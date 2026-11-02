// Real KO ledgers for every equipped companion, including rescues and shared 1v1–3v3 scheduling.
const fs=require('fs'),http=require('http'),path=require('path'),assert=require('assert'),{chromium}=require('playwright'),install=require('../tools/duel-art-fixture.cjs');
const root=path.resolve(__dirname,'..');
(async()=>{const server=http.createServer((q,r)=>{r.setHeader('content-type','text/html');r.end(fs.readFileSync(process.env.DUEL_DOWNLOAD||path.join(root,'index.html')));});await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({headless:true,executablePath:'/usr/bin/chromium',args:['--no-sandbox']});
 try{const p=await browser.newPage({viewport:{width:430,height:932}}),errors=[];p.on('pageerror',e=>errors.push(e.message));await p.addInitScript(()=>{window.__noIntro=window.__noQuick=true;});await p.goto('http://127.0.0.1:'+server.address().port);await install(p);
 const report=await p.evaluate(()=>{const S=simPrepare(),out={species:[],runs:[]},R=Math.random;let checks=0;const ok=(v,m)=>{checks++;if(!v)throw Error(m);};
  try{
   for(const kind of PET_KINDS){const arena=duelArtFixture({weapons:['katana'],foes:['katana'],strong:true,hp:110,pet:kind}),hr=arena.pairs[0].a,pet=hr.pet;
    ok(pet?.kind===kind&&hr.hero.look.gear.m===kind,'Equipped companion missing: '+kind);const plans=[];
    for(const count of [1,2,3]){const chosen=duelArtChain(arena,DUEL_BEAST_MOVES[kind],count),clip=duelClip(chosen.a);
      ok(clip.animal&&!clip.mounted&&clip.duration<=1.5&&clip.moves.length===count&&clip.beats.length===count,'Invalid companion plan');
      ok(clip.moves.at(-1)===DUEL_BEAST_MOVES[kind]&&clip.beats.every((v,i)=>v>0&&v<clip.duration&&(!i||v>clip.beats[i-1])),'Invalid hits/timing');plans.push({count,seed:chosen.seed,moves:clip.moves});}
    const chosen=duelArtChain(arena,DUEL_BEAST_MOVES[kind],3),a=chosen.a,e=a.at(-1),W=e.f.hr,L=e.t.hr,clip=duelClip(a);
    W.x=64;W.y=98;L.x=91;L.y=98;pet.x=58;pet.y=102;
    BT.duelRun={D:chosen.D,shots:0,clock:0,warm:[],warmIndex:0};BT.cine={F:chosen.D.F};duelEvent({k:'tdFinish',a,D:chosen.D,n:1,clip});const c=BT.duelShot;
    ok(c.pet===pet&&pet.duelPet===c,'Finisher substituted/duplicated the animal');
    for(const pose of DUEL_POSES){duelPoseFrame(W,e.f.g,pose,1);duelPoseFrame(L,e.t.g,pose,-1);}
    if(W.sashimono)sashimonoFrames(W.sashimono);if(L.sashimono)sashimonoFrames(L.sashimono);
    const cv=gameCanvas();cv.width=190;cv.height=130;const x=cv.getContext('2d'),before=JSON.stringify([W.hero.hp,L.hero.hp,e.f.g.troops,e.t.g.troops,W.hero.guard,L.hero.guard]),create=document.createElement;let alloc=0;const positions=new Set(),poses=new Set();
    document.createElement=function(tag,...args){if(tag==='canvas')alloc++;return create.call(this,tag,...args);};
    try{Math.random=()=>{throw Error('Animal drawing used combat RNG');};for(let frame=0;frame<85;frame++){c.t=frame/85*(clip.duration-.001);updateDuelPet(c);
      positions.add((pet.x|0)+','+(pet.y|0)+','+(pet.lift|0));poses.add(pet.duelFrame);for(let j=0;j<a.length;j++)a[j].applied=c.t>=c.beats[j];c.contact=a.at(-1).applied;c.impactAt=c.beats.at(-1);
      x.clearRect(0,0,190,130);drawDuelFinishGround(x,c,1);drawDuelActor(x,W,e.f.g,0,1);drawDuelActor(x,L,e.t.g,1,1);drawDuelPet(x,c,1);drawDuelTrails(x,c,1);
      ok(Number.isFinite(pet.x+pet.y+pet.lift),'Invalid animal transform');}
    }finally{document.createElement=create;Math.random=R;}
    ok(alloc===0,'Per-frame animal canvases: '+kind+'/'+alloc);ok(positions.size>15&&poses.size>=3,'Frozen companion pose');
    ok(JSON.stringify([W.hero.hp,L.hero.hp,e.f.g.troops,e.t.g.troops,W.hero.guard,L.hero.guard])===before,'Art changed combat stats');
    // The frozen background must exclude the actual companion; draw it only in the foreground pass.
    a.forEach(e=>delete e.applied);c.t=.1;c.contact=false;let backgroundPet=0,foregroundPet=0;const soldier=drawSoldier,animal=drawDuelPet;
    drawSoldier=function(ctx,s,...args){if(s===pet)backgroundPet++;return soldier(ctx,s,...args);};drawDuelPet=function(...args){foregroundPet++;return animal(...args);};
    try{drawBattle();drawBattle();}finally{drawSoldier=soldier;drawDuelPet=animal;}
    ok(backgroundPet===0&&foregroundPet===2,'Animal rendered twice in the frozen scene: '+JSON.stringify({kind,backgroundPet,foregroundPet}));
    if(kind==='fox'||kind==='tanuki'){c.save='guard';c.t=c.duration;updateDuelPet(c);ok(Math.abs(pet.x-(W.x+pet.gx))<.01,'Rescued feint leaves companion at an uncommitted passing position');}
    releaseDuelCinema();ok(!pet.duelPet&&!pet.duelFrame,'Companion cinematic survived cancel');updPet(W,.1,e.f.g,0);ok(Number.isFinite(pet.x)&&!pet.out,'Companion did not resume following');
    cv.width=cv.height=0;out.species.push({kind,finisher:DUEL_BEAST_MOVES[kind],plans,positions:positions.size,poses:[...poses],steadyCanvasAllocations:alloc});closeBattle();
   }
   // Family coverage in the real event loop: 30 fps at 4x, both sides, multi-champion help and intercepts.
   const configs=[{pet:'bear',count:1},{pet:'boar',count:2},{pet:'wolf',count:3},{pet:'fox',count:3},{pet:'monkey',count:2},{pet:'hawk',count:1},
    {pet:'tosa',count:3,save:'guard',guardCount:6},{pet:'gyrfalcon',count:3,save:'ward'},{pet:'tanuki',count:2,side:1},{pet:'hound',n:3},{pet:'fox',count:2,save:'guard'},{pet:'tanuki',count:3,save:'ward'}];
   for(const cfg of configs){const side=cfg.side||0,arena=duelArtFixture({weapons:['katana','yari','ninja_claw'],foes:['katana','naginata','nodachi'],strong:!side,hp:110,n:cfg.n||1,pet:cfg.pet,petSide:side,save:cfg.save,guardCount:cfg.guardCount});
    const chosen=cfg.n?{seed:77}:duelArtChain(arena,DUEL_BEAST_MOVES[cfg.pet],cfg.count,side);
    Math.random=seeded(chosen.seed);const withPet=simDuel(arena.pairs),ledger=D=>D.log.map(e=>[e.chain,e.dmg,e.hit,e.hp,e.ko]);const pets=[];
    for(const pair of arena.pairs)for(const s of [pair.a,pair.b])if(s.pet){pets.push([s,s.pet]);s.pet=null;}
    Math.random=seeded(chosen.seed);const withoutPet=simDuel(arena.pairs);for(const [s,q] of pets)s.pet=q;
    ok(JSON.stringify(ledger(withPet))===JSON.stringify(ledger(withoutPet)),'Companion presentation changed damage/RNG');
    Math.random=seeded(chosen.seed);startDuel({pairs:arena.pairs});Math.random=R;BT.speed=4;const run=BT.duelRun,D=run.D,totals=BT.A.map(totalOf),orig=duelEvent;let frames=0,shots=0,guards=0;
    duelEvent=function(o){orig(o);if(o.k==='tdFinish'&&BT.duelShot?.animal){shots++;ok(BT.duelShot.pet===o.a.at(-1).f.hr.pet,'Scheduled wrong animal');}
      if(o.k==='tdHit'){const hp=o.e.t.hr.hero.hp,committed=D.committed,guard=o.e.t.hr.hero.guard;orig(o);ok(hp===o.e.t.hr.hero.hp&&D.committed===committed&&guard===o.e.t.hr.hero.guard,'Replayed animal hit duplicated damage');
        if(BT.duelShot?.animal&&o.e.ko&&cfg.save==='guard'){ok(BT.duelShot.coverReady&&BT.duelShot.result.intercepted,'Retainer arrived late in animal finale');guards++;}}
    };
    try{while(!run.ended&&frames++<6000){updateBattle(1/30);if(frames%6===0)drawBattle();}}
    finally{duelEvent=orig;Math.random=R;}
    ok(frames<6000&&D.ended&&D.committed===D.log.filter(e=>!e.reload).length,'Animal duel stuck/lost HP events');ok(BT.A.every((A,i)=>totalOf(A)===totals[i]),'Animal animation deducted extra troops');
    if(!cfg.n)ok(shots>0,'Selected actual animal finisher never played');if(cfg.save==='guard')ok(guards>0,'Missing animal interception');if(cfg.save==='ward')ok(D.res.some(r=>r.save==='ward'),'Talisman rescue broken');
    ok(!BT.duelShot&&pets.every(([s,q])=>!q.duelPet),'Cinematic ownership leaked');out.runs.push({...cfg,shots,guards,hits:D.committed,frames,fps:30,speed:4});closeBattle();
   }
   ok(Object.keys(_beastSet).length<=PET_KINDS.length*2+Object.keys(MOUNT_LOOK).length*2+10,'Beast cache key count unbounded');out.cacheKeys=Object.keys(_beastSet).length;out.checks=checks;return out;
  }finally{Math.random=R;if(BT)closeBattle();simRestore(S);}
 });assert.deepStrictEqual(errors,[]);fs.writeFileSync(path.join(root,'reports/animal-duels.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
 }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
