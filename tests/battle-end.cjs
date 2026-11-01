// Battles always end. Reported: a village land fight against bandits ran 600+ rounds with the enemy showing "1" left
// and no figure on the field. Cause: when two fighters struck the same lone foe in one phase, the foe's figure was
// planned to fall from the combined blow, the second blow then found no figure to animate and was dropped with its
// losses, so the unit kept a fraction of a man that no figure showed and melee could never reach.
// Checks: (1) direct: two blows on one lone foe both land, and the figure only falls when the unit is spent;
// (2) the land fights that hung (seed 18 on the build before the fix) and a sweep of others all end, and at the end of
// every round no unit holds men without a figure standing. Writes reports/battle-end.json.
const fs = require('fs'), http = require('http'), assert = require('assert'), path = require('path'), { chromium } = require('playwright');
const dir = path.resolve(__dirname, '..');
const ignorable = t => /Failed to load resource: net::ERR_(TUNNEL_CONNECTION_FAILED|FAILED|NAME_NOT_RESOLVED|INTERNET_DISCONNECTED)/.test(t);
(async () => {
  const server = http.createServer((q, r) => { r.setHeader('Content-Type', 'text/html'); r.end(fs.readFileSync(dir + '/index.html')); });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH || (fs.existsSync('/usr/bin/chromium') ? '/usr/bin/chromium' : undefined), args: ['--no-sandbox'] });
  const errors = [];
  try {
    const p = await browser.newPage({ viewport: { width: 390, height: 844 } });
    p.on('pageerror', e => errors.push(e.message)); p.on('console', m => { if (m.type() === 'error' && !ignorable(m.text())) errors.push(m.text()); });
    await p.addInitScript(() => { window.__noIntro = true; });
    await p.goto('http://127.0.0.1:' + server.address().port);
    const report = await p.evaluate(() => {
      const check = (x, m) => { if (!x) throw Error(m); };
      const P = Sound.play, SY = Sound.say; Sound.play = () => {}; Sound.say = () => {};
      const out = {};
      try {
        // ---- (1) two blows on one lone foe in the same phase ----
        Math.random = seeded(5); newGame(); $('#title').hidden = true; resizeView(); afterLoad(); MQ.length = 0; $('#modal').hidden = true;
        window.__noQuick = true; const site = landSite('shrine');
        check(startBattle(null, { site, pa: playerSkirmish(), ea: enemyArmy(site) }), 'Land fight did not start'); window.__noQuick = false;
        const mine = BT.A[0].groups.filter(g => g.troops > 0 && g.spr.some(s => s.alive)), foe = BT.A[1].groups.find(g => g.troops > 0 && g.spr.filter(s => s.alive).length === 1);
        check(mine.length >= 2 && foe, 'Need two fighters and a lone foe');
        const t0 = foe.troops, hits = [{ from: mine[0], to: foe, kills: t0 * .7, depth: 0 }, { from: mine[1], to: foe, kills: t0 * .6, depth: 0 }];
        normalizeBattleHits(hits); check(Math.abs(hits[0].kills + hits[1].kills - t0) < 1e-9, 'Blows should add up to the whole unit');
        const S = buildScript('inf', hits); const landed = new Set(S.ev.filter(e => e.k === 'hit').map(e => e.h));
        check(hits.every(h => landed.has(h)), 'A blow on the lone foe has no hit event: its losses would be dropped');
        S.ev.sort((a, b) => a.t - b.t).forEach(e => { BT.t = e.t; doEvent(e); });
        check(!(foe.troops > 0), `Foe keeps ${foe.troops} men after both blows`); check(!foe.spr.some(s => s.alive), 'Foe still standing after both blows');
        out.direct = { foeTroops: +t0.toFixed(3), blows: hits.map(h => +h.kills.toFixed(3)), bothLanded: true, left: foe.troops };
        closeBattle(); MQ.length = 0; $('#modal').hidden = true;

        // ---- (2) land fights end, and no unit is ever left with men but no figure ----
        let ghosts = []; const er = window.endRound;
        window.endRound = function () { if (BT) for (const si of [0, 1]) for (const g of BT.A[si].groups) if (g.troops > 0 && !g.spr.some(s => s.alive) && !(g.heroes || []).some(h => !h.out)) ghosts.push({ round: BT.round, side: si, type: g.type, troops: g.troops.toPrecision(3) }); return er.apply(this, arguments); };
        const runs = [], stuck = [];
        for (const seed of [18, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]) { // 18: hung at round 600+ before the fix
          Math.random = seeded(seed * 13 + 1); newGame(); $('#title').hidden = true; resizeView(); afterLoad(); MQ.length = 0; $('#modal').hidden = true;
          const extra = seed % 6, roster = VILLAGER_POOL.concat(RECRUITS).filter(v => !vById(v.id)); for (let i = 0; i < extra && i < roster.length; i++) addVillager(roster[i].id, true);
          G.villagers.forEach(v => { v.lv = 1 + (seed % 8); v.en = 100; });
          for (const k of ['hollow', 'hollow', 'ronin', 'shrine']) {
            const s = landSite(k); ghosts = [];
            if (!startBattle(null, { site: s, pa: playerSkirmish(), ea: enemyArmy(s) })) break;
            const row = { seed, k, round: BT.round, result: BT.result || null, done: BT.state === 'done', ghosts: ghosts.slice(0, 3) }; runs.push(row);
            if (!row.done || ghosts.length) stuck.push(row);
            closeBattle(); MQ.length = 0; $('#modal').hidden = true; G.villagers.forEach(v => { v.hurt = 0; v.en = 100; delete v.recover; });
          }
        }
        window.endRound = er;
        out.fights = runs.length; out.maxRound = Math.max(...runs.map(r => r.round)); out.seed18 = runs.filter(r => r.seed === 18).map(r => `${r.k}: ${r.result} in ${r.round} rounds`);
        out.stuck = stuck;
        check(!stuck.length, 'Fights that did not end or left a unit with men but no figure: ' + JSON.stringify(stuck.slice(0, 3)));
      } finally { Sound.play = P; Sound.say = SY; }
      return out;
    });
    assert.deepStrictEqual(errors, []);
    fs.mkdirSync(dir + '/reports', { recursive: true });
    fs.writeFileSync(dir + '/reports/battle-end.json', JSON.stringify({ ...report, errors }, null, 2));
    console.log(JSON.stringify({ ...report, errors }, null, 2));
  } finally { await browser.close(); server.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
