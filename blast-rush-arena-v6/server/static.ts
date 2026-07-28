/**
 * Deno-side bindings for the static asset cache: filesystem access, MIME typing, path safety and
 * the compression codec.
 */

import type { AssetCache, AssetSource, Codec } from "./assets.ts";
import type { Encoding } from "./http_cache.ts";

const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".webmanifest": "application/manifest+json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  // Art-pack formats. Without these an art pack is served as octet-stream, which browsers will
  // often still decode but which breaks caching heuristics and Safari's image pipeline.
  ".webp": "image/webp",
  ".avif": "image/avif",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".ktx2": "image/ktx2",
  ".mp3": "audio/mpeg",
  ".ogg": "audio/ogg",
  ".wav": "audio/wav",
};

/** Assets whose contents define the build id handed to the service worker. */
export const BUILD_INPUTS: readonly string[] = ["index.html", "net.js", "game.js"];

/** Placeholder in client/sw.js, substituted per deployment so the worker can self-invalidate. */
const BUILD_ID_TOKEN = "__BUILD_ID__";

export function mimeFor(path: string): string {
  const dot = path.lastIndexOf(".");
  const slash = path.lastIndexOf("/");
  if (dot < 0 || dot < slash) return "application/octet-stream";
  return MIME[path.slice(dot).toLowerCase()] ?? "application/octet-stream";
}

/**
 * Map a request path to a path relative to the client root, or null when it escapes.
 *
 * Resolving against the root and re-checking the prefix catches encoded traversals that a plain
 * ".." substring test misses, such as `/%2e%2e/server/store.ts`.
 */
export function resolveClientPath(pathname: string, root: URL): string | null {
  let requested: string;
  try {
    requested = pathname === "/" ? "index.html" : decodeURIComponent(pathname.slice(1));
  } catch {
    return null;
  }
  if (!requested || requested.endsWith("/")) requested += "index.html";
  if (requested.includes("\\") || requested.includes("\0")) return null;
  const resolved = new URL(requested, root);
  if (!resolved.href.startsWith(root.href)) return null;
  return decodeURIComponent(resolved.href.slice(root.href.length));
}

export function createDenoSource(root: URL): AssetSource {
  return {
    async read(path) {
      return await Deno.readFile(new URL(path, root));
    },
    async stamp(path) {
      try {
        const info = await Deno.stat(new URL(path, root));
        return `${info.mtime?.getTime() ?? 0}:${info.size}`;
      } catch {
        return null;
      }
    },
  };
}

/**
 * Build a compression codec for the current runtime.
 *
 * Brotli is not part of the WHATWG CompressionStream set, so it only exists here via node:zlib.
 * Rather than assume that is present and wired up on Deploy, each algorithm is probed once at
 * startup and only advertised if it actually produced output — advertising an encoding we cannot
 * generate would send clients bytes they cannot decode.
 *
 * The async (callback) zlib entry points are used deliberately: the synchronous ones would park the
 * isolate for the duration of a brotli pass, which on game.js is long enough to stall the very
 * request loop this cache exists to speed up.
 */
export async function createCodec(): Promise<Codec> {
  const encodings: Encoding[] = [];
  const probe = new TextEncoder().encode("blast-rush-arena-compression-probe".repeat(8));

  let gzip: ((data: Uint8Array, level: number) => Promise<Uint8Array>) | null = null;
  let brotli: ((data: Uint8Array, level: number) => Promise<Uint8Array>) | null = null;

  try {
    const zlib = await import("node:zlib");
    const constants = zlib.constants;

    const candidateGzip = (data: Uint8Array, level: number) =>
      new Promise<Uint8Array>((resolve, reject) => {
        zlib.gzip(data, { level }, (error, result) => {
          if (error) reject(error);
          else resolve(new Uint8Array(result));
        });
      });
    const candidateBrotli = (data: Uint8Array, level: number) =>
      new Promise<Uint8Array>((resolve, reject) => {
        zlib.brotliCompress(data, {
          params: {
            [constants.BROTLI_PARAM_QUALITY]: level,
            [constants.BROTLI_PARAM_SIZE_HINT]: data.length,
          },
        }, (error, result) => {
          if (error) reject(error);
          else resolve(new Uint8Array(result));
        });
      });

    try {
      if ((await candidateGzip(probe, 9)).length > 0) gzip = candidateGzip;
    } catch { /* Probed and unusable; the CompressionStream path below still applies. */ }
    try {
      if ((await candidateBrotli(probe, 5)).length > 0) brotli = candidateBrotli;
    } catch { /* No brotli on this runtime; gzip alone is still a 3x reduction. */ }
  } catch {
    /* node:zlib unavailable entirely. */
  }

  if (!gzip && typeof CompressionStream === "function") {
    const streamGzip = async (data: Uint8Array) => {
      const compressed = new Response(data).body!.pipeThrough(new CompressionStream("gzip"));
      return new Uint8Array(await new Response(compressed).arrayBuffer());
    };
    try {
      if ((await streamGzip(probe)).length > 0) gzip = streamGzip;
    } catch { /* Serve identity. */ }
  }

  if (brotli) encodings.push("br");
  if (gzip) encodings.push("gzip");

  return {
    encodings,
    compress(encoding, data, level) {
      if (encoding === "br" && brotli) return brotli(data, level);
      if (encoding === "gzip" && gzip) return gzip(data, level);
      return Promise.reject(new Error(`unsupported encoding ${encoding}`));
    },
  };
}

/**
 * Advertise the running build on the document response.
 *
 * The service worker compares this against the id compiled into its own body. A worker that has not
 * been replaced yet can therefore tell it is serving the previous deployment and stop answering
 * asset requests from its cache, which closes the one-navigation window in which a returning player
 * would otherwise run a stale game.js.
 */
export async function stampBuild(path: string, response: Response, cache: AssetCache): Promise<Response> {
  if (!path.endsWith(".html")) return response;
  response.headers.set("x-build", await cache.buildId());
  return response;
}

/**
 * Rewrite sw.js with the current build id.
 *
 * The service worker's cache name is derived from this value, so a deploy changes the worker's own
 * bytes, which is the only signal a browser acts on when deciding to install a new worker. Bumping
 * the constant by hand was the previous mechanism and it only works when somebody remembers.
 */
export async function transformAsset(path: string, raw: Uint8Array, cache: AssetCache): Promise<Uint8Array> {
  if (path !== "sw.js") return raw;
  const source = new TextDecoder().decode(raw);
  if (!source.includes(BUILD_ID_TOKEN)) return raw;
  return new TextEncoder().encode(source.replaceAll(BUILD_ID_TOKEN, await cache.buildId()));
}
