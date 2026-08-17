/**
 * Content negotiation and cache-policy rules for static delivery.
 *
 * Deliberately free of Deno APIs. The rules here decide what the client receives and are the part
 * most likely to be subtly wrong (a mis-parsed `br;q=0` means we ship brotli to something that
 * cannot read it), so they are kept pure and covered directly by tests. assets.ts owns the I/O.
 */

export type Encoding = "br" | "gzip" | "identity";

/** Order we fall back through when the client is equally happy with several encodings. */
const PREFERENCE: readonly Encoding[] = ["br", "gzip", "identity"];

/**
 * Below this size compression loses: gzip/brotli framing plus the extra `Vary` cache split costs
 * more than the handful of bytes saved, and every response still pays a CPU pass.
 */
export const MIN_COMPRESS_BYTES = 256;

const COMPRESSIBLE_TYPES = new Set([
  "application/javascript",
  "application/json",
  "application/manifest+json",
  "application/wasm",
  "application/xml",
  "image/svg+xml",
]);

/**
 * Parse `Accept-Encoding` into token -> qvalue.
 *
 * Tokens are returned verbatim apart from case; `x-gzip` is normalised because some older Android
 * WebViews still send it and would otherwise be served identity.
 */
export function parseAcceptEncoding(header: string | null | undefined): Map<string, number> {
  const values = new Map<string, number>();
  if (!header) return values;
  for (const segment of header.split(",")) {
    const [rawToken, ...parameters] = segment.split(";");
    let token = rawToken.trim().toLowerCase();
    if (!token) continue;
    if (token === "x-gzip") token = "gzip";
    if (token === "x-compress") token = "compress";
    let quality = 1;
    for (const parameter of parameters) {
      const separator = parameter.indexOf("=");
      if (separator < 0) continue;
      if (parameter.slice(0, separator).trim().toLowerCase() !== "q") continue;
      const parsed = Number.parseFloat(parameter.slice(separator + 1).trim());
      /* A malformed q is treated as "acceptable" rather than 0: dropping to identity on a typo
         costs every byte of the payload, while the reverse only risks a re-request. */
      quality = Number.isFinite(parsed) ? Math.min(Math.max(parsed, 0), 1) : 1;
    }
    values.set(token, quality);
  }
  return values;
}

/**
 * Choose the encoding to serve.
 *
 * A completely absent `Accept-Encoding` resolves to identity rather than to gzip. Every real
 * browser sends the header, so the only callers that omit it are scripts and intermediaries that
 * genuinely cannot decode, and guessing on their behalf produces unreadable bytes.
 */
export function negotiateEncoding(
  header: string | null | undefined,
  available: readonly Encoding[],
): Encoding {
  const accepted = parseAcceptEncoding(header);
  const wildcard = accepted.get("*");
  let best: Encoding = "identity";
  let bestQuality = -1;

  for (const encoding of PREFERENCE) {
    if (encoding !== "identity" && !available.includes(encoding)) continue;
    let quality = accepted.get(encoding);
    if (quality === undefined) quality = wildcard;
    if (quality === undefined) quality = encoding === "identity" ? 1 : 0;
    /* Strictly-greater keeps PREFERENCE as the tie-break, so `gzip, br` still yields brotli. */
    if (quality > 0 && quality > bestQuality) {
      bestQuality = quality;
      best = encoding;
    }
  }
  return best;
}

/** Whether a media type is worth a compression pass. Already-compressed binaries are excluded. */
export function isCompressible(contentType: string): boolean {
  const type = contentType.split(";")[0]!.trim().toLowerCase();
  if (!type) return false;
  if (type.startsWith("text/")) return true;
  if (type.endsWith("+json") || type.endsWith("+xml")) return true;
  return COMPRESSIBLE_TYPES.has(type);
}

/**
 * Cache lifetime for a static path.
 *
 * `client/game.js` is a build artifact served from a URL with no content hash in it, so it can
 * never be `immutable`: a deploy would leave every returning player pinned to the previous build
 * until their cache expired. It gets must-revalidate instead, which combined with a strong ETag
 * turns a repeat visit into a ~200 byte 304 rather than 271 KB. Paths that *do* carry a version
 * query are safe to freeze, so the client owners can opt in later without a server change.
 */
export function cacheControlFor(pathname: string, versioned: boolean): string {
  /* Callers pass either a request path ("/sw.js") or a root-relative asset key ("sw.js"), so
     normalise before matching. Missing that distinction is how sw.js first picked up a
     revalidate-only policy here instead of no-cache. */
  const path = pathname.toLowerCase().replace(/^\/+/, "");
  /* index.html bootstraps every other URL, sw.js decides which build the client runs, and the
     manifest names them both. If any of the three sticks, a deploy silently fails to land. */
  if (path === "" || path.endsWith(".html") || path === "sw.js" || path.endsWith(".webmanifest")) {
    return "no-cache";
  }
  if (versioned) return "public, max-age=31536000, immutable";
  return "public, max-age=0, must-revalidate";
}

/** True when the URL carries a cache-busting token, which makes a long immutable lifetime safe. */
export function isVersionedRequest(search: URLSearchParams): boolean {
  return search.has("v") || search.has("build") || search.has("hash");
}

/** Strong ETag for a representation. Encoding is part of the tag because the bytes differ. */
export function etagFor(contentHash: string, encoding: Encoding): string {
  const suffix = encoding === "identity" ? "" : `-${encoding === "gzip" ? "gz" : "br"}`;
  return `"${contentHash}${suffix}"`;
}

/**
 * RFC 9110 If-None-Match comparison.
 *
 * Weak validators compare equal here: we only ever emit strong tags, but proxies are entitled to
 * weaken them in transit and a missed match costs a full re-download.
 */
export function etagMatches(ifNoneMatch: string | null | undefined, etag: string): boolean {
  if (!ifNoneMatch) return false;
  const strip = (value: string) => {
    const trimmed = value.trim();
    return trimmed.startsWith("W/") ? trimmed.slice(2) : trimmed;
  };
  const target = strip(etag);
  for (const candidate of ifNoneMatch.split(",")) {
    const normalised = strip(candidate);
    if (normalised === "*" || normalised === target) return true;
  }
  return false;
}
