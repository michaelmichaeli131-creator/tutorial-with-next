import { buildClient } from "../scripts/build_client.ts";
import { Matchmaker } from "./matchmaker.ts";
import { GameStore } from "./store.ts";
import { cleanCode, cleanName, safeNumber } from "./protocol.ts";
import { AssetCache } from "./assets.ts";
import { isVersionedRequest } from "./http_cache.ts";
import { BUILD_INPUTS, createCodec, createDenoSource, mimeFor, resolveClientPath, stampBuild, transformAsset } from "./static.ts";

const PORT = Number(Deno.env.get("PORT") ?? 8000);
/**
 * Deploy sets this; a local `deno task dev` does not. It distinguishes an immutable deployment,
 * where the client tree cannot change under us, from a watch-mode run where game.js is regenerated
 * from client/game-src while the server is up.
 */
const DEPLOYMENT_ID = Deno.env.get("DENO_DEPLOYMENT_ID");

if (DEPLOYMENT_ID) {
  // The build already ran as part of the deployment, and the filesystem is read-only. Attempting it
  // again re-stats every source part on each cold start only to fail at the write, which is pure
  // added latency on exactly the request that is already paying for the cold start.
  console.log("[build] deployment detected; using prebuilt client/game.js");
} else {
  try {
    await buildClient();
  } catch (error) {
    // Production runtimes may expose a read-only filesystem. The generated
    // client/game.js is committed and built during deployment, so startup can
    // safely continue when a runtime rebuild is unavailable.
    console.warn(`[build] using prebuilt client/game.js: ${error instanceof Error ? error.message : String(error)}`);
  }
}
const CLIENT_ROOT = new URL("../client/", import.meta.url);
const matchmaker = new Matchmaker();
const store = new GameStore();
await store.init();

const codec = await createCodec();
const assets = new AssetCache({
  source: createDenoSource(CLIENT_ROOT),
  codec,
  mimeFor,
  revalidate: !DEPLOYMENT_ID,
  transform: transformAsset,
  buildInputs: BUILD_INPUTS,
});
console.log(`[static] in-memory cache ready; encodings: ${codec.encodings.join(", ") || "identity only"}`);

Deno.serve({ port: PORT }, async (request) => {
  const url = new URL(request.url);

  if (url.pathname === "/ws") {
    if (request.headers.get("upgrade")?.toLowerCase() !== "websocket") return text("WebSocket upgrade required", 426);
    const { socket, response } = Deno.upgradeWebSocket(request, { idleTimeout: 120 });
    matchmaker.attach(socket);
    return response;
  }

  if (url.pathname === "/api/health") return json({ ok: true, service: "blast-rush-arena", version: "6.0", at: Date.now() });
  if (url.pathname === "/api/tables" && request.method === "GET") return json({ tables: matchmaker.publicTables() });
  if (url.pathname === "/api/leaderboard" && request.method === "GET") return json({ entries: await store.getLeaderboard() });

  /* The daily board. GET is open; POST only accepts the current UTC day, because a client that can
     post to an arbitrary day could quietly fill in every board back to the epoch, and because a
     score for a field nobody can play any more is not a score anybody can check. */
  if (url.pathname === "/api/daily" && request.method === "GET") {
    const day = cleanDay(url.searchParams.get("day")) || utcDay();
    return json({ day, entries: await store.getDailyBoard(day) });
  }

  if (url.pathname === "/api/daily" && request.method === "POST") {
    const body = await readJson(request);
    if (!body) return json({ error: "Invalid JSON" }, 400);
    const day = cleanDay(body.day);
    if (!day) return json({ error: "Invalid day" }, 400);
    if (day !== utcDay()) return json({ error: "Day is closed" }, 409);
    const entries = await store.addDailyScore(day, {
      name: cleanName(body.name),
      score: safeNumber(body.score, 0, 2_000_000_000),
      wave: safeNumber(body.wave, 1, 999),
      at: Date.now(),
    });
    const name = cleanName(body.name);
    const rank = entries.findIndex((e) => e.name === name);
    return json({ day, rank: rank < 0 ? null : rank + 1, total: entries.length, entries: entries.slice(0, 10) });
  }

  if (url.pathname === "/api/challenges" && request.method === "POST") {
    const body = await readJson(request);
    if (!body) return json({ error: "Invalid JSON" }, 400);
    const record = await store.createChallenge({
      creatorName: cleanName(body.creatorName),
      score: safeNumber(body.score, 0, 2_000_000_000),
      wave: safeNumber(body.wave, 1, 999),
      perfects: safeNumber(body.perfects, 0, 100_000),
      maxCombo: safeNumber(body.maxCombo, 0, 100_000),
      stage: String(body.stage ?? "Nebula Forge").slice(0, 40),
      seed: safeNumber(body.seed, 1, 0xffff_ffff),
    });
    return json({ challenge: publicChallenge(record) }, 201);
  }

  const challengeMatch = url.pathname.match(/^\/api\/challenges\/([A-Z0-9]{4,8})(?:\/attempt)?$/i);
  if (challengeMatch) {
    const code = cleanCode(challengeMatch[1]);
    if (request.method === "GET" && !url.pathname.endsWith("/attempt")) {
      const record = await store.getChallenge(code);
      return record ? json({ challenge: publicChallenge(record) }) : json({ error: "Challenge not found" }, 404);
    }
    if (request.method === "POST" && url.pathname.endsWith("/attempt")) {
      const body = await readJson(request);
      if (!body) return json({ error: "Invalid JSON" }, 400);
      const record = await store.addAttempt(code, {
        name: cleanName(body.name),
        score: safeNumber(body.score, 0, 2_000_000_000),
        wave: safeNumber(body.wave, 1, 999),
        perfects: safeNumber(body.perfects, 0, 100_000),
        maxCombo: safeNumber(body.maxCombo, 0, 100_000),
        createdAt: Date.now(),
      });
      if (!record) return json({ error: "Challenge not found" }, 404);
      const attempt = record.attempts.find((entry) => entry.name === cleanName(body.name) && entry.score === safeNumber(body.score, 0, 2_000_000_000));
      const rank = record.attempts.findIndex((entry) => entry === attempt) + 1;
      return json({
        result: {
          beatCreator: safeNumber(body.score, 0, 2_000_000_000) > record.score,
          creatorScore: record.score,
          rank: rank || record.attempts.length,
          attempts: record.attempts.length,
        },
        challenge: publicChallenge(record),
      });
    }
  }

  if (request.method !== "GET" && request.method !== "HEAD") return text("Method not allowed", 405);
  return serveStatic(request, url);
});

console.log(`Blast Rush Arena V6 running on http://localhost:${PORT}`);

async function serveStatic(request: Request, url: URL): Promise<Response> {
  const requested = resolveClientPath(url.pathname, CLIENT_ROOT);
  if (requested === null) return text("Forbidden", 403);

  const versioned = isVersionedRequest(url.searchParams);
  const response = await assets.respond(requested, request, versioned);
  if (response) return await stampBuild(requested, response, assets);

  // Unknown extensionless paths are client routes, not missing files, so they get the shell back.
  // The previous version served that fallback with no cache-control at all, which let browsers
  // apply heuristic caching to the one document that must never be stale.
  if (!url.pathname.startsWith("/api/") && !url.pathname.includes(".")) {
    const fallback = await assets.respond("index.html", request, false);
    if (fallback) return await stampBuild("index.html", fallback, assets);
  }
  return text("Not found", 404);
}

async function readJson(request: Request): Promise<Record<string, unknown> | null> {
  try {
    if (Number(request.headers.get("content-length") ?? 0) > 20_000) return null;
    return await request.json();
  } catch {
    return null;
  }
}

function publicChallenge(record: Awaited<ReturnType<GameStore["createChallenge"]>>) {
  return {
    code: record.code,
    creatorName: record.creatorName,
    score: record.score,
    wave: record.wave,
    perfects: record.perfects,
    maxCombo: record.maxCombo,
    stage: record.stage,
    seed: record.seed,
    createdAt: record.createdAt,
    expiresAt: record.expiresAt,
    attempts: record.attempts.slice(0, 10),
  };
}

/* The client derives the same string from the same UTC date, so no clock negotiation is needed —
   both sides agree on the key or neither does. */
function utcDay(date = new Date()): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${date.getUTCFullYear()}-${p(date.getUTCMonth() + 1)}-${p(date.getUTCDate())}`;
}

/* Shape-checked rather than merely stringified: this value becomes part of a storage key, so it has
   to be exactly a date and nothing else. */
function cleanDay(value: unknown): string | null {
  const raw = String(value ?? "").slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : null;
}

function json(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "access-control-allow-origin": "*",
    },
  });
}

function text(value: string, status = 200): Response {
  return new Response(value, { status, headers: { "content-type": "text/plain; charset=utf-8" } });
}
