/* B737 Classic IRS electrical source and annunciator EVIDENCE V2.
 * Backend-only, non-destructive. No interaction with owner-frozen panel files.
 * Electrical V7 is a BUS model, not a per-LRU CB wiring certification.
 * Source: project's FCOM 11.20.7-10 / IRS_TRAINER_ARCHITECTURE_V1.md.
 * ON DC self-test = 3.5s (IRS core); LEFT backup DC from switched hot battery;
 * RIGHT backup DC limited to 300 seconds in a continuous, selected DC run.
 * Fail closed when upstream bus evidence is UNKNOWN, never infer a CB route.
 */
(function(root,factory){'use strict';const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.B737IRSElectricalEvidenceV2=api;})
(typeof globalThis!=='undefined'?globalThis:this,function(){'use strict';
const MODES=Object.freeze(['OFF','ALIGN','NAV','ATT']);
const MAX_BACKUP_R=300;
const MAX_STEP=5;
const PHASE_ALIGN=Object.freeze(['ALIGNING','WAIT_POSITION','HIGH_LAT_READY','ALIGN_READY','FAST_REALIGN','SHUTDOWN']);
function tri(v){return v===true||v===false?v:null;}
function validateMode(v){if(!MODES.includes(v))throw new RangeError('IRS MODE selector must be OFF ALIGN NAV ATT');return v;}
function copy(v){return JSON.parse(JSON.stringify(v));}
function initialState(){return {schema:'B737_IRS_ELECTRICAL_EVIDENCE_V2',revision:0,
 rightBackupElapsedSec:0,side:{L:null,R:null},events:[],
 note:'Electrical projection: no inferred CB-to-IRS wiring'};}
function evaluate(state,{electrical=null,modes={L:'OFF',R:'OFF'},unitStates=null,dtSec=0,cbEvidence=null}={}){
 if(!state||state.schema!=='B737_IRS_ELECTRICAL_EVIDENCE_V2')throw new TypeError('Invalid IRS electrical evidence state');
 if(typeof dtSec!=='number'||!Number.isFinite(dtSec)||dtSec<0||dtSec>MAX_STEP)
  throw new RangeError('IRS evidence step must be between 0 and 5 seconds');
 for(const side of ['L','R'])validateMode(modes[side]);
 if(electrical!==null&&electrical?.schema!=='B737_ELECTRICAL_V7_RESULT')
  throw new TypeError('Only evaluated Electrical V7 output accepted; raw assumed buses rejected');
 // A CB catalogue or generic TR/transfer bus state is NOT proof of the
 // breaker-to-IRS equipment feed. Quarantine any suggestions, including
 // OPEN breakers and seemingly compelling indexed circuit labels.
 const cbFlag=cbEvidence===null?'NO_IRS_CB_EVIDENCE':
  'CB_PRESENT_BUT_EQUIPMENT_ROUTE_UNVERIFIED';
 const bus=electrical?.bus||null;
 const acL=tri(bus?.acStandby),acR=tri(bus?.transfer2),dc=tri(bus?.switchedHotBattery),batteryBus=tri(bus?.battery);
 let elapsed=state.rightBackupElapsedSec;
 const rShutdown=modes.R==='OFF'&&unitStates?.R?.phase==='SHUTDOWN';
 if((modes.R==='OFF'&&!rShutdown)||acR===true){elapsed=0;}
 else if((modes.R!=='OFF'||rShutdown)&&acR===false&&dc===true){
  elapsed=Math.min(MAX_BACKUP_R,elapsed+dtSec);
 }
 // Unknown source does not reset or refill backup time.
 function sideProjection(side,ac){
  const mode=modes[side];
  const core=unitStates?.[side]||null;
  // OFF retains its electrical supply for the 30-second SHUTDOWN phase.
  // Only the core may time that shutdown; do not forcibly drop power here.
  const shutdownPowered=mode==='OFF'&&core?.phase==='SHUTDOWN';
  const active=mode!=='OFF'||shutdownPowered;
  const evidence=side==='L'?'AC_STANDBY':'AC_TRANSFER_2';
  let power=null,source='UNKNOWN',reason='BUS_EVIDENCE_INCOMPLETE';
  if(!active){power=false;source='OFF';reason='MSU_SELECTOR_OFF';}
  else if(ac===true){power=true;source=evidence;reason='AC_FEED_PRESENT';}
  else if(ac===false&&dc===false){power=false;source='NO_AC_OR_DC';reason='BOTH_KNOWN_FEEDS_LOST';}
  else if(ac===false&&dc===true){
   if(side==='R'&&elapsed>=MAX_BACKUP_R){power=false;source='RIGHT_BACKUP_EXPIRED';reason='RIGHT_DC_300_SECOND_CUTOFF';}
   else{power=true;source='SWITCHED_HOT_BATTERY';reason='BACKUP_DC_ACTIVE';}
  }
  // ON DC reports active backup DC, and the existing 3.5-second startup cue.
  // Do not fabricate a lamp state if power/source is unknown.
  const selftest=core?.phase==='SELFTEST';
  const onDcLamp=power===true?(source==='SWITCHED_HOT_BATTERY'||selftest):power===false?false:null;
  const alignLamp=power===true?(!!core&&PHASE_ALIGN.includes(core.phase)):power===false?false:null;
  const faultLamp=power===true?(core?.faultLamp===true):power===false?false:null;
  // DC FAIL corresponds to loss of DC feed while the unit's AC stays alive
  // in this TRAINING projection. Installation-specific illumination requires
  // separate FCOM + wiring confirmation, so the confidence remains PROVISIONAL.
  const dcFailLamp=power===true?(dc===false?true:dc===true?false:null):power===false?false:null;
  return Object.freeze({side,mode,powered:power,source,reason,shutdownPowered,normalBus:evidence,
   normalAcAvailable:ac,backupDcAvailable:dc,initialBatteryBusAvailable:batteryBus,
   onDcLamp,dcFailLamp,alignLamp,faultLamp,
   electricalConfidence:electrical?'SOURCE_BUS_ONLY_NO_CB_PROVENANCE':'NO_ELECTRICAL_V7_DATA',
   lampConfidence:{onDc:'BACKUP_OR_CORE_SELFTEST',dcFail:'PROVISIONAL_REQUIRES_SOURCE_LAMP_QA'},
   circuitBreakerStatus:cbFlag,
   isolationApplied:false,
   rightBackupRemainingSeconds:side==='R'&&ac===false&&dc===true?
     Math.max(0,MAX_BACKUP_R-elapsed):null});
 }
 const left=sideProjection('L',acL),right=sideProjection('R',acR);
 const next=copy(state);next.revision++;next.rightBackupElapsedSec=elapsed;
 next.side.L=left;next.side.R=right;
 if(state.side?.L?.source!==left.source)next.events.push({side:'L',source:left.source,revision:next.revision});
 if(state.side?.R?.source!==right.source)next.events.push({side:'R',source:right.source,revision:next.revision});
 if(next.events.length>128)next.events=next.events.slice(-128);
 return Object.freeze({state:next,units:Object.freeze({L:left,R:right}),rightBackupElapsedSec:elapsed,
  diagnostics:Object.freeze({cbCoverage:'NO_VERIFIED_IRS_CB_ASSIGNMENTS',
   busModel:'B737_ELECTRICAL_V7_RESULT',geometryModified:false,
   visualOwnership:'FROZEN_93_BLOBS_NO_UI_MUTATION',
   note:'Lamp outputs are backend projections; frozen Unified display consumes legacy cues until independently authorized routing is implemented.'})});
}
// Optional backend-only integration with the existing independent IRS core.
// No external cockpit mount or owner-locked annunciator DOM is touched.
// UNKNOWN source is deliberately treated as unavailable (fail closed).
function reconcileCore(core,current,projection){
 if(!core||typeof core.apply!=='function'||typeof core.status!=='function')
  throw new TypeError('Valid IRS core API required');
 if(!current||!current.units||!projection?.units)
  throw new TypeError('Current IRS state and power evidence required');
 let updated=current;
 for(const side of ['L','R']){
  const candidate=projection.units[side];
  // Initial IRS energization (and energization after a complete loss)
  // requires an explicitly live BATTERY BUS, even when AC is available.
  // An already-running IRS on good AC is not killed merely because DC fails.
  const starting=!updated.units[side].powered&&candidate?.powered===true;
  const powered=candidate?.powered===true&&
    (!starting||candidate.initialBatteryBusAvailable===true);
  if(updated.units[side].powered!==powered)
   updated=core.apply(updated,{type:'POWER',side,available:powered});
 }
 return Object.freeze({coreState:updated,source:projection.units,
  evidence:'IRS_POWER_PROJECTION_V2',panelMutated:false});
}
return Object.freeze({MAX_BACKUP_R,initialState,evaluate,reconcileCore});
});
