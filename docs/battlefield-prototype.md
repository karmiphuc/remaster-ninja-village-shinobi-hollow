# Grand Battlefield — real-time study

Open [`prototypes/Shinobi Hollow - Grand Battlefield.html`](../prototypes/Shinobi%20Hollow%20-%20Grand%20Battlefield.html) as a separate, standalone HTML. All code and procedural assets are embedded. The main game's `index.html` remains unchanged from `8ee4c7e` (merged PR #38); campaign saves are never accessed.

The armies begin with 2,480 and 2,260 combatants represented by 300 figures. Each figure carries an actual share of its formation's HP. Both armies deploy **infantry → gunners → archers → cavalry**, from front to back. All four arms act continuously; there is no shared firing/melee phase clock.

## What to try

- Watch infantry slowly close, then fight enemies within personal weapon reach. Reserve ranks move up as soldiers fall. Holding a formation stops its march while allowing nearby defence.
- Watch matchlocks find clear shots through gaps and around the edges of friendly ranks. They hold fire when a friendly soldier or a terrain rise blocks their sight line. Bullets travel straight, and their swept path resolves the first living body encountered. A friendly crossing after release harmlessly intercepts the bullet; it never takes friendly-fire damage.
- Archers fire overhead. Each arrow has a sampled landing point and a flight time. Only an enemy body inside its landing footprint takes damage. Scatter, movement and the spacing of ranks therefore determine actual projectile hit counts; a fired arrow does not guarantee damage. Archers prefer ranged targets when they are in range.
- **MRK** sets each ranged soldier's firing interval. Select a blue ranged label to see the formation's MRK and seconds per shot. The current equipment-derived values are 38 MRK / 3.39 seconds for matchlocks and 20 MRK / 2.53 seconds for bows.
- Cavalry approaches the **closest formation**, beginning with the infantry, charges into nearby opponents, then withdraws to the rear and regroups before charging again. It uses the edge of the friendly line for its approach/return, rather than bypassing infantry to attack the enemy's rear. Riders turn to face their actual movement or opponent.
- Drag to pan; pinch/scroll to zoom. **Overview** shows the whole army; **Follow** focuses the selected formation or infantry front. Both **2.5D / Isometric** projections show the same ongoing battle.
- Tap a blue formation label for **Hold**, **Advance**, or cavalry **Charge cycle**. Pause, change speed (1× / 2× / 0.5×), or replay. Space pauses; F follows; O opens Overview; Escape closes help/orders.
- After victory, bodies, pools of blood, dropped weapons and fallen standards remain. Replay clears the field.

## Combat model

`combat.js` is independent of rendering, DOM, camera and frame rate. It owns the actors' HP, formation motion, individual attack/fire timers, projectile pools and cavalry state machine. Movement and combat run at a fixed 60 Hz; target acquisition runs every 0.18 seconds. A reusable 64-unit spatial grid supports local melee queries and swept bullet intersections. The gunner target search considers a bounded set of nearby candidates; it does not run an expensive global shot planner. A gunner keeps a small lane offset after finding a clear view, avoiding repeated side-to-side resets.

Ranges are 650 world units for matchlocks and 840 for bows. The firing interval is `base / (1 + 0.85 × MRK / (MRK + 40))`, using a 4.8-second matchlock base and a 3.25-second bow base. The bonus is bounded. MRK also tightens arrow dispersion. Bows clear intervening friendly ranks; they do not inflict friendly damage at landing.

The private adapter reuses the game's unit attack/defence, equipment MRK, cohesion, resistance, damage and bounded overtime pressure formulas. Per-strike coefficients tune the continuous encounter, rather than repeatedly spending the campaign's old phase damage budgets. Melee damage requires contact at impact, and a telegraphed attack can miss if its target leaves reach. Simultaneously committed melee can produce mutual hits. Projectile power is captured at release; a later wound, buff or death cannot change an arrow/bullet already in flight. In-flight attacks settle before the final result.

Only actual landed damage subtracts HP and formation strength. Casualty routs depict already-accounted losses, retaining the 18% baseline chance after 55% losses. They never deduct additional troops. There are no round-limit, casualty-ratio or morale victories: combat-capable HP must reach zero.

## Art and scope

`asset-bridge.js` calls the real `footSoldierFrame`, `riderFrame`, `artTroopLook`, `reactionHumanFrame`, `sashimonoFrames`, `buildingSprite` and `propImg` painters. Ten shared modular kit/face rigs retain the existing detailed chibi art. Ground projection changes; characters stay upright with their original detail canvases.

This remains a presentation/combat prototype. Its real-time cadence, physical targeting and individual HP distribution intentionally differ from the campaign, so campaign results are not reproduced. Full commanders/duels, retainers, jutsu, siege mechanics, terrain bonuses and campaign orders are not integrated. Static tree/building props are scenery; gun sight checks cover living soldiers and terrain rises. Character facings are still left/right, not a full set of isometric directions. Formation motion is lightweight, without an individual collision/avoidance simulation.

## Build and performance

- `shell.html`: responsive controls, safe areas, elapsed battle timer and selected formation details.
- `preview.js`: projection, cached terrain, camera and drawing; it delegates gameplay to `combat.js`.
- `combat.js`: continuous model, reusable spatial grid, timers and actual impact accounting.
- `asset-bridge.js`: private adapter to the game's art and combat primitives.
- `tools/build-battlefield-prototype.py`: embeds the sources into one HTML; strips the game's boot hook and global audio setup. Source `index.html` is read-only.

The renderer retains one display canvas, one replaceable terrain canvas, ten shared rigs, at most 300 figures, 220 effect slots and 160 projectile slots. Corpses and discarded gear reuse each casualty's kit. Rendering creates no canvases. Replay reuses the art set, and projection changes release the old terrain backing. The display backing is capped at DPR 2 and 2.3 million pixels. `?perf=1` enables the frame/canvas HUD; `?test=1` leaves time under test control.

## Validation

```sh
python3 tools/build-battlefield-prototype.py
npm run test:prototype
```

The focused Chromium run passed **155 checks**, with zero page errors. Full output and screenshots are in [`reports/battlefield-prototype`](../reports/battlefield-prototype).

| Check | Result |
|---|---|
| Friendly blocking / clearing | No shots through the blocker; firing resumes after it moves |
| Ally crossing a bullet after release | Harmless interception; no friendly or downstream target damage |
| MRK 0 → 80, same 30-second fixture | 185 → 291 shots; 4.80 → 3.06 seconds per firing interval |
| Overhead arrow fixture | 294 released = 52 hits + 228 misses + 14 still airborne |
| Target moves after arrow release | Endpoint unchanged; missed target takes zero damage |
| Shooter buff after projectile release | Landed damage unchanged |
| Cavalry fixture, both sides | Two charge/withdraw/regroup cycles; initial target is infantry |
| Default battle at 12 seconds | Guns, arrows and melee all active concurrently |
| 30 / 60 Hz; either projection | Identical formation state and casualties |
| Five seeded full battles | All finish through actual elimination; actor HP and formation strength agree |
| Seed 7711, normal landscape | Kage 914.369, Kurogane 0; 196 fallen figures, 32 casualty routs |
| Damage conservation | Initial 4,740 = remaining 914.369 + applied 3,825.631; no negative HP |
| Angled / isometric canvas backing | 31.6 / 33.8 MiB at 1440 × 900 |
| Phone viewport, 430 × 932, emulated DPR 3 | 32.8 MiB; backing capped to 860 × 1864 |
| Warm rendering / eight replays | Zero new render canvases; rig memory unchanged |
| Eight projection switches | Only terrain replaced; backing memory returns to its starting value |
| Offline standalone document | No external assets, storage accesses or audio contexts |

The short automated autoplay smoke sample reported 54 fps / 33.4 ms frame p95 in headless Chromium, including startup. It is not a physical iPhone performance measurement. The managed test browser blocks direct `file://` navigation; offline execution is tested by loading the complete HTML into an offline context. Physical Safari, Files/Quick Look handling and sustained device frame rate still need a device check.
