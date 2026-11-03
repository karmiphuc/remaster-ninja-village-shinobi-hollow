# Field executions and battle pacing

The standalone source is `index.html`. This change adds small paired infantry finishes and adjusts presentation timing. It adds no items, stats, UI or save fields.

## Occasional field finishes

`planFieldExecutions()` uses a private visual PRNG to nominate about 10% of existing infantry casualty events. `beginFieldExecution()` chooses a living attacker already within weapon reach and close to the victim's row. An already assigned hero/retainer remains the visual attacker when reachable. Ordinary swords use a short passing cut, yari a low thrust, heavy blades a downward cut, and naginata a sweep.

The animation lasts 0.7 seconds at 1× speed: 0.24 seconds of anticipation and 0.46 seconds of impact/recovery. It uses the soldier's existing equipped wind, attack, follow-through and recovery frames. There are no additional sprite canvases, detached weapon assets, camera cuts, zooms, global freezes or damage events. Other soldiers continue fighting, moving and falling.

At most two pairs are active across the battlefield. Each actor belongs to at most one pair. Rendering adds only a small step and a short ink/steel trail after the actual death event. It does not move simulation coordinates, suspend orders, add HP damage or change kill credit. Existing death states still own equipment drops, blood and flattened remains.

The victim must be ordinary rank and file. Heroes, guards, pets, ranged impacts, grenades and duel losses retain their existing presentation. Unbreached siege walls exclude field finishes. Distant targets, occupied actors, dead attackers, moving targets that leave reach, and cinematic transitions fall back to ordinary combat. A victim that flees cancels the finish before its fatal effect; the existing 18% casualty-rout chance after 55% losses remains intact. No additional troops are deducted.

`updateFieldExecutions()` visits at most two records, allocates no per-frame state and releases actor references on expiry/cancellation. Recovery, battle cleanup and duel entry also clear them. No queue or historical event collection is added to `G`.

## Infantry time includes pursuit

Army infantry now has a **5.4-second shared fight-and-pursuit clock**, replacing the original 2.7-second clock plus synthetic presentation stretching. The original phase damage is divided across the longer clock, so a normal uninterrupted front-line exchange keeps its previous damage cap. Each advance to a different line still costs 1.25 seconds with no melee damage; same-line retargets cost 0.14 seconds.

Clearing a line ends its attack poses. Soldiers immediately follow their planned advance to the next live formation. If the remaining clock cannot cover travel and another strike, they make a partial chase without dealing extra damage. The last visible defender falls near the clearing deadline, rather than leaving an empty line throughout the exchange. There is no padding after the actual exchange. Strong armies can reach additional rear lines only by clearing each preceding line and spending the required travel time.

`resolveInfantry()` plans combat and optional partial pursuit; `timedInfAdvance()` queues the matching block movement, target references and deadlines. `exitSprite()` marks a visually cleared formation and `updSprite()` ends its attack poses and releases the next planned advance. Damage events remain individually resolved and idempotent. No pathfinding or collision simulation runs per frame.

HP-duel clocks, cavalry timing, field ranged spill, faster reactions and the small field finishes remain in place. Sieges use their separate gate assault and rampart-targeting rules. See [pursuit and siege corrections](pursuit-siege.md).

## Ranged impact hold and faster casualties

Gun and archer phases get **0.5 additional visible seconds at 1× speed**, after impact. Because the existing battle playback rate is 0.7, this is 0.35 battle-clock seconds. Firing, projectile flight, damage events, reload timing and spill calculations remain unchanged. The hold scales with the player's battle-speed setting.

`REACTION_SPEED = 1.33` advances the existing death/rout state and escape motion 33% faster. It preserves panic, recoil, discarded gear, kneeling/folding and the distinction between fleeing soldiers and bodies. Equipment physics retain their existing gravity, bounces and settling. Active soldiers' movement speed is unchanged. The resulting reaction duration is about 25% shorter.

## Measured fixture and validation

The historical pacing baseline was recorded from merged PR #34. PR #35 stretched the infantry presentation; the subsequent pursuit correction replaces that stretch with actual fight/travel time. These are 1× durations for a fixed 400-vs-400 fixture on a 430×932 viewport; battle layout and troop strength affect other encounters.

| Presentation | Before | After |
| --- | ---: | ---: |
| Gun phase countdown | 3.471 s | 3.971 s |
| Archer phase countdown | 4.643 s | 5.143 s |
| Death through settled body | 2.702 s | 2.033 s |
| Sample rout through escape | 13.745 s | 10.336 s |

Each side still loses exactly 240 of its 400 troops in the scripted exchange. Current playback checks exercise both 30 and 60 fps / 4× playback, with a maximum of two finishes active at once.

`tests/field-combat.cjs` compares the original timing fixture, raw planning and presented planning; checks untouched damage, movement speeds and combat RNG; verifies ranged firing/flight timestamps; covers both facings and four weapon families; measures faster death/rout completion; tests saturation, cancellation, distant actors, unbreached walls, grenade synchronization and repeated impacts; and checks real phase playback. Warmed field rendering creates zero canvases and consumes no combat RNG.

Reproduce baseline/current probes with `tools/probe-field-pacing.cjs`; review frames use `tools/preview-field-executions.cjs`. The [animation](field-executions-preview.gif) and [contact sheet](field-executions-preview.png) are generated from actual equipped frames and casualty states, and are not runtime dependencies. Local Chromium tests do not measure physical iPhone Safari frame rate.

Historical PR #35 local result: **nine related suites pass**—field-combat, battle-end, siege, tactics, melee-rebels, ranged-spill, duel-executions, duel-cavalry and animal-duels. That version of the field suite recorded **113 checks**; current pursuit/siege checks are linked separately above. All 120 reference duel HP/damage ledgers remain identical. The standalone export byte-matches `index.html`; the logistics code is byte-identical to merged PR #34. The [regression log](../reports/field-combat-regression.txt), [focused results](../reports/field-combat.json), [baseline](../reports/field-pacing-baseline.json) and [current probe](../reports/field-pacing-after.json) record the checks.
