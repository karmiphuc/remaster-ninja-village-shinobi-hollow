// Guns follow the ranks; field arrows spill only beside their original aim. Neither uses the infantry clock.
const fs=require('fs'),http=require('http'),path=require('path'),assert=require('assert'),{chromium}=require('playwright');
const root=path.resolve(__dirname,'..');
(async()=>{
 const server=http.createServer((q,r)=>{r.setHeader('content-type','text/html');r.end(fs.readFileSync(process.env.RANGED_DOWNLOAD||path.join(root,'index.html')));});await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH||(fs.existsSync('/usr/bin/chromium')?'/usr/bin/chromium':undefined),args:['--no-sandbox']});
 try{const p=await browser.newPage({viewport:{width:430,height:932}}),errors=[];p.on('pageerror',e=>errors.push(e.message));await p.addInitScript(()=>{window.__noIntro=window.__noQuick=true;});await p.goto('http://127.0.0.1:'+server.address().port);
 const report=await p.evaluate(()=>{
  const S=simPrepare(),out={};let checks=0,cases=0;const ok=(v,m)=>{checks++;if(!v)throw Error(m);},near=(a,b,m)=>ok(Math.abs(a-b)<1e-7,m+': '+a+' / '+b),types=['inf','gun','arc','cav'];
  const group=(type,n,a=1,d=1)=>({type,troops:n,max:n,start:n,atkMul:a,defMul:d,guards:0,cmds:[],mods:modsOf([]),spr:[],heroes:[]});
  const army=(side,groups)=>finishArmy({side,groups,clan:side?'ikki':'kage',mode:'army',name:side?'Rivals':'Kage Clan',strat:0,ki:0});
  function raw(A,D,phase,seed=71,siege=false){BT={A:A.side?[D,A]:[A,D],round:1,maxR:3,tac:['steady','steady'],jutsu:[null,null]};const R=Math.random;Math.random=seeded(seed);try{return resolvePhase(phase,A,D,{jutsu:[null,null],siege});}finally{Math.random=R;}}
  const summary=hs=>hs.map(h=>({target:h.to.type,kills:+h.kills.toFixed(6),depth:h.depth,stray:!!h.stray}));
  const signature=hs=>JSON.stringify(summary(hs));
  try{
   newGame();G.tut=1;G.speed=0;G.autoDuel=true;G.boons=freshBoons();G.roll=null;afterLoad();
   let A=army(0,[group('gun',400,3)]),D=army(1,types.map(t=>group(t,8))),hs=raw(A,D,'gun');
   ok(hs.map(h=>h.to.type).join()===types.join(),'Guns do not reach all four lines in order');
   ok(hs.every(h=>h.kills===8&&h.infAt==null&&h.infEnd==null),'Gun damage capped or infantry-timed');out.gun=summary(hs);
   D=army(1,[group('inf',10000),group('gun',8),group('arc',8),group('cav',8)]);hs=raw(A,D,'gun');
   ok(hs.length===1&&hs[0].to.type==='inf','Guns created free damage behind a surviving front');

   A=army(0,[group('arc',400,10)]);D=army(1,types.map(t=>group(t,8)));hs=raw(A,D,'arc');
   ok(hs[0].to.type==='gun'&&hs.some(h=>h.to.type==='inf')&&hs.some(h=>h.to.type==='arc'),'Gunner aim cannot reach both neighbours');
   ok(!hs.some(h=>h.to.type==='cav'),'Gunner-aimed arrows jumped to cavalry');out.arrowsAtGunners=summary(hs);
   D=army(1,[group('inf',8),group('arc',8),group('cav',8)]);hs=raw(A,D,'arc');
   ok(hs[0].to.type==='arc'&&hs.some(h=>h.to.type==='cav')&&!hs.some(h=>h.to.type==='inf'),'Archer aim escaped the archer/cavalry neighbourhood');out.arrowsAtArchers=summary(hs);

   // No adjacent rank means the whole volley stays aimed; an absent rank never makes a distant one adjacent.
   A=army(0,[group('arc',100)]);D=army(1,[group('gun',10000)]);const alone=raw(A,D,'arc');
   D=army(1,[group('gun',10000),group('cav',8)]);hs=raw(A,D,'arc');
   ok(hs.length===1&&hs[0].to.type==='gun','Empty archer rank allowed a jump from gunners to cavalry');near(hs[0].kills,alone[0].kills,'No-neighbour volley wasted its scatter budget');
   D=army(1,[group('inf',10000),group('cav',8)]);hs=raw(A,D,'arc');ok(hs.every(h=>h.to.type==='inf'),'Fallback infantry aim jumped a gap');
   D=army(1,[group('gun',10000),group('gun',10000)]);hs=raw(A,D,'arc');ok(!hs.some(h=>h.stray),'Same-line hero treated as adjacent scatter');near(hs[0].kills,alone[0].kills,'Same-line group stole aimed damage');
   A=army(0,[group('arc',400,10)]);D=army(1,[group('gun',1),group('gun',1),group('gun',1),group('arc',8),group('cav',8)]);hs=raw(A,D,'arc');
   ok(hs.filter(h=>h.to.type==='gun').length===3&&hs.some(h=>h.to.type==='arc')&&!hs.some(h=>h.to.type==='cav'),'Duplicate groups changed the volley footprint or imposed an old group cap');

   // Scatter can reach either neighbour while the primary formation is still alive.
   const neighbours=new Set();A=army(0,[group('arc',100)]);
   for(let seed=1;seed<=32;seed++){D=army(1,types.map(t=>group(t,10000)));hs=raw(A,D,'arc',seed);
    for(const h of hs)if(h.stray){ok(h.to.type==='inf'||h.to.type==='arc','Non-adjacent scatter beside gunners');neighbours.add(h.to.type);ok(hs[0].kills<10000,'Scatter requires wiping the primary line');}}
   ok(neighbours.size===2,'Scatter cannot choose both sides');

   // Every missing-formation combination, both sides, varied force and seeded volleys. Weighted expenditure
   // includes the existing 25% attenuation, so extra eligible targets cannot create extra attack power.
   for(let mask=1;mask<16;mask++)for(let side=0;side<2;side++)for(const phase of ['gun','arc'])for(const power of [1,5,100])for(let seed=1;seed<=8;seed++){
    const present=types.filter((t,i)=>mask&(1<<i));A=army(side,[group(phase,100,power)]);D=army(1-side,present.map(t=>group(t,20)));
    hs=raw(A,D,phase,seed);cases++;const spent=new Map(),aim=phase==='arc'?(present.includes('gun')?'gun':present.includes('arc')?'arc':present[0]):present[0];
    let last=-1,cost=0;
    for(const h of hs){ok(h.kills>0&&Number.isFinite(h.kills)&&h.infAt==null,'Invalid or infantry-timed ranged hit');
     spent.set(h.to,(spent.get(h.to)||0)+h.kills);ok(spent.get(h.to)<=h.to.troops+1e-8,'Duplicated casualties');
     if(phase==='gun'){ok(types.indexOf(h.to.type)>=last,'Gun spill out of order');last=types.indexOf(h.to.type);}
     else ok(Math.abs(types.indexOf(h.to.type)-types.indexOf(aim))<=1,'Arrow spill skipped a formation');
     const mult=phase==='gun'&&h.to.type==='inf'?1.2:1;cost+=h.kills*battleResistance(h.to)/mult/(h.stray?1:Math.pow(.75,h.depth));
    }
    const R=seeded(seed),budget=100*power*UNITS[phase].atk*.26*(.88+.24*R());ok(cost<=budget+1e-7,'Ranged spill created damage beyond its volley budget');
   }
   out.matrix={cases,bothSides:true,missingFormations:true,adjacentScatter:[...neighbours].sort(),boundedDamageBudget:true,finiteCasualties:true};

   // The infantry timing constants cannot alter volleys or opening countershots.
   const clock={...INF_CLOCK};A=army(0,[group('gun',400,3),group('arc',100)]);D=army(1,types.map(t=>group(t,8)));
   const gun=signature(raw(A,D,'gun')),arc=signature(raw(A,D,'arc'));INF_CLOCK.fight=.01;INF_CLOCK.advance=100;
   try{ok(signature(raw(A,D,'gun'))===gun&&signature(raw(A,D,'arc'))===arc,'Infantry timing changed ranged damage');
    A=army(0,[group('inf',400),group('gun',100),group('arc',100)]);D=army(1,[group('inf',400)]);raw(A,D,'gun');Math.random=seeded(33);const h1=signature(interceptHits('inf'));
    Object.assign(INF_CLOCK,clock);Math.random=seeded(33);ok(signature(interceptHits('inf'))===h1,'Infantry timing changed ranged countershots');
   }finally{Object.assign(INF_CLOCK,clock);Math.random=S.random;}
   A=army(0,[group('arc',400,100)]);D=army(1,types.map(t=>group(t,8)));hs=raw(A,D,'arc',71,true);ok(hs.length===2&&hs.every(h=>!h.stray),'Standing-wall archery changed');
   out.infantryClockIndependent=true;out.countershotsPreserved=true;out.siegeArcheryPreserved=true;BT=null;

   // Real mobile-sized playback: resolved ranged losses still land once, without marching to a rear line.
   const playback=[];
   for(const phase of ['gun','arc']){
    A=army(0,[group(phase,400,10)]);D=army(1,types.map(t=>group(t,8)));
    startBattle('ranged_check',{site:{id:'ranged_check',type:'dojo',clan:'ikki',x:1,y:1,power:100,reward:{}},pa:A,ea:D});
    BT.autoKi.on=false;BT.round=1;BT.state='run';BT.phase=phase==='gun'?0:1;BT.speed=2;Math.random=seeded(71);runPhase(phase);Math.random=S.random;
    const script=BT.script,hits=[...new Set(script.ev.filter(e=>e.k==='hit').map(e=>e.h))],expected=D.groups.map(g=>Math.max(0,g.troops-hits.filter(h=>h.to===g).reduce((n,h)=>n+h.kills,0)));
    ok(hits.every(h=>h.infAt==null)&&script.ev.some(e=>e.k==='shot'),'Ranged playback became infantry contact');
    let frames=0;while(script.i<script.ev.length&&frames++<600){updateBattle(1/30);if(frames%10===0)drawBattle();}
    ok(frames<600&&script.i===script.ev.length,'Ranged playback stalled');D.groups.forEach((g,i)=>near(g.troops,expected[i],'Playback damage differs from ranged ledger'));
    const before=D.groups.map(g=>g.troops);for(const h of hits)doEvent({k:'hit',h});D.groups.forEach((g,i)=>near(g.troops,before[i],'Repeated ranged event duplicated damage'));
    playback.push({phase,targets:hits.map(h=>h.to.type),frames,fps:30,speed:2,damageOnce:true,noInfantryTravel:true});closeBattle();
   }
   out.playback=playback;out.checks=checks;return out;
  }finally{if(BT)closeBattle();simRestore(S);}
 });
 assert.deepStrictEqual(errors,[]);fs.writeFileSync(path.join(root,'reports/ranged-spill.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
 }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
