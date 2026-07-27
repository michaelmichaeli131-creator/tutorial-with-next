# Blast Rush Arena V6 — Impact (V16)

## Art packs

Every creature, pilot and background is drawn procedurally by default. An **art pack** replaces any
of that with illustrated sprite sheets with no code change: drop `client/art/pack.json` and its
images in place and the game uses them on next load.

Fallback is **per entry**, not all-or-nothing — ship only the creatures and the pilots keep drawing
procedurally until their art arrives, so art can land incrementally. A missing or broken file logs a
warning and that one asset falls back; everything else still uses the pack.

`deno task build` validates an installed pack and fails on a missing file, a malformed manifest or a
bad frame grid — the failure modes that are otherwise silent at runtime. See `ART_PACK.md` for the
asset specification.

## V16 — game feel, destruction and pressure

Built against the standard game-feel recipe rather than by taste.

**Destruction.** Killing something now shatters it into pieces cut from its own silhouette and
palette, under a three-stage impact: a white core flash on the impact frame, a fast thin shockwave,
then gibs, smoke and embers. A hit is registered by the brain during a freeze frame, so kills hold
the world at 12% speed for 3-5 frames scaled by weight, with a camera punch, roll and chromatic
fringe on the heaviest ones. Every effect is capped and quality-scaled so the readable game survives
underneath.

**Audio.** Impacts are rebuilt as three layers whose onsets land on the same instant — transient
(the snap that makes it read sharp), body (the low weight), tail (debris and space) — with the snap
mixed hotter than the body, which is what "crisp" actually is. The old single-oscillator blips had a
body and no transient, which is exactly why they sounded thin. Each species has its own kit
(metallic ring for armour, glass partials for wraiths, a double thump for twins, a sub-boom for
raiders), combos raise the pitch, and a voice budget stops chain kills turning to mush.

**Challenge.** A curve that only ever rises is predictable, and predictable is what "boring" means.
The arena now breathes: announced surge windows alternate with calm ones, elites (Shielded, Swift,
Siege) demand priority and are worth taking out of turn, Siege elites and phase-two titans shoot
back with interceptable fire, and the combo decays if you stop killing while paying up to 2x score
if you hold it.

**Launch screen.** Rebuilt to the conventions these games actually use: one unmistakable gold
primary action with a solid drop edge that presses down, a chunky outlined logo with real bevel
depth instead of thin gradient text, and a staged hero diorama with separated background, midground
and foreground.



## V15.1 fixes

- **Panels scroll again.** `premium-v13.css` set `.panel{overflow:hidden}`, which overrode the
  `overflow:auto` from `styles.css` and left every screen unscrollable. Once the menu grew past the
  viewport its lower half was unreachable on desktop and on phones alike.
- **Desktop menu layout.** The V13 mode grid hand-placed exactly four buttons; adding CAMPAIGN as a
  fifth shifted every placement and collapsed the layout into overlapping cards. It is now a
  flow-based grid that works for any button count.
- **Hero legibility.** Five generations had each stacked a decorative overlay onto the same hero
  pseudo-elements. Together they washed the title into a muddy rainbow haze; one deliberate
  treatment replaces them.
- **Pilot rendering.** Characters now go through an offscreen buffer that adds a rim light, a
  volumetric top-down light pass and a contact shadow, so they read as solid objects instead of flat
  cutouts.
- **Per-species behaviour.** Every creature used to fall in the same straight line. Sentinels now
  brace, Raiders commit to an accelerating dive, Wraiths blink sideways, Twin Beasts zigzag, Scouts
  weave, and rival cores hunt the reactor.

## What V15 changed

- **Weapons are visible.** Buying a weapon used to change hidden numbers only. Every weapon now fires
  from the pilot with its own projectile, colour and impact — a pulse bolt, a scatter fan, a piercing
  lance, forked lightning, a credit-draining tether, a mortar shell with a blast ring — plus muzzle
  flash, recoil and a HUD chip showing its name, level and cooldown.
- **All-original creatures.** The six enemy archetypes and the titans are drawn from scratch in the
  same art language as the pilots, replacing the flat shapes and the external sprite sheets. The game
  now fetches no third-party images at all.
- **A readable combat HUD.** V12 had trimmed the mobile HUD so far that lives, wave and objective
  progress were not on screen at all. One compact bar now carries stage, score, reactor pips and an
  objective meter, in half the vertical space the old two-row layout used.
- **Depth in the arena.** Parallax nebula banks, three star layers, a rim-lit planet, a ground plane
  with a lit ridge, a vignette and a per-world colour grade — plus a stage intro card, a damage edge
  flash and a low-health pulse.



A cinematic competitive browser arcade game with a Deno backend, a fifteen-stage campaign with saved
progression, unlockable pilots and weapons bought with earned credits, six-world endless progression,
Titan Gauntlet boss rush, public tables, private invite rooms, live seeded 1v1, player-launched Rival
Cores, pressure attacks, skins, asynchronous challenges, PWA installation and a persistent leaderboard.

## Highlights

- **Campaign:** fifteen hand-authored stages across four worlds with six objective types (purge,
  elite, precision, survival, titan, gauntlet), five hazard modifiers, per-stage star ratings and a
  save that resumes exactly where you stopped.
- **Weapons:** six lateral weapon systems with five upgrade levels each. Base damage always lands;
  only special effects are cooldown-gated, so nothing you buy becomes a fire-rate advantage.
- **Pilots:** six original characters drawn procedurally as genuinely different silhouettes, each
  with one modest perk.
- **Economy:** credits earned from offline play buy weapons, weapon levels and pilots. Duels strip
  damage, score and economy perks so a bigger wallet cannot out-stat a rival.
- **Original launch artwork:** the launch screen is a live canvas scene — parallax starfield, rim-lit
  planet, spire skyline, approaching hostiles and your equipped pilot — with no external art.
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
- `client/game-src/03f.part` — V14 campaign data model: stages, weapons, pilots, hazards, save schema.
- `client/game-src/03g.part` — V14 original pilot artwork, drawn on any 2D context.
- `client/game-src/03h.part` — V14 combat: stage flow, difficulty curve, weapon behaviour, rewards.
- `client/game-src/03i.part` — V14 interface: launch scene, stage select, armory.
- `scripts/build_client.ts` — assembles the ordered source fragments into `client/game.js` without npm.
- `server/main.ts` — HTTP server, public-table API, challenge APIs and WebSocket upgrade.
- `server/matchmaker.ts` — matchmaking, public/private rooms, Core Volley, pressure, reconnect and score validation.
- `server/store.ts` — Deno KV persistence with an in-memory local fallback.
- `ARCHITECTURE.md` — topology, scaling and anti-cheat roadmap.
- `GAME_DESIGN.md` — challenge, retention and social-loop rationale.

## Alpha boundary

This is a feature-complete multiplayer Alpha, not yet a globally scaled ranked service. Before a commercial ranked launch, add authenticated identities, moderation, replay auditing, fully server-authoritative object simulation, telemetry and shared room infrastructure.
