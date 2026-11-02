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

`simDuel()` and its damage, accuracy, combos and HP outcomes are unchanged. `duelStrikePose()` uses the resolved strike data; `duelFinisher()` rolls a private visual PRNG among eligible finishes without consuming combat RNG. A triple execution requires an actual three-entry chain; the art never invents additional hits.

`tdHit` remains the single, idempotent HP commit. Finishing trails require that their ledger entry has been applied; misses stay faint. The localized black impact burst and collapse wait for the actual KO. Talisman and retainer rescues use gold effects and surviving poses, with no fatal black burst or victory stance over a rescued opponent. Assistance and 1v1–3v3 scheduling retain the existing behavior.

Foot executions last **1.18 seconds** at 1× speed. The two special horse executions use **1.42 seconds**, within the original short cinematic budget. Each clip has its own clock, with a one-time correction for an event caught between frames. The shared battle clock continues; hit events are scheduled from the clip's actual beats, including at 30 fps / 4× speed. There is no extra damage at the end of a clip.

## Rendering and validation

`duelPoseFrame()` recognizes a finite set of 25 pose/fallback names, including the newer infantry finishes, and normalizes facing. The cache is bounded at **50 pose/facing keys per recipe**; mounted actors use their seven horse poses plus the optional unhorsed frame and otherwise reuse their existing sprite set. Foot poses are warmed incrementally across champions, and only the required mounted poses/facings are added to the same existing 2 ms warm-up budget. Effects use fixed paths and small direct-drawn marks; afterimages reuse the same cached frame. Battle cleanup releases the pose canvases and cached parts.

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

## Yari throws and infantry executions against cavalry

Three additional finishes extend the resolved weapon choreography:

- **Yari cast:** a foot spearman creates a little throwing room, chambers the actual equipped spear overarm and releases it along a short gravity arc. The throwing hand is empty during flight. After the KO, the victor steps in and retrieves the spear before their victory stance. The projectile is the existing procedural weapon layer, including bamboo, steel, long and cross-headed variants. This finish targets foot opponents; mounted opponents have the braced-spear family instead.
- **Braced impalement:** infantry using a yari plant low as the actual horse charges into the spear. The horse buckles and folds while the rider falls along the rising thrust. A second short piercing trail describes the rider's fall onto the point. Horse and rider settle flat together, leaving their actual barding, armor and standard in the existing battlefield aftermath.
- **Rider takedown:** sword infantry leap toward the saddle, reach with a free hand while keeping the sword in the other, pull the rider clear and land in a kneeling ground execution. The horse bolts away riderless, using its existing coat, tack and running frames. The rider remains on the battlefield.

All three last **1.46 seconds** at 1× cinematic speed. One-, two- and three-hit variants retain exactly the simulator's real strike entries. Earlier hits remain weapon openers; the new move supplies the ending. The extra spear/horse/rider reactions are presentation of the decisive hit, not additional attacks. Selection is randomized within weapon- and hit-count-specific pools and requires a foot attacker; the two anti-cavalry endings additionally require infantry and an actual horse-mounted target. Bows, guns, claws, animal companions and mounted attackers retain their existing families.

`duelFinisher()` and `duelClip()` select the family and timing. `startDuel()` adds only selected special poses to the existing incremental 2 ms warm-up queue and gives a thrown yari more space. `duelPoseFrame()` adds finite overarm, empty-hand, brace, grapple and downward execution poses; the unhorsed pose assembles the victim's actual face, hair, armor, weapon and helmet on foot. `duelFootMotion()` reuses one object per clip. No canvas is created by warmed animation drawing, and no new long-lived sprite cache is added.

At `tdFinish`, an available retainer or talisman substitutes a normal thrust/guard-break ending before the fatal horse or grapple track starts. The retainer still intercepts before the first real strike. Protected commanders and their horses do not acquire corpse art. HP and rescue costs are still committed only by the existing idempotent `tdHit`; `tdEnd` still controls commander absence and recovery.

`settleDuelFootFinish()` stamps the cosmetic remains once into the existing aftermath records and hides the defeated commander's moving sprite. It creates no extra troop loss, inventory deduction or survivor accounting. Braced horses remain with their riders; takedown horses transfer once to the existing riderless-horse list. Those horses use private seeded dust randomness so their new visual effects do not consume combat RNG. `recoverVisual()` removes the cosmetic remains if the existing game recovers an actor. Cleanup and resize reuse the existing aftermath lifecycle; there are no new save fields and `G.v` remains 1.

`tests/infantry-executions.cjs` covers genuine KO plans at all three hit counts, equipped Nanbu barding, separate rider art, thrown-weapon duplication/retrieval, unchanged HP/troops during drawing, flat/idempotent aftermath, both sides, team assistance, early retainer and talisman rescues, 30 fps / 4× playback, zero warmed canvas allocations and battle-close cleanup. `tools/preview-infantry-executions.cjs` renders genuine KO chains and a retainer interruption as review frames; the standalone game imports none of those artifacts.

Review the [three-move animation](infantry-executions-preview.gif) or [four-beat contact sheet](infantry-executions-preview.png). They show the real modular gear and resolved hits, with no runtime image dependency.

Latest local result: **six suites passed against the exported HTML**—infantry-executions, duel-executions, duel-cavalry, animal-duels, battle-end and battle-heraldry. The new suite records **232 checks**, covering nine real move/hit-count plans and thirteen playback scenarios. All **120 reference HP/damage ledgers** remain identical; warmed new animation rendering creates zero canvases. Heraldry removal passes 139 assertions and phone/desktop/landscape clearance checks. The export byte-matches `index.html`, and the logistics code remains byte-identical to merged PR #33. Physical iPhone Safari performance has not been measured.


## Randomized execution selection

Every KO now rolls from an eligible move pool, including older endings and the new yari/anti-cavalry moves. Swords, heavy blades, yari, naginata, claws and mounted melee have distinct pools. The selector no longer fixes a claw ending from hit count or gives the new anti-cavalry finish two-thirds of the selections. Heavy blades retain committed cuts, naginata retain sweeps, and mounted fighters never receive foot-only slides, throws, braces or grapples. Doubles and triples still require their actual resolved hit counts. Bows and guns retain their compatible release finish. An active animal companion retains its existing approximately two-thirds participation chance, with the other rolls using the weapon pool.

`duelFinisherPool()` builds the small eligible pool only while planning a KO. `duelFinisher()` uses a private PRNG salted by the randomized battle seed, round, duel number and resolved strike identity. Separate encounters receive fresh rolls even when their weapon and hit count match. A WeakMap memoizes the chosen family by the actual final strike object, so warm-up, clip creation, playback and repeated queries cannot reroll it; entries expire with their transient strike ledgers. No new combat RNG calls, save fields, canvases or per-frame selection are introduced. Rescue fallbacks and HP commits are unchanged.

`tests/duel-randomization.cjs` samples **4,992 selections** across **39 weapon/mount/target/hit-count profiles**, including claws, both heavy blades, all three new endings and mounted attacks. It verifies varied eligible choices between duels, stable choices for the same KO, actual-count restrictions, no foot-only mounted moves, zero combat RNG calls and unchanged save state. The developer fixture fixes only its battle-art seed so genuine-KO previews and regression searches remain reproducible; gameplay still uses its existing randomized battle seed.

After randomization, **five affected suites pass on the exact exported HTML**: duel-randomization, duel-executions, duel-cavalry, infantry-executions and animal-duels. The selector records 25,009 assertions; the new execution suite records 255 checks. All 120 reference HP/damage ledgers remain identical, and retainer/talisman rescues still pass at 30 fps / 4×. Results: [selection samples](../reports/duel-randomization.json) and [focused regression log](../reports/duel-randomization-regression.txt).
