/* A real requestAnimationFrame session; no accelerated test clock. */
const fs=require('fs'),http=require('http'),path=require('path'),{chromium,webkit}=require('playwright');
const root=path.resolve(__dirname,'..'),name=process.env.SIM_ENGINE||'webkit',engine=name==='webkit'?webkit:chromium;
function baselineHtml(){
 let result='';const nativefs=fs,build=fs.readFileSync(path.join(root,'tools/build-economy.cjs'),'utf8');
 const fakefs={readFileSync:(p,...a)=>nativefs.readFileSync(p,...a),writeFileSync:(p,s)=>{result=s;}};
 new Function('require','__dirname','Buffer','console',build)(n=>n==='fs'?fakefs:require(n),path.join(root,'tools'),Buffer,{log:()=>{}});return result;
}
(async()=>{const baseline=baselineHtml(),current=fs.readFileSync(path.join(root,'index.html'),'utf8');
const server=http.createServer((q,r)=>{r.setHeader('content-type','text/html');r.end(q.url.startsWith('/baseline')?baseline:current);});await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await engine.launch({headless:true,args:name==='chromium'?['--no-sandbox']:[]}),rows=[],errors=[];
try{
 const p=await browser.newPage({viewport:{width:430,height:900},deviceScaleFactor:3,isMobile:true,hasTouch:true});p.on('pageerror',e=>errors.push(e.message));
 await p.route('https://**',r=>r.abort());await p.addInitScript(()=>{window.__noIntro=true;window.__noQuick=true;});
 async function setup(url){
  await p.goto('http://127.0.0.1:'+server.address().port+url);await p.waitForFunction(()=>typeof simPrepare==='function');
  await p.evaluate(()=>{
   const S=simPrepare();simFixture({id:'late-soak',tier:3,count:40,porters:2,chain:true},0x534801);
   VIEW.cv=S.VIEW.cv;VIEW.ctx=VIEW.cv.getContext('2d');document.getElementById('title').hidden=true;document.getElementById('app').hidden=false;
   resizeView();VIEW.zoom=.7;VIEW.scale=VIEW.dpr*.7;VIEW.cx=MAP_W*8;VIEW.cy=MAP_H*8;G.speed=3;G.endYear=9999;
   SH_PERF.sim=false;SH_PERF.diag=null;UI.panel=null;RT.paused=false;SH_PERF.on=true;perfOpen();
   const H=window.__soak={hist:new Uint32Array(501),frames:0,sum:0,last:0,started:performance.now(),marks:[],tick:null,nodes:0,peak:0,redraw:0};
   const frame=perfFrame;perfFrame=function(now){if(H.last){const dt=now-H.last;if(dt>0&&dt<500){H.frames++;H.sum+=dt;H.hist[Math.min(500,Math.floor(dt))]++;}}H.last=now;frame(now);};
   H.tick=setInterval(()=>{let count=0;for(const a of RT.agents)if(a.kind==='trav'&&!a.dead)count++;
    while(count++<42)spawnTraveller();G.speed=3;G.boons.pending=null;G.endYear=9999;
    const m=perfMemory();H.peak=Math.max(H.peak,m.mb);
   },1000);
  });
 }
 async function sample(stage,minute){
  const r=await p.evaluate(({stage,minute})=>{
   const H=window.__soak,m=perfMemory();let n=0,p95=0;for(let i=0;i<H.hist.length;i++){n+=H.hist[i];if(n>=H.frames*.95){p95=i;break;}}
   const at=performance.now(),json=JSON.stringify(G),ms=performance.now()-at,trav=RT.agents.filter(a=>a.kind==='trav').length;
   return {stage,minute,seconds:(performance.now()-H.started)/1000,fps:H.sum?H.frames*1000/H.sum:0,p95,agents:RT.agents.length,travellers:trav,canvasMB:m.mb,peakMB:H.peak,
    caches:perfCacheSizes(),rigDrawsPerSecond:SH_PERF.rigDraws/Math.max(1,(performance.now()-H.started)/1000),saveKB:new Blob([json]).size/1024,stringifyMs:ms,
    collections:perfCollections(),dom:document.querySelectorAll('*').length,year:G.year};
  },{stage,minute});rows.push(r);console.log('SOAK_SAMPLE='+JSON.stringify({...r,engine:name}));return r;
 }
 await setup('/baseline?perf=1');
 for(let minute=1;minute<=2;minute++){await p.waitForTimeout(60000);await sample('baseline',minute);}
 await setup('/?perf=1');
 for(let minute=1;minute<=15;minute++){await p.waitForTimeout(60000);await sample('P0',minute);}
 const panels=await p.evaluate(()=>{
  clearInterval(window.__soak.tick);G.speed=0;closeSheet();const before=document.querySelectorAll('*').length;
  for(let i=0;i<50;i++){openBuildingInfo(G.buildings.find(b=>b.id==='porter'));closeSheet();openVillager(G.villagers[i%G.villagers.length].id);closeSheet();}
  const after=document.querySelectorAll('*').length,m=perfMemory();return {before,after,growth:after-before,canvasMB:m.mb,caches:perfCacheSizes()};
 });
 const report={engine:name,durationMinutes:15,baselineMinutes:2,viewport:'430×900 DPR 3',village:{workers:40,travellers:42,speed:3,zoom:.7},rows,panels,errors,notes:['CI browser engine results; an actual iPhone app-switch/Low Power Mode check is still needed.','42 guests are maintained only in this stress fixture; gameplay demand is unchanged.']};
 fs.mkdirSync(path.join(root,'reports'),{recursive:true});fs.writeFileSync(path.join(root,'reports/perf-soak-'+name+'.json'),JSON.stringify(report,null,2));await p.screenshot({path:path.join(root,'reports/perf-soak-'+name+'.png')});console.log('SOAK_REPORT='+JSON.stringify(report));
 if(errors.length)throw Error(errors.join('\n'));
 if(rows.filter(r=>r.stage==='P0').some(r=>r.peakMB>48||r.collections>5000||r.stringifyMs>30))throw Error('P0 performance limits exceeded');
 }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
