// Runs inside a private copy of the game's procedural library. boot() is never called.
G={v:1,wins:8,year:5,researched:{},items:{},troops:{inf:0,arc:0,gun:0,cav:0},villagers:[],buildings:[],boons:freshBoons(),clanPolicies:null};
const grandStyles=new Map(),grandOwned=new Set();
function grandOwn(c){if(c){grandOwned.add(c);if(c.detail)grandOwned.add(c.detail);}return c;}
function grandKit(type,side,variant=0){return {w:type==='inf'?(variant?'katana':'steel_yari'):type==='gun'?'samurai':type==='arc'?'yumi':'naginata',a:type==='gun'?'nanbando':type==='arc'?'fuma_garb':side?'oyoroi':variant?'tosei':'domaru',h:type==='gun'?'eboshi_samurai':type==='arc'?'sugegasa':variant?'zunari':'kabuto',m:type==='cav'?'kiso':null};}
function grandStyle(type,side,variant=0){
 const key=[type,side,variant].join(':');if(grandStyles.has(key))return grandStyles.get(key);
 const kit=grandKit(type,side,variant),L=artTroopLook(type,side,variant+side*5,kit),frames={},raw=[];
 const poses=['idle','idle2','runA','runB','wind','aim','atk','follow','recover','reload','cheer'];
 const coat=side?2:0,tack={cloth:side?'#9e3028':'#344e85',trim:'#c9953d',tassel:null};
 for(const pose of poses)raw.push(type==='cav'?riderFrame(L,pose,false,kit.w,coat,tack):footSoldierFrame(type,L,pose,false,kit.w));
 const fin=finishSet(raw);for(let i=0;i<poses.length;i++)frames[poses[i]]=grandOwn(fin(raw[i]));
 const recipe={L,wid:kit.w,type,hero:false,coat,tack,parts:new Map()};
 for(const pose of ['stagger','kneel','rest','panic'])frames[pose]=grandOwn(reactionHumanFrame(recipe,pose));
 for(const pose of ['runA','runB']){
  const f=type==='cav'?riderFrame(L,pose,false,'unarmed',coat,tack):null;
  frames['flee'+pose]=grandOwn(f?finishSet([f])(f):reactionHumanFrame(recipe,pose));
 }
 const p=new ArtPB(88,40),kind=weaponKind(kit.w);
 if(kind==='spear'||kind==='glaive')spear(p,10,20,67,20,kind==='glaive',kit.w);
 else if(kind==='sword')sword(p,p,25,20,-.05,24,kit.w);
 else if(kind==='gun')musket(p,14,24,55,18,'ozutsu');
 else bow(p,39,4,34,BOW_COL[kit.w]||'#a8743f',0,23);
 const weapon=grandOwn(p.shadeEdges(.9,1.05).outlined().canvas());
 const flag=sashimonoFrames({clan:side?'kurogane':'kage',type,rank:'regular'});for(const c of flag.right)grandOwn(c);for(const c of flag.left)grandOwn(c);
 const out={key,type,side,kit,L,frames,flag,weapon};grandStyles.set(key,out);return out;
}
function grandArmy(side,counts){const ns=counts||(side?[1100,460,440,260]:[1400,380,480,220]),types=['inf','gun','arc','cav'];
 return finishArmy({side,clan:side?'kurogane':'kage',name:side?'Kurogane':'Kage',mode:'army',strat:0,ki:0,groups:types.map((type,i)=>{const kit=grandKit(type,side);return {type,troops:Math.max(0,ns[i]||0),mrk:12+[kit.w,kit.a,kit.h].reduce((n,k)=>n+(ITEMS[k]?.mrk||0),0),atkMul:type==='inf'?(side?1.15:1.5):1.25,defMul:1.1,cmds:[],guards:0,mods:modsOf([]),spr:[],heroes:[]};})});}
function grandBattle(seed,counts){const A=[grandArmy(0,counts?.[0]),grandArmy(1,counts?.[1])],rng=seeded(seed),B={A,round:1,maxR:3,tac:['steady','steady'],jutsu:[null,null],seed,state:'run'};
 // Individual landed attacks use the game's attack, defence, cohesion and bounded overtime formulas.
 // Cadence/contact/scatter belong to the continuous prototype, rather than resolvePhase's volley budgets.
 function clock(t){BT=B;B.round=1+Math.floor(t/25);}
 function power(from,force,kind,scale=1){BT=B;return force*UNITS[kind].atk*from.atkMul*battleAttack(from)*scale*(.88+rng()*.24);}
 function impact(raw,to,force,kind){BT=B;let mult=1;
  if(kind==='gun'&&to.type==='inf')mult=1.2;
  if(kind==='inf'&&(to.type==='gun'||to.type==='arc'))mult=1.35;
  if(kind==='cav'&&(to.type==='gun'||to.type==='arc'))mult=1.6;
  return battleDamage(raw,battleResistance(to),mult,force);
 }
 function damage(from,to,force,kind,scale=1){return impact(power(from,force,kind,scale),to,force,kind);}
 return {A,clock,power,impact,damage,random:rng,totals:()=>A.map(a=>a.groups.reduce((n,g)=>n+g.troops,0))};
}
window.GrandArt={style:grandStyle,prop:(k,side=0)=>grandOwn(propImg(k,side)),building:(id,lv=1)=>{const b=buildingSprite(id,0,lv);grandOwn(b.cv);return b;},battle:grandBattle,
 stats:()=>{let bytes=0,live=0;for(const c of grandOwned)if(c.width&&c.height){bytes+=c.width*c.height*4;live++;}return {styles:grandStyles.size,canvases:live,bytes};}};
