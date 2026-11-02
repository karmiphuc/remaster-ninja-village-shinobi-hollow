const fs=require('fs'),http=require('http'),path=require('path'),{chromium}=require('playwright');
const root=path.resolve(__dirname,'..'),dir=process.env.TRAINING_PREVIEW_DIR||'/workspace/shared/downloads/animal-training';
(async()=>{const server=http.createServer((q,r)=>{r.setHeader('content-type','text/html');r.end(fs.readFileSync(process.argv[2]||path.join(root,'index.html')));});await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({headless:true,executablePath:'/usr/bin/chromium',args:['--no-sandbox']});try{const p=await browser.newPage({viewport:{width:430,height:932}});
 await p.addInitScript(()=>{window.__noIntro=window.__noQuick=true;});await p.goto('http://127.0.0.1:'+server.address().port);fs.mkdirSync(dir,{recursive:true});
 const report=await p.evaluate(()=>{Math.random=seeded(775);newGame();G.tut=1;G.speed=0;G.boons.pending=null;G.roll.v=false;$('#title').hidden=true;resizeView();afterLoad();MQ.length=0;$('#modal').hidden=true;
  G.troops={inf:400,arc:250,gun:100,cav:70};for(const t of ['arc','gun','cav'])G.researched['corps_'+t]=1;
  openMap();showProvCard(PROVINCES.find(p=>p.type==='dojo'));
  const mounts=Object.keys(ITEMS).filter(k=>ITEMS[k].slot==='mount').map(k=>({k,tier:ITEMS[k].tier,rare:ITEMS[k].rare,cost:ITEMS[k].cost}));return {mounts};});
 await p.locator('#prov-card').screenshot({path:path.join(dir,'training-level-1.png')});await p.evaluate(()=>{G.dojoLevel=10;showProvCard(PROVINCES.find(p=>p.type==='dojo'));});await p.locator('#prov-card').screenshot({path:path.join(dir,'training-level-10.png')});
 console.log(JSON.stringify(report));}finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
