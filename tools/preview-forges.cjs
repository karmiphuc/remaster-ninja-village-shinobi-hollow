// Development-only contact sheet of the actual cached forge assets, both focuses.
const fs = require('fs'), http = require('http'), path = require('path');
const {chromium} = require('playwright');
const root = path.resolve(__dirname, '..');
const output = path.resolve(process.argv[2] || path.join(root, 'docs/forge-upgrades-preview.png'));
(async () => {
  const server = http.createServer((request, response) => {
    response.setHeader('content-type', 'text/html');
    response.end(fs.readFileSync(path.join(root, 'index.html')));
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  let browser;
  try {
    browser = await chromium.launch({headless: true,
      executablePath: process.env.CHROMIUM_PATH || (fs.existsSync('/usr/bin/chromium') ? '/usr/bin/chromium' : undefined),
      args: ['--no-sandbox']});
    const page = await browser.newPage(), errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.addInitScript(() => { window.__noIntro = window.__noQuick = true; });
    await page.goto('http://127.0.0.1:' + server.address().port);
    const png = await page.evaluate(() => {
      const canvas = gameCanvas(); canvas.width = 1200; canvas.height = 1110;
      const ctx = canvas.getContext('2d'); ctx.imageSmoothingEnabled = false;
      ctx.fillStyle = '#e8d8b0'; ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#342a2a'; ctx.font = 'bold 22px monospace';
      ctx.fillText('Formation forges - completed upgrades', 26, 34);
      ctx.font = '14px monospace';
      ctx.fillText('Actual procedural sprites at 3x. Left: Weapons (red). Right: Armor (green).', 26, 60);
      for (let level = 1; level <= 3; level++) {
        const col = (level - 1) * 400;
        ctx.font = 'bold 18px monospace';
        ctx.fillText('LEVEL ' + level + ' / ' + (level - 1) + (level === 2 ? ' CHIMNEY' : ' CHIMNEYS'), col + 64, 104);
        let row = 0;
        for (const id of Object.keys(ARMY_FORGES)) {
          const y = 130 + row++ * 245;
          ctx.fillStyle = '#342a2a'; ctx.font = '16px monospace';
          ctx.fillText(BUILDINGS[id].name, col + 30, y + 14);
          for (const armor of [false, true]) {
            const sprite = buildingSprite(id, armor ? 4 : 0, level);
            ctx.save(); ctx.translate(col + (armor ? 225 : 38), y + 86); ctx.scale(3, 3);
            artDraw(ctx, sprite.cv, sprite.ox, sprite.oy); ctx.restore();
          }
          ctx.fillStyle = '#762a26'; ctx.font = '14px monospace'; ctx.fillText('Weapons', col + 72, y + 216);
          ctx.fillStyle = '#254e30'; ctx.fillText('Armor', col + 265, y + 216);
        }
      }
      const png = canvas.toDataURL('image/png').split(',')[1];
      canvas.width = canvas.height = 0;
      return png;
    });
    if (errors.length) throw new Error(errors.join('\n'));
    fs.writeFileSync(output, Buffer.from(png, 'base64'));
    console.log('Wrote ' + output);
  } finally { if (browser) await browser.close(); server.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
