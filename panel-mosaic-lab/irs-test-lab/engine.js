/* B737 Classic IRS QRH test bench: actual IRS V1 core and Electrical Evidence V2,
 * with EXPLICIT injected overrides for equipment failures not yet in core.
 * Does not connect to flight controls, actual cockpit, or frozen 93-file UI.
 */
(function(root,factory){'use strict';
 const mod=typeof module==='object'&&module.exports;
 const core=mod?require('../../engine/systems/irs-trainer-core-v1.cjs'):root.B737IRSTrainerCoreV1;
 const evidence=mod?require('../../engine/systems/irs-electrical-evidence-v2.js'):root.B737IRSElectricalEvidenceV2;
 const scenarios=mod?require('./scenarios.js'):root.B737IRSTestScenariosV1;
 const api=factory(core,evidence,scenarios);
 if(mod)module.exports=api;
 if(root)root.B737IRSTestLabEngineV1=api;
})(typeof window!=='undefined'?window:null,function(Core,Electrical,Scenarios){'use strict';
if(!Core||!Electrical||!Scenarios)throw Error('IRS lab requires real backend core, electrical evidence and QRH catalogue');
const sides=['L','R'];
const pos='N35395 E051254',highPos='N71123 E010000',fiftyPos='N50100 E010000';
const initialBus=()=>({acStandby:true,transfer2:true,switchedHotBattery:true,battery:true});
const clone=x=>JSON.parse(JSON.stringify(x));
function create(){
 let state,elec,bus,projected,clock,stationary,selected,activeScenario,log,sim,checklist,error,transfer;
 const coreStatus=side=>Core.status(state,side);
 function record(message,kind='INFO'){
  log.unshift({at:clock.toFixed(1),kind,message:String(message)});
  if(log.length>90)log.length=90;
 }
 function evaluate(dt=0){
  const res=Electrical.evaluate(elec,{
   electrical:{schema:'B737_ELECTRICAL_V7_RESULT',bus:{...bus}},
   modes:{L:state.units.L.mode,R:state.units.R.mode},
   unitStates:{L:coreStatus('L'),R:coreStatus('R')},dtSec:dt,
   cbEvidence:sim.cbCandidate?{candidate:sim.cbCandidate}:null
  });
  elec=res.state;projected=res.units;
  const reconciled=Electrical.reconcileCore(Core,state,res);
  state=reconciled.coreState;
  return res;
 }
 function fresh(mode='COLD'){
  state=Core.initialState({northAlignHoldLatitude:50,motionRecoveryPolicy:'AUTO_FULL_RESTART'});
  elec=Electrical.initialState();
  bus=initialBus();projected=null;clock=0;stationary=true;selected='L';
  activeScenario=null;log=[];sim={L:{dcFail:false,fault:false,attRecover:false},R:{dcFail:false,fault:false,attRecover:false},cbCandidate:null};
  checklist=[];error='';transfer='NORMAL';
  // Prime an actual live BATTERY BUS and AC feed for both IRUs.
  for(const side of sides)state=Core.apply(state,{type:'POWER',side,available:true});
  if(mode==='READY'){
   for(const side of sides)state=Core.apply(state,{type:'SELECT_MODE',side,mode:'NAV'});
   state=Core.apply(state,{type:'FMC_SET_IRS_POS',position:pos});
   state=Core.tick(state,{dtSec:3.5,stationary:true,valid:true,gsKt:0,trueTrackDeg:0,trueHeadingDeg:0});
   for(let i=0;i<120;i++)state=Core.tick(state,{dtSec:5,stationary:true,valid:true,gsKt:0,trueTrackDeg:0,trueHeadingDeg:0});
   clock=603.5;
   evaluate(0);
   record('L/R NAV READY — stable reference for fault testing');
  }else record('COLD & DARK mode selection — both selectors OFF');
  return snapshot();
 }
 function energize(side){
  if(state.units[side].powered)return;
  const ac=side==='L'?bus.acStandby:bus.transfer2;
  if(bus.battery!==true||!(ac===true||bus.switchedHotBattery===true))
   throw Error('NO PROVEN POWER: restore BATTERY BUS and AC / switched-hot DC first');
  state=Core.apply(state,{type:'POWER',side,available:true});
 }
 function setMode(side,mode){
  if(!sides.includes(side))throw Error('Invalid IRS side');
  if(!['OFF','ALIGN','NAV','ATT'].includes(mode))throw Error('Invalid MSU selector');
  if(mode!=='OFF')energize(side);
  state=Core.apply(state,{type:'SELECT_MODE',side,mode});
  evaluate(0);record(side+' MSU → '+mode,'ACTION');
  return snapshot();
 }
 function setBus(name,value){
  if(!Object.hasOwn(bus,name)||typeof value!=='boolean')throw Error('Invalid electrical BUS switch');
  bus[name]=value;evaluate(0);
  record(name.toUpperCase()+' = '+(value?'POWERED':'LOST'),'ELECTRICAL');
  return snapshot();
 }
 function setPos(input=pos,side=null,origin=null){
  const sidesArg=side?[side]:sides.filter(id=>state.units[id].powered&&
    ['SELFTEST','ALIGNING','WAIT_POSITION','HIGH_LAT_READY','ALIGN_READY','FAST_REALIGN'].includes(state.units[id].phase));
  state=Core.apply(state,{type:'FMC_SET_IRS_POS',sides:sidesArg,position:input,originPosition:origin||undefined});
  record('FMC SET IRS POS '+input+' → '+sidesArg.join('/'),'INPUT');
  return snapshot();
 }
 function checks(side,e){
  state=Core.apply(state,{type:'SET_ALIGNMENT_CHECKS',side,evidence:e});
  record(side+' IRU comparison evidence updated','INSTRUCTOR');
  return snapshot();
 }
 function advance(seconds){
  if(!Number.isFinite(seconds)||seconds<=0||seconds>2000)throw Error('Advance 0–2000 seconds');
  let remaining=seconds;let n=0;
  while(remaining>1e-7&&n++<6000){
   const dt=Math.min(5,remaining);
   evaluate(dt);
   state=Core.tick(state,{dtSec:dt,stationary,valid:true,gsKt:stationary?0:7,
    trueTrackDeg:0,trueHeadingDeg:0,altitudeFt:3963});
   clock+=dt;remaining-=dt;
   // If actual core went OFF at shutdown end, reevaluate electrical source.
   if(remaining<=1e-7)evaluate(0);
  }
  record('TIME +'+Number(seconds.toFixed(2))+' sec · '+(stationary?'PARKED':'MOVING'),'TIME');
  return snapshot();
 }
 function setMotion(moving){
  stationary=!moving;
  record(moving?'SIMULATOR MOTION 7 kt':'AIRCRAFT PARKED 0 kt','MOTION');
  return snapshot();
 }
 function inject(side,kind,on=true){
  if(!sides.includes(side))throw Error('Invalid side');
  if(!['dcFail','fault','attRecover'].includes(kind))throw Error('Unsupported injection');
  sim[side][kind]=!!on;
  record(side+' '+kind.toUpperCase()+' → '+(on?'INJECTED':'CLEARED'),'INSTRUCTOR');
  return snapshot();
 }
 function select(side){if(!sides.includes(side))throw Error('Invalid side');selected=side;return snapshot();}
 function selectTransfer(mode){if(!['NORMAL','BOTH ON L','BOTH ON R'].includes(mode))throw Error('Invalid transfer');
  transfer=mode;record('IRS TRANSFER '+mode+' (bench simulation; not connected to aircraft)','INSTRUCTOR');return snapshot();}
 function rollup(side){
  const c=coreStatus(side),p=projected?.[side]||null,x=sim[side];
  const normalPower=!!p?.powered;
  const syntheticFault=x.fault;
  return {...c,
   alignLamp:c.alignLamp,alignLampMode:c.alignLampMode||'OFF',
   onDcLamp:p?.onDcLamp===null?null:p?.onDcLamp??c.onDcLamp,
   dcFailLamp:p?.dcFailLamp===null?null:(x.dcFail?true:p?.dcFailLamp??false),
   faultLamp:c.faultLamp||syntheticFault,
   positionValid:c.positionValid&&!syntheticFault,
   powerSource:p?.source||(c.powered?'INITIAL_BATTERY':'OFF'),
   powerConfidence:p?.electricalConfidence||'BENCH_PRESET',
   rightBackupRemainingSeconds:p?.rightBackupRemainingSeconds??null,
   syntheticFault,syntheticDcFail:x.dcFail,
   attRecover:x.attRecover,
   electricallyPowered:p?.powered??c.powered
  };
 }
 function snapshot(){
  return {schema:'B737_IRS_QRH_TEST_LAB_V1',clock,selected,activeScenario,stationary,
   bus:clone(bus),units:{L:rollup('L'),R:rollup('R')},
   powerDiagnostics:{rightBackupSeconds:elec.rightBackupElapsedSec,cbRoutingVerified:false},
   checklist:checklist.slice(),transfer,error,log:log.slice(0,60),sim:clone(sim),
   currentScenario:Scenarios.byId(activeScenario),
   sourceType:'LOCAL_BENCH_ISOLATED_FROM_UNIFIED',
   sourceNote:'Internal IRS status + evaluated electrical bus; simulated faults are explicitly marked'};
 }
 function safe(action){try{error='';return action()}catch(e){error=e?.message||String(e);record(error,'REJECTED');return snapshot();}}
 function scenario(id,side='L'){
  const item=Scenarios.byId(id);if(!item)throw Error('Unknown IRS QRH scenario');
  fresh(['POWER','QRH','CB'].includes(item.group)||['fast-realign','off-shutdown'].includes(id)?'READY':'COLD');
  selected=side;activeScenario=id;checklist=item.steps.map(()=>false);
  // Every preset runs against real Core and electrical evidence. Simulated
  // effects are clearly marked and never passed as an actual IRU core fault.
  switch(id){
   case 'normal-nav':setMode(side,'NAV');setPos(pos,side);advance(3.5);break;
   case 'normal-align':setMode(side,'ALIGN');setPos(fiftyPos,side);advance(3.5);break;
   case 'no-position':setMode(side,'NAV');advance(3.5);advance(600);break;
   case 'motion':setMode(side,'NAV');setPos(pos,side);advance(3.5);setMotion(true);advance(1);break;
   case 'stored-position':setMode(side,'NAV');checks(side,{storedPositionConsistent:false});setPos(pos,side);break;
   case 'computed-position':setMode(side,'NAV');checks(side,{computedLatitudeConsistent:false});setPos(pos,side);break;
   case 'computed-twice':setMode(side,'NAV');checks(side,{computedLatitudeConsistent:false});setPos(pos,side);setPos(pos,side);break;
   case 'verify-origin':setMode(side,'NAV');setPos(pos,side,{lat:34,lon:52});break;
   case 'invalid-format':setMode(side,'NAV');safe(()=>setPos('N35995 E051254',side));break;
   case 'high-lat-mode':setMode(side,'NAV');setPos(highPos,side);break;
   case 'high-lat-correct':setMode(side,'ALIGN');setPos(highPos,side);advance(3.5);break;
   case 'fast-realign':setMode(side,'ALIGN');break;
   case 'off-shutdown':setMode(side,'OFF');break;
   case 'on-dc-left':setBus('acStandby',false);break;
   case 'on-dc-right':setBus('transfer2',false);break;
   case 'right-300':setBus('transfer2',false);advance(300);break;
   case 'dual-on-dc':setBus('acStandby',false);setBus('transfer2',false);break;
   case 'dc-fail-left':inject('L','dcFail',true);break;
   case 'dc-fail-right':inject('R','dcFail',true);break;
   case 'dc-fail-dual':setBus('switchedHotBattery',false);break;
   case 'power-loss-left':setBus('switchedHotBattery',false);setBus('acStandby',false);break;
   case 'power-restore':
    setBus('switchedHotBattery',false);setBus(side==='L'?'acStandby':'transfer2',false);
    setBus(side==='L'?'acStandby':'transfer2',true);break;
   case 'fault-ground':
    fresh('COLD');activeScenario=id;checklist=item.steps.map(()=>false);selected=side;
    setMode(side,'NAV');checks(side,{computedLatitudeConsistent:false});
    setPos(pos,side);setPos(pos,side);break;
   case 'fault-flight':inject(side,'fault',true);break;
   case 'att-relevel':inject(side,'fault',true);setMode(side,'ATT');inject(side,'attRecover',true);break;
   case 'fault-both':inject('L','fault',true);inject('R','fault',true);break;
   case 'unverified-cb':sim.cbCandidate='P18-2|ALL|D4';evaluate(0);record('IRS NO.1 AC CB — wiring NOT VERIFIED','INSTRUCTOR');break;
   default:throw Error('Preset has no handler');
  }
  record('QRH SCENARIO SELECTED: '+item.title,'SCENARIO');
  return snapshot();
 }
 function progressStep(index,checked){
  if(!Number.isInteger(index)||index<0||index>=checklist.length)throw Error('Invalid QRH training step');
  checklist[index]=!!checked;record('QRH training step '+(index+1)+(checked?' CHECK':' UNCHECK'),'CHECKLIST');
  return snapshot();
 }
 function checkStatus(){
  const s=snapshot();const L=s.units.L,R=s.units.R,side=s.selected,u=s.units[side];
  switch(activeScenario){
   case 'no-position':return u.alignStatusCode===8&&u.alignLampMode==='FLASHING';
   case 'motion':return u.alignStatusCode===3&&!u.faultLamp;
   case 'stored-position':return u.alignStatusCode===12;
   case 'computed-position':return u.alignStatusCode===4&&!u.faultLamp;
   case 'computed-twice':return u.alignStatusCode===4&&u.faultLamp;
   case 'normal-nav':return u.phase==='ALIGNING';
   case 'normal-align':return u.phase==='ALIGNING'&&u.mode==='ALIGN';
   case 'verify-origin':return u.cduMessage==='VERIFY POSITION'&&u.alignStatusCode===null;
   case 'invalid-format':return /minutes/.test(error);
   case 'high-lat-mode':return u.phase==='MODE_MISMATCH';
   case 'high-lat-correct':return u.phase==='ALIGNING'&&u.mode==='ALIGN';
   case 'fast-realign':return u.phase==='FAST_REALIGN';
   case 'off-shutdown':return u.phase==='SHUTDOWN';
   case 'on-dc-left':return L.onDcLamp===true&&L.positionValid;
   case 'on-dc-right':return R.onDcLamp===true&&R.positionValid;
   case 'right-300':return R.phase==='POWER_LOST'&&!R.positionValid&&L.positionValid;
   case 'dual-on-dc':return L.onDcLamp===true&&R.onDcLamp===true;
   case 'dc-fail-left':return L.dcFailLamp===true&&L.positionValid;
   case 'dc-fail-right':return R.dcFailLamp===true&&R.positionValid;
   case 'dc-fail-dual':return L.dcFailLamp===true&&R.dcFailLamp===true&&L.positionValid&&R.positionValid;
   case 'power-loss-left':return L.phase==='POWER_LOST'&&!L.positionValid&&R.positionValid;
   case 'power-restore':return u.phase==='SELFTEST'&&!u.positionValid;
   case 'fault-ground':return u.faultLamp&&u.alignStatusCode===4;
   case 'fault-flight':return u.faultLamp&&!u.positionValid;
   case 'att-relevel':return u.mode==='ATT'&&u.attRecover;
   case 'fault-both':return L.faultLamp&&R.faultLamp&&!L.positionValid&&!R.positionValid;
   case 'unverified-cb':return s.powerDiagnostics.cbRoutingVerified===false&&L.positionValid;
   default:return null;
  }
 }
 fresh();
 return Object.freeze({snapshot,reset:fresh,scenario,select,setMode,setBus,setPos,checks,advance,
  setMotion,inject,selectTransfer,progressStep,safe,checkStatus,Core,Electrical,Scenarios});
}
return Object.freeze({create});
});
