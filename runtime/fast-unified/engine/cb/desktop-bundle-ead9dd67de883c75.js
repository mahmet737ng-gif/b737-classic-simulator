(async()=>{
;
/* ../../engine/cb/cb-kernel.js?v=CB-UNIFIED-0001 */
try{
/* B737 Classic — isolated circuit-breaker kernel.
 * No inferred aircraft bus/consumer feed is accepted; tracing requires evidence.
 * Browser global B737_CB_Kernel / CommonJS.
 */
(function(root,factory){if(typeof module==="object"&&module.exports)module.exports=factory();else root.B737_CB_Kernel=factory();})(typeof globalThis!=="undefined"?globalThis:this,function(){
"use strict";
const VARIANTS=["CPCS","DCPCS"];
function keyFor(panel,position,variant){return panel+"|"+(panel==="P6-4"?(variant||"CPCS"):"ALL")+"|"+position;}
function entries(src){return String(src||"").split(";").map(x=>x.trim()).filter(Boolean).map(x=>{const t=x.split("|"),k=t[0].split(":"),position=k[0],rating=Number(k[1]),label=(t[1]||"").trim();if(!/^(?:[A-F]\d{1,2}|CB\d+)$/.test(position)||!Number.isFinite(rating)||rating<=0||!label)throw Error("Bad catalogue "+x);return {position,rating,label};});}
function parseCatalog(catalog){
if(!catalog||!Array.isArray(catalog.panels))throw Error("Missing CB catalog");
const out=[],seen=new Set(),panels=new Set();
for(const p of catalog.panels){
if(!p.id||panels.has(p.id))throw Error("Duplicate panel");
panels.add(p.id);
for(const variant of (p.id==="P6-4"?VARIANTS:["ALL"])){
let es=entries(p.breakers).filter(e=>!(p.id==="P6-4"&&variant==="DCPCS"&&/^F[1-6]$/.test(e.position)));
if(p.id==="P6-4"&&variant==="DCPCS")es=es.concat(entries(p.altBreakers));
for(const e of es){const id=keyFor(p.id,e.position,variant);if(seen.has(id))throw Error("Duplicate CB "+id);seen.add(id);out.push(Object.assign({id,panel:p.id,variant},e));}
}}
return out;
}
class BreakerNetwork{
constructor(catalog,opts){
this.variant=VARIANTS.includes(opts&&opts.variant)?opts.variant:"CPCS";
this.inventory=parseCatalog(catalog);this.breakers=new Map(this.inventory.map(b=>[b.id,Object.assign({},b,{pulled:false,tripped:false,fault:null})]));
this.routes=[];this.busStates=new Map();this.events=[];this.seq=0;this.listeners=[];
}
isActive(b){return !!b&&(b.panel!=="P6-4"||b.variant===this.variant);}
subscribe(cb){this.listeners.push(cb);return ()=>{this.listeners=this.listeners.filter(x=>x!==cb);};}
emit(type,data){const e=Object.assign({seq:++this.seq,type},data||{});this.events.push(e);if(this.events.length>1500)this.events.shift();for(const fn of this.listeners.slice())fn(e);}
setVariant(v){if(!VARIANTS.includes(v))return {ok:false,reason:"INVALID_VARIANT"};this.variant=v;this.emit("VARIANT",{variant:v});return {ok:true};}
state(id){const b=this.breakers.get(id);return b?Object.assign({},b):null;}
activeEntries(){return [...this.breakers.values()].filter(b=>this.isActive(b)).map(b=>Object.assign({},b));}
action(id,verb,reason){
const b=this.breakers.get(id);if(!b)return {ok:false,reason:"UNKNOWN_CB"};
if(!this.isActive(b))return {ok:false,reason:"INACTIVE_VARIANT"};
if(verb==="PULL")b.pulled=true;
else if(verb==="PUSH"){if(b.fault!==null)return {ok:false,reason:"FAULT_ACTIVE"};b.pulled=false;b.tripped=false;}
else if(verb==="INJECT_TRIP"){if(typeof reason!=="string"||!reason.trim())return {ok:false,reason:"FAULT_REASON_REQUIRED"};b.fault=reason.trim().slice(0,200);b.tripped=true;b.pulled=true;}
else if(verb==="CLEAR_FAULT")b.fault=null;
else return {ok:false,reason:"INVALID_ACTION"};
this.emit(verb,{id,pulled:b.pulled,tripped:b.tripped,reason:reason||null});return {ok:true,state:this.state(id)};
}
reset(){for(const b of this.breakers.values()){b.pulled=false;b.tripped=false;b.fault=null;}this.emit("RESET",{});return {ok:true};}
addRoute(r){
if(!r||!this.breakers.has(r.breaker)||!r.bus||!r.consumer)return {ok:false,reason:"INVALID_ROUTE"};
if(!["VERIFIED","SANDBOX"].includes(r.mode))return {ok:false,reason:"UNVERIFIED_ROUTE_REJECTED"};
if(r.mode==="VERIFIED"&&(!r.provenance||!r.provenance.manual||!r.provenance.page||!r.provenance.effectivity))return {ok:false,reason:"PROVENANCE_REQUIRED"};
const k=r.breaker+"|"+r.bus+"|"+r.consumer;if(this.routes.some(x=>x.key===k))return {ok:false,reason:"DUPLICATE_ROUTE"};
this.routes.push(Object.assign({key:k},r));this.emit("ROUTE",{key:k,mode:r.mode});return {ok:true};
}
setBus(bus,powered,source){if(typeof bus!=="string"||typeof powered!=="boolean"||!["SANDBOX","EXTERNAL_AUTHORITY"].includes(source))return {ok:false,reason:"INVALID_BUS_SOURCE"};this.busStates.set(bus,{powered,source});this.emit("BUS",{bus,powered,source});return {ok:true};}
consumer(consumer,mode){
const kind=mode||"VERIFIED";if(!["VERIFIED","SANDBOX"].includes(kind))return {status:"UNKNOWN",reason:"BAD_MODE"};
const paths=this.routes.filter(r=>r.consumer===consumer&&r.mode===kind&&this.isActive(this.breakers.get(r.breaker)));
if(!paths.length)return {status:"UNKNOWN",reason:"NO_TRACED_ROUTE"};
const results=paths.map(r=>{const b=this.breakers.get(r.breaker),s=this.busStates.get(r.bus);
if(!s||(kind==="VERIFIED"&&s.source!=="EXTERNAL_AUTHORITY"))return {key:r.key,status:"UNKNOWN"};
return {key:r.key,status:!b.pulled&&!b.tripped&&s.powered?"POWERED":"UNPOWERED"};});
return {status:results.some(x=>x.status==="POWERED")?"POWERED":results.some(x=>x.status==="UNKNOWN")?"UNKNOWN":"UNPOWERED",paths:results};
}
report(){const a=this.activeEntries();return {panels:new Set(a.map(e=>e.panel)).size,breakers:a.length,pulled:a.filter(e=>e.pulled).length,tripped:a.filter(e=>e.tripped).length,verifiedRoutes:this.routes.filter(r=>r.mode==="VERIFIED").length,sandboxRoutes:this.routes.filter(r=>r.mode==="SANDBOX").length,variant:this.variant};}
snapshot(){return {schema:1,variant:this.variant,breakers:[...this.breakers.values()].filter(e=>e.pulled||e.tripped||e.fault).map(e=>({id:e.id,pulled:e.pulled,tripped:e.tripped,fault:e.fault})),buses:[...this.busStates.entries()].map(([id,s])=>({id,powered:s.powered,source:s.source}))};}
restore(s){
if(!s||s.schema!==1||!VARIANTS.includes(s.variant)||!Array.isArray(s.breakers))return {ok:false,reason:"BAD_SNAPSHOT"};
for(const e of s.breakers){if(!this.breakers.has(e.id)||typeof e.pulled!=="boolean"||typeof e.tripped!=="boolean"||(e.fault!==null&&typeof e.fault!=="string")||(e.tripped&&!e.pulled)||(e.fault!==null&&!e.tripped))return {ok:false,reason:"BAD_BREAKER_STATE"};}
for(const b of this.breakers.values()){b.pulled=false;b.tripped=false;b.fault=null;}
for(const e of s.breakers)Object.assign(this.breakers.get(e.id),{pulled:e.pulled,tripped:e.tripped,fault:e.fault});
this.variant=s.variant;this.busStates.clear();
for(const sBus of (Array.isArray(s.buses)?s.buses:[])){if(typeof sBus.id==="string"&&typeof sBus.powered==="boolean"&&["SANDBOX","EXTERNAL_AUTHORITY"].includes(sBus.source))this.busStates.set(sBus.id,{powered:sBus.powered,source:sBus.source});}
this.emit("RESTORE",{count:s.breakers.length});return {ok:true};
}
}
return {BreakerNetwork,parseCatalog,keyFor};
});
}catch(error){queueMicrotask(()=>{throw error});}
;await 0;
;
/* ../../engine/cb/unified-circuit-gates-v1.js?v=ATA28-KG-0002&amp;p8=ATA26-0003 */
try{
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
one('fuel.quantityCommon','P6-3','A4','INDICATION');
for(const [tank,position] of Object.entries({main1:'F5',center:'F4',main2:'F3'}))
 define('fuel.quantity.'+tank,[key('P6-3','A4'),key('P6-3',position)],'INDICATION');
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
// Independent COURSE 2 feed from the photo-labelled P6-2 B2 CB.
one('mcp.course2','P6-2','B2');
one('fmc.FMC1','P18-2','E8');one('fmc.FMC2','P6-1','C12');
one('fmc.CDU_CAPT','P18-2','E9');one('fmc.CDU_FO','P6-1','C13');
for(const [name,p,ac,dc]of [['L','P18-2','D4','D5'],['R','P6-1','D11','D12']]){
 one('irs.'+name+'.ac',p,ac);one('irs.'+name+'.dc',p,dc);
}
for(const [name,pos]of Object.entries({landingOutboardR:'A12',landingOutboardL:'A13',landingInboardR:'A14',landingInboardL:'A15',wingScan:'B13',strobe:'B14',position:'B15',beaconUpper:'C16',beaconLower:'C17',taxi:'D15',turnoffR:'D16',turnoffL:'D17',seatBelts:'A8',passengerSigns:'A10',emergencyExit:'A11'}))one('lights.'+name,'P18-3',pos);
for(const [name,pos]of Object.entries({airCond:'D8',antiIce:'D9',fuel:'D10',annunciator1:'D11',annunciatorBattery:'D12',masterCaution:'D13',section4:'D14',section5:'D15',section6:'D16'}))one('warning.'+name,'P6-3',pos,'INDICATION');
one('warning.masterCautionControl','P6-2','A4','CONTROL');
one('lights.masterDimBattery','P6-3','B13','INDICATION');
one('lights.masterDimDC1','P6-3','B14','INDICATION');
one('lights.masterDimDC2','P6-3','B15','INDICATION');
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
// P6-2 photo catalogue and LAN ATA 26-20 fig. 29: alternate engine-bottle firing feeds.
one('fire.extinguisherLAlternate','P6-2','D24','CONTROL');
one('fire.extinguisherRAlternate','P6-2','D23','CONTROL');
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

}catch(error){queueMicrotask(()=>{throw error});}
;await 0;
;
/* ./cb-unified-live-v1.js?v=CB-UNIFIED-0001 */
try{
/* One persisted CB state in every same-origin Unified/overhead/CB frame. */
(function(win){'use strict';
const Core=win.B737UnifiedCircuitGatesV1,Kernel=win.B737_CB_Kernel;
if(!Core||!Kernel||!win.CB_CATALOG)throw Error('Unified CB prerequisites unavailable');
const service=Core.create(win.CB_CATALOG,Kernel);let signature='',lastError=null;
function profile(){try{const p=JSON.parse(localStorage.getItem(Core.PROFILE)||'{}');return p.pressurization==='DCPCS'?'DCPCS':'CPCS';}catch{return 'CPCS';}}
function notify(){win.dispatchEvent(new CustomEvent('b737:cb-state-change',{detail:service.report()}));}
function refresh(){
 try{
  const raw=localStorage.getItem(Core.STORAGE),variant=profile(),next=(raw||'')+'|'+variant;
  if(next===signature)return false;
  if(raw){const result=service.restore(JSON.parse(raw));if(!result.ok)throw Error(result.reason);}
  else service.network.reset();
  service.setVariant(variant);signature=next;lastError=null;notify();return true;
 }catch(error){lastError=String(error);console.warn('Unified CB state rejected; last valid state retained',error);return false;}
}
win.B737UnifiedCB=Object.freeze({get revision(){return service.revision;},closed:service.closed,available:service.available,gate:service.gate,
 irsPower:(side,upstream)=>{
  const ac=service.available('irs.'+side+'.ac')!==false,dc=service.available('irs.'+side+'.dc')!==false;
  if(!ac&&!dc)return false;
  const bus=win.B737ISNCockpitV1?.getState?.()?.state?.electrical?.bus;
  const rawAC=bus?.[side==='L'?'acStandby':'transfer2'],rawDC=bus?.switchedHotBattery;
  if(rawAC===true||rawDC===true)return upstream&&((rawAC===true&&ac)||(rawDC===true&&dc));
  return upstream;
 },
 snapshot:service.snapshot,report:()=>({...service.report(),error:lastError}),refresh,
 lampAllowed:id=>{const name=Core.LIGHT_CONSUMERS[id];return !name||service.available(name)!==false;}});
win.addEventListener('storage',e=>{if(e.key===Core.STORAGE||e.key===Core.PROFILE||e.key===null)refresh();});
win.addEventListener('b737:cb-snapshot',refresh);
win.addEventListener('message',e=>{
 if(e.origin!==location.origin||e.data?.type!=='b737:cb-state-changed')return;
 if(e.source===win.parent||[...document.querySelectorAll('iframe')].some(f=>f.contentWindow===e.source))refresh();
});
win.addEventListener('b737:aircraft-profile-change',refresh);
refresh();
})(window);

}catch(error){queueMicrotask(()=>{throw error});}
;await 0;
})();
