// Seeded identities, actual offers/recruitment, reservation safety, art and v1 save/load.
const fs=require('fs'),http=require('http'),path=require('path'),assert=require('assert'),{chromium}=require('playwright');
const root=path.resolve(__dirname,'..');
(async()=>{const server=http.createServer((q,r)=>{r.setHeader('content-type','text/html');r.end(fs.readFileSync(process.env.RECRUIT_DOWNLOAD||path.join(root,'index.html')));});await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({headless:true,executablePath:'/usr/bin/chromium',args:['--no-sandbox']});try{const p=await browser.newPage({viewport:{width:430,height:932}}),errors=[];p.on('pageerror',e=>errors.push(e.message));await p.addInitScript(()=>{window.__noIntro=window.__noQuick=true;});await p.goto('http://127.0.0.1:'+server.address().port);
 const report=await p.evaluate(()=>{const S=simPrepare(),saved=localStorage.getItem(SAVE_KEY),out={};let checks=0;const ok=(v,m)=>{checks++;if(!v)throw Error(m);},clear=()=>{MQ.length=0;$('#modal').hidden=true;};
  try{newGame();G.tut=1;G.speed=0;G.boons.pending=null;G.roll.v=false;$('#title').hidden=true;resizeView();afterLoad();clear();G.camps=[];G.dojoPrize=null;G.hire=[];
   const original=JSON.stringify(VILLAGER_POOL.concat(RECRUITS).map(r=>vData(r.id))),originalRoll=JSON.stringify(G.roll),create=document.createElement,R=Math.random;let allocations=0;
   G.recruitPool={v:1,seed:73117,turn:0,recent:[]};_roamingRoster=null;
   document.createElement=function(tag,...args){if(tag==='canvas')allocations++;return create.call(this,tag,...args);};Math.random=()=>{throw Error('Roster generation consumed gameplay RNG');};
   let cast;try{cast=roamingRoster();ok(recruitRoster()===cast.all&&roamingRoster()===cast,'Roster regenerated every lookup');}finally{document.createElement=create;Math.random=R;}
   ok(allocations===0,'Unused recruit pool created canvases');ok(cast.list.length===48&&cast.all.length===RECRUITS.length+48,'Expansion missing');
   ok(cast.list.filter(r=>r.role==='work').length===32,'Worker calling guarantee broken');for(const t of ['inf','arc','gun','cav'])ok(cast.list.filter(r=>r.role===t).length===4,'Fighter role coverage '+t);
   ok(new Set(cast.list.map(r=>r.name)).size===48&&new Set(cast.list.map(r=>r.id)).size===48,'Duplicate identities');
   ok(new Set(cast.list.map(r=>r.hair)).size>=8&&new Set(cast.list.map(r=>artFaceTraits(r).profile.name)).size===6,'Face/hair variety missing');
   ok(new Set(cast.list.filter(r=>r.role==='work').map(r=>r.profession)).size===6,'Missing work specialties');
   for(const r of cast.list){ok(vBase(r.id)===r&&vData(r.id)===r,'Identity lookup failed');ok(SKILLS[r.skill]&&SKILLS[r.skill2]&&r.skill!==r.skill2,'Invalid skill pair');ok(r.base.every(n=>Number.isFinite(n)&&n>0)&&r.base[2]<40&&r.base[5]<=14,'Inflated/invalid base stats');
    const v=addVillager(r.id,true);ok(v&&v.pref===r.role,'Cannot recruit generated hero');const stats=vStats(v);ok(stats.sk[r.skill]===1,'Primary skill not learned');
    v.lv=22;const later=vStats(v);ok(later.sk[r.skill]===4&&later.sk[r.skill2]===3,'Growth/secondary skill missing');}
   ok(JSON.stringify(G.roll)===originalRoll&&JSON.stringify(VILLAGER_POOL.concat(RECRUITS).map(r=>vData(r.id)))===original,'New cast rerolled existing villagers');
   out.cast={extra:48,workers:32,heroes:16,workSpecialties:6,hairStyles:new Set(cast.list.map(r=>r.hair)).size,faceShapes:6,canvasesForUnseenPool:allocations};
   // All 48 slots reproduce from the saved seed, including art after crossing campaigns.
   const before=JSON.stringify(cast.list),id=cast.list[0].id,look=vLook({id,eq:{}});_roamingRoster=null;ok(JSON.stringify(roamingRoster().list)===before,'Same seed rerolled people');
   G.recruitPool={v:1,seed:98241,turn:0,recent:[]};const other=roamingRoster(),otherLook=vLook({id,eq:{}});ok(JSON.stringify(other.list)!==before&&otherLook.faceSeed!==look.faceSeed&&otherLook!==look,'New campaign reused old portrait identity');
   G.recruitPool={v:1,seed:73117,turn:0,recent:[]};ok(JSON.stringify(roamingRoster().list)===before,'Returning campaign changed identity');
   G.villagers=G.villagers.filter(v=>!v.id.startsWith('roam_'));G.recruitQueue=[];G.hire=[];G.camps=[];G.dojoPrize=null;G.recruitPool.recent=[];G.recruitPool.turn=0;
   const people=roamingRoster().list,blocked=people.slice(0,8).map(r=>r.id);addVillager(blocked[0],true);G.recruitQueue=[blocked[1]];G.hire=[{id:blocked[2],fee:100,src:'wander',until:99}];G.boons.pledge=blocked[3];
   G.dojoPrize={kind:'person',id:blocked[4],mul:1.05};G.camps=[{id:'reserved',reward:{recruits:[blocked[5]]}}];G.prov.settsu.retake={recruits:[blocked[6]]};const reserved=siteById('dojo1');reserved.reward.recruit=blocked[7];G.prov[reserved.id].owner='ronin';
   for(const id of blocked)ok(!freeRecruitsNow().some(r=>r.id===id),'Double booking reserved person '+id);
   ok(recruitEligible(blocked[7],true),'Explicit early castle recruitment unavailable');ok(!recruitEligible(blocked[5],true)&&!recruitEligible(blocked[6],true),'Castle override bypasses captive reservation');
   for(const level of [10,70,130,190])ok(!blocked.slice(0,7).includes(dojoMilestoneReward(level).id),'Milestone steals reserved worker');
   delete reserved.reward.recruit;delete G.prov.settsu.retake;G.camps=[];G.boons.pledge=null;G.hire=[];G.recruitQueue=[];G.dojoPrize=null;
   // Observe offers without accepting: all fresh candidates should rotate before refusals repeat.
   G.year=5;G.wins=10;G.recruitPool.recent=[];G.recruitPool.turn=0;const seen=[];
   for(let i=0;i<16;i++){const r=wanderingRecruit();ok(r&&(!seen.includes(r.id)||i>=12),'Immediate repeat in wandering pool');const snapshot=JSON.stringify(G.recruitPool);
    ok(wanderingRecruit().id===r.id&&JSON.stringify(G.recruitPool)===snapshot,'Preview rerolled/advanced rotation');offerHire(r.id,'wander','Test wandering offer');
    ok(onHire(r.id)&&G.recruitPool.recent.includes(r.id),'Actual offer not recorded');G.hire=[];seen.push(r.id);}
   ok(new Set(seen).size>=12&&seen.some(id=>id.startsWith('roam_')),'Expanded cast not offered');ok(G.recruitPool.recent.length===12,'Offer history not bounded');
   const S0=JSON.stringify(G.recruitPool);G.dojoPrize=null;let P;for(let i=0;i<200;i++){G.dojoPrize=null;P=dojoPrize();if(P.kind==='person')break;}
   ok(P.kind==='person'&&G.recruitPool.recent.includes(P.id),'Spar person not rotated');const stable=JSON.stringify(G.recruitPool);ok(dojoPrize()===P&&JSON.stringify(G.recruitPool)===stable,'Same prize changed rotation');
   const worker=dojoMilestoneReward(10);ok(worker.kind==='worker'&&vData(worker.id).role==='work'&&worker.id!==P.id,'Milestone offers duplicate/non-worker');
   const q0=G.recruitQueue.length;takeRecruit(worker.id);ok(vById(worker.id)||G.recruitQueue.includes(worker.id),'Worker was not recruited or queued');const n=G.villagers.length+G.recruitQueue.length;takeRecruit(worker.id);ok(G.villagers.length+G.recruitQueue.length===n,'Repeated reward duplicated resident/queue');
   const next=dojoMilestoneReward(10);ok(next.kind==='worker'&&next.id!==worker.id,'Next worker repeats accepted person');out.rotation={wanderersSeen:seen,unique:new Set(seen).size,recentLimit:G.recruitPool.recent.length,stablePrize:true,noDoubleBooking:true};
   // The real monthly arrival path retains its cooldown, signing fee and house requirement.
   G.recruitQueue=[];G.hire=[];G.dojoPrize=null;let home=null;
   for(let y=0;y<MAP_H&&!home;y++)for(let x=0;x<MAP_W&&!home;x++)if(!canPlace('hut',x,y)){clearTrees('hut',x,y);home=place('hut',x,y,true);}
   ok(home&&housingCap()>G.villagers.length,'Cannot provide a real free bed');G.wander=5;const roll=Math.random;
   try{Math.random=()=>.25;monthTick();}finally{Math.random=roll;}clear();
   const arrival=(G.hire||[]).find(h=>h.src==='wander');ok(arrival&&arrival.fee>0&&G.wander===0,'Monthly rotating recruit not offered at normal fee/cooldown');
   G.gold=10000;ok(hireNow(arrival.id)===null&&vById(arrival.id),'Cannot hire generated arrival through actual game path');clear();
   // The new pool supplies workers/commanders to the existing rebellion and event paths.
   const reward={recruits:[]},wid=ensureRebelWorker(reward);ok(vData(wid).role==='work'&&reward.workerCaptive===wid&&recruitRoster().some(r=>r.id===wid),'Rebellion skipped expanded worker pool');
   ok(freeRecruits(2).length===2&&freeRecruits(2,true).length===2,'Event choices cannot use expanded cast');
   G.camps=[];G.prov[reserved.id].owner='ronin';clear();const selected=G.villagers.find(v=>v.id.startsWith('roam_'))||addVillager(people[10].id,true);selected.eq={weapon:'bokken',armor:'hemp',head:'bandana',special:null,special2:null,mount:'pony'};
   const L=vLook(selected),stats=vStats(selected);ok(L.gear.w==='bokken'&&L.gear.a===selected.eq.armor&&L.gear.h===selected.eq.head&&L.gear.m==='pony','Generated identity broke equipment visuals');
   const cv=portrait(L,true),rig=artLiveVillager(L,'front',[],null);ok(cv.width&&rig.img.width,'Generated person cannot render');
   const savedData=JSON.stringify(recruitRoster().map(r=>vData(r.id))),savedLook=JSON.stringify(L),savedStats=JSON.stringify(stats),savedRotation=JSON.stringify(G.recruitPool),bytes=new Blob([JSON.stringify(G.recruitPool)]).size;
   ok(S.save(),'Save failed');G=null;ok(S.load(),'Load failed');afterLoad();clear();ok(G.v===1&&JSON.stringify(G.recruitPool)===savedRotation,'Save reset seed/rotation');
   ok(JSON.stringify(recruitRoster().map(r=>vData(r.id)))===savedData,'Save rerolled skills/looks/names');ok(JSON.stringify(vLook(vById(selected.id)))===savedLook&&JSON.stringify(vStats(vById(selected.id)))===savedStats,'Recruited gear/stats changed across load');
   ok(bytes<350&&!JSON.stringify(G.recruitPool).includes('base'),'Unseen roster bloats save');
   delete G.recruitPool;afterLoad();clear();const migrated=JSON.stringify(G.recruitPool);migrateRecruitPool();ok(JSON.stringify(G.recruitPool)===migrated&&recruitRoster().length===68,'Legacy migration failed/idempotence');
   G.recruitPool={v:1,seed:NaN,turn:-99,recent:['bad',null,...people.map(r=>r.id),people[0].id]};migrateRecruitPool();ok(G.recruitPool.turn===0&&G.recruitPool.recent.length<=12&&new Set(G.recruitPool.recent).size===G.recruitPool.recent.length,'Malformed rotation migration');
   out.save={version:G.v,extraStateBytes:bytes,legacyMigration:true,gearAndStatsStable:true};out.checks=checks;return out;
  }finally{Math.random=S.random;if(BT)closeBattle();if(saved===null)localStorage.removeItem(SAVE_KEY);else localStorage.setItem(SAVE_KEY,saved);simRestore(S);}
 });
 report.mobileHire=await p.evaluate(()=>{
  newGame();G.tut=1;G.speed=0;G.boons.pending=null;G.roll.v=false;$('#title').hidden=true;resizeView();afterLoad();MQ.length=0;$('#modal').hidden=true;G.year=5;G.wins=10;G.gold=10000;G.recruitPool={v:1,seed:73117,turn:0,recent:[]};
  const r=roamingRoster().list.slice().sort((a,b)=>b.name.length-a.name.length)[0];let home=null;
  for(let y=0;y<MAP_H&&!home;y++)for(let x=0;x<MAP_W&&!home;x++)if(!canPlace('hut',x,y)){clearTrees('hut',x,y);home=place('hut',x,y,true);}
  if(!home)throw Error('Missing real home fixture');offerHire(r.id,'wander','A wanderer seeks work');
  if(!$('#modal').textContent.includes(r.name)||document.documentElement.scrollWidth>innerWidth)throw Error('Long-name hire dialog overflow/missing identity');
  const buttons=[...document.querySelectorAll('#modal .modal-ft button')],hire=buttons.find(b=>b.textContent.startsWith('Hire ·'));
  if(!hire)throw Error('No actual hire button');hire.click();MQ.length=0;$('#modal').hidden=true;openPanel('folk');
  if(!vById(r.id)||!$('#sh-body').textContent.includes(r.name)||document.documentElement.scrollWidth>innerWidth)throw Error('Generated resident missing/overflowing after hiring: '+JSON.stringify({id:r.id,name:r.name,joined:!!vById(r.id),panel:UI.panel,width:document.documentElement.scrollWidth,body:$('#sh-body').textContent.slice(0,250)}));
  closeSheet();return {name:r.name,dialogFits:true,hiredFromButton:true,residentCardFits:true};
 });assert.deepStrictEqual(errors,[]);fs.writeFileSync(path.join(root,'reports/recruit-pool.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
 }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
