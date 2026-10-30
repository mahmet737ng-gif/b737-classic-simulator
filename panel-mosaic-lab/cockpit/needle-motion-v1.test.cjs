'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {step,create}=require('./needle-motion-v1');

function clock(){
 let now=0,seq=0;
 const queue=new Map();
 const requestFrame=cb=>{const id=++seq;queue.set(id,cb);return id;};
 const cancelFrame=id=>queue.delete(id);
 function tick(ms=1000/60){
  now+=ms;const active=[...queue.values()];queue.clear();
  for(const cb of active)cb(now);
 }
 return {requestFrame,cancelFrame,tick,get pending(){return queue.size;}};
}
test('Damped analytical integrator never introduces a discontinuity at zero time',()=>{
 assert.deepEqual(step(-74,0,74,0,6.8),{angle:-74,velocity:0});
 let p={angle:-74,velocity:0};
 for(let i=0;i<240;i++){
  const next=step(p.angle,p.velocity,74,1/60,6.8);
  assert.ok(next.angle>=p.angle-1e-9,'A constant rising signal cannot jump back');
  assert.ok(next.angle<=74+1e-9,'No overshoot at constant target');
  p=next;
 }
 assert.ok(Math.abs(p.angle-74)<0.001);
 assert.throws(()=>step(0,0,100,-1));
 assert.throws(()=>step(0,0,NaN,0.016));
});

test('APU amps continuously retargets mid-travel, stops on correct zero and idles with zero RAF work',()=>{
 const t=clock(),frames=[];
 const a=create(-74,{omega:6.8,min:-74,max:74,
  requestFrame:t.requestFrame,cancelFrame:t.cancelFrame});
 a.bind(x=>frames.push(x));
 assert.equal(a.snapshot().angle,-74);
 assert.equal(t.pending,0,'Cold/dark has no perpetual animation loop');
 a.setTarget(74);
 assert.equal(a.snapshot().angle,-74,'Setting target does not teleport pointer');
 assert.equal(t.pending,1,'Exactly one scheduled frame even on repeat changes');
 a.setTarget(74);assert.equal(t.pending,1);
 for(let i=0;i<24;i++)t.tick();
 const before=a.snapshot(),lastRendered=frames.at(-1);
 assert.ok(before.angle>-74&&before.angle<74);
 assert.ok(before.velocity>0);
 a.setTarget(-74);
 assert.equal(a.snapshot().angle,lastRendered,'Retarget must keep exact prior visible angle');
 assert.equal(t.pending,1);
 t.tick();
 const after=a.snapshot();
 assert.ok(Math.abs(after.angle-before.angle)<12,'No large one-frame jump on reversal');
 for(let i=0;i<320;i++)t.tick();
 assert.equal(a.snapshot().angle,-74,'Exactly at printed APU 0 A stop');
 assert.equal(a.snapshot().velocity,0);
 assert.equal(t.pending,0,'Animation loop must stop at rest');
 const framesAtRest=frames.length;
 for(let i=0;i<100;i++)t.tick();
 assert.equal(frames.length,framesAtRest,'No idle paint/CPU overhead');
 a.setTarget(74);t.tick();
 assert.equal(t.pending,1);
 a.unbind();assert.equal(t.pending,0,'Unmount cancels animation');
 const frozen=a.snapshot().angle;
 a.setTarget(0);
 for(let i=0;i<40;i++)t.tick();
 assert.equal(a.snapshot().angle,frozen,'No invisible background loop');
 a.bind(x=>frames.push(x));
 for(let i=0;i<280;i++)t.tick();
 assert.equal(a.snapshot().angle,0,'Remount resumes from previous angle to newest target');
 assert.equal(t.pending,0);
});

test('APU EGT retains original zero and approaches new ECU sample without CSS restart',()=>{
 const t=clock(),values=[];
 const a=create(-241.5,{omega:6.4,min:-250,max:145,
  requestFrame:t.requestFrame,cancelFrame:t.cancelFrame});
 a.bind(angle=>values.push(angle));
 a.setTarget(-59);  // 600 deg C
 for(let i=0;i<20;i++)t.tick();
 const current=a.snapshot().angle;
 a.setTarget(-121.1); // 400 deg C
 assert.equal(a.snapshot().angle,current);
 t.tick();assert.ok(Math.abs(a.snapshot().angle-current)<10);
 for(let i=0;i<260;i++)t.tick();
 assert.equal(a.snapshot().angle,-121.1);
 assert.equal(t.pending,0);
 a.setTarget(-241.5); // cool toward printed 0
 for(let i=0;i<320;i++)t.tick();
 assert.equal(a.snapshot().angle,-241.5);
 assert.equal(t.pending,0);
});

test('Mixed frame rates and long page-tab stalls remain bounded, finite and converge',()=>{
 const t=clock(),angles=[];
 const a=create(-74,{min:-74,max:74,requestFrame:t.requestFrame,cancelFrame:t.cancelFrame});
 a.bind(value=>angles.push(value));
 a.setTarget(74);
 for(const ms of [8,12,33,16,16,1200,9,30,16,17,24,60,50,13])t.tick(ms);
 assert.ok(angles.every(v=>Number.isFinite(v)&&v>=-74&&v<=74));
 for(let i=0;i<260;i++)t.tick(1000/30);
 assert.equal(a.snapshot().angle,74);
 assert.equal(t.pending,0);
 assert.throws(()=>a.setTarget(100));
});

test('Unified mounting uses RAF motion; no 320ms CSS transition resets',()=>{
 const fs=require('node:fs'),path=require('node:path');
 const dir=__dirname;
 for(const name of ['drive-amps-needle-unified.js','apu-egt-needle-unified.js']){
  const s=fs.readFileSync(path.join(dir,name),'utf8');
  assert.match(s,/B737UnifiedNeedleMotionV1/);
  assert.match(s,/animation(?:s)?/);
  assert.doesNotMatch(s,/transition:'transform 320ms ease-out'/);
  assert.match(s,/transition:'none'/);
 }
 const html=fs.readFileSync(path.join(dir,'index.html'),'utf8');
 const shared=html.indexOf('needle-motion-v1.js?v=NEEDLE-SMOOTH-0001');
 const drives=html.indexOf('drive-amps-needle-unified.js?v=DAN-APU-SMOOTH-0008');
 const egt=html.indexOf('apu-egt-needle-unified.js?v=EGT-SMOOTH-0006');
 assert.ok(shared>0&&drives>shared&&egt>shared,'Shared motion script loads before instruments');
});
