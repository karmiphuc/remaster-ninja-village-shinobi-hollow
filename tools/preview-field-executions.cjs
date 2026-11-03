// Existing equipped frames in a live fight: no cinematic camera or new sprite sheets.
const fs=require('fs'),http=require('http'),path=require('path'),{chromium}=require('playwright'),install=require('./field-combat-fixture.cjs');
const root=path.resolve(__dirname,'..'),frameRoot=process.env.FIELD_FRAME_DIR||'/tmp/shinobi-field-previews';
(async()=>{const server=http.createServer((q,r)=>{r.setHeader('content-type','text/html');r.end(fs.readFileSync(process.argv[2]||path.join(root,'index.html')));});await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({headless:true,executablePath:'/usr/bin/chromium',args:['--no-sandbox']});try{const p=await browser.newPage();await p.addInitScript(()=>{window.__noIntro=window.__noQuick=true;});await p.goto('http://127.0.0.1:'+server.address().port);await install(p);fs.mkdirSync(frameRoot,{recursive:true});
 for(const [id,weapon,title]of [['katana','katana','KATANA / PASSING CUT'],['yari','steel_yari','YARI / LOW THRUST'],['heavy','nodachi','NODACHI / DOWNWARD CUT']]){
  const frames=await p.evaluate(({weapon,title})=>{const S=simPrepare();try{const a=fieldCombatFixture({weapon}),g=a.pa.groups[0],T=a.ea.groups[0],A=g.spr[0],V=T.spr[0];
   for(const s of g.spr)s.x=-500;A.x=61;A.y=82;A.face=1;A.state='fight';A.fightUntil=100;A.fightAt=BT.t;
   V.x=81;V.y=82;const h={from:g,to:T,kills:BT.per,depth:0},die={k:'die',t:BT.t+FIELD_EXECUTION.lead,s:V,h};doEvent({k:'fieldTell',die});
   if(!A.fieldExecution)throw Error('Review pair is outside actual reach');const start=BT.t,cv=gameCanvas();cv.width=420;cv.height=300;const x=cv.getContext('2d'),frames=[];x.imageSmoothingEnabled=false;
   const back=g.spr.slice(1,4);back.forEach((s,i)=>{s.x=15+i*21;s.y=57;s.state='fight';s.fightAt=start+i*.19;s.fightUntil=100;});
   for(let i=0;i<75;i++){BT.t=start+i/30*BATTLE_PACE;BT.anim=i/30;if(BT.t>=die.t&&V.alive){doEvent({k:'hit',h});doEvent(die);}
    if(V.fate)updSprite(V,BATTLE_PACE/30,T,1);updateDroppedGear(BATTLE_PACE/30);updateFieldExecutions();
    x.setTransform(1,0,0,1,0,0);x.globalAlpha=1;x.fillStyle='#e7d6af';x.fillRect(0,0,420,300);x.fillStyle='#624834';x.font='13px monospace';x.textAlign='center';x.fillText(title,210,18);x.font='10px monospace';x.fillText('LIVE FIELD / EXISTING EQUIPPED POSES',210,32);
    x.save();x.translate(0,38);x.scale(3,3);x.fillStyle='#a6ae78';x.fillRect(0,0,140,88);x.fillStyle='#959c65';x.fillRect(0,82,140,6);
    for(const s of back)drawSoldier(x,s,g,0,1);if(BT.aftermathState?.records.length)artDraw(x,BT.aftermathState.cv,0,0);
    for(const prop of BT.aftermathState?.flying||[])drawDroppedGear(x,prop);
    drawSoldier(x,V,T,1,1);drawSoldier(x,A,g,0,1);x.restore();frames.push(cv.toDataURL('image/png'));
   }cv.width=cv.height=0;return frames;
  }finally{if(BT)closeBattle();simRestore(S);}}, {weapon,title});
  const dir=path.join(frameRoot,id);fs.mkdirSync(dir,{recursive:true});frames.forEach((data,i)=>fs.writeFileSync(path.join(dir,String(i).padStart(3,'0')+'.png'),Buffer.from(data.split(',')[1],'base64')));
 }console.log(frameRoot);
 }finally{await browser.close();server.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
