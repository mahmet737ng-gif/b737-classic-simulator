'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const Core=require('../engine/flight/flight-scenario-core-v1.js');
const Guidance=require('../engine/afds/fcc-flight-guidance-v1.js');
const Sources=require('../panel-mosaic-lab/cockpit/unified-efis-sources-v1.js');
const WMM=require('../engine/efis/wmm2025-magnetic-model-v1.js');
const Network=require('../engine/runtime/avionics-data-network-v1.js');
const Computer=require('../engine/integration/avionics-fmc-computer-v1.js');
const read=file=>fs.readFileSync(path.join(__dirname,'..',file),'utf8');
function fixture(vertical='LVL_CHG',altitudeFt=10182){
 let now=10000,timer,ready,frame=null,fccState=Guidance.createState(),failure=null;
 const listeners=new Map(),elements=new Map(),captures=[],warnings=[];
 const node=()=>({value:'',dataset:{},disabled:false,textContent:'',addEventListener(){},setAttribute(){},appendChild(){},replaceChildren(){},add(){}});
 const doc={readyState:'loading',hidden:false,body:node(),addEventListener(type,fn){if(type==='DOMContentLoaded')ready=fn;},
  getElementById(id){if(id==='flightScenarioDialog')return elements.get(id)||null;
   if(!elements.has(id))elements.set(id,node());return elements.get(id);},
  createElement(){return node();},querySelector:()=>node()};
 class CustomEvent{constructor(type,opt={}){this.type=type;this.detail=opt.detail;}}
 const output={power:true,speedDisplayMode:'IAS',values:{altitude:10000,verticalSpeed:1000,speed:183,heading:185},
  modes:{autopilot:'CMD_B',vertical,lateral:'HDG_SEL'},axisControl:{pitch:'CMD',roll:'CMD'},capture:{pitch:null}};
 const win={document:doc,B737FlightScenarioCoreV1:Core,B737WMM2025V1:WMM,
  B737AvionicsDataNetworkV1:Network,B737AvionicsFmcComputerV1:Computer,
  console:{error(){},warn(...args){warnings.push(args);}},queueMicrotask:()=>{},
  addEventListener(type,fn){if(!listeners.has(type))listeners.set(type,[]);listeners.get(type).push(fn);},
  dispatchEvent(e){for(const fn of listeners.get(e.type)||[])fn(e);},
  setInterval(fn,ms){if(ms===100)timer=fn;return 1;},
  B737ISNCockpitV1:{getECUState:()=>({aircraft:{onGround:false}}),setFlightScenarioContext(){}},
  B737IRSTrainerUnified:{getState(){
   const fresh=frame&&now-frame.sourceTimestampMs<=3000;
   const unit={powered:true,mode:'NAV',phase:'NAV_READY',positionValid:true,position:{lat:35.6,lon:51.4},trueHeadingDeg:185,gsKt:180,trueTrackDeg:185};
   return {units:{L:unit,R:unit},motionSource:fresh?'EXTERNAL_TELEMETRY':'NO_VALID_MOTION',trainerOnly:true};
  }},
  B737McpAFDSBridgeV1:{getOutput:()=>output,observeAltitudeCapture(sample){
   captures.push(sample.stage);output.capture.pitch=sample.stage==='HOLD'?'ALT_HOLD':'ALT_ACQ';}},
  B737UnifiedFccFlightV1:{follow(state){
   if(failure)throw Error(failure);
   const result=Guidance.evaluate(fccState,output,state,{magneticVariationDeg:5});
   fccState=result.state;return result;
  }}
 };
 win.addEventListener('b737:simulator-telemetry',e=>{frame=e.detail;});
 const context={window:win,document:doc,CustomEvent,performance:{now:()=>now},
  Option:class {constructor(label,value){this.label=label;this.value=value;}},
  Date:class extends Date{static now(){return now;}},structuredClone,console:win.console};
 vm.runInNewContext(read('panel-mosaic-lab/cockpit/avionics-network-runtime-v1.js'),context);
 vm.runInNewContext(read('panel-mosaic-lab/cockpit/flight-scenario-panel-v1.js'),context);
 for(const [id,value] of Object.entries({flightAirport:'OIII',flightPreset:'RUNWAY_READY',flightAirGround:'GROUND'}))
  doc.getElementById(id).value=value;
 ready();
 return {win,captures,
  load(){return win.B737UnifiedFlightScenarioV1.loadScenario({airport:'OIII',preset:'MANUAL',airborne:true,
   altitudeFt,speedKt:183,headingDeg:185,vsFpm:Math.abs(altitudeFt-10000)<30?0:vertical==='VS'?1000:-1000});},
  advance(ms){now+=ms;timer();win.B737UnifiedAvionicsNetworkV1.refresh();},
  health(seat){return Sources.resolve(win.B737UnifiedAvionicsNetworkV1.getSnapshot(),seat,{}, {1:true,2:true}).health;},
  fail(message){failure=message;}};
}
function boot(vertical,altitude){const f=fixture(vertical,altitude);f.load();return f;}
for(const vertical of ['LVL_CHG','VS'])test(vertical+' altitude acquisition keeps both EFIS sides live beyond IRS expiry',()=>{
 const f=boot(vertical,vertical==='VS'?9818:10182);
 for(let i=0;i<50;i++)f.advance(100);
 assert.ok(f.captures.includes('ACQUIRE'));
 assert.equal(f.win.B737UnifiedFlightScenarioV1.getDiagnostics().tickErrorCount,0);
 assert.ok(f.win.B737UnifiedFlightScenarioV1.getState().elapsedSec>4);
 for(const seat of ['CAPT','FO']){
  const h=f.health(seat);
  assert.equal(h.attitudeValid,true);assert.equal(h.trackDisplayValid,true);
  assert.equal(h.adcQuality,'VALID');assert.equal(h.radioAltQuality,'VALID');
 }
});
test('altitude HOLD confirmation reaches the existing MCP bridge',()=>{
 const f=boot('LVL_CHG',10010);f.advance(100);
 assert.deepEqual(f.captures,['ACQUIRE','HOLD']);
});
test('an FCC exception stays diagnosable while IRS, ADC and RA telemetry remain fresh, then recovers',()=>{
 const f=boot('LVL_CHG',10182);f.fail('FCC_TEST_FAILURE');
 for(let i=0;i<50;i++)f.advance(100);
 const diag=f.win.B737UnifiedFlightScenarioV1.getDiagnostics();
 assert.ok(diag.tickErrorCount>0);assert.match(diag.lastTickError.message,/FCC_TEST_FAILURE/);
 for(const seat of ['CAPT','FO'])assert.equal(f.health(seat).attitudeValid,true);
 assert.equal(f.health('CAPT').adcQuality,'VALID');
 assert.equal(f.health('FO').radioAltQuality,'VALID');
 f.fail(null);f.advance(300);assert.ok(f.captures.includes('ACQUIRE'));
 f.win.B737UnifiedFlightScenarioV1.pause(true);
 const elapsed=f.win.B737UnifiedFlightScenarioV1.getState().elapsedSec;
 for(let i=0;i<50;i++)f.advance(100);
 assert.equal(f.win.B737UnifiedFlightScenarioV1.getState().elapsedSec,elapsed);
 assert.equal(f.health('CAPT').attitudeValid,true);
});
