// Housing migration and manual recovery exercise the real reservation/cargo and bed-healing paths.
const fs=require('fs'),http=require('http'),path=require('path'),assert=require('assert'),{chromium}=require('playwright');
const root=path.resolve(__dirname,'..');
(async()=>{
 const server=http.createServer((q,r)=>{r.setHeader('content-type','text/html');r.end(fs.readFileSync(process.env.RECALL_DOWNLOAD||path.join(root,'index.html')));});await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH||(fs.existsSync('/usr/bin/chromium')?'/usr/bin/chromium':undefined),args:['--no-sandbox']});
 try{
  const p=await browser.newPage({viewport:{width:430,height:932}}),errors=[];p.on('pageerror',e=>errors.push(e.message));await p.addInitScript(()=>{window.__noIntro=window.__noQuick=true;});await p.goto('http://127.0.0.1:'+server.address().port);
  const report=await p.evaluate(()=>{
   const S=simPrepare(),out={};let checks=0,residual=0;const ok=(v,m)=>{checks++;if(!v)throw Error(m);};
   function fresh(){
    SH_PERF.diag=null;simFixture({id:'recall',tier:3,count:6,porters:0},0xbede5);G.buildings=[];G.bmap.fill(-1);G.roads.fill(0);G.tiles.fill('grass');G.wares={};for(const k in G.stock)G.stock[k]=0;
    for(const k in LAND)G.land[k]=true;G.trade={cs:[],offers:[],cd:0};G.villagers.forEach(v=>{v.home=v.job=-1;v.role='work';v.en=40;delete v.hp;});resetRT();RT.paused=false;G.speed=0;
   }
   const set=(b,kind,g,n)=>createGoods(economyPoint(b,kind),g,n,'test-seed');
   function fixture(){
    fresh();const hall=place('hall',32,5,true),store=place('kura',2,6,true),work=place('workshop',6,6,true),A=place('onigiri',12,6,true),B=place('noodle',16,6,true),home=place('hut',20,6,true),porter=place('porter',26,6,true);
    for(let x=1;x<36;x++)G.roads[idx(x,8)]=1;invalidateRoadTraffic();refreshBoosts();economyTopology();assignHomes();
    const v=G.villagers[0];v.home=home.uid;v.job=work.uid;ensureVillagerAgents();const a=RT.agents.find(a=>a.vid===v.id);agentAtTile(a,2,8);return {hall,store,work,A,B,home,porter,v,a};
   }
   function ledgerStart(){SH_PERF.diag=simStageStats();diagInventory(SH_PERF.diag.opening);}
   function ledgerEnd(){const d=SH_PERF.diag;diagInventory(d.ending);for(const g of new Set([...Object.keys(d.opening),...Object.keys(d.ending),...Object.keys(d.created),...Object.keys(d.destroyed)])){
    const r=(d.ending[g]||0)-(d.opening[g]||0)-(d.created[g]||0)+(d.destroyed[g]||0);residual+=Math.abs(r);ok(Math.abs(r)<1e-8,'Conservation '+g+': '+r);}
    ok(!diagNegatives(),'Negative goods');SH_PERF.diag=null;
   }
   function recalled(M){const e=entranceOf(M.home),a=M.a;ok(a.state==='inside'&&a.hidden&&a.resting&&a.target===M.home.uid,'Did not enter bed');
    ok(!a.path.length&&!a.moving&&!a.mission&&!a.goingHome&&!a.bubble&&a.speedMul===1,'Stale movement state');ok(a.x===e[0]*16+8&&a.y===e[1]*16+12,'Wrong home entrance');}
   try{
    let M=fixture();const shopIds=Object.keys(BUILDINGS).filter(k=>BUILDINGS[k].cat==='shop');
    for(const id of shopIds)for(const lv of [1,2,3])ok(capOf({id,lv})===0,'Shop has housing: '+id+'/'+lv);
    G.boons.homeCap=1;for(const id of shopIds)ok(capOf({id,lv:2})===0,'Cramped Homes created shop housing');G.boons.homeCap=0;
    ok([1,2,3].every((lv,i)=>capOf({id:'hut',lv})===[2,3,4][i]&&capOf({id:'longhouse',lv})===[4,6,8][i]),'Real home capacity changed');
    ok(SHOP_LV2.sale===.15&&SHOP_LV2.appeal===2,'Shop trade upgrade changed');out.housing={shopTypes:shopIds.length,allShopLevelsZero:true,homeCapacitiesPreserved:true,tradeBonusesPreserved:true};

    // Old residents keep their identities/jobs/equipment even when removing beds leaves the village over capacity.
    M=fixture();M.A.lv=M.B.lv=2;G.villagers[0].home=M.A.uid;G.villagers[1].home=M.B.uid;
    const identity=JSON.stringify(G.villagers.map(v=>[v.id,v.role,v.job,v.eq]));G.villagers[0].hp=10;
    ok(!homeOf(G.villagers[0])&&homePerk(G.villagers[0]).rest===.6,'Legacy Shophouse still grants home perks');
    const old=JSON.stringify(G);G=JSON.parse(old);resetRT();afterLoad();const h=bByUid(M.home.uid);
    ok(JSON.stringify(G.villagers.map(v=>[v.id,v.role,v.job,v.eq]))===identity,'Migration lost/changed villagers or assignments');
    ok(G.villagers.every(v=>v.home<0||capOf(bByUid(v.home))>0)&&G.villagers.filter(v=>v.home===h.uid).length===2,'Migration did not respect real beds');
    ok(G.villagers.filter(v=>v.home<0).length===G.villagers.length-2&&G.villagers.find(v=>v.hp===10),'Over-capacity residents or wounds lost');
    const more=place('longhouse',24,10,true);assignHomes();ok(G.villagers.every(v=>v.home>=0),'Unhoused residents did not take new beds');out.migration={version:1,freeBedsReassigned:true,overCapacityRetained:true,newBedsFill:true,jobsAndEquipmentPreserved:true};

    // Cancel an uncollected shipment: reservations disappear, inventory remains at the source.
    M=fixture();set(G,'stock','rice',12);ledgerStart();
    ok(economyStart(M.a,M.v,economyCentral('rice'),economyPoint(M.A,'shelf'),'rice',6,M.store,M.A)&&walkTo(M.a,M.store),'Unpicked trip setup');
    M.a.path=[[40,40]];M.a.bubble={t:2,icon:'?'};M.a.moving=true;M.v.hp=10;const en=M.v.en,hp=M.v.hp,job=M.v.job;
    ok(recallResident(M.v.id,M.home.uid),'Unpicked recall failed');recalled(M);
    ok(!economyState().claims.size&&G.stock.rice===12&&!shopStock(M.A).rice,'Unpicked goods moved/claim leaked');
    ok(M.v.en===en&&M.v.hp===hp&&M.v.job===job,'Recall instantly healed or changed job');ledgerEnd();
    updateVillagerAgent(M.a,.25);ok(M.v.en>en&&M.v.hp>hp&&M.a.resting,'Normal bed healing not running');
    for(let i=0;M.a.resting&&i<3000;i++)updateVillagerAgent(M.a,1/30);
    ok(M.v.en===100&&M.v.hp==null&&M.a.state==='idle'&&!M.a.hidden,'Rest never finishes');
    updateVillagerAgent(M.a,1);ok(M.v.job===job&&M.a.state==='walk','Resident did not resume assigned work');out.rest={immediateTeleport:true,noInstantHeal:true,normalRecovery:true,resumesWork:true};

    // Real porter pickup with two ware types/two destinations. Recall returns only loaded goods, exactly once.
    M=fixture();M.v.job=M.porter.uid;set(G,'wares','mochi',30);set(G,'wares','bento',20);ledgerStart();economyState().jobCount=0;
    economyJob(economyCentral('bento'),economyPoint(M.B,'shelf'),'bento',6,13,M.store,M.B);
    ok(economyStart(M.a,M.v,economyCentral('mochi'),economyPoint(M.A,'shelf'),'mochi',6,M.store,M.A),'Mixed trip setup');economyBundle(M.a);
    ok(economyClaimOf(M.a).second===M.B,'Second shop setup');arrive(M.a,M.v,M.store);
    ok(M.a.carry&&economyFreightTotal(M.a)>0&&economyClaimOf(M.a).picked,'Mixed goods not loaded');
    ok(recallResident(M.v.id,M.home.uid),'Loaded recall failed');recalled(M);
    ok(G.wares.mochi===30&&G.wares.bento===20&&!M.a.carry&&!economyFreightTotal(M.a)&&!economyState().claims.size,'Loaded cargo lost/duplicated or reservation leaked');
    ok(isPorter(M.v)&&recallResident(M.v.id,M.home.uid)&&G.wares.mochi===30&&G.wares.bento===20,'Repeated recall duplicates cargo/loses porter job');ledgerEnd();

    // Interrupting a batch releases unconsumed ingredients and does not finish phantom products.
    M=fixture();M.work.recipe='mochi';set(M.work,'inbox','rice',10);ledgerStart();ok(craftReserve(M.a,M.v,M.work,'mochi',5),'Craft setup');M.a.mission='craft';arrive(M.a,M.v,M.work);
    ok(M.a.state==='work'&&economyState().crafting.size===1,'Batch did not start');ok(recallResident(M.v.id,M.home.uid),'Craft recall failed');
    ok(!economyState().crafting.size&&M.work.inbox.rice===10&&!outTotal(M.work),'Interrupted batch produced/lost goods');
    for(let i=0;i<60;i++)updateVillagerAgent(M.a,1/30);ok(M.work.inbox.rice===10&&!outTotal(M.work),'Cancelled batch finished later');ledgerEnd();out.logistics={unpickedClaims:true,mixedLoadedTwoStopCargo:true,repeatedRecallSafe:true,cancelledCraftSafe:true};

    // No road is required for the emergency teleport; roads are still required to leave normally.
    M=fixture();G.roads.fill(0);invalidateRoadTraffic();agentAtTile(M.a,40,40);ok(recallResident(M.v.id,M.home.uid)&&M.a.resting&&M.a.hidden,'Disconnected recall failed');
    ok(G.bmap[idx(Math.floor(M.a.x/16),Math.floor(M.a.y/16))]===M.home.uid,'Roadless teleport outside house');
    M=fixture();RT.agents=RT.agents.filter(a=>a!==M.a);ok(recallResident(M.v.id,M.home.uid)&&RT.agents.filter(a=>a.vid===M.v.id).length===1,'Missing agent not recovered');
    const a=RT.agents.find(a=>a.vid===M.v.id);ok(a.resting&&a.hidden,'New agent not resting');
    const before=JSON.stringify(G),count=RT.agents.length;ok(!recallResident('missing',M.home.uid)&&!recallResident(M.v.id,M.A.uid),'Invalid recall accepted');
    ok(JSON.stringify(G)===before&&RT.agents.length===count,'Invalid recall changed game');
    const uid=M.home.uid;removeBuilding(M.home);ok(!recallResident(M.v.id,uid),'Demolished home recall accepted');out.edgeCases={disconnectedHome:true,missingAgent:true,invalidRequestsAtomic:true,demolishedHome:true};
    out.checks=checks;out.conservationResidual=residual;return out;
   }finally{SH_PERF.diag=null;simRestore(S);}
  });

  // Real mobile house controls: one sibling button below each resident card, including every upgraded home.
  const fixture=await p.evaluate(()=>{newGame();G.tut=1;G.speed=0;$('#title').hidden=true;afterLoad();resizeView();const h=G.buildings.find(b=>b.id==='hut');h.lv=3;assignHomes();ensureVillagerAgents();const vs=G.villagers.filter(v=>v.home===h.uid);vs[0].en=20;vs[0].hp=10;openBuildingInfo(h);return {uid:h.uid,vid:vs[0].id,n:vs.length,beds:capOf(h)};});
  assert.equal(await p.locator('[data-recall-resident]').count(),fixture.n);assert(await p.locator('#sh-body').textContent().then(t=>t.includes('Residents '+fixture.n+'/'+fixture.beds)));
  assert(await p.locator('.resident').evaluateAll(rows=>rows.every(r=>r.children[0].classList.contains('vcard')&&r.children[1].hasAttribute('data-recall-resident')&&r.children[1].getBoundingClientRect().top>=r.children[0].getBoundingClientRect().bottom)));
  const button=p.locator(`[data-recall-resident="${fixture.vid}"]`);await button.scrollIntoViewIfNeeded();if(process.env.RECALL_SCREENSHOT)await p.screenshot({path:process.env.RECALL_SCREENSHOT});await button.click();
  assert(await p.evaluate(({vid,uid})=>{const a=RT.agents.find(a=>a.vid===vid),v=vById(vid);return a.resting&&a.hidden&&a.target===uid&&v.en===20&&v.hp===10;},fixture));
  await p.evaluate(()=>{const b=G.buildings.find(b=>BUILDINGS[b.id].cat==='shop');b.lv=2;openBuildingInfo(b);});assert.equal(await p.locator('[data-recall-resident]').count(),0);assert(!await p.locator('#sh-body').textContent().then(t=>/Residents|Homes 1|room upstairs|work \+|rest ×/.test(t)));
  assert(await p.evaluate(()=>saveGame()));await p.reload();await p.locator('#t-cont').click();assert(await p.evaluate(({vid,uid})=>G.v===1&&vById(vid).home===uid&&vById(vid).hp===10&&G.villagers.every(v=>v.home<0||capOf(bByUid(v.home))>0),fixture));
  assert.deepStrictEqual(errors,[]);report.ui={mobileButtonsBelowResidents:true,upgradedBedCount:true,shopHasNoResidentsOrHousingPerks:true,browserSaveReload:true};
  fs.mkdirSync(path.join(root,'reports'),{recursive:true});fs.writeFileSync(path.join(root,'reports/resident-recall.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
 }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
