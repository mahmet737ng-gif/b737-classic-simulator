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
 // Use exactly the same ATA28 tank readings and electrical gates as
 // the physical Smiths quantity indicators, not a local 6000 kg constant.
 function fuelInput(host){
  const owner=host.B737ISNCockpitV1,reading=owner?.getFuelQuantityIndications?.();
  if(!reading)return null;
  const cb=id=>host.B737UnifiedCB?.available(id)!==false;
  const keys=['main1','center','main2'];
  if(reading.standbyAc!==true||!cb('fuel.quantityCommon')||keys.some(k=>!cb('fuel.quantity.'+k)||!Number.isFinite(reading.tanksKg?.[k])||reading.tanksKg[k]<0))return {quality:'INVALID',source:'ATA28'};
  return {quality:'VALID',source:'ATA28',totalKg:keys.reduce((sum,k)=>sum+reading.tanksKg[k],0)};
 }
 let warningSignature='',announced=new Set();
 function displayFuelWarnings(warnings){
  const signature=warnings.join('|');
  if(signature!==warningSignature){
   if(['INSUFFICIENT FUEL','USING RSV FUEL'].includes(state.message)&&!warnings.includes(state.message))state.message='';
   announced=new Set([...announced].filter(w=>warnings.includes(w)));warningSignature=signature;
  }
  const warning=warnings.find(w=>!announced.has(w));
  if(warning&&!state.message&&!state.scratch){state.message=warning;announced.add(warning);return true;}
  return false;
 }
 function receiveAvionics(){
  avionicsFrame=0;
  const network=parent.B737UnifiedAvionicsNetworkV1;
  const ground=network?.getSignal('aircraft.airground');
  const ecu=parent.B737ISNCockpitV1?.getECUState?.();
  state.fmcOnGroundVerified=ground?.quality==='VALID'&&typeof ground.value?.onGround==='boolean'?
   ground.value.onGround:typeof ecu?.aircraft?.onGround==='boolean'?ecu.aircraft.onGround:null;
  const refCleared=core.onAirGround?.(state,state.fmcOnGroundVerified)===true;
  const data=network?.getSignal('fmc.computed');
  const next=data?.quality==='VALID'?{
   predictions:data.value.predictions,trainingPerformance:data.value.trainingPerformance,rta:data.value.rta,motion:data.value.motion,fuel:data.value.fuel,airData:data.value.airData,guidance:data.value.guidance,
   position:data.value.failed!==true&&data.value.position?.quality==='VALID'?data.value.position:null
  }:{};
  const actual=fuelInput(parent);if(actual)next.fuel=actual;
  const route=window.CDU_CH11_ROUTE_PAGES,scenario=parent.B737UnifiedFlightScenarioV1;
  const flight=scenario?.getDiagnostics?.()?.active===true?scenario.getState?.():null;
  const arp=icao=>window.B737CDUIRSAdapterV1?.arp?.(icao);
  // PERF data is derived against the same current quantity, with no second fuel ledger.
  const prior=state.fmcPageInputs;state.fmcPageInputs=next;
  const perf=core.perfData?.({...state,pending:{},stagedRoute:{}});
  const p=next.position,position=p?.quality==='VALID'?{lat:p.latitudeDeg,lon:p.longitudeDeg}:flight;
  const flows=['engine1','engine2'].map(k=>ecu?.engines?.[k]?.fuelFlowKgHr);
  const native=next.predictions?.quality==='VALID'&&next.predictions.destination?.ident===state.active.DEST&&Number.isFinite(next.predictions.destination?.fuelKg)?next.predictions:null;
  if(!native){const estimate=route?.trainingFuelPrediction?.(state,next,{perf,onGround:state.fmcOnGroundVerified,origin:arp(state.active.ORIGIN),destination:arp(state.active.DEST),position,altitudeFt:flight?.altitudeFt??ecu?.aircraft?.pressureAltitudeFt,verticalSpeedFpm:flight?.verticalSpeedFpm,flowKgHr:flows.every(Number.isFinite)?flows[0]+flows[1]:null});
   if(estimate){next.predictions=null;next.trainingPerformance=estimate;}
  }
  const pred=native||next.trainingPerformance;
  const reserve=/^\d{1,2}(?:\.\d)?$/.test(String(state.active.RESERVES??''))?Number(state.active.RESERVES)*1000:null;
  const validPrediction=next.fuel?.quality==='VALID'&&state.routeActivated===true&&!route?.modified?.(state)&&pred?.destination?.ident===state.active.DEST;
  const warnings=validPrediction?route?.fuelWarnings?.(pred.remainingFuelRawKg??pred.destination.fuelKg,reserve)||[]:[];
  if(next.fuel?.quality==='INVALID'){next.predictions=null;next.trainingPerformance=null;}
  state.fmcPageInputs=prior;
  const warningChanged=displayFuelWarnings(warnings);
  const signature=JSON.stringify([state.fmcOnGroundVerified,next]);
  if(signature===lastInputs){if(refCleared||warningChanged)update();return;}
  lastInputs=signature;state.fmcPageInputs=next;
  // Settle the weight once and publish via the existing CDU shared-state bridge.
  const weightSettled=core.settlePerfWeight?.(state)===true;

  if(next?.guidance?.holdExited&&state.page==='HOLD'){core.choose(state,pages,'LEGS');state.subpage=1;}
  if(refCleared||weightSettled||warningChanged||performancePages.has(state.page))update();
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
 // Poll the authoritative ATA28 ledger even when the optional avionics bus is absent.
 const poll=setInterval(queueAvionics,1000);window.addEventListener('pagehide',()=>clearInterval(poll),{once:true});queueAvionics();
 paintFeed();send();parent.postMessage({type:'b737:fmc-cdu-power-ready',seat},location.origin);
 window.B737CduFmcTelemetryV1=Object.freeze({snapshot,getFeed:()=>feed,
  awaitingPower:()=>pendingPowerEvidence});
})();
