# Shinobi Hollow

A pixel-art village-builder and strategy game set in Akitsu, a fictional island realm. The Shogun has fallen, the clans are at war, and you command a small hidden village. Grow rice, sell to travellers, raise an army, then march on the provinces. You must unify the islands before a deadline set at the start of each game (20–30 years).

The whole game is one self-contained HTML file. It has no build step, no server and no dependencies beyond an optional web font.

**Play:** https://karmiphuc.github.io/remaster-ninja-village-shinobi-hollow/

## Playing

- **Title screen:** *New Game*, *Continue* (shown only when a save exists), and *Warrior Atelier* (a viewer for the warrior art).
- **Main menu (bottom bar):** Build · Villagers · Army · Armory · Campaign · Village.
- **Top bar:** date (year, season, month, week), village appeal and star rating, population, coin, and time controls (pause, play, fast-forward, music).
- **Input:** mouse, touch and scroll wheel. It works on desktop and phone-sized screens. In the Warrior Atelier, `Esc` closes the panel and `Tab` cycles focus.

## Battles: formation tactics and ninjutsu

Battles are prepared, not micromanaged. Everything is set in the **Army** screen, and once you press *Attack!* the rounds play out without pausing. *Retreat* and speed stay on the battle bar, and a retreat takes effect at the end of the current round.

**Formation tactics.** Each formation (Infantry, Archers, Gunners, Cavalry) takes its own orders. How many orders it can take depends on the highest Strategy among its own active commanders. Formations never share Strategy.

| Strategy | Orders |
|---|---|
| 0 | None. The formation fights in its default formation. |
| 1 | One order for Rounds 1–3 |
| 2 | Round 1, then one order for Rounds 2–3 |
| 3+ | Rounds 1, 2 and 3 set separately |

Rounds after the third keep the last order. Each order belongs to a family with a fixed trade-off, and the families counter each other: Defensive beats Aggressive, Aggressive beats Precise, Precise beats Defensive. A formation whose order beats the enemy's deals +15%, plus 2% per Strategy level above 1. The enemy forms one army-wide order each round.

| Family | Damage dealt | Damage taken | Infantry | Archers | Gunners | Cavalry |
|---|---|---|---|---|---|---|
| Steady | — | — | Hold Line | | Controlled Fire | |
| Aggressive | +15% | +20% | Aggressive Assault | Rapid Fire | | Full Charge |
| Precise | +5% | +5% | | Aimed Volley | Focused Fire | Flanking Attack |
| Defensive | −20% | −15% | Spear Wall | Harassment | Suppressive Volley | Defensive Reserve |

At the start of Round 3, each formation led by an active strategist rolls once, with a 20% × Strategy level chance (Lv5: certain), to switch to an order that beats the enemy's.

**Ninjutsu and Ki.** Ki is banked between battles. It recovers 1 each game month, up to a capacity of 1 plus smoke pouches, the Shadow skill, monkeys and the Shadow School doctrine, with a hard maximum of 3. Pick a preferred ninjutsu and turn on *Auto-cast*, and it is cast once per battle at a useful moment, provided enough Ki is banked and your share of the two armies' combined strength is between 33% and 67%. That window means Ki is also spent when you are the stronger side, to save troops. With Auto-cast off, Ki only accumulates.

## Army forging

Each formation forge (Training) makes its own sets of your **best researched gear** every month, for one focus: **Weapons**, or **Armor & helmets** (one set each).

| Forge level | Sets a month | Upgrade cost |
|---|---|---|
| 1 | 40 | (build cost) |
| 2 | 65 | 2× build cost + 20 Wood + 20 Ore, 2 weeks |
| 3 | 90 | 4× build cost + 40 Wood + 40 Ore, 3 weeks |

- **Output adds up.** Five Level 1 Gunner forges on armor make 200 sets a month and fully equip 1,000 Gunners with top armor and helmets in 10 months. At Level 3 it takes 5.
- **A forge keeps working while carpenters upgrade it.**
- **Forges add quantity, never quality.** Every set costs its usual gold and materials, and stops before the treasury drops below 150G.
- **The village smiths add a small shared trickle on top**, split between formations: 20 a month, +30 per Smithy, +12 per Iron Mine.
- **Forges only fill missing top-tier coverage.** Once every soldier carries the best researched gear they stop spending, and start again when research unlocks something better.
- **Older and higher-quality gear stays in service** until it is replaced.
- **Where to see it:** the Army screen shows each formation's coverage and forge rate. Each forge shows its level, output, time to full coverage and upgrade cost.

## The campaign hand

Every new game deals a forced hand of three cards: a **House Doctrine**, a **Hardship** (or a two-sided **Twist**), and one more **Omen**, which can be a hardship, a twist or a blessing. You can redraw the whole hand once, then it stands. A reload does not buy another redraw. The hand is listed under *Campaign* in the Village panel.

**Doctrines (7):** Spear Lords, Gunpowder House, Horse Clans, Shrine Archers, Merchant House, Shadow School, Rice Barons.

| Omen | Kind | Effect |
|---|---|---|
| 呪 Cursed Market | Hardship | One random shop sells at −50% |
| 槍 Lost Spear Scrolls | Hardship | Spears cannot be researched |
| 刀 Lost Sword Scrolls | Hardship | Swords cannot be researched |
| 馬 Barren Pastures | Hardship | Horse gear cannot be researched (the Horse Corps stays open) |
| 枯 Blight | Hardship | One random field, grove, lumber yard, mine or silk hut type yields −40% |
| 期 Short Mandate | Hardship | Deadline 4 years sooner (never before Year 16) |
| 鉄 Iron Famine | Hardship | Armour and helmets, and their research, +40% gold |
| 税 Heavy Tithe | Hardship | Army upkeep +25% |
| 覇 Shogunate Ascendant | Hardship | Rival castles +12% strength |
| 匪 Lawless Coasts | Hardship | Roaming bandit, pirate and rōnin camps ×2–3 strength (same spoils) |
| 泥 Washed-out Roads | Hardship | Marches take twice as long |
| 道 Proud Masters | Hardship | Dojo lessons ×3–5 fee |
| 狭 Cramped Homes | Hardship | Every home houses 1 fewer (never below 1) |
| 褪 Faded Gardens | Hardship | Each decoration gives 1 point less boost |
| 巻 Costly Scrolls | Hardship | Research ×1.5–2 gold (same time) |
| 隊 Long Caravans | Twist | Contracts run 2× longer and pay 2× per week |
| 師 Wandering Sensei | Blessing | Research −25% gold |
| 絹 Silk Road | Blessing | One random shop sells +40% |
| 乱 Divided Daimyō | Blessing | Rival castles −10% strength |
| 豊 Bountiful Land | Blessing | Harvests +15% |

Sealed gear can still be bought, won as a reward or looted. No hand seals two lines, pairs Horse Clans with Barren Pastures, puts Silk Road on the cursed shop, or deals Ascendant with Divided Daimyō, or Costly Scrolls with the Sensei. Saves from before this change keep their doctrine and get no omens.

## Saving

Progress is saved to your browser's `localStorage` under the key `shinobi-hollow-v1`. It saves automatically:

- every 3 in-game months,
- after a campaign battle resolves,
- when you switch tabs, minimise, or close the page.

You can also save manually from the options panel. Saves stay in the browser and on the device where you played. Clearing site data or using a private window loses them.

## Running locally

Open `index.html` in any modern browser. To match how it behaves on the web, you can serve the folder instead:

```sh
python3 -m http.server 8000
# then open http://localhost:8000/
```

## Deployment

The game is served by GitHub Pages straight from the `main` branch root (`/`), with `index.html` as the entry point. Pushing to `main` redeploys it.

## Project layout

| File | Purpose |
|---|---|
| `index.html` | The complete game: markup, styles, script, sprites and audio (audio is embedded as data URIs) |
| `README.md` | This file |
| `docs/` | Equipment notes, [village art direction](docs/ART_DIRECTION.md), and previews rendered from the procedural game assets |
| `tests/` | Browser checks for equipment effects, research, saves, portraits, formation tactics, Ki, army forging, the campaign hand, logistics and mobile layout |
| `reports/` | Recorded validation results |

## Current version: v19.1 + Logistics P0

Includes the compact battle HUD, independent hero formations, physically delivered shop stock, guaranteed worker-calling rebellion captives, and the specialist arsenal. The three-shot rifle uses a one-over-two triangular barrel cluster. See [equipment notes](docs/equipment-v19.1.txt) and the [procedural preview](docs/arsenal-v19.1.png).

Logistics P0 adds the **Porter House** (荷運び小屋) under **Build → Fields & Work**, beside the Storehouse. It costs 240G. Assign up to two workers manually; vacancies never auto-fill. Porters collect harvests, supply artisans, and bundle goods on shared trips to local shop shelves. Ordinary workers can still haul without porters. Full piles pause further work and retain completed output in a counted buffer.

The Lumber Yard, Iron Mine and Porter House use the established village pixel scale, dark outlines, warm timber and shared shading. The Porter House has a permanent wheelbarrow in front. See the [art direction guide](docs/ART_DIRECTION.md) and [procedural comparison sheet](docs/porter-house-preview.png). Roofs are optional for future buildings; consistency comes from the rendering language and materials.

Saved games keep version 1. Existing local shop stock migrates without losing goods. Procedural artwork is preserved; bounded sprite caches, trimmed transparent margins, and releasing previews reduce canvas memory. See the [design note](docs/logistics-p0-design.txt) and [recorded validation](docs/logistics-p0-validation.md).

Optional diagnostics are off by default: use `?perf=1` or hold the date for two seconds. The seeded economy test is available manually in that panel or through `?simtest=1`. Regular CI runs functional checks; the full economy suite is manual. Long stress sessions and physical iPhone app-switch/Low Power Mode checks are deferred. P1 demand and service-capacity changes are outside this update.

Run the browser checks with `npm install`, `npx playwright install chromium`, then `npm test`. It runs every suite in parallel and prints one pass/fail line with timing per suite, plus the full output of any suite that fails. Name suites to run only those (`node tests/run-all.cjs tactics omens`), and set `TEST_JOBS` to cap how many run at once (default: CPU cores, at most 4). Set `CHROMIUM_PATH` to use an existing Chromium executable. The game itself has no installation or build requirement.

## Technical notes

- **Rendering:** HTML5 canvas, pixel art.
- **Audio:** Web Audio API. Music and sound effects can each be toggled, and those settings persist in `localStorage` (`sh-mus`, `sh-sfx`).
- **Network:** the only external requests are to Google Fonts. If they fail, the game still loads and falls back to system fonts.
- **Origin:** the game was built as a Claude artifact. It contains optional hooks for that runtime (`window.claude.hot`) that are skipped automatically everywhere else. No changes were needed to run it standalone.

## Testing

Verified on 2026-10-31 in headless Chrome at 1280×800 and 390×844, served from file and over HTTP:

- the title screen renders and *New Game* starts a game;
- there are no page errors (the only console error was a deliberately blocked font request);
- leaving the page writes a save, and on reload *Continue* appears and resumes the game.
