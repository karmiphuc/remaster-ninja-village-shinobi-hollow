// Physical bullet journeys, adaptive cavalry and closing depleted ranks in the real continuous model.
module.exports=function flow(){const failures=[],out={};let checks=0;
 const ok=(v,m)=>{checks++;if(!v)failures.push(m);},near=(a,b,m)=>ok(Math.abs(a-b)<1e-7,m+': '+a+' / '+b),hold={0:'hold',1:'hold',2:'hold',3:'hold',4:'hold',5:'hold',6:'hold',7:'hold'};
 const make=(troops,positions,extra={})=>GrandCombat.create(GrandArt,181,{troops,positions,orders:hold,...extra});
 const wait=(c,t,step=1/60)=>{for(let n=0;n<t-1e-8;n+=step)c.advance(step);return c.snapshot();};
 const move=(c,id,x,y)=>{const f=c.groups[id],dx=x-f.x,dy=y-f.y;f.x=f.homeX=x;f.y=f.homeY=y;for(const m of f.members){m.x+=dx;m.y+=dy;m.vx=m.vy=0;}};
 const audit=(c,name)=>{const s=c.snapshot();near(s.residual,0,name+' conservation');near(s.hp,s.totals[0]+s.totals[1],name+' physical HP');ok(c.models.every(m=>m.hp>=0&&Number.isFinite(m.x)&&Number.isFinite(m.y)),name+' invalid actor');};
 const shot=c=>{let p;for(let i=0;i<360&&!p;i++){c.advance(1/60);p=c.shots.find(p=>p.on);}ok(!!p,'Gun never released');for(const m of c.models)if(m.f.type==='gun'||m.f.type==='arc')m.nextFire=Infinity;return p;};
 // A released bullet never homes. Evading the ray avoids damage, and a different enemy can catch the stray.
 for(const stray of [false,true]){const c=make([[1,1000,0,0],[1,0,stray?1:0,0]],{0:[460,560],1:[300,500],4:[620,500],6:[820,500]},{count:g=>g.troops?1:0});
  for(const m of c.groups[6].members)m.nextFire=Infinity;const p=shot(c);if(!p)continue;const x=p.x1,y=p.y1;move(c,4,620,650);move(c,0,460,500);
  if(stray)move(c,6,820,p.y0+(p.y1-p.y0)*(820-p.x0)/(p.x1-p.x0));
  const s=wait(c,1);near(c.groups[4].members[0].hp,1,'Evading enemy took scheduled damage');near(c.groups[0].members[0].hp,1,'Crossing ally took damage');near(p.x1,x,'Bullet endpoint moved X');near(p.y1,y,'Bullet endpoint moved Y');
  ok(stray?s.groups[1].landed===1&&c.groups[6].g.troops===0:s.groups[1].landed===0&&s.groups[1].missed===1,stray?'Stray did not kill the enemy on its ray':'Evaded bullet did not miss');audit(c,'bullet '+stray);
  out[stray?'stray':'evade']={fired:s.groups[1].fired,landed:s.groups[1].landed,missed:s.groups[1].missed,enemyHP:c.groups[4].g.troops,allyHP:c.groups[0].g.troops};
 }
 // Ranged units in the distance are attractive flanks once the foot lines are engaged.
 let hitRanged=0,c=make([[20000,0,0,5000],[20000,0,5000,0]],{0:[650,500],3:[340,500],4:[688,500],6:[900,500]},
  {count:g=>g.troops?8:0,afterHit:(a,b,n)=>{if(a.f.id===3&&b.f.id===6)hitRanged+=n;}});c.order(3,'cycle');let s=wait(c,3.2);
 ok(s.groups[3].target===6&&s.groups[3].intent==='flank','Cavalry did not select an exposed ranged flank');ok(c.groups[3].flankY<c.groups[0].minY||c.groups[3].flankY>c.groups[0].maxY,'Flank route crosses the friendly foot line');
 s=wait(c,23);ok(hitRanged>0,'Flanking cavalry never actually hit the ranged formation');ok(s.groups[3].impacts>0&&s.groups[3].withdrawals>0,'Flank did not complete a real charge/withdraw cycle');audit(c,'ranged flank');out.flank={damage:hitRanged,charges:s.groups[3].charges,impacts:s.groups[3].impacts};
 // Enemy riders fighting our infantry take priority over a distant enemy foot formation.
 let relieved=0;c=make([[20000,0,0,5000],[20000,0,0,5000]],{0:[650,500],3:[340,500],4:[1100,500],7:[685,500]},
  {count:g=>g.troops?8:0,afterHit:(a,b,n)=>{if(a.f.id===3&&b.f.id===7)relieved+=n;}});c.order(3,'cycle');s=wait(c,3.2);
 ok(s.groups[3].target===7&&s.groups[3].intent==='relieve','Cavalry ignored enemy riders engaging friendly infantry');s=wait(c,23);ok(relieved>0,'Relief charge never hit enemy cavalry');audit(c,'cavalry relief');out.relief={damage:relieved,charges:s.groups[3].charges,impacts:s.groups[3].impacts};
 // Explicit backline orders remain authoritative; reselecting a target cannot skip regroup.
 c=make([[20000,0,0,5000],[20000,0,5000,5000]],{0:[650,500],3:[340,500],4:[1100,500],6:[900,500],7:[685,500]},{count:g=>g.troops?8:0});c.order(3,'cycle');const at=c.groups[3].stateAt;c.target(3,6);near(c.groups[3].stateAt,at,'Order skipped regroup');s=wait(c,4);ok(s.groups[3].target===6&&s.groups[3].intent==='ordered','Auto relief replaced the player target');audit(c,'explicit target');
 // A timeout may abort an unreachable charge; it must not show an impact without contact.
 c=make([[0,0,0,1000],[20000,0,0,0]],{3:[100,500],4:[1150,500]},{count:g=>g.troops?1:0});const f=c.groups[3];f.order='cycle';f.state='charge';f.target=c.groups[4];f.speed=0;let fake=false;
 for(let n=0;n<280;n++){c.advance(1/60);if(f.state==='impact')fake=true;}ok(!fake&&f.impacts===0,'Charge timer fabricated an impact');ok(f.withdrawals===1,'Unreachable charge did not safely abort');audit(c,'unreachable charge');
 // With only mounted units left, direct interceptions must actually clash and end through HP loss.
 out.mounted=[];for(const seed of [11,79,181]){c=GrandCombat.create(GrandArt,seed,{troops:[[0,0,0,100],[0,0,0,100]],count:g=>g.troops?8:0});s=wait(c,300);ok(!!s.winner&&s.groups[3].impacts+s.groups[7].impacts>0,'Mounted-only armies circled forever: '+seed);audit(c,'mounted '+seed);out.mounted.push({seed,winner:s.winner,time:s.time,damage:s.applied});}
 // Close vanished files: opposite isolated survivors walk back into contact without teleporting.
 c=make([[2000,0,0,0],[2000,0,0,0]],{0:[650,500],4:[800,500]},{count:g=>g.troops?20:0,externallyDead:m=>m.f.side?m.row!==0:m.row!==19});const a=c.groups[0].members.at(-1),b=c.groups[4].members[0],ax=a.x,ay=a.y,bx=b.x,by=b.y;
 for(const g of [c.groups[0],c.groups[4]])g.g.troops=(g.side?b:a).hp;c.reconcile();
 near(a.x,ax,'Repack teleported X');near(a.y,ay,'Repack teleported Y');near(b.x,bx,'Repack teleported enemy X');near(b.y,by,'Repack teleported enemy Y');ok(c.groups[0].rows===1&&a.row===0&&b.row===0,'Depleted infantry left empty files');c.order(0,'advance');c.order(4,'advance');s=wait(c,30);ok(s.applied>0,'Last foot soldiers could not close and fight');audit(c,'last foot soldiers');
 // New routing remains fixed-step and camera-independent at 30 and 60 Hz.
 const runs=[];for(const step of [1/60,1/30]){c=GrandCombat.create(GrandArt,181);runs.push(wait(c,50,step));audit(c,'step '+step);}ok(JSON.stringify(runs[0].groups)===JSON.stringify(runs[1].groups),'New movement differs at 30 / 60 Hz');
 out.checks=checks;out.failures=failures;return out;
};
