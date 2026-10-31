// Building relocation: actual UI flow, paused placement, identity and active logistics.
const fs=require('fs'),http=require('http'),path=require('path'),assert=require('assert'),{chromium}=require('playwright');
const root=path.resolve(__dirname,'..');
(async()=>{
 const server=http.createServer((q,r)=>{r.setHeader('content-type','text/html');r.end(fs.readFileSync(process.env.MOVE_DOWNLOAD||path.join(root,'index.html')));});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH||(fs.existsSync('/usr/bin/chromium')?'/usr/bin/chromium':undefined),args:['--no-sandbox']});
 try{
  const p=await browser.newPage({viewport:{width:430,height:932}}),errors=[];p.on('pageerror',e=>errors.push(e.message));
  await p.addInitScript(()=>{window.__noIntro=window.__noQuick=true;});await p.goto('http://127.0.0.1:'+server.address().port);
  const report=await p.evaluate(()=>{
   const S=simPrepare(),out={};let checks=0,residual=0;
   const ok=(v,m)=>{checks++;if(!v)throw Error(m);};
   function fresh(){
    SH_PERF.diag=null;simFixture({id:'move',tier:3,count:6,porters:0},0xb017d);
    G.buildings=[];G.roads.fill(0);G.bmap.fill(-1);G.tiles.fill('grass');G.wares={};for(const k in G.stock)G.stock[k]=0;
    for(const k in LAND)G.land[k]=true;
    G.trade={cs:[],offers:[],cd:0};G.villagers.forEach(v=>{v.job=-1;v.home=-1;v.role='work';});resetRT();G.speed=0;RT.paused=false;RT.t=0;
   }
   const road=(x,y)=>{G.roads[idx(x,y)]=1;};
   const topology=()=>{invalidateRoadTraffic();economyState().dirty=true;economyTopology();economyJobs();};
   const set=(b,kind,k,n)=>createGoods(economyPoint(b,kind),k,n,'test-seed');
   const actor=(x,y,i=0)=>{const v=G.villagers[i],a=spawnAgent({kind:'villager',vid:v.id,look:vLook(v),speed:22});agentAtTile(a,x,y);return a;};
   function fixture(){
    fresh();const store=place('kura',2,6,true),work=place('workshop',6,6,true),shop=place('onigiri',12,6,true),home=place('hut',20,6,true);
    for(let x=1;x<=30;x++){road(x,8);road(x,12);}for(let y=8;y<=12;y++)road(1,y);topology();return {store,work,shop,home,v:G.villagers[0]};
   }
   const startLedger=()=>{SH_PERF.diag=simStageStats();diagInventory(SH_PERF.diag.opening);};
   function endLedger(){const d=SH_PERF.diag;diagInventory(d.ending);for(const g of new Set([...Object.keys(d.opening),...Object.keys(d.ending),...Object.keys(d.created),...Object.keys(d.destroyed)])){
    const r=(d.ending[g]||0)-(d.opening[g]||0)-(d.created[g]||0)+(d.destroyed[g]||0);residual+=Math.abs(r);ok(Math.abs(r)<1e-8,'Conservation '+g+': '+r);}
    ok(!diagNegatives(),'Negative inventory');SH_PERF.diag=null;
   }
   function leg(a){const b=bByUid(a.target);ok(b,'Missing target');for(let i=0;a.path.length&&i<6000;i++)stepAgent(a,1/30);ok(!a.path.length,'Moved delivery stuck');return missionArrive(a,vById(a.vid)||a,b);}
   try{
    let M=fixture();M.work.lv=2;M.work.recipe='mochi';M.v.job=M.work.uid;M.v.home=M.home.uid;
    const original=JSON.stringify(G),ecoTime=economyState().t;G.speed=4;ok(startMove(M.work)&&G.speed===0,'Move did not pause');
    ok(document.querySelector('[data-sp="1"]').disabled&&document.querySelector('[data-sp="4"]').disabled,'Speed buttons active during move');
    RT.ghost={x:6,y:10};updatePlaceBar();G.speed=4;for(let i=0;i<60;i++)updateVillage(1/30);
    ok(economyState().t===ecoTime&&G.wt===0,'Simulation ran during placement');exitMode();
    ok(G.speed===0&&JSON.stringify(G)===original&&!RT.moveUid,'Cancel changed the village');
    ok(!document.querySelector('[data-sp="1"]').disabled,'Play stayed disabled after cancel');
    out.pause={initial:true,speedControlsLocked:true,simulationFrozen:true,cancelKeepsPause:true};
    const startBattleReal=startBattle;let battles=0;
    try{startBattle=()=>{battles++;};const P=PROVINCES.find(p=>p.type==='clan'&&G.prov[p.id]?.owner!=='kage');G.march={id:P.id,left:0};
     startMove(M.work);marchCheck();ok(G.march&&battles===0,'Battle interrupted move');exitMode();marchCheck();ok(G.march&&battles===0,'Battle ignored paused clock');G.speed=1;marchCheck();ok(!G.march&&battles===1,'Ready battle did not resume on Play');
    }finally{startBattle=startBattleReal;G.speed=0;}

    // Invalid destinations are atomic, including terrain, locked plots and roads.
    startMove(M.work);const before=JSON.stringify(G);G.tiles[idx(6,10)]='water';
    ok(!moveBuilding(M.work,6,10)&&M.work.x===6&&M.work.y===6,'Moved onto water');G.tiles[idx(6,10)]='grass';
    ok(!moveBuilding(M.work,12,6),'Moved over another building');ok(!moveBuilding(M.work,6,8),'Moved onto road');
    ok(!moveBuilding(M.work,-1,10)&&!moveBuilding(M.work,MAP_W,10),'Moved outside map');
    const plot=plotOf(6,10),owned=G.land[plot];G.land[plot]=false;ok(!moveBuilding(M.work,6,10),'Moved onto locked land');G.land[plot]=owned;
    ok(JSON.stringify(G)===before,'Invalid move changed stock, identity or maps');exitMode();
    const mine=place('mine',25,6,true);for(let y=6;y<8;y++)for(let x=25;x<27;x++)G.tiles[idx(x,y)]='ore';
    ok(!moveBuilding(mine,25,10),'Mine moved off ore');for(let y=10;y<12;y++)for(let x=25;x<27;x++)G.tiles[idx(x,y)]='ore';
    ok(moveBuilding(mine,25,10),'Valid ore destination refused');
    out.placement={blockedAndAtomic:true,roadsPreserved:true,oreRequired:true};

    // One-column overlap keeps every building field and the same inventory endpoints.
    M=fixture();M.work.lv=3;M.work.recipe='mochi';M.work.reno={lv:3,w:1,w0:3};M.v.job=M.work.uid;M.v.home=M.home.uid;
    set(M.work,'inbox','rice',10);set(M.work,'outs','mochi',2);set(M.shop,'shelf','rice',5);set(M.shop,'shelf','mochi',4);
    const uid=G.uid,count=G.buildings.length,gold=G.gold,point=economyPoint(M.work,'inbox'),renovation=M.work.reno;startLedger();
    ok(moveBuilding(M.work,7,6),'Overlapping move refused');
    ok(bByUid(M.work.uid)===M.work&&M.work.lv===3&&M.work.recipe==='mochi'&&M.work.reno===renovation&&M.work.reno.w===1,'Progress reset');
    ok(economyPoint(M.work,'inbox')===point&&M.work.inbox.rice===10&&M.work.outs.mochi===2,'Inventory endpoint or contents replaced');
    ok(M.v.job===M.work.uid&&M.v.home===M.home.uid&&G.uid===uid&&G.buildings.length===count&&G.gold===gold,'Assignment, UID or money changed');
    ok(G.bmap[idx(6,6)]===-1&&G.bmap[idx(7,6)]===M.work.uid&&G.bmap[idx(8,7)]===M.work.uid,'Overlapping footprint corrupted');
    ok(moveBuilding(M.shop,12,10)&&shopStock(M.shop).rice===5&&shopStock(M.shop,true).mochi===4,'Shop shelves lost on move');endLedger();

    // Residents and hidden visitors leave via the new entrance.
    M=fixture();M.home.lv=3;M.v.home=M.home.uid;const sleeper=actor(20,8);sleeper.target=M.home.uid;sleeper.state='inside';sleeper.hidden=true;sleeper.resting=true;sleeper.timer=3;
    ok(moveBuilding(M.home,20,10)&&M.v.home===M.home.uid&&sleeper.hidden&&sleeper.resting&&sleeper.timer===3,'Resident assignment/rest lost');
    ok(sleeper.entryTile[1]===12&&sleeper.y===12*16+12,'Resident kept old entrance');
    const guest=spawnAgent({kind:'trav',prof:'farmer',look:collectorLook(0),target:M.shop.uid,shop:M.shop.uid,state:'inside',hidden:true,timer:2});agentAtTile(guest,12,8);
    ok(moveBuilding(M.shop,12,10)&&guest.hidden&&guest.shop===M.shop.uid&&guest.y===12*16+12,'Shop visitor lost');
    out.identity={sameObjectAndUID:true,upgrades:true,renovation:true,recipes:true,stock:true,jobsAndHomes:true,overlap:true,occupants:true};

    // An uncollected trip follows its moved source; a loaded trip follows its moved shop.
    M=fixture();set(G,'stock','rice',10);const a=actor(8,8);startLedger();
    ok(economyStart(a,M.v,economyCentral('rice'),economyPoint(M.shop,'shelf'),'rice',6,M.store,M.shop)&&walkTo(a,M.store),'Claim setup');
    const c=economyClaimOf(a),ax=a.x,ay=a.y;ok(moveBuilding(M.store,2,10)&&a.x===ax&&a.y===ay&&economyClaimOf(a)===c,'Road carrier teleported or claim lost');
    leg(a);ok(a.carry?.n===6,'Pickup failed after source move');ok(moveBuilding(M.shop,12,10),'Loaded destination move');leg(a);
    ok(shopStock(M.shop).rice===6&&G.stock.rice===4&&!a.carry&&!economyState().claims.size,'Moved trip duplicated or lost goods');endLedger();

    M=fixture();M.work.recipe='mochi';M.v.job=M.work.uid;set(M.work,'inbox','rice',10);const artisan=actor(6,8);artisan.target=M.work.uid;artisan.mission='craft';
    startLedger();ok(craftReserve(artisan,M.v,M.work,'mochi',5),'Craft reservation');arrive(artisan,M.v,M.work);
    const timer=artisan.timer,oldY=artisan.y,plan=economyState().crafting.get(artisan);ok(moveBuilding(M.work,6,10),'Active craft move');
    ok(artisan.state==='work'&&artisan.timer===timer&&artisan.y===oldY+64&&economyState().crafting.get(artisan)===plan,'Work or timer reset');
    for(let i=0;artisan.state==='work'&&i<1000;i++)updateVillagerAgent(artisan,1/30);
    ok(M.work.outs.mochi===5&&!M.work.inbox.rice&&!economyState().crafting.size&&M.v.job===M.work.uid,'Moved craft not completed exactly once');endLedger();

    M=fixture();M.work.recipe='mochi';M.v.job=M.work.uid;set(M.work,'inbox','rice',10);const waiting=actor(6,8);waiting.target=M.work.uid;waiting.entryTile=[6,8];
    ok(moveBuilding(M.work,6,10)&&waiting.target!==M.work.uid,'Idle worker retained stale on-site target');updateVillagerAgent(waiting,.1);
    ok(waiting.state==='walk'&&waiting.y===8*16+12,'Idle worker teleported into moved worksite');

    M=fixture();const field=place('paddy',24,6,true);topology();set(field,'pile','rice',12);ok(hireCollectors(M.store),'Collector hire');collectorWeek();economyTick(1);startLedger();
    const carrier=RT.agents.find(a=>a.kind==='collector');ok(carrier,'Collector missing');for(let i=0;carrier.mission==='goodsPick'&&i<4000;i++)updateCollector(carrier,1/30);
    const contract=M.store.collectorHire;ok(carrier.carry&&moveBuilding(M.store,2,10)&&M.store.collectorHire===contract,'Collector hire lost on move');
    for(let i=0;!carrier.dead&&i<4000;i++)updateCollector(carrier,1/30);
    ok(carrier.dead&&G.stock.rice===12&&contract.left===4&&!contract.visits.length&&!economyState().claims.size,'Collector failed to return to moved Storehouse');endLedger();
    out.logistics={unpickedSource:true,loadedDestination:true,activeBatchExactlyOnce:true,paidCollectors:true};

    fresh();const forge=place('teppo_kaji',2,6,true),porter=place('porter',9,6,true);for(let x=1;x<25;x++)road(x,8);topology();forge.lv=3;forge.forgeFocus='armor';
    G.villagers[0].job=G.villagers[1].job=porter.uid;
    ok(moveBuilding(forge,16,6)&&movingBuildingSprite(forge)===buildingSprite(forge.id,4,3),'Forge focus/level preview reset');
    ok(moveBuilding(porter,12,6)&&isPorter(G.villagers[0])&&isPorter(G.villagers[1]),'Porter assignments reset');
    const tree=place('pine',25,6,true);ok(moveBuilding(tree,26,6)&&bByUid(tree.uid)===tree,'Tree deleted itself');
    const hall=place('hall',30,5,true);ok(moveBuilding(hall,34,5),'Clan Hall could not move');
    const merchant=place('stall',38,6,true);ok(!moveBuilding(merchant,41,6),'Temporary merchant moved');

    // Moving a pass-through footprint invalidates both navigation graphs.
    fresh();const bridge=place('paddy',2,6,true);road(1,6);road(4,6);topology();ok(roadPath(1,6,4,6,true,true),'Crossing setup');
    ok(moveBuilding(bridge,2,10)&&!roadPath(1,6,4,6,true,true),'Stale building crossing survived move');
    out.navigation={revisionInvalidation:true,oldCrossingRemoved:true};

    M=fixture();M.v.job=M.work.uid;M.work.lv=2;startMove(M.work);RT.ghost={x:6,y:10};economyBeforeSave();
    G=JSON.parse(JSON.stringify(G));resetRT();afterLoad();
    ok(bByUid(M.work.uid).y===6&&bByUid(M.work.uid).lv===2&&vById(M.v.id).job===M.work.uid&&RT.mode==='normal'&&RT.moveUid==null&&G.speed===0,'Preview committed itself on save/load');

    M=fixture();M.v.job=M.work.uid;M.v.home=M.home.uid;M.home.lv=3;set(M.work,'inbox','rice',7);startLedger();
    ok(moveBuilding(M.work,6,10)&&moveBuilding(M.home,20,10),'Save setup');economyBeforeSave();let raw=JSON.stringify(G);
    ok(!raw.includes('moveUid')&&!raw.includes('ghost'),'Move UI entered save');G=JSON.parse(raw);resetRT();afterLoad();
    ok(G.v===1&&bByUid(M.work.uid).y===10&&bByUid(M.work.uid).inbox.rice===7&&vById(M.v.id).job===M.work.uid&&vById(M.v.id).home===M.home.uid&&bByUid(M.home.uid).lv===3,'Move save/load lost data');endLedger();
    out.save={version:1,committedPosition:true,uncommittedPreviewDiscarded:true,assignmentsAndStock:true,noTransientMoveState:true};
    M=fixture();M.v.job=M.work.uid;ok(moveBuilding(M.work,6,15)&&!entranceOf(M.work),'Disconnected move setup');
    assignJobs();ok(vById(M.v.id).job===M.work.uid&&M.work.moveJobHold,'Disconnected move lost assignment');
    G=JSON.parse(JSON.stringify(G));resetRT();afterLoad();assignJobs();ok(vById(M.v.id).job===M.work.uid,'Saved roadless move lost assignment');
    road(3,13);topology();assignJobs();ok(vById(M.v.id).job===M.work.uid,'Partial road edit reassigned worker');
    road(6,14);topology();assignJobs();ok(vById(M.v.id).job===M.work.uid&&!bByUid(M.work.uid).moveJobHold,'Reconnection did not release temporary job hold');
    out.identity.disconnectedAssignmentHold=true;
    out.checks=checks;out.conservationResidual=residual;out.negativeStock=diagNegatives();return out;
   }finally{SH_PERF.diag=null;simRestore(S);}
  });
  // Real mobile buttons and canvas taps, not direct relocation calls.
  await p.evaluate(()=>{newGame();$('#title').hidden=true;G.tut=1;G.gold=1500;G.speed=1;resizeView();afterLoad();});
  await p.locator('#dock-in [data-p="build"]').click();assert.equal(await p.locator('[data-move-tool]').count(),1);
  await p.locator('[data-move-tool]').click();assert(await p.evaluate(()=>RT.mode==='move'&&G.speed===0));assert(await p.locator('[data-sp="1"]').isDisabled());
  const selected=await p.evaluate(()=>{
   const b=G.buildings.find(b=>b.id==='paddy');b.lv=2;const v=G.villagers.find(v=>v.role==='work')||G.villagers[0];v.role='work';v.job=b.uid;
   VIEW.cx=(b.x+1)*16;VIEW.cy=(b.y+1)*16;setZoom(2);return {uid:b.uid,x:b.x,y:b.y,vid:v.id,gold:G.gold};
  });
  async function tapTile(x,y){const pt=await p.evaluate(({x,y})=>{const s=VIEW.scale/VIEW.dpr;return {x:VIEW.w/2+((x+.5)*16-VIEW.cx)*s,y:VIEW.h/2+((y+.5)*16-VIEW.cy)*s};},{x,y});await p.locator('#view').click({position:pt});}
  await tapTile(selected.x,selected.y);assert(await p.evaluate(uid=>RT.moveUid===uid,selected.uid));
  const dest=await p.evaluate(uid=>{const b=bByUid(uid);for(let y=1;y<MAP_H-2;y++)for(let x=1;x<MAP_W-2;x++)if((x!==b.x||y!==b.y)&&!canPlace(b.id,x,y,b)&&entranceOf({id:b.id,x,y})){VIEW.cx=(x+1)*16;VIEW.cy=(y+1)*16;return {x,y};}throw Error('No relocation destination');},selected.uid);
  await tapTile(dest.x,dest.y);assert.equal(await p.locator('#pb-ok').textContent(),'Move');assert(!(await p.locator('#pb-ok').isDisabled()));
  if(process.env.MOVE_SCREENSHOT)await p.screenshot({path:process.env.MOVE_SCREENSHOT});
  await p.locator('#pb-ok').click();assert(await p.evaluate(({selected,dest})=>{const b=bByUid(selected.uid);return b.x===dest.x&&b.y===dest.y&&b.lv===2&&vById(selected.vid).job===b.uid&&G.gold===selected.gold&&G.speed===0&&RT.mode==='normal';},{selected,dest}));
  await p.evaluate(uid=>openBuildingInfo(bByUid(uid)),selected.uid);assert.equal(await p.locator('[data-building-move]').count(),1);assert.equal(await p.locator('[data-building-remove]').count(),1);
  await p.locator('[data-building-move]').click();await p.locator('#pb-no').click();assert(await p.evaluate(()=>G.speed===0&&RT.mode==='normal'));
  assert(await p.evaluate(()=>saveGame()));await p.reload();await p.locator('#t-cont').click();
  assert(await p.evaluate(({selected,dest})=>{const b=bByUid(selected.uid);return b.x===dest.x&&b.y===dest.y&&b.lv===2&&vById(selected.vid).job===b.uid&&G.speed===0;},{selected,dest}));
  assert.deepStrictEqual(errors,[]);report.ui={buildMenuTool:true,buildingInfoButton:true,canvasPlacement:true,free:true,staysPaused:true,cancel:true,browserSaveReload:true};
  fs.mkdirSync(path.join(root,'reports'),{recursive:true});fs.writeFileSync(path.join(root,'reports/building-move.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
 }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
