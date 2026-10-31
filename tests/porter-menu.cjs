const fs=require('fs'),http=require('http'),path=require('path'),assert=require('assert'),{chromium}=require('playwright');
const root=path.resolve(__dirname,'..');
(async()=>{
 const server=http.createServer((q,r)=>{const file=q.url.startsWith('/legacy')?'baseline/v19.1.html':q.url.startsWith('/download')?process.env.PORTER_DOWNLOAD:'index.html';r.setHeader('content-type','text/html');r.end(fs.readFileSync(path.isAbsolute(file)?file:path.join(root,file)));});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const url='http://127.0.0.1:'+server.address().port;
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH||(fs.existsSync('/usr/bin/chromium')?'/usr/bin/chromium':undefined),args:['--no-sandbox']});
 try{
  const old=await browser.newPage();await old.addInitScript(()=>{window.__noIntro=window.__noQuick=true;});await old.goto(url+'/legacy');
  const legacy=await old.evaluate(()=>{newGame();G.tut=1;G.speed=0;G.gold=1200;G.villagers.slice(0,2).forEach(v=>v.role='work');afterLoad();saveGame();return localStorage.getItem(SAVE_KEY);});await old.close();
  const routes=process.env.PORTER_DOWNLOAD?['/','/download']:['/'],report=[];
  for(const route of routes){
   const context=await browser.newContext({viewport:{width:390,height:844}}),p=await context.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));
   await p.addInitScript(saved=>{window.__noIntro=window.__noQuick=true;if(!localStorage.getItem('porter-menu-seeded')){localStorage.setItem('shinobi-hollow-v1',saved);localStorage.setItem('porter-menu-seeded','1');}},legacy);
   await p.goto(url+route);await p.locator('#t-cont').click();
   await p.locator('#dock-in [data-p="build"]').click();await p.locator('#sh-tabs button').filter({hasText:'Fields & Work'}).click();
   const card=p.locator('#sh-body button.card').filter({hasText:'Porter House'});assert.equal(await card.count(),1,'Porter must appear once in the real build menu');await card.scrollIntoViewIfNeeded();assert(await card.isVisible());assert((await card.textContent()).includes('240'));
   if(process.env.PORTER_SCREENSHOT)await p.screenshot({path:process.env.PORTER_SCREENSHOT});
   await card.click();const ghost=await p.evaluate(()=>{if(RT.mode!=='place'||RT.buildId!=='porter')throw Error('Build card did not start placement');for(let y=0;y<MAP_H-1;y++)for(let x=0;x<MAP_W-1;x++)if(!canPlace('porter',x,y)&&entranceOf({id:'porter',x,y})){RT.ghost={x,y};updatePlaceBar();return {x,y,gold:G.gold};}throw Error('No connected placement found');});
   await p.locator('#pb-ok').click();const uid=await p.evaluate(gold=>{const b=G.buildings.find(b=>b.id==='porter');if(!b||G.gold!==gold-240||G.villagers.some(v=>v.job===b.uid))throw Error('Placement, cost, or auto-assignment failed');exitMode();openBuildingInfo(b);return b.uid;},ghost.gold);
   await p.locator('#sh-body .assign button').first().click();await p.locator('#sh-body .assign button').first().click();
   assert(await p.evaluate(uid=>G.villagers.filter(v=>v.job===uid).length===2,uid));assert(await p.evaluate(()=>saveGame()));
   await p.reload();await p.locator('#t-cont').click();assert(await p.evaluate(uid=>G.buildings.some(b=>b.uid===uid&&b.id==='porter')&&G.villagers.filter(v=>v.job===uid).length===2,uid));
   assert.deepStrictEqual(errors,[]);report.push({route,oldSave:true,visible:true,placed:true,cost:240,assigned:2,reload:true});await context.close();
  }
  fs.mkdirSync(path.join(root,'reports'),{recursive:true});fs.writeFileSync(path.join(root,'reports/porter-menu.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
 }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
