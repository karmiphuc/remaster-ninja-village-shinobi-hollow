// Wooden Tate (盾) for Gunner formations: the Yamashiro unlock (and old saves that hold it), buying and replenishing
// with gold and timber, coverage capped at 100% (player) and 50% (AI), no Tate for AI castle garrisons, the combat
// effects (−20% arrow casualties, −8% Gunner attack at full coverage, nothing else), the cumulative death ledger
// (every 10 killed breaks one, remainder carried, wounded and fled excluded, never twice), the pavise art, 1,000+
// Gunner formations, and the Army screen without the −10 buttons. Writes reports/tate.json.
const fs = require('fs'), http = require('http'), assert = require('assert'), path = require('path'), { chromium } = require('playwright');
const dir = path.resolve(__dirname, '..');
const ignorable = t => /Failed to load resource: net::ERR_(TUNNEL_CONNECTION_FAILED|FAILED|NAME_NOT_RESOLVED|INTERNET_DISCONNECTED)/.test(t);
(async () => {
  const server = http.createServer((q, r) => { r.setHeader('Content-Type', 'text/html'); r.end(fs.readFileSync(dir + '/index.html')); });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH || (fs.existsSync('/usr/bin/chromium') ? '/usr/bin/chromium' : undefined), args: ['--no-sandbox'] });
  try {
    const p = await browser.newPage({ viewport: { width: 390, height: 844 } }), errors = [];
    p.on('pageerror', e => errors.push(e.message)); p.on('console', m => { if (m.type() === 'error' && !ignorable(m.text())) errors.push(m.text()); });
    await p.addInitScript(() => { window.__noIntro = true; window.__noQuick = true; });
    await p.goto('http://127.0.0.1:' + server.address().port);
    const report = await p.evaluate(async () => {
      const check = (x, m) => { if (!x) throw Error(m); };
      const near = (a, b, tol, m) => check(Math.abs(a - b) <= tol, `${m}: ${a.toFixed ? a.toFixed(4) : a} vs ${b}`);
      const clearModals = () => { MQ.length = 0; $('#modal').hidden = true; };
      const fresh = () => { newGame(); G.tut = 1; G.speed = 0; G.boons.pending = null; G.roll.v = false; $('#title').hidden = true; resizeView(); afterLoad(); clearModals(); };
      const arm = (troops) => { ['arc', 'gun', 'cav'].forEach(t => { G.researched['corps_' + t] = 1; G.units[t] = true; }); G.troops = Object.assign({ inf: 0, arc: 0, gun: 0, cav: 0 }, troops); };
      const endAs = res => { BT.A[res === 'win' ? 1 : 0].groups.forEach(g => g.troops = 0); check(finishBattle(res) !== false, 'Battle did not end'); };
      // a seeded Math.random, so two resolutions differ only by what is being measured
      const seeded = s => () => (s = (s * 16807) % 2147483647) / 2147483647;
      const withSeed = (s, f) => { const R = Math.random; Math.random = seeded(s); try { return f(); } finally { Math.random = R; } };
      const yam = PROVINCES.find(q => q.id === 'yamashiro'), out = {};

      // ---------- unlock ----------
      fresh(); check(yam.links.includes('home'), 'Yamashiro is not next to home'); check(!tateOn(), 'Tate open from the start');
      arm({ inf: 300, gun: 1200 }); openPanel('army'); UI.armyOpen = { gun: true }; refreshSheet();
      check(/conquer Yamashiro Castle/.test($('#sh-body').textContent), 'Locked panel missing');
      check(![...$('#sh-body').querySelectorAll('button')].some(b => /−10|-10/.test(b.textContent)), '−10 button still on the Army screen');
      closeSheet(); openMap(); showProvCard(yam); check(/Wooden Tate/.test($('#prov-card').textContent), 'Yamashiro card does not list the Tate'); $('#prov-card').hidden = true; closeMap();
      check(startBattle(yam.id), 'Siege did not start'); endAs('win'); closeBattle(); clearModals();
      check(tateOn() && G.prov.yamashiro.owner === 'kage', 'Conquering Yamashiro did not unlock the Tate');
      // old saves: holding Yamashiro unlocks it; not holding it does not
      fresh(); G.prov.yamashiro.owner = 'kage'; delete G.tateOn; check(saveGame(), 'save'); G = null; check(loadGame(), 'load'); afterLoad(); clearModals();
      check(tateOn(), 'Old save holding Yamashiro is not unlocked'); check(tateOwned() === 0 && (G.tateKills || 0) === 0, 'Old save fields');
      fresh(); delete G.tateOn; check(saveGame(), 'save'); G = null; check(loadGame(), 'load'); afterLoad(); clearModals(); check(!tateOn(), 'Old save without Yamashiro unlocked');
      out.unlock = { reward: 'Yamashiro', oldSaveHolding: true, oldSaveNot: false, minus10Buttons: 0 };

      // ---------- buying and replenishing (1,000+ Gunners) ----------
      fresh(); G.tateOn = true; arm({ inf: 300, gun: 1234 }); G.gold = 1e6; G.stock.wood = 10000;
      check(tateNeed() === 124 && tateMissing() === 124, 'Need for 1,234 Gunners');
      openPanel('army'); UI.armyOpen = { gun: true }; refreshSheet(); let txt = $('#sh-body').textContent;
      check(/0 \/ 124/.test(txt) && /Missing 124 · 4,960G \+ 496 Timber/.test(txt), 'Panel numbers: ' + txt.match(/Defensive Support.{0,200}/)?.[0]);
      let g0 = G.gold, w0 = G.stock.wood; $('#tate-buy').click(); clearModals();
      check(tateOwned() === 124 && g0 - G.gold === 124 * TATE.gold && w0 - G.stock.wood === 124 * TATE.wood, 'Buy cost');
      txt = $('#sh-body').textContent; check(/124 \/ 124/.test(txt) && /100%/.test(txt) && /Arrow casualties −20%/.test(txt) && /Gunner attack −8%/.test(txt) && /Every Gunner is covered/.test(txt), 'Full-coverage panel');
      check($('#tate-buy').disabled, 'Can buy past 100% coverage'); check(tateBuy(5) === 0, 'tateBuy past the need');
      // losses: replenish buys exactly the missing bundles at the same price
      G.tate = 97; refreshSheet(); g0 = G.gold; w0 = G.stock.wood; check(/Replenish 27/.test($('#tate-buy').textContent), 'Replenish label'); $('#tate-buy').click(); clearModals();
      check(tateOwned() === 124 && g0 - G.gold === 27 * 40 && w0 - G.stock.wood === 27 * 4, 'Replenish cost');
      // short of timber: buys what it can, never more than missing
      G.tate = 100; G.stock.wood = 41; $('#tate-buy') && refreshSheet(); $('#tate-buy').click(); clearModals(); check(tateOwned() === 110 && G.stock.wood === 1, 'Partial buy with 41 timber');
      // nothing comes back on its own
      const t0 = tateOwned(); for (let i = 0; i < 3; i++) monthTick(); clearModals(); check(tateOwned() === t0, 'Tate restored for free');
      closeSheet(); out.buying = { gunners: 1234, need: 124, costEach: `${TATE.gold}G + ${TATE.wood} timber`, replenish27: '1,080G + 108 timber', partialWith41Timber: 10 };

      // ---------- combat effects, measured on a real battle's resolution ----------
      fresh(); G.tateOn = true; arm({ inf: 400, arc: 400, gun: 1500, cav: 200 }); G.tate = tateNeed();
      const camp = { id: 'tatecamp', type: 'camp', clan: 'wako', mode: 'army', name: 'Test Pirates', x: 700, y: 760, power: 4000, owner: 'wako', reward: { gold: 10 }, expires: monthIdx() + 9, near: 'Kakure Valley', links: [] };
      G.camps.push(camp); G.wins = 0; check(startBattle(camp.id), 'Camp battle did not start');
      const pg = BT.A[0].groups.find(g => g.type === 'gun'), eg = BT.A[1].groups.find(g => g.type === 'gun');
      check(pg.tate === 150 && pg.tateCov === 1, 'Player coverage at battle start'); check(!eg || !eg.tate, 'AI got Tate with no victories');
      // arrows at the Gunners: the AI's archers fire; only the casualty multiplier differs
      const ctx = { jutsu: [null, null], siege: false }, snap = BT.A.map(A => A.groups.map(g => g.troops));
      const reset = () => BT.A.forEach((A, i) => A.groups.forEach((g, j) => g.troops = snap[i][j]));
      const killsOn = (phase, from, to, cov, seed) => { reset(); pg.tateCov = cov; const hs = withSeed(seed, () => resolvePhase(phase, BT.A[from], BT.A[to], ctx)); return hs.filter(h => h.to === pg).reduce((n, h) => n + h.kills, 0); };
      const dmgOf = (cov, seed) => { reset(); BT.A[1].groups.forEach(g => g.troops *= 50); pg.tateCov = cov; // a deep enemy, so the volley is never capped by who is left
        const hs = withSeed(seed, () => resolvePhase('gun', BT.A[0], BT.A[1], ctx)); return hs.reduce((n, h) => n + h.kills, 0); };
      // make the arrows land on the Gunners: the enemy archers' first preference is gunners
      check(BT.A[1].groups.some(g => g.type === 'arc'), 'Pirates have no archers');
      const ratios = {};
      for (const [cov, want] of [[1, .8], [.5, .9]]) { let a = 0, b = 0; for (let s = 1; s <= 40; s++) { b += killsOn('arc', 1, 0, 0, s); a += killsOn('arc', 1, 0, cov, s); } ratios['arrow' + cov] = a / b; near(a / b, want, .01, `Arrow casualties at ${cov * 100}%`); }
      for (const [cov, want] of [[1, .92], [.5, .96]]) { let a = 0, b = 0; for (let s = 1; s <= 40; s++) { b += dmgOf(0, s); a += dmgOf(cov, s); } ratios['attack' + cov] = a / b; near(a / b, want, .01, `Gunner attack at ${cov * 100}%`); }
      for (const ph of ['gun', 'inf', 'cav']) { let a = 0, b = 0; for (let s = 1; s <= 20; s++) { b += killsOn(ph, 1, 0, 0, s); a += killsOn(ph, 1, 0, 1, s); } ratios[ph + 'Taken'] = b ? a / b : 1; check(a === b, `Tate changed ${ph} casualties: ${a} vs ${b}`); }
      // ninjutsu fire/wind ignore it: the jutsu path never reads tateCov (checked by source)
      check(!/tate/i.test(String(castJutsu || '')), 'Ninjutsu reads the Tate');
      // multiplicative with an Arrow Ward
      pg.mods.arrowres = 2; { let a = 0, b = 0; for (let s = 1; s <= 40; s++) { b += killsOn('arc', 1, 0, 0, s); a += killsOn('arc', 1, 0, 1, s); } ratios.arrowWithWard = a / b; near(a / b, .8, .01, 'Tate with an Arrow Ward'); } pg.mods.arrowres = 0;
      // the pavise art: one per covered row in front of the Gunners
      const props = BT.props.filter(q => q.tate && q.si === 0); check(props.length >= 1 && props.every(q => q.k === 'pavise'), 'No pavises in front of the Gunners');
      out.combat = { gunners: 1500, tate: 150, ratios: Object.fromEntries(Object.entries(ratios).map(([k, v]) => [k, +v.toFixed(4)])), pavisesFull: props.length };
      reset(); closeBattle(); clearModals();
      // half coverage: fewer pavises
      G.tate = 75; check(startBattle(camp.id), 'restart'); const half = BT.A[0].groups.find(g => g.type === 'gun'); near(half.tateCov, .5, 1e-9, 'Half coverage');
      const propsHalf = BT.props.filter(q => q.tate && q.si === 0).length; check(propsHalf < props.length, `Half coverage drew ${propsHalf} pavises vs ${props.length}`); out.combat.pavisesHalf = propsHalf; closeBattle(); clearModals();

      // ---------- AI: progression, the 50% cap, never in castles ----------
      const pa0 = playerArmy(), aiCov = wins => { G.wins = wins; const ea = enemyArmy(camp); tateEquip(pa0, ea, camp); const g = ea.groups.find(x => x.type === 'gun'); return g ? g.tateCov || 0 : null; };
      const ai = { 0: aiCov(0), 4: aiCov(4), 10: aiCov(10), 30: aiCov(30) };
      check(ai[0] === 0, 'AI Tate at 0 wins'); check(ai[4] > .15 && ai[4] <= .2 + 1e-9, 'AI at 4 wins: ' + ai[4]); check(ai[10] <= .5 + 1e-9 && ai[30] <= .5 + 1e-9 && ai[30] > .45, 'AI cap: ' + JSON.stringify(ai));
      G.wins = 30; const castles = PROVINCES.filter(q => q.type === 'clan'); let castleTate = 0;
      for (const P of castles) { const ea = enemyArmy(P); tateEquip(pa0, ea, P); castleTate += ea.groups.reduce((n, g) => n + (g.tate || 0), 0); }
      check(castleTate === 0, 'A castle garrison got Tate'); { const ea = enemyArmy(PROVINCES.find(q => q.type === 'dojo')); tateEquip(pa0, ea, PROVINCES.find(q => q.type === 'dojo')); check(!ea.groups.some(g => g.tate), 'Dojo partners got Tate'); }
      out.ai = { coverageByWins: Object.fromEntries(Object.entries(ai).map(([k, v]) => [k, +v.toFixed(3)])), castlesChecked: castles.length, castleTate };

      // ---------- the death ledger ----------
      { const g = { tate: 50 }; let W = tateWear(g, 27, 0); check(W.lost === 2 && W.carry === 7, '27 deaths'); W = tateWear(g, 5, W.carry); check(W.lost === 1 && W.carry === 2, '7 + 5 carried'); W = tateWear({ tate: 1 }, 35, 0); check(W.lost === 1 && W.carry === 0, 'Fewer Tate than breaks'); }
      { const g = { start: 100, troops: 60, fellN: 30, fledN: 10 }; check(tateKilled(g, 12) === 18, 'Killed excludes wounded and fled: ' + tateKilled(g, 12)); check(tateKilled({ start: 100, troops: 60 }, 12) === 28, 'No sprite record: all permanent losses'); }
      // through the real end of a battle, twice, so nothing is deducted twice
      fresh(); G.tateOn = true; arm({ inf: 400, arc: 0, gun: 1000, cav: 0 }); G.tate = 100; G.tateKills = 7; G.camps.push(Object.assign({}, camp)); check(startBattle(camp.id), 'Ledger battle');
      { const g = BT.A[0].groups.find(x => x.type === 'gun'); g.troops = g.start - 40; g.fellN = 30; g.fledN = 10; BT.A[1].groups.forEach(x => x.troops = 0);
        check(finishBattle('win') !== false, 'Ledger battle did not end'); const killed = g.tateKilled, back = Math.round(40 * (.3 + (BT.A[0].qm || 0) * .05));
        check(killed === Math.round(40 * .75 - back), 'Killed: ' + killed); const tot = 7 + killed; check(G.tate === 100 - Math.floor(tot / 10) && G.tateKills === tot % 10, `Ledger: ${G.tate} / ${G.tateKills}`);
        const after = [G.tate, G.tateKills]; check(finishBattle('win') === false && G.tate === after[0] && G.tateKills === after[1], 'Deducted twice');
        out.ledger = { lost: 40, fell: 30, fled: 10, wounded: back, killed, carriedIn: 7, tateLost: Math.floor(tot / 10), carriedOut: G.tateKills }; }
      closeBattle(); clearModals();

      // ---------- full battles: identical rules for both sides ----------
      // even battles against the archer-heavy Karasu with the AI at its 50% cap; your Gunners with no Tate and with 100% coverage
      const battle = (tate, seed, noGuns) => withSeed(seed, () => { G.troops = { inf: 400, arc: 300, gun: 1200, cav: 0 }; G.tate = tate; G.tateKills = 0; G.wins = 30; G.ki = 0;
        G.camps = G.camps.filter(c => c.id !== camp.id); G.camps.push(Object.assign({}, camp, { clan: 'karasu', power: 2600 })); startBattle(camp.id); BT.autoKi && (BT.autoKi.on = false);
        // an even fight: the archer-heavy Karasu scaled to your strength, their Gunners keeping their 50% Tate share
        { const f = .2 * totalOf(BT.A[0]) / totalOf(BT.A[1]); BT.A[1].groups.forEach(x => { if (!x.heroOnly) { x.troops *= f; x.start = x.max = x.troops; if (x.tate) x.tate = x.troops * x.tateCov / TATE.men; } }); if (noGuns) BT.A[1].groups.forEach(x => { if (x.type === 'gun') { x.troops = x.start = x.max = 0; x.tate = 0; } }); BT.A[1].power0 = armyPower(BT.A[1]); }
        const pg = BT.A[0].groups.find(g => g.type === 'gun'), eg = BT.A[1].groups.find(g => g.type === 'gun'), p0 = pg.start, e0 = eg ? eg.start : 0, ecov = eg ? eg.tateCov || 0 : 0, et = eg ? eg.tate || 0 : 0;
        const by = {}, tally = hs => { hs.forEach(h => { if (h.to === pg) { const k = h.from.type + (h.icpt ? '-countershot' : h.counter ? '-counter' : ''); by[k] = (by[k] || 0) + h.kills; } }); return hs; };
        const rp = window.resolvePhase, ch = window.counterHits, ih = window.interceptHits;
        window.resolvePhase = (...a) => tally(rp(...a)); window.counterHits = (...a) => tally(ch(...a)); window.interceptHits = (...a) => tally(ih(...a));
        try { beginRound(); let n = 0; while (BT && BT.state !== 'done' && n++ < 20000) updateBattle(1 / 10); } finally { window.resolvePhase = rp; window.counterHits = ch; window.interceptHits = ih; }
        const r = { by, res: BT.result, pLost: p0 - Math.ceil(Math.max(0, pg.troops)), pCov: pg.tateCov || 0, tateLost: pg.tateLost || 0, killed: pg.tateKilled || 0, eLost: eg ? e0 - Math.ceil(Math.max(0, eg.troops)) : 0, eCov: ecov, eTate: et, eTateLost: eg ? eg.tateLost || 0 : 0, eKilled: eg ? eg.tateKilled || 0 : 0, tateAfter: G.tate, carry: G.tateKills };
        closeBattle(); clearModals(); return r; });
      fresh(); G.tateOn = true; arm({}); const rows = [];
      for (const tate of [0, 120]) for (let s = 1; s <= 2; s++) rows.push(Object.assign({ tate, seed: s }, battle(tate, s * 97)));
      rows.forEach(r => { check(r.res, 'Battle unfinished'); check(r.eCov <= .5 + 1e-9, 'AI over 50%');
        if (r.tate) { const br = Math.floor(r.killed / 10), lost = Math.min(r.tate, br); check(r.tateLost === lost && r.carry === (lost < br ? 0 : r.killed % 10) && r.tateAfter === r.tate - lost, 'Player ledger in a full battle: ' + JSON.stringify(r)); }
        if (r.eTate) check(r.eTateLost === Math.min(r.eTate, Math.floor(r.eKilled / 10)), 'AI ledger in a full battle: ' + JSON.stringify(r)); });
      // where the Tate earns its keep: the same fight against archers and spears with no Gunners
      const bowRows = []; for (const tate of [0, 120]) for (let s = 1; s <= 2; s++) bowRows.push(Object.assign({ tate, seed: s }, battle(tate, s * 131, true)));
      const bowAvg = (tate, k) => { const L = bowRows.filter(r => r.tate === tate); return L.reduce((n, r) => n + r[k], 0) / L.length; };
      const avg = (tate, k) => { const L = rows.filter(r => r.tate === tate); return L.reduce((n, r) => n + r[k], 0) / L.length; };
      out.fullBattles = { battles: rows.length, aiCoverage: +avg(0, 'eCov').toFixed(3),
        byPlayerTate: Object.fromEntries([0, 120].map(t => [t, { coverage: avg(t, 'pCov'), gunnersLost: Math.round(avg(t, 'pLost')), killedBy: (() => { const T = {}; rows.filter(r => r.tate === t).forEach(r => Object.entries(r.by).forEach(([k, v]) => T[k] = (T[k] || 0) + v)); const sum = Object.values(T).reduce((a, b) => a + b, 0) || 1; return Object.fromEntries(Object.entries(T).map(([k, v]) => [k, Math.round(v / sum * 100) + '%'])); })(), enemyGunnersLost: Math.round(avg(t, 'eLost')), tateLost: +avg(t, 'tateLost').toFixed(1), wins: rows.filter(r => r.tate === t && r.res === 'win').length }])),
        rows,
        vsArchersOnly: Object.fromEntries([0, 120].map(t => [t, { coverage: bowAvg(t, 'pCov'), gunnersLost: Math.round(bowAvg(t, 'pLost')), tateLost: +bowAvg(t, 'tateLost').toFixed(1), wins: bowRows.filter(r => r.tate === t && r.res === 'win').length, battles: bowRows.filter(r => r.tate === t).length }])) };
      // saves keep the ledger
      G.tate = 33; G.tateKills = 4; check(saveGame(), 'save'); G = null; check(loadGame(), 'load'); afterLoad(); clearModals(); check(tateOwned() === 33 && G.tateKills === 4 && tateOn(), 'Save round trip');
      out.save = { tate: 33, carry: 4 };
      return out;
    });
    assert.deepStrictEqual(errors, []);
    fs.mkdirSync(dir + '/reports', { recursive: true });
    fs.writeFileSync(dir + '/reports/tate.json', JSON.stringify({ ...report, errors }, null, 2));
    const { rows, ...summary } = report.fullBattles; console.log(JSON.stringify({ ...report, fullBattles: summary, errors }, null, 2));
  } finally { await browser.close(); server.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
