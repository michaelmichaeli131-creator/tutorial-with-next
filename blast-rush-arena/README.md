# Blast Rush Arena V5

A cinematic browser arcade game with a Deno server, solo roguelite progression, live seeded 1v1 duels, pressure attacks, private invite rooms, asynchronous friend challenges and a persistent leaderboard.

## Run locally

1. Install Deno 2.8 or newer.
2. Run `deno task start`.
3. Open `http://localhost:8000`.

Windows users can double-click `PLAY_WINDOWS.bat`.

## Project layout

- `client/` — Canvas interface, networking client, PWA files and game source fragments.
- `scripts/build_client.ts` — dependency-free build step that assembles `client/game.js`.
- `server/main.ts` — HTTP server, static files, challenge APIs and WebSocket upgrade.
- `server/matchmaker.ts` — Quick Match, private rooms, score validation, pressure attacks and rematches.
- `server/store.ts` — Deno KV persistence with in-memory fallback.
- `server/protocol.ts` — shared protocol types, sanitization and score limits.
- `ARCHITECTURE.md` — production architecture, scaling and anti-cheat roadmap.
- `GAME_DESIGN.md` — engagement and virality design rationale.

## Validate

```bash
deno task check
deno task test
deno task fmt --check
```

## Deploy publicly

Run `deno deploy` from this directory. The `deploy.runtime.entrypoint` in `deno.json` points to `server/main.ts`. Use `deno deploy --prod` when promoting an existing app directly to production.

Live duels include a 10-second reconnect grace period. The server preserves room state, canonical score, seed and pressure while the client reconnects.
