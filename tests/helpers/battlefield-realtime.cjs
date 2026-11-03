// Runs inside the browser, against the actual continuous model and procedural game adapter.
module.exports=function mechanics(){
 const out={},failures=[];let checks=0;
 const ok=(v,m)=>{checks++;if(!v)failures.push(m);},near=(a,b,m)=>ok(Math.abs(a-b)<1e-7,m+': '+a+' / '+b);
 const wait=(c,seconds,step=1/60)=>{for(let t=0;t<seconds-1e-8;t+=step)c.advance(step);return c.snapshot();};
 const make=o=>GrandCombat.create(GrandArt,7711,o),allHold={0:'hold',1:'hold',2:'hold',3:'hold',4:'hold',5:'hold',6:'hold',7:'hold'};
 const fixture=(counts,positions,mrk)=>make({troops:counts,positions,orders:allHold,mrk});
 const move=(c,id,x,y)=>{const f=c.groups[id],dx=x-f.x,dy=y-f.y;f.x=f.homeX=x;f.y=f.homeY=y;for(const m of f.members){m.x+=dx;m.y+=dy;m.vx=m.vy=0;}};
 const audit=(c,name)=>{const s=c.snapshot();near(s.residual,0,name+' ledger');near(s.hp,s.totals[0]+s.totals[1],name+' actor HP');ok(c.models.every(m=>m.hp>=0&&Number.isFinite(m.x)&&Number.isFinite(m.y)),name+' negative/invalid actor');ok(s.groups.every(f=>f.troops>=0&&f.landed+f.missed<=f.fired),name+' projectile accounting');};
 // Full opaque friendly screen: hold fire, then resume after it moves away.
 let c=fixture([[1,1,0,0],[1,0,0,0]],{0:[450,500],1:[300,500],4:[650,500]});
 let s=wait(c,7);ok(s.groups[1].fired===0&&s.groups[1].blocked>0,'Gun fired through a friendly blocker');near(s.applied,0,'Blocked gun applied damage');
 move(c,0,450,560);s=wait(c,12);ok(s.groups[1].fired>0&&s.groups[1].landed>0,'Gun did not resume after lane cleared');near(c.groups[0].members[0].hp,1,'Friendly soldier took damage');audit(c,'cleared lane');
 out.firingLane={blockedAttempts:s.groups[1].blocked,shotsAfterClearing:s.groups[1].fired,hits:s.groups[1].landed};
 // Range is a prerequisite; bows can also be out of range rather than firing globally.
 for(const type of ['gun','arc']){const k=type==='gun'?1:2,counts=[[0,0,0,0],[1,0,0,0]];counts[0][k]=1;c=fixture(counts,{[k]:[80,500],4:[1250,500]});s=wait(c,8);ok(s.groups[k].fired===0&&s.applied===0,type+' fired beyond range');audit(c,type+' range');}
 // MRK changes actual release intervals, with stationary targets and no incoming damage.
 const marks=[];for(const mark of [0,80]){c=fixture([[0,120,0,0],[20000,0,0,0]],{1:[300,500],4:[690,500]},{1:mark});s=wait(c,30);marks.push({mrk:mark,cadence:s.groups[1].cadence,shots:s.groups[1].fired,hits:s.groups[1].landed});audit(c,'MRK '+mark);}
 ok(marks[1].shots>marks[0].shots*1.2&&marks[1].cadence<marks[0].cadence,'Higher MRK did not increase actual rate of fire');out.mrk=marks;
 // Overhead arrows pass friendly ranks, scatter into actual hits and misses, and never remove friendly HP.
 c=fixture([[1,0,30,0],[3000,0,0,0]],{0:[450,500],2:[300,500],4:[690,500]});s=wait(c,25);
 ok(s.groups[2].fired>0&&s.groups[2].landed>0&&s.groups[2].missed>0,'Overhead arrows did not resolve both hits and misses');near(c.groups[0].members[0].hp,1,'Overhead arrow hit friendly screen');
 out.arrows={fired:s.groups[2].fired,hits:s.groups[2].landed,misses:s.groups[2].missed,active:s.projectiles};near(out.arrows.fired,out.arrows.hits+out.arrows.misses+out.arrows.active,'Arrow count not conserved');audit(c,'arrow scatter');
 // Move a target after release: an arrow keeps its sampled endpoint; no damage is scheduled merely for firing.
 c=fixture([[0,0,1,0],[1,0,0,0]],{2:[300,500],4:[620,500]});let p=null;for(let i=0;i<360&&!p;i++){c.advance(1/60);p=c.shots.find(p=>p.on);}
 ok(!!p,'No arrow released for moving-target check');if(p){const x=p.x1,y=p.y1;c.groups[2].members[0].nextFire=Infinity;move(c,4,1050,500);s=wait(c,2);near(c.groups[4].members[0].hp,1,'Missed moving target took arrow damage');near(p.x1,x,'Arrow homed in X');near(p.y1,y,'Arrow homed in Y');ok(s.groups[2].missed===1,'Missed arrow not accounted');}audit(c,'moving arrow target');
 // A friendly can enter the ray after release. Stop the bullet without friendly HP damage.
 c=fixture([[1,1,0,0],[1,0,0,0]],{0:[490,560],1:[300,500],4:[700,500]});p=null;for(let i=0;i<360&&!p;i++){c.advance(1/60);p=c.shots.find(p=>p.on);}
 ok(!!p,'No bullet released for crossing check');if(p){c.groups[1].members[0].nextFire=Infinity;move(c,0,490,500);s=wait(c,1);near(c.groups[0].members[0].hp,1,'Crossing ally was shot');near(c.groups[4].members[0].hp,1,'Bullet damaged target beyond crossing ally');ok(s.groups[1].intercepted===1&&s.groups[1].missed===1,'Crossing interception not recorded');}audit(c,'crossing ally');
 // Projectile power belongs to release time, including when its shooter is later wounded or buffed.
 const shotDamage=[];for(const buff of [1,1000]){c=fixture([[0,6000,0,0],[200000,0,0,0]],{1:[300,500],4:[700,500]});p=null;for(let i=0;i<360&&!p;i++){c.advance(1/60);p=c.shots.find(p=>p.on);}ok(!!p,'No projectile for release-power check');if(p){for(const m of c.groups[1].members)m.nextFire=Infinity;c.groups[1].g.atkMul*=buff;s=wait(c,1);shotDamage.push(s.applied);audit(c,'release power '+buff);}}
 ok(shotDamage[0]>0,'Release-power projectile did not land');near(shotDamage[0],shotDamage[1],'In-flight projectile changed power after release');out.releaseDamage=shotDamage[0];
 // Soldiers do not swing at distant enemies; advancing brings real contact and paid-for HP damage.
 c=fixture([[100,0,0,0],[100,0,0,0]],{0:[450,500],4:[800,500]});s=wait(c,5);ok(s.applied===0&&s.groups[0].strikes===0&&s.groups[4].strikes===0,'Infantry fought the air');const x=s.groups[0].x;c.order(0,'advance');s=wait(c,16);ok(s.groups[0].x>x+50&&s.groups[0].strikes>0&&s.applied>0,'Advancing infantry did not enter local combat');audit(c,'infantry contact');
 // Hold is a positional order, not a ban on defending against nearby attackers.
 c=fixture([[40,0,0,0],[40,0,0,0]],{0:[650,500],4:[688,500]});s=wait(c,3);ok(s.groups[0].strikes>0&&s.groups[4].strikes>0,'Held nearby infantry did not fight');near(s.groups[0].x,650,'Held formation centre moved');audit(c,'held defence');
 // Observe distinct charge / withdrawal / regroup transitions and a second cycle.
 c=make({troops:[[8000,0,0,400],[8000,0,0,400]]});let withdrawing=null,regrouped=false;
 for(let i=0;i<1800;i++){c.advance(1/60);if(c.groups[3].state==='withdraw'&&!withdrawing){withdrawing={strikes:c.groups[3].strikes,time:c.time};const d=wait(c,.3);ok(d.groups[3].state==='withdraw'&&d.groups[3].strikes===withdrawing.strikes,'Cavalry attacked while withdrawing');}if(c.groups[3].regroups)regrouped=true;}
 s=c.snapshot();ok(s.groups[3].firstChargeTarget==='inf'&&s.groups[7].firstChargeTarget==='inf','Cavalry bypassed closest infantry');ok(s.groups[3].charges>=2&&s.groups[3].withdrawals>=1&&regrouped,'Cavalry failed to repeat charge/regroup cycle');ok(s.groups[3].strikes<=18*s.groups[3].charges,'Cavalry applied repeated impacts in one charge');audit(c,'cavalry cycles');
 out.cavalry=s.groups.filter(g=>g.type==='cav').map(g=>({side:g.side,charges:g.charges,withdrawals:g.withdrawals,regroups:g.regroups,firstTarget:g.firstChargeTarget,strikes:g.strikes}));
 // Both arms are active together; no shared gun/arrow/melee phase remains.
 c=make({});s=wait(c,12);ok(s.groups[1].fired>0&&s.groups[2].fired>0&&s.groups[0].strikes>0,'Combat is still gated by formation phases');out.concurrent={gun:s.groups[1].fired,arrows:s.groups[2].fired,melee:s.groups[0].strikes};audit(c,'concurrent battle');
 // Seeded full battles: bounded state, HP conservation and actual elimination, with different victims/misses.
 out.seeds=[];for(const seed of [11,79,7711,9441,18937]){c=GrandCombat.create(GrandArt,seed);s=wait(c,200);ok(!!s.winner&&s.totals.includes(0),'Default real-time battle stalled for seed '+seed);audit(c,'seed '+seed);out.seeds.push({seed,totals:s.totals,fallen:s.fallen,routed:s.routed});}
 out.checks=checks;out.failures=failures;return out;
};
