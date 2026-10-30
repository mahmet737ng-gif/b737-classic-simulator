/* Training-only FMC IDENT navigation database banks.
 * Calendar validity != NAVDB installation. An expired private 2610 source
 * remains archived, NEVER silently copied or relabeled as 2611.
 * No navigation, active legs, LNAV/VNAV or aircraft guidance is authorized.
 */
(function(root,factory){'use strict';const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.B737CDUAiracBanksV1=api;
})(typeof globalThis!=='undefined'?globalThis:null,function(){
 'use strict';
 const VERSION='CDU-AIRAC-BANKS-0001';
 const CALENDAR=Object.freeze({
  '2610':Object.freeze({cycle:'2610',start:'2026-10-01',endExclusive:'2026-10-29',lastValid:'2026-10-28'}),
  '2611':Object.freeze({cycle:'2611',start:'2026-10-29',endExclusive:'2026-11-26',lastValid:'2026-11-25'}),
  '2612':Object.freeze({cycle:'2612',start:'2026-11-26',endExclusive:'2026-12-24',lastValid:'2026-12-23'})
 });
 const PRIVATE2610=Object.freeze({cycle:'2610',revision:1,sourceId:'PMDG_WORLD_2610_WITH_PROCEDURES_R1',
  marker:'//AIRAC Cycle : 2610 (01/OCT/2026 - 29/OCT/2026) - Ver.1',
  status:'PRIVATE_SOURCE_REFERENCE_ONLY',fmcInstalled:false,fmcExecutable:false,
  privateLicense:true,redistributable:false});
 const EXPECTED2611=Object.freeze({cycle:'2611',status:'SOURCE_ARCHIVE_NOT_AVAILABLE',
  imported:false,fmcInstalled:false,fmcExecutable:false,airacCalendarKnown:true});
 function date(iso){
  if(typeof iso!=='string'||!/^\d{4}-\d\d-\d\d$/.test(iso))throw Error('ISO_UTC_DAY_REQUIRED');
  const t=Date.parse(iso+'T00:00:00Z');
  if(!Number.isFinite(t)||new Date(t).toISOString().slice(0,10)!==iso)throw Error('INVALID_UTC_DAY');
  return iso;
 }
 function current(asOfIso){
  const day=date(asOfIso);
  const record=Object.values(CALENDAR).find(v=>v.start<=day&&day<v.endExclusive);
  return record?{...record}:null;
 }
 function archive(){
  return Object.freeze({old:{...PRIVATE2610},requested:{...EXPECTED2611},
   sourceScope:'AIRAC_EFFECTIVITY_METADATA_ONLY',privateDataPublished:false});
 }
 const noBank=()=>null;
 function validateBank(record){
  if(!record||typeof record!=='object'||Array.isArray(record))throw Error('NAVBANK_RECORD_REQUIRED');
  const reference=CALENDAR[record.cycle];
  if(!reference)throw Error('UNSUPPORTED_AIRAC_CYCLE');
  if(record.schema!=='B737_PRIVATE_NAVDATA_VALIDATED_V1')throw Error('UNVERIFIED_NAVDATA_SCHEMA');
  if(record.importStatus!=='COMPLETE'||record.integrityCheck!=='PASS'||
     record.procedureCoverage!=='VALIDATED'||record.fmcInstalled!==true||
     record.fmcExecutable!==true||record.approvedForTraining!==true)
   throw Error('FMC_NAVDATA_NOT_VERIFIED_OR_NOT_INSTALLED');
  if(typeof record.sourceSha256!=='string'||!/^[a-f0-9]{64}$/i.test(record.sourceSha256))
   throw Error('NAVDATA_SHA256_REQUIRED');
  if(record.start!==reference.start||record.endExclusive!==reference.endExclusive)
   throw Error('NAVDATA_DATE_MISMATCH');
  if(!Number.isInteger(record.airportCount)||record.airportCount<=0||
     !Number.isInteger(record.waypointCount)||record.waypointCount<=0||
     !Number.isInteger(record.procedureCount)||record.procedureCount<=0)
   throw Error('NAVDATA_CONTENT_COUNTS_REQUIRED');
  if(typeof record.signedBy!=='string'||!record.signedBy.trim())
   throw Error('NAVDATA_VERIFICATION_SIGNOFF_REQUIRED');
  return Object.freeze({...record});
 }
 function install(readout,asOfIso){
  // A preflight projection never changes the real engine or switches banks.
  const now=current(asOfIso);
  const banks={ACTIVE:noBank(),INACTIVE:noBank()},failures=[];
  for(const name of ['ACTIVE','INACTIVE']){
   if(!readout?.[name])continue;
   try{banks[name]=validateBank(readout[name]);}
   catch(e){failures.push({slot:name,reason:e.message});}
  }
  if(banks.ACTIVE&&banks.INACTIVE&&banks.ACTIVE.cycle===banks.INACTIVE.cycle){
   failures.push({slot:'INACTIVE',reason:'DUPLICATE_NAVDATA_IN_BOTH_BANKS'});
   banks.INACTIVE=null;
  }
  return Object.freeze({version:VERSION,effectiveCalendarCycle:now?.cycle||null,
   effectiveCalendar:now,ACTIVE:banks.ACTIVE,INACTIVE:banks.INACTIVE,
   sourcesImported:['ACTIVE','INACTIVE'].filter(k=>!!banks[k]),
   failures,activeStatus:banks.ACTIVE?'INSTALLED_BANK':'NO_VERIFIED_ACTIVE_BANK',
   calendarIsNotFmcInstall:true});
 }
 function fcomIdent(readout,asOfIso){
  const resolved=install(readout,asOfIso);
  const signed=slot=>resolved[slot]?{
   quality:'VALID',origin:'VERIFIED_NAV_DATABASE',
   value:resolved[slot].cycle,airac:resolved[slot].cycle,
   dateStart:resolved[slot].start,dateEndExclusive:resolved[slot].endExclusive,
   sourceSha256:resolved[slot].sourceSha256,bank:slot
  }:null;
  return Object.freeze({schema:VERSION,currentCalendarCycle:resolved.effectiveCalendarCycle,
   ACTIVE:signed('ACTIVE'),INACTIVE:signed('INACTIVE'),
   NAV_DATA:resolved.ACTIVE?{
    quality:'VALID',origin:'VERIFIED_NAV_DATABASE',value:'AIRAC'+resolved.ACTIVE.cycle,
    sourceSha256:resolved.ACTIVE.sourceSha256
   }:null,
   currentCycleInstalled:!!(resolved.ACTIVE&&resolved.ACTIVE.cycle===resolved.effectiveCalendarCycle),
   importRequired:!resolved.ACTIVE,errors:resolved.failures});
 }
 return Object.freeze({VERSION,CALENDAR,PRIVATE2610,EXPECTED2611,current,archive,validateBank,
  install,fcomIdent});
});
