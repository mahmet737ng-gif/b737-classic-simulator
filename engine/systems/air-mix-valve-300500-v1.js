/* B737-300/500 ATA 21 air mix valves — training-only deterministic model.
 * 0 = full COLD, 1 = full HOT. Independent physical and indication power.
 * Manual references: 737 Classic FCOM Air Systems 2.10.4-6; Lufthansa ATA 21-60.
 * Do not treat calibration setpoints/travel time as Boeing-certified values.
 */
(function(root,factory){
 'use strict';const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.B737AirMixValve300500V1=api;
})(typeof globalThis==='object'?globalThis:null,function(){
 'use strict';
 const SIDES=Object.freeze(['CONT','PASS']);
 const SELECTORS=Object.freeze(['MANUAL COOL','AUTO COOL','AUTO NORM','AUTO WARM','MANUAL WARM']);
 const GAUGES=Object.freeze({
  CONT:Object.freeze({x:224,y:425,selector:'control-cabin-temp',pack:'pack-l'}),
  PASS:Object.freeze({x:1021,y:425,selector:'pass-cabin-temp',pack:'pack-r'})
 });
 const SOURCE=Object.freeze({width:1254,height:1254,piece:'OH20'});
 const CONFIG=Object.freeze({fullTravelSeconds:90,deadbandC:0.5,ductLimitC:60,overheatC:88,
  // Training approximations: actual AUTO knob trim mapping must be calibrated.
  targetC:Object.freeze({'AUTO COOL':20,'AUTO NORM':22,'AUTO WARM':24})});
 const clamp=n=>Math.max(0,Math.min(1,n));
 const finite=n=>typeof n==='number'&&Number.isFinite(n);
 function create(){
  return {positions:{CONT:0.5,PASS:0.5},overheatLatched:{CONT:false,PASS:false},
   command:{CONT:'HOLD',PASS:'HOLD'},reason:{CONT:'SENSOR_UNKNOWN',PASS:'SENSOR_UNKNOWN'}};
 }
 function angle(position){return -55+110*clamp(position);}
 function sample(inputs,side){
  const v=inputs?.[side]||{};
  return {selector:SELECTORS.includes(v.selector)?v.selector:'AUTO NORM',
   cabinC:finite(v.cabinC)?v.cabinC:null,ductC:finite(v.ductC)?v.ductC:null,
   packMode:['OFF','AUTO','HIGH'].includes(v.packMode)?v.packMode:null,
   actuatorPower:typeof v.actuatorPower==='boolean'?v.actuatorPower:null,
   indicatorPower:typeof v.indicatorPower==='boolean'?v.indicatorPower:null,
   indicatorCB:v.indicatorCB!==false,
   overheat:v.overheat===true,stuck:v.stuck===true,
   transmitterFailed:v.transmitterFailed===true,
   targetC:finite(v.targetC)?v.targetC:null};
 }
 function resetOverheat(s,side,inputs){
  if(!SIDES.includes(side))throw Error('Invalid valve side');
  const v=sample(inputs,side);
  if(v.overheat||(v.ductC!==null&&v.ductC>=CONFIG.overheatC))return false;
  s.overheatLatched[side]=false;return true;
 }
 function step(state,inputs,elapsedSeconds){
  const next={positions:{...state.positions},overheatLatched:{...state.overheatLatched},
   command:{...state.command},reason:{...state.reason}};
  const dt=finite(elapsedSeconds)?Math.max(0,Math.min(3600,elapsedSeconds)):0;
  for(const side of SIDES){
   const v=sample(inputs,side);
   if(v.overheat||(v.ductC!==null&&v.ductC>=CONFIG.overheatC))next.overheatLatched[side]=true;
   let direction=0,reason='HOLD';
   if(next.overheatLatched[side]){direction=-1;reason='DUCT_OVERHEAT_LATCH';}
   else if(v.packMode==='OFF'){direction=-1;reason='PACK_OFF_FULL_COLD';}
   else if(v.ductC!==null&&v.ductC>=CONFIG.ductLimitC){direction=-1;reason='DUCT_LIMIT_COOL';}
   else if(v.selector==='MANUAL COOL'){direction=-1;reason='MANUAL_COOL';}
   else if(v.selector==='MANUAL WARM'){direction=1;reason='MANUAL_WARM';}
   else if(v.cabinC!==null){
    const target=v.targetC===null?CONFIG.targetC[v.selector]:v.targetC;
    const error=target-v.cabinC;
    direction=Math.abs(error)<=CONFIG.deadbandC?0:Math.sign(error);
    reason=direction===0?'AUTO_DEADBAND':direction>0?'AUTO_HEAT_DEMAND':'AUTO_COOL_DEMAND';
   }else reason='SENSOR_UNKNOWN';
   if(v.stuck){direction=0;reason='ACTUATOR_STUCK';}
   else if(v.actuatorPower!==true){direction=0;reason=v.actuatorPower===false?'ACTUATOR_UNPOWERED':'ACTUATOR_POWER_UNKNOWN';}
   const previous=clamp(next.positions[side]);
   next.positions[side]=clamp(previous+direction*dt/CONFIG.fullTravelSeconds);
   next.command[side]=direction<0?'COLD':direction>0?'HOT':'HOLD';
   next.reason[side]=reason;
  }
  return next;
 }
 function indication(state,inputs,side){
  if(!SIDES.includes(side))throw Error('Invalid valve side');
  const v=sample(inputs,side);
  // Missing power evidence != an invented zero or full-cold indication.
  const valid=v.indicatorPower!==false&&v.indicatorCB&&!v.transmitterFailed;
  return {valid,position:valid?clamp(state.positions[side]):null,
   angle:valid?angle(state.positions[side]):null,
   powerKnown:v.indicatorPower!==null,reason:!v.indicatorCB?'CB_P6-4_D3_OPEN':
    v.indicatorPower===false?'DC_BUS_2_UNPOWERED':
    v.transmitterFailed?'TRANSMITTER_FAILED':v.indicatorPower===null?'INDICATION_POWER_UNKNOWN':'OK'};
 }
 return Object.freeze({SIDES,SELECTORS,GAUGES,SOURCE,CONFIG,create,step,indication,resetOverheat,angle,sample});
});
