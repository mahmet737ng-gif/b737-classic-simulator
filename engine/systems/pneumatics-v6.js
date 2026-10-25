/* B737 Classic pneumatic/air conditioning discrete trainer V6.
 * Sources: private Technical Database FCOM pages 982-984 (2.10.1-3), 988-989
 * (2.10.7-8), 1000-1001 (2.20.1-2), 1004 (2.20.5),
 * 1006-1007 (2.30.1-2), 1010 (2.30.5).
 * No pressure, temperature, valve travel or actual bus wiring physics.
 */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.B737PneumaticsV6=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){'use strict';
const SIDES=['L','R'];
const FAULTS=Object.freeze(['engineBleed1ValveFailed','engineBleed2ValveFailed','apuBleedValveFailed','isolationJammedOpen','isolationJammedClosed','packLValveFailed','packRValveFailed','recircFanFailed','recircFanLFailed','recircFanRFailed']);
const CONTROL_TYPES=Object.freeze({engineBleed1:['ON','OFF'],engineBleed2:['ON','OFF'],apuBleed:['ON','OFF'],isolation:['CLOSE','AUTO','OPEN'],packL:['OFF','AUTO','HIGH'],packR:['OFF','AUTO','HIGH'],recirc:['OFF','AUTO'],recircL:['OFF','AUTO'],recircR:['OFF','AUTO'],aircraftFamily:['B737-300-500','B737-400'],temperatureL:['AUTO','MANUAL'],temperatureR:['AUTO','MANUAL']});
const INPUT_TYPES=Object.freeze({engine1Running:'boolean',engine2Running:'boolean',apuRunning:'boolean',onGround:'boolean',flapsUp:'boolean',bleedValveControlPower:'boolean',isolationAcPower:'boolean',recircAcPower:'boolean',ductGaugeAcPower:'boolean',externalAirAvailable:'boolean',bleed1Overlimit:'boolean',bleed2Overlimit:'boolean',packLOverheat:'boolean',packROverheat:'boolean',ductLOverheat:'boolean',ductROverheat:'boolean',wingBodyLLeakDetected:'boolean',wingBodyRLeakDetected:'boolean',wingBodyTestHeld:'boolean',cabinAltitudeFt:'number',ductLeftPsi:'numberOrNull',ductRightPsi:'numberOrNull'});
const SOURCES=Object.freeze({bleed:'FCOM 2.20.1-2; indexed pages 1000-1001',panel:'FCOM 2.10.2-3; indexed pages 983-984',packs:'FCOM 2.10.7-8,2.30.1-2; indexed pages 988-989,1006-1007',cooling:'FCOM 2.30.5; indexed page 1010',wingBody:'FCOM 2.20.5; indexed page 1004',cabinHorn:'FCOM 15.20 via existing WarningEngine'});
const copy=v=>JSON.parse(JSON.stringify(v));
function initial(){return {schema:'b737-pneumatics/6',seq:0,controls:{engineBleed1:'ON',engineBleed2:'ON',apuBleed:'OFF',isolation:'AUTO',packL:'AUTO',packR:'AUTO',recirc:'AUTO',recircL:'AUTO',recircR:'AUTO',aircraftFamily:'B737-300-500',temperatureL:'AUTO',temperatureR:'AUTO'},inputs:{engine1Running:true,engine2Running:true,apuRunning:false,onGround:true,flapsUp:false,bleedValveControlPower:true,isolationAcPower:true,recircAcPower:true,ductGaugeAcPower:true,externalAirAvailable:false,bleed1Overlimit:false,bleed2Overlimit:false,packLOverheat:false,packROverheat:false,ductLOverheat:false,ductROverheat:false,wingBodyLLeakDetected:false,wingBodyRLeakDetected:false,wingBodyTestHeld:false,cabinAltitudeFt:0,ductLeftPsi:null,ductRightPsi:null},faults:Object.fromEntries(FAULTS.map(f=>[f,false])),latched:{bleed1:false,bleed2:false,packL:false,packR:false,ductL:false,ductR:false},events:[]};}
function ensure(s){if(!s||s.schema!=='b737-pneumatics/6'||!s.controls||!s.inputs||!s.latched)throw Error('Invalid pneumatic state');}
function validateInput(k,v){if(!Object.prototype.hasOwnProperty.call(INPUT_TYPES,k))throw Error('Unknown sensor '+k);const type=INPUT_TYPES[k];if(type==='boolean'&&typeof v!=='boolean')throw Error('Expected Boolean');if(type==='number'&&(typeof v!=='number'||!Number.isFinite(v)))throw Error('Expected finite number');if(type==='numberOrNull'&&v!==null&&(typeof v!=='number'||!Number.isFinite(v)||v<0))throw Error('Expected nonnegative pressure or null');}
function syncTrips(n){const i=n.inputs;for(const [target,trigger] of [['bleed1','bleed1Overlimit'],['bleed2','bleed2Overlimit'],['packL','packLOverheat'],['packR','packROverheat'],['ductL','ductLOverheat'],['ductR','ductROverheat']])if(i[trigger])n.latched[target]=true;}
function apply(s,command){ensure(s);if(!command||typeof command.type!=='string')throw Error('Invalid pneumatic command');if(command.type==='RESET')return initial();const n=copy(s),c=n.controls,i=n.inputs;
 switch(command.type){
 case 'CONTROL':if(!Object.prototype.hasOwnProperty.call(CONTROL_TYPES,command.key)||!CONTROL_TYPES[command.key].includes(command.value))throw Error('Invalid switch/detent');c[command.key]=command.value;break;
 case 'SENSOR':validateInput(command.key,command.value);i[command.key]=command.value;break;
 case 'FAULT':if(!FAULTS.includes(command.id)||typeof command.active!=='boolean'||command.instructor!==true)throw Error('Instructor-only fault command');n.faults[command.id]=command.active;break;
 case 'TRIP_RESET':{
   // FCOM: reset only if the initiating condition has been corrected.
   const map={bleed1:'bleed1Overlimit',bleed2:'bleed2Overlimit',packL:'packLOverheat',packR:'packROverheat',ductL:'ductLOverheat',ductR:'ductROverheat'};
   for(const [lamp,sensor] of Object.entries(map))if(!i[sensor])n.latched[lamp]=false;
   break;}
 default:throw Error('Unknown pneumatic action');
 }
 syncTrips(n);n.seq++;n.events.push({seq:n.seq,command:copy(command)});if(n.events.length>500)n.events.shift();return n;
}
function derive(s){ensure(s);const c=s.controls,i=s.inputs,f=s.faults,t=s.latched;
 // Valve availability is an explicit instructor signal. Missing physical bus wiring is NOT inferred.
 const e1=c.engineBleed1==='ON'&&i.engine1Running&&i.bleedValveControlPower&&!t.bleed1&&!f.engineBleed1ValveFailed;
 const e2=c.engineBleed2==='ON'&&i.engine2Running&&i.bleedValveControlPower&&!t.bleed2&&!f.engineBleed2ValveFailed;
 const apu=c.apuBleed==='ON'&&i.apuRunning&&i.bleedValveControlPower&&!f.apuBleedValveFailed;
 const bothBleedsSelected=c.engineBleed1==='ON'&&c.engineBleed2==='ON';
 const bothPacksSelected=c.packL!=='OFF'&&c.packR!=='OFF';
 let isolation=i.isolationAcPower?(c.isolation==='OPEN'||(c.isolation==='AUTO'&&!(bothBleedsSelected&&bothPacksSelected))):null;
 if(f.isolationJammedOpen)isolation=true;else if(f.isolationJammedClosed)isolation=false;
 // APU / external ground source manifold side is not established by page-level sources.
 // Deliberately report UNKNOWN instead of inventing precise duct source distribution.
 function supply(side){const local=side==='L'?e1:e2,opposite=side==='L'?e2:e1;if(local)return true;
  if(isolation===true&&opposite)return true;
  if(apu||i.externalAirAvailable)return null; // functional common source; side distribution NOT VERIFIED
  if(isolation===null&&opposite)return null;
  return false;
 }
 const duct={L:{engineSource:e1,anySupply:supply('L')},R:{engineSource:e2,anySupply:supply('R')}};
 const pack={};for(const side of SIDES){const key='pack'+side,mode=c[key],overheat=t[key],available=duct[side].anySupply;const valid=mode!=='OFF'&&!overheat&&!f[key+'ValveFailed'];const operational=valid?(available===true?true:available===null?null:false):false;pack[side]={selectedMode:mode,operational,tripOff:overheat,ductOverheat:t['duct'+side],mixValveCommand:overheat||t['duct'+side]||mode==='OFF'?'FULL_COLD':'TEMP_SELECTOR',flow:'OFF'};}
 const operatingCount=SIDES.filter(x=>pack[x].operational===true).length;
 const apuOnly=apu&&c.engineBleed1==='OFF'&&c.engineBleed2==='OFF';
 for(const side of SIDES){const p=pack[side];if(p.operational===false){p.flow='OFF';continue;}if(p.operational===null){p.flow='UNKNOWN_SOURCE_ROUTE';continue;}
  if(c['pack'+side]==='HIGH')p.flow=i.onGround&&apu?'APU_HIGH':'HIGH';
  else if(apuOnly)p.flow='HIGH';
  else if(operatingCount===1&&!i.onGround&&i.flapsUp)p.flow='HIGH';
  else p.flow='NORMAL';
 }
 // Legacy 300/500 single fan remains unchanged. The 400 has two independently
 // selected fans; physical AC availability is an explicit existing input.
 const singleRecircActive=c.recirc==='AUTO'&&i.recircAcPower&&!f.recircFanFailed&&!(operatingCount===2&&(c.packL==='HIGH'||c.packR==='HIGH'));
 const recircFans={
  L:{selectedMode:c.recircL??'AUTO',running:(c.recircL??'AUTO')==='AUTO'&&i.recircAcPower&&!f.recircFanLFailed},
  R:{selectedMode:c.recircR??'AUTO',running:(c.recircR??'AUTO')==='AUTO'&&i.recircAcPower&&!f.recircFanRFailed}
 };
 const recircActive=c.aircraftFamily==='B737-400'?(recircFans.L.running||recircFans.R.running):singleRecircActive;
 const dualBleed=apu&&(c.engineBleed1==='ON'||(c.engineBleed2==='ON'&&isolation===true));
 const wingBody={L:i.wingBodyLLeakDetected||i.wingBodyTestHeld,R:i.wingBodyRLeakDetected||i.wingBodyTestHeld};
 const gauges={L:i.ductGaugeAcPower?i.ductLeftPsi:null,R:i.ductGaugeAcPower?i.ductRightPsi:null,source:'EXPLICIT_SENSOR_ONLY_PRESSURE_NOT_CALCULATED'};
 return {schema:'b737-pneumatics-derived/6',seq:s.seq,bleed:{engine1ValveOpen:e1,engine2ValveOpen:e2,apuBleedValveOpen:apu,externalAirAttached:i.externalAirAvailable,isolationOpen:isolation,dualBleed,wingBody},duct,pack,recircFanRunning:recircActive,recircFans,recircInstallation:c.aircraftFamily,gauges,
 lamps:{dualBleed,bleedTrip1:t.bleed1,bleedTrip2:t.bleed2,packTripL:t.packL,packTripR:t.packR,ductOverheatL:t.ductL,ductOverheatR:t.ductR,wingBodyOverheatL:wingBody.L,wingBodyOverheatR:wingBody.R},
 toPressurization:{packConditionedAirAvailable:operatingCount>0?true:pack.L.operational===null||pack.R.operational===null?null:false,cabinPressureCalculated:false,source:'FCOM 2.30.1 functional supply only'},
 statuses:{physicalBleedPressure:'UNKNOWN',actualTemperature:'UNKNOWN',exactAPUAndGroundSourceRouting:'UNKNOWN',powerBusRouting:'NOT_VERIFIED',overlimitSensorThresholds:'NOT_IN_THIS_SOURCE_VIEW',faultFailureResponse:'SYNTHETIC_TRAINER',flightOperations:'NOT_FOR_FLIGHT'},sources:SOURCES};
}
function replay(commands){let s=initial();for(const a of commands)s=apply(s,a);return s;}
return Object.freeze({SIDES,FAULTS,INPUT_TYPES,CONTROL_TYPES,SOURCES,initial,apply,derive,replay});
});