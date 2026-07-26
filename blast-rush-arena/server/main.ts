import { buildClient } from "../scripts/build_client.ts";
import { Matchmaker } from "./matchmaker.ts";
import { GameStore } from "./store.ts";
import { cleanCode, cleanName, safeNumber } from "./protocol.ts";

const PORT = Number(Deno.env.get("PORT") ?? 8000);
await buildClient();
const CLIENT_ROOT = new URL("../client/", import.meta.url);
const matchmaker = new Matchmaker();
const store = new GameStore();
await store.init();

const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".webmanifest": "application/manifest+json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
};

Deno.serve({ port: PORT }, async (request) => {
  const url = new URL(request.url);

  if (url.pathname === "/ws") {
    if (request.headers.get("upgrade")?.toLowerCase() !== "websocket") return text("WebSocket upgrade required", 426);
    const { socket, response } = Deno.upgradeWebSocket(request, { idleTimeout: 120 });
    matchmaker.attach(socket);
    return response;
  }

  if (url.pathname === "/api/health") return json({ ok: true, service: "blast-rush-arena", at: Date.now() });
  if (url.pathname === "/api/leaderboard" && request.method === "GET") return json({ entries: await store.getLeaderboard() });

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
  return serveStatic(url.pathname);
});

console.log(`Blast Rush Arena running on http://localhost:${PORT}`);

async function serveStatic(pathname: string): Promise<Response> {
  let requested: string;
  try {
    requested = pathname === "/" ? "index.html" : decodeURIComponent(pathname.slice(1));
  } catch {
    return text("Bad request", 400);
  }
  if (requested.includes("..") || requested.includes("\\")) return text("Forbidden", 403);
  const fileUrl = new URL(requested, CLIENT_ROOT);
  try {
    const data = await Deno.readFile(fileUrl);
    const ext = requested.includes(".") ? requested.slice(requested.lastIndexOf(".")) : "";
    return new Response(data, {
      headers: {
        "content-type": MIME[ext] ?? "application/octet-stream",
        "cache-control": ext === ".html" ? "no-cache" : "public, max-age=3600",
        "x-content-type-options": "nosniff",
        "referrer-policy": "strict-origin-when-cross-origin",
      },
    });
  } catch {
    if (!pathname.startsWith("/api/") && !pathname.includes(".")) {
      try {
        return new Response(await Deno.readFile(new URL("index.html", CLIENT_ROOT)), { headers: { "content-type": MIME[".html"] } });
      } catch { /* fall through */ }
    }
    return text("Not found", 404);
  }
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
