/* Parent: calendar display and authenticated private NAVDB bank status.
 * Current AIRAC is calendar metadata, NEVER equivalent to loaded FMC data.
 * Nothing is retrieved over the public Internet; 2610 private source stays private.
 */
(function(root){
 'use strict';
 const api=root.B737CDUAiracBanksV1;
 if(!api){root.console?.error('AIRAC cycle model not loaded');return;}
 const seats=['CAPT','FO'];let bankRecords={ACTIVE:null,INACTIVE:null};
 const utcDay=()=>new Date().toISOString().slice(0,10);
 const status=()=>api.fcomIdent(bankRecords,utcDay());
 const panel=root.document.getElementById('airacDatabaseStatus');
 function paint(){
  if(!panel)return;
  const s=status(),cy=s.currentCalendarCycle||'UNKNOWN';
  const active=s.ACTIVE?.value||'NOT INSTALLED',inactive=s.INACTIVE?.value||'NOT INSTALLED';
  panel.textContent='AIRAC '+cy+' is current by UTC calendar · FMC NAV DATA ACTIVE: '+active+
    ' · INACTIVE: '+inactive+
    (s.importRequired?' · Licensed navigation data must be privately imported; 2610 preserved.':'');
  panel.dataset.calendar=cy;
  panel.dataset.fmcInstalled=String(!s.importRequired);
 }
 function send(seat){
  const frame=root.document.getElementById('cduFrame'+seat);
  if(!frame?.contentWindow)return false;
  frame.contentWindow.postMessage({type:'b737:cdu-navdb-bank-snapshot-v1',seat,
    snapshot:status()},root.location.origin);return true;
 }
 function notify(){paint();return seats.map(seat=>({seat,delivered:send(seat)}));}
 root.addEventListener('message',e=>{
  if(e.origin!==root.location.origin||e.data?.type!=='b737:cdu-navdb-bank-request-v1'||
     !seats.includes(e.data.seat))return;
  const frame=root.document.getElementById('cduFrame'+e.data.seat);
  if(e.source!==frame?.contentWindow)return;
  send(e.data.seat);
 });
 root.document.addEventListener('load',event=>{
  for(const seat of seats)if(event.target===root.document.getElementById('cduFrame'+seat))
   {send(seat);break;}
 },true);
 // To be called ONLY by a private, source-verified NAVDB importer.
 // Explicit labels "ACTIVE"/"INACTIVE" are FMC storage banks; calendar
 // effectivity NEVER automatically swaps actual database slots.
 function attachVerifiedBanks(payload){
  const next={ACTIVE:payload?.ACTIVE??null,INACTIVE:payload?.INACTIVE??null};
  for(const name of seats){void name;} // No seat-specific NAVDB source divergence.
  for(const name of ['ACTIVE','INACTIVE'])if(next[name])api.validateBank(next[name]);
  bankRecords=next;return notify();
 }
 root.B737CDUAiracStatusBridgeV1=Object.freeze({version:api.VERSION,status,notify,attachVerifiedBanks});
 notify();
})(window);
