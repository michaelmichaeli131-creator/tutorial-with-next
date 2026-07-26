# Blast Rush Arena — Architecture

## Runtime topology

```text
Browser client
  ├─ Canvas simulation and rendering
  ├─ Local progression in localStorage
  ├─ REST: challenges and leaderboard
  └─ WebSocket: rooms, matchmaking and live duel state
             │
             ▼
Deno server
  ├─ Static client hosting
  ├─ REST API
  ├─ WebSocket gateway
  ├─ Matchmaker and room state
  ├─ Score-event validation
  └─ Deno KV persistence
```

## Live duel protocol

1. The player connects and sends `hello` with a stable local player ID and sanitized display name.
2. `quick_match` places the player in a queue, while `create_room` and `join_room` use a private code.
3. Once two players are present, the server creates a random Seed, a synchronized start time and a 100-second end time.
4. Both clients generate gameplay from the same Seed.
5. Clients send sequenced score events. The server rejects old sequences, excessive event rate and deltas exceeding the allowed value for each event type.
6. The server owns canonical scores and broadcasts match state every 400 ms.
7. Pressure is earned from validated events. When full, the server chooses a hazard and sends it to the opponent.
8. A disconnected player receives a 10-second reconnect window while the server preserves the room and canonical score.
9. The server decides the winner at the end of the timer and handles rematch consensus.

## Persistence

Deno KV stores asynchronous challenges and the leaderboard. A challenge includes the creator score, run statistics, seed, expiration timestamp and top attempts. Live room state stays in memory because WebSocket objects cannot be stored in KV.

## Security included in the Alpha

- Name and room-code sanitization.
- Request body size limit.
- Strict sequence numbers.
- Per-second score-event cap.
- Event-specific score caps.
- Server-owned pressure meter and match timer.
- Static path traversal and malformed-path protection.
- Ten-second live-session reconnect window with stale-socket ownership checks.
- No third-party browser dependencies.

## Production hardening roadmap

### Server-authoritative simulation

For competitive ranking, move spawn generation and hit validation to the server. The server should generate orb IDs and timestamps, and the client should only submit input coordinates and client clock samples. Store compact match replays for audit.

### Identity

Use passkeys, OAuth or anonymous signed guest tokens. Never trust a localStorage player ID for ranked play. Add name moderation and abuse reporting.

### Horizontal scale

The current room manager targets one Deno process. At scale, use one of these patterns:

- sticky WebSocket routing plus Redis/NATS pub-sub;
- a dedicated room process per match;
- regional matchmaking with room ownership stored in a shared database;
- a stateful game-server platform while retaining Deno for APIs and web delivery.

### Observability

Track match start rate, completion rate, disconnects, latency, rejected events, challenge conversion, rematch rate, D1/D7 retention and objective difficulty. Add OpenTelemetry traces and structured logs.

### Reliability

Add graceful shutdown, room migration, reconnect windows, idempotent challenge submissions, database backups and load tests with thousands of simulated WebSockets.
