# Shinobi Hollow

A pixel-art village-builder and strategy game set in Akitsu, a fictional island realm. The Shogun has fallen, the clans are at war, and you command a small hidden village. Grow rice, sell to travellers, raise an army, then march on the provinces. You must unify the islands before the deadline (20 years, per the opening briefing).

The whole game is one self-contained HTML file. It has no build step, no server and no dependencies beyond an optional web font.

**Play:** https://karmiphuc.github.io/remaster-ninja-village-shinobi-hollow/

## Playing

- **Title screen:** *New Game*, *Continue* (shown only when a save exists), and *Warrior Atelier* (a viewer for the warrior art).
- **Main menu (bottom bar):** Build · Villagers · Army · Armory · Campaign · Village.
- **Top bar:** date (year, season, month, week), village appeal and star rating, population, coin, and time controls (pause, play, fast-forward, music).
- **Input:** mouse, touch and scroll wheel. It works on desktop and phone-sized screens. In the Warrior Atelier, `Esc` closes the panel and `Tab` cycles focus.

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
