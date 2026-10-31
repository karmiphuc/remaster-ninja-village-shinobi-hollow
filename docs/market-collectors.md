# Material retail and part-time collectors

The standalone `index.html` remains authoritative. Existing artwork, raw/ware capacities, crafting, porter trips and version-1 saves are preserved. The economy runtime mirror is synchronized in `tools/modules/economy-p0.js`; navigation, calendar, save and panel integrations also live in `index.html`.

## Player controls

Open the **Clan Hall** (clan seat) for **Shop material sales**. There is one master switch and six individual raw-material switches. A disabled raw material cannot be sold or restocked at shops. A shop combining raw ingredients pauses that whole raw recipe when one ingredient is disabled, so the other ingredients do not build up uselessly. Wares remain on sale, and workshops and Ton'ya contracts retain their normal access to materials.

Existing raw shelf stock stays counted at the shop until an ordinary worker or porter collects it and returns it to central storage through a reachable Storehouse or Clan Hall. Incoming uncollected raw claims are cancelled. Loaded mixed carts retain their wares and valid second stop, then return unwanted raw cargo. Re-enabling sales cancels uncollected return trips; goods already picked up can finish returning safely.

Open a **Storehouse → Part-time collectors**. **500G total** buys **five weekly collection rounds**, with the first starting at the next weekly tick. Every round considers all connected raw-material worksites: rice, daikon, tea, timber, ore and silk. A collector reserves an available pile, walks out, collects up to 31 goods and carries them back to the hired Storehouse. Empty, fully reserved and unreachable piles are skipped; normal workers and porters continue using unreserved goods. Worksites built after a weekly round starts join the next round.

Collectors use two fixed appearances from the existing farmer/merchant visitors, with the normal cargo/cart artwork. They have no villager record, housing, wages, customer purse, visitor-cap usage or interaction target. They disappear inside storage after returning. The service can be hired again after all five rounds finish. Demolishing its Storehouse ends the remaining service; carried goods still recover safely.

## Implementation and limits

- `materialSalesAllowed`, `shopRawSalesAllowed`, `setMaterialSales`: optional `G.materialSales` stores only disabled keys; absent means all enabled for old saves. `shopRoom`, `sell`, `economyCanSell` and `economyJobs` share the rule. `planShopSupply` lets ordinary workers perform shelf returns as well as restocking. Every transfer still uses `moveGoods`.
- `hireCollectors`, `collectorWeek`, `collectorDispatch`: each hire stores a five-round counter, at most five numeric worksite-UID cutoffs, a UID cursor, and at most eight pending visit intentions across the village. Actual pickup/delivery reservations remain in `RT.eco.claims`. Queued paid rounds survive disconnected roads and reloads. Empty/disconnected individual sites do not hold up the round.
- The existing 0.75-game-second dispatcher starts at most four collectors per tick, considers at most 32 worksite candidates and rotates through up to 16 storage sites. At most eight collectors are alive village-wide. Producer UIDs are sorted only on topology rebuild, then found by binary search. The new actors use the cached worker road graph, including permitted road/building crossings and keep-left routing; regular visitors retain their road-only graph.
- `updateCollector` runs simple dt-driven walking/pickup/return states. No per-frame job search, new canvas, sprite cache, map overlay pass or per-building DOM is introduced. Existing bounded caches render the reused visitor looks and cargo.
- `collectorBeforeSave` runs before normal cargo recovery. Loaded goods return to central storage exactly once through the existing save ledger. Uncollected paid visit intentions remain saved and resume after load. No actor positions, cargo copies or claims enter `G`. Demolished sites, lost roads and invalid claims use normal recovery. `perfCollections` includes the small new queues.

Storehouses still access one shared central inventory; hiring does not create a separate store or grant goods. Collection is an extra scheduled haul, not guaranteed production or a promise to fill every shop. Large or disconnected rounds can finish after their scheduled week. The eight-carrier cap is intentional for mobile performance.

## Validation

Focused checks cover all six raw goods, five rounds with no sixth round or duplicate charge, concurrent Storehouse hires, a worksite added mid-round, ordinary shelf returns, loaded mixed-cargo policy changes, shared reservations, staggered dispatch, worker crossings, demolition and road loss, unpicked/loaded save recovery, real panel buttons and browser save/reload. Inventory conservation and negative-stock counts are checked after representative transfers and interruptions. Recorded results are in [market-collectors.json](../reports/market-collectors.json).

All **13 regression suites passed** locally. The focused economy, collector, logistics and Porter House suites also passed after the final saved-visit cap change. The new suite recorded **4,104 checks**, zero conservation residual and zero negative stock, including real mobile panel clicks and browser localStorage reload.

The optional [paired profile](../tests/market-collectors-profile.cjs) compares base `0d504a4` with default behavior and with one paid hire, across three identical seeds in late villages with 20 workers, two porters and 40+ total agents. Each run warms up for 24 simulated seconds, then updates 120 seconds at 30 fps, drawing every tenth step. The hired runs reached eight simultaneous collectors. Results are in [market-collectors-performance.json](../reports/market-collectors-performance.json).

| Metric | Before | Default | Hired collectors |
|---|---:|---:|---:|
| Mean simulation + drawing ms per game week | 290.09 | 265.52 | 268.59 |
| Peak live canvas backing, MiB | 11.44 | 11.44 | 11.60 |
| Largest sampled save, KiB | 44.99 | 44.99 | 44.49 |
| Slowest sampled stringify, ms | 2.40 | 2.20 | 1.50 |
| Largest economy collection count | 424 | 424 | 440 |
| Conservation residual / negative stocks | 0 / 0 | 0 / 0 | 0 / 0 |

The local timing is 0.93× baseline with a hire; browser warm-up and scheduling affect these numbers, so this does not promise an FPS increase. Default behavior produced identical final inventories, cache sizes and collection counts to the baseline for each paired seed. Repeat with `MARKET_BASELINE=/path/to/before.html node tests/market-collectors-profile.cjs`, while other test suites are idle.

The exported **Shinobi Hollow.html** is byte-identical to `index.html`. The focused suite was rerun against that exact export over local HTTP at 430×932, including both real panels, hiring, saving and Continue after reload, with no page errors. The branch and download also retain the pending #17 Training Ground recruit caps (100 infantry, 50 archers, 30 gunners, 20 cavalry); the campaign suite passed again with those caps included.

Physical iPhone Safari and a long app-switch session are not available here. This managed browser blocks `file://` navigation. No external runtime dependency is added.
