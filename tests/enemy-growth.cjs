// Growth at real encounter boundaries, unchanged castle snapshots, v1 saves and actual map interaction.
// GROWTH_BEFORE=/path/to/previous.html adds a seeded before/after comparison (no runtime dependency).
const fs=require('fs'),http=require('http'),path=require('path'),assert=require('assert'),{chromium}=require('playwright');
const root=path.resolve(__dirname,'..'),source=process.env.GROWTH_DOWNLOAD||path.join(root,'index.html');
async function collect(page){return page.evaluate(()=>{
 const S=simPrepare(),rows=[];try{
  Math.random=seeded(73117);newGame();G.tut=1;G.speed=0;G.roll=null;G.boons=freshBoons();G.vseed=73117;afterLoad();
  const states=[{year:1,wins:0,growth:0},{year:1,wins:5,growth:.15},{year:5,wins:4,growth:.2},{year:12,wins:10,growth:.64},{year:20,wins:40,growth:2.7}];
  const camps=['bandit','ronin','ikki','wako'].flatMap((clan,i)=>['army','skirmish'].map(mode=>({id:'fixture_'+clan+mode,type:'camp',clan,mode,x:65+i*45,y:90,power:120+i*180,expires:11,reward:{}})));
  for(const state of states){G.year=state.year;G.wins=state.wins;G.dGrowth=state.growth;G.troops={inf:2000,arc:1000,gun:800,cav:500};G.dojoLevel=20;
   const castles={},fields={},hunts={};
   for(const p of PROVINCES.filter(p=>p.type==='clan'||p.type==='dojo')){Math.random=seeded(1921);castles[p.id]=JSON.stringify(enemyArmy(p));}
   for(const p of PROVINCES.filter(p=>p.type==='bandit').concat(camps,Object.keys(LAND_FIGHT).map(landSite))){Math.random=seeded(1921);const a=enemyArmy(p);fields[p.id]={power:armyPower(a),troops:totalOf(a),mode:a.mode};}
   for(const h of HUNTS)hunts[h.k]=huntArmy(h).groups.map(g=>g.cmds[0].s);
   rows.push({state,castles,fields,hunts,castleScale:diffScale(),fieldScale:typeof fieldScale==='function'?fieldScale():1});
  }return rows;
 }finally{Math.random=S.random;simRestore(S);}
});}
(async()=>{
 const server=http.createServer((q,r)=>{r.setHeader('content-type','text/html');r.end(fs.readFileSync(q.url==='/before'&&process.env.GROWTH_BEFORE?process.env.GROWTH_BEFORE:source));});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});
 try{
  const page=await browser.newPage({viewport:{width:430,height:932}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));await page.route('https://**',r=>r.abort());
  await page.addInitScript(()=>{window.__noIntro=window.__noQuick=true;window.requestAnimationFrame=()=>0;});
  const url='http://127.0.0.1:'+server.address().port;await page.goto(url);
  const after=await collect(page),report=await page.evaluate(()=>{
   const S=simPrepare(),out={};let checks=0;const ok=(v,m)=>{checks++;if(!v)throw Error(m);},near=(a,b,m)=>ok(Math.abs(a-b)<1e-8,m+': '+a+' != '+b);
   try{
    Math.random=seeded(73117);newGame();G.tut=1;G.speed=0;G.roll=null;G.boons=freshBoons();G.vseed=73117;$('#title').hidden=true;resizeView();afterLoad();
    G.wins=0;G.dGrowth=0;
    out.annual=[];for(const [year,creep]of [[1,0],[2,.01],[5,.04],[6,.06],[11,.16],[12,.19]]){G.year=year;near(diffScale(),1+creep,'Castle annual rate');near(fieldScale(),1+2*creep,'Field annual rate');out.annual.push({year,castle:diffScale(),field:fieldScale()});}
    out.captures=[];for(const year of [1,2,5,11]){G.year=year;G.dGrowth=0;const c=diffScale(),f=fieldScale();G.dGrowth=(2+year)/100;near(diffScale()-c,(2+year)/100,'Castle capture rate');near(fieldScale()-f,(2+year)/50,'Field capture rate');out.captures.push({year,castlePercent:year+2,fieldPercent:(year+2)*2});}
    G.year=1;G.dGrowth=20;near(diffScale(),3,'Castle conquest ceiling');near(fieldScale(),41,'Field growth still capped');
    G.dGrowth+=.03;near(fieldScale(),41.06,'Further captures stop growing fields');near(diffScale(),3,'Field cap removal changed castles');
    out.uncapped=[];for(const growth of [2.7,20,100]){G.dGrowth=growth;const scale=1+growth*2;
     for(const site of [{id:'uncapped_band',type:'camp',clan:'bandit',mode:'army',x:65,y:90,power:120,expires:11,reward:{}},landSite(Object.keys(LAND_FIGHT)[0])]){
      G.dGrowth=0;Math.random=seeded(1921);const base=armyPower(enemyArmy(site));G.dGrowth=growth;Math.random=seeded(1921);const a=enemyArmy(site),power=armyPower(a);
      ok(Number.isFinite(power)&&power>base*3,'Late field strength capped/invalid');ok(a.groups.every(g=>Number.isFinite(g.troops)&&g.troops>0&&Number.isFinite(g.atkMul)&&g.atkMul>0),'Uncapped growth invalidates formations');
      ok(Math.abs(power/(base*scale)-1)<.13,'Uncapped strength lost in normalization');out.uncapped.push({growth,scale,mode:a.mode,power,troops:totalOf(a)});
     }
    }
    delete G.dGrowth;G.wins=6;near(fieldScale(),1.36,'Legacy wins fallback');near(diffScale(),1.18,'Legacy castle fallback');
    G.year=5;G.wins=4;G.dGrowth=.2;
    const camp={id:'test_band',type:'camp',clan:'bandit',mode:'army',x:65,y:90,power:200,expires:monthIdx()+4,reward:{}};
    const army=()=>{Math.random=seeded(919);return enemyArmy(camp);};
    G.boons.raid=1;const p1=armyPower(army());G.boons.raid=3;const p3=armyPower(army());ok(Math.abs(p3/p1-3)<.12,'Raider omen compounded with growth');G.boons.raid=1;
    const province=siteById('settsu');G.prov[province.id].owner='kage';Math.random=seeded(527);const rebel=spawnRebellion(province),power=rebel.power;
    const local=(province.power||80)*diffScale()*siteBoost(province)*(province.capital&&!province.boss?SIEGE_MUL:1);
    near(rebellionBase(province)/local,fieldScale()/diffScale(),'Rebel growth applied more than once');
    Math.random=seeded(919);const r1=armyPower(enemyArmy(rebel));G.boons.raid=3;Math.random=seeded(919);near(armyPower(enemyArmy(rebel)),r1,'Raider omen affects rebels');G.boons.raid=1;
    G.year=12;G.dGrowth=2.7;Math.random=seeded(919);near(armyPower(enemyArmy(rebel)),r1,'Spawned revolt scaled twice/changed while waiting');
    const rewards=JSON.stringify(rebel.reward),until=rebel.expires;G.camps=[camp,rebel];economyBeforeSave();const saved=JSON.stringify(G);G=JSON.parse(saved);resetRT();afterLoad();
    ok(G.v===1&&G.dGrowth===2.7&&G.wins===4,'v1 growth history lost');const loaded=G.camps.find(c=>c.id===rebel.id);ok(loaded.power===power&&loaded.expires===until&&JSON.stringify(loaded.reward)===rewards,'Save/load rerolled uprising');
    Math.random=seeded(919);near(armyPower(enemyArmy(loaded)),r1,'Loaded revolt grew again');
    const oldGoods=JSON.stringify({stock:G.stock,wares:G.wares,items:G.items});delete G.dGrowth;const legacy=fieldScale();afterLoad();near(fieldScale(),legacy,'Migration changed legacy scaling');ok(JSON.stringify({stock:G.stock,wares:G.wares,items:G.items})===oldGoods,'Migration changed goods');
    out.retakes=[];for(const p of [province,PROVINCES.find(p=>p.type==='bandit')]){
     const st=G.prov[p.id];st.owner='kage';st.power=p.power;G.camps=[];Math.random=seeded(527);const c=spawnRebellion(p);c.expires=monthIdx();
     const expected=Math.max(p.power,Math.ceil(c.power*(p.type==='clan'?1.05:1.2)/sitePowerScale(p)));Math.random=()=>.99;rebelTick();
     ok(st.owner===p.clan&&st.power===expected,'Expired uprising applied growth twice at '+p.id);const restored=st.power;
     st.owner='kage';G.camps=[];Math.random=seeded(527);const c2=spawnRebellion(p);near(c2.power,c.power,'Revolt reused retake strength');c2.expires=monthIdx();Math.random=()=>.99;rebelTick();near(st.power,restored,'Repeated uprising inflated retake');
     out.retakes.push({id:p.id,original:p.power,uprising:c.power,restored:st.power,scale:sitePowerScale(p)});
    }
    out.saves={version:1,legacyWins:true,rebelsScaleOnce:true,rawHistoryUnchanged:true};
    G.year=2;G.dGrowth=0;G.wins=0;G.troops={inf:500,arc:0,gun:0,cav:0};G.camps=[];
    const target=PROVINCES.find(p=>p.type==='clan'&&!p.boss&&!p.capital);G.prov[target.id].owner=target.clan;
    ok(startBattle(target.id),'Capture fixture did not start');for(const g of BT.A[1].groups){g.troops=0;for(const c of g.cmds)c.ko=true;}
    ok(finishBattle('win')!==false,'Capture did not finish');near(G.dGrowth,.04,'Real capture stored doubled history');ok(G.wins===1,'Capture not counted');near(fieldScale()-diffScale(),.05,'Real capture/year field premium');closeBattle();
    for(const mode of ['army','skirmish']){ok(nodeKind({...camp,mode})==='band','Roaming '+mode+' uses rebel icon');ok(nodeKind({...loaded,mode})===(mode==='army'?'fort':'fire'),'Rebel icon changed');}
    for(const clan of ['bandit','ronin','ikki','wako']){const c=CLANS[clan].banner,img=mapIcon('band',false,c);ok(img===mapIcon('band',false,c),'Band icon is uncached');ok(img!==mapIcon('fort',false,c),'Band and rebel sprites alias');}
    out.checks=checks;return out;
   }finally{Math.random=S.random;if(BT)closeBattle();simRestore(S);}
  });
  // Keep real field/hunt progression checked even when the optional historical HTML is absent.
  report.functionalFieldEncounters=0;report.functionalHuntEncounters=0;
  for(const row of after){
   for(const id in row.fields){const ratio=row.fields[id].power/Math.max(1,after[0].fields[id].power);assert(Math.abs(ratio/row.fieldScale-1)<.13,'Field normalization erased actual growth: '+id);report.functionalFieldEncounters++;}
   const f=1+((row.state.year-1)*.7+row.state.wins*.56)*.12;
   for(const id in row.hunts){for(let j=0;j<row.hunts[id].length;j++)for(const key of ['atk','def','hp','str','mrk'])assert(Math.abs(row.hunts[id][j][key]/after[0].hunts[id][j][key]-f)<1e-8,'Hunt progression missing: '+id);report.functionalHuntEncounters++;}
  }
  if(process.env.GROWTH_BEFORE){
   const old=await browser.newPage();await old.route('https://**',r=>r.abort());await old.addInitScript(()=>{window.__noIntro=window.__noQuick=true;window.requestAnimationFrame=()=>0;});await old.goto(url+'/before');const before=await collect(old);let castles=0,fields=0,hunts=0;
   report.beforeAfter=[];
   for(let i=0;i<before.length;i++){
    assert.deepStrictEqual(after[i].castles,before[i].castles,'Castle or dojo army changed at '+JSON.stringify(before[i].state));castles+=Object.keys(before[i].castles).length;
    const state=before[i].state,field=after[i].fieldScale;
    for(const id in before[i].fields){const a=before[i].fields[id],b=after[i].fields[id],ratio=b.power/Math.max(1,a.power);assert(Math.abs(ratio/field-1)<.13,'Actual field strength did not follow growth: '+JSON.stringify({state,id,a,b,ratio,field}));if(i===0)assert.deepStrictEqual(a,b,'Opening encounter changed');fields++;}
    for(const id in before[i].hunts){const a=before[i].hunts[id],b=after[i].hunts[id];for(let j=0;j<a.length;j++)for(const key of ['atk','def','hp','str','mrk'])assert(Math.abs((b[j][key]/a[j][key])-((1+2*((state.year-1)*.35+state.wins*.28)*.12)/(1+((state.year-1)*.35+state.wins*.28)*.12)))<1e-8,'Hunt growth not doubled');hunts++;}
    const id='fixture_banditarmy';report.beforeAfter.push({...state,castleScale:after[i].castleScale,fieldScale:+field.toFixed(3),bandBefore:before[i].fields[id],bandAfter:after[i].fields[id]});
   }
   report.comparison={unchangedCastleAndTrainingSnapshots:castles,fieldEncounters:fields,hunts};await old.close();
  }
  // Exercise the actual map renderer, tap target and march button with the new icon.
  await page.evaluate(()=>{Math.random=seeded(73117);newGame();G.tut=1;G.speed=0;G.boons=freshBoons();G.roll=null;$('#title').hidden=true;resizeView();afterLoad();MQ.length=0;$('#modal').hidden=true;
   G.camps=[];let band=null;for(let i=0;i<20&&!band;i++)band=spawnCamp(true);if(!band)throw Error('No valid on-land band location');
   Object.assign(band,{id:'map_band',clan:'ronin',mode:'skirmish',name:'Wandering Ronin'});G.prov.settsu.owner='kage';const rebel=spawnRebellion(siteById('settsu'));rebel.name='Peasant Uprising';
   MQ.length=0;$('#modal').hidden=true;openMap();MAPV.cam.z=1.6;mapCenterOn({x:(band.x+rebel.x)/2,y:(band.y+rebel.y)/2});clampMap();drawMap();});
  const beforeCanvases=await page.evaluate(()=>{for(let i=0;i<60;i++)drawMap();return Object.keys(_micon).length;});await page.evaluate(()=>{for(let i=0;i<120;i++)drawMap();});assert.strictEqual(await page.evaluate(()=>Object.keys(_micon).length),beforeCanvases,'Drawing creates new icon cache entries');
  fs.mkdirSync(path.join(root,'reports'),{recursive:true});await page.screenshot({path:path.join(root,'reports/enemy-growth-map.png')});
  const tap=await page.evaluate(()=>{const b=G.camps.find(c=>c.id==='map_band'),[x,y]=m2s(b.x,b.y),r=$('#map-cv').getBoundingClientRect();return{x:r.x+x,y:r.y+y};});await page.mouse.click(tap.x,tap.y);
  assert((await page.locator('#prov-card').textContent()).includes('Wandering Ronin'),'New icon is not selectable');await page.locator('#pc-go').click();assert.strictEqual(await page.evaluate(()=>G.march?.id),'map_band','New icon cannot start march');
  await page.evaluate(()=>{G.march=null;$('#prov-card').hidden=true;MAPV.sel=null;drawMap();});
  const out=path.join(root,'reports');
  const png=await page.evaluate(()=>{
   const c=gameCanvas();c.width=880;c.height=490;const x=c.getContext('2d');x.fillStyle='#e8d8b0';x.fillRect(0,0,c.width,c.height);x.imageSmoothingEnabled=false;
   x.fillStyle='#342a2a';x.font='bold 24px monospace';x.fillText('Roaming bands & local uprisings',24,38);x.font='15px monospace';x.fillText('Actual cached procedural map icons. Indigo bivouac / red rebel stronghold.',24,66);
   let col=0;for(const clan of ['bandit','ronin','wako','ikki']){const px=col++*215+18;x.fillStyle='#342a2a';x.font='17px monospace';x.fillText(CLANS[clan].name,px,101);for(const [row,kind]of ['band','fort'].entries()){const img=mapIcon(kind,false,CLANS[clan].banner);artDraw(x,img,px+26,125+row*176,img.width*4,img.height*4);x.font='14px monospace';x.fillText(row?'Rebel stronghold':'Roaming bivouac',px,258+row*176);artDraw(x,img,px+160,224+row*176,img.width,img.height);}}
   const png=c.toDataURL('image/png').split(',')[1];c.width=c.height=0;return png;
  });fs.writeFileSync(path.join(out,'band-icons-preview.png'),Buffer.from(png,'base64'));
  assert.deepStrictEqual(errors,[],'Browser errors');report.map={cached:true,selectable:true,canMarch:true,noGrowthAfter120Draws:true};fs.writeFileSync(path.join(out,'enemy-growth.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
 }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
