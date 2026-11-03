# Field executions and battle pacing

The standalone source is `index.html`. This change adds small paired infantry finishes and adjusts presentation timing. It adds no items, stats, UI, save fields or combat rules.

## Occasional field finishes

`planFieldExecutions()` uses a private visual PRNG to nominate about 10% of existing infantry casualty events. `beginFieldExecution()` chooses a living attacker already within weapon reach and close to the victim's row. An already assigned hero/retainer remains the visual attacker when reachable. Ordinary swords use a short passing cut, yari a low thrust, heavy blades a downward cut, and naginata a sweep.

The animation lasts 0.7 seconds at 1× speed: 0.24 seconds of anticipation and 0.46 seconds of impact/recovery. It uses the soldier's existing equipped wind, attack, follow-through and recovery frames. There are no additional sprite canvases, detached weapon assets, camera cuts, zooms, global freezes or damage events. Other soldiers continue fighting, moving and falling.

At most two pairs are active across the battlefield. Each actor belongs to at most one pair. Rendering adds only a small step and a short ink/steel trail after the actual death event. It does not move simulation coordinates, suspend orders, add HP damage or change kill credit. Existing death states still own equipment drops, blood and flattened remains.

The victim must be ordinary rank and file. Heroes, guards, pets, ranged impacts, grenades and duel losses retain their existing presentation. Unbreached siege walls exclude field finishes. Distant targets, occupied actors, dead attackers, moving targets that leave reach, and cinematic transitions fall back to ordinary combat. A victim that flees cancels the finish before its fatal effect; the existing 18% casualty-rout chance after 55% losses remains intact. No additional troops are deducted.

`updateFieldExecutions()` visits at most two records, allocates no per-frame state and releases actor references on expiry/cancellation. Recovery, battle cleanup and duel entry also clear them. No queue or historical event collection is added to `G`.

## Twice as much time in the infantry phase

`INF_CLOCK` remains a **2.7-second logical damage budget**, with its existing 1.25-second advance allowance. Doubling that logical budget would change breakthrough balance; this change leaves it intact.

`buildScript()` wraps the existing `buildPhaseScript()`. `capturePhaseTiming()` records existing orders/clocks once during planning. `stretchInfantryScript()` preserves the approach and first contact and expands the following exchange so the actual phase countdown is twice its old duration. Soldiers keep their normal movement speeds and repeated strike cadence. Casualty events, engagement windows, new movement orders, hero/retainer strikes and camera keys remain aligned. Previously queued orders are preserved. Hero wind-up leads and retainer lunge durations remain short. Lethal countershots and grenades keep their flight duration and meet their rescheduled impacts.

This applies to infantry presentation in field battles, skirmishes and sieges. Cavalry phases and HP-duel cinematic clocks retain their existing timing. The melee damage, screen/breakthrough rules, ranged spill and last-combatant victory conditions are unchanged.

## Ranged impact hold and faster casualties

Gun and archer phases get **0.5 additional visible seconds at 1× speed**, after impact. Because the existing battle playback rate is 0.7, this is 0.35 battle-clock seconds. Firing, projectile flight, damage events, reload timing and spill calculations remain unchanged. The hold scales with the player's battle-speed setting.

`REACTION_SPEED = 1.33` advances the existing death/rout state and escape motion 33% faster. It preserves panic, recoil, discarded gear, kneeling/folding and the distinction between fleeing soldiers and bodies. Equipment physics retain their existing gravity, bounces and settling. Active soldiers' movement speed is unchanged. The resulting reaction duration is about 25% shorter.

## Measured fixture and validation

The baseline was recorded from merged PR #34 before changing the code. These are 1× durations for a fixed 400-vs-400 fixture on a 430×932 viewport; battle layout and troop strength affect other encounters.

| Presentation | Before | After |
| --- | ---: | ---: |
| Infantry phase countdown | 6.887 s | 13.773 s |
| Gun phase countdown | 3.471 s | 3.971 s |
| Archer phase countdown | 4.643 s | 5.143 s |
| Death through settled body | 2.702 s | 2.033 s |
| Sample rout through escape | 13.745 s | 10.336 s |

Each side still loses exactly 240 of its 400 troops in the scripted exchange. The new phase produced five short finishes at both 30 and 60 fps / 4× playback, with a maximum of two active at once.

`tests/field-combat.cjs` compares the original timing fixture, raw planning and presented planning; checks untouched damage, movement speeds and combat RNG; verifies ranged firing/flight timestamps; covers both facings and four weapon families; measures faster death/rout completion; tests saturation, cancellation, distant actors, unbreached walls, grenade synchronization and repeated impacts; and checks real phase playback. Warmed field rendering creates zero canvases and consumes no combat RNG.

Reproduce baseline/current probes with `tools/probe-field-pacing.cjs`; review frames use `tools/preview-field-executions.cjs`. The [animation](field-executions-preview.gif) and [contact sheet](field-executions-preview.png) are generated from actual equipped frames and casualty states, and are not runtime dependencies. Local Chromium tests do not measure physical iPhone Safari frame rate.

Final local result: **nine related suites pass**—field-combat, battle-end, siege, tactics, melee-rebels, ranged-spill, duel-executions, duel-cavalry and animal-duels. The field suite records **113 checks**. All 120 reference duel HP/damage ledgers remain identical. The standalone export byte-matches `index.html`; the logistics code is byte-identical to merged PR #34. The [regression log](../reports/field-combat-regression.txt), [focused results](../reports/field-combat.json), [baseline](../reports/field-pacing-baseline.json) and [current probe](../reports/field-pacing-after.json) record the checks.
