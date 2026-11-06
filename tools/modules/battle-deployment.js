/* Real-time field staging. Battle-only state; no second troop ledger or saved army cap. */
function battleShakeKey(){return ['off','low','full'].includes(G?.battleShake)?G.battleShake:window.matchMedia?.('(prefers-reduced-motion: reduce)').matches?'off':'low';}
function battleShakeScale(){return battleShakeKey()==='off'?0:battleShakeKey()==='full'?1:.38;}
function battleShakeOffset(axis){const t=BT?.anim||0,s=BT?.seed||0,amp=Math.min(1,BT?.shake||0)*battleShakeScale();return Math.sin(t*(axis?127:103)+s)*(axis?1.8:3)*amp/Math.max(1,BT?.S||1);}
function rtCanDeploy(){return !!(BT&&!BT.headless&&!BT.skipDeployment&&rtBattleChosen()&&!BT.siege&&BT.A[0].mode==='army'&&BT.A[1].mode==='army');}
function rtPrimaryGroups(R){const result=[];for(const f of R.model.groups)if(f.side===0&&rtFormationActive(f)&&!result.some(p=>p.type===f.type))result.push(f);return result;}
function rtInitBattleTactics(R){if(R.tactics)return R.tactics;
 const T=R.tactics={begun:false,log:[],open:false,decision:null,signal:false,stage:'waiting',stageAt:0,lastUI:'',title:'',subtitle:'',titleUntil:0,impact:0,impactAt:-10,reserve:null,feint:(BT.seed&3)===0};
 const seen=new Set();for(const f of R.model.groups){const k=f.side+f.type;f.standard=!seen.has(k);f.standardFall=-1;seen.add(k);if(f.side===1&&f.type==='cav'&&f.g.troops>0&&!f.g.heroOnly&&!T.reserve)T.reserve=f;}
 if(T.reserve&&R.model.groups.some(f=>f.side===1&&f.type!=='cav'&&f.g.troops>0)){T.reserve.reserve=true;R.model.order(T.reserve.id,'hold');}else T.reserve=null;
 return T;
}
function rtSyncDeploymentExtras(R,old){for(const m of R.extras)if(!m.personal&&!m.hq){const p=old.get(m.f);if(p){m.x+=m.f.x-p.x;m.y+=m.f.y-p.y;}}rtUpdateExtras(0);}
function rtDeployAt(f,x,y){const R=BT?.rt;if(!R||!BT.deploy?.active||f.side!==0)return false;
 const reason=R.model.placement(f.id,x,y);if(reason){BT.deploy.notice=reason;rtRenderDeployment();return false;}
 const old=new Map();for(const p of R.model.groups)old.set(p,{x:p.x,y:p.y});
 if(!R.model.deploy(f.id,x,y))return false;rtSyncDeploymentExtras(R,old);BT.deploy.ghost.show=false;BT.deploy.tapArmed=false;BT.deploy.notice='';Sound.play('tap');rtRenderDeployment();return true;
}
function rtPreviewDeployment(f,x,y){if(!BT?.deploy?.active)return;const g=BT.deploy.ghost;g.show=true;g.x=x;g.y=y;g.valid=!BT.rt.model.placement(f.id,x,y);}
function rtFitInitialDeployment(R){if(R.deployFitted)return;R.deployFitted=true;const old=new Map();for(const f of R.model.groups)old.set(f,{x:f.x,y:f.y});
 const primary=rtPrimaryGroups(R).sort((a,b)=>['gun','cav','arc','inf'].indexOf(a.type)-['gun','cav','arc','inf'].indexOf(b.type));
 for(let pass=0;pass<2;pass++)for(const f of primary)if(R.model.placement(f.id,f.x,f.y)){
  const ox=f.x,oy=f.y;let found=false;for(let radius=1;radius<=72&&!found;radius++)for(let i=-radius;i<=radius&&!found;i++)for(let edge=0;edge<4&&!found;edge++){
   const x=ox+(edge<2?i:edge===2?-radius:radius)*12,y=oy+(edge<2?(edge===0?-radius:radius):i)*12;
   if(!R.model.placement(f.id,x,y)){R.model.deploy(f.id,x,y);found=true;}
  }
 }
 rtSyncDeploymentExtras(R,old);for(const f of R.model.groups){f.spawnX=f.x;f.spawnY=f.y;f.spawnStance=f.stance;}
}
function rtShowDeployment(){if(!rtCanDeploy())return false;
 BT.deploy||={active:true,ghost:{show:false,x:0,y:0,valid:false}};BT.deploy.active=true;BT.rtTactics=true;
 if(!BT.rt){if(BT.buf)BT.buf.width=BT.buf.height=0;rtTrimClassicScenery(true);}
 const R=BT.rt||rtMakeCampaignModel();R.model.reconcile();rtFitInitialDeployment(R);rtInitBattleTactics(R);BT.state='prep';BT.phaseName='deployment';BT.cine=BT.focus=null;BT.script=null;BT.next=Infinity;clearCamKeys();
 if(!R.selected){R.selected=rtPrimaryGroups(R)[0]||null;R.view.select(R.selected);}
 $('#rt-controls').hidden=true;rtReleaseClassicBuffer();rtRenderDeployment();R.view.overview(true);return true;
}
function rtRenderDeployment(){const R=BT?.rt;if(!R||!BT.deploy?.active)return;const groups=rtPrimaryGroups(R),selected=R.selected;
 const cards=groups.map(f=>{let troops=0;const same=BT.A[0].groups.filter(g=>g.type===f.type);for(const g of same)troops+=g.heroOnly?(g.troops>0?1:0):Math.ceil(Math.max(0,g.troops));
  const power=armyPower({...BT.A[0],groups:same});return `<button class="rt-company${selected?.type===f.type?' selected':''}" data-rt-company="${f.id}" aria-pressed="${selected?.type===f.type}">${icon('u_'+f.type)}<span>${UNITS[f.type].name}<small>${fmt(troops)} combatants</small><small>Power ${fmt(power)}</small></span></button>`;}).join('');
 const selectedType=selected?.type,shapes=selected?Object.entries(GrandCombat.stances[selectedType]).map(([key,v])=>`<option value="${key}"${selected.stance===key?' selected':''}>${v.name}</option>`).join(''):'';
 $('#btac').innerHTML=`<div class="rt-muster"><div class="rt-muster-head"><div><b>布陣 · Plant your banners</b><small>${esc(BT.prov.name)} · ${fmt(combatCount(BT.A[0]))} combatants · ${groups.length} formations</small></div><button class="btn ghost" data-rt-reset>Reset ranks</button></div><div class="rt-companies">${cards}</div><div class="rt-deploy-hint${BT.deploy.notice?' warning':''}" aria-live="polite">${BT.deploy.notice?esc(BT.deploy.notice):'Drag a formation or its banner. Or select a card, then tap the field. Keep the whole formation behind the ivory line.'}</div><div class="rt-muster-foot"><button class="btn ghost" id="bt-retreat">Withdraw</button><label>${selected?icon('u_'+selectedType):''}<select data-rt-shape aria-label="Deployment formation">${shapes}</select></label><button class="btn ghost" data-rt-angle>2.5D / Iso</button><span class="sp"></span><button class="btn gold" id="bt-go">Raise the banners</button></div></div>`;
 for(const el of $$('[data-rt-company]'))el.onclick=()=>rtSelectFormation(+el.dataset.rtCompany,true);
 $('[data-rt-reset]').onclick=()=>{const old=new Map();for(const f of R.model.groups)old.set(f,{x:f.x,y:f.y});R.model.resetDeployment();rtSyncDeploymentExtras(R,old);BT.deploy.notice='';rtRenderDeployment();R.view.overview(true);};
 $('[data-rt-angle]').onclick=()=>R.view.angle();
 $('[data-rt-shape]').onchange=e=>{const old=selected.stance;
  for(const f of R.model.groups)if(f.side===0&&f.type===selected.type)R.model.setStance(f.id,e.target.value,true);
  const reason=R.model.placement(selected.id,selected.x,selected.y);if(reason){for(const f of R.model.groups)if(f.side===0&&f.type===selected.type)R.model.setStance(f.id,old,true);BT.deploy.notice=reason;}
  if(!reason)BT.deploy.notice='';rtRenderDeployment();
 };
 $('#bt-retreat').onclick=()=>{closeBattle();openMap();};$('#bt-go').onclick=rtLaunchDeployment;
 R.view.insets($('#bformations').getBoundingClientRect().bottom-$('#battle-cv').getBoundingClientRect().top+8,$('#btac').getBoundingClientRect().height+18);
}
function rtLaunchDeployment(){const R=BT?.rt;if(!R||!BT.deploy?.active)return false;
 for(const f of rtPrimaryGroups(R)){const reason=R.model.placement(f.id,f.x,f.y);if(reason){BT.deploy.notice=reason;rtRenderDeployment();return false;}}
 BT.deploy.active=false;BT.deploy.ghost.show=false;BT.phaseName=null;R.selected=null;R.view.select(null);$('#btac').innerHTML='';R.view.insets($('#bformations').getBoundingClientRect().bottom-$('#battle-cv').getBoundingClientRect().top+8,100);R.view.overview(true);R.view.beginBattle();
 rtRestoreClassicBuffer();Sound.play('horn');beginRound();return true;
}
function rtTacticalLog(R,text){const T=R.tactics;if(!T)return;T.log.push({at:R.model.time,text});if(T.log.length>40)T.log.shift();T.lastUI='';}
function rtTacticalTitle(R,title,subtitle){const T=R.tactics;if(!T)return;T.title=title;T.subtitle=subtitle;T.titleUntil=R.model.time+3.6;T.lastUI='';}
function rtIssueOrder(id,order){const R=BT?.rt;if(!R||BT.state!=='realtime')return false;const f=R.model.groups[id];if(!f||f.side!==0||!rtFormationActive(f))return false;
 let changed=false;for(const p of R.model.groups)if(p.side===0&&(f.g.heroOnly?p===f:p.type===f.type)&&rtFormationActive(p)){const before=p.order;if(R.model.order(p.id,order)&&p.order!==before)changed=true;}
 if(changed){Sound.play('tap');rtTacticalLog(R,`${UNITS[f.type].name}: ${order==='fallback'?'fall back under cover':order==='hold'?'hold the line':'advance'}.`);}rtRenderControls(true);return true;
}
function rtOpenFieldDecision(R){const T=R.tactics,t=R.model.time;T.signal=true;T.decision={until:t+8,kind:T.reserve?'reserve':'contact',closed:false};
 rtTacticalLog(R,T.reserve?'An enemy mounted reserve waits on the flank.':'The battle lines are closing.');
 rtTacticalTitle(R,T.reserve?'敵の備え · A reserve waits':'接敵 · Lines closing',T.reserve?'Watch the flank. Keep an order in hand.':'Brace the front, or press your advantage.');
}
function rtFieldDecision(choice){const R=BT?.rt,T=R?.tactics,d=T?.decision;if(!R||BT.state!=='realtime'||!d||d.closed||R.model.time>=d.until)return false;
 let target=null;for(const f of R.model.groups)if(f.side===0&&rtFormationActive(f)&&(!target||f.type==='inf')){target=f;if(f.type==='inf')break;}
 if(choice==='intercept'){let horse=null;for(const f of R.model.groups)if(f.side===0&&f.type==='cav'&&rtFormationActive(f)){horse=f;break;}
  if(!horse||!T.reserve||!rtFormationActive(T.reserve))return false;R.model.target(horse.id,T.reserve.id);rtIssueOrder(horse.id,'advance');rtTacticalLog(R,'Our riders turn to intercept the reserve.');
 }else if(choice==='hold'&&target)rtIssueOrder(target.id,'hold');
 else if(choice==='advance'&&target)rtIssueOrder(target.id,'advance');
 else rtTacticalLog(R,'The captains keep their current orders.');
 d.closed=true;T.lastUI='';rtRenderBattleLayers(R);return true;
}
// Called on the existing fixed think cadence. Decisions/feints use combat time, never a wall-clock timer.
function rtTickBattleTactics(R){const T=R.tactics;if(!T?.begun||BT.state!=='realtime'||R.model.outcome)return;const t=R.model.time;
 if(T.reserve&&!rtFormationActive(T.reserve)){T.reserve.reserve=false;T.reserve=null;T.stage='spent';if(T.decision?.kind==='reserve'&&!T.decision.closed){T.decision.closed=true;rtTacticalLog(R,'The enemy reserve has fallen.');}}
 const reserve=T.reserve;
 if(T.decision&&!T.decision.closed&&t>=T.decision.until){T.decision.closed=true;rtTacticalLog(R,'The captains keep their current orders.');}
 if(!T.signal&&t>=3)rtOpenFieldDecision(R);
 if(!reserve||!rtFormationActive(reserve))return;
 let front=null,near=Infinity;for(const f of R.model.groups){if(f.side===1&&f.type==='inf'&&rtFormationActive(f))front=f;if(f.side===0&&rtFormationActive(f))near=Math.min(near,Math.hypot(f.bodyX-reserve.bodyX,f.bodyY-reserve.bodyY));}
 if(T.stage==='waiting'&&(near<200||t>=16||t>=8&&(!front||front.engaged||front.g.troops<front.g.start*.90))){
  reserve.reserve=false;R.model.order(reserve.id,'cycle');T.stage=T.feint&&near>220?'probe':'committed';T.stageAt=t;
  rtTacticalLog(R,T.stage==='probe'?'The enemy reserve probes forward.':'The enemy reserve commits to the field.');rtTacticalTitle(R,'備え動く · Reserve moving','The riders must reach your line before they can strike.');
 }else if(T.stage==='probe'){
  if(reserve.engaged||reserve.pinned||t-T.stageAt>=5){T.stage='committed';}
  else if(t-T.stageAt>=3){R.model.order(reserve.id,'fallback');T.stage='feint';T.stageAt=t;rtTacticalLog(R,'The riders draw back — a feint.');}
 }else if(T.stage==='feint'&&(t-T.stageAt>=2.5||reserve.pinned||t>=24)){
  R.model.order(reserve.id,'cycle');T.stage='committed';rtTacticalLog(R,'The reserve turns and commits.');
 }
}
function rtBeginBattleTactics(R){if(!BT.rtTactics)return;const T=rtInitBattleTactics(R);if(T.begun)return;T.begun=true;
 rtTacticalLog(R,'The banners rise. The army advances.');rtTacticalTitle(R,'出陣 · Banners raised','Attack, hold, or fall back. The captains handle the clash.');rtRenderBattleLayers(R);
}
function rtBattleImpact(R,kind){const T=R.tactics;if(!T||R.model.time-T.impactAt<.24)return;T.impactAt=R.model.time;T.impact=kind==='cav'?1:kind==='inf'?.48:.28;}
function rtShakeAmount(R){const T=R.tactics;return T?Math.max(0,1-(R.model.time-T.impactAt)/.18)*T.impact*battleShakeScale():0;}
function rtRenderBattleLayers(R,force=false){const root=$('#rt-battle-layers'),T=R?.tactics;if(!root)return;if(!T){root.hidden=true;return;}
 root.hidden=BT.state!=='realtime'||!rtIsFieldView()||!T.begun;if(root.hidden)return;const t=R.model.time,d=T.decision,active=d&&!d.closed&&t<d.until,title=T.titleUntil>t&&!active;
 let horse=false;for(const f of R.model.groups)if(f.side===0&&f.type==='cav'&&rtFormationActive(f))horse=true;
 const key=[T.log.length,T.log.at(-1)?.text,T.open,!!active,!!title,horse].join('|');if(!force&&T.lastUI===key){const timer=$('[data-rt-countdown]',root);if(timer)timer.textContent=Math.ceil(d.until-t)+'s · No order needed to continue';return;}T.lastUI=key;
 root.style.setProperty('--rt-layer-top',($('#bformations').getBoundingClientRect().bottom-$('#battle-cv').getBoundingClientRect().top+8)+'px');root.style.setProperty('--rt-orders-height',$('#rt-controls').getBoundingClientRect().height+'px');
 let log='';const count=T.open?8:1,from=Math.max(0,T.log.length-count);for(let i=from;i<T.log.length;i++){const e=T.log[i];log+=`<li><time>${Math.floor(e.at/60)}:${String(Math.floor(e.at%60)).padStart(2,'0')}</time>${esc(e.text)}</li>`;}
 root.innerHTML=`<div class="rt-journal"><button class="rt-journal-toggle" aria-expanded="${T.open}">戦記 · Field reports <span>${T.open?'−':'+'}</span></button><ol>${log}</ol></div>${title?`<div class="rt-feature-title"><b>${esc(T.title)}</b><span>${esc(T.subtitle)}</span></div>`:''}${active?`<div class="rt-field-decision"><b>${d.kind==='reserve'?'Enemy reserve on the flank':'The lines are closing'}</b><span data-rt-countdown>${Math.ceil(d.until-t)}s · No order needed to continue</span><div>${d.kind==='reserve'&&horse&&T.reserve&&rtFormationActive(T.reserve)?'<button data-rt-decision="intercept">Intercept</button>':''}<button data-rt-decision="hold">Hold front</button><button data-rt-decision="advance">Press on</button><button data-rt-decision="keep">Keep orders</button></div></div>`:''}`;
 $('.rt-journal-toggle',root).onclick=()=>{T.open=!T.open;T.lastUI='';rtRenderBattleLayers(R);};
 for(const b of root.querySelectorAll('[data-rt-decision]'))b.onclick=()=>rtFieldDecision(b.dataset.rtDecision);
}
// Covered Classic scenery is rebuilt for its duels/preludes; persistent corpses/decals are retained.
function rtTrimClassicScenery(force=false){if(!BT||!force&&!rtIsFieldView())return;for(const k of ['far','mid','gnd'])if(BT[k]){perfRelease(BT[k]);BT[k]=null;BT.rtSceneryTrimmed=true;}}
function rtRestoreClassicScenery(){if(!BT?.rtSceneryTrimmed)return;const decal=BT.decal,dx=BT.dx,random=Math.random;BT.decal=null;Math.random=seeded(BT.seed^0x4f1bbcdc);
 try{buildBattleBG();perfRelease(BT.decal);}finally{Math.random=random;BT.decal=decal;BT.dx=dx;BT.rtSceneryTrimmed=false;}
}
