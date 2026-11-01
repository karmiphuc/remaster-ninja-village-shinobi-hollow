// Ton'ya and travelling merchants.
// Ton'ya: a house runs as many contracts at once as its level (1/2/3); offers stay limited to goods your fields grow
// and wares your workshops can make; every running contract is collected and paid weekly; a broken one stops alone.
// Guild Charter (research, needs a Lv3 Ton'ya) auto-seals offers made only of the raw goods ticked in the Ton'ya's
// Auto-accept tab, while a slot is free and the guild is not frozen. Merchants: 8-12 offers, nothing below your
// research for that slot and troop type, more army crates the further your research has come, crates drawn apart.
// Writes reports/tonya-merchant.json.
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
    await p.addInitScript(() => { window.__noIntro = true; window.__noQuick = true; });
    await p.goto('http://127.0.0.1:' + server.address().port);
    const tonya = await p.evaluate(() => {
      const check = (x, m) => { if (!x) throw Error(m); }, out = {};
      Math.random = seeded(11); newGame(); $('#title').hidden = true; resizeView(); afterLoad(); MQ.length = 0; $('#modal').hidden = true; G.speed = 0;
      const toasts = []; const t0 = window.toast; window.toast = m => { toasts.push(String(m)); };
      const ann = window.announce; window.announce = () => {};
      for (const k in LAND) G.land[k] = true; G.gold = 1e6;
      const spot = () => { for (let y = 2; y < MAP_H - 4; y++) for (let x = 2; x < MAP_W - 4; x++) { const b = place('tonya', x, y, true); if (b) return b; } return null; };
      const H = spot(); check(H, 'Could not place a Ton\'ya');
      const T = tradeState(); T.cs = []; T.offers = []; T.cd = 0;
      const offer = (items, lv = 1) => ({ lv, kind: lv === 1 ? (items.length > 1 ? 4 : 1) : lv, items, weeks: 6, pay: 100 });
      // ---- concurrent contracts by level ----
      out.cap = {};
      for (const lv of [1, 2, 3]) {
        H.lv = lv; T.cs = []; T.offers = [offer([{ k: 'rice', qty: 1 }]), offer([{ k: 'veg', qty: 1 }]), offer([{ k: 'rice', qty: 1 }, { k: 'veg', qty: 1 }]), offer([{ k: 'tea', qty: 1 }])];
        let sealed = 0; for (let i = 0; i < 4; i++) { if (tradeAccept(0, H)) sealed++; else break; }
        check(houseCap(H) === lv && sealed === lv && houseCs(H).length === lv && freeSlots() === 0, `Lv${lv} Ton'ya sealed ${sealed}, expected ${lv}`);
        out.cap['Lv' + lv] = sealed;
      }
      // ---- every running contract is collected and paid weekly; a broken one stops alone ----
      H.lv = 3; T.cs = []; T.offers = [offer([{ k: 'rice', qty: 2 }]), offer([{ k: 'veg', qty: 2 }]), offer([{ k: 'tea', qty: 2 }])]; T.offers.forEach((o, i) => o.pay = 100 * (i + 1));
      tradeAccept(0, H); tradeAccept(0, H); tradeAccept(0, H); T.cs.forEach(c => c.grace = 0);
      G.stock.rice = 50; G.stock.veg = 50; G.stock.tea = 50; const g0 = G.gold; tradeWeek();
      check(G.gold - g0 === 600 && T.cs.length === 3 && T.cs.every(c => c.left === 5), 'Not every contract at one house was paid: ' + (G.gold - g0));
      G.stock.tea = 0; tradeWeek(); check(T.cs.length === 2 && !T.cs.some(c => c.items[0].k === 'tea') && T.cd === TRADE_CD, 'A breach did not stop just that contract');
      out.weekly = { paidAtOneHouse: 600, afterTeaRanShort: T.cs.map(c => c.items[0].k), freezeWeeks: T.cd };
      // ---- offers stay limited to what the village makes ----
      T.cs = []; T.cd = 0; let bad = 0; for (let i = 0; i < 40; i++) for (const o of tradeOffers()) for (const it of o.items) if (tIsWare(it.k) ? !tradeCan(it.k) : tMakes(it.k) <= 0) bad++;
      check(!bad, bad + ' offers asked for goods or wares the village cannot make'); out.offersMakeable = true;
      // ---- Guild Charter: research gated by a Lv3 Ton'ya ----
      const R = RESEARCH.find(r => r.item === 'guild_charter'); check(R, 'No Guild Charter research');
      H.lv = 2; check(resState(R).why.some(w => w.t === 'bld'), 'Guild Charter open without a Lv3 Ton\'ya');
      H.lv = 3; check(!resState(R).why.some(w => w.t === 'bld'), 'Guild Charter still blocked with a Lv3 Ton\'ya');
      out.charter = { research: R.id, weeks: R.weeks, gold: R.gold, blockedBelowLv3: true };
      // ---- auto-accept: only raw goods ticked, only free slots, never while frozen ----
      T.cs = []; T.cd = 0; T.auto = { rice: true };
      const mix = () => [offer([{ k: 'rice', qty: 1 }]), offer([{ k: 'rice', qty: 1 }, { k: 'veg', qty: 1 }]), offer([{ k: 'veg', qty: 1 }]), offer([{ k: 'mochi', qty: 1 }], 2), offer([{ k: 'rice', qty: 2 }])];
      T.offers = mix(); check(tradeAutoRun() === 0 && !T.cs.length, 'Auto-accept worked before the research');
      G.researched.guild_charter = 1; T.offers = mix(); const n1 = tradeAutoRun();
      check(n1 === 2 && T.cs.every(c => c.items.every(it => it.k === 'rice')), `Auto-accept sealed ${n1} (expected the 2 rice-only offers)`);
      T.auto.veg = true; const n2 = tradeAutoRun(); check(n2 === 1 && T.cs.length === 3 && T.offers.some(o => o.items.some(it => it.k === 'mochi')), 'Auto-accept did not respect free slots / took a ware offer');
      check(toasts.some(t => /auto-sealed/.test(t)), 'No toast for an auto-sealed contract');
      T.cs = []; T.cd = 2; T.offers = mix(); check(tradeAutoRun() === 0, 'Auto-accept sealed while the guild was frozen'); T.cd = 0;
      T.offers = [offer([{ k: 'mochi', qty: 1 }], 2)]; T.auto = { rice: true, veg: true, tea: true, wood: true, ore: true, silk: true }; check(tradeAutoRun() === 0, 'Auto-accept sealed a ware offer');
      out.auto = { beforeResearch: 0, riceTicked: n1, vegTickedToo: n2, frozen: 0, wareOffers: 'never' };
      // ---- save and load keep the ticks and the contracts ----
      T.cs = []; T.offers = [offer([{ k: 'rice', qty: 1 }]), offer([{ k: 'veg', qty: 1 }])]; tradeAccept(0, H); tradeAccept(0, H);
      const json = JSON.stringify(G); G = JSON.parse(json); resetRT(); afterLoad();
      const T2 = tradeState(), H2 = G.buildings.find(b => b.id === 'tonya');
      check(T2.cs.length === 2 && houseCs(H2).length === 2 && T2.auto.rice && T2.auto.silk, 'Save/load lost contracts or auto-accept ticks');
      out.saveLoad = true;
      window.toast = t0; window.announce = ann; return out;
    });
    // ---- the Ton'ya sheet: two tabs; ticking a good with a real click ----
    const ui = await p.evaluate(() => { const H = G.buildings.find(b => b.id === 'tonya'); G.trade.auto = {}; G.trade.cs = []; G.trade.offers = []; openBuildingInfo(H);
      return { tabs: [...document.querySelectorAll('#sh-tabs button')].map(b => b.textContent) }; });
    assert.deepStrictEqual(ui.tabs, ['Contracts', 'Auto-accept'], 'Ton\'ya tabs: ' + ui.tabs);
    await p.click('#sh-tabs button:nth-child(2)'); await p.waitForTimeout(150);
    await p.click('#sh-body [data-auto="tea"]'); await p.waitForTimeout(150);
    const ticked = await p.evaluate(() => ({ tea: !!G.trade.auto.tea, pressed: document.querySelector('#sh-body [data-auto="tea"]').getAttribute('aria-pressed') }));
    assert(ticked.tea && ticked.pressed === 'true', 'Clicking Tea did not tick it: ' + JSON.stringify(ticked));
    await p.click('#sh-body [data-auto-all]'); await p.waitForTimeout(150);
    const allOn = await p.evaluate(() => Object.keys(GOODS).every(g => G.trade.auto[g]));
    assert(allOn, 'Accept-all did not tick every raw good');
    // the contracts tab shows n/cap
    await p.click('#sh-tabs button:nth-child(1)'); await p.waitForTimeout(150);
    // (with every raw good ticked, opening the tab may already have auto-sealed a raw-goods offer)
    const capTxt = await p.evaluate(() => (document.querySelector('#sh-body .trade .sec b') || {}).textContent), capWant = await p.evaluate(() => houseCs(G.buildings.find(b => b.id === 'tonya')).length + '/3');
    assert.strictEqual(capTxt, capWant, 'Contracts tab should show ' + capWant + ', got ' + capTxt);
    const merch = await p.evaluate(() => {
      const check = (x, m) => { if (!x) throw Error(m); }, out = { stages: {} };
      const stage = (name, setup) => {
        Math.random = seeded(name.length * 97); newGame(); MQ.length = 0; $('#modal').hidden = true; setup();
        const rows = {}; let below = 0, n0 = Infinity, n1 = 0, crates = 0, total = 0;
        for (const kind of Object.keys(MERCHANTS)) { const counts = [];
          for (let i = 0; i < 25; i++) { const st = rollStock(kind); counts.push(st.length); total += st.length; crates += st.filter(o => o.crate).length;
            for (const o of st) if (o.crate ? !atTech(o.crate, o.t) : !atTech(o.k)) below++; }
          rows[kind] = { min: Math.min(...counts), max: Math.max(...counts) }; n0 = Math.min(n0, ...counts); n1 = Math.max(n1, ...counts); }
        check(!below, `${name}: ${below} offers below your research`);
        check(n0 >= 8 && n1 <= 12, `${name}: offers ranged ${n0}-${n1}, not 8-12`);
        return { gearTier: gearTier(), perMerchant: rows, crateShare: +(crates / total).toFixed(2), min: n0, max: n1 };
      };
      const res = (pred) => { for (const k in ITEMS) if (GEAR_SLOTS.includes(ITEMS[k].slot) && pred(ITEMS[k], k)) G.researched[k] = 1; };
      out.stages.early = stage('early', () => {});
      out.stages.mid = stage('mid-game', () => { ['arc', 'gun', 'cav'].forEach(t => G.researched['corps_' + t] = 1); res(I => (I.tier || 0) <= 2 && !I.rare); G.troops = { inf: 300, arc: 150, gun: 200, cav: 100 }; });
      out.stages.late = stage('late game, tier 4', () => { ['arc', 'gun', 'cav'].forEach(t => G.researched['corps_' + t] = 1); res(I => (I.tier || 0) <= 4 && !I.rare); G.troops = { inf: 800, arc: 400, gun: 600, cav: 300 }; });
      check(out.stages.late.crateShare > out.stages.early.crateShare, 'Late game does not lean towards army crates');
      // floor is per slot and troop: a tier-1 gunner weapon is below tech once a tier-2 gunner weapon is researched
      const gw = Object.keys(ITEMS).filter(k => ITEMS[k].slot === 'weapon' && itemFits('gun', k) && ITEMS[k].for && ITEMS[k].for.length === 1);
      const t1 = gw.find(k => ITEMS[k].tier === 1), t2 = gw.find(k => ITEMS[k].tier === 2);
      if (t1 && t2) { newGame(); G.researched[t2] = 1; check(!atTech(t1, 'gun') && atTech(t2, 'gun'), 'Per-troop floor wrong'); out.floorExample = `${t1} (t1) below ${t2} (t2) for gunners`; }
      return out;
    });
    // ---- army crates look different at the stall ----
    const look = await p.evaluate(() => {
      Math.random = seeded(3); newGame(); $('#title').hidden = true; resizeView(); afterLoad(); MQ.length = 0; $('#modal').hidden = true; G.speed = 0;
      ['arc', 'gun', 'cav'].forEach(t => G.researched['corps_' + t] = 1); G.troops = { inf: 400, arc: 200, gun: 300, cav: 150 };
      G.merch = G.merch || {}; G.merch.cur = null; G.merch.wait = null; G.merch.sc = 0; const spot = stallSpot(); const b = place('stall', spot.x, spot.y, true); b.kind = 'smith';
      G.merch.cur = { kind: 'smith', uid: b.uid, weeks: 5, weeks0: 5, stock: rollStock('smith'), buys: {}, sold: {}, haggled: {}, visited: false, rumor: '' };
      openMerchant(b);
      const cards = [...document.querySelectorAll('#sh-body .grid .card')], army = cards.filter(c => c.classList.contains('crate-army')), plain = cards.find(c => !c.classList.contains('crate-army'));
      const cs = el => { const s = getComputedStyle(el); return s.borderTopStyle + ' ' + s.borderTopWidth + ' ' + s.borderTopColor; };
      return { offers: G.merch.cur.stock.length, crates: G.merch.cur.stock.filter(o => o.crate).length, armyCards: army.length, armyBorder: army[0] ? cs(army[0]) : null, plainBorder: plain ? cs(plain) : null, ribbon: army[0] ? !!army[0].querySelector('.tagx.army') : false };
    });
    assert(look.armyCards === look.crates && look.crates > 0, 'Army crate cards not marked: ' + JSON.stringify(look));
    assert(look.armyBorder && look.armyBorder !== look.plainBorder && /double/.test(look.armyBorder) && look.ribbon, 'Army crates do not look different: ' + JSON.stringify(look));
    assert.deepStrictEqual(errors, []);
    const report = { tonya, ui: { tabs: ui.tabs, tickTea: ticked, acceptAll: allOn, contractsTab: capTxt }, merchants: merch, stall: look, errors };
    fs.mkdirSync(dir + '/reports', { recursive: true }); fs.writeFileSync(dir + '/reports/tonya-merchant.json', JSON.stringify(report, null, 2));
    console.log(JSON.stringify(report, null, 2));
  } finally { await browser.close(); server.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
