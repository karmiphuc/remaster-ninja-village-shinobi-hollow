// Castle sieges: a standing gate shelters its defenders (attacking infantry and cavalry strike only the gate, the
// defenders' infantry and cavalry never attack, archers and gunners still trade volleys, duels still happen), the
// breach restarts the fight cleanly at Round 1 with survivors, casualties, commanders and Ki carried over; and siege
// engines bought one by one before the attack (Bombards: 2 max, 4,000/5,000G, gate only; Hwacha: 4 max,
// 2,000–3,500G, rampart defenders only, diminishing), refundable until the attack. Writes reports/siege.json.
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
    const report = await p.evaluate(() => {
      const check = (x, m) => { if (!x) throw Error(m); };
      const clearModals = () => { MQ.length = 0; $('#modal').hidden = true; };
      const seeded = s => () => (s = (s * 16807) % 2147483647) / 2147483647;
      const castle = PROVINCES.find(q => q.id === 'yamashiro'), out = {};
      const fresh = () => { newGame(); G.tut = 1; G.speed = 0; G.boons.pending = null; G.roll.v = false; $('#title').hidden = true; resizeView(); afterLoad(); clearModals();
        ['arc', 'gun', 'cav'].forEach(t => { G.researched['corps_' + t] = 1; G.units[t] = true; });
        G.villagers.forEach((v, i) => { v.role = ['inf', 'inf', 'cav', 'gun', 'arc'][i] || 'work'; delete v.hp; }); G.allHands = false;
        G.troops = { inf: 900, arc: 400, gun: 500, cav: 300 }; G.ki = 0; G.gold = 50000; };
      // a log of every blow, tagged with whether the gate stood when it was struck
      let log = [], phases = [], rounds = [];
      const wrap = () => { const W = {}; ['resolvePhase', 'interceptHits', 'counterHits'].forEach(n => { W[n] = window[n]; window[n] = (...a) => { const hs = W[n](...a); hs.forEach(h => log.push({ fn: n, hold: siegeHold(), fs: sideOf(h.from), ft: h.from.type, ts: sideOf(h.to), tt: h.to.type, kills: h.kills, icpt: !!h.icpt })); return hs; }; });
        W.equipmentGrenades = window.equipmentGrenades; window.equipmentGrenades = (ph, hits, ctx) => { const n = hits.length; W.equipmentGrenades(ph, hits, ctx); hits.slice(n).forEach(h => log.push({ fn: 'grenade', hold: siegeHold(), fs: sideOf(h.from), ft: h.from.type })); };
        W.runPhase = window.runPhase; window.runPhase = ph => { phases.push({ p: ph, seq: BT.roundSeq, round: BT.round, hold: siegeHold() }); return W.runPhase(ph); };
        W.beginRound = window.beginRound; window.beginRound = () => { const r = W.beginRound(); rounds.push({ seq: BT.roundSeq, round: BT.round, hold: siegeHold(), ki: BT.ki[0] }); return r; };
        return () => Object.entries(W).forEach(([k, f]) => window[k] = f); };
      const play = (until) => { let n = 0; while (BT && BT.state !== 'done' && n++ < 30000 && !(until && until())) updateBattle(1 / 5); };

      // ---------- P0: the gate holds ----------
      fresh(); G.researched.siegegun = 1; check(startBattle(castle.id) && BT.siege && siegeHold(), 'Siege did not start');
      BT.siege.hp = BT.siege.max = 1e9; // the gate never falls here
      BT.autoKi.on = false; log = []; phases = []; rounds = [];
      let unwrap = wrap(); const R = Math.random; Math.random = seeded(7);
      try { beginRound(); play(() => BT.round > 2 && BT.state === 'autowait'); } finally { Math.random = R; unwrap(); }
      check(BT.siege.hp < 1e9, 'Nothing struck the gate');
      const held = log.filter(h => h.hold);
      const meleeIn = held.filter(h => h.fs === 0 && (h.ft === 'inf' || h.ft === 'cav') && h.ts === 1);
      const meleeOut = held.filter(h => h.fs === 1 && (h.ft === 'inf' || h.ft === 'cav'));
      const grenades = held.filter(h => h.fn === 'grenade');
      check(!meleeIn.length, 'Attacking melee struck troops behind the gate: ' + JSON.stringify(meleeIn[0]));
      check(!meleeOut.length, 'Defending melee attacked before the breach: ' + JSON.stringify(meleeOut[0]));
      check(!grenades.length, 'Grenades thrown over a standing gate');
      const rangedOut = held.filter(h => h.fs === 0 && (h.ft === 'gun' || h.ft === 'arc') && !h.icpt).length, rangedIn = held.filter(h => h.fs === 1 && (h.ft === 'gun' || h.ft === 'arc')).length;
      check(rangedOut > 0 && rangedIn > 0, `Ranged exchange missing: ours ${rangedOut}, theirs ${rangedIn}`);
      check(held.filter(h => h.icpt && h.fs === 0).length === 0, 'We shot at defenders who never charged');
      const seen = new Set(); phases.forEach(x => { const k = x.seq + x.p; check(!seen.has(k), 'Phase ran twice: ' + k); seen.add(k); });
      out.gateHolds = { rounds: BT.round, blowsWhileHeld: held.length, rangedOurs: rangedOut, rangedTheirs: rangedIn, meleeIntoTheGate: 0, defendingMeleeAttacks: 0, gateDamage: Math.round(1e9 - BT.siege.hp) };
      closeBattle(); clearModals();
      // duels: still offered while the gate stands
      fresh(); check(startBattle(castle.id), 'restart'); BT.siege.hp = BT.siege.max = 1e9; BT.round = 1; BT.duelRound = null; BT.auto = true;
      { const R2 = Math.random; Math.random = () => .01; let ok; try { ok = preDuel(); } finally { Math.random = R2; } check(ok && BT.phaseName === 'duel' && siegeHold(), 'No duel before the breach'); out.duelBeforeBreach = true; }
      closeBattle(); clearModals();

      // ---------- P0: the breach restarts at Round 1 ----------
      fresh(); check(startBattle(castle.id), 'restart 2'); BT.autoKi.on = false; G.ki = 2; BT.ki[0] = 2;
      log = []; phases = []; rounds = []; unwrap = wrap(); let breachSeq = null, koName = null; const rp = window.runPhase;
      // keep the gate up through Round 1, then let it fall to the ram in Round 2's infantry phase
      BT.siege.hp = BT.siege.max = 1e9; BT.A[1].groups.forEach(g => { if (!g.heroOnly) { g.troops *= .25; g.start = g.max = g.troops; } }); // a garrison we can outlast
      window.runPhase = ph => { if (ph === 'inf' && BT.roundSeq === 2 && breachSeq == null) { BT.siege.hp = 1; breachSeq = 2; const c = BT.A[0].groups.flatMap(g => g.cmds || []).find(c => c.vref && !c.ko); if (c) { c.ko = true; koName = c.name; } } return rp(ph); };
      Math.random = seeded(11);
      try { beginRound(); play(() => rounds.some(r => r.seq === 4)); } finally { Math.random = R; unwrap(); window.runPhase = rp; }
      check(BT.siege.breached, 'The gate did not fall');
      const r2 = phases.filter(x => x.seq === 2).map(x => x.p);
      check(r2.join() === 'gun,arc,inf', 'Round 2 should stop at the breach: ' + r2.join());
      const after = rounds.find(r => r.seq === 3); check(after && after.round === 1 && !after.hold, 'Did not restart at Round 1: ' + JSON.stringify(rounds));
      check(BT.maxR === 3 && BT.breachRestarted === 1, 'Open-combat rounds');
      check(after.ki === 2, 'Ki changed at the breach: ' + after.ki);
      if (koName) check(BT.A[0].groups.flatMap(g => g.cmds || []).some(c => c.name === koName && c.ko), 'Commander state lost at the breach');
      const open = log.filter(h => !h.hold);
      check(open.some(h => h.fs === 0 && h.ft === 'inf' && h.ts === 1) || open.some(h => h.fs === 1 && h.ft === 'inf'), 'No melee after the breach');
      const s3 = new Set(); phases.forEach(x => { const k = x.seq + x.p; check(!s3.has(k), 'Phase ran twice: ' + k); s3.add(k); });
      out.breach = { brokeInRound: 2, round2Phases: r2, nextRound: after.round, ki: after.ki, commanderKoKept: koName, meleeAfterBreach: open.filter(h => h.ft === 'inf' || h.ft === 'cav').length };
      play(); check(BT && BT.state === 'done' && BT.result, 'Siege did not finish'); out.breach.result = BT.result; closeBattle(); clearModals();

      // ---------- P1: buying, caps, refunds ----------
      fresh(); G.gold = 30000; check(startBattle(castle.id), 'restart 3'); check(BT.state === 'prep', 'Not in deployment');
      // locked without the research
      showTacticPanel(); check(/Research the Siege Battery|Siege engines/.test($('#btac').textContent) && !$('#btac [data-eng-more]'), 'Engines offered without research');
      G.researched.siegegun = 1; showTacticPanel();
      const more = k => $(`#btac [data-eng-more="${k}"]`), less = k => $(`#btac [data-eng-less="${k}"]`), txt = () => $('#btac').textContent;
      check(/Bombard/.test(txt()) && /Hwacha/.test(txt()) && /Next 4,000G/.test(txt()) && /Next 2,000G/.test(txt()), 'Deployment rows');
      check(/Batters the gate/.test(more('bombard').closest('.engine').innerHTML) && /ramparts/.test(more('hwacha').closest('.engine').innerHTML), 'Engine roles not shown');
      const paid = []; let g0 = G.gold;
      more('bombard').click(); paid.push(g0 - G.gold); g0 = G.gold; more('bombard').click(); paid.push(g0 - G.gold); g0 = G.gold;
      check(paid.join() === '4000,5000' && engN('bombard') === 2, 'Bombard costs ' + paid.join()); check(more('bombard').disabled && !engBuy('bombard') && G.gold === g0, 'Third Bombard');
      for (let i = 0; i < 4; i++) { more('hwacha').click(); paid.push(g0 - G.gold); g0 = G.gold; }
      check(paid.slice(2).join() === '2000,2500,3000,3500' && engN('hwacha') === 4, 'Hwacha costs ' + paid.join()); check(more('hwacha').disabled && !engBuy('hwacha') && G.gold === g0, 'Fifth Hwacha');
      check(/2\/2/.test(txt()) && /4\/4/.test(txt()) && /20,000G, refundable/.test(txt()), 'Totals shown: ' + txt().slice(0, 300));
      check(BT.props.filter(q => q.k === 'mortar').length === 2 && BT.props.filter(q => q.k === 'hwacha').length === 4, 'Engines not drawn');
      less('hwacha').click(); check(G.gold - g0 === 3500 && engN('hwacha') === 3, 'Hwacha refund'); g0 = G.gold; less('bombard').click(); check(G.gold - g0 === 5000 && engN('bombard') === 1, 'Bombard refund');
      check(/Next 5,000G/.test(txt()) && /Next 3,500G/.test(txt()), 'Escalating price after refunds');
      // not enough gold
      G.gold = 1000; showTacticPanel(); check(more('bombard').disabled && !engBuy('bombard') && G.gold === 1000, 'Bought without gold'); G.gold = 30000 - (4000 + 2000 + 2500 + 3000); showTacticPanel();
      // withdraw refunds everything
      const gw = G.gold; $('#bt-retreat').click(); clearModals(); check(G.gold === gw + 4000 + 2000 + 2500 + 3000, 'Withdraw refund: ' + (G.gold - gw));
      out.buying = { bombard: '4,000 / 5,000 (max 2)', hwacha: '2,000 / 2,500 / 3,000 / 3,500 (max 4)', refunds: 'last bought, full price', withdraw: 'all refunded' };
      // ---------- P1: one siege with 2 Bombards and 4 Hwacha ----------
      fresh(); G.researched.siegegun = 1; G.troops = { inf: 900, arc: 400, gun: 0, cav: 300 }; G.villagers.forEach(v => { if (v.role === 'gun') v.role = 'work'; }); // no gunfire at the gate but the Bombards'
      check(startBattle(castle.id), 'engine battle'); for (let i = 0; i < 2; i++) check(engBuy('bombard'), 'buy b'); for (let i = 0; i < 4; i++) check(engBuy('hwacha'), 'buy h');
      BT.siege.hp = BT.siege.max = 100000; BT.autoKi.on = false; BT.engLog = []; const gA = G.gold; beginRound();
      check(!engRefund('bombard') && !engBuy('hwacha') && G.gold === gA && engN('bombard') === 2 && engN('hwacha') === 4, 'Refund or purchase after the attack'); out.afterAttack = 'locked';
      const snap = BT.A[1].groups.map(g => g.troops), hp0 = BT.siege.hp; let n = 0;
      while (BT && BT.phase < 1 && n++ < 3000) updateBattle(1 / 5); while (BT && BT.phaseName === 'gun' && n++ < 6000) updateBattle(1 / 5); // through the gun phase: ours is empty, so only the engines fire
      const loss = Object.fromEntries(BT.A[1].groups.map((g, i) => [g.type, snap[i] - g.troops])), shells = BT.engLog.filter(e => e[0] === 'shell'), rk = BT.engLog.filter(e => e[0] === 'rockets');
      check(shells.length === 2 && Math.abs(hp0 - BT.siege.hp - 40000) < 1e-6, `Two Bombards: ${shells.length} shells, gate −${hp0 - BT.siege.hp} (Hwacha add nothing to the gate)`);
      check(rk.length === 4 && rk.every(e => e[3] === 'gun' || e[3] === 'arc'), 'Hwacha volleys: ' + JSON.stringify(rk));
      check(['inf', 'cav'].every(t => !(loss[t] > 1e-9)), 'Engines killed sheltered infantry or cavalry: ' + JSON.stringify(loss));
      const ks = rk.map(e => e[4]), base = ks[0]; check(ks.every((k, i) => Math.abs(k - base * ENGINES.hwacha.dim[i]) < 1e-6) && rk.every(e => e[2] <= e[4] + 1e-9), 'Hwacha returns not diminishing: ' + ks.join());
      check(rk.reduce((a, e) => a + e[2], 0) <= ['gun', 'arc'].reduce((a, t) => a + (loss[t] || 0), 0) + 1e-6, 'Hwacha kills not on the ramparts');
      out.engines = { bombardsGate: '-40% of the gate from 2 shells (20% each)', hwachaPlanned: ks.map(k => +k.toFixed(1)), hwachaActual: rk.map(e => +e[2].toFixed(1)), hwachaTargets: [...new Set(rk.map(e => e[3]))], meleeLosses: 0 };
      // nobody left on the ramparts: the Hwacha strike no one
      BT.A[1].groups.forEach(g => { if (g.type === 'gun' || g.type === 'arc') g.troops = 0; }); BT.engLog = []; BT.script = { dur: 0, ev: [], i: 0, wins: [] }; engineScript();
      { const t1 = totalOf(BT.A[1]); BT.script.ev.filter(e => e.k === 'rockets' || e.k === 'hwacha').forEach(e => batteryEvent(e)); check(totalOf(BT.A[1]) === t1 && !BT.engLog.length, 'Hwacha hit someone with no one on the ramparts'); }
      // a ball in flight when the gate falls strikes nothing; after the breach the engines fall silent
      { const pend = BT.script.ev.filter(e => e.k === 'shell'), hp1 = BT.siege.hp; check(pend.length === 2, 'Shell events'); breachGate(); const t0 = totalOf(BT.A[1]);
        pend.forEach(e => batteryEvent(e)); check(totalOf(BT.A[1]) === t0 && BT.siege.hp === hp1 && !BT.engLog.length, 'A shell struck after the breach'); }
      BT.script = null; BT.phase = PHASES.length; BT.state = 'between'; BT.next = 0; n = 0; const fired = []; const es = window.engineScript; window.engineScript = () => { fired.push(BT.roundSeq); es(); };
      try { while (BT && BT.state !== 'done' && n++ < 30000) updateBattle(1 / 5); } finally { window.engineScript = es; }
      check(!fired.length, 'Engines fired after the breach'); out.afterBreach = 'silent'; if (BT) { closeBattle(); clearModals(); }
      // the AI never fields engines, and field battles offer none
      fresh(); G.researched.siegegun = 1; const lair = PROVINCES.find(q => q.type === 'bandit'); check(startBattle(lair.id), 'field'); showTacticPanel(); check(!$('#btac [data-eng-more]') && !engBuy('bombard'), 'Engines in a field battle'); closeBattle(); clearModals();
      out.ai = 'no engines for defenders or in field battles';
      // saves are untouched
      fresh(); check(saveGame(), 'save'); G = null; check(loadGame(), 'load'); afterLoad(); clearModals(); check(G && !('eng' in G), 'Save shape'); out.save = true;
      return out;
    });
    assert.deepStrictEqual(errors, []);
    fs.mkdirSync(dir + '/reports', { recursive: true });
    fs.writeFileSync(dir + '/reports/siege.json', JSON.stringify({ ...report, errors }, null, 2));
    console.log(JSON.stringify({ ...report, errors }, null, 2));
  } finally { await browser.close(); server.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
