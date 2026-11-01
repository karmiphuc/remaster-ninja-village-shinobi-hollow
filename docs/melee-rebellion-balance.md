# Infantry breakthroughs and local uprisings

Infantry used to carry leftover phase damage straight through Infantry → Gunners → Archers → Cavalry. The animation reused one clash position/window for every target, so soldiers could kill a rear formation while visibly standing at the front. Uprisings separately used 25–50% of the player's total army power, including equipment/commanders, and also received the Lawless Coasts raider multiplier. A lost clan province then ignored that uprising power and reverted to its old garrison budget.

## Infantry contact and travel

Army infantry now shares a **2.7-second engagement clock after its opening approach**, using the existing front-line damage as its DPS basis. Defeating a formation consumes time in proportion to its endurance and the attackers' actual damage rate. Each swing/contact lasts at least 0.25 seconds. Surviving defenders screen every formation behind them.

After clearing a line, infantry spends **1.25 seconds advancing**, during which it inflicts no melee damage. Retargeting another group in the same line costs 0.14 seconds. Only the time left in the engagement window can damage the next line. All infantry groups and independent infantry heroes share the breach schedule; splitting forces cannot bypass the screen or receive extra time. A formation eliminated in the simultaneous front-line exchange cannot make later attacks on the rear.

Stats, equipment, tactics, cohesion, retainers, opening countershots and overtime pressure still determine damage. There is no fixed kill-count cap, ranged immunity or one-round protection rule. Chain Strike and personal bonuses stay in their actual engagements instead of transferring unused front-line damage into a tiny rear-line window. The next round can attack an exposed ranged line normally. The existing cavalry/ranged rules, small skirmishes, HP duels, sieges, player retreat and last-combatant victory rules remain in place.

`timedInfAdvance()` queues an actual block advance after the previous clash finishes. `lineClash()` uses the matching target position and contact interval. Damage events, including the no-visible-figure fallback, respect that interval. Rear attacks no longer run concurrently with the front clash. The existing corpse, rout, dropped-gear, camera and procedural weapon poses are reused.

These are battle-clock seconds, scaled by the existing playback speed and 0.7 pacing factor. The logical schedule is independent of viewport, sprite count and density; it adds no per-frame pathfinding or collision simulation. The first front-line exchange retains the game's simultaneous phase resolution rather than introducing a new physical combat simulator.

## Province-based uprisings

`rebellionBase()` uses the province's **original** power with its normal world growth and site/capital modifiers. A new uprising rolls **75–105%** of that local budget, with a small minimum for early sites. Recruiting more troops or equipping a powerful commander no longer inflates a peasant uprising. Repeated revolts do not compound their previous power. Later provinces still support stronger uprisings.

Lawless Coasts continues to multiply roaming bandit/pirate/rōnin camps; held-province uprisings are excluded. Their two-month deadline, rolled rewards and guaranteed worker captive remain intact.

On an unquelled revolt, the returning clan garrison retains at least its old province budget and the equivalent of **105% of the uprising budget**, converted back through `sitePowerScale()` so world growth is not applied twice. Non-clan sites keep their existing 120% retake rule. Different clans may field different mixes/headcounts at comparable strength; the budget is consistent rather than promising identical soldiers.

`migrateRebellions()` caps an old, unversioned active uprising at the local 105% ceiling, once. It preserves its deadline, reward roll and captives. Events receive a small `rebelV: 1` marker; saves remain `G.v === 1`. Existing lost provinces and rewards already earned are retained.

## Controlled before/after checks

The baseline was recorded from main commit `132fb7b`. The infantry fixture uses 2,000 attacking infantry at ATK multiplier 3 against 400 infantry, 100 gunners, 300 archers and 100 cavalry at DEF multiplier 1, with neutral orders and fixed random rolls.

| One infantry phase | Before | After |
|---|---:|---:|
| Defending infantry lost | 400 | 400 |
| Gunners lost | 100 | 100 |
| Archers lost | 300 | 0 |
| Cavalry lost | 100 | 0 |
| Delay between clearing infantry and rear contact | Shared clash | 1.25 battle seconds |

The front consumes 0.692 seconds; the gunner contact starts at 1.942 seconds and ends at 2.192. The clock expires before another line can be reached. Higher defense can keep the infantry line alive for the whole window, protecting both ranged formations.

A separate seeded year-5 fixture with 400 infantry / 300 archers / 150 gunners / 100 cavalry and equipped level-10 commanders had army power 4,580. Its Settsu uprising budget fell from **1,183 → 292**, with **191 → 63** rebels in that particular officer roll. This is an illustrative fixture, not an exact reconstruction of the reported save. The focused checks additionally increase the player's army/gear drastically and verify unchanged local revolt power, and confirm Lawless Coasts still strengthens ordinary raiders.

`tests/melee-rebels.cjs` checks screens, timed damage, shared clocks, bonuses, eliminated attackers, real phone-sized playback and movement, local early/late scaling, legacy saves, rewards/deadlines, and garrison consistency. Its actual advancing sprites reach the gunner line before the first rear damage, while all 300 archers survive that infantry phase. See [recorded checks](../reports/melee-rebels.json).

The complete local browser regression passed **23/23 suites**, including battle-end stalemates, density-independent combat, sieges, tactics, equipment, uprisings, save/load, roads and logistics. The byte-identical standalone export also passed the 31 focused infantry/rebellion assertions.

## Code paths

- `resolvePhase()` / `resolveInfantry()` / `INF_CLOCK`: original strike stats converted into a finite shared engagement schedule.
- `finishPhase()` / `guardInfantryBreakthrough()` / `heroPhase()`: preserve simultaneous front exchanges and prevent posthumous or transferred bonus spill.
- `buildScript()` / `infAdvance()` / `timedInfAdvance()` / `lineClash()` / hero and retainer strike helpers: queue and render the matching contact, advance and casualty events.
- `sitePowerScale()` / `enemyArmy()` / `rebellionBase()` / `spawnRebellion()` / `rebelTick()` / `afterLoad()`: local revolt budgets, correct retake units and one-time legacy correction.

No new art assets, canvas caches, UI panels or persistent combat history are introduced. Run `node tests/melee-rebels.cjs`; `BALANCE_DOWNLOAD` optionally verifies an exported standalone HTML. The suite is included in `npm test`.
