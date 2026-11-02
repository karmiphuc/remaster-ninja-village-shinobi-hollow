// Finisher moves are composed from real hits. Mounted executions and early retainer interception remain cosmetic.
const fs=require('fs'),http=require('http'),path=require('path'),assert=require('assert'),{chromium}=require('playwright'),install=require('../tools/duel-art-fixture.cjs');
const root=path.resolve(__dirname,'..');
(async()=>{const server=http.createServer((q,r)=>{r.setHeader('content-type','text/html');r.end(fs.readFileSync(process.env.DUEL_DOWNLOAD||path.join(root,'index.html')));});await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH||(fs.existsSync('/usr/bin/chromium')?'/usr/bin/chromium':undefined),args:['--no-sandbox']});
 try{const p=await browser.newPage({viewport:{width:430,height:932}}),errors=[];p.on('pageerror',e=>errors.push(e.message));await p.addInitScript(()=>{window.__noIntro=window.__noQuick=true;});await p.goto('http://127.0.0.1:'+server.address().port);await install(p);
 const report=await p.evaluate(()=>{const S=simPrepare(),out={};let checks=0;const ok=(v,m)=>{checks++;if(!v)throw Error(m);},R=Math.random;
  try{
   let arena=duelArtFixture({weapons:['katana'],foes:['katana'],strong:true,hp:110});const mixed=[];
   for(const count of [1,2,3]){const chosen=duelArtChain(arena,'slidingThrust',count),clip=duelClip(chosen.a);
    ok(clip.moves.length===count&&clip.beats.length===count,'Finisher invented or dropped a hit');
    ok(clip.moves.at(-1)==='slidingThrust'&&clip.duration===1.18,'Mixed finale changed foot timing');
    if(count>1)ok(clip.moves[0]==='sweep','Sword slide has no cutting opener');if(count===3)ok(clip.moves[1]==='thrust','Three-hit mix lacks its second strike');
    mixed.push({count,moves:clip.moves,damage:chosen.a.map(e=>e.dmg)});}
   for(const count of [1,2,3])for(const kind of DUEL_ENDINGS){const chosen=duelArtChain(arena,kind,count),clip=duelClip(chosen.a);
    ok(clip.moves.length===count&&clip.moves.at(-1)===kind,'Shared ending missing from a real '+count+'-hit chain: '+kind);}
   out.mixed=mixed;out.sharedEndings={families:DUEL_ENDINGS.length,hitCounts:[1,2,3],realKOCombinations:DUEL_ENDINGS.length*3};closeBattle();

   arena=duelArtFixture({weapons:['katana'],foes:['katana'],strong:true,hp:110,mounted:true});const plans=[];
   for(const kind of ['cavTrample','cavBackKick'])for(const count of [1,2,3]){const chosen=duelArtChain(arena,kind,count),clip=duelClip(chosen.a);
    ok(clip.mounted&&clip.duration<=1.5&&clip.moves.length===count&&clip.beats.length===count,'Invalid cavalry clip');
    ok(clip.beats.every((t,i)=>t>0&&t<clip.duration&&(!i||t>clip.beats[i-1])),'Invalid mounted hit times');plans.push({kind,count,duration:clip.duration,seed:chosen.seed});}
   const chosen=duelArtChain(arena,'cavBackKick',1),a=chosen.a,e=a.at(-1),W=e.f.hr,L=e.t.hr,recipe=reactionRecipe(W,e.f.g);
   const frames=[];Math.random=()=>{throw Error('Mounted pose construction consumed combat RNG');};
   try{for(const pose of DUEL_CAV_POSES)for(const face of [-1,1])frames.push(duelPoseFrame(W,e.f.g,pose,face));
    for(const pose of DUEL_POSES)duelPoseFrame(L,e.t.g,pose,-1);
    for(const s of [W,L])if(s.sashimono)sashimonoFrames(s.sashimono);
   }finally{Math.random=R;}
   ok(recipe.coat===MOUNT_LOOK.nanbu.coat&&recipe.tack.barding==='nanban'&&recipe.L.gear.w==='katana','Mounted recipe lost real coat/barding/weapon');
   ok(new Set(frames).size===DUEL_CAV_POSES.length*2,'Mounted poses reuse one unarticulated frame');
   const cv=gameCanvas();cv.width=210;cv.height=120;const x=cv.getContext('2d');W.x=70;W.y=100;L.x=97;L.y=100;
   // Two/three-hit rear kicks must actually show their weapon openers before turning the horse.
   for(const count of [2,3]){const chosen=duelArtChain(arena,'cavBackKick',count),clip=duelClip(chosen.a),c={...clip,a:chosen.a,e:chosen.a.at(-1),W,L,n:1,dir:1,save:null,t:0};BT.duelShot=c;
    const original=duelPoseFrame;let requested=null;duelPoseFrame=function(s,g,pose,face){if(s===W)requested=pose;return original(s,g,pose,face);};
    try{for(let i=0;i<count-1;i++){c.t=c.beats[i];drawDuelActor(x,W,e.f.g,0,1);ok(requested==='sweep'||requested==='thrust'||requested==='cutUp','Mounted opener hidden behind a standing/turning horse');}
     c.t=c.beats.at(-1);drawDuelActor(x,W,e.f.g,0,1);ok(requested==='horseBackKick','Mounted finale did not show extended hind legs');}
    finally{duelPoseFrame=original;}}
   const c={...duelClip(a),a,e,W,L,n:1,dir:1,t:0,save:null,contact:false,impactAt:.82};BT.duelShot=c;
   const create=document.createElement,before=JSON.stringify([W.hero.hp,L.hero.hp,W.hero.guard,L.hero.guard,e.f.g.troops,e.t.g.troops]);let allocations=0;
   document.createElement=function(tag,...args){if(tag==='canvas')allocations++;return create.call(this,tag,...args);};
   try{Math.random=()=>{throw Error('Mounted rendering consumed combat RNG');};
    for(const kind of ['cavTrample','cavBackKick']){c.kind=kind;c.moves[0]=kind;for(let i=0;i<60;i++){c.t=i/60*1.415;c.contact=c.t>=.82;a[0].applied=c.contact;
      x.clearRect(0,0,210,120);drawDuelFinishGround(x,c,1);drawDuelActor(x,W,e.f.g,0,1);drawDuelActor(x,L,e.t.g,1,1);drawDuelTrails(x,c,1);}}
   }finally{document.createElement=create;Math.random=R;}
   ok(allocations===0,'Warmed mounted drawing created '+allocations+' canvases');ok(JSON.stringify([W.hero.hp,L.hero.hp,W.hero.guard,L.hero.guard,e.f.g.troops,e.t.g.troops])===before,'Mounted drawing changed combat stats');
   ok(recipe.duelFrames.size<=DUEL_POSE_SET.size*2,'Mounted cache unbounded');closeBattle();ok(recipe.duelFrames.size===0&&frames.every(f=>!f.width),'Mounted canvases survived battle close');
   out.mounts={plans,poses:DUEL_CAV_POSES.length,steadyCanvasAllocations:allocations,equippedNanbuPreserved:true,weaponOpenersVisible:true,releasedOnClose:true};

   // Real scheduling: guard present before the hits, actual guard falls at KO, commander survives visually, no second deduction.
   const configs=[
    {kind:'slidingThrust',count:1,save:'guard',guardCount:3},
    {kind:'crossCut',count:2,save:'guard',guardCount:6},
    {kind:'tripleSlash',count:3,save:'guard',guardCount:12,speed:4,fps:30},
    {kind:'cavTrample',count:2,mounted:true,speed:4,fps:30},
    {kind:'cavBackKick',count:1,mounted:true,speed:4,fps:30},
    {kind:'cavBackKick',count:1,mounted:true,mountedSide:1,side:1,speed:4,fps:30},
    {kind:'cavTrample',count:2,mounted:true,save:'guard',speed:4,fps:30},
    {kind:'tripleSlash',count:3,save:'guard',reserve:true},
    {kind:'cavBackKick',count:1,mounted:true,save:'ward'},
    {n:3,mounted:true,speed:4,fps:30}
   ],runs=[];
   for(const cfg of configs){arena=duelArtFixture({weapons:cfg.n?['katana','yari','nodachi']:['katana'],foes:cfg.n?['katana','yari','naginata']:['katana'],strong:true,hp:110,...cfg});
    const sample=cfg.kind?duelArtChain(arena,cfg.kind,cfg.count,cfg.side||0):{seed:71};
    if(cfg.reserve)for(const A of [arena.pa,arena.ea])for(const g of A.groups)for(const hr of g.heroes||[])hr.guards=[];
    Math.random=seeded(sample.seed);startDuel({pairs:arena.pairs});Math.random=R;BT.speed=cfg.speed||1;
    const run=BT.duelRun,D=run.D,original=duelEvent,totals=BT.A.map(totalOf),covered=new Set(),losses=new Set(),seenKinds=new Set();let ticks=0,early=0,shots=0;
    duelEvent=function(o){
     if(o.k==='tdFinish'){ok(!BT.duelShot,'Mounted/mixed finishers overlapped');shots++;}
     if(cfg.reserve&&o.k==='tdFinish'){const random=Math.random;try{Math.random=()=>{throw Error('Reserve retainer consumed combat RNG');};original(o);}finally{Math.random=random;}}
     else original(o);const shot=BT.duelShot;
     if(o.k==='tdFinish'){seenKinds.add(shot.kind);ok(shot.moves.length===o.a.length,'Cinematic strike count mismatch');}
     if(o.k==='tdHit'&&o.e.hit){const loss=o.e.t.loss,want=o.e.ko&&loss?.save==='ward'?Math.max(o.e.hp,o.e.t.hr.hero.hpMax*.3):o.e.hp;
      ok(o.e.t.hr.hero.hp===want,'Execution changed the real HP ledger');}
     if(o.k==='tdHit'&&shot?.guard&&shot.a.includes(o.e)){
      ok(shot.coverReady,'Retainer did not intercept the strike');ok(Math.abs(shot.guard.x-shot.L.x)<.01&&Math.abs(shot.guard.y-shot.L.y)<.01,'Retainer did not replace the impact position');
      ok(!shot.L.fate&&!shot.L.duelDown,'Protected commander used a death pose');covered.add(shot);
      if(o.e.ko){const loss=shot.result;ok(loss.save==='guard'&&loss.intercepted===shot.guard&&!shot.guard.alive&&shot.guard.fate.kind==='death','Guard did not take the finishing hit');
       ok(loss.guardDeaths===1&&loss.lost===Math.ceil((cfg.guardCount||3)/3),'Guard loss count changed');losses.add(loss);
       const count=D.committed,hp=shot.L.hero.hp,guard=shot.L.hero.guard;original(o);ok(D.committed===count&&hp===shot.L.hero.hp&&guard===shot.L.hero.guard,'Repeated KO duplicated rescue damage/cost');}
     }
    };
    try{while(!run.ended&&ticks++<10000){const old=BT.duelShot;updateBattle(1/(cfg.fps||60));const now=BT.duelShot;
      if(now?.guard&&!now.guard.fate&&!now.a.some(e=>e.applied&&e.hit)&&now.coverU>.96&&now.L.hero.hp>0)early++;
      if(old&&!now&&old.result?.save==='guard')ok(!old.L.duelDown&&old.L.duelRescued>BT.t,'Commander collapsed after the interception clip');
      if(ticks%9===0)drawBattle();}}
    finally{duelEvent=original;Math.random=R;}
    ok(ticks<10000&&D.ended&&D.committed===D.log.filter(e=>!e.reload).length,'Cavalry/rescue sequence lost real strikes');
    ok(!BT.duelShot&&BT.A.every((A,i)=>totalOf(A)===totals[i]),'Presentation changed troop casualty accounting');
    if(cfg.kind)ok(seenKinds.has(cfg.kind),'Requested real finisher did not play');
    if(cfg.save==='guard'){ok(early>0&&covered.size>0&&losses.size>0,'Retainer arrived after the damaging sequence: '+JSON.stringify({cfg,early,covered:covered.size,losses:losses.size}));
      for(const loss of losses){const dead=(loss.L.guards||[]).filter(q=>!q.alive).length;ok(dead===Math.min(4,loss.lost),'Guard killed twice or extra guards deducted');ok(loss.L.hero.guard===(cfg.guardCount||3)-loss.lost,'Rescue changed remaining retainers');}}
    if(cfg.save==='ward')ok(D.res.some(r=>r.save==='ward')&&!covered.size,'Talisman became a retainer rescue');
    runs.push({kind:cfg.kind||'3v3 mixed',count:cfg.count||null,save:cfg.save||null,side:cfg.side||0,speed:BT.speed,fps:cfg.fps||60,shots,hits:D.committed,earlyGuardFrames:early,helpers:D.log.filter(e=>e.help).length});closeBattle();
   }
   out.runs=runs;out.checks=checks;return out;
  }finally{if(BT)closeBattle();simRestore(S);}
 });assert.deepStrictEqual(errors,[]);fs.writeFileSync(path.join(root,'reports/duel-cavalry.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
 }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
