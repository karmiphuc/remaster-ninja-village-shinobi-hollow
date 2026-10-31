const fs=require('fs'),http=require('http'),path=require('path'),{chromium,webkit}=require('playwright');
const root=path.resolve(__dirname,'..');
(async()=>{const server=http.createServer((q,r)=>{r.setHeader('content-type','text/html');r.end(fs.readFileSync(path.join(root,'index.html')));});await new Promise(r=>server.listen(0,'127.0.0.1',r));
const engine=process.env.SIM_ENGINE==='webkit'?webkit:chromium;
const browser=await engine.launch({headless:true,args:engine===chromium?['--no-sandbox']:[]});
try{const p=await browser.newPage({viewport:{width:430,height:900},deviceScaleFactor:3}),errors=[];p.on('pageerror',e=>errors.push(e.message));
p.on('console',m=>{if(m.text().startsWith('ECONOMY_REPORT='))console.log(m.text());else if(m.type()==='error'&&!m.text().includes('ERR_'))errors.push(m.text());});
await p.addInitScript(()=>{window.__noIntro=true;window.__noQuick=true;});await p.goto('http://127.0.0.1:'+server.address().port+'/?perf=1');await p.waitForFunction(()=>typeof runEconomySim==='function');
const before=await p.evaluate(()=>{newGame();G.tut=1;G.speed=0;G.boons.pending=null;afterLoad();return {json:JSON.stringify(G),save:localStorage.getItem(SAVE_KEY),agents:JSON.stringify(RT.agents),data:JSON.stringify([PROVINCES,ITEMS,UNITS,RESEARCH])};});
const report=await p.evaluate(async()=>{return await runEconomySim();});
const after=await p.evaluate(()=>({json:JSON.stringify(G),save:localStorage.getItem(SAVE_KEY),agents:JSON.stringify(RT.agents),data:JSON.stringify([PROVINCES,ITEMS,UNITS,RESEARCH])}));
if(before.json!==after.json||before.save!==after.save||before.agents!==after.agents||!require('util').isDeepStrictEqual(JSON.parse(before.data),JSON.parse(after.data))){console.log('ISOLATION_DIFF='+JSON.stringify({g:before.json===after.json,save:before.save===after.save,data:before.data===after.data,differences:(function(){const out=[];function walk(a,b,path){if(a===b)return;if(!a||!b||typeof a!=='object'||typeof b!=='object'){out.push({path,before:a,after:b});return;}for(const k of new Set([...Object.keys(a),...Object.keys(b)]))walk(a[k],b[k],path+'.'+k);}walk(JSON.parse(before.data),JSON.parse(after.data),'data');return out.slice(0,20);})()}));throw Error('Simulation changed real village/save');}
if(report.rows.length!==50)throw Error('Missing seed/scenario results');
if(report.rows.some(r=>!r.failureExercised))throw Error('Failure scenario did not execute');
fs.mkdirSync(path.join(root,'reports'),{recursive:true});fs.writeFileSync(path.join(root,'reports','economy-'+report.version.toLowerCase()+'.json'),JSON.stringify({...report,engine:engine===webkit?'webkit':'chromium',isolation:true,errors},null,2));
await p.screenshot({path:path.join(root,'reports','economy-'+report.version.toLowerCase()+'.png')});
console.log('SIM_SUMMARY='+JSON.stringify({version:report.version,summary:report.summary,isolation:true,errors}));if(errors.length)throw Error(errors.join('\n'));
}finally{await browser.close();server.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
