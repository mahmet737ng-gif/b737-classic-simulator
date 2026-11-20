/* Unified A/T SPEED -> shared ISN-18 ENG 1+2 -> flight speed feedback v1.
 * The MCP mode core is authoritative. Never energize a stopped engine or
 * manufacture indications. Instructor RUNNING preset requires explicit click.
 */
(function(win){
 'use strict';
 const Servo=win.B737AutothrottleSpeedServoV1,VERSION='UNIFIED_AT_ENGINE_BRIDGE_0001';
 if(!Servo){win.console?.error('A/T servo dependency missing');return;}
 const doc=win.document,by=id=>doc.getElementById(id);
 let state=Servo.initial(),last=0,manualOverride=false,errors=[],lastCommands={};
 const clone=x=>JSON.parse(JSON.stringify(x));
 function activeMode(m){
  return m?.power===true&&m.controls?.atArm===true&&m.modes?.thrust==='SPEED';
 }
 function getSources(){
  const mcp=win.B737McpAFDSBridgeV1?.getOutput?.()||null;
  const scenario=win.B737UnifiedFlightScenarioV1;
  const status=scenario?.getDiagnostics?.();
  const flight=status?.active===true?scenario.getState?.():null;
  const owner=win.B737ISNCockpitV1;
  // Keep idle-window overhead negligible: ISN ECU snapshots contain large
  // diagnostics trees and are only required when A/T can run or panel is open.
  const needEngines=activeMode(mcp);
  const propulsion=needEngines?owner?.getPropulsionSnapshot?.():null;
  const chain=needEngines&&!propulsion?owner?.getStartState?.():null;
  const ecu=needEngines&&!propulsion?owner?.getECUState?.():null;
  const engines={};
  for(const n of [1,2]){
   const id='engine'+n;
   engines[id]=propulsion?.engines?.[id]?
    {...propulsion.engines[id]}:
    {running:chain?.phase?.[id]==='RUNNING',
     n1Percent:ecu?.engines?.[id]?.n1Percent??null,
     throttle:chain?.runningEnvelope?.throttle?.[id]??null};
  }
  // When the Scenario Lab is not running, accept only a VALID ADC source.
  // The external producer remains responsible for moving IAS in that case.
  const network=win.B737UnifiedAvionicsNetworkV1;
  const adc=!flight&&activeMode(mcp)?network?.getSignal?.('airdata.adc1'):null;
  const airGround=!flight&&activeMode(mcp)?network?.getSignal?.('aircraft.airground'):null;
  const ias=Number.isFinite(flight?.iasKt)?flight.iasKt:
   adc?.quality==='VALID'?(adc.value?.iasKt??adc.value?.casKt):null;
  const airborne=flight?flight.airborne:
   airGround?.quality==='VALID'&&airGround.value?.onGround===true?false:null;
  return {mcp,flight:{iasKt:ias,vsFpm:flight?.vsFpm??0,airborne},
   engines,scenarioActive:status?.active===true,paused:status?.paused===true,
   ecu,owner};
 }
 function notify(){
  win.dispatchEvent(new CustomEvent('b737:autothrottle-speed-state',{detail:clone(state)}));
 }
 function tick(){
  const now=performance.now();
  const dt=last?Math.min(.5,Math.max(0,(now-last)/1000)):.2;
  last=now;
  const src=getSources();
  if(!activeMode(src.mcp)){manualOverride=false;lastCommands={};}
  try{
   state=Servo.step(state,{dtSec:dt,mcp:src.mcp,flight:src.flight,
    engines:src.engines,paused:src.paused,inhibited:manualOverride});
   if(state.active){
    if(typeof src.owner?.autoThrottleCommand!=='function'){
     state={...state,active:false,reason:'ISN18_THROTTLE_INTERFACE_MISSING',commands:[]};
    }else for(const command of state.commands){
     if(Math.abs(command.throttle-(lastCommands[command.engine]??-1))<.008)continue;
     const result=src.owner.autoThrottleCommand({
      engine:command.engine,value:command.throttle,controller:Servo.VERSION});
     if(result?.accepted!==true){
      state={...state,active:false,reason:result?.reason||'ENGINE_THROTTLE_REJECTED',commands:[]};
      break;
     }
     lastCommands[command.engine]=command.throttle;
     const number=command.engine==='engine1'?1:2;
     // This is a photo sprite only. The real ECU has already accepted the
     // continuous throttle; visually it is quantized to five photo stages.
     doc.dispatchEvent(new CustomEvent('b737:throttle-state',{detail:{
      engine:number,percent:command.throttle*100,source:'A/T SPEED',visualOnly:true}}));
    }
   }
  }catch(error){
   const message=String(error?.message||error);
   if(errors.at(-1)!==message){errors.push(message);if(errors.length>12)errors.shift();}
   state={...state,active:false,reason:'A/T_COMMAND_ERROR: '+message,commands:[]};
  }
  notify();
 }
 function manualIntervention(event){
  const d=event?.detail;
  if(![1,2].includes(d?.engine)&&!['engine1','engine2'].includes(d?.engine))return;
  if(!Number.isFinite(d.percent)&&!Number.isFinite(d.throttle))return;
  if(activeMode(win.B737McpAFDSBridgeV1?.getOutput?.()))manualOverride=true;
 }
 doc.addEventListener('b737:throttle-position',manualIntervention);
 win.addEventListener('b737:manual-engine-throttle',manualIntervention);
 const publicApi=Object.freeze({
  getState:()=>clone(state),getDiagnostics:()=>({version:VERSION,manualOverride,errors:[...errors]}),
  tickForTest:tick,resetManualOverride:()=>{manualOverride=false;},
  version:VERSION
 });
 win.B737UnifiedAutothrottleV1=publicApi;
 function boot(){
  win.setInterval(tick,200);
 }
 if(doc.readyState==='loading')doc.addEventListener('DOMContentLoaded',boot,{once:true});
 else boot();
})(window);
