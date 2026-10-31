# Paused building relocation

Use **Build → Move**, beside the existing Demolish tool, to select a building on the map. A building's details also has **Move** beside Remove; the protected Clan Hall has Move without Remove. The temporary travelling merchant and numeric road tiles are excluded. Moving is free.

Starting either flow sets the saved speed to Pause before closing the panel or entering placement. Play and fast-forward are disabled while moving, and the simulation also guards against an accidental speed change. An army waiting to arrive cannot start a battle during relocation or while the game remains paused. The player can pan and zoom normally.

Tap a destination to preview it, then press **Move** or tap the same spot again. The current building stays in place until confirmation. Cancel changes no building data. Completion and cancellation leave the game paused, with Play re-enabled. Normal building placement applies: open land, compatible terrain, no roads or other occupied footprints, mines on ore. Overlapping the building's own footprint is allowed. Existing tree-clearing rules apply at the confirmed destination. Disconnected placement is allowed with a reminder to connect a road.

## Preserved state

`moveBuilding` updates the existing building's coordinates and footprint map. It does not demolish/rebuild, refund/recharge gold, generate a new UID, release its stock, or call job/home reassignment. Levels, in-progress renovations, recipe/focus choices, production progress, piles, finished buffers, workshop inbox/output, shop shelves and paid collector contracts remain on the same object. Villagers' job/home UIDs stay unchanged.

Actual occupants move with the building. Active artisans keep their reserved batch and remaining work time; resting residents and hidden shop visitors use the new entrance. Road users retain their world positions. Idle agents left outside the relocated workplace lose their stale on-site target, so the existing immediate-work shortcut cannot teleport them into it.

Moving invalidates the existing road and worker graph caches. Active pickup and delivery claims retain their original inventory endpoints and building identity; walkers reroute through the normal path-revision check. The existing recovery paths handle disconnected destinations without duplicating or losing goods. Location bonuses and nearby scenery/combo effects recalculate at the new position. A previously assigned but disconnected building keeps its assignments and needs a road to resume normal access. A small `moveJobHold` flag protects those jobs from automatic reassignment during intermediate road edits and after reload; normal assignment checks clear it once an entrance reconnects. It does not auto-fill disconnected buildings or Porter Houses.

## Rendering, saves and performance

No procedural building artwork changes. The preview reuses cached building assets at the current upgrade level, forge focus, field variant or workshop product; it stays within the existing native pixel style. The Porter House keeps its built-in foreground wheelbarrow. No new canvas, sprite cache, per-frame pathfinding, collision simulation or per-building DOM layer is added. A confirmed move performs one footprint update, one agent pass and the existing topology/bonus invalidation.

The version-1 save stores the existing building's coordinates, paused speed, and an optional assignment-hold flag for a disconnected moved workplace. Selection, ghost position and `RT.moveUid` stay transient. Saving or switching apps during a preview stores the original position; reloading discards the preview. Confirmed positions, upgrades, assignments and counted inventory persist normally. The `assignJobs` hold check is synchronized in the economy runtime mirror; relocation and placement live in the standalone HTML's village/UI code.

## Local validation

`node tests/building-move.cjs` covers pause and cancellation, blocked/locked/road/ore placement, overlapping footprints, identity and inventories, upgrades and renovation progress, worker and resident assignments, occupants, active crafting, moved pickup sources and loaded delivery destinations, paid collectors, forge focus/level previews, road-cache invalidation and save/load. Real mobile controls exercise the Build tool, canvas selection/preview, confirmation, the details-panel button, cancellation, and browser save/Continue. Inventory conservation residual and negative-stock counts are zero in the tested flows. Results are recorded in [building-move.json](../reports/building-move.json).

All **14 local regression suites passed** after rebasing onto main `526482d`, including the newly merged forge fixes. The focused relocation suite recorded **72 checks**, zero conservation residual and zero negative stock. It also passed against the byte-identical **Shinobi Hollow.html** export over local HTTP at 430×932, with real canvas placement, panel buttons and browser save/Continue.

Direct `file://` and physical iPhone Safari validation are not available in this managed browser; no new runtime dependency is introduced.
