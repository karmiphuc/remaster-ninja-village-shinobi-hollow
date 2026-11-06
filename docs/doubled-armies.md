# Larger real-time armies

Real-time battles show up to **192 Infantry and 96 each of Archers, Gunners and Cavalry per side**: **960 ordinary soldiers across two full armies**, plus existing officers, retainers and companions. Infantry has twice the other formations' display cap. Sampling remains proportional to the army, never exceeds its actual troop count and never clones independent heroes. Actual troop HP, ownership, upkeep, equipment and commander budgets retain their existing accounting. Classic density settings and save version 1 remain unchanged.

These figures are physical display/targeting caps, not recruitment limits. Extra soldiers divide the existing formation HP; they do not create extra troop strength or multiply damage formulas. Physical targeting and scatter can produce different real-time outcomes with denser ranks.

## Rendering and capacity

- Relative to the original 48-actor layout, Infantry rank depth is quartered; other rank depth remains halved. Alternating quarter-row offsets expose faces and weapons. The covered legacy layout uses the same per-type scaling, keeping scenery/aftermath canvases compact.
- Existing procedural looks, character scale and shared troop/guard atlases remain. No actor canvases are created during warm drawing.
- Fixed pools contain **768 projectiles, 2,400 pending melee impacts and 440 effects**, allocated once and never saved. Extra infantry needs melee headroom; gun/bow populations and projectile capacity remain unchanged from the 96-per-formation build.
- Footprints include asymmetric rank offsets, mounted silhouettes and guards. Mount clearance is cached per corps. The extra infantry depth retains a similar deployment footprint.
- Preparation first tries nearby moves. Crowded saved shapes use a startup-only search over at most four rectangles, bounded to 4,096 expanded states. An entire layout is validated before movement. Invalid layouts cannot change HP/time or partially move troops. Full mounted Loose/Pikewall combinations and post-breach entry are covered.

Field dimensions, ranges, movement speeds, skills, wards, duels, casualties, routs, Last Stand, reserves, explicit retreat and rewards retain their existing systems. The game remains a standalone HTML with no new runtime assets.

## Verification

`tests/infantry-cap.cjs` compares the Infantry-only change against the previous 96-per-formation build (`1d58391`). Its **73 checks pass**: full, mixed, tiny and mounted armies; unchanged non-Infantry counts and all troop stats; original officers/retainers; valid saved shapes; live HP conservation; unique actor IDs; bounded warm drawing. A full field grows **768 → 960** ordinary actors. With 16 officers and 32 retainers, all **1,008 actors** have distinct IDs. The all-mounted fixture holds **43.63 MiB → 43.63 MiB** across 90 warm redraws, with zero new canvases.

`tests/doubled-armies.cjs` retains the original comparison against merged PR #46 (`1c92ede`), now expecting 4× Infantry and 2× other populations relative to its 48-per-formation baseline, limited by real troops. All **41 checks pass**, including six exact Classic ledgers, 24 damage/ward cases, complete rifle/Rapid Shot bursts, atomic placement rejection, 30/60 fps determinism and post-breach bounds. The interactive deployment, deployment-review and campaign suites also pass **36, 14 and 30 checks**, respectively.

`tests/realtime-flow-performance.cjs` compares Infantry caps 96/192 on the same current model with all other caps fixed at 96, using actual preparation/launch and zero or sixteen officers. Run it alone. Current reports and screenshots are in [`reports/infantry-cap`](../reports/infantry-cap). The original 48/96-all-types measurements remain historical records in [`reports/doubled-armies`](../reports/doubled-armies).

Local Chromium measurements do not establish sustained physical iPhone Safari frame rate or long-session memory. The exported exact HTML is checked with external requests blocked and the network then disabled; managed Chromium blocks direct `file://` navigation.

## Current paired performance

The 25-check sequential benchmark passes. Both columns keep Archers, Gunners and Cavalry at 96; this fixture has sixteen officers and thirty-two retainers.

| Phone-sized fixture | Infantry 96 | Infantry 192 |
|---|---:|---:|
| Ordinary soldiers + officers/retainers | 768 + 48 | 960 + 48 |
| Live canvas MiB, start → end | 39.30 → 39.34 | 39.55 → 39.58 |
| Median update / draw, ms | 0.50 / 7.80 | 0.70 / 13.70 |
| Draw p95, ms | 41.30 | 51.70 |
| Warm drawing canvas allocations | 0 | 0 |

Both no-officer fixtures also plateau below 48 MiB. The look/gear families are identical at both caps, with at most two shared regular/retainer variants per family; random guard selection can warm one or both. This avoids mistaking finite variant warming for per-soldier cache growth. Software-rendered timing has long tail stalls; physical Safari remains unverified.
