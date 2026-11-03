// Real infantry timing, nearby executions and fast casualties preserve resolved damage and equipment.
const fs=require('fs'),http=require('http'),path=require('path'),assert=require('assert'),{chromium}=require('playwright'),install=require('../tools/field-combat-fixture.cjs');
const root=path.resolve(__dirname,'..'),baseline=JSON.parse(fs.readFileSync(path.join(root,'reports/field-pacing-baseline.json')));
(async()=>{const server=http.createServer((q,r)=>{r.setHeader('content-type','text/html');r.end(fs.readFileSync(process.env.FIELD_DOWNLOAD||path.join(root,'index.html')));});await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({headless:true,executablePath:'/usr/bin/chromium',args:['--no-sandbox']});try{const p=await browser.newPage({viewport:{width:430,height:932}}),errors=[];p.on('pageerror',e=>errors.push(e.message));await p.addInitScript(()=>{window.__noIntro=window.__noQuick=true;});await p.goto('http://127.0.0.1:'+server.address().port);await install(p);
 const report=await p.evaluate(baseline=>{const S=simPrepare(),R=Math.random,out={};let checks=0;const ok=(v,m)=>{checks++;if(!v)throw Error(m);},near=(a,b,m,tol=1e-7)=>ok(Math.abs(a-b)<tol,m+': '+a+' / '+b);
  try{const timing={};for(const type of ['inf','gun','arc','cav']){
    let a=fieldCombatFixture({type});Math.random=seeded(101);const raw=buildPhaseScript(type,a.hits),rawRoll=Math.random(),rawMoves=BT.A.flatMap(A=>A.groups.flatMap(g=>g.spr.flatMap(s=>s.q.map(q=>[q.x,q.y,q.spd])))),
      rawEvents=raw.ev.map(e=>[e.k,e.t,e.flight||0]),rawContact=Math.min(...raw.wins.map(w=>w.t0));Math.random=R;
    a=fieldCombatFixture({type});Math.random=seeded(101);const script=buildScript(type,a.hits),shownRoll=Math.random();Math.random=R;
    near(shownRoll,rawRoll,'Presentation consumed combat RNG');ok(a.hits.every(h=>h.kills===240),'Timing changed damage');
    ok(JSON.stringify(BT.A.flatMap(A=>A.groups.flatMap(g=>g.spr.flatMap(s=>s.q.map(q=>[q.x,q.y,q.spd])))))===JSON.stringify(rawMoves),'Timing changed positions or movement speeds');
    ok(script.ev.filter(e=>e.k==='hit').length===raw.ev.filter(e=>e.k==='hit').length&&script.ev.filter(e=>e.k==='die').length===raw.ev.filter(e=>e.k==='die').length,'Timing invented/dropped casualties');
    if(type==='inf'){
      near(script.dur,raw.dur,'Infantry phase padded after the actual exchange');
      near(INF_CLOCK.fight,5.4,'Infantry fight/pursuit clock is not doubled');near(INF_CLOCK.advance,1.25,'Infantry breakthrough travel changed');
      near(Math.min(...script.wins.map(w=>w.t0)),rawContact,'Infantry approach was needlessly delayed');
      for(const e of script.ev.filter(e=>e.k==='fieldTell'))ok(script.ev.includes(e.die)&&e.die.k==='die','Execution has no resolved casualty');
    }else if(type==='gun'||type==='arc'){
      near((script.dur-raw.dur)/BATTLE_PACE,.5,'Ranged impact hold not +0.5 seconds');ok(JSON.stringify(script.ev.map(e=>[e.k,e.t,e.flight||0]))===JSON.stringify(rawEvents),'Ranged firing/flight/impact times changed');
      near(raw.dur,baseline[type].duration,'Ranged baseline fixture drifted');
    }else near(script.dur,raw.dur,'Cavalry phase stretched');
    timing[type]={before:(raw.dur-.25)/BATTLE_PACE,after:(script.dur-.25)/BATTLE_PACE,firstContact:Number.isFinite(rawContact)?rawContact:null,kills:a.hits.map(h=>h.kills),candidates:script.ev.filter(e=>e.k==='fieldTell').length};closeBattle();
   }out.timing=timing;
   {const a=fieldCombatFixture();BT.siege={hp:100,max:100,breached:false,x:BT.cx};const h={from:a.pa.groups[0],to:a.ea.groups[0],kills:10,depth:0,grenade:true,owner:{},pk:'burn'};a.hits.push(h);
    Math.random=seeded(101);const script=buildScript('inf',a.hits);Math.random=R;const thrown=script.ev.find(e=>e.k==='pitchThrow'),burst=script.ev.find(e=>e.k==='pitchBurst');
    near(burst.t-thrown.t,.7,'Infantry timing desynchronized grenade flight/explosion');near(h.t0,burst.t,'Grenade damage no longer lands at explosion');
    ok(!script.ev.some(e=>e.k==='fieldTell'),'Field execution crosses an unbreached wall');closeBattle();}

   out.reactions={};for(const kind of ['death','rout']){fieldCombatFixture();const g=BT.A[0].groups[0],s=g.spr[0],troops=g.troops;if(kind==='death')killSprite(g,s,'inf',1);else routSprite(g,s,-1);
    const f=s.fate;let elapsed=0;while(!s.stamped&&!s.gone&&elapsed<30){updSprite(s,1/600,g,0);elapsed+=1/600;}
    near(elapsed*REACTION_SPEED,baseline[kind].elapsed,'Reaction is not 33% faster',.005);near(g.troops,troops,'Reaction deducted extra troops');
    if(kind==='death')ok(s.stamped&&aftermathState().records.some(r=>r.owner===s&&r.flat<.5),'Faster death did not settle flat');
    else ok(s.gone&&!s.stamped&&!aftermathState().records.some(r=>r.owner===s&&r.kind==='body'),'Fleeing survivor turned into a body');
    out.reactions[kind]={before:baseline[kind].elapsed/BATTLE_PACE,after:elapsed/BATTLE_PACE,speed:REACTION_SPEED};closeBattle();
   }

   const renders=[];for(const [weapon,want]of [['katana','passing'],['steel_yari','thrust'],['nodachi','heavy'],['naginata','sweep']])for(const side of [0,1]){
    const a=fieldCombatFixture({weapon}),g=BT.A[side].groups[0],T=BT.A[1-side].groups[0],sc=spriteScale(),dir=sideDir(side),A=g.spr[0],V=T.spr[0];
    for(const s of g.spr){s.x=-500;s.y=80;s.q=[];}A.x=120-dir*18*sc;A.y=80;A.face=dir;V.x=120;V.y=80;
    const h={from:g,to:T,kills:BT.per,depth:0},die={k:'die',t:BT.t+FIELD_EXECUTION.lead,s:V,h},before=JSON.stringify([g.troops,T.troops,BT.stop,BT.cam,BT.pk]);
    doEvent({k:'fieldTell',die});const c=A.fieldExecution;ok(c&&c.V===V&&c.style===want,'Wrong equipped finisher or no legal nearby pair');
    ok(JSON.stringify([g.troops,T.troops,BT.stop,BT.cam,BT.pk])===before,'Starting execution changed combat/camera');
    const set=A.sprs;if(A.sashimono)sashimonoFrames(A.sashimono);const cv=gameCanvas();cv.width=220;cv.height=140;const x=cv.getContext('2d'),create=document.createElement;let allocations=0;
    document.createElement=function(tag,...args){if(tag==='canvas')allocations++;return create.call(this,tag,...args);};
    try{Math.random=()=>{throw Error('Field execution drawing consumed combat RNG');};for(let i=0;i<15;i++){BT.t=c.start+(c.impact-c.start)*i/16;drawFieldExecution(x,A,g,side,sc);}}
    finally{document.createElement=create;Math.random=R;}
    ok(!allocations&&A.sprs===set,'Field execution creates replacement sprite canvases');
    BT.t=die.t;doEvent({k:'hit',h});doEvent(die);ok(c.hit&&V.fate?.kind==='death','Execution did not synchronize to real death');
    const troops=T.troops;doEvent({k:'hit',h});doEvent(die);near(T.troops,troops,'Repeated impact duplicated losses');
    const state=JSON.stringify([g.troops,T.troops,A.x,A.y,V.x,V.y]);Math.random=()=>{throw Error('Field follow-through consumed combat RNG');};
    try{for(let i=0;i<20;i++){BT.t=c.impact+FIELD_EXECUTION.after*i/21;drawFieldExecution(x,A,g,side,sc);}}finally{Math.random=R;}
    ok(JSON.stringify([g.troops,T.troops,A.x,A.y,V.x,V.y])===state,'Drawing teleported actors or dealt damage');
    BT.t=c.end+.01;updateFieldExecutions();ok(!A.fieldExecution&&!V.fieldExecution&&!BT.fieldExecutions.length,'Execution references survived expiry');
    renders.push({weapon,side,style:want,canvases:allocations});cv.width=cv.height=0;closeBattle();
   }out.render=renders;

   // Saturation, cancellation, distant targets and the casualty-rout baseline.
   {const a=fieldCombatFixture(),g=a.pa.groups[0],T=a.ea.groups[0],sc=spriteScale(),dies=[];for(const s of g.spr)s.x=-500;
    for(let i=0;i<3;i++){const A=g.spr[i],V=T.spr[i];A.x=100;A.y=60+i*12*sc;A.face=1;V.x=100+18*sc;V.y=A.y;
     const die={k:'die',t:BT.t+FIELD_EXECUTION.lead,s:V,h:{from:g,to:T,kills:BT.per,depth:0}};dies.push(die);doEvent({k:'fieldTell',die});}
    ok(BT.fieldExecutions.length===2&&!T.spr[2].fieldExecution,'More than two active field finishes');
    const routed=dies[0].s,clip=routed.fieldExecution;routed.routPending=true;BT.t=dies[0].t;doEvent({k:'hit',h:dies[0].h});doEvent(dies[0]);
    ok(routed.fate?.kind==='rout'&&!clip.hit&&clip.cancelled,'Rout was replaced by an execution');updateFieldExecutions();
    const other=dies[1].s.fieldExecution;killSprite(g,other.A,'inf',-1);updateFieldExecutions();ok(!dies[1].s.fieldExecution&&!BT.fieldExecutions.length,'Dead attacker stranded a victim');
    const far=dies[2];far.s.x=900;far.t=BT.t+FIELD_EXECUTION.lead;doEvent({k:'fieldTell',die:far});ok(!far.s.fieldExecution,'Distant attacker teleported to victim');
    closeBattle();
   }
   const runs=[];let observed=0;for(const fps of [30,60]){const a=fieldCombatFixture(),g0=a.pa.groups[0],g1=a.ea.groups[0];Math.random=seeded(101);const script=buildScript('inf',a.hits);Math.random=R;
    BT.script=script;BT.next=script.dur-.25;BT.phaseDur=BT.next;BT.speed=4;BT.auto=false;const original=doEvent;let frames=0,started=0,maxActive=0;
    doEvent=function(e){original(e);if(e.k==='fieldTell'&&e.die.s.fieldExecution)started++;maxActive=Math.max(maxActive,BT.fieldExecutions?.length||0);};
    try{while(BT.state==='run'&&BT.script===script&&frames++<3000){updateBattle(1/fps);if(frames%7===0)drawBattle();}}finally{doEvent=original;}
    ok(frames<3000,'Infantry phase stalled');near(g0.troops,160,'Actual phase lost wrong allied troop count');near(g1.troops,160,'Actual phase lost wrong enemy troop count');
    ok(maxActive<=2,'Playback exceeded execution cap');observed+=started;runs.push({fps,speed:4,frames,started,maxActive,remaining:[g0.troops,g1.troops]});closeBattle();
   }ok(observed>0,'Executions never appear in real line combat');out.runs=runs;out.checks=checks;return out;
  }finally{Math.random=R;if(BT)closeBattle();simRestore(S);}
 },baseline);assert.deepStrictEqual(errors,[]);fs.writeFileSync(path.join(root,'reports/field-combat.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
 }finally{await browser.close();server.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
