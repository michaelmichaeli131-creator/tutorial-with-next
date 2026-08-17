import {
  cacheControlFor,
  etagFor,
  etagMatches,
  isCompressible,
  isVersionedRequest,
  negotiateEncoding,
  parseAcceptEncoding,
} from "./http_cache.ts";

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

Deno.test("parses Accept-Encoding qvalues", () => {
  const values = parseAcceptEncoding("gzip;q=0.8, br;q=1.0, *;q=0.1");
  assert(values.get("gzip") === 0.8, "gzip qvalue");
  assert(values.get("br") === 1, "br qvalue");
  assert(values.get("*") === 0.1, "wildcard qvalue");
  // Some older Android WebViews still send the x- prefixed form.
  assert(parseAcceptEncoding("x-gzip").get("gzip") === 1, "x-gzip alias");
  assert(parseAcceptEncoding(null).size === 0, "absent header");
});

Deno.test("negotiates the best available encoding", () => {
  const both = ["br", "gzip"] as const;
  assert(negotiateEncoding("gzip, deflate, br", both) === "br", "prefers brotli");
  assert(negotiateEncoding("gzip", both) === "gzip", "gzip only");
  assert(negotiateEncoding("gzip, br", ["gzip"]) === "gzip", "brotli unavailable server-side");
  // A client that explicitly refuses brotli must never receive it.
  assert(negotiateEncoding("br;q=0, gzip", both) === "gzip", "br refused");
  assert(negotiateEncoding("br;q=0, gzip;q=0", both) === "identity", "everything refused");
  assert(negotiateEncoding("*", both) === "br", "wildcard");
  // No header at all means the peer never advertised a decoder; guessing produces garbage.
  assert(negotiateEncoding(null, both) === "identity", "absent header");
  assert(negotiateEncoding("gzip, deflate, br", []) === "identity", "no codec available");
});

Deno.test("only compresses types that benefit", () => {
  assert(isCompressible("text/javascript; charset=utf-8"), "js");
  assert(isCompressible("text/css; charset=utf-8"), "css");
  assert(isCompressible("image/svg+xml"), "svg");
  assert(isCompressible("application/manifest+json; charset=utf-8"), "manifest");
  assert(!isCompressible("image/png"), "png");
  assert(!isCompressible("image/webp"), "webp");
  assert(!isCompressible("audio/mpeg"), "mp3");
  assert(!isCompressible("application/octet-stream"), "unknown");
});

Deno.test("cache policy keeps deploy-critical files revalidating", () => {
  // Both spellings occur: request paths carry a leading slash, asset keys do not.
  assert(cacheControlFor("sw.js", false) === "no-cache", "sw.js key");
  assert(cacheControlFor("/sw.js", false) === "no-cache", "sw.js path");
  assert(cacheControlFor("index.html", false) === "no-cache", "index.html");
  assert(cacheControlFor("manifest.webmanifest", false) === "no-cache", "manifest");
  // game.js has no content hash in its URL, so it can never be frozen.
  assert(cacheControlFor("game.js", false) === "public, max-age=0, must-revalidate", "game.js");
  assert(cacheControlFor("game.js", true) === "public, max-age=31536000, immutable", "versioned game.js");
  // A version query must not override the no-cache rule for the bootstrap documents.
  assert(cacheControlFor("sw.js", true) === "no-cache", "versioned sw.js stays no-cache");
});

Deno.test("detects cache-busting queries", () => {
  assert(isVersionedRequest(new URLSearchParams("v=abc")), "v");
  assert(isVersionedRequest(new URLSearchParams("build=7")), "build");
  assert(!isVersionedRequest(new URLSearchParams("")), "none");
});

Deno.test("etags distinguish encodings and compare per RFC 9110", () => {
  const identity = etagFor("abc123", "identity");
  const brotli = etagFor("abc123", "br");
  const gzip = etagFor("abc123", "gzip");
  assert(identity === '"abc123"', "identity tag");
  assert(brotli === '"abc123-br"', "brotli tag");
  // Same bytes decoded, different bytes transferred: a shared cache must not confuse them.
  assert(new Set([identity, brotli, gzip]).size === 3, "distinct tags");

  assert(etagMatches('"abc123-br"', brotli), "exact match");
  assert(etagMatches('W/"abc123-br"', brotli), "weakened by a proxy");
  assert(etagMatches('"other", "abc123-br"', brotli), "list match");
  assert(etagMatches("*", brotli), "wildcard");
  assert(!etagMatches('"abc123"', brotli), "different encoding must not match");
  assert(!etagMatches(null, brotli), "absent header");
});
