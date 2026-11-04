# Optional real-time campaign battles

Gunners now use readable rank volleys with planted aim/recoil, actual muzzle sockets, lighter smoke and the existing firing sound. Chain Strike/Rapid Shot resolve real follow-ups, Countershot affects approaching foes, and Vanguard officers move forward. See the [complete skill audit, before/after measurements and captured firing sequence](realtime-volleys-skills.md).

Choose **Village → Options → Battle: Real-time** before entering a battle. The choice and preferred shapes are saved in `G` with save version 1. Older saves default to Classic. Each battle captures its mode when it opens; changing the village preference cannot change a battle already underway.

Infantry, gunners, archers and cavalry retain their original deployment order. Infantry advances into personal weapon reach. Bows shoot overhead with sampled landing points; only projectiles that hit an enemy footprint cause damage. Gunners can fire from behind friendly infantry. Allies are bypassed at release and throughout flight, with zero friendly damage. Each bullet aims at the target's current position when released, keeps that straight trajectory, and hits the first enemy footprint it crosses. Moving targets can evade, and another enemy can catch a stray bullet. Terrain rises still block sight; close/mid-range accuracy and long-range dispersion remain.

## Controls and balance

- Tap a blue formation label, or its top strength row, for **Hold / Advance** and shapes. Shapes have a 1.5-second change cooldown.
- Select cavalry, then tap an enemy field label or target icon. **Auto** chooses useful targets: enemy riders engaging friendly infantry receive priority; exposed ranged formations become attractive once the foot lines clash. Otherwise cavalry engages a nearby opponent. This is a persistent preference: committed charges finish their current cycle, and riders still have to reach the target. Infantry contact slows withdrawal and regrouping; repeating an order cannot reset that delay.
- **Overview**, **Follow**, dragging, pinching and the **2.5D / Iso** button control the view. Pause allows orders. Retreat remains explicit and takes effect immediately in the live field.

| Arm | Line | Loose | Third shape |
|---|---|---|---|
| Infantry | 18% less melee damage | 10% less ranged damage; wider ranks | Pikewall: stationary; 45% less melee damage |
| Archers / gunners | +12% attack; 15% tighter dispersion | 10% less incoming damage; wider ranks | — |
| Cavalry | +12% ordinary melee attack | +15% movement; 10% less ranged damage | Skein: +35% first charge impact; −10% ordinary melee attack |

Gun cadence is **20% slower** than the initial prototype: the base interval rises from 4.8 to 6 seconds. Bow base cadence stays 3.25 seconds. Both use `base / (1 + .85 × MRK / (MRK + 40))`. Guns retain close/mid-range accuracy, with dispersion rising between 390 and their maximum 650-unit range. Bows reach 840. Repeater/rifle bursts emit their actual two/three projectiles with a reload trade-off. Charge bonuses apply to first impact only, not every defensive strike during withdrawal.

## Integration and limits

`combat.js` owns physical motion, hit timing and individual HP shares. `renderer.js` draws the source game's modular equipment and faces. `battle-realtime-campaign.js` connects the actual `BT.A` groups, commander/retainer effects, skills, casualty accounting, Ki, recovery, rewards and retreat. No second campaign troop ledger is saved. External duel/Jutsu damage and recovery reconcile into the same HP shares without applying losses twice.

The existing round lifecycle remains as 25-game-second field windows for duels, Ki, medicine and bounded overtime pressure. Bookkeeping runs without pausing ordinary marching or reloading. A duel, duel choice or grenade prelude still suspends the field. These boundaries do not automatically kill, route or defeat an army. Existing 18% casualty-rout presentation below 45% remaining strength is retained. Grenades use the existing infantry script before the live field window. Castle walls use Classic siege targeting until the breach; the surviving armies then enter Real-time. Cinematic duels suspend the live model and resume it after its real HP/rescue events settle.

Real-time uses up to 48 figures per formation independently of the Classic density preference, two shared rank-and-file/guard variants per kit, and original hero identities. Rendered detail caches are compacted for the wider camera; the procedural painters and equipment definitions are unchanged. Hidden village display/rig caches and the unused Classic drawing buffer are released, then rebuilt on return. The display backing is capped at DPR 2 / 2.3 million pixels. Rendering allocates no actor canvases; targeting runs every .18 seconds over reused spatial bins. There is no individual collision solver, traffic queue or tactical terrain obstacle planner. Tree/castle props remain scenery; gun sight checks cover the terrain height field; swept bullet collisions consider enemies only. Real-time balance deliberately differs from staged Classic outcomes.

## Duel execution playback fix

The cold companion failure was reproduced in the actual update/draw loop: normal following had already attached `_f`, the opposite-facing sprite cache, to a beast rig. A later `beastSet(kind, 1)` ran `mapSet` over that nested set and passed it to `flipCanvas` as an image. The RAF error handler logged the exception while the HP event clock continued. The frozen background stayed on screen until the duel ended, hiding the execution.

`mapSet` now excludes `_f`; `beastSet` and normal turning share the same facing set. Selected companion, dismount, throw and mounted poses warm during the approach. `duelFacingFrame` reuses one existing flipped frame or prepares just that frame, rather than flipping the whole atlas during a reverse kick or loose-horse draw. The background freeze captures only the current/finishing camera windows at the original detail density, reducing the portrait snapshot from roughly 20 MiB to 4.4 MiB. These are presentation changes: `simDuel`, real `tdHit` damage, retainer/talisman saves and commander consequences remain authoritative.

## Local verification

```sh
python3 tools/apply-battle-realtime.py
python3 tools/build-battlefield-prototype.py
node tests/realtime-campaign.cjs
node tests/duel-cold-playback.cjs
npm run test:prototype
```

The sync tool updates embedded model/view/adapter blocks; the canonical integration hooks live in `index.html`. The resulting HTML needs no server, build tools or external assets to play.

The existing 35-suite regression run passed before the final execution/cache fixes. Focused duel, cavalry, animal, infantry-execution and randomization suites check the subsequent changes, including 120 unchanged baseline HP ledgers. The campaign suite checks the real menu, version-1 save migration, stances and target controls, fixed-density physical outcomes, complete battle rewards/losses/wounded, explicit retreat, standing-gate/breach transition, duel/rescue resumption and control cleanup. Cold-playback coverage includes all ten companion species, newer sword/yari/mount moves, 3v3 sequencing and rescues at 30 fps / 4×, with visible anticipation, impact and recovery and no render errors. Reports and actual game screenshots are in `reports/realtime-campaign/`.

Chromium mobile emulation is not physical Safari validation. Full officer-heavy battles and duel transitions require more memory than the isolated ten-rig prototype; `tools/probe-realtime-memory.cjs` records live canvas backing before/after collection without accessing a player's save. Sustained iPhone frame time, memory and app-switch recovery still need a device session.

Mobile-emulation canvas backing for eight 750-troop formations measured 31.9 MiB immediately after entry / 28.3 MiB after GC with no officers, and 50.2 / 46.7 MiB with sixteen equipped officers and thirty-two retainers. The officer stress case exceeds 48 MiB transiently; these figures are not a claim that every army or Safari session meets that ceiling. The visible field and the unused Classic drawing buffer no longer coexist. Detailed backing dimensions are recorded in [the canvas report](../reports/realtime-campaign/canvas-memory.json).

## Review corrections

The follow-up review fixes keep the covered village canvas suspended across browser resize events and run the existing cinematic/aftermath geometry update before returning to the live field. Replaced background canvases are explicitly released. Independent burst weapons apply their 68%/60% power per bullet, use one continuous reload timer (2/3 ordinary intervals for Repeater/Rifle), and bypass Classic's aggregate burst factor and round-based firing gate. Eagle Eye, Horse Lord and tactic counters now feed the real-time damage adapter; projectile counter context is captured at release. Solo kill credit uses a separate path from regular formation commander shares.

`tests/realtime-review.cjs` reproduces all five findings against actual campaign actors, including independent/skirmish kill credit, real burst weapon styles, unchanged live model coordinates across rotation, fresh duel/aftermath buffers and a rendered duel after rotation. Its 41 checks pass. The officer-heavy resize fixture retained 46.39 MiB before and after a complete orientation cycle, with the hidden village canvas remaining 0×0. Campaign integration (28 checks), siege, battle-end, reference duel ledgers and all 24 cold-playback scenarios also pass. Measurements use Chromium emulation, not physical Safari.

## Bullet paths, cavalry and larger forces

The follow-up flow change raises the campaign cap from 36 to 48 physical actors per formation (+33%, up to 384 rank-and-file models across eight full formations, plus officers/retainers). All share the same finite equipment/frame sets; Classic density cannot change live physical targeting. The isolated demo retains its 300-model population.

Formation footprints are cached at the existing 0.18-second think interval. Cavalry scores nearby opponents, prioritises riders threatening its main infantry, and seeks exposed ranged flanks once the infantry is engaged. Player-selected targets remain authoritative. Approach plans refresh at most once per 0.9 seconds with hysteresis. Riders narrow their marching width to clear the full infantry screen, choose an upper or lower flank, and turn in from its side. In a mounted-only fight they intercept directly. Route waypoints use the same bounds as formation movement, including near the field edge.

A charge enters its impact state only at actual local contact. Rear riders close up, each rider receives its charge bonus once, and a short impact window leads into withdrawal/regroup. Stalled approaches fall back to direct pursuit; an unreachable charge safely aborts rather than fabricating a hit. Infantry still slows disengagement. Depleted formations close empty files while preserving neighbours; survivors walk to their new slots without teleporting. Reconciliation repacks revived survivors too.

The two-bullet/three-bullet styles retain their per-bullet power and reload delays. A burst can reacquire a target that fell between targeting ticks. The selected gun formation now shows the actual burst reload interval. Cavalry controls show its intent and current cycle state.

Local checks cover rear gunfire and crossing allies, evasion and lethal strays, actual ranged flanks and infantry relief, player targets, aborted charges, mounted-only elimination, separated infantry survivors, fixed-step determinism, seamless recovery windows, and real campaign rewards/saves/retreat/siege/duel rescue integration. `tests/realtime-flow-performance.cjs` compares 36/48-model campaign caps using actual officer equipment on a phone-sized backing. It records canvas allocation separately for rendering and first-use casualty cache entries. These are Chromium measurements; sustained physical iPhone Safari frame rate remains unverified.

### Flow verification measurements

The final focused runs pass 245 prototype/model/render checks, 30 actual campaign integration checks, 41 review regressions, and 23 actor/memory checks. HP conservation errors remain below 1e-6, including medicine and duel reconciliation.

The actor-cap comparison uses eight 720-troop groups, identical equipment and seed, a 430×932 CSS viewport and a DPR-2 battlefield backing. “Officers” includes 16 unique commanders with 32 retainers. It compares the two population caps on the new combat model, rather than attributing every gameplay difference to actor count.

| Actor cap | Visible physical actors | Live canvas MiB, start → end | Median update / draw, ms | Draw p95, ms |
|---|---:|---:|---:|---:|
| 36, no officers | 288 | 27.74 → 27.74 | 0.3 / 3.8 | 56.7 |
| 48, no officers | 384 | 28.35 → 28.37 | 0.5 / 5.1 | 64.3 |
| 36, officers | 336 | 46.39 → 46.41 | 0.3 / 3.3 | 40.3 |
| 48, officers | 432 | 46.77 → 46.79 | 0.4 / 4.6 | 46.8 |

No new canvases were created by rendering in any fixture. First-use casualty variants created 3–9 canvases through the existing finite reaction cache (about 0.02 MiB growth), and rig atlas backing did not increase with population. The slightly larger legacy field/aftermath backing accounts for the remaining static canvas increase. Headless software drawing has long tail stalls in both caps; these numbers support the memory budget, not a 60-fps Safari claim. Raw results and screenshots are in [`reports/realtime-flow`](../reports/realtime-flow).
