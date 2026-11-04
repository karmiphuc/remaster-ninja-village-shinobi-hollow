const fs = require('fs'), path = require('path'), http = require('http');
const assert = require('assert'), { chromium } = require('playwright');
const root = path.resolve(__dirname, '..'), dir = path.join(root, 'reports/assignment-mounts');

(async () => {
  const server = http.createServer((q, r) => r.end(fs.readFileSync(process.env.SHINOBI_DOWNLOAD || path.join(root, 'index.html'))));
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const browser = await chromium.launch({ executablePath: '/usr/bin/chromium', args: ['--no-sandbox'] });
  try {
    const p = await browser.newPage({ viewport: { width: 430, height: 932 } }), errors = [];
    p.on('pageerror', e => errors.push(e.message));
    await p.addInitScript(() => { window.__noIntro = window.__noQuick = true; });
    await p.route('https://**/*', r => r.abort());
    await p.goto('http://127.0.0.1:' + server.address().port);
    const report = await p.evaluate(() => {
      let checks = 0;
      const ok = (x, m) => { checks++; if (!x) throw Error(m); };
      newGame(); G.tut = 1; G.speed = 0; G.roll = null; afterLoad();
      MQ.length = 0; $('#modal').hidden = true; $('#title').hidden = true;
      G.villagers.forEach(v => v.job = -1);
      const template = structuredClone(vData(G.villagers[0].id));
      function worker(id, skill, work = 10, secondary = null) {
        const d = { ...template, id, name: id, role: 'work', base: [4, 4, 30, 4, 4, work / CALLING_BONUS], skill,
          skill2: secondary, sk: [[1, 1]], growth: 1 };
        RECRUITS.push(d); const v = addVillager(id, true); v.home = v.job = -1;
        return v;
      }
      const slow = worker('Ordinary hand', 'strongback', 19.99), fast = worker('Fast carrier', 'strongback');
      fast.eq = { weapon: null, armor: null, head: null, mount: 'ashige', special: 'waraji', special2: 'waraji' };
      const swift = worker('Swift carrier', 'swift'), tireless = worker('Tireless carrier', 'tireless');
      const thumb = worker('Green grower', 'greenthumb'), skilled = worker('Experienced grower', 'strongback', 20);
      const secondary = worker('Second calling', 'strongback', 10, 'swift');
      secondary.lv = 7;
      let spot;
      for (let y = 0; y < MAP_H - 1 && !spot; y++) for (let x = 0; x < MAP_W - 1; x++)
        if (!canPlace('porter', x, y) && entranceOf({ id: 'porter', x, y })) { spot = { x, y }; break; }
      ok(spot, 'No connected Porter House location');
      const porter = place('porter', spot.x, spot.y, true), field = G.buildings.find(b => b.id === 'paddy');
      function button(v) { return [...$('#sh-body .assign').children].find(el => el.textContent.includes(v.id)); }
      function badges(el) { return [...el.querySelectorAll('[data-worker-affinity]')].map(b => b.dataset.workerAffinity); }
      function candidates(b) { openBuildingInfo(b); const body = $('#sh-body'); body.innerHTML = ''; buildingWorkersPanel(body, b, true); }
      candidates(porter);
      ok(badges(button(fast)).includes('move'), 'Exactly +50% movement not highlighted');
      ok(badges(button(swift)).includes('swift'), 'Swift Feet omitted');
      ok(badges(button(tireless)).includes('tireless'), 'Tireless omitted');
      ok(badges(button(secondary)).includes('swift'), 'Active secondary skill omitted');
      ok(badges(button(slow)).length === 0 && badges(button(thumb)).length === 0, 'Porter highlight leaked to unrelated skills');
      fast.eq.mount = 'jiba'; candidates(porter);
      ok(!badges(button(fast)).includes('move'), 'Below +50% movement highlighted');
      fast.eq.mount = 'ashige'; candidates(porter);
      // Click the actual assignment handler; assigned cards must retain the useful markers.
      button(fast).click();
      ok(fast.job === porter.uid, 'Highlight blocked assignment');
      ok([...$('#sh-body [data-worker-list]').children].some(el => el.textContent.includes(fast.id) && badges(el).includes('move')), 'Assigned porter lost highlight');
      fast.job = -1;
      for (const id of ['paddy', 'veggie', 'teafield']) {
        candidates({ ...field, id });
        ok(badges(button(thumb)).includes('greenthumb'), id + ' omitted Green Thumb');
        ok(badges(button(skilled)).includes('work') && !badges(button(slow)).includes('work'), id + ' Work threshold is wrong');
      }
      candidates(field); button(thumb).click();
      ok(thumb.job === field.uid && [...$('#sh-body [data-worker-list]').children].some(el => el.textContent.includes(thumb.id) && badges(el).includes('greenthumb')), 'Assigned grower lost highlight');
      candidates({ ...field, id: 'lumber' });
      ok(!$('#sh-body [data-worker-affinity]'), 'Farm markers leaked into lumber');
      window.assignmentFixture = { porter, field, candidates };
      return { checks, movement: vStats(fast).move, farmWork: vStats(skilled).wrk, secondarySkill: vStats(secondary).sk.swift };
    });
    fs.mkdirSync(dir, { recursive: true });
    await p.evaluate(() => { openBuildingInfo(assignmentFixture.porter); });
    await p.screenshot({ path: path.join(dir, 'porter.png'), scale: 'css' });
    await p.evaluate(() => { openBuildingInfo(assignmentFixture.field); });
    await p.screenshot({ path: path.join(dir, 'farm.png'), scale: 'css' });
    await p.evaluate(() => { openVillager('Fast carrier'); });
    const battlePreview = p.locator('.doll img[alt="In battle"]');
    await battlePreview.evaluate(img => img.decode());
    assert(await battlePreview.evaluate(img => img.naturalWidth >= 156), 'Worker equipment battle preview still shows a foot sprite');
    await p.screenshot({ path: path.join(dir, 'worker-mount.png'), scale: 'css' });
    report.workerMountedPreview = true;

    report.mounts = await p.evaluate(() => {
      let checks = 0;
      const ok = (x, m) => { checks++; if (!x) throw Error(m); };
      closeSheet(); if (BT) closeBattle();
      const mounts = Object.keys(ITEMS).filter(k => isHorse(k)), types = ['inf', 'arc', 'gun', 'cav'];
      const weapons = { inf: 'katana', arc: 'yumi', gun: 'tanegashima', cav: 'yari' };
      const cv = document.createElement('canvas'); cv.width = 1120; cv.height = mounts.length * 176 + 35;
      const x = cv.getContext('2d'); x.fillStyle = '#e6d8b2'; x.fillRect(0, 0, cv.width, cv.height); x.imageSmoothingEnabled = false;
      x.fillStyle = '#30251e'; x.font = '16px monospace'; x.fillText('Rideable equipment · formation and weapon retained', 15, 24);
      for (let row = 0; row < mounts.length; row++) {
        const m = mounts[row];
        for (let col = 0; col < types.length; col++) {
          const type = types[col], L = artPresetLook(ART_PRESETS[0]);
          L.gear = { w: weapons[type], a: 'domaru', h: 'eboshi_samurai', m };
          const set = soldierSprites(type, 0, L), recipe = BATTLE_RECIPES.get(set);
          ok(set.horse?.length === 4 && set.fall && set.reload, m + '/' + type + ' not mounted');
          ok(recipe.type === 'cav' && recipe.L.gear.m === m && recipe.wid === weapons[type] && recipe.coat === MOUNT_LOOK[m].coat, 'Mount identity or weapon changed');
          ok(soldierSprites(type, 0, L) === set, 'Mounted render bypassed cache');
          const img = set.atk, scale = Math.min(1.8, 260 / img.width);
          artDraw(x, img, 140 + col * 280 - img.width * scale / 2, row * 176 + 184 - img.height * scale, img.width * scale, img.height * scale);
          x.fillText(ITEMS[m].name + ' · ' + type, 12 + col * 280, row * 176 + 204);
        }
        // Review pixels were copied; do not retain a whole campaign's atlases in this test.
        releaseBattleSprites();
      }
      const troop = soldierSprites('arc', 0, null, 0, { w: 'yumi', m: 'ashige' });
      ok(troop.horse && BATTLE_RECIPES.get(troop).L.gear.m === 'ashige', 'Rank-and-file equipped mount ignored');
      releaseBattleSprites();
      const L = artPresetLook(ART_PRESETS[0]); L.gear.w = 'katana';
      for (const k in ITEMS) if (ITEMS[k].slot === 'mount' && !isHorse(k)) {
        L.gear.m = k; ok(!soldierSprites('inf', 0, L).horse, 'Companion turned into a horse: ' + k);
        releaseBattleSprites();
      }
      window.mountFixture = function(mode = 'classic') {
        if (BT) closeBattle(); MQ.length = 0; $('#modal').hidden = true; G.battleMode = mode;
        function army(side) { return finishArmy({ side, name: side ? 'Rival' : 'Clan', clan: side ? 'kurogane' : 'kage', mode: 'army', strat: 0, ki: 0,
          groups: types.map(type => {
            const look = artPresetLook(ART_PRESETS[0]); look.gear = { w: weapons[type], a: 'domaru', h: 'eboshi_samurai', m: side ? 'pony' : 'nanbu' };
            const c = { name: type + ' officer', look, s: { atk: 24, def: 15, hp: 110, str: 20, mrk: 24, wrk: 10 }, hp: 110, hpMax: 110, post: 'line', guard: 1, skill: 'duelist', slv: 1,
              retF: [retFighter({ _i: 0, w: weapons[type], a: 'lamellar', h: 'jingasa', m: side ? 'ashige' : 'stallion' })] };
            return { type, troops: 90, atkMul: 1, defMul: 1, guards: 1, cmds: [c], mods: modsOf([c]) };
          }) }); }
        const pa = army(0), ea = army(1), powers = [armyPower(pa), armyPower(ea)];
        startBattle(null, { site: { id: 'mounts', name: 'Mounted review', type: 'dojo', clan: 'kurogane', power: 100, reward: {} }, pa, ea });
        BT.state = 'run'; BT.round = 1; BT.roundSeq = 1; BT.t = BT.anim = 2;
        return { pa, ea, powers };
      };
      const C = mountFixture();
      for (const A of BT.A) for (const g of A.groups) {
        const s = g.heroes[0], ghost = { hero: s.hero, _g: g };
        ok(s.sprs.horse && BATTLE_RECIPES.get(s.sprs).L.gear.m === (A.side ? 'pony' : 'nanbu'), 'Actual battle omitted equipped mount');
        ok(s.guards[0].sprs.horse && reactionRecipe(s.guards[0], g).L.gear.m === (A.side ? 'ashige' : 'stallion'), 'Retainer equipped mount lost');
        ok(JSON.stringify(duelWeapon({ ...s, _g: g })) === JSON.stringify(duelWeapon(ghost)), 'Headless mounted duel properties differ');
        ok(g.type === types[A.groups.indexOf(g)], 'Rendering changed formation');
        const r = reactionRecipe(s, g); ok(r.type === 'cav', 'Reaction reverted to foot soldier');
        for (const pose of ['guard', 'thrust', 'horseRear', 'horseBackKick']) ok(duelPoseFrame(s, g, pose, sideDir(A.side)).width > 0, 'Missing mounted duel pose');
      }
      ok(C.powers.every((v, i) => v === armyPower(BT.A[i])), 'Rendering changed army stats');
      const g = C.pa.groups[0], s = g.heroes[0]; routSprite(g, s, -1, true);
      s.guards = []; const cover = duelRetainer({ hr: s, g, si: 0 });
      ok(cover?.sprs.horse && reactionRecipe(cover, g).L.gear.m === 'stallion', 'Reserve rescue retainer lost equipped mount');
      ok(s.fate.mounted && reactionFrame(s, g, 'runA').width > 0, 'Infantry rider routed on foot');
      const gun = C.pa.groups[2], rider = gun.heroes[0]; killSprite(gun, rider, 'gun', -1);
      updateLifeState(rider, .5, gun, 0);
      ok(rider.fate.mounted && BT.loose.length === 1, 'Mounted gunner failed to dismount once');
      updateLifeState(rider, .1, gun, 0); ok(BT.loose.length === 1, 'Dismount duplicated horse');
      closeBattle();
      mountFixture('realtime'); BT.autoKi.on = false; rtStartWindow();
      const extra = BT.rt.extras.filter(m => m.source.hero);
      ok(extra.length === 8 && extra.every(m => m.style.mounted && m.style.kit.m), 'Real-time adapter lost mounts');
      for (let i = 0; i < 90; i++) updateBattle(1 / 30);
      drawBattle(); drawBattle();
      const create = document.createElement; let alloc = 0;
      document.createElement = function(tag, ...args) { if (tag === 'canvas') alloc++; return create.call(this, tag, ...args); };
      try { for (let i = 0; i < 60; i++) drawBattle(); } finally { document.createElement = create; }
      ok(alloc === 0, 'Mounted draw allocated canvases after warmup');
      ok(BT.A.every(A => A.groups.every((g, i) => g.type === types[i])), 'Real-time mount appearance changed formations');
      closeBattle(); ok(_battleArt.size === 0 && _soldierCache2.size === 0, 'Mounted sprite atlases leaked after battle');
      return { checks, rideable: mounts, formations: types, realtimeMountedOfficers: extra.length, warmCanvasAllocations: alloc, preview: cv.toDataURL('image/png').split(',')[1] };
    });
    fs.writeFileSync(path.join(dir, 'mounts.png'), Buffer.from(report.mounts.preview, 'base64')); delete report.mounts.preview;
    assert.deepStrictEqual(errors, []); report.errors = errors;
    fs.writeFileSync(path.join(dir, 'results.json'), JSON.stringify(report, null, 2));
    console.log(JSON.stringify(report, null, 2));
  } finally { await browser.close(); server.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
