/* Data-only staged combat. No battlefield, soldier frames or shared clock fast-forward.
   Damage, round effects, HP duels and the final campaign settlement use the watched battle's rules. */
const AUTO_RESOLVE_TIP='Resolve without loading the battlefield. Uses staged combat, your army tactics, equipment and Auto Duel setting. Losses and rewards still apply; army march time is unchanged. Sieges use your army without hiring siege engines.';
function prepareAutoArmy(){
 for(const A of BT.A){A.hqSpr=[];for(const g of A.groups){g.spr=[];g.heroes=[];g.hx=g.hy=g.front=0;
  for(const c of g.cmds||[]){c.hpMax??=c.s.hp;c.hp??=c.hpMax;
   if(c.post==='hq'&&!g.solo)continue;
   const h={hero:c,_g:g,alive:g.troops>0,out:!!c.ko,guards:[],x:0,y:0,sx:0,sy:0,hdx:0,hdy:0,si:A.side,q:[]};
   if(g.solo===c)g.spr.push(h);else g.heroes.push(h);
  }
 }}
}
function autoJutsuEffect(side,j){const D=BT.A[1-side];
 if(j==='fire'||j==='wind')for(const g of D.groups)if(g.troops>0&&(j==='fire'?g.type==='gun'||g.type==='arc':g.type==='inf'||g.type==='cav')){
  g.troops=Math.max(0,g.troops-Math.min(g.troops,(j==='fire'?.16:.1)*g.troops+3));independentDamage(g);unitBreak(g);
 }
}
function autoDuelResolve(pairs){const D=simDuel(pairs);BT.duels=(BT.duels||0)+1;
 for(const e of D.log){if(e.reload)continue;e.applied=true;D.committed++;if(!e.hit)continue;
  e.t.cur=e.hp;e.t.hr.hero.hp=e.hp;if(e.t.g.heroOnly)refreshIndependent(e.t.g);
  if(e.ko&&!e.t.loss){e.t.loss=duelLoss(e.t,e.f,pairs.length);D.res.push(e.t.loss);}
 }
 for(const f of D.yields)if(!f.loss){f.loss=duelLoss(f,f.by,pairs.length);D.res.push(f.loss);}
 for(const R of D.res){R.L.out=R.save!=='ward';independentDuelExit(R.gL);}
 return D;
}
function autoResolveRound(){const session=BT;if(!session?.headless||session.state==='done')return;
 if(session.retreatReq){session.playerRetreat=true;finishBattle('lose','You sounded the retreat.');return;}
 beginRound();
 for(const p of PHASES){session.phaseName=p;session.phaseId=(session.phaseId||0)+1;
  if(p==='inf')for(const A of session.A)for(const g of A.groups)g.infPursuit=null;
  const gateFire=siegeHold()&&p==='gun'&&!wallRangedAlive(),walled=siegeHold()&&(p==='inf'||p==='cav'),
    hits=collectPhaseHits(p);
  preparePhaseEffects(p,hits,null);
  // Countershots resolve before the clash. Front/rear infantry hits retain their shared travel clock.
  hits.sort(autoHitOrder);for(const h of hits)applyBattleHit(h);
  if(siegeHold()&&(walled||gateFire))gateHit({dmg:siegeAttackPower(p),shot:p==='gun',gateVolley:gateFire});
  for(const A of session.A)for(const g of A.groups)unitBreak(g);
  if(totalOf(session.A[0])<=0||totalOf(session.A[1])<=0||session.breachReset)break;
 }
 session.t+=25;endRound();session.labels.length=0;session.fx.length=0;session.nums.length=0;session.pops.length=0;
 if(session.log.length>200)session.log.splice(0,session.log.length-200);
 if(session.ftacLog)for(const k in session.ftacLog)if(+k<session.round-2)delete session.ftacLog[k];
}
function autoHitOrder(a,b){return (a.icpt?-1:a.infAt??0)-(b.icpt?-1:b.infAt??0);}
function dismissAutoProgress(session){const i=MQ.indexOf(session.autoDialog);if(i<0)return;MQ.splice(i,1);if(i===0)showModal();session.autoDialog=null;}
function runAutoResolve(){const session=BT,bank=G.ki;session.quick=true;session.autoResolve=true;
 $('#map-layer').hidden=true;
 modal('Auto-resolving',`<b>${esc(session.prov.name)}</b><p id="auto-progress" class="note">Resolving attacks, losses and recovery…</p>`,[['Retreat',()=>{if(BT===session&&session.state!=='done')session.retreatReq=true;},'ghost']],{must:true,icon:'army'});
 session.autoDialog=MQ[MQ.length-1];
 function chunk(){if(BT!==session||session.state==='done')return;const until=performance.now()+8;
  try{let n=0;do{autoResolveRound();}while(session.state!=='done'&&++n<8&&performance.now()<until);
  }catch(e){console.error('Auto-resolve failed',e);dismissAutoProgress(session);if(session.state!=='done'){G.ki=bank;closeBattle();toast('Auto-resolve could not finish. Your army can still fight this battle normally.');}return;}
  if(session.state!=='done'){const el=$('#auto-progress');if(el)el.textContent=`Round ${session.roundSeq} · ${fmt(combatCount(session.A[0]))} vs ${fmt(combatCount(session.A[1]))} active`;setTimeout(chunk,0);}
 }
 setTimeout(chunk,0);
}
function autoResolveReport(o){const session=BT;dismissAutoProgress(session);updateHUD();
 const done=()=>{if(BT===session)closeBattle();if(!['hunt','land'].includes(session.prov.type))openMap();o.unlockMsgs.forEach(m=>announce('Spoils of war',m,'scroll'));saveGame();};
 modal(esc(o.title),`<p class="note">Auto-resolved · ${o.rounds} round${o.rounds===1?'':'s'} · staged combat</p><p>${o.drill?'Sparring: no troops lost':session.A[0].mode==='army'?`Troops lost: <b>${fmt(o.lost)}</b>`:'Villager skirmish'} · Enemy remaining: ${fmt(combatCount(session.A[1]))}</p>${o.mvpHtml}${o.duelHtml}<div class="rewards">${o.rewards.map(r=>`<span class="chip">${r}</span>`).join('')}</div>`,[['Continue',done]],{must:true,icon:o.res==='win'?'army':'u_inf'});
 saveGame();
}
