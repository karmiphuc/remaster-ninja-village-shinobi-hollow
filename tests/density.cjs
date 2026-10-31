// Battle density and formation layout: the Standard 25 / Dense 36 / Epic 48 setting (default Dense, per device), the
// representative troops per soldier, ranks spread over ~88% of the room between the HUD and the bottom safe area,
// deterministic even ranks with per-arm identities, captains and guards clear of the rank and file, casualties
// thinning the soldiers shown, bounded sprite art, identical combat at every density, sieges, formation mixes,
// resizing and frame cost. Writes reports/density.json.
const fs = require('fs'), http = require('http'), assert = require('assert'), path = require('path'), { chromium } = require('playwright');
const dir = path.resolve(__dirname, '..');
const ignorable = t => /Failed to load resource: net::ERR_(TUNNEL_CONNECTION_FAILED|FAILED|NAME_NOT_RESOLVED|INTERNET_DISCONNECTED)/.test(t);
(async () => {
  const server = http.createServer((q, r) => { r.setHeader('Content-Type', 'text/html'); r.end(fs.readFileSync(dir + '/index.html')); });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH || (fs.existsSync('/usr/bin/chromium') ? '/usr/bin/chromium' : undefined), args: ['--no-sandbox'] });
  const report = {}, errors = [];
  try {
    const page = async (w, h) => { const p = await browser.newPage({ viewport: { width: w, height: h } });
      p.on('pageerror', e => errors.push(e.message)); p.on('console', m => { if (m.type() === 'error' && !ignorable(m.text())) errors.push(m.text()); });
      await p.addInitScript(() => { window.__noIntro = true; window.__noQuick = true; });
      await p.goto('http://127.0.0.1:' + server.address().port);
      await p.evaluate(() => {
        window.check = (x, m) => { if (!x) throw Error(m); };
        window.clearModals = () => { MQ.length = 0; $('#modal').hidden = true; };
        window.seeded = s => () => (s = (s * 16807) % 2147483647) / 2147483647;
        window.fresh = (troops) => { newGame(); G.tut = 1; G.speed = 0; G.boons.pending = null; G.roll.v = false; $('#title').hidden = true; resizeView(); afterLoad(); clearModals();
          ['arc', 'gun', 'cav'].forEach(t => { G.researched['corps_' + t] = 1; G.units[t] = true; });
          G.villagers.forEach((v, i) => { v.role = ['inf', 'inf', 'cav', 'gun', 'arc', 'inf'][i] || 'work'; delete v.hp; }); G.allHands = false;
          G.troops = Object.assign({ inf: 0, arc: 0, gun: 0, cav: 0 }, troops || { inf: 2000, arc: 1000, gun: 1200, cav: 800 }); G.ki = 0; };
        window.hudLimit = () => { const r = $('#battle-cv').getBoundingClientRect(); let hud = 0; for (const id of ['#bhud', '#bformations']) { const b = $(id).getBoundingClientRect(); if (b.height > 0) hud = Math.max(hud, (b.bottom - r.top) / BT.S); } return hud; };
        // what a formation looks like at rest: fill of the band, spacing, files and the gap to the next block
        window.formStats = si => { const B = BT.band; return BT.A[si].groups.filter(g => !g.heroOnly && g.spr.length).map(g => {
          const T = g.spr.filter(s => s.alive), ys = T.map(s => s.sy).concat((g.heroes || []).filter(h => !h.out).map(h => h.sy)), xs = T.map(s => s.sx);
          let sep = 1e9; for (let i = 0; i < T.length; i++) for (let j = i + 1; j < T.length; j++) sep = Math.min(sep, Math.hypot(T[i].sx - T[j].sx, T[i].sy - T[j].sy));
          return { type: g.type, n: T.length, heroes: (g.heroes || []).length, R: g.R, rowStep: +g.rowStep.toFixed(2), colStep: +g.colStep.toFixed(2), fill: (Math.max(...ys) - Math.min(...ys)) / (B.y1 - B.y0),
            top: Math.min(...ys), bottom: Math.max(...ys), xMin: Math.min(...xs, ...(g.heroes || []).map(h => h.sx)), xMax: Math.max(...xs, ...(g.heroes || []).map(h => h.sx)), sep: +sep.toFixed(2), g }; }); };
      });
      return p; };

    // ---------- the setting ----------
    let p = await page(1280, 800);
    report.setting = await p.evaluate(() => {
      try { localStorage.removeItem('sh-density'); } catch (e) { }
      check(densityKey() === 'dense' && DENSITY.dense.n === 36 && DENSITY.standard.n === 25 && DENSITY.epic.n === 48, 'Defaults');
      fresh(); openPanel('menu'); UI.tab = 'opts'; refreshSheet();
      const btn = k => $(`#sh-body [data-dens="${k}"]`); check(btn('dense').classList.contains('gold') && btn('epic') && btn('standard'), 'Options buttons');
      btn('epic').click(); clearModals(); check(localStorage.getItem('sh-density') === 'epic' && densityKey() === 'epic' && $(`#sh-body [data-dens="epic"]`).classList.contains('gold'), 'Epic not kept');
      closeSheet(); check(startBattle('hoshi') && BT.maxVis === 48 && BT.density === 'epic', 'Battle ignores the setting'); closeBattle(); clearModals();
      fresh(); G.troops = { inf: 2000, arc: 1000, gun: 1200, cav: 800 }; setDensity('standard'); check(startBattle('hoshi') && BT.maxVis === 25, 'Standard'); closeBattle(); clearModals(); setDensity('dense');
      check(saveGame(), 'save'); const raw = localStorage.getItem(SAVE_KEY); check(!/density/.test(raw), 'Density leaked into the save');
      return { default: 'dense', options: ['Standard 25', 'Dense 36', 'Epic 48'], storedPerDevice: true };
    });

    // ---------- a 5,000-troop army at each density, desktop ----------
    report.desktop = await p.evaluate(() => {
      const out = {};
      for (const k of ['standard', 'dense', 'epic']) { setDensity(k); fresh(); const t0 = performance.now(); check(startBattle('hoshi'), 'start'); const ms = performance.now() - t0, n = DENSITY[k].n;
        check(BT.per === Math.ceil(2000 / n), 'Troops per soldier ' + BT.per);
        const F = formStats(0), B = BT.band, hud = hudLimit();
        F.forEach(f => { check(f.n === Math.max(Math.ceil(f.g.troops / BT.per), Math.min(3, Math.ceil(f.g.troops))) && f.n <= n, `${f.type}: ${f.n} soldiers`);
          check(f.top - FORM_HEAD * BT.armySc >= hud - .5, `${f.type} heads under the HUD`); check(f.bottom <= BT.vh - 16 + .5, `${f.type} feet off the bottom`);
          check(f.fill <= .9 + 1e-6, `${f.type} overfills: ${f.fill}`); if (f.n + f.heroes >= 2 * f.R && f.R > 3) check(f.fill >= .85 - 1e-6, `${f.type} fills ${Math.round(f.fill * 100)}%`); });
        const inf = F.find(f => f.type === 'inf'); check(inf.fill >= .85, 'Main block does not fill the field');
        // identities: tight infantry, straight gunner files, staggered archers, wide cavalry
        const by = t => F.find(f => f.type === t); check(by('inf').colStep < by('gun').colStep && by('gun').colStep < by('cav').colStep && by('arc').colStep < by('cav').colStep, 'File spacing by arm');
        check(by('cav').rowStep >= by('inf').rowStep, 'Cavalry rank spacing');
        { const g = by('gun').g, cols = new Map(); g.spr.forEach(s => { const c = Math.round((s.sx - g.front) / g.colStep * 100) / 100; check(Math.abs(c - Math.round(c)) < 1e-6, 'Gunner off its file'); }); }
        { const g = by('arc').g, xs = new Set(g.spr.map(s => Math.round(Math.abs(s.sx - g.front) / (g.colStep * .5)))); check([...g.spr].some(s => Math.abs(Math.abs(s.sx - g.front) / g.colStep % 1 - .5) < 1e-6), 'Archers not staggered'); }
        F.forEach(f => check(f.sep >= Math.min(f.rowStep, f.colStep * (f.g.stag ? .5 : 1)) - 1e-6 && f.sep > 8, `${f.type} soldiers overlap: ${f.sep}`));
        // blocks never overlap each other
        const xsF = F.slice().sort((a, b) => b.xMax - a.xMax); for (let i = 1; i < xsF.length; i++) check(xsF[i].xMax < xsF[i - 1].xMin - 4, 'Formations overlap');
        // guards stand ahead of the front file, not on the ranks
        BT.A[0].groups.forEach(g => (g.heroes || []).forEach(hr => (hr.guards || []).forEach(q => check(q.x > Math.max(...g.spr.map(s => s.sx)) + 2, 'A guard stands on the ranks'))));
        let t1 = performance.now(); for (let i = 0; i < 40; i++) drawBattle(); const frame = (performance.now() - t1) / 40;
        out[k] = { per: BT.per, scale: +BT.armySc.toFixed(2), band: [Math.round(B.y0), Math.round(B.y1)], soldiers: Object.fromEntries(F.map(f => [f.type, f.n])), fill: Object.fromEntries(F.map(f => [f.type, Math.round(f.fill * 100) + '%'])), spriteSets: _battleArt.size, startMs: Math.round(ms), frameMs: +frame.toFixed(2) };
        check(_battleArt.size <= SC2_MAX, `Sprite sets ${_battleArt.size}`);
        closeBattle(); clearModals(); }
      check(out.epic.spriteSets <= out.standard.spriteSets + 8, 'Epic multiplies sprite art');
      check(out.epic.frameMs < 30, 'Epic frame too slow: ' + out.epic.frameMs);
      setDensity('dense'); return out;
    });

    // ---------- deterministic ranks ----------
    report.deterministic = await p.evaluate(() => {
      const pos = seed => { fresh(); const R = Math.random; Math.random = seeded(seed); try { startBattle('hoshi'); } finally { Math.random = R; } const P = BT.A[0].groups.filter(g => !g.heroOnly).map(g => g.spr.map(s => [s.sx, s.sy].map(v => +v.toFixed(3)))); closeBattle(); clearModals(); return JSON.stringify(P); };
      const a = pos(3), b = pos(99); check(a === b, 'Placement depends on the random roll'); return true;
    });

    // ---------- casualties thin the soldiers shown; the ranks re-form ----------
    report.casualties = await p.evaluate(() => {
      setDensity('epic'); fresh(); check(startBattle('hoshi'), 'start'); BT.state = 'run'; const g = BT.A[0].groups.find(x => x.type === 'inf'), t0 = g.troops, n0 = g.spr.filter(s => s.alive).length, R0 = g.R;
      g.troops = t0 * .5; syncSprites(g, 'knock'); const n1 = g.spr.filter(s => s.alive).length; check(n1 === visibleCount(g) && n1 === Math.ceil(g.troops / BT.per), `Shown ${n1} for ${g.troops}`);
      g.troops = 2 * BT.per - 1; syncSprites(g, 'knock'); check(g.spr.filter(s => s.alive).length === 3 && visibleCount(g) === 3, 'A formation in its last shares still shows 3');
      g.troops = t0 * .5; syncRevive(g); const n2 = g.spr.filter(s => s.alive).length; check(n2 === visibleCount(g), 'Revive count');
      regroup(['inf']); const al = g.spr.filter(s => s.alive), ys = [...new Set(al.map(s => +s.sy.toFixed(2)))].sort((a, b) => a - b);
      check(g.R === R0 && ys.length <= R0, `Ranks changed shape: ${ys.length} rows of ${R0}`);
      ys.forEach(y => { const k = (y - ys[0]) / g.rowStep; check(Math.abs(k - Math.round(k)) < 1e-3, 'Soldier off the rank grid'); });
      const out = { troops: [t0, t0 * .5], soldiers: [n0, n1, n2], rowsKept: g.R === R0 }; closeBattle(); clearModals(); setDensity('dense'); return out;
    });

    // ---------- the same fight at every density ----------
    report.combat = await p.evaluate(() => {
      // combat draws its own random stream; animation draws another, so the soldiers shown can't move the dice
      const COMBAT = ['resolvePhase', 'interceptHits', 'counterHits', 'equipmentGrenades', 'heroPhase', 'siegeScript', 'aiTactic', 'preDuel', 'castJutsu', 'endRound'];
      const run = k => { setDensity(k); const R = Math.random; let cr = seeded(4242), vr = seeded(777), inC = 0;
        Math.random = () => (inC ? cr() : vr()); fresh({ inf: 1200, arc: 600, gun: 700, cav: 400 }); const W = {}; COMBAT.forEach(n => { W[n] = window[n]; window[n] = (...a) => { inC++; try { return W[n](...a); } finally { inC--; } }; });
        const led = []; const rp = window.resolvePhase; window.resolvePhase = (...a) => { const hs = rp(...a); hs.forEach(h => led.push(+h.kills.toFixed(6))); return hs; };
        try { startBattle('hoshi'); BT.autoKi.on = false; beginRound(); let n = 0; while (BT && BT.state !== 'done' && n++ < 30000) updateBattle(1 / 5); }
        finally { Math.random = R; window.resolvePhase = rp; Object.entries(W).forEach(([n2, f]) => window[n2] = f); }
        const res = { result: BT.result, rounds: BT.round, ours: BT.A[0].groups.map(g => +g.troops.toFixed(4)), theirs: BT.A[1].groups.map(g => +g.troops.toFixed(4)), hits: led.length, ledger: led.reduce((a, b) => a + b, 0).toFixed(4), shown: BT.A[0].groups.reduce((n, g) => n + g.spr.length, 0) };
        closeBattle(); clearModals(); return res; };
      const S = run('standard'), D = run('dense'), E = run('epic');
      const key = r => JSON.stringify([r.result, r.rounds, r.ours, r.theirs, r.hits, r.ledger]);
      check(key(S) === key(D) && key(D) === key(E), 'Combat differs by density: ' + JSON.stringify({ S, D, E }));
      check(S.shown < D.shown && D.shown < E.shown, 'Densities draw the same number of soldiers');
      setDensity('dense'); return { result: S.result, rounds: S.rounds, hits: S.hits, killsTotal: S.ledger, soldiersDrawn: { standard: S.shown, dense: D.shown, epic: E.shown }, identical: true };
    });

    // ---------- formation mixes and a siege ----------
    report.mixes = await p.evaluate(() => {
      const out = {}; setDensity('epic');
      for (const [name, T] of [['infantry only', { inf: 5000 }], ['gun line', { inf: 800, gun: 4200 }], ['horse army', { inf: 1000, cav: 4000 }], ['balanced', { inf: 1250, arc: 1250, gun: 1250, cav: 1250 }]]) {
        fresh(T); check(startBattle('hoshi'), name); const F = formStats(0);
        F.forEach(f => { check(f.fill <= .9 + 1e-6 && f.top - FORM_HEAD * BT.armySc >= hudLimit() - .5, name + ' ' + f.type + ' band'); check(f.sep > 8, name + ' overlap'); });
        const big = F.reduce((m, f) => f.n > m.n ? f : m, F[0]); check(big.fill >= .85, `${name}: biggest block fills ${Math.round(big.fill * 100)}%`);
        const xsF = F.slice().sort((a, b) => b.xMax - a.xMax); for (let i = 1; i < xsF.length; i++) check(xsF[i].xMax < xsF[i - 1].xMin - 4, name + ' blocks overlap');
        const width = Math.max(...F.map(f => f.xMax)) - Math.min(...F.map(f => f.xMin)); check(Math.min(...F.map(f => f.xMin)) >= 10, name + ' runs off the field: ' + Math.min(...F.map(f => f.xMin))); { const E = formStats(1); if (E.length) check(Math.max(...E.map(f => f.xMax)) <= BT.WW - 10, name + ' enemy off the field'); }
        out[name] = { soldiers: Object.fromEntries(F.map(f => [f.type, f.n])), biggestFill: Math.round(big.fill * 100) + '%', armyWidth: Math.round(width), fit: BT.fit[0] }; closeBattle(); clearModals(); }
      // a siege: defenders' gunners on the wall walkway, everyone inside the band
      fresh(); check(startBattle('yamashiro') && BT.siege, 'siege'); const F0 = formStats(0), F1 = formStats(1), B = BT.band;
      F0.concat(F1).forEach(f => check(f.top >= B.y0 - .5 && f.bottom <= B.y1 + .5, 'Siege ranks outside the band'));
      const wall = BT.A[1].groups.find(g => g.onWall); if (wall) check(wall.spr.every(s => Math.abs(s.sx - BT.siege.x) < 40), 'Wall gunners off the wall');
      out.siege = { attackers: Object.fromEntries(F0.map(f => [f.type, f.n])), defenders: Object.fromEntries(F1.map(f => [f.type, f.n])), wallGunners: wall ? wall.spr.length : 0 };
      // a full siege plays out at Epic
      BT.autoKi.on = false; beginRound(); let n = 0; while (BT && BT.state !== 'done' && n++ < 30000) updateBattle(1 / 5); check(BT.state === 'done', 'Siege did not finish'); out.siege.result = BT.result; closeBattle(); clearModals();
      setDensity('dense'); return out;
    });
    await p.close();

    // ---------- phones and tablets, and resizing ----------
    report.devices = {};
    for (const [w, h] of [[390, 844], [844, 390], [768, 1024], [1024, 768]]) {
      p = await page(w, h);
      report.devices[`${w}x${h}`] = await p.evaluate(() => {
        fresh(); check(startBattle('hoshi'), 'start'); const F = formStats(0), B = BT.band, hud = hudLimit();
        F.forEach(f => { check(f.top - FORM_HEAD * BT.armySc >= hud - .5 && f.bottom <= BT.vh - 16 + .5, f.type + ' outside the room'); check(f.sep > 8, f.type + ' overlap'); });
        check(F.find(f => f.type === 'inf').fill >= .85, 'Main block fill');
        let t1 = performance.now(); for (let i = 0; i < 30; i++) drawBattle(); const frame = (performance.now() - t1) / 30;
        return { scale: +BT.armySc.toFixed(2), band: [Math.round(B.y0), Math.round(B.y1)], infFill: Math.round(F.find(f => f.type === 'inf').fill * 100) + '%', frameMs: +frame.toFixed(2) };
      });
      await p.close();
    }
    // resize mid-deployment: desktop to phone portrait and back; the ranks refit to the new room
    p = await page(1280, 800);
    await p.evaluate(() => { fresh(); check(startBattle('hoshi'), 'start'); window.__b0 = BT.band; });
    const fit = async label => p.evaluate(label => { const B = BT.band, hud = hudLimit(), F = formStats(0);
      F.forEach(f => { check(f.top - FORM_HEAD * BT.armySc >= hud - .5 && f.bottom <= BT.vh - 16 + .5 && f.top >= B.y0 - .5 && f.bottom <= B.y1 + .5, `${label}: ${f.type} outside the room`);
        const al = f.g.spr.filter(s => s.alive); check(al.every(s => s.x === s.sx && s.y === s.sy), `${label}: not standing in the new ranks`); });
      const inf = F.find(f => f.type === 'inf'); check(inf.fill >= .8, `${label}: infantry fills ${Math.round(inf.fill * 100)}%`);
      return { band: [Math.round(B.y0), Math.round(B.y1)], infFill: Math.round(inf.fill * 100) + '%', infRows: inf.R }; }, label);
    report.resize = {};
    await p.setViewportSize({ width: 390, height: 844 }); await p.waitForTimeout(300); report.resize.toPortrait = await fit('portrait');
    await p.setViewportSize({ width: 844, height: 390 }); await p.waitForTimeout(300); report.resize.toLandscapePhone = await fit('landscape');
    await p.setViewportSize({ width: 1280, height: 800 }); await p.waitForTimeout(300); report.resize.backToDesktop = await fit('desktop');
    // and mid-battle: positions keep to the band, then re-form at the next regroup
    report.resize.midBattle = await p.evaluate(() => { BT.autoKi.on = false; beginRound(); let n = 0; while (BT && BT.state === 'run' && BT.phase < 1 && n++ < 400) updateBattle(1 / 5);
      window.dispatchEvent(new Event('resize')); n = 0; while (BT && BT.state !== 'done' && n++ < 30000) updateBattle(1 / 5); check(BT.state === 'done', 'Battle after resize'); return BT.result; });
    await p.close();

    assert.deepStrictEqual(errors, []);
    fs.mkdirSync(dir + '/reports', { recursive: true });
    fs.writeFileSync(dir + '/reports/density.json', JSON.stringify({ ...report, errors }, null, 2));
    console.log(JSON.stringify({ ...report, errors }, null, 2));
  } finally { await browser.close(); server.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
