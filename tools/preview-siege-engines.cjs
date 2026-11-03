// Review the real cached procedural sprites, then capture an actual mobile siege deployment.
// Optional SIEGE_SOURCE / SIEGE_BEFORE select a standalone export and a historical HTML for comparison.
const fs=require('fs'),http=require('http'),path=require('path'),assert=require('assert'),{chromium}=require('playwright');
const root=path.resolve(__dirname,'..'),source=process.env.SIEGE_SOURCE||path.join(root,'index.html'),before=process.env.SIEGE_BEFORE;
(async()=>{const server=http.createServer((q,r)=>{r.setHeader('content-type','text/html');r.end(fs.readFileSync(q.url==='/before'&&before?before:source));});await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});try{
  const p=await browser.newPage({viewport:{width:430,height:932}}),errors=[];p.on('pageerror',e=>errors.push(e.message));await p.addInitScript(()=>{window.__noIntro=window.__noQuick=true;});
  let old=[];if(before){await p.goto('http://127.0.0.1:'+server.address().port+'/before');old=await p.evaluate(()=>['mortar','hwacha'].map(k=>propImg(k,0).toDataURL()));}
  await p.goto('http://127.0.0.1:'+server.address().port);
  const sheet=await p.evaluate(async old=>{const legacy=await Promise.all(old.map(url=>new Promise(r=>{const im=new Image();im.onload=()=>r(im);im.src=url;}))),cv=gameCanvas();cv.width=1000;cv.height=860;const x=cv.getContext('2d');x.imageSmoothingEnabled=false;
   x.fillStyle='#e8d8b0';x.fillRect(0,0,1000,860);x.fillStyle='#342a2a';x.font='bold 23px monospace';x.fillText('SHINOBI HOLLOW / SIEGE BATTERY',34,42);x.font='14px monospace';x.fillText('Actual procedural pixels. Warm timber, bronze and ink outlines.',34,70);
   for(const [i,k]of ['mortar','hwacha'].entries()){const c=propImg(k,0),cx=250+i*500;x.fillStyle='#342a2a';x.font='bold 22px monospace';x.fillText(i?'HWACHA / FIRE-ARROW CART':'BOMBARD / OZUTSU',cx-191,112);
    if(legacy[i]){const b=legacy[i];artDraw(x,b,cx-b.width*3,282-b.height*6,b.width*6,b.height*6);x.font='13px monospace';x.fillText('Previous / 6x',cx-82,310);}
    artDraw(x,c,cx-c.width*3,628-c.height*6,c.width*6,c.height*6);x.font='14px monospace';x.fillText('New / 6x - '+c.width+' x '+c.height+' native pixels',cx-181,654);
   }
   x.fillStyle='#bca47a';x.fillRect(30,680,940,1);x.fillStyle='#342a2a';x.font='14px monospace';x.fillText('Battlefield comparison / 2x',34,708);
   for(const [i,k]of ['mortar','hwacha','ram','yagura','stake'].entries()){const im=propImg(k,0),cx=150+i*175;artDraw(x,im,cx-im.width,832-im.height*2,im.width*2,im.height*2);}
   const out=cv.toDataURL().split(',')[1];cv.width=cv.height=0;return out;
  },old);fs.writeFileSync(path.join(root,'docs/siege-engines-preview.png'),Buffer.from(sheet,'base64'));
  const report=await p.evaluate(()=>{newGame();G.speed=0;G.tut=1;G.autoDuel=false;G.gold=50000;G.troops={inf:500,gun:350,arc:200,cav:100};G.researched.siegegun=1;for(const t of ['gun','arc','cav']){G.units[t]=true;G.researched['corps_'+t]=1;}$('#title').hidden=true;resizeView();afterLoad();MQ.length=0;$('#modal').hidden=true;startBattle('yamashiro');BT.state='prep';BT.round=0;
   showTacticPanel();$('#btac [data-eng-more="bombard"]').click();$('#btac [data-eng-more="hwacha"]').click();
   const ui=[...document.querySelectorAll('.engine img')].map(im=>im.src);
   for(const A of BT.A)for(const g of A.groups)for(const s of g.spr.concat(g.heroes||[])){s.q=[];s.x=s.sx;s.y=s.sy;s.state='idle';}
   BT.speed=0;BT.state='run';BT.t=BT.anim=10;BT.intro=null;BT.wipe=null;BT.phaseName=null;$('#btac').innerHTML='';clearCamKeys();BT.camAnchor=(BT.engPos.bombard[0]+BT.engPos.hwacha[0])/2;setCam(BT.camAnchor);drawBattle();
   const native=Object.fromEntries(['mortar','hwacha'].map(k=>{const im=propImg(k,0);return [k,{width:im.width,height:im.height,cached:im===propImg(k,0)}];}));
   for(const pr of BT.props)if(pr.k==='mortar'||pr.k==='hwacha')drawProp(BT.bx,pr);
   const before=Object.keys(_propImg).length,create=document.createElement;let allocations=0;document.createElement=function(k,...a){if(k==='canvas')allocations++;return create.call(this,k,...a);};try{for(let i=0;i<200;i++)for(const pr of BT.props)if(pr.k==='mortar'||pr.k==='hwacha')drawProp(BT.bx,pr);}finally{document.createElement=create;}
   drawBattle();return {native,distinctDeploymentIcons:ui.length===2&&ui[0]!==ui[1],warmCanvasAllocations:allocations,propCacheBefore:before,propCacheAfter:Object.keys(_propImg).length,drawn:engCount(),preview:$('#battle-cv').toDataURL()};
  });
  fs.writeFileSync(path.join(root,'docs/siege-engines-battle.png'),Buffer.from(report.preview.split(',')[1],'base64'));delete report.preview;
  const max=await p.evaluate(()=>{BT.round=0;BT.state='prep';for(let i=engN('bombard');i<2;i++)engBuy('bombard');for(let i=engN('hwacha');i<4;i++)engBuy('hwacha');const props=BT.props.filter(p=>p.k==='mortar'||p.k==='hwacha').sort((a,b)=>a.x-b.x);return {count:props.length,minGap:Math.min(...props.slice(1).map((p,i)=>p.x-props[i].x-(propImg(p.k,0).width+propImg(props[i].k,0).width)/2)),inField:props.every(p=>p.x-propImg(p.k,0).width/2>0&&p.x+propImg(p.k,0).width/2<BT.siege.x),sameY:props.every(p=>p.y===BT.engPos.y)};});report.maxBattery=max;
  assert(report.distinctDeploymentIcons&&report.warmCanvasAllocations===0&&max.count===6&&max.minGap>=2&&max.inField&&max.sameY);assert.deepStrictEqual(errors,[]);
  fs.writeFileSync(path.join(root,'reports/siege-engine-art.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
 }finally{await browser.close();server.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
