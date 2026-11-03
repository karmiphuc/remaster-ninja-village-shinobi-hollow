// Runs inside a private copy of the game's procedural library. boot() is never called.
G={v:1,wins:8,year:5,researched:{},items:{},troops:{inf:0,arc:0,gun:0,cav:0},villagers:[],buildings:[],boons:freshBoons(),clanPolicies:null};
const grandStyles=new Map(),grandOwned=new Set();
function grandOwn(c){if(c){grandOwned.add(c);if(c.detail)grandOwned.add(c.detail);}return c;}
function grandStyle(type,side,variant=0){
 const key=[type,side,variant].join(':');if(grandStyles.has(key))return grandStyles.get(key);
 const kit={w:type==='inf'?(variant?'katana':'steel_yari'):type==='gun'?'samurai':type==='arc'?'yumi':'naginata',a:type==='gun'?'nanbando':type==='arc'?'fuma_garb':side?'oyoroi':variant?'tosei':'domaru',h:type==='gun'?'eboshi_samurai':type==='arc'?'sugegasa':variant?'zunari':'kabuto',m:type==='cav'?'kiso':null},L=artTroopLook(type,side,variant+side*5,kit),frames={},raw=[];
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
function grandArmy(side){const ns=side?[1100,460,440,260]:[1400,380,480,220],types=['inf','gun','arc','cav'];
 return finishArmy({side,clan:side?'kurogane':'kage',name:side?'Kurogane':'Kage',mode:'army',strat:0,ki:0,groups:types.map((type,i)=>({type,troops:ns[i],atkMul:type==='inf'?(side?1.15:1.5):1.25,defMul:1.1,cmds:[],guards:0,mods:modsOf([]),spr:[],heroes:[]}))});}
function grandBattle(seed){const A=[grandArmy(0),grandArmy(1)],rng=seeded(seed);let round=1;
 function calc(type){const prior=Math.random,order=PREF.cav;BT={A,round,maxR:3,tac:['steady','steady'],jutsu:[null,null],seed,state:'run'};Math.random=rng;
  try{if(type==='cav')PREF.cav=['gun','arc','cav','inf'];const ctx={siege:false,jutsu:[null,null]},hs=resolvePhase(type,A[0],A[1],ctx).concat(resolvePhase(type,A[1],A[0],ctx));if(type==='inf')guardInfantryBreakthrough(hs);return hs.map(h=>({side:sideOf(h.from),from:A[sideOf(h.from)].groups.indexOf(h.from),targetSide:sideOf(h.to),to:A[sideOf(h.to)].groups.indexOf(h.to),kills:h.kills,depth:h.depth,at:h.infAt||0,end:h.infEnd||0}));}
  finally{PREF.cav=order;Math.random=prior;}}
 return {A,calc,round:n=>{round=n;},totals:()=>A.map(a=>a.groups.reduce((n,g)=>n+g.troops,0))};
}
window.GrandArt={style:grandStyle,prop:(k,side=0)=>grandOwn(propImg(k,side)),building:(id,lv=1)=>{const b=buildingSprite(id,0,lv);grandOwn(b.cv);return b;},battle:grandBattle,
 stats:()=>{let bytes=0,live=0;for(const c of grandOwned)if(c.width&&c.height){bytes+=c.width*c.height*4;live++;}return {styles:grandStyles.size,canvases:live,bytes};}};
