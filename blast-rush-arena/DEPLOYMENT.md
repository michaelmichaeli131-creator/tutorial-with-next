# Blast Rush Arena — Deployment

## Deno Deploy

1. Install Deno 2.8 or newer.
2. Sign in to the current Deno Deploy platform and create an organization.
3. From this directory, run `deno deploy` and follow the interactive wizard.
4. Choose dynamic runtime mode. `deno.json` defines `server/main.ts` as the entrypoint.
5. After validating the preview deployment, promote it or run `deno deploy --prod`.

The public HTTPS domain enables Web Share, installable PWA behavior, live invite links and asynchronous challenge links.

## Docker / VPS

```bash
docker build -t blast-rush-arena .
docker run --rm -p 8000:8000 -v blast-rush-data:/app/data blast-rush-arena
```

Place a TLS reverse proxy in front of the service for public use. Ensure WebSocket upgrades are forwarded for `/ws`.

## Production notes

- Live rooms are process-local in this Alpha. Keep one instance or use sticky routing.
- Deno KV stores challenge and leaderboard data.
- Add authentication, moderation, external rate limiting, telemetry and server-authoritative input validation before ranked public launch.
