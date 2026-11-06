/* Circuit isolation for the Unified procedure trainer. Breaker identities come
 * from the existing photo catalogue. This is a functional simulation contract,
 * not an EP-FSI WDM, amperage/trip model or certification of upstream wiring.
 * CBs gate protected circuits; they never rewrite switches or instructor faults.
 */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.B737UnifiedCircuitGatesV1=api;})(typeof globalThis!=='undefined'?globalThis:null,function(){
'use strict';
const STORAGE='b737classic.cb.v1',PROFILE='b737classic.aircraft-profile.v1';
const DEFINITIONS={};
function define(name,keys,role='POWER'){DEFINITIONS[name]={keys,role};}
const key=(p,pos)=>p+'|'+(p==='P6-4'?'ACTIVE':'ALL')+'|'+pos;
function one(name,p,pos,role){define(name,[key(p,pos)],role);}
for(const [id,pos] of Object.entries({main2FwdPump:'B3',main1FwdPump:'B7',main2AftPump:'C3',main1AftPump:'C7',centerRightPump:'D5',centerLeftPump:'E5'}))one('fuel.'+id,'P6-3',pos);
define('hyd.electricPumpA',[key('P6-12','C2'),key('P6-2','A15')]);
define('hyd.electricPumpB',[key('P6-11','C2'),key('P6-2','A14')]);
one('fuel.crossfeedControl','P6-3','C5','CONTROL');
one('fuel.groundFuelingControl','P6-3','A7','CONTROL');
for(const [name,pos]of Object.entries({bleedIsolationControl:'B1',bleedRightControl:'B2',bleedLeftControl:'B3',recircControl:'B4',recircEnergized:'B5',packR:'C3',packL:'C4',ductGauge:'D1',temperatureIndicator:'D2',valvePositionIndicator:'D3',overheatDetector:'D4',recircFan:'E5',temperatureAutoR:'A3',temperatureAutoL:'A4',temperatureManual:'A5',ramModR:'E1',ramModL:'E2',turbofanR:'C1',turbofanL:'C2'}))one('air.'+name,'P6-4',pos,/Indicator|Gauge|Energized/.test(name)?'INDICATION':'CONTROL');
define('air.recirc',[key('P6-4','B4'),key('P6-4','E5')]);
for(const [name,pos]of Object.entries({tr1:'A8',tr2:'C8',tr3:'E8',charger:'D8',alternateCharger:'F8',gen1Control:'D10',apuGenControl:'D11',gen2Control:'D12',transfer1Control:'F10',transfer2Control:'F12',standbyControl:'F16',standbyIndication:'F17'}))one('electrical.'+name,'P6-4',pos);
for(const [name,pos]of Object.entries({inverterControl:'A1',inverterPower:'A2',apuControl:'B1',batteryBus:'C7',dc1:'B8',dc2:'B7',externalPowerControl:'D4',dcStandbyBattery:'D2',dcStandbyTr:'D3'}))one('electrical.'+name,'P6-5',pos);
for(const n of [1,2]){
 one('engine'+n+'.starter','P6-2',n===1?'A7':'A6','CONTROL');
 one('engine'+n+'.ignitionLeft','P6-2',n===1?'B8':'B6');
 one('engine'+n+'.ignitionRight','P6-2',n===1?'B7':'B5');
 one('engine'+n+'.n1Indicator','P6-2',n===1?'D3':'D1','INDICATION');
 one('engine'+n+'.n2Indicator','P6-2',n===1?'D4':'D2','INDICATION');
 one('engine'+n+'.egtIndicator','P6-2',n===1?'A2':'A1','INDICATION');
 one('engine'+n+'.oilIndicator','P6-2',n===1?'D8':'D6','INDICATION');
 one('engine'+n+'.oilQuantityIndicator','P6-2',n===1?'D7':'D5','INDICATION');
 one('engine'+n+'.fuelFlowIndicator','P6-3',n===1?'A6':'A5','INDICATION');
 one('engine'+n+'.fireDetector','P6-2',n===1?'A24':'A22','DETECTION');
 one('antiice.cowl'+n,'P18-3',n===1?'A2':'A1','CONTROL');
 one('antiice.engineWing'+n,'P18-3',n===1?'A4':'A3','CONTROL');
}
one('engine.vibrationIndicator','P6-2','B3','INDICATION');
one('apu.control','P6-5','B1','CONTROL');
one('apu.fireDetector','P6-2','A23','DETECTION');
one('antiice.wingValve','P18-3','A5','CONTROL');
one('tat.heater','P18-3','C5');
for(const [name,pos]of Object.entries({captUpper:'C1',captLower:'C2',foUpper:'C3',foLower:'C4',elevatorR:'D1',elevatorL:'D2',alphaR:'D4',alphaL:'D5',drain:'D3'}))one('probe.'+name,'P18-3',pos);
// Additional photo-indexed control feeds used by the live overhead indications.
// Standby hydraulic pump NORMAL/ALTN supplies remain separate: either path can remain available.
one('hyd.standbyPumpNormal','P6-11','A8');
one('hyd.standbyPumpAlternate','P6-12','A8');
one('flight.standbyRudderControl','P6-2','A11','CONTROL');
one('brakes.autobrake','P6-2','B9','CONTROL');
one('brakes.autobrakeControl','P6-3','A17','CONTROL');
one('brakes.antiskidInboard','P6-2','A20','CONTROL');
one('brakes.antiskidOutboard','P6-2','A21','CONTROL');
one('brakes.antiskidWarning','P6-2','B22','INDICATION');
one('mcp.power','P18-1','D1');
one('fmc.FMC1','P18-2','E8');one('fmc.FMC2','P6-1','C12');
one('fmc.CDU_CAPT','P18-2','E9');one('fmc.CDU_FO','P6-1','C13');
for(const [name,p,ac,dc]of [['L','P18-2','D4','D5'],['R','P6-1','D11','D12']]){
 one('irs.'+name+'.ac',p,ac);one('irs.'+name+'.dc',p,dc);
}
for(const [name,pos]of Object.entries({landingOutboardR:'A12',landingOutboardL:'A13',landingInboardR:'A14',landingInboardL:'A15',wingScan:'B13',strobe:'B14',position:'B15',beaconUpper:'C16',beaconLower:'C17',taxi:'D15',turnoffR:'D16',turnoffL:'D17',seatBelts:'A8',passengerSigns:'A10',emergencyExit:'A11'}))one('lights.'+name,'P18-3',pos);
for(const [name,pos]of Object.entries({airCond:'D8',antiIce:'D9',fuel:'D10',annunciator1:'D11',annunciatorBattery:'D12',masterCaution:'D13',section4:'D14',section5:'D15',section6:'D16'}))one('warning.'+name,'P6-3',pos,'INDICATION');
one('warning.masterCautionControl','P6-2','A4','CONTROL');
one('warning.masterFireControl','P6-2','B23','CONTROL');
one('warning.aural','P6-2','D22','AUDIO');
one('oxygen.indicator','P18-3','F6','INDICATION');
one('oxygen.manualControl','P18-3','F7','CONTROL');
one('cooling.control','P18-3','A17','CONTROL');
one('cooling.normalBlower','P18-3','B18');one('cooling.alternateBlower','P18-3','C19');
// CPCS and DCPCS positions are mutually exclusive; never share an F-row identity.
for(const [name,variant,pos]of [['autoAC','CPCS','F1'],['autoDC','CPCS','F2'],['standbyAC','CPCS','F3'],['standbyDC','CPCS','F4'],['manualAC','CPCS','F5'],['manualDC','CPCS','F6'],['manual','DCPCS','F1'],['auto1','DCPCS','F2'],['auto2','DCPCS','F3'],['indication','DCPCS','F4'],['lighting','DCPCS','F5']])define('press.'+name,['P6-4|'+variant+'|'+pos]);
// Existing Window Heat core consumes these same keys directly from the snapshot.
for(const [name,keys]of Object.entries({L_FWD:['P6-11|ALL|B9','P18-3|ALL|F1'],L_SIDE:['P6-12|ALL|B9','P18-3|ALL|F3'],R_FWD:['P6-12|ALL|B8','P18-3|ALL|E1'],R_SIDE:['P6-11|ALL|B8','P18-3|ALL|E3'],L45:['P6-11|ALL|B7'],R45:['P6-12|ALL|B7']}))define('window.'+name,keys);
one('fire.wheelWellDetector','P6-2','B24','DETECTION');
one('fire.extinguisherL','P6-2','C24','CONTROL');one('fire.extinguisherR','P6-2','C22','CONTROL');one('fire.extinguisherAPU','P6-2','C23','CONTROL');
// Catalogue/MRG conflicts remain unavailable for automatic system routing.
const QUARANTINED=['P6-4|CPCS|C8','P6-4|DCPCS|C8','P6-4|CPCS|E8','P6-4|DCPCS|E8','P18-3|ALL|A12'];
const UNBOUND=['fuel.groundFuelingControl','air.recircControl','air.recircEnergized','air.recircFan','air.temperatureIndicator','air.valvePositionIndicator','air.temperatureAutoR','air.temperatureAutoL','air.temperatureManual','air.ramModR','air.ramModL','air.turbofanR','air.turbofanL','electrical.tr2','electrical.tr3','electrical.standbyControl','electrical.standbyIndication','electrical.apuControl','electrical.dcStandbyBattery','electrical.dcStandbyTr','antiice.cowl1','antiice.cowl2','antiice.engineWing1','antiice.engineWing2','antiice.wingValve','lights.landingOutboardR','lights.landingOutboardL','lights.landingInboardL','lights.landingInboardR','lights.seatBelts','lights.passengerSigns','lights.emergencyExit','warning.annunciator1','warning.annunciatorBattery','warning.section4','warning.section5','warning.section6','oxygen.manualControl','cooling.normalBlower','cooling.alternateBlower','press.indication','press.lighting','probe.drain'];
for(const name of UNBOUND)delete DEFINITIONS[name];
const LIGHT_CONSUMERS={
 'oxygen-pressure':'oxygen.indicator',
 'wing-body-overheat-l':'air.overheatDetector','wing-body-overheat-r':'air.overheatDetector',
 'anti-skid-inop':'brakes.antiskidWarning'
};
function create(catalog,Kernel,{variant='CPCS'}={}){
 const net=new Kernel.BreakerNetwork(catalog,{variant});let revision=0;net.subscribe(()=>revision++);
 const resolve=id=>id.replace('|ACTIVE|','|'+net.variant+'|');
 function closed(id){const b=net.state(resolve(id));return b&&net.isActive(b)?!(b.pulled||b.tripped):null;}
 function available(name){const d=DEFINITIONS[name];if(!d)return null;const values=d.keys.map(closed);return values.includes(false)?false:values.includes(null)?null:true;}
 function gate(name,upstream){return available(name)===false?false:upstream;}
 function restore(snapshot){const r=net.restore(snapshot);if(r.ok)revision++;return r;}
 function setVariant(value){if(value!==net.variant){net.setVariant(value);revision++;}}
 function report(){const wired=new Set(Object.values(DEFINITIONS).flatMap(d=>d.keys.map(resolve)));
 const active=net.activeEntries();return {revision,variant:net.variant,total:active.length,
  mappedBreakers:active.filter(b=>wired.has(b.id)).length,
  open:active.filter(b=>b.pulled||b.tripped).map(b=>({id:b.id,label:b.label,consumers:Object.keys(DEFINITIONS).filter(n=>DEFINITIONS[n].keys.map(resolve).includes(b.id))})),
  quarantined:QUARANTINED,
  unmapped:active.filter(b=>!wired.has(b.id)).map(b=>({id:b.id,label:b.label})),
  model:'FUNCTIONAL_TRAINER_CIRCUIT_ISOLATION_NOT_WDM'};}
 return {get revision(){return revision;},closed,available,gate,restore,setVariant,report,snapshot:()=>net.snapshot(),network:net};
}
return Object.freeze({STORAGE,PROFILE,DEFINITIONS,LIGHT_CONSUMERS,create});
});
