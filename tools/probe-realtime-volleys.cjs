const fs=require('fs'),path=require('path'),http=require('http'),{chromium}=require('playwright'),install=require('./realtime-volley-fixture.cjs');
const root=path.resolve(__dirname,'..');
(async()=>{const source=process.env.VOLLEY_SOURCE||path.join(root,'index.html'),server=http.createServer((q,r)=>r.end(fs.readFileSync(source)));await new Promise(r=>server.listen(0,'127.0.0.1',r));const b=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']});
 try{const p=await b.newPage({viewport:{width:1100,height:780}});await p.addInitScript(()=>{window.__noIntro=window.__noQuick=true;window.requestAnimationFrame=()=>0;});await p.route('https://**/*',r=>r.abort());await p.goto('http://127.0.0.1:'+server.address().port);await install(p);
  const results={};for(const [name,opts]of Object.entries({ordinary:{heroes:false},officers:{},rifles:{weapon:'rifle'},stationary:{heroes:false,hold:true}}))results[name]=await p.evaluate(o=>volleyMeasure(o),opts);
  const out=process.env.VOLLEY_REPORT||'/tmp/shinobi-volley-probe.json';fs.writeFileSync(out,JSON.stringify(results,null,2));console.log(JSON.stringify(Object.fromEntries(Object.entries(results).map(([k,v])=>{delete v.hist;return [k,v];})),null,2));
 }finally{await b.close();server.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
