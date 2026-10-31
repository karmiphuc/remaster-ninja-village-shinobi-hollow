# Logistics P0 validation

Source: `c7898ede1caf9d108f985b7c989a1a59d71867f2`. The production HTML in this PR is byte-for-byte the reviewed download. The follow-up commit changes documentation, recorded evidence, and test execution only.

The untouched-economy baseline was recorded before P0 behavior changes at `700f57c287a08d02321a7f86383aa4a9ca2436dc`. Ten scenarios each ran for 52 weeks across five paired seeds in Chromium and WebKit. Economy outcomes matched across engines; the real village, agents, save, and campaign data were restored after simulation.

| Scenario | Baseline gold / 52 weeks | P0 gold / 52 weeks | Change |
|---|---:|---:|---:|
| starter | 1116 | 1127 | 1.0% |
| small | 3847 | 3483 | -9.5% |
| mature | 6337 | 6486 | 2.4% |
| mature_2porters_same | 6592 | 7879 | 19.5% |
| mature_2porters_plus2 | 8318 | 10818 | 30.1% |
| early_duplicates | 1598 | 1511 | -5.4% |
| late | 14084 | 23969 | 70.2% |
| late_second_chain | 14707 | 28140 | 91.3% |
| late_duplicate_shops | 15745 | 24239 | 53.9% |
| demolish_and_roundtrip | 5915 | 6928 | 17.1% |

The baseline porter scenarios use an inert placeholder building and ordinary workers; porters did not exist in that version. Compare P0 mature with P0 mature_2porters_same to measure the same-headcount porter benefit: **21.5%** by mean income, **21.4%** across paired seed ratios.

Checks and measurements:

- Conservation residual, negative stock, and lost output: **zero** in all 50 runs per engine.
- Porters carried goods for **42.6%** of their time and were idle **6.1%**.
- Aggregate producer haul plus empty-walk time was **55.5% of baseline**. Moving two workers into porter roles contributes to this reduction; per producer, travel was **66.5% of baseline**, so the stricter per-person 60% interpretation remains a tuning item.
- Peak sampled canvas use: **20.3 MB**; economy collections: **341** maximum.
- Largest scenario save: **47.4 KB**; maximum recorded stringify time: **0.7 ms** on the CI runner.
- Focused checks cover manual assignments, local-only sales, source and shelf reservations, mixed carts, contract holds, overflow preservation, demolition, migration, and in-memory save/load.
- **96 procedural rig frames** matched the original renderer pixel for pixel after transparent margins were trimmed.
- Mobile DPR 2 changed 0.21% of pixels at default zoom; DPR 3 remains the default.

These memory and timing numbers come from the seeded scenario test, not a sustained physical iPhone profile. The attempted long stress fixture exceeded the named roster during setup and produced no usable long-run results. That runner and its CI step are deferred at the user’s request. A 15-minute late-save session, physical iPhone app switching, and Low Power Mode remain unverified.

P1 service capacity, turn-away, demand growth, contract scaling, and specialization are deferred. The duplicate-shop and late-expansion targets are not claimed complete.

## Review in the game

Build a Porter House under Industry, assign two workers, and watch mixed carts supply shops and workshops. Check local shop shelves, full-pile markers, and workers taking brief seated breaks while a full site waits for a carrier. Removing a destination or saving during a delivery must preserve its cargo.

![Porter House beside the existing Workshop and Storehouse](porter-house-preview.png)
