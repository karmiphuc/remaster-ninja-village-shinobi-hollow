// Real procedural rank-and-file, shared by the pacing tests and review captures.
module.exports=async function install(page){await page.evaluate(()=>{
 window.fieldCombatFixture=function(opts={}){
  if(BT)closeBattle();newGame();G.tut=1;G.speed=0;G.autoDuel=false;G.boons=freshBoons();G.roll=null;$('#title').hidden=true;resizeView();afterLoad();MQ.length=0;$('#modal').hidden=true;
  const R=Math.random;Math.random=seeded(opts.seed||73117);
  try{const type=opts.type||'inf',weapon=opts.weapon||({inf:'katana',arc:'yumi',gun:'tanegashima',cav:'naginata'}[type]),n=opts.troops||400,
   army=si=>finishArmy({side:si,clan:si?'kurogane':'kage',name:si?'Rivals':'Kage Clan',mode:'army',strat:0,ki:0,groups:[{type,troops:n,atkMul:1,defMul:1,cmds:[],guards:0,mods:modsOf([]),kitDist:{w:[[weapon,1]],a:[['lamellar',1]],h:[['jingasa',1]]}}]}),pa=army(0),ea=army(1);
   startBattle('field_art',{site:{id:'field_art',type:opts.site||'camp',clan:'kurogane',power:300,x:1,y:1,reward:{}},pa,ea});BT.seed=opts.seed||73117;BT.autoKi.on=false;BT.state='run';BT.round=1;BT.phaseName=type;BT.phase=type==='inf'?2:type==='gun'?0:1;BT.t=BT.anim=2;BT.speed=0;$('#btac').innerHTML='';
   for(const A of BT.A)for(const g of A.groups)for(const s of g.spr){s.q=[];s.x=s.sx;s.y=s.sy;s.state='idle';s.ph=.4;s.glow=0;}
   const hits=[{from:pa.groups[0],to:ea.groups[0],kills:n*.60,depth:0},{from:ea.groups[0],to:pa.groups[0],kills:n*.60,depth:0}];
   if(type==='inf')for(const h of hits){h.infAt=0;h.infEnd=INF_CLOCK.fight;}
   return {pa,ea,hits};
  }finally{Math.random=R;}
 };
});};
