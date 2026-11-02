// Real battle sprites/props: distinction, anchor safety, cache budgets and the existing collapse path.
const fs=require('fs'),http=require('http'),path=require('path'),assert=require('assert'),{chromium}=require('playwright'),install=require('../tools/command-heraldry-fixture.cjs');
const root=path.resolve(__dirname,'..');
(async()=>{const server=http.createServer((q,r)=>{r.setHeader('content-type','text/html');r.end(fs.readFileSync(process.env.COMMAND_DOWNLOAD||path.join(root,'index.html')));});await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({headless:true,executablePath:'/usr/bin/chromium',args:['--no-sandbox']});try{const p=await browser.newPage({viewport:{width:1280,height:820}}),errors=[];p.on('pageerror',e=>errors.push(e.message));await p.addInitScript(()=>{window.__noIntro=window.__noQuick=true;});await p.goto('http://127.0.0.1:'+server.address().port);await install(p);
 const report=await p.evaluate(()=>{const S=simPrepare(),out={};let checks=0;const ok=(v,m)=>{checks++;if(!v)throw Error(m);};
  try{const cases=[];for(const cfg of [{site:'camp'},{site:'dojo',small:true},{site:'clan'},{site:'camp',skirm:true}]){
    commandArtFixture(cfg);const enemy=BT.A[1],officers=enemy.groups.flatMap(g=>g.spr.concat(g.heroes||[]).filter(s=>s.hero)).concat(enemy.hqSpr||[]);
    ok(officers.length>0&&officers.every(s=>s.sashimono?.rank.startsWith('enemy')),'Enemy commander lacks special flag: '+JSON.stringify(cfg));
    ok(officers.some(s=>s.sashimono.rank==='enemyLord')&&officers.some(s=>s.sashimono.rank==='enemyVanguard'),'Rank silhouettes missing');
    if(cfg.skirm||cfg.small)ok(enemy.groups.every(g=>g.spr.filter(s=>!s.hero).every(s=>!s.sashimono)),'Flags added to all small-band troops');
    const g=enemy.groups[0],c=officers[0].hero,policy=sashimonoPolicy(enemy,BT.prov);
    ok(!officerSashimono(enemy,g,{...c,beast:'bear'},policy),'A wild animal wears a command flag');
    ok(officerSashimono(enemy,g,{...c,aux:true,look:{...c.look,horo:'#8f553e'}},policy),'Enemy auxiliary/horo hero lost identity');
    cases.push({mode:cfg.skirm?'skirmish':cfg.site,officers:officers.length,ranks:[...new Set(officers.map(s=>s.sashimono.rank))]});closeBattle();ok(!SASHIMONO_CACHE.size&&sashimonoBytes===0,'Heraldry canvases survived battle close');}
   out.coverage=cases;commandArtFixture();const sc=spriteScale(),ownG=BT.A[0].groups[0],enemyG=BT.A[1].groups[1],own=ownG.heroes[0],enemy=enemyG.heroes[0],cv=gameCanvas();cv.width=200;cv.height=160;const ctx=cv.getContext('2d');
   const snapshot=JSON.stringify(BT.A.map(A=>({power:armyPower(A),total:totalOf(A),cmds:A.groups.map(g=>g.cmds.map(c=>[c.hp,c.s,c.post]))}))),outline=outlineOf,draw=artDraw;let active=-1,rims=[0,0],maxAlpha=0,padding=0,lastRim=null,rimWidth=0;
   outlineOf=function(...args){if(active>=0)rims[active]++;const image=outline(...args);if(active===0){lastRim=image;rimWidth=args[0].width;}return image;};artDraw=function(x,img,px,py,w,h,...rest){if(active===0&&img===lastRim){maxAlpha=Math.max(maxAlpha,x.globalAlpha);padding=(w-rimWidth*sc)/2;}return draw(x,img,px,py,w,h,...rest);};
   try{for(const [si,s,g] of [[0,own,ownG],[1,enemy,enemyG]]){s.x=65;s.y=130;s.ph=0;BT.anim=0;active=si;drawSoldier(ctx,s,g,si,sc);active=-1;}}finally{outlineOf=outline;artDraw=draw;}
   // Inspect the actual draw call rather than asserting artwork constants.
   ok(rims[0]>0&&rims[1]===0,'Enemy gray silhouette still drawn');ok(maxAlpha>0&&maxAlpha<.4&&padding>0&&padding<sc,'Friendly rim is not translucent and subpixel');
   const leader=BT.props.find(pr=>pr.k==='nobori'),maku=BT.props.find(pr=>pr.k==='maku'),old=sashimonoFrames({clan:BT.A[0].clan,type:'inf',rank:'field'}),tall=sashimonoFrames(leader.standard),curtain=sashimonoFrames(maku.standard);
   ok(tall.ay>old.ay*1.7,'Leadership pole not taller');ok(curtain.right[0].width>=60&&curtain.ay>=35,'Command curtain too small');
   const curtainWidth=curtain.right[0].width;ok(new Set(curtain.right.concat(curtain.left)).size===1,'Static curtain duplicates canvases');
   const create=document.createElement,R=Math.random;let allocations=0;for(const s of [own,enemy]){flipSet(s);for(const img of s.sprs.idle)if(s===own)outlineOf(img,HERO_COL[0].hex);}
   for(let i=0;i<12;i++){BT.anim=i*.4;drawSoldier(ctx,own,ownG,0,sc);drawSoldier(ctx,enemy,enemyG,1,sc);for(const pr of BT.props)drawProp(ctx,pr);}
   document.createElement=function(tag,...args){if(tag==='canvas')allocations++;return create.call(this,tag,...args);};Math.random=()=>{throw Error('Idle heraldry rendering consumed combat RNG');};
   try{for(let i=0;i<120;i++){BT.anim=i/30;drawSoldier(ctx,own,ownG,0,sc);drawSoldier(ctx,enemy,enemyG,1,sc);for(const pr of BT.props)drawProp(ctx,pr);}}finally{document.createElement=create;Math.random=R;}
   ok(allocations===0,'Warmed heraldry created per-frame canvases');ok(JSON.stringify(BT.A.map(A=>({power:armyPower(A),total:totalOf(A),cmds:A.groups.map(g=>g.cmds.map(c=>[c.hp,c.s,c.post]))})))===snapshot,'Heraldry mutated HP/leadership/troops');
   enemy.duelDown={at:BT.t-1,dir:1};const fallDraw=drawFallen;let duelFlag=null;
   drawFallen=function(x,r){duelFlag=r.flag;return fallDraw(x,r);};try{drawDuelActor(ctx,enemy,enemyG,1,sc);}finally{drawFallen=fallDraw;delete enemy.duelDown;}
   ok(duelFlag===enemy.sashimono,'Duel collapse discarded its command standard');
   const fallen=enemyG.heroes[0],flag=fallen.sashimono;killSprite(enemyG,fallen,'inf',1);for(let i=0;i<240&&!fallen.stamped;i++)updSprite(fallen,1/60,enemyG,1);
   ok(fallen.stamped&&aftermathState().records.some(r=>r.owner===fallen&&r.flag?.rank===flag.rank),'Fallen commander lost its equipped standard');
   // The ordinary formation standard still falls only on actual elimination.
   const g=BT.A[1].groups[0],before=g.troops;g.troops=0;for(const s of g.spr)killSprite(g,s,'inf',-1);ok(g.bannerFall&&g.bannerFall.t===0,'Final casualty lost its collapsing standard');
   for(const t of [0,.1,.3,.65,1]){g.bannerFall.t=t;drawBanner(ctx,bannerPos(g),g,1);}ok(g.troops===0&&before>0,'Banner changed casualty accounting');
   // The LRU also has a byte budget, and releases evicted canvases immediately.
   const first=sashimonoFrames({clan:'kage',type:'inf',rank:'command'}),canvases=first.right.slice();
   for(const clan of Object.keys(CLANS))for(const type of ['inf','arc','gun','cav']){sashimonoFrames({clan,type,rank:'enemyCaptain'});ok(SASHIMONO_CACHE.size<=SASHIMONO_CACHE_LIMIT&&sashimonoBytes<=SASHIMONO_BYTE_LIMIT,'Flag cache exceeded its budget');}
   ok(canvases.every(c=>!c.width&&!c.height),'LRU eviction retained canvas backing');
   out.render={friendlyRimAlpha:maxAlpha,friendlyRimPadding:padding,enemyRimDraws:rims[1],steadyCanvasAllocations:allocations,leadershipPole:tall.ay,formationPole:old.ay,curtainWidth,cacheLimit:SASHIMONO_CACHE_LIMIT,cacheMBLimit:SASHIMONO_BYTE_LIMIT/1048576};
   cv.width=cv.height=0;closeBattle();ok(SASHIMONO_CACHE.size===0&&sashimonoBytes===0,'Closed battle leaks flag cache');out.checks=checks;return out;
  }finally{if(BT)closeBattle();simRestore(S);}
 });
 report.viewports=[];for(const [width,height] of [[430,932],[1280,820],[844,390]]){await p.setViewportSize({width,height});report.viewports.push(await p.evaluate(()=>{const S=simPrepare();try{commandArtFixture();const hud=BT.band.hud;for(const pr of BT.props.filter(pr=>pr.standard)){const f=sashimonoFrames(pr.standard);if(pr.x-f.ax<0||pr.x-f.ax+f.right[0].width>BT.WW||pr.y-f.ay<hud)throw Error('Command decoration clipped behind field edge/HUD');}
  for(const A of BT.A)for(const s of A.hqSpr||[]){const img=s.sprs.idle[0],f=s.sashimono&&sashimonoFrames(s.sashimono),socket=img.sashimonoSocket,top=s.y-Math.max(img.height,f?img.height-(socket?socket.y:img.height-7)+f.ay:0)*spriteScale();if(top<hud)throw Error('HQ decoration clips into HUD');}
  const troops=JSON.stringify(BT.A.map(A=>A.groups.map(g=>g.spr.map(s=>[s.sx,s.sy]))));prepareCommandDecorations();if(JSON.stringify(BT.A.map(A=>A.groups.map(g=>g.spr.map(s=>[s.sx,s.sy]))))!==troops)throw Error('Decoration adjustment moved formation soldiers');drawBattle();return {width:innerWidth,height:innerHeight,hudClear:true,worldEdgesClear:true,formationPositionsPreserved:true};
 }finally{if(BT)closeBattle();simRestore(S);}}));}
 assert.deepStrictEqual(errors,[]);fs.writeFileSync(path.join(root,'reports/battle-heraldry.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
 }finally{await browser.close();server.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
