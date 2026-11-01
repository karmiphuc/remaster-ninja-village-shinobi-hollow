// Starting roads can be dug up to reshape the visitors' flow; only the last GATE_KEEP (3) tiles of road at each
// entrance, both lanes, stay. Travellers whose gate no longer reaches a shop come in by another gate, and the player
// is told when a removal cuts a gate off. The south approach used to be protected along its whole length.
// Writes reports/roads.json.
const fs = require('fs'), http = require('http'), assert = require('assert'), path = require('path'), { chromium } = require('playwright');
const dir = path.resolve(__dirname, '..');
const ignorable = t => /Failed to load resource: net::ERR_(TUNNEL_CONNECTION_FAILED|FAILED|NAME_NOT_RESOLVED|INTERNET_DISCONNECTED)/.test(t);
(async () => {
  const server = http.createServer((q, r) => { r.setHeader('Content-Type', 'text/html'); r.end(fs.readFileSync(dir + '/index.html')); });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH || (fs.existsSync('/usr/bin/chromium') ? '/usr/bin/chromium' : undefined), args: ['--no-sandbox'] });
  const errors = [];
  try {
    const p = await browser.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
    p.on('pageerror', e => errors.push(e.message)); p.on('console', m => { if (m.type() === 'error' && !ignorable(m.text())) errors.push(m.text()); });
    await p.addInitScript(() => { window.__noIntro = true; window.__noQuick = true; });
    await p.goto('http://127.0.0.1:' + server.address().port);
    // a new village with the south road and at least one more gate
    const setup = await p.evaluate(() => {
      for (let seed = 1; seed < 60; seed++) { Math.random = seeded(seed); newGame(); if (gates().length >= 2) break; }
      $('#title').hidden = true; resizeView(); afterLoad(); MQ.length = 0; $('#modal').hidden = true; G.speed = 0;
      window.__toasts = []; const t = window.toast; window.toast = m => { __toasts.push(String(m)); return t(m); };
      return { gates: gates().map(g => g.join(',')), cut: cutGates().length };
    });
    assert(setup.gates.length >= 2, 'No village with a second gate'); assert.strictEqual(setup.cut, 0, 'A gate starts cut off');
    // a real finger tap with the demolish tool on the south approach, mid-way up
    const tapTile = async (tx, ty) => {
      const pt = await p.evaluate(([tx, ty]) => { VIEW.cx = tx * 16 + 8; VIEW.cy = ty * 16 + 8; const s = VIEW.scale / VIEW.dpr, r = VIEW.cv.getBoundingClientRect();
        const wx = tx * 16 + 8, wy = ty * 16 + 8; return { x: r.left + (wx - VIEW.cx) * s + VIEW.w / 2, y: r.top + (wy - VIEW.cy) * s + VIEW.h / 2 }; }, [tx, ty]);
      await p.touchscreen.tap(pt.x, pt.y); await p.waitForTimeout(120);
    };
    await p.evaluate(() => setMode('demolish'));
    // the lowest row of the south approach on land a new village owns (further south is unbought South Bank)
    const sx = await p.evaluate(() => GATE[0]), sy = await p.evaluate(() => { for (let y = MAP_H - 1; y > 0; y--) { const b = roadEraseBox(GATE[0], y); if (b && b.w === 2 && [0, 1].every(j => [0, 1].every(i => tileOpen(b.x + i, b.y + j)))) return y; } return -1; });
    assert(sy > 0, 'No owned stretch of the south approach');
    // unbought land stays off limits, as it is for buildings
    const locked = await p.evaluate(() => { const y = MAP_H - 5; if (tileOpen(GATE[0], y)) return 'owned'; __toasts.length = 0; const ok = eraseRoad(GATE[0], y); return { refused: ok === false && !!G.roads[idx(GATE[0], y)], note: __toasts[0] }; });
    assert(locked === 'owned' || locked.refused && locked.note === 'Locked land', 'Unbought land: ' + JSON.stringify(locked));
    await tapTile(sx, sy);
    const r = await p.evaluate(([SY, LOCKED]) => {
      const check = (x, m) => { if (!x) throw Error(m); }, road = (x, y) => !!G.roads[idx(x, y)], out = {};
      const S = GATE[0], y0 = SY;
      check(!road(S, y0) && !road(S - 1, y0), 'Tapping the south approach did not remove it (both lanes)');
      out.southApproach = `removed at row ${y0} (owned land) by a real tap`;
      check(__toasts.some(t => /South gate no longer reaches a shop/.test(t)), 'No warning that the South gate is cut off: ' + JSON.stringify(__toasts));
      out.warning = __toasts[__toasts.length - 1];
      // own all the land, then: the last 3 tiles at the south gate stay; the tile just past them goes
      for (const k in LAND) G.land[k] = true;
      __toasts.length = 0; check(eraseRoad(S, MAP_H - 2) === false && road(S, MAP_H - 2) && road(S - 1, MAP_H - 2), 'A gate tile was removed');
      check(__toasts.some(t => /road at the gate stays/.test(t)), 'No note that the gate road stays');
      check(eraseRoad(S, MAP_H - 4) === true && !road(S, MAP_H - 4) && !road(S - 1, MAP_H - 4) && road(S, MAP_H - 3) && road(S - 1, MAP_H - 3), 'The tile next to the kept 3 was not removable, or the kept tile went with it');
      out.southGateKept = [MAP_H - 3, MAP_H - 2, MAP_H - 1].map(y => road(S - 1, y) && road(S, y));
      // the starting avenue goes too
      const ay = 11 + MAP_OY; check(eraseRoad(10 + MAP_OX, ay) && !road(10 + MAP_OX, ay), 'Avenue not removable'); out.avenue = 'removable';
      // every other gate keeps exactly its last 3 tiles
      out.otherGates = gates().filter(g => g[2] !== 'S').map(([gx, gy, sd]) => {
        const step = { W: [1, 0], E: [-1, 0], N: [0, 1] }[sd], lane = sd === 'N' ? [1, 0] : [0, 1];
        const at = k => [gx + step[0] * k, gy + step[1] * k], x4 = at(3)[0], y4 = at(3)[1], had4 = road(x4, y4);
        [0, 1, 2].forEach(k => eraseRoad(...at(k))); // the eraser takes 2x2 sections: next to the 3rd tile it may take the 4th
        const kept = [0, 1, 2].every(k => { const [x, y] = at(k); return road(x, y) && road(x + lane[0], y + lane[1]); });
        if (road(x4, y4)) eraseRoad(x4, y4); const gone = had4 ? !road(x4, y4) && !road(x4 + lane[0], y4 + lane[1]) : 'no road there';
        check(kept, `${sd} gate road not kept`); check(gone !== false, `${sd} road past the gate not removable`);
        return { side: sd, kept3: kept, fourthRemovable: gone };
      });
      out.unboughtLand = LOCKED;
      return out;
    }, [sy, locked]);
    // travellers: with the south approach cut, those who pick the south gate come in by a gate that still reaches a shop
    const trav = await p.evaluate(() => {
      // put back the roads the other-gate check removed, so one gate still reaches the shops; the south stays cut
      const check = (x, m) => { if (!x) throw Error(m); };
      gates().filter(g => g[2] !== 'S').forEach(([gx, gy, sd]) => { const step = { W: [1, 0], E: [-1, 0], N: [0, 1] }[sd], lane = sd === 'N' ? [1, 0] : [0, 1];
        for (let k = 0; k < 40; k++) { const x = gx + step[0] * k, y = gy + step[1] * k; if (!inMap(x, y)) break; if (G.roads[idx(x, y)] || k === 3) { G.roads[idx(x, y)] = 1; if (inMap(x + lane[0], y + lane[1])) G.roads[idx(x + lane[0], y + lane[1])] = 1; } } });
      for (let x = 8 + MAP_OX; x <= 21 + MAP_OX; x++) for (let y = 11 + MAP_OY; y <= 12 + MAP_OY; y++) G.roads[idx(x, y)] = 1; invalidateRoadTraffic();
      const cut = cutGates().map(g => g[2]); check(cut.includes('S') && cut.length < gates().length, 'Expected only the south gate cut: ' + cut);
      const S = gates().find(g => g[2] === 'S'), R = Math.random; let n0 = G.stats.trav, starts = [];
      const pk = window.pick; window.pick = a => a === G.gates ? S : pk(a); // every traveller picks the south gate
      try { for (let i = 0; i < 20; i++) { const before = RT.agents.length; spawnTraveller(); const a = RT.agents[RT.agents.length - 1]; if (RT.agents.length > before && a && a.kind === 'trav' && !a.dead) starts.push(Math.round(a.x / 16) + ',' + Math.round(a.y / 16)); } }
      finally { window.pick = pk; Math.random = R; }
      const came = G.stats.trav - n0; check(came === 20, `Only ${came} of 20 travellers who chose the cut South gate arrived`);
      return { cutGates: cut, picked: 'South (cut)', arrived: came, enteredAt: [...new Set(starts)].slice(0, 4) };
    });
    assert.deepStrictEqual(errors, []);
    const report = { ...r, travellers: trav, errors };
    fs.mkdirSync(dir + '/reports', { recursive: true }); fs.writeFileSync(dir + '/reports/roads.json', JSON.stringify(report, null, 2));
    console.log(JSON.stringify(report, null, 2));
  } finally { await browser.close(); server.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
