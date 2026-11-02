// Actual battle-only dress and real procedural horse/armor rigs; no runtime image dependency.
const fs=require('fs'),http=require('http'),path=require('path'),{chromium}=require('playwright'),install=require('./command-heraldry-fixture.cjs');
const root=path.resolve(__dirname,'..'),output=process.env.ALLIED_PREVIEW||'/workspace/shared/downloads/allied-commanders/allied-commanders.png';
(async()=>{const server=http.createServer((q,r)=>{r.setHeader('content-type','text/html');r.end(fs.readFileSync(process.argv[2]||path.join(root,'index.html')));});await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({headless:true,executablePath:'/usr/bin/chromium',args:['--no-sandbox']});try{const p=await browser.newPage();await p.addInitScript(()=>{window.__noIntro=window.__noQuick=true;});await p.goto('http://127.0.0.1:'+server.address().port);await install(p);
 const png=await p.evaluate(()=>{const S=simPrepare();try{commandArtFixture();const A=BT.A[0],ig=A.groups[0],cg=A.groups.find(g=>g.type==='cav'),base=cg.cmds[0],policy=sashimonoPolicy(A,BT.prov),samples=[[ig.heroes[0],ig,'LEADERSHIP','Lord fan and clan pennon']];
  for(const [post,leader,title,caption] of [['van',false,'CAVALRY / VANGUARD','Blood-red balloon horo'],['line',false,'CAVALRY / LINE','Indigo balloon horo'],['line',true,'CAVALRY / LEADERSHIP','Lord standard + indigo horo']]){
   const c={...base,post,...(leader?{skill:'strategy',slv:3}:{})},s=mkSprite(cg,0,45,80,commanderBattleLook(c,cg,0));s.hero=c;s.sashimono=officerSashimono(A,cg,c,policy);samples.push([s,cg,title,caption]);}
  const cv=gameCanvas();cv.width=1120;cv.height=360;const x=cv.getContext('2d');x.imageSmoothingEnabled=false;x.fillStyle='#e8d7b3';x.fillRect(0,0,1120,360);x.fillStyle='#4d3d31';x.textAlign='center';x.font='bold 20px monospace';x.fillText('KAGE CLAN / LEADERSHIP AND CAVALRY',560,28);x.font='12px monospace';x.fillText('Battle dress follows the hero’s command rating and post',560,50);
  for(let i=0;i<samples.length;i++){const [s,g,title,caption]=samples[i],ox=i*280;x.fillStyle='#a6ae78';x.fillRect(ox+6,65,268,240);x.fillStyle='#939b66';x.fillRect(ox+6,290,268,15);s.x=51;s.y=82;s.face=1;s.ph=0;s.glow=0;
   x.save();x.translate(ox,70);x.scale(2.7,2.7);drawSoldier(x,s,g,0,1);x.restore();x.fillStyle='#4d3d31';x.font='bold 12px monospace';x.fillText(title,ox+140,326);x.font='11px monospace';x.fillText(caption,ox+140,346);}
  const url=cv.toDataURL('image/png');cv.width=cv.height=0;return url;
 }finally{if(BT)closeBattle();simRestore(S);}});fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,Buffer.from(png.split(',')[1],'base64'));console.log(output);
 }finally{await browser.close();server.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
