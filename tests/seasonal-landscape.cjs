// Seasonal scenery is cosmetic, bounded and independent of the gameplay RNG.
const fs=require('fs'),http=require('http'),path=require('path'),assert=require('assert'),{chromium}=require('playwright');
const root=path.resolve(__dirname,'..');
(async()=>{
 const server=http.createServer((q,r)=>{r.setHeader('content-type','text/html');r.end(fs.readFileSync(process.env.SEASON_DOWNLOAD||path.join(root,'index.html')));});await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH||(fs.existsSync('/usr/bin/chromium')?'/usr/bin/chromium':undefined),args:['--no-sandbox']});
 try{const p=await browser.newPage({viewport:{width:430,height:932}}),errors=[];p.on('pageerror',e=>errors.push(e.message));await p.addInitScript(()=>{window.__noIntro=window.__noQuick=true;});await p.goto('http://127.0.0.1:'+server.address().port+'/?perf=1');
 const report=await p.evaluate(()=>{
  const S=simPrepare(),out={};let checks=0;const ok=(v,m)=>{checks++;if(!v)throw Error(m);};
  const pixels=cv=>cv.getContext('2d').getImageData(0,0,cv.width,cv.height).data;
  const hash=cv=>{const a=pixels(cv);let n=2166136261;for(let i=0;i<a.length;i++)n=Math.imul(n^a[i],16777619);return n>>>0;};
  const opaque=cv=>{let n=0;const a=pixels(cv);for(let i=3;i<a.length;i+=4)if(a[i])n++;return n;};
  try{
   simFixture({id:'landscape',tier:2,count:6,porters:0},0x5ea50);G.speed=0;G.buildings=[];G.bmap.fill(-1);G.roads.fill(0);G.tiles.fill('grass');for(const k in LAND)G.land[k]=true;RT.agents=[];
   place('hall',15,10,true);place('pine',11,10,true);place('sakura',13,10,true);place('pond',19,10,true);place('paddy',10,15,true);place('teien',22,15,true);place('fujidana',15,15,true);
   for(let x=7;x<28;x++){G.roads[idx(x,13)]=1;G.roads[idx(x,14)]=2;}for(let y=8;y<12;y++)for(let x=23;x<27;x++)G.tiles[idx(x,y)]='water';
   invalidateRoadTraffic();refreshBoosts();VIEW.cx=17*16;VIEW.cy=14*16;
   const tileHashes=[];for(let s=0;s<4;s++){G.month=1+s*3;updateVillageWeather(0);drawVillage();tileHashes.push(hash(RT.ground));ok(RT.groundSeason===s,'Wrong ground season');}
   ok(tileHashes[0]===tileHashes[1]&&tileHashes[0]!==tileHashes[2]&&tileHashes[2]!==tileHashes[3],'Ground palette changes missing');
   ok(SEASON_ART.tiles[0].grass0===TILES.grass0&&SEASON_ART.tiles[1].grass0===TILES.grass0,'Spring/summer terrain changed');
   ok(hash(SEASON_ART.roads[3].road15_0)!==hash(SEASON_ART.roads[0].road15_0),'Winter road not washed out');
   for(const id of ['pine','sakura'])ok(opaque(seasonalNatureSprite(id,0,3).cv)<opaque(seasonalNatureSprite(id,0,0).cv),'Winter tree still leafy: '+id);
   ok(hash(seasonalNatureSprite('pine',0,3).cv)!==hash(seasonalNatureSprite('sakura',0,3).cv),'Bare sakura not distinct');
   ok(hash(seasonalNatureSprite('sakura',0,0).cv)!==hash(seasonalNatureSprite('sakura',0,1).cv),'Summer sakura still flowering');
   ok(hash(seasonalNatureSprite('pond',0,3).cv)!==hash(seasonalNatureSprite('pond',0,0).cv),'Pond did not freeze');
   const ice=hash(RT.ground);RT.t+=10;drawVillage();ok(hash(RT.ground)===ice,'Winter ice animated');
   ok(canPlace('hut',23,8)&&roadBrushPlan(23,8,'road').why,'Ice became buildable or a path');
   const roads=JSON.stringify(G.roads),terrain=JSON.stringify(G.tiles),bmap=JSON.stringify(G.bmap),assets=SEASON_ART.canvases,memStart=perfMemory().mb;
   const before=JSON.stringify(G);const create=document.createElement;let canvases=0;
   document.createElement=function(name,...args){if(name==='canvas')canvases++;return create.call(this,name,...args);};
   try{for(let i=0;i<120;i++){G.month=1+(i%4)*3;updateVillageWeather(1/30);drawVillage();}buildSeasonalArt();}
   finally{document.createElement=create;}
   ok(canvases===0,'Season cycling created '+canvases+' canvases in draw');ok(SEASON_ART.canvases===assets,'Unbounded seasonal assets');G.month=10;
   ok(JSON.stringify(G)===before&&JSON.stringify(G.roads)===roads&&JSON.stringify(G.tiles)===terrain&&JSON.stringify(G.bmap)===bmap,'Season rendering changed saved gameplay state');
   out.art={seasons:4,terrainHashes:tileHashes,bareTrees:true,distinctSakura:true,summerGreenSakura:true,frozenPond:true,iceStillBlocked:true,canvasAssets:assets,drawCanvasAllocations:canvases,canvasMBStart:memStart,canvasMBAfterCycles:perfMemory().mb};

   const rng=Math.random;G.month=4;let weather60,weather30;
   function sample(fps){RT.weather=null;updateVillageWeather(0);const w=RT.weather;let ons=0,offs=0,wet=0,cloud=0,was=false;
    for(let i=0;i<240*fps;i++){updateVillageWeather(1/fps);if(w.raining!==was){if(w.raining)ons++;else offs++;was=w.raining;}if(w.raining)wet++;for(const c of w.clouds)if(c.active)cloud++;if(i%fps===0)drawSeason(VIEW.ctx);}
    return {ons,offs,wetFraction:wet/(240*fps),cloudFrames:cloud,nextRain:w.nextRain,rain:w.rain,t:w.t,particles:w.particles.length,cloudSlots:w.clouds.length};}
   try{Math.random=()=>{throw Error('Weather consumed gameplay RNG');};weather60=sample(60);weather30=sample(30);}finally{Math.random=rng;}
   ok(weather60.ons>=3&&weather60.offs>=2&&weather60.wetFraction>.1&&weather60.wetFraction<.7,'Rain lacks showers/dry intervals');
   ok(weather60.cloudFrames>0&&weather60.cloudSlots===3&&weather60.particles===140,'Cloud/particle bounds');
   ok(weather60.ons===weather30.ons&&weather60.offs===weather30.offs&&Math.abs(weather60.nextRain-weather30.nextRain)<1e-7&&Math.abs(weather60.wetFraction-weather30.wetFraction)<.002,'30/60 fps weather timing diverged');
   out.weather={seconds:240,showers:weather60.ons,dryBreaks:weather60.offs,wetFraction:weather60.wetFraction,privateRNG:true,dtDriven:true,particlePool:140,cloudPool:3};

   const nThumbs=()=>Object.keys(_thumb).length;
   for(let round=0;round<2;round++)for(let s=0;s<4;s++){G.month=1+s*3;for(const id of ['pine','sakura','bamboo','pond','road','road_wide','stone','stone_wide'])bThumb(id);if(round===0&&s===3)out.thumbCount=nThumbs();}
   ok(nThumbs()===out.thumbCount,'Seasonal UI thumbnails keep growing');
   G.month=10;economyBeforeSave();const raw=JSON.stringify(G);ok(!raw.includes('rainRng')&&!raw.includes('nextRain')&&!raw.includes('groundSeason'),'Transient art/weather entered save');
   G=JSON.parse(raw);resetRT();afterLoad();drawVillage();ok(G.v===1&&villageSeason()===3&&RT.groundSeason===3,'Winter save failed');
   out.save={version:1,winterReload:true,weatherTransient:true,bytes:new Blob([raw]).size};out.checks=checks;return out;
  }finally{simRestore(S);}
 });assert.deepStrictEqual(errors,[]);fs.mkdirSync(path.join(root,'reports'),{recursive:true});fs.writeFileSync(path.join(root,'reports/seasonal-landscape.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
 }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
