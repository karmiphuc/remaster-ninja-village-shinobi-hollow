// Regression coverage for out-of-range rear ranks, held screens and failed aiming retries.
const fs=require('fs'),path=require('path'),http=require('http'),assert=require('assert'),{chromium}=require('playwright'),install=require('../tools/battle-regression-fixture.cjs');
const root=path.resolve(__dirname,'..'),dir=path.join(root,'reports/realtime-engagement');
(async()=>{const server=http.createServer((q,r)=>r.end(fs.readFileSync(process.env.ENGAGEMENT_SOURCE||path.join(root,'index.html'))));await new Promise(r=>server.listen(0,'127.0.0.1',r));const b=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']});
 try{const p=await b.newPage({viewport:{width:430,height:932},deviceScaleFactor:3}),errors=[];p.on('pageerror',e=>errors.push(e.message));await p.addInitScript(()=>{window.__noIntro=window.__noQuick=true;window.requestAnimationFrame=()=>0;window.__engagementCanvas=0;const create=document.createElement;document.createElement=function(t,...a){if(t==='canvas')__engagementCanvas++;return create.call(this,t,...a);};});await p.route('https://**/*',r=>r.abort());await p.goto('http://127.0.0.1:'+server.address().port+'/?perf=1');await p.evaluate(()=>{Sound.play=Sound.say=Sound.music=()=>{};});await install(p);
  const report=await p.evaluate(()=>{let checks=0;const out={};const ok=(v,m)=>{checks++;if(!v)throw Error(m);},near=(a,b,m)=>ok(Math.abs(a-b)<1e-6,m+': '+a+' / '+b);
   const wait=(M,t,dt=1/60)=>{for(let n=0;n<Math.round(t/dt);n++)M.advance(dt);return M.snapshot();};
   const move=(f,x,y)=>{const dx=x-f.x,dy=y-f.y;f.x=f.homeX=f.goalX=x;f.y=f.homeY=f.goalY=y;for(const m of f.members){m.x+=dx;m.y+=dy;m.vx=m.vy=0;}};
   function make(o={},ground=null){const R=balanceFixture({counts:[1200,1200,0,0],enemyCounts:[1200,0,0,0],officers:0,attack:.0001,defense:50,...o});let M=R.model;
    if(ground){const old=M,styles=new Map(old.groups.map(f=>[f.g,f.members.map(m=>m.style)]));M=GrandCombat.create({battle:()=>old.sim,style:(t,s,v,g,i)=>styles.get(g)[i]},o.seed||11731,{count:g=>styles.get(g).length},ground);}
    for(const f of M.groups)if(f.type==='inf'||f.side)M.order(f.id,'hold');return {R,M};
   }
   function audit(M,name){const s=M.snapshot();near(s.residual,0,name+' ledger');near(s.hp,s.totals[0]+s.totals[1],name+' physical HP');ok(M.models.every(m=>m.hp>=0&&Number.isFinite(m.x)&&Number.isFinite(m.y)),name+' invalid actor');return s;}
   // All four ranks can engage across a held infantry screen, on either side.
   let C=make({enemyCounts:[1200,1200,0,0]});for(const f of C.M.groups)if(f.type==='gun')C.M.order(f.id,'advance');wait(C.M,12);out.heldScreen=[];
   for(const f of C.M.groups.filter(f=>f.type==='gun')){const active=f.members.filter(m=>m.shotAt>=0).length;ok(active>=46&&f.fired>=140,'Rear gun ranks stranded behind held infantry: '+f.side);out.heldScreen.push({side:f.side,actors:f.members.length,active,shots:f.fired,hits:f.landed});}audit(C.M,'both held screens');
   // A screen that is still alive must not lock pursuit of a distant enemy back line.
   C=make({enemyCounts:[0,0,1200,0]});let gun=C.M.groups.find(f=>!f.side&&f.type==='gun'),enemy=C.M.groups.find(f=>f.side);move(enemy,1250,500);let first=null;
   for(let i=0;i<1440;i++){C.M.advance(1/60);if(first===null&&gun.fired)first=C.M.time;}
   ok(gun.x>500&&gun.fired>=100&&gun.landed>0,'Guns stayed behind an idle screen instead of entering range');const x=gun.x;wait(C.M,5);near(gun.x,x,'Engagement position oscillates after reaching range');out.pursuit={firstShot:first,x:gun.x,shots:gun.fired,hits:gun.landed};audit(C.M,'distant back line');
   // Hold stays authoritative, and neither bows nor guns can shoot across the whole map.
   out.range=[];for(const type of ['gun','arc']){const counts=[0,0,0,0];counts[type==='gun'?1:2]=1200;C=make({counts,enemyCounts:[1200,0,0,0]});const f=C.M.groups.find(f=>!f.side),e=C.M.groups.find(f=>f.side);C.M.order(f.id,'hold');move(f,80,500);move(e,1250,500);wait(C.M,8);near(f.x,80,'Explicit ranged Hold moved');ok(f.fired===0,'Weapon fired beyond its maximum range');out.range.push({type,shots:f.fired,x:f.x});audit(C.M,'held range '+type);}
   // Terrain blocks a held gun, but an advancing gun is free to seek its existing firing lane.
   out.terrain=[];for(const held of [true,false]){C=make({counts:[1,1,0,0],enemyCounts:[1,0,0,0]},(x,y)=>x>470&&x<540?80:0);gun=C.M.groups.find(f=>f.type==='gun');const own=C.M.groups.find(f=>!f.side&&f.type==='inf'),e=C.M.groups.find(f=>f.side);move(own,450,500);move(gun,300,500);move(e,650,500);C.M.order(gun.id,held?'hold':'advance');wait(C.M,12);ok(held?gun.fired===0:gun.fired>0,'Terrain was bypassed or gun could not reposition');near(own.g.troops,1,'Gun damaged its friendly screen');out.terrain.push({held,x:gun.members[0].x,y:gun.members[0].y,shots:gun.fired,blocked:gun.blocked});audit(C.M,'terrain '+held);}
   // A failed release's short retry interval must not renew a permanent planted aiming pose.
   C=make({counts:[1,1,0,0],enemyCounts:[1,0,0,0]});gun=C.M.groups.find(f=>f.type==='gun');const own=C.M.groups.find(f=>!f.side&&f.type==='inf'),e=C.M.groups.find(f=>f.side);move(own,500,500);move(gun,300,500);move(e,700,500);C.M.advance(1/60);const m=gun.members[0],mx=m.x;m.blocked=true;m.aimUntil=C.M.time+.15;m.nextFire=C.M.time+.18;C.M.advance(1/60);ok(m.x>mx+.1&&m.aimUntil===0,'Blocked retry pinned a gunner in an endless aim pose');audit(C.M,'blocked retry');
   // Actual isolated arrow landings: MRK remains useful, and both hits and misses are possible.
   out.arrows=[];for(const distance of [180,420,760])for(const mrk of [0,80]){let fired=0,hits=0,misses=0,r2=0,samples=0;
    for(const seed of [11,53,181]){C=make({counts:[0,0,1,0],enemyCounts:[1,0,0,0],seed});const f=C.M.groups[0],t=C.M.groups[1];f.g.mrk=mrk;C.M.order(f.id,'hold');move(f,150,500);move(t,150+distance,500);const seen=new Float64Array(C.M.shots.length);seen.fill(-1);
     for(let i=0;i<14400;i++){C.M.advance(1/60);for(let j=0;j<C.M.shots.length;j++){const p=C.M.shots[j];if(p.on&&p.kind==='arc'&&p.start!==seen[j]){seen[j]=p.start;r2+=(p.x1-t.x)**2+(p.y1-t.y)**2;samples++;}}}
     fired+=f.fired;hits+=f.landed;misses+=f.missed;audit(C.M,'arrows '+distance+'/'+mrk+'/'+seed);
    }out.arrows.push({distance,mrk,fired,hits,misses,hitRate:hits/(hits+misses),rms:Math.sqrt(r2/samples)});
   }
   for(const distance of [180,420,760]){const a=out.arrows.find(r=>r.distance===distance&&r.mrk===0),b=out.arrows.find(r=>r.distance===distance&&r.mrk===80);ok(a.hits>0&&a.misses>0&&b.hits>0&&b.misses>0,'Arrows became guaranteed hits/misses');ok(b.hitRate>a.hitRate&&b.fired>a.fired&&b.rms<a.rms,'MRK lost its accuracy/cadence benefit');}
   near(GrandCombat.cadence('gun',0),6,'Gun reload changed');near(GrandCombat.cadence('arc',0),3.25,'Bow cadence changed');ok(GrandCombat.gunSpread(380,40)<1&&GrandCombat.gunSpread(800,40)>GrandCombat.gunSpread(580,40),'Close/mid gun accuracy or long-range penalty changed incorrectly');
   // Camera projection and 30/60 fps must not change the physical engagement journey.
   const steps=[];for(const dt of [1/60,1/30]){C=make({enemyCounts:[0,0,1200,0]});move(C.M.groups.find(f=>f.side),1250,500);steps.push(wait(C.M,24,dt));audit(C.M,'step '+dt);}ok(JSON.stringify(steps[0].groups)===JSON.stringify(steps[1].groups),'Engagement differs at 30/60 Hz');
   // Exercise the real campaign renderer on a phone-sized viewport after the back line enters range.
   const R=balanceFixture({officers:2,retainers:2,heavy:true,counts:[1200,1200,1200,1200],attack:.1,defense:20});for(let i=0;i<900;i++)updateBattle(1/60);R.view.overview(true);drawBattle();const start=__engagementCanvas,mb=perfMemory().mb;for(let i=0;i<60;i++)drawBattle();ok(__engagementCanvas===start,'Warm field rendering created canvases');ok(mb<=48,'Expanded range exceeds sampled canvas budget');out.render={canvasesDuringWarmDraw:__engagementCanvas-start,mb,models:R.model.models.length,extras:R.extras.length};audit(R.model,'rendered campaign');
   out.checks=checks;return out;
  });
  assert.deepStrictEqual(errors,[]);report.errors=errors;fs.mkdirSync(dir,{recursive:true});await p.screenshot({path:path.join(dir,'field.png'),scale:'css'});fs.writeFileSync(path.join(dir,'tests.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
 }finally{await b.close();server.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
