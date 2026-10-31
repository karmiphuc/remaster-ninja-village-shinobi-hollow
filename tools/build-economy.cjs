const fs=require('fs'),path=require('path');
const root=path.resolve(__dirname,'..');
let s=fs.readFileSync(path.join(root,'baseline/v19.1.html'),'utf8');
function rep(a,b){if(s.split(a).length!==2)throw Error('Expected one occurrence: '+a.slice(0,100));s=s.replace(a,()=>b);}
function edit(name,a,b){const at=s.indexOf('function '+name+'('),line=s.indexOf('\n',at),end=s.slice(at,line).trimEnd().endsWith('}')?line:s.indexOf('\n}',at)+2;let f=s.slice(at,end);if(f.split(a).length!==2)throw Error(name+': missing '+a.slice(0,100));s=s.slice(0,at)+f.replace(a,()=>b)+s.slice(end);}
s=s.replaceAll("document.createElement('canvas')","gameCanvas()");
const perf=fs.readFileSync(path.join(root,'tools/modules/perf-diagnostics.js'),'utf8');
rep("<script>\n'use strict';","<script>\n'use strict';\n"+perf);
rep('const _villageRigCache=new Map(),_villageToolCache=new Map();','const _villageRigCache=new Map(),_villageToolCache=new Map();\nperfLRU(_villageRigCache,1000);perfLRU(_villageToolCache,96);');
rep('if(_villageRigCache.size>=256)_villageRigCache.delete(_villageRigCache.keys().next().value);','');
rep("if(_villageRigCache.has(key))return _villageRigCache.get(key);","if(_villageRigCache.has(key))return _villageRigCache.get(key);if(SH_PERF.on||SH_PERF.sim)SH_PERF.rigDraws++;");
rep('const _carry = {};','const _carry = perfObjectLRU(512);');
rep('const _pile = {};','const _pile = perfObjectLRU(160);');
rep('const _workshopProductSprites = Object.create(null);','const _workshopProductSprites = perfObjectLRU(48);');
edit('produce','  b.pile = Math.min(PILE_CAP, (b.pile || 0) + amt);','  if(SH_PERF.diag&&!SH_PERF.ledgerHooked){const kept=Math.min(amt,Math.max(0,PILE_CAP-(b.pile||0)));diagGoods(B.makes,kept,true);SH_PERF.diag.overflow+=amt-kept;}\n  b.pile = Math.min(PILE_CAP, (b.pile || 0) + amt);');
edit('craftDone','Object.entries(R.from).forEach(([g, n]) => b.inbox[g] -= n);','Object.entries(R.from).forEach(([g,n])=>{if(SH_PERF.diag&&!SH_PERF.ledgerHooked)diagGoods(g,n,false);b.inbox[g]-=n;});');
edit('craftDone','  b.outs[w] =','  if(SH_PERF.diag&&!SH_PERF.ledgerHooked)diagGoods(w,amt,true);\n  b.outs[w] =');
rep('function sell(a,b){','function perfBaseSell(a,b){');
rep('function boot() {',"function sell(a,b){if(!SH_PERF.diag)return perfBaseSell(a,b);var before=G.stats.sales,w=diagMapCopy(shopStock(b,true)),g=diagMapCopy(shopStock(b,false)),n=perfBaseSell(a,b);diagMapDelta(w,shopStock(b,true),false);diagMapDelta(g,shopStock(b,false),false);diagSale(a,b,n,before);return n;}\nfunction boot() {");
edit('boot','  initUI(); bindVillageInput(); bindMapInput(); initAtelier();','  initUI(); bindVillageInput(); bindMapInput(); initAtelier();perfInit();');
edit('afterLoad',"  centerOnHall(); updateHUD(); Sound.music('village');","  perfPrewarm();centerOnHall(); updateHUD(); Sound.music('village');");
edit('loop','  const rdt =','  if(SH_PERF.on)perfFrame(now);if(SH_PERF.sim){requestAnimationFrame(loop);return;}\n  const rdt =');
fs.writeFileSync(path.join(root,'index.html'),s);
console.log('Built diagnostics foundation: '+Buffer.byteLength(s)+' bytes');
