const fs=require('fs'),path=require('path'),http=require('http'),assert=require('assert'),{chromium}=require('playwright'),install=require('../tools/realtime-volley-fixture.cjs');
const root=path.resolve(__dirname,'..'),dir=path.join(root,'reports/realtime-volleys');
(async()=>{const server=http.createServer((q,r)=>r.end(fs.readFileSync(process.env.SHINOBI_DOWNLOAD||path.join(root,'index.html'))));await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const b=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']});
 try{const p=await b.newPage({viewport:{width:1100,height:780}}),errors=[];p.on('pageerror',e=>errors.push(e.stack));await p.addInitScript(()=>{window.__noIntro=window.__noQuick=true;window.requestAnimationFrame=()=>0;});await p.route('https://**/*',r=>r.abort());await p.goto('http://127.0.0.1:'+server.address().port);await install(p);
  const report=await p.evaluate(()=>{
   let checks=0;const ok=(x,m)=>{checks++;if(!x)throw Error(m);},near=(a,b,m)=>ok(Math.abs(a-b)<1e-7,m+' '+a+' / '+b),types=['inf','gun','arc','cav'];
   function step(R,seconds){for(let n=0;n<Math.round(seconds*60);n++){R.model.advance(1/60);BT.t+=1/60;BT.anim=(BT.anim||0)+1/60;rtUpdateExtras(1/60);}}
   function move(f,x,y){const dx=x-f.x,dy=y-f.y;f.x=f.homeX=x;f.y=f.homeY=y;for(const m of f.members){m.x+=dx;m.y+=dy;}}
   function held(skill,level=3,type='gun',weapon='tanegashima'){
    const own=[0,0,0,0],enemy=[0,0,0,0];own[types.indexOf(type)]=100000;enemy[0]=100000;
    const R=volleyFixture({counts:own,enemyCounts:enemy,skill,level,weapon,hold:true,attack:.01,defense:50}),f=R.model.groups[0],e=R.model.groups[1];move(f,300,500);move(e,type==='inf'?328:650,500);return {R,f,e};
   }
   const volley=volleyMeasure({heroes:false});ok(volley.maxSimultaneousFire>=12&&volley.peakShotsPer200ms>=10,'No recognizable firing rank');near(volley.residual,0,'Volley ledger');
   // Actual feet stop for aim/recoil while the formation can continue marching.
   let C=held('attackup',0),aimed=0,recoils=0,walked=0;move(C.f,150,500);C.R.model.order(0,'advance');
   for(let i=0;i<360;i++){step(C.R,1/60);for(const m of C.f.members){if(m.aimUntil>C.R.model.time&&m.target?.alive){aimed++;ok(!m.moving,'Gun walked through an aimed release');}if(C.R.model.time-m.shotAt<.3){recoils++;ok(!m.moving,'Gun slid through recoil');}if(Math.abs(m.vx)+Math.abs(m.vy)>2)walked++;}}
   ok(aimed>0&&recoils>0&&walked>0,'Aim, release or march was missing');
   // The flashes/traces use the actual procedural muzzle socket, including mirrored and mounted guns.
   const mounted=volleyFixture({mount:'nanbu'}),gunStyles=mounted.extras.filter(m=>m.f.type==='gun'&&m.source.hero).map(m=>m.style);
   ok(gunStyles.length===2&&gunStyles.every(s=>s.mounted&&s.muzzleX>12&&s.muzzleHeight>17),'Mounted/mirrored gun sockets missing');
   C=held('attackup',0);const socket=C.f.members[0].style;ok(socket.muzzleX>12&&socket.frames.atk.muzzleSocket,'Gun flash still originates inside the barrel');
   for(const f of C.R.model.groups){for(const m of f.members.slice(1)){m.source.alive=false;f.g.troops-=m.hp;}C.R.model.reconcile();}
   const shooter=C.f.members[0],target=C.e.members[0];move(C.f,600,500);move(C.e,608,500);shooter.x=600;shooter.y=target.y=500;target.x=608;
   step(C.R,1);ok(C.f.landed>0,'Point-blank bullets started beyond the enemy');near(C.R.model.snapshot().residual,0,'Point-blank ledger');
   const skills={};
   // Rapid Shot must release extra physical projectiles, and Chain Strike must land separate in-range blows.
   for(const skill of ['rapid','chain']){
    const rows=[];for(const level of [0,3]){C=held(skill,level,skill==='rapid'?'gun':'inf');step(C.R,14);const s=C.R.model.snapshot();rows.push({level,fired:C.f.fired,strikes:C.f.strikes,damage:C.f.damage,rapid:C.f.rapidProcs,chain:C.f.chainProcs,residual:s.residual});near(s.residual,0,skill+' ledger');}
    const [base,active]=rows;ok(skill==='rapid'?active.rapid>0&&active.fired>base.fired:active.chain>0&&active.strikes>base.strikes,skill+' remained a passive stat');ok(active.damage>base.damage*1.08,skill+' follow-ups did no useful damage');skills[skill]=rows;
   }
   // Countershot only boosts actual shots at a closing melee attacker, not a stationary target.
   const counter=[];for(const level of [0,3]){C=held('counter',level);C.R.model.order(C.e.id,'advance');step(C.R,10);counter.push({level,shots:C.f.counterShots,damage:C.f.damage,residual:C.R.model.snapshot().residual});}
   ok(counter[0].shots===0&&counter[1].shots>0&&counter[1].damage>counter[0].damage,'Countershot missing in live combat');C=held('counter',3);step(C.R,6);ok(C.f.counterShots===0,'Countershot applied to an idle enemy');skills.counter=counter;
   // Shared damage and commander data paths must retain primary AND learned secondary skills.
   const numeric={};for(const skill of ['attackup','marksman','arrowres','bulletres','horseres','shadow','ironwall','vanguard','duelist','strategy','laststand']){
    const values=[];for(const level of [0,3]){C=held(skill,level,skill==='marksman'?'gun':'inf');const g=C.f.g,t=C.e.g,c=g.cmds[0];
     if(['arrowres','bulletres','horseres','shadow'].includes(skill)){const kind=skill==='arrowres'?'arc':skill==='horseres'?'cav':'gun';values.push(C.R.model.sim.impact(1000,g,100,kind,t));}
     else if(skill==='ironwall'){recalcGroup(g,BT.A[0]);values.push(battleResistance(g));}
     else if(skill==='vanguard'){values.push(persPow(c,'inf'));}
     else if(skill==='duelist'){values.push(duelStats(c).off);}
     else if(skill==='strategy'){BT.A[0].strat=stratOf(c);values.push(C.R.model.sim.power(g,100,'inf',1));}
     else if(skill==='laststand'){g.troops=g.start*.25;updateCohesion(g);values.push(battleAttack(g));}
     else values.push(C.R.model.sim.power(g,100,C.f.type,1));
    }
    ok(['arrowres','bulletres','horseres','shadow'].includes(skill)?values[1]<values[0]:values[1]>values[0],skill+' lost its effect');numeric[skill]=values;
   }
   C=held('attackup',0);const c=C.f.g.cmds[0];c.sk={rapid:2,counter:1};c.skill='attackup';c.slv=0;recalcGroup(C.f.g,BT.A[0]);ok(C.f.g.mods.rapid===2&&C.f.g.mods.counter===1,'Learned secondary skills dropped');
   // Horse Lord belongs to charge impacts, rather than ordinary withdrawal swipes.
   const cavalry=[];for(const level of [0,3]){C=held('cavmaster',level,'cav');cavalry.push({charge:C.R.model.sim.power(C.f.g,100,'cav',1,true),ordinary:C.R.model.sim.power(C.f.g,100,'cav',1,false)});}
   near(cavalry[1].charge/cavalry[0].charge,1.3,'Horse Lord impact');near(cavalry[1].ordinary/cavalry[0].ordinary,1,'Horse Lord stacked on all swipes');skills.numeric=numeric;skills.cavalry=cavalry;
   // Finite medicine still travels through the existing once-per-round recovery and HP reconciliation.
   C=held('medic',3);C.f.g.troops-=10000;C.R.model.reconcile();const before=C.f.g.troops;endRound();const recovered=C.f.g.troops-before;endRound();near(C.f.g.troops-before,recovered,'Medic ran twice in one round');C.R.model.reconcile();ok(recovered>0&&recovered<=C.f.g.start*.09+1e-7,'Medic reserve wrong');near(C.R.model.snapshot().residual,0,'Medic reconciliation');skills.medic={recovered,once:true};
   // Vanguard officers advance independently to the front; line/Honjin officers and explicit orders remain distinct.
   const R=volleyFixture(),vans=R.extras.filter(m=>m.source.hero?.post==='van'),leads=[];let moving=false;
   for(let i=0;i<150;i++){step(R,1/60);moving||=vans.some(m=>m.moving);}
   for(const m of vans){const line=R.extras.find(q=>q.f===m.f&&q.source.hero?.post==='line');leads.push((m.x-line.x)*m.f.face);ok(leads.at(-1)>25,'Vanguard did not take the lead');}
   ok(moving&&vans.every(m=>m.chargeTarget?.alive),'Vanguard has no charge/pursuit behavior');
   const actual=vans[0];R.model.order(actual.f.id,'hold');step(R,2);ok((actual.x-actual.f.x)*actual.f.face<12,'Vanguard ignored explicit Hold');
   const HQ=volleyFixture({post:'hq',skill:'vanguard'}),camp=HQ.extras.filter(m=>m.hq);step(HQ,3);ok(camp.length>0&&camp.every(m=>!m.vanguard&&(m.f.side?m.x===1335:m.x===65)),'Honjin officer charged out of camp');
   const vanguard={leads,bothSides:vans.length,moving,honjinPreserved:true};
   // A full field with real triple-barrel styles and Rapid Shot must finish each released burst.
   const mass=volleyFixture({counts:[100000,100000,100000,100000],weapon:'rifle',skill:'rapid',hold:true,attack:.0001,defense:100}),M=mass.model;
   let peak=0;for(let i=0;i<180;i++){step(mass,1/60);let active=0;for(const p of M.shots)if(p.on)active++;peak=Math.max(peak,active);}
   const gunMembers=M.models.filter(m=>m.f.type==='gun'),released=gunMembers.filter(m=>m.nextFire>M.time+1);
   ok(released.length>=48&&released.every(m=>m.burstLeft===0),'Live triple-barrel bursts silently lost projectiles');ok(M.shots.length<=384&&peak>100,'Projectile state grew or stress did not exercise volleys');near(M.snapshot().residual,0,'Mass volley ledger');
   // Nothing pending can hit after the actor becomes a casualty.
   const victim=released[0];victim.followAt=victim.rapidAt=M.time+.1;victim.burstLeft=2;victim.source.alive=false;victim.f.g.troops-=victim.hp;M.reconcile();ok(!victim.alive&&victim.followAt===0&&victim.rapidAt===0&&victim.burstLeft===0,'Casualty kept follow-ups');
   const audit={battle:['chain','rapid','strategy','arrowres','bulletres','horseres','attackup','shadow','medic','vanguard','ironwall','marksman','cavmaster','duelist','laststand','siegecraft','counter','quartermaster'],village:['strongback','greenthumb','artisan','swift','tireless','haggler']};
   ok(Object.keys(SKILLS).every(k=>audit.battle.includes(k)||audit.village.includes(k)),'A hero skill has no audit route');
   closeBattle();ok(_battleArt.size===0&&_soldierCache2.size===0,'Volley atlases retained after exit');
   return {checks,volley,skills,vanguard,mass:{models:M.models.length,peakProjectiles:peak,pool:M.shots.length,completedBursts:released.length},audit};
  });
  assert.deepStrictEqual(errors,[]);report.errors=errors;fs.mkdirSync(dir,{recursive:true});fs.writeFileSync(path.join(dir,'results.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
 }finally{await b.close();server.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
