// Development/browser fixture; the standalone game never loads this file.
module.exports=async function install(page){await page.evaluate(()=>{
 window.volleyFixture=function(opts={}){
  if(BT)closeBattle();Math.random=seeded(11731);newGame();G.tut=1;G.speed=0;G.battleMode='realtime';G.autoDuel=false;G.allHands=false;G.roll=null;G.boons=freshBoons();$('#title').hidden=true;resizeView();afterLoad();MQ.length=0;$('#modal').hidden=true;closeSheet();
  const counts=opts.counts||[1200,600,400,200],types=['inf','gun','arc','cav'];
  function army(side){return finishArmy({side,clan:side?'kurogane':'kage',name:side?'Rivals':'Kage Clan',mode:'army',strat:0,ki:0,
   groups:types.map((type,i)=>{
    const weapon=type==='gun'?(opts.weapon||'tanegashima'):type==='arc'?'yumi':type==='inf'?'yari':'naginata',s={atk:24,def:18,hp:140,str:22,mrk:40,wrk:10},
     make=(post,skill,sk=null)=>({id:type+side+post,name:type+' '+post,s,look:artTroopLook(type,side,post==='van'?1:0,{w:weapon,a:'domaru',h:'kabuto',m:opts.mount||(type==='cav'?'ashige':null)}),hp:140,hpMax:140,post,skill,slv:opts.level??3,sk:sk||{[skill]:opts.level??3},guard:0,kills:0}),
     cmds=opts.heroes===false?[]:[make(opts.post||'line',opts.skill||'attackup'),...(type==='inf'?[make('van','vanguard')]:[])];
    return {type,troops:(side?opts.enemyCounts:opts.counts)?.[i]??counts[i],atkMul:opts.attack??1,defMul:opts.defense??2,guards:0,cmds,mods:modsOf(cmds),kitDist:{w:[[weapon,1]],a:[['domaru',1]],h:[['jingasa',1]]}};
   }).filter(g=>g.troops>0)});}
  startBattle(null,{site:{id:'volley-review',name:'Volley review',type:'dojo',clan:'kurogane',power:2000,reward:{}},pa:army(0),ea:army(1)});
  BT.seed=11731;BT.autoKi.on=false;BT.round=BT.roundSeq=1;BT.phase=0;BT.state='run';rtStartWindow();
  if(opts.hold)for(const f of BT.rt.model.groups)BT.rt.model.order(f.id,'hold');
  return BT.rt;
 };
 window.volleyMeasure=function(opts={}){
  const R=volleyFixture(opts),M=R.model,guns=M.groups.find(f=>!f.side&&f.type==='gun'),hist=new Uint16Array(2400),eligible=new Uint32Array(1),moving=new Uint32Array(1);
  let last=0,maxReady=0,readyFrames=0,peak=0;
  for(let n=0;n<(opts.seconds||12)*60;n++){
   M.advance(1/60);BT.t+=1/60;BT.anim=(BT.anim||0)+1/60;rtUpdateExtras(1/60);
   const at=Math.min(hist.length-1,Math.floor(M.time*5)),delta=guns.fired-last;hist[at]+=delta;last=guns.fired;
   let ready=0;for(const m of guns.members)if(m.alive&&m.target?.alive&&Math.hypot(m.target.x-m.x,m.target.y-m.y)<=650){eligible[0]++;if(m.moving)moving[0]++;if(M.time-m.shotAt<.25)ready++;}
   maxReady=Math.max(maxReady,ready);if(ready)readyFrames++;
  }
  for(const n of hist)peak=Math.max(peak,n);
  const van=R.extras.find(m=>!m.f.side&&m.source.hero?.post==='van'),line=R.extras.find(m=>!m.f.side&&m.f.type==='inf'&&m.source.hero?.post==='line');
  return {seconds:M.time,fired:guns.fired,landed:guns.landed,damage:guns.damage,maxSimultaneousFire:maxReady,peakShotsPer200ms:peak,walkingWhileInRange:eligible[0]?moving[0]/eligible[0]:0,hist:Array.from(hist).slice(0,Math.ceil(M.time*5)),vanguard:van?{x:van.x,front:van.f.maxX,formation:van.f.x,line:line?.x}:null,residual:M.snapshot().residual};
 };
});};
