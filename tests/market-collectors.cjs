// Raw-retail policy, physical returns, paid weekly collection and interrupted cargo.
const fs=require('fs'),http=require('http'),path=require('path'),assert=require('assert'),{chromium}=require('playwright');
const root=path.resolve(__dirname,'..');
(async()=>{
 const server=http.createServer((q,r)=>{r.setHeader('content-type','text/html');r.end(fs.readFileSync(process.env.MARKET_DOWNLOAD||path.join(root,'index.html')));});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH||(fs.existsSync('/usr/bin/chromium')?'/usr/bin/chromium':undefined),args:['--no-sandbox']});
 try{
  const p=await browser.newPage({viewport:{width:430,height:932}}),errors=[];p.on('pageerror',e=>errors.push(e.message));
  await p.addInitScript(()=>{window.__noIntro=window.__noQuick=true;});await p.goto('http://127.0.0.1:'+server.address().port);
  const report=await p.evaluate(()=>{
   const S=simPrepare(),out={};let checks=0,peak=0,residual=0;
   const ok=(v,m)=>{checks++;if(!v)throw Error(m);};
   function fresh(){
    SH_PERF.diag=null;simFixture({id:'collectors',tier:3,count:6,porters:0},0xc011ec7);
    G.buildings=[];G.roads.fill(0);G.bmap.fill(-1);G.tiles.fill('grass');G.wares={};
    for(const k in G.stock)G.stock[k]=0;delete G.materialSales;
    G.trade={cs:[],offers:[],cd:0};G.villagers.forEach(v=>{v.job=-1;v.role='work';});
    resetRT();RT.t=0;RT.ready=false;RT._aw=null;G.speed=1;
   }
   const road=(x,y)=>{G.roads[idx(x,y)]=1;};
   const topology=()=>{invalidateRoadTraffic();economyState().dirty=true;economyTopology();economyJobs();};
   const set=(b,kind,k,n)=>createGoods(economyPoint(b,kind),k,n,'test-seed');
   const actor=(x,y,i=0)=>{const v=G.villagers[i],a=spawnAgent({kind:'villager',vid:v.id,look:vLook(v),speed:22});agentAtTile(a,x,y);return a;};
   const startLedger=()=>{SH_PERF.diag=simStageStats();diagInventory(SH_PERF.diag.opening);};
   function endLedger(){const d=SH_PERF.diag;diagInventory(d.ending);
    for(const k of new Set([...Object.keys(d.opening),...Object.keys(d.ending),...Object.keys(d.created),...Object.keys(d.destroyed)])){
     const r=(d.ending[k]||0)-(d.opening[k]||0)-(d.created[k]||0)+(d.destroyed[k]||0);residual+=Math.abs(r);ok(Math.abs(r)<1e-8,'Conservation '+k+': '+r);}
    ok(!diagNegatives(),'Negative inventory');SH_PERF.diag=null;
   }
   function market(){
    fresh();const store=place('kura',2,6,true),A=place('onigiri',8,6,true),B=place('noodle',12,6,true),craft=place('workshop',16,6,true);
    for(let x=1;x<=23;x++)road(x,8);topology();const a=actor(2,8);return {store,A,B,craft,a,v:G.villagers[0]};
   }
   function leg(a){
    const b=bByUid(a.target);ok(b,'Missing journey target');
    for(let n=0;a.path.length&&n<6000;n++)stepAgent(a,1/30);
    ok(!a.path.length,'Journey stuck');return missionArrive(a,vById(a.vid)||a,b);
   }
   function collectorsOnly(dt){
    economyTick(dt);
    for(let i=RT.agents.length-1;i>=0;i--){const a=RT.agents[i];if(a.kind==='collector')updateCollector(a,dt);if(a.dead)RT.agents.splice(i,1);}
    let n=0;for(const a of RT.agents)if(a.kind==='collector')n++;peak=Math.max(peak,n);ok(n<=8,'Collector population cap');
   }
   function drain(home){let n=0;while(home.collectorHire&&home.collectorHire.waves.length&&n++<8000)collectorsOnly(.1);ok(n<8000,'Collection wave stuck');}
   function fieldFixture(count=6){
    fresh();const fields=[],ids=['paddy','veggie','teafield','lumber','mine','silkhut'];
    for(let i=0;i<count;i++)fields.push(place(ids[i%6],1+i*3,6,true));
    const store=place('kura',1,10,true);for(let x=0;x<=Math.min(MAP_W-1,count*3+2);x++)road(x,8);road(0,9);road(0,10);topology();return {fields,store};
   }
   try{
    let M=market();set(G,'stock','rice',30);set(G,'stock','veg',30);set(M.A,'shelf','rice',6);set(M.B,'shelf','rice',3);set(M.B,'shelf','veg',3);set(M.A,'shelf','mochi',3);set(M.craft,'inbox','rice',10);
    ok(materialSalesAllowed('rice')&&shopRawSalesAllowed(M.A)&&shopRoom(M.A,'rice')===SHOP_CAP-6,'Old-save default changed');
    startLedger();setMaterialSales('rice',false);
    ok(!shopRoom(M.A,'rice')&&!shopRoom(M.B,'rice')&&!shopRoom(M.B,'veg'),'Disabled mixed raw recipe still restocks');
    ok(shopStock(M.A).rice===6&&!shopRawSalesAllowed(M.A),'Shelf stock teleported or policy ignored');
    const customer={wallet:1,prof:'farmer'};ok(sell(customer,M.A)>0&&shopStock(M.A).rice===6,'Crafted ware sales paused');
    destroyGoods(economyPoint(M.A,'shelf'),'mochi',10,'test-clear');ok(sell(customer,M.A)===0&&!economyCanSell(M.A),'Disabled raw stock sold');
    ok(M.craft.inbox.rice===10&&economyRoom(economyPoint(M.craft,'inbox'),'rice')>0,'Workshop inputs affected');
    const source=planShopSupply(M.a,M.v);ok(source===M.A||source===M.B,'Ordinary worker cannot return materials');
    const before=G.stock.rice;ok(walkTo(M.a,source),'Cannot walk to paused shelf');leg(M.a);ok(M.a.carry&&G.stock.rice===before,'Return has no physical pickup');leg(M.a);
    ok(G.stock.rice>before&&!M.a.carry,'Return did not reach storage');
    for(let i=0;i<economyState().jobCount;i++){const j=economyState().jobs[i];ok(!(j.to.kind==='shelf'&&!WARES[j.good]&&[M.A,M.B].includes(j.target)),'Raw restock job survived policy');}
    setMaterialSales(null,false);ok(Object.keys(GOODS).every(g=>!materialSalesAllowed(g)),'Master off');
    setMaterialSales(null,true);ok(!G.materialSales&&shopRoom(M.A,'rice')>0,'Master on');endLedger();

    // Toggle while a mixed, two-shop cart is already moving.
    M=market();const depot=place('porter',20,6,true);M.v.job=depot.uid;topology();set(G,'stock','rice',10);set(G,'wares','mochi',10);startLedger();
    economyStart(M.a,M.v,economyCentral('rice'),economyPoint(M.A,'shelf'),'rice',6,M.store,M.A);
    const c=economyClaimOf(M.a);ok(economyAddLine(c,economyCentral('mochi'),economyPoint(M.B,'shelf'),'mochi',4,M.B)===4,'Mixed claim setup');
    ok(walkTo(M.a,M.store),'Mixed pickup walk');leg(M.a);setMaterialSales('rice',false);ok(M.a.target===M.B.uid&&M.a.carry,'Toggle destroyed mixed cart');
    leg(M.a);if(M.a.carry)leg(M.a);
    ok(G.stock.rice===10&&shopStock(M.B,true).mochi===4&&!shopStock(M.A).rice&&!economyState().claims.size,'Mixed cargo lost, duplicated or delivered to disabled shop');endLedger();
    M=market();set(G,'stock','rice',10);economyStart(M.a,M.v,economyCentral('rice'),economyPoint(M.A,'shelf'),'rice',6,M.store,M.A);setMaterialSales('rice',false);
    ok(!economyClaimOf(M.a)&&!M.a.carry&&G.stock.rice===10,'Unpicked restock not cancelled');
    out.materials={defaultsPreserved:true,individualAndAll:true,craftedSalesUnaffected:true,mixedRecipesPaused:true,physicalReturns:true,mixedTripReroute:true};

    let F=fieldFixture();startLedger();const gold=G.gold,headcount=G.villagers.length,trav=G.stats.trav;
    ok(hireCollectors(F.store)&&G.gold===gold-500,'Hire price');ok(!hireCollectors(F.store)&&G.gold===gold-500,'Duplicate charge');
    economyTick(1);ok(!RT.agents.some(a=>a.kind==='collector'),'Collectors arrived before first week');
    const receipts={};
    for(let round=0;round<5;round++){
     for(const f of F.fields){const g=BUILDINGS[f.id].makes;set(f,round===0?'buffer':'pile',g,round+3);receipts[g]=(receipts[g]||0)+round+3;}
     if(round===0)weekTick();else collectorWeek();drain(F.store);
     for(const g in receipts)ok(G.stock[g]===receipts[g],'Weekly collection missing '+g);
    }
    ok(!F.store.collectorHire&&G.villagers.length===headcount&&G.stats.trav===trav,'Hire ended incorrectly or added customers/workers');
    set(F.fields[0],'pile','rice',5);collectorWeek();economyTick(1);ok(!RT.agents.some(a=>a.kind==='collector')&&F.fields[0].pile===5,'Sixth unpaid round');endLedger();
    out.weekly={price:500,rounds:5,goods:Object.keys(receipts),received:receipts,noExtraWorkersOrCustomers:true};

    F=fieldFixture(12);startLedger();for(const f of F.fields)set(f,'pile',BUILDINGS[f.id].makes,30);
    ok(hireCollectors(F.store),'Large hire');collectorWeek();economyTick(1);ok(RT.agents.filter(a=>a.kind==='collector').length===4,'Dispatch not staggered');
    economyTick(1);ok(RT.agents.filter(a=>a.kind==='collector').length===8,'Eight carriers not dispatched');
    const first=RT.agents.find(a=>a.kind==='collector'),claim=economyClaimOf(first),v=G.villagers[0],other=actor(0,8);
    ok(!economyClaim(other,claim.from,claim.to,claim.good,1,claim.source,claim.target),'Worker stole collector-reserved pile');
    economyTick(1);ok(economyClaimOf(first),'Collector mistaken for missing villager');
    drain(F.store);for(const g in GOODS)ok(G.stock[g]===60,'Large round missing '+g);endLedger();
    out.dispatch={peak,staggered:true,sharedReservations:true};

    F=fieldFixture(12);const second=place('kura',5,10,true);road(4,9);road(4,10);topology();startLedger();
    for(const f of F.fields)set(f,'pile',BUILDINGS[f.id].makes,10);
    ok(hireCollectors(F.store)&&hireCollectors(second),'Concurrent Storehouse hire');collectorWeek();economyTick(1);economyTick(1);economyBeforeSave();
    economyState().collectorAt=economyState().stores.indexOf(second);economyTick(1);
    let pending=0;for(const b of G.buildings)if(b.collectorHire)pending+=b.collectorHire.visits.length;
    ok(pending<=8,'Saved visits plus new jobs exceeded global intent cap');drain(F.store);drain(second);
    for(const g in GOODS)ok(G.stock[g]===20,'Concurrent hires duplicated or lost '+g);endLedger();
    out.dispatch.multipleStorehouses=true;out.dispatch.savedVisitCap=8;

    F=fieldFixture(1);set(F.fields[0],'pile','rice',3);hireCollectors(F.store);collectorWeek();
    const newField=place('paddy',5,6,true);topology();set(newField,'pile','rice',4);drain(F.store);
    ok(G.stock.rice===3&&newField.pile===4,'New field retroactively entered old round');collectorWeek();drain(F.store);
    ok(G.stock.rice===7,'New field missed next round');

    // Worker crossings are available to collectors, but building-only networks are not.
    fresh();const field=place('paddy',2,6,true),bridge=place('kura',7,6,true),home=place('kura',12,6,true);
    for(const x of [1,4,5,6,9,10,11,14])road(x,6);topology();set(field,'pile','rice',9);startLedger();
    ok(hireCollectors(home),'Crossing hire rejected');collectorWeek();drain(home);ok(G.stock.rice===9,'Collector cannot cross field/storehouse road links');endLedger();

    // Save recovery preserves loaded goods once; unpicked paid visits resume.
    F=fieldFixture(1);set(F.fields[0],'pile','rice',30);hireCollectors(F.store);collectorWeek();economyTick(1);startLedger();
    ok(F.store.collectorHire.visits.length===1,'No pending visit');economyBeforeSave();
    ok(!RT.agents.some(a=>a.kind==='collector')&&F.store.collectorHire.visits.length===1&&F.fields[0].pile===30,'Pre-pickup save consumed paid visit');
    let raw=JSON.stringify(G);G=JSON.parse(raw);resetRT();afterLoad();F.store=bByUid(F.store.uid);drain(F.store);
    ok(G.stock.rice===30,'Unpicked visit did not resume');endLedger();
    F=fieldFixture(1);set(F.fields[0],'pile','rice',30);hireCollectors(F.store);collectorWeek();economyTick(1);startLedger();
    const carrier=RT.agents.find(a=>a.kind==='collector');while(carrier.mission==='goodsPick')collectorsOnly(.1);
    ok(carrier.carry?.n===30&&carrier.carry.kind==='cart','Actual load or cart wrong');
    economyBeforeSave();economyBeforeSave();ok(G.stock.rice===30&&!F.store.collectorHire.visits.length,'Loaded save did not recover exactly once');
    raw=JSON.stringify(G);ok(!raw.includes('goodsClaim')&&!raw.includes('collectorVisit'),'Runtime claims or actors leaked into save');
    G=JSON.parse(raw);resetRT();afterLoad();F.store=bByUid(F.store.uid);drain(F.store);ok(G.stock.rice===30,'Reload duplicated recovered load');endLedger();

    for(const mode of ['source-before','source-loaded','home-loaded','road-loaded']){
     F=fieldFixture(1);set(F.fields[0],'pile','rice',12);hireCollectors(F.store);collectorWeek();economyTick(1);startLedger();
     const a=RT.agents.find(q=>q.kind==='collector');if(mode!=='source-before')while(a.mission==='goodsPick')collectorsOnly(.1);
     if(mode==='source-before'||mode==='source-loaded')removeBuilding(F.fields[0]);
     else if(mode==='home-loaded')removeBuilding(F.store);
     else {G.roads.fill(0);topology();}
     for(let i=0;i<2000&&RT.agents.some(q=>q.kind==='collector');i++)collectorsOnly(.1);
     ok(G.stock.rice===12&&!RT.agents.some(q=>q.kind==='collector')&&!economyState().claims.size,'Interrupted cargo '+mode);endLedger();
    }
    out.recovery={prePickupSave:true,loadedSaveExactlyOnce:true,sourceDemolition:true,storeDemolition:true,roadDemolition:true,crossings:true};

    // Five rounds can queue while roads are cut, then resume without permanent NPCs.
    F=fieldFixture(1);set(F.fields[0],'pile','rice',3);hireCollectors(F.store);G.roads.fill(0);topology();
    for(let i=0;i<8;i++)collectorWeek();economyTick(1);ok(F.store.collectorHire.waves.length===5&&!F.store.collectorHire.left,'Unbounded weekly queue');
    for(let x=0;x<7;x++)road(x,8);road(0,9);road(0,10);topology();drain(F.store);ok(!F.store.collectorHire&&G.stock.rice===3,'Disconnected paid hire never recovered');
    G.gold=499;ok(!hireCollectors(F.store)&&G.gold===499,'Hire accepted insufficient gold');
    out.checks=checks;out.conservationResidual=residual;out.negativeStock=diagNegatives();out.cacheSizes=perfCacheSizes();return out;
   }finally{SH_PERF.diag=null;simRestore(S);}
  });
  // Real panels, real localStorage save and reload, outside the isolated sim.
  await p.evaluate(()=>{newGame();$('#title').hidden=true;G.tut=1;G.speed=0;G.gold=1500;RT.paused=true;afterLoad();openBuildingInfo(G.buildings.find(b=>b.id==='hall'));});
  await p.locator('[data-material="rice"]').click();assert.equal(await p.locator('[data-material="rice"]').getAttribute('aria-pressed'),'false');
  await p.locator('[data-material-all]').click();await p.locator('[data-material-all]').click();
  assert(await p.evaluate(()=>Object.keys(GOODS).every(g=>!materialSalesAllowed(g))));
  if(process.env.MARKET_HALL_SCREENSHOT){await p.locator('[data-material="silk"]').scrollIntoViewIfNeeded();await p.screenshot({path:process.env.MARKET_HALL_SCREENSHOT});}
  const storeUid=await p.evaluate(()=>{
   closeSheet();let b;
   for(let y=1;y<MAP_H-2&&!b;y++)for(let x=1;x<MAP_W-2;x++)if(!canPlace('kura',x,y)&&entranceOf({id:'kura',x,y})){b=place('kura',x,y,true);break;}
   if(!b)throw Error('No connected storehouse placement');economyState().dirty=true;openBuildingInfo(b);return b.uid;
  });
  await p.locator('[data-hire-collectors]').click();assert.equal(await p.locator('[data-hire-collectors]').isDisabled(),true);
  assert(await p.evaluate(()=>G.gold===1000&&saveGame()));await p.reload();await p.locator('#t-cont').click();
  assert(await p.evaluate(uid=>Object.keys(GOODS).every(g=>!materialSalesAllowed(g))&&bByUid(uid).collectorHire.left===5,storeUid));
  await p.evaluate(uid=>{G.speed=0;openBuildingInfo(bByUid(uid));},storeUid);
  if(process.env.MARKET_SCREENSHOT){await p.locator('[data-hire-collectors]').scrollIntoViewIfNeeded();await p.screenshot({path:process.env.MARKET_SCREENSHOT});}
  assert.deepStrictEqual(errors,[]);report.ui={individualToggle:true,masterToggle:true,hireButton:true,chargedOnce:true,saveReload:true};
  fs.mkdirSync(path.join(root,'reports'),{recursive:true});fs.writeFileSync(path.join(root,'reports/market-collectors.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
 }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
