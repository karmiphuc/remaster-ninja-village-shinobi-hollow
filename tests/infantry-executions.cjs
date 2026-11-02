// Real resolved KO chains, split rider/mount presentation and rescue-safe finishing moves.
const fs=require('fs'),http=require('http'),path=require('path'),assert=require('assert'),{chromium}=require('playwright'),install=require('../tools/duel-art-fixture.cjs');
const root=path.resolve(__dirname,'..');
(async()=>{const server=http.createServer((q,r)=>{r.setHeader('content-type','text/html');r.end(fs.readFileSync(process.env.DUEL_DOWNLOAD||path.join(root,'index.html')));});await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({headless:true,executablePath:'/usr/bin/chromium',args:['--no-sandbox']});try{const p=await browser.newPage({viewport:{width:430,height:932}}),errors=[];p.on('pageerror',e=>errors.push(e.message));await p.addInitScript(()=>{window.__noIntro=window.__noQuick=true;});await p.goto('http://127.0.0.1:'+server.address().port);await install(p);
 const report=await p.evaluate(()=>{const S=simPrepare(),R=Math.random,out={};let checks=0;const ok=(v,m)=>{checks++;if(!v)throw Error(m);};
  try{const plans=[],families=[['yariCast','steel_yari',false],['spearBrace','steel_yari',true],['riderDrag','katana',true]];
   for(const [kind,weapon,mounted]of families){const arena=duelArtFixture({weapons:[weapon],foes:['katana'],strong:true,hp:110,mounted,mountedSide:1,site:'camp'});
    for(const count of [1,2,3]){const pick=duelArtChain(arena,kind,count),a=pick.a,e=a.at(-1),clip=duelClip(a);
     ok(clip.footFinish&&clip.moves.length===count&&clip.beats.length===count&&clip.moves.at(-1)===kind,'New move fabricated or dropped a hit');
     ok(clip.duration<=1.5&&clip.beats.every((v,i)=>v>0&&v<clip.duration&&(!i||v>clip.beats[i-1])),'Invalid new finisher timing');
     ok(!e.f.hr.sprs.horse&&!!e.t.hr.sprs.horse===mounted,'Incorrect weapon/target eligibility');plans.push({kind,count,seed:pick.seed,damage:a.map(e=>e.dmg)});
    }
    const chosen=duelArtChain(arena,kind,1),a=chosen.a,e=a.at(-1),W=e.f.hr,L=e.t.hr;W.x=65-(kind==='yariCast'?20:0);W.y=105;L.x=92;L.y=105;
    L.hero.hp=a[0].hpBefore;e.t.cur=a[0].hpBefore;BT.duelRun={D:chosen.D,shots:0,clock:0,warm:[],warmIndex:0};BT.cine={F:chosen.D.F};duelEvent({k:'tdFinish',a,D:chosen.D,n:1,clip:duelClip(a)});const c=BT.duelShot;
    Math.random=()=>{throw Error('Pose/effect construction consumed combat RNG');};
    try{for(const pose of DUEL_POSE_SET)for(const face of [-1,1]){duelPoseFrame(W,e.f.g,pose,face);duelPoseFrame(L,e.t.g,pose,face);}for(const s of [W,L]){flipSet(s);if(s.sashimono)sashimonoFrames(s.sashimono);}}
    finally{Math.random=R;}
    if(mounted){const recipe=reactionRecipe(L,e.t.g);ok(recipe.L.gear.m==='nanbu'&&recipe.tack.barding==='nanban','Split rider lost actual mount/barding');
     ok(duelPoseFrame(L,e.t.g,'unhorseHurt',-1)!==L.sprs.hurt,'Unhorsed rider still contains its mounted sprite');}
    const cv=gameCanvas();cv.width=210;cv.height=145;const x=cv.getContext('2d'),create=document.createElement,before=JSON.stringify([W.hero.hp,L.hero.hp,totalOf(arena.pa),totalOf(arena.ea)]);let allocations=0;
    document.createElement=function(tag,...args){if(tag==='canvas')allocations++;return create.call(this,tag,...args);};
    try{Math.random=()=>{throw Error('New finisher rendering consumed combat RNG');};
     for(let i=0;i<88;i++){c.t=i/60;c.contact=c.t>=c.beats.at(-1);c.impactAt=c.beats.at(-1);a[0].applied=c.contact;
      x.clearRect(0,0,210,145);drawDuelActor(x,L,e.t.g,1,1);drawDuelActor(x,W,e.f.g,0,1);drawDuelTrails(x,c,1);drawDuelFinishGround(x,c,1);}
    }finally{document.createElement=create;Math.random=R;}
    ok(!allocations,'Warmed finishing animation allocated canvases');ok(JSON.stringify([W.hero.hp,L.hero.hp,totalOf(arena.pa),totalOf(arena.ea)])===before,'Drawing caused damage/casualties');
    if(kind==='yariCast'){
     let spears=0;const original=spear;spear=function(...args){spears++;return original(...args);};try{duelPoseFrame(W,e.f.g,'castEmpty',1);const recipe=reactionRecipe(W,e.f.g),old=recipe.duelFrames;recipe.duelFrames=new Map();duelPoseFrame(W,e.f.g,'castEmpty',1);recipe.duelFrames=old;}finally{spear=original;}
     ok(spears===0,'Thrown spear duplicated in empty throwing hand');
     const draw=artDraw;let copies=0;artDraw=function(ctx,img,...args){if(img===c.castAsset.cv)copies++;return draw(ctx,img,...args);};
     try{for(const [time,want]of [[.10,0],[.73,1],[1.25,0]]){c.t=time;copies=0;drawDuelCast(x,c,1);ok(copies===want,'Thrown spear is duplicated or not retrieved');}}finally{artDraw=draw;}
    }
    c.t=c.duration-.01;c.contact=true;c.impactAt=c.beats.at(-1);const records=aftermathState().records.length,loose=BT.loose?.length||0;settleDuelFootFinish(c);settleDuelFootFinish(c);
    ok(L.duelCorpse&&aftermathState().records.length===records+(kind==='spearBrace'?2:1),'Body/horse aftermath missing or duplicated');
    ok((BT.loose?.length||0)===loose+(kind==='riderDrag'?1:0),'Wrong riderless horse count');
    ok(aftermathState().records.filter(r=>r.owner===L).every(r=>r.flat===.5),'New casualty stopped halfway upright');
    const recipe=reactionRecipe(W,e.f.g),cached=[...recipe.duelFrames.values()];cv.width=cv.height=0;closeBattle();ok(!recipe.duelFrames.size&&cached.every(c=>!c.width),'New finisher canvases survived close');
   }
   out.plans=plans;out.render={steadyCanvasAllocations:0,actualNanbuPreserved:true,noDuplicateSpears:true,aftermathIdempotent:true};

   const runs=[];for(const [kind,weapon,mounted]of families)for(const save of [null,'guard','ward']){
    const arena=duelArtFixture({weapons:[weapon],foes:['katana'],strong:true,hp:110,mounted,mountedSide:1,save,site:'camp'}),sample=duelArtChain(arena,kind,save?1:3),totals=BT.A.map(totalOf);
    Math.random=seeded(sample.seed);startDuel({pairs:arena.pairs});Math.random=R;BT.speed=4;const run=BT.duelRun,D=run.D,original=duelEvent;let ticks=0,shots=0,covered=0,applied=0;
    duelEvent=function(o){const committed=D.committed;original(o);
     if(o.k==='tdFinish'&&(BT.duelShot?.sourceKind||BT.duelShot?.kind)===kind){shots++;const c=BT.duelShot;
      ok(c.moves.length===o.a.length,'Playback changed resolved combo length');if(save)ok(!c.footFinish&&c.kind!==kind,'Rescue still uses a fatal horse/grapple sequence');}
     if(o.k==='tdHit'){applied++;const e=o.e,hp=e.t.hr.hero.hp,guards=e.t.hr.hero.guard;ok(D.committed===committed+1,'Hit not committed once');
      if(e.hit)ok(hp===(e.ko&&e.t.loss?.save==='ward'?Math.max(e.hp,e.t.hr.hero.hpMax*.3):e.hp),'New sequence changed actual HP');
      const c=BT.duelShot;if(c?.guard&&c.a.includes(e)&&e.hit){ok(c.coverReady&&!c.L.duelCorpse,'Retainer arrived too late');covered++;}
      original(o);ok(D.committed===committed+1&&e.t.hr.hero.hp===hp&&e.t.hr.hero.guard===guards,'Repeated hit duplicated damage/rescue');}
    };
    try{while(!run.ended&&ticks++<12000){updateBattle(1/30);if(ticks%5===0)drawBattle();}}finally{duelEvent=original;Math.random=R;}
    ok(ticks<12000&&D.ended&&D.committed===D.log.filter(e=>!e.reload).length&&shots>0,'New finisher playback stalled');ok(BT.A.every((A,i)=>totalOf(A)===totals[i]),'Cinematic removed extra troops');
    if(save){ok(D.res.some(r=>r.save===save)&&!D.res.some(r=>r.L.duelCorpse),'Rescue left a protected commander corpse');if(save==='guard')ok(covered>0,'No early retainer interception');}
    else ok(aftermathState().records.some(r=>r.kind==='body'&&r.owner?.hero),'KO failed to leave its procedural body');
    runs.push({kind,save,hits:applied,shots,covered,fps:30,speed:4});closeBattle();
   }
   // Enemy-side execution and team assistance keep the same shared scheduling contract.
   for(const [kind,weapon,mounted,n]of [['yariCast','steel_yari',false,1],['spearBrace','steel_yari',true,1],['riderDrag','katana',true,1],['riderDrag','katana',true,3]]){const arena=duelArtFixture({n,weapons:['katana','yari','naginata'],foes:[weapon,'steel_yari','katana'],hp:110,mounted,mountedSide:0});
    const chosen=duelArtChain(arena,kind,null,1);Math.random=seeded(chosen.seed);startDuel({pairs:arena.pairs});Math.random=R;BT.speed=4;const run=BT.duelRun;let ticks=0;
    while(!run.ended&&ticks++<12000){updateBattle(1/30);if(ticks%6===0)drawBattle();}
    ok(run.ended&&run.D.committed===run.D.log.filter(e=>!e.reload).length,'Enemy/team finisher lost hits');ok(!BT.duelShot,'Enemy/team cinematic leaked');runs.push({kind,side:1,champions:n,hits:run.D.committed,helpers:run.D.log.filter(e=>e.help).length});closeBattle();}
   out.runs=runs;out.checks=checks;return out;
  }finally{Math.random=R;if(BT)closeBattle();simRestore(S);}
 });assert.deepStrictEqual(errors,[]);fs.writeFileSync(path.join(root,'reports/infantry-executions.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
 }finally{await browser.close();server.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
