# House residents and Recall home

All seven shop types, including renovated **Shophouses**, now provide **zero beds**. Shophouse renovations keep their existing +15% sales and +2 appeal, appearance, price and timing. Their obsolete resident work/rest perks and one-room upgrade text are removed. Real house capacities and their renovation bonuses are unchanged.

Every resident card in a house's details has a separate **↩ Recall home** button directly beneath it. The card itself still opens that villager's equipment/details. The resident heading uses the home's effective capacity, including upgrades and Cramped Homes.

Recall immediately teleports that villager to their current home and starts the existing bed-rest state. It clears their old route, target, stuck bubble and movement animation. Energy and wounds heal at the house's normal rate as game time runs; recall does not grant instant healing. When fully recovered, they resume their usual activities. Jobs, porter assignments, roles, experience and equipment remain intact.

## Cargo, work and navigation safety

`recallResident(id, uid)` validates the current resident/home before changing anything. It cannot run during a battle and rejects a missing villager, a shop, a demolished house or an outdated home assignment. If the villager's visual agent is missing, the existing agent-creation routine restores it first.

The existing `dropLost()` recovery path releases both hauling and crafting reservations. It moves every loaded raw good and crafted ware, including mixed two-shop porter cargo, back into central storage through `moveGoods()`. Uncollected goods stay at their source. Interrupted crafting releases its unconsumed inputs and never completes a phantom batch. Repeated recalls cannot duplicate cargo.

With a connected home, the agent rests at the existing entrance and exits there after recovery. A disconnected home can still receive this explicit emergency teleport; the agent is placed inside its footprint. Normal road requirements continue to apply when it tries to leave. Moving the home while a resident sleeps uses the existing relocation handling. Recall changes no road topology, lane preferences or movement speeds.

## Existing saves

`afterLoad()` now calls the existing `assignHomes()` without resetting valid assignments, before recreating agents. Saved Shophouse residents take free real-house beds. If the village is over capacity, every villager is retained; those without a bed use the established Clan Hall fallback until more housing is available. Jobs, equipment and wounds are preserved. `homeOf()` also rejects non-residential assignments rather than granting a shop's home perks.

There is no new saved field or version bump: `G.v === 1`. Like existing rest, the immediate animation/state is transient; saved energy and wounds continue through the normal rest logic after loading.

## Validation

`node tests/resident-recall.cjs` checks all shop levels and Cramped Homes, unchanged real-house capacities/trade bonuses, old-save reassignment and over-capacity retention, immediate teleport with gradual healing, normal return to work, uncollected shipment cancellation, mixed two-stop loaded cargo, repeated recall, interrupted crafting, disconnected/demolished homes and missing agents. Cargo conservation residual is **0**, with no negative inventory.

The mobile browser check uses the real house buttons, confirms they appear below the resident cards, checks the upgraded capacity heading and absent shop housing text, then saves and reloads through Continue. The focused run passed **73 assertions plus the UI/save checks**. It is included in `npm test`. `RECALL_DOWNLOAD` optionally checks an exported HTML; `RECALL_SCREENSHOT` saves the house panel for review.

The full local browser regression passed **21/21 suites**, including the seasonal landscape, road traffic, building relocation, hauling/crafting, collectors, combat and equipment checks. The byte-identical standalone export also passed the focused recall suite.

See [recorded checks](../reports/resident-recall.json) and the [mobile house panel](resident-recall-mobile.png). The feature adds no per-frame work, sprite caches or external dependencies.
