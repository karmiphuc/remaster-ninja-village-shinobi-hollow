# Commander highlights and battlefield heraldry

This is a battle-art change in the standalone `index.html`, built on merged PR #32. Damage, HP, skills, leadership values, formation geometry, casualty accounting, saves and village artwork remain unchanged.

## Friendly commanders

Friendly commanders retain a faint warm rim and a low, narrow wash beneath the normal grounded shadow. The rim uses 28% alpha and 0.45 logical pixels of display padding per side, down from an opaque one-pixel expansion. The smaller ground wash pulses gently. Existing attack, recovery, celebration and duel effects keep their original timing and behavior.

Enemy commanders receive neither the gray silhouette expansion nor the colored ground pool. Their native armor, face, clothing and equipment palettes remain intact. Name labels and transient combat effects still work.

## Enemy back standards

Every human enemy commander receives a separate heraldic standard, including small bands, Training Ground partners, auxiliaries, riders, commanders wearing horo, and HQ officers. Wild animals and companions do not wear commander flags.

- Captains carry a larger clan pennon with gold edging, the clan mon, formation emblem, ivory corner and forked tail.
- Vanguard officers use the same family with an extra gold crossbar.
- Lords and HQ commanders carry a gold war fan above a shorter hanging clan pennon.

These standards attach to the existing waist socket and follow the sprite's facing, footwork, horse and death pose. They also render in duels and remain with fallen bodies through the existing aftermath renderer. Ordinary troop flag distribution is unchanged: selective allied ranks, castle forces and large armies retain their existing issue rules. Small-band troops do not all acquire flags.

## Leadership decorations

Planted leadership nobori use a 61-pixel ground anchor/pole, compared with the ordinary formation standard's 31.5 pixels. Their broader cloth carries a larger mon and a fan motif. The Strategy skill still creates the same number of props at the same levels.

The jinmaku command curtain is now 70 logical pixels wide including outline, with tall wooden poles, finials, guy ropes, grounded support feet, cream cloth, clan-colored bands, restrained gold trim and a central mon. It uses the battle renderer's existing pixel scale, cloth shading, timber and heraldic palette. It is not a village building and adds no roof or building asset.

`prepareCommandDecorations()` runs during layout and resize. It warms the finite assets, keeps the larger decorations inside the world and below the header, and gives HQ officers room for their standards. Formation soldiers and front-line commanders retain their positions. During resize, leadership props follow the existing vertical field mapping. The larger curtain also receives enough horizontal culling margin to enter and leave the camera smoothly.

## Cache and memory

The shared heraldry LRU retains its 48-entry limit and adds an 8 MiB canvas-backing limit. Both limits release evicted canvases immediately. Static curtains use one canvas shared by their phase/facing aliases; planted leadership flags share their unused reverse facing. Back flags retain both facings and three wind phases.

New decoration descriptors are prepared once per prop. No extra per-frame search, DOM, shadow blur, gradient or physics system is introduced. The entire flag cache is released when the battle closes, so larger standards do not accumulate across campaigns or inflate the village's resting canvas memory.

## Validation and review

`tests/battle-heraldry.cjs` exercises real field, castle, dojo and skirmish sprites; rider, vanguard, lord, auxiliary and HQ flag policies; friendly rim draw alpha/padding; absence of enemy silhouette draws; warmed drawing without new canvases or combat RNG calls; unchanged HP/leadership/troops; fallen commander standards; the final-casualty banner collapse; LRU eviction and battle-close release. It also checks HUD/world clearance and unchanged formation positions at 430×932, 1280×820 and 844×390.

`tools/preview-command-heraldry.cjs` renders actual gear and decorations at matching scales, plus desktop/phone front and rear views. It accepts a standalone HTML path and a `COMMAND_PREVIEW_PREFIX` for before/after captures. Review PNGs are artifacts only; the game uses procedural drawing throughout. Local headless Chromium checks do not establish physical iPhone Safari frame rate.

Recorded local result: eight related suites passed across the focused art checks and combat regressions (battle-heraldry, density, siege, tactics, battle-end, duel-executions, duel-cavalry and animal-duels). The final exported HTML also passed the art and both weapon/cavalry execution suites, including the existing 120 HP-ledger cases. Heraldry checks record 119 assertions plus all three viewport checks, zero warmed per-frame canvas allocations, no enemy rim draws, and a 28% friendly rim.
