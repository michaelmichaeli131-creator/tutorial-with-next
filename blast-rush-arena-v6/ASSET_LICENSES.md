# Asset and Audio Licensing

Blast Rush Arena V12 uses a mix of original procedural rendering and third-party runtime assets with documented commercial-use permissions.

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
