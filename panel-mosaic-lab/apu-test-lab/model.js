/* APU-LAB-0001 | Standalone instructor-only protective monitor.
 * No effectivity-specific certified thresholds are asserted here.
 * Adjustable demonstration thresholds MUST be reconciled to installed APU.
 * The existing live ECU is never replaced: this model observes it.
 */
(function(root,factory){'use strict';const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.B737APUProtectiveLabV1=api;})(typeof globalThis!=='undefined'?globalThis:null,function(){
 'use strict';
 const faults=Object.freeze([
  {id:'OVERSPEED',label:'APU OVERSPEED',group:'PROTECTION'},
  {id:'HIGH_OIL_TEMP',label:'HIGH OIL TEMPERATURE',group:'PROTECTION'},
  {id:'LOW_OIL_PRESSURE',label:'LOW OIL PRESSURE',group:'PROTECTION'},
  {id:'OIL_PUMP_FAILURE',label:'OIL PUMP FAILURE',group:'OIL'},
  {id:'OIL_LEAK',label:'OIL LEAK / DEPLETION',group:'OIL'},
  {id:'OIL_TEMP_SENSOR',label:'OIL TEMPERATURE SENSOR FAILURE',group:'SENSORS'},
  {id:'SPEED_SENSOR',label:'APU SPEED SENSOR FAILURE',group:'SENSORS'},
  {id:'EGT_SENSOR',label:'DUAL EGT SENSOR FAILURE',group:'SENSORS'},
  {id:'GENERATOR_FAILURE',label:'APU GENERATOR FAILURE',group:'ELECTRICAL'},
  {id:'BLEED_FAILURE',label:'APU BLEED CONTROL FAILURE',group:'PNEUMATIC'},
  {id:'ECU_DC_LOSS',label:'APU ECU DC POWER LOSS',group:'CONTROL'},
  {id:'INLET_DOOR',label:'INLET DOOR DISAGREEMENT',group:'CONTROL'},
  {id:'NO_ACCELERATION',label:'START · NO ACCELERATION',group:'START'},
  {id:'NO_FLAME',label:'START · NO LIGHT-OFF',group:'START'},
  {id:'OVERSPEED_SELF_TEST',label:'OVERSPEED SHUTDOWN TEST FAIL',group:'CONTROL'}
 ]);
 const defaults=Object.freeze({overspeedPct:110,highOilTempC:143,highOilHoldSec:10,
  lowOilTripPsi:30,lowOilHoldSec:20,normalOilTempC:82});
 const clip=(x,a,b)=>Math.max(a,Math.min(b,x));
 const smooth=(v,target,dt,seconds)=>target+(v-target)*Math.exp(-dt/seconds);
 const isNum=x=>typeof x==='number'&&Number.isFinite(x);
 function initial(){return {time:0,active:[],trip:null,hold:{overspeed:0,oilTemp:0,oilPressure:0,start:0},
  values:{rpmPct:0,egtC:0,oilTempC:defaults.normalOilTempC,oilPressurePsi:0},
  limits:{...defaults},logs:[],scenario:'NORMAL',lastPhase:'OFF'};}
 function setFault(state,id,on){
  if(!faults.some(x=>x.id===id)||typeof on!=='boolean')throw Error('Unknown APU failure');
  return {...state,active:on?Array.from(new Set([...state.active,id])):state.active.filter(x=>x!==id),
   logs:[...state.logs.slice(-39),{time:state.time,text:(on?'INJECT ':'CLEAR ')+id}]};
 }
 function setLimits(state,limits){
  const next={...state.limits};for(const [key,value] of Object.entries(limits)){
   if(!Object.hasOwn(defaults,key)||!isNum(value))throw Error('Invalid APU limit '+key);
   const bounds={overspeedPct:[100,140],highOilTempC:[100,200],highOilHoldSec:[0,120],
    lowOilTripPsi:[1,80],lowOilHoldSec:[0,120],normalOilTempC:[20,140]}[key];
   if(value<bounds[0]||value>bounds[1])throw Error('APU limit out of training range');
   next[key]=value;
  }return {...state,limits:next};
 }
 function step(state,live,dt){
  if(!isNum(dt)||dt<0||dt>1)throw Error('APU lab step must be 0..1 s');
  const phase=typeof live?.phase==='string'?live.phase:'OFF';
  const running=phase==='READY', starting=phase==='STARTING'||phase==='INLET_DOOR';
  const a=new Set(state.active),v={...state.values},limits=state.limits;
  const baselineRpm=isNum(live?.rpmPct)?live.rpmPct:running?95.5:0;
  const baselineEgt=isNum(live?.egtC)?live.egtC:0;
  const baselineOil=isNum(live?.oil?.pressurePsi)?live.oil.pressurePsi:running?55:0;
  const targetRpm=running&&a.has('OVERSPEED')?115:baselineRpm;
  const targetOil=running&&(a.has('LOW_OIL_PRESSURE')||a.has('OIL_PUMP_FAILURE'))?0:
   running&&a.has('OIL_LEAK')?Math.max(0,baselineOil-state.time*0.9):baselineOil;
  const targetTemp=running&&a.has('HIGH_OIL_TEMP')?156:
   running&&a.has('OIL_LEAK')?108:running?limits.normalOilTempC:Math.max(20,v.oilTempC-dt*0.03);
  v.rpmPct=smooth(v.rpmPct,targetRpm,dt,running?2.3:.85);
  v.egtC=smooth(v.egtC,baselineEgt,dt,running?1:2);
  v.oilPressurePsi=smooth(v.oilPressurePsi,targetOil,dt,running?1.8:.85);
  v.oilTempC=smooth(v.oilTempC,targetTemp,dt,running?8:200);
  const h={...state.hold};
  h.overspeed=running&&v.rpmPct>=limits.overspeedPct?h.overspeed+dt:0;
  h.oilTemp=running&&v.oilTempC>=limits.highOilTempC?h.oilTemp+dt:0;
  h.oilPressure=running&&v.oilPressurePsi<=limits.lowOilTripPsi?h.oilPressure+dt:0;
  h.start=starting?h.start+dt:0;
  let trip=state.trip;
  const reasons=[
   [h.overspeed>0,'OVERSPEED'],
   [h.oilTemp>0&&h.oilTemp>=limits.highOilHoldSec,'HIGH_OIL_TEMP'],
   [h.oilPressure>0&&h.oilPressure>=limits.lowOilHoldSec,'LOW_OIL_PRESSURE'],
   [running&&a.has('OIL_TEMP_SENSOR'),'OIL_TEMP_SENSOR'],
   [running&&a.has('SPEED_SENSOR'),'SPEED_SENSOR'],
   [running&&a.has('EGT_SENSOR'),'EGT_SENSOR'],
   [running&&a.has('ECU_DC_LOSS'),'ECU_DC_LOSS'],
   [running&&a.has('INLET_DOOR'),'INLET_DOOR'],
   [starting&&a.has('NO_ACCELERATION')&&h.start>=12.5,'NO_ACCELERATION'],
   [starting&&a.has('NO_FLAME')&&h.start>=20,'NO_FLAME']
  ];
  if(!trip){const r=reasons.find(x=>x[0]);if(r)trip={reason:r[1],atSec:state.time+dt};}
  const logs=trip&&!state.trip?[...state.logs.slice(-39),{time:state.time+dt,text:'AUTOMATIC PROTECTIVE SHUTDOWN · '+trip.reason}]:state.logs;
  return {...state,time:state.time+dt,values:v,hold:h,trip,logs,lastPhase:phase,
   scenario:a.size?Array.from(a).join(', '):'NORMAL'};
 }
 function lamps(state,live){
  const trip=state.trip?.reason,phase=live?.phase;
  return {overspeed:trip==='OVERSPEED'||state.active.includes('OVERSPEED_SELF_TEST'),
   lowOil:trip==='LOW_OIL_PRESSURE'||(['INLET_DOOR','STARTING'].includes(phase)&&
    state.values.oilPressurePsi<4),
   fault:Boolean(trip&&trip!=='OVERSPEED'&&trip!=='LOW_OIL_PRESSURE')||
    state.active.includes('GENERATOR_FAILURE')||state.active.includes('BLEED_FAILURE'),
   highOilTemp:trip==='HIGH_OIL_TEMP'};
 }
 return Object.freeze({SCHEMA:'B737_CLASSIC_APU_PROTECTION_LAB_V1',faults,defaults,initial,setFault,setLimits,step,lamps});
});