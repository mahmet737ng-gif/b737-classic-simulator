'use strict';
/**
 * ISN-07: source-indexed discrete bleed valves, trips, APU protections,
 * and observed-input engine start protections. NOT an AMM/WDM air-flow solver.
 * FCOM Sepehran §2.10.2-3 (PDF 983-984), §2.20.1-2 (1000-1001),
 * §7.20.7 (1208), §7.30.3 (1218), NP.21.33-35 (133-135).
 */
const SOURCE='FCOM-SEPEHRAN-1937';
const ref=(section,pages)=>({sourceId:SOURCE,section,pdfPages:pages});
const IDS=['1','2'];
const APU_SHUTDOWN=new Set(['OVERSPEED','LOW_OIL_PRESSURE','HIGH_OIL_TEMPERATURE','FIRE','FCU_FAILURE']);
const FAULT_IDS=[...APU_SHUTDOWN,'BLEED_OVERTEMP'];
const finite=(v,n,lo,hi)=>{if(typeof v!=='number'||!Number.isFinite(v)||v<lo||v>hi)throw new TypeError(n+' invalid');};
const bool=(v,n)=>{if(typeof v!=='boolean')throw new TypeError(n+' must be boolean');};
const sel=(v,list,n)=>{if(!list.includes(v))throw new TypeError(n+' invalid');};
const side=id=>sel(String(id),IDS,'engine');
function initializeProtection(){
 const e=()=>({
   starterElapsedSeconds:0,attemptCount:0,cooldownRemainingSeconds:0,
   startFault:null,secondsAfterIdle:0,egtC:null,egtRiseConfirmed:null,
   n2Acceleration:'UNKNOWN',oilPressureIndicated:null
 });
 return {
   pneumatic:{
     isolationSwitch:'AUTO',engineBleedSwitches:{'1':true,'2':true},
     packs:{L:'OFF',R:'OFF'},
     bleedTripCondition:{'1':false,'2':false},
     bleedTripLatched:{'1':false,'2':false}
   },
   apuFaultSignals:Object.fromEntries(FAULT_IDS.map(k=>[k,false])),
   engines:{'1':e(),'2':e()}
 };
}
function verifyStartAttempt(p,id) {
 const e=p.safety.engines[id],eng=p.engines[id];
 if(eng.startSwitch==='GRD')return;
 if(e.cooldownRemainingSeconds>0)throw new Error('STARTER_COOLDOWN_REQUIRED: '+e.cooldownRemainingSeconds+'s');
 if(e.startFault==='STARTER_DUTY_LIMIT')throw new Error('STARTER_DUTY_FAULT_REQUIRES_RESET');
 if(e.attemptCount>0 && eng.n2Pct>=20 && !eng.lightoffConfirmed)
   throw new Error('EARLY_START_REENGAGEMENT_REQUIRES_N2_BELOW_20');
}
function endStarter(e){
 if(e.starterElapsedSeconds>0||e.attemptCount>0)
   e.cooldownRemainingSeconds=Math.max(e.cooldownRemainingSeconds,e.attemptCount===1?20:180);
}
function reconcileStarterEdges(p,before){
 if(!before||before.mode!=='INTEGRATED')return;
 for(const id of IDS){
   const prior=before.engines[id],next=p.engines[id],state=p.safety.engines[id];
   if(prior.startSwitch!=='GRD'&&next.startSwitch==='GRD'){
     verifyStartAttempt(before,id);
     state.attemptCount++;state.starterElapsedSeconds=0;
     state.secondsAfterIdle=0;state.egtRiseConfirmed=null;
     state.n2Acceleration='UNKNOWN';
   } else if(prior.startSwitch==='GRD'&&next.startSwitch!=='GRD'){
     endStarter(state);
   }
   if(prior.startLever!=='IDLE'&&next.startLever==='IDLE'){
     state.secondsAfterIdle=0;state.egtRiseConfirmed=null;
   }
 }
}
function tickProtection(p,dt){
 finite(dt,'elapsed seconds',0,3600);
 const results=[];
 for(const id of IDS){
   const e=p.engines[id],s=p.safety.engines[id];
   const wasStarting=e.startSwitch==='GRD';
   if(s.cooldownRemainingSeconds>0&&!wasStarting)
     s.cooldownRemainingSeconds=Math.max(0,s.cooldownRemainingSeconds-dt);
   if(wasStarting){
     s.starterElapsedSeconds+=dt;
     if(s.starterElapsedSeconds>120){
       // FCOM NP.21.33 is a crew operating limit, not a stated
       // automatic starter cutout at 120 seconds. Do not move GRD or
       // shut fuel off without an explicit pilot action.
       s.startFault='STARTER_DUTY_LIMIT';
       results.push({id,reason:'STARTER_DUTY_LIMIT',
         actionRequired:'CREW_ABORT_START',automaticCutout:false});
     }
   }
   if(e.startLever==='IDLE'&&e.phase!=='RUNNING')s.secondsAfterIdle+=dt;
 }
 return results;
}
function resetStarterDuty(p,id){
 const s=p.safety.engines[id],e=p.engines[id];
 if(e.startSwitch==='GRD')throw new Error('Cannot reset starter duty with starter engaged');
 if(s.cooldownRemainingSeconds>0)throw new Error('Cooldown still required');
 s.startFault=null;
}
function reconcileApuProtections(p){
 const q=p.safety.apuFaultSignals;
 const shutdown=[...APU_SHUTDOWN].find(k=>q[k]);
 if(shutdown && p.apu.phase!=='OFF'){
   p.apu.phase='OFF';p.apu.switch='OFF';p.apu.bleedSwitchOn=false;
   p.apu.fault='AUTO_SHUTDOWN_'+shutdown;
 }
 return shutdown;
}
function applyProtectionAction(p,a){
 const s=p.safety,air=s.pneumatic;
 const yes=()=>bool(a.value,'value');
 switch(a.type){
 case 'SET_ISOLATION_SWITCH':
   sel(a.value,['AUTO','OPEN','CLOSE'],'isolation switch');
   air.isolationSwitch=a.value;break;
 case 'SET_ENGINE_BLEED_SWITCH':
   side(a.engine);yes();air.engineBleedSwitches[String(a.engine)]=a.value;break;
 case 'SET_PACK_SWITCH':
   sel(a.pack,['L','R'],'pack');sel(a.value,['OFF','AUTO','HIGH'],'pack switch');
   air.packs[a.pack]=a.value;break;
 case 'SET_BLEED_TRIP_CONDITION':
   side(a.engine);yes();
   air.bleedTripCondition[String(a.engine)]=a.value;
   if(a.value)air.bleedTripLatched[String(a.engine)]=true;
   break;
 case 'PUSH_BLEED_TRIP_RESET':
   for(const id of IDS)if(!air.bleedTripCondition[id])air.bleedTripLatched[id]=false;
   break;
 case 'SET_APU_PROTECTION_SIGNAL':
   sel(a.fault,FAULT_IDS,'APU protection');yes();
   s.apuFaultSignals[a.fault]=a.value;break;
 case 'SET_ENGINE_EGT_C':
   side(a.engine);
   if(a.value!==null)finite(a.value,'EGT degC',-100,1300);
   s.engines[String(a.engine)].egtC=a.value;break;
 case 'SET_ENGINE_EGT_RISE_CONFIRMED':
   side(a.engine);
   if(a.value!==null)yes();
   s.engines[String(a.engine)].egtRiseConfirmed=a.value;break;
 case 'SET_ENGINE_N2_ACCELERATION':
   side(a.engine);sel(a.value,['NORMAL','SLOW','UNKNOWN'],'N2 acceleration');
   s.engines[String(a.engine)].n2Acceleration=a.value;break;
 case 'SET_ENGINE_OIL_PRESSURE_INDICATED':
   side(a.engine);if(a.value!==null)yes();
   s.engines[String(a.engine)].oilPressureIndicated=a.value;break;
 case 'RESET_STARTER_DUTY_FAULT':
   side(a.engine);resetStarterDuty(p,String(a.engine));break;
 default:throw new TypeError('Unsupported ISN07 action '+String(a.type));
 }
}
const PROTECTION_COMMANDS=new Set([
 'SET_ISOLATION_SWITCH','SET_ENGINE_BLEED_SWITCH','SET_PACK_SWITCH',
 'SET_BLEED_TRIP_CONDITION','PUSH_BLEED_TRIP_RESET',
 'SET_APU_PROTECTION_SIGNAL','SET_ENGINE_EGT_C','SET_ENGINE_EGT_RISE_CONFIRMED',
 'SET_ENGINE_N2_ACCELERATION','SET_ENGINE_OIL_PRESSURE_INDICATED',
 'RESET_STARTER_DUTY_FAULT'
]);
/**
 * The isolator is AC-operated; command and verified physical actuation are
 * not interchangeable. With normal AC available we use a clearly labeled
 * nominal actuator assumption for training; otherwise UNKNOWN, not CLOSED.
 */
function evaluatePneumatics(p,electrical) {
 const s=p.safety, a=s.pneumatic;
 const isolationCommand=a.isolationSwitch==='AUTO'?
  (a.engineBleedSwitches['1']&&a.engineBleedSwitches['2']&&
   a.packs.L!=='OFF'&&a.packs.R!=='OFF'?'CLOSE':'OPEN'):
  a.isolationSwitch;
 const acKnown=(electrical.buses.generator1==='POWERED'||
   electrical.buses.generator2==='POWERED');
 const isolation=acKnown?isolationCommand:'UNKNOWN';
 const apuOvertemp=s.apuFaultSignals.BLEED_OVERTEMP;
 const apuValve=p.apu.phase==='AVAILABLE'&&p.apu.bleedSwitchOn&&!apuOvertemp;
 const engineValves={};
 for(const id of IDS){
   engineValves[id]={
    command:a.engineBleedSwitches[id],
    observed:'UNVERIFIED_VALVE_FEEDBACK',
    available:p.engines[id].phase==='RUNNING'&&a.engineBleedSwitches[id]&&!a.bleedTripLatched[id],
    bleedTripCondition:a.bleedTripCondition[id],
    bleedTripLatched:a.bleedTripLatched[id],
    source:ref('2.10.3;2.20.1',[984,1000])
   };
 }
 const dualBleed=apuValve&&(
   a.engineBleedSwitches['1']||
   (a.engineBleedSwitches['2']&&isolation==='OPEN'));
 const dualUncertain=apuValve&&!a.engineBleedSwitches['1']&&
   a.engineBleedSwitches['2']&&isolation==='UNKNOWN';
 const target={};
 for(const id of IDS){
   const local=engineValves[id].available;
   // APU feed connects to No.1 side by the FCOM 2.20.3 schematic; exact
   // flow/pressure under isolation transition is still not calculated.
   const apuReach=apuValve&&(id==='1'||isolation==='OPEN');
   const cartReach=p.pneumatic.groundCartOn&&(id==='2'||isolation==='OPEN');
   const crossReach=p.pneumatic.crossbleedOn&&(
     id==='1'?engineValves['2'].available:engineValves['1'].available)&&
       isolation==='OPEN';
   let source=apuReach?'APU':cartReach?'GROUND_CART':
     crossReach?'ENGINE_CROSSBLEED':local?'ENGINE_BLEED_SELF':'NONE';
   let access='AVAILABLE';
   if(source==='NONE'){
     source=(isolation==='UNKNOWN' &&(apuValve||p.pneumatic.groundCartOn ||
      p.pneumatic.crossbleedOn))?'UNKNOWN_ROUTING':'NONE';
     access=source==='NONE'?'UNAVAILABLE':'UNKNOWN';
   }
   target[id]={source,access};
 }
 return {
   isolation:{switch:a.isolationSwitch,command:isolationCommand,
     nominalProjectedPosition:isolation,actualValveFeedback:null,
     quality:acKnown?'NOMINAL_ACTUATOR_PILOT':'AC_ACTUATOR_UNVERIFIED'},
   engineValves,apuBleedValve:{command:p.apu.bleedSwitchOn,
     projectedOpen:apuValve,overTemperatureShutdown:apuOvertemp,
     actualValveFeedback:null},
   dualBleedLightDemand:dualUncertain?null:dualBleed,
   engines:target,
   source:ref('2.10.2-3;2.20.1-3',[983,984,1000,1001,1002]),
   unresolved:['No valve travel times or duct routing pressure losses',
      'Actual valve feedback and isolation actuator circuit not WDM-verified',
      'Ground cart coupling route and partial-AC isolation behavior provisional']
 };
}
function evaluateStartProtections(p) {
 const eng={};
 for(const id of IDS){
   const s=p.safety.engines[id],e=p.engines[id];
   const reasons=[];
   if(s.startFault==='STARTER_DUTY_LIMIT')reasons.push('STARTER_DUTY_LIMIT');
   if(e.startLever==='IDLE' && e.phase!=='RUNNING'){
     if(s.egtC!==null&&s.egtC>=725)reasons.push('EGT_AT_OR_ABOVE_725_C');
     if(s.secondsAfterIdle>=10&&s.egtRiseConfirmed===false)
       reasons.push('NO_EGT_RISE_WITHIN_10_SECONDS');
     if(e.n2Pct>=32&&s.n2Acceleration==='SLOW'&&s.egtRiseConfirmed===true)
       reasons.push('SLOW_N2_ACCELERATION_AFTER_EGT_RISE');
   }
   if(e.phase==='RUNNING'&&s.oilPressureIndicated===false)
     reasons.push('NO_OIL_PRESSURE_AT_STABLE_IDLE');
   eng[id]={
     ...s,recommendedProcedure:reasons.length?'REVIEW_ABORTED_ENGINE_START':'NONE_CONFIRMED',
     advisoryReasons:reasons,
     egtDigitalFlashDemand:e.startLever==='IDLE'&&e.phase!=='RUNNING'&&
       s.egtC!==null&&s.egtC>=725,
     automaticEngineShutdown:false,
     evidence:ref('NP.21.33-35;7.20.7',[133,134,135,1208])
   };
 }
 const active=[...APU_SHUTDOWN].filter(k=>p.safety.apuFaultSignals[k]);
 const overtemp=p.safety.apuFaultSignals.BLEED_OVERTEMP;
 return {
   engines:eng,
   apu:{shutdownFaults:active,overtemperatureBleedClosure:overtemp,
     note:'APU overtemperature closes bleed, does not imply APU shutdown',
     source:ref('7.30.3',[1218])},
   source:ref('NP.21.33-35;7.30.3',[133,134,135,1218])
 };
}
module.exports={initializeProtection,PROTECTION_COMMANDS,verifyStartAttempt,
 reconcileStarterEdges,tickProtection,reconcileApuProtections,
 applyProtectionAction,evaluatePneumatics,evaluateStartProtections};
