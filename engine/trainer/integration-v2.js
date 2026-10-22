/* 737 Classic single-device Systems, Fault & Checklist integration v2.
 * 1 authoritative trainer-core state; warnings/indicator projections via existing warning-engine.
 * Separate lab only, not an adapter to the original copyrighted cockpit artwork.
 * Source locations summarized; deliberately no aircraft flight/stall performance model.
 */
(function(root,factory){'use strict';const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.B737IntegrationV2=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){'use strict';
 const CONTROLS=Object.freeze({
  'OH.BATTERY':'battery','OH.BUS_TRANS':'busTransferAuto','OH.GROUND_AVAILABLE':'externalAvailable','OH.GRD_PWR':'externalConnected',
  'OH.ENGINE_1_RUNNING':'engine1Running','OH.ENGINE_2_RUNNING':'engine2Running','OH.GEN_1':'gen1Connected','OH.GEN_2':'gen2Connected',
  'OH.APU_RUNNING':'apuRunning','OH.APU_GEN_1':'apuGen1Connected','OH.APU_GEN_2':'apuGen2Connected',
  'OH.FUEL_MAIN1_FWD':'fuel.leftFwd','OH.FUEL_MAIN1_AFT':'fuel.leftAft','OH.FUEL_MAIN2_FWD':'fuel.rightFwd','OH.FUEL_MAIN2_AFT':'fuel.rightAft',
  'OH.FUEL_CTR_L':'fuel.centerLeft','OH.FUEL_CTR_R':'fuel.centerRight','OH.HYD_ELEC_A':'hyd.elecA','OH.HYD_ELEC_B':'hyd.elecB',
  'OH.HYD_ENG_A':'engineHyd.A','OH.HYD_ENG_B':'engineHyd.B'
 });
 const FAULTS=Object.freeze({
  'ELEC.GEN1_FAILED':'gen1Failed','ELEC.GEN2_FAILED':'gen2Failed','ELEC.TRANSFER1_FAILED':'transfer1Failed',
  'ELEC.TRANSFER2_FAILED':'transfer2Failed','HYD.ELEC_A_FAILED':'elecAFailed','HYD.ELEC_B_FAILED':'elecBFailed',
  'HYD.ELEC_A_OVERHEAT':'elecAOverheat','HYD.ELEC_B_OVERHEAT':'elecBOverheat',
  'FUEL.MAIN1_FWD_FAILED':'fuel_leftFwd_Failed','FUEL.MAIN1_AFT_FAILED':'fuel_leftAft_Failed',
  'FUEL.MAIN2_FWD_FAILED':'fuel_rightFwd_Failed','FUEL.MAIN2_AFT_FAILED':'fuel_rightAft_Failed',
  'FUEL.CENTER_L_FAILED':'fuel_centerLeft_Failed','FUEL.CENTER_R_FAILED':'fuel_centerRight_Failed'
 });
 const ENV_FIELDS=Object.freeze({
  onGround:'boolean',stallWarning:'boolean',engine1Fire:'boolean',engine2Fire:'boolean',apuFire:'boolean',
  wingFlaps:'number',cabinAltitudeFt:'number',pressureAltitudeFt:'number',selectedAltitudeFt:'number',
  radioAltitudeFt:'number',iasKt:'number',vmoKt:'number',mach:'number',mmo:'number',
  engineN1Pct:'number',engineN2Pct:'number',taxiIn:'boolean',
  controllerNotResponding:'boolean',dcpcsControllerFault:'boolean',outflowControlFault:'boolean',
  cabinDifferentialPsid:'number',cabinVerticalRateFtMin:'number',
  stallTest1:'boolean',stallTest2:'boolean',hydNo1PressureLow:'boolean',hydNo2PressureLow:'boolean'
 });
 const BASE_ENV=Object.freeze({
  onGround:true,stallWarning:false,engine1Fire:false,engine2Fire:false,apuFire:false,
  wingFlaps:5,cabinAltitudeFt:5000,pressureAltitudeFt:0,selectedAltitudeFt:10000,radioAltitudeFt:0,
  iasKt:0,vmoKt:340,mach:0,mmo:0.82,engineN1Pct:25,engineN2Pct:70,
  taxiIn:false,controllerNotResponding:false,dcpcsControllerFault:false,outflowControlFault:false,
  cabinDifferentialPsid:0,cabinVerticalRateFtMin:0,stallTest1:false,stallTest2:false,
  hydNo1PressureLow:false,hydNo2PressureLow:false
 });
 const SOURCE_REFS=Object.freeze({
  electrical:'FCOM 6.10.8-9; 6.20.1-4',fuel:'FCOM 12.10.2-3',hydraulics:'FCOM 13.10.1',
  warnings:'FCOM 15.20',dcpcs:'FCOM 2.40.4; 2.40.7; 2.40.9',stall:'FCOM 15.10.3; 15.20.7',
  qrh:'QRH 6.1-6.4 (paraphrased educational checkpoints)'
 });
 const NUM_OK=v=>typeof v==='number'&&Number.isFinite(v);
 function newWarn(WarningEngine){if(typeof WarningEngine!=='function')throw new Error('Existing WarningEngine constructor required');return new WarningEngine({variant:'737-300'});}
 class Session{
  constructor({core,WarningEngine}={}){
   if(!core||!core.initialState||!core.derive||!core.apply)throw new Error('Trainer core required');
   this.core=core;this.WarningEngine=WarningEngine;
   this.reset();
  }
  reset(){this.state=this.core.initialState();this.env={...BASE_ENV};this.nowMs=0;this.qualifiedSince=null;
   this.warning=newWarn(this.WarningEngine);this.log=[];this.lastResult=null;
   return this.render();}
  send(action){
   if(!action||typeof action!=='object')throw new Error('Command object required');
   const {type}=action;
   if(type==='RESET')return this.reset();
   if(type==='SWITCH'){
    if(!Object.prototype.hasOwnProperty.call(CONTROLS,action.id))throw new Error('Unknown cockpit switch');
    if(typeof action.value!=='boolean')throw new Error('Switch value must be boolean');
    this.state=this.core.apply(this.state,{type:'CONTROL',path:CONTROLS[action.id],value:action.value});
   }else if(type==='FAULT'){
    if(!Object.prototype.hasOwnProperty.call(FAULTS,action.id))throw new Error('Unknown instructor fault');
    if(typeof action.active!=='boolean')throw new Error('Fault active must be boolean');
    this.state=this.core.apply(this.state,{type:'FAULT',id:FAULTS[action.id],active:action.active});
   }else if(type==='ENV'){
    if(!Object.prototype.hasOwnProperty.call(ENV_FIELDS,action.key))throw new Error('Unknown simulator sensor');
    if(typeof action.value!==ENV_FIELDS[action.key]||(ENV_FIELDS[action.key]==='number'&&!NUM_OK(action.value)))throw new Error('Invalid sensor type');
    if(action.key==='stallWarning' && action.value===true && !action.instructor)throw new Error('Stall envelope not calculated; instructor simulation required');
    this.env[action.key]=action.value;
   }else if(type==='SCENARIO'){
    if(action.id!=='bus1'&&action.id!=='bus2'&&action.id!=='none')throw new Error('Unknown scenario');
    this.state=this.core.apply(this.state,{type:'SCENARIO',id:action.id});
   }else if(type==='ACK_CABIN')this.warning.cutoutCabin();
   else if(type==='ACK_FIRE')this.warning.acknowledgeFire();
   else if(type==='ADVANCE'){
    if(!Number.isInteger(action.ms)||action.ms<0||action.ms>600000)throw new Error('Invalid simulated time delta');
    this.nowMs+=action.ms;
   }else throw new Error('Unknown training command '+type);
   this.log.push({number:this.log.length+1,atMs:this.nowMs,action:JSON.parse(JSON.stringify(action))});
   return this.render();
  }
  render(){
   const d=this.core.derive(this.state),e=this.env;
   const w=this.warning.update({
    onGround:e.onGround,flaps:e.wingFlaps,gearDownLocked:true,pressureAltitudeFt:e.pressureAltitudeFt,
    selectedAltitudeFt:e.selectedAltitudeFt,radioAltitudeFt:e.radioAltitudeFt,cabinAltitudeFt:e.cabinAltitudeFt,
    iasKt:e.iasKt,vmoKt:e.vmoKt,mach:e.mach,mmo:e.mmo,stallWarning:e.stallWarning,
    engine1Fire:e.engine1Fire,engine2Fire:e.engine2Fire,apuFire:e.apuFire,
    leadingEdgeTakeoff:true,speedbrakeDown:true,parkingBrakeSet:false,stabilizerTrimTakeoff:true,
    thrustLever1Angle:45,thrustLever2Angle:45,takeoffThrust:false
   });
   // FCOM's ground prepressurization uses qualified N1 AND N2 for 1.5 seconds.
   // Source provides logical block association, not the physical Stall Management channel/pin.
   const qualify=e.onGround && e.engineN1Pct>60 && e.engineN2Pct>89;
   if(!qualify)this.qualifiedSince=null;
   else if(this.qualifiedSince===null)this.qualifiedSince=this.nowMs;
   const qualified=qualify && this.nowMs-this.qualifiedSince>=1500;
   const dcpcsPower=Boolean(d.dc.bus1||d.dc.bus2); // TRAINING SURROGATE, not installed DCPCS feed.
   const dcpcsFault=!dcpcsPower||e.dcpcsControllerFault||e.outflowControlFault||(
    e.controllerNotResponding&&(e.cabinDifferentialPsid>8.3||Math.abs(e.cabinVerticalRateFtMin)>2000||e.cabinAltitudeFt>15800));
   const outflowValveCommand=dcpcsFault?'TRANSFER_TO_ALTN':qualified?'MODULATE_TOWARD_CLOSED':
    (e.onGround&&e.taxiIn&&e.engineN1Pct<50)?'SLOWLY_OPEN_FULL':'NO_NEW_COMMAND';
   const stallTestAuthorized=e.onGround && Boolean(d.generatorBus[1]||d.generatorBus[2]); // 115VAC actual bus, not assumed battery DC
   const stallTest=stallTestAuthorized&&(e.stallTest1||e.stallTest2);
   const checklist=this.core.checklist(this.state);
   const alarms=[...w.active.map(a=>({id:a.id,priority:a.priority??0,asset:a.asset||null,origin:'WARNING_ENGINE'}))];
   const inputLabels={
    dcpcs:{power:'TRAINING_ROUTING_UNVERIFIED',n1:e.engineN1Pct,n2:e.engineN2Pct,airGround:e.onGround?'GROUND':'AIR'},
    stall:{aoaThreshold:'MISSING_SOURCE_NO_CALCULATION',forcedTrainerStall:e.stallWarning,groundTest:stallTest}
   };
   const result={schema:'B737_TRAINER_INTEGRATION_V2',seq:this.state.seq,clockMs:this.nowMs,
    sources:SOURCE_REFS,controls:this.state.controls,faults:this.state.faults,
    electrical:{generatorBus:d.generatorBus,transferBus:d.transferBus,indicators:d.indicators},
    fuel:d.fuel,hyd:d.hyd,systemHyd:d.systemHyd,
    warning:{lamps:w.lamps,active:alarms,events:w.events},
    dcpcs:{autoFail:dcpcsFault,selectedMode:dcpcsFault?'ALTN':'AUTO',prepressQualified:qualified,outflowValveCommand},
    stall:{testAuthorized:stallTestAuthorized,columnsVibrateOnTest:stallTest,airborneShakerSimulated:!e.onGround&&e.stallWarning},
    checklist,environment:{...e},inputLabels,
    limitations:['FUEL_HYD_EQUIPMENT_BUS_ASSIGNMENTS_SURROGATE','STALL_AOA_LAW_NOT_IMPLEMENTED','DCPCS_POWER_FEED_SURROGATE','QRH_EDUCATIONAL_ONLY','NO_PHOTO_HOTSPOT_WIRING']};
   this.lastResult=result;return result;
  }
  replay(commands){this.reset();for(const cmd of commands)this.send(cmd);return this.render();}
 }
 return Object.freeze({Session,CONTROLS,FAULTS,BASE_ENV,SOURCE_REFS});
});