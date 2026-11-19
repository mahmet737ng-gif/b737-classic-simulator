(async()=>{
;
/* ./lights-model.js?v=ATA32-AUTOBRAKE-SHARED-0001&amp;cb=CB-UNIFIED-0001 */
try{
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.B737CockpitLightsModel=api;})(typeof globalThis!=='undefined'?globalThis:null,function(){
 'use strict';
 const copy=x=>JSON.parse(JSON.stringify(x));
 function initial(){return {power:true,aircraftAltitude:8000,selectedAltitude:10000,trailingFlaps:0,leCenterPowered:true,leDirectValid:false,leDirectTransit:false,leDirectExtended:false,gsCaptured:false,gearLever:'DN',gearLeft:'DOWN',gearRight:'DOWN',gearNose:'DOWN',thrustIdle:false,leadingEdge:'RETRACTED',autoslatInFlight:false,antiskidOn:true,antiskidFault:false,autobrakeArmed:false,autobrakeDisarmed:false,autobrakeSelector:'OFF',autobrakeMode:'OFF',aircraftOnGround:true,autobrakeRtoSelfTest:false,speedBrakeArmedIndication:false,speedBrakeDoNotArmIndication:false,autopilotEngaged:false,stabTrimError:false,gpwsPullUp:false,belowGsDots:0,gsSignalValid:true,gsInhibited:false,radioAltitude:1500,gpwsComputerFailed:false,gpwsPowerLost:false,gpwsInvalidInput:false,brakeTempTest:false,atLimitDegradedN1:false,reverser1Unlocked:false,reverser2Unlocked:false,startValve1Open:false,startValve2Open:false,starter1Air:false,starter2Air:false,oil1AtRedRadial:false,oil2AtRedRadial:false,oilFilter1Bypass:false,oilFilter2Bypass:false};}
 function programmed(s){return s.trailingFlaps===0?s.leadingEdge==='RETRACTED':[1,2,5].includes(s.trailingFlaps)?s.leadingEdge==='INTERMEDIATE':s.trailingFlaps>=10&&s.trailingFlaps<=40&&s.leadingEdge==='FULL';}
 function validate(reg,assembly){const ids=new Set(),pieces=new Map();for(const r of assembly.regions)for(const p of r.placements||[])pieces.set(p.id,p);for(const c of reg.lights){if(ids.has(c.id))throw Error('Duplicate light '+c.id);ids.add(c.id);const p=pieces.get(c.pieceId),a=p&&assembly.assets[p.asset],b=c.sourceRect;if(!a||b.length!==4||b.some(n=>!Number.isFinite(n))||b[0]<0||b[1]<0||b[2]<=0||b[3]<=0||b[0]+b[2]>a.dimensions[0]||b[1]+b[3]>a.dimensions[1])throw Error('Invalid socket '+c.id);if(!reg.assets[c.asset]?.OFF||!reg.assets[c.asset]?.ON)throw Error('Missing faces '+c.id);for(const k of c.inputs)if(!Object.hasOwn(initial(),k))throw Error('Missing input '+k);}return true;}
 function controller(reg){let s=initial(),overrides={},lampTest=false,visualTest=false,overheadPower=null,previousDifference=Math.abs(s.aircraftAltitude-s.selectedAltitude),previousTarget=s.selectedAltitude,acquired=false,altitudeMode='OFF';
  function altitude(){const d=Math.abs(s.aircraftAltitude-s.selectedAltitude),newTarget=s.selectedAltitude!==previousTarget,inhibited=s.trailingFlaps>=25||s.gsCaptured;if(newTarget||inhibited){acquired=false;altitudeMode='OFF';}else if(d<=300){acquired=true;altitudeMode='OFF';}else if(acquired){altitudeMode=d<900?'FLASH':'OFF';}else if(previousDifference>900&&d<=900){altitudeMode='ON';}else if(d>900){altitudeMode='OFF';}previousDifference=d;previousTarget=s.selectedAltitude;return altitudeMode;}
  function evaluate(){if(s.radioAltitude>1000||s.radioAltitude<30)s.gsInhibited=false;const altitudeFrame=altitude(),frames={},power=s.power&&overheadPower===true;
   for(const c of reg.lights){let on=false;switch(c.rule){
    case 'signal':on=s[c.inputs[0]];break;
    case 'start-valve':on=c.inputs.every(k=>s[k]);break;
    case 'altitude':on=altitudeFrame;break;
    case 'below-gs':on=s.gsInhibited||(s.gsSignalValid&&s.belowGsDots>1.3);break;
    case 'gear-green':on=s['gear'+c.gear[0].toUpperCase()+c.gear.slice(1)]==='DOWN';break;
    case 'gear-red':{const g=s['gear'+c.gear[0].toUpperCase()+c.gear.slice(1)];on=['TRANSIT','UNSAFE'].includes(g)||(s.gearLever==='DN'&&g!=='DOWN')||(s.gearLever==='UP'&&g!=='UP')||(s.thrustIdle&&g!=='DOWN');break;}
    case 'le-transit':on=s.leCenterPowered&&(s.leDirectValid?s.leDirectTransit:!s.autoslatInFlight&&!programmed(s));break;
    case 'le-extended':on=s.leCenterPowered&&(s.leDirectValid?s.leDirectExtended:s.trailingFlaps>0&&programmed(s));break;
    case 'antiskid':on=!s.antiskidOn||s.antiskidFault;break;
    case 'autobrake':on=s.autobrakeRtoSelfTest||s.autobrakeDisarmed||s.autobrakeArmed&&!s.antiskidOn;break;
    case 'stab-trim':on=s.autopilotEngaged&&s.stabTrimError;break;
    case 'gpws-inop':on=s.gpwsComputerFailed||s.gpwsPowerLost||s.gpwsInvalidInput;break;
    default:throw Error('Unrecognized source rule '+c.rule);
   }if(!visualTest&&globalThis.B737UnifiedCB?.lampAllowed?.(c.id)===false){frames[c.id]='OFF';continue;}frames[c.id]=visualTest?'ON':Object.hasOwn(overrides,c.id)?overrides[c.id]:!power?'OFF':lampTest?'ON':typeof on==='string'?on:on?'ON':'OFF';}
   return {version:reg.version,frames,inputs:copy(s),overrides:copy(overrides),power,overheadPower,lampTest,visualTest};
  }
  return {evaluate,update(patch){for(const [k,v]of Object.entries(patch)){if(!Object.hasOwn(s,k)||typeof v!==typeof s[k]||(typeof v==='number'&&!Number.isFinite(v)))throw Error('Invalid sensor input '+k);if(k==='gearLever'&&!['UP','OFF','DN'].includes(v)||k.startsWith('gear')&&k!=='gearLever'&&!['UP','DOWN','TRANSIT','UNSAFE'].includes(v)||k==='leadingEdge'&&!['RETRACTED','INTERMEDIATE','FULL','TRANSIT','DISAGREE'].includes(v))throw Error('Invalid sensor value '+k);if(k==='trailingFlaps'&&![0,1,2,5,10,15,25,30,40].includes(v)||k==='belowGsDots'&&(v<0||v>10)||k==='radioAltitude'&&(v<0||v>60000)||['aircraftAltitude','selectedAltitude'].includes(k)&&(v< -2000||v>60000))throw Error('Sensor out of range '+k);}Object.assign(s,patch);return evaluate();},setOverheadPower(v){if(typeof v!=='boolean')throw Error('Invalid power');overheadPower=v;return evaluate();},setVisualTest(v){visualTest=!!v;return evaluate();},setTest(v){lampTest=!!v;return evaluate();},setOverride(id,frame){if(!reg.lights.some(c=>c.id===id)||!['AUTO','ON','OFF'].includes(frame))throw Error('Invalid lamp override');if(frame==='AUTO')delete overrides[id];else overrides[id]=frame;return evaluate();},reset(){s=initial();overrides={};lampTest=false;visualTest=false;previousDifference=2000;previousTarget=10000;acquired=false;altitudeMode='OFF';return evaluate();}};
 }
 return Object.freeze({initial,programmed,validate,controller});
});

}catch(error){queueMicrotask(()=>{throw error});}
;await 0;
;
/* ../../engine/systems/autobrake-classic-v1.js?v=ATA32-AUTOBRAKE-SHARED-0001 */
try{
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

}catch(error){queueMicrotask(()=>{throw error});}
;await 0;
;
/* ./autobrake-unified-v1.js?v=ATA24-CONSUMER-REG-0001&amp;cb=CB-UNIFIED-0001 */
try{
/* Shared B737 Classic AUTOBRAKE runtime — one logic source for EIS/CONVENTIONAL.
   No display-specific hardware positions here; all lamp outputs are derived
   from the deterministic engine/systems/autobrake-classic-v1.js model.
*/
(function(win){
 'use strict';
 const Model=win.B737ClassicAutobrakeModel;
 if(!Model)throw Error('B737CL autobrake model must load before unified bridge');
 let engine=Model.create(),timer=null,previousTime=win.performance.now();
 const lightSystem=()=>win.B737CockpitLights;
 function clearTimer(){if(timer!==null){win.clearTimeout(timer);timer=null;}}
 function flush(){
  const time=win.performance.now();
  engine.advance(Math.max(0,time-previousTime));
  previousTime=time;
 }
 function render(){
  const state=engine.getState(),light=lightSystem();
  if(light?.setInputs){
   const available=light.getState()?.inputs||{};
   const patch={
    autobrakeSelector:state.selector,autobrakeMode:state.phase,
    aircraftOnGround:state.inputs.onGround,antiskidOn:state.inputs.antiskidOn,
    antiskidFault:state.inputs.antiskidFault,
    autobrakeRtoSelfTest:state.rtoSelfTest,
    autobrakeArmed:state.armed,autobrakeDisarmed:state.disarmLight&&!state.rtoSelfTest
   };
   const changed=Object.fromEntries(Object.entries(patch).filter(([key,value])=>
    Object.hasOwn(available,key)&&available[key]!==value));
   if(Object.keys(changed).length)light.setInputs(changed);
  }
  win.dispatchEvent(new win.CustomEvent('b737:autobrake-state',{detail:state}));
  clearTimer();
  if(state.nextDueMs!==null){
   timer=win.setTimeout(()=>{
    timer=null;
    flush();render();
   },Math.max(1,state.nextDueMs));
  }
  return state;
 }
 function act(fn){
  clearTimer();flush();fn();return render();
 }
 const unprotectedSensors=Model.initialSensors();
 let electricalPowerRegistered=false,eventElectricalPower=null;
 function receiveElectricalAvailability(next){
  if(!['NORMAL','OFF','DEGRADED','UNKNOWN','NOT_INSTALLED'].includes(next))return false;
  const power=next==='NORMAL'?true:next==='OFF'||next==='NOT_INSTALLED'?false:null;
  if(electricalPowerRegistered&&eventElectricalPower===power)return false;
  electricalPowerRegistered=true;eventElectricalPower=power;
  updateSensors({});return true;
 }
 function updateSensors(patch){
  if(!patch||typeof patch!=='object')throw Error('Missing Classic autobrake sensors');
  Object.assign(unprotectedSensors,patch);
  const cb=win.B737UnifiedCB;
  // Classic MRG IV.6 p.182: AUTOBRAKE CONTROL is fed by DC BUS 2.
  // Read the SAME evaluated Electrical V7 owner, not GEN2 breaker detent.
  // A missing owner is unknown and must not fabricate a failure.
  const owner=win.B737ISNCockpitV1;
  const state=owner?.getElectricalState?.();
  const evaluated=!electricalPowerRegistered&&state&&win.B737ElectricalV7?
   win.B737ElectricalV7.evaluate(state):null;
  const dc2=electricalPowerRegistered?eventElectricalPower:
   typeof evaluated?.bus?.dc2==='boolean'?evaluated.bus.dc2:null;
  return act(()=>engine.update({...patch,
   electricalAvailable:unprotectedSensors.electricalAvailable&&dc2!==false&&
    cb?.available('brakes.autobrake')!==false&&cb?.available('brakes.autobrakeControl')!==false,
   antiskidFault:unprotectedSensors.antiskidFault||cb?.available('brakes.antiskidInboard')===false||cb?.available('brakes.antiskidOutboard')===false}));
 }
 win.addEventListener('b737:cb-state-change',()=>updateSensors({}));
 win.addEventListener('b737:electrical-v7-state',()=>{if(!electricalPowerRegistered)updateSensors({});});
 function setSelector(position){
  if(!Model.DETENTS.includes(position))throw Error('Invalid AUTO BRAKE position '+position);
  return act(()=>engine.select(position));
 }
 function setOnGround(value){
  if(typeof value!=='boolean')throw Error('WOW must be boolean');
  return updateSensors({onGround:value});
 }
 function getState(){flush();return engine.getState();}
 function manualAdvance(milliseconds){
  clearTimer();previousTime=win.performance.now();
  engine.advance(milliseconds);
  return render();
 }
 function ingest(detail){
  if(!detail||typeof detail!=='object')return;
  const map={
   aircraftOnGround:'onGround',
   autobrakeOnGround:'onGround',
   antiskidOn:'antiskidOn',antiskidFault:'antiskidFault',
   autobrakeHydraulicBAvailable:'hydraulicBAvailable',
   normalBrakesOperative:'normalBrakesOperative',
   autobrakeElectricalAvailable:'electricalAvailable',
   wheelSpeedKnots:'wheelSpeedKnots',
   bothThrustLeversIdle:'thrustIdle',
   autobrakeMainWheelSpinup:'mainWheelSpinup',
   manualBrakesApplied:'manualBrakesApplied',
   manualBrakePressurePsi:'manualBrakePressurePsi',
   speedBrakeDown:'speedBrakeDown',
   autobrakeSystemFault:'autobrakeFault',
   autobrakeSolenoidPressurePsi:'solenoidPressurePsi'
  };
  const patch={};
  for(const [name,target]of Object.entries(map))if(Object.hasOwn(detail,name))
   patch[target]=detail[name];
  if(Object.keys(patch).length)updateSensors(patch);
 }
 function readGuard(){
  const x=win.B737GuardOwner18?.inspect?.()?.antiskid?.value;
  if(x==='ON'||x==='OFF'){
   const value=x==='ON';
   if(engine.getState().inputs.antiskidOn!==value)updateSensors({antiskidOn:value});
  }
 }
 win.addEventListener('b737:guard-changed',e=>{
  if(e.detail?.id==='antiskid')readGuard();
 });
 win.addEventListener('b737:antiskid-selector-changed',e=>{
  if(['ON','OFF'].includes(e.detail?.value))updateSensors({antiskidOn:e.detail.value==='ON'});
 });
 win.addEventListener('b737:cockpit-lights-ready',()=>{
  const inputs=lightSystem()?.getState()?.inputs;
  if(inputs)ingest(inputs);
  readGuard();render();
 });
 win.addEventListener('b737:cockpit-sensors',e=>ingest(e.detail));
 // The pedestal levers already publish real mechanical events; share these
 // with the autobrake engine in BOTH EIS and Conventional display modes.
 const throttleStages={1:0,2:0};
 function onThrottle(event){
  const d=event.detail||{};
  if(![1,2].includes(Number(d.engine))||!Number.isFinite(d.percent))return;
  throttleStages[Number(d.engine)]=d.percent;
  const bothIdle=throttleStages[1]===0&&throttleStages[2]===0;
  if(engine.getState().inputs.thrustIdle!==bothIdle)
   updateSensors({thrustIdle:bothIdle});
 }
 win.document.addEventListener('b737:throttle-position',onThrottle);
 win.document.addEventListener('b737:throttle-state',onThrottle);
 const syncPhysicalThrottles=()=>{
  const api=win.B737ThrottlePositions;
  if(!api?.get)return;
  const values=[api.get(1),api.get(2)];
  if(values.every(Number.isFinite)){
   throttleStages[1]=values[0];throttleStages[2]=values[1];
   updateSensors({thrustIdle:values[0]===0&&values[1]===0});
  }
 };
 win.addEventListener('b737:throttle-sprites-ready',syncPhysicalThrottles);
 win.document.addEventListener('b737:throttle-sprites-ready',syncPhysicalThrottles,true);
 function onSpeedBrake(event){
  const d=event.detail||{};
  if(typeof d.detent!=='string')return;
  const down=d.detent==='DOWN';
  if(engine.getState().inputs.speedBrakeDown!==down)
   updateSensors({speedBrakeDown:down});
 }
 win.document.addEventListener('b737:speedbrake-position',onSpeedBrake);
 win.document.addEventListener('b737:speedbrake-state',onSpeedBrake);
 const syncPhysicalSpeedBrake=()=>{
  const p=win.B737SpeedbrakeLever?.get?.();
  if(Number.isFinite(p))updateSensors({speedBrakeDown:p<0.01});
 };
 win.addEventListener('b737:speedbrake-ready',syncPhysicalSpeedBrake);
 win.document.addEventListener('b737:speedbrake-ready',syncPhysicalSpeedBrake,true);
 // Disconnects are represented by sensors, not changes to the visual mode.
 // EIS -> Conventional -> EIS never reinitializes this module.
 win.B737AutobrakeUnified=Object.freeze({
  getState,setSelector,setOnGround,updateSensors,receiveElectricalAvailability,
  ingest,advance:manualAdvance,reset(){
   clearTimer();engine=Model.create();previousTime=win.performance.now();return render();
  },
  detents:Model.DETENTS.slice(),RTO_SELF_TEST_MS:Model.RTO_TEST_MS
 });
 render();
})(window);

}catch(error){queueMicrotask(()=>{throw error});}
;await 0;
})();
