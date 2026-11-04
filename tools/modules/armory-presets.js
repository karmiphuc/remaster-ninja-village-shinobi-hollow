/* Bugu-gura: finite saved equipment profiles; arrivals and explicit armory actions only. */
BUILDINGS.bugugura={name:'Bugu-gura',jp:'武具蔵',cat:'train',w:3,h:2,cost:750,appeal:2,desc:'Clan armory. Prepare six-slot kits for new villagers, stock researched equipment in advance, and review incomplete kits.'};
if(!BUILD_ORDER.includes('bugugura'))BUILD_ORDER.splice(BUILD_ORDER.indexOf('library')+1,0,'bugugura');
const BUGU_PROFILES={duelist:{name:'Infantry · Duelist',role:'inf'},frontline:{name:'Infantry · Frontline',role:'inf'},arc:{name:'Archers',role:'arc'},gun:{name:'Gunners',role:'gun'},cav:{name:'Cavalry',role:'cav'},delivery:{name:'Workers · Delivery',role:'work'},craft:{name:'Workers · Craft',role:'work'},farm:{name:'Workers · Farm',role:'work'}};
const BUGU_SLOTS=[['weapon','Weapon'],['armor','Armor'],['head','Headwear'],['mount','Mount / companion'],['special','Special I'],['special2','Special II']];
function buguBuilt(){return G.buildings.some(b=>b.id==='bugugura'&&!b.reno);}
function migrateArmoryPresets(){const old=G.armory||{},profiles={};
 for(const id in BUGU_PROFILES){const from=old.profiles?.[id]||{},slots={};for(const [key] of BUGU_SLOTS){const k=from.slots?.[key];slots[key]=k==='*'?'*':k&&buguFits(BUGU_PROFILES[id].role,key,k)?k:k===undefined?'*':null;}profiles[id]={slots,buy:from.buy===true,reserve:from.reserve===true&&from.buy===true};}
 G.armory={enabled:old.enabled===true,inf:old.inf==='duelist'?'duelist':'frontline',work:['farm','delivery','craft'].includes(old.work)?old.work:'farm',profiles};return G.armory;
}
function armoryState(){return G.armory?.profiles?G.armory:migrateArmoryPresets();}
function buguFits(role,slot,k){const I=ITEMS[k];if(!I||I.slot!==(slot==='special2'?'special':slot)||!itemFits(role,k))return false;
 return !(ROLE_NEED[role]&&roleSlot(role)===slot)||fitsRole(role,k);
}
function buguProfileFor(v){const A=armoryState();if(v.role==='inf')return A.inf;if(v.role!=='work')return BUGU_PROFILES[v.role]?v.role:'frontline';
 const b=bByUid(v.job);return b?.id==='porter'?'delivery':BUILDINGS[b?.id]?.craft?'craft':A.work;
}
function buguScore(id,k){const I=ITEMS[k],base=(I.def||0)*.5+(I.hp||0)*.2;
 if(id==='delivery')return base+(I.carry||0)*1000+(I.move||0)*200+(I.wrk||0)*2;
 if(id==='craft')return base+(I.craft||0)*1000+(I.wrk||0)*6+(I.move||0)*35;
 if(id==='farm')return base+(I.wrk||0)*10+(I.move||0)*70+(I.carry||0)*80;
 if(id==='duelist')return base+(I.str||0)*3+(I.atk||0)*2+(I.duel||0)*6;
 if(id==='frontline')return (I.def||0)*4+(I.hp||0)+(I.str||0)*1.5+(I.atk||0);
 if(id==='arc'||id==='gun')return base+(I.mrk||0)*4+(I.atk||0);
 return base+(I.atk||0)*2+(I.str||0)*2+(I.hp||0)*.5+(I.ride?10:0);
}
function buguAny(id,role,slot){let best=null,score=-Infinity;for(const k in G.items)if(G.items[k]>0&&buguFits(role,slot,k)){const s=buguScore(id,k);if(s>score||s===score&&k<best){score=s;best=k;}}return best;}
function buguBuy(k){const I=ITEMS[k];if(!I||!G.researched[k]||I.cost<=0||I.wild||!canBuyItem(k))return false;
 G.gold-=I.cost;if(I.res)for(const r in I.res)destroyGoods(economyCentral(r),r,I.res[r],'equipment');G.items[k]=(G.items[k]||0)+1;return true;
}
function applyEquipmentPreset(v,id){const P=armoryState().profiles[id];if(!v||!P||BUGU_PROFILES[id]?.role!==v.role||!buguBuilt())return 0;let n=0;
 for(const [slot] of BUGU_SLOTS){if(v.eq[slot])continue;let k=P.slots[slot];if(k==='*')k=buguAny(id,v.role,slot);if(!k||!buguFits(v.role,slot,k))continue;
  if(!(G.items[k]>0)&&P.buy)buguBuy(k);if(!(G.items[k]>0))continue;G.items[k]--;v.eq[slot]=k;n++;
 }return n;
}
function armoryReservePlan(){const wish={},A=armoryState();for(const id in BUGU_PROFILES){const P=A.profiles[id];if(!P.buy||!P.reserve)continue;for(const [slot] of BUGU_SLOTS){const k=P.slots[slot];if(k&&k!=='*'&&buguFits(BUGU_PROFILES[id].role,slot,k)&&G.researched[k]&&ITEMS[k].cost>0&&!ITEMS[k].wild)wish[k]=(wish[k]||0)+1;}}
 const need={};for(const k in wish){const n=wish[k]-(G.items[k]||0);if(n>0)need[k]=n;}return need;
}
function restockArmoryPresets(){if(!buguBuilt())return 0;const need=armoryReservePlan();let n=0;for(const k in need)for(let i=0;i<need[k];i++){if(!buguBuy(k))break;n++;}return n;}
function presetOnArrival(v){if(!buguBuilt())return;const A=armoryState();if(A.enabled)applyEquipmentPreset(v,buguProfileFor(v));restockArmoryPresets();}
function buguChoiceFor(v){const id=UI.buguChoice?.[v.id];return BUGU_PROFILES[id]?.role===v.role?id:buguProfileFor(v);}
function buguPanel(body,b,tab){const A=armoryState();if(tab==='review'){if(UI.buguLastTab!=='review'||UI.buguReviewUid!==b.uid)buguScan(b);UI.buguLastTab='review';renderBuguReview(body,b);return;}UI.buguLastTab='presets';
 const id=BUGU_PROFILES[UI.buguProfile]?UI.buguProfile:'frontline',P=A.profiles[id],meta=BUGU_PROFILES[id];UI.buguProfile=id;
 body.appendChild(h('<p class="note">Presets fill empty slots. Gear villagers bring stays equipped.</p>'));
 const controls=h(`<details class="bugu-settings"><summary>New arrivals · auto-kit ${A.enabled?'on':'off'}</summary><div class="row wrap"><label><input type="checkbox" data-bugu-auto${A.enabled?' checked':''}> Equip new arrivals</label><label>Infantry default <select data-bugu-default="inf"><option value="frontline"${A.inf==='frontline'?' selected':''}>Frontline</option><option value="duelist"${A.inf==='duelist'?' selected':''}>Duelist</option></select></label><label>Worker default <select data-bugu-default="work">${['farm','craft','delivery'].map(k=>`<option value="${k}"${A.work===k?' selected':''}>${BUGU_PROFILES[k].name.split(' · ')[1]}</option>`).join('')}</select></label></div></details>`);
 controls.querySelector('[data-bugu-auto]').onchange=e=>{A.enabled=e.target.checked;controls.querySelector('summary').textContent='New arrivals · auto-kit '+(A.enabled?'on':'off');};controls.querySelectorAll('[data-bugu-default]').forEach(el=>el.onchange=()=>{A[el.dataset.buguDefault]=el.value;});body.appendChild(controls);
 const profiles=h(`<label class="bugu-profiles"><b>Equipment profile</b><select data-bugu-profile>${Object.entries(BUGU_PROFILES).map(([k,m])=>`<option value="${k}"${id===k?' selected':''}>${m.name}</option>`).join('')}</select></label>`);profiles.querySelector('select').onchange=e=>{UI.buguProfile=e.target.value;refreshSheet();};body.appendChild(profiles);
 const grid=h('<div class="bugu-slots"></div>');for(const [slot,name] of BUGU_SLOTS){const keys=Object.keys(ITEMS).filter(k=>buguFits(meta.role,slot,k)).sort((a,b)=>ITEMS[a].tier-ITEMS[b].tier||ITEMS[a].cost-ITEMS[b].cost),selected=P.slots[slot];
  const row=h(`<label class="bugu-slot"><b>${selected&&selected!=='*'?icon('it_'+selected):icon({weapon:'it_katana',armor:'it_lamellar',head:'it_jingasa',mount:'it_jiba',special:'it_horo',special2:'it_ise'}[slot])} ${name}</b><select data-bugu-slot="${slot}"><option value="*"${selected==='*'?' selected':''}>✦ Any available</option><option value=""${selected===null?' selected':''}>— Leave as is</option>${keys.map(k=>`<option value="${k}"${selected===k?' selected':''}>T${ITEMS[k].tier} · ${esc(ITEMS[k].name)}${G.researched[k]?'':' · not researched'} · stock ${G.items[k]||0}</option>`).join('')}</select><small class="muted">${selected&&selected!=='*'?itemStat(selected):selected==='*'?'Uses fitting stock, ranked for this profile.':'Keeps this slot untouched.'}</small></label>`);
  row.querySelector('select').onchange=e=>{P.slots[slot]=e.target.value||null;refreshSheet();};grid.appendChild(row);
 }body.appendChild(grid);
 const buy=h(`<div class="row wrap"><label><input data-bugu-buy type="checkbox"${P.buy?' checked':''}> Buy missing researched gear</label><label><input data-bugu-reserve type="checkbox"${P.reserve?' checked':''}${P.buy?'':' disabled'}> Keep one spare kit</label></div>`);
 buy.querySelector('[data-bugu-buy]').onchange=e=>{P.buy=e.target.checked;if(!P.buy)P.reserve=false;refreshSheet();};buy.querySelector('[data-bugu-reserve]').onchange=e=>{P.reserve=e.target.checked;refreshSheet();};body.appendChild(buy);
 const need=armoryReservePlan(),cost=Object.entries(need).reduce((n,[k,q])=>n+ITEMS[k].cost*q,0),row=h(`<div class="row wrap"><button class="btn" data-bugu-stock>Stock spare kits</button><span class="muted">${Object.values(need).reduce((a,n)=>a+n,0)} named pieces · up to ${fmt(cost)}G + normal materials</span></div>`);
 row.querySelector('button').onclick=()=>{const n=restockArmoryPresets();Sound.play('coin');toast(`${n} spare piece${n===1?'':'s'} bought.`);updateHUD();refreshSheet();};body.appendChild(row);
 body.appendChild(h('<p class="note">Auto-buy applies to named, researched gear at its normal price. “Any available” only uses owned stock. Spare-kit orders are replenished on arrivals and research completion, or with Stock spare kits. Trade-reserved materials remain protected. Workers assigned to a Porter House or Workshop use Delivery or Craft; other workers use your default.</p>'));
}
function buguScan(b){UI.buguReviewUid=b.uid;const limit=UI.buguThreshold===5?5:6;UI.buguReviewIds=G.villagers.filter(v=>BUGU_SLOTS.filter(([s])=>!!v.eq[s]).length<limit).map(v=>v.id);}
function renderBuguReview(body,b){const head=h(`<div><p class="note">A snapshot taken when this tab opens. Fill missing slots while keeping personal weapons and existing gear.</p><div class="row wrap"><label>Show fewer than <select data-bugu-threshold><option value="6"${UI.buguThreshold!==5?' selected':''}>6 slots</option><option value="5"${UI.buguThreshold===5?' selected':''}>5 slots</option></select></label><button class="btn ghost" data-bugu-scan>Rescan</button><button class="btn gold" data-bugu-all>Equip listed</button></div></div>`);
 head.querySelector('[data-bugu-threshold]').onchange=e=>{UI.buguThreshold=+e.target.value;buguScan(b);refreshSheet();};head.querySelector('[data-bugu-scan]').onclick=()=>{buguScan(b);refreshSheet();};head.querySelector('[data-bugu-all]').onclick=()=>{let n=0;for(const id of UI.buguReviewIds||[]){const v=vById(id);if(v)n+=applyEquipmentPreset(v,buguChoiceFor(v));}restockArmoryPresets();toast(`${n} empty slots equipped.`);updateHUD();refreshSheet();};body.appendChild(head);
 let count=0;for(const id of UI.buguReviewIds||[]){const v=vById(id);if(!v)continue;count++;const filled=BUGU_SLOTS.filter(([s])=>!!v.eq[s]).length,pid=buguChoiceFor(v),row=h(`<div class="bugu-review"><div data-card></div><div class="row wrap"><span class="chip">${filled}/6 slots</span><select data-bugu-choice aria-label="Equipment profile for ${esc(vData(id).name)}">${Object.entries(BUGU_PROFILES).filter(([k,m])=>m.role===v.role).map(([k,m])=>`<option value="${k}"${pid===k?' selected':''}>${m.name}</option>`).join('')}</select><button class="btn" data-bugu-equip="${esc(id)}"${filled===6?' disabled':''}>Fill missing</button></div></div>`);
  row.querySelector('[data-card]').appendChild(vCard(v));row.querySelector('select').onchange=e=>{(UI.buguChoice||={})[id]=e.target.value;};row.querySelector('[data-bugu-equip]').onclick=()=>{const n=applyEquipmentPreset(v,buguChoiceFor(v));restockArmoryPresets();toast(n?`${n} empty slots equipped.`:'No fitting stock or affordable researched gear.');updateHUD();refreshSheet();};body.appendChild(row);
 }if(!count)body.appendChild(h('<p class="note">Everyone meets the selected equipment threshold.</p>'));
}
function buguGuraArt(p,W,H,Y){const by=Y+H-1,wall=by-16;
 p.rect(2,by-2,W-4,3,'#6d6562');wallFront(p,2,wall,W-4,15,{plaster:'#efe6d0',wood:'#7a5230',door:false});roofTiles(p,0,1,W,wall+3,'#3a3442');
 p.rect(4,wall+4,12,10,'#2a1a24');p.rect(18,wall+3,13,12,'#4a321e');p.rect(19,wall+4,5,10,'#7a5230');p.rect(25,wall+4,5,10,'#6b4a2e');p.vline(24,wall+4,10,'#2a1a14');p.set(23,wall+9,'#d6ae62');
 // A kabuto and lamellar cuirass in the open bay; native village pixels, not character-scale art.
 p.rect(7,wall+5,6,2,'#8d93a3');p.rect(6,wall+7,8,1,'#4a4a52');p.rect(8,wall+8,4,5,'#3b4a7a');p.hline(8,wall+9,4,'#c8945f');p.hline(8,wall+11,4,'#8d93a3');p.rect(6,wall+9,2,3,'#973f35');p.rect(12,wall+9,2,3,'#973f35');p.hline(5,by-3,12,'#a8743f');
 p.rect(34,wall+4,10,11,'#4a321e');for(let x=35;x<=41;x+=3){p.vline(x,wall+5,10,'#a8743f');p.poly([[x-1,wall+5],[x,wall+1],[x+1,wall+5]],'#d8dce6');}p.hline(33,wall+10,12,'#6b4a2e');
 p.rect(20,wall,10,3,'#3b4a7a');p.vline(24,wall,3,'#efe6d0');p.rect(17,by-1,15,2,'#8a7e6d');
}
