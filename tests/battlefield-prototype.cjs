// Standalone visual study: deterministic simulation, camera/orders, offline isolation and bounded art.
const fs=require('fs'),path=require('path'),http=require('http'),assert=require('assert');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'..'),html=path.join(root,'prototypes/Shinobi Hollow - Grand Battlefield.html');
(async()=>{
 const server=http.createServer((q,r)=>{r.setHeader('content-type','text/html');r.end(fs.readFileSync(html));});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_BIN||'/usr/bin/chromium',args:['--no-sandbox']});
 const result={},errors=[],url='http://127.0.0.1:'+server.address().port+'/?test=1';let checks=0;
 const ok=(v,m)=>{checks++;assert.ok(v,m);},near=(a,b,m)=>ok(Math.abs(a-b)<1e-7,m);
 async function open(options={}){
  const p=await browser.newPage({viewport:{width:1440,height:900},...options});p.on('pageerror',e=>errors.push(e.message));
  await p.addInitScript(()=>{
   window.__audit={storage:0,audio:0,canvas:0,requests:[]};
   for(const k of ['getItem','setItem','removeItem','clear'])Storage.prototype[k]=function(){__audit.storage++;throw Error('Prototype accessed storage');};
   window.AudioContext=window.webkitAudioContext=function(){__audit.audio++;throw Error('Prototype started audio');};
   const original=document.createElement;document.createElement=function(tag,...args){if(tag.toLowerCase()==='canvas')__audit.canvas++;return original.call(this,tag,...args);};
  });
  p.on('request',q=>{if(q.url()!==url&&!q.url().startsWith('data:')&&!q.url().startsWith('file:'))errors.push('Unexpected request: '+q.url());});
  await p.goto(url);await p.waitForFunction(()=>window.GrandBattle?.ready,null,{timeout:60000});
  await p.waitForFunction(()=>!document.getElementById('loading'));return p;
 }
 try{
  const p=await open();const start=await p.evaluate(()=>GrandBattle.snapshot());
  ok(start.living===300&&start.totals[0]===2480&&start.totals[1]===2260,'Missing armies or procedural figures');
  ok(start.canvas.styles===10&&start.canvas.MB<48,'Cold art budget exceeded');
  ok(start.groups[0].x>start.groups[1].x&&start.groups[1].x>start.groups[2].x&&start.groups[2].x>start.groups[3].x&&start.groups[4].x<start.groups[5].x&&start.groups[5].x<start.groups[6].x&&start.groups[6].x<start.groups[7].x,'Formation order changed');
  result.realtime=await p.evaluate(require('./helpers/battlefield-realtime.cjs'));ok(result.realtime.failures.length===0,result.realtime.failures.join('\n'));
  result.tactics=await p.evaluate(require('./helpers/battlefield-tactics.cjs'));ok(result.tactics.failures.length===0,result.tactics.failures.join('\n'));
  result.flow=await p.evaluate(require('./helpers/battlefield-flow.cjs'));ok(result.flow.failures.length===0,result.flow.failures.join('\n'));
  const steady=await p.evaluate(()=>{const n=__audit.canvas;for(let i=0;i<120;i++){GrandBattle.advance(1/60);GrandBattle.render();}return {allocated:__audit.canvas-n,now:GrandBattle.snapshot()};});
  ok(steady.allocated===0,'Rendering allocated new canvases');
  const run=async(step,iso=false)=>p.evaluate(({step,iso})=>{GrandBattle.reset(7711);if(iso)GrandBattle.angle();for(let t=0;t<40-1e-7;t+=step)GrandBattle.advance(step);const s=GrandBattle.snapshot();if(iso)GrandBattle.angle();return s;},{step,iso});
  const s60=await run(1/60),s30=await run(1/30),iso=await run(1/30,true);
  for(const s of [s60,s30,iso]){near(s.time,40,'Fixed-step time changed');ok(s.applied>1000&&s.fallen>0,'No resolved combat');near(s.totals[0]+s.totals[1]+s.applied,4740,'Duplicate or missing damage');ok(s.living+s.fallen+s.routed===300,'Casualty counted twice');}
  ok(JSON.stringify(s60.groups)===JSON.stringify(s30.groups),'30 / 60 Hz combat differs');
  ok(JSON.stringify(iso.groups)===JSON.stringify(s60.groups),'Projection changed combat');
  // Actual formation controls stop a march and resume contact without phase gating.
  const orders=await p.evaluate(()=>{GrandBattle.reset(7711,{troops:[[100,0,0,0],[100,0,0,0]],positions:{0:[450,500],4:[800,500]},orders:{0:'hold',4:'hold'}});GrandBattle.select(0);const before=GrandBattle.snapshot();for(let i=0;i<5;i++)GrandBattle.advance(1);const held=GrandBattle.snapshot();GrandBattle.order('advance');for(let i=0;i<16;i++)GrandBattle.advance(1);return {before,held,advanced:GrandBattle.snapshot()};});
  near(orders.before.groups[0].x,orders.held.groups[0].x,'Hold still marches');near(orders.held.applied,0,'Distant held infantry inflicted damage');ok(orders.advanced.groups[0].x>orders.held.groups[0].x+50&&orders.advanced.applied>0,'Advance failed to reconnect');
  await p.evaluate(()=>GrandBattle.reset());
  // Real pointer controls, pause, speed, keyboard and projection buttons.
  await p.click('#replay');await p.waitForTimeout(500);
  const cam0=await p.evaluate(()=>({...GrandBattle.camera}));await p.mouse.move(700,550);await p.mouse.down();await p.mouse.move(790,590,{steps:5});await p.mouse.up();
  const cam1=await p.evaluate(()=>({...GrandBattle.camera}));ok(Math.abs(cam1.x-cam0.x)>50,'Drag did not pan');
  await p.mouse.wheel(0,-160);const cam2=await p.evaluate(()=>({...GrandBattle.camera}));ok(cam2.z>cam1.z,'Wheel did not zoom');
  await p.click('#follow');ok(await p.getAttribute('#follow','aria-pressed')==='true','Follow button failed');
  await p.keyboard.press('Space');ok((await p.getAttribute('#pause','aria-label'))==='Play battle','Pause keyboard failed');await p.keyboard.press('Space');
  await p.click('#speed');ok((await p.textContent('#speed')).includes('2×'),'Speed button failed');await p.click('#speed');await p.click('#speed');
  const end=await p.evaluate(()=>{GrandBattle.reset();for(let i=0;i<240;i++)GrandBattle.advance(1);GrandBattle.render();return GrandBattle.snapshot();});
  ok(end.winner&&end.totals.includes(0),'Battle never finished through attrition');ok(end.routed>0&&end.fallen>0,'Death and casualty rout not both exercised');
  near(end.totals[0]+end.totals[1]+end.applied,4740,'End-state accounting failed');
  const cache=await p.evaluate(()=>{const old=GrandBattle.canvasStats(),n=__audit.canvas;for(let i=0;i<8;i++){GrandBattle.reset(i+1);for(let j=0;j<3;j++)GrandBattle.advance(1);GrandBattle.render();}const same=GrandBattle.canvasStats();for(let i=0;i<8;i++)GrandBattle.angle();return {old,same,after:GrandBattle.canvasStats(),created:__audit.canvas-n};});
  near(cache.old.MB,cache.same.MB,'Replay grew art memory');near(cache.after.MB,cache.old.MB,'Projection switch retained terrain');ok(cache.after.count===cache.old.count&&cache.created===8,'Replay or angle rebuilt actor art');
  await p.evaluate(()=>{GrandBattle.reset();for(let i=0;i<16;i++)GrandBattle.advance(1);GrandBattle.render();});await p.click('#overview');await p.waitForTimeout(450);
  const reportDir=path.join(root,'reports/battlefield-prototype');fs.mkdirSync(reportDir,{recursive:true});
  await p.screenshot({path:path.join(reportDir,'angled.png')});await p.click('#angle');await p.waitForTimeout(600);await p.screenshot({path:path.join(reportDir,'isometric.png')});
  result.desktop={canvasMB:start.canvas.MB,canvases:start.canvas.count,renderCanvasAllocations:steady.allocated,at40Seconds:s60.totals,final:end.totals,fallen:end.fallen,routed:end.routed,deterministic30and60:true};
  await p.close();
  const mobile=await open({viewport:{width:430,height:932},deviceScaleFactor:3,isMobile:true,hasTouch:true});
  const mobileStats=await mobile.evaluate(()=>GrandBattle.canvasStats());ok(mobileStats.width===860&&mobileStats.MB<48,'Mobile backing DPR / budget incorrect');
  const buttons=await mobile.locator('.controls button').evaluateAll(bs=>bs.map(b=>{const r=b.getBoundingClientRect();return {x:r.x,right:r.right,y:r.y,bottom:r.bottom,w:r.width,h:r.height};}));
  ok(buttons.every(b=>b.x>=0&&b.right<=430&&b.y>=0&&b.bottom<=932&&b.h>=44),'Mobile controls clipped / too small');
  // Actual synthetic touch pair (Chromium CDP) exercises the two-pointer pinch handler.
  const cdp=await mobile.context().newCDPSession(mobile),z=await mobile.evaluate(()=>GrandBattle.camera.z);
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:170,y:500,id:1},{x:260,y:500,id:2}]});
  await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:120,y:500,id:1},{x:310,y:500,id:2}]});
  await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  ok((await mobile.evaluate(()=>GrandBattle.camera.z))>z*1.8,'Pinch zoom failed');
  await mobile.click('#overview');await mobile.waitForTimeout(450);await mobile.evaluate(()=>{for(let i=0;i<15;i++)GrandBattle.advance(1);});
  await mobile.click('#follow');await mobile.waitForTimeout(450);await mobile.screenshot({path:path.join(reportDir,'mobile.png'),scale:'css'});
  const isolation=await mobile.evaluate(()=>({storage:__audit.storage,audio:__audit.audio}));ok(isolation.storage===0&&isolation.audio===0,'Game save / audio booted');
  await mobile.setViewportSize({width:932,height:430});await mobile.waitForTimeout(400);ok((await mobile.locator('body').evaluate(el=>el.scrollWidth))===932,'Landscape overflow');
  await mobile.screenshot({path:path.join(reportDir,'landscape.png'),scale:'css'});
  result.mobile={...mobileStats,backingDPR:2,touchPinch:true,isolatedStorageAndAudio:isolation};await mobile.close();
  // Exercise a completely offline standalone document with no HTTP-origin dependencies.
  // This managed Chromium forbids file:// navigation by browser policy; do not claim that was tested.
  const offlineContext=await browser.newContext({offline:true}),offline=await offlineContext.newPage();offline.on('pageerror',e=>errors.push(e.message));
  await offline.setContent(fs.readFileSync(html,'utf8'),{waitUntil:'load'});await offline.waitForFunction(()=>window.GrandBattle?.ready,null,{timeout:60000});
  ok((await offline.evaluate(()=>GrandBattle.snapshot().living))===300,'Offline standalone document does not run');await offlineContext.close();
  result.standalone={offlineDocument:true,externalAssets:0,fileProtocol:'Managed browser policy blocks file:// navigation; physical Safari not tested'};
  // Run the autonomous loop briefly; separate manual checks above from real RAF playback.
  const live=await browser.newPage();live.on('pageerror',e=>errors.push(e.message));await live.goto(url.replace('?test=1','?perf=1'));
  await live.waitForFunction(()=>GrandBattle?.ready,null,{timeout:60000});await live.waitForFunction(()=>GrandBattle.snapshot().time>4,null,{timeout:15000});const liveA=await live.evaluate(()=>GrandBattle.snapshot());
  ok(liveA.time>2.5,'Live loop stalled');await live.click('#pause');const paused=await live.evaluate(()=>GrandBattle.snapshot());await live.waitForTimeout(400);const still=await live.evaluate(()=>GrandBattle.snapshot());near(paused.time,still.time,'Paused game advanced');
  result.live={advancedSeconds:liveA.time,hud:await live.textContent('#perf')};await live.close();
  ok(errors.length===0,errors.join('\n'));result.checks=checks+result.realtime.checks+result.tactics.checks+result.flow.checks;result.errors=errors;fs.writeFileSync(path.join(reportDir,'results.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
 }finally{await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});
