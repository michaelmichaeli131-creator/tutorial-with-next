# Blast Rush Arena V6 — Game and Social Design

## V21 — a price for being wrong

The game could not be lost. That is not a figure of speech: a bot tapping twelve random points a
second, never reading the screen, survived two minutes on three lives, and a bot with human-like
aim survived a full five minutes at wave 16 **without losing a single life**. Worse, on the same
harness random mashing out-scored careful aiming — 173,287 against 167,038. The game was actively
rewarding the player for not looking at it.

No difficulty number fixes that. A faster version of a game you cannot lose is still a game you
cannot lose. The cause was structural: `pointer` hit-tested the tap and silently returned when it
found nothing, so a tap that missed cost nothing at all. With unlimited free attempts and hit
boxes generous enough to be hit by accident, covering the screen in taps was the dominant
strategy. `perfect` was decided purely by distance from the centre, so there was no timing
dimension either — only "tap everything, as fast as possible".

Four changes, ordered by how much each one alters the decision the player is making.

**Reactor heat.** Every shot heats the reactor and heat decays continuously; at the ceiling the
reactor locks out for just over a second while it vents. A tap that lands costs 7, a tap that
finds nothing costs 17, and kills and centre hits vent heat back. The intent is not to slow the
player down — accurate fire at four taps a second adds 28 heat against 34 of passive decay plus
whatever kills return, so a precise player never climbs and can fire as fast as they like. The
same four taps at spam accuracy add well over a hundred. Accuracy now buys rate of fire, which is
the trade the game never had. The lockout deliberately does not break the combo; stacking a combo
wipe on the lockout turns one mistimed burst into a ruined run.

**Ward windows.** Armoured hostiles and shielded elites raise a ward on a fixed cycle. Tapping a
raised ward costs heat and does nothing, so those targets have to be read and timed rather than
merely found. The ward is open slightly longer than it is shut, so patience always has a way
through and only haste is punished. Chain and blast damage ignore wards on purpose — the ward
tests the timing of a tap, and letting it stop area weapons would quietly delete the reason to buy
them. Both states are drawn clearly: a ward the player cannot see until it blocks them teaches
nothing except that the game is unfair.

**Divers.** Everything used to fall at one rate, so a target left for later cost exactly as much
as a target taken now and there was no priority to get right. A diver drifts down slowly — which
is what makes it tempting to ignore — then commits at nearly triple speed past the halfway line.
It is marked from the moment it spawns, because a priority test the player cannot see coming is
just a random death.

**A ramp that ramps.** Difficulty was indexed on the wave number alone, and a wave takes twenty
seconds or more to clear, so a run spent its opening minutes in the shallow end. Time in the arena
now counts as well. The arrival interval is clamped rather than scaled — a multiplier drives the
gap towards zero and produces a wall no reaction speed can clear, whereas a clamp can only ever
tighten the base spawner, never loosen it, and keeps a floor under it.

Measured on the same harness, before and after:

| bot | before | after |
| --- | --- | --- |
| random mashing, 12 taps/s | 93s, wave 5, 173,287 | 38s, wave 1, 5,023 |
| aimed, 6 taps/s | 180s survived, wave 4, 167,038 | 180s survived, wave 8, 314,515 |
| human accuracy, 5 taps/s | **300s, never died**, wave 13 | 233s, wave 10, run ended |
| human accuracy, 8 taps/s | **300s, never died**, wave 16 | 270s, wave 11, run ended |

Mashing went from out-scoring skilled play to a thirty-fourth of it, skilled play got *better*
rather than harder — wave 4 to wave 8, and nearly double the score, because precision now vents
heat and the ramp supplies more to kill — and a realistic player now has a run that ends. Scoring
rate per second is essentially unchanged (2,281/s against 2,191/s); what changed is that the run
has a ceiling. Campaign winnability was checked the same way: stages 3, 6, 9, 12 and 15 produce
the identical pass/fail pattern before and after, so the ladder is not newly impossible.

Duel scope is deliberate. Heat is a rule about the player's own input — identical on both clients,
needing no synchronisation — so it applies everywhere. Wards, divers and the ramp change what is
on the field, and V20 made the field server-authoritative precisely so that two duellists meet
identical enemies at identical moments. They stay off in duels rather than putting that guarantee
at risk.


## Duel fairness

Duels were simulated locally from a shared seed, which only produces the same field if both clients
consume the generator in the same order at the same rate. They do not. `dt` is clamped to 33ms per
frame to prevent a spiral of death, so a client running at 20fps advances its world roughly a third
slower than one at 60fps while the match clock keeps real time — the slower player met fewer enemies
and had fewer chances to score in the same 120 seconds. Visual effects consuming the same generator
made it worse, since `explode()` draws several values per hit and hits are player-driven.

The server now builds the entire spawn schedule at match start and sends it with `match_start`.
Both clients replay it against wall-clock time, so the two arenas hold identical enemies at
identical moments regardless of frame rate. Difficulty in a duel ramps on match progress rather than
each player's own wave, so both duellists face exactly the same gauntlet and the score gap reflects
play. Surges are suppressed in duels for the same reason — they fire off a local timer and would
break that guarantee. Solo and campaign keep the local spawner, which is correct for one player.

## Duel sends

A duel used to offer one random hazard and one core, so there was nothing to decide. Charge earned
by scoring inside the match now buys a chosen threat, each at its own price and cooldown: Swarm
(25), Gravity Well (35), EMP Veil (45), Rival Core (55) and War Titan (90). The expensive options
are worth pausing for, and the cheap ones let a losing player apply steady pressure.

Every price and cooldown is enforced on the server; the client only chooses what to ask for. Charge
comes exclusively from in-match scoring, so nothing bought with campaign credits can be converted
into pressure on an opponent — the same anti-pay-to-win rule the pilot perks follow.


## V15 — making the purchase visible

V14 built the economy but left a hole in it: a player could spend 2,900 credits on the Nova Cannon and
see nothing change on screen. The damage was different, the feel was not. V15 closes that loop.

Every weapon now has a visible identity in combat — its own projectile shape, colour, travel speed,
impact and HUD chip. The chip carries the weapon's name, its level as pips, and a cooldown bar that
visibly drains and refills, so the thing the player bought and the thing they upgraded are both
legible mid-fight without reading a menu.

Two supporting decisions matter for feel:

- **Base damage always lands, specials are gated.** Firing is instant and responsive on every tap;
  only the special effect waits on the cooldown. Rate of fire is never something you can buy.
- **Impact weight is attached to outcomes, not inputs.** A shot landing spawns a handful of sparks.
  Kills and area procs keep the heavy explosions, screen shake and flash. An early build fired a full
  explosion on every tap, which shook the camera continuously and buried the creatures under rings —
  effects have to stay proportional to what actually happened.

Creature art was rebuilt for the same reason. The external sprite sheets were pixel-art monsters
sitting inside a neon vector interface, and the mismatch was most of what read as "generic". Six
original archetypes now share the pilots' art language, and the game fetches no third-party images.

The mobile HUD was also failing the player outright: V12's trimming had removed lives, wave and
objective progress from the screen entirely. A single compact bar restores all three in half the
vertical space, which matters because creatures enter from the top edge — every extra row of chrome
is a row the player cannot see threats in.

## V14 campaign foundation

V14 adds the long-form spine the game was missing: a stage ladder, a save that remembers where you
stopped, and an economy that turns offline play into permanent progress.

### Stages

Fifteen hand-authored stages span the first four worlds. Each one declares an objective `kind` —
`purge`, `elite`, `perfect`, `survive`, `boss` or `gauntlet` — and everything else layers on top of a
single shared difficulty curve (`v14StageCurve`) so the ramp can be read and retuned in one place.
Across the ladder enemies get roughly 85% faster, armour gains up to two extra hit points, spawn
intervals compress by 44%, and boss health scales with the same curve.

Stages award one to three stars: clearing the stage earns one, finishing with at least two reactor
lives earns two, taking no damage at all earns three. Stars are cosmetic prestige plus a 15% credit
bonus per star, so replaying an early stage well is worth something without being mandatory.

### Hazards

Hazards are stage modifiers that change something the player can actually see: `gravity` (hostiles
fall much faster), `meteor` (burning debris that must be tapped before it lands), `fog` (a vignette
that collapses visibility around the reactor), `emp` (Overdrive and Blast go offline in four-second
bursts every twelve seconds) and `swarm` (periodic reinforcement waves).

### Weapons

Six weapons are lateral rather than a straight power ladder — each wins in a different situation.
Pulse Driver is the reliable single-target default, Scatter Volley splits into a crowd, Void Lance
shreds armour and titans, Arc Chain jumps between hostiles to hold combos, Shard Siphon trades
damage for credits, and Nova Cannon detonates a wide shockwave.

Base tap damage always lands. Only the *special* effect is rate limited by a per-weapon cooldown, so
buying an expensive weapon never converts into a raw fire-rate advantage — it converts into a
different shape of engagement. Each weapon has five levels bought with credits at a 1.55× curve.

### Pilots

Six pilots are drawn from scratch as distinct silhouettes — knight, striker, specter, warden, reaper
and ascendant — not palette swaps of one body. Each carries exactly one modest perk: a wider PERFECT
window, more weapon damage, faster Overdrive, a free Phase Shield, more credits, or a score and Blast
bonus.

### Economy and pay-to-win protection

Credits are earned by playing offline stages and Solo/Gauntlet runs; failing a stage still salvages a
consolation payout so a bad run is never a total loss. Credits buy weapons, weapon levels and pilots.

Duels neutralise the damage, score and credit perks entirely (`v14Mods(duel)` strips them), leaving
only feel-based perks such as the PERFECT window. A larger wallet therefore cannot out-stat a rival —
it can only change which weapon shape you bring.

### Persistence

Progression lives under its own `blastRushV14` localStorage key with a schema version and a tolerant
migration that fills defaults rather than wiping a partially written payload.

Tolerant is not the same as trusting. The first version of the migration clamped numbers with
`Math.max(0, Math.round(value || 0))`, which does nothing to a string: `Math.round('abc')` is NaN and
every comparison against NaN is false. A NaN field is worse than a missing one — `v14Spend` tests
`credits < amount`, so a NaN wallet approved every purchase for free and displayed "NaN"; a NaN
`unlocked` count failed every `index <= unlocked` test and locked the entire stage ladder. Every
field is now coerced, checked with `Number.isFinite`, then clamped, and the stage-keyed star and
best-score maps are rebuilt entry by entry so out-of-range keys and non-numeric values are dropped
rather than copied. Weapon and pilot entries are filtered against the ids this build actually
defines, so a tampered save cannot equip a weapon that has no stats function behind it.

`BlastRushSave.export()` and `BlastRushSave.import()` are the seam a server-side save plugs into.
The whole client is one IIFE, so these are published on `window` deliberately — and narrowly: read
the save, replace the save, read the schema number, nothing else. An imported payload goes through
the same migration as a local one, which is why that hardening matters: the import seam is the one
place a save arrives from outside the player's own device.

## Product principle

The core action remains instantly understandable: identify the most valuable threat and click it before it reaches the reactor. Depth comes from target priority, boss attack interception, combo preservation, tactical augments and social counterplay—not from hidden rules or pay-to-win power.

## Challenge ladder

1. **Seconds:** choose between a normal threat, a chain bomb, an incoming boss projectile and a high-value Rival Core.
2. **Wave:** complete a clearly announced directive under a visible mutation.
3. **World:** learn one visual and mechanical language before facing its bespoke boss.
4. **Run:** assemble an augment build and decide when to use Overdrive or Reactor Blast.
5. **Gauntlet:** survive a sequence of escalating Omega Titans.
6. **Social:** master Core Volley risk/reward and adapt to a human rival.

## Boss identity

- Singularity Warden: gravitational volleys.
- Prism Hydra: delayed refracted beams.
- Solar Colossus: meteor rain.
- Void Seraph: portal attacks.
- Tempest Leviathan: rapid lightning lanes.
- Celestial Architect: geometric lattice barrages.

Bosses expose orbiting weak points. Their central core is shielded until those parts are broken, creating readable phases and satisfying destruction milestones.

## Core Volley social loop

Players earn Volley ammunition through validated score events. Launching spends ammunition and creates a tiered Rival Core on the opponent's field. The payload is dangerous, but successful defusal grants a larger score reward and Shards. This makes every send a social challenge rather than an unavoidable punishment.

## Low-friction multiplayer

- Quick Match for one-click entry.
- Public Tables for visible open rooms.
- Private link and room code for direct friend play.
- Asynchronous seeded challenge for friends who are not online together.
- Instant rematch after a live duel.

## Cosmetic expression

Reactor skins affect the player's reactor, trails, lobby identity and sent Rival Cores. They are unlocked through play and deliberately have no competitive stats.

## Ethical retention

The design uses mastery, variety, expression, friendship and fair competition. It avoids loot boxes, paid power, energy timers, deceptive notifications, forced streak loss and intentionally frustrating matchmaking.
