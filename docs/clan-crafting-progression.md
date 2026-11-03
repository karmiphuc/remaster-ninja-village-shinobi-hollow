# Clan residence, crafting and progression

The standalone source remains `index.html`. This update adds building progression and two permanent clan-policy choices, keeps assigned craftsmen on productive batches, quiets automatic Ton’ya completions, enlarges the existing Ram and adjusts the first castle/training ladder.

## Building upgrades

All materials are paid once from available central storage through `destroyGoods(..., 'renovation')`; Ton’ya reserves remain protected. Existing renovation timing applies: two weeks for Lv2 and three weeks for Lv3. The completed level’s limits and perks remain during construction. Workshops start no new craft cycles until construction finishes; stock and assignments stay. Upgrade completion invalidates capacity/demand caches. Moving, demolishing and saving still use the existing goods ledger.

| Building / target level | Gold | Timber / Iron Ore / Silk | Result |
| --- | ---: | --- | --- |
| Workshop Lv2 — Artisan Workshop | 1,000 | 18 / 6 / 0 | 60 input materials; 15G/month |
| Workshop Lv3 — Master Workshop | 2,400 | 36 / 14 / 0 | 90 input materials; 20G/month |
| Shop Lv3 — Grand Shophouse | 2.4× original shop build cost, rounded to 10G | 24 / 10 / 6 | 60 materials **and** 60 wares on separate shelves |
| Clan Hall Lv2 — Kage Residence | 3,500 | 40 / 18 / 10 | Tall indigo standards, gold fittings, +6 appeal; unlocks policies |

Lv1 workshops retain their existing **zero upkeep**. Because there was no cash upkeep to multiply, the new upgraded charges use a nominal 10G basis: 1.5× / 2× = 15G / 20G per month. Actual amounts appear in the Workshop and renovation panels. Monthly upkeep collects them once; the ordinary troop/retainer calculations remain intact.

Workshop output capacity stays 30 and worker slots stay two. Material kinds retain their existing shared-input allocation. Shop capacities are totals across all accepted material/ware types, including incoming reservations. Lv3 shops retain Lv2’s +15% sale bonus; no extra sale multiplier is introduced. Shophouses still house **zero villagers**.

`shopCapacity()` and `workshopInputCap()` supply the same per-building limits to claims, physical deliveries, market demand, pile drawings and UI. No upgrade creates or remotely delivers inventory. Existing Lv1/Lv2 shops and old saves keep their stock and limits.

## Assigned craftsmen

The interruption came from two existing decisions: checking general shop supply before the worker’s assigned workshop, and carrying away output at three wares even when another batch was available. Assigned craftsmen now check their workshop first, and `continueAssignedCraft()` reserves another actual batch immediately after a successful one.

They continue while they have at least 25 energy, no wounds requiring rest, useful demand, available recipe ingredients and output space. Contracts, shortages, the preferred recipe and other useful recipes retain their priority order; preference is still a soft choice. A finished batch pays its complete inputs, produces its actual 1–5 products and charges energy once. Work/Fine Craft efficiency stays in the existing cycle calculation.

A full output bay, insufficient ingredients, exhaustion, reassignment, construction or demolition ends continuation safely. Craftsmen can then fetch, deliver or rest through the existing logistics. Porters can haul output during crafting; villages without porters retain self-delivery. Casual helpers keep their existing behavior. There is no extra production queue or per-frame routing search.

Worker assignment now precedes recipe selection. Active Fine Craft skills get **green** badges; equipped crafting bonuses get **blue** badges. A worker can display both. Assigned cards use the full panel width so names and badges remain readable on a phone.

## Clan policies

Open **Kage Residence → Clan Policies**. Choose one service charter, then one village edict. Each choice costs **5,000G**, so adopting both costs 10,000G. The choice within each pair is permanent and excludes its alternative. Repeated clicks cannot buy another path or charge twice.

| Choice | Option A | Option B |
| --- | --- | --- |
| 1. Service charter | Shokunin Charter: all Workers gain Work +20% and village walking speed +10% | Samurai Service: all non-workers gain those bonuses |
| 2. Village edict | Restorative Care: all villagers recover energy and recover HP in bed ×1.5 | Diligence Edict: all villagers gain Work +15% |

Policies affect current and future villagers according to their current role. Work bonuses add: a matching service charter plus Diligence gives **+35% Work**. Walking receives its explicit +10% once; the Work increase does not secretly multiply it again. Visitors and combat movement are unaffected. Recovery multiplies the existing bed/scenery recovery, and also applies to the existing brief goods-rest state; it does not heal wounds outside beds.

Only two choice strings are saved in `G.clanPolicies`. Missing policies preserve old behavior, and saves remain `G.v === 1`. Existing building level/renovation fields are reused. A loaded workshop input-kind cache is rebuilt if JSON has converted its transient Set to a plain object.

## Trading and combat progression

- **Ton’ya:** a completed contract at a Lv3 house stops opening the completion dialog while Guild Charter auto-accept is active and at least one material is enabled. Payments, counters, replacement offers and reservations are unchanged. Manual completion and broken-contract warnings still show their dialogs.
- **Siege Battery research:** canonical tier changes from 5 to **4**. Its 10,000G price, twelve-week duration and gun prerequisites remain; existing researched ownership is retained.
- **Yamashiro Castle:** generated gunners are multiplied by **0.5**, archers by **0.3**, with ordinary integer rounding. Infantry, cavalry and other castles are untouched. The adjustment happens after the capital troop floor, without redistributing the removed ranged troops. In the seeded check, gunners fall 60→30 and archers 729→219; infantry/cavalry remain 729 each.
- **Training:** starts at 30 infantry. Each cleared level adds `max(25, ceil(previous nominal count × 0.10))` before the player-strength ceiling. Infantry receives every ordinary-level addition and at least 60% of a milestone’s addition. At ten-level milestones, one unlocked ranged/cavalry arm may receive the remaining share; other formations do not all grow at every level. Original level-10/20/30 Corps gates remain. The ceiling can truncate the minimum increase; it never forces training up to the player’s strength. Levels, milestone rewards, cooldowns, prize caps and v1 counters remain intact. Evaluation stops at the ceiling, including extreme saved levels.
- **Ram:** the existing infantry Ram grows from 30×17 to **50×30** outlined native pixels. It shares the bronze/timber engines’ spoked-wheel painter and native outline pipeline. The iron head rests at the gate; its former charge timing and damage calculations are retained. It remains the infantry’s automatic siege prop, with no new purchase slot or unit.

## Validation and review

`tests/clan-crafting.cjs` uses the real renovation and policy buttons and covers three consecutive craft batches (30 rice→15 wares, 73 energy left), exhaustion, recipe fallback, full outputs, demolition, expanded shelf claims, upkeep collection, both policy branches, duplicate purchases, v1 round-trips, quiet/manual/broken contracts and a seeded first-castle comparison. Inventory conservation residual is zero and no inventory becomes negative. `tests/training-ladder.cjs` independently checks the 10%/minimum-25 rule through consecutive levels, milestone-only ranged reinforcements, strength caps and existing rewards.

**Final local result:** 13 related suites pass. The 69 focused assertions also pass against the standalone export; the sampled save is 33.46KB. The two-workshop monthly check collects exactly 35G (15+20), and both crafting/renovation inventory audits have zero conservation residual. The economy mirror’s changed functions match the standalone. See the [regression log](../reports/clan-crafting-regression.txt).

See [focused results](../reports/clan-crafting.json), [training results](../reports/training-ladder.json), [art sheet](clan-crafting-preview.png), [policy panel](clan-policies-ui.png) and [workshop panel](workshop-workers-ui.png). Regenerate previews with `node tools/preview-clan-progression.cjs`. The PNGs and tools are review artifacts; the downloaded HTML needs none of them. Local browser checks use Chromium, not physical iPhone Safari.
