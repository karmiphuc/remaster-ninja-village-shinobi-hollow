// Browser-only review/test fixture. The standalone game never imports this file.
module.exports=async function install(page){await page.evaluate(()=>{
 window.duelArtFixture=function(opts={}){
  if(BT)closeBattle();newGame();G.tut=1;G.speed=0;G.autoDuel=true;G.boons=freshBoons();G.roll=null;G.vseed=73117;$('#title').hidden=true;resizeView();afterLoad();MQ.length=0;$('#modal').hidden=true;
  const n=opts.n||1,weapons=opts.weapons||['katana'],foes=opts.foes||['yari'];
  function army(si){const groups=[];
   for(let i=0;i<n;i++){const id=(si?foes:weapons)[i%(si?foes:weapons).length],kind=weaponKind(id),type=opts.mounted&&si===0?'cav':kind==='gun'?'gun':kind==='bow'?'arc':'inf',
     s={atk:opts.strong&&!si?34:23+i*2,def:12+i,hp:opts.hp||140,str:18,mrk:29,wrk:6,duel:3},
     look=artEquipmentLook(artTroopLook(type,si,i,{w:id,a:si?'kokuyo_gusoku':'gekko_gusoku',h:si?'kabuto':'eboshi_samurai',m:type==='cav'?'nanbu':null})),
     c={name:(si?'Rival ':'Champion ')+(i+1),s,look,hpMax:s.hp,hp:s.hp,post:'line',skill:'duelist',slv:3,kills:0,guard:opts.save==='guard'?3:0,ward:opts.save==='ward',wardUsed:false},
     g={type,troops:120,atkMul:2,defMul:2,guards:c.guard,cmds:[c],mods:modsOf([c])};groups.push(g);
   }return finishArmy({side:si,clan:si?'kurogane':'kage',name:si?'Rivals':'Kage Clan',mode:'army',groups,ki:0,strat:0});}
  const pa=army(0),ea=army(1);startBattle('duel_art',{site:{id:'duel_art',type:'dojo',clan:'kurogane',power:300,x:1,y:1,reward:{}},pa,ea});
  BT.autoKi.on=false;BT.state='run';BT.round=1;BT.phase=-1;BT.speed=1;$('#btac').innerHTML='';
  const own=pa.groups.map(g=>g.heroes[0]||g.spr.find(s=>s.hero)),other=ea.groups.map(g=>g.heroes[0]||g.spr.find(s=>s.hero));
  own.forEach((s,i)=>s._g=pa.groups[i]);other.forEach((s,i)=>s._g=ea.groups[i]);
  return {pa,ea,pairs:own.map((a,i)=>({a,b:other[i]}))};
 };
 window.duelArtChain=function(arena,kind,count){
  const R=Math.random;try{for(let seed=1;seed<=1000;seed++){Math.random=seeded(seed);const D=simDuel(arena.pairs),chains=[];
   for(const e of D.log){let a=chains.at(-1);if(!a||a[0].chain!==e.chain)chains.push(a=[]);a.push(e);}
   const a=chains.find(a=>a.at(-1).ko&&a.every(e=>e.hit)&&a[0].f.si===0&&(!count||a.length===count)&&(!kind||duelFinisher(a)===kind));
   if(a)return {seed,D,a};}throw Error('No actual KO chain found: '+kind+'/'+count);
  }finally{Math.random=R;}
 };
});};
