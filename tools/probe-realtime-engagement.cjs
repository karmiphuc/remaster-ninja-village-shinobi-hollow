// Actual campaign formations; expose failure to acquire/fire rather than just successful held volleys.
const fs=require('fs'),path=require('path'),http=require('http'),{chromium}=require('playwright'),install=require('./battle-regression-fixture.cjs');
const root=path.resolve(__dirname,'..');
(async()=>{const server=http.createServer((q,r)=>r.end(fs.readFileSync(process.env.ENGAGEMENT_SOURCE||path.join(root,'index.html'))));await new Promise(r=>server.listen(0,'127.0.0.1',r));const b=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']});
 try{const p=await b.newPage({viewport:{width:1100,height:780}}),errors=[];p.on('pageerror',e=>errors.push(e.message));await p.addInitScript(()=>{window.__noIntro=window.__noQuick=true;window.requestAnimationFrame=()=>0;});await p.route('https://**/*',r=>r.abort());await p.goto('http://127.0.0.1:'+server.address().port);await p.evaluate(()=>{Sound.play=Sound.say=Sound.music=()=>{};});await install(p);
  const out={errors,cases:{}};
  for(const name of ['active','mixed','held-front','distant-rear','ridge'])out.cases[name]=await p.evaluate(name=>{
   const R=balanceFixture({counts:[1200,1200,1200,0],enemyCounts:name==='distant-rear'?[0,0,1200,0]:[1200,1200,1200,0],officers:0,attack:.1,defense:20}),M=R.model;
   function move(f,x,y){const dx=x-f.x,dy=y-f.y;f.x=f.homeX=f.goalX=x;f.y=f.homeY=f.goalY=y;for(const m of f.members){m.x+=dx;m.y+=dy;}}
   for(const f of M.groups)if(f.side&&name!=='active')M.order(f.id,'hold');
   const inf=M.groups.find(f=>!f.side&&f.type==='inf'),gun=M.groups.find(f=>!f.side&&f.type==='gun'),arc=M.groups.find(f=>!f.side&&f.type==='arc');
   if(name!=='mixed'&&name!=='active')M.order(inf.id,'hold');
   if(name==='distant-rear')move(M.groups.find(f=>f.side&&f.type==='arc'),1250,500);
   if(name==='ridge'){for(const f of M.groups)move(f,f.x,f.side?790:650);move(gun,740,650);move(inf,810,650);}
   const rows=[];let eligible=0,aimLocked=0,gunSeconds=0;
   for(let i=0;i<3600;i++){updateBattle(1/60);for(const m of gun.members)if(m.alive){gunSeconds++;if(m.target?.alive)eligible++;if(m.blocked&&m.aimUntil>M.time&&!m.moving)aimLocked++;}if(i%600===599)rows.push({at:M.time,gun:{x:gun.x,fired:gun.fired,hits:gun.landed,damage:gun.damage,blocked:gun.blocked,targets:gun.members.filter(m=>m.alive&&m.target?.alive).length,moving:gun.members.filter(m=>m.alive&&m.moving).length},arc:{x:arc.x,fired:arc.fired,hits:arc.landed,damage:arc.damage}});}
   drawBattle();return {rows,eligible:eligible/gunSeconds,aimLocked:aimLocked/gunSeconds,residual:M.snapshot().residual};
  },name);
  fs.writeFileSync(process.env.ENGAGEMENT_REPORT||'/tmp/shinobi-engagement-probe.json',JSON.stringify(out,null,2));console.log(JSON.stringify(out,null,2));
 }finally{await b.close();server.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
