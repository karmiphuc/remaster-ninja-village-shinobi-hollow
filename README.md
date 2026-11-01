# Shinobi Hollow

A pixel-art village-builder and strategy game set in Akitsu, a fictional island realm. The Shogun has fallen, the clans are at war, and you command a small hidden village. Grow rice, sell to travellers, raise an army, then march on the provinces. You must unify the islands before a deadline set at the start of each game (20–30 years).

The whole game is one self-contained HTML file. It has no build step, no server and no dependencies beyond an optional web font.

**Play:** https://karmiphuc.github.io/remaster-ninja-village-shinobi-hollow/

## Playing

- **Title screen:** *New Game*, *Continue* (shown only when a save exists), and *Warrior Atelier* (a viewer for the warrior art).
- **Main menu (bottom bar):** Build · Villagers · Army · Armory · Campaign · Village.
- **Top bar:** date (year, season, month, week), village appeal and star rating, population, coin, and time controls (pause, play, fast-forward, music).
- **Input:** mouse, touch and scroll wheel. It works on desktop and phone-sized screens. In the Warrior Atelier, `Esc` closes the panel and `Tab` cycles focus.
- **Dialogs:** a dialog never grows past the screen; its content scrolls. The dialogs you click straight through (the New Game campaign hand, the Year in review, duels, hunts and the battle deployment) have their buttons at the top as well as the bottom, and any other dialog too tall for the screen gets the top row too.

## Battlefield density and formations

- **Battle density** (Village → Options, saved per device): **Standard** 25, **Dense** 36 (default) or **Epic** 48 soldiers at most per formation.
  - At the start of each battle one soldier stands for a fixed number of men, so the largest formation fills the cap and smaller ones look smaller.
  - Troop numbers, casualties and combat results are the same at every setting. The tests run the same seeded battle at all three and compare every blow.
- **Formations** stand in even, deterministic ranks spread over about 88% of the room between the HUD and the bottom of the screen, safe area included. The lines of men one behind another stand 1.75 body widths apart (body measured from the sprites, weapon left out), so each line's weapons show clear of the line in front; the ranks keep their close order down the field. When a big army needs it, the battlefield widens (up to about 3× its old width) and the camera pans further. Ranks keep their shape at rest and re-form after each clash. Charges, duels, casualties and routs still break them up for a moment.
  - Infantry: tight ranks.
  - Gunners: straight firing lines.
  - Archers: staggered ranks.
  - Cavalry: wider ranks.
- **Sizing:** rows, files, spacing and sprite size (0.85–1.25×) adapt to the screen. Only past the widest field do the files close up. On resize, the ranks refit to the new room; on a shorter screen they close up until the next battle.
- **Commanders and banners:** commanders take places in the front file, and their guards stand just ahead of it rather than on the ranks. Back-flags are carried by whole ranks, so they line up.
- **Drawing:** each formation's rank and file share a few looks (3–5), so sprite art stays bounded at Epic: about 35–40 sprite sets per battle at any density.

## Castle sieges

- **While the gate stands:**
  - Your infantry ram it and your cavalry hack at it; they never strike the troops sheltered behind it.
  - The defenders' infantry and cavalry hold the walls and don't attack.
  - Archers and gunners on both sides keep trading volleys.
  - Commanders can still be called out to duel.
- **When the gate falls:** the breach plays out, the rest of that round is skipped, and open combat starts again at **Round 1** with the survivors. Casualties, commanders' wounds and KOs, and Ki carry over.
- **Siege engines** (research the *Siege Battery* in the Armory) are bought one at a time in the pre-battle deployment panel, for that siege only:

  | Engine | Max | Each purchase | Role |
  |---|---|---|---|
  | Bombard (大筒) | 2 | 4,000G, then 5,000G | Batters the gate only: each takes 20% of its strength off every round. |
  | Hwacha (火車) | 4 | 2,000 / 2,500 / 3,000 / 3,500G | Sweeps defenders exposed on the ramparts (their gunners and archers) only, never the gate. Each extra cart adds less: ×1, ×0.6, ×0.4, ×0.25. |

  Any engine can be sent back for a full refund until you order the attack (withdrawing refunds them all). Engines fire once a round while the gate stands and fall silent after the breach; a ball still in flight when the gate falls strikes nothing. Defenders never field engines.

## Wooden Tate (盾) for Gunners

- **Unlock:** conquer **Yamashiro Castle**, next to your home valley. Saves that already hold Yamashiro get it automatically.
- **Buying:** Army → Gunners (tap the gear row) → **Defensive Support**.
  - Each Tate covers 10 Gunners and costs 40G + 4 Timber. No forging, upkeep or durability.
  - The panel shows Tate owned / needed, coverage, protection, attack penalty, missing Tate and their cost.
  - **Buy / Replenish** buys exactly the missing Tate at the same price (or as many as you can afford). Coverage never goes above 100%.
- **In battle:** at full coverage your Gunners take 20% fewer arrow casualties and deal 8% less damage; both scale with coverage and multiply with every other defence. Bullets, melee, cavalry and ninjutsu ignore the Tate. Wooden pavises stand in front of the Gunner line, one per covered row.
- **Losses:** every 10 Gunners actually killed breaks one Tate.
  - Wounded who return and men who fled don't count. Fled men are told apart using the battle's own record of who fell and who fled.
  - The remainder carries to the next battle: 27 killed breaks 2 and carries 7.
  - Nothing is restored for free.
- **The AI:** armies in the field get 5% coverage per clan victory, up to 50%, under the same rules. Castle garrisons never get Tate (they have walls), and neither do the dojo's partners.

## The map: provinces, the dojo and uprisings

- **Winning the map:** 49 provinces can be held (41 clan castles, 7 bandit lairs and your home village). The **Training Ground** dojo is sparred at, never taken, so it does not count; the map and the Ledger show *held / 49*. The war ends when you take the Shogun's keep.
- **Dojo prizes:** each spar puts up one prize, shown on the dojo's map card before you fight. A win takes it, plus 120G:
  - recruits of a random arm you have unlocked (8% of your troops, at least 10);
  - your latest researched armor or horse;
  - a free commander or worker.
  Bigger prizes bring stronger sparring partners. A recruits prize matches the old dojo's difficulty; armor or a horse brings partners 20% stronger, and a person 40% stronger. A loss still sends a few recruits home with you, and nobody is ever lost. A new prize is rolled after every spar.
- **Uprisings:** when rebels throw out your governor, the province falls back to its clan.
  - Lairs and other non-castle sites come back as strong as the uprising that took them, plus 20%. Castles keep their own strength.
  - Its spoils are rolled afresh: 1–2 pieces of gear, and often a commander or worker (one of the uprising's captives when it held any). The map card shows them.
  - The province's one-time rewards (deeds, unlocks, buildings, its named item and recruit) are not granted again.

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
- **Focus is a priority, not a limit.** A forge whose focus is already covered (say, every Gunner carries your best gun) makes the other job instead of resting. The forge panel says so, and the Army screen's rates and time to full coverage count it.
- **Materials set the pace.** Each set uses the gear's usual gold and an eighth of its materials. Top armor and helmets need Silk: Ginryū Gusoku 1.75 a set, Eboshi-nari Kabuto 1. A short material is shared between formations in proportion to their forges' monthly output (260 sets of Gunner forges get 6.5× the Silk of a 40-set forge). When a material runs out mid-month, the forging message says *stopped short of …*.
- **Visible upgrades:** Level 1 has an open furnace; Levels 2 and 3 add one and two roof chimneys. Formation displays and the red weapon / green armor banners remain visible. See the [procedural level preview](docs/forge-upgrades-preview.png).
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
| `tests/` | Browser checks for equipment effects, research, saves, portraits, formation tactics, Ki, army forging, the campaign hand, logistics, the province count, dojo prizes, uprisings, Wooden Tate, sieges, battle density and mobile layout |
| `reports/` | Recorded validation results |

## Current version: v19.1 + Logistics P0

Includes the compact battle HUD, independent hero formations, physically delivered shop stock, guaranteed worker-calling rebellion captives, and the specialist arsenal. The three-shot rifle uses a one-over-two triangular barrel cluster. See [equipment notes](docs/equipment-v19.1.txt) and the [procedural preview](docs/arsenal-v19.1.png).

Logistics P0 adds the **Porter House** (荷運び小屋) under **Build → Fields & Work**, beside the Storehouse. It costs 240G. Assign up to two workers manually; vacancies never auto-fill. Porters collect harvests, supply artisans, and bundle goods on shared trips to local shop shelves. Ordinary workers can still haul without porters. Full piles pause further work and retain completed output in a counted buffer.

Village economy flow lets workers and porters cross fields, Storehouses and Workshops **between road sections**. Other buildings remain obstacles, and visitors keep using roads. Workshops automatically craft useful batches of **1–5**, prioritising Ton'ya orders, shop shortages, the preferred recipe and other useful wares. Every product uses its full recipe: **10 Rice → 5 Mochi Boxes**. Work and Fine Craft improve cycle efficiency.

Porters can combine deliveries to **two shops from one pickup**, within their existing 31-unit load and a small route-detour allowance. Each stop receives its reserved goods; leftovers return to storage. Input/output reservations protect concurrent workers, and old version-1 saves retain their goods. See the [implementation and validation notes](docs/village-economy-flow.md). Run the focused browser checks with `node tests/economy-flow.cjs`.

The **Clan Hall** (the clan seat) has **Shop material sales** controls: pause all raw materials or toggle Rice, Daikon, Tea Leaf, Timber, Iron Ore and Silk individually. Paused shops stop raw selling and restocking; workers and porters physically return existing raw shelf stock to storage. Crafted wares, workshop ingredients and Ton'ya orders continue normally. A shop's mixed raw recipe pauses when any ingredient is disabled.

**Move buildings:** use **Move** beside the Build menu's Demolish tool, or beside Remove in a building's details. Moving immediately pauses the game. Select a building, tap its new footprint, then tap **Move** or tap that spot again. Moving is free and keeps upgrades, renovation progress, worker/resident assignments, recipes, stock and paid collector hires. **Cancel** leaves the original in place. Both completion and cancellation stay paused until you press Play. The Clan Hall can move; the travelling merchant stays fixed. Normal terrain, roads and unlocked-land placement rules still apply. See [relocation checks](docs/building-move.md).

Open a **Storehouse → Part-time collectors** to pay **500G total for five weekly rounds**, starting next week. Temporary carriers collect available piles from all connected raw-material worksites, including Lumber Yards, Mines and Silk Huts, and return to the hired Storehouse. They reuse visitor artwork, need no housing or assignment, and do not count as customers. Large rounds dispatch gradually, with at most eight collectors village-wide. See [design and validation](docs/market-collectors.md); run `node tests/market-collectors.cjs` for focused checks.

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
