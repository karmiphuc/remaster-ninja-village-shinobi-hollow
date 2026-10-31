/* Built-in diagnostics. Off by default; no sampling, canvas registry or UI
   updates until requested. The in-page runner owns a fully isolated village. */
var SH_PERF={on:/(?:[?&])perf=1(?:&|$)/.test(location.search),sim:false,diag:null,
 frame:new Float32Array(120),fi:0,fn:0,last:0,stamp:0,rigDraws:0,lastRig:0,
 refs:new Map(),ids:new WeakMap(),uid:1,root:null,body:null,result:null,run:null,
 ledgerHooked:false,baseline:null,cacheLimits:{rig:1000,tools:96,carry:512,pile:160,products:48}};
function gameCanvas(){
 var c=document.createElement('canvas');
 if(SH_PERF.on||SH_PERF.sim)perfCanvas(c);
 return c;
}
function perfCanvas(c){
 if(!c||SH_PERF.ids.has(c)||typeof WeakRef!=='function')return c;
 var id=SH_PERF.uid++;SH_PERF.ids.set(c,id);SH_PERF.refs.set(id,new WeakRef(c));return c;
}
function perfRelease(value){
 if(!value)return;
 if(value instanceof HTMLCanvasElement){value.width=0;value.height=0;if(value.detail){value.detail.width=0;value.detail.height=0;}return;}
 if(value.cv)perfRelease(value.cv);
 if(value.img)perfRelease(value.img);
 if(value.hands)perfRelease(value.hands);
}
function perfLRU(M,max){
 var get=Map.prototype.get,set=Map.prototype.set;
 M.get=function(k){var v=get.call(this,k);if(v!==undefined){this.delete(k);set.call(this,k,v);}return v;};
 M.set=function(k,v){if(!this.has(k)&&this.size>=max){var old=this.keys().next().value;perfRelease(get.call(this,old));this.delete(old);}return set.call(this,k,v);};
 return M;
}
function perfObjectLRU(max){
 var data=Object.create(null),order=new Map();
 return new Proxy(data,{get:function(o,k){var v=o[k];if(v!==undefined){order.delete(k);order.set(k,1);}return v;},
 set:function(o,k,v){if(!Object.prototype.hasOwnProperty.call(o,k)&&order.size>=max){var old=order.keys().next().value;perfRelease(o[old]);delete o[old];order.delete(old);}o[k]=v;order.delete(k);order.set(k,1);return true;}});
}
function perfMemory(){
 var count=0,bytes=0;
 for(var pair of SH_PERF.refs){var c=pair[1].deref();if(!c){SH_PERF.refs.delete(pair[0]);continue;}if(c.width&&c.height){count++;bytes+=c.width*c.height*4;}}
 return {canvases:count,mb:bytes/1048576};
}
function perfCacheSizes(){
 return {rig:_villageRigCache.size,tools:_villageToolCache.size,carry:Object.keys(_carry).length,pile:Object.keys(_pile).length,products:Object.keys(_workshopProductSprites).length};
}
function perfCollections(){
 if(!G)return 0;var n=G.buildings.length+G.villagers.length+RT.agents.length;
 for(var b of G.buildings)n+=Object.keys(b.shelf||{}).length+Object.keys(b.inbox||{}).length+Object.keys(b.outs||{}).length;
 if(RT.eco)n+=(RT.eco.claims?RT.eco.claims.size:0)+(RT.eco.jobs?RT.eco.jobs.length:0);
 return n;
}
function perfFrame(now){
 if(!SH_PERF.on)return;
 if(SH_PERF.last){var d=now-SH_PERF.last;if(d>0&&d<1000){SH_PERF.frame[SH_PERF.fi]=d;SH_PERF.fi=(SH_PERF.fi+1)%120;SH_PERF.fn=Math.min(120,SH_PERF.fn+1);}}
 SH_PERF.last=now;if(now-SH_PERF.stamp<750||SH_PERF.sim)return;
 var elapsed=Math.max(.001,(now-SH_PERF.stamp)/1000),redraw=(SH_PERF.rigDraws-SH_PERF.lastRig)/elapsed;
 SH_PERF.lastRig=SH_PERF.rigDraws;SH_PERF.stamp=now;
 var ar=Array.from(SH_PERF.frame.slice(0,SH_PERF.fn)).sort(function(a,b){return a-b;}),sum=0;
 for(var v of ar)sum+=v;
 var m=perfMemory(),cs=perfCacheSizes(),kb=0,ms=0;
 if(G){var at=performance.now(),json=JSON.stringify(G);ms=performance.now()-at;kb=new Blob([json]).size/1024;}
 if(SH_PERF.body)SH_PERF.body.textContent=
  'FPS '+(sum?1000*ar.length/sum:0).toFixed(1)+' · p95 '+(ar.length?ar[Math.min(ar.length-1,Math.floor(ar.length*.95))]:0).toFixed(1)+' ms\n'+
  'Agents '+(RT.agents?RT.agents.length:0)+' · canvases '+m.canvases+' · '+m.mb.toFixed(1)+' MB\n'+
  'Rig redraws '+redraw.toFixed(1)+'/s · rig '+cs.rig+'/'+SH_PERF.cacheLimits.rig+' · tools '+cs.tools+'\n'+
  'Cargo '+cs.carry+' · piles '+cs.pile+' · products '+cs.products+'\n'+
  'Save '+kb.toFixed(1)+' KB / '+ms.toFixed(1)+' ms · economy entries '+perfCollections()+
  (redraw>150?' \nRig redraws high: compare cache limit and canvas MB.':'');
}
function perfUI(){
 if(SH_PERF.root)return;
 var root=document.createElement('section');root.id='perf-panel';
 root.style.cssText='position:fixed;z-index:190;right:max(8px,env(safe-area-inset-right));top:calc(58px + env(safe-area-inset-top));max-width:min(94vw,600px);max-height:80vh;overflow:auto;padding:10px;background:#211c20ed;color:#efdfb7;border:1px solid #b7955b;border-radius:4px;font:11px monospace;white-space:normal;box-shadow:0 4px 20px #0006';
 root.innerHTML='<div style="display:flex;gap:7px;align-items:center"><b style="flex:1">Village diagnostics</b><button id="perf-close">×</button></div><pre id="perf-metrics" style="white-space:pre-wrap;line-height:1.5"></pre><div style="display:flex;gap:6px;flex-wrap:wrap"><button id="perf-sim">Run sim test</button><button id="perf-copy">Copy report</button><button id="perf-cancel" hidden>Cancel</button></div><div id="perf-progress" style="margin-top:7px"></div><div id="perf-results" style="overflow:auto"></div>';
 document.body.appendChild(root);SH_PERF.root=root;SH_PERF.body=root.querySelector('#perf-metrics');
 root.querySelector('#perf-close').onclick=function(){root.hidden=true;SH_PERF.on=false;SH_PERF.last=0;};
 root.querySelector('#perf-sim').onclick=function(){runEconomySim();};
 root.querySelector('#perf-cancel').onclick=function(){if(SH_PERF.run)SH_PERF.run.cancel=true;};
 root.querySelector('#perf-copy').onclick=function(){var t=SH_PERF.result?JSON.stringify(SH_PERF.result,null,2):SH_PERF.body.textContent;
  if(navigator.clipboard&&navigator.clipboard.writeText)navigator.clipboard.writeText(t).catch(function(){perfCopyFallback(t);});else perfCopyFallback(t);};
}
function perfCopyFallback(t){var el=document.createElement('textarea');el.value=t;el.style.cssText='position:fixed;left:-9999px';document.body.appendChild(el);el.select();document.execCommand('copy');el.remove();}
function perfOpen(){SH_PERF.on=true;SH_PERF.last=0;perfUI();SH_PERF.root.hidden=false;document.querySelectorAll('canvas').forEach(perfCanvas);}
function perfInit(){
 var date=document.getElementById('hud-date'),timer=0;
 if(date){date.style.touchAction='manipulation';date.addEventListener('pointerdown',function(){timer=setTimeout(perfOpen,2000);});
 for(var k of ['pointerup','pointercancel','pointerleave'])date.addEventListener(k,function(){clearTimeout(timer);});}
 if(SH_PERF.on)perfOpen();
 if(/(?:[?&])simtest=1(?:&|$)/.test(location.search))setTimeout(function(){perfOpen();runEconomySim();},100);
}
function perfPrewarm(){
 var goods=Object.keys(GOODS).concat(Object.keys(WARES)),dirs=['up','down','right','left'];
 for(var good of goods){var k=visWare(good),one=carryKind(good,1),large=carryKind(good,30);
  for(var dir of dirs)for(var f=0;f<2;f++){carrySprite(one,dir,f,k);if(large!==one)carrySprite(large,dir,f,k);}
  for(var n=1;n<=4;n++)pileSprite(WARES[good]?'w_'+k:k,n);
 }
}
function diagGoods(key,n,created){var d=SH_PERF.diag;if(!d||!n)return;var map=created?d.created:d.destroyed;map[key]=(map[key]||0)+n;}
function diagInventory(out){
 for(var k in out)delete out[k];
 var add=function(k,n){if(n)out[k]=(out[k]||0)+n;};
 for(var k in G.stock)add(k,G.stock[k]);for(var k in G.wares)add(k,G.wares[k]);
 for(var b of G.buildings){if(BUILDINGS[b.id].makes)add(BUILDINGS[b.id].makes,b.pile||0);
  for(var key of ['inbox','outs','shopGoods','shopWares','shelf'])for(var k in b[key]||{})add(k,b[key][k]);}
 for(var a of RT.agents)if(a.carry)add(a.carry.good,a.carry.n);
 return out;
}
function diagNegatives(){
 var n=0,check=function(x){if(x<-.00000001)n++;};
 for(var k in G.stock)check(G.stock[k]);for(var k in G.wares)check(G.wares[k]);
 for(var b of G.buildings){check(b.pile||0);for(var key of ['inbox','outs','shopGoods','shopWares','shelf'])for(var k in b[key]||{})check(b[key][k]);}
 for(var a of RT.agents)if(a.carry)check(a.carry.n);return n;
}
function diagProbe(dt){
 var d=SH_PERF.diag;if(!d)return;
 for(var a of RT.agents){if(a.kind!=='villager')continue;var v=vById(a.vid);if(!v||v.role!=='work')continue;
  var porter=typeof isPorter==='function'&&isPorter(v),category=a.state==='work'?0:a.state==='walk'?(a.carry?1:2):a.resting?3:4;
  (porter?d.porter:d.worker)[category]+=dt;var b=v.job>=0?bByUid(v.job):null;
  if(!porter&&b&&(BUILDINGS[b.id].makes||BUILDINGS[b.id].craft))d.producer[category]+=dt;
 }
}
function diagSale(a,b,result,before){var d=SH_PERF.diag;if(!d)return;d.visits++;if(!result)d.stockouts++;d.sales+=G.stats.sales-before;}
function diagMapCopy(map){var out={};for(var k in map||{})out[k]=map[k];return out;}
function diagMapDelta(before,after,create){if(!SH_PERF.diag||SH_PERF.ledgerHooked)return;for(var k in create?after:before){var n=create?(after[k]||0)-(before[k]||0):(before[k]||0)-(after[k]||0);if(n>0)diagGoods(k,n,create);}}
function simStageStats(){
 return {created:{},destroyed:{},overflow:0,sales:0,visits:0,stockouts:0,turned:0,worker:[0,0,0,0,0],porter:[0,0,0,0,0],producer:[0,0,0,0,0],opening:{},ending:{},negatives:0,serialMs:0};
}
var SIM_CASES=[
 {id:'starter',tier:0,count:6,porters:0},{id:'small',tier:1,count:8,porters:0},
 {id:'mature',tier:2,count:12,porters:0},{id:'mature_2porters_same',tier:2,count:12,porters:2},
 {id:'mature_2porters_plus2',tier:2,count:14,porters:2},
 {id:'early_duplicates',tier:0,count:6,porters:0,duplicates:true},
 {id:'late',tier:3,count:20,porters:2},{id:'late_second_chain',tier:3,count:26,porters:2,chain:true},
 {id:'late_duplicate_shops',tier:3,count:20,porters:2,duplicates:true},
 {id:'demolish_and_roundtrip',tier:2,count:12,porters:2,failure:true}
];
function simPlace(id,x,y){var b=place(id,x,y,true);if(b)b.born=-9;return b;}
function simFixture(spec,seed){
 Math.random=seeded(seed);newGame();G.roll.v=false;G.tut=1;G.endYear=99;G.speed=1;G.gold=100000;
 G.villagers=[];G.buildings=[];G.bmap.fill(-1);G.roads.fill(0);G.tiles.fill('grass');
 for(var k in G.land)G.land[k]=true;
 for(var x=0;x<MAP_W;x++)for(var y of [10,11,22,23,34,35])G.roads[idx(x,y)]=1;
 for(var y=0;y<MAP_H;y++)for(var x of [20,21])G.roads[idx(x,y)]=1;
 G.gates=[[GATE[0],MAP_H-1,'S']];for(var y=35;y<MAP_H;y++)for(var x of [GATE[0]-1,GATE[0]])G.roads[idx(x,y)]=1;
 if(spec.tier>=2)G.gates.push([0,10,'W']);if(spec.tier>=3)G.gates.push([MAP_W-1,22,'E']);
 G.stock={rice:6,veg:0,tea:0,wood:0,ore:0,silk:0};G.wares={};G.troops={inf:0,arc:0,gun:0,cav:0};G.allHands=false;
 G.recruitQueue=[];G.camps=[];G.campSeeded=1;G.merch=null;G.research=null;G.resQ=[];G.hire=null;G.boons.pending=null;G.boons.doc=null;
 G.researched={bokken:1,hankyu:1,hemp:1,bandana:1};
 for(var k in ITEMS)if((ITEMS[k].tier||0)<=Math.max(1,spec.tier)&&k.indexOf('rcp_')!==0)G.researched[k]=1;
 G.forge={inf:false,arc:false,gun:false,cav:false};G.wins=spec.tier===3?16:spec.tier===2?5:0;
 var owned=spec.tier===3?24:spec.tier===2?6:0;
 for(var p of PROVINCES){G.prov[p.id]={owner:p.clan,power:p.power||0};if(p.type==='clan'&&owned-->0)G.prov[p.id].owner='kage';}
 simPlace('hall',17,7);
 var paddy=simPlace('paddy',2,8);simPlace('paddy',5,8);simPlace('onigiri',24,8);
 if(spec.tier>=1){simPlace('veggie',8,8);simPlace('pickle',27,8);simPlace('noodle',30,8);var w=simPlace('workshop',11,12);w.recipe='bento';}
 if(spec.tier>=2){simPlace('paddy',11,8);simPlace('veggie',14,8);simPlace('teafield',2,12);simPlace('lumber',5,12);simPlace('mine',8,12);
  var w=simPlace('workshop',14,12);w.recipe='kokeshi';simPlace('teahouse',33,8);simPlace('crafts',36,8);simPlace('smithy',39,8);simPlace('kura',17,12);
  for(var pt of [[4,14],[6,14],[7,15],[3,15]])simPlace('pine',pt[0],pt[1]);}
 if(spec.tier>=3){simPlace('paddy',2,20);simPlace('veggie',5,20);simPlace('teafield',8,20);simPlace('silkhut',11,20);simPlace('kimono',33,20);
  var w=simPlace('workshop',14,20);w.recipe='kimono';simPlace('kura',24,20);
  for(var pt of [[1,15],[9,15],[12,15],[15,15],[27,15],[30,15],[33,15],[36,15]])simPlace('sakura',pt[0],pt[1]);
  for(var pt of [[25,15],[28,15],[31,15],[34,15]])simPlace('lantern',pt[0],pt[1]);}
 if(spec.duplicates){simPlace('onigiri',24,24);simPlace(spec.tier>=3?'noodle':'onigiri',27,24);}
 if(spec.chain){simPlace('paddy',2,24);simPlace('paddy',5,24);simPlace('veggie',8,24);var w=simPlace('workshop',11,24);w.recipe='bento';}
 for(var i=0;i<Math.ceil(spec.count/4);i++)simPlace('longhouse',2+i*3,32);
 if(spec.porters){if(!BUILDINGS.porter)BUILDINGS.porter={name:'Porter House (baseline placeholder)',cat:'special',w:2,h:2,cost:0,noBuild:true};
  var depot=simPlace('porter',22,12);}
 var roster=VILLAGER_POOL.concat(RECRUITS);for(var i=0;i<spec.count;i++){var v=addVillager(roster[i].id,true);v.role='work';v.lv=spec.tier>=3?8:spec.tier>=2?4:1;v.en=100;v.eq={weapon:null,armor:spec.tier?'hemp':null,head:spec.tier?'bandana':null,special:spec.tier>=2?'tenbin':null,special2:null,mount:null};}
 resetRT();RT.t=0;RT.ready=false;RT._aw=null;assignHomes();assignJobs();
 if(depot&&typeof isPorter==='function'){var sorted=G.villagers.slice().sort(function(a,b){return vStats(a).wrk-vStats(b).wrk;});for(var i=0;i<spec.porters;i++)sorted[i].job=depot.uid;assignJobs();}
 afterLoad();RT.ready=true;refreshBoosts();RT.paused=false;G.speed=1;
 VIEW.cx=21*16;VIEW.cy=17*16;VIEW.w=430;VIEW.h=739;VIEW.dpr=2;VIEW.zoom=2;VIEW.scale=4;
 VIEW.cv.width=860;VIEW.cv.height=1478;VIEW.ctx=VIEW.cv.getContext('2d');RT.groundDirty=true;
 return {depot:depot?depot.uid:-1,first:paddy.uid};
}
function simSnapshotObject(o){var r={};for(var k in o)r[k]=o[k];return r;}
function simRestoreObject(o,b){for(var k in o)if(!(k in b))delete o[k];for(var k in b)o[k]=b[k];}
function simPrepare(){
 var S={G:G,RT:simSnapshotObject(RT),VIEW:simSnapshotObject(VIEW),UI:simSnapshotObject(UI),road:simSnapshotObject(ROAD_TRAFFIC),land:JSON.parse(JSON.stringify(LAND)),
 random:Math.random,save:saveGame,load:loadGame,modal:modal,announce:announce,toast:toast,noIntro:window.__noIntro,noQuick:window.__noQuick,
 sound:{},placeholder:BUILDINGS.porter||null,timer:setTimeout,clear:clearTimeout,timers:[],cancel:false,index:0,seedIndex:0,step:0,
 rows:[],steps:Math.round(52*WEEK_SEC/.1),weekMs:0,mutated:0,mem:null,canvas:gameCanvas()};
 for(var k in Sound)if(typeof Sound[k]==='function'){S.sound[k]=Sound[k];Sound[k]=function(){};}
 saveGame=function(){return true;};loadGame=function(){return false;};modal=function(){};announce=function(){};toast=function(){};
 window.__noIntro=window.__noQuick=true;UI.panel=null;UI.render=null;UI.atelier=false;
 window.setTimeout=function(fn,delay){var id=S.timer(function(){if(SH_PERF.sim)fn();},delay);S.timers.push(id);return id;};
 VIEW.cv=S.canvas;VIEW.ctx=S.canvas.getContext('2d');SH_PERF.sim=true;SH_PERF.run=S;return S;
}
function simRestore(S){
 for(var id of S.timers)S.clear(id);window.setTimeout=S.timer;window.clearTimeout=S.clear;
 G=S.G;simRestoreObject(RT,S.RT);simRestoreObject(VIEW,S.VIEW);simRestoreObject(UI,S.UI);simRestoreObject(ROAD_TRAFFIC,S.road);
 for(var k in LAND)LAND[k]=S.land[k];Math.random=S.random;saveGame=S.save;loadGame=S.load;modal=S.modal;announce=S.announce;toast=S.toast;
 for(var k in S.sound)Sound[k]=S.sound[k];window.__noIntro=S.noIntro;window.__noQuick=S.noQuick;
 if(!S.placeholder)delete BUILDINGS.porter;else BUILDINGS.porter=S.placeholder;
 S.canvas.width=S.canvas.height=0;SH_PERF.diag=null;SH_PERF.sim=false;SH_PERF.run=null;SH_PERF.last=0;
 if(SH_PERF.root)SH_PERF.root.querySelector('#perf-cancel').hidden=true;
}
function simFailureStep(S,spec){
 if(!spec.failure||S.mutated)return;
 var found=null;
 for(var a of RT.agents)if(a.kind==='villager'&&a.carry){var b=bByUid(a.target);if(b&&(b.id==='kura'||BUILDINGS[b.id].cat==='shop')){found=b;break;}}
 if(S.step<900||!found&&S.step<1500)return;
 if(found)removeBuilding(found);else {var shops=G.buildings.filter(function(b){return BUILDINGS[b.id].cat==='shop';});if(shops.length)removeBuilding(shops[0]);}
 var d=SH_PERF.diag;
 for(var a of RT.agents)if(a.carry){dropLost(a);a.mission=null;}
 if(typeof economyBeforeSave==='function')economyBeforeSave();
 var start=performance.now(),json=JSON.stringify(G);d.serialMs=Math.max(d.serialMs,performance.now()-start);
 G=JSON.parse(json);resetRT();afterLoad();G.speed=1;RT.paused=false;UI.panel=null;S.mutated=1;
}
function simFinishRow(S,spec){
 var d=SH_PERF.diag;diagInventory(d.ending);var residual=0,detail={};
 var keys=new Set(Object.keys(d.opening).concat(Object.keys(d.ending),Object.keys(d.created),Object.keys(d.destroyed)));
 for(var key of keys){var n=(d.ending[key]||0)-(d.opening[key]||0)-(d.created[key]||0)+(d.destroyed[key]||0);if(Math.abs(n)<1e-8)n=0;if(n)detail[key]=n;residual+=Math.abs(n);}
 var normalize=function(ar){var sum=0;for(var v of ar)sum+=v;return ar.map(function(v){return sum?v/sum*100:0;});};
 var at=performance.now(),json=JSON.stringify(G),saveMs=performance.now()-at,m=perfMemory();
 S.rows.push({scenario:spec.id,seed:S.seedIndex+1,gold:d.sales,travellers:G.stats.trav,stockout:d.visits?d.stockouts/d.visits*100:0,turnedAway:d.turned,
 worker:normalize(d.worker),porter:normalize(d.porter),producer:normalize(d.producer),overflowLost:d.overflow,residual:residual,residualByGood:detail,
 negatives:d.negatives,saveKB:new Blob([json]).size/1024,saveMs:Math.max(saveMs,d.serialMs),canvasStart:S.memStart.mb,canvasEnd:m.mb,caches:perfCacheSizes(),
 collections:perfCollections(),msPerWeek:S.weekMs/52,failureExercised:!spec.failure||!!S.mutated});
}
function simReport(rows){
 var report={version:typeof ECONOMY_P0!=='undefined'?'P0':'baseline',weeks:52,seeds:5,
 timeOrder:['work','haul-loaded','walk-empty','rest','idle'],rows:rows,summary:[],baseline:SH_PERF.baseline||null};
 for(var spec of SIM_CASES){var list=rows.filter(function(r){return r.scenario===spec.id;});if(!list.length)continue;
  var row={scenario:spec.id};for(var key of ['gold','travellers','stockout','turnedAway','overflowLost','residual','negatives','saveKB','canvasStart','canvasEnd','msPerWeek','collections']){var sum=0;for(var r of list)sum+=r[key];row[key]=sum/list.length;}
  row.worker=[0,0,0,0,0];row.porter=[0,0,0,0,0];row.producer=[0,0,0,0,0];
  for(var r of list)for(var key of ['worker','porter','producer'])for(var i=0;i<5;i++)row[key][i]+=r[key][i]/list.length;
  report.summary.push(row);
 }
 return report;
}
function simRenderReport(report){
 if(!SH_PERF.root)return;var box=SH_PERF.root.querySelector('#perf-results'),html='<table style="border-collapse:collapse;white-space:nowrap;font:10px monospace"><thead><tr>';
 for(var k of ['Scenario','Gold/52w','Trav','Stockout %','Away','Worker W/H/E/R/I %','Porter W/H/E/R/I %','Lost','Residual','Neg','KB','MB start/end','ms/wk'])html+='<th style="padding:5px;border-bottom:1px solid #846d4b">'+k+'</th>';
 html+='</tr></thead><tbody>';
 for(var r of report.summary){var cells=[r.scenario,r.gold.toFixed(0),r.travellers.toFixed(0),r.stockout.toFixed(1),r.turnedAway.toFixed(0),r.worker.map(function(v){return v.toFixed(0);}).join('/'),r.porter.map(function(v){return v.toFixed(0);}).join('/'),r.overflowLost.toFixed(0),r.residual.toFixed(8),r.negatives.toFixed(0),r.saveKB.toFixed(1),r.canvasStart.toFixed(1)+'/'+r.canvasEnd.toFixed(1),r.msPerWeek.toFixed(1)];
 html+='<tr>';for(var v of cells)html+='<td style="padding:5px;border-bottom:1px solid #493e30">'+v+'</td>';html+='</tr>';}
 box.innerHTML=html+'</tbody></table><p>52 weeks × five paired seeds. Loaded haul excludes empty pickup legs. P1 demand/service changes are not enabled.</p>';
}
function runEconomySim(){
 if(SH_PERF.sim)return Promise.reject(new Error('A simulation is already running'));
 perfOpen();var S=simPrepare();SH_PERF.root.querySelector('#perf-cancel').hidden=false;
 SH_PERF.root.querySelector('#perf-results').textContent='';var progress=SH_PERF.root.querySelector('#perf-progress');
 return new Promise(function(resolve,reject){
  var begin=function(){var spec=SIM_CASES[S.index];SH_PERF.diag=null;simFixture(spec,0x534800+S.seedIndex+1);S.step=0;S.weekMs=0;S.mutated=0;
   SH_PERF.diag=simStageStats();diagInventory(SH_PERF.diag.opening);S.memStart=perfMemory();S.createdRig=SH_PERF.rigDraws;};
  var chunk=function(){try{
   if(S.cancel){simRestore(S);progress.textContent='Cancelled. Original village restored.';resolve({cancelled:true});return;}
   if(S.step===0&&S.weekMs===0)begin();var until=performance.now()+12,spec=SIM_CASES[S.index],n=0;
   while(S.step<S.steps&&performance.now()<until&&n++<150){var at=performance.now();updateVillage(.1);diagProbe(.1);simFailureStep(S,spec);S.step++;
    if(S.step%10===0)drawVillage();if(S.step%90===0)SH_PERF.diag.negatives+=diagNegatives();S.weekMs+=performance.now()-at;}
   progress.textContent=(SH_PERF.ledgerHooked?'P0':'Baseline')+' · '+spec.id+' · seed '+(S.seedIndex+1)+'/5 · week '+Math.min(52,Math.floor(S.step*.1/WEEK_SEC))+'/52';
   if(S.step>=S.steps){simFinishRow(S,spec);S.seedIndex++;if(S.seedIndex>=5){S.seedIndex=0;S.index++;}S.step=0;S.weekMs=0;
    if(S.index>=SIM_CASES.length){var report=simReport(S.rows);simRestore(S);SH_PERF.result=report;simRenderReport(report);progress.textContent='Complete. Original village restored.';console.log('ECONOMY_REPORT='+JSON.stringify(report));resolve(report);return;}}
   S.timer(chunk,0);
  }catch(e){simRestore(S);progress.textContent='Test stopped: '+e.message+'. Original village restored.';reject(e);}};
  S.timer(chunk,0);
 });
}
