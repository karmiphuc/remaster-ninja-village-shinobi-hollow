// Browser-only art fixture: real procedural equipment, formations, officers and leadership props.
module.exports=async function install(page){await page.evaluate(()=>{
 window.commandArtFixture=function(opts={}){
  if(BT)closeBattle();newGame();G.tut=1;G.speed=0;G.autoDuel=true;G.boons=freshBoons();G.roll.v=false;$('#title').hidden=true;resizeView();afterLoad();MQ.length=0;$('#modal').hidden=true;
  const R=Math.random;Math.random=seeded(73117);
  try{const skirm=!!opts.skirm,groups=(si)=>['inf','arc','gun','cav'].map((type,i)=>{
    const weapon={inf:'katana',arc:'yumi',gun:'tanegashima',cav:'naginata'}[type],s={atk:22,def:18,hp:140,str:18,mrk:24,wrk:7,duel:3},
      look=artEquipmentLook(artTroopLook(type,si,i,{w:weapon,a:si?'kokuyo_gusoku':'gekko_gusoku',h:si?'kabuto':'eboshi_samurai',m:type==='cav'?'nanbu':null})),
      c={id:(si?'rival_':'ally_')+type,name:(si?'Rival ':'Ally ')+type,look,s,hp:s.hp,hpMax:s.hp,skill:i===0?'strategy':'attackup',slv:i===0?4:2,post:type==='cav'?(si===0?(opts.allyCavPost||'van'):'van'):'line',lord:si===1&&i===0,kills:0,guard:0};
    if(si===0&&type==='cav'&&opts.allyCavLeadership){c.skill='strategy';c.slv=3;}
    if(skirm)return fighterGroup(type,c);
    const cmds=[c];if(i===0){const h={...c,id:c.id+'_hq',name:(si?'Rival':'Ally')+' general',lord:false,post:'hq',look:{...look,horo:'#8f553e'}};cmds.push(h);}
    return {type,troops:(opts.small?25:[400,250,150,100][i])*(si?1.2:1),cmds,atkMul:2,defMul:2,guards:0,mods:modsOf(cmds)};
  }),army=si=>finishArmy({side:si,clan:si?'kurogane':'kage',name:si?'Kurogane':'Kage',groups:groups(si),mode:skirm?'skirmish':'army',ki:0,strat:skirm?0:4}),pa=army(0),ea=army(1);
  const type=opts.site||'camp',site={id:'command_art',type,clan:'kurogane',x:1,y:1,power:500,reward:{}};
  startBattle(site.id,{site,pa,ea});BT.state='run';BT.phaseName='inf';$('#btac').innerHTML='';BT.t=BT.anim=2;BT.speed=0;BT.seed=73117;BT.sky='day';if(BT.autoKi)BT.autoKi.on=false;
  for(const A of BT.A){for(const g of A.groups)for(const q of g.spr.concat(g.heroes||[])){q.q=[];q.x=q.sx;q.y=q.sy;q.state='idle';q.glow=0;q.poseUntil=0;q.strikeAt=0;q.hop=0;for(const r of q.guards||[]){r.q=[];r.glow=0;}}
   for(const q of A.hqSpr||[]){q.q=[];q.state='idle';q.glow=0;}}
  BT.split=0;BT.cine=null;BT.cam.x=BT.cx;return {pa,ea};
  }finally{Math.random=R;}
 };
});};
