/* B737 Classic 300/400/500 — shared autobrake trainer logic.
   Same engine for EIS and conventional. Technical reference: B737CL FCOM
   14.10.5, 14.20.5–6 and Lufthansa LAN ATA 32-40.
   Educational procedural simulation only, not certified aircraft software.
   All times are deterministic simulator milliseconds supplied via advance().
*/
(function(root,factory){
 'use strict';const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.B737ClassicAutobrakeModel=api;
})(typeof globalThis!=='undefined'?globalThis:null,function(){
 'use strict';
 const DETENTS=Object.freeze(['RTO','OFF','1','2','3','MAX']);
 const RTO_TEST_MS=1500,LANDING_RTO_DISARM_MS=120000,LANDING_THRUST_GRACE_MS=3000;
 function initialSensors(){return{
  onGround:true,antiskidOn:true,antiskidFault:false,
  hydraulicBAvailable:true,normalBrakesOperative:true,electricalAvailable:true,
  wheelSpeedKnots:0,thrustIdle:true,mainWheelSpinup:false,
  manualBrakesApplied:false,manualBrakePressurePsi:0,speedBrakeDown:false,
  autobrakeFault:false,solenoidPressurePsi:0
 };}
 const copy=o=>({...o});
 function create(){
  let clock=0,selector='OFF',phase='OFF',reason='OFF',s=initialSensors();
  let testUntil=null,rtoLandingUntil=null,landingTouchdownAt=null,airborneSinceRto=false;
  let manualBrakeAt=null;
  const landing=()=>['1','2','3','MAX'].includes(selector);
  const systemOK=()=>s.antiskidOn&&!s.antiskidFault&&s.hydraulicBAvailable&&
    s.normalBrakesOperative&&s.electricalAvailable&&!s.autobrakeFault;
  const anomalousSolenoid=()=>s.solenoidPressurePsi>1000&&phase!=='ACTIVE';
  const fault=()=>!systemOK()||anomalousSolenoid();
  function disarm(why,failed=false){
   if(selector==='OFF')return;
   phase=failed?'FAILED':'DISARMED';reason=why;testUntil=null;
  }
  function select(value){
   if(!DETENTS.includes(value))throw Error('Invalid Classic autobrake detent '+value);
   if(value===selector)return status();
   const wasAutobraking=phase==='ACTIVE';
   const priorSelector=selector;
   selector=value;testUntil=null;rtoLandingUntil=null;landingTouchdownAt=null;
   manualBrakeAt=null;airborneSinceRto=false;
   // Disengaging an ACTIVE RTO/landing autobrake by switching to any
   // different non-OFF position is an illuminated pilot disarm.
   if(wasAutobraking&&priorSelector!=='OFF'&&value!=='OFF'){
    phase='DISARMED';reason='SELECTOR_CHANGED_DURING_BRAKING';
    return status();
   }
   if(value==='OFF'){phase='OFF';reason='MANUAL_OFF';}
   else if(value==='RTO'){
    if(!s.onGround){phase='INHIBITED';reason='RTO_AIRBORNE';}
    else {phase='SELF_TEST';reason='RTO_TOSC';testUntil=clock+RTO_TEST_MS;}
   }else if(!systemOK()){phase='FAILED';reason='LANDING_TOSC_FAILED';}
   else {phase='WAITING';reason='LANDING_TOSC_PASSED';}
   return status();
  }
  function update(patch){
   if(!patch||typeof patch!=='object'||Array.isArray(patch))throw Error('Invalid autobrake sensors');
   const former=copy(s);
   for(const [key,value] of Object.entries(patch)){
    if(!Object.hasOwn(s,key)||typeof value!==typeof s[key]||
      (typeof value==='number'&&(!Number.isFinite(value)||value<0||value>100000)))
     throw Error('Invalid autobrake sensor '+key);
   }
   Object.assign(s,patch);
   if(selector!=='OFF'&&['SELF_TEST','WAITING','ARMED','ACTIVE'].includes(phase)&&
      fault()&&phase!=='SELF_TEST')disarm('SYSTEM_OR_ANTISKID_FAULT',true);
   if(selector==='RTO'){
    if(former.onGround&&!s.onGround){
     airborneSinceRto=true;rtoLandingUntil=null;testUntil=null;
     phase='INHIBITED';reason='RTO_LIFTOFF_NO_LIGHT';
    }else if(!former.onGround&&s.onGround&&airborneSinceRto){
     rtoLandingUntil=clock+LANDING_RTO_DISARM_MS;
     phase='INHIBITED';reason='LANDING_WITH_RTO_SELECTED_PENDING';
    }
    if(s.onGround&&!airborneSinceRto){
     if(phase==='WAITING'&&s.wheelSpeedKnots>=60){
      phase='ARMED';reason='RTO_SPEED_ARMED';
     }
     const rejected=former.thrustIdle===false&&s.thrustIdle===true;
     if(['ARMED','WAITING'].includes(phase)&&rejected&&s.wheelSpeedKnots>=90){
      phase='ACTIVE';reason='RTO_AUTOBRAKING';
     }else if(phase==='ARMED'&&rejected&&s.wheelSpeedKnots>=60&&s.wheelSpeedKnots<90){
      disarm('RTO_REJECT_BELOW_90');
     }
    }
   }
   if(landing()){
    if(!former.onGround&&s.onGround)landingTouchdownAt=clock;
    if(['WAITING','ARMED'].includes(phase)&&s.onGround&&s.mainWheelSpinup&&s.thrustIdle){
     phase='ACTIVE';reason='LANDING_AUTOBRAKING';
     if(landingTouchdownAt===null)landingTouchdownAt=clock;
    }
   }
   if(phase==='ACTIVE'){
    const grace=landing()&&landingTouchdownAt!==null&&clock-landingTouchdownAt<LANDING_THRUST_GRACE_MS;
    if(s.speedBrakeDown&&!former.speedBrakeDown)disarm('SPEEDBRAKE_STOWED');
    else if(!s.thrustIdle&&!grace)disarm('THRUST_ADVANCED');
    else if(s.manualBrakesApplied)disarm('MANUAL_BRAKES');
    // Lufthansa ATA 32-40: above 60 kt >750 psi for 2s; below 60 kt 300ms.
    else if(s.manualBrakePressurePsi>=750){
     if(manualBrakeAt===null)manualBrakeAt=clock;
    }else manualBrakeAt=null;
   }
   return status();
  }
  function advance(ms){
   if(!Number.isFinite(ms)||ms<0||ms>3600000)throw Error('Invalid elapsed milliseconds');
   clock+=ms;
   if(phase==='SELF_TEST'&&testUntil!==null&&clock>=testUntil){
    testUntil=null;
    if(!s.onGround||!systemOK()||s.wheelSpeedKnots>=60||!s.thrustIdle){phase='FAILED';reason='RTO_TOSC_FAILED';}
    else {phase='WAITING';reason='RTO_TOSC_PASSED';}
   }
   if(rtoLandingUntil!==null&&clock>=rtoLandingUntil&&selector==='RTO'){
    rtoLandingUntil=null;disarm('LANDED_WITH_RTO_SELECTED');
   }
   if(phase==='ACTIVE'){
    if(s.manualBrakePressurePsi>=750&&manualBrakeAt!==null){
     const threshold=s.wheelSpeedKnots>60?2000:300;
     if(clock-manualBrakeAt>=threshold)disarm('MANUAL_BRAKE_PRESSURE');
    }
    const grace=landing()&&landingTouchdownAt!==null&&clock-landingTouchdownAt<LANDING_THRUST_GRACE_MS;
    if(!s.thrustIdle&&!grace)disarm('THRUST_ADVANCED');
   }
   return status();
  }
  function status(){
   const selfTest=phase==='SELF_TEST';
   const disarmed=phase==='DISARMED'||phase==='FAILED';
   const solenoidException=selector==='OFF'&&s.solenoidPressurePsi>1000;
   const lamp=selfTest||disarmed||solenoidException;
   return{clockMs:clock,selector,phase,reason,inputs:copy(s),
    disarmLight:lamp,antiskidInop:!s.antiskidOn||s.antiskidFault,
    rtoSelfTest:selfTest,armed:['WAITING','ARMED','ACTIVE'].includes(phase),
    braking:phase==='ACTIVE',faulted:phase==='FAILED'||solenoidException,
    nextDueMs:testUntil!==null?Math.max(0,testUntil-clock):
      rtoLandingUntil!==null?Math.max(0,rtoLandingUntil-clock):
      phase==='ACTIVE'&&manualBrakeAt!==null?
       Math.max(0,(s.wheelSpeedKnots>60?2000:300)-(clock-manualBrakeAt)):
      phase==='ACTIVE'&&landingTouchdownAt!==null&&!s.thrustIdle?
       Math.max(0,LANDING_THRUST_GRACE_MS-(clock-landingTouchdownAt)):null};
  }
  return Object.freeze({select,update,advance,getState:status});
 }
 return Object.freeze({DETENTS,RTO_TEST_MS,LANDING_RTO_DISARM_MS,LANDING_THRUST_GRACE_MS,initialSensors,create});
});
