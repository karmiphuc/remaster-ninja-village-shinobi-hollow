# Seasonal village landscape

The existing calendar now changes the village landscape without changing production, travel, placement or combat. The artwork stays procedural inside `index.html`; the PNGs below are review sheets, not runtime assets.

- **Spring:** the established green ground and pink sakura, with falling petals.
- **Summer:** leafy green sakura, short passing showers separated by longer dry spells, and occasional translucent ivory clouds. Rain fades in and out rather than switching abruptly.
- **Autumn:** golden/ochre trees, copper-gold sakura and tawny grass, with a few falling leaves. Fields, gardens, bamboo and the wisteria trellis use the same seasonal palette.
- **Winter:** white snow, pale worn dirt and stone paths, sparse snowfall, bare trees and solid blue ice. Sakura has a broad forked crown, rose-brown bark and dormant tips; the other tree has a taller, narrower branch pattern. Decorative ponds and garden ponds lose their fish/lily-pad artwork under the ice. The map's rivers and lakes freeze visually too.

The existing `pine` asset deliberately follows the requested bare-branch winter treatment. This is a stylized seasonal choice rather than a botanical evergreen model. Frozen water remains water for navigation and construction. Fields continue working normally.

## Integration

| Function / data | Change |
|---|---|
| `treePB`, `winterTreePB` | Native pixel palettes and distinct bare-tree silhouettes; original footprints and anchors |
| `SEASON_ART`, `buildSeasonalArt` | Finite four-season terrain, road and nature variants, plus three cloud sprites; generated once at boot |
| `x5Teien`, `x5Fujidana` | Winter pond ice and dormant trellis; optional season parameter preserves original default sprites |
| `rebuildGround`, `drawVillage` | Cached seasonal ground, shoreline snow, frozen water, seasonal nature sprites; buildings retain their established art |
| `updateVillageWeather`, `drawSeason` | Reusable particle/cloud pools, private seeded randomness and dt-driven movement |
| `bThumb`, `movingBuildingSprite`, `openBuildingInfo`, `worksiteInfoSprite` | Matching seasonal previews, with assigned field tools preserved |
| `afterLoad`, `perfCacheSizes`, `perfCollections` | Initialize transient weather after load and include the bounded art/pools in diagnostics |

The calendar remains Spring months 1–3, Summer 4–6, Autumn 7–9, Winter 10–12. Ground redraws once when the season changes. Building definitions, collision maps, road topology, left-hand traffic, stock accounting and save version `G.v === 1` are unchanged. No migration or new saved fields are required; weather lives only in `RT`.

## Performance and validation

All variants are pre-rendered at native pixel size. The registry references 508 unique canvases, mostly tiny terrain/road tiles and including shared original sprites. Nothing grows with years, coordinates or weather events. Spring and summer reuse the original terrain/road canvases. Weather reuses 140 particle records and three cloud slots; each season draws only its active subset. No canvas is created in a weather draw or warmed season switch. Cosmetic ambience uses real elapsed time, as the previous ambience did, including while the village is paused.

The focused mobile-viewport Chromium check (`node tests/seasonal-landscape.cjs`) passed 23 assertions:

| Check | Result |
|---|---|
| 120 season changes and renders | 0 new canvases; tracked canvas memory 11.676 → 11.676 MB |
| Four-minute seeded summer at 30 and 60 fps | Same 5 showers / 5 dry breaks; about 29.8% wet time |
| Weather randomness | No calls to gameplay `Math.random` |
| Four-season UI thumbnail repetition | Plateau at 32 keys for the eight tested types |
| Rendering and save compatibility | Map, roads, building occupancy and gameplay JSON unchanged; version-1 winter save reloads |
| Ice | Static winter artwork; remains blocked for construction and road placement |

Results: [seasonal-landscape.json](../reports/seasonal-landscape.json). The focused suite is included in `npm test`. Export verification uses `SEASON_DOWNLOAD="/path/Shinobi Hollow.html" node tests/seasonal-landscape.cjs` and serves the supplied file locally.

The complete local browser regression passed **20/20 suites**, covering battles, equipment, campaign, dialogs, road traffic, hauling/crafting, collectors, shelves, building moves, forging and save compatibility. The byte-identical exported `Shinobi Hollow.html` also passed the 23 focused seasonal checks.

Physical iPhone/Safari performance has not been measured here. The managed browser blocks direct `file://` navigation, so the byte-identical standalone export is checked over local HTTP. The game adds no external art dependencies or build requirement.

## Visual review

- [Four-season village comparison](seasonal-village-preview.png): the same layout, including assigned fields, the Porter House/cart, pond, garden and river. The summer panel deliberately shows a shower and passing clouds.
- [Nature asset comparison](seasonal-assets-preview.png): summer, autumn and winter trees, bamboo and pond at readable scale.

Regenerate both with `node tools/preview-seasons.cjs [optional HTML path]`. In play, look for green sakura and intermittent showers in summer, a gold landscape in autumn, then distinct bare trees, pale paths and solid ice in winter. Season changes happen on the normal quarter boundaries; there is no new UI or weather penalty.
