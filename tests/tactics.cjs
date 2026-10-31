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
      newGame(); G.tut = 1; G.speed = 0; G.boons.pending = null; G.roll.v = false; $('#title').hidden = true; resizeView(); afterLoad(); MQ.length = 0; $('#modal').hidden = true;
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

      // ---------- Army screen: dropdowns per level, all formations, mobile width ----------
      out.dropdowns = {};
      for (let lv = 0; lv <= 5; lv++) {
        setLv({ inf: lv, arc: lv, gun: lv, cav: lv }); openPanel('army');
        const rows = [...document.querySelectorAll('#sh-body .ftac')].map(f => f.querySelectorAll('select').length);
        check(rows.length === 4 && rows.every(n => n === orderSlots(lv)), `Lv${lv} dropdowns ${rows}`);
        check(document.documentElement.scrollWidth <= innerWidth, `Army screen overflows at Lv${lv}`);
        out.dropdowns['Lv' + lv] = rows; closeSheet();
      }
      // a dropdown edit reaches the plan; Lv1 sets all three rounds, Lv2's second slot sets Rounds 2-3
      setLv({ inf: 1, arc: 2, gun: 3, cav: 0 }); G.ftac = {}; openPanel('army');
      const sel = t => [...document.querySelectorAll('#sh-body .troop')].find(r => r.querySelector(`select[aria-label^="${UNITS[t].name} "]`))?.querySelectorAll('.ftac select');
      const pickSel = (s, v) => { s.value = v; s.onchange(); };
      pickSel(sel('inf')[0], 'spear'); check(orderPlan('inf').join() === 'spear,spear,spear', 'Lv1 edit');
      pickSel(sel('arc')[1], 'harass'); check(orderPlan('arc').join() === 'aimed,harass,harass', 'Lv2 edit');
      pickSel(sel('gun')[2], 'suppress'); check(orderPlan('gun')[2] === 'suppress' && orderPlan('gun')[0] === 'controlled', 'Lv3 edit');
      check(!sel('cav') || sel('cav').length === 0, 'Lv0 has no dropdown');
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
      for (let lv = 0; lv <= 5; lv++) {
        setLv({ inf: lv, arc: lv, gun: lv, cav: lv }); startBattle(site.id); BT.round = 3; BT.tac[1] = 'volley';
        const sw = { inf: 0, arc: 0, gun: 0, cav: 0 }, ro = { inf: 0, arc: 0, gun: 0, cav: 0 };
        for (let i = 0; i < N; i++) { FORM_TYPES.forEach(t => BT.ftac[t] = formOrder(t, BT.flv[t], 3)); BT.adapt = null; adaptFormations();
          FORM_TYPES.forEach(t => { const a = BT.adapt[t]; if (a) { ro[t]++; if (a.to !== a.from) sw[t]++; } }); }
        const want = Math.min(1, .2 * lv);
        FORM_TYPES.forEach(t => { if (lv === 0) check(ro[t] === 0, 'Lv0 rolled'); else { check(ro[t] === N, 'Missing roll'); near(sw[t] / N, want, .03, `${t} Lv${lv} adapt rate`); } });
        out.adapt['Lv' + lv] = { expected: want, rates: Object.fromEntries(FORM_TYPES.map(t => [t, +(sw[t] / N).toFixed(3)])) };
        // the switch is the beneficial one
        if (lv === 5) check(BT.ftac.inf === 'assault' && BT.ftac.arc === 'rapid' && BT.ftac.cav === 'charge' && BT.ftac.gun === 'controlled', 'Adapted order not beneficial');
        // one roll per battle: a second call does nothing
        if (lv >= 1) { const first = JSON.stringify(BT.adapt); adaptFormations(); check(JSON.stringify(BT.adapt) === first, 'Rerolled'); }
        closeBattle();
      }
      // a KO'd strategist cannot adapt; Rounds 1-2 never adapt; adaptation survives into Round 4+
      setLv({ inf: 5, arc: 5, gun: 5, cav: 5 }); window.aiTactic = () => 'volley'; startBattle(site.id);
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
      const fight = (opts) => { cast = []; startBattle(site.id); Object.assign(BT.autoKi, opts); const ki0 = BT.ki[0], g0 = G.ki;
        for (let r = 1; r <= 4; r++) { BT.round = r - 1; beginRound(); } const mine = cast.filter(c => c[0] === 0); const res = { ki0, g0, after: G.ki, casts: mine, kiCast: BT.kiCast }; closeBattle(); return res; };
      G.jutsuPref = 'clone'; G.autoCast = true; G.ki = 3;
      const b1 = fight({ eligible: true }), b2 = fight({ eligible: true });
      check(b1.casts.length === 1 && b1.casts[0][1] === 'clone' && b1.after === 1 && b1.kiCast.cost === 2, 'Cast once, cost 2: ' + JSON.stringify(b1));
      check(b2.ki0 === 1 && b2.casts.length === 0 && b2.after === 1, 'Ki refilled or cast without Ki: ' + JSON.stringify(b2));
      G.ki = 3; const off = (G.autoCast = false, fight({ eligible: true, on: false })); G.autoCast = true;
      check(off.casts.length === 0 && off.after === 3, 'Auto-cast off still cast');
      G.ki = 3; const inel = fight({ eligible: false }); check(inel.casts.length === 0 && inel.after === 3, 'Ineligible still cast');
      // not useful: Fire Scroll with no enemy archers or gunners
      G.jutsuPref = 'fire'; G.ki = 3; cast = []; startBattle(site.id); BT.autoKi.eligible = true; BT.A[1].groups.filter(x => x.type === 'gun' || x.type === 'arc').forEach(x => x.troops = 0);
      for (let r = 1; r <= 3; r++) { BT.round = r - 1; beginRound(); } check(!cast.some(c => c[0] === 0) && G.ki === 3, 'Cast with nothing to burn'); closeBattle();
      window.castJutsu = realCast;
      out.cast = { first: { kiBefore: b1.g0, kiAfter: b1.after, casts: b1.casts.length, cost: b1.kiCast.cost }, nextBattleStartsWith: b2.ki0, autoCastOff: off.casts.length, ineligible: inel.casts.length };

      // ---------- enemy Ki untouched ----------
      startBattle(site.id); check(BT.ki[1] === BT.A[1].ki, 'Enemy Ki changed'); closeBattle();

      // ---------- no pause between rounds; Retreat ends after the round ----------
      G.ki = 3; startBattle(site.id); beginRound(); const states = new Set(); let n = 0, retreated = false;
      while (BT && BT.state !== 'done' && n++ < 60000) { states.add(BT.state); if (BT.round === 1 && BT.state === 'run' && !retreated) { renderBHUD(); const b = $('#rs-retreat'); check(b, 'No Retreat button'); b.click(); retreated = true; } updateBattle(1 / 30); }
      out.flow = { states: [...states], endedRound: BT && BT.round, result: BT && BT.result, retreated: !!(BT && BT.playerRetreat) };
      check(!states.has('tactic'), 'Battle paused for orders');
      if (retreated) check(BT.playerRetreat && BT.round === 1, 'Retreat did not land at end of round');
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
