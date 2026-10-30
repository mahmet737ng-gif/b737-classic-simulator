/* Boeing 737 Classic FMC NAV DATA bank management (trainer only).
 * AIRAC calendar metadata is NOT a navigation database. Two FMC banks are
 * activated ONLY after a private, parsed, integrity-verified installation.
 * FCOM 11.40.8-9: on-ground date transfer, previous active becomes inactive,
 * route data must be cleared; expired active retained during flight.
 */
(function(root,factory){'use strict';const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.B737FMCAiracBanksV1=api;
})(typeof globalThis!=='undefined'?globalThis:null,function(){
 'use strict';
 const SCHEMA='B737_FMC_AIRAC_BANKS_V1',VERSION='AIRAC-2611-BANKS-0001';
 const CALENDAR=Object.freeze({
  '2610':Object.freeze({cycle:'2610',start:'2026-10-01',endExclusive:'2026-10-29',endInclusive:'2026-10-28',sourceStatus:'PRIVATE_2610_REFERENCE_NOT_FMC_ACTIVE'}),
  '2611':Object.freeze({cycle:'2611',start:'2026-10-29',endExclusive:'2026-11-26',endInclusive:'2026-11-25',sourceStatus:'CALENDAR_ONLY_AWAITING_2611_NAVDATA'}),
  '2612':Object.freeze({cycle:'2612',start:'2026-11-26',endExclusive:'2026-12-24',endInclusive:'2026-12-23',sourceStatus:'FUTURE_CALENDAR_ONLY'})
 });
 const date=x=>/^\d{4}-\d{2}-\d{2}$/.test(x||'')?x:null;
 const copy=v=>JSON.parse(JSON.stringify(v));
 function currentCycle(utcDay){const s=date(utcDay);if(!s)throw Error('AIRAC_UTC_DAY_REQUIRED');
  return Object.values(CALENDAR).find(c=>s>=c.start&&s<c.endExclusive)?.cycle||null;
 }
 function fmt(ymd){const [yy,mm,dd]=ymd.split('-').map(Number);
  return ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'][mm-1]+String(dd).padStart(2,'0');
 }
 function dateRange(cycle){const c=CALENDAR[cycle];if(!c)throw Error('UNKNOWN_AIRAC_CYCLE');
  return fmt(c.start)+fmt(c.endInclusive)+'/'+c.endInclusive.slice(2,4);
 }
 function initial(){return {schema:SCHEMA,activeCycle:null,inactiveCycle:null,installed:{},
  lastTransition:null,sourceStatus:'NO_FMC_NAVDATA_INSTALLED'};}
 function validSource(pkg,verifyPackage){
  if(!pkg||!CALENDAR[pkg.cycle]||typeof verifyPackage!=='function')
   throw Error('NAVDATA_PACKAGE_AND_TRUSTED_IMPORT_VALIDATOR_REQUIRED');
  if(pkg.cycle!=='2610'&&pkg.cycle!=='2611')throw Error('CYCLE_NOT_ACCEPTED_FOR_IMPORT');
  if(!/^[0-9a-f]{64}$/i.test(pkg.sourceSha256||''))throw Error('MISSING_SOURCE_SHA256');
  if(!/^[A-Z0-9._-]{4,12}$/.test(pkg.navDataIdentifier||''))throw Error('MISSING_REAL_NAVDATA_IDENTIFIER');
  if(pkg.effectiveStart!==CALENDAR[pkg.cycle].start||
     pkg.effectiveEndExclusive!==CALENDAR[pkg.cycle].endExclusive)
    throw Error('NAVDATA_AIRAC_DATES_MISMATCH');
  if(pkg.proceduresParsed!==true||pkg.legEncodingValidated!==true||
     !Number.isSafeInteger(pkg.records?.airports)||pkg.records.airports<=0||
     !Number.isSafeInteger(pkg.records?.waypoints)||pkg.records.waypoints<=0)
    throw Error('NAVDATA_RECORDS_OR_PROCEDURE_LEGS_UNVALIDATED');
  // Actual SHA-256 and parser trust MUST be validated by the private import
  // pipeline. A string or calendar declaration by itself cannot pass.
  if(verifyPackage(pkg)!==true)throw Error('NAVDATA_PRIVATE_IMPORT_VERIFICATION_FAILED');
  return {cycle:pkg.cycle,sourceSha256:pkg.sourceSha256.toLowerCase(),
   navDataIdentifier:pkg.navDataIdentifier,effectiveStart:pkg.effectiveStart,
   effectiveEndExclusive:pkg.effectiveEndExclusive,records:copy(pkg.records),
   provenance:'PRIVATE_PARSED_AND_VERIFIED_NAVDATA',fmcExecutable:true};
 }
 function install(s,pkg,verifyPackage){
  validate(s);const record=validSource(pkg,verifyPackage),next=copy(s);
  next.installed[record.cycle]=record;next.sourceStatus='BANKS_PRESENT';
  // Adding a bank never silently activates it.
  if(record.cycle!==next.activeCycle&&next.inactiveCycle!==record.cycle)
   next.inactiveCycle=record.cycle;
  return next;
 }
 function activate(s,cycle,{onGround,utcDay}={}){
  validate(s);
  if(onGround!==true)throw Error(onGround===false?'NAVDATA_SWITCH_IN_FLIGHT':'GROUND_STATE_NOT_VERIFIED');
  const d=date(utcDay);if(!d)throw Error('NAVDATA_SWITCH_NEEDS_VALID_UTC_DATE');
  const bank=s.installed[cycle];
  if(!bank||bank.provenance!=='PRIVATE_PARSED_AND_VERIFIED_NAVDATA'||bank.fmcExecutable!==true)
    throw Error('NAVDATA_CYCLE_NOT_INSTALLED_OR_NOT_VERIFIED');
  const next=copy(s);
  if(next.activeCycle===cycle)return {state:next,changed:false,clearRoute:false};
  const previous=next.activeCycle;
  next.activeCycle=cycle;
  next.inactiveCycle=previous||Object.keys(next.installed).find(x=>x!==cycle)||null;
  next.lastTransition={atUtc:d,previousActive:previous,newActive:cycle,
   requiresRouteClear:true,approvedOnGround:true};
  return {state:next,changed:true,clearRoute:true};
 }
 const ROUTE_FIELDS=Object.freeze(['ORIGIN','DEST','CO_ROUTE','FLIGHT','RUNWAY','WPT1','WPT2','OFFSET']);
 const ROUTE_STATE=Object.freeze(['navdbActive','navdbPending','navdbStage',
  'stage5Pending','stage5Committed','stage5AwaitingExec','stage6PendingPlan',
  'stage6Selections','stage6AwaitingExec','stage6BasePlanId','depArrSelection']);
 function switchFmc(fmc,cycle,environment){
  if(!fmc||!fmc.fmcNavDataBanks)throw Error('FMC_NAVDATA_BANKS_REQUIRED');
  const decision=activate(fmc.fmcNavDataBanks,cycle,environment);
  const next=copy(fmc);
  next.fmcNavDataBanks=decision.state;
  if(decision.changed){
   for(const key of ROUTE_FIELDS)if(Object.hasOwn(next.active||{},key))next.active[key]='';
   for(const key of ROUTE_FIELDS)if(Object.hasOwn(next.pending||{},key))delete next.pending[key];
   next.stagedRoute={};
   for(const key of ROUTE_STATE)delete next[key];
   next.message='';next.scratch='';
  }
  return {state:next,changed:decision.changed,clearedRoute:decision.clearRoute};
 }
 function validate(s){
  if(!s||s.schema!==SCHEMA||!s.installed||typeof s.installed!=='object')
   throw Error('INVALID_AIRAC_BANK_STATE');
  for(const x of [s.activeCycle,s.inactiveCycle])if(x!==null&&!s.installed[x])throw Error('NAVDATA_BANK_REFERENCE_NOT_INSTALLED');
  if(s.activeCycle&&s.activeCycle===s.inactiveCycle)throw Error('DUPLICATED_ACTIVE_AND_INACTIVE_NAVDATA');
  return true;
 }
 function ident(s){
  validate(s);
  const active=s.activeCycle?s.installed[s.activeCycle]:null;
  const inactive=s.inactiveCycle?s.installed[s.inactiveCycle]:null;
  return {
   NAV_DATA:active?{quality:'VALID',origin:'VERIFIED_NAV_DATABASE',value:active.navDataIdentifier}:null,
   ACTIVE:active?{quality:'VALID',origin:'VERIFIED_NAV_DATABASE',value:dateRange(active.cycle)}:null,
   INACTIVE:inactive?{quality:'VALID',origin:'VERIFIED_NAV_DATABASE',value:dateRange(inactive.cycle)}:null
  };
 }
 function status(s,utcDay){
  validate(s);
  const cycle=currentCycle(utcDay);
  return {version:VERSION,calendarCurrentCycle:cycle,activeCycle:s.activeCycle,
   inactiveCycle:s.inactiveCycle,installedCycles:Object.keys(s.installed).sort(),
   activeStatus:s.activeCycle?(s.activeCycle===cycle?'ACTIVE_IN_DATE':'ACTIVE_EXPIRED_OR_NONCURRENT'):'NO_FMC_ACTIVE_NAVDB',
   pendingCycle2611:!s.installed['2611'],cycle2611DateRange:dateRange('2611'),
   statusFromMetadataOnly:s.installed['2611']===undefined};
 }
 return Object.freeze({SCHEMA,VERSION,CALENDAR,initial,currentCycle,dateRange,install,activate,switchFmc,validate,ident,status});
});
