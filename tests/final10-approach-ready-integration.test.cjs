'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const base=path.resolve(__dirname,'../panel-mosaic-lab/cockpit');
const parent=fs.readFileSync(path.join(base,'final10-approach-preset-v1.js'),'utf8');
const trainer=fs.readFileSync(path.resolve(__dirname,'../panel-mosaic-lab/le-devices/trainer-bridge-v1.js'),'utf8');
const LE=require('../engine/systems/le-devices-classic-v1.js');
const TE=require('../engine/systems/te-flap-actuator-v1.js');
function rig({generator2Fault=false,ownerReady=true}={}){
 const calls=[],callbacks=[],source={1:'APU',2:'APU'},
  faults={GEN1_FAILED:false,GEN2_FAILED:generator2Fault},
  config={engine1Running:false,engine2Running:false},phase={engine1:'OFF',engine2:'OFF',apu:'READY'};
 let pos=0,le={lever:0,actualTe:0,overheadReady:true,projection:{source:'PHYSICAL',lever:0,teTarget:0,teMoving:false}};
 const ab={selector:'2',phase:'FAILED',disarmLight:true,reason:'LANDING_TOSC_FAILED',
  inputs:{onGround:true,electricalAvailable:false,antiskidOn:true,antiskidFault:false,
   hydraulicBAvailable:true,normalBrakesOperative:true,autobrakeFault:false,solenoidPressurePsi:0}};
 const ids=['gen-1','gen-2','apu-gen-1','apu-gen-2','apu-start','bleed-apu','bleed-eng-1','bleed-eng-2','pack-l','pack-r','isolation-valve',
  'landing-out-l','landing-out-r','landing-in-l','landing-in-r','strobe','position-lights','anti-collision','logo','wing-lights','runway-turnoff-l','runway-turnoff-r','taxi'];
 const detents=Object.fromEntries(ids.map(id=>[id,id.startsWith('gen-')?'NEUTRAL':id.startsWith('apu-gen-')?'ON':id==='apu-start'?'ON':'OFF']));
 const children={
  B737OverheadToggles:{
   getState:()=>({...detents}),
   getRegistry:()=>({controls:ids.map(id=>({id,states:id.startsWith('gen-')||id.startsWith('apu-gen-')?['OFF','NEUTRAL','ON']:id.startsWith('pack-')?['OFF','AUTO','HIGH']:id==='isolation-valve'?['CLOSE','AUTO','OPEN']:id==='apu-start'?['OFF','ON','START']:['OFF','ON']}))}),
   setScenarioSwitch(id,target){
    calls.push([id,target]);
    if(id.startsWith('gen-')&&target==='ON'){
     const n=Number(id.at(-1));
     if(!config['engine'+n+'Running']||faults['GEN'+n+'_FAILED']||!Object.values(source).some(Boolean))return {accepted:false,reason:'GENERATOR_NOT_READY'};
     source[n]='GEN'+n;detents[id]='NEUTRAL';return {accepted:true};
    }
    if(id.startsWith('apu-gen-')&&target==='OFF'&&source[Number(id.at(-1))]==='APU')source[Number(id.at(-1))]=null;
    if(id==='apu-start'&&target==='OFF')phase.apu='OFF';
    detents[id]=target;
    return {accepted:true};
   }
  },
  postMessage(){calls.push(['POST_MESSAGE','LE_OWNER_NOT_READY'])}
 };
 if(ownerReady)children.B737LEDevicesTrainer={presetFinal10ReadyFlaps({originator}){
   assert.equal(originator,'FLIGHT_SCENARIO_FINAL10');
   calls.push(['LE_OWNER','READY_30']);
   le={lever:30,actualTe:30,overheadReady:true,
    projection:{source:'FLIGHT_SCENARIO_FINAL10',lever:30,teTarget:30,teMoving:false,leStage:'FULL'}};
   return {lever:30};
 }};
 const doc={getElementById:id=>id==='overheadFrame'?{contentWindow:children}:null,querySelector:()=>({})};
 const win={document:doc,location:{origin:'https://unified.test'},
  addEventListener(){},dispatchEvent(){},clearInterval(){},setInterval(fn){callbacks.push(fn);return callbacks.length},
  CustomEvent:class{constructor(type,opts){this.type=type;this.detail=opts?.detail}},
  B737UnifiedFlightScenarioV1:{getState:()=>({preset:'FINAL_10',icao:'OIII',runway:'29L'})},
  B737ISNCockpitV1:{
   getStartState:()=>({phase:{...phase}}),
   engineTrainerAction({engine,type}){assert.equal(type,'PRESET_RUNNING');phase[engine]='RUNNING';config[engine+'Running']=true;return {type}},
   getElectricalState:()=>({source,config,faults})
  },
  B737ElectricalV7:{evaluate:()=>({bus:{generator1:source[1]==='GEN1'&&!faults.GEN1_FAILED,
   generator2:source[2]==='GEN2'&&!faults.GEN2_FAILED,dc2:!!source[2]}})},
  B737FlapVisualTest:{get position(){return pos},presetFinal10(){pos=30;return true}},
  B737LEDevicesUnifiedLink:{getState:()=>le},
  B737CockpitLights:{getState:()=>({inputs:{speedBrakeArmedIndication:true}})},
  B737SpeedbrakeLever:{mounted:()=>true,set:()=>{}},
  B737LandingGearUnifiedV1:{getState:()=>({lever:'DN',gear:{nose:'DOWN',left:'DOWN',right:'DOWN'}})},
  B737McpAFDSBridgeV1:{refreshElectrical(){},applyFinal10Preset:()=>({accepted:true})},
  B737WMM2025V1:{evaluate:()=>({valid:true,declinationDeg:0})},
  B737AutobrakeUnified:{
   getState:()=>({...ab,inputs:{...ab.inputs}}),
   updateSensors(patch){Object.assign(ab.inputs,patch);ab.inputs.electricalAvailable=!!source[2];return this.getState()},
   setSelector(value){calls.push(['AB',value]);ab.selector=value;ab.phase=value==='2'?'WAITING':'OFF';ab.disarmLight=false;ab.reason=value==='2'?'LANDING_TOSC_PASSED':'MANUAL_OFF';return this.getState()}
  }
 };
 vm.runInNewContext(parent,{window:win,CustomEvent:win.CustomEvent,Date,console},{filename:'final10-approach-preset-v1.js'});
 const scenario={preset:'FINAL_10',icao:'OIII',runway:'29L',runwayHeadingTrueDeg:290,lat:35,lon:51,altitudeFt:6000};
 function load(){win.B737Final10ApproachPresetV1.apply(scenario)}
 function tick(n=1){for(let i=0;i<n;i++)for(const fn of callbacks.slice())fn()}
 return {win,phase,source,calls,le:()=>le,ab:()=>ab,load,tick,
  status:()=>win.B737Final10ApproachPresetV1.getStatus().checks};
}
test('FINAL_10 first connects both engine generators while APU bus remains energized, then disconnects APU',()=>{
 const x=rig();x.load();x.tick(3);
 assert.equal(x.source[1],'GEN1');assert.equal(x.source[2],'GEN2');
 assert.equal(x.phase.apu,'OFF');
 const firstGen=Math.min(x.calls.findIndex(([id,v])=>id==='gen-1'&&v==='ON'),
  x.calls.findIndex(([id,v])=>id==='gen-2'&&v==='ON'));
 const apuOff=x.calls.findIndex(([id,v])=>id==='apu-gen-1'&&v==='OFF');
 assert.ok(firstGen>=0&&apuOff>firstGen,'APU supply disconnected only after generator contactors close');
 assert.equal(x.status().GEN1_ON_BUS.ok,true);assert.equal(x.status().GEN2_ON_BUS.ok,true);
 assert.equal(x.status().APU_OFF.ok,true);
});
test('Flap lever and actual actuator initialize at 30, already extended, not animated from UP',()=>{
 const x=rig();x.load();x.tick();
 assert.equal(x.le().actualTe,30);
 assert.equal(x.le().projection.teMoving,false);
 assert.equal(x.status().FLAP_LEVER_30.ok,true);
 assert.equal(x.status().FLAP_ACTUAL_30.ok,true);
 assert.ok(x.calls.some(([id,v])=>id==='LE_OWNER'&&v==='READY_30'));
});
test('Autobrake reselects OFF then 2 only with DC2 available, clearing old FAILED latch',()=>{
 const x=rig();x.load();x.tick();
 assert.deepEqual(x.calls.filter(([id])=>id==='AB'),[['AB','OFF'],['AB','2']]);
 assert.equal(x.ab().phase,'WAITING');assert.equal(x.ab().disarmLight,false);
 assert.equal(x.ab().inputs.onGround,false);assert.equal(x.status().AUTOBRAKE_2.ok,true);
});
test('GEN2 fault: do not invent an on-bus source, turn off APU, or rearm failed autobrake',()=>{
 const x=rig({generator2Fault:true});x.load();x.tick(3);
 assert.equal(x.source[2],'APU');assert.equal(x.phase.apu,'READY');
 assert.equal(x.status().GEN2_ON_BUS.ok,false);
 assert.equal(x.status().APU_OFF.ok,false);
 assert.ok(!x.calls.some(([id,v])=>id==='apu-gen-2'&&v==='OFF'));
});
test('FLAP owner not ready must not mark actual flap configuration complete',()=>{
 const x=rig({ownerReady:false});x.load();x.tick();
 assert.equal(x.status().FLAP_LEVER_30.ok,true);
 assert.equal(x.status().FLAP_ACTUAL_30.ok,false);
 assert.equal(x.status().FLAP_OWNER_PRESET.ok,false);
});
test('The approved TE actuator reaches 30 before scenario START in the owner 48-second replay',()=>{
 let te=TE.initialState(),state=LE.initialState('NORMAL');
 state=LE.apply(state,{type:'GROUND',value:false});
 te=TE.apply(te,{type:'COMMAND',value:30});
 state=LE.apply(state,{type:'FLAP_LEVER',value:30});
 state=LE.apply(state,{type:'START_LE_SEQUENCE'});
 for(let i=0;i<48;i++){
  te=TE.apply(te,{type:'TICK',seconds:1});
  state=LE.apply(state,{type:'FOLLOW_TE',position:te.actual,command:30});
  state=LE.apply(state,{type:'TICK',seconds:1,motionProfile:'TIMED',pressureFactor:1});
 }
 assert.equal(TE.evaluate(te).actual,30);
 assert.equal(TE.evaluate(te).moving,false);
 assert.equal(LE.evaluate(state).leStage,'FULL');
 assert.deepEqual(LE.evaluate(state).mismatch,[]);
 assert.match(trainer,/presetFinal10ReadyFlaps:/);
});
