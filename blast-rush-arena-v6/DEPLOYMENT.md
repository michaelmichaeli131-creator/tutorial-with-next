# Blast Rush Arena V6 — Deno Deploy

Deno Deploy Classic is retired. Use the current Deno Deploy platform at `console.deno.com` or the `deno deploy` CLI included with current Deno releases.

## First deployment on Windows

1. Install Deno 2.8.1 or newer.
2. Double-click `DEPLOY_DENO_FIRST_TIME.bat`.
3. The CLI runs build/check, then opens the secure Deno authentication flow.
4. In the interactive wizard:
   - create/select an Organization;
   - choose an application name such as `blast-rush-arena`;
   - source: local directory, or connect the GitHub repository;
   - app directory: this project directory;
   - framework preset: none;
   - build command: `deno task build`;
   - runtime mode: dynamic;
   - entrypoint: `server/main.ts`;
   - region: global.
5. Validate the generated HTTPS URL.
6. Run `DEPLOY_DENO_UPDATE.bat` to promote the configured app to production or publish future updates.

## Equivalent CLI flow

```bash
deno task check
deno task test
deno deploy create .
deno deploy --prod
```

The first command requiring authentication opens a browser and stores a secure token in the operating-system keyring.

## GitHub source option

For automatic deployments, choose GitHub as the source, repository `michaelmichaeli131-creator/tutorial-with-next`, and set the app directory to the final Blast Rush V6 folder. The production branch can be selected after the V6 PR is merged. Until then, the feature branch is suitable for preview deployments.

## Database

`Deno.openKv()` is used for challenges and leaderboard data. If the new app does not automatically receive a KV database, provision a Deno KV database and assign it to the application from the dashboard or Deploy CLI.

## Docker / VPS fallback

```bash
docker build -t blast-rush-arena-v6 .
docker run --rm -p 8000:8000 blast-rush-arena-v6
```

Use HTTPS and forward WebSocket upgrades for `/ws`.

## Scaling note

Keep a single dynamic instance for the Alpha or configure sticky routing. Live rooms are process-local. Persistent challenges and leaderboard data are in Deno KV.
