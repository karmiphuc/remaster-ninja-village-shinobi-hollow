// Duel art must preserve the pre-art-change HP ledger, including multi-champion assistance and burst weapons.
const fs=require('fs'),http=require('http'),path=require('path'),assert=require('assert'),{chromium}=require('playwright'),install=require('../tools/duel-art-fixture.cjs');
const root=path.resolve(__dirname,'..'),baseline=path.join(root,'reports/duel-execution-baseline.json');
(async()=>{
 const server=http.createServer((q,r)=>{r.setHeader('content-type','text/html');r.end(fs.readFileSync(process.env.DUEL_DOWNLOAD||path.join(root,'index.html')));});await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH||(fs.existsSync('/usr/bin/chromium')?'/usr/bin/chromium':undefined),args:['--no-sandbox']});
 try{const p=await browser.newPage({viewport:{width:430,height:932}}),errors=[];p.on('pageerror',e=>errors.push(e.message));await p.addInitScript(()=>{window.__noIntro=window.__noQuick=true;});await p.goto('http://127.0.0.1:'+server.address().port);
 const ledger=await p.evaluate(()=>{
  const S=simPrepare();try{newGame();G.boons=freshBoons();G.roll=null;const rows=[],weapons=['katana','ninjato','yari','naginata','nodachi','zanbato','ninja_claw','yumi','repeater','rifle'];
   function fighter(w,si,i){const type=weaponKind(w)==='bow'?'arc':weaponKind(w)==='gun'?'gun':'inf',s={atk:23+i*3,def:11+i,hp:140,str:18,mrk:26,wrk:6,duel:3},
    c={name:si?'Rival':'Champion',s,look:{gear:{w}},hpMax:140,hp:140,post:'line',skill:'duelist',slv:3},g=fighterGroup(type,c),hr={hero:c,sprs:{},_g:g};return hr;}
   for(const w of weapons)for(const n of [1,2,3])for(const seed of [11,29,53,97]){Math.random=seeded(seed);const pairs=Array.from({length:n},(_,i)=>({a:fighter(w,0,i),b:fighter(i%2?'yari':'katana',1,i)})),D=simDuel(pairs);let hash=2166136261,damage=0;
    for(const e of D.log){const line=[e.r,e.chain,e.index,e.f.si,e.f.k,e.t.si,e.t.k,+!!e.hit,+!!e.ko,+!!e.reload,+!!e.counter,+!!e.help,e.dmg,e.hpBefore,e.hp,e.defense].join('|');for(let i=0;i<line.length;i++)hash=Math.imul(hash^line.charCodeAt(i),16777619);damage+=e.dmg;}
    rows.push({w,n,seed,win:D.win,rounds:D.rounds,events:D.log.length,damage,endHP:D.F.map(f=>f.hp),hash:hash>>>0});}
   return rows;
  }finally{simRestore(S);}
 });
 if(process.env.DUEL_RECORD_BASELINE){fs.writeFileSync(baseline,JSON.stringify({source:'d6b0970aecd75a043e82d55188c463596b0781b0',ledger},null,2));console.log('Captured '+ledger.length+' pre-art duel ledgers');return;}
 assert.deepStrictEqual(ledger,JSON.parse(fs.readFileSync(baseline)).ledger,'Art changed real duel outcomes');
 await install(p);
 const report=await p.evaluate(()=>{
  const S=simPrepare(),out={};let checks=0;const ok=(v,m)=>{checks++;if(!v)throw Error(m);};
  try{
   let arena=duelArtFixture({weapons:['katana'],foes:['katana'],strong:true,hp:110});
   const z=duelArtChain(arena,'tripleSlash',3),thrust=duelArtChain(arena,'tripleThrust',3);
   ok(z.a.length===3&&thrust.a.length===3&&thrust.a[0].f.weapon.kind==='sword','No genuine sword thrust/slash triple');
   const styles=new Set();for(let i=0;i<120;i++){const a=thrust.a.map(e=>({...e,visualSeed:i}));styles.add(duelFinisher(a));}
   ok(styles.has('tripleSlash')&&styles.has('tripleThrust'),'Sword finisher variety');
   const attack={...thrust.a[0],index:1,counter:true,visualSeed:3};ok(duelStrikePose(attack)==='kneelThrust','No kneeling normal counter');
   const W=thrust.a[0].f.hr,L=thrust.a[0].t.hr,gW=thrust.a[0].f.g,gL=thrust.a[0].t.g;
   const warmRandom=Math.random;try{Math.random=()=>{throw Error('Pose construction consumed combat RNG');};
    for(const pose of DUEL_POSES){duelPoseFrame(W,gW,pose,1);duelPoseFrame(L,gL,pose,-1);}
    for(const s of [W,L])if(s.sashimono)sashimonoFrames(s.sashimono);
   }finally{Math.random=warmRandom;}
   ok(duelPoseFrame(W,gW,'kneelThrust',1)!==duelPoseFrame(W,gW,'thrust',1),'Kneeling just reuses standing frame');
   ok(duelPoseFrame(W,gW,'kneelGuard',1)!==duelPoseFrame(W,gW,'guard',1),'No knee-down anticipation');
   ok(duelPoseFrame(W,gW,'finish',1)!==duelPoseFrame(W,gW,'recover',1),'No victory pose');

   // Warmed rendering is bounded and purely cosmetic, including FX, rescue states and unrecognized pose requests.
   const cv=gameCanvas();cv.width=180;cv.height=120;const x=cv.getContext('2d');W.x=65;W.y=95;L.x=85;L.y=95;
   const a=thrust.a,c={a,e:a.at(-1),W,L,n:1,dir:1,t:0,duration:DUEL_CINE_TIME,kind:'tripleSlash',save:null,contact:false,impactAt:.69};BT.duelShot=c;
   const pixels=()=>x.getImageData(0,0,cv.width,cv.height).data,opaque=()=>{let n=0;const d=pixels();for(let i=3;i<d.length;i+=4)if(d[i])n++;return n;},hash=()=>{let h=2166136261;for(const n of pixels())h=Math.imul(h^n,16777619);return h>>>0;};
   c.t=.1;a.forEach(e=>e.applied=false);x.clearRect(0,0,180,120);drawDuelTrails(x,c,1);drawDuelFinishGround(x,c,1);ok(opaque()===0,'Finisher effects before a resolved hit');
   a.forEach(e=>e.applied=true);c.t=.73;c.contact=true;x.clearRect(0,0,180,120);drawDuelTrails(x,c,1);ok(opaque()>0,'Missing triple impact trails');
   let black=0;const rgba=pixels();for(let i=0;i<rgba.length;i+=4)if(rgba[i+3]&&rgba[i]<55&&rgba[i+1]<55&&rgba[i+2]<65)black++;ok(black>12,'Black Z has no visible ink');
   const before=JSON.stringify([W.hero.hp,L.hero.hp,gW.troops,gL.troops,W.hero.guard,L.hero.guard]),create=document.createElement,R=Math.random;
   let allocations=0;const fxHashes=new Set();document.createElement=function(tag,...args){if(tag==='canvas')allocations++;return create.call(this,tag,...args);};
   try{Math.random=()=>{throw Error('New duel art consumed combat RNG');};
    for(const kind of ['tripleSlash','tripleThrust','crossCut','slidingThrust','risingCut','guardBreak','passing','reversal','jump']){
     c.kind=kind;
     for(let i=0;i<40;i++){c.t=i*.029;for(let j=0;j<a.length;j++)a[j].applied=c.t>=DUEL_IMPACT[a.length][j];c.contact=a.at(-1).applied;
      x.clearRect(0,0,180,120);drawDuelFinishGround(x,c,1);drawDuelActor(x,W,gW,0,1);drawDuelActor(x,L,gL,1,1);drawDuelTrails(x,c,1);}
     c.t=.72;x.clearRect(0,0,180,120);drawDuelTrails(x,c,1);fxHashes.add(hash());
    }
    for(const save of ['ward','guard']){c.save=save;c.t=.78;c.contact=true;x.clearRect(0,0,180,120);drawDuelFinishGround(x,c,1);ok(opaque()===0,'Fatal ink flash on rescue');drawDuelActor(x,L,gL,1,1);}
    for(let i=0;i<60;i++)duelPoseFrame(W,gW,'unknown_'+i,1);
   }finally{document.createElement=create;Math.random=R;}
   ok(allocations===0,'Per-frame duel canvas creation: '+allocations);ok(fxHashes.size>=7,'Finisher effects are indistinguishable');
   ok(JSON.stringify([W.hero.hp,L.hero.hp,gW.troops,gL.troops,W.hero.guard,L.hero.guard])===before,'Drawing changed HP/troops/retainers');
   ok(reactionRecipe(W,gW).duelFrames.size<=DUEL_POSE_SET.size*2,'Open-ended pose cache');
   out.art={swordTripleThrust:true,blackZ:true,kneeDownPoses:true,distinctEffectFamilies:fxHashes.size,steadyCanvasAllocations:allocations,privateVisualChoice:true,noDamageFromDrawing:true,poseLimit:DUEL_POSE_SET.size*2};
   const recipe=reactionRecipe(W,gW),cached=[...recipe.duelFrames.values()];cv.width=cv.height=0;BT.duelShot=null;closeBattle();
   ok(recipe.duelFrames.size===0&&cached.every(c=>!c.width&&!c.height&&(!c.detail||!c.detail.width)),'Duel pose canvases survived battle cleanup');
   out.art.releasedOnClose=true;

   // Real scheduling, HP commits, rescues and help after a teammate falls. Repeat every hit event once.
   const configs=[{n:1,weapons:['katana'],foes:['yari']},{n:2,weapons:['ninjato','naginata'],foes:['katana','yari']},
    {n:3,weapons:['katana','yari','ninja_claw'],foes:['naginata','ninjato','nodachi'],speed:4,fps:30},
    {n:1,weapons:['katana'],foes:['katana'],save:'ward'},{n:1,weapons:['ninjato'],foes:['yari'],save:'guard'},
    {n:1,weapons:['katana'],foes:['yari'],mounted:true},{n:1,weapons:['rifle'],foes:['yumi']}];
   const runs=[];
   for(let k=0;k<configs.length;k++){const cfg=configs[k];arena=duelArtFixture(cfg);Math.random=seeded(131+k);startDuel({pairs:arena.pairs});Math.random=R;BT.speed=cfg.speed||1;
    const D=BT.duelRun.D,original=duelEvent,expected=D.log.filter(e=>!e.reload).length;let frames=0,shots=0,observed=0;
    duelEvent=function(e){
     if(e.k==='tdFinish'){ok(e.a.at(-1).ko,'False cinematic KO');ok(!BT.duelShot,'Overlapping finisher clocks');shots++;}
     const count=D.committed;original(e);
     if(e.k==='tdHit'){observed++;const hp=e.e.t.hr.hero.hp,loss=e.e.t.loss;
      ok(D.committed===count+1,'Lost/duplicated ledger commit');
      if(e.e.hit)ok(hp===(e.e.ko&&loss?.save==='ward'?Math.max(e.e.hp,e.e.t.hr.hero.hpMax*.3):e.e.hp),'HP does not match resolved hit');
      const guard=e.e.t.hr.hero.guard||0;original(e);ok(D.committed===count+1&&hp===e.e.t.hr.hero.hp&&guard===(e.e.t.hr.hero.guard||0),'Repeated hit duplicated HP/rescue');
     }
    };
    try{while(!BT.duelRun.ended&&frames++<10000){updateBattle(1/(cfg.fps||60));if(frames%7===0)drawBattle();}}
    finally{duelEvent=original;Math.random=R;}
    ok(frames<10000&&D.ended&&D.committed===expected&&observed===expected,'Duel sequencing stalled/missed hits');ok(!BT.duelShot,'Cinematic leaked past duel end');
    if(cfg.save)ok(D.res.length&&D.res.every(r=>r.save===cfg.save),'Rescue changed');
    if(cfg.mounted)ok(D.log.filter(e=>e.ko).every(e=>duelFinisher(D.log.filter(o=>o.chain===e.chain))!=='slidingThrust'),'Horse uses kneeling slide');
    runs.push({champions:cfg.n,weapon:cfg.weapons.join('/'),save:cfg.save||null,mounted:!!cfg.mounted,speed:cfg.speed||1,fps:cfg.fps||60,hits:expected,finishers:shots,helpers:D.log.filter(e=>e.help).length,rescues:D.res.filter(r=>r.save).length});closeBattle();
   }
   out.runs=runs;out.cinematicSeconds=DUEL_CINE_TIME;out.checks=checks;return out;
  }finally{if(BT)closeBattle();simRestore(S);}
 });
 assert.deepStrictEqual(errors,[]);report.ledgerCases=ledger.length;report.unchangedHPDamage=true;fs.writeFileSync(path.join(root,'reports/duel-executions.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
 }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
