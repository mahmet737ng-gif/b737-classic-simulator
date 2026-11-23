/* LEDEV-LOGIC-V1: training adapter for the approved LEDEV-0006 photo panel.
   Does not own Electrical V7 and does not mutate any guarded control/image.
   Authoritative electrical buses must be supplied by owner or instructor;
   until then modeled power is a clearly documented training assumption.
*/
(function(){
 'use strict';
 const engine=window.B737LEDevicesClassicV1, panel=window.B737LeadingEdgeDevices,
  actuator=window.B737TEFlapActuatorV1;
 if(!engine||!panel||!actuator){console.warn('LE trainer dependency not available');return;}
 let state=engine.initialState(),te=actuator.initialState(),
  source='TRAINER_PRESET',mode='NORMAL',physicalMotion=false;
 let latest=null;
 function paint(){
  latest=engine.evaluate(state);
  panel.setPower(latest.overhead.power);
  // Visual state must reflect desired-vs-observed agreement, not the last
  // physical detent of a jammed device (which could still be EXT).
  for(const [id,status] of Object.entries(latest.overhead.indication)){
   panel.setDevice(id,status);
  }
  for(const [key,lit] of Object.entries(latest.overhead.windows)){
   const [id,level]=key.split('|');
   // Null is an unknown feed: panel power gating keeps all real lamps dark.
   panel.setWindow(id,level,lit===null?false:lit);
  }
  const flap=actuator.evaluate(te);
  const detail={revision:latest.revision,lever:latest.lever,scenario:mode,
   leStage:latest.leStage,
   tePosition:flap.actual,teTarget:flap.command,teMoving:flap.moving,
   hydraulicPsi:flap.pressurePsi,
   center:latest.center,overheadPower:latest.overhead.power,
   autoslatInhibit:latest.autoslatInhibit,mismatch:latest.mismatch,source};
  window.dispatchEvent(new CustomEvent('b737:le-classic-projection',{detail}));
  if(parent!==window&&typeof parent.postMessage==='function'){
   parent.postMessage({type:'b737:cockpit-overhead',kind:'le-devices-projection',
    projection:detail},location.origin);
  }
  return latest;
 }
 function apply(action){
  if(action.type==='HYDRAULIC_PRESSURE'){
   te=actuator.apply(te,{type:'PRESSURE',psi:action.psi});
   return paint();
  }
  const tick=action.type==='TICK';
  const physicalTick=tick&&physicalMotion;
  const pf=actuator.evaluate(te).pressureFactor;
  if(action.type==='RESET'){
   state=engine.apply(state,action);
   mode=action.mode||'NORMAL';te=actuator.initialState();physicalMotion=false;stopMotion();
   return paint();
  }
  if(action.type==='FLAP_LEVER'){
   const firstExtension=physicalMotion&&te.command===0&&te.actual<1e-6&&action.value>0;
   te=actuator.apply(te,{type:'COMMAND',value:action.value});
   if(firstExtension)state=engine.apply(state,{type:'START_LE_SEQUENCE'});
  }
  else if(action.type==='HYDRAULIC'&&action.system==='B')
   te=actuator.apply(te,{type:'HYDRAULIC',value:action.value});
  else if(physicalTick)
   te=actuator.apply(te,{type:'TICK',seconds:action.seconds});
  if(physicalMotion)
   state=engine.apply(state,{type:'FOLLOW_TE',position:te.actual,command:te.command});
  const actualAction=physicalTick?{...action,motionProfile:'TIMED',pressureFactor:pf}:action;
  state=engine.apply(state,actualAction);
  return paint();
 }
 function authorize(action){
  if(!action||typeof action.type!=='string')throw Error('LE command required');
  if(action.type==='POWER')source='TRAINER_OVERRIDE';
  return apply(action);
 }
 function buses(input){
  // Read only the already-authoritative electrical evaluation; do not create another Electrical instance.
  const b=input?.bus||input?.electrical?.bus;
  if(!b||!Object.hasOwn(b,'transfer1')||!Object.hasOwn(b,'dc1'))throw Error('Existing Electrical bus projection required');
  if(![true,false,null].includes(b.transfer1)||![true,false,null].includes(b.dc1))throw Error('Invalid electrical projection');
  state=engine.apply(state,{type:'POWER',bus:'transfer1',value:b.transfer1});
  state=engine.apply(state,{type:'POWER',bus:'dc1',value:b.dc1});
  source='ELECTRICAL_OWNER_SNAPSHOT';
  return paint();
 }
 let motionTimer=null;
 function stopMotion(){if(motionTimer!==null){clearInterval(motionTimer);motionTimer=null;}}
 function runMotion(){
  if(motionTimer!==null)return;
  // This is only activated by physical lever commands coming from Unified.
  // A jam or hydraulic failure must not create an infinite animation loop.
  motionTimer=setInterval(()=>{
   const prior=JSON.stringify(state.position)+'|'+te.actual;
   try{apply({type:'TICK',seconds:0.2});}
   catch(error){stopMotion();console.error('LE motion tick failed',error);return;}
   if(JSON.stringify(state.position)+'|'+te.actual===prior)stopMotion();
  },200);
 }
 const api=Object.freeze({
  dispatch:authorize,advance:seconds=>apply({type:'TICK',seconds}),
  setElectricalSnapshot:buses,
  snapshot:()=>latest,
  flapActuator:()=>actuator.evaluate(te),
  setHydraulicPressure:psi=>{const result=apply({type:'HYDRAULIC_PRESSURE',psi});if(physicalMotion)runMotion();return result;},
  calibrateFlapSegment:(from,to,seconds)=>{te=actuator.apply(te,{type:'CALIBRATE',from,to,seconds});return actuator.evaluate(te);},
  reset:scenario=>{source='TRAINER_PRESET';return apply({type:'RESET',mode:scenario||'NORMAL'});},
  powerOrigin:()=>source,
  info:Object.freeze({scope:'TRAINING',version:'LEDEV-LOGIC-V1',autobindToAircraft:false})
 });
 window.B737LEDevicesTrainer=api;
 window.addEventListener('b737:le-devices-trainer-command',e=>{
  try{authorize(e.detail||{});}catch(err){console.warn('Rejected LE command',err.message);}
 });
 window.addEventListener('b737:electrical-buses',e=>{
  try{buses(e.detail);}catch(err){console.warn('Rejected LE bus handoff',err.message);}
 });
 window.addEventListener('pagehide',stopMotion);
 window.addEventListener('b737:le-devices-lamp-test',e=>{
  if(typeof e.detail?.pressed==='boolean'){
   // Physical TEST is owned by the panel; do not repaint and erase manual demo lamp states.
   state=engine.apply(state,{type:'TEST',value:e.detail.pressed});
   latest=engine.evaluate(state);
  }
 });
 // Parent cockpit can send explicit LE commands without an invented hidden authority.
 window.addEventListener('message',e=>{
  if(e.origin!==location.origin||e.source!==parent||e.data?.type!=='b737:cockpit-command')return;
  if(e.data.action==='le-devices'&&e.data.command){
   try{
    const cmd=e.data.command;
    if(e.data.originator==='physical-flap-lever'&&cmd.type==='FLAP_LEVER')physicalMotion=true;
    authorize(cmd);
    if(e.data.originator==='physical-flap-lever'&&cmd.type==='FLAP_LEVER')runMotion();
    if(physicalMotion&&cmd.type==='HYDRAULIC'&&cmd.system==='B'&&cmd.value===true)runMotion();
   }catch(err){console.warn('Invalid LE cockpit command',err.message);}
  }
 });
 paint();
})();