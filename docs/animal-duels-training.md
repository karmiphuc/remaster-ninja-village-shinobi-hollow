# Animal finishers and the Training Ground ladder

The standalone source is `index.html`. This change extends the existing duel presentation and the campaign Training Ground; it does not change damage, equipment stats, village buildings, logistics or road routing.

## Equipped animal finishers

The game renders non-horse mounts as companions beside their commander. Their new finishers use that same live sprite and equipped species, rather than replacing them with a horse or summoning a second animal.

| Companion | Finishing sequence |
| --- | --- |
| Bear | Rise, load the forepaws, slam down, settle onto all fours |
| Boar | Lower the head, charge, toss the opponent into a short grounded collapse |
| Hound, wolf, Tosa | Crouch, pounce into the opponent, bound back |
| Fox, tanuki | Sidestep and draw attention while the commander makes a passing cut |
| Monkey | Vault into a coordinated low-guard strike and spring back |
| Hawk, gyrfalcon | Climb, dive with talon trails, recover into flight |

An equipped companion participates in approximately two-thirds of eligible KO sequences; the other sequences retain the weapon's existing finishers. This is a deterministic presentation choice from the resolved strike chain. One-, two- and three-hit finishers contain exactly the simulator's actual hits. Weapon openers lead into the animal finale, with a 1.36-second independent cinematic clock. No damage is added for a paw, bite or talon effect.

`duelFinisher()` and `duelClip()` choose the family and schedule the existing HP events. `updateDuelPet()` controls the existing companion during the cinematic; normal `updPet()` following resumes afterward. `drawDuelScene()` excludes that companion from its frozen backdrop and draws it once with the active actors. `releaseDuelPet()` runs on completion and cancellation. Retainers still intercept before the first damaging hit, talismans remain nonfatal rescues, and neither changes casualty accounting.

Only existing, finite beast poses are used. Both facings are warmed at the clip boundary and shared by species; there is no per-frame canvas creation, new physics simulation or open-ended animal sprite cache. Human poses and battlefield backdrops retain the existing battle-close cleanup.

## Training Ground progression

- New games and old saves without a ladder start at **level 1: 30 infantry**, without a sparring commander.
- Nominal troops start at 30 and grow by `max(25, ceil(previous count × 0.10))` per level. The nominal power budget follows those recruits. The player's current army power is an **upper ceiling**, not a target. Reinforcements or new research cannot jump an uncapped low-level opponent to the player's strength.
- Defeating the current level advances it once. Losing or explicitly withdrawing does not advance it. The existing two-month cooldown, XP, no-permanent-troop-loss rules, normal rolled prizes and loss consolation remain.
- Infantry takes each ordinary-level increase; at ten-level milestones, one other unlocked arm can take up to 40% of that milestone’s increment. Archers enter from level 10, gunners from 20 and cavalry from 30, only after their Corps is unlocked. Infantry retains the majority. Small capped armies omit groups too small to field anyone.
- Officers enter from level 10. Their stats and gear follow the ladder's level, independently of player equipment. Army strength is calibrated through persistent `calA`/`calD` factors so recounting after an officer KO does not restore uncapped strength.
- A player army weaker than the opening 30-infantry budget gets fewer trainees to respect the ceiling. An army with zero power has no opposing trainees. Progression evaluation stops at the power ceiling, so extreme saved levels cannot overflow or require iterating through the entire saved level.
- The campaign card displays the level, 10% / minimum-25 rule, and the next milestone prize. The prize multiplier in an old saved `dojoPrize` is still readable, but no longer controls difficulty.

Two small saved counters, `dojoLevel` and `dojoMilestone`, preserve `G.v === 1`. `migrateTraining()` initializes and sanitizes them in `afterLoad()`; it is idempotent. The active battle snapshots its level and milestone reward and has a transient payout guard. Repeated battle-end calls cannot advance or reward it twice.

## Every tenth cleared level

The milestone is awarded on **clearing** level 10, 20, 30 and so on, in addition to the ordinary spar prize. Merely reaching level 10 does not award it.

| Cleared level | Bonus | Later cycles |
| --- | --- | --- |
| 10 | Free worker | Aim for better potential grades at 70 / 130 / 190 |
| 20 | Free equipment research | Aim for the next tier above current research, up to tier 5 |
| 30 | Free armor | Progress from tier 3 toward tier 5; keep pace with current research |
| 40 | Free mount | Progress from ordinary mounts to rare tier 5 mounts; keep pace with current research |
| 50 | Army equipment crate | Start at 50 sets; grow by 30 each cycle, capped at 150 |
| 60 | Gold | Start at 2,000G; increase by 1,500G each cycle |

Then the six-prize cycle repeats. Selection is deterministic for the current eligibility state, so reopening the card does not reroll it. Research never duplicates an active/queued paid project, respects required equipment and formation/building/doctrine restrictions, and waives only rank/previous-tier count gates for the free reward. Research candidates are equipment rather than Corps, so no separate formation-unlock path is needed.

Workers join for free through `takeRecruit()`, or wait in the existing housing queue. A worker reserved by a castle may join early; `releaseRecruit()` removes their old one-time castle reservation. Already hired, queued, owned or pledged workers and the ordinary spar's recruit are excluded. Exhausted recruit/research pools and a prize that becomes unavailable fall back to useful gold. The [expanded recruit pool](recruit-rotation.md) adds procedural workers and fighters with bounded rotation history and no duplicate ownership.

Ordinary recruit rewards retain the limits **100 infantry / 50 archers / 30 gunners / 20 cavalry**, including consolation rewards. Crates add equipment sets, not troops, using `kitAdd()`.

## Local validation and review

Run:

```sh
NODE_PATH=/opt/codex/cua_node/lib/node_modules node tests/run-all.cjs
```

The two additional suites are `animal-duels` and `training-ladder`. Animal checks cover all ten species, real 1/2/3-hit KO chains, both sides, 3v3 help, retainer and talisman rescues at 30 fps and 4× speed, cancellation, single rendering, unchanged HP ledgers, and zero canvas allocations in warmed animation drawing. Ladder checks cover low/huge levels, the 5% budget and independent power cap, locked formations, real battle completion, loss/repeated payout, all six milestone kinds, exhausted research, paid research exclusion, mobile campaign-card layout, and actual v1 save/load plus legacy migration. The existing 120 seeded pre-art HP ledgers remain the damage reference.

`tools/preview-animal-sequences.cjs` renders review frames from actual KO ledgers; `tools/preview-training-card.cjs` captures the real mobile campaign card. These are local developer tools and are not imported by the standalone game. A headless Chromium run cannot establish physical iPhone Safari frame rate or memory behavior.

### Initial release validation

All 28 local browser suites passed across the full regression run and targeted reruns after updating the grenade fixture for the intentionally weaker level-1 opponent. The exported HTML was used for the affected six-suite combat/campaign check; subsequent focused reruns covered the rare-mount reward and rescued-feint adjustments. The final animal suite records 1,136 checks across ten species and twelve scheduled encounters; the ladder suite records 153 checks. The existing 120 seeded HP ledgers are unchanged. Warmed companion drawing created zero canvases, and the saved ladder counters add 34 JSON characters in the tested save.
