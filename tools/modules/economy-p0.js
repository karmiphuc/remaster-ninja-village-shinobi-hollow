/* Runtime mirror of the standalone game. Navigation and agent lifecycle changes
   in index.html are also required; historical builder scripts are not a current build system. */
function wantsGood(w,g) {
 if((w.inbox&&w.inbox[g]||0)>=INBOX_CAP)return false;
 for(const k in WARES)if(wareKnown(k)&&WARES[k].from[g]&&craftNeed(w,k)>0)return true;
 return false;
}
function craftSupplySnapshot(component){
 const E=economyState();let entry=E.supplyCache.get(component);
 if(!entry){if(E.supplyCache.size>=8)E.supplyCache.delete(E.supplyCache.keys().next().value);
  entry={revision:-1,counts:Object.create(null),markets:Object.create(null)};E.supplyCache.set(component,entry);}
 if(entry.revision===E.goodsRevision)return entry;
 const counts=entry.counts;for(const w in WARES)counts[w]=G.wares[w]||0;
 for(const b of E.crafts)if(!component||economyBuildingComponent(b,component))for(const w in b.outs)if(WARES[w])counts[w]+=b.outs[w];
 for(const a of RT.agents){
  if(a.dead)continue;
  const x=clamp(Math.round((a.x-8)/16),0,MAP_W-1),y=clamp(Math.round((a.y-12)/16),0,MAP_H-1);
  const c=E.components[idx(x,y)]||(a.entryTile?E.components[idx(a.entryTile[0],a.entryTile[1])]:0);
  if(component&&c!==component)continue;
  if(a.carry&&WARES[a.carry.good])counts[a.carry.good]+=a.carry.n;
  for(const w in a.freight)if(WARES[w])counts[w]+=a.freight[w];
 }
 for(const c of E.crafting.values())if(!component||economyBuildingComponent(c.site,component))counts[c.w]+=c.n;
 entry.revision=E.goodsRevision;return entry;
}
function craftSupply(w,site,except){
 const E=economyState(),component=site?economyBuildingComponent(site):0;let n=craftSupplySnapshot(component).counts[w]||0;
 if(except&&except.w===w&&E.crafting.get(except.agent)===except&&(!component||economyBuildingComponent(except.site,component)))n-=except.n;
 return n;
}
function craftContractNeed(w,except){return Math.max(0,tradeHold(w)*2-craftSupply(w,null,except));}
function craftMarketState(site,w){
 const E=economyState(),component=economyBuildingComponent(site),entry=craftSupplySnapshot(component),key=E.marketKeys[w];
 let view=entry.markets[key];if(!view){view={revision:-1,contracts:null,contractN:-1,accepted:Object.create(null),balance:0,urgent:false};entry.markets[key]=view;}
 const cs=G.trade&&G.trade.cs,n=cs?cs.length:0;
 if(view.revision===E.goodsRevision&&view.contracts===cs&&view.contractN===n)return view;
 const R=WARES[w];let room=0,supply=0;view.urgent=false;
 for(const k in WARES)view.accepted[k]=false;
 for(const b of E.shops)if(component>0&&R.shops.includes(b.id)&&economyBuildingComponent(b,component)){
  const stock=shopTotal(b,true);room+=Math.max(0,SHOP_CAP-stock);if(stock<3)view.urgent=true;
  for(const k in WARES)if(WARES[k].shops.includes(b.id))view.accepted[k]=true;
 }
 for(const k in WARES)if(view.accepted[k])supply+=Math.max(0,entry.counts[k]-tradeHold(k)*2);
 // Keep the unclamped balance so excluding one's own batch cannot hide surplus.
 view.balance=room-supply;view.revision=E.goodsRevision;view.contracts=cs;view.contractN=n;return view;
}
function craftShopNeed(site,w,except){
 const E=economyState(),view=craftMarketState(site,w);let balance=view.balance;
 if(except&&view.accepted[except.w]&&E.crafting.get(except.agent)===except&&economyBuildingComponent(except.site,economyBuildingComponent(site))){
  const supply=craftSupplySnapshot(economyBuildingComponent(site)).counts[except.w],held=tradeHold(except.w)*2;
  balance+=Math.max(0,supply-held)-Math.max(0,supply-except.n-held);
 }
 return Math.max(0,Math.floor(balance));
}
function craftNeed(site,w,except){return craftContractNeed(w,except)+craftShopNeed(site,w,except);}
function craftRoom(site,except){
 let n=OUT_CAP-outTotal(site);for(const c of economyState().crafting.values())if(c!==except&&c.site===site)n-=c.n;
 return Math.max(0,Math.floor(n));
}
function craftRank(site,w){
 if(craftContractNeed(w)>0)return 4;
 if(craftMarketState(site,w).urgent)return 3;
 return site.recipe===w?2:1;
}
function chooseCraft(J){
 const E=economyState();if(E.dirty)economyTopology();let best=null,score=-1;
 const room=craftRoom(J),input=economyPoint(J,'inbox');if(!room)return null;
 for(const w in WARES){
  if(!wareKnown(w))continue;
  const R=WARES[w],need=Math.min(5,room,Math.floor(craftNeed(J,w)));if(need<1)continue;
  let n=need,fetch=null,possible=true;
  for(const g in R.from){
   const have=economyAvailable(input,g),incoming=economyReserved(input,g,true);
   n=Math.min(n,Math.floor(have/R.from[g]));
   if(have+incoming+spendableGood(g)<R.from[g])possible=false;
   if(!fetch&&have+incoming<R.from[g]&&spendableGood(g)>=1)fetch=g;
  }
  if(n<1&&(!possible||!fetch))continue;
  const rank=craftRank(J,w),value=rank*1000+(n>=1?100:0)+(J.recipe===w?30:0)+need;
  if(value>score){score=value;best=n>=1?{w,mode:'craft',n}:{w,mode:'fetch',g:fetch,n:need};}
 }
 return best;
}
function craftRelease(a){
 const E=RT.eco;if(E&&E.crafting.delete(a))E.goodsRevision++;a.craftBatch=0;a.craftWare=null;
}
function craftReserve(a,v,site,w,n){
 craftRelease(a);if(a.carry||economyFreightTotal(a)||!entranceOf(site))return null;economyRelease(a);
 const E=economyState(),R=WARES[w];if(!R||!wareKnown(w)||E.crafting.size>=128)return null;
 const input=economyPoint(site,'inbox');n=Math.min(5,Math.floor(n||5),craftRoom(site),Math.floor(craftNeed(site,w)));
 for(const g in R.from)n=Math.min(n,Math.floor(economyAvailable(input,g)/R.from[g]));
 if(n<1)return null;
 const c={agent:a,site,w,n,until:E.t+120,lastX:a.x,lastY:a.y};E.crafting.set(a,c);E.goodsRevision++;a.craftWare=w;a.craftBatch=n;return c;
}
function craftCycleTime(site,v,n){
 const s=vStats(v),mul=workMul(v);
 const base=clamp(5.5/(1+s.wrk/22),1.5,5.5)/mul*1.25/(1+s.craft)*1.25;
 // Preserve the former Work/Fine Craft yield benefit as efficiency. Every unit
 // now pays its complete recipe; a five-unit batch takes 2.12 single-unit cycles.
 const efficiency=clamp((s.wrk-6)/30*mul*(1+(site.boost||0))+s.craft,0,.75);
 return base*(1+.28*(n-1))/(1+efficiency);
}
/* Logistics P0: central storage, physical shelves and optional dedicated haulers.
   Runtime endpoints, jobs and claims never enter the save. */
const ECONOMY_P0=1;
// An absent policy preserves old saves. Only disabled raw materials enter G.
function materialSalesAllowed(good){return !G.materialSales||G.materialSales[good]!==false;}
function shopRawSalesAllowed(b){const B=BUILDINGS[b.id];return !B.needWares&&B.sells.length>0&&B.sells.every(materialSalesAllowed);}
function setMaterialSales(good,enabled){
 if(good&&!GOODS[good])return;
 if(!G.materialSales)G.materialSales={};
 for(const g in GOODS)if(!good||g===good){if(enabled)delete G.materialSales[g];else G.materialSales[g]=false;}
 if(!Object.keys(G.materialSales).length)delete G.materialSales;
 const E=economyState();if(E.dirty)economyTopology();
 // Cancel only affected lines; mixed loads keep their wares and second stop.
 for(const c of E.claims.values()){
  if(c.to.kind==='shelf'&&!WARES[c.good]&&!shopRawSalesAllowed(c.target)||!c.picked&&c.from.kind==='shelf'&&!WARES[c.good]&&shopRawSalesAllowed(c.source))c.n=0;
  if(c.extra)for(const l of c.extra)if(l.to.kind==='shelf'&&!WARES[l.good]&&!shopRawSalesAllowed(economyLineTarget(c,l))||!c.picked&&l.from.kind==='shelf'&&!WARES[l.good]&&shopRawSalesAllowed(c.source))l.n=0;
  const a=c.agent,stop=economyStop(c);
  if(!stop){economyRelease(a);a.mission=null;a.path.length=0;a.state='idle';a.timer=0;if(a.carry||economyFreightTotal(a))returnShopCarry(a);}
  else if(c.picked&&a.target!==stop.uid&&!economyContinueTrip(a,c)){dropLost(a);a.mission=null;a.state='idle';a.path.length=0;}
 }
 E.goodsRevision++;economyJobs();Sound.play('tap');
}
function materialSalesPanel(){
 let all=true;for(const g in GOODS)if(!materialSalesAllowed(g))all=false;
 const box=h(`<div><div class="sec">Shop material sales ${ib('Control raw-material retail across the village. Disabled materials stop selling and restocking; workers or porters return existing raw shelf stock to storage. Shops that combine ingredients pause their whole raw recipe if one is disabled. Crafted wares, workshop inputs and Ton’ya contracts are unaffected.')}</div><div class="row wrap"><button class="btn ${all?'ghost':'gold'}" data-material-all>${all?'Pause all materials':'Allow all materials'}</button></div><div class="row wrap" style="margin-top:8px">${Object.keys(GOODS).map(g=>`<button class="btn ${materialSalesAllowed(g)?'gold':'ghost'}" data-material="${g}" aria-pressed="${materialSalesAllowed(g)}">${icon('g_'+g)} ${esc(GOODS[g].name)} · ${materialSalesAllowed(g)?'On':'Off'}</button>`).join('')}</div><p class="note">Wares stay on sale. Raw stock returns by carrier when a route is available.</p></div>`);
 box.querySelector('[data-material-all]').onclick=()=>{setMaterialSales(null,!all);refreshSheet();};
 for(const bt of box.querySelectorAll('[data-material]'))bt.onclick=()=>{const g=bt.dataset.material;setMaterialSales(g,!materialSalesAllowed(g));refreshSheet();};
 return box;
}
BUILDINGS.porter={name:'Porter House',jp:'荷運び小屋',cat:'ind',tab:'ind',w:2,h:2,cost:240,slots:2,appeal:1,
 desc:'Assign up to two porters by hand. They collect harvests and wares, supply artisans and restock shop shelves with handcarts. Ordinary workers still haul without them.'};
if(!BUILD_ORDER.includes('porter'))BUILD_ORDER.splice(BUILD_ORDER.indexOf('kura')+1,0,'porter');
SH_PERF.ledgerHooked=true;
function economyState(){
 let E=RT.eco;if(E&&E.owner===G)return E;
 E={owner:G,t:0,next:0,dirty:true,points:new WeakMap(),entrances:new WeakMap(),access:new WeakMap(),crafting:new Map(),supplyCache:new Map(),marketKeys:Object.create(null),goodsRevision:0,components:new Int16Array(MAP_W*MAP_H),queue:new Int16Array(MAP_W*MAP_H),roadRevision:-1,nextPoint:1,claims:new Map(),nextClaim:1,
 jobs:[],jobCount:0,shops:[],producers:[],crafts:[],stores:[],porters:0,workers:0,collectorAt:0,collectorHires:0,
 events:SH_PERF.on?Array.from({length:200},()=>({t:0,reason:'',good:'',n:0})):null,eventAt:0,eventN:0,moved:0,created:0,destroyed:0,overflows:0};
 for(const w in WARES)E.marketKeys[w]=WARES[w].shops.slice().sort().join('|');
 for(let i=0;i<128;i++)E.jobs.push({from:null,to:null,good:null,n:0,rank:0,source:null,target:null});
 RT.eco=E;return E;
}
function economyPoint(owner,kind){
 const E=economyState();let parts=E.points.get(owner);
 if(!parts){parts=Object.create(null);E.points.set(owner,parts);}
 return parts[kind]||(parts[kind]={owner:owner,kind:kind,id:E.nextPoint++});
}
function economyCentral(good){return economyPoint(G,WARES[good]?'wares':'stock');}
function economyMap(p,good){
 const o=p.owner;
 if(p.kind==='stock'||p.kind==='wares')return o[p.kind]||(o[p.kind]={});
 if(p.kind==='shelf')return shopStock(o,!!WARES[good]);
 if(p.kind==='freight')return o.freight||(o.freight={});
 if(p.kind==='legacyRaw')return o.shopGoods||(o.shopGoods={});
 if(p.kind==='legacyWare')return o.shopWares||(o.shopWares={});
 return o[p.kind]||(o[p.kind]={});
}
function economyCount(p,good){
 if(!p)return 0;const o=p.owner;
 if(p.kind==='pile'||p.kind==='buffer')return BUILDINGS[o.id].makes===good?(o[p.kind]||0):0;
 if(p.kind==='oldOut')return o.recipe===good?(o.out||0):0;
 if(p.kind==='carry')return o.carry&&o.carry.good===good?o.carry.n:0;
 return economyMap(p,good)[good]||0;
}
function economyWrite(p,good,n){
 const o=p.owner;n=Math.abs(n)<1e-9?0:n;
 if(p.kind==='pile'||p.kind==='buffer'){o[p.kind]=n;return;}
 if(p.kind==='oldOut'){o.out=n;return;}
 if(p.kind==='carry'){setCarry(o,good,n);return;}
 const map=economyMap(p,good);if(n)map[good]=n;else delete map[good];
}
function economyNote(reason,good,n,kind){
 const E=economyState();E.goodsRevision++;if(kind===1)E.created+=n;else if(kind===-1)E.destroyed+=n;else E.moved+=n;
 if(E.events){const item=E.events[E.eventAt];item.t=Math.round(E.t*10)/10;item.reason=reason;item.good=good;item.n=n;E.eventAt=(E.eventAt+1)%200;E.eventN=Math.min(200,E.eventN+1);}
}
function moveGoods(from,to,key,n,reason){
 if(!from||!to||from===to||!Number.isFinite(n)||n<=0)return 0;if(to.kind==='carry'&&to.owner.carry&&to.owner.carry.good!==key)return 0;
 n=Math.min(n,Math.max(0,economyCount(from,key)));if(n<=0)return 0;
 economyWrite(from,key,economyCount(from,key)-n);economyWrite(to,key,economyCount(to,key)+n);
 economyNote(reason||'transfer',key,n,0);return n;
}
function createGoods(to,key,n,reason){
 if(!to||!Number.isFinite(n)||n<=0)return 0;
 economyWrite(to,key,economyCount(to,key)+n);economyNote(reason||'production',key,n,1);diagGoods(key,n,true);return n;
}
function destroyGoods(from,key,n,reason){
 if(!from||!Number.isFinite(n)||n<=0)return 0;n=Math.min(n,Math.max(0,economyCount(from,key)));if(n<=0)return 0;
 economyWrite(from,key,economyCount(from,key)-n);economyNote(reason||'consumption',key,n,-1);diagGoods(key,n,false);return n;
}
function economyReserved(p,good,incoming,except){
 let n=0;for(const c of economyState().claims.values()){if(c===except||!incoming&&c.picked)continue;
  if(c.good===good&&(incoming?c.to===p:c.from===p))n+=c.n;
  if(c.extra)for(const l of c.extra)if(l.good===good&&(incoming?l.to===p:l.from===p))n+=l.n;
 }
 if(!incoming&&p.kind==='inbox')for(const c of economyState().crafting.values())if(c!==except&&c.site===p.owner)n+=c.n*(WARES[c.w].from[good]||0);
 return n;
}
function economyAvailable(p,good,except){
 let n=economyCount(p,good)-economyReserved(p,good,false,except);
 if(p.owner===G)n-=tradeHold(good);return Math.max(0,n);
}
function spendableGood(good){return economyAvailable(economyCentral(good),good);}
function economyRoom(p,good,except){
 if(p.kind==='shelf')return shopRoom(p.owner,good,except&&except.agent);
 if(p.kind==='inbox')return Math.max(0,INBOX_CAP+4-economyCount(p,good)-economyReserved(p,good,true,except));
 return Infinity;
}
function economyClaim(a,from,to,good,n,source,target){
 if(a.carry||economyFreightTotal(a))return null;
 economyRelease(a);if(!source||!target||source.reno||target.reno)return null;
 const E=economyState();if(E.dirty)economyTopology();const component=economyAgentComponent(a);if(!component||!economyBuildingComponent(source,component)||!economyBuildingComponent(target,component))return null;n=Math.min(n,economyAvailable(from,good),economyRoom(to,good));if(!(n>0))return null;
 if(E.claims.size>=128)return null;
 const c={id:E.nextClaim++,agent:a,from:from,to:to,good:good,n:n,source:source,target:target,picked:false,extra:null,until:E.t+100,lastX:a.x,lastY:a.y};
 E.claims.set(c.id,c);a.goodsClaim=c.id;return c;
}
function economyRelease(a){
 if(!a)return;const E=RT.eco;if(E&&a.goodsClaim)E.claims.delete(a.goodsClaim);a.goodsClaim=0;
}
function economyClaimOf(a){return a.goodsClaim?economyState().claims.get(a.goodsClaim):null;}
function isPorter(v){const b=v&&v.role==='work'&&v.job>=0?bByUid(v.job):null;return !!b&&b.id==='porter';}
function economyTopology(){
 const E=economyState();if(E.roadRevision!==ROAD_TRAFFIC.revision)economyComponents(E);E.shops.length=E.producers.length=E.crafts.length=E.stores.length=0;E.porters=E.workers=E.collectorHires=0;
 for(const b of G.buildings){if(b.collectorHire)E.collectorHires++;const B=BUILDINGS[b.id],e=b.reno?null:entranceOf(b),access=[];E.entrances.set(b,e);E.access.set(b,access);if(!e)continue;
  for(const t of roadEntranceTiles(b)){const n=E.components[idx(t[0],t[1])];if(n&&!access.includes(n))access.push(n);}
  if(shopIs(b))E.shops.push(b);if(B.makes)E.producers.push(b);if(B.craft)E.crafts.push(b);if(B.store||b.id==='hall')E.stores.push(b);}
 E.producers.sort(collectorUidOrder); // UID cursors survive demolition and save/load.
 E.porterComps=new Set();
 for(const v of G.villagers)if(v.role==='work'){E.workers++;if(isPorter(v)){E.porters++;const h=bByUid(v.job),c=h&&economyBuildingComponent(h);if(c)E.porterComps.add(c);}}
 E.dirty=false;E.goodsRevision++;collectorPruneVisits();
}
function economyNearStore(from,preferred=0){
 const E=economyState();let best=null,score=Infinity;
 for(let i=0;i<E.stores.length;i++){const b=E.stores[i];if(!economyConnected(from,b)||preferred&&!economyBuildingComponent(b,preferred))continue;const d=Math.abs(b.x-from.x)+Math.abs(b.y-from.y);if(d<score){score=d;best=b;}}return best;
}
function economyOutputTarget(good,from,preferred=0){
 const E=economyState(),ware=!!WARES[good];let best=null,score=-Infinity;
 if(tradeHold(good)*(ware?2:1)>economyCount(economyCentral(good),good))return economyNearStore(from,preferred);
 for(let i=0;i<E.shops.length;i++){const b=E.shops[i];if(!economyConnected(from,b)||preferred&&!economyBuildingComponent(b,preferred))continue;const room=shopRoom(b,good);if(room<=0)continue;
  const s=(shopTotal(b,ware)<1?28:12)+Math.min(10,room)-.35*(Math.abs(b.x-from.x)+Math.abs(b.y-from.y));
  if(s>score){score=s;best=b;}}
 if(!ware)for(let i=0;i<E.crafts.length;i++){const b=E.crafts[i];if(!economyConnected(from,b)||preferred&&!economyBuildingComponent(b,preferred)||!wantsGood(b,good))continue;
  const p=economyPoint(b,'inbox'),room=economyRoom(p,good);if(room<1)continue;
  const s=(economyCount(p,good)<2?23:8)+Math.min(8,room)-.35*(Math.abs(b.x-from.x)+Math.abs(b.y-from.y));
  if(s>score){score=s;best=b;}}
 return best||economyNearStore(from,preferred);
}
function economyDestination(b,good){
 if(shopIs(b))return economyPoint(b,'shelf');
 if(BUILDINGS[b.id].craft&&!WARES[good])return economyPoint(b,'inbox');
 return economyCentral(good);
}
function economyJob(from,to,good,n,rank,source,target){
 const E=economyState();if(E.jobCount>=128||!source||!target||source===target)return;
 n=Math.min(n,economyAvailable(from,good),economyRoom(to,good));if(n<1)return;
 const j=E.jobs[E.jobCount++];j.from=from;j.to=to;j.good=good;j.n=n;j.rank=rank;j.source=source;j.target=target;
}
function economyFlush(b){
 const B=BUILDINGS[b.id];if(B.makes&&(b.buffer||0)>0)moveGoods(economyPoint(b,'buffer'),economyPoint(b,'pile'),B.makes,Math.max(0,PILE_CAP-(b.pile||0)),'finish-harvest');
 
}
function economyJobs(){
 const E=economyState();E.jobCount=0;
 for(let i=0;i<E.producers.length;i++){const b=E.producers[i],g=BUILDINGS[b.id].makes,p=economyPoint(b,'pile');economyFlush(b);
  if(economyAvailable(p,g)<2)continue;const target=economyOutputTarget(g,b);if(target)economyJob(p,economyDestination(target,g),g,PORTER_LOAD,economyFull(b)?18:(b.pile||0)>=PILE_CAP*.6?12:5,b,target);}
 for(let i=0;i<E.crafts.length;i++){const b=E.crafts[i];economyFlush(b);
  for(const g in b.outs||{}){const p=economyPoint(b,'outs');if(economyAvailable(p,g)<1)continue;const target=economyOutputTarget(g,b);
   if(target)economyJob(p,economyDestination(target,g),g,20,economyFull(b)?13:9,b,target);}
  const plan=chooseCraft(b),w=plan?plan.w:null,R=w&&WARES[w];if(!R)continue;
  const st=economyNearStore(b);if(!st)continue;
  for(const g in R.from){const to=economyPoint(b,'inbox'),want=Math.min(16,R.from[g]*Math.max(1,plan.n))-economyAvailable(to,g)-economyReserved(to,g,true);
   if(want>0)economyJob(economyCentral(g),to,g,want,economyCount(to,g)<R.from[g]?9:4,st,b);}
 }
 for(let i=0;i<E.shops.length;i++){const b=E.shops[i],st=economyNearStore(b);if(!st)continue;const B=BUILDINGS[b.id],to=economyPoint(b,'shelf');
  for(const g in WARES)if(wareKnown(g)&&WARES[g].shops.includes(b.id))economyJob(economyCentral(g),to,g,10,shopTotal(b,true)<1?13:7,st,b);
  if(shopRawSalesAllowed(b))for(let k=0;k<B.sells.length;k++){const g=B.sells[k];economyJob(economyCentral(g),to,g,10,shopTotal(b,false)<1?10:5,st,b);}
  else for(const g in shopStock(b,false))economyJob(to,economyCentral(g),g,PORTER_LOAD,15,b,st);
 }
}
function economyTick(dt){
 const E=economyState();E.t+=dt;if(E.roadRevision!==ROAD_TRAFFIC.revision)E.dirty=true;if(E.t<E.next)return;E.next=E.t+.75;
 if(E.dirty)economyTopology();
 for(const c of E.crafting.values()){
  const a=c.agent,v=vById(a.vid),active=(a.state==='work'&&a.target===c.site.uid)||(a.mission==='craft'&&a.target===c.site.uid);
  if(a.dead||!v||!RT.agents.includes(a)||!bByUid(c.site.uid)||!active||E.t>c.until){craftRelease(a);if(a.state==='work'){a.state='idle';a.timer=.2;}if(a.mission==='craft')a.mission=null;continue;}
  if(a.state==='work'||Math.abs(a.x-c.lastX)+Math.abs(a.y-c.lastY)>.25){c.lastX=a.x;c.lastY=a.y;c.until=E.t+120;}
 }
 for(const c of E.claims.values()){
  const a=c.agent,gone=a.dead||!RT.agents.includes(a)||a.kind!=='collector'&&!vById(a.vid);
  if(gone){dropLost(a);continue;}
  if(Math.abs(a.x-c.lastX)+Math.abs(a.y-c.lastY)>.25){c.lastX=a.x;c.lastY=a.y;c.until=E.t+60;}
  if(c.n>0&&!bByUid(c.target.uid))c.n=0;
  if(c.extra)for(const l of c.extra)if(l.n>0&&!bByUid(economyLineTarget(c,l).uid))l.n=0;
  if(a.goodsClaim!==c.id||!c.picked&&!bByUid(c.source.uid)||!economyStop(c)||E.t>c.until){
   economyRelease(a);a.mission=null;a.state='idle';a.timer=0;a.path.length=0;
   if(a.carry||economyFreightTotal(a))returnShopCarry(a);
  }
 }
 collectorDispatch();economyJobs();
}

function economyStart(a,v,from,to,good,n,source,target){
 const c=economyClaim(a,from,to,good,n,source,target);if(!c)return null;
 a.mission='goodsPick';a.dest=target.uid;a.home2=source.uid;return source;
}
// Porters only haul: a porter carries 30% more per trip (31 vs 24 goods) and walks 15% faster (before any cart load)
const PORTER_LOAD=31,PORTER_SPEED=1.15;
// Paid weekly visits store only bounded intentions, never cargo or reservations.
const COLLECTOR_COST=500,COLLECTOR_ROUNDS=5,COLLECTOR_MAX=8;
let _collectorLooks=null;
function collectorLook(n){
 if(!_collectorLooks)_collectorLooks=[Object.assign({skin:SKIN[1],mask:false},VISITORS[0].looks[0]),Object.assign({skin:SKIN[2],mask:false},VISITORS[3].looks[0])];
 return _collectorLooks[n%2];
}
function collectorUidOrder(a,b){return a.uid-b.uid;}
function hireCollectors(b){
 if(!b||b.id!=='kura'||b.reno||b.collectorHire||G.gold<COLLECTOR_COST)return false;
 const E=economyState();if(E.dirty)economyTopology();let reachable=false;
 for(const f of E.producers)if(economyConnected(b,f)){reachable=true;break;}
 if(!reachable)return false;
 G.gold-=COLLECTOR_COST;b.collectorHire={left:COLLECTOR_ROUNDS,waves:[],cursor:0,scanned:false,visits:[]};E.collectorHires++;
 Sound.play('coin');return true;
}
function collectorWeek(){
 // Snapshot by UID, so newly built worksites join the next weekly round.
 for(const b of G.buildings){const c=b.collectorHire;if(c&&c.left>0){c.left--;c.waves.push(G.uid-1);}}
}
function collectorActiveVisit(home,visit){
 for(const a of RT.agents)if(a.kind==='collector'&&!a.dead&&a.collectorHome===home.uid&&a.collectorVisit===visit)return true;
 return false;
}
function collectorPruneVisits(){
 // Saved intentions on a now-unreachable route are skipped like any other visit.
 for(const b of G.buildings){const c=b.collectorHire;if(!c||!c.visits.length)continue;
  for(let i=c.visits.length-1;i>=0;i--){const visit=c.visits[i],f=bByUid(visit.field);
   if(!collectorActiveVisit(b,visit)&&(!f||!economyConnected(b,f)))c.visits.splice(i,1);}
  collectorComplete(b,c);
 }
}
function collectorSpawn(home,visit){
 const f=bByUid(visit.field),E=economyState();if(!f||f.reno||!BUILDINGS[f.id].makes||!economyConnected(home,f))return false;
 const good=BUILDINGS[f.id].makes;economyFlush(f);const pile=economyPoint(f,'pile'),n=Math.min(PORTER_LOAD,Math.floor(economyAvailable(pile,good)));
 if(n<1)return false;
 let edge=null;for(const e of roadEntranceTiles(home))if(economyBuildingComponent(f,E.components[idx(e[0],e[1])])){edge=e;break;}
 if(!edge)return false;
 const a=spawnAgent({kind:'collector',look:collectorLook(f.uid),speed:22,en:100,collectorHome:home.uid,collectorVisit:visit});
 agentAtTile(a,edge[0],edge[1]);
 if(economyStart(a,a,pile,economyCentral(good),good,n,f,home)&&walkTo(a,f))return true;
 economyRelease(a);a.dead=true;return false;
}
function collectorComplete(home,c){
 if(!c.scanned||c.visits.length)return;
 c.waves.shift();c.cursor=0;c.scanned=false;
 if(!c.left&&!c.waves.length){delete home.collectorHire;economyState().collectorHires=Math.max(0,economyState().collectorHires-1);toast('Collector hire complete · five rounds');}
}
function collectorDispatch(){
 const E=economyState();if(!E.collectorHires||!E.stores.length||E.claims.size>=128)return;
 let live=0,pending=0;for(const a of RT.agents)if(a.kind==='collector'&&!a.dead)live++;
 for(const b of E.stores)if(b.collectorHire)pending+=b.collectorHire.visits.length;
 let budget=32,spawned=0,checked=0;
 while(live<COLLECTOR_MAX&&spawned<4&&budget>0&&checked<Math.min(16,E.stores.length)){
  const home=E.stores[E.collectorAt%E.stores.length],c=home.collectorHire;E.collectorAt=(E.collectorAt+1)%E.stores.length;checked++;if(!c||!c.waves.length)continue;
  // At most eight pending visit records survive a save; resume those first.
  for(let i=c.visits.length-1;i>=0&&live<COLLECTOR_MAX&&spawned<4&&budget>0&&E.claims.size<128;i--){
   const visit=c.visits[i];if(collectorActiveVisit(home,visit))continue;budget--;
   if(collectorSpawn(home,visit)){live++;spawned++;}else{c.visits.splice(i,1);pending--;}
  }
  if(c.scanned){collectorComplete(home,c);continue;}
  if(pending>=COLLECTOR_MAX)continue;
  // Find the first unexamined UID without rescanning earlier fields each tick.
  let lo=0,hi=E.producers.length;while(lo<hi){const mid=(lo+hi)>>>1;if(E.producers[mid].uid<=c.cursor)lo=mid+1;else hi=mid;}
  while(lo<E.producers.length&&E.producers[lo].uid<=c.waves[0]&&live<COLLECTOR_MAX&&pending<COLLECTOR_MAX&&spawned<4&&budget>0&&E.claims.size<128){
   const f=E.producers[lo++];c.cursor=f.uid;budget--;
   if(!economyConnected(home,f))continue;
   economyFlush(f);if(economyAvailable(economyPoint(f,'pile'),BUILDINGS[f.id].makes)<1)continue;
   const visit={field:f.uid};c.visits.push(visit);pending++;
   if(collectorSpawn(home,visit)){live++;spawned++;}else{c.visits.pop();pending--;}
   if(E.claims.size>=128)break;
  }
  if(lo>=E.producers.length||E.producers[lo].uid>c.waves[0])c.scanned=true;
  collectorComplete(home,c);
 }
}
function collectorFinish(a){
 if(a.carry||economyFreightTotal(a))dropLost(a);else economyRelease(a);
 const home=bByUid(a.collectorHome),c=home&&home.collectorHire;
 if(c){const i=c.visits.indexOf(a.collectorVisit);if(i>=0)c.visits.splice(i,1);collectorComplete(home,c);}
 a.dead=true;a.path.length=0;a.hidden=true;
}
function updateCollector(a,dt){
 const home=bByUid(a.collectorHome);if(!home||home.reno||a.collectorRecovered){collectorFinish(a);return;}
 if(a.state==='walk'){
  const done=stepAgent(a,dt);if(a.state==='walk'&&!done)return;
  if(done&&a.state==='walk'){
   const b=bByUid(a.target),m=a.mission;
   if(b&&(m==='goodsPick'||m==='goodsDrop'||m==='shopReturn')){if(missionArrive(a,a,b)==='walking')return;}
   if(b&&(b.uid===home.uid||m==='shopReturn')&&!a.carry&&!economyFreightTotal(a)){collectorFinish(a);return;}
  }
 }
 if(a.carry||economyFreightTotal(a)){if(returnShopCarry(a))return;collectorFinish(a);return;}
 economyRelease(a);a.mission='collectorReturn';if(walkTo(a,home))return;collectorFinish(a);
}
function collectorBeforeSave(){
 for(let i=RT.agents.length-1;i>=0;i--){const a=RT.agents[i];if(a.kind!=='collector')continue;
  // Existing save recovery stores loaded cargo once. Uncollected paid visits resume.
  if(a.carry||economyFreightTotal(a)||a.collectorRecovered)collectorFinish(a);else economyRelease(a);
  RT.agents.splice(i,1);
 }
}
function collectorHirePanel(b){
 const c=b.collectorHire,E=economyState();if(E.dirty)economyTopology();let reachable=false,active=0;
 for(const f of E.producers)if(economyConnected(b,f)){reachable=true;break;}
 for(const a of RT.agents)if(a.kind==='collector'&&!a.dead&&a.collectorHome===b.uid)active++;
 const box=h(`<div><div class="sec">Part-time collectors ${ib('500G total hires five weekly collection rounds, beginning next week. Each round visits every connected raw-material worksite: fields, tea, timber, ore and silk. Collectors reserve available goods, carry up to 31 units and return here. Empty, fully reserved or unreachable piles are skipped. Large rounds dispatch gradually, with eight carriers village-wide. Ordinary workers and porters continue normally. Demolishing this Storehouse ends its hire.')}</div><p class="note">${c?`<b>${c.left+c.waves.length}/5 rounds remaining</b> · ${active} collecting${c.waves.length?' · collection in progress':' · next round next week'}`:'Extra hands for harvests, timber, ore and silk. No housing or worker assignment needed.'}${!entranceOf(b)?'<br>Connect this Storehouse to a road to dispatch collectors.':!reachable?'<br>No raw-material worksites share this road network.':''}</p><button class="btn gold" data-hire-collectors${c||G.gold<COLLECTOR_COST||!reachable?' disabled':''}>${icon('gold')} Hire collectors · 500G / 5 weeks</button></div>`);
 box.querySelector('button').onclick=()=>{if(hireCollectors(b))refreshSheet();};return box;
}
function porterPlan(a,v){
 const E=economyState();if(E.dirty)economyTopology();const component=economyAgentComponent(a);let best=null,score=-Infinity;
 for(let i=0;i<E.jobCount;i++){const j=E.jobs[i];if(economyBuildingComponent(j.source,component)!==component)continue;const n=Math.min(j.n,economyAvailable(j.from,j.good),economyRoom(j.to,j.good),PORTER_LOAD);if(n<1)continue;
  const empty=Math.abs(a.x/16-j.source.x)+Math.abs(a.y/16-j.source.y),
   loaded=Math.abs(j.source.x-j.target.x)+Math.abs(j.source.y-j.target.y),s=(j.rank+n*.6+(WARES[j.good]?Math.min(3,WARES[j.good].price/20):0))/(8+empty*1.5+loaded*.6);
  if(s>score){score=s;best=j;}}
 if(best){const source=economyStart(a,v,best.from,best.to,best.good,Math.min(best.n,PORTER_LOAD),best.source,best.target);if(source)economyBundle(a);return source;}
 a.timer=.75;return null;
}

function shopStock(b,ware=false){
 if(!b.shelf)b.shelf={raw:{},ware:{}};
 return b.shelf[ware?'ware':'raw'];
}
function shopTotal(b,ware=false){let n=0;const map=shopStock(b,ware);for(const g in map)n+=Math.max(0,map[g]||0);return n;}
function shopIncoming(b,good,exclude){
 let n=0;const E=RT.eco;if(!E)return 0;const p=economyPoint(b,'shelf');
 for(const c of E.claims.values())if(c.agent!==exclude){
  if(c.to===p&&c.good===good)n+=c.n;
  if(c.extra)for(const l of c.extra)if(l.to===p&&l.good===good)n+=l.n;
 }return n;
}
function shopRoom(b,good,exclude){
 if(!shopIs(b))return Infinity;const ware=!!WARES[good],B=BUILDINGS[b.id];
 if(ware?!WARES[good].shops.includes(b.id):!shopRawSalesAllowed(b)||!B.sells.includes(good))return 0;
 const stock=shopStock(b,ware);let incoming=0;const E=RT.eco;
 if(E){const p=economyPoint(b,'shelf');for(const c of E.claims.values())if(c.agent!==exclude){if(c.to===p&&!!WARES[c.good]===ware)incoming+=c.n;if(c.extra)for(const l of c.extra)if(l.to===p&&!!WARES[l.good]===ware)incoming+=l.n;}}
 const perKind=ware?SHOP_CAP:Math.max(1,Math.floor(SHOP_CAP/Math.max(1,B.sells.length)));
 return Math.max(0,Math.floor(Math.min(SHOP_CAP-shopTotal(b,ware)-incoming,perKind-(stock[good]||0)-shopIncoming(b,good,exclude))));
}
function releaseShopStock(b){
 if(!shopIs(b))return;const p=economyPoint(b,'shelf');
 for(const g in shopStock(b))moveGoods(p,economyCentral(g),g,economyCount(p,g),'demolish-shelf');
 for(const g in shopStock(b,true))moveGoods(p,economyCentral(g),g,economyCount(p,g),'demolish-shelf');
}
function migrateEconomy(){
 const first=!G.economyV;G.stock=G.stock||{};G.wares=G.wares||{};
 for(const b of G.buildings){
  if(BUILDINGS[b.id].craft){if(!b.recipe)b.recipe=defaultRecipe();b.inbox=b.inbox||{};b.outs=b.outs||{};
   if((b.out||0)>0)moveGoods(economyPoint(b,'oldOut'),economyPoint(b,'outs'),b.recipe,b.out,'migrate-workshop');delete b.out;}
  if(!shopIs(b))continue;
  const pooled=first&&!b.shelf&&!b.shopGoods&&!b.shopWares;
  if(!b.shelf)b.shelf={raw:{},ware:{}};
  for(const kind of ['legacyRaw','legacyWare']){const p=economyPoint(b,kind),map=economyMap(p,'rice');
   for(const g in map){const n=economyCount(p,g);if(n>0){const keep=Math.min(n,shopRoom(b,g));if(keep>0)moveGoods(p,economyPoint(b,'shelf'),g,keep,'migrate-shelf');moveGoods(p,economyCentral(g),g,economyCount(p,g),'migrate-surplus');}}
  }
  delete b.shopGoods;delete b.shopWares;
  if(pooled&&!BUILDINGS[b.id].needWares)for(const g of BUILDINGS[b.id].sells){const n=Math.min(2,spendableGood(g),shopRoom(b,g));if(n>0)moveGoods(economyCentral(g),economyPoint(b,'shelf'),g,n,'opening-shelf');}
 }
 G.economyV=1;const E=economyState();E.dirty=true;
}
function migrateShopStock(){migrateEconomy();}
function migrateLogistics(){
 G.wares=G.wares||{};for(const v of G.villagers)if(v.en==null)v.en=100;
 migrateEconomy();G.logi=1;
}
function economyBeforeSave(){
 collectorBeforeSave();
 for(const c of economyState().crafting.values()){const a=c.agent;craftRelease(a);a.mission=null;a.state='idle';a.timer=.2;a.path.length=0;a.hidden=false;}
 for(const a of RT.agents){if(a.carry||economyFreightTotal(a))dropLost(a);else economyRelease(a);if(a.mission==='goodsPick'||a.mission==='goodsDrop')a.mission=null;}
}
function saveGame(){try{economyBeforeSave();localStorage.setItem(SAVE_KEY,JSON.stringify(G));return true;}catch(e){return false;}}
function economyRemove(b){
 const E=economyState();
 for(const c of E.crafting.values())if(c.site===b){const a=c.agent;craftRelease(a);a.mission=null;a.state='idle';a.timer=.2;a.path.length=0;a.hidden=false;}
 for(const c of E.claims.values()){
  if(c.source===b&&!c.picked){const a=c.agent;dropLost(a);a.mission=null;a.state='idle';a.timer=.2;a.path.length=0;a.hidden=false;continue;}
  economyCancelStop(c,b);
  if(!economyStop(c)){const a=c.agent;dropLost(a);a.mission=null;a.state='idle';a.timer=.2;a.path.length=0;a.hidden=false;}
  else if(c.picked&&c.agent.target===b.uid){const a=c.agent;if(!economyContinueTrip(a,c)){dropLost(a);a.mission=null;a.state='idle';a.timer=.2;a.path.length=0;a.hidden=false;}}
 }
 const B=BUILDINGS[b.id];releaseShopStock(b);
 for(const kind of ['inbox','outs']){const p=economyPoint(b,kind),map=economyMap(p,'rice');for(const g in map)moveGoods(p,economyCentral(g),g,economyCount(p,g),'demolish-store');}
 if(B.makes){moveGoods(economyPoint(b,'pile'),economyCentral(B.makes),B.makes,b.pile||0,'demolish-harvest');moveGoods(economyPoint(b,'buffer'),economyCentral(B.makes),B.makes,b.buffer||0,'demolish-batch');}
 E.dirty=true;
}

function removeBuilding(b){
 economyRemove(b);const B=BUILDINGS[b.id];
 for(let j=0;j<B.h;j++)for(let i=0;i<B.w;i++)G.bmap[idx(b.x+i,b.y+j)]=-1;
 G.buildings.splice(G.buildings.indexOf(b),1);invalidateRoadTraffic();
 for(const v of G.villagers){if(v.home===b.uid)v.home=-1;if(v.job===b.uid)v.job=-1;}
 for(const a of RT.agents)if((a.target===b.uid||a.dest===b.uid||a.home2===b.uid)&&!economyClaimOf(a)){dropLost(a);a.mission=null;a.resting=false;a.state='idle';a.timer=.2;a.hidden=false;a.path.length=0;}
 RT.groundDirty=true;refreshBoosts();assignHomes();assignJobs();
}
function dropLost(a){
 if(a.kind==='collector'&&(a.carry||economyFreightTotal(a)))a.collectorRecovered=true;
 economyRelease(a);craftRelease(a);a.shopSupply=null;
 if(a.carry){const g=a.carry.good;moveGoods(economyPoint(a,'carry'),economyCentral(g),g,a.carry.n,'recover-carrier');}
 if(a.freight)for(const g in a.freight)moveGoods(economyPoint(a,'freight'),economyCentral(g),g,a.freight[g],'recover-cart');
}
function depositCarry(a,b){
 if(!b)return;const c=economyClaimOf(a);if(c&&c.picked)return economyDeliverStop(a,b,c);let delivered=0;
 if(a.carry){const g=a.carry.good,p=economyDestination(b,g),n=Math.min(a.carry.n,economyRoom(p,g,economyClaimOf(a)));
  delivered+=moveGoods(economyPoint(a,'carry'),p,g,n,'delivery');}
 if(a.freight)for(const g in a.freight){const p=economyDestination(b,g),n=Math.min(a.freight[g],economyRoom(p,g,economyClaimOf(a)));
  delivered+=moveGoods(economyPoint(a,'freight'),p,g,n,'cart-delivery');}
 economyPromoteCargo(a);if(delivered){const B=BUILDINGS[b.id];floater(b.x*16+B.w*8,b.y*16-2,'+'+delivered,'build','#e9dcae');}
}
function depositCarryWarehouse(a,b){if(b)depositCarry(a,b);else dropLost(a);}
function missionArrive(a,v,b){
 const m=a.mission;a.mission=null;
 if(m==='shopReturn'){depositCarry(a,b);if(a.carry||economyFreightTotal(a))dropLost(a);return true;}
 if(m!=='goodsPick'&&m!=='goodsDrop'){if(a.carry||economyFreightTotal(a))depositCarry(a,b);economyRelease(a);return true;}
 const c=economyClaimOf(a);
 if(!c){economyPromoteCargo(a);if(a.carry&&returnShopCarry(a))return 'walking';return true;}
 if(m==='goodsPick'){
  if(c.source!==b||!economyStop(c)){economyRelease(a);return true;}
  let room=isPorter(v)||a.kind==='collector'?PORTER_LOAD:Infinity;
  const n=Math.min(c.n,room,economyAvailable(c.from,c.good,c),economyRoom(c.to,c.good,c));
  c.n=moveGoods(c.from,economyPoint(a,'carry'),c.good,n,'pickup');room-=c.n;c.picked=true;c.until=economyState().t+100;
  if(c.extra)for(const l of c.extra){const amount=Math.min(l.n,room,economyAvailable(l.from,l.good,c),economyRoom(l.to,l.good,c));
   l.n=moveGoods(l.from,economyPoint(a,'freight'),l.good,amount,'cart-pickup');room-=l.n;}
  economyPromoteCargo(a);if(!a.carry){economyRelease(a);return true;}
  if((isPorter(v)||a.kind==='collector')&&a.carry.n+economyFreightTotal(a)>=CART_AT){a.carry.kind='cart';a.speedMul=1-(1-.78)*(1-Math.min(.9,carryOf(a)));}
  if(economyContinueTrip(a,c))return 'walking';
 }else{
  economyDeliverStop(a,b,c);v.en=Math.max(0,(v.en??100)-4);
  if(economyContinueTrip(a,c))return 'walking';
 }
 economyRelease(a);economyPromoteCargo(a);
 if(a.carry&&returnShopCarry(a))return 'walking';return true;
}

function shopMissionArrive(a,v,b){return missionArrive(a,v,b);}
function planShopSupply(a,v){
 if(a.carry||isPorter(v))return null;const E=economyState();if(E.dirty)economyTopology();
 let hauling=0;for(const c of E.claims.values())if(!isPorter(vById(c.agent.vid))&&(c.to.kind==='shelf'||c.from.kind==='shelf'))hauling++;
 if(hauling>=Math.max(1,Math.ceil(E.workers*.35)))return null;
 const component=economyAgentComponent(a);let best=null,score=-Infinity;
 for(let i=0;i<E.jobCount;i++){const j=E.jobs[i];if(economyBuildingComponent(j.source,component)!==component||!(j.from.owner===G&&j.to.kind==='shelf'||j.from.kind==='shelf'&&j.to.owner===G))continue;
  const n=Math.min(j.n,economyAvailable(j.from,j.good),economyRoom(j.to,j.good));if(n<1)continue;
  if(j.to.kind==='shelf'&&porterReach(j.target)&&shopTotal(j.target,!!WARES[j.good])>0)continue;
  const d=Math.abs(a.x/16-j.source.x)+Math.abs(a.y/16-j.source.y)+Math.abs(j.source.x-j.target.x)+Math.abs(j.source.y-j.target.y),s=(j.rank+Math.min(8,n))/(10+d);
  if(s>score){score=s;best=j;}}
 if(!best)return null;return economyStart(a,v,best.from,best.to,best.good,Math.round(6*(1+vStats(v).carry)),best.source,best.target);
}
function dropFor(g,fromB,a){const E=economyState();if(E.dirty)economyTopology();return economyOutputTarget(g,fromB,a?economyAgentComponent(a):0);}
// Everyone shares the hauling. Porters get first call on output they can reach (workers leave a pile to them until
// it is well filled); a full pile, or one no porter can reach, the worker carries away himself, taking whatever no
// porter has already claimed. A worker only waits when porters have claimed everything left to move.
function porterReach(b){const E=economyState();if(E.dirty)economyTopology();return !!(E.porterComps&&E.porterComps.has(economyBuildingComponent(b)));}
function workerPlan(a,v,J){
 const B=BUILDINGS[J.id],E=economyState(),capacity=Math.max(1,Math.round(6*(1+vStats(v).carry)));a.haulSite=0;
 if(B.makes){
  economyFlush(J);
  const pile=economyPoint(J,'pile'),avail=economyAvailable(pile,B.makes),reach=porterReach(J),full=economyFull(J);
  const haulAt=reach?Math.round(PILE_CAP*.6):Math.round(HAUL_AT*(1+vStats(v).carry));
  if(avail>=1&&(avail>=haulAt||full)){
   const to=dropFor(B.makes,J,a);if(to){const plan=economyStart(a,v,pile,economyDestination(to,B.makes),B.makes,Math.max(capacity,avail),J,to);if(plan)return plan;}
  }
  if(full){a.bubble={t:1.5,icon:'!'};return economyReserved(pile,B.makes,false)>0?economyWait(a,J):null;}
  a.mission='work';return J;
 }
 if(B.craft){
  J.inbox=J.inbox||{};J.outs=J.outs||{};
  const c=chooseCraft(J),outs=economyPoint(J,'outs'),reach=porterReach(J),full=outTotal(J)>=OUT_CAP;
  let ready=null,readyTo=null,n=0;for(const g in J.outs){const k=economyAvailable(outs,g);if(k>n){const to=dropFor(g,J,a);if(to&&to!==J){ready=g;readyTo=to;n=k;}}}
  if(ready&&(full||(reach?n>=Math.ceil(OUT_CAP*.5):n>=3||!c||c.mode!=='craft'))){
   const plan=economyStart(a,v,outs,economyDestination(readyTo,ready),ready,capacity,J,readyTo);if(plan)return plan;}
  if(full&&Object.keys(J.outs).some(g=>economyReserved(outs,g,false)>0))return economyWait(a,J);
  if(c&&c.mode==='craft'&&!full&&craftReserve(a,v,J,c.w,c.n)){a.mission='craft';return J;}
  if(c&&c.mode==='fetch'){
   const p=economyPoint(J,'inbox'),need=WARES[c.w].from[c.g]-(J.inbox[c.g]||0);
   if(economyReserved(p,c.g,true)>=need)return economyWait(a,J);
   const st=economyNearStore(J),want=Math.min(economyRoom(p,c.g),WARES[c.w].from[c.g]*Math.round(3*(1+vStats(v).carry)),WARES[c.w].from[c.g]*c.n-economyAvailable(p,c.g)-economyReserved(p,c.g,true));
   if(st&&want>=1){const plan=economyStart(a,v,economyCentral(c.g),p,c.g,want,st,J);if(plan)return plan;}
  }
  a.bubble={t:1.6,icon:full?'!':'…'};return null;
 }
 return null;
}
function produce(b,v){
 const B=BUILDINGS[b.id],s=vStats(v);let amt=B.rate*(.55+s.wrk/22)*(1+(b.boost||0))*(b.combo?b.combo.m:1);
 if(s.sk.strongback)amt*=1+.2*s.sk.strongback;if(s.sk.greenthumb)amt*=1+.15*s.sk.greenthumb;
 if(B.needTrees)amt*=clamp(treesNear(b,2)/4,.25,1.5);
 amt=Math.max(1,Math.round(amt*1.4*workMul(v)*boonFarm()*blightOf(b.id)));
 createGoods(economyPoint(b,'buffer'),B.makes,amt,'harvest');economyFlush(b);
 b.prog=(b.prog+1)%4;b.var=b.prog>=2?1:0;
 floater(b.x*16+B.w*8,b.y*16+4,'+'+amt,'g_'+B.makes,'#f2efe2');if(Math.random()<.25)giveXP(v,1);
}
function craftDone(b,v,w,a){
 const E=economyState(),c=a&&E.crafting.get(a);if(!c||c.site!==b||c.w!==w)return 0;
 const R=WARES[w],input=economyPoint(b,'inbox');let n=Math.min(c.n,craftRoom(b,c),Math.floor(craftNeed(b,w,c)));
 for(const g in R.from)n=Math.min(n,Math.floor(economyAvailable(input,g,c)/R.from[g]));
 craftRelease(a);if(n<1)return 0;
 for(const g in R.from)destroyGoods(input,g,R.from[g]*n,'craft-input');
 createGoods(economyPoint(b,'outs'),w,n,'craft-output');b.prog=((b.prog||0)+1)%4;
 floater(b.x*16+16,b.y*16-2,'+'+n,'w_'+w,'#f2d27a');if(Math.random()<.3)giveXP(v,1);return n;
}

function sell(a,b){
 const before=G.stats.sales,B=BUILDINGS[b.id],qty=rint(1,2+(a.wallet>2?1:0))+(likes(a,b)?1:0),L=lvInfo(b),ws=waresOf(b.id),wares=shopStock(b,true),goods=shopStock(b),p=economyPoint(b,'shelf');
 let base=0,n=0,wn=0;
 for(let i=0;i<qty;i++){
  let w=null;for(let j=0;j<ws.length;j++){const k=ws[j];if((wares[k]||0)>=1&&(!w||WARES[k].price>WARES[w].price))w=k;}
  if(w){destroyGoods(p,w,1,'retail');base+=WARES[w].price;n++;wn++;}
  else if(shopRawSalesAllowed(b)&&B.sells.every(g=>(goods[g]||0)>=1)){for(const g of B.sells)destroyGoods(p,g,1,'retail');base+=B.price;n++;}
 }
 if(!n){a.bubble={t:1.8,icon:'…'};diagSale(a,b,0,before);return 0;}
 const price=(1+(b.boost||0))*(b.combo?b.combo.m:1)*(G.activeCombos?.lanterns?1.15:1)*(1+(L?.sale||0))*(1+(b.wideStreet?WIDE_STREET_BONUS.sale:0)),gold=Math.round(base*price*boonSales()*shopOmen(b.id));
 if(wn)a.bubble={t:1.6,icon:'★'};G.gold+=gold;G.stats.sales+=gold;RT.monthSales+=gold;
 floater(b.x*16+B.w*8,b.y*16-2,'+'+gold,'gold','#f2d27a');if(Math.random()<.35)a.bubble={t:1.6,icon:'♥'};if(Math.random()<.5)a.cheer=RT.t+1.1;
 Sound.play('coin',{vol:.5});diagSale(a,b,n,before);return n;
}

function economyFull(b){const B=BUILDINGS[b.id];return B.makes?((b.pile||0)>=PILE_CAP||(b.buffer||0)>0):B.craft?outTotal(b)>=OUT_CAP:false;}
function assignJobs(){
 const inds=G.buildings.filter(b=>(BUILDINGS[b.id].cat==='ind'||BUILDINGS[b.id].craft)&&BUILDINGS[b.id].slots),load={};
 for(const v of G.villagers){if(v.role!=='work'){v.job=-1;continue;}const job=v.job>=0&&inds.find(b=>b.uid===v.job);
  if(job&&(job.moveJobHold||entranceOf(job))){load[v.job]=(load[v.job]||0)+1;if(job.moveJobHold&&entranceOf(job))delete job.moveJobHold;}else v.job=-1;}
 for(const v of G.villagers)if(v.role==='work'&&v.job<0){
  const free=inds.filter(b=>b.id!=='porter'&&(load[b.uid]||0)<BUILDINGS[b.id].slots&&entranceOf(b));
  if(!free.length)continue;free.sort((a,b)=>(load[a.uid]||0)-(load[b.uid]||0)||a.uid-b.uid);v.job=free[0].uid;load[v.job]=(load[v.job]||0)+1;}
 economyState().dirty=true;
}
function porterHouseSprite(){
  // Village art: native PB pixels, shared shading, and a permanent foreground barrow.
  const p=new PB(32,46),wood='#6b4a2e';
  wallFront(p,2,26,28,15,{plaster:'#efe6d0',wood,door:true,noren:'#3b4a7a'});
  p.rect(24,30,5,8,'#8a5a32');p.hline(24,30,5,'#a87a48');
  p.hline(24,34,5,'#5a3a20');p.vline(26,30,8,'#5a3a20');
  roofTiles(p,0,5,32,24,'#3a3442');
  p.rect(12,21,9,7,wood);p.rect(13,22,7,5,'#e8d8b0');
  p.rect(14,23,5,3,'#a8743f');p.vline(16,23,3,'#f2efe2');
  // Empty wooden wheelbarrow parked in front, separate from the house's sill.
  // Keep its sloped tray, two shafts, support leg and large spoked wheel readable.
  p.line(19,38,29,34,'#4a321e');p.line(19,39,29,35,'#c8945f');
  p.line(18,41,28,38,'#4a321e');p.set(28,38,'#c8945f');
  p.line(18,40,21,44,'#4a321e');p.hline(20,44,3,'#4a321e');
  p.poly([[3,35],[22,35],[20,41],[7,41]],'#4a321e');
  p.poly([[5,36],[20,36],[18,39],[8,39]],'#a8743f');
  p.hline(3,35,19,'#c8945f');p.hline(8,39,11,'#8a5a32');
  p.hline(7,40,13,'#6b4a2e');p.vline(8,36,4,'#8a5a32');p.vline(18,36,4,'#8a5a32');
  // The wheel is painted last so it cannot disappear behind the cart or foundation.
  p.circle(8,42,3,'#3a2a22');p.circle(8,42,2,'#c8945f');
  p.vline(8,40,5,'#4a321e');p.hline(6,42,5,'#4a321e');p.set(8,42,'#e0b884');
  p.shadeEdges(.88,1.06);const o=p.outlined(OUTLINE);return {cv:o.canvas(),ox:-1,oy:-11};
}
function economyBadge(ctx,b,B,px,py){
 let kind=0;
 if((B.makes||B.craft)&&economyFull(b))kind=3;
 else if(B.cat==='shop'&&!economyCanSell(b))kind=2;
 else if(B.craft){const R=WARES[b.recipe];if(R)for(const g in R.from)if(((b.inbox||{})[g]||0)<R.from[g]){kind=1;break;}}
 if(!kind)return;const x=px+B.w*16-4,y=py+6;
 ctx.fillStyle='#342e29';ctx.fillRect(x-3,y-4,7,7);ctx.fillStyle=kind===3?'#d59f45':kind===2?'#b66a58':'#7c9eaa';ctx.fillRect(x-2,y-3,5,5);
 ctx.fillStyle='#fff0cf';if(kind===3){ctx.fillRect(x,y-2,1,2);ctx.fillRect(x,y+1,1,1);}else if(kind===2){ctx.fillRect(x-1,y-1,3,1);}else{ctx.fillRect(x-1,y-2,3,1);ctx.fillRect(x,y-1,1,2);}
}
function porterPanel(b){
 const box=h('<div><p class="note">Porters collect real goods and reserve shelf space before setting off. Assign workers below; this house never hires automatically.</p></div>'),
 ws=G.villagers.filter(v=>v.job===b.uid);
 for(const v of ws){const bt=h('<button class="btn ghost">Release '+esc(vData(v.id).name)+'</button>');
 bt.onclick=()=>{const a=RT.agents.find(q=>q.vid===v.id);if(a){dropLost(a);a.mission=null;a.state='idle';a.timer=0;a.path.length=0;a.hidden=false;}v.job=-1;assignJobs();refreshSheet();};box.appendChild(bt);}
 return box;
}

function outTotal(b){let n=0;const map=b.outs;if(map)for(const k in map)n+=map[k];return n;}
function economyCanSell(b){
 const B=BUILDINGS[b.id],wares=shopStock(b,true);for(const w in wares)if(wares[w]>=1&&WARES[w]&&WARES[w].shops.includes(b.id))return true;
 if(!shopRawSalesAllowed(b))return false;const raw=shopStock(b,false);for(let i=0;i<B.sells.length;i++)if((raw[B.sells[i]]||0)<1)return false;return true;
}

function economyWait(a,b){
 if(a.target!==b.uid){a.mission='goodsPause';return b;}
 a.state='goodsRest';a.mission=null;a.moving=false;a.hidden=false;a.timer=2;return null;
}

function economyFreightTotal(a){let n=0;if(a.freight)for(const g in a.freight)n+=a.freight[g];return n;}
function economyPromoteCargo(a){
 if(!a.carry&&a.freight)for(const g in a.freight)if(a.freight[g]>0){moveGoods(economyPoint(a,'freight'),economyPoint(a,'carry'),g,a.freight[g],'cart-front');break;}
 if(a.carry&&(isPorter(vById(a.vid))||a.kind==='collector')&&a.carry.n+economyFreightTotal(a)>=CART_AT){
  a.carry.kind='cart';a.speedMul=1-(1-.78)*(1-Math.min(.9,carryOf(a)));}
}
function economyAddLine(c,from,to,good,n,target=c&&c.target){
 if(!c||c.picked||!target||c.from===from&&c.to===to&&c.good===good||c.extra&&c.extra.some(l=>l.from===from&&l.to===to&&l.good===good))return 0;
 let load=c.n;if(c.extra)for(const l of c.extra)load+=l.n;
 n=Math.min(n,PORTER_LOAD-load,economyAvailable(from,good),economyRoom(to,good));if(n<1)return 0;
 if(!c.extra)c.extra=[];if(c.extra.length>=3)return 0;
 if(target!==c.target){if(!shopIs(c.target)||!shopIs(target)||c.second&&c.second!==target)return 0;c.second=target;}
 c.extra.push({from,to,good,n,target});return n;
}

function economyBundle(a){
 const c=economyClaimOf(a),E=economyState();if(!c)return;let room=PORTER_LOAD-c.n;
 for(let i=0;i<E.jobCount&&room>0;i++){const j=E.jobs[i];if(j.source!==c.source||j.target!==c.target)continue;
  room-=economyAddLine(c,j.from,j.to,j.good,Math.min(room,j.n));}
 if(room<1||!shopIs(c.target)||c.extra&&c.extra.length>=3)return;
 const se=entranceOf(c.source),ae=entranceOf(c.target);if(!se||!ae)return;
 const ds=roadDistances(idx(se[0],se[1]),true),da=roadDistances(idx(ae[0],ae[1]),true),first=ds[idx(ae[0],ae[1])];
 if(first<0)return;let best=null,score=-Infinity;
 for(let i=0;i<E.jobCount;i++){
  const j=E.jobs[i];if(j.source!==c.source||j.target===c.target||!shopIs(j.target))continue;
  const be=entranceOf(j.target);if(!be)continue;const at=idx(be[0],be[1]),between=da[at],from=ds[at];if(between<0||from<0)continue;
  // one pickup, two shops: visit the nearer shop first (start → near → far); the detour is what that costs over going straight to the farther shop
  const direct=Math.max(first,from),extra=Math.min(first,from)+between-direct;
  if(extra>Math.max(4,direct*.25))continue;
  const n=Math.min(room,j.n,economyAvailable(j.from,j.good),economyRoom(j.to,j.good));if(n<1)continue;
  const urgent=shopTotal(j.target,!!WARES[j.good])<3?1:0,value=urgent*1000+j.rank*20+n*3-extra*4-between*.25;
  if(value>score){score=value;best=j;}
 }
 if(!best)return;
 // the final check walks the real keep-left paths, in both orders, and keeps the shorter
 const be=entranceOf(best.target),leg=(p,q)=>{if(p[0]===q[0]&&p[1]===q[1])return 0;const P=roadPath(p[0],p[1],q[0],q[1],true,true);return P?P.length:Infinity;};
 const direct=Math.max(first,ds[idx(be[0],be[1])]),aFirst=leg(se,ae)+leg(ae,be),bFirst=leg(se,be)+leg(be,ae);
 const walked=Math.min(aFirst,bFirst),detour=walked-direct;
 if(detour>Math.max(4,direct*.25))return;
 for(let i=0;i<E.jobCount&&room>0;i++){const j=E.jobs[i];if(j.source!==c.source||j.target!==best.target)continue;
  room-=economyAddLine(c,j.from,j.to,j.good,Math.min(room,j.n),j.target);}
 if(c.second){c.directDistance=direct;c.detour=detour;c.detourLimit=Math.max(4,direct*.25);c.secondFirst=bFirst<aFirst;c.walked=walked;}
}

function economyLineTarget(c,line){return line===c?c.target:line.target||c.target;}
function economyStop(c){
 if(c.secondFirst&&c.second&&bByUid(c.second.uid)&&c.extra&&c.extra.some(l=>l.n>0&&economyLineTarget(c,l)===c.second))return c.second;
 if(c.n>0&&bByUid(c.target.uid))return c.target;
 if(c.extra)for(const l of c.extra){const b=economyLineTarget(c,l);if(l.n>0&&bByUid(b.uid))return b;}return null;
}
function economyCancelStop(c,b){
 if(c.target===b)c.n=0;if(c.extra)for(const l of c.extra)if(economyLineTarget(c,l)===b)l.n=0;
 if(c.second===b)c.second=null;
}
function economyContinueTrip(a,c){
 for(let tries=0;tries<2;tries++){
  const b=economyStop(c);if(!b)return false;
  a.mission='goodsDrop';a.dest=b.uid;
  if(walkTo(a,b))return true;
  economyCancelStop(c,b);
 }
 return false;
}
function economyMoveCargo(a,to,good,n,reason){
 let moved=moveGoods(economyPoint(a,'carry'),to,good,n,reason);
 moved+=moveGoods(economyPoint(a,'freight'),to,good,n-moved,reason);return moved;
}
function economyDeliverStop(a,b,c){
 let delivered=0;
 if(c.target===b&&c.n>0){const n=Math.min(c.n,economyRoom(c.to,c.good,c));delivered+=economyMoveCargo(a,c.to,c.good,n,'delivery');c.n=0;}
 if(c.extra)for(const l of c.extra)if(economyLineTarget(c,l)===b&&l.n>0){
  const n=Math.min(l.n,economyRoom(l.to,l.good,c));delivered+=economyMoveCargo(a,l.to,l.good,n,'cart-delivery');l.n=0;}
 economyPromoteCargo(a);
 if(delivered){const B=BUILDINGS[b.id];floater(b.x*16+B.w*8,b.y*16-2,'+'+delivered,'build','#e9dcae');}
 return delivered;
}
function economyComponents(E){
 const C=roadTrafficTopology(),map=E.components,q=E.queue;map.fill(0);let label=0;
 for(let i=0;i<G.roads.length;i++){if(!G.roads[i]||map[i])continue;let head=0,tail=0;label++;map[i]=label;q[tail++]=i;
  while(head<tail){const at=q[head++],x=at%MAP_W,y=(at/MAP_W)|0;
   for(let d=0;d<4;d++){const nx=x+ROAD_STEPS[d][0],ny=y+ROAD_STEPS[d][1];if(!inMap(nx,ny))continue;
    const next=idx(nx,ny);if(!map[next]&&roadCanStep(at,next,C,true)){map[next]=label;q[tail++]=next;}}}}
 E.roadRevision=ROAD_TRAFFIC.revision;
}
function economyBuildingComponent(b,preferred=0){
 const E=economyState(),edges=E.access.get(b);if(!edges||!edges.length)return 0;
 if(preferred){for(const n of edges)if(n===preferred)return n;return 0;}return edges[0];
}
function economyConnected(a,b){
 const E=economyState(),aa=E.access.get(a),bb=E.access.get(b);if(!aa||!bb)return false;
 for(const x of aa)for(const y of bb)if(x===y)return true;return false;
}
function economyAgentComponent(a){
 const E=economyState(),sx=clamp(Math.round((a.x-8)/16),0,MAP_W-1),sy=clamp(Math.round((a.y-12)/16),0,MAP_H-1);
 let n=E.components[idx(sx,sy)];if(n)return n;const p=navigationStart(a);return p?E.components[idx(p[0],p[1])]:0;
}
