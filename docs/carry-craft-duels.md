# Carry, craft and Auto Duel

Item definitions now grant carry bonuses to every ground mount/companion. Pack Pony is the strongest carrying mount at +100%; the two birds and White Fox stay at zero carry. Existing equipment IDs, prices, research tiers, combat stats, companion formation bonuses and procedural artwork are preserved. Old saves immediately receive the new item stats when loaded; no equipment replacement or repeated stat multiplier runs on load.

| Mount / companion | Carry bonus |
|---|---:|
| Pack Pony | 100% |
| Kiso Warhorse | 75% |
| Nanbu Warhorse, Black Stallion, Red-Armored Charger | 60% |
| Dappled Grey, Armored Steed, Moon Bear | 50% |
| Hill Horse, Tanuki | 40% |
| Wild Boar | 30% |
| Mountain Wolf | 25% |
| Tosa Fighting Dog | 20% |
| Akita Hound | 15% |
| Snow Monkey | 10% |
| War Hawk, White Gyrfalcon, White Fox | 0% |

Existing work-item bonuses double: Shoulder Pole carry 40% → 80%; Artisan's Kit craft 35% → 70%; Merchant Abacus carry/craft 15% → 30% each. Tanuki's existing carry also doubles from 20% to 40%; Pack Pony uses the explicitly requested 100%. Item descriptions and the dynamic stat displays show the updated values.

`vStats` already combines equipped carry/craft bonuses. Worker pickups, hauling thresholds, load slowdown and `craftCycleTime` consume those values without new rules or inventory mutations. Stronger craft stats shorten the cycle through the existing formula; output still pays every ingredient and completion remains idempotent. The existing 31-unit porter/collector trip cap and encumbrance cap are unchanged. There is no new sprite, canvas or cache.

## Auto Duel

**Village → Options → Auto Duel** stores one boolean in `G.autoDuel`. New villages start Off; older saves without the field also default Off. With Auto Duel Off, an eligible challenge opens the existing champion picker even during Auto Battle. The player can Fight or Refuse. With it On and Auto Battle running, the existing `autoPairs` selection starts the duel. Turning general Auto Battle off always preserves manual champion selection.

`preDuel` still controls eligibility, challenge probability, one challenge per round and skirmish exclusions. The preference only chooses the existing manual/automatic branch. HP resolution, weapon combos, finishers, assistance, talismans, retainers, refusal penalties and commander consequences are unchanged. Saves remain version 1, and repeated loads do not compound the equipment buffs.

## Validation

The focused `tests/carry-duel.cjs` suite verifies all 18 mount IDs, exclusions, Pack Pony's unique maximum, equipment stacking and displayed percentages. A real worker reserves, picks up and delivers 19 raw goods using the full carry setup, with zero inventory residual. The doubled crafting setup completes five Mochi from ten Rice and cannot complete twice. In the seeded fixture, the same five-unit cycle drops from 3.3913 to 2.5435 seconds; actual timing depends on Work and other existing bonuses.

The suite forces eligible challenges to verify Off/On, independent manual battle control, once-per-round behavior and skirmish exclusions. Real mobile Options buttons test On/Off persistence and an old save missing the preference. Real Refuse and Fight buttons still execute the existing paths with Auto Duel Off. Results are in [carry-duel.json](../reports/carry-duel.json).

The existing unattended density, siege, Tate and tactics fixtures explicitly opt into Auto Duel so their battle simulations retain their prior behavior. Manual dialogs and land-fight tests continue exercising the default Off behavior.

All **19 local regression suites passed** on main base `37623a4`, including the current stock capacities, editable starting roads, dialog touch fixes and battle-ending checks. The new suite recorded **91 focused checks** and also passed against the exact **Shinobi Hollow.html** export over local HTTP at 430×932. The export is byte-identical to the playable source. The economy runtime mirror is synchronized with main's shared-inbox capacity and current hauling thresholds; this change does not alter those caps or thresholds in the game.

Direct `file://` and physical iPhone Safari checks are not available in this managed browser.
