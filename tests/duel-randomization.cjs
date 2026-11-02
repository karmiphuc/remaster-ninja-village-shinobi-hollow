// Selection varies between duels, stays stable within one KO and cannot consume combat RNG.
const fs=require('fs'),http=require('http'),path=require('path'),assert=require('assert'),{chromium}=require('playwright'),install=require('../tools/duel-art-fixture.cjs');
const root=path.resolve(__dirname,'..');
(async()=>{const server=http.createServer((q,r)=>{r.setHeader('content-type','text/html');r.end(fs.readFileSync(process.env.DUEL_DOWNLOAD||path.join(root,'index.html')));});await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({headless:true,executablePath:'/usr/bin/chromium',args:['--no-sandbox']});try{const p=await browser.newPage({viewport:{width:430,height:932}}),errors=[];p.on('pageerror',e=>errors.push(e.message));await p.addInitScript(()=>{window.__noIntro=window.__noQuick=true;});await p.goto('http://127.0.0.1:'+server.address().port);await install(p);
 const report=await p.evaluate(()=>{const S=simPrepare(),R=Math.random;let checks=0;const ok=(v,m)=>{checks++;if(!v)throw Error(m);};try{
  const arena=duelArtFixture({weapons:['katana'],foes:['katana'],strong:true,hp:110}),source=duelArtChain(arena,null,3).a,saved=JSON.stringify(G),profiles=[],round=BT.round;
  // Reuse a genuine resolved chain to check selection eligibility, without simulating fabricated attacks.
  for(const [weapon,mounted,targetMounted]of [['katana',false,false],['ninjato',false,false],['ninja_claw',false,false],['naginata',false,false],['nodachi',false,false],['zanbato',false,false],['steel_yari',false,false],['katana',false,true],['steel_yari',false,true],['katana',true,false],['steel_yari',true,false],['yumi',false,false],['rifle',false,false]])for(const count of [1,2,3]){
   const last=source.at(-1),f={...last.f,hr:{...last.f.hr,look:{...last.f.hr.look,gear:{...last.f.hr.look.gear,w:weapon}},sprs:{...last.f.hr.sprs,horse:mounted?last.f.hr.sprs.idle:null},pet:null},g:{...last.f.g,type:mounted?'cav':'inf'}},
    t={...last.t,hr:{...last.t.hr,sprs:{...last.t.hr.sprs,horse:targetMounted?last.t.hr.sprs.idle:null}}};f.hr.hero={...last.f.hr.hero,look:f.hr.look};f.hr._g=f.g;f.weapon=duelWeapon(f.hr);
   const fresh=()=>source.slice(-count).map(e=>({...e,f,t,visualSeed:91})),seen=new Map();let pinned=null,chosen;
   Math.random=()=>{throw Error('Finisher selection consumed combat RNG');};
   try{for(let duel=0;duel<128;duel++){BT.duels=duel;const a=fresh(),kind=duelFinisher(a);seen.set(kind,(seen.get(kind)||0)+1);
     ok(duelFinisherPool(a).includes(kind),'Selected an ineligible weapon/target move');
     ok(count===3||!kind.startsWith('triple'),'Invented a triple from fewer resolved hits');
     ok(count!==1||kind!=='doubleThrust','Invented a double from one resolved hit');
     if(mounted)ok(!['slidingThrust','riderDrag','spearBrace','yariCast'].includes(kind),'Mounted actor received a foot-only execution');
     if(!targetMounted)ok(!['riderDrag','spearBrace'].includes(kind),'Anti-cavalry move selected against a foot target');
     if(!pinned){pinned=a;chosen=kind;}ok(duelFinisher(pinned)===chosen&&duelClip(pinned).kind===chosen,'KO rerolled during repeated reads or a later duel');
    }}finally{Math.random=R;}
   const ranged=weapon==='yumi'||weapon==='rifle';ok(ranged?seen.size===1&&seen.has('release'):seen.size>=3,'Execution is still effectively fixed by weapon or hit count');
   if(weapon==='steel_yari'&&!mounted)ok(seen.has(targetMounted?'spearBrace':'yariCast')&&seen.size>1,'New yari move excluded or forced');
   if(weapon==='katana'&&!mounted&&targetMounted)ok(seen.has('riderDrag')&&seen.size>1,'Rider takedown excluded or forced');
   profiles.push({weapon,mounted,targetMounted,count,choices:Object.fromEntries(seen)});
  }
  BT.round=round;ok(JSON.stringify(G)===saved,'Selection changed save state');return {checks,profiles,draws:profiles.length*128,combatRandomCalls:0,stablePerKO:true,saveUnchanged:true};
 }finally{Math.random=R;if(BT)closeBattle();simRestore(S);}});
 assert.deepStrictEqual(errors,[]);fs.writeFileSync(path.join(root,'reports/duel-randomization.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
 }finally{await browser.close();server.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
