# Expanded recruit pool and rotating offers

`index.html` adds a finite procedural cast alongside the original 20 recruits: **32 workers and 16 fighters**, giving 68 later recruits in total. The six starting villagers and the original cast retain their existing campaign rolls, province rewards and identities.

Workers cover rice growing, crafting, hauling, woodcutting, trading and carpentry. All 32 keep a worker calling; four extra fighters serve each formation. Names, sex, hair, skin, facial traits, muted clothing, skills, learning thresholds, stats and C/B/A/S growth potential vary with the campaign seed. Stat variation is ±15% around modest existing-role profiles, and potential uses the existing distribution. Everyone arrives at level 1 through the normal recruitment system. No additional arrival frequency, free beds, automatic hires or stronger equipment is introduced.

## Where they appear

The expanded cast participates in normal monthly wanderers, Training Ground person prizes and worker milestones, crossroads/pledge events, camps, rebellion captives and retake rewards. Wanderers keep their existing five-month minimum interval, chance, house requirement and signing fee. The rebellion's guaranteed worker and its existing extra captive chances are preserved; the existing procedural artisan fallback still covers an exhausted cast.

A shared eligibility check excludes owned residents, queued recruits, pending hires, pledges, other camps' captives, retake captives and the current sparring recruit. Normal roaming offers also exclude castle reservations. Explicit early recruitment can still release a castle's worker through `releaseRecruit()`.

Selection no longer uses alphabetic ties for worker milestones or the same six-person wandering shortlist. A seeded rank varies with the offer counter, source and milestone/month. The last **12 offered or accepted people** receive lower priority, so declined people rotate out while fresh eligible candidates remain. Worker milestones still aim for better potential grades as the ladder progresses. The normal spar prize remains saved, and repeatedly reopening its card does not reroll it or advance the rotation. Accepting the same worker twice cannot duplicate a resident or housing-queue entry.

## Saves, art and performance

`G.recruitPool` stores only a generator version, seed, offer counter and at most 12 recent IDs. The 48 full definitions are regenerated deterministically and cached as one roster in memory. They are not copied into `G.roll.v`, so existing campaign RNG, names, stats and skills stay intact. `migrateRecruitPool()` initializes old v1 saves and sanitizes the bounded state in `afterLoad()`. Keep generator version 1 stable in future edits so an already recruited person does not change identity or skills.

`vBase()` resolves generated IDs through the same path used by the villager list, jobs, army, portraits and duels. `vLook()` includes the face seed in its identity signature so a new campaign cannot reuse an older campaign's cached look for the same generated slot. Actual equipped gear continues to control clothing, weapons, headwear and mounts.

Roster construction uses a local seeded PRNG and creates **zero canvases**. Characters render only when encountered, using the existing procedural modules and bounded art caches. No per-frame roster generation, AI scans or new UI panels are added.

## Validation

`tests/recruit-pool.cjs` covers all 48 identities, exact calling counts, six work specialties, face/hair variety, real skill progression, unchanged original villagers, rotation after refused offers, reservation conflicts, monthly arrivals, actual hiring, full housing/duplicate queues, event/rebellion integration, equipped rendering, saved identity/gear/stats, old-save migration and malformed state. It also checks the real mobile hire dialog and resident card with a long generated name.

The test seed produces 16 distinct candidates across 16 observed offers. Only the bounded seed/history state is saved; its measured size is recorded in `reports/recruit-pool.json`. Campaign, Training Ground, omens, equipment, resident recall, carry/duels, existing HP ledgers and logistics are covered by the related browser suites. Physical iPhone Safari performance is not measured by these local tests.

`tools/preview-recruit-pool.cjs` renders all 48 examples directly through the live village character renderer. It is a local review tool and is not loaded by the standalone game.

Recorded follow-up: all 12 related browser suites passed. The recruit suite passed 388 checks plus the actual mobile hire-button flow, found 16 distinct people across 16 observed offers, generated no canvases for the unused cast, and saved 160 bytes of pool metadata in its exercised campaign. The exported HTML was also checked directly through the recruit and Training Ground suites.
