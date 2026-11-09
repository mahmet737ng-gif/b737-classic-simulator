'use strict';
/* B737 Classic speed tape FCOM 10.30 / 10.40 + Chapter 4 regression.
 * Run: node engine/efis/classic-speed-tape-engine-v1.test.cjs
 */
const assert=require('node:assert/strict');
const E=require('./classic-speed-tape-engine-v1.js');
const R=require('../../panel-mosaic-lab/cockpit/eadi-speed-tape-v1.js');
const Flap=require('./classic-flap-speed-profile-v1.js');
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
// Explicit AFDS/FMC authority cannot be inferred from an arbitrary MCP knob.
let a=E.initialState();
a=apply(a,{type:'MCP',powered:true,displayBlank:false,selectedCasKt:230,speedDisplayMode:'IAS'});
a=apply(a,{type:'FMC',valid:true,commandCasKt:245,grossWeightAvailable:true});
assert.equal(E.view(a).command?.source,'MCP');
a=apply(a,{type:'COMMAND_AUTHORITY',source:'FMC'});
assert.equal(E.view(a).command?.speedKt,245);
a=apply(a,{type:'COMMAND_AUTHORITY',source:'NONE'});
assert.equal(E.view(a).command,null);
a=apply(a,{type:'COMMAND_AUTHORITY',source:'MCP'});
assert.equal(E.view(a).command?.speedKt,230);
assert.throws(()=>apply(a,{type:'COMMAND_AUTHORITY',source:'GUESS'}),/INVALID_COMMAND_AUTHORITY/);
a=apply(a,{type:'LIMITS',valid:true,vmoMmoCasKt:300,
 minimumAfdsKt:180,minimumManeuverKt:190,stickShakerKt:160});
a=apply(a,{type:'CONFIG',gearExtended:false,flapsPosition:0});
assert.equal(E.view(a).speedProtection.active,false);
a=apply(a,{type:'MCP',powered:true,displayBlank:false,selectedCasKt:150,speedDisplayMode:'IAS'});
assert.equal(E.view(a).speedProtection.effectiveKt,180);
assert.equal(E.view(a).speedProtection.reason,'MINIMUM_AFDS_SPEED');
assert.equal(E.view(a).marks.minimumManeuverKt,190);
assert.equal(E.view(a).marks.stickShakerKt,160);
a=apply(a,{type:'MCP',powered:true,displayBlank:false,selectedCasKt:330,speedDisplayMode:'IAS'});
assert.equal(E.view(a).speedProtection.effectiveKt,300);
assert.equal(E.view(a).speedProtection.reason,'VMO_MMO');
// Regression: 0..45 actual CAS anchors the visible tape at 45.
for(const speed of [0,12.5,44.9,45]){
 let low=E.initialState();
 low=apply(low,{type:'ADC',valid:true,casKt:speed,timeMs:1000});
 const display=E.view(low);
 assert.equal(display.casKt,speed);
 assert.equal(display.tapeCenterKt,45);
 assert.equal(display.lowSpeedDefault,true);
 assert.equal(display.rollingDigitsVisible,false);
}
let high=E.initialState();
high=apply(high,{type:'ADC',valid:true,casKt:45.1,timeMs:1000});
assert.equal(E.view(high).lowSpeedDefault,false);
assert.equal(E.view(high).rollingDigitsVisible,true);
assert.equal(E.view(high).tapeCenterKt,45.1);
// Owner-supplied flap schedule must show the band independently of
// FMC high-speed buffet and never leak into AFDS speed-control authority.
for(const detent of [1,2,5,10,15,25,30,40]){
 const row=Flap.get(detent);
 let ss=E.initialState();
 ss=apply(ss,{type:'TRAINING_FLAP_PROFILE',source:'INSTRUCTOR_VISUAL_DETENT',
  detent,maximumKt:row.maximumKt,bufferKt:row.bufferKt});
 const result=E.view(ss);
 assert.equal(result.marks.trainingFlapLimit.maximumKt,row.maximumKt);
 assert.equal(result.marks.trainingFlapLimit.detent,detent);
 assert.equal(result.marks.flapBuffer?.bufferKt??null,row.bufferKt);
 if(row.bufferKt!==null)assert.equal(result.marks.flapBuffer.lowerKt,row.bufferStartKt);
  assert.equal(result.speedProtection.maximumKt,null);
 assert.equal(result.coverage.complete,false);
}
let flap30=E.initialState();
flap30=apply(flap30,{type:'TRAINING_FLAP_PROFILE',source:'INSTRUCTOR_VISUAL_DETENT',
 detent:30,maximumKt:180,bufferKt:25});
assert.equal(E.view(flap30).marks.flapBuffer.lowerKt,155);
flap30=apply(flap30,{type:'TRAINING_FLAP_PROFILE',source:'INSTRUCTOR_VISUAL_DETENT',
 detent:30,maximumKt:185,bufferKt:25});
assert.equal(E.view(flap30).marks.flapBuffer.lowerKt,160);
assert.throws(()=>apply(flap30,{type:'TRAINING_FLAP_PROFILE',
 source:'SIMULATOR_TELEMETRY',detent:30,maximumKt:180,bufferKt:25}),/INVALID_TRAINING_FLAP_SOURCE/);
let verified=E.initialState();
verified=apply(verified,{type:'CONFIG',flapsPosition:5,gearExtended:false});
verified=apply(verified,{type:'LIMITS',valid:true,vmoMmoCasKt:340,
 flapPlacardKt:225,flapBufferKt:15});
assert.equal(E.view(verified).marks.maximumOperatingKt,225);
assert.equal(E.view(verified).marks.flapBuffer.lowerKt,210);
verified=apply(verified,{type:'LIMITS',valid:true,vmoMmoCasKt:200,
 flapPlacardKt:225,flapBufferKt:15});
assert.equal(E.view(verified).marks.maximumOperatingKt,200);
assert.equal(E.view(verified).marks.flapBuffer,null,
 'no flap buffer when VMO/MMO is a lower controlling limit');
const calls=[];
const ctx=new Proxy({},{
 get(target,key){return key in target?target[key]:
  (...args)=>{calls.push([String(key),...args])}},
 set(target,key,value){target[key]=value;return true}
});
R.draw(ctx,E.view(t));assert.equal(calls.some(c=>c[0]==='fillText'),false,'No IAS means no displayed digits without flags');
t=apply(t,{type:'ADC',valid:true,casKt:227.5,timeMs:100});
R.draw(ctx,E.view(t));assert.ok(calls.some(c=>c[0]==='fillText'));
calls.length=0;
let stopped=E.initialState();
stopped=apply(stopped,{type:'ADC',valid:true,casKt:0,timeMs:250});
R.draw(ctx,E.view(stopped));
assert.equal(calls.filter(c=>c[0]==='fillText'&&c[1]==='45').length,1);
assert.ok(calls.some(c=>c[0]==='strokeRect'),'magnified fixed 45 window');
assert.ok(!calls.some(c=>c[0]==='fillText'&&c[1]==='40'),'no 40-label collision');
calls.length=0;
let trainingDisplay=E.initialState();
trainingDisplay=apply(trainingDisplay,{type:'TRAINING_FLAP_PROFILE',
 source:'INSTRUCTOR_VISUAL_DETENT',detent:30,maximumKt:180,bufferKt:25});
trainingDisplay=apply(trainingDisplay,{type:'TRAINING_CAS',origin:'TRAINING_SCENARIO',casKt:174,timeMs:1000});
R.draw(ctx,E.view(trainingDisplay));
assert.ok(calls.some(x=>x[0]==='fillText'&&x[1]==='TRN FL30'));
// Overspeed yellow buffer is inverted L (┘): only the LOWER arm
// points LEFT toward the scale, and the UPPER arm is removed.
const top=391-(180-174)*5.2,bottom=391-(155-174)*5.2;
const near=(a,b)=>Math.abs(a-b)<1e-6;
const hasLine=(x1,y1,x2,y2)=>calls.some((c,i)=>
 c[0]==='moveTo'&&near(c[1],x1)&&near(c[2],y1)&&
 calls[i+1]?.[0]==='lineTo'&&near(calls[i+1][1],x2)&&near(calls[i+1][2],y2));
assert.ok(hasLine(221,top,221,bottom),'HIGH bracket stem on RIGHT');
assert.ok(hasLine(209,bottom,221,bottom),'HIGH lower arm points LEFT');
assert.ok(!hasLine(209,top,221,top),'HIGH bracket has NO upper tooth');
assert.ok(!calls.some(c=>c[0]==='fillRect'&&c[1]===233&&c[3]===15),
 'flap buffer must not be filled');
// Red block placard matches the square/rectangular EADI reference; do NOT
// confuse it with the diagonal VMO barber pole or yellow pre-maximum buffer.
assert.ok(calls.some(x=>x[0]==='fillRect'&&x[1]===201&&x[3]===12&&x[4]===12),
 'Flap red squares must adjoin the right of numeric speed axis');
const blockCount=calls.filter(x=>x[0]==='fillRect'&&x[1]===201&&x[3]===12&&x[4]===12).length;
assert.ok(blockCount>=2,'More than one separated red block above the maximum');
calls.length=0;
// Stall yellow buffer is the OPPOSITE (┌). Upper tooth RIGHT into tape,
// no lower tooth; never fill the maneuver-to-stick-shaker region.
let stall=E.initialState();
stall=apply(stall,{type:'CONFIG',gearExtended:false,flapsPosition:0});
stall=apply(stall,{type:'LIMITS',valid:true,vmoMmoCasKt:340,
 minimumManeuverKt:165,stickShakerKt:140});
stall=apply(stall,{type:'ADC',valid:true,casKt:153,timeMs:1000});
R.draw(ctx,E.view(stall));
const upper=391-(165-153)*5.2,lower=391-(140-153)*5.2;
assert.ok(hasLine(201,upper,201,lower),'STALL stem immediately right of axis');
assert.ok(hasLine(201,upper,213,upper),'STALL UPPER tooth points INTO tape');
assert.ok(!hasLine(201,lower,213,lower),'STALL lower tooth absent');
assert.ok(!calls.some(c=>c[0]==='fillRect'&&c[1]===234&&c[3]===15),
 'STALL yellow range not filled');
calls.length=0;
// No flap buffer: FL40 zero kt, FL1 unspecified.
for(const [detent,maximumKt,bufferKt] of [[40,158,0],[1,230,null]]){
 const limited=apply(apply(E.initialState(),{type:'TRAINING_FLAP_PROFILE',
  source:'INSTRUCTOR_VISUAL_DETENT',detent,maximumKt,bufferKt}),
  {type:'TRAINING_CAS',origin:'TRAINING_SCENARIO',casKt:maximumKt-4,timeMs:1000});
 R.draw(ctx,E.view(limited));
 assert.ok(!calls.some(c=>c[0]==='moveTo'&&c[1]===221),
  'zero/unspecified flap buffer must not produce bracket');
 calls.length=0;
}
let vmoOnly=E.initialState();
vmoOnly=apply(vmoOnly,{type:'CONFIG',gearExtended:false,flapsPosition:0});
vmoOnly=apply(vmoOnly,{type:'LIMITS',valid:true,vmoMmoCasKt:180});
vmoOnly=apply(vmoOnly,{type:'ADC',valid:true,casKt:175,timeMs:1000});
R.draw(ctx,E.view(vmoOnly));
assert.ok(!calls.some(x=>x[0]==='fillRect'&&x[1]===201&&x[3]===12&&x[4]===12),
 'VMO/MMO retains its own diagonal pattern');

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
  return topic==='airdata.adc1'?{quality:'VALID',origin:'SIMULATOR_TELEMETRY',receivedAtMs:5000,
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