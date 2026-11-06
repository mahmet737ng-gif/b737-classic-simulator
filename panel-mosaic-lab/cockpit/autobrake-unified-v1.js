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
 function updateSensors(patch){
  if(!patch||typeof patch!=='object')throw Error('Missing Classic autobrake sensors');
  Object.assign(unprotectedSensors,patch);
  const cb=win.B737UnifiedCB;
  return act(()=>engine.update({...patch,
   electricalAvailable:unprotectedSensors.electricalAvailable&&cb?.available('brakes.autobrake')!==false&&cb?.available('brakes.autobrakeControl')!==false,
   antiskidFault:unprotectedSensors.antiskidFault||cb?.available('brakes.antiskidInboard')===false||cb?.available('brakes.antiskidOutboard')===false}));
 }
 win.addEventListener('b737:cb-state-change',()=>updateSensors({}));
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
  getState,setSelector,setOnGround,updateSensors,
  ingest,advance:manualAdvance,reset(){
   clearTimer();engine=Model.create();previousTime=win.performance.now();return render();
  },
  detents:Model.DETENTS.slice(),RTO_SELF_TEST_MS:Model.RTO_TEST_MS
 });
 render();
})(window);
