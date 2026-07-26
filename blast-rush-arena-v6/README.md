# Blast Rush Arena V6 — Titan Volley

A cinematic competitive browser arcade game with a Deno backend, six-world solo progression, Titan Gauntlet boss rush, public tables, private invite rooms, live seeded 1v1, player-launched Rival Cores, pressure attacks, skins, asynchronous challenges, PWA installation and a persistent leaderboard.

## Highlights

- Six procedural worlds with distinct palettes, movement, mutations and boss architecture.
- Six multi-phase bosses plus escalating Omega Titan forms.
- Titan Gauntlet mode: consecutive colossal boss battles with augment choices.
- 120-second live 1v1 on a shared deterministic seed.
- Core Volley: earn ammunition, launch valuable Rival Cores, intercept the opponent's payload and collect bonus score/Shards.
- Public Tables browser, one-click Quick Match, private room codes and direct invite links.
- Eight unlockable cosmetic reactor skins; no pay-to-win stats.
- Original procedural Web Audio soundtrack and SFX. No third-party audio files or runtime dependencies.
- Deno KV challenges/leaderboard, reconnect grace, PWA cache and Web Share support.

## Run locally

1. Install Deno 2.8.1 or newer.
2. Run `deno task start`.
3. Open `http://localhost:8000`.

Windows users can double-click `PLAY_WINDOWS.bat`.

## Validate

```bash
deno task check
deno task test
deno task fmt --check
```

## Deploy

Windows users can run `DEPLOY_DENO_FIRST_TIME.bat` and follow the secure browser sign-in. For subsequent releases use `DEPLOY_DENO_UPDATE.bat`.

The current Deno Deploy platform is configured as a dynamic application with `server/main.ts` as its entrypoint and `deno task build` as the build command. See `DEPLOYMENT.md`.

## Project layout

- `client/` — Canvas renderer, PWA shell, adaptive audio, networking and game source fragments.
- `scripts/build_client.ts` — assembles the ordered source fragments into `client/game.js` without npm.
- `server/main.ts` — HTTP server, public-table API, challenge APIs and WebSocket upgrade.
- `server/matchmaker.ts` — matchmaking, public/private rooms, Core Volley, pressure, reconnect and score validation.
- `server/store.ts` — Deno KV persistence with an in-memory local fallback.
- `ARCHITECTURE.md` — topology, scaling and anti-cheat roadmap.
- `GAME_DESIGN.md` — challenge, retention and social-loop rationale.

## Alpha boundary

This is a feature-complete multiplayer Alpha, not yet a globally scaled ranked service. Before a commercial ranked launch, add authenticated identities, moderation, replay auditing, fully server-authoritative object simulation, telemetry and shared room infrastructure.
