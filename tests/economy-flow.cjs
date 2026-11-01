// Worker crossings, bounded craft batches and destination-specific two-shop cargo.
const fs=require('fs'),http=require('http'),path=require('path'),assert=require('assert'),{chromium}=require('playwright');
const root=path.resolve(__dirname,'..');
(async()=>{
 const server=http.createServer((q,r)=>{r.setHeader('content-type','text/html');r.end(fs.readFileSync(q.url.startsWith('/baseline')&&process.env.FLOW_BASELINE_SOURCE?process.env.FLOW_BASELINE_SOURCE:path.join(root,'index.html')));});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH||(fs.existsSync('/usr/bin/chromium')?'/usr/bin/chromium':undefined),args:['--no-sandbox']});
 try{
  const p=await browser.newPage({viewport:{width:390,height:844}}),errors=[];p.on('pageerror',e=>errors.push(e.message));
  await p.addInitScript(()=>{window.__noIntro=window.__noQuick=true;});await p.goto('http://127.0.0.1:'+server.address().port);
  const report=await p.evaluate(()=>{
   const ok=(v,m)=>{if(!v)throw Error(m);},out={};
   const S=simPrepare();
   function fresh(){
    SH_PERF.diag=null;
    simFixture({id:'flow',tier:2,count:6,porters:0},0x7711);
    G.buildings=[];G.roads.fill(0);G.bmap.fill(-1);G.tiles.fill('grass');G.wares={};
    for(const k in G.stock)G.stock[k]=0;
    G.trade={cs:[],offers:[],cd:0};G.villagers.forEach(v=>{v.job=-1;v.role='work';});
    resetRT();RT.t=0;RT.ready=false;RT._aw=null;G.speed=1;
   }
   const road=(x,y)=>{G.roads[idx(x,y)]=1;invalidateRoadTraffic();};
   const actor=(x,y,i=0)=>{const v=G.villagers[i],a=spawnAgent({kind:'villager',vid:v.id,look:vLook(v),speed:22});agentAtTile(a,x,y);return a;};
   const topology=()=>{economyState().dirty=true;economyTopology();economyJobs();};
   const set=(b,kind,k,n)=>createGoods(economyPoint(b,kind),k,n,'test-seed');
   const sum=k=>diagInventory({})[k]||0;
   try{
    // Road -> multi-tile field -> road -> store -> road -> workshop -> road.
    fresh();const f=place('paddy',2,6,true),s=place('kura',7,6,true),w=place('workshop',12,6,true);
    for(const x of [1,4,5,6,9,10,11,14])road(x,6);topology();
    const route=roadPath(1,6,14,6,true,true);
    ok(route&&route.some(t=>t[0]===2)&&route.some(t=>t[0]===7)&&route.some(t=>t[0]===12),'Footprint crossings missing');
    ok(!roadPath(1,6,14,6),'Visitors crossed a building');
    ok(economyConnected(f,w),'Worker components disagree with crossing paths');
    const a=actor(1,6);ok(walkTo(a,w),'Worker cannot reach workshop');
    const beforeRevision=ROAD_TRAFFIC.revision;removeBuilding(s);
    ok(ROAD_TRAFFIC.revision>beforeRevision&&!roadPath(1,6,14,6,true,true),'Demolition left stale crossing');
    stepAgent(a,.1);ok(a.state==='idle'&&!a.path.length,'Stale worker path survives demolition');
    fresh();place('paddy',2,6,true);place('workshop',4,6,true);road(1,6);road(6,6);
    ok(!roadPath(1,6,6,6,true,true),'Building-only road network allowed');
    fresh();place('hut',2,6,true);road(1,6);road(4,6);
    ok(!roadPath(1,6,4,6,true,true),'House was passable');
    fresh();for(let x=2;x<=18;x++){road(x,10);road(x,11);}
    const east=roadPath(2,11,18,11,true,true),west=roadPath(18,10,2,10,true,true);
    ok(east.filter(t=>t[1]===10).length>=12&&west.filter(t=>t[1]===11).length>=12,'Keep-left lanes regressed');
    ok(JSON.stringify(east)===JSON.stringify(roadPath(2,11,18,11)),'Worker road routing differs without crossings');
    fresh();for(let x=2;x<=18;x++)road(x,10);
    ok(JSON.stringify(roadPath(2,10,18,10,true,true))===JSON.stringify(roadPathLegacy(2,10,18,10)),'One-tile route changed');
    fresh();const edgeStore=place('kura',2,6,true),edgeShop=place('onigiri',8,6,true);
    for(let x=1;x<=7;x++)road(x,6);road(8,8);topology();const edgeActor=actor(1,6);
    ok(entranceOf(edgeShop)[1]===8&&walkTo(edgeActor,edgeShop)&&edgeActor.entryTile[0]===7,'Unreachable default entrance hides reachable side entrance');
    set(G,'stock','rice',2);ok(economyClaim(edgeActor,economyCentral('rice'),economyPoint(edgeShop,'shelf'),'rice',1,edgeStore,edgeShop),'Side-entrance delivery rejected');
    out.navigation={chain:true,multiTile:true,noBuildingChains:true,opaqueObstacles:true,demolitionRepath:true,leftHandTraffic:true,oneTileUnchanged:true};

    function craftFixture(){
     fresh();const site=place('workshop',4,6,true),store=place('kura',8,6,true),shop=place('onigiri',12,6,true);
     for(let x=1;x<=18;x++)road(x,8);site.recipe='mochi';topology();
     const a=actor(5,8,0),b=actor(6,8,1);a.target=b.target=site.uid;
     return {site,store,shop,a,b};
    }
    const ledgerStart=()=>{SH_PERF.diag=simStageStats();diagInventory(SH_PERF.diag.opening);};
    let residual=0;
    const ledgerEnd=()=>{const d=SH_PERF.diag;diagInventory(d.ending);for(const k of new Set([...Object.keys(d.opening),...Object.keys(d.ending),...Object.keys(d.created),...Object.keys(d.destroyed)])){
     const r=(d.ending[k]||0)-(d.opening[k]||0)-(d.created[k]||0)+(d.destroyed[k]||0);residual+=Math.abs(r);ok(Math.abs(r)<1e-8,'Conservation residual '+k+': '+r);}
     ok(!diagNegatives(),'Negative inventory');SH_PERF.diag=null;};
    let C=craftFixture();set(C.site,'inbox','rice',10);ledgerStart();
    const planned=chooseCraft(C.site);ok(planned&&planned.w==='mochi'&&planned.n===5,'10 Rice did not plan 5 Mochi');
    ok(craftReserve(C.a,G.villagers[0],C.site,'mochi',5)?.n===5,'Batch reservation failed');
    ok(!craftReserve(C.b,G.villagers[1],C.site,'mochi',5),'Two workers reserved the same rice');
    ok(craftDone(C.site,G.villagers[0],'mochi',C.a)===5,'Wrong batch yield');
    ok(!C.site.inbox.rice&&C.site.outs.mochi===5,'Recipe ratio was not 10 -> 5');
    ok(craftDone(C.site,G.villagers[0],'mochi',C.a)===0&&C.site.outs.mochi===5,'Duplicate completion produced goods');ledgerEnd();

    C=craftFixture();set(C.site,'inbox','rice',24);set(C.site,'outs','mochi',OUT_CAP-2);ledgerStart();
    // Contract demand allows filling the last two output slots, even with stock waiting.
    G.trade.cs=[{items:[{k:'mochi',qty:OUT_CAP}]}];
    ok(craftReserve(C.a,G.villagers[0],C.site,'mochi',5)?.n===2,'Output space not reserved');
    ok(!craftReserve(C.b,G.villagers[1],C.site,'mochi',5),'Concurrent output overbooking');
    ok(craftDone(C.site,G.villagers[0],'mochi',C.a)===2&&outTotal(C.site)===OUT_CAP&&C.site.inbox.rice===20,'Full-output accounting wrong');ledgerEnd();

    C=craftFixture();set(C.site,'inbox','rice',10);ledgerStart();craftReserve(C.a,G.villagers[0],C.site,'mochi',5);
    set(C.shop,'shelf','mochi',SHOP_CAP);ok(craftDone(C.site,G.villagers[0],'mochi',C.a)===0&&C.site.inbox.rice===10,'Demand vanished but ingredients consumed');
    ok(!chooseCraft(C.site)&&!wantsGood(C.site,'rice'),'Full market caused overproduction or pointless restocking');ledgerEnd();

    C=craftFixture();set(C.site,'inbox','rice',10);ledgerStart();craftReserve(C.a,G.villagers[0],C.site,'mochi',5);
    destroyGoods(economyPoint(C.site,'inbox'),'rice',6,'test-damage');
    ok(craftDone(C.site,G.villagers[0],'mochi',C.a)===2&&!C.site.inbox.rice,'Ingredient shortage caused waste or negative stock');ledgerEnd();

    C=craftFixture();set(C.site,'inbox','rice',10);set(C.site,'inbox','veg',10);
    G.trade.cs=[{items:[{k:'bento',qty:3}]}];ok(chooseCraft(C.site)?.w==='bento','Contract did not outrank preference');
    G.trade.cs=[];const pickle=place('pickle',16,6,true);topology();set(C.shop,'shelf','mochi',5);
    ok(chooseCraft(C.site)?.w==='pickles','Empty shop did not outrank preference');
    set(pickle,'shelf','pickles',5);ok(chooseCraft(C.site)?.w==='mochi','Preferred useful recipe not favoured');
    C.site.recipe='matcha';ok(chooseCraft(C.site)?.w!=='matcha'&&chooseCraft(C.site),'Preference became a strict lock');
    C=craftFixture();set(G,'wares','mochi',8);G.trade.cs=[{items:[{k:'mochi',qty:4}]}];
    ok(craftShopNeed(C.site,'mochi')===SHOP_CAP,'Contract reserve included in retail supply');
    G.trade.cs=[];ok(craftShopNeed(C.site,'mochi')===SHOP_CAP-8,'Contract cancellation left stale cached demand');
    const one=craftCycleTime(C.site,G.villagers[0],1),five=craftCycleTime(C.site,G.villagers[0],5);
    ok(five>one&&five<one*5,'Batch time is not moderately longer and more efficient');
    const craftItem=Object.keys(ITEMS).find(k=>(ITEMS[k].craft||0)>0),v=G.villagers[0];v.eq[ITEMS[craftItem].slot]=craftItem;
    ok(craftCycleTime(C.site,v,5)<five,'Fine Craft bonus lost');

    C=craftFixture();set(C.site,'inbox','rice',10);ledgerStart();craftReserve(C.a,G.villagers[0],C.site,'mochi',5);
    C.a.state='work';C.a.target=C.site.uid;economyBeforeSave();
    ok(!economyState().crafting.size&&C.site.inbox.rice===10&&C.a.state==='idle','Saving lost ingredients or left pending production');
    const json=JSON.stringify(G);ok(!json.includes('craftBatch')&&!json.includes('goodsClaim'),'Runtime plans entered save');
    G=JSON.parse(json);resetRT();afterLoad();ok(G.v===1&&G.buildings.find(b=>b.uid===C.site.uid).inbox.rice===10,'Craft save/load lost goods');ledgerEnd();
    C=craftFixture();set(C.site,'inbox','rice',10);ledgerStart();craftReserve(C.a,G.villagers[0],C.site,'mochi',5);
    C.a.dead=true;economyTick(1);ok(!economyState().crafting.size&&C.site.inbox.rice===10,'Gone artisan kept ingredient reservation');ledgerEnd();
    C=craftFixture();set(C.site,'inbox','rice',10);ledgerStart();craftReserve(C.a,G.villagers[0],C.site,'mochi',5);
    removeBuilding(C.site);ok(!economyState().crafting.size&&G.stock.rice===10,'Workshop demolition lost reserved inputs');ledgerEnd();
    C=craftFixture();removeBuilding(C.shop);topology();G.trade.cs=[{items:[{k:'mochi',qty:2}]}];set(C.site,'inbox','rice',8);ledgerStart();
    ok(workerPlan(C.a,G.villagers[0],C.site)===C.site&&C.a.mission==='craft','Contract-only batch not planned');
    arrive(C.a,G.villagers[0],C.site);for(let i=0;C.a.state==='work'&&i<3000;i++)updateVillagerAgent(C.a,1/30);
    ok(C.site.outs.mochi===4,'Contract batch did not complete');
    const pickup=workerPlan(C.a,G.villagers[0],C.site);ok(pickup===C.site&&C.a.mission==='goodsPick','Artisan cannot haul contract goods without a retail shop');
    ok(walkTo(C.a,pickup),'Cannot return to contract pickup');finishLeg(C.a);finishLeg(C.a);
    ok(G.wares.mochi===4&&!outTotal(C.site)&&!C.a.carry,'Contract batch never reached central storage');ledgerEnd();
    out.crafting={rice10ToMochi5:true,maxBatch:5,inputAndOutputReservations:true,noDuplicateCompletion:true,fullMarketPauses:true,shortageScalesSafely:true,contractFirst:true,contractOnlyDelivery:true,shopShortageNext:true,softPreference:true,fineCraftKept:true,batchTimeRatio:five/one,saveLoad:true};

    function tripFixture(far=false){
     fresh();const store=place('kura',4,6,true),A=place('onigiri',10,6,true),B=place('noodle',14,far?17:6,true),depot=place('porter',1,10,true);
     for(let x=1;x<=28;x++)road(x,8);road(1,9);
     if(far){for(let y=9;y<=19;y++)road(3,y);for(let x=3;x<=15;x++)road(x,19);}
     G.villagers[0].job=G.villagers[1].job=depot.uid;topology();
     const a=actor(4,8,0),b=actor(5,8,1);return {store,A,B,a,b,v:G.villagers[0]};
    }
    const jobsClear=()=>{economyState().jobCount=0;};
    function twoStop(T){
     jobsClear();const mochi=economyCentral('mochi'),bento=economyCentral('bento');
     economyJob(bento,economyPoint(T.A,'shelf'),'bento',4,7,T.store,T.A);
     economyJob(mochi,economyPoint(T.B,'shelf'),'mochi',4,13,T.store,T.B);
     economyJob(bento,economyPoint(T.B,'shelf'),'bento',6,13,T.store,T.B);
     ok(economyStart(T.a,T.v,mochi,economyPoint(T.A,'shelf'),'mochi',6,T.store,T.A),'Could not plan first stop');
     economyBundle(T.a);const c=economyClaimOf(T.a);ok(c.second===T.B,'Nearby second shop not combined');return c;
    }
    function finishLeg(a){
     const target=bByUid(a.target);ok(target,'Trip target gone');
     for(let n=0;a.path.length&&n<3000;n++)stepAgent(a,1/30);
     ok(!a.path.length,'Delivery walk never finished');arrive(a,vById(a.vid),target);
    }
    let T=tripFixture();set(G,'wares','mochi',60);set(G,'wares','bento',20);ledgerStart();
    let claim=twoStop(T);ok(claim.detour<=claim.detourLimit,'Accepted detour outside budget');
    // the trip reserves 10 of the second shop's ware shelf (4 mochi + 6 bento): another worker may claim only the rest
    {const c2=economyClaim(T.b,economyCentral('mochi'),economyPoint(T.B,'shelf'),'mochi',SHOP_CAP,T.store,T.B);ok(c2&&c2.n===SHOP_CAP-10,'Second worker stole reserved shelf space');economyRelease(T.b);}
    arrive(T.a,T.v,T.store);ok(T.a.carry.n+economyFreightTotal(T.a)===20,'Mixed pickup count wrong');
    finishLeg(T.a);ok(shopStock(T.A,true).mochi===6&&shopStock(T.A,true).bento===4,'First shop got wrong goods');
    ok(T.a.carry.n+economyFreightTotal(T.a)===10&&T.a.carry.kind==='cart'&&T.a.target===T.B.uid&&economyClaimOf(T.a),'Second-stop goods discarded or cart lost at first stop');
    finishLeg(T.a);ok(shopStock(T.B,true).mochi===4&&shopStock(T.B,true).bento===6&&!T.a.carry&&!economyFreightTotal(T.a),'Second stop missing or duplicate');
    ok(!economyState().claims.size,'Completed trip kept claims');ledgerEnd();

    T=tripFixture();set(G,'wares','mochi',30);set(G,'stock','rice',30);ledgerStart();jobsClear();
    economyStart(T.a,T.v,economyCentral('mochi'),economyPoint(T.A,'shelf'),'mochi',10,T.store,T.A);
    economyJob(economyCentral('rice'),economyPoint(T.A,'shelf'),'rice',10,10,T.store,T.A);
    economyJob(economyCentral('mochi'),economyPoint(T.B,'shelf'),'mochi',10,13,T.store,T.B);
    economyJob(economyCentral('rice'),economyPoint(T.B,'shelf'),'rice',5,10,T.store,T.B);
    economyBundle(T.a);claim=economyClaimOf(T.a);arrive(T.a,T.v,T.store);
    ok(T.a.carry.n+economyFreightTotal(T.a)===31,'Porter load is not bounded at 31');finishLeg(T.a);finishLeg(T.a);ledgerEnd();

    T=tripFixture(true);set(G,'wares','mochi',30);jobsClear();
    economyStart(T.a,T.v,economyCentral('mochi'),economyPoint(T.A,'shelf'),'mochi',6,T.store,T.A);
    economyJob(economyCentral('mochi'),economyPoint(T.B,'shelf'),'mochi',6,13,T.store,T.B);economyBundle(T.a);
    ok(!economyClaimOf(T.a).second,'Long detour accepted');
    arrive(T.a,T.v,T.store);finishLeg(T.a);ok(shopStock(T.A,true).mochi===6&&!T.a.carry,'Single-stop fallback failed');

    T=tripFixture();const other=place('kura',22,6,true);topology();set(G,'wares','mochi',30);jobsClear();
    economyStart(T.a,T.v,economyCentral('mochi'),economyPoint(T.A,'shelf'),'mochi',6,T.store,T.A);
    economyJob(economyCentral('mochi'),economyPoint(T.B,'shelf'),'mochi',6,13,other,T.B);economyBundle(T.a);
    ok(!economyClaimOf(T.a).second,'Combined different pickup sources');

    T=tripFixture();const urgent=place('onigiri',18,6,true);topology();set(G,'wares','mochi',40);set(T.B,'shelf','mochi',5);jobsClear();
    economyStart(T.a,T.v,economyCentral('mochi'),economyPoint(T.A,'shelf'),'mochi',6,T.store,T.A);
    economyJob(economyCentral('mochi'),economyPoint(T.B,'shelf'),'mochi',5,7,T.store,T.B);
    economyJob(economyCentral('mochi'),economyPoint(urgent,'shelf'),'mochi',6,13,T.store,urgent);economyBundle(T.a);
    ok(economyClaimOf(T.a).second===urgent,'Urgent shortage lost to nearer stocked shop');

    T=tripFixture();set(G,'wares','mochi',20);set(G,'wares','bento',20);ledgerStart();twoStop(T);arrive(T.a,T.v,T.store);
    removeBuilding(T.A);ok(T.a.target===T.B.uid&&T.a.carry,'First-shop demolition cancelled surviving second stop');
    finishLeg(T.a);ok(shopStock(T.B,true).mochi===4&&shopStock(T.B,true).bento===6,'Second stop after demolition wrong');
    if(T.a.mission==='shopReturn')finishLeg(T.a);ok(!T.a.carry&&!economyFreightTotal(T.a),'Undeliverable goods never returned');ledgerEnd();

    T=tripFixture();set(G,'wares','mochi',20);set(G,'wares','bento',20);ledgerStart();twoStop(T);
    removeBuilding(T.A);arrive(T.a,T.v,T.store);ok(T.a.target===T.B.uid,'First-shop demolition before pickup blocked second stop');
    finishLeg(T.a);ok(shopTotal(T.B,true)===10&&!T.a.carry,'Cancelled first-stop cargo was still picked up');ledgerEnd();

    T=tripFixture();set(G,'wares','mochi',20);set(G,'wares','bento',20);ledgerStart();twoStop(T);arrive(T.a,T.v,T.store);
    removeBuilding(T.store);ok(economyClaimOf(T.a)&&T.a.carry,'Loaded trip discarded after pickup-source demolition');
    finishLeg(T.a);finishLeg(T.a);ok(shopTotal(T.A,true)===10&&shopTotal(T.B,true)===10,'Loaded trip could not finish without its origin');ledgerEnd();

    T=tripFixture();set(G,'wares','mochi',20);set(G,'wares','bento',20);ledgerStart();twoStop(T);arrive(T.a,T.v,T.store);finishLeg(T.a);
    removeBuilding(T.B);ok(!T.a.carry&&!economyFreightTotal(T.a)&&!T.a.goodsClaim,'Second-shop demolition lost cargo recovery');ledgerEnd();

    T=tripFixture();set(G,'wares','mochi',20);set(G,'wares','bento',20);ledgerStart();twoStop(T);arrive(T.a,T.v,T.store);
    set(T.A,'shelf','mochi',SHOP_CAP);finishLeg(T.a);ok(shopTotal(T.A,true)===SHOP_CAP,'Full shop overflowed');finishLeg(T.a);
    ok(shopStock(T.B,true).mochi===4&&shopStock(T.B,true).bento===6,'Full first shop stole second-shop cargo');
    if(T.a.mission==='shopReturn')finishLeg(T.a);ok(!T.a.carry&&!economyFreightTotal(T.a),'Full-shop remainder not returned');ledgerEnd();

    T=tripFixture();set(G,'wares','mochi',20);set(G,'wares','bento',20);ledgerStart();twoStop(T);arrive(T.a,T.v,T.store);finishLeg(T.a);
    const inventory=diagInventory({});economyBeforeSave();const saved=JSON.stringify(G);G=JSON.parse(saved);resetRT();afterLoad();
    const loaded=diagInventory({});for(const k in inventory)ok(inventory[k]===loaded[k],'Mid-trip save lost '+k);
    ok(G.v===1&&!economyState().claims.size&&!RT.agents.some(a=>a.carry||economyFreightTotal(a)),'Transit state leaked through save');ledgerEnd();
    T=tripFixture();set(G,'wares','mochi',20);set(G,'wares','bento',20);ledgerStart();twoStop(T);arrive(T.a,T.v,T.store);T.a.dead=true;
    economyTick(1);ok(!T.a.carry&&!economyFreightTotal(T.a)&&!economyState().claims.size,'Gone porter left goods or claims behind');ledgerEnd();
    // Nearer shop first: the claimed shop is the far one, the second shop sits on the way. The porter serves the near
    // shop first and walks no further than straight to the far one (the old order doubled back and was charged 4 tiles).
    T=tripFixture();set(G,'wares','mochi',20);set(G,'wares','bento',20);ledgerStart();jobsClear();
    economyJob(economyCentral('bento'),economyPoint(T.A,'shelf'),'bento',5,13,T.store,T.A);
    ok(economyStart(T.a,T.v,economyCentral('mochi'),economyPoint(T.B,'shelf'),'mochi',6,T.store,T.B),'Could not plan far stop');
    economyBundle(T.a);claim=economyClaimOf(T.a);ok(claim.second===T.A&&claim.secondFirst,'On-the-way shop not taken first');
    ok(claim.detour===0&&claim.walked===claim.directDistance,'On-the-way shop still costs a detour: '+claim.detour);
    arrive(T.a,T.v,T.store);ok(T.a.target===T.A.uid,'Porter heads to the far shop first');finishLeg(T.a);
    ok(shopStock(T.A,true).bento===5&&T.a.target===T.B.uid,'Near shop not served first');finishLeg(T.a);
    ok(shopStock(T.B,true).mochi===6&&!T.a.carry&&!economyFreightTotal(T.a)&&!economyState().claims.size,'Far shop missed after the near one');ledgerEnd();
    out.nearestFirst={walked:claim.walked,direct:claim.directDistance,claimedShopFirstWalk:claim.directDistance+(()=>{const be=entranceOf(T.B),ae=entranceOf(T.A);return roadDistances(idx(be[0],be[1]),true)[idx(ae[0],ae[1])];})()};
    out.porters={twoShops:true,mixedWares:true,sameGoodSplit:true,capacity:31,sharedPickupOnly:true,detourBounded:true,urgentSecondStop:true,concurrentClaims:true,singleStopFallback:true,demolition:true,fullShopRecovery:true,midTripSaveLoad:true};

    // Real 30-fps worker plans and deliveries through the exact crossing chain.
    fresh();const field=place('paddy',2,6,true),store=place('kura',7,6,true),work=place('workshop',12,6,true),market=place('onigiri',17,6,true),depot=place('porter',0,8,true);
    for(const x of [1,4,5,6,9,10,11,14,15,16])road(x,6);road(1,7);work.recipe='mochi';
    const home=place('longhouse',4,9,true);road(4,7);road(4,8);G.villagers.forEach(v=>v.home=home.uid);
    G.villagers[0].job=field.uid;G.villagers[1].job=work.uid;G.villagers[2].job=depot.uid;topology();
    actor(1,6,0);actor(1,6,1);actor(1,7,2);ledgerStart();let crafted=0,question=null;
    for(let i=0;i<5400;i++){RT.t+=1/30;economyTick(1/30);updateAgents(1/30);crafted=SH_PERF.diag.created.mochi||0;
     for(const a of RT.agents)if(a.bubble&&a.bubble.icon==='?'&&!question)question={x:a.x,y:a.y,state:a.state,mission:a.mission,target:a.target,en:vById(a.vid).en};}
    ok(crafted>0,'Creative layout never crafted or delivered useful wares');ok(!question,'Reachable workers showed stuck question marks: '+JSON.stringify(question));
    ok(economyState().claims.size<=128&&economyState().crafting.size<=128,'Unbounded runtime plans');ledgerEnd();
    out.creativeLayout={seconds:180,dt:1/30,mochiCrafted:crafted,noStuckQuestions:true};

    out.conservationResidual=residual;out.errors=[];return out;
   }finally{simRestore(S);}
  });
  assert.deepStrictEqual(errors,[]);
  if(process.env.FLOW_BASELINE_SOURCE){
   async function profile(route,seed){
    const q=await browser.newPage({viewport:{width:430,height:900}});await q.addInitScript(()=>{window.__noIntro=window.__noQuick=true;});
    await q.goto('http://127.0.0.1:'+server.address().port+route);
    const rows=await q.evaluate(seed=>{
     const S=simPrepare(),rows=[];
     try{
      simFixture({id:'perf',tier:2,count:14,porters:2},seed);G.speed=1;RT.paused=false;
      for(let i=0;i<28;i++)spawnTraveller();
      for(let i=0;i<720;i++){updateVillage(1/30);if(i%60===0)drawVillage();}
      SH_PERF.diag=simStageStats();diagInventory(SH_PERF.diag.opening);
      const start=performance.now();
      for(let i=0;i<3600;i++){updateVillage(1/30);if(i%60===0){while(RT.agents.length<40)spawnTraveller();drawVillage();}}
      const ms=performance.now()-start,d=SH_PERF.diag;diagInventory(d.ending);let residual=0;
      for(const k of new Set([...Object.keys(d.opening),...Object.keys(d.ending),...Object.keys(d.created),...Object.keys(d.destroyed)]))residual+=Math.abs((d.ending[k]||0)-(d.opening[k]||0)-(d.created[k]||0)+(d.destroyed[k]||0));
      const C=ROAD_TRAFFIC,E=economyState(),serialize=performance.now(),save=JSON.stringify(G),saveMs=performance.now()-serialize;
      rows.push({seed,msPerWeek:ms/(120/WEEK_SEC),agents:RT.agents.length,claims:E.claims.size,craftPlans:E.crafting?E.crafting.size:0,paths:C.paths.size,workerPaths:C.walkPaths?C.walkPaths.size:0,distances:C.distances.size,workerDistances:C.walkDistances?C.walkDistances.size:0,supplySnapshots:E.supplyCache?E.supplyCache.size:0,residual,negativeStocks:diagNegatives(),saveKB:save.length/1024,saveMs,canvasMB:perfMemory().mb,collections:perfCollections()});
     return rows[0];}finally{simRestore(S);}
    },seed);await q.close();return rows;
   }
   const baseline=[],current=[];
   for(const seed of [771,772,773]){
    // Alternate order to reduce warm-up and background-load bias between builds.
    if(seed%2){baseline.push(await profile('/baseline',seed));current.push(await profile('/',seed));}
    else{current.push(await profile('/',seed));baseline.push(await profile('/baseline',seed));}
   }
   report.performance={baseline,current,alternatingOrder:true,ratio:current.reduce((n,r)=>n+r.msPerWeek,0)/baseline.reduce((n,r)=>n+r.msPerWeek,0)};
   for(const row of [...baseline,...current])assert(row.residual<1e-7&&row.negativeStocks===0,'Performance run broke conservation');
  }
  fs.writeFileSync(path.join(root,'reports/economy-flow.json'),JSON.stringify(report,null,2));
  console.log(JSON.stringify(report,null,2));
 }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
