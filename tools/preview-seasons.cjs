// Review sheets rendered from the procedural game; never loaded by the game.
const fs=require('fs'),http=require('http'),path=require('path'),{chromium}=require('playwright');
const root=path.resolve(__dirname,'..'),source=process.argv[2]||path.join(root,'index.html');
(async()=>{
 const server=http.createServer((q,r)=>{r.setHeader('content-type','text/html');r.end(fs.readFileSync(source));});await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH||(fs.existsSync('/usr/bin/chromium')?'/usr/bin/chromium':undefined),args:['--no-sandbox']});
 try{const p=await browser.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));await p.addInitScript(()=>{window.__noIntro=window.__noQuick=true;});await p.goto('http://127.0.0.1:'+server.address().port);
 const result=await p.evaluate(()=>{
  const S=simPrepare();try{
   simFixture({id:'seasons',tier:3,count:12,porters:2},0x5ea50);G.buildings=[];G.bmap.fill(-1);G.roads.fill(0);G.tiles.fill('grass');for(const k in LAND)G.land[k]=true;G.speed=0;G.vseed=73117;G.year=2;
   const put=(id,x,y)=>{const b=place(id,x,y,true);b.born=-9;return b;};
   for(let x=6;x<38;x++)for(const y of [18,19])G.roads[idx(x,y)]=1;for(let y=5;y<34;y++)for(const x of [20,21])G.roads[idx(x,y)]=1;
   put('hall',17,15);put('hut',10,16);put('longhouse',13,16);put('smithy',23,16);put('workshop',26,16);put('porter',29,16);put('kura',32,16);put('lumber',35,16);
   put('paddy',10,20);put('veggie',13,20);put('teafield',16,20);put('pond',23,22);put('teien',28,22);put('fujidana',12,25);
   for(const [x,y] of [[8,13],[11,11],[15,12],[18,9],[23,8],[26,12],[33,13],[10,24],[17,26],[24,27],[34,25]])put('pine',x,y);
   for(const [x,y] of [[9,10],[13,13],[17,11],[24,12],[27,9],[32,12],[8,23],[16,24],[22,26],[33,23]])put('sakura',x,y);
   put('bamboo',18,22);put('bamboo',23,25);
   for(let y=7;y<27;y++)for(let x=5;x<8;x++)G.tiles[idx(x,y)]='water';for(let y=8;y<12;y++)for(let x=29;x<36;x++)G.tiles[idx(x,y)]='water';
   invalidateRoadTraffic();assignHomes();assignJobs();RT.agents=[];ensureVillagerAgents();for(let i=0;i<RT.agents.length;i++)agentAtTile(RT.agents[i],13+i%6,18+i%2);
   const panel=gameCanvas();panel.width=800;panel.height=576;VIEW.cv=panel;VIEW.ctx=panel.getContext('2d');VIEW.dpr=1;VIEW.w=800;VIEW.h=576;VIEW.scale=2;VIEW.zoom=2;VIEW.cx=21*16;VIEW.cy=18.5*16;
   const sheet=gameCanvas();sheet.width=1632;sheet.height=1264;const out=sheet.getContext('2d');out.fillStyle='#e8d8b0';out.fillRect(0,0,sheet.width,sheet.height);out.imageSmoothingEnabled=false;
   for(let s=0;s<4;s++){
    G.month=s*3+1;RT.groundDirty=true;updateVillageWeather(0);if(s===1){const w=RT.weather;w.rain=.65;w.raining=true;w.strength=.65;w.nextRain=100;const c=w.clouds[0];c.active=true;c.x=250;c.y=140;c.width=265;c.speed=10;}
    drawVillage();const x=8+(s%2)*816,y=44+Math.floor(s/2)*632;out.drawImage(panel,x,y);out.fillStyle='#403126';out.font='20px monospace';out.fillText(['SPRING · blossoms','SUMMER · passing shower','AUTUMN · golden foliage','WINTER · snow and ice'][s],x+8,y-15);
   }
   const detail=gameCanvas();detail.width=1080;detail.height=750;const d=detail.getContext('2d');d.imageSmoothingEnabled=false;d.fillStyle='#e8d8b0';d.fillRect(0,0,1080,750);
   const ids=['pine','sakura','bamboo','pond'];for(let s=1;s<4;s++)for(let j=0;j<ids.length;j++){
    const x=40+j*255,y=20+(s-1)*240;d.fillStyle=s===3?'#d5e0d7':s===2?'#b8a35c':'#78b25a';d.fillRect(x,y,185,200);const sp=seasonalNatureSprite(ids[j],0,s);
    artDraw(d,sp.cv,x+92-sp.cv.width*2,y+190-sp.cv.height*4,sp.cv.width*4,sp.cv.height*4);d.fillStyle='#342a2a';d.font='15px monospace';d.fillText(ids[j]+' · '+['','Summer','Autumn','Winter'][s],x+3,y+222);
   }
   return {scene:sheet.toDataURL('image/png').split(',')[1],detail:detail.toDataURL('image/png').split(',')[1],canvases:SEASON_ART.canvases};
  }finally{simRestore(S);}
 });if(errors.length)throw Error(errors.join('\n'));fs.writeFileSync(path.join(root,'docs/seasonal-village-preview.png'),Buffer.from(result.scene,'base64'));fs.writeFileSync(path.join(root,'docs/seasonal-assets-preview.png'),Buffer.from(result.detail,'base64'));console.log(JSON.stringify({canvases:result.canvases,previews:2}));
 }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
