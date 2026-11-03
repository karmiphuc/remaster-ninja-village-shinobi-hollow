// Exercise the real update/draw loop before any pose warm-up. A rendering
// exception can be swallowed by the game's RAF catch while HP events keep running.
const fs=require('fs'),http=require('http'),path=require('path'),assert=require('assert'),{chromium}=require('playwright'),install=require('../tools/duel-art-fixture.cjs');
const root=path.resolve(__dirname,'..');
(async()=>{const server=http.createServer((q,r)=>r.end(fs.readFileSync(path.join(root,'index.html'))));await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({headless:true,executablePath:'/usr/bin/chromium',args:['--no-sandbox']});
 try{const p=await browser.newPage({viewport:{width:430,height:932},deviceScaleFactor:3}),errors=[];p.on('pageerror',e=>errors.push(e.message));p.on('console',m=>{if(m.type()==='error'&&!m.text().includes('ERR_'))errors.push(m.text());});
  await p.addInitScript(()=>{window.__noIntro=window.__noQuick=true;window.requestAnimationFrame=()=>0;});await p.route('https://**/*',r=>r.abort());await p.goto('http://127.0.0.1:'+server.address().port);await install(p);
  const report=await p.evaluate(()=>{let checks=0;const ok=(v,m)=>{checks++;if(!v)throw Error(m);},rows=[],R=Math.random;
   const configs=[
    {kind:'tripleSlash'},{kind:'tripleThrust'},{kind:'slidingThrust'},{kind:'jump'},{kind:'guardBreak',weapons:['nodachi']},
    {kind:'yariCast',weapons:['yari']},{kind:'spearBrace',weapons:['yari'],mounted:true,mountedSide:1},
    {kind:'riderDrag',mounted:true,mountedSide:1},{kind:'cavBackKick',mounted:true},{kind:'cavTrample',mounted:true},
    ...PET_KINDS.map(pet=>({kind:DUEL_BEAST_MOVES[pet],pet})),
    {kind:'spearBrace',weapons:['yari'],mounted:true,mountedSide:1,save:'guard'},
    {kind:'riderDrag',mounted:true,mountedSide:1,save:'ward'},
    {kind:'tripleThrust',n:3},{kind:'beastPounce',pet:'wolf',n:3,save:'guard'}
   ];
   for(const cfg of configs){const arena=duelArtFixture({strong:true,hp:100,...cfg});
    // This order is normal during the walk-in: flip a following pet first,
    // then request its side-specific set at the finisher. It used to throw.
    for(const pair of arena.pairs)for(const s of [pair.a,pair.b])if(s.pet){const q=s.pet,flipped=flipSet(q),left=beastSet(q.kind,1);
      ok(left===flipped,'Companion facing cache duplicated: '+q.kind);ok(left.beast&&!left._f,'A cached set was treated as a sprite');}
    const choose=duelFinisher;try{duelFinisher=a=>{const e=a.at(-1);return e.f.si===0?cfg.kind:choose(a);};Math.random=seeded(3);startDuel({pairs:arena.pairs});}finally{duelFinisher=choose;Math.random=R;}
    const run=BT.duelRun,D=run.D,expected=D.log.filter(e=>!e.reload).length,totals=BT.A.map(totalOf),stats=new Map();let ticks=0,maxUpdate=0,maxDraw=0;
    BT.speed=4;drawBattle();
    while(!run.ended&&ticks++<5000){const at=performance.now();updateBattle(1/30);maxUpdate=Math.max(maxUpdate,performance.now()-at);
      const c=BT.duelShot;if(!c)continue;let s=stats.get(c);if(!s)stats.set(c,s={kind:c.kind,frames:0,before:0,after:0,bgMB:0,warmDone:run.warmIndex>=run.warm.length});
      const t=performance.now();drawBattle();maxDraw=Math.max(maxDraw,performance.now()-t);s.frames++;if(c.contact)s.after++;else s.before++;
      if(c.bg)s.bgMB=Math.max(s.bgMB,(c.bg.width*c.bg.height+c.bg.detail.width*c.bg.detail.height)*4/1048576);
      ok(Number.isFinite(c.W.x+c.W.y+c.L.x+c.L.y),'Invalid execution transform');}
    const clips=[...stats.values()];ok(run.ended&&ticks<5000,'Cold playback stalled: '+cfg.kind);ok(D.committed===expected,'Cold playback lost/duplicated real HP events');
    ok(clips.length>0&&clips.every(s=>s.before>0&&s.after>0&&s.frames>=8),'Execution skipped its anticipation/impact/recovery');
    if(!cfg.save)ok(clips.some(s=>s.kind===cfg.kind),'Requested new move was never painted: '+cfg.kind);
    ok(clips.every(s=>s.bgMB<6),'Full-world background allocation returned');ok(BT.A.every((a,i)=>totalOf(a)===totals[i]),'Presentation deducted soldiers');
    if(cfg.save)ok(D.res.some(r=>r.save===cfg.save),'Rescue lost during cold playback');
    ok(!BT.duelShot,'Execution survived the duel result');rows.push({kind:cfg.kind,pet:cfg.pet||null,n:cfg.n||1,save:cfg.save||null,fps:30,speed:4,hits:D.committed,clips,maxUpdateMs:+maxUpdate.toFixed(2),maxDrawMs:+maxDraw.toFixed(2)});closeBattle();
   }
   return {checks,cases:rows.length,rows};
  });assert.deepStrictEqual(errors,[]);report.errors=errors;fs.mkdirSync(path.join(root,'reports/realtime-campaign'),{recursive:true});fs.writeFileSync(path.join(root,'reports/realtime-campaign/duel-cold-playback.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
 }finally{await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});
