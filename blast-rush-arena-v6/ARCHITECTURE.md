# Blast Rush Arena V6 — Architecture

## Runtime topology

```text
Browser / installable PWA
  ├─ Canvas simulation and procedural rendering
  ├─ Web Audio adaptive music and SFX
  ├─ Local progression / unlocked skins
  ├─ REST: tables, challenges and leaderboard
  └─ WebSocket: matchmaking, rooms, score, pressure and Core Volley
             │
             ▼
Deno dynamic application
  ├─ Static client hosting
  ├─ REST API
  ├─ WebSocket gateway
  ├─ Matchmaker and room state
  ├─ Canonical score / ammo / pressure validation
  └─ Deno KV persistence
```

## Live duel protocol

1. The client sends `hello` with a stable guest ID, display name and selected skin.
2. The player chooses Quick Match, a public table, a private room or code join.
3. At two players, the server creates a shared Seed, synchronized start time and 120-second end time.
4. Clients generate the same base challenge from that Seed.
5. Sequenced score events are checked against event-specific caps and rate limits.
6. The server owns canonical score, pressure, ammunition, sent/defused counters and timer.
7. Valid score accumulation grants Volley ammunition. `launch_core` spends one ammo and the server creates the Rival Core payload delivered to the opponent.
8. Pressure attacks and Core Volley are separate tactical resources.
9. State is broadcast every 400 ms. A disconnected player has a 12-second reconnect grace period.
10. The server decides the result and coordinates rematch consensus.

## Persistence

Deno KV stores asynchronous challenges and leaderboard entries. Player cosmetics/progression remain local in this Alpha. Live WebSocket room state remains process-local because sockets cannot be persisted directly.

## Alpha security controls

- Name, skin, table name and room-code sanitization.
- Request body limits and static path traversal protection.
- Strict sequence numbers.
- Per-second score-event caps.
- Event-specific score limits.
- Server-owned timer, score, ammo and pressure.
- Core launch cooldown and ammunition ownership.
- Reconnect session replacement protection.
- No third-party browser runtime dependencies.

## Production roadmap

For ranked release, make spawns and hit validation server-authoritative: the server should issue object IDs/timestamps and clients should submit only inputs. Add signed identities/passkeys, moderation/reporting, replay storage, OpenTelemetry, external rate limiting, regional matchmaking and shared room ownership through sticky routing plus Redis/NATS or a dedicated stateful game service.
