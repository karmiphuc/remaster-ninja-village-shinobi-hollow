const fs=require('fs'),http=require('http'),path=require('path'),{chromium}=require('playwright'),install=require('./field-combat-fixture.cjs');
const root=path.resolve(__dirname,'..');
(async()=>{const server=http.createServer((q,r)=>{r.setHeader('content-type','text/html');r.end(fs.readFileSync(process.env.FIELD_DOWNLOAD||path.join(root,'index.html')));});await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({headless:true,executablePath:'/usr/bin/chromium',args:['--no-sandbox']});try{const p=await browser.newPage({viewport:{width:430,height:932}});await p.addInitScript(()=>{window.__noIntro=window.__noQuick=true;});await p.goto('http://127.0.0.1:'+server.address().port);await install(p);
 const report=await p.evaluate(()=>{const S=simPrepare(),out={};try{for(const type of ['inf','gun','arc']){const a=fieldCombatFixture({type});Math.random=seeded(101);const s=buildScript(type,a.hits);Math.random=S.random;
   out[type]={duration:s.dur,firstHit:Math.min(...s.ev.filter(e=>e.k==='hit').map(e=>e.t-BT.t)),lastDeath:Math.max(...s.ev.filter(e=>e.k==='die').map(e=>e.t-BT.t)),hits:a.hits.map(h=>h.kills),events:s.ev.length};closeBattle();}
  for(const kind of ['death','rout']){fieldCombatFixture();const g=BT.A[0].groups[0],s=g.spr[0];if(kind==='death')killSprite(g,s,'inf',1);else routSprite(g,s,-1);
   const f=s.fate;let elapsed=0;while(!s.stamped&&!s.gone&&elapsed<30){updSprite(s,1/600,g,0);elapsed+=1/600;}
   out[kind]={reactionClock:f.end,elapsed,escapeAt:f.escapeAt||null};closeBattle();}return out;
 }finally{Math.random=S.random;if(BT)closeBattle();simRestore(S);}});if(process.env.FIELD_REPORT)fs.writeFileSync(process.env.FIELD_REPORT,JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
 }finally{await browser.close();server.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
