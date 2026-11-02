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

Foot executions last **1.18 seconds** at 1× speed. The two special horse executions use **1.42 seconds**, within the original short cinematic budget. Each clip has its own clock, with a one-time correction for an event caught between frames. The shared battle clock continues; hit events are scheduled from the clip's actual beats, including at 30 fps / 4× speed. There is no extra damage at the end of a clip.

## Rendering and validation

`duelPoseFrame()` recognizes a finite set of 19 pose/fallback names and normalizes facing. Foot actors use at most **24 pose/facing keys**; mounted actors use at most **14** new horse-pose keys and otherwise reuse their existing sprite set. Foot poses are warmed incrementally across champions, and only the required mounted poses/facings are added to the same existing 2 ms warm-up budget. Effects use fixed paths and small direct-drawn marks; afterimages reuse the same cached frame. Battle cleanup releases the pose canvases and cached parts.

`tests/duel-executions.cjs` compares **120 seeded HP/damage ledgers** with the pre-change baseline from main `d6b0970`. It also checks real 1v1, 2v2 and 3v3 playback, teammate assistance, talismans, retainers, mounted and ranged fighters, repeated hit events, 30 fps at 4× speed, visual RNG isolation, distinct effects, zero warmed render-time canvas creation and cache cleanup. Results: [duel-executions.json](../reports/duel-executions.json). The normal regression runner includes the suite.

All **24 local regression suites passed** ([run log](../reports/duel-execution-regression.txt)), including **347 focused duel checks**. The 120 baseline ledgers are identical, all nine tested effect families are distinct, warmed render-time canvas allocations are zero, and battle close clears the pose canvases. The exact standalone export was also checked over local HTTP and byte-compared with `index.html`.

The [animated preview](duel-executions-preview.gif) and [contact sheet](duel-executions-preview.png) are rendered from genuine HP-resolved KO chains by `tools/preview-duel-executions.cjs`. They are review artifacts, not game dependencies. Browser checks run locally in Chromium; physical iPhone Safari performance has not been measured for this change.

## Mixed sequences, horse executions and retainer interception

Moves now compose around the real **one-, two- or three-hit chain** instead of tying every ending to one fixed hit count. Swords share six endings—passing strike, sliding thrust, jumping cut, rising cut, guard break and straight thrust—across all three counts. A sword can perform a single sliding thrust, a cut into a slide, or a cut → thrust → sliding thrust. Heavy blades, polearms, claws and firearms retain their weapon-specific identities; yari keep thrust-led sequences. A Z or a triple thrust still requires three real ledger entries.

Mounted melee champions can also use:

- **Rearing trample:** rise on planted hind legs, strike with the front legs, then land and trample through. A two-hit chain uses a front-leg strike and a decisive stamp; a third real hit can supply a weapon opener. With one resolved hit, the extra stride over the fallen opponent is follow-through and applies no additional damage.
- **Turning hind-leg kick:** turn through a small hop, load the hindquarters over planted forelegs, then kick backward into the opponent. A bounded airborne arc ends in a grounded collapse. The horse keeps its real coat, barding and tack; the rider keeps their face, armor and weapon.

The horse and rider use the existing jointed procedural rig. Saddle and rein anchors follow the pivot; Nanbu leg plates follow the loaded or striking legs. Finishing positions are carried into the existing return movement, so a horse or sliding swordsman does not snap back when the cinema ends. The kicked opponent lands at their actual visual endpoint.

A surviving retainer now stays near their commander during the duel and jumps into the impact position **before the first finishing strike**. The commander backs out of that position and remains visibly alive. The actual equipped retainer flinches through the hits, then falls at the decisive impact using the normal dropped-equipment and aftermath system. Their existing sacrifice is counted once; the end event only handles any remaining guards already included in that cost. If the four visible guards have fallen but the commander still has a real reserve, one reserve is brought into view using existing equipment and bounded sprite caches, with a separate seeded visual random source.

Talismans retain priority, and neither rescue uses the fatal impact burst or the commander's death pose. HP-based KO, commander absence and next-round recovery keep their existing rules. No troop, item or retainer is added by the animation. All clip, escort and pose data are transient; version-1 saves are unchanged.

The [new animated preview](duel-sequences-preview.gif) and [six-panel sheet](duel-sequences-preview.png) show three real hit counts, both horse executions and the early retainer interception. `tests/duel-cavalry.cjs` checks genuine KO plans for both horse moves at all three counts, both facing directions, 1v1–3v3 playback, talismans, multiple retainer costs, reserve guards, repeated events, early interception, cache cleanup and zero warmed render-time canvas creation. Results: [duel-cavalry.json](../reports/duel-cavalry.json).

All **26 local suites passed**. After the final move-pool and transition adjustments, both duel suites were rerun against the exact standalone export: all **120 baseline HP ledgers** remain identical, all **18 shared-ending/hit-count combinations** have genuine KO examples, and the mounted/rescue checks pass at 30 fps / 4× speed. The [validation log](../reports/duel-cavalry-regression.txt) includes the full run and final export checks. The export byte-matches `index.html`; physical iPhone Safari performance remains unmeasured.
