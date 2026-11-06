# Real-time deployment and battlefield layers

Choose **Village → Options → Battle: Real-time**, then enter an army field battle. Before the fight, **Plant your banners** shows the actual Infantry, Gunners, Archers and Cavalry available, with combatant counts and Power. Drag a formation or its planted standard, or select its card and tap the ground. Select a shape, then **Raise the banners**. Reset ranks restores the accepted starting positions. The camera supports 2.5D/isometric, pan and pinch throughout.

The ivory boundary is enforced against the whole footprint, including mounts, wide shapes, independent fighters of the same arm, commanders and their guards. Formations cannot overlap another arm or cross the boundary. Invalid drops retain the previous placement. Reset ranks restores both the opening positions and shapes so a later width change cannot leave the reset army outside the field. Preparation advances neither combat time nor HP. Saved Loose/Skein preferences are fitted once before interaction; ordinary placement never invokes a pathfinder. There is no new army cap, purchase screen or saved deployment ledger.

## The three layers

1. **Staging and presentation.** Full field armies begin in deeper ranks, retain existing modular faces/equipment and carry planted clan standards. The initial view fits both armies around the HUD; after the opening, it gently follows the clash unless the player has moved the camera. Black/gold mechanic captions and a compact field journal add context. A standard collapses only after its corps has no soldiers or healthy field officers left. **Village → Options → Battle shake** cycles Off/Low/Full; Low is the default, or Off when the browser requests reduced motion. Shake is capped, cosmetic, and consumes no combat randomness.
2. **Deployment and orders.** Hold, Advance/Charge cycle and **Fall Back** use the existing live model. Fall Back moves toward a bounded point 170 world units to the rear, then Holds. It exits a stationary pikewall, suspends new ranged releases and clears stored mounted charge readiness; released projectiles still land normally. Infantry contact slows disengagement, including mounted heroes. Repeated orders cannot reset the withdrawal. A commander-only remnant can withdraw. This is a local order; it does not invoke campaign Retreat or remove troops.
3. **Reserves, feints and reports.** An enemy cavalry corps waits visibly in reserve when another enemy arm can hold the front. It commits on close approach, an engaged/weakened infantry front after eight combat seconds, or by sixteen seconds. Eligible seeded battles may probe for three seconds, draw back for up to 2.5 seconds, then commit; contact cancels the feint. This uses existing soldiers and actual movement. At three seconds, one optional eight-second field decision offers Hold front/Press on/Keep orders, plus Intercept when cavalry and a real reserve exist. The army continues fighting; expiry retains current orders. No-cavalry armies receive a lines-closing cue instead of a fabricated reserve. The journal retains at most 40 reports and shows one or eight at a time.

The regular 25-second recovery/duel windows remain. Tactical timers use the fixed combat clock, stop with Pause or cinematic duels, and persist across those windows. Actual troop HP, commander HP, skills, wards, retainers, medicine, casualties, cohesion, Last Stand and existing casualty-based rout presentation remain authoritative. No morale or decision deadline decides victory.

## Scope and implementation

This release covers field staging and the first battle layers. Classic battles retain their existing preparation and phases. Standing castle walls retain their siege targeting; skirmishes and post-breach fields retain their existing entry flow. Ladders, wall-defence battles, manually aimed siege, new campaign chapters/doctrines and a Muster cap are outside this change.

| Source | Responsibility |
|---|---|
| `prototypes/battlefield-25d/combat.js` | Whole-corps placement/footprints, preparation shapes, bounded withdrawal and pinning |
| `prototypes/battlefield-25d/renderer.js` | Procedural standards, boundary/ghost, camera framing, inverse pointer projection, capped shake and cached terrain |
| `tools/modules/battle-deployment.js` | Preparation UI, real orders, bounded reports/decisions, enemy reserve/feint timing, shake preference and covered scenery lifecycle |
| `tools/modules/battle-realtime-campaign.js` | Existing campaign model/renderer hooks, controls, cleanup and actual equipment/HP integration |
| `index.html` | Saved option, responsive panels, deployment/round/resize entry points and embedded canonical modules |

Run `python3 tools/apply-battle-realtime.py` after module edits, then `python3 tools/build-battlefield-prototype.py` to keep the standalone demonstration synchronized. No network asset or new runtime library is added. `G.v` stays 1; the only new persistent field is the optional shake preference. Deployment, decisions, logs and reserve state live in `BT`, and are discarded on close.

Current population and memory figures after the later doubling are documented in [Doubled real-time armies](doubled-armies.md). The measurements below record the original staging release.

## Memory and verification

The live field releases the covered Classic ground/scenery buffers as well as its unused drawing buffer. Before a Classic duel/prelude, scenery is rebuilt while preserving the exact aftermath decal. Terrain is rendered once at half backing resolution, snapped to the same coarse pixel grid and drawn with nearest-neighbour scaling; equipment and character frames retain their existing resolution. This reduces the cached field ground from about 7.1 MiB to 1.8 MiB. Rotation rebuilds that single cache and teardown releases it.

`tests/battle-deployment.cjs` exercises the actual interactive entry flow with real browser pointer events, phone controls, accepted/invalid/cancelled placements, rotation, saved shapes, commanders/guards, optional decisions, pinning, real reserves/feints, last-officer victory, settings/save compatibility and overlay cleanup. The fully mounted stress fixture has 376 ordinary physical models and 48 officers/guards: canvas backing stays **43.09 MiB → 43.09 MiB** across 90 warm redraws, with **zero new canvases**. Shake Off/Full and 30/60 fps produce identical recorded HP/projectile/report ledgers. Conservation residuals stay below 1e-6.

The focused suite passes **36 checks**. Prototype/model/render coverage passes **245 checks**. Existing real-time campaign/review/hero/engagement/volley, cold-duel, auto-resolve, Classic tactics, siege, density and battle-end suites also pass. Engine-only fixtures explicitly bypass interactive preparation so they can set their own positions/seed; the campaign suite and new deployment suite exercise preparation itself. Raw results and desktop/phone captures are in [`reports/battle-deployment`](../reports/battle-deployment).

These are local Chromium measurements with external requests blocked. They do not establish physical iPhone Safari frame rate, long-session memory or the peak allocation during a cinematic transition. Existing Classic art atlases have a separate memory footprint. A paired check against main at `ae131c1` records Classic HP/reward ledgers, gun burst/cadence damage, ward math and isolated software-render timing in `comparison.json`.

Eight Classic ledger pairs (ordinary, skilled, burst/duel and siege), eighteen sustained gun pairs (three weapons, two ranges, three seeds), and all 24 damage/ward cases match exactly. Performance uses the same 432-actor officer/retainer army in sequential before/after/after/before runs; engine-only placement isolates renderer/model costs from intentional deployment/reserve decisions. The table averages the two runs' medians/p95 values.

| Paired fixture | Main before | Updated |
|---|---:|---:|
| Canvas MiB, start → end | 48.98 → 48.98 | 40.97 → 40.98 |
| Median update / draw, ms | 0.45 / 2.50 | 0.40 / 2.35 |
| Frame p95, ms | 63.10 | 55.85 |
| Canvases created by 360 warm draws | 0 | 0 |

The software-rendered p95 has long stalls in both versions and is not a device frame-rate claim. Three first-use casualty canvases are allocated during updates in each version; they use the existing finite reaction cache. Reproduce the focused checks with `node tests/battle-deployment.cjs`; run the slower paired check separately with `node tools/probe-battle-deployment.cjs` so other browser suites cannot distort timing.

The exact exported **Shinobi Hollow.html** also passes touch card/tap placement, launch and timed-decision playback with external requests blocked and the network subsequently disabled, with zero runtime errors. [`offline.json`](../reports/battle-deployment/offline.json) records its SHA-256. Managed Chromium blocks direct `file://` navigation, so this check uses local HTTP; a physical Safari downloaded-file session remains to be checked.

## Review corrections before merge

The follow-up review reproduces nine failures on the initial PR head in [`review-before.json`](../reports/battle-deployment/review-before.json), then checks the final fixes through the same actual campaign adapter in `tests/battle-deployment-review.cjs`:

- Restoring covered Classic scenery preserves both the persistent decal canvas and its original `BT.dx` context. Blood, embedded arrows and aftermath stamps can still draw after a duel. Scenery rebuilding uses an isolated visual random stream and restores `Math.random` in `finally`, so cosmetic restores cannot consume subsequent combat/reward randomness.
- Field reports and decisions hide immediately on a duel/grenade transition and on results, then return when the live field resumes. The model and decision clocks stay paused. Rotating the phone forces overlay geometry to update even when the report contents are unchanged. Eliminated selected corps lose their controls, and Intercept disappears when no friendly cavalry survives.
- Reset restores the initial shape with the initial position. Withdrawal destinations account for full living footprints, including mounted officers and Skein spread, on both sides of the field. Both ordinary commanders and independent mounted heroes clear their stored charge bonus when ordered to withdraw.
- A shared standard stays upright while any independent hero of its corps can still fight. Its collapse represents the final active group, rather than the first hero's fall.
- Deployment Power uses the complete army context, including companion attack bonuses, when measuring each corps.

Short landscape screens use a compact preparation panel; the 932×430 fixture leaves at least 180 CSS pixels of unobscured field and keeps both armies inside that area. All 14 review checks pass, alongside the 36 deployment checks, 245 prototype checks and 13 broader combat suites. Review results, the validation summary and the captured landscape are in [`reports/battle-deployment`](../reports/battle-deployment). Run the review checks with `node tests/battle-deployment-review.cjs`.
