const fs=require('fs'),http=require('http'),path=require('path'),assert=require('assert'),{chromium}=require('playwright');
const root=path.resolve(__dirname,'..');
(async()=>{const server=http.createServer((q,r)=>{r.setHeader('content-type','text/html');r.end(fs.readFileSync(path.join(root,'index.html')));});await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
try{const p=await browser.newPage({viewport:{width:430,height:900}}),errors=[];p.on('pageerror',e=>errors.push(e.message));
await p.addInitScript(()=>{window.__noIntro=true;window.__noQuick=true;});await p.goto('http://127.0.0.1:'+server.address().port+'/?perf=1');await p.waitForFunction(()=>typeof ECONOMY_P0!=='undefined');
const rawHtml=fs.readFileSync(path.join(root,'baseline/v19.1.html'),'utf8'),at=rawHtml.indexOf('function artLiveVillager('),end=rawHtml.indexOf('\n}',at)+2,uncroppedSource=rawHtml.slice(at,end).replaceAll('artLiveVillager','uncroppedRig').replace('const key=JSON.stringify','const key=\'uncropped|\'+JSON.stringify').replace('if(_villageRigCache.size>=256)_villageRigCache.delete(_villageRigCache.keys().next().value);','');
const result=await p.evaluate((uncroppedSource)=>{
 function ok(v,m){if(!v)throw Error(m);}
 const S=simPrepare(),out={};
 try{
 simFixture(SIM_CASES[3],0x534801);economyTopology();economyJobs();
 const E=economyState(),depot=G.buildings.find(b=>b.id==='porter'),porters=G.villagers.filter(isPorter);
 ok(porters.length===2,'manual porter assignments survive afterLoad');
 assignJobs();ok(G.villagers.filter(isPorter).length===2,'assignJobs preserves porters');
 porters[0].job=-1;assignJobs();ok(G.villagers.filter(isPorter).length===1,'porter vacancy never auto-filled');
 porters[0].job=depot.uid;assignJobs();out.manualAssignments=true;
 for(const v of porters){const a=RT.agents.find(q=>q.vid===v.id);ok(!chooseSite(a,v,false),'porters excluded from chooseSite');}
 for(const q of G.buildings)if(shopIs(q))releaseShopStock(q);
 SH_PERF.diag=simStageStats();diagInventory(SH_PERF.diag.opening);
 const shop=G.buildings.find(b=>b.id==='onigiri'),field=G.buildings.find(b=>b.id==='paddy'),a=RT.agents.find(q=>q.vid===porters[0].id),b=RT.agents.find(q=>q.vid===porters[1].id);
 const central=economyCentral('rice'),shelf=economyPoint(shop,'shelf');
 createGoods(central,'rice',50,'test-seed');
 const visitor={wallet:1,likes:[],bubble:null};let before=G.stats.sales;
 ok(sell(visitor,shop)===0&&G.stats.sales===before,'shops may not sell central stock');out.localOnlySales=true;
 const c=economyClaim(a,central,shelf,'rice',8,E.stores[0],shop),c2=economyClaim(b,central,shelf,'rice',8,E.stores[0],shop);
 ok(c&&c.n===8&&c2&&c2.n===2,'delivery claims cap shelves at ten');
 economyRelease(a);economyRelease(b);
 const pick=economyStart(a,porters[0],central,shelf,'rice',6,E.stores[0],shop);
 ok(pick===E.stores[0]&&!a.carry,'goods stay at source until pickup');
 a.mission='goodsPick';missionArrive(a,porters[0],pick);ok(a.carry&&a.carry.n===6,'physical pickup');
 a.mission='goodsDrop';missionArrive(a,porters[0],shop);ok(!a.carry&&shopStock(shop).rice===6,'physical shelf delivery');
 ok(E.claims.size===0,'claims released after delivery');out.claimsAndDelivery=true;
 const noodle=G.buildings.find(q=>q.id==='noodle'),to=economyPoint(noodle,'shelf'),src=E.stores[0];createGoods(economyCentral('veg'),'veg',20,'test-seed');
 const bundleSource=economyStart(a,porters[0],central,to,'rice',5,src,noodle),bundle=economyClaimOf(a);
 ok(bundleSource&&economyAddLine(bundle,economyCentral('veg'),to,'veg',5)===5,'mixed pickup reserves both ingredients');
 a.mission='goodsPick';missionArrive(a,porters[0],src);ok(a.carry.n+economyFreightTotal(a)===10&&a.carry.kind==='cart','mixed cart has ten real goods');
 a.mission='goodsDrop';missionArrive(a,porters[0],noodle);ok(shopStock(noodle).rice===5&&shopStock(noodle).veg===5&&!a.carry&&!economyFreightTotal(a),'mixed ingredients delivered without duplicate cargo');
 out.mixedCart=true;

 const contract=G.trade;G.trade={cs:[{items:[{k:'rice',qty:7}]}]};
 const available=spendableGood('rice');ok(available===Math.max(0,G.stock.rice-7),'contracts protect stock');
 const cl=economyClaim(a,central,shelf,'rice',999,E.stores[0],shop);if(cl)ok(cl.n<=available,'claims respect contracts');economyRelease(a);G.trade=contract;out.contractReserves=true;
 createGoods(economyPoint(field,'pile'),'rice',29.5,'test-seed');produce(field,porters[0]);
 ok((field.pile||0)<=30&&(field.buffer||0)>0,'overflow is preserved in a counted batch');out.noSilentOverflow=true;
 economyStart(a,porters[0],central,shelf,'rice',2,E.stores[0],shop);a.mission='goodsPick';missionArrive(a,porters[0],E.stores[0]);
 removeBuilding(shop);ok(!a.carry&&!a.goodsClaim,'demolish shop recovers in-transit goods');
 removeBuilding(field);out.demolition=true;
 const s2=G.buildings.find(b=>b.id==='pickle'),raw=economyPoint(s2,'shelf'),st=E.stores.find(x=>x.id==='kura');
 createGoods(economyCentral('veg'),'veg',20,'test-seed');economyStart(a,porters[0],economyCentral('veg'),raw,'veg',4,st,s2);a.mission='goodsPick';missionArrive(a,porters[0],st);
 ok(a.carry,'mid-transit roundtrip starts loaded');economyBeforeSave();const json=JSON.stringify(G);
 ok(!json.includes('goodsClaim')&&!json.includes('events')&&!json.includes('_ecoEntrance'),'runtime claims excluded from saves');
 G=JSON.parse(json);resetRT();afterLoad();ok(economyState().claims.size===0,'roundtrip clears claims');out.roundtrip=true;
 const d=SH_PERF.diag;diagInventory(d.ending);let residual=0;
 const keys=new Set(Object.keys(d.opening).concat(Object.keys(d.ending),Object.keys(d.created),Object.keys(d.destroyed)));
 for(const k of keys)residual+=Math.abs((d.ending[k]||0)-(d.opening[k]||0)-(d.created[k]||0)+(d.destroyed[k]||0));
 ok(residual<1e-8,'ledger conservation: '+residual);ok(diagNegatives()===0,'no negative stock');out.residual=residual;
 // Genuine legacy fixture: old shelf keys and an old scalar workshop output.
 SH_PERF.diag=null;const old=G.buildings.find(b=>b.id==='onigiri')||G.buildings.find(b=>b.id==='pickle'),w=G.buildings.find(b=>BUILDINGS[b.id].craft);
 old.shopGoods={veg:12.5};old.shopWares={};delete old.shelf;delete G.economyV;w.out=2;w.recipe='bento';
 const invBefore=diagInventory({});migrateEconomy();const invAfter=diagInventory({});for(const k in invBefore)ok(Math.abs((invAfter[k]||0)-(invBefore[k]||0)-(k==='bento'?2:0))<1e-8,'legacy migration '+k);
 ok(G.v===1&&G.economyV===1&&!old.shopGoods&&old.shelf,'save version unchanged and shelf migration complete');out.migration=true;
 const oldRig=eval('('+uncroppedSource+')'),one=gameCanvas(),two=gameCanvas();one.width=two.width=180;one.height=two.height=144;const ca=one.getContext('2d'),cb=two.getContext('2d');let frames=0;
 const base=vLook(G.villagers[0]),looks=[base,{...base,gear:{w:'nodachi',a:'kokuryu_gusoku',h:'eboshi_samurai'}},{...base,gear:{w:'rifle',a:'nanbando',h:'happuri'}}];
 function paint(x,r){x.setTransform(3,0,0,3,0,0);x.imageSmoothingEnabled=false;x.clearRect(0,0,60,48);artDraw(x,r.img,30+r.img.ox,32+r.img.oy);if(r.hands)artDraw(x,r.hands,30+r.hands.ox,32+r.hands.oy);return new Uint32Array(x.getImageData(0,0,180,144).data.buffer);}
 for(const L of looks)for(const dir of ['up','down','right','left'])for(const mods of [[],['walk0'],['raise'],['sit']])for(const carry of [null,'cart']){
  const a=paint(ca,oldRig(L,dir,mods,carry)),b=paint(cb,artLiveVillager(L,dir,mods,carry));for(let i=0;i<a.length;i++)ok(a[i]===b[i],'rig crop changed a painted pixel in '+dir+' '+mods+' '+carry);frames++;}
 one.width=one.height=two.width=two.height=0;for(const [key,r] of _villageRigCache)if(key.startsWith('uncropped|')){freeCanvases(r);_villageRigCache.delete(key);}
 out.identicalRigFrames=frames;out.dprTrial=perfDprExperiment();out.cacheSizes=perfCacheSizes();out.errors=[];
 return out;
 }finally{simRestore(S);}
 },uncroppedSource);
const preview=await p.evaluate(()=>{const c=gameCanvas();c.width=960;c.height=340;const x=c.getContext('2d');x.fillStyle='#e5d4ae';x.fillRect(0,0,960,340);x.imageSmoothingEnabled=false;
 for(const it of [['Porter House','porter'],['Workshop','workshop'],['Storehouse','kura']].entries()){const i=it[0],label=it[1][0],id=it[1][1],im=buildingSprite(id,0);x.save();x.translate(64+i*306,106);x.scale(5,5);artDraw(x,im.cv,im.ox,im.oy);x.restore();x.font='18px monospace';x.fillStyle='#403324';x.fillText(label,50+i*306,292);}
 const url=c.toDataURL('image/png');c.width=c.height=0;return url.split(',')[1];});
 fs.mkdirSync(path.join(root,'reports'),{recursive:true});fs.writeFileSync(path.join(root,'reports/porter-preview.png'),Buffer.from(preview,'base64'));console.log('PORTER_PREVIEW_DATA='+preview);
 assert.deepStrictEqual(errors,[]);fs.mkdirSync(path.join(root,'reports'),{recursive:true});fs.writeFileSync(path.join(root,'reports/logistics-checks.json'),JSON.stringify(result,null,2));console.log('LOGISTICS_CHECKS='+JSON.stringify(result));
}finally{await browser.close();server.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
