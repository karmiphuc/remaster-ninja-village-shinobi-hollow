// Render the actual procedural assets beside the established village family.
// Development-only: the standalone game does not load this script or its PNG.
const fs = require('fs');
const http = require('http');
const path = require('path');
const {chromium} = require('playwright');
const root = path.resolve(__dirname, '..');
const source = path.resolve(process.argv[2] || path.join(root, 'index.html'));
const output = path.resolve(process.argv[3] || path.join(root, 'docs/porter-house-preview.png'));

(async () => {
  const server = http.createServer((request, response) => {
    response.setHeader('content-type', 'text/html');
    response.end(fs.readFileSync(source));
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  let browser;
  try {
    browser = await chromium.launch({
      headless: true,
      executablePath: process.env.CHROMIUM_PATH || (fs.existsSync('/usr/bin/chromium') ? '/usr/bin/chromium' : undefined),
      args: ['--no-sandbox']
    });
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.addInitScript(() => { window.__noIntro = window.__noQuick = true; });
    await page.goto('http://127.0.0.1:' + server.address().port);
    const png = await page.evaluate(() => {
      newGame();
      G.speed = 0;
      const canvas = gameCanvas();
      canvas.width = 1260;
      canvas.height = 1000;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#e8d8b0';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.imageSmoothingEnabled = false;
      const ids = ['lumber', 'mine', 'porter', 'workshop', 'kura', 'smithy', 'hut', 'longhouse', 'tonya'];
      for (let i = 0; i < ids.length; i++) {
        const col = i % 3, row = (i / 3) | 0;
        const building = {id: ids[i], uid: 9000 + i, x: 0, y: 0, pile: 12};
        G.buildings.push(building);
        G.villagers[0].role = 'work';
        G.villagers[0].job = building.uid;
        const sprite = i < 2 ? worksiteInfoSprite(building) : buildingSprite(ids[i], 0);
        ctx.save();
        ctx.translate(105 + col * 420, 82 + row * 330);
        ctx.scale(6, 6);
        artDraw(ctx, sprite.cv, sprite.ox, sprite.oy);
        if (i < 2) drawLogi(ctx, building, BUILDINGS[building.id], 0, 0);
        ctx.restore();
        ctx.fillStyle = '#342a2a';
        ctx.font = '18px monospace';
        ctx.fillText(BUILDINGS[ids[i]].name, 78 + col * 420, 312 + row * 330);
      }
      const png = canvas.toDataURL('image/png').split(',')[1];
      canvas.width = canvas.height = 0;
      return png;
    });
    if (errors.length) throw new Error(errors.join('\n'));
    fs.writeFileSync(output, Buffer.from(png, 'base64'));
    console.log('Wrote ' + output);
  } finally {
    if (browser) await browser.close();
    server.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
