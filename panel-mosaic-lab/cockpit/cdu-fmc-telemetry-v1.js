/* Additive read-only Chapter 11 network export from existing locked v6 CDU.
 * No changes to key map, panel bitmap, owner fonts, IRS logic or FMC transactions.
 */
(function(){
 'use strict';
 const seat=new URLSearchParams(location.search).get('seat');
 if(!['CAPT','FO'].includes(seat)||parent===window||typeof state==='undefined'||typeof update!=='function')return;
 const original=update;let queued=false,feed='UNKNOWN';
 const paintFeed=()=>{
  // Existing CDU power is not inferred from the aircraft bus. Only proven
  // absence turns the screen and annunciators off; UNKNOWN stays in trainer mode.
  const off=feed==='ABSENT';
  for(const id of ['fmc-screen','annunciators']){
   const el=document.getElementById(id);if(el)el.style.visibility=off?'hidden':'visible';
  }
  document.documentElement.dataset.cduElectricalFeed=feed;
 };
 // Block all keyboard and physical key activation only for proven CDU loss.
 for(const evt of ['pointerdown','click']){
  document.addEventListener(evt,e=>{
   if(feed!=='ABSENT'||!e.target?.closest?.('#clickmap .hotspot'))return;
   e.preventDefault();e.stopImmediatePropagation();
  },true);
 }
 document.addEventListener('keydown',e=>{
  if(feed!=='ABSENT')return;
  if(e.key==='Escape'||e.key==='Tab')return;
  e.stopImmediatePropagation();e.preventDefault();
 },true);
 window.addEventListener('message',e=>{
  if(e.source!==parent||e.origin!==location.origin)return;
  if(e.data?.type==='b737:fmc-cdu-power'&&e.data.seat===seat&&['PRESENT','ABSENT','UNKNOWN'].includes(e.data.feed)){
   feed=e.data.feed;paintFeed();
  }
 });
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
 paintFeed();send();parent.postMessage({type:'b737:fmc-cdu-power-ready',seat},location.origin);
 window.B737CduFmcTelemetryV1=Object.freeze({snapshot,getFeed:()=>feed});
})();
