// Stock limits: a field holds 60; a shop or workshop holds 30 materials + 30 wares (60 in all). A workshop's 30 inputs
// are shared equally between the materials in play, so one cannot crowd out another. One pile icon = up to 6 of a
// good (rounded up), stacked bottom-up 4-3-2-1: a full field shows 10 icons, each full shelf 5. Pickup triggers keep
// their old sizes (fields 18, workshops 6). Writes reports/stock-caps.json.
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
    const report = await p.evaluate(() => {
      const check = (x, m) => { if (!x) throw Error(m); }, out = {};
      Math.random = seeded(4); newGame(); $('#title').hidden = true; resizeView(); afterLoad(); MQ.length = 0; $('#modal').hidden = true; G.speed = 0;
      out.caps = { field: PILE_CAP, shopShelf: SHOP_CAP, workshopIn: WS_IN_CAP, workshopOut: OUT_CAP, unit: PILE_UNIT, fieldHaul: FIELD_HAUL, workshopHaul: WS_HAUL };
      check(PILE_CAP === 60 && SHOP_CAP === 30 && WS_IN_CAP === 30 && OUT_CAP === 30 && PILE_UNIT === 6, 'Caps are not 60 / 30+30 / 30+30 / 6 per icon');
      check(FIELD_HAUL === 18 && WS_HAUL === 6, 'Pickup triggers changed');

      // ---- a field fills to exactly 60, then holds the next harvest in its baskets and pauses ----
      const field = G.buildings.find(b => BUILDINGS[b.id].makes === 'rice'), v = G.villagers[0]; v.role = 'work';
      field.pile = 0; field.buffer = 0; let harvests = 0;
      while ((field.pile || 0) < PILE_CAP && harvests < 200) { produce(field, v); harvests++; }
      check(field.pile === PILE_CAP, `Field stopped at ${field.pile}, not 60`); produce(field, v);
      check(field.pile === PILE_CAP && field.buffer > 0 && economyFull(field), 'A full field did not keep the next harvest in its baskets and pause');
      out.field = { filledTo: field.pile, harvests, nextHarvestWaits: field.buffer, paused: economyFull(field) };

      // ---- shops: 30 materials and 30 wares; materials split equally between the kinds a shop sells ----
      const on = place('onigiri', 4, 30, true) || G.buildings.find(b => b.id === 'onigiri'), nd = place('noodle', 8, 30, true); invalidateRoadTraffic();
      check(on && nd, 'Could not place shops');
      out.shops = { onigiriRice: shopRoom(on, 'rice'), noodleRice: shopRoom(nd, 'rice'), noodleVeg: shopRoom(nd, 'veg'), noodleWares: shopRoom(nd, 'mochi') };
      check(shopRoom(on, 'rice') === 30 - shopTotal(on), 'One-material shop does not take 30');
      check(shopRoom(nd, 'rice') === 15 && shopRoom(nd, 'veg') === 15, 'Two-material shop does not split 30 into 15 + 15');
      check(shopRoom(nd, 'mochi') === 30, 'Ware shelf does not take 30');

      // ---- workshops: 30 inputs in all, shared equally between the materials in play; 30 wares ----
      const ws = place('workshop', 12, 30, true); check(ws, 'Could not place workshop'); ws.inbox = {}; ws.outs = {};
      const room = g => economyRoom(economyPoint(ws, 'inbox'), g), inPlay = (...g) => { ws._inK = { t: RT.t, k: new Set(g) }; };
      // bento's two inputs in play: 15 each, one can't crowd out the other, never more than 30 in all
      inPlay('rice', 'veg'); check(room('rice') === 15 && room('veg') === 15, `Two materials in play should take 15 + 15, got ${room('rice')} + ${room('veg')}`);
      ws.inbox.rice = 15; inPlay('rice', 'veg'); check(room('rice') === 0 && room('veg') === 15, 'Rice crowded out veg');
      ws.inbox.veg = 15; inPlay('rice', 'veg'); check(inboxTotal(ws) === 30 && room('rice') === 0 && room('veg') === 0, 'Workshop inputs went past 30');
      out.workshop = { bentoInputs: '15 rice + 15 veg', afterFullRice: 'veg still 15', full: inboxTotal(ws) + '/30' };
      // a lone material in play may take all 30; held goods count as in play
      ws.inbox = {}; inPlay('rice'); check(room('rice') === 30, 'A lone material cannot take 30');
      ws.inbox = { ore: 3 }; ws._inK = null; check(inboxKinds(ws).has('ore'), 'Goods already held are not counted as in play');
      // reservations for incoming deliveries count against both the share and the 30
      ws.inbox = {}; inPlay('rice', 'veg'); check(inboxRoom(ws, 'rice', 20, 10) === 5 && inboxRoom(ws, 'veg', 20, 10) === 5, 'Incoming deliveries not counted');
      out.workshop.loneMaterial = 30;
      ws._inK = null; check(OUT_CAP - outTotal(ws) === 30, 'Workshop wares room is not 30');

      // ---- pile icons: up to 6 per icon, rounded up; 4-3-2-1 stacks ----
      out.icons = Object.fromEntries([1, 5, 6, 7, 12, 13, 24, 25, 30, 31, 54, 55, 60].map(n => [n, pileIcons({ rice: n }, 60).length]));
      check(out.icons[1] === 1 && out.icons[6] === 1 && out.icons[7] === 2 && out.icons[12] === 2 && out.icons[13] === 3 && out.icons[30] === 5 && out.icons[31] === 6 && out.icons[54] === 9 && out.icons[55] === 10 && out.icons[60] === 10, 'Icon counts are not ceil(n / 6)');
      check(pileIcons({ rice: 5.9 }, 60).length === 1 && pileIcons({ rice: .9 }, 60).length === 0, 'Icons should count whole units, as the panels do');
      check(pileIcons({ rice: 30 }, 30).length === 5 && pileIcons({ rice: 60 }, 30).length === 5, 'A shelf pile shows at most 5 icons');
      check(JSON.stringify(pileRows(10)) === '[4,3,2,1]' && JSON.stringify(pileRows(1)) === '[1]', 'Field stack is not 4-3-2-1');
      check(JSON.stringify(pileRows(5, 2)) === '[2,2,1]' && JSON.stringify(pileRows(3, 2)) === '[2,1]' && JSON.stringify(pileRows(4, 2)) === '[2,2]', 'Shelf stack is not 2-2-1');
      out.stacks = { field10: pileRows(10), shelf5: pileRows(5, 2) };
      const mix = pileIcons({ rice: 18, veg: 12 }, 30); check(mix.join() === 'rice,rice,rice,veg,veg', 'Mixed stock not shown in proportion: ' + mix);
      const few = pileIcons({ rice: 25, veg: 1 }, 30); check(few.includes('veg') && few.length === 5, 'A kind in stock was left out of the pile: ' + few);
      out.mixed = { '18 rice + 12 veg': mix.join(' '), '25 rice + 1 veg': few.join(' ') };
      const im10 = pileStackSprite(pileIcons({ rice: 60 }, 60), 4), im5 = pileStackSprite(pileIcons({ rice: 30 }, 30), 2), crate5 = pileStackSprite(pileIcons({ w_mochi: 30 }, 30), 2);
      out.sizes = { field10: [im10.width, im10.height], shelf5Rice: [im5.width, im5.height], shelf5Crates: [crate5.width, crate5.height] };
      check(im5.width + crate5.width <= 32 + 4, 'Two full shelf piles do not fit a 2x2 building side by side'); check(im10.width <= 32, 'A full field pile is wider than its field');

      // ---- panels show the numbers ----
      const shopTxt = shopStockPanel(on).textContent, wsTxt = workshopPanel(ws).textContent;
      check(/Materials\s*\d+\/30/.test(shopTxt) && /Wares\s*\d+\/30/.test(shopTxt), 'Shop panel does not show /30: ' + shopTxt.slice(0, 120));
      check(/Materials\s*0\/30\s*→\s*Wares\s*0\/30/.test(wsTxt), 'Workshop panel does not show Materials n/30 → Wares n/30');
      out.panels = { shop: (shopTxt.match(/Materials\s*\d+\/30/) || [''])[0] + ' · ' + (shopTxt.match(/Wares\s*\d+\/30/) || [''])[0], workshop: (wsTxt.match(/Materials[^W]*Wares\s*\d+\/30/) || [''])[0] };
      return out;
    });
    assert.deepStrictEqual(errors, []);
    fs.mkdirSync(dir + '/reports', { recursive: true }); fs.writeFileSync(dir + '/reports/stock-caps.json', JSON.stringify({ ...report, errors }, null, 2));
    console.log(JSON.stringify({ ...report, errors }, null, 2));
  } finally { await browser.close(); server.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
