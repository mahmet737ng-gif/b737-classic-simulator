/* B737 Classic Chapter 11 · conservative FMC/CDU power & avionics data bus.
 * Public engineering model. No proprietary FCOM diagrams, screen facsimiles,
 * breaker-to-bus claims or AFDS servo commands.
 * FCOM Sepehran Vol 2: 11.10, 11.31, 11.32.5–6, 11.40–43.
 */
(function(root,factory){
 'use strict';const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.B737FmcSystemsV1=api;
})(typeof globalThis!=='undefined'?globalThis:null,function(){
 'use strict';
 const UNIT_IDS=Object.freeze(['FMC1','FMC2','CDU_CAPT','CDU_FO']);
 const STATES=Object.freeze(['PRESENT','ABSENT','UNKNOWN']);
 const POWER_BUSES=Object.freeze(['generator1','generator2','transfer1','transfer2','main1','main2','acStandby','groundService','dc1','dc2','battery','hotBattery','switchedHotBattery','dcStandby']);
 const BREAKERS=Object.freeze([
  {id:'P18-2:E8',label:'FMCS CMPTR NO.1',unit:'FMC1'},
  {id:'P18-2:E9',label:'CDU NO.1',unit:'CDU_CAPT'},
  {id:'P6-1:C12',label:'FMCS COMPTR NO.2',unit:'FMC2'},
  {id:'P6-1:C13',label:'CDU NO.2',unit:'CDU_FO'},
  {id:'P18-2:D1',label:'FMC AC',unit:null},
  {id:'P6-1:D8',label:'FMC AC',unit:null},
  {id:'P18-2:E7',label:'FMCS MODE ANN',unit:null},
  {id:'P18-2:C5',label:'DAA FMC NO.1',unit:null},
  {id:'P6-1:D13',label:'DAA FMC NO.2',unit:null},
  {id:'P18-1:D1',label:'AFDS MCP DC',unit:'MCP'},
  {id:'P6-2:B2',label:'AFDS MCP CRS 2',unit:'MCP'}
 ].map(x=>Object.freeze({...x,verification:'PHOTO_LABEL_CANDIDATE_ONLY',bus:'UNVERIFIED',activeTripEffect:false})));
 const clone=x=>JSON.parse(JSON.stringify(x));
 const invalid=x=>{throw Error(x);};
 function createState(){
  return {schema:'B737_FMC_SYSTEMS_V1',revision:0,profile:'EP-FSI_737_CLASSIC',power: Object.fromEntries(UNIT_IDS.map(x=>[x,{feed:'UNKNOWN',sinceMs:null,lastDurationMs:null}])),
   phase:'GROUND',route:{origin:'',dest:'',active:false,legsVerified:false,discontinuitiesUnknown:true},irs:{leftValid:null,rightValid:null},
   guidance:{lnavAuthorized:false,vnavAuthorized:false,forceDisengage:false,reason:'SOURCE_NOT_VERIFIED'},
   recovery:{reinitializePreflight:false,selectActiveWaypoint:false,showModRteLegs:false},history:[],
   fmcFailure:false,connection:'TRAINER_NO_ACTUATOR_AUTHORITY'};
 }
 function globalPower(snapshot){
  const buses=snapshot?.bus;
  if(!buses||!POWER_BUSES.every(k=>Object.hasOwn(buses,k)))return 'UNKNOWN';
  if(POWER_BUSES.every(k=>buses[k]===false))return 'ABSENT';
  // Live bus voltage NEVER proves that a particular FMC/CDU feeder is energized.
  return 'UNKNOWN';
 }
 function apply(old,event){
  if(old?.schema!=='B737_FMC_SYSTEMS_V1'||!event||typeof event.type!=='string')invalid('INVALID_FMC_NETWORK_EVENT');
  const s=clone(old),now=event.nowMs;
  if(event.type==='FEED'){
   if(!UNIT_IDS.includes(event.unit)||!STATES.includes(event.evidence)||!Number.isFinite(now)||now<0)invalid('FEED_EVENT_INVALID');
   if(!['DIRECT_VERIFIED_EQUIPMENT_FEED','ALL_POWER_BUSES_PROVEN_ABSENT','UPSTREAM_POWER_RESTORED_FEED_UNKNOWN'].includes(event.provenance))invalid('FEED_PROVENANCE_REQUIRED');
   if(event.provenance==='UPSTREAM_POWER_RESTORED_FEED_UNKNOWN'&&event.evidence!=='UNKNOWN')invalid('RESTORATION_CANNOT_PROVE_FEED');
   if(event.provenance==='ALL_POWER_BUSES_PROVEN_ABSENT'&&event.evidence!=='ABSENT')invalid('GLOBAL_POWER_MAY_ONLY_PROVE_ABSENCE');
   const p=s.power[event.unit],previous=p.feed;
   if(previous!==event.evidence){
    if(event.evidence==='ABSENT')p.sinceMs=now;
    else if(previous==='ABSENT'&&p.sinceMs!==null){
     const duration=Math.max(0,now-p.sinceMs);
     p.lastDurationMs=duration;p.sinceMs=null;
     if(event.unit.startsWith('FMC')&&event.evidence==='PRESENT'){
      if(duration>=10000&&s.phase==='GROUND')s.recovery.reinitializePreflight=true;
      if(duration>10000&&s.phase==='FLIGHT'){
       s.recovery.selectActiveWaypoint=true;s.recovery.showModRteLegs=true;
      }
     }
    }else p.sinceMs=null;
    p.feed=event.evidence;
    if(event.unit.startsWith('FMC')&&event.evidence==='ABSENT'){
     s.guidance.lnavAuthorized=false;s.guidance.vnavAuthorized=false;
     s.guidance.forceDisengage=true;s.guidance.reason='FMC_POWER_INTERRUPTED';
    }
   }
  }else if(event.type==='PHASE'){
   if(!['GROUND','FLIGHT'].includes(event.phase))invalid('PHASE_INVALID');s.phase=event.phase;
  }else if(event.type==='IRS'){
   for(const k of ['leftValid','rightValid'])if(event[k]!==undefined){if(![true,false,null].includes(event[k]))invalid('IRS_EVIDENCE_INVALID');s.irs[k]=event[k]}
  }else if(event.type==='ROUTE'){
   if(!event.route||typeof event.route!=='object')invalid('ROUTE_EVIDENCE_MISSING');
   const r=event.route;
   for(const k of ['origin','dest'])if(r[k]!==undefined)s.route[k]=String(r[k]).toUpperCase().slice(0,4);
   for(const k of ['active','legsVerified','discontinuitiesUnknown'])if(r[k]!==undefined){if(typeof r[k]!=='boolean')invalid('ROUTE_EVIDENCE_INVALID');s.route[k]=r[k]}
  }else if(event.type==='FMC_FAILURE'){
   if(typeof event.failed!=='boolean')invalid('FMC_FAILURE_INVALID');
   s.fmcFailure=event.failed;
   if(event.failed){s.guidance.forceDisengage=true;s.guidance.reason='FMC_FAILURE';}
  }else if(event.type==='ACK_RECOVERY'){
   s.recovery={reinitializePreflight:false,selectActiveWaypoint:false,showModRteLegs:false};
  }else invalid('EVENT_NOT_SUPPORTED');
  const i=s.irs.leftValid===true||s.irs.rightValid===true;
  const r=s.route;
  const ready=/^[A-Z]{4}$/.test(r.origin)&&/^[A-Z]{4}$/.test(r.dest)&&r.origin!==r.dest&&r.active&&r.legsVerified&&!r.discontinuitiesUnknown&&i&&!s.fmcFailure;
  const powered=UNIT_IDS.filter(k=>k.startsWith('FMC')).some(k=>s.power[k].feed==='PRESENT');
  const allOff=['FMC1','FMC2'].every(k=>s.power[k].feed==='ABSENT');
  if(!ready||!powered){s.guidance.lnavAuthorized=false;s.guidance.vnavAuthorized=false;s.guidance.reason=allOff?'NO_FMC_POWER':'NAV_ROUTE_OR_FEED_NOT_VERIFIED';}
  else {s.guidance.lnavAuthorized=true;s.guidance.vnavAuthorized=true;s.guidance.forceDisengage=false;s.guidance.reason='TRAINER_EVIDENCE_ONLY';}
  s.revision++;s.history.push({type:event.type,unit:event.unit||null,revision:s.revision});if(s.history.length>32)s.history.shift();
  return s;
 }
 function mcpEvidence(s){
  if(s.guidance.lnavAuthorized&&s.guidance.vnavAuthorized)return true;
  if(s.route.active===false||s.fmcFailure||['FMC1','FMC2'].every(k=>s.power[k].feed==='ABSENT'))return false;
  return null;
 }
 function screenGrid(rows){
  if(!Array.isArray(rows)||rows.length!==14)invalid('CDU_REQUIRES_EXACTLY_14_ROWS');
  return rows.map((row,i)=>{
   const val=String(row??'');if([...val].length>24)invalid('CDU_ROW_TOO_LONG_'+i);
   return val.padEnd(24,' ');
  });
 }
 return Object.freeze({UNIT_IDS,POWER_BUSES,BREAKERS,createState,apply,globalPower,mcpEvidence,screenGrid});
});
