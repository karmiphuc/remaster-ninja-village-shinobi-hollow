// Every preview is a genuine KO chain, rendered with the game's modular character and mount rigs.
const fs=require('fs'),http=require('http'),path=require('path'),{chromium}=require('playwright'),install=require('./duel-art-fixture.cjs');
const root=path.resolve(__dirname,'..'),frameRoot=process.env.DUEL_FRAME_DIR||'/tmp/shinobi-animal-sequences';
(async()=>{const server=http.createServer((q,r)=>{r.setHeader('content-type','text/html');r.end(fs.readFileSync(process.argv[2]||path.join(root,'index.html')));});await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH||(fs.existsSync('/usr/bin/chromium')?'/usr/bin/chromium':undefined),args:['--no-sandbox']});
 try{const p=await browser.newPage();await p.addInitScript(()=>{window.__noIntro=window.__noQuick=true;});await p.goto('http://127.0.0.1:'+server.address().port);await install(p);
 const cases=[['bear','bearSlam','katana',2,'BEAR / RISING PAW SLAM'],['boar','boarToss','yari',1,'BOAR / LOW CHARGE AND TOSS'],['wolf','beastPounce','katana',3,'WOLF / LEAPING TAKEDOWN'],['fox','beastFeint','ninjato',2,'FOX / FEINT AND PASSING CUT'],['monkey','monkeyVault','katana',2,'MONKEY / VAULT AND STRIKE'],['hawk','birdDive','katana',3,'HAWK / TALON DIVE']];
 fs.mkdirSync(frameRoot,{recursive:true});const samples=[];
 for(const [id,kind,weapon,count,title] of cases){
  const result=await p.evaluate(({id,kind,weapon,count,title})=>{const S=simPrepare();try{
   const mounted=false,arena=duelArtFixture({weapons:[weapon],foes:['katana'],strong:true,hp:110,pet:id}),chosen=duelArtChain(arena,kind,count),a=chosen.a,e=a.at(-1),W=e.f.hr,L=e.t.hr,clip=duelClip(a);
   W.x=91-e.f.weapon.reach;W.y=83;W.face=1;L.x=91;L.y=83;L.face=-1;L.hero.hp=a[0].hpBefore;e.t.cur=a[0].hpBefore;
   W.pet.x=W.x-12;W.pet.y=W.y+4;
   for(const q of L.guards||[]){q.x=L.x+17;q.y=L.y+5;}
   BT.duelRun={D:chosen.D,shots:0,clock:0,warm:[],warmIndex:0};BT.cine={F:chosen.D.F};duelEvent({k:'tdFinish',a,D:chosen.D,n:1,clip});const c=BT.duelShot;
   for(const pose of DUEL_POSES){duelPoseFrame(W,e.f.g,pose,1);duelPoseFrame(L,e.t.g,pose,-1);}
   if(mounted)for(const pose of DUEL_CAV_POSES)for(const face of [-1,1])duelPoseFrame(W,e.f.g,pose,face);
   const cv=gameCanvas();cv.width=420;cv.height=300;const x=cv.getContext('2d'),frames=[];x.imageSmoothingEnabled=false;
   for(let i=0;i<60;i++){c.t=Math.min(clip.duration-.005,i/30);BT.t=i/30*BATTLE_PACE;if(c.guard)updateDuelCover(c);if(c.pet)updateDuelPet(c);
    for(let j=0;j<a.length;j++)if(c.t>=c.beats[j]&&!a[j].applied)duelEvent({k:'tdHit',e:a[j],D:chosen.D,n:1});
    if(c.guard?.fate)updSprite(c.guard,BATTLE_PACE/30,e.t.g,e.t.si);
    x.setTransform(1,0,0,1,0,0);x.globalAlpha=1;x.fillStyle='#e7d6af';x.fillRect(0,0,420,300);x.fillStyle='#624834';x.font='13px monospace';x.textAlign='center';x.fillText(title,210,18);x.font='10px monospace';x.fillText(count+' RESOLVED HIT'+(count>1?'S':'')+' / PROCEDURAL GEAR',210,32);
    x.save();x.translate(0,38);x.scale(3,3);x.fillStyle='#a6ae78';x.fillRect(0,0,140,88);x.fillStyle='#959c65';x.fillRect(0,82,140,6);x.fillStyle='#c2bc8a';
    for(let k=0;k<15;k++)x.fillRect(3+k*9,84+(k%3),2,1);
    drawDuelFinishGround(x,c,1);drawDuelActor(x,W,e.f.g,0,1);drawDuelActor(x,L,e.t.g,1,1);drawDuelGuard(x,c,1);drawDuelPet(x,c,1);drawDuelTrails(x,c,1);x.restore();frames.push(cv.toDataURL('image/png'));
   }cv.width=cv.height=0;return {frames,id,kind,weapon,seed:chosen.seed,moves:clip.moves,hits:a.map(e=>e.dmg),retainerIntercepted:!!c.result?.intercepted};
  }finally{if(BT)closeBattle();simRestore(S);}}, {id,kind,weapon,count,title});
  const dir=path.join(frameRoot,id);fs.mkdirSync(dir,{recursive:true});result.frames.forEach((data,i)=>fs.writeFileSync(path.join(dir,String(i).padStart(3,'0')+'.png'),Buffer.from(data.split(',')[1],'base64')));
  const {frames,...sample}=result;samples.push(sample);
 }
 fs.writeFileSync(path.join(frameRoot,'samples.json'),JSON.stringify(samples,null,2));console.log(JSON.stringify({frameRoot,samples}));
 }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
