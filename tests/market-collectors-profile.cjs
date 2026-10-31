// Optional paired local profile; not part of npm test. Supply the pre-change HTML.
// MARKET_BASELINE=/tmp/before.html node tests/market-collectors-profile.cjs
const fs=require('fs'),http=require('http'),path=require('path'),assert=require('assert'),{chromium}=require('playwright');
const root=path.resolve(__dirname,'..'),baseline=process.env.MARKET_BASELINE;
if(!baseline)throw Error('Set MARKET_BASELINE to the pre-change standalone HTML');
(async()=>{
 const server=http.createServer((q,r)=>{r.setHeader('content-type','text/html');r.end(fs.readFileSync(q.url.startsWith('/before')?baseline:path.join(root,'index.html')));});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH||(fs.existsSync('/usr/bin/chromium')?'/usr/bin/chromium':undefined),args:['--no-sandbox']});
 try{
  const rows=[];
  for(const seed of [771,772,773])for(const mode of (seed%2?['before','default','hired']:['hired','default','before'])){
   const p=await browser.newPage({viewport:{width:430,height:932}}),errors=[];p.on('pageerror',e=>errors.push(e.message));
   await p.addInitScript(()=>{window.__noIntro=window.__noQuick=true;});await p.goto('http://127.0.0.1:'+server.address().port+(mode==='before'?'/before':'/'));
   const row=await p.evaluate(({seed,mode})=>{
    const S=simPrepare();
    try{
     simFixture({id:'late-collectors',tier:3,count:20,porters:2},seed);G.speed=1;RT.paused=false;
     while(RT.agents.length<60)spawnTraveller();
     for(let i=0;i<720;i++){updateVillage(1/30);if(i%30===0)drawVillage();}
     for(const b of G.buildings)if(BUILDINGS[b.id].makes)createGoods(economyPoint(b,'pile'),BUILDINGS[b.id].makes,Math.max(0,30-(b.pile||0)),'profile-seed');
     if(mode==='hired'&&!hireCollectors(G.buildings.find(b=>b.id==='kura')))throw Error('Profile hire failed');
     SH_PERF.diag=simStageStats();diagInventory(SH_PERF.diag.opening);
     const initial=perfMemory().mb,start=performance.now();let peakCollectors=0,peakMB=initial,maxSave=0,maxSaveMs=0,maxEntries=0;
     for(let i=0;i<3600;i++){
      updateVillage(1/30);
      if(i%10===0){let n=0;for(const a of RT.agents)if(a.kind==='collector'&&!a.dead)n++;peakCollectors=Math.max(peakCollectors,n);drawVillage();}
      if(i%270===0){peakMB=Math.max(peakMB,perfMemory().mb);const t=performance.now(),s=JSON.stringify(G);maxSaveMs=Math.max(maxSaveMs,performance.now()-t);maxSave=Math.max(maxSave,new Blob([s]).size/1024);maxEntries=Math.max(maxEntries,perfCollections());}
     }
     const ms=performance.now()-start,d=SH_PERF.diag;diagInventory(d.ending);let residual=0;
     for(const k of new Set([...Object.keys(d.opening),...Object.keys(d.ending),...Object.keys(d.created),...Object.keys(d.destroyed)]))residual+=Math.abs((d.ending[k]||0)-(d.opening[k]||0)-(d.created[k]||0)+(d.destroyed[k]||0));
     return {mode,seed,msPerWeek:ms/(120/WEEK_SEC),agents:RT.agents.length,peakCollectors,canvasMBStart:initial,canvasMBEnd:perfMemory().mb,peakCanvasMB:peakMB,maxSaveKB:maxSave,maxStringifyMs:maxSaveMs,maxCollections:maxEntries,cacheSizes:perfCacheSizes(),residual,negativeStocks:diagNegatives()};
    }finally{SH_PERF.diag=null;simRestore(S);}
   },{seed,mode});
   assert.deepStrictEqual(errors,[]);assert(row.residual<1e-7&&!row.negativeStocks,'Profile conservation');rows.push(row);await p.close();
  }
  const average=mode=>rows.filter(r=>r.mode===mode).reduce((n,r)=>n+r.msPerWeek,0)/3;
  const result={baseline:'0d504a4',seeds:3,secondsPerRun:120,warmupSeconds:24,updateFPS:30,drawEvery:10,rows,defaultRatio:average('default')/average('before'),hiredRatio:average('hired')/average('before')};
  fs.writeFileSync(path.join(root,'reports/market-collectors-performance.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
 }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
