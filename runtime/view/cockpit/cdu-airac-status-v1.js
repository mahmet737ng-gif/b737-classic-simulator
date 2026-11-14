/* Unified AIRAC calendar/status readout. Never claims a date-only cycle
 * was installed into an executable FMC navigation database.
 */
(function(root){
 'use strict';
 const model=root.B737FMCAiracBanksV1,output=root.document.getElementById('fmcAiracCycleStatus');
 if(!model||!output)return;
 const seats=new Map();
 const today=()=>new Date().toISOString().slice(0,10);
 function render(){
  const date=today(),schedule=model.status(model.initial(),date);
  const period=model.dateRange('2611');
  const reports=[...seats.entries()];
  const active=reports.map(([seat,x])=>seat+': '+(x.activeCycle||'NOT LOADED'));
  output.textContent='AIRAC calendar: '+(schedule.calendarCurrentCycle||'UNKNOWN')+
   ' · 2611 '+period+
   ' · 2611 NAVDATA: '+(reports.some(([,x])=>x.installedCycles?.includes('2611'))?'PRIVATE SOURCE INSTALLED':'SOURCE NOT PROVIDED')+
   ' · FMC: '+(active.length?active.join(' | '):'NO VERIFIED ACTIVE NAVDB')+
   ' · 2610 preserved as private reference; not silently promoted to active.';
 }
 root.addEventListener('message',event=>{
  const d=event.data;
  if(event.origin!==root.location.origin||d?.type!=='b737:unified-cdu'||
     d.kind!=='airac-banks'||!['CAPT','FO'].includes(d.seat))return;
  const frame=root.document.getElementById('cduFrame'+d.seat);
  if(!frame||event.source!==frame.contentWindow)return;
  seats.set(d.seat,{activeCycle:d.activeCycle,
   inactiveCycle:d.inactiveCycle,installedCycles:d.installedCycles||[]});
  render();
 });
 root.B737FMCAiracStatusV1=Object.freeze({version:model.VERSION,read:()=>({
  calendar:model.currentCycle(today()),seats:Object.fromEntries(seats)
 })});
 render();
})(window);
