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
| `docs/` | Equipment notes and previews rendered from the procedural game assets |
| `tests/` | Browser checks for equipment effects, research, saves, portraits, formation tactics, Ki and mobile layout |
| `reports/` | Recorded validation results |

## Current version: v19.1

Includes the compact battle HUD, independent hero formations, physically delivered shop stock, guaranteed worker-calling rebellion captives, and the specialist arsenal. The three-shot rifle uses a one-over-two triangular barrel cluster. See [equipment notes](docs/equipment-v19.1.txt) and the [procedural preview](docs/arsenal-v19.1.png).

Run the browser checks with `npm install`, `npx playwright install chromium`, then `npm test`. Set `CHROMIUM_PATH` to use an existing Chromium executable. The game itself has no installation or build requirement.

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
