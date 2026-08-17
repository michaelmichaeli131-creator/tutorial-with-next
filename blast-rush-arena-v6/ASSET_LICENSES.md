# Asset and Audio Licensing

Blast Rush Arena uses a mix of original procedural rendering and third-party runtime assets with documented commercial-use permissions.

## Original artwork (V14–V15)

**As of V15 the game fetches no third-party images at all.** Every visual is original and generated at
runtime on a 2D canvas:

- The six playable pilots (`client/game-src/03g.part`) are drawn from scratch as distinct silhouettes and are also used for the in-game player avatar and the armory previews.
- The six enemy creatures and the titan bosses (`client/game-src/03j.part`) are original designs sharing the pilot art language.
- Weapon projectiles, beams, muzzle flashes and impacts (`client/game-src/03k.part`) are procedural.
- The launch screen scene (`client/game-src/03i.part`) — parallax starfield, rim-lit planet, spire skyline, approaching hostiles and the ground glow — is composed procedurally each frame.
- The arena background, ground plane, vignette and colour grade (`client/game-src/03l.part`) are procedural.
- Meteor hazards, ion fog and EMP overlays are procedural.

## Art packs

The game supports drop-in illustrated art via `client/art/pack.json` (see `ART_PACK.md`). **No art
pack is installed** — the repository ships procedural art only, which is why there is nothing to
license above.

If a pack is added, every asset in `client/art/` must be cleared for commercial use and
redistribution as part of a web game, and recorded in this file before merging.

## Retired third-party sprites

The animated monster sprite sheets listed below were used in V12–V14 and are **no longer fetched or
referenced**. V15 replaced every creature with original artwork, which removed the runtime CDN
dependency, made the art direction consistent and let the game render fully offline. The attribution
is kept here for the historical record of those releases.

## Animated monster sprites

### Pixel Monsters Animations Pack SCIFI — Mayouma Studio

- Source: https://mayoumastudio.itch.io/pixelmonstersanimationspackscifi
- Used for several animated enemy archetypes loaded from the publisher's itch.io CDN preview files.
- The source page states that the pack may be distributed, remixed, adapted and used commercially, and that credit is not required.
- The asset files may not be resold as a standalone asset pack.

### Evil Alien Creature 3 FREE — CreativeKind

- Source: https://creativekind.itch.io/evil-aline-creature-3
- Used for rival and boss animation variants loaded from the publisher's itch.io CDN preview files.
- The source page permits use in commercial and non-commercial projects and permits modification.
- Redistribution or resale of the standalone asset is prohibited.

## Background music

### Space Battle — MintoDog

- Source: https://opengameart.org/content/space-battle
- Runtime audio file: https://opengameart.org/sites/default/files/space_battle_bpm130.mp3
- License: CC0.
- The track is loopable and may be used commercially without attribution.

## Original project assets

- Environments, particles, beams, UI decoration, fallback enemies and fallback bosses are rendered procedurally with Canvas and CSS.
- Sound effects and supplemental music layers are synthesized at runtime with the Web Audio API.
- If external assets fail to load, the game falls back to the original procedural rendering and audio systems.

## Audio (V28)

**The game fetches no third-party audio.** Earlier versions hotlinked a soundtrack from
opengameart.org, which made the main music an external download that could be blocked or removed,
with the procedural layer mixed underneath at 17% as a bed that was never meant to carry a track on
its own. That hotlink is gone.

The soundtrack in `client/game-src/03zg.part` is generated at runtime with the Web Audio API — kit,
bass, sub, pads and lead are all synthesised from oscillators and noise buffers, arranged over a
four-bar minor progression, with sidechain ducking on the kick and an arrangement that adds layers
as the run intensifies. There is nothing to licence because there is no recording: no samples, no
external files, no network request.

Sound effects (`client/game-src/03o.part`) are likewise synthesised per event.
