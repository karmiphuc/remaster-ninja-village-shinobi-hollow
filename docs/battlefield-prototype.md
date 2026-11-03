# Grand Battlefield study

Open [`prototypes/Shinobi Hollow - Grand Battlefield.html`](../prototypes/Shinobi%20Hollow%20-%20Grand%20Battlefield.html) as a separate, standalone HTML. It includes all its code and procedural assets; no server, library download or campaign save is required. The main game's `index.html` is unchanged from `8ee4c7e` (merged PR #38).

The study answers one question: can a continuous battlefield with depth, sweeping cavalry and a freely moving camera make the existing art feel larger? It is an interactive battle prototype, not a replacement campaign battle engine.

## What to try

- Start with **Overview**. Watch the infantry meet across the centre and the two cavalry wings ride around the outside toward the opposing matchlocks.
- **Drag** to pan; **pinch / scroll** to zoom. Try both portrait and landscape. **Follow** moves closer to the selected formation or the infantry front.
- Tap a **blue formation label**. **Hold** stops its march while allowing attacks against enemies in contact. **Advance** resumes movement. Cavalry also has **Sweep wing**.
- Switch **2.5D / Isometric** during combat: positions, targets and casualties stay the same. The second view tests projection, not a new battle roll.
- Pause, change speed (1× / 2× / 0.5×), or replay. Space pauses; F follows; O opens the overview; Escape closes help/orders.
- Let a battle finish. Bodies, blood pools, dropped weapons and fallen standards persist; surviving troops celebrate. Replay clears the field.

The armies begin with 2,480 and 2,260 combatants, represented by 300 figures. Figures represent shares of formations, rather than one figure per soldier. Terrain and siege engines are scenery in this study.

## Reuse and boundaries

`asset-bridge.js` calls the actual `footSoldierFrame`, `riderFrame`, `artTroopLook`, `reactionHumanFrame`, `sashimonoFrames`, `buildingSprite` and `propImg` painters. Ten shared kit/face rigs retain the existing shaded, modular chibi characters. Ground projection changes; characters remain upright and preserve their native detail canvases.

The private battle adapter reuses `finishArmy`, `resolvePhase`, `guardInfantryBreakthrough`, cohesion and offensive-pressure formulas. Resolved damage budgets are divided into individually applied impacts; damage is clamped to remaining combatants and is never multiplied for extra animation. Melee impacts require physical formation contact. Casualty routs depict already-accounted losses, including the 18% chance after 55% losses. No extra headcount is deducted for fleeing. Battles end through combat attrition.

Movement and targeting are **experimental**: cavalry deliberately attacks rear formations, and contact can cancel hits that the campaign's abstract resolution would allow. Results are not claimed to match the campaign. Commanders, duels, retainers, jutsu, siege combat, terrain bonuses and campaign orders are not integrated here. There are no individual collision queues or pathfinding searches. Full isometric staging would also need more character facing directions; this study deliberately reuses the existing two-direction rigs.

## Implementation and performance

- `shell.html`: responsive canvas shell and controls, with safe-area padding.
- `preview.js`: projection, cached terrain, camera, group movement, fixed-step simulation, effects and presentation. World state is independent of camera projection.
- `asset-bridge.js`: small adapter inside an isolated copy of the game's library. The build removes the game boot hook and the global audio setup, so save handlers and audio gesture handlers are never installed. The preview never reads or writes player storage.
- `tools/build-battlefield-prototype.py`: bundles the three sources and the current procedural library into the downloadable HTML. The game source itself is read-only.

The renderer uses one display canvas, one replaceable terrain canvas, ten finite shared rigs, 300 figures, 220 effect slots and 160 projectile slots. Corpses and discarded weapons reuse each casualty's procedural kit. There is no per-frame canvas creation. Replay reuses the rig set; switching projection releases the old terrain backing before replacing it. The display backing is capped at DPR 2 and 2.3 million pixels. Optional `?perf=1` shows frame timing and owned canvas memory; `?test=1` leaves time under test control.

## Validation

Build and run the focused browser checks:

```sh
python3 tools/build-battlefield-prototype.py
node tests/battlefield-prototype.cjs
```

The test covers 30/60 Hz determinism, identical combat across both projections, real damage accounting, hold/advance/flank orders, pan/zoom/pinch, pause/speed/replay, victory through attrition, persistent casualty states, warmed rendering without canvas allocations, repeated perspective switches, portrait/landscape controls and offline execution without storage or audio access. Generated screenshots and measurements live in [`reports/battlefield-prototype`](../reports/battlefield-prototype).

The managed Chromium environment blocks direct `file://` navigation by browser policy. Offline standalone execution is tested by loading the complete HTML document into an offline browser context. Actual iPhone Safari, Files/Quick Look handling, sustained device frame rate and thermal behaviour still need a physical-device check; desktop emulation does not establish those results.

Measured in the focused Chromium run (41 checks passed, zero page errors):

| Check | Result |
|---|---|
| Angled view, 1440 × 900 | 31.6 MiB owned canvas backing |
| Isometric view, 1440 × 900 | 33.8 MiB owned canvas backing |
| Phone viewport, 430 × 932, emulated DPR 3 | 32.8 MiB; capped to an 860 × 1864 backing |
| Warmed playback / eight replays | Zero new render canvases; rig memory unchanged |
| Eight projection switches | Only eight replacement terrain canvases; backing memory returns to its starting value |
| Same seed at 30 / 60 Hz and either projection | Identical formation state and casualties |
| Complete seeded battle | Kage 884.604 remaining, Kurogane 0; 231 fallen figures and 18 casualty routs |
| Damage accounting | Initial 4,740 − remaining 884.604 = applied 3,855.396; no negative troop counts |
| Standalone file | 1.34 MiB; zero external assets, storage accesses or audio contexts |

The short automated autoplay sample reported 47 fps / 66.7 ms frame p95 in software-rendered headless Chromium, including startup. It is a smoke measurement, not an iPhone performance result. The remaining presentation work before campaign integration is directional character art, formation avoidance, richer contact choreography and real-device profiling.
