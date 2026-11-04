# Infantry pursuit and siege exposure

The longer infantry phase now spends its time fighting live formations and advancing between them. Castle ranged attacks respect the standing gate: exposed wall archers/gunners are targeted first. Once both wall corps are gone, guns strike the gate and archers lob over it into the courtyard at reduced effectiveness. See the [courtyard volley update](auto-resolve-armory.md).

## Infantry

- `INF_CLOCK.fight` is 5.4 battle seconds. `resolveInfantry()` divides the existing phase damage across this clock, preserving the uninterrupted front-line damage cap (the neutral 400-vs-400 check still resolves 104 casualties).
- Clearing each line consumes its actual allocated fighting time. A different formation line requires 1.25 seconds of movement without melee damage; another group in the same line costs 0.14 seconds. All attacking infantry groups share the schedule. Eliminated attackers cannot strike a later line.
- `timedInfAdvance()` queues real block movement and associates attack orders with their target. `lineClash()` places the final visible casualty near the clearing deadline, including a one-soldier line.
- `exitSprite()` marks the cleared visual line. `updSprite()` stops that line's attack poses and releases the next planned advance. Damage still lands on its scheduled event after travel. If time is too short for travel plus another strike, an optional partial pursuit uses the remainder without inventing damage.
- The old snapshot/stretch machinery is removed. The phase can finish early when there is no remaining eligible action; it no longer adds time after the actual fighting. Short duels, field finishes and the existing faster death/rout animations remain intact.

The longer real clock can let a strong force reach an additional rear line. It must still clear every intervening line and pay for every advance; it receives no larger uninterrupted phase damage budget. Existing field gun/arrow targeting remains independent of this clock.

## Standing gate

- `resolvePhase()` initially limits attacking gun/arrow targets to defender gun/arrow groups, including independent ranged commanders. `layoutSprites()` places both ranged corps in separate sections along the ramparts, keeping their files within the walkway. Regrouping and resize refits preserve these sections. Sheltered infantry/cavalry cannot receive ordinary ranged spill while wall defenders remain.
- The volley chooses its role when planned. If wall defenders are alive, it attacks them only. Once they have been cleared, the next available gun volley attacks the gate and the next arrow volley lobs into infantry/cavalry behind the wall. Clearing a wall line never earns an extra gate/courtyard attack from that same volley. Courtyard arrows apply an extra 0.35 accuracy multiplier to existing siege-arrow power and deal no gate damage.
- Gate projectiles use the actual gunners and normal shot events. A shared volley counter records real shots and scales one gate-damage event; visual multi-shot effects do not duplicate damage. Repeated application of the gate impact is ignored. Gun gate damage retains its existing 0.14 coefficient.
- `chargeGate()` physically brings the attacking infantry/cavalry to the gate. `siegeScript()` restricts their damage to the gate, and `gateHit()` scales later blows to the surviving assault strength. A dead assault group cannot continue ramming. Wall ranged defenders retain their counterfire, without their sheltered infantry suppressing it.
- `breachGate()` removes the rampart lift/formation state and restores field ordering. The existing breach pause, round reset, casualties, commander HP/KOs and Ki are preserved. Bombards still attack gates; Hwacha still attack rampart defenders.

## Scope and cost

This changes battle planning, queued movement, target eligibility and presentation only. There are no new sprite assets/caches, per-frame path searches, save fields, economic changes or victory conditions. Target-clear flags and shot counters exist only in `BT`; the standalone remains a version-1-save-compatible HTML file. The logistics module is unchanged.

## Local validation

`tests/pursuit-siege.cjs` exercises actual `runPhase()`/`updateBattle()` playback for both pursuit directions, partial pursuit with zero extra damage, gun/arrow rampart targeting, protected melee troops, next-volley gate fire/courtyard arrows, idempotent gate impacts, defensive counterfire, dead ram crews, breach state and an independent wall hero. `tests/melee-rebels.cjs` retains damage-cap, travel, screening and posthumous-attack checks. `tests/field-combat.cjs` retains 30/60-fps playback, equipped executions, combat RNG, zero warm-render canvas allocations, reaction speed and ranged impact timing checks. The siege suite asserts held-gate ranged targets are wall defenders or, after the wall clears, courtyard arrow targets. The auto-resolve suite verifies the exact high-wall damage reduction.

The focused suite passes **57 checks** against both the source and the downloaded standalone. On both sides, a cleared front line was followed by pursuit in 0.0117 battle seconds (one 60-fps simulation frame), with zero frames spent swinging at that cleared line. Rear damage landed at a physical 14-pixel contact gap, after the required march. A 0.149-second partial pursuit inflicted no rear damage. Neutral full-window infantry damage remains 104.

All **nine related local suites pass**: pursuit-siege, field-combat, melee-rebels, ranged-spill, tactics, duel-executions, siege, battle-end and density. The density suite verifies identical field-combat outcomes at Standard/Dense/Epic settings and a complete Epic siege. See the [regression log](../reports/pursuit-siege-regression.txt) and [actual rampart preview](../reports/siege-ramparts-preview.png).

Results are recorded in [pursuit/siege](../reports/pursuit-siege.json), [field combat](../reports/field-combat.json), [melee balance](../reports/melee-rebels.json) and [siege](../reports/siege.json). Browser automation uses local Chromium, not physical iPhone Safari; no device frame-rate claim is made.

Watch a weak infantry line break in front of gunners: the attackers should immediately run forward, then resume combat on contact. In a castle battle, both wall ranged corps should take casualties while sheltered melee remains untouched; after the wall defenders are gone, subsequent gunshots land on the gate while arrows rise over it into the courtyard.
