// Functional equipment bonuses and an independent, saved Auto Duel preference.
const fs=require('fs'),http=require('http'),path=require('path'),assert=require('assert'),{chromium}=require('playwright');
const root=path.resolve(__dirname,'..');
(async()=>{
 const server=http.createServer((q,r)=>{r.setHeader('content-type','text/html');r.end(fs.readFileSync(process.env.CARRY_DOWNLOAD||path.join(root,'index.html')));});await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH||(fs.existsSync('/usr/bin/chromium')?'/usr/bin/chromium':undefined),args:['--no-sandbox']});
 try{
  const p=await browser.newPage({viewport:{width:430,height:932}}),errors=[];p.on('pageerror',e=>errors.push(e.message));await p.addInitScript(()=>{window.__noIntro=window.__noQuick=true;});await p.goto('http://127.0.0.1:'+server.address().port);
  const report=await p.evaluate(()=>{
   const S=simPrepare(),out={};let checks=0;const ok=(v,m)=>{checks++;if(!v)throw Error(m);},near=(a,b,m)=>ok(Math.abs(a-b)<1e-8,m);
   function fixture(){
    SH_PERF.diag=null;simFixture({id:'carry-duel',tier:2,count:6,porters:0},0xca770);G.buildings=[];G.roads.fill(0);G.bmap.fill(-1);G.tiles.fill('grass');
    for(const k in G.stock)G.stock[k]=0;G.wares={};G.trade={cs:[],offers:[],cd:0};for(const k in LAND)G.land[k]=true;
    for(const v of G.villagers){v.job=-1;v.home=-1;v.eq={weapon:null,armor:null,head:null,special:null,special2:null,mount:null};}
    resetRT();G.speed=0;const store=place('kura',2,6,true),shop=place('onigiri',8,6,true),work=place('workshop',12,6,true);
    for(let x=1;x<22;x++)G.roads[idx(x,8)]=1;invalidateRoadTraffic();economyTopology();economyJobs();
    const v=G.villagers[0],a=spawnAgent({kind:'villager',vid:v.id,look:vLook(v),speed:22});agentAtTile(a,5,8);return {store,shop,work,v,a};
   }
   function leg(a){const b=bByUid(a.target);for(let i=0;a.path.length&&i<6000;i++)stepAgent(a,1/30);ok(!a.path.length,'Haul stuck');return missionArrive(a,vById(a.vid),b);}
   try{
    let M=fixture();const excluded=new Set(['hawk','gyrfalcon','fox']),mounts={};
    for(const [id,I] of Object.entries(ITEMS))if(I.slot==='mount'){
     if(excluded.has(id)){ok(!I.carry,'Excluded companion gained carry: '+id);continue;}
     ok(I.carry>0&&I.carry<=1,'Missing or excessive mount carry: '+id);if(id!=='pony')ok(I.carry<ITEMS.pony.carry,'Pack Pony not best: '+id);
     M.v.eq.mount=id;near(vStats(M.v).carry,I.carry,'Mount bonus absent: '+id);ok(itemStat(id).includes('Carry+'+Math.round(I.carry*100)+'%'),'Wrong mount display: '+id);mounts[id]=I.carry*100;
    }
    near(ITEMS.pony.carry,1,'Pony not +100%');near(ITEMS.tenbin.carry,.8,'Pole not doubled');near(ITEMS.abacus.carry,.3,'Abacus carry not doubled');near(ITEMS.chisel.craft,.7,'Kit not doubled');near(ITEMS.abacus.craft,.3,'Abacus craft not doubled');
    M.v.eq.mount='pony';M.v.eq.special='tenbin';M.v.eq.special2='abacus';near(vStats(M.v).carry,2.1,'Carry gear failed to stack');
    ok(itemStat('tenbin').includes('Carry+80%')&&itemStat('chisel').includes('Craft+70%')&&itemStat('abacus').includes('Craft+30%'),'Work stat display stale');
    createGoods(economyCentral('rice'),'rice',50,'test-seed');economyJobs();SH_PERF.diag=simStageStats();diagInventory(SH_PERF.diag.opening);
    const source=planShopSupply(M.a,M.v);ok(source===M.store&&economyClaimOf(M.a)?.n===19,'Buffed worker did not reserve 19 goods');ok(walkTo(M.a,source),'Cannot reach pickup');leg(M.a);
    ok(M.a.carry?.n===19,'Buffed pickup wrong');leg(M.a);ok(shopStock(M.shop).rice===19&&G.stock.rice===31&&!M.a.carry,'Buffed delivery wrong');
    const d=SH_PERF.diag;diagInventory(d.ending);let residual=0;for(const k of new Set([...Object.keys(d.opening),...Object.keys(d.ending)]))residual+=Math.abs((d.ending[k]||0)-(d.opening[k]||0)-(d.created[k]||0)+(d.destroyed[k]||0));
    near(residual,0,'Inventory residual');ok(!diagNegatives(),'Negative inventory');SH_PERF.diag=null;
    out.carry={mountPercent:mounts,excluded:[...excluded],stacked:210,physicalWorkerDelivery:19,conservationResidual:residual};
    M=fixture();M.v.eq.special='chisel';M.v.eq.special2='abacus';near(vStats(M.v).craft,1,'Craft gear failed to stack');
    const boosted=craftCycleTime(M.work,M.v,5),kit=ITEMS.chisel.craft,abacus=ITEMS.abacus.craft;let previous;
    try{ITEMS.chisel.craft=.35;ITEMS.abacus.craft=.15;previous=craftCycleTime(M.work,M.v,5);}finally{ITEMS.chisel.craft=kit;ITEMS.abacus.craft=abacus;}
    ok(boosted<previous,'Double craft stats did not shorten cycle');
    createGoods(economyPoint(M.work,'inbox'),'rice',10,'test-seed');M.work.recipe='mochi';M.a.target=M.work.uid;
    ok(craftReserve(M.a,M.v,M.work,'mochi',5)?.n===5&&craftDone(M.work,M.v,'mochi',M.a)===5,'Buffed batch failed');
    ok(M.work.outs.mochi===5&&!M.work.inbox.rice&&craftDone(M.work,M.v,'mochi',M.a)===0,'Craft doubled output without ingredients');
    out.craft={kitPercent:70,abacusPercent:30,stackedPercent:100,oldBatchSeconds:previous,newBatchSeconds:boosted,fullRecipeCost:true,noDoubleCompletion:true};

    // Force actual eligible challenges, then inspect only the acceptance decision.
    newGame();G.tut=1;G.roll.v=false;G.allHands=false;G.troops.inf=80;G.villagers.forEach((v,i)=>{v.role=i<3?'inf':'work';if(i<3)v.eq.weapon='katana';});afterLoad();
    ok(!autoDuelOn()&&G.autoDuel===false,'New game auto-accepts');delete G.autoDuel;ok(!autoDuelOn(),'Legacy save auto-accepts');
    const P=PROVINCES.find(p=>p.type==='clan'&&!p.capital&&!p.boss);ok(startBattle(P.id),'Battle setup');
    const picker=openDuelPicker,duel=startDuel,random=Math.random;let picked=0,accepted=0;
    try{
     openDuelPicker=()=>{picked++;BT.state='duelpick';};startDuel=spec=>{ok(spec.pairs?.length>=1,'Bad auto pairing');accepted++;};Math.random=()=>.01;
     const challenge=(enabled,auto)=>{G.autoDuel=enabled;BT.auto=auto;BT.round=1;BT.duelRound=null;BT.state='run';return preDuel();};
     ok(challenge(false,true)&&picked===1&&accepted===0,'Auto Battle bypassed Off');ok(!preDuel()&&picked===1,'Repeated challenge in one round');
     ok(challenge(true,true)&&accepted===1&&picked===1,'On did not auto-accept');
     ok(challenge(true,false)&&picked===2&&accepted===1,'Manual battle auto-accepted');
     ok(challenge(false,false)&&picked===3&&accepted===1,'Manual Off broken');
     BT.A[0].mode='skirmish';BT.duelRound=null;ok(!preDuel(),'Skirmish gained duel');
    }finally{openDuelPicker=picker;startDuel=duel;Math.random=random;closeBattle();}
    out.duel={newAndLegacyDefaultOff:true,autoBattleOffAsks:true,onAccepts:true,manualBattleAlwaysAsks:true,oncePerRound:true,skirmishUnchanged:true};out.checks=checks;return out;
   }finally{SH_PERF.diag=null;if(BT)closeBattle();simRestore(S);}
  });
  await p.evaluate(()=>{newGame();$('#title').hidden=true;G.tut=1;G.speed=0;resizeView();afterLoad();MQ.length=0;$('#modal').hidden=true;});
  async function options(){await p.locator('#dock-in [data-p="menu"]').click();await p.locator('#sh-tabs button').filter({hasText:'Options'}).click();}
  await options();assert.equal(await p.locator('#o-autoduel').textContent(),'Auto Duel: Off');await p.locator('#o-autoduel').click();assert.equal(await p.locator('#o-autoduel').getAttribute('aria-pressed'),'true');
  if(process.env.CARRY_SCREENSHOT)await p.screenshot({path:process.env.CARRY_SCREENSHOT});
  await p.locator('#o-save').click();await p.reload();await p.locator('#t-cont').click();await options();assert.equal(await p.locator('#o-autoduel').textContent(),'Auto Duel: On');
  await p.locator('#o-autoduel').click();await p.locator('#o-save').click();await p.reload();await p.locator('#t-cont').click();await options();assert.equal(await p.locator('#o-autoduel').textContent(),'Auto Duel: Off');
  await p.evaluate(()=>{delete G.autoDuel;saveGame();});await p.reload();await p.locator('#t-cont').click();await options();assert.equal(await p.locator('#o-autoduel').textContent(),'Auto Duel: Off');
  assert(await p.evaluate(()=>G.v===1&&ITEMS.pony.carry===1&&ITEMS.chisel.craft===.7&&ITEMS.abacus.craft===.3));
  async function challenge(){return p.evaluate(()=>{closeSheet();if(BT)closeBattle();G.autoDuel=false;G.allHands=false;G.troops.inf=60;G.villagers.forEach((v,i)=>{v.role=i<3?'inf':'work';if(i<3)v.eq.weapon='katana';});
   const P=PROVINCES.find(p=>p.type==='clan'&&!p.capital&&!p.boss);if(!startBattle(P.id))throw Error('UI battle setup');BT.auto=true;BT.speed=0;BT.round=1;BT.duelRound=null;
   const R=Math.random;Math.random=()=>.01;try{return preDuel()&&BT.state==='duelpick';}finally{Math.random=R;}});}
  assert(await challenge());await p.locator('#dp-no').click();assert(await p.evaluate(()=>BT.state==='run'&&!BT.script&&BT.A[0].groups.some(g=>g.shock===1)));
  assert(await challenge());await p.locator('#dp-go').click();assert(await p.evaluate(()=>BT.state==='run'&&BT.phaseName==='duel'&&BT.script.ev.some(e=>e.k==='tdHit')));
  assert.deepStrictEqual(errors,[]);report.ui={menuToggle:true,onAndOffPersist:true,oldSaveDefaultOff:true,noCompoundingOnReload:true,realRefuseButton:true,realFightButton:true};
  fs.mkdirSync(path.join(root,'reports'),{recursive:true});fs.writeFileSync(path.join(root,'reports/carry-duel.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
 }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
