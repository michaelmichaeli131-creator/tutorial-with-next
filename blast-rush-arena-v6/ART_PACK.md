# Art Pack Specification

Blast Rush renders every creature, pilot and background procedurally by default. An **art pack**
replaces any of that with illustrated sprite sheets without a single code change.

The pack is data-driven and **falls back per entry**. Supply only the creatures and the pilots keep
drawing procedurally until their art arrives. Nothing is all-or-nothing, so art can be delivered
incrementally.

## Installing a pack

1. Put the images under `client/art/`.
2. Copy `client/art/pack.example.json` to `client/art/pack.json` and edit it to match.
3. Run `deno task build` — the validator checks every referenced file exists.
4. Reload. The console logs `[art-pack] "<name>" v<n> — <count> assets`.

To disable without deleting anything, set `"enabled": false` in `pack.json`, or delete the file.

## What to deliver

### Creatures — 6 sheets, required ids

| id | name | role |
| --- | --- | --- |
| `normal` | Void Scout | fast, fragile, most common |
| `armored` | Iron Sentinel | heavy, plated, braces periodically |
| `bomb` | Nova Raider | unstable, dives, explodes |
| `shard` | Crystal Wraith | crystalline, blinks sideways |
| `splitter` | Twin Beast | two-headed, splits on death |
| `rival` | Rival Warlord | armoured humanoid, another player's core |

### Bosses

Keyed by world index `0`–`5`. A `default` entry covers any world without its own titan, so a pack
can ship one titan and still be complete.

Worlds: `0` Nebula Forge, `1` Crystal Rift, `2` Solar Temple, `3` Void Cathedral,
`4` Tempest Garden, `5` Celestial Engine.

### Pilots — 6 sheets, required ids

`vanguard`, `lancer`, `specter`, `warden`, `reaper`, `omega`.

Each may also declare a `portrait`: a **single-frame square** image for the HUD portrait frame and
armory cards. Without one, the HUD crops the idle sheet instead, which is usually fine but rarely
as tidy as a purpose-made bust.

### Ability icons

`overdrive`, `blast`, `pressure`, `volley` — single frame each.

### Background — optional

Painted parallax layers. Supply them and the procedural sky is replaced entirely; omit the
`background` key and the procedural sky stays.

## Technical requirements

**Format.** PNG with straight (non-premultiplied) alpha. WebP and AVIF also work and are smaller;
the server sends the right MIME type for all three.

**Sheet layout.** A uniform grid, filled left-to-right then top-to-bottom. Declare `frames` (total)
and `cols` (per row); rows are derived. Every cell must be exactly the same size — the renderer
slices by `width / cols`, so uneven padding shifts every frame after the first.

**Resolution.** Art is drawn at a size derived from the entity, not from the file, and scales up on
large or high-DPI screens. Deliver generously:

| asset | minimum frame size | notes |
| --- | --- | --- |
| creature | 256 × 256 | drawn around 90–160 px on a phone |
| boss | 512 × 512 | drawn up to ~260 px, and it is the focal point |
| pilot | 384 × 512 | the launch screen hero is the largest use, ~340 px tall |
| portrait | 256 × 256 | square, head and shoulders |
| ability icon | 128 × 128 | |
| background layer | 1080 × 1920 | tiles horizontally, scrolls vertically |

**Anchoring.** `anchorY: 0.5` centres the sprite on the entity's collision point, which is what the
tap hitbox uses. Shift it only if the art has deliberate empty space — for a creature with a long
trailing tail, an `anchorY` nearer `0.4` keeps the body over the hitbox.

**Scale.** `scale` multiplies the computed draw height. Creatures are drawn at `radius × 2 × scale`,
so around `2.6`–`2.9` matches the current procedural silhouettes. Tune per sheet rather than
re-exporting art.

**Facing.** Creatures descend toward the player at the bottom of the screen. Draw them facing
**down / toward the viewer**. Pilots are drawn upright facing the viewer.

**Silhouette.** Each archetype must be recognisable at ~110 px on a phone, in motion, against a
busy background. Silhouette separation matters more than internal detail at this size.

**Animation.** Idle loops. 6–8 frames at 9–14 fps reads well. Loops must be seamless: the pipeline
plays them continuously with no blending.

**Colour.** Creatures are drawn with an additive glow tinted from their palette, and flash white on
a non-lethal hit. Avoid baking a heavy outer glow into the art or it will double up.

## Licensing

Anything shipped in `client/art/` must be cleared for commercial use and redistribution as part of a
web game. Record the source and licence for every asset in `ASSET_LICENSES.md` before merging. The
project deliberately carries no third-party art today, so this file is the single place that has to
stay honest.

## Verifying

`deno task build` runs `scripts/validate_art_pack.ts`, which:

- exits 0 and says so when no pack is installed;
- fails the build on malformed JSON, a missing `src`, an invalid frame grid, or a file that does not
  exist on disk;
- warns (without failing) about ids that are absent, naming exactly which ones keep procedural art.

That last distinction is the important one: a missing entry is silently survivable at runtime, which
makes it easy to ship a half-wired pack and never notice.
