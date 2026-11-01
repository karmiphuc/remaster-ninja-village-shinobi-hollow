// Dialogs on small screens: buttons keep the page's touch-action none (a tap registers at once), a dialog taller than
// the screen is pinned to the top so it never runs off above it, and the dialogs players click straight through (the New Game campaign hand, the Year in review, duels,
// hunts and the battle deployment) carry their action buttons at the top as well as the bottom, so the way on never
// sits below a long scroll. Any other dialog too tall for the screen also gets the top row. Writes reports/dialogs.json.
const fs = require('fs'), http = require('http'), assert = require('assert'), path = require('path'), { chromium } = require('playwright');
const dir = path.resolve(__dirname, '..');
const ignorable = t => /Failed to load resource: net::ERR_(TUNNEL_CONNECTION_FAILED|FAILED|NAME_NOT_RESOLVED|INTERNET_DISCONNECTED)/.test(t);
(async () => {
  const server = http.createServer((q, r) => { r.setHeader('Content-Type', 'text/html'); r.end(fs.readFileSync(dir + '/index.html')); });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH || (fs.existsSync('/usr/bin/chromium') ? '/usr/bin/chromium' : undefined), args: ['--no-sandbox'] });
  const report = {}, errors = [];
  try {
    for (const [w, h] of [[375, 667], [390, 844], [844, 390], [1280, 800]]) {
      const p = await browser.newPage({ viewport: { width: w, height: h }, hasTouch: w < 900, isMobile: w < 900 });
      p.on('pageerror', e => errors.push(e.message)); p.on('console', m => { if (m.type() === 'error' && !ignorable(m.text())) errors.push(m.text()); });
      await p.addInitScript(() => { window.__noIntro = true; window.__noQuick = true; });
      await p.goto('http://127.0.0.1:' + server.address().port);
      report[`${w}x${h}`] = await p.evaluate(async () => {
        const check = (x, m) => { if (!x) throw Error(m); };
        const wait = ms => new Promise(r => setTimeout(r, ms));
        const vis = el => { if (!el || el.hidden || el.offsetParent === null) return false; const r = el.getBoundingClientRect(); return r.top >= -1 && r.bottom <= innerHeight + 1 && r.width > 0; };
        const out = {};
        const effTA = el => { const v = []; for (let e = el; e && e !== document.documentElement; e = e.parentElement) { const cs = getComputedStyle(e); v.push(cs.touchAction); if (e !== el && /auto|scroll/.test(cs.overflowY) && e.scrollHeight > e.clientHeight) break; } return v.includes('none') ? 'none' : v.find(x => x !== 'auto') || 'auto'; };
        const allNone = sel => [...document.querySelectorAll(sel)].filter(b => b.offsetParent).every(b => effTA(b) === 'none');
        newGame(); $('#title').hidden = true; resizeView(); afterLoad(); MQ.length = 0; $('#modal').hidden = true;
        // ---- the New Game campaign hand ----
        offerDoctrine(); await wait(120);
        const M = () => $('#modal'), inner = () => M().querySelector('.modal-in'), bd = () => M().querySelector('.modal-bd');
        const topRow = () => M().querySelector('.modal-ft-top'), botRow = () => M().querySelector('.modal-ft');
        check(/campaign hand/.test(M().textContent), 'No campaign hand');
        check(inner().getBoundingClientRect().top >= -1, 'Dialog runs off the top of the screen');
        check(!topRow().hidden && vis(topRow()) && topRow().querySelectorAll('button').length === botRow().querySelectorAll('button').length, 'Top buttons missing or off screen');
        check([...topRow().querySelectorAll('button')].map(b => b.textContent).join('|') === [...botRow().querySelectorAll('button')].map(b => b.textContent).join('|'), 'Top and bottom buttons differ');
        // the bottom buttons are reachable: visible, or the body scrolls to them
        const B = bd(); B.scrollTop = B.scrollHeight; await wait(30); const bottomReach = vis(botRow()); // recorded; the top row is the guaranteed way on
        check(allNone('#modal button'), 'A campaign-hand button would wait to see if a tap is a swipe');
        out.hand = { fits: inner().getBoundingClientRect().bottom <= innerHeight + 1, bottomReachable: bottomReach, topButtons: [...topRow().querySelectorAll('button')].map(b => b.textContent), scrolls: B.scrollHeight > B.clientHeight };
        // the top Redraw and Accept do exactly what the bottom ones do
        const doc0 = G.boons.doc; topRow().querySelector('button').click(); await wait(80);
        check(G.boons.rr === 1 && /campaign hand/.test(M().textContent) && [...topRow().querySelectorAll('button')].map(b => b.textContent).join('|') === '承 Accept the hand', 'Top Redraw did not redraw');
        topRow().querySelector('button').click(); await wait(80); check(M().hidden && !G.boons.pending && G.boons.doc, 'Top Accept did not accept'); out.hand.topWorks = true;
        // ---- the Year in review ----
        G.year = 2; yrLedger(); yrNote('won', 3); yrNote('battles', 4); G.year = 3; const R = yearReport(); check(R, 'No year report'); yearTick(); await wait(80);
        check(/in review/.test(M().textContent) && !topRow().hidden && vis(topRow()), 'Year review lacks top buttons');
        check(inner().getBoundingClientRect().top >= -1, 'Year review runs off the top of the screen');
        topRow().querySelector('button').click(); await wait(60); check(M().hidden || !/in review/.test(M().textContent), 'Top Onward did not close'); MQ.length = 0; M().hidden = true;
        out.yearReview = { topButtons: ['Onward'] };
        // ---- a short dialog keeps a single row; a long one gets the top row too ----
        announce('Short', 'One line.'); await wait(60); check(topRow().hidden, 'Short dialog got a second row'); MQ.length = 0; showModal();
        announce('Long', '<p>' + 'A very long dispatch from the provinces. '.repeat(120) + '</p>'); await wait(60);
        check(!topRow().hidden && vis(topRow()), 'Long dialog: no top row on screen'); MQ.length = 0; showModal();
        out.generic = { shortOneRow: true, longTopRow: true };
        // ---- the backdrop is not a scroll area, so the buttons on it keep the page's touch-action none ----
        check(!/auto|scroll/.test(getComputedStyle(M()).overflowY) && getComputedStyle(M()).touchAction === 'auto', 'Backdrop became a scroll area again');
        // ---- hunt ----
        const H = HUNTS[HUNTS.length - 1];
        openHunt(H); await wait(60); const ht = $('#sh-body [data-top-of="hunt"]'); check(ht && vis(ht.querySelector('.btn.red')), 'Hunt top buttons missing');
        let started = 0; const sb = window.startBattle; window.startBattle = () => { started++; return true; }; ht.querySelector('.btn.red').click(); window.startBattle = sb; check(started === 1, 'Top Begin the hunt did nothing');
        openHunt(H); await wait(30); $('#sh-body [data-top-of="hunt"] .btn.ghost').click(); check(!$('#sheet').classList.contains('open') || UI.panel !== 'hunt', 'Top Let it go did nothing');
        out.hunt = { topButtons: ['Let it go', 'Begin the hunt'] };
        // ---- battle deployment and a duel ----
        ['arc', 'gun', 'cav'].forEach(t => { G.researched['corps_' + t] = 1; G.units[t] = true; }); G.villagers.forEach((v, i) => { v.role = ['inf', 'inf', 'cav', 'gun'][i] || 'work'; }); G.allHands = false; G.troops = { inf: 600, arc: 300, gun: 300, cav: 200 };
        G.researched.siegegun = 1; G.gold = 99999; check(startBattle('yamashiro'), 'Battle did not start'); await wait(60);
        const dt = $('#btac [data-top-of="deploy"]'); check(allNone('#btac .dlg-top:not([hidden]) button, #bt-go, #bt-retreat'), 'A deploy-panel button would wait to see if a tap is a swipe'); 
        // the top row shows whenever it fits; when it doesn't (landscape phone) the bottom Attack must be on screen instead
        check(dt && (vis(dt.querySelector('[data-press="bt-go"]')) || dt.hidden && vis($('#bt-go'))), 'Neither the top nor the bottom Attack is on screen');
        if (dt.hidden) out.deploy = 'top row hidden: panel already at the top edge; bottom Attack on screen';
        const pap = $('#btac .in > .paper'); check(dt.hidden || pap.getBoundingClientRect().top >= -1, 'The deploy top row pushed the panel off the top');
        let began = 0; const br = window.beginRound; window.beginRound = () => { began++; }; (dt.hidden ? $('#bt-go') : dt.querySelector('[data-press="bt-go"]')).click(); window.beginRound = br; check(began === 1, 'Top Attack did not attack');
        BT.round = 1; BT.duelRound = null; BT.auto = false; const R2 = Math.random; Math.random = () => .01; let duel; try { duel = preDuel(); } finally { Math.random = R2; }
        if (duel) { await wait(60); const tp = $('#btac [data-top-of="duel"]'); check(allNone('#btac .dlg-top:not([hidden]) button, #dp-go, #dp-no'), 'A duel button would wait to see if a tap is a swipe'); check(tp && (vis(tp.querySelector('[data-press="dp-go"]')) || tp.hidden && vis($('#dp-go'))), 'Neither the top nor the bottom Fight! is on screen');
          let spec = null; const sd = window.startDuel; window.startDuel = s => { spec = s; }; (tp.hidden ? $('#dp-go') : tp.querySelector('[data-press="dp-go"]')).click(); window.startDuel = sd; check(spec && spec.pairs, 'Top Fight! did not start the duel'); out.duel = tp.hidden ? 'top row hidden: panel already at the top edge; bottom Fight! on screen' : { topButtons: [...tp.querySelectorAll('button')].map(b => b.textContent) }; }
        else out.duel = 'no duel offered at this size';
        closeBattle(); MQ.length = 0; $('#modal').hidden = true;
        return out;
      });
      if (w < 900) report[`${w}x${h}`].touch = await realTouch(browser, w, h, server.address().port);
      await p.close();
    }
    assert.deepStrictEqual(errors, []);
    fs.mkdirSync(dir + '/reports', { recursive: true });
    fs.writeFileSync(dir + '/reports/dialogs.json', JSON.stringify({ ...report, errors }, null, 2));
    console.log(JSON.stringify({ ...report, errors }, null, 2));
  } finally { await browser.close(); server.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });

// Real finger input (CDP touch events, no scripted clicks): from the title, New Game -> welcome -> first steps ->
// campaign hand, each button must answer the first tap, including a tap whose finger drifts 6px; and a swipe on the
// long campaign hand scrolls it.
async function realTouch(browser, w, h, port) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, hasTouch: true, isMobile: true, deviceScaleFactor: 3 });
  const p = await ctx.newPage(); await p.goto('http://127.0.0.1:' + port); await p.waitForTimeout(800);
  const cdp = await ctx.newCDPSession(p), pt = (x, y) => [{ x, y, radiusX: 4, radiusY: 4, force: 1, id: 1 }];
  const settle = () => p.waitForTimeout(450); // dialogs pop in over 250ms
  const touch = async (x, y, dy = 0, steps = 3) => { await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: pt(x, y) });
    for (let k = 1; k <= steps; k++) { await p.waitForTimeout(16); await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: pt(x, y + dy * k / steps) }); }
    await p.waitForTimeout(20); await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); };
  const centre = sel => p.evaluate(sel => { const els = [...document.querySelectorAll(sel)].filter(e => e.offsetParent); const e = els[els.length - 1]; if (!e) return null; const r = e.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2, bottom: r.bottom }; }, sel);
  const title = () => p.evaluate(() => $('#modal').hidden ? null : $('#modal h3').textContent);
  const out = { steps: [] };
  let c = await centre('#t-new'); await touch(c.x, c.y); await settle();
  for (let i = 0; i < 6; i++) {
    const t = await title(); if (!t) break;
    if (/campaign hand/.test(t)) {
      const bd = await centre('#modal .modal-bd'); const before = await p.evaluate(() => $('#modal .modal-bd').scrollTop);
      const can = await p.evaluate(() => { const b = $('#modal .modal-bd'); return b.scrollHeight > b.clientHeight; });
      if (can) { await touch(bd.x, bd.y + 60, -120, 8); await p.waitForTimeout(400); const after = await p.evaluate(() => $('#modal .modal-bd').scrollTop);
        if (!(after > before)) throw Error(`${w}x${h}: a finger swipe did not scroll the campaign hand`); out.handSwipe = Math.round(after - before) + 'px'; }
      else out.handSwipe = 'fits without scrolling';
      c = await centre('#modal .modal-ft-top button'); if (c.y < 0 || c.y > h) throw Error(`${w}x${h}: campaign-hand top Accept off screen`); await touch(c.x, c.y, 6); await settle();
      if (await title() === t) throw Error(`${w}x${h}: the top Accept on the campaign hand needed more than one tap`);
      out.steps.push(t + ': 1 tap (top row, finger drifted 6px)'); break;
    }
    c = await centre('#modal .modal-ft button');
    if (c.bottom > h) { await p.evaluate(() => { const b = $('#modal .modal-bd'); b.scrollTop = b.scrollHeight; }); await settle(); c = await centre('#modal .modal-ft button'); }
    await touch(c.x, c.y, i % 2 ? 6 : 0); await settle();
    if (await title() === t) throw Error(`${w}x${h}: "${t}" needed more than one tap`);
    out.steps.push(t + ': 1 tap');
  }
  if (!out.steps.some(s => /campaign hand/.test(s))) throw Error(`${w}x${h}: never reached the campaign hand by touch (${out.steps.join(' | ')})`);
  await ctx.close(); return out;
}
