// Dialogs on small screens: a dialog never grows past the screen (its body scrolls, the backdrop scrolls as a last
// resort), and the dialogs players click straight through (the New Game campaign hand, the Year in review, duels,
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
        newGame(); $('#title').hidden = true; resizeView(); afterLoad(); MQ.length = 0; $('#modal').hidden = true;
        // ---- the New Game campaign hand ----
        offerDoctrine(); await wait(120);
        const M = () => $('#modal'), inner = () => M().querySelector('.modal-in'), bd = () => M().querySelector('.modal-bd');
        const topRow = () => M().querySelector('.modal-ft-top'), botRow = () => M().querySelector('.modal-ft');
        check(/campaign hand/.test(M().textContent), 'No campaign hand');
        check(inner().getBoundingClientRect().bottom <= innerHeight + 1 && inner().getBoundingClientRect().top >= -1, 'Dialog taller than the screen');
        check(!topRow().hidden && vis(topRow()) && topRow().querySelectorAll('button').length === botRow().querySelectorAll('button').length, 'Top buttons missing or off screen');
        check([...topRow().querySelectorAll('button')].map(b => b.textContent).join('|') === [...botRow().querySelectorAll('button')].map(b => b.textContent).join('|'), 'Top and bottom buttons differ');
        // the bottom buttons are reachable: visible, or the body scrolls to them
        const B = bd(); if (!vis(botRow())) { check(B.scrollHeight > B.clientHeight, 'Bottom buttons hidden and nothing scrolls'); }
        B.scrollTop = B.scrollHeight; await wait(30); check(vis(botRow()), 'Bottom buttons not reachable by scrolling');
        out.hand = { fits: true, topButtons: [...topRow().querySelectorAll('button')].map(b => b.textContent), scrolls: B.scrollHeight > B.clientHeight };
        // the top Redraw and Accept do exactly what the bottom ones do
        const doc0 = G.boons.doc; topRow().querySelector('button').click(); await wait(80);
        check(G.boons.rr === 1 && /campaign hand/.test(M().textContent) && [...topRow().querySelectorAll('button')].map(b => b.textContent).join('|') === '承 Accept the hand', 'Top Redraw did not redraw');
        topRow().querySelector('button').click(); await wait(80); check(M().hidden && !G.boons.pending && G.boons.doc, 'Top Accept did not accept'); out.hand.topWorks = true;
        // ---- the Year in review ----
        G.year = 2; yrLedger(); yrNote('won', 3); yrNote('battles', 4); G.year = 3; const R = yearReport(); check(R, 'No year report'); yearTick(); await wait(80);
        check(/in review/.test(M().textContent) && !topRow().hidden && vis(topRow()), 'Year review lacks top buttons');
        check(inner().getBoundingClientRect().bottom <= innerHeight + 1, 'Year review taller than the screen');
        topRow().querySelector('button').click(); await wait(60); check(M().hidden || !/in review/.test(M().textContent), 'Top Onward did not close'); MQ.length = 0; M().hidden = true;
        out.yearReview = { topButtons: ['Onward'] };
        // ---- a short dialog keeps a single row; a long one gets the top row too ----
        announce('Short', 'One line.'); await wait(60); check(topRow().hidden, 'Short dialog got a second row'); MQ.length = 0; showModal();
        announce('Long', '<p>' + 'A very long dispatch from the provinces. '.repeat(120) + '</p>'); await wait(60);
        check(!topRow().hidden && vis(topRow()) && inner().getBoundingClientRect().bottom <= innerHeight + 1, 'Long dialog: no top row or too tall'); MQ.length = 0; showModal();
        out.generic = { shortOneRow: true, longTopRow: true };
        // ---- the backdrop itself can scroll (last resort), and touch panning is allowed on it ----
        check(getComputedStyle(M()).overflowY === 'auto' && /pan-y/.test(getComputedStyle(M()).touchAction) && /pan-y/.test(getComputedStyle(M().querySelector('.modal-bd') || document.createElement('div')).touchAction || 'pan-y'), 'Backdrop cannot scroll');
        // ---- hunt ----
        const H = HUNTS[HUNTS.length - 1];
        openHunt(H); await wait(60); const ht = $('#sh-body [data-top-of="hunt"]'); check(ht && vis(ht.querySelector('.btn.red')), 'Hunt top buttons missing');
        let started = 0; const sb = window.startBattle; window.startBattle = () => { started++; return true; }; ht.querySelector('.btn.red').click(); window.startBattle = sb; check(started === 1, 'Top Begin the hunt did nothing');
        openHunt(H); await wait(30); $('#sh-body [data-top-of="hunt"] .btn.ghost').click(); check(!$('#sheet').classList.contains('open') || UI.panel !== 'hunt', 'Top Let it go did nothing');
        out.hunt = { topButtons: ['Let it go', 'Begin the hunt'] };
        // ---- battle deployment and a duel ----
        ['arc', 'gun', 'cav'].forEach(t => { G.researched['corps_' + t] = 1; G.units[t] = true; }); G.villagers.forEach((v, i) => { v.role = ['inf', 'inf', 'cav', 'gun'][i] || 'work'; }); G.allHands = false; G.troops = { inf: 600, arc: 300, gun: 300, cav: 200 };
        G.researched.siegegun = 1; G.gold = 99999; check(startBattle('yamashiro'), 'Battle did not start'); await wait(60);
        const dt = $('#btac [data-top-of="deploy"]'); check(dt && vis(dt.querySelector('[data-press="bt-go"]')), 'Deploy top Attack missing or off screen');
        const pap = $('#btac .in > .paper'); check(pap.getBoundingClientRect().top >= -1, 'Deploy panel runs off the top');
        let began = 0; const br = window.beginRound; window.beginRound = () => { began++; }; dt.querySelector('[data-press="bt-go"]').click(); window.beginRound = br; check(began === 1, 'Top Attack did not attack');
        BT.round = 1; BT.duelRound = null; BT.auto = false; const R2 = Math.random; Math.random = () => .01; let duel; try { duel = preDuel(); } finally { Math.random = R2; }
        if (duel) { await wait(60); const tp = $('#btac [data-top-of="duel"]'); check(tp && vis(tp.querySelector('[data-press="dp-go"]')), 'Duel top Fight! missing or off screen');
          let spec = null; const sd = window.startDuel; window.startDuel = s => { spec = s; }; tp.querySelector('[data-press="dp-go"]').click(); window.startDuel = sd; check(spec && spec.pairs, 'Top Fight! did not start the duel'); out.duel = { topButtons: [...tp.querySelectorAll('button')].map(b => b.textContent) }; }
        else out.duel = 'no duel offered at this size';
        closeBattle(); MQ.length = 0; $('#modal').hidden = true;
        return out;
      });
      await p.close();
    }
    assert.deepStrictEqual(errors, []);
    fs.mkdirSync(dir + '/reports', { recursive: true });
    fs.writeFileSync(dir + '/reports/dialogs.json', JSON.stringify({ ...report, errors }, null, 2));
    console.log(JSON.stringify({ ...report, errors }, null, 2));
  } finally { await browser.close(); server.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
