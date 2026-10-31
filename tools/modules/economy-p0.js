
/* Logistics P0: central storage, physical shelves and optional dedicated haulers.
   Runtime endpoints, jobs and claims never enter the save. */
const ECONOMY_P0=1;
BUILDINGS.porter={name:'Porter House',jp:'荷運び小屋',cat:'ind',tab:'ind',w:2,h:2,cost:240,slots:2,appeal:1,
 desc:'Assign up to two porters by hand. They collect harvests and wares, supply artisans and restock shop shelves with handcarts. Ordinary workers still haul without them.'};
SH_PERF.ledgerHooked=true;
function economyState(){
 let E=RT.eco;if(E&&E.owner===G)return E;
 E={owner:G,t:0,next:0,dirty:true,points:new WeakMap(),entrances:new WeakMap(),components:new Int16Array(MAP_W*MAP_H),queue:new Int16Array(MAP_W*MAP_H),roadRevision:-1,nextPoint:1,claims:new Map(),nextClaim:1,
 jobs:[],jobCount:0,shops:[],producers:[],crafts:[],stores:[],porters:0,workers:0,
 events:SH_PERF.on?Array.from({length:200},()=>({t:0,reason:'',good:'',n:0})):null,eventAt:0,eventN:0,moved:0,created:0,destroyed:0,overflows:0};
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
 const E=economyState();if(kind===1)E.created+=n;else if(kind===-1)E.destroyed+=n;else E.moved+=n;
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
 }return n;
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
 economyRelease(a);if(!source||!target||source.reno||target.reno)return null;
 const E=economyState();if(E.dirty)economyTopology();if(!economyConnected(source,target))return null;n=Math.min(n,economyAvailable(from,good),economyRoom(to,good));if(!(n>0))return null;
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
 const E=economyState();if(E.roadRevision!==ROAD_TRAFFIC.revision)economyComponents(E);E.shops.length=E.producers.length=E.crafts.length=E.stores.length=0;E.porters=E.workers=0;
 for(const b of G.buildings){const B=BUILDINGS[b.id];E.entrances.set(b,b.reno?null:entranceOf(b));if(!E.entrances.get(b))continue;
  if(shopIs(b))E.shops.push(b);if(B.makes)E.producers.push(b);if(B.craft)E.crafts.push(b);if(B.store||b.id==='hall')E.stores.push(b);}
 E.porterComps=new Set();
 for(const v of G.villagers)if(v.role==='work'){E.workers++;if(isPorter(v)){E.porters++;const h=bByUid(v.job),c=h&&economyBuildingComponent(h);if(c)E.porterComps.add(c);}}
 E.dirty=false;
}
function economyNearStore(from){
 const E=economyState();let best=null,score=Infinity;
 for(let i=0;i<E.stores.length;i++){const b=E.stores[i];if(!economyConnected(from,b))continue;const d=Math.abs(b.x-from.x)+Math.abs(b.y-from.y);if(d<score){score=d;best=b;}}return best;
}
function economyOutputTarget(good,from){
 const E=economyState(),ware=!!WARES[good];let best=null,score=-Infinity;
 if(tradeHold(good)>economyCount(economyCentral(good),good))return economyNearStore(from);
 for(let i=0;i<E.shops.length;i++){const b=E.shops[i];if(!economyConnected(from,b))continue;const room=shopRoom(b,good);if(room<=0)continue;
  const s=(shopTotal(b,ware)<1?28:12)+Math.min(10,room)-.35*(Math.abs(b.x-from.x)+Math.abs(b.y-from.y));
  if(s>score){score=s;best=b;}}
 if(!ware)for(let i=0;i<E.crafts.length;i++){const b=E.crafts[i];if(!economyConnected(from,b)||!wantsGood(b,good))continue;
  const p=economyPoint(b,'inbox'),room=economyRoom(p,good);if(room<1)continue;
  const s=(economyCount(p,good)<2?23:8)+Math.min(8,room)-.35*(Math.abs(b.x-from.x)+Math.abs(b.y-from.y));
  if(s>score){score=s;best=b;}}
 return best||economyNearStore(from);
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
  if(economyAvailable(p,g)<2)continue;const target=economyOutputTarget(g,b);if(target)economyJob(p,economyDestination(target,g),g,24,economyFull(b)?18:(b.pile||0)>=PILE_CAP*.6?12:5,b,target);}
 for(let i=0;i<E.crafts.length;i++){const b=E.crafts[i];economyFlush(b);
  for(const g in b.outs||{}){const p=economyPoint(b,'outs');if(economyAvailable(p,g)<1)continue;const target=economyOutputTarget(g,b);
   if(target)economyJob(p,economyDestination(target,g),g,20,economyFull(b)?13:9,b,target);}
  const w=b.recipe&&wareKnown(b.recipe)?b.recipe:null,R=w&&WARES[w];if(!R)continue;
  const st=economyNearStore(b);if(!st)continue;
  for(const g in R.from){const to=economyPoint(b,'inbox'),want=Math.min(12,R.from[g]*4)-economyCount(to,g)-economyReserved(to,g,true);
   if(want>0)economyJob(economyCentral(g),to,g,want,economyCount(to,g)<R.from[g]?9:4,st,b);}
 }
 for(let i=0;i<E.shops.length;i++){const b=E.shops[i],st=economyNearStore(b);if(!st)continue;const B=BUILDINGS[b.id],to=economyPoint(b,'shelf');
  for(const g in WARES)if(wareKnown(g)&&WARES[g].shops.includes(b.id))economyJob(economyCentral(g),to,g,10,shopTotal(b,true)<1?13:7,st,b);
  if(!B.needWares)for(let k=0;k<B.sells.length;k++){const g=B.sells[k];economyJob(economyCentral(g),to,g,10,shopTotal(b,false)<1?10:5,st,b);}
 }
}
function economyTick(dt){
 const E=economyState();E.t+=dt;if(E.roadRevision!==ROAD_TRAFFIC.revision)E.dirty=true;if(E.t<E.next)return;E.next=E.t+.75;
 if(E.dirty)economyTopology();
 for(const c of E.claims.values()){
  const a=c.agent,gone=a.dead||!RT.agents.includes(a)||!vById(a.vid);
  if(gone){dropLost(a);continue;}
  if(Math.abs(a.x-c.lastX)+Math.abs(a.y-c.lastY)>.25){c.lastX=a.x;c.lastY=a.y;c.until=E.t+60;}
  if(a.goodsClaim!==c.id||!bByUid(c.source.uid)||!bByUid(c.target.uid)||E.t>c.until){
   economyRelease(a);if(a.carry||economyFreightTotal(a)){a.mission=null;a.state='idle';a.timer=0;}}
 }
 economyJobs();
}
function economyStart(a,v,from,to,good,n,source,target){
 const c=economyClaim(a,from,to,good,n,source,target);if(!c)return null;
 a.mission='goodsPick';a.dest=target.uid;a.home2=source.uid;return source;
}
function porterPlan(a,v){
 const E=economyState();if(E.dirty)economyTopology();const component=economyAgentComponent(a);let best=null,score=-Infinity;
 for(let i=0;i<E.jobCount;i++){const j=E.jobs[i];if(economyBuildingComponent(j.source)!==component)continue;const n=Math.min(j.n,economyAvailable(j.from,j.good),economyRoom(j.to,j.good),24);if(n<1)continue;
  const empty=Math.abs(a.x/16-j.source.x)+Math.abs(a.y/16-j.source.y),
   loaded=Math.abs(j.source.x-j.target.x)+Math.abs(j.source.y-j.target.y),s=(j.rank+n*.6+(WARES[j.good]?Math.min(3,WARES[j.good].price/20):0))/(8+empty*1.5+loaded*.6);
  if(s>score){score=s;best=j;}}
 if(best){const source=economyStart(a,v,best.from,best.to,best.good,Math.min(best.n,24),best.source,best.target);if(source)economyBundle(a);return source;}
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
 if(ware?!WARES[good].shops.includes(b.id):B.needWares||!B.sells.includes(good))return 0;
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
 for(const a of RT.agents){if(a.carry||economyFreightTotal(a))dropLost(a);else economyRelease(a);if(a.mission==='goodsPick'||a.mission==='goodsDrop')a.mission=null;}
}
function saveGame(){try{economyBeforeSave();localStorage.setItem(SAVE_KEY,JSON.stringify(G));return true;}catch(e){return false;}}
function economyRemove(b){
 const E=economyState();
 for(const c of E.claims.values())if(c.source===b||c.target===b){const a=c.agent;dropLost(a);a.mission=null;a.state='idle';a.timer=.2;a.path.length=0;a.hidden=false;}
 const B=BUILDINGS[b.id];releaseShopStock(b);
 for(const kind of ['inbox','outs']){const p=economyPoint(b,kind),map=economyMap(p,'rice');for(const g in map)moveGoods(p,economyCentral(g),g,economyCount(p,g),'demolish-store');}
 if(B.makes){moveGoods(economyPoint(b,'pile'),economyCentral(B.makes),B.makes,b.pile||0,'demolish-harvest');moveGoods(economyPoint(b,'buffer'),economyCentral(B.makes),B.makes,b.buffer||0,'demolish-batch');}
 E.dirty=true;
}
function removeBuilding(b){
 economyRemove(b);const B=BUILDINGS[b.id];
 for(let j=0;j<B.h;j++)for(let i=0;i<B.w;i++)G.bmap[idx(b.x+i,b.y+j)]=-1;
 G.buildings.splice(G.buildings.indexOf(b),1);
 for(const v of G.villagers){if(v.home===b.uid)v.home=-1;if(v.job===b.uid)v.job=-1;}
 for(const a of RT.agents)if(a.target===b.uid||a.dest===b.uid||a.home2===b.uid){dropLost(a);a.mission=null;a.resting=false;a.state='idle';a.timer=.2;a.hidden=false;a.path.length=0;}
 RT.groundDirty=true;refreshBoosts();assignHomes();assignJobs();
}
function dropLost(a){
 economyRelease(a);a.shopSupply=null;
 if(a.carry){const g=a.carry.good;moveGoods(economyPoint(a,'carry'),economyCentral(g),g,a.carry.n,'recover-carrier');}
 if(a.freight)for(const g in a.freight)moveGoods(economyPoint(a,'freight'),economyCentral(g),g,a.freight[g],'recover-cart');
}
function depositCarry(a,b){
 if(!b)return;let delivered=0;
 if(a.carry){const g=a.carry.good,p=economyDestination(b,g),n=Math.min(a.carry.n,economyRoom(p,g,economyClaimOf(a)));
  delivered+=moveGoods(economyPoint(a,'carry'),p,g,n,'delivery');}
 if(a.freight)for(const g in a.freight){const p=economyDestination(b,g),n=Math.min(a.freight[g],economyRoom(p,g,economyClaimOf(a)));
  delivered+=moveGoods(economyPoint(a,'freight'),p,g,n,'cart-delivery');}
 economyPromoteCargo(a);if(delivered){const B=BUILDINGS[b.id];floater(b.x*16+B.w*8,b.y*16-2,'+'+delivered,'build','#e9dcae');}
}
function depositCarryWarehouse(a,b){if(b)depositCarry(a,b);else dropLost(a);}
function missionArrive(a,v,b){
 const m=a.mission;a.mission=null;
 if(m==='shopReturn'){depositCarry(a,b);if(a.carry){dropLost(a);}return true;}
 if(m!=='goodsPick'&&m!=='goodsDrop'){if(a.carry)depositCarry(a,b);economyRelease(a);return true;}
 const c=economyClaimOf(a);
 if(!c){economyPromoteCargo(a);if(a.carry&&returnShopCarry(a))return 'walking';return true;}
 if(m==='goodsPick'){
  if(c.source!==b||!bByUid(c.target.uid)){economyRelease(a);return true;}
  const n=Math.min(c.n,economyAvailable(c.from,c.good,c),economyRoom(c.to,c.good,c));
  if(n<=0&&!c.extra){economyRelease(a);return true;}
  c.n=moveGoods(c.from,economyPoint(a,'carry'),c.good,n,'pickup');c.picked=true;c.until=economyState().t+100;
  if(c.extra)for(const l of c.extra){const amount=Math.min(l.n,economyAvailable(l.from,l.good,c),economyRoom(l.to,l.good,c));l.n=moveGoods(l.from,economyPoint(a,'freight'),l.good,amount,'cart-pickup');}
  economyPromoteCargo(a);if(!a.carry){economyRelease(a);return true;}
  if(isPorter(v)&&a.carry.n+economyFreightTotal(a)>=CART_AT){a.carry.kind='cart';a.speedMul=1-(1-.78)*(1-Math.min(.9,carryOf(a)));}
  a.mission='goodsDrop';a.dest=c.target.uid;
  if(walkTo(a,c.target))return 'walking';dropLost(a);a.mission=null;return true;
 }
 depositCarry(a,b);economyRelease(a);v.en=Math.max(0,(v.en??100)-4);
 if(a.carry&&returnShopCarry(a))return 'walking';return true;
}
function shopMissionArrive(a,v,b){return missionArrive(a,v,b);}
function planShopSupply(a,v){
 if(a.carry||isPorter(v))return null;const E=economyState();if(E.dirty)economyTopology();
 let hauling=0;for(const c of E.claims.values())if(!isPorter(vById(c.agent.vid))&&c.to.kind==='shelf')hauling++;
 if(hauling>=Math.max(1,Math.ceil(E.workers*.35)))return null;
 const component=economyAgentComponent(a);let best=null,score=-Infinity;
 for(let i=0;i<E.jobCount;i++){const j=E.jobs[i];if(economyBuildingComponent(j.source)!==component||j.from.owner!==G||j.to.kind!=='shelf')continue;
  const n=Math.min(j.n,economyAvailable(j.from,j.good),economyRoom(j.to,j.good));if(n<1)continue;
  if(porterReach(j.target)&&shopTotal(j.target,!!WARES[j.good])>0)continue;
  const d=Math.abs(a.x/16-j.source.x)+Math.abs(a.y/16-j.source.y)+Math.abs(j.source.x-j.target.x)+Math.abs(j.source.y-j.target.y),s=(j.rank+Math.min(8,n))/(10+d);
  if(s>score){score=s;best=j;}}
 if(!best)return null;return economyStart(a,v,best.from,best.to,best.good,Math.round(6*(1+vStats(v).carry)),best.source,best.target);
}
function dropFor(g,fromB){const E=economyState();if(E.dirty)economyTopology();return economyOutputTarget(g,fromB);}
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
   const to=dropFor(B.makes,J);if(to){const plan=economyStart(a,v,pile,economyDestination(to,B.makes),B.makes,Math.max(capacity,avail),J,to);if(plan)return plan;}
  }
  if(full){a.bubble={t:1.5,icon:'!'};return economyReserved(pile,B.makes,false)>0?economyWait(a,J):null;}
  a.mission='work';return J;
 }
 if(B.craft){
  J.inbox=J.inbox||{};J.outs=J.outs||{};
  const c=chooseCraft(J),outs=economyPoint(J,'outs'),reach=porterReach(J),full=outTotal(J)>=OUT_CAP;
  let ready=null,n=0;for(const g in J.outs){const k=economyAvailable(outs,g);if(k>n&&shopsFor(g).length){ready=g;n=k;}}
  if(ready&&(full||(reach?n>=Math.ceil(OUT_CAP*.5):n>=3||!c||c.mode!=='craft'))){
   const to=dropFor(ready,J);if(to){const plan=economyStart(a,v,outs,economyDestination(to,ready),ready,capacity,J,to);if(plan)return plan;}}
  if(full&&Object.keys(J.outs).some(g=>economyReserved(outs,g,false)>0))return economyWait(a,J);
  if(c&&c.mode==='craft'&&!full){a.mission='craft';a.craftWare=c.w;return J;}
  if(c&&c.mode==='fetch'){
   const p=economyPoint(J,'inbox'),need=WARES[c.w].from[c.g]-(J.inbox[c.g]||0);
   if(economyReserved(p,c.g,true)>=need)return economyWait(a,J);
   const st=economyNearStore(J),want=Math.min(economyRoom(p,c.g),WARES[c.w].from[c.g]*Math.round(3*(1+vStats(v).carry)));
   if(st){const plan=economyStart(a,v,economyCentral(c.g),p,c.g,Math.max(1,want),st,J);if(plan)return plan;}
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
function craftDone(b,v,w){
 w=w&&WARES[w]?w:b.recipe;const R=WARES[w];if(!R)return;b.inbox=b.inbox||{};b.outs=b.outs||{};
 const input=economyPoint(b,'inbox');for(const g in R.from)if(economyCount(input,g)<R.from[g])return;
 const s=vStats(v),amt=1+(Math.random()<clamp((s.wrk-6)/30*workMul(v)*(1+(b.boost||0))+s.craft,0,.75)?1:0);
 for(const g in R.from)destroyGoods(input,g,R.from[g],'craft-input');
 createGoods(economyPoint(b,'outs'),w,amt,'craft-output');b.prog=((b.prog||0)+1)%4;economyFlush(b);
 floater(b.x*16+16,b.y*16-2,'+'+amt,'w_'+w,'#f2d27a');if(Math.random()<.3)giveXP(v,1);
}
function sell(a,b){
 const before=G.stats.sales,B=BUILDINGS[b.id],qty=rint(1,2+(a.wallet>2?1:0))+(likes(a,b)?1:0),L=lvInfo(b),ws=waresOf(b.id),wares=shopStock(b,true),goods=shopStock(b),p=economyPoint(b,'shelf');
 let base=0,n=0,wn=0;
 for(let i=0;i<qty;i++){
  let w=null;for(let j=0;j<ws.length;j++){const k=ws[j];if((wares[k]||0)>=1&&(!w||WARES[k].price>WARES[w].price))w=k;}
  if(w){destroyGoods(p,w,1,'retail');base+=WARES[w].price;n++;wn++;}
  else if(!B.needWares&&B.sells.every(g=>(goods[g]||0)>=1)){for(const g of B.sells)destroyGoods(p,g,1,'retail');base+=B.price;n++;}
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
 for(const v of G.villagers){if(v.role!=='work'){v.job=-1;continue;}if(v.job>=0&&inds.find(b=>b.uid===v.job&&entranceOf(b)))load[v.job]=(load[v.job]||0)+1;else v.job=-1;}
 for(const v of G.villagers)if(v.role==='work'&&v.job<0){
  const free=inds.filter(b=>b.id!=='porter'&&(load[b.uid]||0)<BUILDINGS[b.id].slots&&entranceOf(b));
  if(!free.length)continue;free.sort((a,b)=>(load[a.uid]||0)-(load[b.uid]||0)||a.uid-b.uid);v.job=free[0].uid;load[v.job]=(load[v.job]||0)+1;}
 economyState().dirty=true;
}
function porterHouseSprite(){
 const p=new ArtPB(32,44),C=EDO_WORK_PALETTE;
 p.rect(2,22,28,18,'#d4c1a0');p.rect(4,24,24,14,'#493928');
 for(let x=4;x<29;x+=4){p.rect(x,23,.65,16,'#94734e');p.rect(x+.65,23,.33,16,'#ba9665');}
 p.rect(2,39,28,3,'#9e825d');p.rect(3,39,26,.65,'#ddc294');p.rect(3,41,26,.65,'#705439');
 p.poly([[0,23],[4,12],[27,12],[32,23]],'#34383c');
 p.poly([[1,22],[5,13],[27,13],[31,22]],'#59616a');
 for(let y=15;y<23;y+=2){p.rect(3-(y-15)/4,y,25+(y-15)/2,.55,'#30383d');}
 for(let x=5;x<29;x+=3.7){p.line(x,13,x-2.2,22,'#7d8383');p.line(x+.7,13,x-1.5,22,'#424a51');}
 p.rect(1,22,30,1.6,'#262e32');p.hline(1,22,30,'#9a9e96');
 p.rect(6,24,10,1,'#c1a16b');p.rect(7,25,3,9,'#314d59');p.rect(11,25,3,9,'#314d59');
 p.hline(8,27,1,'#e5debb');p.rect(10,35,4,.7,'#755438');
 // Rope rack, shoulder poles, wrapped consignments and a parked wooden cart.
 artStroke(p,[[24,25],[22,37]],.65,'#bc9661');artStroke(p,[[26,25],[25,36]],.55,'#78583b');
 p.ellipse(21,28,2,3.1,'#c5aa74');p.ellipse(21,28,1.2,2.2,'#68583d');p.line(20.7,30.5,19.2,33.5,'#d5bb85');
 p.rect(3,32,5,5,'#b4915b');p.hline(3,33,5,'#ddbc80');p.vline(5,32,5,'#665037');
 p.rect(14,34,13,4,'#987548');p.hline(14,34,13,'#d2ad6d');p.rect(15,36,12,.5,'#5f482f');
 p.circle(17,39,2.5,'#3e3530');p.circle(17,39,1.7,'#bb945f');p.circle(17,39,.6,'#4e3c2e');
 p.circle(25,39,2.5,'#3e3530');p.circle(25,39,1.7,'#bb945f');p.circle(25,39,.6,'#4e3c2e');
 p.line(26,35,30,31,'#c4a071');p.rect(17,29,7,5,'#b6a078');p.vline(20,29,5,'#596d6c');p.hline(17,31,7,'#596d6c');
 p.shadeEdges(.92,1.045);const o=p.outlined(OUTLINE);return {cv:o.canvas(),ox:-1,oy:-13};
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
 if(B.needWares)return false;const raw=shopStock(b,false);for(let i=0;i<B.sells.length;i++)if((raw[B.sells[i]]||0)<1)return false;return true;
}

function economyWait(a,b){
 if(a.target!==b.uid){a.mission='goodsPause';return b;}
 a.state='goodsRest';a.mission=null;a.moving=false;a.hidden=false;a.timer=2;return null;
}

function economyFreightTotal(a){let n=0;if(a.freight)for(const g in a.freight)n+=a.freight[g];return n;}
function economyPromoteCargo(a){
 if(a.carry||!a.freight)return;for(const g in a.freight)if(a.freight[g]>0){moveGoods(economyPoint(a,'freight'),economyPoint(a,'carry'),g,a.freight[g],'cart-front');break;}
}
function economyAddLine(c,from,to,good,n){
 if(!c||c.good===good||c.extra&&c.extra.some(l=>l.good===good))return 0;
 n=Math.min(n,economyAvailable(from,good),economyRoom(to,good));if(n<1)return 0;
 if(!c.extra)c.extra=[];if(c.extra.length>=3)return 0;c.extra.push({from:from,to:to,good:good,n:n});return n;
}
function economyBundle(a){
 const c=economyClaimOf(a),E=economyState();if(!c)return;let room=24-c.n;
 for(let i=0;i<E.jobCount&&room>0;i++){const j=E.jobs[i];if(j.source!==c.source||j.target!==c.target)continue;
  room-=economyAddLine(c,j.from,j.to,j.good,Math.min(room,j.n));}
}
function economyComponents(E){
 const map=E.components,q=E.queue;map.fill(0);let label=0;
 for(let i=0;i<G.roads.length;i++){if(!G.roads[i]||map[i])continue;let head=0,tail=0;label++;map[i]=label;q[tail++]=i;
  while(head<tail){const at=q[head++],x=at%MAP_W,y=(at/MAP_W)|0;
   for(let d=0;d<4;d++){const nx=x+ROAD_STEPS[d][0],ny=y+ROAD_STEPS[d][1];if(nx<0||ny<0||nx>=MAP_W||ny>=MAP_H)continue;
    const next=ny*MAP_W+nx;if(G.roads[next]&&!map[next]){map[next]=label;q[tail++]=next;}}}}
 E.roadRevision=ROAD_TRAFFIC.revision;
}
function economyBuildingComponent(b){const E=economyState(),e=E.entrances.get(b);return e?E.components[idx(e[0],e[1])]:0;}
function economyConnected(a,b){const n=economyBuildingComponent(a);return n>0&&n===economyBuildingComponent(b);}
function economyAgentComponent(a){
 const E=economyState(),sx=clamp(Math.round((a.x-8)/16),0,MAP_W-1),sy=clamp(Math.round((a.y-12)/16),0,MAP_H-1);
 let n=E.components[idx(sx,sy)];if(n)return n;const b=bByUid(a.target);if(b&&(n=economyBuildingComponent(b)))return n;
 const p=nearestRoad(sx,sy);return p?E.components[idx(p[0],p[1])]:0;
}
