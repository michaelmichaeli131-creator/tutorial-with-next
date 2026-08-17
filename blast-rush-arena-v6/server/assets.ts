/**
 * In-memory static asset cache with pre-negotiated compressed variants.
 *
 * The previous implementation called Deno.readFile on every request. On Deno Deploy the module
 * filesystem is network-backed, so each of the seventeen assets an initial page load pulls cost a
 * fresh remote read of up to 271 KB, and none of it was compressed. This reads a file at most once
 * per deployment, hashes it for a strong ETag, and keeps the encoded bodies alongside the raw
 * bytes so a warm request is a Map lookup.
 *
 * The filesystem and the compression codec are injected rather than imported so the caching and
 * negotiation behaviour can be exercised outside Deno.
 */

import {
  cacheControlFor,
  type Encoding,
  etagFor,
  etagMatches,
  isCompressible,
  MIN_COMPRESS_BYTES,
  negotiateEncoding,
} from "./http_cache.ts";

export interface AssetSource {
  /** Reject (any error) when the path is absent; the caller turns that into a 404. */
  read(path: string): Promise<Uint8Array>;
  /**
   * Cheap change fingerprint, or null when unavailable. Only consulted in revalidating mode, so a
   * source backed by an immutable deployment may return null unconditionally.
   */
  stamp(path: string): Promise<string | null>;
}

export interface Codec {
  readonly encodings: readonly Encoding[];
  compress(encoding: "br" | "gzip", data: Uint8Array, level: number): Promise<Uint8Array>;
}

/**
 * Brotli at quality 11 takes ~486 ms for game.js versus ~9 ms at quality 5, for 68.6 KB against
 * 77.8 KB. Paying half a second on the first request of a cold isolate is exactly the stall we are
 * here to remove, so the first caller gets the cheap pass and a background upgrade replaces it.
 * Gzip has no equivalent trade-off (level 9 is ~10 ms), so it has no second pass.
 */
const LEVELS: Record<"br" | "gzip", { fast: number; max: number }> = {
  br: { fast: 5, max: 11 },
  gzip: { fast: 9, max: 9 },
};

interface Variant {
  body: Uint8Array;
  etag: string;
  level: number;
  /**
   * What the body is actually encoded as, which is not always what was negotiated: a codec failure
   * degrades to identity, and labelling those raw bytes `br` anyway would hand the client something
   * it cannot decode.
   */
  encoding: Encoding;
}

interface Entry {
  stamp: string | null;
  raw: Uint8Array;
  hash: string;
  contentType: string;
  compressible: boolean;
  variants: Map<Encoding, Variant>;
  inFlight: Map<Encoding, Promise<Variant>>;
}

export interface AssetCacheOptions {
  source: AssetSource;
  codec: Codec;
  mimeFor(path: string): string;
  /**
   * When true the cache re-checks the source fingerprint on every lookup. Used for `deno task dev`,
   * where game.js is regenerated from client/game-src while the server is running; a deployment is
   * immutable and skips the check entirely.
   */
  revalidate: boolean;
  /** Applied after read, before hashing, so a rewritten body still gets a matching ETag. */
  transform?(path: string, raw: Uint8Array, cache: AssetCache): Promise<Uint8Array>;
  /** Paths whose contents define the deployment's build id. */
  buildInputs?: readonly string[];
}

export class AssetCache {
  #entries = new Map<string, Entry>();
  #loading = new Map<string, Promise<Entry>>();
  #buildId: Promise<string> | null = null;
  #options: AssetCacheOptions;

  constructor(options: AssetCacheOptions) {
    this.#options = options;
  }

  /** Raw bytes of an asset, loading and caching it if needed. Rejects when the path is absent. */
  async raw(path: string): Promise<Uint8Array> {
    return (await this.#entry(path)).raw;
  }

  /**
   * Short identifier for the current build, derived from the contents of the assets the service
   * worker precaches. Stable within a deployment, different across deployments, which is what lets
   * sw.js decide by itself whether its cache is still valid.
   */
  buildId(): Promise<string> {
    if (!this.#buildId) {
      this.#buildId = (async () => {
        const inputs = this.#options.buildInputs ?? [];
        const parts: string[] = [];
        for (const path of inputs) {
          try {
            parts.push((await this.#entry(path)).hash);
          } catch {
            /* A missing input must not brick sw.js; the remaining inputs still change per deploy. */
            parts.push(`missing:${path}`);
          }
        }
        return (await sha256Hex(new TextEncoder().encode(parts.join("|")))).slice(0, 12);
      })();
    }
    return this.#buildId;
  }

  /**
   * Build the response for a static GET/HEAD.
   *
   * Returns null when the asset does not exist so the caller can apply its SPA fallback.
   */
  async respond(path: string, request: Request, versioned: boolean): Promise<Response | null> {
    let entry: Entry;
    try {
      entry = await this.#entry(path);
    } catch {
      return null;
    }

    const available = entry.compressible ? this.#options.codec.encodings : [];
    const negotiated = negotiateEncoding(request.headers.get("accept-encoding"), available);
    const cacheControl = cacheControlFor(path, versioned);

    /* Settle the conditional before compressing anything. The tag depends only on the content hash
       and the chosen encoding, so a returning player on a cold isolate gets their 304 without the
       server first spending a brotli pass over 271 KB it is about to throw away. */
    if (etagMatches(request.headers.get("if-none-match"), etagFor(entry.hash, negotiated))) {
      // 304 carries no content-type or length, but must repeat the validator and the policy.
      return new Response(null, {
        status: 304,
        headers: {
          "cache-control": cacheControl,
          "etag": etagFor(entry.hash, negotiated),
          "vary": "accept-encoding",
        },
      });
    }

    const variant = await this.#variant(entry, negotiated);
    const encoding = variant.encoding;

    const headers = new Headers({
      "content-type": entry.contentType,
      "cache-control": cacheControl,
      "etag": variant.etag,
      /* Without this a shared cache can hand a brotli body to a client that never asked for one. */
      "vary": "accept-encoding",
      "x-content-type-options": "nosniff",
      "referrer-policy": "strict-origin-when-cross-origin",
    });
    if (encoding !== "identity") headers.set("content-encoding", encoding);
    headers.set("content-length", String(variant.body.length));
    if (request.method === "HEAD") return new Response(null, { status: 200, headers });
    return new Response(variant.body, { status: 200, headers });
  }

  async #entry(path: string): Promise<Entry> {
    const cached = this.#entries.get(path);
    if (cached) {
      if (!this.#options.revalidate) return cached;
      const stamp = await this.#options.source.stamp(path);
      if (stamp === null || stamp === cached.stamp) return cached;
      this.#entries.delete(path);
    }

    /* Single-flight: a cold isolate hit by a burst of parallel requests for game.js would otherwise
       read and compress the same 271 KB once per request. */
    const pending = this.#loading.get(path);
    if (pending) return await pending;

    const load = this.#load(path);
    this.#loading.set(path, load);
    try {
      const entry = await load;
      this.#entries.set(path, entry);
      return entry;
    } finally {
      this.#loading.delete(path);
    }
  }

  async #load(path: string): Promise<Entry> {
    const stamp = this.#options.revalidate ? await this.#options.source.stamp(path) : null;
    let raw = await this.#options.source.read(path);
    if (this.#options.transform) raw = await this.#options.transform(path, raw, this);
    const contentType = this.#options.mimeFor(path);
    return {
      stamp,
      raw,
      hash: (await sha256Hex(raw)).slice(0, 20),
      contentType,
      compressible: isCompressible(contentType) && raw.length >= MIN_COMPRESS_BYTES,
      variants: new Map(),
      inFlight: new Map(),
    };
  }

  async #variant(entry: Entry, encoding: Encoding): Promise<Variant> {
    const ready = entry.variants.get(encoding);
    if (ready) return ready;
    if (encoding === "identity") {
      const variant: Variant = { body: entry.raw, etag: etagFor(entry.hash, "identity"), level: 0, encoding: "identity" };
      entry.variants.set(encoding, variant);
      return variant;
    }

    const pending = entry.inFlight.get(encoding);
    if (pending) return await pending;

    const levels = LEVELS[encoding];
    const work = (async (): Promise<Variant> => {
      const body = await this.#options.codec.compress(encoding, entry.raw, levels.fast);
      return { body, etag: etagFor(entry.hash, encoding), level: levels.fast, encoding };
    })();
    entry.inFlight.set(encoding, work);

    let variant: Variant;
    try {
      variant = await work;
    } catch {
      /* Compression failing must never fail the request; fall back to the raw bytes. */
      entry.inFlight.delete(encoding);
      return await this.#variant(entry, "identity");
    }
    entry.inFlight.delete(encoding);
    entry.variants.set(encoding, variant);
    if (levels.max > levels.fast) this.#scheduleUpgrade(entry, encoding, levels.max);
    return variant;
  }

  /**
   * Recompress at full quality once the request that triggered the first pass has been answered.
   * The decoded bytes are identical, so the ETag is unchanged and any 304 already issued stays
   * valid; only the number of bytes on the wire improves.
   */
  #scheduleUpgrade(entry: Entry, encoding: Encoding, level: number): void {
    setTimeout(async () => {
      try {
        const current = entry.variants.get(encoding);
        if (!current || current.level >= level) return;
        const body = await this.#options.codec.compress(encoding, entry.raw, level);
        const latest = entry.variants.get(encoding);
        /* The entry may have been replaced by a dev-mode reload while we were compressing. */
        if (latest !== current) return;
        if (body.length < current.body.length) {
          entry.variants.set(encoding, { body, etag: current.etag, level, encoding });
        } else {
          entry.variants.set(encoding, { ...current, level });
        }
      } catch {
        /* Keep the fast variant; an upgrade failure is not worth surfacing. */
      }
    }, 0);
  }
}

async function sha256Hex(data: Uint8Array): Promise<string> {
  const view = new Uint8Array(data);
  const digest = await crypto.subtle.digest("SHA-256", view);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}
