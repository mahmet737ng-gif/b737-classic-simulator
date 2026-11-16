'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const code=fs.readFileSync(path.resolve(__dirname,'../panel-mosaic-lab/cockpit/instrument-lab/unified.js'),'utf8');
function boot(mcpValues){
 const renders=[],created=[],events={};
 const host={querySelector:()=>null,querySelectorAll:()=>[]};
 const geometry={altimeter:{size:[1000,1000],pivot:[500,500]},
  airspeed:{size:[700,700],pivot:[350,350]},
  rmi:{size:[600,700],pivot:[300,300]},
  ivsi:{size:[600,600],pivot:[300,300]}};
 const photos={geometry,defaults:{ias:0,altitude:0,orangeBugs:[155,165],bugs:[80,95,110,120],
  altitudeBug:2000,qnh:1013.25,standbyQnh:1013.25},
  calibratedSpeed:()=>200,
  createGauge:(parent,kind,opts)=>{
   created.push({kind,opts});return {canvas:{parentNode:parent,style:{},dataset:{},isConnected:true,
    setAttribute(){},remove(){this.isConnected=false;this.parentNode=null;}},render:args=>renders.push({kind,options:opts,state:args})};
  }};
 const source={captain:{piece:'captain',width:1600,height:1600,
  gauges:{altimeter:{x:500,y:500,radius:200},verticalSpeed:{x:500,y:500,radius:200},rmi:{x:500,y:500,radius:200}}},
  firstOfficerOuter:{piece:'fo-outer',width:1600,height:1600,gauges:{rmi:{x:500,y:500,radius:200}}},
  firstOfficerInner:{piece:'fo-inner',width:1600,height:1600,gauges:{altimeter:{x:500,y:500,radius:200},
   verticalSpeed:{x:500,y:500,radius:200}}}};
 const snapshot={'mcp.state':{quality:'VALID',value:mcpValues},
  'airdata.adc1':{quality:'VALID',value:{casKt:190}},
  'airdata.adc2':{quality:'VALID',value:{casKt:190}}};
 const win={
  B737PhotoGauges:photos,B737FlightNeedlesModel:{sources:source},
  B737PhotoGaugeRegistrationV1:require('../panel-mosaic-lab/cockpit/instrument-lab/photo-gauge-registration-v1.js'),
  B737AirspeedPointersModel:{source:{piece:'captain',width:1600,height:1600},
    pivot:{x:400,y:400},pointers:{airspeed:{tipRadius:200}},
    firstOfficer:{piece:'fo-inner',width:1600,height:1600,pivot:{x:400,y:400},tipRadius:200}},
  B737UnifiedFlightGaugeBridgeV1:{getState:()=>({sample:{altitudeFt:6000,
    standbyAltitudeFt:6000,indicatedSpeedKt:190,verticalSpeedFpm:0}})},
  B737UnifiedFlightDisplayMotionV1:{sample:()=>null},
  B737UnifiedFlightNeedles:{getAngles:()=>({captain:{},firstOfficer:{}})},
  B737UnifiedAirspeedPointers:{getValues:()=>({captain:{},firstOfficer:{}})},
  B737UnifiedAvionicsNetworkV1:{getSnapshot:()=>snapshot},
  B737UnifiedEfisSources:{project:()=>({heading:100,bearings:[]})},
  addEventListener:(k,f)=>events[k]=f
 };
 const document={readyState:'complete',documentElement:{dataset:{engineIndication:'EIS'}},
  querySelector:q=>q.startsWith('.texture-piece')?host:null};
 vm.runInNewContext(code,{window:win,document,requestAnimationFrame:f=>f(),console});
 return {renders,created,snapshot,win,refresh:()=>events['b737:avionics-data']?.({detail:{topic:'mcp.state'}})};
}
test('both orange target bugs follow selected IAS on powered MCP, not measured IAS',()=>{
 const t=boot({powered:true,speedBlank:false,speedDisplayMode:'IAS',selectedSpeedKt:240});
 const air=t.renders.filter(r=>r.kind==='airspeed');
 assert.equal(air.length,2);
 for(const x of air){
  assert.equal(x.state.ias,190);
  assert.deepEqual(Array.from(x.state.orangeBugs),[240,240]);
  assert.equal(x.state.autoCursor,240);
  assert.equal(x.options.lockOrangeBugs,true);
 }
});
test('MCP speed change 240 to 270 moves both orange targets; selected speed does not move needle',()=>{
 const t=boot({powered:true,speedBlank:false,speedDisplayMode:'IAS',selectedSpeedKt:240});
 t.snapshot['mcp.state'].value.selectedSpeedKt=270;
 t.refresh();
 const air=t.renders.filter(r=>r.kind==='airspeed').slice(-2);
 for(const r of air){
  assert.deepEqual(Array.from(r.state.orangeBugs),[270,270]);
  assert.equal(r.state.ias,190);
 }
});
test('speed window blank or MCP not powered hides target bugs rather than freezing old values',()=>{
 const t=boot({powered:true,speedBlank:false,speedDisplayMode:'IAS',selectedSpeedKt:240});
 t.snapshot['mcp.state'].value.speedBlank=true;t.refresh();
 for(const r of t.renders.filter(x=>x.kind==='airspeed').slice(-2))
  assert.deepEqual(Array.from(r.state.orangeBugs),[null,null]);
});
