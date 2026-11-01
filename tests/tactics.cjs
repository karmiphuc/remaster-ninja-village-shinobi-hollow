// Unattended battle simulations explicitly opt in to automatic duel acceptance.
// Formation tactics (Strategy Lv0-5, all formations, Round 3 adaptation) and persistent Ki (cap, monthly recharge,
// no battle refill, symmetric Auto-cast window, one cast per battle). Writes reports/tactics.json.
const fs = require('fs'), http = require('http'), assert = require('assert'), path = require('path'), { chromium } = require('playwright');
const dir = path.resolve(__dirname, '..');
// a blocked web font is a network condition, not a game error
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
    const report = await p.evaluate(() => {
      const check = (x, m) => { if (!x) throw Error(m); };
      const near = (a, b, tol, m) => check(Math.abs(a - b) <= tol, `${m}: ${a} vs ${b}±${tol}`);
      newGame(); G.autoDuel = true; G.tut = 1; G.speed = 0; G.boons.pending = null; G.roll.v = false; $('#title').hidden = true; resizeView(); afterLoad(); MQ.length = 0; $('#modal').hidden = true;
      G.troops = { inf: 60, arc: 40, gun: 30, cav: 20 }; ['arc', 'gun', 'cav'].forEach(t => { G.units[t] = true; G.researched['corps_' + t] = true; });
      G.villagers.forEach((v, i) => { v.role = FORM_TYPES[i % 4]; delete v.hp; });
      // Strategy per formation, set through the game's own stratOf so every caller sees it
      const realStrat = stratOf, LV = {}; window.stratOf = c => { const v = G.villagers.find(x => x.id === c.id); return v && LV[v.role] != null ? LV[v.role] : 0; };
      const setLv = o => Object.assign(LV, o);
      const out = {};

      // ---------- tactic data ----------
      const names = Object.fromEntries(FORM_TYPES.map(t => [t, Object.values(FORM_TACTICS[t]).map(o => o.name)]));
      check(JSON.stringify(names) === JSON.stringify({ inf: ['Hold Line', 'Aggressive Assault', 'Spear Wall'], arc: ['Aimed Volley', 'Rapid Fire', 'Harassment'], gun: ['Focused Fire', 'Suppressive Volley', 'Controlled Fire'], cav: ['Full Charge', 'Flanking Attack', 'Defensive Reserve'] }), 'Formation options wrong');
      const fam = { steady: [1, 1], charge: [1.15, 1.2], volley: [1.05, 1.05], wall: [.8, .85] };
      Object.entries(fam).forEach(([k, [d, t]]) => { const m = TACTICS[k].mod; check(m.rng === d && m.mel === d && m.take === t, 'Family numbers ' + k); });
      Object.values(TACTICS).forEach(T => { check(T.mod.rng <= 1.15 && T.mod.mel <= 1.15 && T.mod.take >= .85 - 1e-9, 'Buff over +15%'); check(T.mod.rng >= .8 && T.mod.take <= 1.2, 'Malus over 20%'); });
      check(COUNTER.wall === 'charge' && COUNTER.charge === 'volley' && COUNTER.volley === 'wall', 'Counter cycle');
      [[1, .15], [2, .17], [3, .19], [5, .23]].forEach(([l, v]) => near(counterBonus(l), v, 1e-9, 'Counter bonus Lv' + l));
      out.options = names;

      // ---------- Strategy Lv0-5: slots and round orders, every formation ----------
      out.orders = {};
      for (const t of FORM_TYPES) {
        const ks = Object.keys(FORM_TACTICS[t]); G.ftac = { [t]: [ks[0], ks[1], ks[2]] };
        const exp = { 0: [null, null, null], 1: [ks[0], ks[0], ks[0]], 2: [ks[0], ks[1], ks[1]], 3: [ks[0], ks[1], ks[2]], 4: [ks[0], ks[1], ks[2]], 5: [ks[0], ks[1], ks[2]] };
        for (let lv = 0; lv <= 5; lv++) { const got = [1, 2, 3].map(r => formOrder(t, lv, r)); check(JSON.stringify(got) === JSON.stringify(exp[lv]), `${t} Lv${lv} orders ${got}`); }
        out.orders[t] = 'Lv0-5 ok';
      }
      check([0, 1, 2, 3, 4, 5].map(orderSlots).join() === '0,1,2,3,3,3', 'Slots per level');

      // ---------- Army screen, Tactics tab: order cells per level, all formations, mobile width ----------
      const tacticsTab = () => { openPanel('army'); UI.tab = 'tactics'; refreshSheet(); };
      const cells = t => [...document.querySelectorAll(`#sh-body .tcell[data-t="${t}"]`)];
      out.dropdowns = {};
      for (let lv = 0; lv <= 5; lv++) {
        setLv({ inf: lv, arc: lv, gun: lv, cav: lv }); tacticsTab();
        const rows = FORM_TYPES.map(t => cells(t).length);
        check(rows.every(n => n === orderSlots(lv)), `Lv${lv} order cells ${rows}`);
        check(document.documentElement.scrollWidth <= innerWidth, `Army screen overflows at Lv${lv}`);
        check($('#sh-body').scrollHeight <= 900, `Tactics tab too tall at Lv${lv}: ${$('#sh-body').scrollHeight}`);
        out.dropdowns['Lv' + lv] = rows; closeSheet();
      }
      // picking an order reaches the plan; Lv1 sets all three rounds, Lv2's second cell sets Rounds 2-3
      setLv({ inf: 1, arc: 2, gun: 3, cav: 0 }); G.ftac = {}; tacticsTab();
      const pick = (t, slot, k) => { cells(t)[slot].click(); const o = document.querySelector(`#sh-body .tpick .topt[data-opt="${k}"]`); check(o, 'No picker for ' + t); o.click(); };
      pick('inf', 0, 'spear'); check(orderPlan('inf').join() === 'spear,spear,spear', 'Lv1 edit');
      pick('arc', 1, 'harass'); check(orderPlan('arc').join() === 'aimed,harass,harass', 'Lv2 edit');
      pick('gun', 2, 'suppress'); check(orderPlan('gun')[2] === 'suppress' && orderPlan('gun')[0] === 'controlled', 'Lv3 edit');
      check(cells('cav').length === 0, 'Lv0 has order cells');
      check(!/[\u3040-\u30ff\u3400-\u9fff]/.test($('#sh-body').textContent), 'Japanese text in the Tactics tab');
      // the other tabs: troops on one compact page, ninjutsu picks the preferred jutsu and toggles Auto-cast
      for (const t of ['troops', 'ninjutsu']) { UI.tab = t; refreshSheet(); check(document.documentElement.scrollWidth <= innerWidth, t + ' tab overflows'); check($('#sh-body').scrollHeight <= 900, t + ' tab too tall: ' + $('#sh-body').scrollHeight); }
      document.querySelector('#sh-body .jcard[data-j="fire"]').click(); check(G.jutsuPref === 'fire', 'Ninjutsu pick');
      const ac = autoCastOn(); $('#ar-autocast').click(); check(autoCastOn() === !ac, 'Auto-cast toggle'); $('#ar-autocast').click(); G.jutsuPref = 'smoke';
      closeSheet();

      // ---------- no cross-formation sharing ----------
      setLv({ inf: 5, arc: 2, gun: 0, cav: 1 }); const A0 = playerArmy();
      out.levels = Object.fromEntries(FORM_TYPES.map(t => [t, formLevel(A0, t)]));
      check(JSON.stringify(out.levels) === JSON.stringify({ inf: 5, arc: 2, gun: 0, cav: 1 }), 'Levels shared across formations');

      // ---------- a real battle follows the plan; Round 4+ keeps the last order ----------
      const site = PROVINCES.find(p => p.type === 'clan' && !p.capital && !p.boss);
      G.ftac = { inf: ['assault', 'spear', 'hold'], arc: ['rapid', 'harass', 'aimed'], gun: ['focused', 'suppress', 'controlled'], cav: ['charge', 'reserve', 'flank'] };
      const realAi = aiTactic; window.aiTactic = () => 'steady'; // Steady leaves nothing to adapt to: orders stay as planned
      startBattle(site.id); check(BT.state === 'prep' && /Attack/.test($('#btac').textContent), 'Deployment panel');
      for (let r = 1; r <= 5; r++) { BT.round = r - 1; beginRound(); }
      const L = BT.ftacLog; out.battleOrders = L;
      check(L[1].inf === 'assault' && L[2].inf === 'spear' && L[3].inf === 'hold' && L[5].inf === 'hold', 'Inf Lv5 per-round orders');
      check(L[1].arc === 'rapid' && L[2].arc === 'harass' && L[3].arc === 'harass' && L[5].arc === 'harass', 'Arc Lv2 orders');
      check([1, 2, 3, 5].every(r => L[r].gun === null), 'Gun Lv0 stays default');
      check([1, 2, 3, 5].every(r => L[r].cav === 'charge'), 'Cav Lv1 one order');
      // family really reaches the damage math
      const g = BT.A[0].groups.find(x => x.type === 'inf'); BT.ftac.inf = 'spear'; check(tacFam(g) === 'wall', 'tacFam'); BT.ftac.inf = null; check(tacFam(g) === 'steady', 'Lv0 fam');
      closeBattle(); window.aiTactic = realAi;

      // ---------- Round 3 adaptation: 20% x level, one roll, only Round 3 ----------
      // Enemy forms Volley Line (Precise). Wall-family orders are countered by it, so a better order exists for everyone.
      const N = 4000; out.adapt = {};
      G.ftac = { inf: ['spear', 'spear', 'spear'], arc: ['harass', 'harass', 'harass'], gun: ['suppress', 'suppress', 'suppress'], cav: ['reserve', 'reserve', 'reserve'] };
      startBattle(site.id); BT.round = 3; BT.tac[1] = 'volley'; // one battle serves all six levels: a battle start costs seconds
      for (let lv = 0; lv <= 5; lv++) {
        setLv({ inf: lv, arc: lv, gun: lv, cav: lv }); FORM_TYPES.forEach(t => BT.flv[t] = lv);
        const sw = { inf: 0, arc: 0, gun: 0, cav: 0 }, ro = { inf: 0, arc: 0, gun: 0, cav: 0 };
        for (let i = 0; i < N; i++) { FORM_TYPES.forEach(t => BT.ftac[t] = formOrder(t, BT.flv[t], 3)); BT.adapt = null; adaptFormations();
          FORM_TYPES.forEach(t => { const a = BT.adapt[t]; if (a) { ro[t]++; if (a.to !== a.from) sw[t]++; } }); }
        const want = Math.min(1, .2 * lv);
        FORM_TYPES.forEach(t => { if (lv === 0) check(ro[t] === 0, 'Lv0 rolled'); else { check(ro[t] === N, 'Missing roll'); near(sw[t] / N, want, .03, `${t} Lv${lv} adapt rate`); } });
        out.adapt['Lv' + lv] = { expected: want, rates: Object.fromEntries(FORM_TYPES.map(t => [t, +(sw[t] / N).toFixed(3)])) };
        // the switch is the beneficial one
        if (lv === 5) { check(BT.ftac.inf === 'assault' && BT.ftac.arc === 'rapid' && BT.ftac.cav === 'charge', 'Adapted order not beneficial');
          check(tacScore(FORM_TACTICS.gun[BT.ftac.gun].fam, 'volley') === 0, 'Gunners (no counter option) did not escape the counter'); }
        // one roll per battle: a second call does nothing
        if (lv >= 1) { const first = JSON.stringify(BT.adapt); adaptFormations(); check(JSON.stringify(BT.adapt) === first, 'Rerolled'); }
      }
      // a KO'd strategist cannot adapt; Rounds 1-2 never adapt; adaptation survives into Round 4+ (same battle, reset)
      setLv({ inf: 5, arc: 5, gun: 5, cav: 5 }); window.aiTactic = () => 'volley'; FORM_TYPES.forEach(t => BT.flv[t] = 5); BT.adapt = null; BT.ftacLog = {}; BT.round = 0;
      BT.A[0].groups.filter(x => x.type === 'inf').forEach(x => x.cmds.forEach(c => c.ko = true));
      for (let r = 1; r <= 4; r++) { BT.round = r - 1; beginRound(); if (r < 3) check(!BT.adapt, 'Adapted before Round 3'); }
      check(!BT.adapt.inf, 'KO strategist rolled'); check(BT.adapt.arc && BT.adapt.arc.hit, 'Lv5 must hit');
      check(BT.ftacLog[4].arc === 'rapid' && BT.ftacLog[4].arc === BT.ftacLog[3].arc, 'Round 4 lost the adapted order');
      closeBattle(); window.aiTactic = realAi;

      // ---------- Ki capacity, monthly recharge, no refill ----------
      window.stratOf = realStrat; setLv({});
      G.boons.ki = 0; const base = playerKiCap(); G.boons.ki = 2; const capDoc = playerKiCap(); G.boons.ki = 9; const capBig = playerKiCap(); G.boons.ki = 0;
      check(base >= 1 && capDoc === Math.min(3, base + 2) && capBig === 3, `Ki cap ${base}/${capDoc}/${capBig}`);
      G.boons.ki = 2; G.ki = 0; const months = []; for (let i = 0; i < 4; i++) { monthTick(); months.push(G.ki); }
      check(months.join() === '1,2,3,3', 'Monthly recharge ' + months); MQ.length = 0; $('#modal').hidden = true;
      out.ki = { capacity: { base, withDoctrine: capDoc, doctrineOverflow: capBig }, monthly: months };

      // ---------- symmetric Auto-cast window ----------
      out.eligibility = Object.fromEntries([[200, 100], [100, 200], [300, 100], [100, 300], [33, 67], [67, 33], [32, 68], [68, 32], [100, 100]].map(([a, b]) => [`${a}v${b}`, autoKiEligible(a, b)]));
      check(out.eligibility['200v100'] && out.eligibility['100v200'] && !out.eligibility['300v100'] && !out.eligibility['100v300'], 'Spec examples');
      check(out.eligibility['33v67'] && out.eligibility['67v33'] && !out.eligibility['32v68'] && !out.eligibility['68v32'], 'Inclusive bounds');

      // ---------- one useful cast per battle, actual cost, banked between battles ----------
      const realCast = castJutsu; let cast = []; window.castJutsu = (s, j) => { cast.push([s, j, BT.round]); return realCast(s, j); };
      const rearm = () => { BT.round = 0; BT.kiCast = null; BT.jutsu = [null, null]; BT.ki[0] = Math.min(BT.kiCap, G.ki ?? BT.kiCap); Object.assign(BT.autoKi, { on: autoCastOn(), pref: jutsuPref() }); };
      const fight = (opts, keep) => { cast = []; if (keep && BT) rearm(); else startBattle(site.id); check(BT.ki[1] === BT.A[1].ki, 'Enemy Ki changed'); Object.assign(BT.autoKi, opts); const ki0 = BT.ki[0], g0 = G.ki;
        for (let r = 1; r <= 4; r++) { BT.round = r - 1; beginRound(); } const mine = cast.filter(c => c[0] === 0); const res = { ki0, g0, after: G.ki, casts: mine, kiCast: BT.kiCast }; if (!keep) closeBattle(); return res; };
      G.jutsuPref = 'clone'; G.autoCast = true; G.ki = 3;
      const b1 = fight({ eligible: true }), b2 = fight({ eligible: true }, true); // two real starts: spend, then no refill
      check(b1.casts.length === 1 && b1.casts[0][1] === 'clone' && b1.after === 1 && b1.kiCast.cost === 2, 'Cast once, cost 2: ' + JSON.stringify(b1));
      check(b2.ki0 === 1 && b2.casts.length === 0 && b2.after === 1, 'Ki refilled or cast without Ki: ' + JSON.stringify(b2));
      G.ki = 3; const off = (G.autoCast = false, fight({ eligible: true, on: false }, true)); G.autoCast = true;
      check(off.casts.length === 0 && off.after === 3, 'Auto-cast off still cast');
      G.ki = 3; const inel = fight({ eligible: false }, true); check(inel.casts.length === 0 && inel.after === 3, 'Ineligible still cast');
      // not useful: Fire Scroll with no enemy archers or gunners
      G.jutsuPref = 'fire'; G.ki = 3; cast = []; rearm(); BT.autoKi.eligible = true; BT.A[1].groups.filter(x => x.type === 'gun' || x.type === 'arc').forEach(x => x.troops = 0);
      for (let r = 1; r <= 3; r++) { BT.round = r - 1; beginRound(); } check(!cast.some(c => c[0] === 0) && G.ki === 3, 'Cast with nothing to burn'); closeBattle();
      window.castJutsu = realCast;
      out.cast = { first: { kiBefore: b1.g0, kiAfter: b1.after, casts: b1.casts.length, cost: b1.kiCast.cost }, nextBattleStartsWith: b2.ki0, autoCastOff: off.casts.length, ineligible: inel.casts.length };

      // (enemy Ki untouched: checked at every battle start inside fight())

      // ---------- no pause between rounds; Retreat ends after the round ----------
      // seeded and retried: a battle that is decided outright in Round 1 never reaches the retreat, which is correct play
      const states = new Set(); let retreated = false; const R0 = Math.random;
      for (let attempt = 0; attempt < 6 && !(BT && BT.playerRetreat); attempt++) { if (BT) closeBattle(); Math.random = seeded(0x7e7 + attempt);
        G.ki = 3; startBattle(site.id); { const even = totalOf(BT.A[0]) * 20 / Math.max(1, totalOf(BT.A[1])); BT.A.forEach((A, i) => A.groups.forEach(x => { if (!x.heroOnly) { x.troops *= i ? even : 20; x.start = x.max = x.troops; } })); } beginRound(); let n = 0; retreated = false;
        while (BT && BT.state !== 'done' && n++ < 60000) { states.add(BT.state); if (BT.round === 1 && BT.state === 'run' && !retreated) { renderBHUD(); const b = $('#rs-retreat'); check(b, 'No Retreat button'); b.click(); retreated = true; } updateBattle(1 / 30); } }
      Math.random = R0;
      out.flow = { states: [...states], endedRound: BT && BT.round, result: BT && BT.result, retreated: !!(BT && BT.playerRetreat) };
      check(!states.has('tactic'), 'Battle paused for orders');
      check(BT.playerRetreat && BT.round === 1 && BT.result === 'lose', 'Retreat did not land at end of round: ' + JSON.stringify(out.flow));
      check(retreated, 'Retreat never offered');
      closeBattle();

      // ---------- an old save without the new fields loads and fights ----------
      ['ftac', 'ki', 'jutsuPref', 'autoCast'].forEach(k => delete G[k]); check(saveGame(), 'Save failed');
      G = null; check(loadGame(), 'Old save did not load'); afterLoad(); MQ.length = 0; $('#modal').hidden = true;
      check(jutsuPref() === 'smoke' && autoCastOn() && kiNow() === playerKiCap() && orderPlan('inf').join() === 'hold,hold,hold', 'Defaults for old save');
      startBattle(site.id); beginRound(); let m = 0; while (BT && BT.state !== 'done' && m++ < 60000) updateBattle(1 / 30); check(BT && BT.state === 'done', 'Old-save battle did not finish');
      out.oldSave = { loaded: true, battle: BT.result }; closeBattle();
      return out;
    });
    assert.deepStrictEqual(errors, []);
    fs.writeFileSync(dir + '/reports/tactics.json', JSON.stringify({ ...report, errors }, null, 2));
    console.log(JSON.stringify({ ...report, errors }, null, 2));
  } finally { await browser.close(); server.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
