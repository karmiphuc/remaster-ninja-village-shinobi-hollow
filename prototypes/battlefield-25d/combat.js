// Continuous, camera-independent combat for the standalone battlefield study.
// Models carry real shares of formation HP. Only a landed strike/projectile removes HP.
(()=>{'use strict';
const STEP=1/60,THINK=.18,CELL=64,COLS=26,ROWS=20;
const TYPES=['inf','gun','arc','cav'],FIGURES=[72,30,30,18],Y=500;
const RANGES={gun:840,arc:840};
const STANCES={
 inf:{line:{name:'Line',melee:.82,ranged:1,attack:1,speed:1,gap:.95},loose:{name:'Loose',melee:1,ranged:.90,attack:1,speed:1,gap:1.25},pikewall:{name:'Pikewall',melee:.55,ranged:1,attack:1,speed:0,gap:.92}},
 gun:{line:{name:'Line',melee:1,ranged:1,attack:1.12,speed:1,gap:.90,accuracy:.85},loose:{name:'Loose',melee:.90,ranged:.90,attack:1,speed:1,gap:1.25,accuracy:1}},
 arc:{line:{name:'Line',melee:1,ranged:1,attack:1.12,speed:1,gap:.90,accuracy:.85},loose:{name:'Loose',melee:.90,ranged:.90,attack:1,speed:1,gap:1.25,accuracy:1}},
 cav:{line:{name:'Line',melee:1,ranged:1,attack:1.12,speed:1,gap:1},loose:{name:'Loose',melee:1,ranged:.90,attack:1,speed:1.15,gap:1.18},skein:{name:'Skein',melee:1,ranged:1,attack:.90,charge:1.5,speed:1,gap:.82}}
};
function stance(f){return STANCES[f.type][f.stance]||STANCES[f.type].line;}
function gunSpread(distance,mrk,accuracy=1){const t=clamp((distance-390)/260,0,1);return (distance*.0015+32*t*t+Math.max(0,distance-650)*.065)*(1-.35*Math.max(0,mrk)/(Math.max(0,mrk)+40))*accuracy;}
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
function hash(x,y=0){let n=Math.imul(x+7919,374761393)^Math.imul(y+104729,668265263);n=Math.imul(n^(n>>>13),1274126177);return ((n^(n>>>16))>>>0)/4294967296;}
function cadence(type,mrk){const training=Math.max(0,mrk)/(Math.max(0,mrk)+40);return (type==='gun'?6:3.25)/(1+.85*training);}
function create(art,seed=7711,options={},ground=()=>0){
 const sim=art.battle(seed,options.troops),groups=[],models=[],officers=[],fighters=[],bins=Array.from({length:COLS*ROWS},()=>[]);
 const effects=Array.from({length:220},()=>({on:false,t:0,dur:0,kind:'',x:0,y:0,size:1,face:1,muzzleX:0,muzzleY:17}));
 const shots=Array.from({length:384},()=>({on:false,start:0,dur:1,x0:0,y0:0,x1:0,y1:0,height:0,kind:'',side:0,from:null,force:0,power:0,lastU:0,counterFamily:null,counterPower:1,ox:0,oy:0,face:1,muzzleX:12,muzzleY:17}));
 const impacts=Array.from({length:600},()=>({from:null,to:null,amount:0,kind:''}));
 let time=0,acc=0,applied=0,outcome=null,nextThink=0,joined=false,externalLoss=0,externalRecovery=0;
 const initial=sim.A.reduce((n,a)=>n+a.groups.reduce((v,g)=>v+g.troops,0),0);
 for(let side=0;side<2;side++){const entries=sim.A[side].groups.slice().sort((a,b)=>TYPES.indexOf(a.type)-TYPES.indexOf(b.type));for(const g of entries){
  const type=g.type,index=TYPES.indexOf(type),id=groups.length,num=options.count?options.count(g):Math.min(FIGURES[index],Math.ceil(g.troops));
  const rows=Math.min(num,options.compact?({inf:12,gun:8,arc:10,cav:8}[type]):type==='inf'?20:type==='cav'?8:12),face=side?-1:1,
   homeX=options.compact?(side?1400-[560,420,230,275][index]:[560,420,230,275][index]):(side?[920,1080,1220,1290]:[480,320,180,110])[index],
   homeY=options.compact?[420,390,400,780][index]:Y,position=options.positions?.[id];
  const f={id,type,index,side,g,face,x:position?.[0]??homeX,y:position?.[1]??homeY,homeX:position?.[0]??homeX,homeY:position?.[1]??homeY,
   goalX:position?.[0]??homeX,goalY:position?.[1]??homeY,rows,baseRows:rows,liveN:0,bodyX:0,bodyY:0,minX:0,maxX:0,minY:0,maxY:0,cols:rows?Math.ceil(num/rows):0,stride:type==='gun'?54:type==='cav'?37:28,
   depthStep:type==='cav'?(options.compact?32:39):23,speed:type==='cav'?145:type==='inf'?34:24,members:[],officers:[],officerN:0,order:type==='cav'?'cycle':'advance',engaged:false,
   fallbackX:homeX,fallbackY:homeY,fallbackAt:-100,reserve:false,deployBox:{left:0,right:0,top:0,bottom:0},
   bannerFall:-1,bx:-1000,by:-1000,state:type==='cav'?'regroup':'advance',stateAt:0,target:null,pathAt:0,pathN:0,
   pathX:new Float64Array(3),pathY:new Float64Array(3),charges:0,withdrawals:0,regroups:0,firstChargeTarget:null,
   fired:0,landed:0,missed:0,blocked:0,intercepted:0,strikes:0,impacts:0,damage:0,lastShotAt:0,lastStrikeAt:-100,lastSkillAt:-100,rapidProcs:0,chainProcs:0,counterShots:0,stance:'line',stanceAt:-100,priorityTarget:null,pinned:0,intent:'advance',laneSign:side?-1:1,flankY:Y,planAt:0,approachAt:0,direct:false,impactBase:0};
  if(options.mrk?.[id]!=null)g.mrk=Math.max(0,options.mrk[id]);
  if(options.orders?.[id])f.order=options.orders[id];
  const selected=options.stances?.[id]||options.stanceOf?.(g,side)||'line';if(STANCES[type][selected])f.stance=selected;f.baseStride=f.stride;f.stride*=stance(f).gap;
  const peers=entries.filter(e=>e.type===type),peer=peers.indexOf(g);if(peers.length>1&&!position){
   if(options.compact&&g.heroOnly){f.x=f.homeX=homeX-face*(20+peer*5);f.y=f.homeY=homeY+((peer%3)-1)*24;}
   else if(!options.compact)f.y=f.homeY=Y+(peer-(peers.length-1)/2)*Math.min(70,420/(peers.length-1));
  }
  f.spawnX=f.x;f.spawnY=f.y;f.spawnStance=f.stance;f.goalX=f.x;f.goalY=f.y;
  for(let i=0;i<num;i++){
   const row=i%rows,rank=Math.floor(i/rows),style=art.style(type,side,type==='inf'?rank%2:0,g,i),hp=g.troops/num;
   const m={id:models.length,f,style,row,rank,phase:hash(i+side*100,index)*6.28,face,x:0,y:0,vx:0,vy:0,alive:hp>0,hp,maxHp:g.start/num,
    fate:null,fateAt:0,hurtUntil:0,actionAt:-100,shotAt:-100,windAt:-100,aimUntil:-100,reloadUntil:-100,
    target:null,attackTarget:null,pendingAt:0,nextStrike:.3+hash(i,side+21)*.6,nextFire:type==='gun'?.6+rank*.22+hash(row,side+41)*.06:.4+hash(i,side+41)*cadence(type,g.mrk),burstLeft:0,burstAt:0,burstUntil:0,rapidAt:0,rapidScale:0,rapidUntil:0,followAt:0,followTarget:null,followScale:0,plantUntil:0,smokeAt:-100,
    candidates:new Array(8).fill(null),scores:new Float64Array(8),blocked:false,lane:0,fireLane:false,laneX:0,laneY:0,blockedAt:0,tiedUntil:0,chargeHit:false,vanguard:false,moving:false,dropX:0,dropY:0,dropAngle:0,sx:0,sy:0,depth:0};
   m.x=f.x-face*(rank*f.depthStep+(f.stance==='skein'?Math.abs(row-(rows-1)/2)*10:0));m.y=f.y+(row-(rows-1)/2)*f.stride+(type==='gun'?rank%2*9:0);if(options.attach)options.attach(m,g,i);f.members.push(m);models.push(m);
  }
  groups.push(f);
 }}
 for(const m of models)fighters.push(m);
 function kindOf(m){return m.kind||m.f.type;}
 function markOf(m){return m.commander?Math.max(0,m.commander.s.mrk||0):m.f.g.mrk;}
 function forceOf(m){return m.personal?Math.max(0,m.force):Math.max(1,m.hp);}
 function skillOf(m,key){const c=m.commander,own=c?(c.sk?c.sk[key]||0:c.skill===key?c.slv||0:0):0;return Math.max(own,m.f.g.mods?.[key]||0);}
 function cancelAttack(m){m.pendingAt=m.followAt=m.rapidAt=0;m.burstLeft=0;m.followTarget=m.attackTarget=null;m.aimUntil=0;}
 function registerOfficer(m){if(officers.includes(m))return;m.personal=m.heroActor=true;
  Object.assign(m,{row:0,rank:0,vx:0,vy:0,target:null,seekTarget:null,attackTarget:null,force:0,nextStrike:.25+hash(m.id,93)*.3,nextFire:.45+hash(m.id,94)*.12,
   burstLeft:0,burstAt:0,burstUntil:0,rapidAt:0,rapidScale:0,rapidUntil:0,followAt:0,followTarget:null,followScale:0,plantUntil:0,smokeAt:-100,
   candidates:new Array(8).fill(null),scores:new Float64Array(8),blocked:false,blockedAt:0,lane:0,fireLane:false,chargeHit:false,chargeTravel:0,chargeReady:false,lastContact:-100,
   fired:0,landed:0,strikes:0,damage:0,chargeImpacts:0});
  officers.push(m);m.f.officers.push(m);fighters.push(m);
 }
 function syncOfficers(){for(const m of officers){const up=!!options.officerAlive?.(m);if(!up){cancelAttack(m);m.moving=false;}else if(!m.alive){m.fate=null;m.hidden=false;}m.alive=up;}}
 function emit(kind,x,y,size=1,face=1,muzzleX=0,muzzleY=17){for(const e of effects)if(!e.on){e.on=true;e.kind=kind;e.x=x;e.y=y;e.t=0;e.size=size;e.face=face;e.muzzleX=muzzleX;e.muzzleY=muzzleY;e.dur=kind==='smoke'?1.6:kind==='dust'?.65:kind==='flash'?.12:.28;return;}}
 function skillCue(m,kind){const f=m.f;if(time-f.lastSkillAt<.35)return;f.lastSkillAt=time;emit(kind,m.x,m.y,1,m.face);if(options.onSkill)options.onSkill(m,kind);}
 function rebuildGrid(){for(const b of bins)b.length=0;for(const m of fighters)if(m.alive){const x=clamp(Math.floor(m.x/CELL),0,COLS-1),y=clamp(Math.floor(m.y/CELL),0,ROWS-1);bins[y*COLS+x].push(m);}}
 // Cached living footprints keep pursuit and flank decisions tied to soldiers, not empty formation slots.
 function refreshBodies(){for(const f of groups){let n=0,x=0,y=0,minX=Infinity,maxX=-Infinity,minY=Infinity,maxY=-Infinity;
  for(const m of f.members)if(m.alive){n++;x+=m.x;y+=m.y;minX=Math.min(minX,m.x);maxX=Math.max(maxX,m.x);minY=Math.min(minY,m.y);maxY=Math.max(maxY,m.y);}
  f.liveN=n;f.officerN=0;for(const m of f.officers)if(m.alive)f.officerN++;
  if(!n)for(const m of f.officers)if(m.alive){n++;x+=m.x;y+=m.y;minX=Math.min(minX,m.x);maxX=Math.max(maxX,m.x);minY=Math.min(minY,m.y);maxY=Math.max(maxY,m.y);}
  f.bodyX=n?x/n:f.x;f.bodyY=n?y/n:f.y;f.minX=n?minX:f.x;f.maxX=n?maxX:f.x;f.minY=n?minY:f.y;f.maxY=n?maxY:f.y;
 }}
 function ownFront(f){let best=null;for(const g of groups)if(g.side===f.side&&g.type==='inf'&&g.g.troops>0&&(!best||g.g.troops>best.g.troops))best=g;return best;}
 function boxDistance(a,b){return Math.hypot(Math.max(0,a.minX-b.maxX,b.minX-a.maxX),Math.max(0,a.minY-b.maxY,b.minY-a.maxY));}
 function threatensFront(e,front){return front&&e.type==='cav'&&boxDistance(e,front)<95&&(e.engaged||e.pinned>0||e.state==='impact');}
 function targetScore(f,e){let score=Math.hypot(e.bodyX-f.bodyX,e.bodyY-f.bodyY)+80;if(f.type!=='cav')return score;
  const front=ownFront(f);
  if(threatensFront(e,front))score*=.22;
  else if(front?.engaged&&(e.type==='gun'||e.type==='arc'))score*=.52;
  else if(e.type==='cav'&&(e.state==='withdraw'||e.state==='regroup'))score*=1.45;
  if(e.type==='inf'&&e.stance==='pikewall')score*=1.45;
  return score*clamp(Math.sqrt(e.g.troops/Math.max(1,f.g.troops)),.85,1.2);
 }
 function fielded(f){return !!f&&(f.g.troops>0||f.officerN>0);}
 function closestFormation(f){if(f.type==='cav'&&f.priorityTarget!=null){const p=groups[f.priorityTarget];if(fielded(p)&&p.side!==f.side)return p;f.priorityTarget=null;}
  let best=null,score=Infinity;for(const e of groups)if(e.side!==f.side&&(e.g.troops>0||e.officerN>0)){const value=targetScore(f,e);if(value<score){score=value;best=e;}}return best;
 }
 function nearest(m,radius,side=1-m.f.side,hitTest=false,type=null,forward=0,group=null){let best=null,bestD=radius*radius;
  const x0=clamp(Math.floor((m.x-radius)/CELL),0,COLS-1),x1=clamp(Math.floor((m.x+radius)/CELL),0,COLS-1),y0=clamp(Math.floor((m.y-radius)/CELL),0,ROWS-1),y1=clamp(Math.floor((m.y+radius)/CELL),0,ROWS-1);
  for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++)for(const e of bins[y*COLS+x])if(e.alive&&e.f.side===side&&(!type||e.f.type===type)&&(!group||e.f===group)&&(!forward||(e.x-m.x)*forward>=-20)){const dx=e.x-m.x,dy=e.y-m.y,d=dx*dx+dy*dy;if(d<bestD&&(!hitTest||d<=(e.f.type==='cav'||e.personal&&e.style.mounted?169:64))){bestD=d;best=e;}}return best;
 }
 // Earliest enemy swept-circle intersection: allies are bypassed at release and during flight.
 function rayHit(x0,y0,x1,y1,exclude){const dx=x1-x0,dy=y1-y0,len=dx*dx+dy*dy;if(len<1e-9)return null;let best=null,bestU=Infinity;
  const bx0=clamp(Math.floor((Math.min(x0,x1)-15)/CELL),0,COLS-1),bx1=clamp(Math.floor((Math.max(x0,x1)+15)/CELL),0,COLS-1),by0=clamp(Math.floor((Math.min(y0,y1)-15)/CELL),0,ROWS-1),by1=clamp(Math.floor((Math.max(y0,y1)+15)/CELL),0,ROWS-1);
  for(let y=by0;y<=by1;y++)for(let x=bx0;x<=bx1;x++)for(const m of bins[y*COLS+x]){
   if(!m.alive||m.f.side===exclude.f.side)continue;
   const r=m.f.type==='cav'||m.personal&&m.style.mounted?13:8,u=((m.x-x0)*dx+(m.y-y0)*dy)/len;if(u<0||u>1)continue;
   const ox=m.x-(x0+dx*u),oy=m.y-(y0+dy*u),perp=ox*ox+oy*oy;if(perp>r*r)continue;
   const hit=u-Math.sqrt(Math.max(0,r*r-perp)/len);if(hit<bestU){bestU=hit;best=m;}
  }return best;
 }
 function terrainClear(a,b){const h0=ground(a.x,a.y)+18,h1=ground(b.x,b.y)+18;
  for(let i=1;i<5;i++){const u=i/5;if(ground(a.x+(b.x-a.x)*u,a.y+(b.y-a.y)*u)>h0+(h1-h0)*u-2)return false;}return true;
 }
 function clearShot(m,target){return terrainClear(m,target);}
 function range(m){return RANGES[kindOf(m)]||0;}
 function rangedTarget(m){let best=null;const max=range(m),r2=max*max;let hasBlocked=false;
  // Try nearer candidates first, without allocating a sorted target list every think.
  const candidates=m.candidates,scores=m.scores;scores.fill(Infinity);candidates.fill(null);
  for(const e of fighters)if(e.alive&&e.f.side!==m.f.side){const dx=e.x-m.x,dy=e.y-m.y,d=dx*dx+dy*dy;if(d>r2)continue;
   const score=d*(kindOf(m)==='arc'&&(kindOf(e)==='gun'||kindOf(e)==='arc')?.68:1)*(e.personal?2:1);let slot=7;if(score>=scores[slot])continue;
   while(slot>0&&score<scores[slot-1]){scores[slot]=scores[slot-1];candidates[slot]=candidates[slot-1];slot--;}scores[slot]=score;candidates[slot]=e;
  }
  for(let i=0;i<8;i++){const e=candidates[i];if(!e)break;if(kindOf(m)==='arc'||clearShot(m,e)){best=e;break;}hasBlocked=true;}
  m.blocked=!best&&hasBlocked;
  if(m.blocked){m.f.blocked++;if(!m.blockedAt)m.blockedAt=time;m.lane=(Math.floor((time+hash(m.id,7)*2.2)/2.2)+m.row)%2?10:-10;}else if(best)m.blockedAt=0;
  return best;
 }
 function reach(m){return m.weaponReach|| (m.f.type==='cav'?53:m.style.kit.w==='steel_yari'?44:34);}
 function pathPoint(f,i,x,y){f.pathX[i]=clamp(x,45,1355);f.pathY[i]=clamp(y,70,950);}
 function touching(f,extra=0){for(const m of f.members)if(m.alive&&m.target?.alive&&Math.hypot(m.target.x-m.x,m.target.y-m.y)<=reach(m)+extra)return true;return false;}
 function planCharge(f,e,restart=false){
  f.target=e;f.planAt=time+.9;const front=ownFront(f);f.intent=f.priorityTarget!=null?'ordered':threatensFront(e,front)?'relieve':e.type==='arc'||e.type==='gun'?'flank':'engage';
  const margin=(f.rows-1)*Math.min(f.stride,24)/2+90;let top=e.minY-margin,bottom=e.maxY+margin,screen=false;
  for(const g of groups)if(g.type==='inf'&&g.g.troops>0&&g.maxX>=Math.min(f.bodyX,e.bodyX)-45&&g.minX<=Math.max(f.bodyX,e.bodyX)+45){top=Math.min(top,g.minY-margin);bottom=Math.max(bottom,g.maxY+margin);screen=true;}
  f.direct=!screen||time-f.approachAt>14||Math.hypot(f.bodyX-e.bodyX,f.bodyY-e.bodyY)<130;
  if(f.direct){f.pathAt=0;f.pathN=1;pathPoint(f,0,e.bodyX,e.bodyY);return;}
  top=clamp(top,70,950);bottom=clamp(bottom,70,950);
  const topCost=Math.abs(f.y-top)+Math.abs(e.minY-top),bottomCost=Math.abs(f.y-bottom)+Math.abs(e.maxY-bottom);
  if(Math.abs(topCost-bottomCost)>50)f.laneSign=topCost<bottomCost?-1:1;
  f.flankY=f.laneSign<0?top:bottom;
  if(restart){f.pathAt=0;pathPoint(f,0,f.x,f.flankY);}
  // Reach the outside of the screen, pass its side, then turn into the target's exposed flank.
  f.pathN=3;pathPoint(f,1,e.bodyX+f.face*55,f.flankY);pathPoint(f,2,e.bodyX+f.face*28,f.laneSign<0?e.minY-26:e.maxY+26);
 }
 function beginCharge(f){const e=closestFormation(f);if(!e)return;
  f.state='approach';f.stateAt=f.approachAt=time;f.charges++;if(f.firstChargeTarget==null)f.firstChargeTarget=e.type;
  planCharge(f,e,true);for(const m of f.members)m.chargeHit=false;
 }
 function withdraw(f){const front=ownFront(f),lane=f.flankY,rally=front?front.bodyX-f.face*260:f.homeX;
  f.state='withdraw';f.stateAt=time;f.withdrawals++;f.pathAt=0;f.pathN=3;
  pathPoint(f,0,f.x-f.face*70,lane);pathPoint(f,1,rally,lane);pathPoint(f,2,rally,f.homeY);
  for(const m of f.members){m.pendingAt=0;m.attackTarget=null;}
 }
 function moveGroup(f){if(f.g.troops<=0&&!(f.order==='fallback'&&f.officerN>0)||outcome)return;let tx=f.x,ty=f.y,velocity=f.speed*stance(f).speed;if(f.type==='cav'&&f.state==='withdraw'&&f.pinned)velocity*=Math.max(.35,1-f.pinned*.8);
  if(f.order==='fallback'){
   f.state='fallback';tx=f.fallbackX;ty=f.fallbackY;velocity=f.speed*.82*(f.pinned>.01?.35:1);
   if(Math.hypot(tx-f.x,ty-f.y)<3){f.order='hold';f.state='hold';}
  }
  else if(f.order==='hold'||f.stance==='pikewall'){f.state='hold';}
  else if(f.type==='cav'){
   if(f.state==='hold'){f.state='regroup';f.stateAt=time;}
   if(f.state==='regroup'&&time-f.stateAt>2.4+hash(f.side,31)*.6)beginCharge(f);
   if(f.state==='approach'&&(time>=f.planAt||!fielded(f.target))){
    const e=closestFormation(f),old=f.target,change=e&&(!fielded(old)||f.priorityTarget!=null&&e!==old||targetScore(f,e)<targetScore(f,old)*.72);
    if(e)planCharge(f,change?e:old,!!change);else f.planAt=time+.9;
   }
   if(f.state==='approach'&&touching(f,12)){f.state='charge';f.stateAt=time;}
   if(f.state==='approach'||f.state==='withdraw'){
    if(f.pathAt<f.pathN){tx=f.pathX[f.pathAt];ty=f.pathY[f.pathAt];if(Math.hypot(tx-f.x,ty-f.y)<5)f.pathAt++;}
    if(f.pathAt===f.pathN){f.state=f.state==='withdraw'?'regroup':'charge';f.stateAt=time;if(f.state==='regroup')f.regroups++;}
   }
   if(f.state==='charge'||f.state==='impact'){
    if(!fielded(f.target)){withdraw(f);tx=f.pathX[0];ty=f.pathY[0];}
    else{const e=f.target;tx=e.bodyX+f.face*22;ty=clamp(f.y,e.minY-15,e.maxY+15);
     // A charge only becomes an impact when a real rider reaches an enemy. A timer never fabricates contact.
     if(f.state==='charge'&&touching(f)){f.state='impact';f.stateAt=time;f.impactBase=f.impacts;}
     if(f.state==='impact'){velocity=45*stance(f).speed;if((time-f.stateAt>1.1&&f.impacts-f.impactBase>=Math.ceil(f.liveN*.6))||time-f.stateAt>2.4){withdraw(f);tx=f.pathX[0];ty=f.pathY[0];velocity=f.speed*stance(f).speed;}}
     else if(time-f.stateAt>4.5){withdraw(f);tx=f.pathX[0];ty=f.pathY[0];}
    }
   }
  }else{
   const e=closestFormation(f);if(e){
    if(f.type==='inf'){tx=e.bodyX-f.face*28;ty=e.bodyY;}
    else{let lead=null;for(const g of groups)if(g.side===f.side&&g.index<f.index&&g.g.troops>0&&g.type!=='cav'){lead=g;break;}
     if(lead){tx=lead.bodyX-f.face*(f.type==='gun'?160:300);ty=f.homeY;
      // Support spacing must not strand the rear ranks outside weapon range, even behind a held screen.
      const rear=Math.max(0,f.cols-1)*f.depthStep,reach=Math.max(70,RANGES[f.type]-rear-70);if(Math.max(0,e.minY-ty,ty-e.maxY)>reach*.5)ty=clamp(ty,e.minY,e.maxY);
      const dy=Math.max(0,e.minY-ty,ty-e.maxY),across=Math.sqrt(Math.max(0,reach*reach-dy*dy)),close=e.bodyX-f.face*across;
      tx=f.face>0?Math.max(tx,close):Math.min(tx,close);
     }
     else{const stand=f.type==='gun'?Math.max(70,380-Math.max(0,time-f.lastShotAt-3)*22):500;if(Math.hypot(e.bodyX-f.x,e.bodyY-f.y)>stand+10){tx=e.bodyX-f.face*stand;ty=e.bodyY;}}
    }
   }
  }
  f.goalX=clamp(tx,45,1355);f.goalY=clamp(ty,70,950);const dx=f.goalX-f.x,dy=f.goalY-f.y,d=Math.hypot(dx,dy),step=velocity*STEP;
  if(d>.1){f.x+=dx/d*Math.min(d,step);f.y+=dy/d*Math.min(d,step);}
 }
 function think(){if(options.beforeThink)options.beforeThink();refreshBodies();for(const f of groups)f.pinned=0;for(const m of fighters)if(m.alive){const kind=kindOf(m);
   if(kind==='inf'||kind==='cav'){const ordered=m.heroActor&&m.f.priorityTarget!=null?groups[m.f.priorityTarget]:null;m.target=fielded(ordered)?nearest(m,1800,1-m.f.side,false,null,0,ordered):nearest(m,m.heroActor?1800:105);}else m.target=rangedTarget(m);
   if(m.heroActor){m.seekTarget=m.target||nearest(m,1800);m.chargeTarget=m.seekTarget;}
   if(!m.personal&&(m.f.type==='cav'||m.f.order==='fallback')&&nearest(m,64,1-m.f.side,false,'inf')){m.tiedUntil=time+1.25;m.f.pinned++;}
  }for(const f of groups)f.pinned/=Math.max(1,f.liveN);
 }
 function moveOfficer(m){if(!m.alive){if(!m.personal)moveModel(m);return;}if(outcome)return;const f=m.f,type=kindOf(m),ranged=type==='gun'||type==='arc',mounted=!!m.style.mounted,hold=f.order==='hold'||f.stance==='pikewall',
   withdrawing=f.g.troops>0&&f.type==='cav'&&!m.vanguard&&(f.state==='withdraw'||f.state==='regroup'),e=m.target?.alive?m.target:m.seekTarget?.alive?m.seekTarget:null;
  let tx=m.personal?f.x+f.face*(m.vanguard?8:-14):f.x,ty=f.y+(m.heroSlot||0),velocity=mounted?(m.vanguard?175:145):(m.vanguard?85:70);
  if(f.order==='fallback'){tx=f.x-f.face*16;ty=f.y+(m.heroSlot||0);m.holdX=m.holdY=null;if(m.tiedUntil>time||e&&Math.hypot(e.x-m.x,e.y-m.y)<reach(m)+20)velocity*=.42;}
  else if(hold){tx=m.holdX??m.x;ty=m.holdY??m.y;m.holdX=tx;m.holdY=ty;}else{m.holdX=m.holdY=null;
   if(!e&&(m.vanguard||ranged)){tx=m.x;ty=m.y;} // Wait for retargeting instead of stepping back toward an old slot.
   if(e&&!withdrawing){const dx=e.x-m.x,dy=e.y-m.y,d=Math.hypot(dx,dy),r=reach(m),pursue=ranged||m.vanguard||type!==f.type||f.g.troops<=0||f.engaged||d<160;
    if(pursue){let gap=ranged?(type==='gun'?360:460):r*.8;
     if(ranged&&!m.target)gap=Math.max(85,gap-Math.max(0,time-m.shotAt-3)*16);
     if(d>gap+2){tx=m.x+dx/d*(d-gap);ty=m.y+dy/d*(d-gap);}else{tx=m.x;ty=m.y;}
    }
    if(d>3)m.face=dx>=0?1:-1;
   }
  }
  if(f.order!=='fallback'&&type==='gun'&&(m.plantUntil>time||m.aimUntil>time&&!m.blocked&&m.target?.alive&&Math.hypot(m.target.x-m.x,m.target.y-m.y)<=range(m))){tx=m.x;ty=m.y;}
  tx=clamp(tx,35,1365);ty=clamp(ty,55,965);const dx=tx-m.x,dy=ty-m.y,d=Math.hypot(dx,dy),step=Math.min(d,velocity*STEP),ox=m.x,oy=m.y;
  if(d>.15){m.x+=dx/d*step;m.y+=dy/d*step;}m.vx=(m.x-ox)/STEP;m.vy=(m.y-oy)/STEP;m.moving=Math.abs(m.x-ox)+Math.abs(m.y-oy)>.02;
  if(!e&&m.moving&&Math.abs(dx)>2)m.face=dx>=0?1:-1;
  // A mount earns one impact by covering real approach distance; staying in melee cannot renew it.
  if(f.order!=='fallback'&&mounted&&m.moving&&e&&m.vx*(e.x-m.x)+m.vy*(e.y-m.y)>0&&Math.hypot(e.x-m.x,e.y-m.y)>reach(m)+30){m.chargeTravel=(m.chargeTravel||0)+step;if(m.chargeTravel>=75)m.chargeReady=true;}
 }
 function moveModel(m){const f=m.f;if(!m.alive){if(m.fate==='rout'&&time-m.fateAt>.48&&time-m.fateAt<7){m.x-=f.face*80*STEP;m.y+=(hash(m.id,42)-.5)*14*STEP;}return;}
  const charging=f.type==='cav'&&(f.state==='charge'||f.state==='impact'),march=f.type==='cav'&&(f.state==='approach'||f.state==='withdraw'),gap=march?Math.min(f.stride,24):charging&&f.target?Math.min(f.stride,Math.max(10,(f.target.maxY-f.target.minY+40)/Math.max(1,f.rows-1))):f.stride;
  let tx=f.x-f.face*(m.rank*(charging?8:f.depthStep)+(f.stance==='skein'?Math.abs(m.row-(f.rows-1)/2)*10:0)),ty=f.y+(m.row-(f.rows-1)/2)*gap+(f.type==='gun'?m.rank%2*9+m.lane:0),velocity=(f.speed+25)*stance(f).speed;if(f.type==='cav'&&f.state==='withdraw'&&m.tiedUntil>time)velocity*=.35;
  if(f.order==='fallback'){velocity=(f.speed+25)*.82;if(m.tiedUntil>time)velocity*=.35;}
  if(m.vanguard&&f.order!=='hold'&&f.order!=='fallback'&&f.stance!=='pikewall'&&!(f.type==='cav'&&(f.state==='withdraw'||f.state==='regroup'))){tx+=f.face*28;velocity*=1.15;}
  const melee=f.type==='inf'||f.type==='cav',canFight=f.type==='inf'||f.order==='hold'||f.state==='charge'||f.state==='impact'||m.tiedUntil>time;
  if(f.order!=='fallback'&&melee&&canFight&&m.target?.alive&&!(f.type==='cav'&&f.state==='withdraw')){const e=m.target,dx=e.x-m.x,dy=e.y-m.y,d=Math.hypot(dx,dy),r=reach(m);
   if(d<r+62){
    if(f.order!=='hold'&&f.stance!=='pikewall'&&(f.type==='cav'||m.rank===0)&&d>r*.83){const chase=Math.min(42,d-r*.83);tx=m.x+dx/d*chase;ty=m.y+dy/d*chase;}
    else if(d<=r){tx=m.x;ty=m.y;}
    if(Math.abs(dx)>3)m.face=dx>0?1:-1;
   }
  }
  if(f.type==='gun'&&f.order!=='hold'&&f.order!=='fallback'){
   const front=ownFront(f);
   if(!front)m.fireLane=false;
   if(m.blocked&&m.blockedAt&&time-m.blockedAt>1.25&&front){const sign=m.row<(f.rows/2)?-1:1,outer=(front.rows-1)*front.stride/2;
    m.fireLane=true;m.laneX=front.x+f.face*(35-m.rank*23);m.laneY=front.y+sign*(outer+36+(m.row%Math.ceil(f.rows/2))*16);
   }
   if(m.fireLane){tx=m.laneX;ty=clamp(m.laneY,60,960);if(front&&Math.abs(m.y-ty)>18&&(m.x-front.x)*f.face<0)tx=front.x-f.face*(front.cols*front.depthStep+30);}
  }
  // Plant the feet for the aimed release/recoil; reloading can continue on the march.
  if(f.order!=='fallback'&&f.type==='gun'&&(m.plantUntil>time||m.aimUntil>time&&!m.blocked&&m.target?.alive&&Math.hypot(m.target.x-m.x,m.target.y-m.y)<=range(m))){tx=m.x;ty=m.y;if(m.target?.alive)m.face=m.target.x>=m.x?1:-1;}
  const dx=tx-m.x,dy=ty-m.y,d=Math.hypot(dx,dy),step=velocity*STEP;let nx=m.x,ny=m.y;
  if(d>.15&&!outcome){nx+=dx/d*Math.min(d,step);ny+=dy/d*Math.min(d,step);}
  m.vx=(nx-m.x)/STEP;m.vy=(ny-m.y)/STEP;m.moving=Math.abs(nx-m.x)+Math.abs(ny-m.y)>.02&&!outcome;m.x=nx;m.y=ny;
  if(m.moving&&Math.abs(dx)>2&&!(melee&&canFight&&m.target&&Math.hypot(m.target.x-m.x,m.target.y-m.y)<reach(m)+6))m.face=dx>0?1:-1;
 }
 function repack(f){let row=0,n=0,cols=0;
  // Close only empty files; retain neighbours and compact their ranks. Positions never jump.
  for(let old=0;old<f.baseRows;old++){let rank=0;for(const m of f.members)if(m.alive&&m.row===old){m.row=row;m.rank=rank++;n++;}if(rank){row++;cols=Math.max(cols,rank);}}
  f.liveN=n;f.rows=row;f.cols=cols;
 }
 function casualty(m){m.alive=false;m.hp=0;const f=m.f;
  m.fate=f.g.troops>0&&f.g.troops/f.g.start<.45&&sim.random()<.18?'rout':'death';m.fateAt=time;m.dropX=m.x+m.face*9;m.dropY=m.y+8;m.dropAngle=(hash(m.id,73)-.5)*2.5;
  m.pendingAt=m.followAt=m.rapidAt=0;m.burstLeft=0;m.followTarget=m.attackTarget=null;if(options.casualty){const kind=options.casualty(m);if(kind)m.fate=kind;}emit('blood',m.x,m.y);repack(f);
  if(f.g.troops<=1e-7){f.g.troops=0;f.bannerFall=time;f.engaged=false;}
 }
 function hit(from,to,damage,kind){if(!to?.alive||from.f.side===to.f.side||!(damage>0))return false;
  const defense=kind==='gun'||kind==='arc'?stance(to.f).ranged:stance(to.f).melee;
  if(to.personal){const n=options.officerHit?options.officerHit(from,to,damage*defense,kind):0;if(from.heroActor)from.officerDamage=(from.officerDamage||0)+n;to.hurtUntil=time+.14;joined=true;emit(kind==='inf'||kind==='cav'?'spark':'blood',to.x,to.y,.7);return true;}
  const amount=Math.min(to.hp,damage*defense);if(options.beforeHit)options.beforeHit(from,to,amount,kind);to.hp-=amount;to.f.g.troops=Math.max(0,to.f.g.troops-amount);applied+=amount;from.f.damage+=amount;if(from.heroActor)from.damage=(from.damage||0)+amount;to.hurtUntil=time+.14;joined=true;if(options.afterHit)options.afterHit(from,to,amount,kind);
  if(to.hp<=1e-8){if(to.hp>0){to.f.g.troops=Math.max(0,to.f.g.troops-to.hp);applied+=to.hp;from.f.damage+=to.hp;}casualty(to);}
  if(kind==='inf'||kind==='cav')emit('spark',(from.x+to.x)/2,(from.y+to.y)/2);else emit('blood',to.x,to.y,.7);
  return true;
 }
 function launch(m,target,extra=false,powerScale=1){const f=m.f,type=kindOf(m),max=range(m),force=forceOf(m);if(!(force>0))return false;let p=null;for(const q of shots)if(!q.on){p=q;break;}if(!p)return false;
  const dx=target.x-m.x,dy=target.y-m.y,d=Math.hypot(dx,dy);if(d>max)return false;
  const flight=type==='arc'?clamp(d/440,.7,1.8):d/1400,lead=type==='arc'?Math.min(flight,.65):0,lx=target.x+clamp(target.vx*lead,-38,38),ly=target.y+clamp(target.vy*lead,-38,38);
  let ax=lx,ay=ly;if(type==='arc'){const mrk=markOf(m),spread=(16+d*.04)*(1-.65*mrk/(mrk+40))*(stance(f).accuracy||1),angle=sim.random()*Math.PI*2,r=Math.sqrt(sim.random())*spread;ax+=Math.cos(angle)*r;ay+=Math.sin(angle)*r;}
  if(type==='gun'){const spread=gunSpread(d,markOf(m),stance(f).accuracy||1),angle=sim.random()*Math.PI*2,r=Math.sqrt(sim.random())*spread;ax+=Math.cos(angle)*r;ay+=Math.sin(angle)*r;aimPoint.x=ax;aimPoint.y=ay;if(!terrainClear(m,aimPoint)){f.blocked++;m.blocked=true;return false;}}
  const len=Math.hypot(ax-m.x,ay-m.y)||1,ux=(ax-m.x)/len,uy=(ay-m.y)/len;
  const counter=skillOf(m,'counter'),incoming=counter>0&&d<=260&&(kindOf(target)==='inf'||kindOf(target)==='cav')&&(target.vx*(m.x-target.x)+target.vy*(m.y-target.y)>1||target.f.engaged);
  const start=Math.min(12,Math.max(0,d-2));p.on=true;p.start=time;p.lastU=0;p.from=m;p.force=force;p.kind=type;p.side=f.side;p.power=sim.power(f.g,p.force,type,.17*stance(f).attack*(m.style.shotPower??1)*powerScale,false,m)*(incoming?1+.3*counter:1);if(sim.prepareShot)sim.prepareShot(p,f.g);p.x0=m.x+ux*start;p.y0=m.y+uy*start;
  p.ox=m.x;p.oy=m.y;p.face=dx>=0?1:-1;p.muzzleX=m.style.muzzleX||12;p.muzzleY=m.style.muzzleHeight||17;
  p.x1=type==='gun'?m.x+ux*max:ax;p.y1=type==='gun'?m.y+uy*max:ay;p.dur=type==='gun'?(max-start)/1400:flight;p.height=type==='arc'?Math.min(125,d*.17):0;
  m.face=dx>=0?1:-1;m.shotAt=time;m.actionAt=time;m.plantUntil=time+.34;if(!extra){const reload=m.style.reload||1;m.nextFire=time+cadence(type,markOf(m))*reload;m.reloadUntil=time+cadence(type,markOf(m))*reload*.68;m.burstLeft=Math.max(0,(m.style.burst||1)-1);m.burstAt=time+.14;m.burstUntil=time+1.25;
   const rapid=skillOf(m,'rapid');if(rapid>0&&sim.random()<Math.min(.85,.35+.1*rapid)){m.rapidAt=time+.14*(m.style.burst||1)+.06;m.rapidUntil=time+1.5;m.rapidScale=(m.style.burst||1)*(.25+.08*rapid);}
  }m.blocked=false;f.fired++;if(m.heroActor)m.fired=(m.fired||0)+1;f.lastShotAt=time;
  if(incoming){f.counterShots++;skillCue(m,'counter');}if(extra==='rapid'){f.rapidProcs++;skillCue(m,'rapid');}
  if(type==='gun'){emit('flash',m.x,m.y,1,m.face,p.muzzleX,p.muzzleY);if(time-m.smokeAt>.35){emit('smoke',m.x,m.y,1,m.face,p.muzzleX,p.muzzleY);m.smokeAt=time;}}if(options.onShot)options.onShot(m);return true;
 }
 function combat(){let n=0;for(const f of groups)f.engaged=false;
  for(const m of fighters)if(m.alive&&(!m.personal||m.force>0)){const f=m.f,type=kindOf(m);
   if(type==='inf'||type==='cav'){
    const ready=type==='inf'||m.heroActor&&(m.vanguard||f.g.troops<=0)||f.order==='hold'||f.order==='fallback'||f.state==='charge'||f.state==='impact'||m.tiedUntil>time;
    if(m.followAt&&time>=m.followAt){let target=m.followTarget;m.followAt=0;m.followTarget=null;
     if(!target?.alive)target=m.target;if(ready&&target?.alive&&Math.hypot(target.x-m.x,target.y-m.y)<=reach(m)+3){const q=impacts[n++];q.from=m;q.to=target;q.kind=type;q.amount=sim.damage(f.g,target.f.g,forceOf(m),type,.05*stance(f).attack*m.followScale,false,m);m.actionAt=f.lastStrikeAt=time;f.strikes++;if(m.heroActor)m.strikes=(m.strikes||0)+1;f.chainProcs++;skillCue(m,'chain');}
    }
    if(m.pendingAt&&time>=m.pendingAt){const target=m.attackTarget;m.pendingAt=0;m.attackTarget=null;m.actionAt=time;
     if(target?.alive&&ready&&Math.hypot(target.x-m.x,target.y-m.y)<=reach(m)+3){const q=impacts[n++],charged=m.heroActor?!!(m.style.mounted&&m.chargeReady):type==='cav'&&(f.state==='charge'||f.state==='impact')&&!m.chargeHit,
       kind=charged&&m.heroActor&&m.style.mounted?'cav':type,scale=type==='cav'?(charged?.24:.08):charged?.10:.05;
      q.from=m;q.to=target;q.kind=kind;q.amount=sim.damage(f.g,target.f.g,forceOf(m),kind,scale*stance(f).attack*(charged?(stance(f).charge||1):1),charged,m);f.lastStrikeAt=time;f.strikes++;m.lastContact=time;if(m.heroActor)m.strikes=(m.strikes||0)+1;
      if(charged){m.chargeHit=true;m.chargeReady=false;m.chargeTravel=0;f.impacts++;if(m.heroActor)m.chargeImpacts=(m.chargeImpacts||0)+1;}
      const chain=type==='inf'?skillOf(m,'chain'):0;if(chain>0&&sim.random()<Math.min(.85,.35+.1*chain)){m.followAt=time+.18;m.followTarget=target;m.followScale=.25+.08*chain;}
     }
    }
    if(ready&&m.target?.alive){const d=Math.hypot(m.target.x-m.x,m.target.y-m.y);if(d<=reach(m)){f.engaged=true;if(time>=m.nextStrike&&!m.pendingAt&&(m.heroActor||type==='inf'||f.order==='hold'||f.order==='fallback'||m.tiedUntil>time||!m.chargeHit)){
      m.windAt=time;m.pendingAt=time+(type==='cav'?.23:.19+hash(m.id,12)*.08);m.attackTarget=m.target;m.nextStrike=time+(m.weaponTempo||(type==='cav'?1.5:1.05+hash(m.id,8)*.22));
    }}}
   }else{
    if(f.order==='fallback'){m.aimUntil=0;continue;} // Withdraw on foot; released projectiles still settle normally.
    if(m.burstLeft&&time>=m.burstAt){if(!m.target?.alive)m.target=rangedTarget(m);if(time>m.burstUntil||!m.target?.alive)m.burstLeft=0;else if(launch(m,m.target,true)){m.burstLeft--;m.burstAt=time+.14;}else m.burstAt=time+.05;}
    if(m.rapidAt&&time>=m.rapidAt){if(!m.target?.alive)m.target=rangedTarget(m);if(time>m.rapidUntil||!m.target?.alive)m.rapidAt=0;else if(launch(m,m.target,'rapid',m.rapidScale))m.rapidAt=0;else m.rapidAt=time+.05;}
    if(m.target?.alive&&time>=m.nextFire-.2&&Math.hypot(m.target.x-m.x,m.target.y-m.y)<=range(m)&&(type!=='gun'||!m.blocked)){m.aimUntil=time+.15;if(type==='gun'){m.moving=false;m.vx=m.vy=0;}}
    else if(type==='gun')m.aimUntil=0;
    if(time>=m.nextFire){if(!m.target?.alive||!launch(m,m.target))m.nextFire=time+.18;}
   }
  }
  // Resolve melee committed in the same fixed step together, permitting legitimate mutual hits.
  for(let i=0;i<n;i++){const q=impacts[i];hit(q.from,q.to,q.amount,q.kind);}
 }
 function projectileStep(){let active=0;
  for(const p of shots)if(p.on){const u=clamp((time-p.start)/p.dur,0,1),f=p.from.f;
   if(p.kind==='gun'){
    const x0=p.x0+(p.x1-p.x0)*p.lastU,y0=p.y0+(p.y1-p.y0)*p.lastU,x1=p.x0+(p.x1-p.x0)*u,y1=p.y0+(p.y1-p.y0)*u,target=rayHit(x0,y0,x1,y1,p.from);
    if(target){p.on=false;f.landed++;if(p.from.heroActor)p.from.landed=(p.from.landed||0)+1;hit(p.from,target,sim.impact(p.power,target.f.g,p.force,'gun',p.from.f.g,p),'gun');}
    else if(u>=1){p.on=false;f.missed++;}
   }else if(u>=1){p.on=false;const point=impactPoint;point.x=p.x1;point.y=p.y1;const target=nearest(point,13,1-p.side,true);
    if(target){f.landed++;if(p.from.heroActor)p.from.landed=(p.from.landed||0)+1;hit(p.from,target,sim.impact(p.power,target.f.g,p.force,'arc',p.from.f.g,p),'arc');}else{f.missed++;emit('dust',p.x1,p.y1,.5);}
   }
   p.lastU=u;if(p.on)active++;
  }return active;
 }
 const impactPoint={x:0,y:0,f:{side:0}},aimPoint={x:0,y:0},queryPoint={x:0,y:0,f:{side:0}};
 function hasForce(side){for(const g of sim.A[side].groups)if(g.troops>1e-7)return true;for(const m of officers)if(m.f.side===side&&m.alive&&options.officerAlive?.(m))return true;return false;}
 function finish(){const a=hasForce(0),b=hasForce(1);if(a&&b)return;outcome={winner:a?'Kage Clan':b?'Kurogane':'Neither army',side:a?0:b?1:null,at:time};
  for(const f of groups)f.engaged=false;for(const m of fighters){cancelAttack(m);m.moving=false;}
 }
 function tick(){time+=STEP;sim.clock(time);syncOfficers();rebuildGrid();
  if(!outcome){if(time+1e-8>=nextThink){think();nextThink+=THINK;}for(const f of groups)moveGroup(f);}
  for(const m of fighters)if(m.heroActor)moveOfficer(m);else moveModel(m);rebuildGrid();if(!outcome)combat();const active=projectileStep();if(!outcome&&!active)finish();
  for(const e of effects)if(e.on){e.t+=STEP;if(e.t>=e.dur)e.on=false;}
 }
 function advance(dt){acc+=Math.max(0,dt);let n=0;while(acc+1e-9>=STEP&&n++<600){tick();acc-=STEP;}if(acc<0&&acc>-1e-8)acc=0;}
 function setStance(id,key,preparing=false){const f=groups[id];if(!f||!STANCES[f.type][key]||!(preparing&&time===0)&&time-f.stanceAt<1.5)return false;f.stance=key;f.stanceAt=preparing&&time===0?-100:time;f.stride=f.baseStride*stance(f).gap;
  for(const m of f.members){m.fireLane=false;if(preparing&&time===0){m.x=f.x-f.face*(m.rank*f.depthStep+(f.stance==='skein'?Math.abs(m.row-(f.rows-1)/2)*10:0));m.y=f.y+(m.row-(f.rows-1)/2)*f.stride+(f.type==='gun'?m.rank%2*9:0);}}if(preparing&&time===0)refreshBodies();if(options.onStance)options.onStance(f);return true;
 }
 function target(id,targetId){const f=groups[id],t=groups[targetId];if(!f||f.type!=='cav'||targetId!=null&&(!t||t.side===f.side||!fielded(t)))return false;f.priorityTarget=targetId==null?null:targetId;
  if(f.state==='approach'){const e=closestFormation(f);if(e)planCharge(f,e,true);}return true;}
 function reconcile(){for(const f of groups){let sum=0;for(const m of f.members)sum+=m.hp;let delta=f.g.troops-sum;
   // A casualty callback may rout other sources mid-pass. The final sweep settles those newly changed priorities now.
   if(delta< -1e-7){externalLoss-=delta;for(let pass=0;pass<3;pass++)for(const m of f.members)if(m.alive&&delta< -1e-8&&(pass===2||!options.externallyDead||Number(!options.externallyDead(m))===pass)){const n=Math.min(m.hp,-delta);m.hp-=n;delta+=n;if(m.hp<1e-8)casualty(m);}}
   else if(delta>1e-7){externalRecovery+=delta;for(const m of f.members)if(delta>1e-8){const n=Math.min(m.maxHp-m.hp,delta);if(n>0){m.hp+=n;delta-=n;if(!m.alive){m.alive=true;m.fate=null;m.hurtUntil=0;if(options.revive)options.revive(m);}}}}
  }for(const f of groups)repack(f);syncOfficers();refreshBodies();return snapshot();}
 function order(id,type){const f=groups[id];if(!fielded(f)||!['hold','advance','cycle','fallback'].includes(type)||type==='cycle'&&f.type!=='cav')return false;
  if(f.order==='fallback'&&type==='fallback')return true; // Repeated taps cannot reset withdrawal/pinning.
  if(type==='fallback'){
   if(f.stance==='pikewall'){f.stance='line';f.stride=f.baseStride*stance(f).gap;if(options.onStance)options.onStance(f);}
   const b=deploymentBounds(f.id,f.x,f.y),left=f.x+45-b.left,right=f.x+1355-b.right,top=f.y+70-b.top,bottom=f.y+950-b.bottom;
   f.fallbackX=left<=right?clamp(f.x-f.face*170,left,right):clamp(f.x-f.face*170,45,1355);
   f.fallbackY=top<=bottom?clamp(f.y,top,bottom):clamp(f.y,70,950);f.fallbackAt=time;
  }
  if(f.type==='cav'&&f.order==='cycle'&&(type==='advance'||type==='cycle'))return true;
  f.order=f.type==='cav'&&type==='advance'?'cycle':type;
  if(f.type!=='cav')f.state=type;for(const m of f.members)m.fireLane=false;
  if(f.type==='cav'){f.state=type==='hold'?'hold':type==='fallback'?'fallback':'regroup';f.stateAt=time;f.pathAt=f.pathN=0;}
  if(type==='fallback'){for(const m of f.officers){m.holdX=m.holdY=null;m.chargeReady=false;m.chargeTravel=0;}
   for(const m of f.members)if(m.heroActor){m.holdX=m.holdY=null;m.chargeReady=false;m.chargeTravel=0;}}
  return true;
 }
 // Deployment moves whole corps, including independent fighters of that arm. It never changes HP or time.
 function deploymentBounds(id,x,y,out){const f=groups[id];if(!f)return null;out=out||f.deployBox;
  out.left=Infinity;out.right=-Infinity;out.top=Infinity;out.bottom=-Infinity;
  const dx=x-f.x,dy=y-f.y;
  for(const p of groups)if(p.side===f.side&&p.type===f.type&&fielded(p)){let mounted=p.type==='cav';for(const m of p.members)if(m.style.mounted)mounted=true;for(const m of p.officers)if(m.alive&&m.style.mounted)mounted=true;
   const r=mounted?38:30,rear=Math.max(0,p.cols-1)*p.depthStep+r+(p.stance==='skein'?Math.max(0,p.rows-1)*5:0),px=p.x+dx,py=p.y+dy;
   let half=Math.max(0,p.rows-1)*p.stride/2+r+(p.type==='gun'&&p.cols>1?9:0);for(const m of p.officers)if(m.alive)half=Math.max(half,Math.abs(m.heroSlot||0)+(m.commander.guard?14:0)+r);
   out.left=Math.min(out.left,px-(p.face>0?rear:r));out.right=Math.max(out.right,px+(p.face>0?r:rear));out.top=Math.min(out.top,py-half);out.bottom=Math.max(out.bottom,py+half);
  }return out;
 }
 function placement(id,x,y){const f=groups[id];if(!f||f.side!==0||time>0||outcome||!Number.isFinite(x)||!Number.isFinite(y))return 'Deployment is closed.';
  const b=deploymentBounds(id,x,y);if(b.left<45||b.right>640||b.top<70||b.bottom>950)return 'Keep the entire formation behind the line and inside the field.';
  for(const p of groups)if(p.side===0&&p.type!==f.type&&fielded(p)){const q=deploymentBounds(p.id,p.x,p.y);
   if(b.left<q.right+8&&b.right>q.left-8&&b.top<q.bottom+8&&b.bottom>q.top-8)return 'Leave room between formations.';
  }return '';
 }
 function shiftFormation(f,dx,dy){f.x+=dx;f.y+=dy;f.homeX=f.goalX=f.x;f.homeY=f.goalY=f.y;
  for(const m of f.members){m.x+=dx;m.y+=dy;}for(const m of f.officers){m.x+=dx;m.y+=dy;m.holdX=m.holdY=null;}
 }
 function deploy(id,x,y){const reason=placement(id,x,y);if(reason)return false;const f=groups[id],dx=x-f.x,dy=y-f.y;
  for(const p of groups)if(p.side===0&&p.type===f.type)shiftFormation(p,dx,dy);refreshBodies();rebuildGrid();return true;
 }
 function resetDeployment(){if(time>0||outcome)return false;for(const f of groups){setStance(f.id,f.spawnStance,true);shiftFormation(f,f.spawnX-f.x,f.spawnY-f.y);}refreshBodies();rebuildGrid();return true;}
 function snapshot(){let hp=0,living=0,fallen=0,routed=0,projectiles=0;for(const m of models){hp+=m.hp;if(m.alive)living++;else if(m.fate==='rout')routed++;else fallen++;}for(const p of shots)if(p.on)projectiles++;
  const totals=sim.totals();return {time,mode:'realtime',totals,applied,initial,hp,externalLoss,externalRecovery,residual:initial+externalRecovery-externalLoss-totals[0]-totals[1]-applied,living,fallen,routed,projectiles,joined,winner:outcome?.winner||null,
   groups:groups.map(f=>({id:f.id,type:f.type,side:f.side,troops:f.g.troops,mrk:f.g.mrk,cadence:f.type==='gun'||f.type==='arc'?cadence(f.type,f.g.mrk):null,x:f.x,y:f.y,order:f.order,stance:f.stance,state:f.state,intent:f.intent,target:f.target?.id??null,laneSign:f.laneSign,liveN:f.liveN,priorityTarget:f.priorityTarget,pinned:f.pinned,charges:f.charges,withdrawals:f.withdrawals,regroups:f.regroups,firstChargeTarget:f.firstChargeTarget,fired:f.fired,landed:f.landed,missed:f.missed,blocked:f.blocked,intercepted:f.intercepted,strikes:f.strikes,impacts:f.impacts,damage:f.damage,rapidProcs:f.rapidProcs,chainProcs:f.chainProcs,counterShots:f.counterShots}))};
 }
 refreshBodies();rebuildGrid();
 return {sim,groups,models,officers,shots,effects,advance,order,setStance,target,reconcile,snapshot,cadence,registerOfficer,syncOfficers,hasForce,deploy,placement,deploymentBounds,resetDeployment,
  get time(){return time;},get applied(){return applied;},get outcome(){return outcome;},get joined(){return joined;},
  // Read-only geometry probes support targeted deterministic browser checks without new gameplay UI.
  enemyNear:(x,y,side,radius=900)=>{queryPoint.x=x;queryPoint.y=y;queryPoint.f.side=side;return nearest(queryPoint,radius,1-side,false,null,side?-1:1)||nearest(queryPoint,radius);},
  clearShot:(from,to)=>clearShot(models[from],models[to]),rayHit:(x0,y0,x1,y1,from)=>rayHit(x0,y0,x1,y1,models[from])?.id??null};
}
window.GrandCombat={create,cadence,stances:STANCES,gunSpread};
})();
