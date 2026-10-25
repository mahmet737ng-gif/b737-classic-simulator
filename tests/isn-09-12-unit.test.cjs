'use strict';
const assert=require('node:assert/strict');
const M=require('../engine/integration/isn-09-12-runtime-v1');
const all=Object.fromEntries(['fuel.main1FwdPump','fuel.main1AftPump','fuel.main2FwdPump','fuel.main2AftPump','fuel.centerLeftPump','fuel.centerRightPump'].map(id=>[id,{operating:false,switchOn:false}]));
function pumps(keys,operating=true){return Object.fromEntries(Object.entries(all).map(([k,v])=>[k,{...v,operating:keys.includes(k)?operating:false}]));}
const f=new M.FuelNetwork({initialFuelKg:{main1:30,center:5,main2:25}});
const cfg={fuelStartLever:'IDLE'};
assert.equal(f.supply('engine1',pumps(['fuel.main1FwdPump']),cfg).tank,'main1');
assert.equal(f.supply('engine2',pumps(['fuel.main1FwdPump']),cfg).available,false);
f.setCrossfeed('OPEN');
assert.equal(f.supply('engine2',pumps(['fuel.main1FwdPump']),cfg).tank,'main1');
assert.equal(f.supply('engine2',pumps(['fuel.main1FwdPump','fuel.centerLeftPump']),cfg).tank,'center');
assert.equal(f.supply('engine1',pumps(['fuel.main1FwdPump']),{fuelStartLever:'CUTOFF'}).reason,'SHUTOFF_VALVE_CLOSED');
assert.equal(f.supply('engine1',pumps(['fuel.main1FwdPump']),{fuelStartLever:'IDLE',fireSwitchPulled:true}).available,false);
const unk=pumps([]);unk['fuel.main1FwdPump'].operating=null;
assert.equal(f.supply('engine1',unk,cfg).available,null);
const burn=f.consume('engine1',40,'main1');assert.equal(burn.deliveredKg,30);assert.equal(burn.shortfallKg,10);
assert.equal(f.get().tanksKg.main1,0);assert.throws(()=>f.setTank('foo',1));
assert.throws(()=>f.consume('engine1',-1,'main1'));
const s=new M.FuelNetwork({initialFuelKg:{main1:4,center:0,main2:5},allowSuctionTraining:true});
assert.equal(s.supply('engine1',pumps([]),{fuelStartLever:'IDLE',pressureAltitudeFt:5000}).available,true);
assert.equal(s.supply('engine1',pumps([]),{fuelStartLever:'IDLE',pressureAltitudeFt:25000}).available,false);
let phase={engine1:'RUNNING',engine2:'OFF',apu:'OFF'},fakePumps=pumps(['fuel.main1FwdPump']);let origin='TRAINING_SEQUENCE_SIMULATED';let feedback={engine1:{fuelStartLever:{value:'IDLE'},n2Percent:{value:60},egtC:{value:445},fuelFlowKgHr:{value:360}},engine2:{fuelStartLever:{value:'CUTOFF'},n2Percent:{value:null},egtC:{value:null},fuelFlowKgHr:{value:null}}};
const fakeChain={start:{core:{pack:{get(){return {pumps:fakePumps}},send(){}}}},flight:{onGround:true},
 get(){return {phase:{...phase},runningEnvelope:{engines:{engine1:phase.engine1==='RUNNING'?{n1Percent:22,fuelFlowKgHr:360}:null,engine2:null}},observations:{engine1:{feedback:feedback.engine1,rules:{starter:{},advisory:{egt725Latched:false}}},engine2:{feedback:feedback.engine2,rules:{starter:{},advisory:{egt725Latched:false}}}},sources:{engine1:{running:phase.engine1==='RUNNING',origin},engine2:{running:false,origin},apu:{running:false}}}},
 advance(){},lever(id,v){feedback[id].fuelStartLever.value=v},setThrottle(){},fuelFlameout(id){phase[id]='FUEL_STARVATION';feedback[id].fuelFlowKgHr.value=0;}};
const planner={performance(input){return {mode:{active:'CRZ',limitTable:{TO:97,CLB:92}},performance:{selectedN1CommandPercent:64}}},applyToTrainingChain(){return {status:'THROTTLE_COMMAND_APPLIED_FOR_SIMULATION'}}};
const rt=new M.Runtime({chain:fakeChain,thrustPlanner:planner,initialFuelKg:{main1:0.02,center:0,main2:0}});
assert.equal(rt.get().engines.engine1.fuelPath.available,true);
const draft=rt.planThrust('engine1',{},{});assert.equal(draft.action,null);assert.equal(rt.get().modeLimitsN1Pct.TO,97);
assert.equal(rt.planThrust('engine1',{}, {apply:true}).action.status,'THROTTLE_COMMAND_APPLIED_FOR_SIMULATION');
rt.advance(1000);
assert.equal(phase.engine1,'FUEL_STARVATION');
assert.equal(rt.get().diagnostics.engines.engine1.status,'ABNORMAL');
assert.equal(rt.get().fuel.burnedKg.engine1,0.02);
const diag=M.diagnostics({phase:{engine1:'ABNORMAL_EGT',engine2:'HUNG_START'},observations:{engine1:{rules:{advisory:{egt725Latched:true}}}}},{});
assert.equal(diag.engines.engine1.faults.length,2);
assert.equal(diag.noInferredFireBell,true);
console.log('PASS ISN-09..12: N1 planner contract, source precedence, fuel pump/crossfeed/quantity, start fuel gate, burn, fuel flameout and diagnostics.');