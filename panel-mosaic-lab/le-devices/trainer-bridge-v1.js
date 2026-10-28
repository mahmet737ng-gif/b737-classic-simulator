/* LEDEV-LOGIC-V1: training adapter for the approved LEDEV-0006 photo panel.
   Does not own Electrical V7 and does not mutate any guarded control/image.
   Authoritative electrical buses must be supplied by owner or instructor;
   until then modeled power is a clearly documented training assumption.
*/
(function(){
 'use strict';
 const engine=window.B737LEDevicesClassicV1, panel=window.B737LeadingEdgeDevices;
 if(!engine||!panel){console.warn('LE trainer dependency not available');return;}
 let state=engine.initialState(),source='TRAINER_PRESET',mode='NORMAL';
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
  window.dispatchEvent(new CustomEvent('b737:le-classic-projection',{
   detail:{revision:latest.revision,scenario:mode,center:latest.center,overheadPower:latest.overhead.power,
    mismatch:latest.mismatch,source}
  }));
  return latest;
 }
 function apply(action){
  state=engine.apply(state,action);
  if(action.type==='RESET')mode=action.mode||'NORMAL';
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
 const api=Object.freeze({
  dispatch:authorize,advance:seconds=>apply({type:'TICK',seconds}),
  setElectricalSnapshot:buses,
  snapshot:()=>latest,
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
   try{authorize(e.data.command);}catch(err){console.warn('Invalid LE cockpit command',err.message);}
  }
 });
 paint();
})();