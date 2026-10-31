// The campaign hand: one forced House Doctrine + a Hardship + a Wild omen, one redraw, every omen's effect,
// conflict rules, determinism, saves made before omens existed, and the hand on a phone. Writes reports/omens.json.
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
      const near = (a, b, m, tol = 1e-6) => check(Math.abs(a - b) <= tol, `${m}: ${a} vs ${b}`);
      const fresh = () => { newGame(); G.tut = 1; G.speed = 0; $('#title').hidden = true; resizeView(); afterLoad(); MQ.length = 0; $('#modal').hidden = true; };
      const out = {};
      fresh();

      // ---------- the pool ----------
      const kinds = OMENS.reduce((m, o) => (m[o.kind] = (m[o.kind] || 0) + 1, m), {});
      check(DOCTRINES.length === 7 && OMENS.length >= 13, 'Pool size');
      out.pool = { doctrines: DOCTRINES.length, omens: OMENS.length, kinds, total: DOCTRINES.length + OMENS.length };

      // ---------- dealing: structure, conflicts, determinism, the redraw ----------
      const seen = { doc: {}, omen: {} }; let changed = 0; const N = 3000;
      for (let i = 0; i < N; i++) {
        G.roll.seed = (i * 2654435761) >>> 0;
        for (const rr of [0, 1]) {
          const H = dealHand(rr), [a, b] = H.omens.map(omenOf);
          check(DOCTRINES.some(d => d.id === H.doc) && H.omens.length === 2 && a && b && a !== b, 'Hand shape');
          check(a.kind !== 'boon', 'Hardship slot dealt a blessing');
          check(!(a.seal && b.seal), 'Two sealed lines');
          check(!([a.id, b.id].includes('ascend') && [a.id, b.id].includes('divided')), 'Ascendant with Divided');
          check(!([a.id, b.id].includes('scrolls') && [a.id, b.id].includes('sensei')), 'Costly Scrolls with Sensei');
          check(!(H.doc === 'horse' && [a, b].some(o => o.seal === 'horse')), 'Horse Clans with Barren Pastures');
          const cur = H.omens.find(o => o.id === 'cursed'), silk = H.omens.find(o => o.id === 'silk'); check(!(cur && silk && cur.arg === silk.arg), 'Silk Road on the cursed shop');
          H.omens.forEach(o => { if (o.id === 'cursed' || o.id === 'silk') check(OMEN_SHOPS.includes(o.arg), 'Shop arg'); if (o.id === 'blight') check(OMEN_YIELDS.includes(o.arg), 'Blight arg');
            if (o.id === 'raiders') check(o.arg >= 2 && o.arg <= 3, 'Raider multiplier ' + o.arg); if (o.id === 'masters') check([3, 4, 5].includes(o.arg), 'Dojo multiplier ' + o.arg); if (o.id === 'scrolls') check(o.arg >= 1.5 && o.arg <= 2, 'Scroll multiplier ' + o.arg); });
          check(JSON.stringify(dealHand(rr)) === JSON.stringify(H), 'Not deterministic');
          seen.doc[H.doc] = 1; H.omens.forEach(o => seen.omen[o.id] = 1);
        }
        if (JSON.stringify(dealHand(0)) !== JSON.stringify(dealHand(1))) changed++;
      }
      check(Object.keys(seen.doc).length === 7 && Object.keys(seen.omen).length === OMENS.length, 'Some card never dealt');
      check(changed / N > .95, 'Redraw rarely changes the hand');
      out.dealing = { seeds: N, everyDoctrineDealt: true, everyOmenDealt: true, redrawChangesHand: +(changed / N).toFixed(3) };

      // ---------- the hand modal: one redraw, then accept; persists across reload ----------
      fresh(); G.boons = freshBoons(); offerDoctrine();
      const cardsShown = () => [...document.querySelectorAll('#modal .hcard')].map(c => c.querySelector('b').textContent);
      const btns = () => [...document.querySelectorAll('#modal .modal-ft button')].map(b => b.textContent);
      check(cardsShown().length === 3 && btns().join('|') === 'Redraw once|承 Accept the hand', 'First hand UI ' + btns());
      check(!document.querySelector('#modal .modal-hd .x'), 'Hand can be dismissed');
      check(document.documentElement.scrollWidth <= innerWidth, 'Hand overflows a phone');
      const first = cardsShown(); document.querySelector('#modal .modal-ft button').click();
      check(G.boons.rr === 1 && cardsShown().length === 3 && btns().join('|') === '承 Accept the hand', 'Redraw UI ' + btns());
      const second = cardsShown(), H2 = dealHand(1);
      // a reload before accepting cannot buy a second redraw
      check(saveGame(), 'save'); G = null; loadGame(); afterLoad(); MQ.length = 0; $('#modal').hidden = true; check(G.boons.rr === 1 && !G.boons.doc, 'Redraw lost on reload');
      offerDoctrine(); check(btns().join('|') === '承 Accept the hand', 'Reload granted another redraw');
      document.querySelector('#modal .modal-ft button').click();
      check(G.boons.doc === H2.doc && JSON.stringify(G.boons.omens.map(o => o.id)) === JSON.stringify(H2.omens.map(o => o.id)), 'Accepted hand differs from the shown one');
      check(!MQ.length && $('#modal').hidden, 'Modal stayed open');
      check(saveGame(), 'save'); G = null; loadGame(); afterLoad(); check(!MQ.some(m => /campaign hand/.test(m.title)), 'Hand offered again after accepting'); MQ.length = 0; $('#modal').hidden = true;
      openPanel('village'); const sheet = $('#sh-body') ? $('#sh-body').textContent : ''; closeSheet();
      out.modal = { firstHand: first, redrawnHand: second, accepted: { doc: G.boons.doc, omens: G.boons.omens.map(o => o.txt) } };

      // ---------- every omen does what its card says ----------
      const withOmen = (id, arg, fn) => { fresh(); G.boons = freshBoons(); applyBoons(); const before = fn('before'); const O = OMENS.find(o => o.id === id); O.apply(arg); applyBoons(); const after = fn('after'); return { before, after }; };
      const eff = {}, RQ = RESEARCH.find(q => q._g0 >= 500 && !q.item.startsWith('rcp_')).id; // one fixed research item
      let r = withOmen('cursed', 'teahouse', () => shopOmen('teahouse')); near(r.after, .5, 'Cursed Market'); check(shopOmen('pickle') === 1, 'Curse leaked'); eff.cursed = r;
      r = withOmen('silk', 'kimono', () => shopOmen('kimono')); near(r.after, 1.4, 'Silk Road'); eff.silk = r;
      check(/boonSales\(\)\*shopOmen\(b\.id\)/.test(sell.toString()), 'sell() ignores shop omens');
      for (const [id, ln] of [['nospear', 'spear'], ['nosword', 'sword'], ['nohorse', 'horse']]) {
        fresh(); G.boons = freshBoons(); OMENS.find(o => o.id === id).apply(); const rs = RESEARCH.filter(q => LINES[ln].items.includes(q.item));
        check(rs.length && rs.every(q => q.item.startsWith('corps_') ? !resState(q).why.some(w => w.t === 'seal') : resState(q).why.some(w => w.t === 'seal')), 'Seal ' + ln);
        check(RESEARCH.filter(q => !LINES[ln].items.includes(q.item)).every(q => !resState(q).why.some(w => w.t === 'seal')), 'Seal leaked from ' + ln);
        eff[id] = { sealedResearch: rs.filter(q => !q.item.startsWith('corps_')).length, corpsOpen: rs.filter(q => q.item.startsWith('corps_')).map(q => q.item) };
      }
      check(eff.nohorse.corpsOpen.includes('corps_cav'), 'Horse Corps sealed');
      // the research screen shows the seal
      fresh(); G.boons = freshBoons(); OMENS.find(o => o.id === 'nospear').apply(); openPanel('armory'); UI.tab = 'research'; refreshSheet(); check(/Sealed by an omen/.test($('#sh-body').textContent), 'Seal not shown'); closeSheet();
      { fresh(); G.boons = freshBoons(); const b = { id: 'paddy', pile: 0, boost: 0 }, v = G.villagers[0]; const run = () => { const R = Math.random; Math.random = () => .5; b.pile = 0; produce(b, v); Math.random = R; return b.pile; };
        const base = run(); OMENS.find(o => o.id === 'blight').apply('paddy'); const hit = run(); b.id = 'veggie'; const other = blightOf('veggie');
        check(hit < base && Math.abs(hit / base - .6) < .2 && other === 1, `Blight ${base}->${hit}`); eff.blight = { before: base, after: hit }; }
      fresh(); G.boons = freshBoons(); G.endYear = 25; let t0 = OMENS.find(o => o.id === 'mandate').txt(); OMENS.find(o => o.id === 'mandate').apply(); check(G.endYear === 21 && t0 === 'Unify by the end of Year 21', 'Short Mandate'); G.endYear = 18; OMENS.find(o => o.id === 'mandate').apply(); check(G.endYear === 16, 'Mandate floor'); eff.mandate = '25→21, floor 16';
      r = withOmen('iron', null, () => ITEMS.domaru.cost); check(r.after >= r.before * 1.35 && r.after <= r.before * 1.45, 'Iron Famine ' + JSON.stringify(r)); eff.iron = r;
      r = withOmen('tithe', null, () => upkeepMul()); near(r.after, 1.25, 'Heavy Tithe');
      { fresh(); G.boons = freshBoons(); G.troops = { inf: 400, arc: 0, gun: 0, cav: 0 }; const up = () => { let n = 0; const yn = yrNote; window.yrNote = (k, v) => { if (k === 'upkeep') n = v; return yn(k, v); }; const R = Math.random; Math.random = () => .99; try { monthTick(); } finally { window.yrNote = yn; Math.random = R; } MQ.length = 0; $('#modal').hidden = true; return n; };
        const a = up(); OMENS.find(o => o.id === 'tithe').apply(); const b = up(); check(Math.abs(b / a - 1.25) < .02, `Tithe upkeep ${a}->${b}`); eff.tithe = { upkeepBefore: a, upkeepAfter: b }; }
      r = withOmen('ascend', null, () => diffScale()); near(r.after / r.before, 1.12, 'Ascendant'); eff.ascend = r;
      r = withOmen('divided', null, () => diffScale()); near(r.after / r.before, .9, 'Divided'); eff.divided = r;
      r = withOmen('sensei', null, () => RESEARCH.find(q => q.id === RQ).gold); check(Math.abs(r.after / r.before - .75) < .03, 'Sensei ' + JSON.stringify(r)); eff.sensei = r;
      r = withOmen('bounty', null, () => boonFarm()); near(r.after - r.before, .15, 'Bountiful'); eff.bounty = r;
      { fresh(); G.boons = freshBoons(); const camp = spawnCamp(true) || G.camps[0]; check(camp, 'No camp'); const pw = () => { const R = Math.random; Math.random = () => .5; try { const A = enemyArmy(camp); return armyPower(A); } finally { Math.random = R; } };
        const a = pw(); OMENS.find(o => o.id === 'raiders').apply(2.5); const b = pw(); check(b / a > 2 && b / a < 3.2, `Raiders ${a}->${b}`); eff.raiders = { powerBefore: Math.round(a), powerAfter: Math.round(b), ratio: +(b / a).toFixed(2) }; }
      { fresh(); G.boons = freshBoons(); const tgt = PROVINCES.find(q => G.prov[q.id].owner !== 'kage' && q.type === 'clan'); const a = marchPlan(tgt).w; OMENS.find(o => o.id === 'mud').apply(); const b = marchPlan(tgt).w; near(b, a * 2, 'Washed-out Roads'); eff.mud = { weeksBefore: a, weeksAfter: b }; }
      { fresh(); G.boons = freshBoons(); const a = dojoFee({ lv: 10 }); OMENS.find(o => o.id === 'masters').apply(4); const b = dojoFee({ lv: 10 }); check(Math.abs(b / a - 4) < .2, `Proud Masters ${a}->${b}`); eff.masters = { feeBefore: a, feeAfter: b }; }
      { fresh(); G.boons = freshBoons(); if (!G.buildings.some(b => b.id === 'paddy')) G.buildings.push({ uid: 99950, id: 'paddy', x: 1, y: 1, born: -9 }); const R = Math.random, offer = () => { Math.random = () => .5; try { return tradeOffer(1); } finally { Math.random = R; } };
        const a = offer(); OMENS.find(o => o.id === 'caravan').apply(); const b = offer();
        check(a && b && b.weeks === a.weeks * 2 && Math.abs(b.pay / a.pay - 2) < .1, 'Long Caravans ' + JSON.stringify([a && [a.weeks, a.pay], b && [b.weeks, b.pay]])); eff.caravan = { before: { weeks: a.weeks, payPerWeek: a.pay }, after: { weeks: b.weeks, payPerWeek: b.pay } }; }
      { fresh(); G.boons = freshBoons(); const homes = G.buildings.filter(b => capOf(b) > 0), a = housingCap(); OMENS.find(o => o.id === 'cramped').apply(); const b = housingCap();
        check(homes.length && b === a - homes.reduce((n, h) => n + (BUILDINGS[h.id].cap > 1 || (lvInfo(h) && lvInfo(h).cap > 1) ? 1 : 0), 0) && homes.every(h => capOf(h) >= 1), `Cramped ${a}->${b}`); eff.cramped = { housingBefore: a, housingAfter: b, homes: homes.length }; }
      { fresh(); G.boons = freshBoons(); const shop = G.buildings.find(b => BUILDINGS[b.id].cat === 'shop') || G.buildings.find(b => BUILDINGS[b.id].cat === 'ind'); check(shop, 'No shop to decorate');
        const B = BUILDINGS[shop.id]; G.buildings.push({ uid: 99901, id: 'pine', x: shop.x + B.w, y: shop.y, born: -9 }, { uid: 99902, id: 'sakura', x: shop.x - 1, y: shop.y, born: -9 });
        refreshBoosts(); const a = shop.boost; OMENS.find(o => o.id === 'faded').apply(); refreshBoosts(); const b = shop.boost; const inRange = G.buildings.filter(e => BUILDINGS[e.id].cat === 'env').filter(e => { const E = BUILDINGS[e.id]; return Math.abs(e.x + E.w / 2 - (shop.x + B.w / 2)) <= E.radius + B.w / 2 && Math.abs(e.y + E.h / 2 - (shop.y + B.h / 2)) <= E.radius + B.h / 2; }).length;
        check(inRange >= 2 && Math.abs((a - b) - .01 * inRange) < 1e-9, `Faded ${a}->${b} with ${inRange} decorations`); eff.faded = { boostBefore: +a.toFixed(3), boostAfter: +b.toFixed(3), decorationsInRange: inRange }; }
      r = withOmen('scrolls', 1.8, () => RESEARCH.find(q => q.id === RQ).gold); check(Math.abs(r.after / r.before - 1.8) < .03, 'Costly Scrolls ' + JSON.stringify(r));
      { const q = RESEARCH.find(x => x.id === RQ); check(q.weeks === (q._w0 ??= q.weeks), 'Research time changed'); } eff.scrolls = r;
      out.effects = eff;

      // ---------- a save from before omens: no hand offered, nothing changes ----------
      fresh(); G.boons = freshBoons(); G.boons.doc = 'rice'; ['shop', 'seal', 'blight', 'upkeep', 'foe', 'resMul', 'raid', 'march', 'dojo', 'contract', 'omens', 'rr'].forEach(k => delete G.boons[k]);
      check(saveGame(), 'save'); G = null; check(loadGame(), 'Old save did not load'); afterLoad();
      check(!MQ.some(m => /campaign hand/.test(m.title)), 'Old save was dealt a hand');
      check(shopOmen('pickle') === 1 && upkeepMul() === 1 && foeMul() === 1 && boonOf('march') === 1 && !sealedItem('yari'), 'Old save picked up omen effects');
      MQ.length = 0; $('#modal').hidden = true; out.oldSave = 'loads with no omens and is not dealt a hand';
      return out;
    });
    assert.deepStrictEqual(errors, []);
    fs.writeFileSync(dir + '/reports/omens.json', JSON.stringify({ ...report, errors }, null, 2));
    console.log(JSON.stringify({ ...report, errors }, null, 2));
  } finally { await browser.close(); server.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
