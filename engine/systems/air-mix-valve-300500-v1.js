/* B737-300/500 ATA 21 cabin-temperature and air mix valve training plant.
 * Independent CONT/PASS temperature sensors, proportional AUTO demand,
 * physical 0..1 valve travel, thermal inertia and safety overrides.
 * FCOM 2.10 / 2.30 establishes functionality; exact detent temperatures,
 * thermal time constants and actuator rates are explicitly SIM estimates.
 */
(function(root,factory){
 'use strict';const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.B737AirMixValve300500V1=api;
})(typeof globalThis==='object'?globalThis:null,function(){
 'use strict';
 const SIDES=Object.freeze(['CONT','PASS']);
 const AUTO_TARGETS=Object.freeze({
  'AUTO 16':16,'AUTO 18':18,'AUTO 20':20,'AUTO 22':22,
  'AUTO 24':24,'AUTO 26':26,
  // Compatibility with original five-detent layout and 737-400 mirror.
  'AUTO COOL':20,'AUTO NORM':22,'AUTO WARM':24
 });
 const SELECTORS=Object.freeze(['MANUAL COOL',...Object.keys(AUTO_TARGETS),'MANUAL WARM']);
 const GAUGES=Object.freeze({
  CONT:Object.freeze({x:226,y:423,selector:'control-cabin-temp',pack:'pack-l'}),
  PASS:Object.freeze({x:1023,y:423,selector:'pass-cabin-temp',pack:'pack-r'})
 });
 const SOURCE=Object.freeze({width:1254,height:1254,piece:'OH20'});
 const CONFIG=Object.freeze({
  fullTravelSeconds:90,benchFullTravelSeconds:10,deadbandC:0.45,
  ductLimitC:60,overheatC:88,
  coldSupplyC:12,hotSupplyC:32,neutralC:22,temperatureTauSeconds:100,
  idleTauSeconds:3600,proportionalGain:0.12,valveTolerance:0.005,
  targetC:AUTO_TARGETS
 });
 const clamp=(n,min=0,max=1)=>Math.max(min,Math.min(max,n));
 const finite=n=>typeof n==='number'&&Number.isFinite(n);
 const copy=x=>({...x});
 function create(){
  return {positions:{CONT:0.5,PASS:0.5},
   temperatures:{CONT:20,PASS:20},
   ductTemperatures:{CONT:22,PASS:22},
   valveDemand:{CONT:0.5,PASS:0.5},
   targetTemperatures:{CONT:22,PASS:22},
   overheatLatched:{CONT:false,PASS:false},
   command:{CONT:'HOLD',PASS:'HOLD'},reason:{CONT:'SENSOR_UNKNOWN',PASS:'SENSOR_UNKNOWN'}};
 }
 function angle(position){return -64+128*clamp(position);}
 function sample(inputs,side){
  const v=inputs?.[side]||{};
  return {selector:SELECTORS.includes(v.selector)?v.selector:'AUTO NORM',
   cabinC:finite(v.cabinC)?v.cabinC:null,ductC:finite(v.ductC)?v.ductC:null,
   packMode:['OFF','AUTO','HIGH'].includes(v.packMode)?v.packMode:null,
   packAirAvailable:typeof v.packAirAvailable==='boolean'?v.packAirAvailable:null,
   actuatorPower:typeof v.actuatorPower==='boolean'?v.actuatorPower:null,
   indicatorPower:typeof v.indicatorPower==='boolean'?v.indicatorPower:null,
   indicatorCB:v.indicatorCB!==false,
   overheat:v.overheat===true,stuck:v.stuck===true,
   benchBypassPack:v.benchBypassPack===true,
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
  const next={positions:copy(state.positions),overheatLatched:copy(state.overheatLatched),
   command:copy(state.command),reason:copy(state.reason),
   temperatures:copy(state.temperatures||{CONT:20,PASS:20}),
   ductTemperatures:copy(state.ductTemperatures||{CONT:22,PASS:22}),
   valveDemand:copy(state.valveDemand||{CONT:0.5,PASS:0.5}),
   targetTemperatures:copy(state.targetTemperatures||{CONT:22,PASS:22})};
  const dt=finite(elapsedSeconds)?clamp(elapsedSeconds,0,3600):0;
  for(const side of SIDES){
   const v=sample(inputs,side),oldPos=clamp(next.positions[side]);
   const temperature=finite(v.cabinC)?v.cabinC:finite(next.temperatures[side])?next.temperatures[side]:20;
   const target=finite(v.targetC)?v.targetC:(AUTO_TARGETS[v.selector]??null);
   let desired=oldPos,reason='HOLD';
   if(v.overheat||(v.ductC!==null&&v.ductC>=CONFIG.overheatC))next.overheatLatched[side]=true;
   if(next.overheatLatched[side]){desired=0;reason='DUCT_OVERHEAT_LATCH';}
   else if(v.packMode==='OFF'&&!v.benchBypassPack){desired=0;reason='PACK_OFF_FULL_COLD';}
   else if(v.ductC!==null&&v.ductC>=CONFIG.ductLimitC){desired=0;reason='DUCT_LIMIT_COOL';}
   else if(v.selector==='MANUAL COOL'){desired=0;reason='MANUAL_COOL';}
   else if(v.selector==='MANUAL WARM'){desired=1;reason='MANUAL_WARM';}
   else if(target!==null){
    const error=target-temperature;
    // Feed-forward supplies the heat required to HOLD each setpoint; error
    // adds proportional effort, so large differences command more travel.
    desired=clamp(0.5+(target-CONFIG.neutralC)/(CONFIG.hotSupplyC-CONFIG.coldSupplyC)
     +CONFIG.proportionalGain*error);
    reason=Math.abs(error)<=CONFIG.deadbandC?'AUTO_DEADBAND':error>0?'AUTO_HEAT_DEMAND':'AUTO_COOL_DEMAND';
   }else reason='SENSOR_UNKNOWN';
   let direction=Math.abs(desired-oldPos)<=CONFIG.valveTolerance?0:Math.sign(desired-oldPos);
   // Small sensor excursions near the established setpoint do not hunt
   // the actuator. A different demanded equilibrium is still attainable.
   if(reason==='AUTO_DEADBAND'&&Math.abs(desired-oldPos)<=0.03)direction=0;
   if(v.stuck){direction=0;reason='ACTUATOR_STUCK';}
   else if(v.actuatorPower!==true){direction=0;reason=v.actuatorPower===false?'ACTUATOR_UNPOWERED':'ACTUATOR_POWER_UNKNOWN';}
   const travel=dt/(v.benchBypassPack?CONFIG.benchFullTravelSeconds:CONFIG.fullTravelSeconds);
   const moved=direction?oldPos+Math.sign(desired-oldPos)*Math.min(Math.abs(desired-oldPos),travel):oldPos;
   next.positions[side]=clamp(moved);
   next.valveDemand[side]=desired;
   next.targetTemperatures[side]=target;
   next.command[side]=direction<0?'COLD':direction>0?'HOT':'HOLD';
   next.reason[side]=v.benchBypassPack&&v.packMode==='OFF'&&reason!=='DUCT_OVERHEAT_LATCH'?'BENCH_'+reason:reason;
   const supply=CONFIG.coldSupplyC+(CONFIG.hotSupplyC-CONFIG.coldSupplyC)*next.positions[side];
   next.ductTemperatures[side]=supply;
   // External measured temperature (when supplied) is authoritative.
   // Otherwise integrate cabin temperature only with a running PACK/bench air.
   if(v.cabinC!==null)next.temperatures[side]=v.cabinC;
   else {
    const airflow=(v.packMode!=='OFF'&&v.packAirAvailable!==false)||v.benchBypassPack;
    const equilibrium=airflow?supply:CONFIG.neutralC;
    const tau=airflow?CONFIG.temperatureTauSeconds:CONFIG.idleTauSeconds;
    next.temperatures[side]=clamp(temperature+(equilibrium-temperature)*
     (1-Math.exp(-dt/tau)),-30,70);
   }
  }
  return next;
 }
 function indication(state,inputs,side){
  if(!SIDES.includes(side))throw Error('Invalid valve side');
  const v=sample(inputs,side);
  const valid=v.indicatorPower!==false&&v.indicatorCB&&!v.transmitterFailed;
  return {valid,position:valid?clamp(state.positions[side]):null,
   angle:valid?angle(state.positions[side]):null,
   powerKnown:v.indicatorPower!==null,reason:!v.indicatorCB?'CB_P6-4_D3_OPEN':
    v.indicatorPower===false?'DC_BUS_2_UNPOWERED':
    v.transmitterFailed?'TRANSMITTER_FAILED':v.indicatorPower===null?'INDICATION_POWER_UNKNOWN':'OK'};
 }
 return Object.freeze({SIDES,SELECTORS,AUTO_TARGETS,GAUGES,SOURCE,CONFIG,create,step,indication,resetOverheat,angle,sample});
});