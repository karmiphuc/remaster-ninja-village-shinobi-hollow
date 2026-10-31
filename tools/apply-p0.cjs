const fs=require('fs'),path=require('path'),root=path.resolve(__dirname,'..');
let s=fs.readFileSync(path.join(root,'index.html'),'utf8');
const core=fs.readFileSync(path.join(root,'tools/modules/economy-p0.js'),'utf8');
function rep(a,b){if(s.split(a).length!==2)throw Error('Expected one occurrence: '+a.slice(0,100));s=s.replace(a,()=>b);}
function fnRange(name){const at=s.indexOf('function '+name+'(');if(at<0)throw Error('Missing function '+name);const line=s.indexOf('\n',at);return [at,s.slice(at,line).trimEnd().endsWith('}')?line:s.indexOf('\n}',at)+2];}
function edit(name,a,b){const r=fnRange(name),f=s.slice(...r);if(f.split(a).length!==2)throw Error(name+': missing '+a.slice(0,100));s=s.slice(0,r[0])+f.replace(a,()=>b)+s.slice(r[1]);}
function remove(name){const r=fnRange(name);s=s.slice(0,r[0])+s.slice(r[1]);}
for(const name of ['outTotal','shopStock','shopTotal','shopIncoming','shopRoom','releaseShopStock','migrateShopStock','migrateLogistics','saveGame','removeBuilding','dropLost','depositCarry','depositCarryWarehouse','missionArrive','shopMissionArrive','planShopSupply','dropFor','workerPlan','produce','craftDone','perfBaseSell','sell','assignJobs'])remove(name);
rep('if (window.claude && window.claude.hot && window.claude.hot.ready)',core+'\nif (window.claude && window.claude.hot && window.claude.hot.ready)');
edit('dollHTML'," _doll[k] = ["," const chars=charSprites(L);_doll[k] = [");
edit('dollHTML',"dataURL(charSprites(L).down[0], 4)","dataURL(chars.down[0], 4)");
edit('dollHTML',"dataURL(charSprites(L).right[0], 4)];","dataURL(chars.right[0], 4)];_charCache.delete(artLookSignature(artEquipmentLook(L)));freeCanvases(chars);if(t&&!BT){const key=JSON.stringify([t,0,0,artLookSignature(L),null]);dropSet(key);}");
edit('releaseBattleSprites',"retired.forEach(r=>freeCanvases(r));","retired.forEach(r=>freeCanvases(r));for(const key of _soldierCache2.keys())dropSet(key);");
edit('artLiveVillager',"const img=pb.outlined().canvas();img.ox=-15;img.oy=-25;","const img=perfRigCanvas(pb.outlined(),-15,-25);");
edit('artLiveVillager',"hands=hp.canvas();hands.ox=-14;hands.oy=-24;","hands=perfRigCanvas(hp,-14,-24);");
edit('resetRT','invalidateRoadTraffic();','invalidateRoadTraffic(); RT.eco=null;');
edit('refreshBoosts',"  const envs =","  if(RT.eco)RT.eco.dirty=true;\n  const envs =");
edit('chooseSite',"  const sites =","  if(isPorter(v))return null;const E=economyState();if(E.dirty)economyTopology();const component=economyAgentComponent(a);\n  if(v.job>=0){const J=bByUid(v.job);if(J&&!J.reno&&economyBuildingComponent(J)===component&&entranceOf(J)&&(BUILDINGS[J.id].makes||BUILDINGS[J.id].craft))return J;}\n  const sites =");
edit('updateVillagerAgent',"    const supply=planShopSupply(a,v),J=supply?null:chooseSite(a,v,v.role!=='work');\n    target=supply||(J&&workerPlan(a,v,J));","    if(isPorter(v))target=porterPlan(a,v);else {const supply=planShopSupply(a,v),J=supply?null:chooseSite(a,v,v.role!=='work');target=supply||(J&&workerPlan(a,v,J));}");
edit('updateVillagerAgent',"  if (target && a.mission === 'rest'","  if(target&&target.uid===a.target&&(a.mission==='work'||a.mission==='craft')){arrive(a,v,target);return;}\n  if (target && a.mission === 'rest'");
edit('chooseSite',"(BUILDINGS[b.id].makes || BUILDINGS[b.id].craft) && !b.reno && entranceOf(b)","(BUILDINGS[b.id].makes || BUILDINGS[b.id].craft) && !b.reno && economyBuildingComponent(b)===component && entranceOf(b)");
edit('ensureVillagerAgents',"RT.agents = RT.agents.filter(a => a.kind !== 'villager' || vById(a.vid));","RT.agents=RT.agents.filter(a=>{if(a.kind==='villager'&&!vById(a.vid)){dropLost(a);return false;}return true;});");
edit('updateVillagerAgent',"if(a.carry){returnShopCarry(a);return;}","if(a.carry||economyFreightTotal(a)){economyPromoteCargo(a);returnShopCarry(a);return;}");
edit('updateVillagerAgent',"if (!v) { a.dead = true; return; }","if (!v) { dropLost(a);a.dead = true; return; }");
edit('updateVillagerAgent',"  if (a.state === 'walk')","  if(a.state==='goodsRest'){v.en=Math.min(100,(v.en??100)+dt*4);a.timer-=dt;if(a.timer<=0){a.state='idle';a.timer=0;}return;}\n  if (a.state === 'walk')");
edit('agentFrame',"a.state==='inside'&&a.resting&&!a.hidden","(a.state==='inside'&&a.resting&&!a.hidden)||a.state==='goodsRest'");
edit('updateVillage',"    updateAgents(dt);","    economyTick(dt);updateAgents(dt);");
edit('buildingSprite',"    case 'hut':","    case 'porter': res=porterHouseSprite();break;\n    case 'hut':");
edit('drawLogi',"  if(B.cat==='shop')","  economyBadge(ctx,b,B,px,py);\n  if(B.cat==='shop')");
edit('openBuildingInfo',"    if (B.forgeType)","    if(b.id==='porter')body.appendChild(porterPanel(b));\n    if (B.forgeType)");
edit('openBuildingInfo',"bt.onclick = () => { v.job = b.uid;","bt.onclick = () => { v.job = b.uid;economyState().dirty=true;");
edit('openBuildingInfo',"/${PILE_CAP} waiting","/${PILE_CAP} waiting${(b.buffer||0)>0?' · '+b.buffer+' in finished baskets · production paused':''}");
rep("stock: { rice: 6, veg: 0, tea: 0, wood: 0, ore: 0, silk: 0 },","stock: { rice: 0, veg: 0, tea: 0, wood: 0, ore: 0, silk: 0 },");
edit('newGame',"  genVillage(","  createGoods(economyCentral('rice'),'rice',6,'new-village');\n  genVillage(");
s=s.replaceAll("Object.entries(I.res).forEach(([r, n]) => G.stock[r] -= n)","Object.entries(I.res).forEach(([r,n])=>destroyGoods(economyCentral(r),r,n,'equipment'))");
s=s.replaceAll("(G.stock[r] || 0) >= n","spendableGood(r) >= n").replaceAll("G.stock[r] >= n","spendableGood(r) >= n");
edit('forgeTick',"(G.stock[r]||0)<need","spendableGood(r)<need");
edit('forgeTick',"G.stock[r]=(G.stock[r]||0)-whole;","destroyGoods(economyCentral(r),r,whole,'army-forge');");
edit('openMerchant',"G.stock[good] -= n;","destroyGoods(economyCentral(good),good,n,'merchant');");
edit('openMerchant',"Math.floor(G.stock[good] || 0), 60","Math.floor(spendableGood(good)), 60");
edit('renoBlock',"(G.stock[r] || 0) < N.res[r]","spendableGood(r) < N.res[r]");
edit('startReno',"G.stock[r] -= N.res[r]","destroyGoods(economyCentral(r),r,N.res[r],'renovation')");
edit('tradeWeek',"if (tIsWare(it.k)) G.wares[it.k] -= it.qty; else G.stock[it.k] -= it.qty;","destroyGoods(economyCentral(it.k),it.k,it.qty,'contract');");
fs.writeFileSync(path.join(root,'index.html'),s);
const baseline=JSON.parse(fs.readFileSync(path.join(root,'reports/economy-baseline.json'),'utf8'));
const compact={source:baseline.sourceCommit,weeks:52,seeds:5,summary:baseline.summary,rows:baseline.rows.map(r=>({scenario:r.scenario,seed:r.seed,gold:r.gold,stockout:r.stockout,travellers:r.travellers,worker:r.worker,producer:r.producer,msPerWeek:r.msPerWeek,saveKB:r.saveKB,canvasEnd:r.canvasEnd}))};
s=s.replace('ledgerHooked:false,baseline:null,','ledgerHooked:false,baseline:'+JSON.stringify(compact)+',');
fs.writeFileSync(path.join(root,'index.html'),s);
console.log('Built logistics P0: '+Buffer.byteLength(s)+' bytes');
