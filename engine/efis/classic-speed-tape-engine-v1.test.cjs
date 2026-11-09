'use strict';
/* B737 Classic speed tape FCOM 10.30 / 10.40 + Chapter 4 regression.
 * Run: node engine/efis/classic-speed-tape-engine-v1.test.cjs
 */
const assert=require('node:assert/strict');
const E=require('./classic-speed-tape-engine-v1.js');
const R=require('../../panel-mosaic-lab/cockpit/eadi-speed-tape-v1.js');
const apply=(state,event)=>E.transition(state,event);
let s=E.initialState('CAPT');
assert.equal(E.view(s).casKt,null);
assert.equal(E.view(s).flags.SPD,false,'Missing telemetry is UNKNOWN, not confirmed SPD failure');
assert.throws(()=>apply(s,{type:'ADC',valid:true,casKt:800,timeMs:0}),/INVALID_CAS/);
s=apply(s,{type:'ADC',valid:true,casKt:227,timeMs:1000,pressureAltitudeFt:3000});
assert.equal(E.view(s).trend,null);
s=apply(s,{type:'ADC',valid:true,casKt:227.5,timeMs:2000,pressureAltitudeFt:3000});
assert.equal(E.view(s).trend.delta10Kt,5);
s=apply(s,{type:'ADC',valid:true,casKt:227.85,timeMs:3000,pressureAltitudeFt:3000});
assert.ok(E.view(s).trend,'Trend stays present at 3.5 kt');
s=apply(s,{type:'ADC',valid:true,casKt:228.1,timeMs:4000,pressureAltitudeFt:3000});
assert.equal(E.view(s).trend,null,'Trend disappears below 3 kt');
assert.throws(()=>apply(s,{type:'ADC',valid:true,casKt:230,timeMs:3999}),/STALE_ADC/);
s=apply(s,{type:'MCP',powered:false,displayBlank:false,selectedCasKt:235,speedDisplayMode:'IAS'});
assert.equal(E.view(s).command,null,'Unpowered MCP never supplies command bug');
s=apply(s,{type:'MCP',powered:true,displayBlank:false,selectedCasKt:235,speedDisplayMode:'IAS'});
assert.equal(E.view(s).command?.speedKt,235);
assert.equal(E.view(s).commandedPosition,'ON_TAPE');
s=apply(s,{type:'MCP',powered:true,displayBlank:true,selectedCasKt:235,speedDisplayMode:'IAS'});
assert.equal(E.view(s).command,null,'FMC authority requires observed FMC speed');
s=apply(s,{type:'FMC',valid:true,commandCasKt:251,v1Kt:132,vrKt:136,
 selectedVrefKt:140,landingFlaps:30,grossWeightAvailable:true});
assert.equal(E.view(s).command?.source,'FMC');
assert.equal(E.view(s).marks.vrefKt,140);
s=apply(s,{type:'CONFIG',gearExtended:true,flapsPosition:5,flapsRetracting:false,
 inFlight:true,phase:'APPROACH'});
s=apply(s,{type:'LIMITS',valid:true,vmoMmoCasKt:340,gearPlacardKt:270,
 flapPlacardKt:240,minimumManeuverKt:165,minimumAfdsKt:128,stickShakerKt:148,
 highSpeedBuffetKt:310,nextFlapPlacardKt:225});
assert.equal(E.view(s).marks.maximumOperatingKt,240,'Lowest applicable limit wins');
assert.equal(E.view(s).marks.highSpeedBuffetKt,null,'Buffet not shown below FL250');
s=apply(s,{type:'ADC',valid:true,casKt:230,timeMs:5000,pressureAltitudeFt:27000});
assert.equal(E.view(s).marks.highSpeedBuffetKt,310);
assert.equal(E.view(s).marks.nextFlapPlacardKt,225);
s=apply(s,{type:'CONFIG',flapsRetracting:true});
assert.equal(E.view(s).marks.nextFlapPlacardKt,null);
s=apply(s,{type:'CONFIG',flapsPosition:0,flapsRetracting:false});
assert.equal(E.view(s).marks.maximumOperatingKt,270,'Gear placard still applies');
s=apply(s,{type:'FAILURES',speedLimit:true});
assert.equal(E.view(s).marks.maximumOperatingKt,null);
assert.equal(E.view(s).marks.stickShakerKt,null);
assert.equal(E.view(s).flags.SPD_LIM,true);
assert.ok(E.view(s).casKt!==null,'SPD LIM must not kill IAS');
s=apply(s,{type:'FAILURES',speed:true});
assert.equal(E.view(s).flags.SPD,true);
assert.equal(E.view(s).casKt,null);
s=apply(s,{type:'FAILURES',speed:false,speedLimit:false});
s=apply(s,{type:'ADC_TIMEOUT',nowMs:7101});
assert.equal(E.view(s).quality,'UNKNOWN');
assert.equal(E.view(s).flags.SPD,false,'Telemetry timeout does not prove ADC hardware failure');
let t=E.initialState();
t=apply(t,{type:'LIMITS',valid:true,vmoMmoCasKt:340});
assert.equal(E.view(t).marks.maximumOperatingKt,null,'Do not publish red pole with unknown gear/flaps');
t=apply(t,{type:'CONFIG',gearExtended:false,flapsPosition:0});
assert.equal(E.view(t).marks.maximumOperatingKt,340);
const calls=[];
const ctx=new Proxy({},{
 get(target,key){return key in target?target[key]:
  (...args)=>{calls.push([String(key),...args])}},
 set(target,key,value){target[key]=value;return true}
});
R.draw(ctx,E.view(t));assert.equal(calls.length,0,'No IAS means no tape without flags');
t=apply(t,{type:'ADC',valid:true,casKt:227.5,timeMs:100});
R.draw(ctx,E.view(t));assert.ok(calls.some(c=>c[0]==='fillText'));
const listeners={},layer={},drawn={CAPT:0,FO:0};
const fake={
 B737ClassicSpeedTapeEngineV1:E,
 B737UnifiedEADIStage1:{
  registerLayer(seat,slot,cb){assert.equal(slot,'speedTape');layer[seat]=cb;return()=>{}},
  snapshot:()=>({stations:{CAPT:{pitch:0,bank:0},FO:{pitch:0,bank:0}}}),
  setAttitude(seat){drawn[seat]++;layer[seat](ctx)}
 },
 B737McpAFDSBridgeV1:{getOutput:()=>({schema:'B737_MCP_AFDS_OUTPUT_V1',
  power:true,speedDisplayMode:'IAS',displayBlank:{speed:false},values:{speed:245}})},
 B737UnifiedAvionicsNetworkV1:{getSignal(topic){
  return topic==='airdata.adc1'?{quality:'VALID',receivedAtMs:5000,
   value:{sensorValid:true,casKt:229,pressureAltitudeFt:3000}}:
   {quality:'UNKNOWN',value:null};
 }},
 addEventListener(key,fn){(listeners[key]||=[]).push(fn)},
 setTimeout(){return 42},clearTimeout(){},
 console:{warn(){}}
};
assert.equal(R.bind(fake),true);
assert.equal(R.getView('CAPT').casKt,229);
assert.equal(R.getView('FO').casKt,null);
assert.equal(R.getView('FO').command?.speedKt,245,'MCP goes to both displays');
assert.ok(drawn.CAPT&&drawn.FO);
assert.equal(R.observe('FO',{type:'CONFIG',gearExtended:false,flapsPosition:0}).seat,'FO');
console.log('PASS — Classic speed tape independent ADC, sources, limits, failures, hysteresis and EADI wiring');