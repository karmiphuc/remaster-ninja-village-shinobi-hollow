# Doubled real-time armies

Real-time battles now show up to **96 soldiers per formation**, up from 48: **768 across two full armies**, plus existing heroes, retainers and companions. Each formation's previous visual population doubles, capped at the actual troop count. Tiny armies and independent heroes are never cloned. Army HP, recruitment/upkeep, equipment, commander budgets, wards and save version 1 retain their existing accounting. Classic density settings remain unchanged.

The extra soldiers share the same formation HP; they do not grant another army or passive attack bonus. Physical targeting and scatter can produce different real-time outcomes with denser ranks. Classic results and raw weapon/ward calculations are compared against merged PR #46 (`1c92ede`).

## Rendering and capacity

- Rank depth is halved in real-time layouts, with alternating quarter-row offsets to expose faces and weapons. Procedural art and character scale stay intact. The covered legacy layout uses the same depth reduction, keeping its background/aftermath canvases compact.
- The original two shared troop/guard looks per kit remain. Extra soldiers reuse the same atlases. No actor canvases are created during warm drawing.
- Fixed runtime pools grow to **768 projectiles, 1,200 pending melee impacts and 440 effects**, allowing real rifle/Rapid Shot bursts to complete. These arrays are allocated once and are not saved.
- Footprints include actual asymmetric rank offsets, mounted silhouettes and guards. Mount clearance is cached per corps rather than rescanning every soldier during placement.
- Preparation first tries nearby moves. Crowded saved shapes then use a startup-only search over at most four rectangles, bounded to 4,096 expanded search states. The entire valid layout is applied atomically; invalid layouts cannot partially move troops or change HP/time. Full Loose and Pikewall combinations are covered. Deeper mounted ranks also stay inside the field at entry after a breach.

Field dimensions, ranges and movement speeds are unchanged. Existing skills, duels, casualties, routs, Last Stand, reserves, explicit retreat and rewards use their current systems. The game remains a single standalone HTML with no new network assets.

## Verification

`tests/doubled-armies.cjs` compares full, mixed, tiny and mounted armies against PR #46; it checks actual populations, original heroes/retainers, HP/stats, finite bursts, atomic saved-shape placement, 30/60 fps determinism, post-breach entry, six exact Classic ledgers and 24 damage/ward cases.

The hero test allows additional complete bow volleys if a short seeded sample scatters wide; it still requires real damage. The campaign fixture disables its background RAF so manual fixed-step updates do not race the live clock. Neither change alters game accuracy or damage.

`tests/realtime-flow-performance.cjs` compares caps 48/96 on the current model through actual preparation/launch, with and without officers. Run it alone. It records population, atlas sizes, canvas backing and update/draw timing. Results and game screenshots are in [`reports/doubled-armies`](../reports/doubled-armies). Local Chromium results are not physical iPhone Safari validation.

The final checks pass: 41 population/integration checks, 36 deployment checks, 14 review checks and 30 campaign checks, plus volley/skills, hero, engagement, siege and auto-resolve regressions. Six Classic ledgers and all 24 damage/ward cases match PR #46 exactly.

| Same-model phone-sized fixture | 48 per formation | 96 per formation |
|---|---:|---:|
| Soldiers + officers/retainers | 384 + 48 | 768 + 48 |
| Live canvas MiB, start → end | 39.01 → 39.03 | 39.30 → 39.34 |
| Median update / draw, ms | 0.40 / 4.20 | 0.60 / 8.20 |
| Draw p95, ms | 36.30 | 40.30 |
| Warm drawing canvas allocations | 0 | 0 |

The 23-check performance comparison passes. The separate all-mounted fixture has 752 soldiers and 48 extras (800 total) and holds **43.18 MiB → 43.18 MiB** across 90 warm redraws, with zero new canvases. Timing is sequential software-rendered Chromium, not a 60-fps claim for Safari. No-officer fixtures also plateau; added soldiers reuse the same rig atlas backing.
