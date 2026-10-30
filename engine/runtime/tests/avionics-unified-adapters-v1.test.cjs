'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const Net=require('../avionics-data-network-v1.js'),Fmc=require('../../integration/avionics-fmc-computer-v1.js');
function mount(){
 const events=new Map(),root={
  B737AvionicsDataNetworkV1:Net,B737AvionicsFmcComputerV1:Fmc,
  console:{warn(){},error(x){throw Error(x)}},
  document:{readyState:'complete',addEventListener(){}},
  addEventListener(type,cb){if(!events.has(type))events.set(type,[]);events.get(type).push(cb);},
  dispatchEvent(e){for(const cb of events.get(e.type)||[])cb(e);},
  setInterval(cb,ms){this.tick=cb;this.intervalMs=ms;},
  B737ISNCockpitV1:{
   getState:()=>({state:{electrical:{schema:'B737_ELECTRICAL_V7_RESULT',revision:10,bus:{dc1:true}},
    pumps:{'fuel.main1FwdPump':{run:true,lowPressure:false}}}}),
   getStartState:()=>({bleed:{apuBleedValveOpen:false}}),
   getECUState:()=>({aircraft:{pressureAltitudeFt:3500,oatC:24,iasKt:180,massKg:58000,onGround:true},
    fuel:{tanksKg:{main1:2000,main2:2300,center:900}},
    apu:{phase:'OFF',rpmPct:0,egtC:22,generator:{ready:false}},
    hydraulics:{systemA:{pressurePsi:0},systemB:{pressurePsi:0}},
    engines:{engine1:{n1Percent:22,n2Percent:60,egtC:410,fuelFlowKgHr:700,oil:{pressurePsi:15}},
     engine2:{n1Percent:0,n2Percent:0,egtC:20,fuelFlowKgHr:0,oil:{pressurePsi:0}}}})},
  B737IRSTrainerUnified:{getState:()=>({units:{
   L:{mode:'NAV',phase:'NAV_READY',powered:true,positionValid:true,position:{lat:35.6,lon:51.3},gsKt:50,trueTrackDeg:123,trueHeadingDeg:123},
   R:{mode:'ALIGN',phase:'ALIGNING',powered:true,positionValid:false,position:null}},
   motionSource:'BENCH_SIM',trainerOnly:true})},
  B737McpAFDSBridgeV1:{getOutput:()=>({schema:'B737_MCP_AFDS_OUTPUT_V1',power:null,powerEvidence:'UNVERIFIED',
   controls:{atArm:false,fd:{left:false,right:false}},values:{altitude:31000,speed:250,heading:123,verticalSpeed:0},
   modes:{lateral:null,vertical:null,thrust:null,autopilot:null}})},
  B737FmcSystemsBridgeV1:{getState:()=>({power:{FMC1:{feed:'UNKNOWN'},FMC2:{feed:'UNKNOWN'},
    CDU_CAPT:{feed:'UNKNOWN'},CDU_FO:{feed:'UNKNOWN'}},
    route:{origin:'OIII',dest:'OIMM',active:true,legsVerified:false,discontinuitiesUnknown:true}})},
  B737AircraftProfileStore:{get:()=>({aircraftFamily:'B737-300-500',pressurization:'CPCS',engineInstruments:'EIS'})}
 };
 class CustomEvent{constructor(type,{detail}={}){this.type=type;this.detail=detail;}}
 const src=fs.readFileSync(path.join(__dirname,'../../../panel-mosaic-lab/cockpit/avionics-network-runtime-v1.js'),'utf8');
 vm.runInNewContext(src,{window:root,CustomEvent},{timeout:2000});
 return root;
}
test('Unified publishes known live/training models and leaves actual ADC and GPS unconnected',()=>{
 const w=mount(),n=w.B737UnifiedAvionicsNetworkV1;
 for(const topic of ['electrical.buses','irs.left','irs.right','mcp.state','afds.state',
   'autothrottle.state','crew.flightplan','fuel.quantity','fuel.pumps','flightcontext.state',
   'propulsion.engine1','hydraulics.state','apu.state','pneumatics.state','aircraft.airground','fmc.computed'])
  assert.equal(n.getSignal(topic).quality,'VALID',topic);
 for(const topic of ['airdata.adc1','navigation.gps1','navigation.dme1','navigation.database','performance.database'])
  assert.equal(n.getSignal(topic).quality,'UNKNOWN',topic);
 assert.equal(n.getSignal('fuel.quantity').value.totalKg,5200);
 assert.equal(n.getSignal('fuel.quantity').origin,'TRAINING_SCENARIO');
 assert.equal(n.getFmcInputs().trainingFlightContext.oatC,24);
 assert.equal(n.getFmcInputs().airData.quality,'UNKNOWN');
 assert.equal(n.getFmcInputs().guidance.canCommandAircraft,false);
 assert.equal(w.intervalMs,250);
 assert.equal(n.getDiagnostics().adapterErrors.length,0);
});
test('external ADC publishes independently and cannot overwrite the IRS or FMC owner',()=>{
 const n=mount().B737UnifiedAvionicsNetworkV1;const a=n.connectExternal('ADC');
 assert.throws(()=>n.connectExternal('ADC'),/OWNER_ALREADY_CONNECTED/);
 assert.throws(()=>a.publish('irs.left',{lat:35,lon:51}),/TOPIC_NOT_OWNED/);
 assert.throws(()=>a.publish('airdata.adc1',{pressureAltitudeFt:90000}),/SIGNAL_RANGE/);
 a.publish('airdata.adc1',{pressureAltitudeFt:4500,casKt:210},{origin:'SIMULATOR_TELEMETRY'});
 assert.equal(n.getFmcInputs().airData.source,'airdata.adc1');
 assert.equal(n.getFmcInputs().airData.casKt,210);
});
