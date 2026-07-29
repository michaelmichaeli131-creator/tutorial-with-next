# Blast Rush Arena V6 — Game and Social Design

## V41–V43 — the titan, the shop, and the cheerful kills

Three reports, three different kinds of fault.

### V41 — the titan's health bar was covering the titan

Measurable, and the measurement is the whole diagnosis. With a boss on the field its centre sat at
y=181 with a radius of 105, so it spanned **y 76 to 286** — while its own health card spanned
**y 118 to 178**, straight across its face, with the wave bar crossing its head above that. What
remained visible was a slice of body and some floating weak points. The fight had a health bar and
no monster.

The card was built like a panel — 60px tall, its own padding and title line, parked in the middle
of the play area. It is a strip at the frame edge now, and the titan drops to 36% of screen height
and grows 28%, which puts its top at y=181 against a bar ending at 173.

On making it imposing, since it is easy to reach for gore and get nothing: a thing is frightening
when it is **large** relative to you, **heavy** enough that hitting it will not move it, and plainly
**aware of you**. So it gained a dark mass wider than its lit body, a shadow cast down the arena
toward the reactor, and a single red eye that tracks the reactor with a lag — a head that snaps
reads as a turret, one that swings late reads as something heavy deciding to look at you. A titan
on the field now also holds V35's dread at a floor of 0.55, so the fight never brightens back to a
normal wave halfway through.

The first eye was white at the gradient centre with a white slit on top, and it read as a friendly
glowing orb — the two whites swamped the red entirely. It is red almost all the way in now, with
white only in the pupil line.

### V42 — you could not see what you were buying

The armory weapon card was a name, a tag, a paragraph and five level pips. Nothing on it was an
image. A player choosing between 2,100 credits for ARC CHAIN and 1,500 for VOID LANCE had two
sentences of prose to go on, in a shop for a game whose entire appeal is what the shooting looks
like.

Each card now draws its weapon firing from a muzzle at the bottom, in that weapon's own colour
pulled from the same table the arena uses — one heavy bolt for PULSE, three diverging for SCATTER,
a shaft through two struck targets for LANCE, a kinked path between nodes for ARC, a shell bursting
into rings for NOVA, a line with shards coming back down it for SIPHON. Diagrams of *behaviour*
rather than icons, because what separates these weapons is what the shot does. The same thumbnail
goes on the in-combat weapon chip, so what you bought and what is firing are visibly the same
thing.

One fault worth recording: the base stylesheet styles the *element* — `canvas { position: fixed;
inset: 0; width: 100%; height: 100% }` — for the arena surface, and that applies to every canvas in
the document. All six diagrams were position-fixed and stacked in the top-left corner over the
header, while a DOM check reported six canvases present and none blank. It had to be found by
reading computed geometry, not by counting elements.

### V43 — the kills were cheerful

Two earlier passes each got half of this right. V34 made every kill a note in the soundtrack's key,
fixing a real fault: before it, the combo raised pitch continuously against a fixed-key arrangement,
so a good run drifted further out of tune the better it went. V36 then made the music tense — a
pedal bass that stops following the chord, a sus voicing that never lands, the kit emptying out.

What was left is a contradiction you can hear: a hollow, unresolved arrangement with **bright
consonant arcade plucks fired over the top of it**. Every kill was a clean triangle pluck with a
perfect fifth stacked on it — the most settled interval in music. The track was refusing to resolve
and the kills were resolving on every shot.

The pitch structure stays, because it earned its place; the character changes.

- The companion interval becomes a **tritone** instead of a fifth — the single biggest change in
  how a kill reads.
- **Every kill bends down** a whole tone as it decays. Things that die fall in pitch; the note was
  static, which is why it read as *played* rather than as coming apart.
- Filters open around half as high, so the voice is a body rather than a chime.
- A narrow band of **grit** under the transient, so a kill has debris in it.
- The tap loses its bell entirely: it was a bright blip an octave above the kills' register, which
  made every shot an event and left the kill nothing to be. It is a dry click now.

Verified with the same spy used for V34: fundamentals and the combo climb are byte-identical —
440, 494, 523, 587, 659, 699, 784, 880, 988, 1175, 1397, 1760 Hz, then holding. The scale check now
reports `OFF-SCALE: 42.00` on several species, which is the tritone at +6 semitones doing exactly
what it was added to do.

## V40 — the two biggest buttons were decoration

The brief was "fun and addictive", and the daily arena had just made something measurable that
never was before: a **fixed field**. Every previous comparison in this document was fought against
spawn randomness so wide that nothing could be concluded — 116k and 524k on consecutive runs of an
identical build. On the daily seed that collapses:

| | run 1 | run 2 | run 3 | spread |
| --- | --- | --- | --- | --- |
| random field (earlier) | 116,000 | — | 524,000 | **4.5×** |
| fixed daily field | 157,182 | 155,513 | 181,441 | **1.17×** |

That is a finding in its own right. Almost all the variance was *which field you drew*, not how you
played — which means solo is where luck decides and the daily is where skill shows.

With that instrument, the ability row could finally be tested. Same field, same bot, same tap rate;
only the ability policy changed.

| policy | Overdrives | Blasts | scores | median |
| --- | --- | --- | --- | --- |
| press on sight | 3 | 2–3 | 157,182 / 155,513 / 181,441 | 157,182 |
| bank and wait | 0–1 | 1 | 166,561 / 147,692 / 134,845 | 147,692 |

**Tripling ability use moved the score less than the run-to-run noise, with the ranges overlapping.**
A perfectly timed discharge catching eight hostiles was worth about five per cent of a run. Two
buttons that occupy a quarter of the HUD, glow, pulse and carry their own charge meters were, in
outcome terms, decoration — and a button whose timing does not matter is not a decision, it is a
lever.

The reward was already proportional to the catch; it was *linear*, and linear is not enough to make
waiting worth the risk. Raising it to an exponent of 1.55 does. Measured directly by placing
exactly N hostiles inside the reach and reading the score delta — arithmetic, so it is tested
arithmetically rather than inferred from a bot:

| hostiles caught | 1 | 2 | 3 | 6 | 8 | 10 | 12 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| at minimum charge | 1,876 | 3,710 | 5,961 | 14,887 | 22,527 | 31,482 | 41,753 |
| at full overcharge | 2,289 | 4,943 | 8,838 | 22,178 | 34,890 | 48,726 | **65,391** |

Twelve caught at full overcharge is 29× one caught, against roughly 5× before, and against a
150,000 run it is a set-piece worth building toward. Dumping a full bank on a straggler stays the
waste it always was. The trade the ability row never had now exists: let the field build and the
payoff climbs steeply, but every extra hostile is another chance at a breach.

A catch of six or more announces itself with a floating chain count and a toast, because a
set-piece that does not celebrate itself is a number going up somewhere off to the side.

**Honest limit:** the payout curve is verified precisely. The strategy-level re-run — does *hold*
now beat *asap* — did not complete: the sandbox degraded to eleven orphaned browsers and the runs
stopped finishing. What is shipped is a change whose direct effect is measured and whose intended
effect on strategy is argued, not yet demonstrated.

## V39 — the daily arena

The last of the four original priorities was "reasons to come back", and the honest description of
the game before this is that **nothing changed between sessions**. Solo is the same endless ladder
every time; the campaign has fifteen stages and then it is finished. V37 gave the results screen a
personal best to chase, which is a reason to press PLAY AGAIN — but nothing anywhere was a reason
to open the app tomorrow.

The answer this genre settled on long ago is a daily seeded run, and it works because it turns a
score into a *comparable* one: everyone plays the same field, so a number means something it cannot
mean when every run is a different arena. And it expires, which is the part that brings people
back.

The machinery already existed — `begin(mode,seed)` takes a seed, `rng()` is seeded from it, and V20
had already made spawns deterministic so two duellists meet identical enemies. What was missing was
a reason to use it.

**Verified before building anything on top of it**, because "everyone gets the same arena today" is
not worth saying unless it is true. The same seed run twice produced an identical sequence of 19
spawns — type, position, speed, radius and elite modifier — while a different seed diverged, so the
check can actually fail. The `Math.random()` calls that remain are all cosmetic: particle angles,
stereo pan, the launch scene.

The seed is an FNV-plus-avalanche hash of the **UTC** date, so the arena turns over at the same
instant everywhere and nobody gets a second attempt by changing timezone. Four consecutive days
produced four distinct seeds.

The streak is the actual hook, and it is decided when a run *finishes*, not when the app opens —
otherwise merely launching the game would extend it. Tested across every transition:

| situation | result |
| --- | --- |
| first play | streak 1, best set |
| replay the same day | streak stays 1, best rises 5,000 → 9,000 |
| a worse replay | best holds at 9,000 |
| played yesterday, streak 4 | streak 5 |
| last played long ago, streak 9 | streak resets to 1 |

Two things the build forced out into the open:

- **PLAY AGAIN and RESTART both call `begin(game.mode)`.** Running the daily as `'solo'`
  internally meant pressing PLAY AGAIN on a daily result silently started a *random* arena — the
  one thing a daily must never do, since the whole proposition is that you can attack the same
  field again. The base is still entered as solo so every layer that switches on mode behaves
  identically, and the mode is stamped back to `'daily'` afterwards. Nothing in the codebase reads
  `'solo'` specifically; every check tests for duel, campaign or gauntlet.
- **V33's comment about reproducible crowds was wrong.** Its signature counter was module-level and
  never reset, so two runs of one seed produced identically-*behaving* hostiles that *looked*
  different. It is now seeded from the run, which makes the claim true and the daily identical
  down to the artwork.

## V38 — the two screens the design pass never reached

Captured rather than assumed, and they came back very different from each other.

**Settings was the weak one.** On an 844px phone the content stopped a third of the way down and
left the rest of the panel empty. Empty space at the bottom of a panel is the most reliable
"unfinished" signal a UI can send, and no amount of polish above it compensates. Worse, not one
control said what it did — "COMFORT FX" is meaningless to anyone who has not read the source, and a
toggle whose effect the player cannot predict is a toggle they will not touch.

It now has three sections (audio, motion and comfort, device), a plain-language line under every
control saying what actually changes, a **haptics toggle** that should have existed all along —
`haptic()` was firing on every mobile device with no way to refuse it, which is an accessibility
problem rather than a missing preference — and a **build stamp** at the foot of the panel. The
stamp is there because it is the only honest answer, from inside the app, to "is the thing on my
screen the thing that was deployed": the first question worth asking when a change appears to have
had no effect.

**Pause was fine as a composition** — centred, clear hierarchy, the blurred arena behind it doing
real work. What it did not do was answer the question people pause to ask. In a score-attack game
you pause to find out how you are doing, and the panel said nothing about the run it had just
interrupted. It now carries score, wave progress and reactor state between the title and the
buttons, with the reactor reddening at one life.

Three faults of my own on the way, all caught by capture and measurement:

- The status row landed *below* the buttons, because the insertion point I picked in the markup was
  the wrong closing tag.
- The hint lines were first put *inside* each row by moving the row's children into a wrapper. That
  quietly destroyed the audio rows: `.audio-row` is a three-column grid sized for label, slider and
  percentage, and once those were nested a level deeper the wrapper became the first grid item —
  squeezed into the 60px label column, collapsing the slider to **six pixels wide** with the
  percentage printed over the text. Measuring the computed style rather than guessing at
  specificity is what found it, and the fix was not a stronger selector but to stop restructuring a
  layout that was already correct. The hints sit after each row now.
- The haptics toggle, the build stamp and the pause row were created at runtime, and the build
  validator rejected the commit: every id reached through `$()` must exist in the markup so the
  check that those elements still exist keeps working. The check was right. They are static
  structure and now live in `index.html`.

## V37 — the results screen was doing no retaining

Captured after a real run rather than reasoned about, and the capture settled it. The run scored
**85,001 against a stored best of 21,500** — four times the player's previous best, the biggest
moment they had had with this game — and the screen said `RUN COMPLETE`. It said it twice, because
the eyebrow above the title is hardcoded in the markup and `finish` sets the title to the same
words.

Under the score sat four numbers: WAVE 3, PERFECT 43, MAX COMBO x36, SHARDS +77. Every one is true
and not one tells the player whether that was good, what decided the run, or why to press PLAY
AGAIN rather than put the phone down. This is the retention screen, and it was retaining nothing.

Three changes, in the order the eye reaches them:

1. **The eyebrow carries context** — `SOLO · CRYSTAL RIFT · WAVE 5`, or the stage in campaign —
   instead of repeating the title.
2. **A line about the best.** Beating it is celebrated with the margin in gold; not beating it
   shows the gap. "12,400 SHORT" is the most reliable replay hook in the genre and it costs one
   line of text. The prior best has to be read *before* `finish` runs, because `finish` opens by
   writing the new best over the old one — by the time the panel is populated the number to
   compare against is already gone. Campaign runs compare against that stage's best rather than a
   career high, which would be meaningless.
3. **A read on the run**, derived from what actually happened rather than from a bank of flavour
   text. Overheats mean accuracy was the problem, escapes mean priority was, a long chain means
   the combo was the story. Two sentences at most. It gives the player something to *intend* next
   run, which is the difference between playing again and playing again for a reason.

Duels are excluded from the best line and the read: they are scored against a person, V20's own
result block already says who won, and a personal-best comparison there answers a question nobody
asked.

Two faults in my own first version, both caught by looking at the capture rather than the diff. The
best line read `NEW BEST · +70,957 OVER YOUR LAST` and wrapped to two rows on a phone — the plus
sign already says what the number is, so the words came out. And the read glued two clauses with
"and" when each already contained one, which with a single raider produced *"1 raider reached the
reactor, and each one took…"* — the plural agreement broke in the most common case. Each clause is
a whole sentence now.

## V36 — tension is what you take away

The follow-up to V35 sharpened the brief: more tension, only a trace of fright, and put it in the
sounds and the soundtrack rather than on the screen. That is a different problem from the one V35
solved, and the instinct it rules out is the obvious one — reaching for scarier noises.

What actually makes music tense is harmony that will not resolve and a floor that will not move,
and then **removing things**. A busy arrangement is thrilling; a sparse one over a held bass is
unbearable in the way this game wants to be. V30's `intensity` was already an excitement curve that
thickened the track as a run heated up. Tension needed the opposite curve, driven by V35's dread so
the arrangement and the screen tighten together.

- **The pedal.** Above dread 0.25 the sub stops following the chord and holds the tonic while the
  harmony keeps moving above it. Two of the eight bars in the phrase then sit a minor third or a
  tritone away from their own bass. It is the most reliable tension device in film scoring and it
  is not remotely frightening.
- **The chord stops arriving.** The pad's settled minor triad `[0,7,12,15]` becomes `[0,5,12,14]` —
  a sus voicing, a chord that has not decided yet. Nothing in it is dissonant enough to alarm
  anyone; it simply never lands.
- **The kit empties.** Hats go first — they are pure forward motion, which is the opposite of
  dread — dropping to eighths and then stopping. The snare loses its bright layer, the moving bass
  line drops out under the pedal, the arp stops.
- **A held fifth** enters above dread 0.45, two oscillators a few cents apart beating slowly, at a
  fortieth of the mix. Most players will never consciously hear it.

Read out of the scheduler over one full 32-bar form:

| dread | events | kick | snare + hats | moving bass | sub | distinct bass notes |
| --- | --- | --- | --- | --- | --- | --- |
| 0 | 1348 | 124 | 352 | 230 | 192 | **5** |
| 0.35 | 1348 | 124 | 352 | 236 | 192 | **1** |
| 0.8 | 708 | 124 | 72 | 68 | 192 | **1** |

The track loses nearly half its events while the kick and the sub are untouched — the floor stays,
the motion goes. The bass locks to one note at 0.35 and the thinning only begins after that, so the
harmony tightens first and the arrangement empties later, as things actually get worse.

**Two cues were rebuilt** for the same reason. Losing a life was an explosion and a diver's lock-on
was a beep; neither is a tension sound. Tension in an interface comes from things that sound like
systems in trouble, not like impacts. Damage is now a power-down — the reactor's own note bending
flat a tritone and dying while the sub drops out from under it, the sound of losing something
rather than of something arriving. The lock-on is two tones a tritone apart that overlap before the
first has finished.

**And V35's own sound was walked back.** The hush swell was a minor second grinding up out of the
sub, which is pure fright and the wrong instrument for this brief; it is a detuned fifth now. The
heartbeat was too loud and started at one lost life, which is a setback rather than a crisis and
left the pulse nowhere to go — it is roughly half the level and starts at dread 0.52.

## V35 — dread

The brief was tension and a little fear. The first thing worth saying is why the game had neither,
because it is not what it looks like from outside. It is not that the palette is bright or the
music upbeat. It is that **nothing ever stopped.** Hostiles spawned off a continuous timer that
reset the instant it fired, the arrangement played without a gap from the first frame to the last,
and the arena was lit evenly from edge to edge. Fear needs a silence to sit in and a dark to hide
in, and there was neither. So this is a pacing and lighting change, not a colour pass.

**The hush.** Clearing a directive now buys a beat of nothing before the next wave arrives. The
field drains, a detuned sub swells under it, and the incoming wave is drawn as silhouettes
descending through the haze — visible, indistinct, and impossible to shoot. Anticipation is where
fear actually lives; surprise is just a noise. This is the biggest change here and the one that
does the most work.

**The dark closes in when you are hurt.** One dread value driven by lives lost, reactor heat, how
close the nearest hostile is to the line, and whether a titan is out. It drains the colour from the
arena through a single non-separable blend fill, closes a vignette centred on the reactor rather
than the screen — the light that is failing is the player's own — shuts the music filter down, and
brings in a heartbeat that speeds up. It rises about three times faster than it falls, so relief
after a close call takes a moment to arrive instead of the arena flickering between moods.

**Divers look at you before they commit.** V21's divers already drifted and then accelerated. What
was missing was the moment of being noticed, so a sightline now snaps from the diver to the reactor
during its tell.

Three limits, all deliberate:

- **Readability is not negotiable.** Desaturation caps at 62% and the vignette stays out at the
  edges. Captured at full dread with a frozen field, every hostile, health bar and status label is
  still legible — a hostile the player cannot see is not tension, it is an unfair death.
- **Solo and campaign only for the hush.** It changes when hostiles arrive, and V20 made duel
  spawns server-authoritative so two players meet identical enemies at identical moments. The
  atmosphere is presentation and runs everywhere; the pacing change does not.
- **It has to be affordable.** Measured on a frozen field, 700 draws a sample, three interleaved
  passes: dread 0 costs nothing (15.53 ms baseline, the treatment is gated off), dread 0.19 is
  +2.2% with only the vignette, and dread 0.5 and 1.0 are +10.4% and +9.5% with both passes
  running. A tenth of a frame, only while the player is in trouble, against the 56% of fill V33
  removed.

## V34 — kills become notes

The destruction sounds were built to the standard impact recipe: noise transient, sine body
sweeping downward, noise tail. That recipe is correct, and it is correct for a *gun*. This game is
neon vector art over a 124 BPM synthwave arrangement in a fixed key, and a filtered noise boom
belongs to a different game — it was the one thing in the mix that sounded borrowed rather than
written.

There was a concrete fault under the aesthetic one. V16 raised the kill pitch smoothly with the
combo (`1+heat*.5`, a continuous multiplier) while V30 plays a fixed-key arrangement underneath, so
the better the player did the further out of tune every kill drifted against the soundtrack. The
reward for a long chain was a rising detune.

What the genre actually does — Geometry Wars, Rez, Lumines, Thumper — is make the kill part of the
music. So:

- **The kill is a note.** A short plucked synth (two detuned oscillators through a filter that
  closes as it decays), under 250 ms, so twelve kills in a second read as twelve notes rather than
  as mud.
- **The note is in the track's key**, chosen from V30's own scale over the current world's root and
  transposed by the harmony degree of the bar playing *right now* — the music's own state, read
  directly, so a kill lands on the chord under it.
- **The combo climbs the scale in steps**, not as a glide. A chain sounds like a run; a broken
  chain audibly starts again from the bottom.
- **Species keep their register**, because which creature died is information.

Verified arithmetically, since I cannot listen to it: a spy on every scheduled oscillator
frequency, converted to semitones above the live root.

| combo | 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 10 | 12 | 14 | 20 | 40 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Hz | 440 | 494 | 523 | 587 | 659 | 699 | 784 | 880 | 988 | 1175 | 1397 | 1760 | 1760 | 1760 |
| semitones | +36 | +38 | +39 | +41 | +43 | +44 | +46 | +48 | +50 | +53 | +56 | +60 | +60 | +60 |

Every degree on the scale, two octaves of climb, then it holds rather than turning shrill. Species
registers came out as designed: wraith +48, scout and twin +36, sentinel and warlord +24, raider
+12. Twelve kills in one frame schedule 36 nodes against roughly 96 unbudgeted.

Two voices are deliberately off-scale and stay that way: the wraith's bell partials and the
metallic ring on armour. Struck glass and struck metal have no harmonic series, and forcing those
into the key would turn them into chimes. They sit at a tenth of the kill's level, which is where
an inharmonic voice can colour a note without arguing with the track.

## V33 — measuring the slowness instead of reasoning about it

Three separate reports of "still very slow" had been answered by reading the rendering code and
optimising whatever looked expensive. This round asked the engine instead: a V8 sample profile of a
live run, and a spy on `CanvasRenderingContext2D.drawImage` counting calls, callers and destination
sizes. Both said something the code review had not.

**The renderer was painting five canvases per frame to show one.**

| | before | after |
| --- | --- | --- |
| `drawImage` calls per frame | 20.2 | 14.0 |
| destination pixels per frame | 1,680,000 | 707,000 |
| canvas size for comparison | 329,000 (390×844) | 329,000 |
| `drawImage` self time, 25s at 4× throttle | 3,615 ms | 2,053 ms |

Three call sites accounted for almost all of it, and none of them was a creature or an explosion:

- **The nebula, 881,000 px/frame — 52% of everything painted.** Four blits of one 256-square puff
  sprite, blown up to between 354 and 625 square in `lighter` mode. They drifted at 0.008 screen
  widths per second, so the parallax between them took two minutes to travel far enough to see.
  Now composited into one band-sized sprite and blitted once, with a bounded sway and a slow breath
  on its alpha in place of the drift.
- **The pilot, 411,000 px/frame — 24%.** The offscreen compositing buffer that gives the pilot its
  rim light was rebuilt every frame: ~30 vector fills, a shadow blur across a 360-square surface,
  and three more full-buffer blits, all to produce a 140-pixel-tall figure. The pilot's walk is two
  sine waves at 2.1 and 4 rad/s. Rebuilding at 20 Hz is indistinguishable from 60 and skips two
  frames in three.
- **The skylines, 198,000 px/frame.** Scrolled by drawing each range twice at full width, so half
  of every blit landed off-canvas. Cutting each to its visible slice draws the same pixels in the
  same places for half the cost.

The sample profile also showed the browser flushing layout **1.58 times per frame** where a frame
needs one. `v17DrawPortrait` runs from `updateHud`, which runs at the end of every `update`, and it
called `getBoundingClientRect` *before* the early-out that decides the portrait has not changed — a
forced synchronous reflow, sixty times a second, to answer a question whose answer was discarded.
Moving the early-out first took layout from 2.37 to 1.13 ms per frame and the count to 0.99.

The rest of the HUD had the same shape of problem: `updateHud` wrote twenty DOM nodes every frame,
and Blink does not compare before it assigns — writing the same string still dirties the node and
buys another style recalculation. `setText`/`setWidth` remember what they last wrote. Most of this
HUD changes on a kill or a wave, not on a frame.

None of this changes what the game looks like. Every screen renders identically; the before and
after captures differ only in which hostiles happened to spawn.

## V33 — a crowd of individuals

The other half of the same pass, and the one thing the graphics work had explicitly left undone.

Every scout was the same drawing at the same size in the same colour, so four arriving together
read as one shape stamped four times. It is the clearest single tell that a crowd was generated
rather than drawn, and detail on the individual creature cannot fix it, because the eye is
comparing neighbours rather than inspecting one of them.

Each hostile now gets a signature the first time it is drawn — size (±8%), resting tilt, bob rate
and depth, facing, and a shift of its palette in hue and lightness. It is hashed off the spawn's
own randomness, so a replayed seed produces the same crowd.

Two constraints shaped it:

- **It has to be free.** All of it is transform and colour, so a varied crowd costs exactly what an
  identical one did. That matters in a pass whose other half is cutting the frame budget in half.
- **It must not touch a readout.** The rival warlord wears the player's own skin and keeps it
  unrecoloured and unflipped. The health bar and the gameplay overlays are drawn in world
  coordinates after the body transform is restored, so nothing that tells the player something is
  ever mirrored or resized. Art already ran at 1.15× the collision radius against a tap ellipse of
  roughly 1.6×, so ±8% on the drawing never approaches the edge of what is hittable.

## V33 — debris that came off a machine

Judged by capturing a single kill frame by frame rather than by watching it, because a 300 ms
effect cannot be assessed at speed. The sequence was structurally right — flash, ring, debris,
smoke, score — but the debris was a flat fill with a uniformly bright outline all the way round,
and frozen on a frame that reads unmistakably as confetti.

Two changes, and one correction along the way:

- **Shaded fragments, baked into sprites.** Lit from the upper left to match the pilot's own light
  and the arena's sky body, with the rim highlight clipped to the lit edge only. Ninety of these
  can be on screen at once, so the shading is baked per shape and colour rather than built per
  piece per frame — which also turns each shard from a path fill plus a path stroke into one small
  blit, making the better-looking version the cheaper one.
- **A cooling pass.** Fresh debris carries the blast: an additive second blit over the first fifth
  of a second, fading out. It is what makes the shards read as thrown out of an explosion rather
  than dropped out of one.
- **Chunks among the chips.** Every fourth piece is now 1.5–2.3× rather than around half size. A
  cloud of uniformly small fragments reads as dust; what says *that came apart* is a few
  recognisable plates tumbling out among the dust.

The correction: the first attempt shaded properly, all the way down to near-black on the away
side, and it looked worse. A shard is about fifteen pixels across on a phone, and at that size a
real dark side is not read as form — it is read as a dimmer, smaller piece of confetti. The dark
end now only drops to about sixty per cent of the fill's own lightness.

Cost, measured against the same harness: fill went from 707k to 738k pixels per frame — 4% — while
`drawImage` self time over 25 s at a 4× CPU throttle continued down to 1,847 ms from the 3,615 ms
it started this pass at, and idle time rose from 74.6% to 82.3%.

## V23 — two buttons become two decisions

This one began by overturning an assumption behind V21 and V22. Both were tuned against bots that
never touched Overdrive or Reactor Blast, on the theory that the ability row was decoration. It was
not. The same bot, same tap rate, same aim error, with the sole addition of pressing both abilities
the instant they lit up:

| | outcome |
| --- | --- |
| never presses an ability | 161s, wave 5, 197,973 |
| presses on sight | 240s survived, wave 13, **1,301,354** |

Six and a half times the score. The ability row was not decoration, it was the dominant mechanic —
with no decision attached, because pressing on sight was strictly optimal. That made it a tax on
knowing to press a button rather than something to think about. Worse, a Blast that wipes the whole
screen every twenty seconds flattens the priority structure V22 had just built: it does not matter
which hostile you let through if the field is about to be erased anyway.

Both abilities keep their power. What changed is that spending them early now costs something.

**Blast overcharges.** Charge no longer stops at 100%; it accumulates to 175% and firing spends all
of it. At the minimum it clears the bottom half of the arena — the panic button it always was —
and held to full it reaches the top of the screen. An early Blast still saves you, it just no
longer also erases everything you were meant to be triaging. Blast also no longer charges itself:
every kill adds charge, including the ones Blast made, so a discharge that caught eleven hostiles
used to hand back 99% and be ready again immediately. An ability that pays for itself is not a
resource, and a bank nobody has to save for is not a decision.

**Overdrive defers heat.** The first attempt made it cancel heat outright, and that was a mistake
worth recording: free immunity made pressing on sight *more* correct than before and suppressed
V21's heat system for nearly half the run, so the ability quietly disabled the mechanic the entire
difficulty rework rests on. Measured at 1,641,664 for press-on-sight against 1,278,092 for banking
— exactly the wrong way round. Heat taken during Overdrive is now banked at a 45% discount and
lands as one lump when the window shuts, drawn on the reactor gauge as it accrues so the bill can
be watched running up. Overdrive buys a burst of unlimited fire and charges for it afterwards:
spend it on a surge and you vent through the calm that follows; spend it on a calm patch for the
score multiplier and you are venting when the next surge arrives.

With that, timing wins on both axes:

| policy | outcome |
| --- | --- |
| presses on sight | died at 190s, wave 10, 695,976 |
| banks and times | **240s survived on three lives**, wave 12, **864,061** |

Press-on-sight fell from 1,641,664 to 695,976 — the spam route is closed — while a player who uses
the abilities well still beats one who ignores them (864,061 against roughly 598,000). Using them
is worth it; using them thoughtlessly is not.

The campaign ladder was re-checked with a bot that presses no abilities at all, which is the
conservative case: stages 1, 2, 3, 9 and 12 clear on three lives and stage 15 clears on the last
heart after eight overheats. Stage 6 still fails, as it does on the pre-V21 build.

### A crash found on the way

The banking bot ended a run on **-1 lives**. Two hostiles landing on the same frame each call
`damage()`, so the last life can be spent twice before `finish()` stops the run, and `updateHud`
renders lives with `'♥ '.repeat(game.lives)` — `repeat(-1)` throws a `RangeError`, taking the rest
of that frame's HUD with it. Confirmed in the browser, then fixed at both levels: `damage()` floors
lives at zero, and the render clamps independently, because a `.repeat()` on a mutable game value
in a per-frame function should not be one arithmetic change away from throwing.

## V22 — make it matter which one you let through

V21 priced tapping badly. This is the other half of the same problem. Every hostile that reached
the reactor cost exactly one life, whatever it was — a single line handled all of them, splice the
orb and call `damage()`. A bomb, a splitter and a shard runner were worth precisely the same to
stop, so there was no priority to get right, and "tap whatever is lowest" was not merely a decent
strategy but the optimal one. That is the shape of a game with nothing to decide.

Landing consequences now differ by what landed, which gives the field a top and a bottom:

- **Bomb** — costs a life *and* slams the reactor to full heat. The cost is not one life, it is one
  life plus the second in which you would have recovered, so it is the target you drop everything
  for.
- **Shard runner** — costs no life at all. It escapes with up to six of the shards this run earned
  and a slice of score. It can never touch shards banked from previous runs: a threat that eats a
  player's permanent wallet is a punishment, not a decision.
- **Everything else** — one life, as before.

The runner is the important one. A threat the player may deliberately ignore is what turns a
crowded field from a reaction test into a choice, and it is the first time in this game that
letting something reach the reactor can be the correct play. Runners are drawn with a dotted
escape route so the role is legible before one gets through.

Two bots at the same tap rate and the same shaky finger, differing only in which target they pick:

| bot | outcome |
| --- | --- |
| takes whatever is lowest | died at 252s, wave 10, 509,712, 547 taps |
| ranks bombs first and abandons runners | **survived all 300s on three lives**, wave 11, 469,803, 427 taps |

Correct targeting survives the full run on fewer taps — and scores *less*, because it gives up
runners worth 400 points each. Greed scores faster and dies sooner. That trade is the decision the
game was missing.

Campaign winnability was re-checked across stages 1, 2, 3, 6, 9, 12 and 15: the opening stages
clear on three lives, and stage 15 now clears at two lives after eight overheats — a real fight
with a way through. Stage 6 fails here and fails identically on the pre-V21 build, so it is
pre-existing rather than new.

These rules apply in duels. Unlike V21's wards and divers, they describe what a hostile *does* —
identical on both clients, needing no synchronisation — so they do not disturb the spawn schedule
V20 made authoritative.

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

## V29 — friend-vs-friend: presence, attribution and a record

The duel mode worked and did not feel like playing someone you know. Reading the wire against the
running V23 build explained most of why: the server was already sending far more about the other
player than the client ever showed.

- `opponent_attack` carries `from`, the sender's name. `applyHazard(kind, durationMs)` was called
  without it, so a friend attacking you printed "GRAVITY ATTACK INCOMING" — word for word the
  sentence a solo hazard prints. The one moment in the mode where another person reaches across and
  does something to you was rendered as weather.
- `arena_flash` and `arena_launch` are broadcast to both players, and neither had a listener. You
  could spend 90 charge on a War Titan and the only feedback was a toast saying you had spent it.
- `opponent_left` had no listener. A friend who quit left you fighting a card that said CONNECTED.
- `rematch_state` had no listener. Tapping REMATCH threw you to a lobby reading "REMATCH REQUESTED"
  over six placeholder dots, identical whether your friend had already agreed or had closed the tab.
- `match_state` carries combo, charge, ammo and defused cores every 400ms. The rival card showed a
  name and a number.

### The rival read-out

The rival card gains a second row: reactor integrity as pips, their combo, and a charge bar
labelled with the most expensive thing that charge can currently buy. A rival sitting on 90 with
WAR TITAN on their bar is a warning you can act on; the raw number was only meaningful to someone
who had memorised the price list. `lives` is the one fact that was genuinely not on the wire — only
a player's own client knows it — so a `vitals` message was added. It is rate limited and clamped
server-side, and deliberately sits outside the `seq` ordering that guards `score` and the sends: it
grants nothing, so paying that ordering cost would only mean a burst of scoring could swallow the
update that says a player is down to their last reactor.

### Being attacked by a person

Every incoming threat — hazard, core or titan — now announces its author: their name, in their skin
colour, with their reactor orb. While a hazard runs, a strip carries their name and counts it out,
and the arena edges take their colour. A hazard lasts four to five and a half seconds, which is long
enough to forget who caused it, and forgetting is what turns it back into weather. Anything you send
is confirmed as having landed on them.

### Rooms that survive a phone

The most common way friend-vs-friend broke was silent. Creating a private room and sharing the link
is not one continuous act on a phone: you leave the browser for a messaging app, and mobile browsers
freeze or drop the socket of a backgrounded tab. `disconnect()` granted a grace period only to a
countdown or a live match, so a *waiting* room was destroyed the instant its host switched apps. The
friend who tapped the link that had just arrived got "Room not found or already started", and the
host's client — which reconnects on its own after 1.2 seconds — went on showing a lobby with a code
that addressed nothing. Neither player was told anything true.

Waiting rooms now hold for three minutes. A countdown will not open against an empty seat, so a
friend who arrives first waits in a lobby that says who they are waiting for, and the host coming
back starts the match. A host opening their own invite link used to splice themselves out of their
own room and orphan it; joining a room you are already in is now idempotent.

A friend tapping the link also lands on the generic launch splash, because `handleUrl` joins behind
the overlay. The splash now names the person waiting. Auto-entering was considered and rejected:
entering starts the music, and browsers only permit that from a real gesture.

### An ending worth staying for

`match_end` carries the running head-to-head record between the two pilots. It is kept in the
matchmaker rather than in the room, keyed on the pilot id pair, because rooms die — five minutes
after a result, and a fresh invite link makes a new one — and "we're 3–2" should still be true
afterwards. A forfeit is deliberately not recorded: counting it would let someone farm a record by
killing the tab whenever they fell behind, and would tell the survivor they beat a friend they never
actually finished a match against. The record lives in memory with a six-hour idle expiry; moving it
to the KV store in `server/store.ts` would let it survive a deploy, and was left out rather than put
async I/O in the socket path.

The rematch handshake now names who has agreed and keeps both players on the result screen, where
the record is.

One ending was missing entirely. `damage()` calls `finish(false)` with no duel data when the last
reactor goes, which clears `game.running` — and `finish()` opens with `if(!game.running)return`. So
a duellist who died at 0:40 sat on a solo-shaped RUN COMPLETE screen showing their own score, with
no rival, no rematch button, and was never told who won the match they were playing against their
friend. Losing is fine; not being told is not. That screen now says the clock is still running and
resolves into the real result when it stops.

Nothing here changes the spawn schedule. Both arenas still replay one server-authoritative list of
enemies, and the score gap still reflects play.
