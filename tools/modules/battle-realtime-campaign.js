/* Campaign adapter: Classic remains the default. Realtime owns open-field hits only;
   the existing deployment, duels, wall siege, rewards, retreats and save version remain authoritative. */
const RT_ACTOR_CAP=48;
const RT_GUN_SOUND={vol:.38};
const RT_STANCE_TEXT={
 inf:{line:'Line: 18% less melee damage.',loose:'Loose: wider spacing and 10% less ranged damage.',pikewall:'Pikewall: stationary; 45% less melee damage.'},
 gun:{line:'Line: +12% damage, 15% tighter aim; closer ranks.',loose:'Loose: wider spacing and 10% less incoming damage.'},
 arc:{line:'Line: +12% damage, 15% tighter aim; closer ranks.',loose:'Loose: wider spacing and 10% less incoming damage.'},
 cav:{line:'Line: +12% melee damage.',loose:'Loose: +15% movement, wider spacing, 10% less ranged damage.',skein:'Skein: wedge; +35% first charge impact, 10% less ordinary melee damage.'}
};
function battleModeOf(){return G?.battleMode==='realtime'?'realtime':'classic';}
function migrateBattleConfig(){G.battleMode=battleModeOf();const old=G.battleStances||{},next={};for(const t of ['inf','gun','arc','cav'])next[t]=GrandCombat.stances[t][old[t]]?old[t]:'line';G.battleStances=next;}
function rtBattleChosen(){return BT?.combatMode==='realtime';}
function rtTrimVillageFrames(){for(const c of _villageRigCache.values())perfRelease(c);_villageRigCache.clear();
 // The covered village display/ground are rebuilt on return, not retained alongside the field.
 if(VIEW.cv){VIEW.cv.width=VIEW.cv.height=0;BT.rtVillageSuspended=true;}if(RT.ground){perfRelease(RT.ground);RT.ground=null;RT.groundDirty=true;}
}
function rtFieldAllowed(){return rtBattleChosen()&&!siegeHold();}
function rtRestoreClassicBuffer(){rtRestoreClassicScenery();if(BT?.buf&&!BT.buf.width){BT.buf.width=BT.vw*ART_DENSITY;BT.buf.height=BT.vh*ART_DENSITY;BT.bx=BT.buf.getContext('2d',{alpha:false});BT.bx._artDensity=ART_DENSITY;}}
function rtReleaseClassicBuffer(){if(BT?.rt&&rtIsFieldView()&&BT.buf){BT.buf.width=BT.buf.height=0;rtTrimClassicScenery();}}
// Classic resolves a whole burst in one hit; the live model resolves each bullet.
function rtPersonalFactor(c,to,kind){return kind==='gun'&&ITEMS[commanderWeapon(c)]?.burst?1:personalWeaponFactor(c,to,kind);}
function rtCounterPower(g){const side=sideOf(g),lv=side===0&&BT.flv?BT.flv[g.type]||0:BT.A[side].strat||0;return 1+counterBonus(lv);}
function rtGround(x,y){return 30*Math.exp(-((x-260)**2/40000+(y-270)**2/50000))+39*Math.exp(-((x-1060)**2/55000+(y-790)**2/50000))-8*Math.exp(-((y-(443+Math.sin(x*.006)*45))**2)/1600);}
function rtDeploymentHTML(){if(!rtBattleChosen())return '<p class="note" style="margin:6px 10px">Battle mode: Classic · change in Village → Options before battle.</p>';
 return `<div class="rt-deploy"><b>Real-time field combat</b><span class="muted"> · ${BT.siege?'Classic wall siege, then real-time after the breach.':'Continuous attacks, physical projectiles and cavalry orders.'}</span><div class="row wrap">${['inf','gun','arc','cav'].filter(t=>BT.A[0].groups.some(g=>g.type===t)).map(t=>`<label>${icon('u_'+t)} ${UNITS[t].name} <select data-rt-deploy="${t}" aria-label="${UNITS[t].name} stance">${Object.keys(GrandCombat.stances[t]).map(k=>`<option value="${k}"${G.battleStances?.[t]===k?' selected':''}>${GrandCombat.stances[t][k].name}</option>`).join('')}</select></label>`).join('')}</div><small class="muted">Army tactics, commander skills, Ki and cinematic duels still apply. Shape and cavalry targets can be changed on the field.</small></div>`;
}
function rtBindDeployment(){for(const el of $$('[data-rt-deploy]'))el.onchange=()=>{(G.battleStances||={})[el.dataset.rtDeploy]=el.value;};}
function rtNormalizeStyle(s,g,side,cache){if(cache.has(s))return cache.get(s);const k=s.sprs,r=reactionRecipe(s,g),faces={},frames={idle:k.idle[0],idle2:k.idle[1]||k.idle[0],runA:k.run?.[0]||k.idle[0],runB:k.run?.[2]||k.run?.[1]||k.idle[0],wind:k.wind||k.atk,aim:k.aim||k.idle[0],atk:k.atk||k.idle[0],follow:k.follow||k.atk,recover:k.recover||k.idle[0],reload:k.reload||k.recover||k.idle[0],brace:k.brace||k.wind||k.idle[0],cheer:k.cheer||k.idle[0]};
 if(r){const sample={...s,fate:{kind:'death',recipe:r},droppedHat:false};for(const key of ['stagger','kneel','rest','panic']){frames[key]=reactionFrame(sample,g,key);faces[key]=1;}sample.fate.kind='rout';for(const key of ['runA','runB']){frames['flee'+key]=reactionFrame(sample,g,key);faces['flee'+key]=1;}}
 else{frames.stagger=k.hurt||k.idle[0];frames.kneel=frames.rest=k.fall||k.hurt||k.idle[0];frames.panic=frames.stagger;frames.fleerunA=frames.runA;frames.fleerunB=frames.runB;}
 const weapon=r?.L.gear?.w||s.look?.gear?.w||s.artKit?.w,meta=ITEMS[weapon];
 const socket=k.atk?.muzzleSocket;const out={frames,faces,muzzleX:socket?Math.abs(socket.x-k.atk.width/2):12,muzzleHeight:socket?k.atk.height-socket.y:17,mounted:!!k.horse,burst:meta?.burst||1,reload:meta?.burst?1+(meta.reload||0):1,shotPower:meta?.shotPower??1,nativeFace:side?-1:1,kit:r?.L.gear||s.look?.gear||s.artKit||{},weapon:r?reactionProp(r,'weapon')?.cv:null,flag:s.sashimono?sashimonoFrames(s.sashimono):null};cache.set(s,out);return out;
}
function rtMapSource(m){const s=m.source;if(!s)return;const x=m.x/1400*BT.WW,y=BT.fy0+m.y/1020*(BT.fy1-BT.fy0);s.x=s.tx=s.sx=x;s.y=s.ty=s.sy=y;s.face=m.face;s.q.length=0;s.state=m.moving?'run':m.pendingAt?'fight':'idle';s.fightUntil=m.pendingAt?BT.t+.3:0;s.hurtUntil=m.hurtUntil>BT.rt.model.time?BT.t+(m.hurtUntil-BT.rt.model.time):0;}
const RT_PERSONAL_SORT=(a,b)=>b.p-a.p;
function rtBindHero(m,g){const c=m.source.hero,w=duelWeapon(m.source);m.commander=c;m.heroActor=true;m.kind=w.kind==='gun'?'gun':w.kind==='bow'?'arc':g.type==='cav'?'cav':'inf';
 m.vanguard=c.post!=='hq'&&(c.post==='van'||skv(c,'vanguard')>0);m.weaponReach=w.reach*1.45;m.weaponTempo=w.style==='claw'?.72:w.style==='nodachi'?1.55:w.style==='zanbato'?1.65:w.style==='naginata'?1.2:1.05;
 m.heroSlot=0;m.chargeTravel=0;m.chargeReady=false;m.fired=m.landed=m.strikes=m.damage=m.officerDamage=m.chargeImpacts=0;
}
function rtRefreshHeroBudgets(R){for(const [g,b]of R.heroBudgets){if(g.heroOnly)continue;let total=0,hq=0;
 for(const r of b.list)r.p=persPow(r.c,r.actor?.kind||g.type);b.list.sort(RT_PERSONAL_SORT);
 for(let i=0;i<b.list.length;i++){const r=b.list[i];r.w=r.p*(PERS_W[i]??.04);total+=r.w;if(r.c.post==='hq')hq+=r.w;}
 const perTroop=Math.max(.001,UNITS[g.type].atk*g.atkMul*.26),share=Math.min(1.5,total*PERS_K/(Math.max(1,g.troops)*perTroop));b.rank=1+(total?share*hq/total:0);
 const support=1/3+2/3*Math.min(1,Math.max(0,g.troops)/Math.max(1,g.start*.3)),budget=Math.min(Math.max(1,g.start)*1.5,total*PERS_K/perTroop)*support;
 for(const r of b.list)if(r.actor)r.actor.force=total?budget*r.w/total:0;
}}
function rtStandingOfficer(s){const m=BT?.rt?.actorsBySource?.get(s);return !!(m?.personal&&!m.commander.ko&&m.commander.hp>0&&s.alive&&!s.out&&!s.fate);}
function rtFormationActive(f){if(f.g.troops>0)return true;for(const m of f.officers)if(m.alive&&!m.commander.ko&&m.commander.hp>0)return true;return false;}
function rtMakeCampaignModel(){const session=BT,styleCache=new WeakMap(),sources=new Map(),heroBudgets=new Map(),extras=[],mapped=new Set(),rng=seeded(BT.seed^0x6d2b79f5),rt={model:null,view:null,selected:null,extras,styleCache,sources,heroBudgets,rng,windowAt:0,hudAt:0,gunAudioAt:-1000,panelKey:'',paused:false,hooking:false};BT.rt=rt;
 for(const A of BT.A)for(const g of A.groups){let list=g.heroOnly?g.spr.slice(0,1):g.spr.filter(s=>s.alive&&!s.fate);if(g.troops>0&&!list.length&&g.spr.length){const s=g.spr[0];recoverVisual(s);s.alive=true;list=[s];}sources.set(g,list);
  const kit=g.kitDist,gearMrk=kit?['w','a','h'].reduce((n,slot)=>n+(kit[slot]||[]).reduce((v,[id,w])=>v+(ITEMS[id]?.mrk||0)*w,0),0):0,cmds=(g.cmds||[]).filter(c=>!c.ko&&c.s);g.mrk=Math.max(0,g.solo?.s.mrk||((cmds.length?cmds.reduce((n,c)=>n+c.s.mrk,0)/cmds.length:12)+gearMrk));
  heroBudgets.set(g,{rank:1,list:(g.cmds||[]).filter(c=>c.s).map(c=>({c,p:0,w:0,actor:null}))});
 }
 function randomCall(fn){const old=Math.random;Math.random=rng;try{return fn();}finally{Math.random=old;}}
 const sim={A:session.A,random:rng,clock:()=>{},power:(g,force,kind,scale=1,charged=kind==='cav',actor=null)=>{const A=session.A[sideOf(g)],ranged=kind==='gun'||kind==='arc',tac=TACTICS[tacFam(g)].mod,
   ret=Math.min(1,retEq(g)/Math.max(1,g.troops)),personal=A.mode==='army'&&!g.heroOnly&&!actor?.personal?(heroBudgets.get(g)?.rank||1):1,
   skills=1+(A.strat||0)*.05+(g.mods.attackup||0)*.1+(A.beast?.[kind]||0),
   weaponSkill=ranged?1+(g.mods.marksman||0)*.08:kind==='cav'&&charged?1+(g.mods.cavmaster||0)*.1:1,j=session.jutsu[sideOf(g)]==='clone'?1.4:1;
  return force*(1+ret)*personal*UNITS[kind].atk*g.atkMul*battleAttack(g)*tac[ranged?'rng':'mel']*skills*weaponSkill*j*tateAtk(g)*scale*(.88+rng()*.24);
 },prepareShot:(p,g)=>{p.counterFamily=tacFam(g);p.counterPower=rtCounterPower(g);},impact:(power,to,force,kind,from,shot)=>{const ward=kind==='gun'?to.mods.bulletres:kind==='arc'?to.mods.arrowres:kind==='cav'?to.mods.horseres:0,
   frozen=shot?.counterFamily!=null,fam=frozen?shot.counterFamily:from?tacFam(from):null,counter=fam&&COUNTER[fam]===tacFam(to)?(frozen?shot.counterPower:rtCounterPower(from)):1,
   mask=session.jutsu[sideOf(to)]==='smoke'&&(kind==='gun'||kind==='arc')?.4:1,
    owner=shot?.from?.personal?shot.from.commander:shot?.personal?shot.commander:from?.solo,
    mult=(1-Math.min(.6,(ward||0)*.1))*(1-Math.min(.3,(to.mods.shadow||0)*.05))*TACTICS[tacFam(to)].mod.take*counter*personalDamageGuard(to,kind)*(owner?rtPersonalFactor(owner,to,kind):1)*tateTake(to,kind)*mask;
  return battleDamage(power,battleResistance(to),mult,force);
 },totals:()=>session.A.map(totalOf)};sim.damage=(g,to,force,kind,scale,charged=kind==='cav',actor=null)=>sim.impact(sim.power(g,force,kind,scale,charged,actor),to,force,kind,g,actor);
 const art={battle:()=>sim,style:(type,side,variant,g,i)=>rtNormalizeStyle(sources.get(g)[i],g,side,styleCache),building:id=>buildingSprite(id),prop:(id,side=0)=>propImg(id,side),teamColor:side=>CLANS[session.A[side].clan||'kage']?.banner||'#3b4a7a',emblem:side=>IMG['mon_'+(session.A[side].clan||'kage')]};
 rt.model=GrandCombat.create(art,session.seed,{compact:!!session.deploy,count:g=>g.troops>0||g.heroOnly?sources.get(g).length:0,
  stanceOf:(g,side)=>side===0?G.battleStances?.[g.type]||'line':g.type==='cav'?'skein':g.type==='arc'?'loose':'line',
  attach:(m,g,i)=>{m.source=sources.get(g)[i];if(m.source.hero&&!m.source.hero.beast)rtBindHero(m,g);if(!m.alive){m.fate=m.source.duelCorpse?'death':'rout';m.fateAt=-20;}mapped.add(m.source);},
  beforeThink:()=>{rtRefreshHeroBudgets(rt);rtTickBattleTactics(rt);},
  officerAlive:m=>!m.commander.ko&&m.commander.hp>0&&m.source.alive&&!m.source.out&&!m.source.fate,
  officerHit:(from,to,n,kind)=>{const c=to.commander,g=to.f.g;if(c.ko||!(c.hp>0))return 0;const before=c.hp,old=Math.random;Math.random=rng;
   try{let guards=0;for(const r of c.retF||[])if(!r.out&&!r.dead)guards++;
    // A drawn soldier/projectile represents a bundle of men. Reuse commander pressure,
    // applied only to the officer actually struck, rather than dumping that bundle into one HP pool.
    const damage=PRESS_K*n/Math.max(6,g.troops)*Math.sqrt(Math.max(.5,from.f.g.atkMul))*postFx(c).expose*(kind==='gun'||kind==='arc'?.7:1)*30/(30+Math.max(0,c.s.def))*(1-Math.min(.35,guards*.07))*rnd(.7,1.3)*(1-equipmentGuard(c,kind==='inf'||kind==='cav'));
    c.hp=Math.max(0,c.hp-damage);c.dmgT=(c.dmgT||0)+before-c.hp;cmdHurt(g,c,before-c.hp,from.f.g);if(c.ko){to.alive=false;session.hudDirty=true;}return (before-c.hp)/3;
   }finally{Math.random=old;}
  },
  onShot:m=>{if((m.kind||m.f.type)==='gun'){const now=performance.now();if(now-rt.gunAudioAt>120){rt.gunAudioAt=now;Sound.play('volley',RT_GUN_SOUND);}}},
  onStance:f=>{if(f.side===0)(G.battleStances||={})[f.type]=f.stance;},
  beforeHit:(from,to,n,kind)=>{if(rt.hooking)return;rt.hooking=true;try{randomCall(()=>{const h={from:from.f.g,to:to.f.g,kills:n};rtMapSource(from);rtMapSource(to);
    if(session.A[0].mode==='army'){const share=retEq(h.from)/Math.max(1,h.from.troops+retEq(h.from));if(share)retCredit(h.from,n*share);for(const [c,f]of retHit(h.to,n)){const hr=h.to.heroes?.find(s=>s.hero===c),q=hr?.guards?.find(q=>q.retRef===f);if(q?.alive)killSprite(h.to,q,'knock',from.face);}}
    if(h.from.solo){h.from.solo.kills=(h.from.solo.kills||0)+n;if(h.from.heroOnly)h.from.solo.pk=(h.from.solo.pk||0)+n;}
    else if(from.personal){const c=from.commander;c.kills=(c.kills||0)+n;c.pk=(c.pk||0)+n;}
   });}finally{rt.hooking=false;}},
  afterHit:(from,to,n,kind)=>{const g=to.f.g;independentDamage(g,from.f.g);if(g.solo&&!g.heroOnly&&session.A[sideOf(g)].mode==='skirmish')g.solo.hp=Math.min(g.solo.hpMax||g.solo.s.hp,g.troops*3);cohesionDamage(g,n,from.f.g);session.hudDirty=true;rtBattleImpact(rt,kind);},
  casualty:m=>{const s=m.source;rtMapSource(m);if(s.alive&&!s.fate)randomCall(()=>exitSprite(m.f.g,s,m.f.type,m.face));if(m.f.g.troops<=0)unitBreak(m.f.g);return s.fate?.kind==='rout'?'rout':'death';},
  externallyDead:m=>!m.source.alive||!!m.source.fate,
  revive:m=>{recoverVisual(m.source);m.source.alive=true;}
 },rtGround);
 const actorsBySource=new Map();rt.actorsBySource=actorsBySource;for(const m of rt.model.models)actorsBySource.set(m.source,m);
 function addExtra(s,g,side,owner=null,hq=false){if(mapped.has(s))return;mapped.add(s);const f=rt.model.groups.find(f=>f.g===g);if(!f)return;const c=s.hero,hs=g.heroes||[],m={id:1000+extras.length,source:s,ownerActor:actorsBySource.get(owner)||null,hq,f,heroIndex:Math.max(0,hs.indexOf(s)),heroCount:hs.length,vanguard:false,chargeTarget:null,positioned:false,style:rtNormalizeStyle(s,g,side,styleCache),face:side?-1:1,x:f.x+f.face*8,y:f.y,phase:s.ph||0,alive:s.alive&&!s.out,fate:null,fateAt:0,hurtUntil:0,actionAt:-100,shotAt:-100,pendingAt:0,aimUntil:0,reloadUntil:0,moving:false,dropX:0,dropY:0,dropAngle:(hash2(extras.length,6)-.5)*2.5,hidden:false};extras.push(m);actorsBySource.set(s,m);
  if(c&&!hq){rtBindHero(m,g);m.heroSlot=(m.heroIndex-(Math.max(1,hs.length)-1)/2)*24;m.y+=m.heroSlot;rt.model.registerOfficer(m);
   Object.defineProperty(m,'hp',{get:()=>Math.max(0,c.hp||0)/3});Object.defineProperty(m,'maxHp',{get:()=>Math.max(0,c.hpMax||c.s.hp)/3});const r=heroBudgets.get(g)?.list.find(r=>r.c===c);if(r)r.actor=m;
  }
 }
 for(let side=0;side<2;side++){const A=session.A[side];for(const g of A.groups){for(const s of g.spr)if(!mapped.has(s))addExtra(s,g,side);for(const s of g.heroes||[]){addExtra(s,g,side);for(const q of s.guards||[])addExtra(q,g,side,s);if(s.pet)addExtra(s.pet,g,side,s);}}for(const s of A.hqSpr||[])addExtra(s,s.g,side,null,true);}
 rt.view=GrandFieldView.create($('#battle-cv'),art,rt.model,{ground:rtGround,canvasFactory:gameCanvas,castle:!!session.siege,terrainScale:.5,framing:!!session.deploy,standards:!!session.deploy,deployment:session.deploy,shake:()=>rtShakeAmount(rt),top:$('#bformations').getBoundingClientRect().bottom-$('#battle-cv').getBoundingClientRect().top+8,bottom:100,extras:()=>extras,enabled:()=>!!BT&&BT===session&&rtIsFieldView(),select:f=>rtSelectFormation(f.id),preview:rtPreviewDeployment,place:rtDeployAt});
 rtRefreshHeroBudgets(rt);rt.model.syncOfficers();rtUpdateExtras(0);return rt;
}
function rtUpdateExtras(dt){const R=BT.rt,t=R.model.time;for(const f of R.model.groups){f.g.front=f.x/1400*BT.WW;f.g.hx=f.g.front;f.g.hy=BT.fy0+f.y/1020*(BT.fy1-BT.fy0);for(const m of f.members){if(m.alive)rtMapSource(m);else if(m.source.fate)updateLifeState(m.source,dt,f.g,f.side);}}
 for(let i=0;i<R.extras.length;i++){const m=R.extras[i],s=m.source,f=m.f;if(s.fate)updateLifeState(s,dt,f.g,f.side);if(s.out&&!s.fate)updSprite(s,dt,f.g,f.side);
  if(s.fate||s.out||!s.alive){if(!m.fate){m.alive=false;m.fate=s.fate?.kind==='death'||s.duelCorpse?'death':'rout';m.fateAt=t;m.dropX=m.x+6;m.dropY=m.y+7;}if(m.fate==='rout'){m.x-=f.face*60*dt;m.hidden=t-m.fateAt>5;}continue;}
  if(!m.alive){m.alive=true;m.fate=null;m.hidden=false;m.fateAt=0;}
  if(m.personal){rtMapSource(m);continue;}
  const owner=m.ownerActor,n=Math.max(1,m.heroCount),baseY=f.y+(m.heroIndex-(n-1)/2)*Math.min(40,Math.max(24,(f.rows-1)*f.stride/n));
  let tx=m.hq?(f.side?1335:65):owner?owner.x-f.face*(10+(i%3)*8):f.x+f.face*(f.type==='inf'&&!m.vanguard?-14:8),ty=m.hq?260+(i%5)*33:owner?owner.y+((i%3)-1)*14:baseY;
  if(m.vanguard&&f.order!=='hold'&&f.stance!=='pikewall'&&!(f.type==='cav'&&(f.state==='withdraw'||f.state==='regroup'))){const e=m.chargeTarget,ranged=f.type==='gun'||f.type==='arc',lead=ranged?42:70;
   tx=f.x+f.face*lead;if(e?.alive){const stop=e.x-f.face*(ranged?180:14);tx=f.face>0?Math.min(tx,stop):Math.max(tx,stop);ty=clamp(e.y,baseY-45,baseY+45);}
  }
  tx=clamp(tx,45,1355);ty=clamp(ty,70,950);if(!m.positioned){m.x=m.hq?tx:f.x+f.face*8;m.y=ty;m.positioned=true;}
  const dx=tx-m.x,dy=ty-m.y,d=Math.hypot(dx,dy),step=(m.hq?60:Math.max(owner?100:65,f.speed+(m.vanguard?45:15)))*dt;
  m.moving=d>.7&&step>0;if(d>0&&step>0){m.x+=dx/d*Math.min(d,step);m.y+=dy/d*Math.min(d,step);}m.face=m.chargeTarget?.alive&&m.vanguard?(m.chargeTarget.x>=m.x?1:-1):f.face;
  m.pendingAt=0;m.actionAt=f.lastStrikeAt;m.shotAt=(f.type==='arc'||f.type==='gun')&&f.fired>0?f.lastShotAt:-100;m.aimUntil=0;
  rtMapSource(m);
 }
}
function rtStartWindow(){if(!rtFieldAllowed())return false;
 if(BT.rtGadgetRound!==BT.roundSeq){BT.rtGadgetRound=BT.roundSeq;const hits=[];equipmentGrenades('inf',hits,{siege:false});if(hits.length){BT.rtGadgetAnimating=true;rtRestoreClassicBuffer();BT.phaseName='inf';BT.pt0=BT.t;BT.script=buildPhaseScript('inf',hits);BT.next=Math.max(.6,BT.script.dur-.25);return false;}}
const R=BT.rt||rtMakeCampaignModel();BT.rtGadgetAnimating=false;R.model.reconcile();R.windowAt=R.model.time;R.paused=false;releaseDuelCinema();BT.cine=BT.focus=null;R.view.resizeIfNeeded();BT.state='realtime';BT.phaseName='realtime';rtReleaseClassicBuffer();BT.script=null;BT.next=Infinity;$('#bcall').innerHTML='';$('#bcut').innerHTML='';$('#btac').innerHTML='';clearCamKeys();rtBeginBattleTactics(R);renderBHUD();rtRenderControls(true);return true;}
function rtIsFieldView(){return !!(BT?.rt&&!siegeHold()&&!BT.rtGadgetAnimating&&BT.phaseName!=='duel'&&!BT.cine&&!BT.duelShot);}
function rtSelectFormation(id,fromCard=false){const R=BT?.rt;if(!R)return;const f=R.model.groups[id];if(!f||!rtFormationActive(f))return;
 if(BT.deploy?.active){if(f.side===0){R.selected=f;R.view.select(f);BT.deploy.tapArmed=fromCard;BT.deploy.notice='';rtRenderDeployment();}return;}
 if(f.side===0){R.selected=f;R.view.select(f);}else if(R.selected?.type==='cav'){R.model.target(R.selected.id,id);Sound.play('tap');}rtRenderControls(true);
}
function rtRenderControls(force=false){const root=$('#rt-controls');if(!root||!BT?.rt)return;const R=BT.rt;root.hidden=!rtIsFieldView()||BT.state==='done'||BT.deploy?.active;if(root.hidden)return;rtRenderBattleLayers(R);const f=R.selected,
  enemies=f?.type==='cav'?R.model.groups.filter(g=>g.side!==f.side&&rtFormationActive(g)):[],key=[f?.id,f?.stance,f?.order,f?.priorityTarget,f?.state,f?.intent,R.paused,...enemies.map(e=>e.id)].join(':');
 if(!force&&key===R.panelKey)return;R.panelKey=key;
 root.innerHTML=`<div class="rt-tools"><button class="btn ghost" data-rt-action="pause">${R.paused?'▶ Play':'Ⅱ Pause'}</button><button class="btn ghost" data-rt-action="overview">Overview</button><button class="btn ghost" data-rt-action="follow">Follow</button><button class="btn ghost" data-rt-action="angle">2.5D / Iso</button>${f?`<button class="btn ghost" data-rt-action="close" aria-label="Close formation controls">×</button>`:''}</div>${f?`<div class="rt-orders"><b>${icon('u_'+f.type)} ${UNITS[f.type].name}</b><button class="btn ${f.order==='hold'?'gold':'ghost'}" data-rt-order="hold">Hold</button><button class="btn ${f.order!=='hold'&&f.order!=='fallback'?'gold':'ghost'}" data-rt-order="advance"${f.stance==='pikewall'?' disabled':''}>${f.type==='cav'?'Charge cycle':'Advance'}</button><button class="btn ${f.order==='fallback'?'gold':'ghost'}" data-rt-order="fallback">Fall Back</button><span class="rt-choices">${Object.entries(GrandCombat.stances[f.type]).map(([k,v])=>`<button class="btn ${f.stance===k?'gold':'ghost'}" data-rt-stance="${k}"${tipAttr(RT_STANCE_TEXT[f.type][k])}>${v.name}</button>`).join('')}</span>${f.type==='cav'?`<span class="rt-targets"><small>Target</small><button class="btn ${f.priorityTarget==null?'gold':'ghost'}" data-rt-target="auto">Auto</button>${enemies.map(e=>`<button class="btn ${f.priorityTarget===e.id?'gold':'ghost'}" data-rt-target="${e.id}" aria-label="Target enemy ${UNITS[e.type].name}">${icon('u_'+e.type)}${e.g.heroOnly?' '+esc(e.g.solo?.name||''):''}</button>`).join('')}</span>`:''}<small class="rt-detail">${f.type==='gun'||f.type==='arc'?`MRK ${Math.round(f.g.mrk)} · ${(GrandCombat.cadence(f.type,f.g.mrk)*(f.members[0]?.style.reload||1)).toFixed(1)}s / ${f.members[0]?.style.burst>1?'burst':'shot'}`:f.type==='cav'?`${f.intent==='relieve'?'Relieve infantry':f.intent==='flank'?'Flank':f.intent==='ordered'?'Ordered target':'Engage'} · ${f.state}${f.pinned?' · tied up in infantry':''}`:RT_STANCE_TEXT.inf[f.stance]}</small></div>`:'<small>Tap a blue formation to set its shape. Select cavalry, then tap an enemy formation to name its target.</small>'}`;
 for(const b of root.querySelectorAll('[data-rt-action]'))b.onclick=()=>{const a=b.dataset.rtAction;if(a==='pause')R.paused=!R.paused;else if(a==='overview'){R.view.cancelAutoFocus();R.view.overview();}else if(a==='follow')R.view.follow();else if(a==='angle')R.view.angle();else{R.selected=null;R.view.select(null);}rtRenderControls(true);};
 for(const b of root.querySelectorAll('[data-rt-order]'))b.onclick=()=>rtIssueOrder(f.id,b.dataset.rtOrder);
 for(const b of root.querySelectorAll('[data-rt-stance]'))b.onclick=()=>{if(!R.model.setStance(f.id,b.dataset.rtStance)){toast('Hold the new shape for a moment before changing again.');return;}rtRenderControls(true);};
 for(const b of root.querySelectorAll('[data-rt-target]'))b.onclick=()=>{R.model.target(f.id,b.dataset.rtTarget==='auto'?null:+b.dataset.rtTarget);rtRenderControls(true);};
 const layer=$('#rt-battle-layers');if(layer)layer.style.setProperty('--rt-orders-height',root.getBoundingClientRect().height+'px');
}
function rtUpdateBattle(rdt){const R=BT.rt;if(!R)return;const dt=R.paused?0:rdt*battlePlaybackRate();BT.t+=dt;BT.anim=(BT.anim||0)+dt;
 if(BT.retreatReq&&BT.state!=='done'){BT.playerRetreat=true;for(const p of R.model.shots)p.on=false;finishBattle('lose','You sounded the retreat.');rtRenderControls(true);return;}
 R.model.advance(dt);rtUpdateExtras(dt);for(const l of BT.labels)l.t+=dt;BT.labels=BT.labels.filter(l=>l.t<1.9);for(const f of BT.fx)f.t-=dt;BT.fx=BT.fx.filter(f=>f.t>0);for(const n of BT.pops)n.t+=dt;BT.pops=BT.pops.filter(n=>n.t<.8);BT.nums.length=0;
 if(BT.state!=='done'&&R.model.outcome){const side=R.model.outcome.side;finishBattle(side==null?'draw':side===0?'win':'lose');rtRenderControls(true);}
 else if(BT.state!=='done'&&R.model.time-R.windowAt>=25)rtNextWindow();
 if(R.model.time-R.hudAt>.25||BT.state==='done'&&BT.hudDirty){R.hudAt=R.model.time;BT.hudDirty=false;renderBHUD();rtRenderControls();}
}
// Run recovery, pressure, Ki and duel decisions once per window, without the Classic marching pause.
function rtNextWindow(){endRound();if(BT.state==='autowait')beginRound();
 if(BT.state==='run'&&BT.phaseName!=='duel'&&!BT.cine&&!BT.duelShot){BT.phase=0;rtStartWindow();}
}
function rtReleaseBattle(){if(BT?.rt){BT.rt.view.destroy();BT.rt.model.shots.forEach(p=>p.on=false);BT.rt=null;}if(BT?.rtVillageSuspended)resizeView();for(const id of ['#rt-controls','#rt-battle-layers']){const root=$(id);if(root){root.hidden=true;root.innerHTML='';}}}

// Realtime keeps a finite set of poses and avoids retaining the legacy flying/spinning frames.
// Compress rendered detail only; logical sockets, gear, identity and procedural painters are unchanged.
function rtCompactFrame(cv,density=1.5){if(!cv?.detail?.width||!BT||!rtBattleChosen())return cv;const src=cv.detail,w=Math.ceil(cv.width*density),h=Math.ceil(cv.height*density);if(src.width<=w&&src.height<=h)return cv;
 const d=gameCanvas();d.width=w;d.height=h;const x=d.getContext('2d');x.imageSmoothingEnabled=false;x.drawImage(src,0,0,w,h);src.width=src.height=0;cv.detail=d;(BT.rtArtCanvases||=new Set()).add(cv);return cv;
}
function rtCompactSet(set){if(!rtBattleChosen())return set;const old=new Set();for(const v of Object.values(set))if(Array.isArray(v))v.forEach(c=>c instanceof HTMLCanvasElement&&old.add(c));else if(v instanceof HTMLCanvasElement)old.add(v);
 if(set.idle?.length>2)set.idle[2]=set.idle[0];if(set.run?.length===4){set.run[1]=set.run[0];set.run[3]=set.run[2];set.step=set.run[0];}if(set.spin)set.spin=set.spin.map(()=>set.hurt||set.idle[0]);if(set.horse?.length===4){set.horse[1]=set.horse[0];set.horse[3]=set.horse[2];}
 const keep=new Set();for(const v of Object.values(set))if(Array.isArray(v))v.forEach(c=>c instanceof HTMLCanvasElement&&keep.add(c));else if(v instanceof HTMLCanvasElement)keep.add(v);
 for(const c of old)if(!keep.has(c))perfRelease(c);const density=BATTLE_RECIPES.get(set)?.hero?1.5:1;for(const c of keep)rtCompactFrame(c,density);return set;
}
