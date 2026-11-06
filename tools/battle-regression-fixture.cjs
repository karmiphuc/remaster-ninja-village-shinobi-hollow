// Isolated before/after fixtures. Never imported by the standalone game.
module.exports=async function install(page){await page.evaluate(()=>{
 window.balanceFixture=function(o={}){
  if(BT)closeBattle();Math.random=seeded(o.seed||11731);newGame();G.tut=1;G.speed=0;G.battleMode=o.mode||'realtime';G.autoDuel=!!o.duels;G.allHands=false;G.roll=null;G.boons=freshBoons();$('#title').hidden=true;resizeView();afterLoad();MQ.length=0;$('#modal').hidden=true;closeSheet();setDensity(o.density||'dense');
  const types=['inf','gun','arc','cav'],counts=o.counts||[720,720,720,720];
  function army(side){const groups=types.map((type,i)=>{const troops=(side?o.enemyCounts:o.counts)?.[i]??counts[i];if(!troops)return null;
   const weapon=type==='gun'?(o.weapon||'tanegashima'):type==='arc'?'yumi':type==='inf'?'yari':'naginata',cmds=[];
   for(let k=0;k<(side?(o.enemyOfficers??o.officers)||0:o.officers||0);k++){const skill=o.skills?(type==='inf'?'chain':type==='gun'||type==='arc'?'rapid':'cavmaster'):'attackup',s={atk:30,def:20,hp:160,str:24,mrk:35,wrk:10,...o.heroStats},level=o.skills?3:0,
     gear={w:o.heroWeapons?.[type]||weapon,a:o.heavy?'kokuyo_gusoku':'domaru',h:o.heavy?'eboshi_samurai':'kabuto',m:o.heroMount||(type==='cav'?'nanbu':null)},look=artTroopLook(type,side,k+i*3,gear),
     c={id:`balance-${side}-${type}-${k}`,name:`Officer ${side}-${type}-${k}`,s,look,hp:s.hp,hpMax:s.hp,skill,slv:level,sk:{[skill]:level,...(k===1?{counter:2}:null)},post:o.posts?.[k]||(k===1?'van':'line'),guard:o.retainers||0,kills:0};
    if(o.retainers)c.retF=Array.from({length:o.retainers},(_,n)=>retFighter({_i:n,w:weapon,a:'lamellar',h:'jingasa',m:type==='cav'?'jiba':null}));cmds.push(c);
   }
   return {type,troops,atkMul:o.attack??1.2,defMul:o.defense??1.1,guards:cmds.reduce((n,c)=>n+c.guard,0),cmds,mods:modsOf(cmds),kitDist:{w:[[weapon,1]],a:[['lamellar',1]],h:[['jingasa',1]]}};
  }).filter(Boolean);return finishArmy({side,clan:side?'kurogane':'kage',name:side?'Rivals':'Kage Clan',mode:'army',strat:0,ki:0,groups});}
  const pa=army(0),ea=army(1),site={id:'balance-review',name:'Balance review',type:'dojo',clan:'kurogane',power:2000,reward:{}};
  const auto=runAutoResolve;try{if(o.fast)runAutoResolve=()=>{};startBattle(null,{site,pa,ea,skipDeployment:!o.deployment,seed:o.deployment?(o.seed||11731):undefined},!!o.fast);}finally{runAutoResolve=auto;}
  if(o.deployment){BT.autoKi.on=false;return BT;}
  BT.seed=o.seed||11731;BT.autoKi.on=false;BT.round=0;BT.roundSeq=0;BT.phase=-1;BT.state='run';BT.speed=1;
  if(o.siege){const hp=Math.round(totalOf(ea)*.75);BT.siege={hp,max:hp,breached:false};BT.maxR=4;}
  if(o.fast)return BT;
  if(G.battleMode==='realtime'){BT.round=BT.roundSeq=1;rtStartWindow();return BT.rt;}
  if(o.siege){buildBattleBG();layoutSprites();}
  const duel=preDuel;try{if(o.noDuels)preDuel=()=>false;beginRound();}finally{preDuel=duel;}return BT;
 };
 window.balanceLedger=function(o){balanceFixture({...o,mode:'classic',fast:true});let hash=2166136261,hits=0,damage=0,duels=0;const apply=applyBattleHit,sim=simDuel;
  function mix(s){for(let i=0;i<s.length;i++)hash=Math.imul(hash^s.charCodeAt(i),16777619);}
  applyBattleHit=function(h){const before=h.to.troops,paid=h.applied;apply(h);if(!paid&&h.applied){hits++;damage+=before-h.to.troops;mix([BT.roundSeq,BT.phaseName,sideOf(h.from),h.from.type,h.to.type,h.kills,h.to.troops].join('|'));}};
  simDuel=function(p){const D=sim(p);duels++;for(const e of D.log)mix([e.r,e.chain,e.index,e.hit,e.dmg,e.hp,e.ko].join('|'));return D;};
  try{Math.random=seeded(o.seed);let n=0;while(BT.state!=='done'&&n++<500)autoResolveRound();if(BT.state!=='done')throw Error('Classic fixture did not finish');return {hash:hash>>>0,hits,damage,rounds:BT.roundSeq,result:BT.result,duels,gate:BT.siege?.hp??null,totals:BT.A.map(totalOf),troops:{...G.troops}};}
  finally{applyBattleHit=apply;simDuel=sim;closeBattle();MQ.length=0;$('#modal').hidden=true;}
 };
 window.balanceDps=function(o){const R=balanceFixture({...o,mode:'realtime',counts:[0,100000,0,0],enemyCounts:[100000,0,0,0],attack:.4,defense:30}),M=R.model,f=M.groups[0],e=M.groups[1];
  function move(g,x){const dx=x-g.x;g.x=g.homeX=g.goalX=x;for(const m of g.members)m.x+=dx;}
  move(f,300);move(e,300+o.distance);M.order(f.id,'hold');M.order(e.id,'hold');
  const nominal=GrandCombat.cadence('gun',f.g.mrk)*(f.members[0].style.reload||1),cycleSteps=Math.ceil(nominal*60-1e-9),steps=cycleSteps*8,seconds=steps/60;
  for(let i=0;i<cycleSteps*3+90;i++)M.advance(1/60);const damage=f.damage,fired=f.fired,hits=f.landed;
  for(let i=0;i<steps;i++)M.advance(1/60);const s=M.snapshot(),out={damage:f.damage-damage,fired:f.fired-fired,hits:f.landed-hits,seconds,cycleSeconds:cycleSteps/60,mrk:f.g.mrk,dps:(f.damage-damage)/seconds,residual:s.residual};closeBattle();return out;
 };
 window.balanceAttackMath=function(){const R=balanceFixture({mode:'realtime',seed:11731}),sim=R.model.sim,out=[];
  try{for(const kind of ['inf','gun','arc','cav']){const from=BT.A[0].groups.find(g=>g.type===kind),to=BT.A[1].groups.find(g=>g.type===kind),ward=kind==='gun'?'bulletres':kind==='arc'?'arrowres':kind==='cav'?'horseres':null;
   for(const level of [0,3,6]){if(ward)to.mods[ward]=level;for(const charged of [false,true])out.push({kind,ward:ward?level:0,charged,damage:sim.damage(from,to,100,kind,.2,charged)});}
  }return out;}finally{closeBattle();}
 };
 window.balancePerf=function(o){balanceFixture({...o,noDuels:true});if(o.mode==='classic'){let n=0;while(BT.phaseName!=='inf'&&BT.state!=='done'&&n++<6000)updateBattle(1/30);if(BT.state==='done')throw Error('Classic fixture ended before profiling');}
  for(let i=0;i<120;i++){updateBattle(1/60);drawBattle();}const cv=$('#battle-cv'),pixels=cv.getContext('2d').getImageData(0,0,cv.width,cv.height).data;let sceneHash=2166136261;for(let i=0;i<pixels.length;i++)sceneHash=Math.imul(sceneHash^pixels[i],16777619);
  return {mode:o.mode,sceneHash:sceneHash>>>0,actors:o.mode==='realtime'?BT.rt.model.models.length+BT.rt.extras.length:BT.A.reduce((n,A)=>n+A.groups.reduce((n,g)=>n+g.spr.length+(g.heroes||[]).reduce((n,h)=>n+1+(h.guards||[]).length,0),0),0),memory:perfMemory()};
 };
 window.balancePerfMeasure=function(){const n=360,u=new Float64Array(n),d=new Float64Array(n),f=new Float64Array(n);let drawCanvases=0,updateCanvases=0;
  for(let i=0;i<n;i++){let created=__balanceCanvases,t=performance.now();updateBattle(1/60);const middle=performance.now();u[i]=middle-t;updateCanvases+=__balanceCanvases-created;created=__balanceCanvases;drawBattle();const end=performance.now();drawCanvases+=__balanceCanvases-created;d[i]=end-middle;f[i]=end-t;}
  u.sort();d.sort();f.sort();return {updateMedian:u[180],renderMedian:d[180],frameMedian:f[180],frameP95:f[342],drawCanvases,updateCanvases,memory:perfMemory()};
 };
 window.balanceRenderControl=function(){for(let i=0;i<360;i++)drawBattle();const n=360,d=new Float64Array(n),created=__balanceCanvases;
  for(let i=0;i<n;i++){const t=performance.now();drawBattle();d[i]=performance.now()-t;}d.sort();return {renderMedian:d[180],renderP95:d[342],drawCanvases:__balanceCanvases-created};
 };
});};
