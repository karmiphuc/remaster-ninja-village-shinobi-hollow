// Upright procedural actors on a cached angled ground plane. No game/save ownership.
(()=>{'use strict';
function create(cv,art,model,options={}){
 const ctx=cv.getContext('2d',{alpha:false}),M=[{name:'2.5D',a:.94,b:.14,c:.30,d:.62},{name:'Isometric',a:.78,b:.4,c:-.78,d:.4}],labels=Array.from({length:80},()=>({x:0,y:0,w:0,h:0,f:null})),draws=[],props=[],pointers=new Map(),sample={sx:0,sy:0,depth:0};
 const camera={x:800,y:400,z:1,tx:800,ty:400,tz:1},worldPoint={x:0,y:0},deployBox={left:0,right:0,top:0,bottom:0},drag={f:null,x:0,y:0,offsetX:0,offsetY:0};
 let W=1,H=1,dpr=1,mode=0,terrain=null,x0=0,y0=0,terrainW=0,terrainH=0,bounds=null,labelN=0,dragged=0,pinch=0,follow=false,selected=null,time=0,groups=model.groups,actors=model.models,topSpace=options.top||115,bottomSpace=options.bottom||85,autoFocusAt=-1,cameraTouched=false;
 const ground=options.ground||(()=>0),clamp=(v,a,b)=>Math.max(a,Math.min(b,v)),mix=(a,b,t)=>a+(b-a)*t,rayA={},rayB={},rayStart={},muzzlePoint={},dash=[9,7],noDash=[],names={inf:'Infantry',gun:'Gunners',arc:'Archers',cav:'Cavalry'};
 function hash(x,y=0){let n=Math.imul(x+7919,374761393)^Math.imul(y+104729,668265263);n=Math.imul(n^(n>>>13),1274126177);return ((n^(n>>>16))>>>0)/4294967296;}
 function project(x,y,z=0){const a=M[mode];return [x*a.a+y*a.c,x*a.b+y*a.d-ground(x,y)-z];}
 function into(o,x,y,z=0){const a=M[mode];o.sx=x*a.a+y*a.c;o.sy=x*a.b+y*a.d-ground(x,y)-z;o.depth=x*a.b+y*a.d;}
 function toWorld(x,y,out=worldPoint){const a=M[mode],px=camera.x+(x-W/2)/camera.z,py=camera.y+(y-H/2)/camera.z,det=a.a*a.d-a.c*a.b;let h=0;
  for(let i=0;i<4;i++){out.x=(px*a.d-a.c*(py+h))/det;out.y=(a.a*(py+h)-a.b*px)/det;h=ground(out.x,out.y);}return out;
 }
 function img(c,x,y,w=c?.width,h=c?.height){if(c?.width&&c.height)ctx.drawImage(c.detail||c,x,y,w,h);}
 function terrainBuild(){if(terrain)terrain.width=terrain.height=0;const a=[project(0,0),project(1400,0),project(1400,1020),project(0,1020)];bounds={left:Math.min(...a.map(p=>p[0]))-100,top:-100,right:Math.max(...a.map(p=>p[0]))+100,bottom:Math.max(...a.map(p=>p[1]))+90};x0=bounds.left;y0=bounds.top;
  const scale=options.terrainScale||1;terrainW=Math.ceil(bounds.right-x0);terrainH=Math.ceil(bounds.bottom-y0);
  terrain=options.canvasFactory?options.canvasFactory():document.createElement('canvas');terrain.width=Math.ceil(terrainW*scale);terrain.height=Math.ceil(terrainH*scale);const c=terrain.getContext('2d',{alpha:false});c.fillStyle='#809153';c.fillRect(0,0,terrain.width,terrain.height);c.scale(scale,scale);c.translate(-x0,-y0);
  const palette=['#7b8c50','#7d8e51','#809153','#839455','#859656'];for(let y=-70;y<1110;y+=36)for(let x=-70;x<1490;x+=36){const creek=443+Math.sin(x*.006)*45,road=90+Math.sin(y*.003)*50+y/1020*1100,n=(Math.sin(x*.009)+Math.cos(y*.012)+2)/4;let col=palette[Math.min(4,(n*5)|0)];if(Math.abs(y-creek)<27)col='#a18e5e';if(Math.abs(x-road)<16)col='#a89564';const p=project(x,y),q=project(x+37,y),r=project(x+37,y+37),s=project(x,y+37);c.fillStyle=col;c.beginPath();c.moveTo(...p);c.lineTo(...q);c.lineTo(...r);c.lineTo(...s);c.fill();}
  for(let i=0;i<4200;i++){const p=project(hash(i,22)*1400,hash(i,23)*1020);c.fillStyle=i%3?'#98a463':'#647d44';c.fillRect(Math.floor(p[0]*scale)/scale,Math.floor(p[1]*scale)/scale,(i%4?1:3)/scale,1/scale);}c.setTransform(1,0,0,1,0,0);
 }
 function warmProps(){props.length=0;if(!art.building)return;for(let i=0;i<27;i++){const type=i%7===0?'sakura':'pine',p=art.building(type),x=i<15?30+hash(i,4)*90:230+(i-15)*89,y=i<15?40+i*61:970+hash(i,9)*30;props.push({id:i,x,y,cv:p.cv,ox:p.ox,oy:p.oy,scale:2.5+hash(i,3),prop:true});}
  if(options.castle&&art.prop)for(const [kind,x,y,scale]of [['yagura',1280,100,2],['gate',1220,100,2],['wall',1180,100,2],['wall',1300,100,2]])props.push({id:props.length,x,y,cv:art.prop(kind),scale,prop:true});
 }
 function resize(){const r=cv.getBoundingClientRect();W=Math.max(1,r.width);H=Math.max(1,r.height);dpr=Math.min(devicePixelRatio||1,2,Math.sqrt(2300000/(W*H)));cv.width=Math.round(W*dpr);cv.height=Math.round(H*dpr);ctx.imageSmoothingEnabled=false;overview(true);if(W<700&&!options.framing){const p=project(700,500);camera.x=camera.tx=p[0];camera.y=camera.ty=p[1]-15;camera.z=camera.tz=.68;}}
 function frameArmies(instant=false){let l=Infinity,r=-Infinity,t=Infinity,b=-Infinity;
  for(const f of groups)if(f.g.troops>0||f.officerN){for(let i=0;i<4;i++){into(sample,i&1?f.maxX:f.minX,i&2?f.maxY:f.minY);l=Math.min(l,sample.sx-60);r=Math.max(r,sample.sx+60);t=Math.min(t,sample.sy-78);b=Math.max(b,sample.sy+20);}}
  if(!Number.isFinite(l))return;camera.tz=Math.min(W<700?1.15:1.4,(W-36)/Math.max(120,r-l),(H-topSpace-bottomSpace-24)/Math.max(100,b-t));camera.tz=clamp(camera.tz,.18,2.7);
  camera.tx=(l+r)/2;camera.ty=(t+b)/2+(bottomSpace-topSpace)/(2*camera.tz);if(instant){camera.x=camera.tx;camera.y=camera.ty;camera.z=camera.tz;}
 }
 function overview(instant=false){follow=false;if(options.framing){frameArmies(instant);return;}camera.tx=(bounds.left+bounds.right)/2;camera.ty=(bounds.top+bounds.bottom)/2;camera.tz=Math.min((W-28)/(bounds.right-bounds.left),(H-topSpace-bottomSpace)/(bounds.bottom-bounds.top));if(instant){camera.x=camera.tx;camera.y=camera.ty;camera.z=camera.tz;}}
 function focus(){const f=selected&&(selected.g.troops>0||selected.officerN)?selected:groups.find(f=>f.side===0&&(f.g.troops>0||f.officerN)&&f.type==='inf')||groups.find(f=>f.side===0&&(f.g.troops>0||f.officerN));if(!f)return;const e=groups.find(e=>e.side===1&&e.g.troops>0&&e.type==='inf');const fx=f.g.troops>0?f.x:f.bodyX,fy=f.g.troops>0?f.y:f.bodyY,p=project(selected?fx:e?(e.x+fx)/2:fx,selected?fy:options.framing?(e?(e.bodyY+fy)/2:fy):500);camera.tx=p[0];camera.ty=p[1]-25;camera.tz=W<700?(options.framing?.72:.85):1.1;}
 function key(m){const f=m.f,type=m.kind||f.type,fs=m.style.frames;if(!m.alive){const age=time-m.fateAt;return m.fate==='rout'?(age<.22?'panic':age<.48?'kneel':(((time*8+m.phase)|0)%2?'fleerunA':'fleerunB')):age<.14?'stagger':age<.42?'kneel':'rest';}
  if(model.outcome&&time-model.outcome.at>1.2)return 'cheer';if(m.hurtUntil>time)return 'stagger';if(m.pendingAt>time)return 'wind';const u=time-m.actionAt,shot=time-m.shotAt;
  if((type==='inf'||type==='cav')&&u<.52)return u<.14?'atk':u<.32?'follow':'recover';if(type==='gun'&&shot<.2)return 'atk';if(type==='gun'&&shot<.42)return shot<.3?'follow':'recover';if(type==='arc'&&shot<.6)return shot<.14?'atk':'recover';if((type==='gun'||type==='arc')&&m.aimUntil>time)return 'aim';if(m.moving)return ((time*(m.style.mounted||type==='cav'?9:7)+m.phase)|0)%2?'runA':'runB';if(f.stance==='pikewall')return 'brace';if(type==='gun'&&m.reloadUntil>time)return 'reload';return ((time*1.5+m.phase)|0)%2?'idle2':'idle';
 }
 function actor(m){if(m.fate==='rout'&&time-m.fateAt>7)return;const k=key(m),s=m.style,fs=s.frames,c=fs[k]||fs.idle;if(!c?.width)return;const f=m.f,age=time-m.fateAt,bodyFace=s.faces?.[k]||s.nativeFace||1;ctx.save();ctx.translate(m.sx,m.sy);
  if(m.alive){ctx.fillStyle='rgba(25,29,23,.23)';ctx.beginPath();ctx.ellipse(0,0,s.mounted||f.type==='cav'?15:8,3,0,0,7);ctx.fill();}
  if(!m.alive&&m.fate==='death'&&age>.42){const u=clamp((age-.42)/.42,0,1);ctx.translate(m.face*8*u,0);ctx.rotate(m.face*.16*u);ctx.scale(m.face/bodyFace,1-u*.72);img(c,-c.width/2,-c.height+1);}
  else{if(m.alive&&s.flag){const fl=s.flag,im=fl.right[((time*3+m.phase)|0)%3];ctx.save();ctx.scale(m.face,1);img(im,-8-fl.ax,-15-fl.ay);ctx.restore();}ctx.scale(m.face/bodyFace,1);if(m.alive&&m.moving)ctx.translate(0,-Math.sin(time*10+m.phase)*.7);img(c,-c.width/2,-c.height+1);}
  ctx.restore();if(m.heroActor&&m.alive&&m.hp<m.maxHp-.01){const hp=clamp(m.hp/m.maxHp,0,1);ctx.fillStyle='#211d22';ctx.fillRect(m.sx-8,m.sy+2,16,3);ctx.fillStyle=f.side?'#cf7855':'#93b86a';ctx.fillRect(m.sx-7,m.sy+3,14*hp,1);}
 }
 function drop(m){const age=time-m.fateAt,w=m.style.weapon;if(age<.16||!w)return;const p=project(m.dropX,m.dropY),t=clamp((age-.16)/.7,0,1);ctx.save();ctx.translate(p[0],p[1]-Math.sin(t*Math.PI)*12);ctx.rotate(m.dropAngle+(1-t)*1.4);ctx.scale(.55,.32);img(w,-w.width/2,-w.height/2);ctx.restore();}
 function effects(){for(const e of model.effects)if(e.on){const p=project(e.x,e.y),u=e.t/e.dur,ex=p[0]+e.face*e.muzzleX,ey=p[1]-e.muzzleY;ctx.globalAlpha=1-u;if(e.kind==='smoke'){ctx.globalAlpha*=.48;ctx.fillStyle='#d6d2bb';const r=(6+u*14)*e.size;ctx.fillRect(ex-r+u*13,ey-7-u*19,r*1.7,r);}
   else if(e.kind==='flash'){ctx.fillStyle='#f7dfaa';ctx.fillRect(ex,ey,9*(1-u)*e.face,3);ctx.fillStyle='#fff2c7';ctx.fillRect(ex,ey-1,3*e.face,2);}else if(e.kind==='rapid'||e.kind==='chain'||e.kind==='counter'){ctx.fillStyle=e.kind==='counter'?'#a8d5e5':'#e3c06b';ctx.fillRect(p[0]-5,p[1]-34-u*5,3,2);ctx.fillRect(p[0]+2,p[1]-37-u*5,3,2);}else if(e.kind==='blood'){ctx.fillStyle='#78372e';ctx.fillRect(p[0]+Math.sin(u*7)*5,p[1]-7-u*6,2,2);}else{ctx.strokeStyle=e.kind==='dust'?'#b2a16d':'#eadba8';ctx.beginPath();ctx.moveTo(p[0]-3-u*4,p[1]-12);ctx.lineTo(p[0]+3+u*4,p[1]-8);ctx.stroke();}}
  ctx.globalAlpha=1;for(const p of model.shots)if(p.on){const u=clamp((time-p.start)/p.dur,0,1),v=Math.max(0,u-.025);into(rayA,mix(p.x0,p.x1,u),mix(p.y0,p.y1,u),17+Math.sin(u*Math.PI)*p.height);into(rayB,mix(p.x0,p.x1,v),mix(p.y0,p.y1,v),17+Math.sin(v*Math.PI)*p.height);
   if(p.kind==='gun'){into(rayStart,p.x0,p.y0,17);into(muzzlePoint,p.ox,p.oy);const dx=muzzlePoint.sx+p.face*p.muzzleX-rayStart.sx,dy=muzzlePoint.sy-p.muzzleY-rayStart.sy;rayA.sx+=dx*(1-u);rayA.sy+=dy*(1-u);rayB.sx+=dx*(1-v);rayB.sy+=dy*(1-v);}
   ctx.strokeStyle=p.kind==='gun'?'#f1d8ab':'#d5bf8f';ctx.lineWidth=p.kind==='gun'?1.3:1;ctx.beginPath();ctx.moveTo(rayB.sx,rayB.sy);ctx.lineTo(rayA.sx,rayA.sy);ctx.stroke();}
 }
 function boxPath(b){into(sample,b.left,b.top);ctx.beginPath();ctx.moveTo(sample.sx,sample.sy);into(sample,b.right,b.top);ctx.lineTo(sample.sx,sample.sy);into(sample,b.right,b.bottom);ctx.lineTo(sample.sx,sample.sy);into(sample,b.left,b.bottom);ctx.lineTo(sample.sx,sample.sy);ctx.closePath();}
 function plantedFlag(f,x,y,ghost=false,angle=0){into(sample,x,y);let px=sample.sx,py=sample.sy;ctx.save();ctx.globalAlpha=ghost?.65:1;if(angle){ctx.translate(px,py);ctx.rotate(angle);px=py=0;}
  ctx.fillStyle='#211822';ctx.fillRect(px-2,py-69,4,71);ctx.fillRect(px,py-66,22,37);ctx.fillStyle='#a8743f';ctx.fillRect(px-1,py-70,2,70);ctx.fillStyle='#d6b76b';ctx.fillRect(px-2,py-72,4,3);
  ctx.fillStyle=f.reserve?'#a87f36':art.teamColor?.(f.side)||(f.side?'#a44232':'#3b4a7a');ctx.fillRect(px+2,py-64,18,31);ctx.fillStyle='#e9d8a8';ctx.fillRect(px+3,py-37,16,2);
  const mon=art.emblem?.(f.side);if(mon?.width)img(mon,px+5,py-61,12,12);else{ctx.fillStyle='#f0dfb3';ctx.fillRect(px+8,py-59,5,9);}
  ctx.fillStyle='#4a321e';ctx.fillRect(px-7,py,14,2);ctx.restore();
 }
 function standards(){if(!options.standards)return;for(const f of groups)if(f.standard){let up=false;for(const p of groups)if(p.side===f.side&&p.type===f.type&&(p.g.troops>0||p.officerN)){up=true;break;}if(up)f.standardFall=-1;else if(f.standardFall<0)f.standardFall=time;
   plantedFlag(f,f.homeX+f.face*23,f.homeY-(f.baseRows-1)*f.stride/2-10,false,up?0:f.face*1.48*clamp((time-f.standardFall)/.65,0,1));
  }}
 function deployment(){const d=options.deployment;if(!d?.active)return;ctx.save();deployBox.left=45;deployBox.right=640;deployBox.top=70;deployBox.bottom=950;
  boxPath(deployBox);ctx.fillStyle='#b8d8e413';ctx.fill();ctx.lineWidth=2/camera.z;ctx.setLineDash(dash);ctx.strokeStyle='#e7d9ad';into(sample,640,70);ctx.beginPath();ctx.moveTo(sample.sx,sample.sy);into(sample,640,950);ctx.lineTo(sample.sx,sample.sy);ctx.stroke();ctx.setLineDash(noDash);
  if(selected?.side===0){model.deploymentBounds(selected.id,selected.x,selected.y,deployBox);boxPath(deployBox);ctx.fillStyle='#e3c87618';ctx.fill();ctx.strokeStyle='#e9d38a';ctx.stroke();}
  if(d.ghost?.show&&selected){model.deploymentBounds(selected.id,d.ghost.x,d.ghost.y,deployBox);boxPath(deployBox);ctx.fillStyle=d.ghost.valid?'#a9d89924':'#c65f4b2e';ctx.fill();ctx.strokeStyle=d.ghost.valid?'#bfdc99':'#ef9a78';ctx.stroke();plantedFlag(selected,d.ghost.x,d.ghost.y,true);}
  ctx.restore();
 }
 function badges(){ctx.setTransform(dpr,0,0,dpr,0,0);ctx.font='10px monospace';ctx.textAlign='center';labelN=0;for(const f of groups){if(labelN>=labels.length)break;if(f.g.troops<=0&&!f.officerN)continue;into(sample,(f.g.troops>0?f.x:f.bodyX)-f.face*(f.cols*f.depthStep+10),(f.g.troops>0?f.y:f.bodyY)-(f.rows-1)*f.stride/2-22);let x=(sample.sx-camera.x)*camera.z+W/2,y=(sample.sy-camera.y)*camera.z+H/2;if(x<12||x>W-12||y<topSpace||y>H-bottomSpace)continue;
   const text=(f.g.heroOnly?f.g.solo?.name||names[f.type]:names[f.type])+' · '+(f.g.heroOnly?1:f.g.troops>0?Math.ceil(f.g.troops):f.officerN+' officers')+(f.reserve?' · Reserve':f.order==='fallback'?' · Falling back':''),w=Math.max(72,ctx.measureText(text).width+14);x=clamp(x,w/2+9,W-w/2-9);
   for(let n=0;n<5;n++){let overlap=false;for(let i=0;i<labelN;i++){const b=labels[i];if(x+w/2+3>b.x&&x-w/2-3<b.x+b.w&&y+9>b.y&&y-15<b.y+b.h){overlap=true;break;}}if(!overlap)break;y-=26;}if(y<topSpace)continue;
   const active=selected===f||selected?.priorityTarget===f.id;ctx.fillStyle=active?'#b49b63':f.side?'#60382ce8':'#2b414de8';ctx.strokeStyle=active?'#f5da9e':f.side?'#ad7a59':'#8aa2ad';ctx.fillRect(x-w/2,y-14,w,23);ctx.strokeRect(x-w/2,y-14,w,23);ctx.fillStyle=active?'#231d18':'#e5dbc0';ctx.fillText(text,x,y+1);const b=labels[labelN++];if(!b)break;b.x=x-w/2;b.y=y-16;b.w=w;b.h=28;b.f=f;
  }}
 function render(){time=model.time;if(autoFocusAt>=0&&time>=autoFocusAt){autoFocusAt=-1;if(!cameraTouched)follow=true;}if(follow)focus();camera.x=mix(camera.x,camera.tx,.15);camera.y=mix(camera.y,camera.ty,.15);camera.z=mix(camera.z,camera.tz,.15);const shake=clamp(options.shake?.()||0,0,1),sx=Math.sin(time*103+model.sim.A.length)*shake*3,sy=Math.cos(time*127)*shake*1.8;
  ctx.setTransform(dpr,0,0,dpr,0,0);ctx.fillStyle='#809153';ctx.fillRect(0,0,W,H);ctx.setTransform(dpr*camera.z,0,0,dpr*camera.z,dpr*(W/2-camera.x*camera.z+sx),dpr*(H/2-camera.y*camera.z+sy));ctx.imageSmoothingEnabled=false;ctx.drawImage(terrain,x0,y0,terrainW,terrainH);deployment();standards();
  draws.length=0;for(const p of props){into(p,p.x,p.y);draws.push(p);}const extra=options.extras?options.extras():null;
  for(let pass=0;pass<(extra?2:1);pass++){const list=pass?extra:actors;for(const m of list){if(m.hidden)continue;into(m,m.x,m.y);if(Math.abs(m.sx-camera.x)>W/(camera.z*2)+100||Math.abs(m.sy-camera.y)>H/(camera.z*2)+100)continue;if(!m.alive){if(m.fate==='death'){ctx.fillStyle='#682d2199';ctx.beginPath();ctx.ellipse(m.sx+4,m.sy,9+Math.min(time-m.fateAt,1)*5,3,0,0,7);ctx.fill();}drop(m);}if(m.fate==='death'&&time-m.fateAt>.9)actor(m);else draws.push(m);}}
  draws.sort(depthSort);for(const a of draws){if(a.prop){ctx.save();ctx.translate(a.sx,a.sy);ctx.scale(a.scale,a.scale);img(a.cv,a.ox!=null?a.ox-a.cv.width/2+16:-a.cv.width/2,a.oy??-a.cv.height+1);ctx.restore();}else actor(a);}
  for(const f of groups)if(f.bannerFall>=0&&f.members.length){into(sample,f.x,f.y);const fl=f.members[0].style.flag;if(fl){ctx.save();ctx.translate(sample.sx,sample.sy);ctx.rotate(f.face*1.48*clamp((time-f.bannerFall)/.6,0,1));img(fl.right[0],-fl.ax,-fl.ay);ctx.restore();}}
  effects();badges();
 }
 function depthSort(a,b){return a.depth-b.depth||a.id-b.id;}
 function zoom(x,y,z){const px=camera.x+(x-W/2)/camera.z,py=camera.y+(y-H/2)/camera.z;follow=false;cameraTouched=true;camera.z=camera.tz=clamp(z,.18,2.7);camera.x=camera.tx=px-(x-W/2)/camera.z;camera.y=camera.ty=py-(y-H/2)/camera.z;}
 function local(e){const r=cv.getBoundingClientRect();return {x:e.clientX-r.left,y:e.clientY-r.top};}
 function hitLabel(p){for(let i=0;i<labelN;i++){const b=labels[i];if(p.x>=b.x&&p.x<=b.x+b.w&&p.y>=b.y&&p.y<=b.y+b.h)return b.f;}return null;}
 function hitFormation(p){const label=hitLabel(p);if(label)return label;
  for(const f of groups)if(f.side===0&&f.standard){into(sample,f.homeX+f.face*23,f.homeY-(f.baseRows-1)*f.stride/2-10);const x=(sample.sx-camera.x)*camera.z+W/2,y=(sample.sy-camera.y)*camera.z+H/2;
   if(p.x>=x-12&&p.x<=x+Math.max(18,24*camera.z)&&p.y>=y-74*camera.z-6&&p.y<=y+8)return f;
  }
  const w=toWorld(p.x,p.y);for(const f of groups)if(f.side===0){model.deploymentBounds(f.id,f.x,f.y,deployBox);if(w.x>=deployBox.left&&w.x<=deployBox.right&&w.y>=deployBox.top&&w.y<=deployBox.bottom)return f;}return null;
 }
 function clearGhost(){drag.f=null;if(options.deployment?.ghost)options.deployment.ghost.show=false;}
 function down(e){if(options.enabled&&!options.enabled())return;const p=local(e);cv.setPointerCapture(e.pointerId);pointers.set(e.pointerId,p);
  if(pointers.size===1){dragged=0;if(options.deployment?.active){const f=hitFormation(p),armed=options.deployment.tapArmed;if(f?.side===0&&(!armed||selected?.type===f.type)){const w=toWorld(p.x,p.y);drag.f=f;drag.offsetX=f.x-w.x;drag.offsetY=f.y-w.y;drag.x=f.x;drag.y=f.y;if(!armed&&options.select)options.select(f);}}}
  else{dragged=100;clearGhost();}
 }
 function move(e){const old=pointers.get(e.pointerId);if(!old)return;const p=local(e),dx=p.x-old.x,dy=p.y-old.y;old.x=p.x;old.y=p.y;dragged+=Math.abs(dx)+Math.abs(dy);follow=false;
  if(pointers.size===2){const a=[...pointers.values()],d=Math.hypot(a[0].x-a[1].x,a[0].y-a[1].y);if(pinch)zoom((a[0].x+a[1].x)/2,(a[0].y+a[1].y)/2,camera.z*d/pinch);pinch=d;}
  else if(drag.f&&options.deployment?.active){const w=toWorld(p.x,p.y);drag.x=w.x+drag.offsetX;drag.y=w.y+drag.offsetY;if(options.preview)options.preview(drag.f,drag.x,drag.y);}
  else{cameraTouched=true;camera.x=camera.tx-=dx/camera.z;camera.y=camera.ty-=dy/camera.z;}
 }
 function up(e){if(!pointers.has(e.pointerId))return;const tap=pointers.size===1&&dragged<7,p=local(e),f=drag.f;pointers.delete(e.pointerId);pinch=0;
  if(options.deployment?.active){if(f&&!tap&&options.place)options.place(f,drag.x,drag.y);else if(tap){const picked=options.deployment.tapArmed?null:hitFormation(p);if(picked){if(options.select)options.select(picked);}else if(selected?.side===0&&options.place){const w=toWorld(p.x,p.y);options.place(selected,w.x,w.y);}}clearGhost();return;}
  if(tap){const picked=hitLabel(p);if(picked&&options.select)options.select(picked);}
 }
 function cancel(e){pointers.delete(e.pointerId);pinch=0;dragged=100;clearGhost();}
 function wheel(e){if(options.enabled&&!options.enabled())return;e.preventDefault();const p=local(e);zoom(p.x,p.y,camera.z*Math.exp(-e.deltaY*.0015));}
 cv.addEventListener('pointerdown',down);cv.addEventListener('pointermove',move);cv.addEventListener('pointerup',up);cv.addEventListener('pointercancel',cancel);cv.addEventListener('wheel',wheel,{passive:false});
 terrainBuild();warmProps();resize();
 return {render,resize,resizeIfNeeded:()=>{const r=cv.getBoundingClientRect();if(Math.abs(r.width-W)>.5||Math.abs(r.height-H)>.5)resize();},overview,camera,project,toWorld,
  insets:(top,bottom)=>{topSpace=top;bottomSpace=bottom;},screen:(x,y)=>{into(sample,x,y);return {x:(sample.sx-camera.x)*camera.z+W/2,y:(sample.sy-camera.y)*camera.z+H/2};},
  beginBattle:()=>{autoFocusAt=model.time+2.8;cameraTouched=false;},cancelAutoFocus:()=>{cameraTouched=true;},
  select:f=>{selected=f;},follow:()=>{cameraTouched=true;follow=!follow;return follow;},angle:()=>{cameraTouched=true;mode=(mode+1)%M.length;terrainBuild();overview(true);return M[mode].name;},
  destroy:()=>{terrain.width=terrain.height=0;cv.removeEventListener('pointerdown',down);cv.removeEventListener('pointermove',move);cv.removeEventListener('pointerup',up);cv.removeEventListener('pointercancel',cancel);cv.removeEventListener('wheel',wheel);pointers.clear();props.length=draws.length=0;}};
}
window.GrandFieldView={create};
})();
