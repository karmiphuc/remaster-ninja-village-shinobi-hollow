# Duel attacks and executions

Duels have more procedural attack poses and distinct finishing effects. The same face, hair, helmet, armor, shoulders and equipped weapon are assembled by the game's existing art helpers. No sprite sheets, runtime image downloads, item changes or new save fields are needed.

| Move | Choreography and effect |
|---|---|
| Triple slash | Three resolved strikes build a black, steel-edged Z. The completed Z flashes together at the KO, then fades. |
| Triple thrust | Swords and yari can perform three jabs, ending low on foot. Three parallel impact swipes accumulate with the hits. |
| Sliding thrust | A knee-down guard becomes a short sliding lunge, with restrained afterimages, ground dust and a low piercing trail. Swords and yari can use it. |
| Cross cut | Opposed cuts leave an X-shaped impact. |
| Rising cut / reversal | A low-to-high cut or returning naginata sweep follows a curved ink-and-steel trail. |
| Guard break | A committed overhead blow has a heavier vertical impact and ground dust. |
| Passing strike / jumping cut | A short passing burst or modest leap has its own trail, recovery and victory stance. |

Ordinary exchanges also vary between cuts, thrusts and low counters. Sword hands stay together on the hilt; polearm hands retain their wider grip. Mounted champions use their existing mounted poses and never kneel-slide. Claws retain their rapid cutting identity, while bows and guns retain their existing shot and reload logic.

## Combat and timing

`simDuel()` and its damage, accuracy, combos and HP outcomes are unchanged. `duelStrikePose()` and `duelFinisher()` select presentation from the resolved strike data without consuming combat RNG. A triple execution requires an actual three-entry chain; the art never invents additional hits.

`tdHit` remains the single, idempotent HP commit. Finishing trails require that their ledger entry has been applied; misses stay faint. The localized black impact burst and collapse wait for the actual KO. Talisman and retainer rescues use gold effects and surviving poses, with no fatal black burst or victory stance over a rescued opponent. Assistance and 1v1–3v3 scheduling retain the existing behavior.

The separate cinematic clock remains **1.18 seconds** at 1× speed. Existing hit-stop, battlefield presentation freeze, shared battle clock and scheduled hit times are preserved. There is no extra pause or damage at the end of a clip.

## Rendering and validation

`duelPoseFrame()` recognizes a finite set of 12 poses, including reload fallback, and normalizes facing. Its cache is bounded to **24 pose/facing keys per participating character**. The 11 full-body poses are warmed incrementally, interleaved across champions, using the existing 2 ms budget. Effects use fixed paths and small direct-drawn marks; afterimages reuse the same cached frame. Battle cleanup releases the pose canvases and cached parts.

`tests/duel-executions.cjs` compares **120 seeded HP/damage ledgers** with the pre-change baseline from main `d6b0970`. It also checks real 1v1, 2v2 and 3v3 playback, teammate assistance, talismans, retainers, mounted and ranged fighters, repeated hit events, 30 fps at 4× speed, visual RNG isolation, distinct effects, zero warmed render-time canvas creation and cache cleanup. Results: [duel-executions.json](../reports/duel-executions.json). The normal regression runner includes the suite.

All **24 local regression suites passed** ([run log](../reports/duel-execution-regression.txt)), including **347 focused duel checks**. The 120 baseline ledgers are identical, all nine tested effect families are distinct, warmed render-time canvas allocations are zero, and battle close clears the pose canvases. The exact standalone export was also checked over local HTTP and byte-compared with `index.html`.

The [animated preview](duel-executions-preview.gif) and [contact sheet](duel-executions-preview.png) are rendered from genuine HP-resolved KO chains by `tools/preview-duel-executions.cjs`. They are review artifacts, not game dependencies. Browser checks run locally in Chromium; physical iPhone Safari performance has not been measured for this change.
