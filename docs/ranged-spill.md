# Ranged volleys and spill

The infantry engagement clock is **infantry-only**: 2.7 seconds of contact time, with 1.25 seconds spent advancing between lines. Gunner volleys, archer volleys and opening countershots do not use that clock. This refinement changes ranged targeting; it does not change the infantry timer, weapon stats or HP-based duels.

| Attack | Primary target and spill |
|---|---|
| Guns | Infantry → Gunners → Archers → Cavalry, skipping absent/depleted groups. Remaining volley damage can continue through every rank. |
| Arrows aimed at Gunners | The aimed gunner line, with spill only into Infantry and Archers. |
| Arrows aimed at Archers | The aimed archer line, with spill only into Gunners and Cavalry. |
| Arrows with neither ranged line present | Aim at Infantry, then Cavalry as fallback. The same immediate-neighbor rule applies. |

Archers retain their existing gunner-first, archer-second preference. Each field volley's footprint is anchored to its original aim; destroying that line cannot let the same volley jump into a more distant rank. Another attacking group can choose a new aim from the remaining troops. Empty ranks do not make distant ranks adjacent. Multiple groups or independent heroes in the same formation remain eligible targets within that footprint.

The old two-target-group cap is removed for guns and field arrows. Guns instead stop when their actual damage is spent or no targets remain; field arrows are bounded by their original aim and adjacent ranks. The existing **25% loss of remaining volley damage between targets** remains. Infantry screens still absorb gun damage before it passes to the rear; there is no guaranteed free damage on every formation.

Arrow scatter retains its existing **85% chance to allocate 15% of the volley** to one other formation. The candidates are now actual neighboring ranks, so scatter can hurt an adjacent line while the primary target still stands. Without an eligible neighbor, the whole volley stays aimed. Scatter spends part of the original damage budget, rather than adding damage.

Damage resistance, tactics, cohesion, wards, Wooden Tate, smoke, marksmen, Rapid Shot, retainers and commander bonuses still use their existing formulas. Opening countershots and standing-wall archery retain their existing rules; walls still apply their normal ranged damage modifiers. Both sides use the same targeting rules. Damage events remain idempotent and use the existing ranged projectile playback, with no infantry advance delay.

## Validation

`tests/ranged-spill.cjs` checks **1,440 seeded combinations** of formation availability, attacker side, weapon phase and attack strength. It verifies rank order, adjacent-only arrows, bounded attack expenditure, finite and capped casualties, missing ranks, duplicate groups, both scatter neighbors, same-line heroes, timer independence, opening countershots and standing-wall archery.

Real 430×932 battle playback at 30 fps / 2× speed verifies that both ranged phases commit exactly their resolved losses once, including repeated-event checks. Results are in [ranged-spill.json](../reports/ranged-spill.json). Run `node tests/ranged-spill.cjs`; `RANGED_DOWNLOAD` optionally tests a standalone HTML export. The suite is included in `npm test`.

All **25 local suites were validated** ([full run and campaign rerun](../reports/ranged-spill-regression.txt)): 24 passed in the full run; the campaign suite passed on rerun after correcting its obsolete requirement that a returning castle keep exactly its old budget. It now checks both the existing old-budget minimum and the uprising-strength floor. Rebellion gameplay is unchanged. The exact **Shinobi Hollow.html** download also passed the **9,988 focused checks** and byte-matches `index.html`.

The code adds only a small per-volley filter over existing formation groups. It adds no per-frame searches, sprites, canvases, persistent fields or migrations. Saves remain version 1.
