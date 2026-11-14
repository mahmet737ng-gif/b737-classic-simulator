/* CDU-seat IDENT NAV DATA projection from verified FMC bank status only.
 * No calendar-only cycle can ever claim ACTIVE or INACTIVE.
 */
(function(root){
 'use strict';
 const seat=new URLSearchParams(root.location.search).get('seat');
 const api=root.B737CDUAiracBanksV1;
 if(!['CAPT','FO'].includes(seat)||!api||root.parent===root||
    typeof state==='undefined'||typeof update!=='function')return;
 // The canonical FMC bank adapter is the sole writer of IDENT NAV DATA.
 // Keep legacy parent snapshots readable, but prevent a second writer from
 // clearing or replacing validated ACTIVE/INACTIVE evidence after update().
 if(root.B737CDUAiracIdentAdapterV1){
  root.B737CDUAiracReceiverV1=Object.freeze({
   version:api.VERSION,getStatus:()=>null,
   disabledReason:'SUPERSEDED_BY_FMC_BANKS_V1'
  });
  return;
 }
 let last=null;
 function apply(){
  if(!last)return false;
  state.preflightEvidence={...(state.preflightEvidence||{})};
  for(const field of ['NAV_DATA','ACTIVE','INACTIVE']){
   const entry=last[field];
   if(entry&&entry.quality==='VALID'&&entry.origin==='VERIFIED_NAV_DATABASE'){
    state.preflightEvidence[field]={...entry};
   }else{
    delete state.preflightEvidence[field];
   }
  }
  return true;
 }
 const prev=update;
 update=function(){apply();return prev();};
 root.updateStage5View=update;
 root.addEventListener('message',e=>{
  if(e.origin!==root.location.origin||e.source!==root.parent||
     e.data?.type!=='b737:cdu-navdb-bank-snapshot-v1'||e.data.seat!==seat)return;
  // Never take pre-rendered ACTIVE/INACTIVE values from the wire.
  // Both seats independently revalidate each source record and its cycle.
  let snap;
  try{snap=api.fcomIdent(e.data.bankRecords,e.data.asOf);}catch{return;}
  if(snap?.schema!==api.VERSION||!snap.calendarIsNotFmcInstall)return;
  last=snap;
  apply();update();
 });
 function request(){
  root.parent.postMessage({type:'b737:cdu-navdb-bank-request-v1',seat},root.location.origin);
 }
 root.addEventListener('pageshow',request);
 root.B737CDUAiracReceiverV1=Object.freeze({
  getStatus:()=>last?{currentCalendarCycle:last.currentCalendarCycle,
   activeInstalled:!!last.ACTIVE,inactiveInstalled:!!last.INACTIVE}:null,
  version:api.VERSION
 });
 request();
})(window);
