# Village economy flow

The playable source remains the standalone `index.html`; saves stay at version 1. This update adds worker-only crossings, automatic batches and two-stop porter trips without new building types or inventory pools.

- **Crossings:** workers and porters can cross the footprints of rice/vegetable/tea fields, Storehouses and Workshops. A crossing connects actual road tiles; stepping directly between different buildings is forbidden. Other structures stay obstacles. Visitors retain road-only routing. Both graphs reuse the existing bounded road caches and keep-left costs. Placement/removal invalidates topology and active routes; entrances are selected from reachable road edges.
- **Crafting:** reserve recipe inputs, output space and useful demand in runtime state before walking/working. Produce 1–5 units, paying the full recipe for every unit: 10 Rice becomes 5 Mochi Boxes. Priorities are two weeks of Ton'ya requirements (the existing buffer), low shop shelves, the preferred recipe and other useful recipes. Count stock, carried wares, workshop output and pending batches before creating more. Recheck at completion; cancel without consuming inputs when work becomes unnecessary. Work, home and Fine Craft bonuses improve cycle efficiency; five units take 2.12 times a single-unit cycle. Ordinary artisan ingredient trips retain their existing carrying allowance.
- **Porters:** preserve mixed cargo (up to four cargo lines) and the 31-unit limit. Reserve each cargo line for its actual destination. Add at most one other shop at the same pickup source, prioritising shortages. Compare the two-stop route with the direct route to the farther shop; extra distance must be at most `max(4, 25% of direct distance)`. Check the final route with actual keep-left paths too. Use cached worker-graph distances, never a jobs-by-sites pathfinding loop. Only unload the current stop's assigned goods, then continue or return the remainder to storage. Single-stop delivery remains the fallback.
- **Recovery:** claims and crafting plans live in `RT`, expire with their carrier, and are released on cancellation, demolition and saving. Ingredients stay in the inbox until completion. Saving recovers carried cargo through the existing ledger and cancels pending work, so a version-1 load needs no new persisted fields. Existing over-cap inventories are retained and drained, never clamped away.

Validation covers the Field → Road → Storehouse → Road → Workshop chain, blocked/non-road layouts, one/two-tile roads, simultaneous artisans, scarce ingredients, full shelves/output, mixed and same-good two-shop loads, detour limits, interruption/demolition and in-memory save/load. Compare seeded mature villages and bounded caches against the pre-change source locally; no built-in runner or new UI is added.

Navigation caches hold at most 128 paths and 24 distance fields per graph. Crafting and hauling each allow at most 128 active plans; production inventory snapshots are capped at eight connected components and invalidated by ledger writes, reservation changes and topology updates. Snapshots share inventory and market-group demand across recipes, avoiding repeated carrier and shop scans. Contract-list changes invalidate cached market demand even without an inventory transfer. The existing 200-event diagnostic ring stays bounded. No canvas, sprite cache or per-building DOM layer is added.

The economy runtime mirror in `tools/modules/economy-p0.js` is synchronized with the standalone source. Navigation and agent lifecycle integrations also live in `index.html`; the historical builder scripts must not regenerate the current game from an older baseline.

The local paired profile uses three identical seeds, 40+ agents, 30-fps updates and periodic draws. CPU measurements include simulation and drawing and vary with browser warm-up; they do not replace a physical iPhone Safari session.

## Local validation

The full regression run passed **11/11 suites**, including the latest siege and Wooden Tate changes. Economy, logistics, forge and Porter House checks were also run together while refining the final recovery paths. The focused suite runs the crossing layout for 180 simulated seconds at 30 fps, checks the exact 10 Rice → 5 Mochi recipe, concurrent workers, contract-only delivery without shops/porters, same-good and mixed cargo, detour rejection, full shelves, demolished origins/destinations, expired carriers and in-memory save/load. Accounting residual and negative-stock counts are zero.

The paired profile uses base `f22802e3c8d1cbf4f5e084bf39e81e927de2b3f6`, three seeds, a 24-second warm-up per build, alternating before/after order, 40+ agents, and periodic drawing. Recorded results are in [reports/economy-flow.json](../reports/economy-flow.json).

| Metric | Before | After |
|---|---:|---:|
| Mean ms per simulated week | 113.06 | 91.85 |
| Mean save size, KiB | 38.92 | 39.57 |
| Peak live canvas backing, MiB | 9.48 | 9.59 |
| Accounting residual / negative stocks | 0 / 0 | 0 / 0 |

The final profile used 0.81× baseline simulation/draw time; this is a local measurement, not a promised FPS improvement. The largest observed economy collection count was 358, and the slowest stringify was 1.8 ms. Physical iPhone Safari and long app-switch sessions were not run here.

Code paths: `roadPath` / `walkTo` / `economyComponents` handle worker connectivity; `chooseCraft` / `craftReserve` / `craftDone` handle automatic batches; `economyBundle` / `missionArrive` / `economyDeliverStop` handle destination-specific cargo. All goods changes still go through the existing ledger.

The exported **Shinobi Hollow.html** was byte-compared with the repository source and tested over local HTTP at 430×932: New Game, saving, reloading and Continue all succeeded with no page errors. Direct `file://` navigation was blocked by this managed browser's administrator policy; it was not validated here. The game remains one HTML file with no new external dependencies.
