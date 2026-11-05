# Field encounter growth and roaming-band icons

Field enemies now use twice the existing conquest and annual growth increments. This changes growth, rather than doubling opening armies. Clan forts, clan seats, the Iron Keep and the Training Ground retain their previous generation rules.

| Growth source | Castle / siege | Small / field encounters |
| --- | --- | --- |
| Clan capture in year 1 | +3% | +6% |
| Clan capture in year 2 | +4% | +8% |
| Clan capture in year N | +(2 + N)% | +2 × (2 + N)% |
| Annual increment, years 1–4 | +1% | +2% |
| Annual increment, years 5–10 | +2% | +4% |
| Annual increment, year 11 onward | +3% | +6% |

These increments remain additive. **Small/field conquest growth has no cap**; castle/siege growth retains its existing 3× conquest ceiling. Annual growth is added afterward. A year-5 campaign with four captures contributing 20% stored conquest growth therefore uses **1.24× castle growth and 1.48× field growth**. `G.dGrowth` continues to store the original castle-rate history, and legacy saves without that field still derive it from `G.wins`. There is no save-version change, reroll or new saved counter. The existing definition of a counted capture remains a clan victory. At year 20 with 270% stored growth, field growth is **7.26×** while castle growth remains **3.43×**; every further capture continues increasing field strength.

## Encounter generation

- `diffScale()` is unchanged. `fieldScale()` doubles only the two growth contributions and applies the existing enemy-strength omen once.
- `sitePowerScale()` exposes the correct effective scale for a site's stored, unscaled budget. `enemyArmy()` applies field scaling after generating and normalizing the opening force. This prevents the old 40–60-man normalization from erasing growth. Field armies receive more combatants; plot skirmishes split growth between endurance and attack. Existing army-power calibration accounts for officers/retainers, with integer rounding at the end.
- Roaming camps retain their existing spawn-time gear/reward budgets and rewards. Field growth and Lawless Coasts are combined once when their combat force is generated. This preserves the established gear progression without also feeding the new field multiplier back into gear and loot generation.
- `huntLevel()` doubles its existing annual and capture increments (0.35 → 0.70 and 0.28 → 0.56). The pack size, opening level, encounter frequency and animal reward remain unchanged.
- `rebellionBase()` uses the doubled field rates with the original province power, site pride and capital modifier. An uprising stores that grown budget once. Waiting, opening its card or loading a save never reapplies growth. Player gear and army size still do not determine rebel strength; Lawless Coasts still excludes held-province uprisings.
- `rebelTick()` converts an expired uprising back through the site's effective scale before storing its returning garrison budget. This applies to non-clan sites as well as castles, preserving their 120% / 105% retake rules without compounding growth. Repeated uprisings continue to use the province's original power.

Both classic and real-time battles, map previews and auto-resolve use the shared encounter generator. No changes were made to combat damage, actor density, equipment, movement or battle timing.

## Art and performance

`bandPB()` draws an indigo cloth bivouac with a spear, bedroll and strapped baggage on the existing native `PB` grid. It uses the established one-pixel outline, warm timber, cool iron and upper-left shading. It is procedural artwork inside the standalone HTML.

Every temporary non-rebel band gets that shelter silhouette, an indigo map ring and an indigo nameplate. Actual province uprisings retain their palisade/campfire, red ring, red nameplate and flag/deadline warning. Clan fortresses and permanent map sites retain their existing artwork. Camp size, faction, expiry, selection and march/auto-resolve actions are unchanged.

The existing `_micon` cache owns these finite clan-colour variants. Band artwork has no animation-frame key: warmed map rendering creates no further icon canvases. Growth work runs only when an encounter is generated, using the existing bounded army-power correction (at most four passes over the small formation list). There is no new per-frame work, saved state, external image, DOM overlay or dependency.

## Validation

`tests/enemy-growth.cjs` covers annual-band transitions, capture rates and a real capture payout, uncapped field growth (including 6.4×, 41× and 201× strength) with the castle ceiling preserved, legacy `G.wins` fallback, mixed troop/plot encounters, both hunt progression sources, single-application uprising budgets, expired and repeated retakes, v1 save/load beyond the old cap, cached map rendering and actual map tap → card → march behavior. It exports a procedural comparison sheet and a phone-sized map capture into `reports/`.

Set `GROWTH_BEFORE` to the previous standalone HTML for a seeded comparison of all castle/Training Ground armies and representative field/hunt encounters across five campaign states. `GROWTH_DOWNLOAD` can point the same suite at the exported download. The recorded results are in [enemy-growth.json](../reports/enemy-growth.json), with [icon comparisons](../reports/band-icons-preview.png) and the [actual map](../reports/enemy-growth-map.png).

Recorded: **76 focused assertions, 210 identical castle/Training Ground snapshots, 90 field comparisons and 65 hunt comparisons**. The same fixed band keeps its original gear/reward budget:

| Campaign state | Previous band power / men | New band power / men | Castle growth, unchanged |
| --- | --- | --- | --- |
| Year 1, no captures | 162 / 46 | 162 / 46 | 1.00× |
| Year 5, 20% stored conquest growth | 162 / 46 | 240 / 68 | 1.24× |
| Year 12, 64% stored conquest growth | 162 / 46 | 425 / 148 | 1.83× |
| Year 20, 270% stored conquest growth | 162 / 46 | 1163 / 610 | 3.43× |

Army strength includes officers and retainers, so troop counts need not rise by exactly the power multiplier. Integer troop/endurance rounding also introduces small differences. All eight additional browser suites passed: campaign, melee/uprisings (33 checks), siege, pursuit/siege targeting, training ladder, omens, auto-resolve and real-time campaign. The uprising regression's old fixed garrison bound was updated to include the requested field-versus-castle growth premium; fixed local budgets and repeated-retake checks still prohibit recursive inflation. The sampled year-5 early-fort uprising fields 80 troops, independent of the player's army and equipment.

After removing the field cap, the full growth/unchanged-castle comparison was rerun, including six actual army/plot encounters at 6.4×, 41× and 201× field growth. All produced finite positive formations and the expected combat strength. Another capture above the former ceiling still increases field strength; the castle ceiling remains unchanged. The v1 round-trip now preserves 270% stored growth, beyond the former ceiling. Melee/uprising and auto-resolve browser suites were rerun and passed. No animation, actor budget, icon or render-loop code changed for cap removal.

Automated browser validation uses Chromium. This environment blocks `file://` navigation, so the identical exported HTML is exercised through a local HTTP server. No physical iPhone/Safari run is claimed.
