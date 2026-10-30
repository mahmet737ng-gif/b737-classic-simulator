/* Additive read-only Chapter 11 network export from existing locked v6 CDU.
 * No changes to key map, panel bitmap, owner fonts, IRS logic or FMC transactions.
 */
(function(){
 'use strict';
 const seat=new URLSearchParams(location.search).get('seat');
 if(!['CAPT','FO'].includes(seat)||parent===window||typeof state==='undefined'||typeof update!=='function')return;
 const original=update;let queued=false;
 function snapshot(){
  const a=state.active||{},p=state.pending||{},staged=state.stagedRoute||{};
  return {type:'b737:fmc-cdu-snapshot',seat,version:1,page:state.page,
   active:{ORIGIN:String(a.ORIGIN||''),DEST:String(a.DEST||''),IRS_POS:String(a.IRS_POS||''),CRZ_ALT:String(a.CRZ_ALT||''),RUNWAY:String(a.RUNWAY||'')},
   routeTransactionPending:Object.keys(p).length>0||Object.keys(staged).length>0,
   hasNavDb:Boolean(state.navdbActive),hasVerifiedLegs:false,
   scratchpadMessage:state.message||null};
 }
 function send(){
  if(queued)return;queued=true;
  requestAnimationFrame(()=>{queued=false;parent.postMessage(snapshot(),location.origin);});
 }
 update=function(){original();send();};
 window.updateStage5View=update;
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)send()});
 window.addEventListener('message',e=>{
  if(e.source!==parent||e.origin!==location.origin)return;
  if(e.data?.type==='b737:fmc-request-snapshot'&&e.data.seat===seat)send();
 });
 send();
 window.B737CduFmcTelemetryV1=Object.freeze({snapshot});
})();
