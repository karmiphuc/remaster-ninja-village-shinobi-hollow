# Optional real-time campaign battles

Choose **Village → Options → Battle: Real-time** before entering a battle. The choice and preferred shapes are saved in `G` with save version 1. Older saves default to Classic. Each battle captures its mode when it opens; changing the village preference cannot change a battle already underway.

Infantry, gunners, archers and cavalry retain their original deployment order. Infantry advances into personal weapon reach. Bows shoot overhead with sampled landing points; only projectiles that hit an enemy footprint cause damage. Gunners require a clear straight shot and cannot fire through a tight friendly infantry screen. After being blocked, they seek a flank behind the friendly line and then step forward outside its edge, exposing themselves. A friendly crossing a released bullet intercepts it without friendly damage.

## Controls and balance

- Tap a blue formation label, or its top strength row, for **Hold / Advance** and shapes. Shapes have a 1.5-second change cooldown.
- Select cavalry, then tap an enemy field label or target icon. **Auto** returns to nearest-enemy targeting. This is a persistent preference: committed charges finish their current cycle, and riders still have to reach the target. Infantry contact slows withdrawal and regrouping; repeating an order cannot reset that delay.
- **Overview**, **Follow**, dragging, pinching and the **2.5D / Iso** button control the view. Pause allows orders. Retreat remains explicit and takes effect immediately in the live field.

| Arm | Line | Loose | Third shape |
|---|---|---|---|
| Infantry | 18% less melee damage | 10% less ranged damage; wider ranks | Pikewall: stationary; 45% less melee damage |
| Archers / gunners | +12% attack; 15% tighter dispersion | 10% less incoming damage; wider ranks | — |
| Cavalry | +12% ordinary melee attack | +15% movement; 10% less ranged damage | Skein: +35% first charge impact; −10% ordinary melee attack |

Gun cadence is **20% slower** than the initial prototype: the base interval rises from 4.8 to 6 seconds. Bow base cadence stays 3.25 seconds. Both use `base / (1 + .85 × MRK / (MRK + 40))`. Guns retain close/mid-range accuracy, with dispersion rising between 390 and their maximum 650-unit range. Bows reach 840. Repeater/rifle bursts emit their actual two/three projectiles with a reload trade-off. Charge bonuses apply to first impact only, not every defensive strike during withdrawal.

## Integration and limits

`combat.js` owns physical motion, hit timing and individual HP shares. `renderer.js` draws the source game's modular equipment and faces. `battle-realtime-campaign.js` connects the actual `BT.A` groups, commander/retainer effects, skills, casualty accounting, Ki, recovery, rewards and retreat. No second campaign troop ledger is saved. External duel/Jutsu damage and recovery reconcile into the same HP shares without applying losses twice.

The existing round lifecycle remains as 25-game-second field windows for duels, Ki, medicine and bounded overtime pressure. These boundaries do not automatically kill, route or defeat an army. Existing 18% casualty-rout presentation below 45% remaining strength is retained. Grenades use the existing infantry script before the live field window. Castle walls use Classic siege targeting until the breach; the surviving armies then enter Real-time. Cinematic duels suspend the live model and resume it after its real HP/rescue events settle.

Real-time uses 36 figures per formation independently of the Classic density preference, two shared rank-and-file/guard variants per kit, and original hero identities. Rendered detail caches are compacted for the wider camera; the procedural painters and equipment definitions are unchanged. Hidden village display/rig caches and the unused Classic drawing buffer are released, then rebuilt on return. The display backing is capped at DPR 2 / 2.3 million pixels. Rendering allocates no actor canvases; targeting runs every .18 seconds over reused spatial bins. There is no individual collision solver, traffic queue or tactical terrain obstacle planner. Tree/castle props remain scenery; gun sight checks cover living actors and the terrain height field. Real-time balance deliberately differs from staged Classic outcomes.

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
