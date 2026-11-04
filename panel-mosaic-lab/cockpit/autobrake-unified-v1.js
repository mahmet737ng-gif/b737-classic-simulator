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
 function updateSensors(patch){
  if(!patch||typeof patch!=='object')throw Error('Missing Classic autobrake sensors');
  return act(()=>engine.update(patch));
 }
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
