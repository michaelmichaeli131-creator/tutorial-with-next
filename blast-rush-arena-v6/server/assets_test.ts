import { AssetCache, type AssetSource, type Codec } from "./assets.ts";

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

const encoder = new TextEncoder();

/** Stub filesystem whose contents and fingerprints can be mutated mid-test. */
function stubSource(files: Record<string, string>) {
  const state = { reads: 0, files: { ...files }, stamps: {} as Record<string, string> };
  for (const name of Object.keys(state.files)) state.stamps[name] = "1";
  const source: AssetSource = {
    read(path) {
      const value = state.files[path];
      if (value === undefined) return Promise.reject(new Error(`missing ${path}`));
      state.reads++;
      return Promise.resolve(encoder.encode(value));
    },
    stamp(path) {
      return Promise.resolve(state.stamps[path] ?? null);
    },
  };
  return { source, state };
}

/**
 * Deterministic stand-in for zlib: output length shrinks as the level rises, which is what the
 * background-upgrade path keys off. Not a real codec — the real one is exercised by the wire test.
 */
const codec: Codec = {
  encodings: ["br", "gzip"],
  compress(encoding, data, level) {
    const size = Math.max(1, Math.floor(data.length / level));
    const out = new Uint8Array(size);
    out.fill(encoding === "br" ? 1 : 2);
    return Promise.resolve(out);
  },
};

const mimeFor = (path: string) => path.endsWith(".js") ? "text/javascript; charset=utf-8" : path.endsWith(".png") ? "image/png" : "text/html; charset=utf-8";

function get(path: string, headers: Record<string, string> = {}) {
  return new Request(`http://localhost/${path}`, { headers });
}

Deno.test("reads each asset from the source only once", async () => {
  const { source, state } = stubSource({ "game.js": "x".repeat(4000) });
  const cache = new AssetCache({ source, codec, mimeFor, revalidate: false });

  for (let i = 0; i < 25; i++) {
    const response = await cache.respond("game.js", get("game.js", { "accept-encoding": "br" }), false);
    assert(response?.status === 200, "served");
  }
  // The whole point of the cache: 25 requests, one read.
  assert(state.reads === 1, `expected 1 read, got ${state.reads}`);
});

Deno.test("concurrent cold requests collapse into a single read", async () => {
  const { source, state } = stubSource({ "game.js": "y".repeat(4000) });
  const cache = new AssetCache({ source, codec, mimeFor, revalidate: false });

  await Promise.all(
    Array.from({ length: 12 }, () => cache.respond("game.js", get("game.js", { "accept-encoding": "br" }), false)),
  );
  assert(state.reads === 1, `expected 1 read under concurrency, got ${state.reads}`);
});

Deno.test("negotiates encoding and returns a matching etag", async () => {
  const { source } = stubSource({ "game.js": "z".repeat(4000) });
  const cache = new AssetCache({ source, codec, mimeFor, revalidate: false });

  const brotli = await cache.respond("game.js", get("game.js", { "accept-encoding": "gzip, br" }), false);
  assert(brotli!.headers.get("content-encoding") === "br", "brotli chosen");
  assert(brotli!.headers.get("vary") === "accept-encoding", "vary present");

  const gzip = await cache.respond("game.js", get("game.js", { "accept-encoding": "gzip" }), false);
  assert(gzip!.headers.get("content-encoding") === "gzip", "gzip chosen");
  assert(gzip!.headers.get("etag") !== brotli!.headers.get("etag"), "etags differ per encoding");

  const plain = await cache.respond("game.js", get("game.js"), false);
  assert(plain!.headers.get("content-encoding") === null, "identity when nothing advertised");
  assert((await plain!.arrayBuffer()).byteLength === 4000, "identity body is the raw file");
});

Deno.test("conditional request returns an empty 304", async () => {
  const { source } = stubSource({ "game.js": "q".repeat(4000) });
  const cache = new AssetCache({ source, codec, mimeFor, revalidate: false });

  const first = await cache.respond("game.js", get("game.js", { "accept-encoding": "br" }), false);
  const etag = first!.headers.get("etag")!;
  await first!.arrayBuffer();

  const second = await cache.respond("game.js", get("game.js", { "accept-encoding": "br", "if-none-match": etag }), false);
  assert(second!.status === 304, "304 expected");
  assert(second!.body === null, "304 must have no body");
  assert(second!.headers.get("etag") === etag, "validator repeated");
  assert(second!.headers.get("cache-control") === "public, max-age=0, must-revalidate", "policy repeated");
});

Deno.test("binary assets are served without a compression pass", async () => {
  const { source } = stubSource({ "sprite.png": "p".repeat(4000) });
  const cache = new AssetCache({ source, codec, mimeFor, revalidate: false });
  const response = await cache.respond("sprite.png", get("sprite.png", { "accept-encoding": "br, gzip" }), false);
  assert(response!.headers.get("content-encoding") === null, "png must not be compressed");
});

Deno.test("revalidating mode picks up a rebuilt game.js", async () => {
  const { source, state } = stubSource({ "game.js": "old".repeat(200) });
  const cache = new AssetCache({ source, codec, mimeFor, revalidate: true });

  const before = await cache.respond("game.js", get("game.js"), false);
  const beforeEtag = before!.headers.get("etag");
  await before!.arrayBuffer();

  // What `deno task dev` does when a client/game-src part changes.
  state.files["game.js"] = "new".repeat(200);
  state.stamps["game.js"] = "2";

  const after = await cache.respond("game.js", get("game.js"), false);
  assert(after!.headers.get("etag") !== beforeEtag, "etag must change when the artifact changes");
  assert(state.reads === 2, `expected a re-read, got ${state.reads} reads`);
});

Deno.test("immutable mode never re-reads even if the source changes", async () => {
  const { source, state } = stubSource({ "game.js": "old".repeat(200) });
  const cache = new AssetCache({ source, codec, mimeFor, revalidate: false });

  await (await cache.respond("game.js", get("game.js"), false))!.arrayBuffer();
  state.files["game.js"] = "new".repeat(200);
  state.stamps["game.js"] = "2";
  await (await cache.respond("game.js", get("game.js"), false))!.arrayBuffer();

  assert(state.reads === 1, `deployment assets are immutable; got ${state.reads} reads`);
});

Deno.test("build id is stable per content and changes with it", async () => {
  const first = stubSource({ "index.html": "<html>", "game.js": "alpha" });
  const cacheA = new AssetCache({ source: first.source, codec, mimeFor, revalidate: false, buildInputs: ["index.html", "game.js"] });
  const idA = await cacheA.buildId();
  assert(idA === await cacheA.buildId(), "build id stable within a deployment");

  const second = stubSource({ "index.html": "<html>", "game.js": "beta" });
  const cacheB = new AssetCache({ source: second.source, codec, mimeFor, revalidate: false, buildInputs: ["index.html", "game.js"] });
  assert(idA !== await cacheB.buildId(), "build id must change when the client changes");
});

Deno.test("sw.js transform receives the build id", async () => {
  const { source } = stubSource({ "index.html": "<html>", "game.js": "alpha", "sw.js": "const BUILD = '__BUILD_ID__';" });
  const cache = new AssetCache({
    source,
    codec,
    mimeFor,
    revalidate: false,
    buildInputs: ["index.html", "game.js"],
    transform: async (path, raw, self) => {
      if (path !== "sw.js") return raw;
      return encoder.encode(new TextDecoder().decode(raw).replaceAll("__BUILD_ID__", await self.buildId()));
    },
  });

  const body = new TextDecoder().decode(await cache.raw("sw.js"));
  assert(!body.includes("__BUILD_ID__"), "placeholder substituted");
  assert(body.includes(await cache.buildId()), "build id present");
});

Deno.test("a failing codec degrades to identity instead of failing the request", async () => {
  const { source } = stubSource({ "game.js": "k".repeat(4000) });
  const broken: Codec = {
    encodings: ["br", "gzip"],
    compress: () => Promise.reject(new Error("codec exploded")),
  };
  const cache = new AssetCache({ source, codec: broken, mimeFor, revalidate: false });

  const response = await cache.respond("game.js", get("game.js", { "accept-encoding": "br, gzip" }), false);
  assert(response!.status === 200, "still served");
  assert(response!.headers.get("content-encoding") === null, "fell back to identity");
  assert((await response!.arrayBuffer()).byteLength === 4000, "raw body intact");
});

Deno.test("missing asset resolves to null so the caller can fall back", async () => {
  const { source } = stubSource({});
  const cache = new AssetCache({ source, codec, mimeFor, revalidate: false });
  assert(await cache.respond("nope.js", get("nope.js"), false) === null, "null for missing");
});
