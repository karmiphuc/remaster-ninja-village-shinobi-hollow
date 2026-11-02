// Render actual HP-resolved finishing chains through the game's own modular poses and effects.
const fs=require('fs'),http=require('http'),path=require('path'),{chromium}=require('playwright'),install=require('./duel-art-fixture.cjs');
const root=path.resolve(__dirname,'..'),frameRoot=process.env.DUEL_FRAME_DIR||'/tmp/shinobi-duel-preview';
(async()=>{const server=http.createServer((q,r)=>{r.setHeader('content-type','text/html');r.end(fs.readFileSync(process.argv[2]||path.join(root,'index.html')));});await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH||(fs.existsSync('/usr/bin/chromium')?'/usr/bin/chromium':undefined),args:['--no-sandbox']});
 try{const p=await browser.newPage();await p.addInitScript(()=>{window.__noIntro=window.__noQuick=true;});await p.goto('http://127.0.0.1:'+server.address().port);await install(p);
 const cases=[['tripleSlash','katana',3,'BLACK FLASH Z'],['tripleThrust','katana',3,'TRIPLE SWORD THRUST'],['slidingThrust','ninjato',1,'KNEELING SLIDE'],['risingCut','nodachi',1,'RISING CUT']];
 fs.mkdirSync(frameRoot,{recursive:true});const samples=[];
 for(const [kind,weapon,count,title] of cases){
  const frames=await p.evaluate(({kind,weapon,count,title})=>{const S=simPrepare();try{
   const arena=duelArtFixture({weapons:[weapon],foes:['katana'],strong:true,hp:110}),chosen=duelArtChain(arena,kind,count),a=chosen.a,e=a.at(-1),W=e.f.hr,L=e.t.hr,
    c={a,e,D:chosen.D,n:1,t:0,duration:DUEL_CINE_TIME,kind,save:null,W,L,dir:1,x:67,y:66,bg:null,hold:0};
   W.x=44;W.y=66;W.face=1;L.x=67;L.y=66;L.face=-1;L.hero.hp=a[0].hpBefore;e.t.cur=a[0].hpBefore;BT.duelShot=c;
   for(const pose of DUEL_POSES){duelPoseFrame(W,e.f.g,pose,1);duelPoseFrame(L,e.t.g,pose,-1);}
   const cv=gameCanvas();cv.width=336;cv.height=246;const x=cv.getContext('2d'),out=[],beats=DUEL_IMPACT[a.length];x.imageSmoothingEnabled=false;
   for(let i=0;i<45;i++){c.t=Math.min(1.175,i/30);BT.t=c.t*BATTLE_PACE;
    for(let j=0;j<a.length;j++)if(c.t>=beats[j]&&!a[j].applied)duelEvent({k:'tdHit',e:a[j],D:chosen.D,n:1});
    x.setTransform(1,0,0,1,0,0);x.globalAlpha=1;x.fillStyle='#e7d6af';x.fillRect(0,0,336,246);x.fillStyle='#624834';x.font='13px monospace';x.textAlign='center';x.fillText(title,168,20);
    x.save();x.translate(0,29);x.scale(3,3);x.fillStyle='#a6ae78';x.fillRect(0,0,112,68);x.fillStyle='#959c65';x.fillRect(0,65,112,7);x.fillStyle='#c2bc8a';
    for(let k=0;k<12;k++)x.fillRect(3+k*9,67+(k%3),2,1);
    drawDuelFinishGround(x,c,1);drawDuelActor(x,W,e.f.g,0,1);drawDuelActor(x,L,e.t.g,1,1);drawDuelTrails(x,c,1);x.restore();
    out.push(cv.toDataURL('image/png'));
   }cv.width=cv.height=0;return {frames:out,seed:chosen.seed,kind,weapon,hits:a.map(e=>e.dmg)};
  }finally{if(BT)closeBattle();simRestore(S);}}, {kind,weapon,count,title});
  const dir=path.join(frameRoot,kind);fs.mkdirSync(dir,{recursive:true});frames.frames.forEach((data,i)=>fs.writeFileSync(path.join(dir,String(i).padStart(3,'0')+'.png'),Buffer.from(data.split(',')[1],'base64')));
  samples.push({kind,weapon,seed:frames.seed,hits:frames.hits});
 }
 fs.writeFileSync(path.join(frameRoot,'samples.json'),JSON.stringify(samples,null,2));console.log(JSON.stringify({frameRoot,framesPerMove:45,samples}));
 }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
