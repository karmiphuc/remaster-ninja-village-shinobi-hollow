// Formation forges: per-forge throughput by level (40/65/90 sets a month, additive), focus, upgrades, coverage-first
// priority and idling, material and gold accounting, research and treasury limits, the village smiths' shared trickle,
// the 1,000-Gunner balance target, saves from before levels, and the forge/Army UI on a phone. Writes reports/forge.json.
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
      const out = {}, realCap = forgeCapacity, realToast = toast; window.toast = () => {};
      // a village on the simulator's road grid, every gear item researched, rich in gold and materials
      const fresh = (troops = { inf: 0, arc: 0, gun: 1000, cav: 0 }) => {
        simFixture({ id: 'forge', tier: 3, count: 6, porters: 0 }, 0x5eed); Math.random = seeded(7);
        for (const k in ITEMS) if (!ITEMS[k].rare && k.indexOf('rcp_') !== 0) G.researched[k] = 1;
        ['arc', 'gun', 'cav'].forEach(t => { G.researched['corps_' + t] = 1; G.units[t] = true; });
        G.troops = Object.assign({ inf: 0, arc: 0, gun: 0, cav: 0 }, troops); G.kit = { inf: {}, arc: {}, gun: {}, cav: {} }; G.kitQuality = {}; G.forgeDebt = {};
        G.forge = { inf: true, arc: true, gun: true, cav: true }; G.gold = 1e9; for (const g of Object.keys(GOODS)) G.stock[g] = 1e6;
        window.forgeCapacity = () => 0; // the shared smiths' trickle is off unless a check turns it on
      };
      // forges on the road grid: rows 12-13 sit just under the road at y=11
      let slot = 0; const forge = (id = 'teppo_kaji', focus = 'armor', lv = 1) => { const b = simPlace(id, 2 + (slot++ % 6) * 3, 12 + Math.floor((slot - 1) / 6) * 12); check(b && entranceOf(b), 'Forge not placed on a road'); b.forgeFocus = focus; b.lv = lv; return b; };
      const cov = t => forgeCoverage(t);

      // ---------- throughput: per level, additive, per focus and formation ----------
      fresh(); slot = 0; const lvl = [];
      for (const lv of [1, 2, 3]) { const b = forge('teppo_kaji', 'armor', lv); lvl.push(forgeOutput(b)); G.buildings.splice(G.buildings.indexOf(b), 1); }
      check(lvl.join() === '40,65,90', 'Per-level output ' + lvl);
      fresh(); slot = 0; for (let i = 0; i < 5; i++) forge(); forge('teppo_kaji', 'weapon', 3); forge('katana_kaji', 'armor', 2);
      check(forgeRate('gun', 'armor') === 200 && forgeRate('gun', 'weapon') === 90 && forgeRate('inf', 'armor') === 65 && forgeRate('arc', 'armor') === 0, 'Additive rates');
      const lone = G.buildings.find(b => b.id === 'teppo_kaji'); const ent = entranceOf; window.entranceOf = b => b === lone ? null : ent(b);
      check(forgeRate('gun', 'armor') === 160, 'A forge off the road still counts'); window.entranceOf = ent;
      out.rates = { perLevel: lvl, fiveLv1Gunners: 200, weaponLv3: 90 };

      // ---------- one month: exactly the forge's output, split across armor and helmets, at standard cost ----------
      fresh(); slot = 0; forge();
      const C0 = cov('gun'), ka = C0.a.k, kh = C0.h.k; check(ka && kh, 'No armor/helmet researched for Gunners');
      const gold0 = G.gold, stock0 = Object.assign({}, G.stock); forgeTick();
      const C1 = cov('gun'), sets = C1.a.have + C1.h.have, goldUsed = gold0 - G.gold;
      check(sets === 40 && Math.abs(C1.a.have - C1.h.have) <= 1, `One Lv1 month made ${C1.a.have}+${C1.h.have}`);
      check(goldUsed === C1.a.have * setCost(ka) + C1.h.have * setCost(kh), 'Gold is not the standard cost per set');
      for (const [g, n0] of Object.entries(stock0)) { const want = C1.a.have * ((ITEMS[ka].res || {})[g] || 0) / 8 + C1.h.have * ((ITEMS[kh].res || {})[g] || 0) / 8, used = n0 - G.stock[g];
        check(Math.abs(used + (G.forgeDebt[g] || 0) - want) < 1e-6 && used === Math.floor(used), `${g}: used ${used} + carry ${G.forgeDebt[g] || 0} vs ${want}`); }
      out.oneMonth = { armor: C1.a.have, helmets: C1.h.have, gold: goldUsed, armorItem: ITEMS[ka].name, helmetItem: ITEMS[kh].name, materialsCarried: Object.fromEntries(Object.entries(G.forgeDebt).filter(([, v]) => v > 0)) };

      // ---------- balance target: 1,000 Gunners, top armor and helmets (2,000 sets) ----------
      const monthsTo = (lv, smiths) => { fresh(); slot = 0; if (smiths) window.forgeCapacity = realCap; for (let i = 0; i < 5; i++) forge('teppo_kaji', 'armor', lv);
        let m = 0; while ((cov('gun').a.need || cov('gun').h.need) && m < 40) { forgeTick(); m++; } return m; };
      const b1 = monthsTo(1, false), b3 = monthsTo(3, false), b1s = monthsTo(1, true);
      check(b1 === 10, 'Five Lv1 forges took ' + b1 + ' months'); check(b3 <= 5, 'Five Lv3 forges took ' + b3 + ' months'); check(b1s <= 10, 'With the smiths it took ' + b1s);
      out.balance = { fiveLv1Months: b1, fiveLv3Months: b3, fiveLv1WithVillageSmithsMonths: b1s };

      // ---------- coverage first, then rest: no overproduction, no spending once covered ----------
      fresh({ gun: 50 }); slot = 0; forge(); for (let i = 0; i < 4; i++) forgeTick(); const full = cov('gun');
      check(full.a.have === 50 && full.h.have === 50 && Math.floor(G.kit.gun[full.a.k]) === 50, 'Overproduced past the troop count');
      const g1 = G.gold, s1 = JSON.stringify(G.stock); forgeTick(); check(G.gold === g1 && JSON.stringify(G.stock) === s1, 'Spent while fully equipped');
      // existing lower-tier and better-quality sets stay in service until replaced
      fresh({ gun: 30 }); slot = 0; const low = kitList('a', 'gun').filter(k => k !== cov('gun').a.k)[0]; kitAdd('gun', low, 30, 2);
      forge(); forgeTick(); check(G.kit.gun[low] === 30 && G.kitQuality.gun[low][2] === 30, 'Older gear was destroyed');
      check(kitSummary('gun').a.length >= 1, 'Kit summary broke with mixed gear'); out.preserved = { kept: ITEMS[low].name, quality: 2 };
      // gear at least as strong as a fresh top set (strength × quality) counts as covered; weaker quality does not
      fresh({ gun: 50 }); slot = 0; const topA = cov('gun').a.k, topS = artKitScore(topA, 'gun');
      const alt = kitList('a', 'gun').filter(k => k !== topA && artKitScore(k, 'gun') > 0).sort((x, y) => artKitScore(y, 'gun') - artKitScore(x, 'gun'))[0], qq = Math.ceil(topS / artKitScore(alt, 'gun') - 1e-9);
      kitAdd('gun', alt, 20, qq); check(cov('gun').a.have === 20 && cov('gun').a.need === 30, `Equal-or-better quality not counted (${ITEMS[alt].name} ×${qq})`);
      if (qq > 1 && artKitScore(alt, 'gun') * (qq - 1) < topS) { kitAdd('gun', alt, 10, qq - 1); check(cov('gun').a.have === 20, 'Weaker quality counted as covered'); }
      forge(); for (let i = 0; i < 6; i++) forgeTick();
      check(Math.floor(G.kit.gun[topA] || 0) === 30 && cov('gun').a.need === 0, `Forged ${G.kit.gun[topA]} top sets, expected only the 30 missing`);
      const worn = kitSummary('gun').a, wornAlt = worn.filter(([k, , q]) => k === alt && q === qq).reduce((n, [, c]) => n + c, 0), wornTop = worn.filter(([k]) => k === topA).reduce((n, [, c]) => n + c, 0);
      check(wornAlt === 20 && wornTop === 30, `Soldiers do not wear what coverage counted: ${JSON.stringify(worn)}`);
      out.qualityCounts = { item: ITEMS[alt].name, quality: qq, topItem: ITEMS[topA].name, countedAsCovered: 20, forgedOnly: 30 };

      // ---------- focus selection ----------
      fresh({ gun: 100 }); slot = 0; const wf = forge('teppo_kaji', 'weapon'); forgeTick();
      check(cov('gun').w.have === 40 && cov('gun').a.have === 0 && cov('gun').h.have === 0, 'Weapon focus made armor');
      wf.forgeFocus = 'armor'; forgeTick(); check(cov('gun').w.have === 40 && cov('gun').a.have + cov('gun').h.have === 40, 'Switching focus did not switch the work');
      out.focus = 'weapons then armor & helmets';
      // a forge whose focus is fully equipped helps with the other job instead of idling (reported: 5 Gunner forges on
      // Weapons, every Gunner already carrying the best gun, only the village smiths' few sets arriving)
      fresh({ gun: 1200 }); slot = 0; for (let i = 0; i < 5; i++) forge('teppo_kaji', 'weapon'); G.kit.gun[cov('gun').w.k] = 1200;
      check(forgeWorkRate('gun', 'weapon') === 0 && forgeWorkRate('gun', 'armor') === 200 && forgeEta('gun', 'armor') === Math.ceil(2400 / 200), 'Rates and ETA ignore the spare forges');
      check(/making armor & helmets/.test(armyForgePanel(G.buildings.find(b => b.id === 'teppo_kaji')).textContent), 'Forge panel does not say it switched');
      forgeTick(); const sp = cov('gun'); check(sp.a.have + sp.h.have === 200 && sp.w.have === 1200, 'Idle weapon forges made ' + (sp.a.have + sp.h.have));
      fresh({ gun: 100 }); slot = 0; forge('teppo_kaji', 'armor'); G.kit.gun[cov('gun').a.k] = 100; G.kit.gun[cov('gun').h.k] = 100; forgeTick();
      check(cov('gun').w.have === 40, 'Idle armor forge did not make weapons');
      fresh({ gun: 100 }); slot = 0; forge('teppo_kaji', 'weapon'); forgeTick(); check(cov('gun').w.have === 40 && cov('gun').a.have + cov('gun').h.have === 0, 'Spilled while its own focus still had work');
      // a scarce material: the month stops early and the message says why
      fresh({ gun: 1200 }); slot = 0; for (let i = 0; i < 5; i++) forge('teppo_kaji', 'weapon'); G.kit.gun[cov('gun').w.k] = 1200;
      { const ka = cov('gun').a.k, mats = Object.keys(ITEMS[ka].res || {}), scarce = mats.find(r => r === 'silk') || mats[0]; economyWrite(economyCentral(scarce), scarce, 20); G.stock[scarce] = 20;
        const said = []; const T = window.toast; window.toast = m => said.push(m); try { forgeTick(); } finally { window.toast = T; }
        const made = cov('gun').a.have + cov('gun').h.have; check(made > 0 && made < 200 && RT.forgeNote.short.includes(GOODS[scarce].name) && said.some(m => new RegExp('stopped short of ' + GOODS[scarce].name).test(m)), 'Shortage not reported: ' + said.join(' | '));
        out.spill = { weaponForgesOnArmor: 200, armorForgeOnWeapons: 40, focusFirst: true, shortOf: GOODS[scarce].name, madeWithShortage: made }; }

      // ---------- research, treasury and pause ----------
      fresh({ gun: 100 }); slot = 0; forge(); const top = cov('gun').a.k; delete G.researched[top]; const next = cov('gun').a.k;
      check(next !== top, 'Unresearched item still chosen'); forgeTick(); check(!G.kit.gun[top] && G.kit.gun[next] > 0, 'Forged unresearched gear');
      fresh({ gun: 100 }); slot = 0; forge(); const k0 = cov('gun').a.k; G.gold = 150 + setCost(k0) * 3 + 1; forgeTick();
      check(G.gold >= 150 && cov('gun').a.have + cov('gun').h.have <= 4, 'Spent below the 150G floor');
      fresh({ gun: 100 }); slot = 0; forge(); G.forge.gun = false; forgeTick(); check(cov('gun').a.have === 0, 'Paused formation forged');
      fresh({ gun: 100 }); slot = 0; forge(); const scarce = Object.keys(ITEMS[k0].res || {})[0];
      if (scarce) { G.stock[scarce] = 0; G.forgeDebt = {}; forgeTick(); check(cov('gun').a.have === 0, 'Forged without materials'); }
      out.limits = { researchRespected: true, goldFloor: G.gold >= 150, pauseRespected: true, materialShortStops: !!scarce };

      // ---------- the village smiths' shared trickle goes round the formations ----------
      fresh({ inf: 100, arc: 100, gun: 100, cav: 100 }); slot = 0; window.forgeCapacity = () => 40; forgeTick();
      const share = ['inf', 'arc', 'gun', 'cav'].map(t => { const c = cov(t); return c.w.have + c.a.have + c.h.have; });
      check(share.reduce((a, b) => a + b) === 40 && share.every(n => n === 10), 'Smiths did not share evenly: ' + share);
      out.smithsShare = share;

      // ---------- upgrades: cost, materials, carpentry time, output during and after ----------
      fresh({ gun: 1000 }); slot = 0; const ub = forge(); const B = BUILDINGS.teppo_kaji, N2 = nextLv(ub);
      check(N2 && N2.lv === 2 && N2.cost === B.cost * 2 && N2.res.wood === 20 && N2.res.ore === 20, 'Lv2 cost ' + JSON.stringify(N2));
      const gb = G.gold, wb = G.stock.wood, ob = G.stock.ore; check(!startReno(ub), 'Upgrade refused');
      check(gb - G.gold === B.cost * 2 && wb - G.stock.wood === 20 && ob - G.stock.ore === 20, 'Upgrade charged wrongly');
      check(forgeOutput(ub) === 40 && ub.reno.w === 2, 'Output during carpentry'); renoWeek(); renoWeek(); check(forgeLevel(ub) === 2 && forgeOutput(ub) === 65, 'Lv2 not reached');
      const N3 = nextLv(ub); check(N3.lv === 3 && N3.cost === B.cost * 4 && N3.res.wood === 40 && N3.res.ore === 40, 'Lv3 cost'); startReno(ub); renoWeek(); renoWeek(); check(forgeLevel(ub) === 2, 'Lv3 too fast'); renoWeek();
      check(forgeLevel(ub) === 3 && forgeOutput(ub) === 90 && !nextLv(ub), 'Lv3 / max'); G.gold = 10; const ub2 = forge(); check(renoBlock(ub2, nextLv(ub2)) === 'Not enough gold.', 'Unaffordable upgrade allowed');
      out.upgrades = { lv2: { gold: N2.cost, wood: 20, ore: 20, weeks: 2 }, lv3: { gold: N3.cost, wood: 40, ore: 40, weeks: 3 } };

      // ---------- a save from before forge levels and quality-free forging ----------
      fresh({ gun: 60 }); slot = 0; const ob1 = forge(); delete ob1.lv; delete ob1.forgeFocus; const lowk = kitList('a', 'gun').filter(k => k !== cov('gun').a.k)[0]; kitAdd('gun', lowk, 20, 3);
      check(saveGame(), 'save'); G = null; check(loadGame(), 'Old save did not load'); afterLoad(); MQ.length = 0; $('#modal').hidden = true; window.forgeCapacity = () => 0;
      const ob2 = G.buildings.find(b => b.id === 'teppo_kaji'); check(forgeLevel(ob2) === 1 && forgeFocus(ob2) === 'weapon' && G.kitQuality.gun[lowk][3] === 20, 'Old save lost levels, focus or quality');
      ob2.forgeFocus = 'armor'; G.gold = 1e9; forgeTick(); check(cov('gun').a.have + cov('gun').h.have === 40 && G.kitQuality.gun[lowk][3] === 20, 'Old save did not forge');
      out.oldSave = 'loads at Level 1, keeps quality sets, forges';

      // ---------- UI: forge panel and Army screen on a phone ----------
      fresh({ inf: 300, arc: 200, gun: 1000, cav: 100 }); slot = 0; const fb = forge('teppo_kaji', 'armor', 2); forge('teppo_kaji', 'weapon');
      openBuildingInfo(fb); const txt = $('#sh-body').textContent;
      check(/Level 2/.test(txt) && /65/.test(txt) && /Upgrade to Level 3/.test(txt) && new RegExp(fmt(BUILDINGS.teppo_kaji.cost * 4)).test(txt), 'Forge panel misses level, output or upgrade cost');
      check(document.documentElement.scrollWidth <= innerWidth, 'Forge panel overflows'); closeSheet();
      openPanel('army'); UI.tab = 'troops'; refreshSheet(); const row = [...document.querySelectorAll('#sh-body .trow')].find(r => /Gunners/.test(r.textContent));
      check(row && /%/.test(row.querySelector('.tkit').textContent) && row.querySelector('.frate').textContent.includes(String(forgeRate('gun', 'weapon') + forgeRate('gun', 'armor'))), 'Army screen misses coverage or rate');
      check(document.documentElement.scrollWidth <= innerWidth && $('#sh-body').scrollHeight <= 900, 'Army troops tab too big'); closeSheet();
      out.ui = { forgePanel: true, armyCoverage: row.querySelector('.tkit').textContent.trim().replace(/\s+/g, ' ') };
      window.toast = realToast; window.forgeCapacity = realCap;
      return out;
    });
    assert.deepStrictEqual(errors, []);
    fs.writeFileSync(dir + '/reports/forge.json', JSON.stringify({ ...report, errors }, null, 2));
    console.log(JSON.stringify({ ...report, errors }, null, 2));
  } finally { await browser.close(); server.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
