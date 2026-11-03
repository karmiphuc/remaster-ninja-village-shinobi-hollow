// Actual campaign battles, prize grants and v1 round-trips for the saved training ladder.
const fs=require('fs'),http=require('http'),path=require('path'),assert=require('assert'),{chromium}=require('playwright');
const root=path.resolve(__dirname,'..');
(async()=>{const server=http.createServer((q,r)=>{r.setHeader('content-type','text/html');r.end(fs.readFileSync(process.env.DUEL_DOWNLOAD||path.join(root,'index.html')));});await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({headless:true,executablePath:'/usr/bin/chromium',args:['--no-sandbox']});
 try{const p=await browser.newPage({viewport:{width:390,height:844}}),errors=[];p.on('pageerror',e=>errors.push(e.message));await p.addInitScript(()=>{window.__noIntro=window.__noQuick=true;});await p.goto('http://127.0.0.1:'+server.address().port);
 const report=await p.evaluate(()=>{const S=simPrepare(),out={},saved=localStorage.getItem(SAVE_KEY);let checks=0;const ok=(v,m)=>{checks++;if(!v)throw Error(m);},clear=()=>{MQ.length=0;$('#modal').hidden=true;};
  try{newGame();G.tut=1;G.speed=0;$('#title').hidden=true;resizeView();afterLoad();clear();const dojo=PROVINCES.find(p=>p.type==='dojo');
   G.troops={inf:20000,arc:10000,gun:10000,cav:5000};for(const t of ['arc','gun','cav'])G.researched['corps_'+t]=1;
   const cap=armyPower(playerArmy()),rows=[];for(const level of [1,2,3,9,10,11,19,20,29,30,50,80,600,1000000]){G.dojoLevel=level;const A=enemyArmy(dojo),p=armyPower(A);
    ok(Number.isFinite(p)&&p<=cap,'Unbounded training strength at '+level);ok(A.groups.every(g=>g.troops>=1&&Number.isFinite(g.atkMul)&&g.atkMul>0),'Invalid group');
    if(level===1){ok(totalOf(A)===30&&A.groups.length===1&&A.groups[0].type==='inf'&&A.groups[0].cmds.length===0,'Opening is not 30 infantry');ok(p===30,'Opening strength scales with player');}
    if(level<10)ok(A.groups.every(g=>g.type==='inf'),'Advanced trainees too early');if(level===10)ok(A.groups.some(g=>g.type==='arc'),'Missing gradual archers');
    if(level===20)ok(A.groups.some(g=>g.type==='gun'),'Missing gradual gunners');if(level===30)ok(A.groups.some(g=>g.type==='cav'),'Missing gradual cavalry');
    let count=30;for(let i=1;i<level&&count<cap;i++)count+=Math.max(25,Math.ceil(count*.1));const expected=Math.min(cap,count);
    ok(p===expected,'Level does not follow 10% / minimum 25 recruits: '+JSON.stringify({level,p,expected}));
    for(const g of A.groups)recalcGroup(g,A);ok(armyPower(A)===p,'Calibration lost on recount');rows.push({level,troops:totalOf(A),power:p,formations:A.groups.map(g=>g.type)});}
   let prior=null;for(let level=1;level<=40;level++){G.dojoLevel=level;const A=enemyArmy(dojo),counts=Object.fromEntries(A.groups.map(g=>[g.type,g.troops]));
    if(prior){ok(totalOf(A)-prior.total>=Math.max(25,Math.ceil(prior.total*.1)),'Small level increment');ok(counts.inf>=prior.inf,'Milestone removed infantry');
     if(level%10)for(const t of ['arc','gun','cav'])ok((counts[t]||0)===(prior[t]||0),'Every formation grew between milestones');}
    prior={...counts,total:totalOf(A)};}
   out.ladder=rows;G.dojoLevel=30;const nominal=armyPower(enemyArmy(dojo));G.allHands=false;G.villagers.forEach(v=>v.role='work');G.troops={inf:15,arc:0,gun:0,cav:0};let A=enemyArmy(dojo);
   ok(armyPower(A)<=armyPower(playerArmy())&&armyPower(A)<nominal,'Army is not an upper cap');ok(G.dojoLevel===30,'Cap reset level');
   G.troops={inf:20000,arc:0,gun:0,cav:0};ok(armyPower(enemyArmy(dojo))===nominal,'Reinforcing changed nominal difficulty');
   G.dojoLevel=1;G.dojoPrize={kind:'troops',t:'inf',mul:.75};const p0=armyPower(enemyArmy(dojo));G.dojoPrize={kind:'person',id:freeRecruitsNow()[0].id,mul:1.05};ok(armyPower(enemyArmy(dojo))===p0,'Prize still scales the opponent');
   G.dojoLevel=30;delete G.researched.corps_arc;delete G.researched.corps_gun;delete G.researched.corps_cav;
   ok(enemyArmy(dojo).groups.every(g=>g.type==='inf'),'Locked formations added');
   G.dojoLevel=1;G.dojoMilestone=0;G.trainCD=0;G.dojoPrize={kind:'troops',t:'inf',mul:.75};ok(startBattle(dojo.id),'Actual spar did not start');
   ok(BT.dojoLevel===1&&totalOf(BT.A[1])===30,'Battle snapshot wrong');BT.A[1].groups.forEach(g=>g.troops=0);ok(finishBattle('win')!==false,'Cannot clear spar');
   ok(G.dojoLevel===2&&G.trainCD===2,'Clear did not advance once with cooldown');const gold=G.gold,n=G.troops.inf;dojoPayout('win',[]);ok(G.gold===gold&&G.troops.inf===n&&G.dojoLevel===2,'Repeated payout duplicated prizes/level');closeBattle();clear();
   G.dojoPrize={kind:'troops',t:'inf',mul:.75};dojoPayout('lose',[]);ok(G.dojoLevel===2,'Defeat advanced the ladder');
   const bonuses=[];for(const level of [10,20,30,40,50,60,70,80,90,100,110,120]){
    G.dojoLevel=level;G.dojoMilestone=level/10-1;const P=dojoMilestoneReward(level),preview=JSON.stringify(P),rewards=[];
    ok(JSON.stringify(dojoMilestoneReward(level))===preview,'Milestone rerolled');
    const before={gold:G.gold,items:JSON.stringify(G.items),research:JSON.stringify(G.researched),kit:JSON.stringify(G.kit),villagers:G.villagers.length,queue:G.recruitQueue.length};
    G.dojoPrize={kind:'troops',t:'inf',mul:.75};dojoPayout('win',rewards);ok(G.dojoLevel===level+1&&G.dojoMilestone===level/10,'Milestone did not advance');
    ok(rewards.some(r=>r.includes('Lv '+level+' milestone')),'Missing milestone receipt');
    if(P.kind==='worker')ok(G.villagers.length+G.recruitQueue.length===before.villagers+before.queue+1,'Free worker not joined/queued');
    if(P.kind==='tech')ok(G.researched[P.k]===1&&before.research!==JSON.stringify(G.researched),'Free technology missing');
    if(level===100)ok(P.kind==='mount'&&ITEMS[P.k].tier===5,'High milestone stuck on ordinary mounts');
    if(P.kind==='armor'||P.kind==='mount')ok((G.items[P.k]||0)===(JSON.parse(before.items)[P.k]||0)+1,'Free gear missing');
    if(P.kind==='crates')ok(G.kit[P.type][P.k]===(JSON.parse(before.kit)[P.type][P.k]||0)+P.n,'Free army sets missing');
    if(P.kind==='gold')ok(G.gold===before.gold+P.n+120,'Gold prize missing');
    const all=JSON.stringify(G),repeat=[];grantDojoMilestone(level,repeat,P);ok(JSON.stringify(G)===all&&!repeat.length,'Duplicate milestone');bonuses.push({level,...P});clear();}
   ok(['worker','tech','armor','mount','crates','gold'].every(kind=>bonuses.some(P=>P.kind===kind)),'Missing reward variety: '+JSON.stringify(bonuses));out.milestones=bonuses;
   // An offered worker/tech cannot be duplicated; all-researched/fully recruited campaigns have useful fallbacks.
   G.dojoLevel=130;G.dojoMilestone=12;const id=G.villagers[0].id,gold1=G.gold;grantDojoMilestone(130,[],{kind:'worker',id});ok(G.gold>gold1,'Unavailable worker has no fallback');
   for(const r of RESEARCH)G.researched[r.item]=1;ok(dojoMilestoneReward(140).kind==='gold','Exhausted research has no fallback');
   G.dojoLevel=20;G.dojoMilestone=1;for(const r of RESEARCH)delete G.researched[r.item];const candidate=dojoMilestoneReward(20);
   if(candidate.kind==='tech'){const r=RESEARCH.find(r=>r.item===candidate.k);G.research={id:r.id,left:3};ok(dojoMilestoneReward(20).k!==candidate.k,'Reward duplicates active paid research');G.research=null;G.resQ=[{id:r.id,paid:123}];ok(dojoMilestoneReward(20).k!==candidate.k,'Reward duplicates queued paid research');G.resQ=[];}
   G.dojoLevel=10;G.dojoMilestone=0;G.troops.inf=1000;openMap();showProvCard(dojo);const text=$('#prov-card').textContent;
   ok(text.includes('Level 10')&&text.includes('Clear Lv 10')&&text.includes('+10%')&&text.includes('+25'),'Card hides level/growth/milestone');
   ok($('#prov-card').scrollWidth<=document.documentElement.clientWidth,'Mobile card overflows');$('#prov-card').hidden=true;closeMap();
   G.dojoLevel=10;G.dojoMilestone=0;G.trainCD=0;G.dojoPrize={kind:'troops',t:'inf',mul:.75};ok(startBattle(dojo.id),'Milestone spar did not start');
   const snapshot=JSON.stringify(BT.dojoBonus);ok(BT.dojoLevel===10&&BT.dojoBonus,'Milestone not snapshotted');BT.A[1].groups.forEach(g=>g.troops=0);
   ok(finishBattle('win')!==false&&G.dojoLevel===11&&G.dojoMilestone===1,'Real battle did not grant its milestone');
   const paid=JSON.stringify(G);dojoPayout('win',[]);ok(JSON.stringify(G)===paid&&JSON.stringify(BT.dojoBonus)===snapshot,'Milestone snapshot paid twice');closeBattle();clear();
   G.dojoLevel=71;G.dojoMilestone=7;ok(S.save(),'Cannot save ladder');G=null;ok(S.load(),'Cannot reload ladder');afterLoad();clear();ok(G.v===1&&G.dojoLevel===71&&G.dojoMilestone===7,'Save compatibility');
   delete G.dojoLevel;delete G.dojoMilestone;afterLoad();clear();ok(G.dojoLevel===1&&G.dojoMilestone===0,'Legacy save not initialized at level 1');const state=JSON.stringify([G.dojoLevel,G.dojoMilestone]);migrateTraining();ok(JSON.stringify([G.dojoLevel,G.dojoMilestone])===state,'Migration not idempotent');
   out.save={v:G.v,oldSaveStartsAt:trainingLevel(),newFields:JSON.stringify({dojoLevel:71,dojoMilestone:7}).length};out.checks=checks;return out;
  }finally{if(BT)closeBattle();if(saved===null)localStorage.removeItem(SAVE_KEY);else localStorage.setItem(SAVE_KEY,saved);simRestore(S);}
 });assert.deepStrictEqual(errors,[]);fs.writeFileSync(path.join(root,'reports/training-ladder.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
 }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
