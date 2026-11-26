/* Additive read-only Chapter 11 network export from existing locked v6 CDU.
 * No changes to key map, panel bitmap, owner fonts, IRS logic or FMC transactions.
 */
(function(){
 'use strict';
 const seat=new URLSearchParams(location.search).get('seat');
 if(!['CAPT','FO'].includes(seat)||parent===window||typeof state==='undefined'||typeof update!=='function')return;
 const original=update;let queued=false,feed='UNKNOWN',pendingPowerEvidence=true;
 const performancePages=new Set(['RTE','FLIGHT_PLAN','ACTIVATE','LEGS','PROG','PROG2','PERF_INIT','PERF_LIMITS','N1_LIMIT','TAKEOFF','CLB','CRZ','DES','APP_REF','RTE_DATA','FIX','HOLD']);
 let avionicsFrame=0,lastInputs='';
 function receiveAvionics(){
  avionicsFrame=0;
  const network=parent.B737UnifiedAvionicsNetworkV1;
  const ground=network?.getSignal('aircraft.airground');
  state.fmcOnGroundVerified=ground?.quality==='VALID'&&typeof ground.value?.onGround==='boolean'?
   ground.value.onGround:null;
  const refCleared=core.onAirGround?.(state,state.fmcOnGroundVerified)===true;
  const data=network?.getSignal('fmc.computed');
  const next=data?.quality==='VALID'?{
   predictions:data.value.predictions,trainingPerformance:data.value.trainingPerformance,rta:data.value.rta,motion:data.value.motion,fuel:data.value.fuel,airData:data.value.airData,guidance:data.value.guidance,
   position:data.value.failed!==true&&data.value.position?.quality==='VALID'?data.value.position:null
  }:null;
  const signature=JSON.stringify([state.fmcOnGroundVerified,next]);
  if(signature===lastInputs){if(refCleared)update();return;}
  lastInputs=signature;state.fmcPageInputs=next;
  // Settle the weight once and publish via the existing CDU shared-state bridge.
  const weightSettled=core.settlePerfWeight?.(state)===true;
  const warning=next?.trainingPerformance?.reserveWarning;
  if(warning&&!state.message&&warning!==state.lastTrainingFuelWarning){state.message=warning;state.lastTrainingFuelWarning=warning;}if(!warning)state.lastTrainingFuelWarning=null;
  if(next?.guidance?.holdExited&&state.page==='HOLD'){core.choose(state,pages,'LEGS');state.subpage=1;}
  if(refCleared||weightSettled||performancePages.has(state.page))update();
 }
 function queueAvionics(){
  if(!avionicsFrame)avionicsFrame=requestAnimationFrame(receiveAvionics);
 }
 const paintFeed=()=>{
  // Embedded CDU must never flash live CRZ/IDENT text before a real ECU
  // snapshot arrives. Once the aircraft feeder is evaluated, proven loss
  // suppresses the screen; UNKNOWN retains trainer-mode behavior only when
  // an authoritative snapshot has actually been received.
  const off=pendingPowerEvidence||feed==='ABSENT';
  for(const id of ['fmc-lines','annunciators']){
   const el=document.getElementById(id);if(el)el.style.visibility=off?'hidden':'visible';
  }
  document.documentElement.dataset.cduElectricalFeed=feed;
  document.documentElement.dataset.cduAwaitingPower=String(pendingPowerEvidence);
 };
 // Block all keyboard and physical key activation only for proven CDU loss.
 for(const evt of ['pointerdown','click']){
  document.addEventListener(evt,e=>{
   if((!pendingPowerEvidence&&feed!=='ABSENT')||!e.target?.closest?.('#clickmap .hotspot'))return;
   e.preventDefault();e.stopImmediatePropagation();
  },true);
 }
 document.addEventListener('keydown',e=>{
  if(!pendingPowerEvidence&&feed!=='ABSENT')return;
  if(e.key==='Escape'||e.key==='Tab')return;
  e.stopImmediatePropagation();e.preventDefault();
 },true);
 window.addEventListener('message',e=>{
  if(e.source!==parent||e.origin!==location.origin)return;
  if(e.data?.type==='b737:fmc-cdu-power'&&e.data.seat===seat&&['PRESENT','ABSENT','UNKNOWN'].includes(e.data.feed)){
   feed=e.data.feed;pendingPowerEvidence=false;paintFeed();
  }
 });
 function snapshot(){
  const a=state.active||{},p=state.pending||{},staged=state.stagedRoute||{};
  const nav=state.navdbActive;
  const importedRoute=window.CDU_NAV_MAP?.acceptedRoute(nav)&&nav.origin===a.ORIGIN&&nav.destination===a.DEST?
   {source:nav.sourceId,points:[{name:nav.origin,...nav.originPosition},
    ...nav.legs.map(l=>({name:l.to,lat:l.lat,lon:l.lon,leg:l.discontinuity?'DISCONTINUITY':'ACTIVE'}))]}:null;
  return {type:'b737:fmc-cdu-snapshot',seat,version:1,page:state.page,
   active:{ORIGIN:String(a.ORIGIN||''),DEST:String(a.DEST||''),IRS_POS:String(a.IRS_POS||''),CRZ_ALT:String(a.CRZ_ALT||''),RUNWAY:String(a.RUNWAY||'')},
   routeTransactionPending:Object.keys(p).length>0||Object.keys(staged).length>0,
   routeActivated:state.chapter11RoutePages?state.routeActivated===true:null,
   routeRevision:state.routeRevision||0,
   hasNavDb:Boolean(state.navdbActive),hasVerifiedLegs:false,
   displayRoute:importedRoute??window.CDU_CH11_ROUTE_PAGES?.activeReferenceRoute(state)??null,
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
 const network=parent.B737UnifiedAvionicsNetworkV1;
 if(network?.subscribe){
  const unsubscribes=['aircraft.airground','fmc.computed'].map(topic=>network.subscribe(topic,queueAvionics));
  window.addEventListener('pagehide',()=>unsubscribes.forEach(unsubscribe=>unsubscribe()),{once:true});
  queueAvionics();
 }
 paintFeed();send();parent.postMessage({type:'b737:fmc-cdu-power-ready',seat},location.origin);
 window.B737CduFmcTelemetryV1=Object.freeze({snapshot,getFeed:()=>feed,
  awaitingPower:()=>pendingPowerEvidence});
})();
