const test=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const {URL}=require('node:url');
const bridge=require('./stage8-ism-signal-bridge-v1.js');
const cold=require('./stage7-cold-dark-state-v1.js');
const contracts=require('./stage8-signal-contracts-v1.json');
const policy=require('./cold-dark-indicator-policy-v1.json');
const routeModel=require('./stage8-pointer-routing-v1.js');
const routes=require('./stage8-pointer-routing-v1.json');
const index=fs.readFileSync('panel-mosaic-lab/cockpit/index.html','utf8');
const code=fs.readFileSync('panel-mosaic-lab/cockpit/stage78-readonly-unified.js','utf8');
const location='https://example.invalid/panel-mosaic-lab/cockpit/stage78-readonly-unified.js';
function boot(){
 const listeners={};let system='CPCS',field=3963,pressure=3963;
 const errors=[],calls=[];
 const window={
  B737InstrumentSignalBridgeV1:bridge,B737Stage7ColdDarkV1:cold,
  B737InstrumentPointerRoutingV1:routeModel,
  B737GroundAirfieldContext:()=>({fieldElevationFt:field,cabinEqualized:true,cabinPressureStable:true}),
  B737PressurizationIntegration:{
   getSelected:()=>system,
   read:()=>({physical:{cabinAltitudeFt:pressure,differentialPsid:0,cabinRateFtMin:0,
       status:'PROVISIONAL_TRAINING_PHYSICS_NOT_AIRCRAFT_VALIDATED'}})
  },
  B737UnifiedDuctPressureNeedles:{setValues:()=>{throw Error('Unexpected live needle movement')}},
  B737ISNCockpitV1:{getECUState:()=>({
    quality:'TRAINING_SIMULATION_ONLY',timeMs:10,
    engines:{engine1:{phase:'RUNNING',n1Percent:25,n2Percent:55},
       engine2:{phase:'RUNNING',n1Percent:25,n2Percent:55}},
    electrical:{battery:true,selectedSources:{1:'GEN1',2:'GEN2'}},
    apu:{phase:'OFF'},aircraft:{iasKt:0,onGround:true}
  })},
  addEventListener:(name,cb)=>((listeners[name]??=[]).push(cb)),
 };
 const document={currentScript:{src:location},querySelector:()=>null,
  addEventListener:(name,cb)=>((listeners['document:'+name]??=[]).push(cb))};
 const fetch=async url=>{
   calls.push(url);
   return {ok:true,json:async()=>url.includes('stage8-signal-contracts')?contracts:
      url.includes('stage8-pointer-routing')?routes:policy};
 };
 vm.runInNewContext(code,{window,document,console:{error:e=>errors.push(String(e))},URL,fetch},
    {filename:'stage78-readonly-unified.js'});
 const fire=(name,detail)=>{for(const fn of listeners[name]||[])fn({detail});};
 return {window,fire,calls,errors,setSystem:s=>system=s,setField:v=>field=v,setCabin:v=>pressure=v};
}
test('Unified HTML loads stage 7/8 before live ECU emitter and retains existing cold-dark module',()=>{
 const a=index.indexOf('stage8-ism-signal-bridge-v1.js');
 const b=index.indexOf('stage7-cold-dark-state-v1.js');
 const routeIndex=index.indexOf('stage8-pointer-routing-v1.js');
 const c=index.indexOf('stage78-readonly-unified.js');
 const d=index.indexOf('isn-cockpit.js');
 assert.ok(a>=0&&b>a&&routeIndex>b&&c>routeIndex&&d>c,'Expected ordered source-signal modules');
 assert.ok(index.includes('cold-dark-indicators-unified.js'));
});
test('Unified live ECU and currently selected CPCS/DCPCS trainer pressure share read-only signal envelopes',async()=>{
 const demo=boot();
 await new Promise(resolve=>setImmediate(resolve));
 const app=demo.window.B737UnifiedInstrumentSignalsV1;
 assert.ok(app,'No Unified signal registry');
 assert.equal(app.getStatus().status,'read_only',demo.errors.join('; '));
 assert.equal(app.getSignals().stats.faces,54);
 assert.equal(Object.keys(app.getPointerSignals().pointers).length,38);
 assert.equal(app.getPointerSignals().authorizedLiveMovements,0);
 assert.equal(app.getSignals().signals['oh.cabin.diff_pressure_altitude'].channels.cabAlt.value,3963);
 assert.equal(app.getColdDarkState().faces['oh.cabin.diff_pressure_altitude'].pressurizationArchitecture,'CPCS');
 demo.setSystem('DCPCS');demo.setField(66);demo.setCabin(66);
 demo.fire('b737:pressurization-state',{system:'DCPCS'});
 assert.equal(app.getColdDarkState().faces['oh.cabin.diff_pressure_altitude'].pressurizationArchitecture,'DCPCS');
 assert.equal(app.getSignals().signals['oh.cabin.diff_pressure_altitude'].channels.cabAlt.value,66);
 const reading=app.getSignals().signals['oh.cabin.diff_pressure_altitude'].channels.cabAlt;
 assert.equal(reading.provenance,'TRAINING_SIMULATION_ONLY');
 assert.equal(reading.liveNeedleAuthorized,false);
 assert.equal(app.getStatus().liveNeedlesUpdated,0);
 assert.deepEqual(demo.errors,[]);
});
test('On real ECU event, validated training envelope is updated but meter selectors remain absent',async()=>{
 const demo=boot();await new Promise(resolve=>setImmediate(resolve));
 const ecu={quality:'TRAINING_SIMULATION_ONLY',timeMs:500,
  engines:{engine1:{n1Percent:0,n2Percent:0,egtC:36,fuelFlowKgHr:0,
   oil:{pressurePsi:0,temperatureC:36}},engine2:{n1Percent:50,n2Percent:79,
    egtC:600,fuelFlowKgHr:3700,oil:{pressurePsi:82,temperatureC:92}}},
  hydraulics:{systemA:{pressurePsi:0},systemB:{pressurePsi:2900}},
  fuel:{tanksKg:{main1:2010,main2:2050,center:0}},
  aircraft:{onGround:true,iasKt:0},
  apu:{phase:'OFF',egtC:18},electrical:{battery:true,selectedSources:{1:'GEN1',2:'GEN2'}}};
 demo.fire('b737:unified-ecu-observation',ecu);
 const app=demo.window.B737UnifiedInstrumentSignalsV1;
 assert.equal(app.getSignals().signals['eng.n2.2'].channels.primary.value,79);
 assert.equal(app.getSignals().signals['eng.fuel_flow.2'].channels.primary.value,3700);
 assert.equal(app.getSignals().signals['oh.elec.dc_amps'].channels.primary.value,null);
 assert.equal(app.getColdDarkState().faces['eng.n2.1'].channels.primary.liveNeedleAuthorized,false);
 assert.equal(app.getStatus().liveNeedlesUpdated,0);
});

test('Known VMO/Mach pointers remain unconnected, while RISE/IN only maps after selector confirmation',async()=>{
 const demo=boot();await new Promise(resolve=>setImmediate(resolve));
 const app=demo.window.B737UnifiedInstrumentSignalsV1;
 let snap=app.getPointerSignals();
 assert.equal(snap.pointers.captVMO.channel,null);
 assert.equal(snap.pointers.captVMO.status,'blocked');
 assert.equal(snap.pointers.driveOil1.reason,'selector_unconfirmed');
 snap=app.setPointerSelectors({'oh.drive_oil.1':'rise'});
 assert.equal(snap.pointers.driveOil1.channel,'rise');
 assert.equal(snap.pointers.driveOil1.liveNeedleAuthorized,false);
});
