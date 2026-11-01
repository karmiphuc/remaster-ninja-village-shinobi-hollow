// Campaign fixes: the province count excludes the training grounds (49 holdable, so the map can reach 49/49); the dojo
// puts up a rolled prize (recruits of an unlocked arm, latest armor or horse, or a free commander or worker) with
// stronger partners for bigger prizes; and a province lost to rebels keeps its old budget or the uprising's strength
// with freshly rolled spoils instead of its one-time rewards. Writes reports/campaign.json.
const fs = require('fs'), http = require('http'), assert = require('assert'), path = require('path'), { chromium } = require('playwright');
const dir = path.resolve(__dirname, '..');
const ignorable = t => /Failed to load resource: net::ERR_(TUNNEL_CONNECTION_FAILED|FAILED|NAME_NOT_RESOLVED|INTERNET_DISCONNECTED)/.test(t);
(async () => {
  const server = http.createServer((q, r) => { r.setHeader('Content-Type', 'text/html'); r.end(fs.readFileSync(dir + '/index.html')); });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH || (fs.existsSync('/usr/bin/chromium') ? '/usr/bin/chromium' : undefined), args: ['--no-sandbox'] });
  try {
    const p = await browser.newPage({ viewport: { width: 390, height: 844 } }), errors = [];
    p.on('pageerror', e => errors.push(e.message)); p.on('console', m => {  if (m.type() === 'error' && !ignorable(m.text())) errors.push(m.text()); });
    await p.addInitScript(() => { window.__noIntro = true; window.__noQuick = true; });
    await p.goto('http://127.0.0.1:' + server.address().port);
    const report = await p.evaluate(async () => {
      const wait = ms => new Promise(r => setTimeout(r, ms));
      const check = (x, m) => { if (!x) throw Error(m); };
      const fresh = () => { newGame(); G.tut = 1; G.speed = 0; G.boons.pending = null; G.roll.v = false; $('#title').hidden = true; resizeView(); afterLoad(); MQ.length = 0; $('#modal').hidden = true; };
      const clearModals = () => { MQ.length = 0; $('#modal').hidden = true; };
      // the result comes from who is left standing, so the losing side is routed before the battle is closed
      const endAs = res => { BT.A[res === 'win' ? 1 : 0].groups.forEach(g => g.troops = 0); check(finishBattle(res) !== false, 'Battle did not end'); check(BT.result === res, 'Result ' + BT.result); };
      const out = {}; fresh();

      // ---------- 1. the province count can be completed ----------
      const T = provinceTally(), dojo = PROVINCES.find(q => q.type === 'dojo');
      check(T.total === PROVINCES.length - PROVINCES.filter(q => q.type === 'dojo').length && T.total === 49, 'Total ' + T.total);
      PROVINCES.filter(conquerable).forEach(q => G.prov[q.id].owner = 'kage');
      const full = provinceTally(); check(full.owned === 49 && full.total === 49, 'Cannot reach 49/49');
      openMap(); check(/49\/49 provinces/.test($('#map-info').textContent), 'Map still shows the dojo in the total: ' + $('#map-info').textContent); MAPV.open = false;
      openPanel('menu'); UI.tab = 'stats'; refreshSheet(); check(/49 \/ 49/.test($('#sh-body').textContent), 'Ledger total'); closeSheet();
      out.provinces = { holdable: T.total, dojoExcluded: dojo.name, completes: '49/49' };

      // ---------- 2. the dojo's rolled prizes ----------
      fresh(); for (const k in ITEMS) if (!ITEMS[k].rare && k.indexOf('rcp_') !== 0) G.researched[k] = 1; ['arc', 'gun', 'cav'].forEach(t => { G.researched['corps_' + t] = 1; G.units[t] = true; });
      G.troops = { inf: 200, arc: 100, gun: 100, cav: 50 };
      const seen = {}; for (let i = 0; i < 400; i++) { G.dojoPrize = null; const P = dojoPrize(); check(dojoPrizeValid(P), 'Invalid prize ' + JSON.stringify(P)); seen[P.kind] = (seen[P.kind] || 0) + 1;
        if (P.kind === 'troops') check(troopsOpen(P.t), 'Locked arm'); if (P.kind === 'armor') check(ITEMS[P.k].slot === 'armor' && P.k === latestGear(I => I.slot === 'armor'), 'Not the latest armor');
        if (P.kind === 'horse') check(isHorse(P.k), 'Not a horse'); if (P.kind === 'person') check(!vById(P.id), 'Prize person already in the village'); }
      check(['troops', 'armor', 'horse', 'person'].every(k => seen[k] > 20), 'Some prize never rolled: ' + JSON.stringify(seen));
      const first = dojoPrize(); check(dojoPrize() === first, 'Prize rerolls before the spar');
      // a locked arm is never offered
      fresh(); for (let i = 0; i < 100; i++) { G.dojoPrize = null; const P = dojoPrize(); if (P.kind === 'troops') check(P.t === 'inf', 'Offered a locked arm: ' + P.t); }
      // bigger prizes, stronger partners
      fresh(); for (const k in ITEMS) if (!ITEMS[k].rare && k.indexOf('rcp_') !== 0) G.researched[k] = 1; G.troops = { inf: 200, arc: 0, gun: 0, cav: 0 };
      const pw = kind => { G.dojoPrize = Object.assign({ kind, mul: DOJO_PRIZE[kind].mul }, kind === 'troops' ? { t: 'inf' } : kind === 'person' ? { id: freeRecruitsNow()[0].id } : { k: latestGear(I => I.slot === 'armor') });
        const R = Math.random; Math.random = () => .5; try { return armyPower(enemyArmy(dojo)); } finally { Math.random = R; } };
      const pt = pw('troops'), pp = pw('person'); check(pp > pt * 1.25, `Person prize not harder: ${pt} vs ${pp}`);
      { G.dojoPrize = null; const P = dojoPrize(); openMap(); showProvCard(dojo); const txt = $('#prov-card').textContent, want = P.kind === 'troops' ? UNITS[P.t].name + ' recruits' : P.kind === 'person' ? vData(P.id).name : ITEMS[P.k].name;
        check(txt.includes(want) && /No troop losses/.test(txt), 'Dojo card lacks the prize: ' + want); $('#prov-card').hidden = true; closeMap(); out.dojoCard = want; }
      out.dojo = { rolls: seen, partnerPower: { troops: Math.round(pt), armor: Math.round(pw('armor')), person: Math.round(pp) } };
      // payouts through the real battle end
      const spar = (prize, res) => { G.dojoPrize = prize; G.trainCD = 0; check(startBattle(dojo.id), 'Spar did not start'); endAs(res); closeBattle(); clearModals(); };
      let before = G.troops.inf; spar({ kind: 'troops', t: 'inf', mul: .75 }, 'win'); check(G.troops.inf - before === Math.max(10, Math.round(200 * .08)), 'Troop prize ' + (G.troops.inf - before)); check(!G.dojoPrize || G.dojoPrize.kind, 'Prize not rerolled');
      const ak = latestGear(I => I.slot === 'armor'); before = G.items[ak] || 0; spar({ kind: 'armor', k: ak, mul: .9 }, 'win'); check((G.items[ak] || 0) === before + 1, 'Armor prize');
      const hk = latestGear((I, k) => I.slot === 'mount' && isHorse(k)); before = G.items[hk] || 0; spar({ kind: 'horse', k: hk, mul: .9 }, 'win'); check((G.items[hk] || 0) === before + 1, 'Horse prize');
      const pid = freeRecruitsNow()[0].id; let offered = null; const oh = window.offerHire; window.offerHire = (id, kind) => { offered = [id, kind]; };
      spar({ kind: 'person', id: pid, mul: 1.05 }, 'win'); await wait(150); check(offered && offered[0] === pid && offered[1] === 'rebel', 'Person prize not offered free: ' + JSON.stringify(offered));
      const ak0 = G.items[ak] || 0, gold0 = G.gold, troops0 = Object.values(G.troops).reduce((a, b) => a + b, 0); spar({ kind: 'armor', k: ak, mul: .9 }, 'lose');
      const troops1 = Object.values(G.troops).reduce((a, b) => a + b, 0);
      check(troops1 > troops0 && G.gold === gold0 && (G.items[ak] || 0) === ak0, 'Loss should give only a few recruits');
      out.dojoPayouts = { troopsOnWin: Math.max(10, Math.round(200 * .08)), armor: ITEMS[ak].name, horse: ITEMS[hk].name, personOffered: vData(pid).name, lossConsolation: troops1 - troops0 };

      // Late-game armies cannot turn one spar into hundreds of specialist troops.
      fresh(); ['arc', 'gun', 'cav'].forEach(t => { G.researched['corps_' + t] = 1; G.units[t] = true; });
      const caps = { inf: 100, arc: 50, gun: 30, cav: 20 }, capped = {};
      for (const [t, cap] of Object.entries(caps)) {
        G.troops = { inf: 0, arc: 0, gun: 0, cav: 0 }; G.troops[t] = 100000;
        G.dojoPrize = { kind: 'troops', t, mul: .75, n: 8000 }; // already-rolled saves also use the cap
        check(dojoPrizeChip(dojoPrize()).includes('×' + cap), 'Preview exceeds ' + t + ' cap');
        const messages = [], before = G.troops[t]; dojoPayout('win', messages);
        check(G.troops[t] - before === cap && messages.some(s => s.includes('+' + cap + ' ')), 'Uncapped victory payout for ' + t);
        const below = Math.floor((cap - 1) / .08); G.troops[t] = below; G.dojoPrize = { kind: 'troops', t, mul: .75 };
        dojoPayout('win', []); check(G.troops[t] - below === cap - 1, 'Below-cap reward changed for ' + t);
        G.troops[t] = 100000; G.dojoPrize = { kind: 'troops', t, mul: .75 }; const lossMessages = [];
        dojoPayout('lose', lossMessages);
        check(G.troops[t] - 100000 === cap && lossMessages.some(s => s.includes('+' + cap + ' recruits')), 'Consolation bypasses cap or displays wrong count for ' + t);
        capped[t] = cap;
      }
      G.troops = { inf: 100000, arc: 100000, gun: 100000, cav: 100000 };
      const mixBefore = { ...G.troops }, mixMessages = []; G.dojoPrize = { kind: 'troops', t: 'cav', mul: .75 }; dojoPayout('lose', mixMessages);
      for (const t in caps) check(G.troops[t] - mixBefore[t] === caps[t], 'Mixed consolation exceeds ' + t + ' cap');
      check(mixMessages.some(s => s.includes('+200 recruits')), 'Mixed consolation reports uncapped total');
      G.troops = { inf: 10000, arc: 0, gun: 0, cav: 0 }; G.dojoPrize = { kind: 'troops', t: 'cav', mul: .75 };
      openMap(); showProvCard(dojo); check($('#prov-card').textContent.includes('Cavalry recruits ×20'), 'Training Ground card lacks capped quantity'); $('#prov-card').hidden = true; closeMap();
      G.troops = { inf: 0, arc: 0, gun: 0, cav: 0 }; G.dojoPrize = { kind: 'troops', t: 'inf', mul: .75 }; dojoPayout('win', []);
      check(G.troops.inf === 10, 'Early minimum changed');
      out.dojoRecruitCaps = { winAndConsolation: capped, belowCapPreserved: true, earlyMinimum: 10, mixedConsolationTotal: 200, previewMatchesPayout: true, alreadyRolledPrizeCapped: true };

      // ---------- 3. a province lost to rebels ----------
      fresh(); for (const k in ITEMS) if (!ITEMS[k].rare && k.indexOf('rcp_') !== 0) G.researched[k] = 1; G.troops = { inf: 400, arc: 0, gun: 0, cav: 0 };
      const lair = PROVINCES.find(q => q.type === 'bandit'), castle = PROVINCES.find(q => q.type === 'clan' && !q.capital && !q.boss && q.reward && (q.reward.item || q.reward.recruit));
      [lair, castle].forEach(q => G.prov[q.id].owner = 'kage');
      const lose = (q, r) => { spawnRebellion(q); clearModals(); const c = G.camps.find(x => x.rebel === q.id); c.expires = monthIdx(); const R = Math.random; if (r) Math.random = () => r; try { rebelTick(); } finally { Math.random = R; } clearModals(); return c; };
      const p0 = G.prov[lair.id].power, c1 = lose(lair), st = G.prov[lair.id];
      check(st.owner === lair.clan && st.power >= Math.round(c1.power * 1.2) && st.power >= p0, `Lair came back weak: ${p0} -> ${st.power} (uprising ${c1.power})`);
      check(st.retake && (st.retake.items.length + st.retake.recruits.length) > 0, 'No rerolled spoils');
      { openMap(); showProvCard(lair); const txt = $('#prov-card').textContent; st.retake.items.forEach(k => check(txt.includes(ITEMS[k].name), 'Card lacks rolled item ' + ITEMS[k].name));
        st.retake.recruits.forEach(id => check(txt.includes(vData(id).name), 'Card lacks rolled recruit')); (lair.reward && lair.reward.item && !st.retake.items.includes(lair.reward.item)) && check(!txt.includes(ITEMS[lair.reward.item].name), 'Card still shows the one-time item'); $('#prov-card').hidden = true; closeMap(); }
      const cpow = G.prov[castle.id].power, c2 = lose(castle, .3), returnedPower = G.prov[castle.id].power;
      check(returnedPower >= cpow, 'Castle lost its original garrison budget');
      check(returnedPower * sitePowerScale(castle) >= c2.power * 1.05, 'Castle returned weaker than its uprising');
      check(G.prov[castle.id].retake && G.prov[castle.id].retake.recruits.length === 1, 'Castle spoils not rerolled with a recruit');
      { const held = [c2.reward.recruit, ...(c2.reward.recruits || [])].filter(Boolean); if (held.length) check(held.includes(G.prov[castle.id].retake.recruits[0]), 'Retake recruit is not one of the uprising\'s captives'); }
      // retaking grants the rolled spoils, not the one-time rewards again
      const X = G.prov[castle.id].retake, origItem = castle.reward.item, origCount = origItem ? (G.items[origItem] || 0) : 0, itemsBefore = Object.assign({}, G.items); offered = null;
      check(startBattle(castle.id), 'Retake did not start'); endAs('win'); closeBattle(); clearModals(); await wait(150);
      const gained = X.items.reduce((m, k) => (m[k] = (m[k] || 0) + 1, m), {});
      for (const [k, n] of Object.entries(gained)) check((G.items[k] || 0) - (itemsBefore[k] || 0) >= n, 'Rolled item missing: ' + k);
      if (origItem && !X.items.includes(origItem)) check((G.items[origItem] || 0) === origCount, 'One-time item granted again');
      check(!G.prov[castle.id].retake && G.prov[castle.id].owner === 'kage', 'Retake not consumed');
      if (castle.reward.recruit && castle.reward.recruit !== X.recruits[0]) check(!(offered && offered[0] === castle.reward.recruit), 'One-time recruit offered again');
      out.rebels = { lair: { name: lair.name, before: p0, after: st.power, uprising: c1.power, spoils: { items: st.retake.items.map(k => ITEMS[k].name), recruits: st.retake.recruits.map(id => vData(id).name) } },
        castle: { name: castle.name, before: cpow, after: returnedPower, uprising: c2.power, spoilsGranted: X.items.map(k => ITEMS[k].name), recruitOffered: X.recruits.length ? (check(offered && offered[0] === X.recruits[0], 'Retake recruit not offered'), vData(X.recruits[0]).name) : 'none rolled' } };
      window.offerHire = oh;

      // ---------- old saves ----------
      fresh(); delete G.dojoPrize; Object.values(G.prov).forEach(s => delete s.retake); check(saveGame(), 'save'); G = null; check(loadGame(), 'load'); afterLoad(); clearModals();
      check(dojoPrizeValid(dojoPrize()) && provinceTally().total === 49, 'Old save'); out.oldSave = true;
      return out;
    });
    assert.deepStrictEqual(errors, []);
    fs.mkdirSync(dir + '/reports', { recursive: true });
    fs.writeFileSync(dir + '/reports/campaign.json', JSON.stringify({ ...report, errors }, null, 2));
    console.log(JSON.stringify({ ...report, errors }, null, 2));
  } finally { await browser.close(); server.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
