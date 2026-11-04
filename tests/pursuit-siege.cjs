// Real pursuit windows and castle-specific exposure, including the transition to gate fire.
const fs=require('fs'),http=require('http'),path=require('path'),assert=require('assert'),{chromium}=require('playwright');
const root=path.resolve(__dirname,'..');
(async()=>{const server=http.createServer((q,r)=>{r.setHeader('content-type','text/html');r.end(fs.readFileSync(process.env.PURSUIT_DOWNLOAD||path.join(root,'index.html')));});await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({headless:true,executablePath:'/usr/bin/chromium',args:['--no-sandbox']});try{const p=await browser.newPage({viewport:{width:430,height:932}}),errors=[];p.on('pageerror',e=>errors.push(e.message));await p.addInitScript(()=>{window.__noIntro=window.__noQuick=true;});await p.goto('http://127.0.0.1:'+server.address().port);
 const report=await p.evaluate(()=>{const S=simPrepare(),R=Math.random,out={};let checks=0;const ok=(v,m)=>{checks++;if(!v)throw Error(m);},near=(a,b,m)=>ok(Math.abs(a-b)<1e-6,m+': '+a+' / '+b);
  const group=(type,n,atk=1,def=1)=>({type,troops:n,atkMul:atk,defMul:def,cmds:[],guards:0,mods:modsOf([]),spr:[],heroes:[],kitDist:{w:[[({inf:'katana',gun:'tanegashima',arc:'yumi',cav:'naginata'})[type],1]],a:[['lamellar',1]],h:[['jingasa',1]]}}),
    army=(side,groups)=>finishArmy({side,groups,clan:side?'kurogane':'kage',name:side?'Garrison':'Kage',mode:'army',strat:0,ki:0});
  function fresh(pa,ea,siege=false){if(BT)closeBattle();newGame();G.tut=1;G.speed=0;G.autoDuel=false;G.boons=freshBoons();G.roll=null;$('#title').hidden=true;resizeView();afterLoad();MQ.length=0;$('#modal').hidden=true;
   Math.random=seeded(73117);if(siege){const player=playerArmy,enemy=enemyArmy;playerArmy=()=>pa;enemyArmy=()=>ea;try{startBattle('yamashiro');}finally{playerArmy=player;enemyArmy=enemy;}}else{const site={id:'pursuit_siege',type:'camp',clan:'kurogane',power:500,x:1,y:1,reward:{}};startBattle(site.id,{site,pa,ea});}Math.random=R;
   BT.seed=73117;BT.autoKi.on=false;BT.state='run';BT.round=1;BT.speed=1;BT.auto=false;BT.t=BT.anim=2;for(const A of BT.A)for(const g of A.groups)for(const s of g.spr){s.q=[];s.x=s.sx;s.y=s.sy;s.state='idle';}
   if(siege)BT.siege.hp=BT.siege.max=1e6;return {pa,ea};}
  function phase(p){BT.phase=PHASES.indexOf(p);Math.random=()=>.5;try{runPhase(p);}finally{Math.random=R;}return BT.script;}
  function drain(script,fps=60){let frames=0;while(BT.script===script&&script.i<script.ev.length&&frames++<10000)updateBattle(1/fps);ok(frames<10000,'Phase stalled');return frames;}
  try{
   const pursuit=[];for(const side of [0,1]){
    const attacker=army(side,[group('inf',400,30)]),defender=army(1-side,[group('inf',1),group('gun',20000),group('arc',300)]),pa=side?defender:attacker,ea=side?attacker:defender;fresh(pa,ea);
    const script=phase('inf'),g=attacker.groups[0],front=defender.groups[0],rear=defender.groups[1],windows=script.wins.filter(w=>w.g===g),first=windows.find(w=>w.T===front),next=windows.find(w=>w.T===rear);
    ok(first&&next&&next.t0>=first.t1+INF_CLOCK.advance-1e-7,'No real travel between enemy lines');
    const final=script.ev.filter(e=>e.k==='die'&&e.h.to===front).at(-1);ok(final.t>=first.t1-.05&&final.t<=first.t1,'Single last defender died before its allocated exchange ended');
    const hit=script.ev.find(e=>e.k==='hit'&&e.h.from===g&&e.h.to===rear);let clear=null,moved=null,rearAt=null,gap=null,air=0,frames=0,oldFrontX=null;
    while(BT.script===script&&script.i<script.ev.length&&frames++<2000){const hp=rear.troops;updateBattle(1/60);
     if(front.visualCleared){if(clear==null){clear=BT.t;oldFrontX=Math.max(...g.spr.filter(s=>s.alive).map(s=>sideDir(side)*s.x));}
      const now=Math.max(...g.spr.filter(s=>s.alive).map(s=>sideDir(side)*s.x));if(moved==null&&now>oldFrontX+.5)moved=BT.t;
      air+=g.spr.filter(s=>s.alive&&s.state==='fight'&&s.fightTarget===front).length;}
     if(rear.troops<hp&&rearAt==null){rearAt=BT.t;gap=Math.min(...g.spr.filter(s=>s.alive).flatMap(s=>rear.spr.map(t=>Math.abs(s.x-t.x))));}
    }
    ok(clear!=null&&moved!=null&&moved-clear<.2,'Infantry waited after the last defender fell');ok(!air,'Infantry swung at an empty formation');
    ok(rearAt>=hit.t-.02&&gap<40,'Rear damage arrived before physical pursuit');ok(defender.groups[2].troops===300,'Surviving gunners failed to screen archers');
    pursuit.push({side,clear,moved,rearDamageAt:rearAt,gap,airFrames:air});closeBattle();
   }
   // A nearly exhausted clock still allows a partial chase, but cannot invent another attack.
   {const pa=army(0,[group('inf',400,2)]),ea=army(1,[group('inf',180),group('gun',1000)]);fresh(pa,ea);const script=phase('inf'),g=pa.groups[0],p=g.infPursuit;
    ok(p&&p.to===ea.groups[1]&&p.end-p.depart<INF_CLOCK.advance,'Missing partial pursuit');ok(!script.ev.some(e=>e.k==='hit'&&e.h.from===g&&e.h.to===ea.groups[1]),'Partial travel created free damage');
    const orders=g.spr.flatMap(s=>s.q.filter(q=>q.pursuit));ok(orders.length>0&&orders.every(q=>q.deadline<=BT.t+BRANDISH+INF_CLOCK.approach+INF_CLOCK.fight+1e-8),'Pursuit exceeds phase clock');
    const first=script.wins.find(w=>w.g===g),start=Math.max(...g.spr.map(s=>s.x));drain(script);ok(Math.max(...g.spr.map(s=>s.x))>start+1,'Partial chase never moved');near(ea.groups[1].troops,1000,'Partial chase damaged ranged line');
    out.partial={available:p.end-p.depart,travel:INF_CLOCK.advance,clearedAt:first.t1,gate:false};closeBattle();}
   out.pursuit=pursuit;

   const targets=[];for(const type of ['gun','arc']){
    const pa=army(0,[group('inf',400),group('gun',600,30),group('arc',600,30)]),ea=army(1,[group('inf',2000),group('gun',12),group('arc',12),group('cav',500)]);fresh(pa,ea,true);
    ok(ea.groups.filter(g=>g.type==='gun'||g.type==='arc').every(g=>g.onWall&&g.spr.every(s=>s.lift===WALL_LIFT)),'Both ranged corps not on ramparts');
    const hp=BT.siege.hp,script=phase(type),own=script.ev.filter(e=>e.k==='hit'&&e.h.from===pa.groups.find(g=>g.type===type));
    ok(own.length&&own.every(e=>e.h.to.type==='gun'||e.h.to.type==='arc'),'Ranged fire hit sheltered melee');ok(!script.gateFire&&!script.ev.some(e=>e.gateVolley),'Gate was attacked while ranged defenders were exposed');
    drain(script);near(ea.groups[0].troops,2000,'Sheltered infantry lost troops');near(ea.groups[3].troops,500,'Sheltered cavalry lost troops');near(BT.siege.hp,hp,'Same volley damaged gate too');ok(!wallRangedAlive(),'Strong volley failed to clear ramparts');
    const next=phase(type),gateShots=next.ev.filter(e=>e.k==='shot'&&e.gate),gate=next.ev.find(e=>e.gateVolley);
    if(type==='gun'){ok(next.gateFire&&gateShots.length&&gate,'No switch to actual gate fire');drain(next);ok(BT.siege.hp<hp,'Cleared ramparts did not allow gun damage to gate');const after=BT.siege.hp;doEvent(gate);near(BT.siege.hp,after,'Repeated gate impact duplicated damage');near(ea.groups[0].troops,2000,'Gun gate fire hit hidden infantry');near(ea.groups[3].troops,500,'Gun gate fire hit hidden cavalry');targets.push({type,gateShots:gateShots.length,gateDamage:hp-after});}
    else{const lob=next.ev.filter(e=>e.k==='hit'&&sideOf(e.h.from)===0);ok(!next.gateFire&&!gate&&lob.length&&lob.every(e=>e.h.wallLob&&['inf','cav'].includes(e.h.to.type)),'Archers did not lob into the courtyard');ok(next.ev.some(e=>e.k==='shot'&&e.lob&&!e.gate),'No high lob projectiles');drain(next);near(BT.siege.hp,hp,'Lob volley damaged gate');ok(ea.groups[0].troops<2000||ea.groups[3].troops<500,'Lobs did not damage sheltered troops');targets.push({type,lobHits:lob.length,gateDamage:0});}closeBattle();
   }out.wallTargets=targets;

   // The ram has real infantry beside it; wall troops can shoot the charging soldiers.
   {const pa=army(0,[group('inf',500),group('gun',100)]),ea=army(1,[group('inf',1000),group('gun',100),group('arc',100),group('cav',100)]);fresh(pa,ea,true);
    const before=pa.groups[0].troops,hp=BT.siege.hp,script=phase('inf'),ram=script.ev.filter(e=>e.k==='ram');
    ok(ram.length===3&&script.ev.some(e=>e.k==='hit'&&e.h.icpt&&sideOf(e.h.from)===1),'Missing gate ram or defensive ranged fire');
    ok(!script.ev.some(e=>e.k==='hit'&&sideOf(e.h.from)===0),'Infantry attacked sheltered garrison');
    ok(pa.groups[0].spr.some(s=>s.q.some(q=>q.gate&&q.x>s.x)),'Infantry never charged gate');drain(script);
    ok(pa.groups[0].troops<before&&BT.siege.hp<hp,'Gate assault had no casualties or damage');near(ea.groups[0].troops,1000,'Ram killed sheltered infantry');
    out.ram={crewLoss:before-pa.groups[0].troops,gateDamage:hp-BT.siege.hp};
    const gateBefore=BT.siege.hp;pa.groups[0].troops=0;gateHit({dmg:1000,crew:'inf',strength:500});near(BT.siege.hp,gateBefore,'Dead ram crew damaged gate');
    breachGate();ok(!wallRangedAlive()&&ea.groups.every(g=>!g.onWall&&g.spr.every(s=>!s.lift)),'Breach did not release rampart state');
    Math.random=()=>.5;const hits=resolvePhase('gun',pa,ea,{jutsu:[null,null],siege:false});Math.random=R;
    ok(hits[0]?.to.type==='inf','Field targeting did not return after breach');closeBattle();
   }
   // A commander without rank-and-file still protects the rampart; no mandatory ordinary troops.
   {const c={name:'Wall gunner',s:{atk:20,def:10,hp:90,str:12,mrk:24,duel:1},hp:90,hpMax:90,post:'line',skill:'marksman',slv:1,look:artEquipmentLook(artTroopLook('gun',1,0,{w:'tanegashima',a:'lamellar',h:'jingasa'}))},g=fighterGroup('gun',c);g.heroOnly=true;g.troops=30;
    fresh(army(0,[group('gun',100)]),army(1,[group('inf',200),g]),true);ok(wallRangedAlive()&&g.spr[0].lift===WALL_LIFT,'Independent ranged hero is not exposed');
    const script=phase('gun');ok(script.ev.some(e=>e.k==='hit'&&e.h.to===g)&&!script.gateFire,'Independent wall hero bypassed');closeBattle();
   }
   out.checks=checks;return out;
  }finally{Math.random=R;if(BT)closeBattle();simRestore(S);}
 });assert.deepStrictEqual(errors,[]);fs.writeFileSync(path.join(root,'reports/pursuit-siege.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
 }finally{await browser.close();server.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
