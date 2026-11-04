# Classic and real-time damage/performance review

Compared the volley/skill changes against `c1bbb1529164c8e44214d303a231bf0d7702a9bf`, the preceding assignment/mount build. No additional gameplay or balance changes were needed for this review. The standalone game contains no comparison runner or benchmark UI.

The [raw report](../reports/battle-balance-performance/results.json) records source SHA-256s, individual seeds, damage ledgers, timings and canvas backing sizes. Run `npm run test:battle-balance` with Playwright and Chromium available. The runner serves both standalone versions locally, blocks external requests, disables the animation driver/audio, and advances isolated browser fixtures manually. It never accesses the player's save.

## Damage

- **Classic: 20/20 exact paired results.** Five seeds cover ordinary armies, active commander skills, rifle bursts with HP duels, and standing-gate sieges. Every recorded hit, damage total, duel strike log hash, completed round count, surviving troop total and result matches the preceding build. This is exact equality, not a statistical tolerance.
- **Real-time baseline damage and Wards:** paired calls through the actual campaign damage adapter cover all four formations, charge/non-charge calls and Ward levels 0/3/6. Base damage, resistance and Ward calculations match exactly. These checks do not claim that restored skill procs should match the old missing effects.
- **Real-time sustained firearms:** 27 paired cases cover three weapons, three distances and three seeds. Targets remain alive and stationary; both sides hold position. After three warm reload cycles, measure eight complete reload cycles. Every pair fires exactly the same number of rounds. HP conservation residuals stay below `1e-6`.

| Weapon | Rounds per eight cycles, before → after | Pooled damage change, all distances/seeds |
|---|---:|---:|
| Tanegashima | 384 → 384 | −0.21% |
| Repeater | 768 → 768 | −0.04% |
| Rifle | 1,152 → 1,152 | −0.01% |

The largest pooled change at one distance is −1.12%, for long-range Tanegashima shots. Bullet scatter and different release timing change individual collisions. The test allows 3% pooled scatter variation at each distance and requires identical completed-cycle shot counts.

The report retains the original `fixedWindow` samples for transparency. An arbitrary 60-second window initially made rifles appear weaker: the new synchronized burst crossed the warmup boundary as a group, while the old staggered burst straddled it. Complete reload-cycle samples remove that boundary artifact. Opening volleys are intentionally earlier; sustained MRK/reload intervals are unchanged.

Restored Rapid Shot, Chain Strike and Countershot have actual additional effects, and Horse Lord is restricted to charges. Their intentional differences, active secondary skills, finite recovery, Vanguard motion and moving-projectile behavior are covered by the [dedicated volley/skill checks](realtime-volleys-skills.md). Real-time remains a physical simulation; its battle outcomes are not expected to equal Classic's staged outcomes.

## Update and drawing cost

Sequential, isolated Chromium runs use a 430×932 CSS-pixel viewport at device DPR 3, with the game's existing backing-resolution rules. Each fixture warms for 120 update/draw frames, then measures 360 frames at `dt=1/60`. Versions run in before/after/after/before order, with no other browser tests running concurrently. The table averages the two per-run medians; p95 averages the two per-run frame p95s. These are software-rendered call costs, **not measured device FPS**.

| Mode / visible actors | Update ms, before → after | Draw ms, before → after | Frame p95 ms, before → after | Canvas MiB after sampling, before → after |
|---|---:|---:|---:|---:|
| Classic / 288 | 0.30 → 0.30 | 8.70 → 9.00 | 19.25 → 19.50 | 146.29 → 146.29 |
| Classic / 336, including officers/guards | 0.30 → 0.30 | 7.05 → 8.65 | 18.25 → 22.25 | 288.11 → 288.11 |
| Real-time / 384 | 0.30 → 0.30 | 1.90 → 2.30 | 78.25 → 83.95 | 28.75 → 28.76 |
| Real-time / 432, including officers/guards | 0.40 → 0.45 | 2.30 → 2.55 | 66.90 → 77.45 | 47.95 → 47.96 |

Simulation medians remain small and stable. Real-time shows an additional 0.25–0.40 ms of median drawing cost in this sample; the report does not call that zero overhead. It allocates **zero canvases in the measured draw pass**. Three/six small first-use casualty variants are generated during updates, adding less than 0.012 MiB. No sprite cache is added by the volley changes.

Classic's hot update/draw function sources are identical across versions. A separate repeat confirms identical rendered scene hashes for each profile and identical canvas backing. Timing still varies significantly between processes; `performanceRecheck` preserves that repeat rather than replacing the initial numbers. `renderControl` additionally holds each Classic scene stationary, warms another 360 draws and measures 360 draws without updates. It also creates zero canvases. These controls help distinguish process/raster variance from changed simulation or scene content; they do not establish hardware frame-rate parity.

Both Classic officer samples create the same 24 first-use flipped canvases during the full moving sample. The stationary control warms and holds its rendered poses before timing. Classic's **146–288 MiB** canvas footprint is an existing problem, unchanged by this PR; it exceeds the historical 48 MiB mobile goal. Real-time remains below 48 MiB in these sampled fixtures. This short comparison cannot establish long-session memory stability, physical iPhone Safari frame p95, app-switch reliability or sustained 60 fps. Those remain unverified; the noisy software p95s are not a hardware performance pass.

## Reproduction details

- `tools/battle-regression-fixture.cjs` builds real campaign armies and gear, drives the shared Classic resolver and real-time model, and measures the actual `updateBattle()` / `drawBattle()` paths.
- `tests/battle-balance-performance.cjs` compares the preceding Git revision with the working standalone file. `BATTLE_BASELINE_SOURCE` and `SHINOBI_DOWNLOAD` optionally select other standalone files.
- `BATTLE_DPS_ONLY=1`, `BATTLE_PERF_ONLY=1`, `BATTLE_RENDER_ONLY=1` and `BATTLE_MATH_ONLY=1` repeat individual sections against an existing report. Source hashes must match before combining partial results. The ordinary full run includes damage, performance and stationary drawing controls.
- This explicit, slower comparison is separate from the normal quick regression runner. Twelve gameplay suites already pass on the reviewed runtime, including campaign integration, skills, wards, duels, siege, tactics, equipment, mounted rendering and auto-resolve.
