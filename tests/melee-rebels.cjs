// Finite infantry contact/travel time, real advancing sprites, and locally sized uprisings.
const fs=require('fs'),http=require('http'),path=require('path'),assert=require('assert'),{chromium}=require('playwright');
const root=path.resolve(__dirname,'..');
(async()=>{
 const server=http.createServer((q,r)=>{r.setHeader('content-type','text/html');r.end(fs.readFileSync(process.env.BALANCE_DOWNLOAD||path.join(root,'index.html')));});await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH||(fs.existsSync('/usr/bin/chromium')?'/usr/bin/chromium':undefined),args:['--no-sandbox']});
 try{const p=await browser.newPage({viewport:{width:430,height:932}}),errors=[];p.on('pageerror',e=>errors.push(e.message));await p.addInitScript(()=>{window.__noIntro=window.__noQuick=true;});await p.goto('http://127.0.0.1:'+server.address().port);
 const report=await p.evaluate(()=>{
  const S=simPrepare(),out={};let checks=0;const ok=(v,m)=>{checks++;if(!v)throw Error(m);},near=(a,b,m)=>ok(Math.abs(a-b)<1e-7,m+': '+a+' / '+b);
  function fresh(){newGame();G.tut=1;G.speed=0;G.autoDuel=true;G.boons=freshBoons();G.roll=null;G.year=5;G.vseed=73117;G.wins=4;G.dGrowth=.2;G.troops={inf:400,arc:300,gun:150,cav:100};
   for(const t of ['arc','gun','cav']){G.units[t]=true;G.researched['corps_'+t]=1;}afterLoad();}
  const group=(type,n,a=1,d=1)=>({type,troops:n,max:n,start:n,atkMul:a,defMul:d,guards:0,cmds:[],mods:modsOf([]),spr:[],heroes:[]});
  const army=(side,groups)=>finishArmy({side,groups,clan:side?'ikki':'kage',mode:'army',name:side?'Rebels':'Kage Clan',strat:0,ki:0});
  function raw(A,D,phase='inf'){BT={A:A.side?[D,A]:[A,D],round:1,maxR:3,tac:['steady','steady'],jutsu:[null,null]};const R=Math.random;Math.random=()=>.5;try{return resolvePhase(phase,A,D,{jutsu:[null,null],siege:false});}finally{Math.random=R;}}
  try{
   fresh();let E=army(1,[group('inf',2000,3)]),P=army(0,[group('inf',400),group('gun',100),group('arc',300),group('cav',100)]),hs=raw(E,P);
   ok(hs.some(h=>h.to.type==='inf'&&h.kills===400),'Strong force did not beat front line');ok(!hs.some(h=>h.to.type==='arc'||h.to.type==='cav'),'Infantry swept every back line');
   const first=hs.find(h=>h.to.type==='inf'),rear=hs.find(h=>h.to.type==='gun');ok(rear&&rear.infAt>=first.infEnd+INF_CLOCK.advance-1e-8,'Rear attack before clearing/advancing');
   ok(hs.every(h=>h.infAt>=0&&h.infEnd<=INF_CLOCK.fight&&h.infEnd>h.infAt),'Attack outside clock');
   out.example=hs.map(h=>({target:h.to.type,kills:h.kills,contact:h.infAt,end:h.infEnd}));

   // Same line DPS is preserved; defense buys time, survivors shield every rear formation.
   E=army(1,[group('inf',400)]);P=army(0,[group('inf',400),group('gun',150),group('arc',300)]);hs=raw(E,P);
   near(hs[0].kills,104,'Ordinary frontline DPS changed');ok(hs.length===1&&hs[0].infEnd===INF_CLOCK.fight,'Unbroken infantry did not screen');
   const slow=raw(army(1,[group('inf',2000,3)]),army(0,[group('inf',400,1,4),group('gun',150),group('arc',300)]));
   ok(slow.length===1&&slow[0].kills<400,'Stronger front defense did not stop breakthrough');
   P=army(0,[group('gun',150),group('arc',300)]);hs=raw(army(1,[group('inf',400)]),P);ok(hs[0].to.type==='gun'&&hs[0].infAt===0,'Exposed ranged units became immune');

   // Several infantry/independent-hero groups share one breach clock; grouping cannot teleport past defenders.
   P=army(0,[group('inf',400),group('gun',100),group('arc',300)]);hs=raw(army(1,[group('inf',1000,3),group('inf',1000,3)]),P);
   const screen=hs.filter(h=>h.to.type==='inf'),back=hs.filter(h=>h.to.type==='gun');near(screen.reduce((n,h)=>n+h.kills,0),400,'Combined frontline loss');
   near(screen[0].infEnd,first.infEnd,'Splitting units changes clear time');ok(back.every(h=>h.infAt>=screen[0].infEnd+INF_CLOCK.advance),'Second infantry group skipped travel');
   const left=army(0,[group('inf',100,100),group('gun',100)]),right=army(1,[group('inf',100,100),group('gun',100)]),mutual=raw(left,right).concat(raw(right,left));
   guardInfantryBreakthrough(mutual);ok(mutual.every(h=>h.depth===0),'Eliminated infantry struck posthumously at rear');

   // Hero/Chain bonuses cannot donate the entire destroyed front's extra damage to a tiny rear contact.
   E=army(1,[group('inf',1000,5)]);E.groups[0].mods.chain=5;P=army(0,[group('inf',100),group('gun',10000)]);hs=raw(E,P);const baseRear=hs.find(h=>h.to.type==='gun').kills;
   Math.random=()=>0;heroPhase('inf',hs,null);Math.random=S.random;ok(hs.find(h=>h.to.type==='gun').kills<=baseRear*1.651,'Chain transfers unused front-line damage');
   out.clock={seconds:INF_CLOCK.fight,advance:INF_CLOCK.advance,sharedAcrossGroups:true,defendersScreen:true,exposedRangedVulnerable:true,deadCannotAdvance:true,bonusBounded:true};BT=null;

   // Actual script/events and movement, at phone size. A hit must wait for the march and reach the next line.
   const pa=army(0,[group('inf',400),group('gun',100),group('arc',300)]),ea=army(1,[group('inf',2000,3)]);
   startBattle('balance',{site:{id:'balance',type:'camp',clan:'ikki',x:1,y:1,power:500,reward:{}},pa,ea});BT.autoKi.on=false;BT.round=1;BT.state='run';BT.phase=2;BT.speed=1;
   Math.random=()=>.5;runPhase('inf');Math.random=S.random;
   const wins=BT.script.wins.filter(w=>w.h?.infAt!=null&&w.g===ea.groups[0]),front=wins.find(w=>w.T.type==='inf'),next=wins.find(w=>w.T.type==='gun');
   ok(front&&next&&next.t0>=front.t1+INF_CLOCK.advance-1e-7,'Visual engagements overlap');
   const transit=ea.groups[0].spr.flatMap(s=>s.q).filter(m=>m.t>=front.t1-1e-7&&m.t<next.t0);
   ok(transit.length>0,'No movement between enemy lines');
   const hit=BT.script.ev.find(e=>e.k==='hit'&&e.h.from===ea.groups[0]&&e.h.to.type==='gun');ok(hit&&hit.t>=next.t0,'Damage before rear contact');
   let maxGap=0,firstRear=null,steps=0;
   while(BT.phaseName==='inf'&&steps++<1000){const before=pa.groups[1].troops;updateBattle(1/60);
    if(pa.groups[1].troops<before&&firstRear==null){firstRear=BT.t;maxGap=Math.min(...ea.groups[0].spr.filter(s=>s.alive).flatMap(s=>pa.groups[1].spr.map(t=>Math.abs(s.x-t.x))));}
   }
   ok(steps<1000&&firstRear!=null&&maxGap<40,'Rear damage without reaching line: '+maxGap);ok(pa.groups[2].troops===300,'Bow line lost to infantry beyond timer');
   ok(!BT.script||BT.script.ev.every(e=>e.k!=='hit'||e.h.infAt==null||e.h.infEnd<=INF_CLOCK.fight),'Late melee damage left queued');
   out.playback={frontEnd:front.t1,rearContact:next.t0,firstRearDamage:firstRear,gapAtDamage:maxGap,archersLeft:pa.groups[2].troops};closeBattle();

   // Rebel strength comes from province/history, independent of player equipment/army size and Lawless Coasts.
   fresh();const early=siteById('settsu'),late=siteById('tengu');G.prov[early.id].owner=G.prov[late.id].owner='kage';
   function revolt(P,seed=527){G.camps=[];Math.random=seeded(seed);const c=spawnRebellion(P);Math.random=S.random;return c;}
   let c=revolt(early),pw=c.power;const expiry=c.expires,reward=JSON.stringify(c.reward);
   G.troops={inf:10000,arc:8000,gun:6000,cav:4000};G.villagers.forEach(v=>{v.lv=30;v.eq.armor='ginryu_gusoku';v.eq.head='eboshi_samurai';});
   near(revolt(early).power,pw,'Player gear/headcount inflates local revolt');ok(revolt(late).power>pw*3,'Late provinces not distinguished');
   c=revolt(early);const r=Math.random;Math.random=seeded(919);G.boons.raid=1;const a1=enemyArmy(c);Math.random=seeded(919);G.boons.raid=3;const a3=enemyArmy(c);Math.random=r;
   near(totalOf(a1),totalOf(a3),'Lawless Coasts multiplies uprising');ok(totalOf(a3)<500,'Early fort rebellion still thousands');
   const camp={id:'raid',type:'camp',clan:'bandit',x:1,y:2,power:200};Math.random=seeded(919);G.boons.raid=1;const raid1=armyPower(enemyArmy(camp));Math.random=seeded(919);G.boons.raid=3;const raid3=armyPower(enemyArmy(camp));Math.random=r;ok(raid3>raid1*2.7,'Lawless Coasts roaming raiders nerfed');

   // Localisation survives legacy saves without rerolling the clock, rewards or guaranteed worker captive.
   c.power=50000;delete c.rebelV;const items=JSON.stringify(c.reward),until=c.expires;G.camps=[c];migrateRebellions();
   ok(c.power<=rebellionBase(early)*1.05+1&&c.rebelV===1,'Oversized legacy uprising not capped');ok(JSON.stringify(c.reward)===items&&c.expires===until,'Migration rerolled rewards/timer');
   const copy=JSON.stringify(c);migrateRebellions();ok(JSON.stringify(c)===copy,'Migration is not idempotent');ok(c.reward.recruits.some(id=>vData(id).role==='work'),'Worker captive lost');
   economyBeforeSave();const saved=JSON.stringify(G);G=JSON.parse(saved);resetRT();afterLoad();const loaded=G.camps.find(x=>x.id===c.id);
   ok(G.v===1&&loaded.power===c.power&&loaded.expires===until&&JSON.stringify(loaded.reward)===items,'Rebellion save/reload altered event');
   const state=G.prov[early.id],before=state.power;loaded.expires=monthIdx();Math.random=()=>.99;rebelTick();Math.random=r;
   ok(state.owner===early.clan&&state.power>=before&&state.power*sitePowerScale(early)>=loaded.power*1.05,'Lost fort ignored uprising strength/double-scaled');
   ok(state.power<=Math.max(before,(early.power||80)*1.11)+1,'Lost fort recursively balloons');
   out.rebellion={earlyPower:pw,latePower:revolt(late).power,earlyTroops:totalOf(a3),playerGearAndCountIndependent:true,lawlessOnlyRoamers:true,legacyCapped:true,rewardsAndCaptivePreserved:true,expiryAndRetakeConsistent:true,saveVersion:1};
   out.checks=checks;return out;
  }finally{Math.random=S.random;if(BT)closeBattle();simRestore(S);}
 });
 assert.deepStrictEqual(errors,[]);fs.mkdirSync(path.join(root,'reports'),{recursive:true});fs.writeFileSync(path.join(root,'reports/melee-rebels.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
 }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
