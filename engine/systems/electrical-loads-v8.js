/* ATA24 electrical-to-consumer traceability bridge. No airframe wiring inferred.
   Only the FCOM-described TR incoming feeds are automatically bound.
   Private source archive references: FCOM 6.20.9 (DB 1158), 15.10.3 (DB 1880),
   2.40.1-2 (DB 1014-15), 12.10.2 (DB 1826), 13.10.1 (DB 1842).
   Educational trainer only: not a load schedule, MEL, or flight tool. */
(function(root,factory){'use strict';const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.B737ElectricalLoadsV8=api;})
(typeof globalThis!=='undefined'?globalThis:this,function(){'use strict';
 const VERIFIED=Object.freeze([
  Object.freeze({id:'elec.TR1.input',upstream:'transfer1',source:'FCOM-SEPEHRAN-1937',pdfPage:1158,folio:'6.20.9'}),
  Object.freeze({id:'elec.TR2.input',upstream:'transfer2',source:'FCOM-SEPEHRAN-1937',pdfPage:1158,folio:'6.20.9'}),
  Object.freeze({id:'elec.TR3.input',upstream:'main2',source:'FCOM-SEPEHRAN-1937',pdfPage:1158,folio:'6.20.9'})
 ]);
 const LOADS=Object.freeze([
  ['stall.test115vac','STALL','AC115',1880,'15.10.3','115VAC needed for ground test; exact supply bus undocumented'],
  ['stall.computer1','STALL',null,1911,'15.20.7','computer channel power bus and installed feed undocumented'],
  ['stall.computer2','STALL',null,1911,'15.20.7','computer channel power bus and installed feed undocumented'],
  ['dcpcs.controller1','DCPCS',null,1015,'2.40.2','controller feed not identified'],
  ['dcpcs.controller2','DCPCS',null,1015,'2.40.2','controller feed not identified'],
  ['dcpcs.autoOutflowMotor','DCPCS','DC',1015,'2.40.2','brushless DC motor; exact bus not specified'],
  ['cpcs.autoOutflowMotor','CPCS','AC',1014,'2.40.1','AC motor; not applicable to EP-FSI DCPCS config'],
  ['cpcs.standbyOutflowMotor','CPCS','DC',1014,'2.40.1','DC motor; not applicable to EP-FSI DCPCS config'],
  ['fuel.main1FwdPump','FUEL',null,1826,'12.10.2','pump ON function verified; supply bus not identified'],
  ['fuel.main1AftPump','FUEL',null,1826,'12.10.2','pump ON function verified; supply bus not identified'],
  ['fuel.main2FwdPump','FUEL',null,1826,'12.10.2','pump ON function verified; supply bus not identified'],
  ['fuel.main2AftPump','FUEL',null,1826,'12.10.2','pump ON function verified; supply bus not identified'],
  ['fuel.centerLeftPump','FUEL',null,1826,'12.10.2','pump ON function verified; supply bus not identified'],
  ['fuel.centerRightPump','FUEL',null,1826,'12.10.2','pump ON function verified; supply bus not identified'],
  ['hyd.electricPumpA','HYDRAULIC',null,1842,'13.10.1','electrically powered, AC/DC class and bus not identified'],
  ['hyd.electricPumpB','HYDRAULIC',null,1842,'13.10.1','electrically powered, AC/DC class and bus not identified']
 ].map(([id,system,electricClass,page,folio,limitation])=>Object.freeze({id,system,electricClass,source:'FCOM-SEPEHRAN-1937',pdfPage:page,folio,limitation})));
 const AC_BUSES=Object.freeze(['generator1','generator2','main1','main2','transfer1','transfer2','acStandby','groundService']);
 const DC_BUSES=Object.freeze(['dc1','dc2','battery','hotBattery','switchedHotBattery','dcStandby']);
 const classes=Object.freeze({AC115:AC_BUSES,AC:AC_BUSES,DC:DC_BUSES});
 function tri(v){if(v===true||v===false||v===null)return v;throw Error('Electrical bus value must be true / false / null');}
 function electricalInput(e){if(!e||e.schema!=='B737_ELECTRICAL_V7_RESULT'||!e.bus||!e.feed?.tr)throw Error('Electrical V7 evaluated output required');return e;}
 function possibleClass(e,type){
  const names=classes[type];if(!names)return {couldBeAvailable:null,buses:[],reason:'NO_DOCUMENTED_VOLTAGE_CLASS'};
  const values=names.map(bus=>({bus,value:tri(e.bus[bus])}));
  // Global absence is the only definite conclusion; any energized source does NOT prove an LRU feed.
  const impossible=values.every(x=>x.value===false);
  return {couldBeAvailable:impossible?false:null,buses:values,reason:impossible?'ALL_POSSIBLE_CLASS_BUSES_OFF':'BUS_TO_EQUIPMENT_WIRING_NOT_VERIFIED'};
 }
 function project(electrical){const e=electricalInput(electrical);
  const upstream=Object.fromEntries(VERIFIED.map(item=>{
   const energized=tri(e.bus[item.upstream]);
   const key='TR'+item.id.match(/TR([123])/)[1];
   const enabled=Boolean(e.feed.tr[key]);
   // An upstream AC source cannot prove the TR is operating: the TR may itself fail.
   return [item.id,{...item,acBusAvailable:energized,powerConversionOperating:energized===false?false:enabled,qa:'VERIFIED_UPSTREAM_FEED_AND_FAULT_MODEL'}];
  }));
  const loads=Object.fromEntries(LOADS.map(load=>{
   const possibility=possibleClass(e,load.electricClass);
   return [load.id,{...load,assignedBus:null,powered:possibility.couldBeAvailable===false?false:null,
    status:possibility.couldBeAvailable===false?'PROVEN_GLOBAL_CLASS_POWER_LOSS':'UNVERIFIED_EQUIPMENT_FEED',
    reason:possibility.reason,provenance:'SOURCE_FUNCTION_ONLY_NO_EP_FSI_WIRING',powerBusCandidateCount:possibility.buses.length}];
  }));
  return {schema:'B737_ELECTRICAL_LOADS_V8',electricalRevision:e.revision,upstream,loads,
   classEvidence:{AC115:possibleClass(e,'AC115'),DC:possibleClass(e,'DC')},
   coverage:{verifiedUpstream:VERIFIED.length,loadsKnownBus:0,loadsPending:LOADS.length},
   qa:['EP_FSI_WIRING_SCHEDULE_NOT_IN_INDEX','NO_AUTOMATIC_LRU_POWER_TRUE','CPCS_NON_FSI_CONFIGURATION','CROSS_SYSTEM_MUTATION_BLOCKED_WHEN_FEED_UNKNOWN']};
 }
 function handoff(loadsResult){if(!loadsResult||loadsResult.schema!=='B737_ELECTRICAL_LOADS_V8')throw Error('V8 projected loads required');
  const load=(id)=>loadsResult.loads[id];
  // Downstream contracts: false only for globally demonstrated loss of a required voltage class.
  // Never turn null into false or invent which source feeds an individual device.
  const stall=load('stall.test115vac');
  return {schema:'B737_ELECTRICAL_HANDOFF_V8',
   stallGroundTest:{ac115Available:stall.powered===false?false:null,applyAutomatically:stall.powered===false,
    annotation:stall.powered===false?'GLOBAL_115VAC_UNAVAILABLE':'REQUIRES_INDEPENDENT_VERIFIED_FEED_OR_INSTRUCTOR_INPUT'},
   dcpcs:{dcPowerAvailable:null,applyAutomatically:false,annotation:'CONTROLLER_DC_BUS_NOT_VERIFIED'},
   fuelPumps:{applyAutomatically:false,annotation:'CONFIG_LOAD_BUS_IS_TRAINING_SURROGATE_NOT_VERIFIED'},
   hydraulicPumps:{applyAutomatically:false,annotation:'CONFIG_LOAD_BUS_IS_TRAINING_SURROGATE_NOT_VERIFIED'},
   policy:'DO_NOT_MODIFY_SUBSYSTEM_STATE_FROM_UNKNOWN_FEED'};
 }
 return Object.freeze({VERIFIED,LOADS,AC_BUSES,DC_BUSES,project,handoff});
});