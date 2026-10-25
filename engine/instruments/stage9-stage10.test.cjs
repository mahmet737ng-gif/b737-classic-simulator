const test=require('node:test');
const assert=require('node:assert/strict');
const motion=require('./stage9-needle-dynamics-v1.js');
const runtime=require('./stage10-needle-workbench-v1.js');
const scaleEngine=require('./stage5-scale-mapping-v1.js');
const subset=require('./stage10-preview-scale-subset-v1.json');
const responseProfiles=require('./stage9-dynamics-registry-v1.json');
const routes=require('./stage8-pointer-routing-v1.json');
const contracts=require('./stage8-signal-contracts-v1.json');
const signal=require('./stage8-ism-signal-bridge-v1.js');
const routeEngine=require('./stage8-pointer-routing-v1.js');
const make=(profile={mode:'slew',speedDegPerSec:20,requiresPower:true})=>motion.create({
 id:'test',limits:{minAngleDeg:-120,maxAngleDeg:130},profile});
const step=(drv,target,dt=0,power='on',other={})=>drv.update({
 targetAngleDeg:target,validSample:Number.isFinite(target),
 dtSeconds:dt,power,source:'test-physical-provider',...other});
test('Stage 9 slew respects elapsed time and reverses without teleportation',()=>{
 const d=make();
 assert.equal(step(d,0).angleDeg,0);
 assert.equal(step(d,100,1).angleDeg,20);
 assert.equal(step(d,-100,.5).angleDeg,10);
 assert.equal(step(d,-100,1).angleDeg,-10);
 assert.equal(d.snapshot().liveNeedleAuthorized,false);
});
test('Stage 9 first-order response is timestep-independent and never overshoots',()=>{
 const a=make({mode:'first_order',tauSeconds:1,requiresPower:true});
 const b=make({mode:'first_order',tauSeconds:1,requiresPower:true});
 step(a,0);step(b,0);
 const x=step(a,100,1).angleDeg;
 for(let i=0;i<10;i++)step(b,100,.1);
 assert.ok(Math.abs(x-b.snapshot().angleDeg)<1e-10);
 assert.ok(x>63&&x<64);
});
test('Stage 9 second-order is finite, stable and bound by mechanical stops',()=>{
 const d=make({mode:'second_order',omegaRadSec:4,dampingRatio:1.2,requiresPower:true});
 step(d,0);
 for(let i=0;i<80;i++)step(d,300,.025);
 assert.ok(d.snapshot().angleDeg>100&&d.snapshot().angleDeg<=130);
 assert.ok(Number.isFinite(d.snapshot().velocityDegPerSec));
});
test('Stage 9 direct and slew clamp to fixed mechanical stops, no automatic zero',()=>{
 const d=make({mode:'direct',requiresPower:true,lossBehavior:'hold'});
 assert.equal(step(d,500).angleDeg,130);
 assert.equal(step(d,30).angleDeg,30);
 const s=d.update({power:'off',validSample:true,targetAngleDeg:0,source:'existing',dtSeconds:3});
 assert.equal(s.status,'power_lost');
 assert.equal(s.angleDeg,30);
});
test('Loss of sensor, power or unverified bus freezes last physical position',()=>{
 const d=make();
 step(d,15);
 assert.equal(step(d,90,2,'unknown').status,'power_unverified');
 assert.equal(d.snapshot().angleDeg,15);
 assert.equal(step(d,90,2,'off').status,'power_lost');
 assert.equal(step(d,90,2,'on',{validSample:false}).status,'signal_unavailable');
 assert.equal(d.snapshot().angleDeg,15);
 assert.equal(step(d,90,2,'on',{fault:'needle_jammed'}).status,'needle_jammed');
 assert.equal(d.snapshot().angleDeg,15);
});
test('Explicit invalidate loss behavior, freshness and source provenance rules',()=>{
 const d=make({mode:'slew',speedDegPerSec:20,requiresPower:true,lossBehavior:'invalidate',staleThresholdMs:1000});
 step(d,10);
 const x=step(d,20,1,'on',{sampleAgeMs:1200});
 assert.equal(x.status,'data_stale');
 assert.equal(x.angleDeg,null);
 assert.throws(()=>step(d,55,.5,'on',{validSample:true,source:''}),/source provenance/);
 assert.throws(()=>step(d,0,33),/elapsed interval/);
});
test('Zero delta never advances, deterministic reset is idempotent',()=>{
 const d=make({mode:'slew',speedDegPerSec:20,requiresPower:true});
 step(d,0);step(d,100,1);
 assert.equal(step(d,100,0).angleDeg,20);
 d.reset({angleDeg:5});assert.equal(d.snapshot().angleDeg,5);
 assert.equal(step(d,100,0).angleDeg,5);
 d.reset();assert.equal(d.snapshot().angleDeg,null);
});
test('Stage10 contains seven candidate scale modes and exactly 8 preview-capable sprites',()=>{
 const bridge=runtime.create({routes,scales:subset,scaleEngine,dynamics:motion,profileRegistry:responseProfiles,
  previewPowerPolicy:'training_qa_assume_power'});
 const p=bridge.getPreparedModels();
 assert.equal(p.count,8);
 assert.deepEqual([...p.ids].sort(),['fuelTemperature','dcAmps','cps','press','cabAlt','cabinTemperature','ductL','ductR'].sort());
 assert.equal(contracts.certifiedAngleTables,0);
 assert.equal(contracts.activation,'BLOCKED');
 assert.equal(routes.counts.liveApproved,0);
});
test('Stage10 uses actual Stage8 cabin altitude source, but never moves a Unified sprite',()=>{
 const sensor=signal.create(contracts),routing=routeEngine.create(routes);
 const unit=runtime.create({routes,scales:subset,scaleEngine,dynamics:motion,profileRegistry:responseProfiles,
  previewPowerPolicy:'training_qa_assume_power'});
 const snap=sensor.read({cabinPlant:{
  source:'PROVISIONAL_IDEAL_GAS_TRAINER',cabinAltitudeFt:3963,cabinRateFtMin:0,differentialPsid:0
 }});
 const ptr=routing.project(snap);
 const out=unit.evaluate(ptr,{nowMs:1000});
 assert.equal(out.counts.total,38);
 assert.equal(out.counts.geometryPreviewCapable,8);
 assert.equal(out.counts.liveNeedlesMoved,0);
 assert.equal(out.pointers.cabAlt.status,'initialized');
 assert.ok(Math.abs(out.pointers.cabAlt.simulationAngleDeg-66.674)<.05);
 assert.equal(out.pointers.cabAlt.liveNeedleAuthorized,false);
 assert.equal(out.pointers.cabAlt.spriteUnchanged,true);
 assert.equal(out.pointers.press.simulationAngleDeg,0.64);
 assert.equal(out.pointers.cps.status,'source_unavailable');
 assert.equal(out.pointers.captIAS.reason,'no_two_anchor_scale');
 assert.equal(out.pointers.captVMO.reason,'channel_not_resolved');
 assert.throws(()=>unit.evaluate(ptr,{nowMs:500}),/backward/);
});
test('Stage10 power evidence is enforced unless explicit QA-only synthetic-power mode',()=>{
 const sensor=signal.create(contracts),route=routeEngine.create(routes);
 const sample=sensor.read({cabinPlant:{source:'PROVISIONAL_IDEAL_GAS_TRAINER',
  cabinAltitudeFt:66,cabinRateFtMin:0,differentialPsid:0}});
 const pts=route.project(sample);
 const strictly=runtime.create({routes,scales:subset,scaleEngine,dynamics:motion,profileRegistry:responseProfiles});
 const result=strictly.evaluate(pts,{nowMs:10});
 assert.equal(result.pointers.cabAlt.status,'power_unverified');
 assert.equal(result.pointers.cabAlt.simulationAngleDeg,null);
 assert.equal(result.counts.liveNeedlesMoved,0);
 assert.ok(result.counts.powerUnknown>0);
});
test('Stage10 pending values remain blocked even when valid observed source is injected',()=>{
 const sensor=signal.create(contracts),routing=routeEngine.create(routes);
 const s=sensor.read({observed:{'oh.elec.cps':{primary:{
  value:410,unit:'Hz',valid:true,origin:'QA_INSTRUMENT_SENSOR',timeMs:1000}}}});
 const work=runtime.create({routes,scales:subset,scaleEngine,dynamics:motion,profileRegistry:responseProfiles,
  previewPowerPolicy:'training_qa_assume_power'});
 let preview=work.evaluate(routing.project(s),{nowMs:1000,observationNowMs:1000});
 assert.ok(Math.abs(preview.pointers.cps.simulationAngleDeg-41.805)<.03);
 assert.equal(preview.pointers.cps.liveNeedleAuthorized,false);
 assert.equal(preview.pointers.cps.sourceCandidateStatus,'preview_unverified');
 const without=runtime.create({routes,scales:subset,scaleEngine,dynamics:motion,profileRegistry:responseProfiles,
  previewPowerPolicy:'training_qa_assume_power'});
 const invalid=sensor.read({observed:{'oh.elec.cps':{primary:{
   value:0,unit:'Hz',valid:false,origin:'QA_INSTRUMENT_SENSOR'}}}});
 preview=without.evaluate(routing.project(invalid),{nowMs:2000});
 assert.equal(preview.pointers.cps.simulationAngleDeg,null);
 assert.equal(preview.pointers.cps.sourceStatus,'invalid_observed');
});

test('Every one of the 38 known pointers has exactly one stage9 response policy',()=>{
 assert.equal(responseProfiles.pointers.length,38);
 assert.equal(new Set(responseProfiles.pointers.map(x=>x.pointerId)).size,38);
 assert.equal(responseProfiles.counts.previewResponseProfiles,8);
 assert.equal(responseProfiles.counts.unresolvedResponseProfiles,30);
 assert.equal(responseProfiles.counts.certifiedMechanicalResponseProfiles,0);
 for(const p of responseProfiles.pointers)assert.equal(p.approvedForOperationalMotion,false);
 const compiled=runtime.create({routes,scales:subset,scaleEngine,dynamics:motion,
   profileRegistry:responseProfiles});
 assert.equal(compiled.getPreparedModels().count,8);
});

test('Stage10 observed sample freshness, anti-replay and invalidation are fail-closed in read-only QA',()=>{
 const sensor=signal.create(contracts),routing=routeEngine.create(routes);
 const work=runtime.create({routes,scales:subset,scaleEngine,dynamics:motion,
   profileRegistry:responseProfiles,previewPowerPolicy:'training_qa_assume_power'});
 const withObservation=(timeMs,value=410)=>routing.project(sensor.read({
   observed:{'oh.elec.cps':{primary:{value,unit:'Hz',valid:true,
     origin:'QA_OBSERVED_CPS',...(timeMs===null?{}:{timeMs})}}}
 }));
 const at=(reading,motionNow,wallNow)=>work.evaluate(reading,{
    nowMs:motionNow,observationNowMs:wallNow}).pointers.cps;
 const first=at(withObservation(1000),1000,1000);
 assert.equal(first.status,'initialized');
 assert.equal(first.sourceIntegrityStatus,'fresh_observed');
 const next=at(withObservation(1500,411),1500,1500);
 assert.equal(next.sourceIntegrityStatus,'fresh_observed');
 const held=next.simulationAngleDeg;
 const replay=at(withObservation(1100,412),1600,1600);
 assert.equal(replay.status,'sensor_lost');
 assert.equal(replay.sourceIntegrityStatus,'observed_timestamp_replay');
 assert.equal(replay.simulationAngleDeg,held);
 assert.equal(replay.sourceValue,null);
 const mutate=at(withObservation(1500,412),1700,1700);
 assert.equal(mutate.sourceIntegrityStatus,'observed_timestamp_mutated');
 assert.equal(mutate.simulationAngleDeg,held);
 const future=at(withObservation(2500),1701,1701);
 assert.equal(future.sourceIntegrityStatus,'observed_timestamp_future');
 assert.equal(future.simulationAngleDeg,held);
 const noDate=at(withObservation(null),1702,1702);
 assert.equal(noDate.sourceIntegrityStatus,'observed_timestamp_missing');
 assert.equal(noDate.simulationAngleDeg,held);
 const stale=work.evaluate(withObservation(1500),{nowMs:7200,observationNowMs:7200});
 assert.equal(stale.pointers.cps.status,'data_stale');
 assert.equal(stale.pointers.cps.sourceIntegrityStatus,'observed_timestamp_stale');
 assert.equal(stale.pointers.cps.simulationAngleDeg,held);
 assert.equal(stale.counts.staleObservations,1);
 assert.equal(stale.counts.liveNeedlesMoved,0);
 assert.throws(()=>work.evaluate(withObservation(1500),{
    nowMs:7201,observationNowMs:7100}),/Observed source clock moved backward/);
 work.reset();
 assert.equal(at(withObservation(1000),1000,1000).status,'initialized');
});
test('Stage10 requires an explicit wall clock for independently observed signals',()=>{
 const sensor=signal.create(contracts),routing=routeEngine.create(routes);
 const work=runtime.create({routes,scales:subset,scaleEngine,dynamics:motion,
   profileRegistry:responseProfiles,previewPowerPolicy:'training_qa_assume_power'});
 const reading=routing.project(sensor.read({observed:{'oh.elec.cps':{
   primary:{value:410,unit:'Hz',valid:true,origin:'QA_SENSOR',timeMs:1000}}}}));
 const result=work.evaluate(reading,{nowMs:1000}).pointers.cps;
 assert.equal(result.status,'sensor_lost');
 assert.equal(result.sourceIntegrityStatus,'observation_clock_missing');
 assert.equal(result.simulationAngleDeg,null);
 assert.equal(result.liveNeedleAuthorized,false);
 assert.throws(()=>runtime.create({routes,scales:subset,scaleEngine,dynamics:motion,
   profileRegistry:responseProfiles,observedMaxAgeMs:0}),/freshness window invalid/);
});
