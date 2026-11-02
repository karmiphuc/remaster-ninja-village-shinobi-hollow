// Review sheet built from the live game's roster and modular character renderer.
const fs=require('fs'),http=require('http'),path=require('path'),{chromium}=require('playwright');
const root=path.resolve(__dirname,'..'),output=process.env.RECRUIT_PREVIEW||'/workspace/shared/downloads/recruit-rotation/recruit-roster.png';
(async()=>{const server=http.createServer((q,r)=>{r.setHeader('content-type','text/html');r.end(fs.readFileSync(process.argv[2]||path.join(root,'index.html')));});await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({headless:true,executablePath:'/usr/bin/chromium',args:['--no-sandbox']});try{const p=await browser.newPage();await p.addInitScript(()=>{window.__noIntro=window.__noQuick=true;});await p.goto('http://127.0.0.1:'+server.address().port);
 const sheet=await p.evaluate(()=>{const S=simPrepare();try{newGame();G.recruitPool={v:1,seed:73117,turn:0,recent:[]};const roster=roamingRoster().list,cv=gameCanvas();cv.width=1280;cv.height=1122;const x=cv.getContext('2d');x.imageSmoothingEnabled=false;x.fillStyle='#ead9b5';x.fillRect(0,0,cv.width,cv.height);x.textAlign='center';x.fillStyle='#493c31';x.font='bold 24px monospace';x.fillText('SHINOBI HOLLOW / THE WANDERING CAST',640,35);x.font='14px monospace';x.fillText('32 workers / 16 fighters / six work specialties / seeded faces, skills and potential',640,62);
  for(let i=0;i<roster.length;i++){const d=roster[i],col=i%8,row=Math.floor(i/8),ox=col*160+4,oy=82+row*172;
   x.fillStyle=i<32?'#f3e7cf':'#e6dcc8';x.fillRect(ox,oy,152,166);x.strokeStyle='#b59a76';x.strokeRect(ox+.5,oy+.5,152,166);x.fillStyle='#66543f';x.font='11px monospace';x.fillText(d.profession,ox+76,oy+18);
   const eq={weapon:i<32?null:{inf:'katana',arc:'yumi',gun:'tanegashima',cav:'yari'}[d.role],armor:i<32?null:'lamellar',head:null,mount:null},L=vLook({id:d.id,eq}),rig=artLiveVillager(L,'front',[],null),img=rig.img;
   artDraw(x,img,ox+76+img.ox*5,oy+100+img.oy*5,img.width*5,img.height*5);
   x.fillStyle='#3f342d';x.font='bold 10px monospace';x.fillText(d.name,ox+76,oy+130);x.font='10px monospace';x.fillStyle='#806648';x.fillText(SKILLS[d.skill].name+' / '+d.pot,ox+76,oy+146);}
  const url=cv.toDataURL('image/png');cv.width=cv.height=0;return url;
 }finally{simRestore(S);}});fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,Buffer.from(sheet.split(',')[1],'base64'));console.log(output);
 }finally{await browser.close();server.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
