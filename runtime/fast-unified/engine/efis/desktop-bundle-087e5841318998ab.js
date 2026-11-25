(async()=>{
;
/* ../../engine/efis/selected-heading-reference-v1.js?v=EHSI-WMM2025-MAG-0002 */
try{
/* Unified 737 Classic magnetic selected heading reference (WMM2025).
 * MCP heading is MAGNETIC. IRS/FMC true heading is converted by independently
 * sourced declination; never convert the MCP bug to True on an EHSI.
 * NOAA/BGS WMM2025 modeled field is distinct from sensor/ARINC measurements.
 */
(function(root,factory){'use strict';const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.B737SelectedHeadingReferenceV1=api;
})(typeof globalThis!=='undefined'?globalThis:null,function(){
 'use strict';
 const VERSION='SELECTED_MAGNETIC_HEADING_WMM2025_0002';
 const finite=x=>typeof x==='number'&&Number.isFinite(x);
 const norm=x=>((x%360)+360)%360;
 function resolve({selectedMagDeg=null,observedVariationDeg=null,
  observedSource=null,positionValid=false,lat=null,lon=null,
  altitudeFt=0,date}={}){
  const mcp=finite(selectedMagDeg)&&selectedMagDeg>=0&&selectedMagDeg<=360;
  const sourceModeled=typeof observedSource==='string'&&observedSource.includes('WMM2025');
  const observedValid=finite(observedVariationDeg)&&Math.abs(observedVariationDeg)<=180;
  // A real sensor or injected IRS variation wins. An IRS WMM estimate is
  // already modeled data: recompute it at *this display's current position*
  // (scenario may have advanced since the last IRU refresh).
  const measured=observedValid&&!sourceModeled;
  let variation=measured?observedVariationDeg:null;
  let source=measured?(observedSource||'IRS_SUPPLIED_MAGNETIC_VARIATION'):'MAGNETIC_VARIATION_UNAVAILABLE';
  let modeled=false,decimalYear=null;
  if(!measured&&positionValid===true){
   const model=globalThis.B737WMM2025V1?.evaluate?.({lat,lon,altitudeFt,date});
   if(model?.valid===true){
    variation=model.declinationDeg;source=model.source;
    decimalYear=model.decimalYear;modeled=true;
   }else if(model?.reason)source=model.reason;
  }
  if(!finite(variation)&&observedValid&&sourceModeled){
   variation=observedVariationDeg;source=observedSource;modeled=true;
  }
  return Object.freeze({selectedDisplayDeg:mcp&&finite(variation)?norm(selectedMagDeg):null,
   declinationDeg:variation,referenceSource:source,reference:'MAGNETIC',
   estimated:modeled,decimalYear,selectedHeadingMagneticDeg:mcp?norm(selectedMagDeg):null,
   quality:finite(variation)?modeled?'WMM2025_MODELED':'OBSERVED':'UNAVAILABLE'});
 }
 return Object.freeze({VERSION,resolve});
});

}catch(error){queueMicrotask(()=>{throw error});}
;await 0;
;
/* ./unified-efis-sources-v1.js?v=EFIS-SOURCES-0008-HEALTH-DIAGNOSTICS-CDU-EHSI-MAP-0001-OFFSETS-0001 */
try{
/* Classic FCOM 10.32.33 / 10.40 / 11.10.11, ATA 34 EFIS training.
 * Seat -> SG (video relay) -> IRS and VHF NAV (independent input relays).
 * Physical display power and dimmers always belong to the receiving seat. */
(function(root,factory){
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root.document)root.B737UnifiedEfisSources=api.bind(root);
})(globalThis,function(){
 'use strict';
 const SEATS=['CAPT','FO'];
 const SWITCHES={'efi-transfer':['BOTH ON 1','NORMAL','BOTH ON 2'],
  'irs-transfer':['BOTH ON L','NORMAL','BOTH ON R'],'vhf-nav':['BOTH ON 1','NORMAL','BOTH ON 2']};
 const signal=(snap,key)=>snap?.[key]?.quality==='VALID'?snap[key].value:null;
 const value=v=>Number.isFinite(v)?v:null;
 const norm=v=>((v%360)+360)%360;
 const coordinate=(lat,lon,source)=>Number.isFinite(lat)&&Math.abs(lat)<=90&&
  Number.isFinite(lon)&&Math.abs(lon)<=180?{lat,lon,source}:null;
 const delta=v=>norm(v+180)-180;
 const irsTopic=n=>n===1?'irs.left':'irs.right';
 function resolve(snapshot,seat,toggles={},feeds={},faults={},scenarioPosition=null){
  const display=seat==='CAPT'?1:2;
  const selected=(key,fallback)=>{
   const i=SWITCHES[key].indexOf(toggles[key]);
   return i===0?1:i===2?2:fallback;
  };
  const sg=selected('efi-transfer',display);
  const irs=selected('irs-transfer',sg),vhf=selected('vhf-nav',sg);
  const irsRecord=snapshot?.[irsTopic(irs)]??null;
  const adcRecord=snapshot?.['airdata.adc'+sg]??null;
  const raRecord=snapshot?.['airdata.radioAltitude'+sg]??null;
  const iru=signal(snapshot,irsTopic(irs)),peer=signal(snapshot,irsTopic(irs===1?2:1));
  const validAtt=u=>u?.powered===true&&u.attitudeValid===true&&Number.isFinite(u.pitchDeg)&&Number.isFinite(u.rollDeg);
  const attitude=validAtt(iru),peerAttitude=validAtt(peer);
  const nav=iru?.powered===true&&iru.positionValid===true;
  const fmc=signal(snapshot,'fmc.computed');
  const fmcMotion=fmc?.operational===true?fmc.motion:null;
  const fmcFix=fmc?.position;
  const mapPosition=(fmcFix?.quality==='VALID'&&fmc.failed!==true?
   coordinate(fmcFix.latitudeDeg,fmcFix.longitudeDeg,'FMC'):null)??
   (nav?coordinate(iru.lat,iru.lon,irs===1?'IRS L':'IRS R'):null);
  const heading=iru?.powered===true?value(iru.headingDeg):null;
  const trueTrack=value(fmcMotion?.trueTrackDeg)??(nav?value(iru.trackDeg):null);
  // Flight instruments always display magnetic (M), not TRU.
  // IRS magneticVariationDeg may be an observed sensor or a labeled WMM2025
  // model value. When absent, evaluate WMM at the current aircraft position.
  const observedVariation=iru?.powered===true?value(iru.magneticVariationDeg):null;
  const scenarioValid=Number.isFinite(scenarioPosition?.lat)&&
   Number.isFinite(scenarioPosition?.lon);
  const positionLat=scenarioValid?scenarioPosition.lat:value(iru?.lat);
  const positionLon=scenarioValid?scenarioPosition.lon:value(iru?.lon);
  const sampleAlt=signal(snapshot,'flightcontext.state')?.pressureAltitudeFt;
  const positionAlt=Number.isFinite(scenarioPosition?.altitudeFt)?
   scenarioPosition.altitudeFt:Number.isFinite(sampleAlt)?sampleAlt:0;
  const selectedMcpMag=signal(snapshot,'mcp.state');
  const headingReference=globalThis.B737SelectedHeadingReferenceV1?.resolve({
   selectedMagDeg:selectedMcpMag?.powered===true?value(selectedMcpMag.headingDeg):null,
   observedVariationDeg:observedVariation,
   observedSource:iru?.magneticVariationSource??null,
   positionValid:scenarioValid||nav,
   lat:positionLat,lon:positionLon,altitudeFt:positionAlt
  })||{declinationDeg:observedVariation,selectedDisplayDeg:
   observedVariation!==null&&selectedMcpMag?.powered===true?
    value(selectedMcpMag.headingDeg):null,
   referenceSource:'MAGNETIC_REFERENCE_MODULE_MISSING',estimated:false};
  const variation=headingReference.declinationDeg;
  const headingReferenceSource=headingReference.referenceSource;
  const direction=deg=>Number.isFinite(deg)&&Number.isFinite(variation)?
   norm(deg-variation):null;
  const magCourse=deg=>Number.isFinite(deg)&&Number.isFinite(variation)?
   norm(deg+variation):null;
  const mcp=signal(snapshot,'mcp.state');
  const mcpPowered=mcp?.powered===true;
  // MRG CL IV.6 p.186: COURSE 2 is an independent battery-fed MCP
  // circuit. A live FO source must never display an unpowered CRS 2.
  const coursePowered=sg===1?mcpPowered:mcp?.course2Powered===true;
  const radioCourse=coursePowered?value(sg===1?mcp.courseL:mcp.courseR):null;
  const selectedSpeedKt=mcpPowered&&mcp?.speedDisplayMode==='IAS'&&
    mcp?.speedBlank!==true?value(mcp.selectedSpeedKt):null;
  const common=selected('efi-transfer',0)!==0||selected('irs-transfer',0)!==0;
  const comparison=common||!attitude||!peerAttitude?['COMP']:
   [Math.abs(iru.pitchDeg-peer.pitchDeg)>3?'PITCH':null,Math.abs(delta(iru.rollDeg-peer.rollDeg))>3?'ROLL':null].filter(Boolean);
  const bearings=[];
  for(const channel of [1,2]){
   // FCOM 10.32.8: rose pointer head/tail represents ADF1/ADF2 only.
   // VOR station radials belong to the separate MAP/CTR MAP VOR layer.
   const station=signal(snapshot,'navigation.adf'+channel);
   if(!station)continue;
   const b=value(station.bearingDeg);
   let angle=null;
   if(b!==null&&station.bearingReference==='TRUE')angle=direction(b);
   if(b!==null&&station.bearingReference==='MAGNETIC'&&variation!==null)angle=norm(b);
   if(b!==null&&station.bearingReference==='RELATIVE'&&heading!==null)angle=direction(heading+b);
   if(angle===null&&nav&&[iru.lat,iru.lon,station.stationLat,station.stationLon].every(Number.isFinite)){
    const to=offsets({lat:iru.lat,lon:iru.lon},{lat:station.stationLat,lon:station.stationLon});
    if(Math.hypot(to.x,to.y)>.001)angle=direction(Math.atan2(to.x,to.y)*180/Math.PI);
   }
   if(angle!==null)bearings.push({channel,angle});
  }
  return {display,sg,irs,vhf,bearings,sourceSeat:SEATS[sg-1],displayPowered:feeds[display]===true,
   video:feeds[sg]===true&&faults[sg]!==true,
   attitude,pitch:attitude?iru.pitchDeg:null,bank:attitude?iru.rollDeg:null,comparison,
   heading:direction(heading),track:direction(trueTrack),trueTrack,mapPosition,
   trueRef:false,reference:'MAGNETIC',magneticVariationDeg:variation,
   magneticVariationSource:headingReferenceSource,
   headingReferenceSource,
   selectedHeading:mcpPowered?headingReference.selectedDisplayDeg:null,
   selectedHeadingEstimated:headingReference.estimated===true||
    headingReference.quality==='WMM2025_MODELED',
   selectedHeadingDeclinationDeg:headingReference.declinationDeg??null,
   course:variation!==null?radioCourse:null,
   // These targets are MCP selections, never a claim of FD servo movement,
   // NAV capture, pitch/roll attitude, or measured aircraft altitude.
   mcp:{powered:mcpPowered,course2Powered:mcp?.course2Powered===true,
    selectedHeadingDeg:mcpPowered?value(mcp.headingDeg):null,
    courseDeg:radioCourse,selectedSpeedKt,
    speedDisplayMode:mcpPowered?mcp.speedDisplayMode:null,
    speedBlank:mcp?.speedBlank===true,
    altitudeSelectedFt:mcpPowered?value(mcp.altitudeFt):null,
    verticalSpeedSelectedFpm:mcpPowered?value(mcp.verticalSpeedFpm):null,
    lateralMode:mcpPowered?mcp.lateralMode:null,
    verticalMode:mcpPowered?mcp.verticalMode:null,
    thrustMode:mcpPowered?mcp.thrustMode:null,
    autopilotMode:mcpPowered?mcp.autopilotMode:null,
    fdLeft:mcpPowered&&mcp.fdLeft===true,
    fdRight:mcpPowered&&mcp.fdRight===true},
   frontCourse:trueTrack!==null&&variation!==null&&radioCourse!==null?Math.abs(delta(trueTrack-magCourse(radioCourse)))<=90:null,
   trackSource:Number.isFinite(fmcMotion?.trueTrackDeg)?'FMC':trueTrack!==null?'IRS '+(irs===1?'L':'R'):null,
   groundSpeed:value(fmcMotion?.gsKt)??(nav?value(iru.gsKt):null),
   windDirection:direction(value(fmcMotion?.windFromDeg)??(nav?iru.windFromDeg:null)),
   windSpeed:value(fmcMotion?.windKt)??(nav?value(iru.windKt):null),
   fmc,adc:signal(snapshot,'airdata.adc'+sg),
   vor:signal(snapshot,'navigation.vor'+vhf),dme:signal(snapshot,'navigation.dme'+vhf),
   ils:signal(snapshot,'navigation.ils'+vhf),ra:signal(snapshot,'airdata.radioAltitude'+sg),
   director:signal(snapshot,'afds.director'+sg),
   health:{
    irsQuality:irsRecord?.quality??'UNKNOWN',
    irsPhase:iru?.phase??'UNKNOWN',irsPowered:iru?.powered===true,
    irsPositionValid:iru?.positionValid===true,attitudeValid:attitude,
    trackDisplayValid:direction(trueTrack)!==null,
    motionSource:iru?.source??'UNKNOWN',
    adcQuality:adcRecord?.quality??'UNKNOWN',
    adcCasKt:value(adcRecord?.value?.casKt),adcMach:value(adcRecord?.value?.mach),
    radioAltQuality:raRecord?.quality??'UNKNOWN',
    radioAltitudeFt:value(raRecord?.value?.heightFt),
    displayPowered:feeds[display]===true,
    sgVideo:feeds[sg]===true&&faults[sg]!==true
   }};
 }
 function offsets(from,to){
  const r=Math.PI/180,a=from.lat*r,b=to.lat*r,dl=delta(to.lon-from.lon)*r;
  const h=Math.sin((b-a)/2)**2+Math.cos(a)*Math.cos(b)*Math.sin(dl/2)**2;
  const distance=6880.13*Math.asin(Math.sqrt(Math.min(1,h)));
  const bearing=Math.atan2(Math.sin(dl)*Math.cos(b),Math.cos(a)*Math.sin(b)-Math.sin(a)*Math.cos(b)*Math.cos(dl));
  return {x:distance*Math.sin(bearing),y:distance*Math.cos(bearing)};
 }
 function route(fmc,mode,step){
  const data=fmc?.operational===true?fmc.route?.displayRoute:null;
  const points=data?.points;
  if(!Array.isArray(points)||points.length<2)return {points:[],activeIndex:-1,centerIndex:0,activeSource:null};
  const centerIndex=Math.min(points.length-1,Math.max(0,step??1));
  const pos=fmc?.position;
  const aircraft=pos?.quality==='VALID'?
   coordinate(pos.latitudeDeg,pos.longitudeDeg,'FMC'):null;
  const anchor=mode==='PLAN'?points[centerIndex]:aircraft;
  const projected=anchor?points.map(p=>({...p,...offsets(anchor,p)})):[];
  let activeIndex=-1,activeSource=null;
  // A displayed route is NOT automatically the active FMC leg. Require
  // verified legs, no unresolved discontinuity and operational FMC evidence.
  const evidence=fmc?.guidance?.routeEvidenceReady===true&&fmc.route?.active===true&&
   fmc.route.legsVerified===true&&fmc.route.discontinuitiesUnknown===false&&
   data.source==='PMDG_WORLD_2610_WITH_PROCEDURES_R1'&&
   points.every(p=>typeof p.name==='string'&&
    Number.isFinite(p.lat)&&Number.isFinite(p.lon))&&
   aircraft&&projected.length===points.length;
  if(evidence){
   const requested=[fmc.route.activeWaypointIndex,fmc.route.activeLegIndex,
    data.activeWaypointIndex,data.activeLegIndex].find(v=>Number.isInteger(v)&&v>=1&&v<points.length);
   const ident=fmc.route.activeWaypointIdent??data.activeWaypointIdent;
   const identified=typeof ident==='string'?
    points.findIndex((p,i)=>i>=1&&p.name===ident):-1;
   if(requested!==undefined&&points[requested].leg!=='DISCONTINUITY'){
    activeIndex=requested;activeSource='FMC_EXPLICIT';
   }else if(identified>=1&&points[identified].leg!=='DISCONTINUITY'){
    activeIndex=identified;activeSource='FMC_EXPLICIT_IDENT';
   }else if(aircraft){
    // Trainer-only leg estimate from validated geometry and FMC position.
    // Never use this estimate as aircraft AFDS/servo guidance.
    let closest=Infinity;
    for(let i=1;i<points.length;i++){
     if(points[i].leg==='DISCONTINUITY')continue;
     const prev=offsets(aircraft,points[i-1]),next=offsets(aircraft,points[i]);
     const dx=next.x-prev.x,dy=next.y-prev.y,len2=dx*dx+dy*dy;
     if(len2<=.000001)continue;
     const t=Math.max(0,Math.min(1,(-prev.x*dx-prev.y*dy)/len2));
     const x=prev.x+t*dx,y=prev.y+t*dy,d=x*x+y*y;
     if(d<closest){closest=d;activeIndex=i;activeSource='TRAINER_VERIFIED_LEG_ESTIMATE';}
    }
   }
  }
  return {source:data.source,points:projected,activeIndex,activeSource,
   centerIndex,aircraftPosition:aircraft,verified:!!evidence};
 }
 function fullNavFromRoute(src,displayRoute){
  const none={valid:false,course:null,cdi:null,waypointBearing:null,
   activeWaypoint:null,distanceNm:null,eta:null,source:null};
  const route=displayRoute||{},points=route.points;
  const fmc=src?.fmc;
  const i=route.activeIndex;
  const live=fmc?.guidance?.activeLeg,variation=src?.magneticVariationDeg,wrap=v=>((v%360)+360)%360;
  if(fmc?.operational&&fmc.failed!==true&&fmc.position?.quality==='VALID'&&fmc.guidance?.simulatorCoupled===true&&live?.ident&&Number.isFinite(live.courseTrueDeg)&&Number.isFinite(variation))return {valid:true,course:wrap(live.courseTrueDeg-variation),cdi:Number.isFinite(live.crossTrackNm)?live.crossTrackNm/2:null,crossTrackNm:live.crossTrackNm,waypointBearing:Number.isFinite(live.bearingTrueDeg)?wrap(live.bearingTrueDeg-variation):null,activeWaypoint:live.ident,distanceNm:live.distanceNm,eta:null,source:'EXECUTED_FMC_TRAINING_LEG'};
  if(!route.verified||!fmc?.operational||fmc.failed===true||
   fmc.position?.quality!=='VALID'||!Number.isFinite(src.magneticVariationDeg)||
   !Array.isArray(points)||!Number.isInteger(i)||i<1||i>=points.length||
   points[i]?.leg==='DISCONTINUITY')return none;
  const before=points[i-1],target=points[i];
  if(![before.x,before.y,target.x,target.y].every(Number.isFinite))return none;
  const dx=target.x-before.x,dy=target.y-before.y,legNm=Math.hypot(dx,dy);
  if(legNm<.01)return none;
  const norm=v=>((v%360)+360)%360;
  // Desired course is ACTIVE LEG TRACK, not selected MCP CRS1/CRS2 and
  // not the direct bearing to the fix. 10.32.9: FMC NAV 2 NM per dot.
  const trueCourse=norm(Math.atan2(dx,dy)*180/Math.PI);
  const desiredMag=norm(trueCourse-src.magneticVariationDeg);
  const signedCrossNm=(dx*(-before.y)-dy*(-before.x))/legNm;
  const bearingTrue=norm(Math.atan2(target.x,target.y)*180/Math.PI);
  const distance=Math.hypot(target.x,target.y);
  const rawEta=target.etaUtc??target.eta??null;
  const eta=typeof rawEta==='string'&&/^\d{4}(?:\.\d)?[zZ]?$/.test(rawEta)?
   rawEta.toUpperCase().replace(/Z?$/,'Z'):null;
  return {valid:true,course:desiredMag,cdi:signedCrossNm/2,
   crossTrackNm:signedCrossNm,waypointBearing:distance>.02?
    norm(bearingTrue-src.magneticVariationDeg):null,
   activeWaypoint:target.name,distanceNm:distance,eta,
   source:route.activeSource};
 }
 function positionDifference(snapshot,source){
  const fmc=source?.fmc;
  const pos=fmc?.position;
  // FCOM 10.32.22 does not state the numeric threshold here: never
  // invent a tolerance. Compare only when the FMC provides a verified
  // configured positive position-difference limit.
  const limit=fmc?.positionDifferenceLimitNm;
  if(!fmc?.operational||pos?.quality!=='VALID'||
   !(Number.isFinite(limit)&&limit>0))return [];
  const center=coordinate(pos.latitudeDeg,pos.longitudeDeg,'FMC');
  if(!center)return [];
  const chosen=source.irs===2?'R':'L';
  const out=[];
  for(const [side,topic] of [['L','irs.left'],['R','irs.right']]){
   const record=snapshot?.[topic],unit=record?.quality==='VALID'?record.value:null;
   if(unit?.powered!==true||unit.positionValid!==true)continue;
   const peer=coordinate(unit.lat,unit.lon,'IRS '+side);
   if(!peer)continue;
   const delta=offsets(center,peer),distance=Math.hypot(delta.x,delta.y);
   if(distance<=limit)continue;
   const trueBearing=((Math.atan2(delta.x,delta.y)*180/Math.PI)%360+360)%360;
   const magneticBearing=Number.isFinite(source.magneticVariationDeg)?
    ((trueBearing-source.magneticVariationDeg)%360+360)%360:null;
   out.push({side,distanceNm:distance,bearingMagDeg:magneticBearing,
    referenceSide:side===chosen});
  }
  out.sort((a,b)=>Number(b.referenceSide)-Number(a.referenceSide));
  return out;
 }
 function bind(win){
  let requested={},applied={},preset='LIVE';
  const faults={1:false,2:false};
  const notify=()=>win.dispatchEvent(new CustomEvent('b737:efis-source-change'));
  function trainingSupply(bus,voltage){
   const flight=win.B737UnifiedFlightScenarioV1;
   const cold=flight?.getDiagnostics?.()?.active===true&&flight?.getState?.()?.preset==='COLD_DARK';
   return !cold&&preset==='FULL_ALIGN'&&win.B737UnifiedBusFailureInjectionV1?.live?.isUnavailable(bus,voltage)!==true;
  }
  function applySelection(snapshot){
   const supply=win.B737UnifiedBusConsumerLiveV1;
   const bus=signal(snapshot,'electrical.buses')?.bus;
   if((supply?.getBus?.('battery','28VDC')?.powered??bus?.battery)!==true&&!trainingSupply('battery','28VDC'))return;
   const changed=['efi-transfer','irs-transfer'].some(key=>(applied[key]??'NORMAL')!==(requested[key]??'NORMAL'));
   applied={...requested};
   if(changed)win.dispatchEvent(new CustomEvent('b737:efis-transfer-ap-disconnect'));
  }
  function updateToggles(values){
   let changed=false;
   for(const [key,valid] of Object.entries(SWITCHES)){
    const next=values?.[key];
    if(valid.includes(next)&&requested[key]!==next){requested[key]=next;changed=true;}
   }
   if(changed){applySelection(win.B737UnifiedAvionicsNetworkV1?.getSnapshot?.());notify();}
  }
  win.addEventListener('b737:efis-overhead-selectors',event=>updateToggles(event.detail));
  for(const event of ['b737:bus-consumer-snapshot','b737:avionics-data'])win.addEventListener(event,e=>{
   if(event==='b737:avionics-data'&&e.detail?.topic!=='electrical.buses')return;
   applySelection(win.B737UnifiedAvionicsNetworkV1?.getSnapshot?.());
  });
  function project(seat,snapshot=win.B737UnifiedAvionicsNetworkV1?.getSnapshot?.()){
   const bus=signal(snapshot,'electrical.buses')?.bus;
   const supply=win.B737UnifiedBusConsumerLiveV1;
   const powered=(id,voltage)=>preset!=='COLD_DARK'&&
    ((supply?.getBus?.(id,voltage)?.powered??bus?.[id])===true||trainingSupply(id,voltage));
   const scenario=win.B737UnifiedFlightScenarioV1;
   const state=scenario?.getDiagnostics?.()?.active===true?
    scenario.getState?.():null;
   const scenarioPosition=state?{
    lat:state.lat,lon:state.lon,altitudeFt:state.altitudeFt,icao:state.icao}:null;
   return resolve(snapshot,seat,applied,{1:powered('electronic1','115VAC'),2:powered('electronic2','115VAC')},faults,scenarioPosition);
  }
  return Object.freeze({project,route,offsets,getPreset:()=>preset,trainingSupply,
   setPreset(value){
    if(!['FULL_ALIGN','COLD_DARK','LIVE'].includes(value))throw Error('Invalid EFIS preset');
    preset=value;
    applySelection(win.B737UnifiedAvionicsNetworkV1?.getSnapshot?.());
    win.dispatchEvent(new CustomEvent('b737:efis-preset-change',{detail:{preset}}));
    notify();
   },
   setSgFailure(n,on){if(![1,2].includes(n))throw Error('Invalid SG');faults[n]=on===true;notify();}
  });
 }
 return Object.freeze({resolve,route,fullNavFromRoute,positionDifference,offsets,bind});
});

}catch(error){queueMicrotask(()=>{throw error});}
;await 0;
;
/* ./eadi-lab-unified-v2.js?v=TCAS-CLASSIC-0001-IRAN-ILS-29L-0001-GROUND-RED-0001&amp;aero=TRN-LOW-0001&amp;fd=DIRECT-CMD-0002 */
try{
/* Unified EADI v2: cockpit mount for the new EFIS Display Lab EADI renderer.
 * Replaces the retired attitude-only painter, retaining the owner-registered
 * Captain and FO glass apertures and existing live FMA / speed-tape contracts.
 * No demo values are read from EFISDisplayLabCore.initial().
 */
(function(root){
 'use strict';
 const VERSION='UNIFIED-EADI-LAB-FULL-0006-MCP-EFIS';
 const WIDTH=900,HEIGHT=720;
 const slots=Object.freeze(['fma','speedTape','mach','localizer','glideslope',
   'radioAltitude','decisionHeight','flightDirector','tcasRA','windshear','comparators']);
 const stations={
  CAPT:{name:'Captain',x:327.20,y:218.20,w:198.00,h:159.30,
   pitch:0,bank:0,powered:null,attitudeValid:false,source:'IRS'},
  FO:{name:'First Officer',x:1612.75,y:263.40,w:173.44,h:147.14,
   pitch:0,bank:0,powered:null,attitudeValid:false,source:'IRS'}
 };
 const hooks={CAPT:new Map(),FO:new Map()};
 const screen={CAPT:null,FO:null};
 const dh={CAPT:{},FO:{}};
 let refreshScheduled=false;
 function mode(){
  return root.document.documentElement.dataset.engineIndication==='CONVENTIONAL'?'CONVENTIONAL':'EIS';
 }
 function normalized(seat){
  const key=String(seat||'').toUpperCase();
  const s=key==='CAPTAIN'?'CAPT':key==='FIRST OFFICER'||key==='FIRSTOFFICER'?'FO':key;
  if(!stations[s])throw Error('Unknown EADI seat');
  return s;
 }
 function position(seat){
  if(seat!=='FO'||mode()!=='CONVENTIONAL')return stations[seat];
  const slot=root.B737ConventionalEadiSocketV1;
  if(!slot?.nativeRect)throw Error('FO Conventional EADI glass registration unavailable');
  return slot.nativeRect;
 }
 function trackDh(seat,cp,ra,powered){
  const s=dh[seat],setting=cp?.dh??-20,count=cp?.dhResetCount??0;
  if(!powered||s.setting!==setting||s.count!==count)s.latched=false;
  else if(ra!==null&&s.previous>setting&&ra<=setting&&ra>0&&setting>=0)s.latched=true;
  s.setting=setting;s.count=count;s.previous=ra;
  return s.latched;
 }
 function paint(seat){
  const station=stations[seat],display=screen[seat];
  const renderer=root.EFISDisplayLabEadi;
  if(!display?.canvas?.isConnected)return false;
  if(typeof renderer?.renderUnifiedFull!=='function'){
   display.host.dataset.eadiError='NEW_FULL_RENDERER_MISSING';
   const ctx=display.canvas.getContext('2d');
   if(ctx){ctx.fillStyle='#000';ctx.fillRect(0,0,display.canvas.width,display.canvas.height);}
   return false;
  }
  const src=root.B737UnifiedEfisSources?.project(seat);
  if(!src)return false;
  const panel=root.B737UnifiedEFISPedestalV1;
  const cp=panel?.getState?.(seat); // DH/dimmer always belong to the receiving pilot
  const powered=root.B737UnifiedEfisSources.getPreset()!=='COLD_DARK'&&src.displayPowered===true&&src.video===true&&station.powered!==false;
  const injected=station.source==='SIMULATOR_INJECTION';
  const numeric=v=>Number.isFinite(v)?v:null;
  const radAlt=numeric(src.ra?.heightFt),front=typeof src.ils?.frontCourse==='boolean'?src.ils.frontCourse:src.frontCourse;
  const adc=src.adc;
  const smooth=root.B737UnifiedFlightDisplayMotionV1?.sample?.();
  const validSmooth=smooth?.schema==='B737_FLIGHT_SCENARIO_STATE_V1'&&
   root.B737UnifiedFlightScenarioV1?.getDiagnostics?.()?.active===true;
  // No bypass of IRS/ADC validity or an explicit pilot-attitude injection.
  const smoothAttitude=validSmooth&&!injected&&src.attitude===true;
  const smoothIas=validSmooth&&(
   numeric(adc?.iasKt)!==null||numeric(adc?.casKt)!==null);
  const originalSpeedView=root.B737UnifiedSpeedTapeV1?.getView?.(src.sourceSeat);
  let speedView=originalSpeedView;
  const activeScene=root.B737UnifiedFlightScenarioV1?.getDiagnostics?.()?.active===true?
   root.B737UnifiedFlightScenarioV1.getState?.():null;
  const lowSpeed=activeScene?.aeroEnvelope;
  // This is the exact same FCC instance driving the flight plant: not a
  // second invented director. In an active instructor scenario it wins over
  // a missing/stale avionics publish after the Railway gateway reconnects.
  const direct=activeScene?root.B737UnifiedFccFlightV1?.getDirector?.(seat):null;
  const director=direct??src.director;
  if(lowSpeed?.source==='INSTRUCTOR_AERO_PROXY_NOT_FCOM_DATA'&&
     originalSpeedView?.casKt!==null&&originalSpeedView?.casKt!==undefined){
   speedView={...originalSpeedView,trainingLowSpeed:{
    source:lowSpeed.source,stallKt:lowSpeed.stallKt,
    stickShakerKt:lowSpeed.stickShakerKt,
    minimumManeuverKt:lowSpeed.minimumManeuverKt,
    belowShaker:lowSpeed.belowShaker}};
  }
  if(smoothIas&&originalSpeedView?.casKt!=null){
   const speed=smooth.iasKt,center=Math.max(45,Math.min(420,speed)),radius=42;
   const range={minKt:center-radius,maxKt:center+radius};
   speedView={...speedView,casKt:speed,tapeCenterKt:center,range,
    lowSpeedDefault:speed<=45,
    commandedPosition:originalSpeedView.command?
      originalSpeedView.command.speedKt>range.maxKt?'ABOVE':
      originalSpeedView.command.speedKt<range.minKt?'BELOW':'ON_TAPE':null};
  }
  // Lower red stall-speed barber pole only when AIRBORNE.
  // Use the authoritative scenario state first; otherwise the existing
  // air/ground avionics owner. Never infer ground merely from low IAS.
  const airground=root.B737UnifiedAvionicsNetworkV1?.getSignal?.('aircraft.airground');
  const knownGround=typeof activeScene?.airborne==='boolean'?!activeScene.airborne:
   airground?.quality==='VALID'&&typeof airground.value?.onGround==='boolean'?airground.value.onGround:null;
  if(speedView&&typeof knownGround==='boolean')
   speedView={...speedView,inFlight:!knownGround};
  display.host.dataset.speedLowerRedBand=knownGround===true?'GROUND_HIDDEN':
   knownGround===false?'AIRBORNE_VISIBLE':'UNKNOWN';
  const painted=renderer.renderUnifiedFull(display.canvas,{
   seat,pitch:smoothAttitude?smooth.pitchDeg:injected?station.pitch:src.pitch,
   bank:smoothAttitude?smooth.bankDeg:injected?station.bank:src.bank,
   powered,attitudeValid:injected?station.attitudeValid:src.attitude,
   source:injected?station.source:'IRS '+(src.irs===1?'L':'R'),
   comparison:src.comparison,brightness:cp?.brightness.adi??1,
    selectedSpeedKt:src.mcp?.selectedSpeedKt??null,
    selectedSpeedValid:src.mcp?.powered===true,
   iasKt:smoothIas?smooth.iasKt:numeric(adc?.iasKt)??numeric(adc?.casKt),
   mach:numeric(adc?.mach),
   speedView,
   groundSpeedKt:src.groundSpeed,radioAltFt:radAlt,dhFt:cp?.dh??null,dhLatched:trackDh(seat,cp,radAlt,powered),
   ils:!!src.ils,frontCourse:front===true,
   locDeviation:front===false&&Number.isFinite(src.ils?.localizerDots)?-src.ils.localizerDots:numeric(src.ils?.localizerDots),
   gsDeviation:numeric(src.ils?.glideslopeDots),
   director,tcas:root.B737UnifiedTcasV1?.getState?.()
  });
  display.host.dataset.sg=String(src.sg);
  display.host.dataset.irs=src.irs===1?'L':'R';
   display.host.dataset.controlSeat=seat;
   display.host.dataset.controlDh=cp?.dh==null?'':String(cp.dh);
   display.host.dataset.controlBrightness=cp?.brightness?.adi==null?'':String(cp.brightness.adi);
   // Read-only MCP-to-glass traces. The real speed tape and the FMA engine
   // keep sole authority for speed bug and annunciation drawing.
   display.host.dataset.mcpSelectedSpeed=src.mcp?.selectedSpeedKt==null?'':String(src.mcp.selectedSpeedKt);
   display.host.dataset.mcpSpeedMode=src.mcp?.speedDisplayMode||'OFF';
   display.host.dataset.mcpVertical=src.mcp?.verticalMode||'';
   display.host.dataset.mcpLateral=src.mcp?.lateralMode||'';
   display.host.dataset.mcpSelectedAltitude=src.mcp?.altitudeSelectedFt==null?'':String(src.mcp.altitudeSelectedFt);
   display.host.dataset.mcpSelectedVs=src.mcp?.verticalSpeedSelectedFpm==null?'':String(src.mcp.verticalSpeedSelectedFpm);
  // Raw radio ILS front-course must be independent of aircraft HDG/TRK/MCP CRS.
  // EADI diamonds are receiver indications, NOT proof of LOC or G/S capture.
  display.host.dataset.ilsIdent=src.ils?.stationIdent||'';
  display.host.dataset.locSignalValid=String(Number.isFinite(src.ils?.localizerDots)&&front===true);
  display.host.dataset.gsSignalValid=String(Number.isFinite(src.ils?.glideslopeDots)&&front===true);
  display.host.dataset.ilsFrontCourse=String(front===true);
  display.host.dataset.fdSource=direct?'FCC_DIRECT_SAME_ENGINE':
   src.director?'AVIONICS_FCC':'NO_FCC_CUE';
  display.host.dataset.fdPitchBar=String(director?.enabled===true&&
   Number.isFinite(director?.pitchDeg));
  display.host.dataset.fdRollBar=String(director?.enabled===true&&
   Number.isFinite(director?.rollDeg));
  display.host.dataset.eadiPower=String(powered);
  display.host.dataset.eadiAttitude=String(injected?station.attitudeValid:src.attitude);
  const health=src.health||{};
  display.host.dataset.irsQuality=health.irsQuality||'UNKNOWN';
  display.host.dataset.irsPhase=health.irsPhase||'UNKNOWN';
  display.host.dataset.irsPowered=String(health.irsPowered===true);
  display.host.dataset.adcQuality=health.adcQuality||'UNKNOWN';
  display.host.dataset.radioAltQuality=health.radioAltQuality||'UNKNOWN';
  display.host.dataset.sgVideo=String(health.sgVideo===true);
  display.host.dataset.displayPowered=String(health.displayPowered===true);
  display.host.dataset.trackSource=src.trackSource||'NO TRK';
  if(painted!==true){
   display.host.dataset.eadiError='NEW_FULL_RENDER_FAILED';return false;
  }
  delete display.host.dataset.eadiError;
  display.host.dataset.eadiPainter='EFIS_LAB_FULL_0004';
  display.host.dataset.eadiPaintCount=String(
   Number(display.host.dataset.eadiPaintCount||0)+1);
  // Full lab engine paints its own live FMA and speed-tape presentation.
  // Legacy hook callbacks remain registered for source notifications but
  // MUST NOT draw the retired attitude-only / duplicate FMA or tape layers.
  return true;
 }
 function make(seat,native){
  const s=stations[seat],rect=position(seat),displayMode=mode();
  let host=native.querySelector('[data-eadi-stage1-seat="'+seat+'"]');
  if(host&&host.dataset.eadiVersion!==VERSION){host.remove();host=null;}
  if(!host){
   host=root.document.createElement('div');
   host.className='eadi-stage1-host';
   host.dataset.eadiStage1Seat=seat;
   host.dataset.eadiVersion=VERSION;
   const canvas=root.document.createElement('canvas');
   canvas.width=WIDTH;canvas.height=HEIGHT;
   canvas.className='eadi-stage1-canvas';
   canvas.setAttribute('role','img');
   canvas.setAttribute('aria-label',s.name+' 737 Classic new EADI');
   host.append(canvas);native.append(host);
  }
  const radius=seat==='FO'&&displayMode==='CONVENTIONAL'
   ?root.B737ConventionalEadiSocketV1.cornerRadius:'7% / 8%';
  Object.assign(host.style,{
   position:'absolute',left:rect.x+'px',top:rect.y+'px',
   width:rect.w+'px',height:rect.h+'px',overflow:'hidden',
   borderRadius:radius,background:'#000',pointerEvents:'none',
   userSelect:'none',zIndex:'27'
  });
  host.dataset.eadiMode=displayMode;
  host.dataset.eadiSocket=seat==='FO'&&displayMode==='CONVENTIONAL'
   ?root.B737ConventionalEadiSocketV1.VERSION:'EIS-FINAL';
  const canvas=host.querySelector('canvas');
  Object.assign(canvas.style,{display:'block',width:'100%',height:'100%',pointerEvents:'none'});
  screen[seat]={host,canvas};
  paint(seat);
 }
 function mount(){
  const native=root.document.querySelector('#region-main .region-native');
  if(!native)return false;
  for(const seat of ['CAPT','FO']){
   const current=screen[seat];
   if(!current?.host?.isConnected||current.host.parentElement!==native||
      current.host.dataset.eadiMode!==mode()){
    make(seat,native);
   }else{
    const rect=position(seat);
    // Retain the approved photo registration even after a mode transition.
    Object.assign(current.host.style,{left:rect.x+'px',top:rect.y+'px',
     width:rect.w+'px',height:rect.h+'px'});
    paint(seat);
   }
  }
  return true;
 }
 function setAttitude(seat,pitch,bank){
  const id=normalized(seat),s=stations[id];
  if(!Number.isFinite(pitch)||!Number.isFinite(bank))
   throw TypeError('EADI pitch/bank require numeric degrees');
  s.pitch=Math.max(-90,Math.min(90,Math.round(pitch*10)/10));
  s.bank=((bank%360)+540)%360-180;
  s.attitudeValid=true;s.source='SIMULATOR_INJECTION';
  paint(id);
  return {seat:id,pitch:s.pitch,bank:s.bank};
 }
 function setAttitudeValid(seat,valid){
  const id=normalized(seat);
  stations[id].attitudeValid=valid===true;paint(id);
  return stations[id].attitudeValid;
 }
 function setPower(seat,on){
  const id=normalized(seat);
  stations[id].powered=on===true;paint(id);
  return stations[id].powered;
 }
 function registerLayer(seat,id,draw){
  const key=normalized(seat);
  if(!slots.includes(id)||typeof draw!=='function')
   throw TypeError('Unregistered EADI extension');
  hooks[key].set(id,draw);paint(key);
  return ()=>{hooks[key].delete(id);paint(key);};
 }
 function snapshot(){
  return {version:VERSION,renderer:root.EFISDisplayLabEadi?.renderUnifiedFull?'EFISDisplayLabEadiFull':'MISSING',
   paints:{CAPT:Number(screen.CAPT?.host?.dataset.eadiPaintCount||0),FO:Number(screen.FO?.host?.dataset.eadiPaintCount||0)},
   mode:mode(),mounted:!!screen.CAPT?.host?.isConnected&&!!screen.FO?.host?.isConnected,
   activeGlass:{CAPT:position('CAPT'),FO:position('FO')},
   stations:Object.fromEntries(Object.entries(stations).map(([seat,s])=>
    [seat,{pitch:s.pitch,bank:s.bank,powered:s.powered,
     attitudeValid:s.attitudeValid,source:s.source}])),
   futureSlots:[...slots]};
 }
 const api=Object.freeze({version:VERSION,mount,setAttitude,setAttitudeValid,
  setPower,registerLayer,snapshot,requestPaint:scheduleLive});
 root.B737UnifiedEADI=api;
 // Compatibility only for existing live FMA / speed-tape extensions.
 // This alias NEVER loads or paints eadi-stage1-unified-v1.js.
 root.B737UnifiedEADIStage1=api;
 root.addEventListener('b737:efis-lab-eadi-ready',()=>{
  // Defer load order must not leave an empty new EADI canvas.
  if(screen.CAPT?.host?.isConnected)paint('CAPT');
  if(screen.FO?.host?.isConnected)paint('FO');
 });
 function scheduleLive(){
  if(refreshScheduled)return;
  refreshScheduled=true;
  root.requestAnimationFrame(()=>{
   refreshScheduled=false;
   for(const seat of ['CAPT','FO'])if(screen[seat]?.host?.isConnected)paint(seat);
  });
 }
 root.addEventListener('b737:avionics-data',event=>{
  if(/^(airdata\.(adc|radioAltitude)[12]|navigation\.ils[12]|afds\.director[12]|irs\.(left|right)|mcp\.state|fmc\.computed|electrical\.buses)$/.test(event.detail?.topic||''))scheduleLive();
 });
 for(const event of ['b737:tcas-state','b737:flight-presentation-frame','b737:flight-scenario-state','b737:flight-scenario-stopped','b737:bus-consumer-snapshot','b737:efis-source-change','b737:unified-efis-control','b737:mcp-afds-state'])root.addEventListener(event,scheduleLive);
 root.addEventListener('b737:cockpit-mounted',mount);
 root.addEventListener('b737:engine-indication-view',mount);
 if(root.document.readyState==='loading')
  root.document.addEventListener('DOMContentLoaded',mount,{once:true});
 else mount();
})(window);

}catch(error){queueMicrotask(()=>{throw error});}
;await 0;
;
/* ../../engine/afds/fma-mode-engine-v1.js?v=B737-FMA-LVLCHG-RETARD-0001&amp;ils=SHI-CH4-0004 */
try{
/* B737-FMA-ENGINE-0002 — 737 Classic CMD/CWS axis-aware FMA contract.
 * Grounding:
 * Sepehran FCOM 4.10.27, 4.20.4–4.20.11: mode labels, 4 columns, ARM
 * white, CWS yellow, 10 s changed-engaged highlight, conditional captures.
 * Lufthansa LAN ATA22-10/22-12: FCC owns EADI status/engagement.
 * MRG: training cross-check, not a substitute for FCC sensor status.
 *
 * MCP is an input, NOT evidence of AFDS servo engagement or LOC/GS capture.
 * This model projects supported MCP command modes, and uses explicitly
 * qualified simulated FCC observations for further modes. Do not synthesize
 * FLARE, LOC/GS, TO/GA, VNAV submodes from a mode-button click alone.
 */
(function(root,factory){
 'use strict';
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.B737FmaModeEngineV1=api;
})(typeof globalThis==='object'?globalThis:null,function(){
 'use strict';
 const VERSION='B737-FMA-ENGINE-0002-CWS-AXIS';
 const FIELDS=Object.freeze(['at','pitch','roll','afds']);
 const MODES=Object.freeze({
  at:Object.freeze(['','N1','GA','RETARD','FMC SPD','MCP SPD','THR HLD','ARM']),
  pitch:Object.freeze(['','TO/GA','V/S','ALT ACQ','ALT HOLD','VNAV SPD','VNAV PTH','MCP SPD','G/S','FLARE']),
  roll:Object.freeze(['','TO/GA','HDG SEL','VOR/LOC','LNAV']),
  afds:Object.freeze(['','CMD','FD','CWS P','CWS R','1 CH'])
 });
 const ARMED=Object.freeze({
  at:Object.freeze(['']),
  pitch:Object.freeze(['','G/S','V/S','G/S V/S','FLARE']),
  roll:Object.freeze(['','VOR/LOC']),
  afds:Object.freeze([''])
 });
 const ORIGIN=Object.freeze({
  MCP:'MCP_TRAINING_MODE_SELECTED',
  FCC:'SIMULATED_FCC_CONFIRMED',
  UNKNOWN:'POWER_OR_FCC_UNVERIFIED'
 });
 function blank(){
  const state=Object.fromEntries(FIELDS.map(k=>[k,{active:'',armed:'',origin:ORIGIN.UNKNOWN}]));
  // In the 737CL the fourth AFDS status column may carry two separate
  // YELLOW axis states at once: CWS P and CWS R. Neither is a Pitch/Roll
  // command-mode annunciation; those command fields are BLANK in CWS.
  state.afds.secondary='';
  state.afds.tertiary='';
  return state;
 }
 function assertField(field,type,value){
  const table=type==='armed'?ARMED:MODES;
  if(!table[field]?.includes(value))throw Error('Invalid FMA '+field+' '+type+': '+String(value));
  return value;
 }
 function normalized(fma){
  const state=blank();
  for(const [field,data]of Object.entries(fma||{})){
   if(!FIELDS.includes(field)||!data||typeof data!=='object')throw Error('Unknown FMA field '+field);
   for(const k of ['active','armed'])if(Object.hasOwn(data,k))state[field][k]=assertField(field,k,data[k]);
   if(Object.hasOwn(data,'origin'))state[field].origin=String(data.origin);
   if(Object.hasOwn(data,'secondary')){
    if(field!=='afds'||!['','CWS P','CWS R','1 CH'].includes(data.secondary))
     throw Error('Only AFDS column can show secondary CWS R');
    state.afds.secondary=data.secondary;
   }
   if(Object.hasOwn(data,'tertiary')){
    if(field!=='afds'||!['','CWS R'].includes(data.tertiary))
     throw Error('Only AFDS can show third-line CWS R');
    state.afds.tertiary=data.tertiary;
   }
  }
  if(state.afds.tertiary&&state.afds.secondary!=='CWS P')
   throw Error('Third-line CWS R requires second-line CWS P');
  return state;
 }
 function sourceMode(val,map){
  return typeof val==='string'&&Object.hasOwn(map,val)?map[val]:'';
 }
 function cwsAxes(output){
  // An engaged CMD autopilot has independent pitch/roll axis control.
  // FCOM 4.10.18, 4.20.9/10: absent/deselected CMD mode -> that axis CWS.
  // Do NOT infer CWS from an F/D-only blank FMA or a VNAV command whose
  // subtype is unknown. Prefer the published MCP/AFDS axis-control state.
  const m=output?.modes||{},autopilot=m.autopilot;
  const engaged=/^(?:CMD|CWS)_[AB]$/.test(autopilot||'');
  if(output?.power!==true||!engaged)return {pitch:false,roll:false};
  const manual=autopilot.startsWith('CWS_'),axis=output?.axisControl;
  return {
   pitch:manual||(axis&&['CMD','CWS'].includes(axis.pitch)
    ?axis.pitch==='CWS':m.vertical==null),
   roll:manual||(axis&&['CMD','CWS'].includes(axis.roll)
    ?axis.roll==='CWS':m.lateral==null)
  };
 }
 function applyCwsStatus(state,pitchCws,rollCws){
  if(pitchCws)state.pitch.active='';
  if(rollCws)state.roll.active='';
  // CMD stays active (green). Independent CWS status is yellow beneath it.
  state.afds.secondary=pitchCws?'CWS P':rollCws?'CWS R':
   state.afds.secondary==='1 CH'?'1 CH':'';
  state.afds.tertiary=pitchCws&&rollCws?'CWS R':'';
  return state;
 }
 function fromMcp(output,seat){
  if(seat!=='CAPT'&&seat!=='FO')throw Error('Invalid FMA seat');
  if(!output||output.schema!=='B737_MCP_AFDS_OUTPUT_V1')return null;
  const state=blank();
  if(output.power!==true)return state;
  const m=output.modes||{},ctrl=output.controls||{};
  const at=ctrl.atArm===true;
  const automaticSpeed=['ALT_HLD','VS'].includes(m.vertical)||
   output.capture?.pitch==='G/S'||output.capture?.pitch==='ALT_HOLD';
  state.at.active=at?(output.dualApproach?.retard===true?'RETARD':automaticSpeed?'MCP SPD':
   sourceMode(m.thrust,{N1:'N1',SPEED:'MCP SPD',RETARD:'RETARD',ARM:'ARM'})||'ARM'):'';
  state.at.origin=ORIGIN.MCP;
  state.pitch.active=sourceMode(output.capture?.pitch,
   {ALT_ACQ:'ALT ACQ',ALT_HOLD:'ALT HOLD','G/S':'G/S',FLARE:'FLARE'})||
   sourceMode(m.vertical,{LVL_CHG:'MCP SPD',ALT_HLD:'ALT HOLD',VS:'V/S'});
  state.roll.active=sourceMode(output.capture?.roll,{VOR_LOC:'VOR/LOC'})||
   sourceMode(m.lateral,{HDG_SEL:'HDG SEL',LNAV:'LNAV'});
  state.pitch.armed=output.dualApproach?.flareArmed===true&&
    output.dualApproach.flareEngaged!==true?'FLARE':output.armed?.pitch==='G/S'?'G/S':
   output.armed?.pitch==='V/S'?'V/S':'';
  state.roll.armed=output.armed?.roll==='VOR/LOC'?'VOR/LOC':'';
  state.pitch.origin=state.roll.origin=ORIGIN.MCP;
  // Specific NAV/vertical capture states require verified FCC observation,
  // not merely illuminated MCP switches.
  const cmd=m.autopilot==='CMD_A'||m.autopilot==='CMD_B';
  const cws=m.autopilot==='CWS_A'||m.autopilot==='CWS_B';
  state.afds.active=cmd?'CMD':
   ctrl.fd?.[seat==='CAPT'?'left':'right']===true?'FD':'';
  state.afds.origin=ORIGIN.MCP;
  if(cmd||cws){
   const axes=cwsAxes(output);
   applyCwsStatus(state,axes.pitch,axes.roll);
  }
  // After LOC capture and before verified second-channel coupling, 1 CH
  // appears yellow in the AFDS status area. It is NOT a CWS override.
  if(cmd&&output.pending?.approach&&output.nav?.loc===true&&
     output.dualApproach?.coupled!==true&&!state.afds.secondary)
   state.afds.secondary='1 CH';
  return state;
 }
 // A qualified simulated FCC observation may override a training-selected
 // mode. No inference about capture, autoland, or thrust-servo motion is
 // made from unverified MCP selections.
 function withFcc(base,observation,seat=observation?.seat){
  if(!observation)return normalized(base);
  if(observation.schema!=='B737_FMA_FCC_OBSERVATION_V1'||
   observation.confirmed!==true||observation.seat!==seat)
   throw Error('Qualified seat-specific FCC observation required');
  const state=normalized(base);
  const p=observation.fields||{};
  for(const [field,data]of Object.entries(p)){
   if(!FIELDS.includes(field)||!data||typeof data!=='object')throw Error('Invalid FCC FMA field');
   if(Object.hasOwn(data,'active'))state[field].active=assertField(field,'active',data.active);
   if(Object.hasOwn(data,'armed'))state[field].armed=assertField(field,'armed',data.armed);
   state[field].origin=ORIGIN.FCC;
  }
  // FCOM 4.20.8 FLARE armed requires dual-channel APP, LOC+G/S captured
  // and radio altitude < 1500 ft; engaged requires <= 50 ft and FCC flare
  // engagement. Observation alone must not invent the last condition.
  const flareArmed=state.pitch.armed==='FLARE',flareActive=state.pitch.active==='FLARE';
  if(flareArmed||flareActive){
   const ev=observation.evidence||{};
   if(ev.dualAp!==true||ev.locCaptured!==true||ev.gsCaptured!==true||
    !Number.isFinite(ev.radioAltitudeFt)||ev.radioAltitudeFt>=1500)
    throw Error('FLARE requires verified dual-channel LOC/GS and RA below 1500');
   if(flareActive&&!(ev.radioAltitudeFt<=50&&ev.flareEngaged===true))
    throw Error('FLARE capture requires FCC and radio-altimeter evidence');
  }
  if(state.pitch.active==='G/S'&&observation.evidence?.gsCaptured!==true)
   throw Error('G/S active requires capture observation');
  if(state.roll.active==='VOR/LOC'&&observation.evidence?.navCaptured!==true)
   throw Error('VOR/LOC active requires course capture');
  if(['VNAV SPD','VNAV PTH'].includes(state.pitch.active)&&
   observation.evidence?.fmcVerticalValid!==true)
   throw Error('VNAV submode requires valid FMC profile');
  if(state.pitch.active==='ALT ACQ'&&observation.evidence?.altAcquire!==true)
   throw Error('ALT ACQ requires AFDS acquisition evidence');
  // Qualified FCC changes to command pitch/roll modes replace CWS on that
  // axis. Force-override CWS must be explicitly supported by evidence;
  // unlike a blank F/D field it must not be invented from missing data.
  const m=observation?.evidence||{};
  const ap=observation?.autopilotMode||'';
  if(m.pitchCwsOverride===true||m.rollCwsOverride===true){
   if(!ap){
    // The MCP-only model has no physical force transducers; a declared FCC
    // pitch/roll override is allowed only with a separately authenticated
    // engaged autopilot flag in the observation.
    if(m.autopilotEngaged!==true)throw Error('CWS override needs engaged A/P evidence');
   }
   if(m.dualAp===true&&m.locCaptured===true&&m.gsCaptured===true)
    throw Error('Dual-channel APP manual CWS override disengages autopilot');
  }
  let pitchCws=m.pitchCwsOverride===true;
  let rollCws=m.rollCwsOverride===true;
  // A capture re-engages command on the newly confirmed axis, so it
  // cancels the CWS status for that axis without disturbing the other.
  const confirmedPitch=Object.hasOwn(p.pitch||{},'active')?p.pitch.active:null;
  const confirmedRoll=Object.hasOwn(p.roll||{},'active')?p.roll.active:null;
  if(confirmedPitch!==null&&confirmedPitch!=='')pitchCws=false;
  if(confirmedRoll!==null&&confirmedRoll!=='')rollCws=false;
  if(pitchCws||rollCws){
   applyCwsStatus(state,pitchCws,rollCws);
   state.afds.origin=ORIGIN.FCC;
  }
  return state;
 }
 function project(output,seat,observation){
  const base=fromMcp(output,seat);
  if(base===null)return null;
  if(output.power!==true)return base;
  const state=withFcc(base,observation,seat);
  if(observation){
   // Capturing a selected command cancels only its own CWS axis.
   const pitchCaptured=Object.hasOwn(observation.fields?.pitch||{},'active')&&
    observation.fields.pitch.active!=='';
   const rollCaptured=Object.hasOwn(observation.fields?.roll||{},'active')&&
    observation.fields.roll.active!=='';
   const axes=cwsAxes(output);
   applyCwsStatus(state,
    (axes.pitch&&!pitchCaptured)||(observation.evidence?.pitchCwsOverride===true&&!pitchCaptured),
    (axes.roll&&!rollCaptured)||(observation.evidence?.rollCwsOverride===true&&!rollCaptured));
  }
  return state;
 }
 const color=(field,mode,type='active')=>type==='armed'||(field==='at'&&mode==='ARM')?'white':
  /^(CWS P|CWS R|1 CH)$/.test(mode)?'yellow':'green';
 return Object.freeze({VERSION,FIELDS,MODES,ARMED,ORIGIN,blank,normalized,
  fromMcp,cwsAxes,applyCwsStatus,withFcc,project,color});
});

}catch(error){queueMicrotask(()=>{throw error});}
;await 0;
;
/* ./eadi-fma-four-v1.js?v=EADI-FMA-FOUR-0001 */
try{
/* EADI-FMA-FOUR-0001 | B737 Classic four-field FMA on EADI glass.
 * Layout order per B737-300/400/500 FCOM 4.20:
 * AUTOTHROTTLE, PITCH, ROLL, AUTOPILOT STATUS (left-to-right).
 * Active green, armed white; status CMD/FD green, CWS/1 CH amber.
 *
 * Four framed cells are visible on the upper black GLASS. We NEVER resize or
 * reposition locked EADI/ADI/FO photo geometry. This layer draws after the
 * 85%-size attitude picture and outside its scaled canvas transform.
 *
 * Event source: existing B737_MCP_AFDS_OUTPUT_V1 training model. Modes not
 * evidenced by the backend stay blank; no invented autopilot engagement.
 * Atomic explicit API supports later FMC/AFDS source integration. One timeout
 * per affected seat after an actual mode change for the FCOM 10-second box;
 * no repeating timers, polling, and no animation loop.
 */
(function(root,factory){
 'use strict';
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root?.document){root.B737EADIFmaFourV1=api;api.bind(root);}
})(typeof window==='object'?window:null,function(){
 'use strict';
 const VERSION='EADI-FMA-FOUR-0001';
 const FIELDS=Object.freeze(['at','pitch','roll','afds']);
 const LABELS=Object.freeze(['A/T','PITCH','ROLL','A/P']);
 const LAYOUT=Object.freeze({x:18,y:12,w:864,h:88,columnWidth:216});
 const VALID=Object.freeze({
  at:Object.freeze(['','N1','GA','RETARD','FMC SPD','MCP SPD','THR HLD','ARM']),
  pitch:Object.freeze(['','TO/GA','V/S','ALT ACQ','ALT HOLD','VNAV','VNAV SPD','VNAV PTH','MCP SPD','G/S','FLARE']),
  roll:Object.freeze(['','HDG SEL','VOR/LOC','LNAV','TO/GA','B/CRS']),
  afds:Object.freeze(['','FD','CMD','CWS P','CWS R','1 CH','SINGLE CH'])
 });
 const initial=()=>Object.fromEntries(FIELDS.map(k=>[k,{active:'',armed:'',highlightUntil:0}]));
 const seats={CAPT:initial(),FO:initial()};
 const timers={CAPT:null,FO:null};
 let host=null,ready=false,unsubscribe=[];
 const COLOR=Object.freeze({green:'#40e08a',white:'#f0f3f5',amber:'#ffd34e',
  grid:'#5d696e',caption:'#9ba9ae',ground:'#080b12'});
 function seatId(value){
  const s=String(value||'').trim().toUpperCase();
  if(s==='CAPTAIN'||s==='LEFT')return 'CAPT';
  if(s==='FIRST OFFICER'||s==='FIRSTOFFICER'||s==='RIGHT')return 'FO';
  if(s==='CAPT'||s==='FO')return s;
  throw Error('FMA seat must be CAPT or FO');
 }
 function validate(field,mode){
  if(typeof mode!=='string'||!VALID[field]?.includes(mode))throw Error('Unsupported '+field+' FMA annunciation: '+String(mode));
  return mode;
 }
 function patchState(seat,patch,now=Date.now()){
  const id=seatId(seat);
  if(!patch||typeof patch!=='object'||Array.isArray(patch))throw Error('FMA field updates required');
  if(!Number.isFinite(now))throw Error('Invalid FMA update time');
  // Validate ALL fields before mutation; a rejected source cannot partially
  // change the annunciations that pilots use to check the active mode.
  const upcoming=Object.fromEntries(FIELDS.map(k=>[k,{...seats[id][k]}]));
  let changed=false,highlighted=false;
  for(const [field,val]of Object.entries(patch)){
   if(!FIELDS.includes(field))throw Error('Unknown FMA field '+field);
   if(!val||typeof val!=='object'||Array.isArray(val))throw Error('FMA field must be a mode object');
   for(const key of Object.keys(val))if(!['active','armed'].includes(key))throw Error('Unknown FMA mode attribute '+key);
   for(const key of ['active','armed']){
    if(!Object.hasOwn(val,key))continue;
    if(key==='armed'&&field==='afds'&&val[key]!=='')throw Error('AFDS status cannot have armed mode');
    const next=validate(field,val[key]);
    if(upcoming[field][key]===next)continue;
    // Only actually engaged mode changes have a 10s outline, not stale
    // changes in armed mode and not a transition to blank.
    if(key==='active'){
     upcoming[field].highlightUntil=next?now+10000:0;
     if(next)highlighted=true;
    }
    upcoming[field][key]=next;changed=true;
   }
  }
  if(!changed)return false;
  seats[id]=upcoming;
  // The EADI render hook is invoked through a no-op future-mode refresh.
  // setAttitude re-paints but MUST preserve current pitch and bank.
  const eadi=host?.B737UnifiedEADIStage1;
  if(eadi?.requestPaint)eadi.requestPaint();
  else{
   const snap=eadi?.snapshot?.()?.stations?.[id];
   if(snap)eadi.setAttitude(id,snap.pitch,snap.bank);
  }
  if(timers[id]!==null){
   host?.clearTimeout?.(timers[id]);
   timers[id]=null;
  }
  const expiry=Math.min(...FIELDS.map(k=>upcoming[k].highlightUntil).filter(t=>t>now));
  if(Number.isFinite(expiry)&&typeof host?.setTimeout==='function'){
   timers[id]=host.setTimeout(()=>{
    timers[id]=null;
    // Exactly one repaint after 10s; no polling or repeated timer.
    const current=eadi?.snapshot?.()?.stations?.[id];
    if(eadi?.requestPaint)eadi.requestPaint();
    else if(current)eadi.setAttitude(id,current.pitch,current.bank);
   },Math.max(0,expiry-now));
  }
  return true;
 }
 function updateBoth(patch,now=Date.now()){
  // For shared engaged modes. Per-seat A/P status can be overridden in the
  // next individual call by an authoritative flight-director source.
  for(const field of Object.entries(patch))if(!FIELDS.includes(field[0]))throw Error('Unknown FMA field '+field[0]);
  patchState('CAPT',patch,now);
  patchState('FO',patch,now);
 }
 function snapshot(seat){
  if(seat!==undefined){
   const id=seatId(seat);
   return Object.freeze({version:VERSION,seat:id,fields:JSON.parse(JSON.stringify(seats[id]))});
  }
  return Object.freeze({version:VERSION,order:[...FIELDS],
   seats:{CAPT:JSON.parse(JSON.stringify(seats.CAPT)),FO:JSON.parse(JSON.stringify(seats.FO))}});
 }
 function displayMode(raw,lookup){
  return typeof raw==='string'&&Object.hasOwn(lookup,raw)?lookup[raw]:'';
 }
 function projectMcp(out,seat){
  const id=seatId(seat);
  if(!out||out.schema!=='B737_MCP_AFDS_OUTPUT_V1')return null;
  if(out.power!==true)return {at:{active:'',armed:''},pitch:{active:'',armed:''},
   roll:{active:'',armed:''},afds:{active:''}};
  const modes=out.modes||{},control=out.controls||{};
  const lateral=displayMode(modes.lateral,{HDG_SEL:'HDG SEL',LNAV:'LNAV',VOR_LOC:'VOR/LOC'});
  const vertical=displayMode(modes.vertical,{LVL_CHG:'MCP SPD',ALT_HLD:'ALT HOLD',VS:'V/S',VNAV:'VNAV'});
  const thrust=control.atArm===true?displayMode(modes.thrust,{N1:'N1',SPEED:'MCP SPD'}):'';
  const ap=displayMode(modes.autopilot,{CMD_A:'CMD',CMD_B:'CMD'});
  const fd=control.fd?.[id==='CAPT'?'left':'right']===true;
  return {
   at:{active:thrust,armed:control.atArm===true&&!thrust?'ARM':''},
   pitch:{active:vertical,armed:''},roll:{active:lateral,armed:''},
   afds:{active:ap||(fd?'FD':'')}
  };
 }
 function render(c,seat,now=Date.now()){
  const id=seatId(seat);
  c.save();
  // Entire stripe stays above the bank pointer (which starts at about y=110
  // after the 85% ADI artwork fit); do not inherit the ADI scale matrix.
  const {x,y,w,h,columnWidth}=LAYOUT;
  c.fillStyle=COLOR.ground;c.fillRect(x,y,w,h);
  c.strokeStyle=COLOR.grid;c.lineWidth=1.5;
  c.strokeRect(x+.75,y+.75,w-1.5,h-1.5);
  for(let i=1;i<4;i++){
   const sx=x+i*columnWidth;
   c.beginPath();c.moveTo(sx,y+1);c.lineTo(sx,y+h-1);c.stroke();
  }
  c.textAlign='center';c.textBaseline='middle';
  for(let i=0;i<4;i++){
   const field=FIELDS[i],entry=seats[id][field],cx=x+(i+.5)*columnWidth;
   c.font='600 16px Arial,sans-serif';c.fillStyle=COLOR.caption;
   c.fillText(LABELS[i],cx,y+14,200);
   if(entry.active){
    c.font='700 29px Arial,sans-serif';
    c.fillStyle=field==='afds'&&/^(?:CWS|1 CH|SINGLE CH)/.test(entry.active)?COLOR.amber:COLOR.green;
    c.fillText(entry.active,cx,y+47,202);
    if(entry.highlightUntil>now){
     c.strokeStyle=c.fillStyle;c.lineWidth=1.9;
     c.strokeRect(cx-94,y+29,188,37);c.strokeStyle=COLOR.grid;
    }
   }
   if(entry.armed){
    c.font='600 19px Arial,sans-serif';c.fillStyle=COLOR.white;
    c.fillText(entry.armed,cx,y+75,200);
   }
  }
  c.restore();
 }
 function applyAfds(out){
  const a=projectMcp(out,'CAPT'),b=projectMcp(out,'FO');
  if(!a||!b)return false;
  const now=Date.now();
  patchState('CAPT',a,now);patchState('FO',b,now);
  return true;
 }
 function bind(win){
  if(ready)return true;
  const eadi=win.B737UnifiedEADIStage1;
  if(!eadi?.registerLayer)return false;
  host=win;ready=true;
  for(const id of ['CAPT','FO'])
   unsubscribe.push(eadi.registerLayer(id,'fma',(canvas)=>render(canvas,id)));
  win.addEventListener('b737:mcp-afds-state',e=>applyAfds(e.detail));
  // MCP may have initialized before this late-loaded display extension.
  const initial=win.B737McpAFDSBridgeV1?.getOutput?.();
  if(initial)applyAfds(initial);
  return true;
 }
 return Object.freeze({VERSION,FIELDS,LABELS,LAYOUT,COLOR,VALID,render,
  setModes:patchState,setBoth:updateBoth,projectMcp,applyAfds,snapshot,bind});
});

}catch(error){queueMicrotask(()=>{throw error});}
;await 0;
;
/* ./eadi-fma-fcom-v2.js?v=EADI-FMA-CLEAR-CH4-0001-CMD-STACK */
try{
/* EADI-FMA-FCOM-0004-CWS-AXIS — source-grounded Classic FMA status annunciator.
 * Replaces the old 'fma' paint callback without changing EADI glass, its
 * frozen EIS geometry, the ADI 0.85 scale, or existing MCP controls.
 * FCOM D6-27370-300/400/500-SHI 4.10.27 / 4.20.4–4.20.11;
 * Lufthansa LAN ATA22-10/22-12; MRG for AFDS training context.
 * Four zones A/T | PITCH | ROLL | AFDS, THREE white separators only.
 * Green engaged, white armed/ARM, yellow CWS and 1 CH.
 * The FCOM 10-second temporary mode-change border is NOT a permanent cell.
 * All FCC captures require explicit validated simulated flight evidence.
 */
(function(root,factory){
 'use strict';
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root?.document){root.B737EADIFMAFcomV2=api;api.bind(root);}
})(typeof window==='object'?window:null,function(){
 'use strict';
 const VERSION='EADI-FMA-FCOM-0004-CWS-AXIS';
 const Core=typeof globalThis==='object'?globalThis.B737FmaModeEngineV1:null;
 const FIELDS=Object.freeze(['at','pitch','roll','afds']);
 const SECTION=Object.freeze(['A/T MODE','PITCH MODE','ROLL MODE','AFDS MODE']);
 const LAYOUT=Object.freeze({x:4,y:4,w:892,h:98,segment:223});
 const COLOR=Object.freeze({green:'#21c663',white:'#f2f2f2',yellow:'#e3c23a',black:'#000000'});
 const seats={CAPT:null,FO:null},primed={CAPT:false,FO:false},highlights={CAPT:{},FO:{}},fcc={CAPT:null,FO:null};
 const scheduled={CAPT:null,FO:null};
 let win=null,ready=false,unsubscribe=[];
 let lastMcpPower=null,lastPhysicalSource='NO_HARDWARE_SNAPSHOT',lastTrigger='INIT',lastBridgeRevision=null;
 function model(){return win?.B737FmaModeEngineV1||Core;}
 function validate(seat){if(!['CAPT','FO'].includes(seat))throw Error('FMA seat CAPT or FO required');}
 function getState(seat){validate(seat);return JSON.parse(JSON.stringify({version:VERSION,seat,
  fields:seats[seat]||model()?.blank?.(),fccObserved:!!fcc[seat]}));}
 function repaint(seat){
  const eadi=win?.B737UnifiedEADIStage1;
  if(eadi?.requestPaint){eadi.requestPaint();return;}
  const state=eadi?.snapshot?.()?.stations?.[seat];
  if(state)eadi.setAttitude(seat,state.pitch,state.bank);
 }
 function armTimer(seat,now){
  if(scheduled[seat]!==null){
   win?.clearTimeout?.(scheduled[seat]);scheduled[seat]=null;
  }
  if(!win?.setTimeout)return;
  const future=Object.values(highlights[seat]).filter(n=>n>now);
  if(!future.length)return;
  const next=Math.min(...future);
  scheduled[seat]=win.setTimeout(()=>{
   scheduled[seat]=null;
   repaint(seat);
   armTimer(seat,Date.now());
  },Math.max(1,next-now));
 }
 function accept(seat,fields,now=Date.now()){
  validate(seat);
  if(!fields)return false;
  const engine=model();
  if(!engine)throw Error('AFDS FMA model missing');
  const incoming=engine.normalized(fields);
  const firstPaint=!primed[seat];
  const prior=seats[seat]||engine.blank();
  const signature=entry=>JSON.stringify([entry.active,entry.secondary||'',entry.tertiary||'',entry.armed,entry.origin]);
  if(FIELDS.every(k=>signature(prior[k])===signature(incoming[k])))return false;
  for(const key of FIELDS){
   if(!firstPaint&&(prior[key].active!==incoming[key].active||
     (key==='afds'&&(prior[key].secondary!==incoming[key].secondary||prior[key].tertiary!==incoming[key].tertiary)))){
    // FCOM 4.10.27: 10s highlight only after an actually changed mode.
    highlights[seat][key]=incoming[key].active&&incoming[key].active!=='ARM'?now+10000:0;
   }
  }
  seats[seat]=incoming;primed[seat]=true;
  repaint(seat);armTimer(seat,now);
  return true;
 }
 // The hardware layer contains the actual A/T ARM and left/right F/D
 // switch positions, while MCP/AFDS owns the simulated powered mode state.
 // FMA must read BOTH; neither a switch click nor the illuminated test button
 // can create unverified autopilot, thrust servo, or electrical power.
 function hardwareReconciled(out){
  if(out?.schema!=='B737_MCP_AFDS_OUTPUT_V1')return out;
  const controls=out.controls||{},fd=controls.fd||{};
  const physical=win?.B737McpHardwareV1?.getState?.();
  if(!physical){lastPhysicalSource='AFDS_OUTPUT_ONLY';return out;}
  const values={AT_ARM:physical.AT_ARM,FD_LEFT:physical.FD_LEFT,FD_RIGHT:physical.FD_RIGHT};
  const valid=(id)=>id==='AT_ARM'?['OFF','ARM'].includes(values[id]):
   ['OFF','ON'].includes(values[id]);
  if(!['AT_ARM','FD_LEFT','FD_RIGHT'].every(valid)){
   lastPhysicalSource='INVALID_HARDWARE_SNAPSHOT';
   return out;
  }
  const physicalAt=values.AT_ARM==='ARM';
  const physicalFd={left:values.FD_LEFT==='ON',right:values.FD_RIGHT==='ON'};
  const changed=physicalAt!==controls.atArm||physicalFd.left!==fd.left||physicalFd.right!==fd.right;
  lastPhysicalSource=changed?'VERIFIED_PHYSICAL_SWITCH_OVERRIDE':'PHYSICAL_AFDS_MATCH';
  const bothOff=!physicalFd.left&&!physicalFd.right;
  // Never mutate the AFDS bridge's published output. All per-event
  // reconciliations are read-only snapshots of its existing mode authority.
  const modes={...out.modes};
  if(bothOff){modes.lateral=null;modes.vertical=null;modes.autopilot=null;}
  // Do not allow stale thrust modes after A/T is physically OFF.
  if(!physicalAt)modes.thrust=null;
  return {...out,
   controls:{...controls,atArm:physicalAt,fd:physicalFd},
   modes};
 }
 function projectMcp(out,trigger='AFDS_OUTPUT'){
  const engine=model();
  if(!engine||out?.schema!=='B737_MCP_AFDS_OUTPUT_V1')return false;
  const matched=hardwareReconciled(out);
  lastMcpPower=matched.power;
  lastTrigger=trigger;
  lastBridgeRevision=matched.electricalRevision??null;
  const now=Date.now();
  let changed=false;
  for(const seat of ['CAPT','FO']){
   try{
    const result=engine.project(matched,seat,fcc[seat]);
    if(result)changed=accept(seat,result,now)||changed;
   }catch(error){
    // Discard stale FCC captures when electrical/mode input conflicts.
    fcc[seat]=null;
    const conservative=engine.fromMcp(matched,seat);
    if(conservative)changed=accept(seat,conservative,now)||changed;
    win?.console?.warn?.('FMA rejected FCC observation',error.message);
   }
  }
  return changed;
 }
 function refreshFromMcp(trigger='MCP_REFRESH'){
  const out=win?.B737McpAFDSBridgeV1?.getOutput?.();
  if(!out)return false;
  return projectMcp(out,trigger);
 }
 function inspectLink(){
  const output=win?.B737McpAFDSBridgeV1?.getOutput?.()||null;
  return Object.freeze({
   version:VERSION,ready,mcpPowered:lastMcpPower,
   mcpPowerEvidence:output?.powerEvidence??null,
   electricalRevision:lastBridgeRevision,
   physical:win?.B737McpHardwareV1?.getState?.()||null,
   physicalSource:lastPhysicalSource,lastTrigger,
   seats:{CAPT:getState('CAPT').fields,FO:getState('FO').fields}
  });
 }
 function observeFcc(evidence){
  if(!evidence||evidence.schema!=='B737_FMA_FCC_OBSERVATION_V1'||
   evidence.confirmed!==true||!['CAPT','FO'].includes(evidence.seat))
   return false;
  const e=win?.B737McpAFDSBridgeV1?.getOutput?.();
  if(!e||e.power!==true)return false;
  try{
   const projected=model().project(e,evidence.seat,evidence);
   if(!projected)return false;
   fcc[evidence.seat]=evidence;accept(evidence.seat,projected);
   return true;
  }catch(error){
   win?.console?.warn?.('Unverified FMA capture ignored',error.message);
   return false;
  }
 }
 function clearFcc(){
  fcc.CAPT=null;fcc.FO=null;
  lastTrigger='FCC_MODE_CLEARED';
  return refreshFromMcp('FCC_MODE_CLEARED');
 }
 function render(ctx,seat,now=Date.now()){
  validate(seat);
  const states=seats[seat]||model()?.blank?.();
  if(!states)return;
  const {x,y,w,h,segment}=LAYOUT;
  ctx.save();
  ctx.fillStyle=COLOR.black;
  ctx.fillRect(x,y,w,h);
  ctx.strokeStyle=COLOR.white;
  ctx.lineWidth=3;
  // Exactly three continuous WHITE dividers. No permanent box outline.
  for(let i=1;i<4;i++){
   const boundary=x+i*segment;
   ctx.beginPath();ctx.moveTo(boundary,y+1);ctx.lineTo(boundary,y+h-1);ctx.stroke();
  }
  ctx.textAlign='center';ctx.textBaseline='middle';
  for(let i=0;i<4;i++){
   const field=FIELDS[i],val=states[field],cx=x+segment*(i+.5);
   if(val?.active){
    // FCOM 4.10.18: CWS P/R are YELLOW in AFDS status; corresponding
    // PITCH and ROLL command-mode fields are blank. Show two independent
    // CWS axes as two lines inside the same FOURTH status column.
    const hasCws=field==='afds'&&!!val.secondary;
    const triple=hasCws&&!!val.tertiary;
    ctx.fillStyle=COLOR[model().color(field,val.active)]||COLOR.green;
    if(hasCws){
     // Green CMD/FD above yellow CWS P/R, with three rows when needed.
     ctx.font=(triple?'700 29px ':'700 35px ')+
      "'Arial Narrow','Liberation Sans Narrow',Arial,sans-serif";
     ctx.fillText(val.active,cx,y+(triple?18:27),segment-13);
     ctx.fillStyle=COLOR.yellow;
     ctx.font=(triple?'700 24px ':'700 29px ')+
      "'Arial Narrow','Liberation Sans Narrow',Arial,sans-serif";
     ctx.fillText(val.secondary,cx,y+(triple?52:75),segment-13);
     if(triple){
      ctx.font="700 23px 'Arial Narrow','Liberation Sans Narrow',Arial,sans-serif";
      ctx.fillText(val.tertiary,cx,y+84,segment-13);
     }
    }else{
     ctx.font="700 43px 'Arial Narrow','Liberation Sans Narrow',Arial,sans-serif";
     ctx.fillText(val.active,cx,y+39,segment-13);
    }
    if(highlights[seat][field]>now){
     ctx.strokeStyle=hasCws?COLOR.yellow:ctx.fillStyle;ctx.lineWidth=1.5;
     ctx.strokeRect(cx-segment/2+8,y+(hasCws?43:15),
      segment-16,hasCws?(triple?50:43):46);
    }
   }
   if(val?.armed){
    ctx.font="700 22px 'Arial Narrow',Arial,sans-serif";
    ctx.fillStyle=COLOR.white;
    ctx.fillText(val.armed,cx,y+79,segment-15);
   }
  }
  ctx.restore();
 }
 // Reference glass layout used by both the live EADI and standalone lab.
 function renderReference(ctx,seat,metrics,glyph,now=Date.now(),fontScale=1){
  validate(seat);
  const state=seats[seat]||model()?.blank?.();
  if(!state)return;
  const {centers,dividers,dividerTop,dividerBottom,primaryY,cwsY,cwsWidth,cwsHeight}=metrics;
  const color={...COLOR,green:'#26ed36',yellow:'#e5d63e'};
  ctx.save();
  ctx.fillStyle=color.black;
  ctx.fillRect(67,36,520,49);
  ctx.fillRect(470,cwsY-cwsHeight/2-2,104,cwsHeight*2+9);
  ctx.strokeStyle=color.white;ctx.lineWidth=2;
  for(const x of dividers){
   ctx.beginPath();ctx.moveTo(x,dividerTop);ctx.lineTo(x,dividerBottom);ctx.stroke();
  }
  FIELDS.forEach((field,i)=>{
   const v=state[field],cx=centers[i];
   if(!v)return;
   const ink=color[model().color(field,v.active)]||color.green;
   if(v.active)glyph.canvas(ctx,v.active,cx,primaryY,37*fontScale,ink,'center',.74);
   if(v.armed)glyph.canvas(ctx,v.armed,cx,primaryY+32,21*fontScale,color.white,'center',.76);
   if(highlights[seat][field]>now&&v.active&&!v.secondary){
    ctx.strokeStyle=ink;ctx.lineWidth=1.7;ctx.strokeRect(cx-64,primaryY-17,128,34);
   }
   [v.secondary,v.tertiary].filter(Boolean).forEach((label,row)=>{
    const y=cwsY+row*(cwsHeight+4);
    if(highlights[seat][field]>now){
     ctx.strokeStyle=color.yellow;ctx.lineWidth=1.8;
     ctx.strokeRect(cx-cwsWidth/2,y-cwsHeight/2,cwsWidth,cwsHeight);
    }
    glyph.canvas(ctx,label,cx,y,33*fontScale,color.yellow,'center',.77);
   });
  });
  ctx.restore();
 }
 function bind(root){
  if(ready)return true;
  const eadi=root.B737UnifiedEADIStage1;
  const engine=root.B737FmaModeEngineV1;
  if(!eadi?.registerLayer||!engine?.project)return false;
  ready=true;win=root;
  for(const seat of ['CAPT','FO']){
   seats[seat]=engine.blank();
   // The EADI supports one registered fma slot. Replaces its earlier
   // boxed implementation with the FCOM presentation, no second overlay.
   unsubscribe.push(eadi.registerLayer(seat,'fma',(canvas)=>render(canvas,seat)));
  }
  root.addEventListener('b737:mcp-afds-state',event=>projectMcp(event.detail,'AFDS_EVENT'));
  // MCP AFDS bridge handles the hardware/button command before this
  // fallback listener (scripts are loaded in document order). Read its
  // resolved output immediately afterward. No timers or constant polling.
  for(const event of ['b737:mcp-hardware-change','b737:mcp-button-request',
   'b737:mcp-value-change','b737:mcp-bank-limit-preview'])
   root.addEventListener(event,()=>refreshFromMcp(event));
  // The scene can be remounted or changed between EIS/Conventional without
  // any MCP movement. The same source snapshot rehydrates both EADI FMAs.
  for(const event of ['b737:cockpit-mounted','b737:engine-indication-view',
   'b737:electrical-owner-ready','b737:cb-state-change',
   'b737:electrical-distribution-changed','b737:bus-failure-injection-changed'])
   root.addEventListener(event,()=>refreshFromMcp(event));
  root.addEventListener('b737:fma-fcc-observation',event=>observeFcc(event.detail));
  root.addEventListener('b737:fma-fcc-clear',clearFcc);
  const current=root.B737McpAFDSBridgeV1?.getOutput?.();
  if(current)projectMcp(current,'INITIAL_BRIDGE_SNAPSHOT');
  return true;
 }
 return Object.freeze({VERSION,FIELDS,SECTION,LAYOUT,COLOR,
  accept,projectMcp,refreshFromMcp,hardwareReconciled,inspectLink,observeFcc,clearFcc,render,renderReference,getState,bind});
});

}catch(error){queueMicrotask(()=>{throw error});}
;await 0;
;
/* ../../engine/efis/classic-flap-speed-profile-v1.js?v=FLAP-SPEED-PROFILE-0001 */
try{
/* B737 Classic Speed Tape — owner-provided flap visual-training schedule.
 * NOT AFM-verified. An instructor/visual detent may display TRAINING markings,
 * but must not be presented as a certified FCC/AFDS speed limit.
 * Flap 30 discrepancy: 180 kts from screenshot statement (default), 185 kts
 * from the written list (explicit alternate). Both preserve the 25kt buffer.
 */
(function(root,factory){'use strict';const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.B737ClassicFlapSpeedProfileV1=api;
})(typeof globalThis!=='undefined'?globalThis:null,function(){'use strict';
 const VERSION='FLAP-SPEED-PROFILE-0001';
 const ROWS=Object.freeze({
  1:Object.freeze({maximumKt:230,bufferKt:null}),
  2:Object.freeze({maximumKt:230,bufferKt:5}),
  5:Object.freeze({maximumKt:225,bufferKt:15}),
  10:Object.freeze({maximumKt:210,bufferKt:15}),
  15:Object.freeze({maximumKt:195,bufferKt:5}),
  25:Object.freeze({maximumKt:190,bufferKt:5}),
  30:Object.freeze({maximumKt:180,bufferKt:25}),
  40:Object.freeze({maximumKt:158,bufferKt:0})
 });
 const DETENTS=Object.freeze([0,...Object.keys(ROWS).map(Number).sort((a,b)=>a-b)]);
 function get(detent,{flap30MaximumKt=180}={}){
  const n=Number(detent);
  if(!Number.isInteger(n)||!DETENTS.includes(n))throw Error('INVALID_FLAP_DETENT');
  if(![180,185].includes(flap30MaximumKt))throw Error('INVALID_FLAP30_VARIANT');
  if(n===0)return Object.freeze({detent:0,maximumKt:null,bufferKt:null,
   bufferStartKt:null,source:'OWNER_VISUAL_TRAINING',variant:'UP'});
  const row=ROWS[n],maximumKt=n===30?flap30MaximumKt:row.maximumKt;
  return Object.freeze({detent:n,maximumKt,bufferKt:row.bufferKt,
   bufferStartKt:row.bufferKt===null?null:maximumKt-row.bufferKt,
   source:'OWNER_VISUAL_TRAINING',variant:n===30?String(flap30MaximumKt):null});
 }
 return Object.freeze({VERSION,ROWS,DETENTS,get});
});
}catch(error){queueMicrotask(()=>{throw error});}
;await 0;
;
/* ../../engine/efis/classic-speed-tape-engine-v1.js?v=SPEED-TAPE-GA-BUG-0001-TREND-20261119-GROUND-RED-0001 */
try{
/* B737 Classic EFIS Speed Tape — FCOM 10.30.13-15 / 10.40.6-8,
 * AFDS FCOM 4.10.3-6 / 4.20.32-35. Pure, event-driven training model.
 * No assumed ADC readings, performance tables, aircraft limits or certified logic.
 */
(function(root,factory){
 'use strict';
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.B737ClassicSpeedTapeEngineV1=api;
})(typeof globalThis!=='undefined'?globalThis:null,function(){
 'use strict';
 const VERSION='SPEED-TAPE-FCOM-0003',SCHEMA='B737_CLASSIC_SPEED_TAPE_STATE_V1';
 const LIMIT_KEYS=['vmoMmoCasKt','gearPlacardKt','flapPlacardKt','minimumManeuverKt',
  'stickShakerKt','minimumAfdsKt','highSpeedBuffetKt','nextFlapPlacardKt',
  'flapRetractionKt','flapsUpManeuverKt','flapBufferKt'];
 const REF_KEYS=['v1Kt','vrKt','selectedVrefKt','landingFlaps'];
 const GEAR_SPEED_LIMITS=Object.freeze({
  DOWN:Object.freeze({iasKt:320,mach:0.82}),
  EXTENDING:Object.freeze({iasKt:270,mach:0.82}),
  RETRACTING:Object.freeze({iasKt:235,mach:null})
 });
 const GEAR_STATES=['UP','DOWN','EXTENDING','RETRACTING'];
 const blankFields=keys=>Object.fromEntries(keys.map(k=>[k,null]));
 const clone=v=>JSON.parse(JSON.stringify(v));
 const isNum=v=>typeof v==='number'&&Number.isFinite(v);
 const required=(v,lo,hi,name)=>{if(!isNum(v)||v<lo||v>hi)throw Error('INVALID_'+name);return v;};
 const optional=(v,lo,hi,name)=>v===null?null:required(v,lo,hi,name);
 const within=(v)=>isNum(v)&&v>=0&&v<=600;
 // Smooth short-interval ADC derivatives to avoid tape-trend jitter from
 // sampling cadence. A real abrupt, physically implausible jump is a new
 // observation baseline, not a 10-second acceleration prediction.
 function filteredTrend(previous,cas,dt){
  if(!(dt>=.1&&dt<=10))return {acceleration:null,visible:false};
  const change=cas-previous.casKt;
  if(dt<1&&Math.abs(change)>12)return {acceleration:null,visible:false};
  const raw=change/dt;
  const old=previous.accelerationKtS;
  const alpha=dt<.75&&isNum(old)?dt/(.65+dt):1;
  const acceleration=isNum(old)?old+alpha*(raw-old):raw;
  const delta10=10*acceleration;
  const visible=previous.trendVisible?Math.abs(delta10)>=3:Math.abs(delta10)>4;
  return {acceleration,visible};
 }
 function initialState(seat='CAPT'){
  if(!['CAPT','FO'].includes(seat))throw Error('INVALID_SEAT');
  return {schema:SCHEMA,version:VERSION,seat,revision:0,commandAuthority:'AUTO',toga:{active:false,targetSpeedKt:null},adc:{quality:'UNKNOWN',casKt:null,
   pressureAltitudeFt:null,mach:null,lastMs:null,previousCasKt:null,accelerationKtS:null,trendVisible:false},
   mcp:{powered:null,displayBlank:true,selectedCasKt:null,speedDisplayMode:'IAS',source:'MCP'},
   fmc:{valid:false,commandCasKt:null,grossWeightAvailable:false,...blankFields(REF_KEYS)},
   config:{flapsPosition:null,gearExtended:null,gearState:null,inFlight:null,phase:null,flapsRetracting:null},
   limits:{valid:false,...blankFields(LIMIT_KEYS)},
   trainingFlap:null,trainingGear:null,
   failures:{speed:false,selectedSpeed:false,v1:false,speedLimit:false,mach:false}};
 }
 function transition(old,event){
  if(old?.schema!==SCHEMA||!event||typeof event.type!=='string')throw Error('INVALID_TAPE_EVENT');
  const s=clone(old),e=event;
  if(e.type==='ADC'){
   if(typeof e.valid!=='boolean')throw Error('ADC_VALIDITY_REQUIRED');
   if(e.valid){
    const cas=required(e.casKt,0,600,'CAS_KT'),ms=required(e.timeMs,0,1e15,'TIMESTAMP');
    if(s.adc.quality==='VALID'&&s.adc.lastMs!==null&&ms<=s.adc.lastMs)
     throw Error('STALE_ADC_SAMPLE');
    const previous=s.adc;
    const deltaTime=previous.lastMs===null?null:(ms-previous.lastMs)/1000;
    const trend=previous.quality==='VALID'?
     filteredTrend(previous,cas,deltaTime):{acceleration:null,visible:false};
    const acceleration=trend.acceleration,visible=trend.visible;
    s.adc={quality:'VALID',casKt:cas,pressureAltitudeFt:e.pressureAltitudeFt==null?null:
     required(e.pressureAltitudeFt,-2000,70000,'PRESSURE_ALTITUDE'),
     mach:e.mach==null?null:required(e.mach,0,1.5,'ACTUAL_MACH'),
     lastMs:ms,previousCasKt:previous.casKt,accelerationKtS:acceleration,trendVisible:visible};
   }else{
    s.adc={quality:'INVALID',casKt:null,pressureAltitudeFt:null,lastMs:null,
     previousCasKt:null,accelerationKtS:null,trendVisible:false};
   }
  }else if(e.type==='TRAINING_CAS'){
   // This is an explicitly labelled cockpit TRAINING source, not an ADC
   // sensor, and is never published to airdata.adc1/adc2 or the AFDS.
   if(e.origin!=='TRAINING_SCENARIO')throw Error('TRAINING_SOURCE_REQUIRED');
   const cas=required(e.casKt,0,600,'TRAINING_CAS');
   const ms=required(e.timeMs,0,1e15,'TRAINING_TIMESTAMP');
   if(s.adc.quality==='TRAINING'&&s.adc.lastMs!==null&&ms<=s.adc.lastMs)
    throw Error('STALE_TRAINING_SAMPLE');
   const p=s.adc,dt=p.quality==='TRAINING'&&p.lastMs!==null?(ms-p.lastMs)/1000:null;
   const trend=p.quality==='TRAINING'?
    filteredTrend(p,cas,dt):{acceleration:null,visible:false};
   const acceleration=trend.acceleration,visible=trend.visible;
   s.adc={quality:'TRAINING',casKt:cas,
    pressureAltitudeFt:e.pressureAltitudeFt==null?null:
     required(e.pressureAltitudeFt,-2000,70000,'PRESSURE_ALTITUDE'),
    mach:e.mach==null?null:required(e.mach,0,1.5,'ACTUAL_MACH'),
    lastMs:ms,previousCasKt:p.casKt,accelerationKtS:acceleration,trendVisible:visible};
  }else if(e.type==='TRAINING_CLEAR'){
   if(s.adc.quality==='TRAINING')s.adc={quality:'UNKNOWN',casKt:null,
    pressureAltitudeFt:null,mach:null,lastMs:null,previousCasKt:null,accelerationKtS:null,trendVisible:false};
  }else if(e.type==='ADC_TIMEOUT'){
   const now=required(e.nowMs,0,1e15,'TIMESTAMP');
   if(s.adc.quality==='VALID'&&s.adc.lastMs!==null&&now-s.adc.lastMs>2000)
    s.adc={quality:'UNKNOWN',casKt:null,pressureAltitudeFt:null,lastMs:null,
     previousCasKt:null,accelerationKtS:null,trendVisible:false};
  }else if(e.type==='TOGA_TARGET'){
   if(e.source!=='SIMULATED_FCC'||typeof e.active!=='boolean')
    throw Error('INVALID_TOGA_TARGET_SOURCE');
   s.toga=e.active?
    {active:true,targetSpeedKt:required(e.targetSpeedKt,0,600,'TOGA_TARGET')}:
    {active:false,targetSpeedKt:null};
  }else if(e.type==='MCP'){
   if(![true,false,null].includes(e.powered)||typeof e.displayBlank!=='boolean'||
      !['IAS','MACH'].includes(e.speedDisplayMode))throw Error('INVALID_MCP_EVIDENCE');
   s.mcp={powered:e.powered,displayBlank:e.displayBlank,
    selectedCasKt:e.selectedCasKt==null?null:required(e.selectedCasKt,0,600,'MCP_CAS'),
    speedDisplayMode:e.speedDisplayMode,source:'MCP'};
  }else if(e.type==='FMC'){
   if(typeof e.valid!=='boolean')throw Error('INVALID_FMC_EVIDENCE');
   if(!e.valid)s.fmc={valid:false,commandCasKt:null,grossWeightAvailable:false,...blankFields(REF_KEYS)};
   else{
    if(typeof e.grossWeightAvailable!=='boolean')throw Error('FMC_WEIGHT_EVIDENCE_REQUIRED');
    const f={valid:true,grossWeightAvailable:e.grossWeightAvailable,
     commandCasKt:e.commandCasKt==null?null:required(e.commandCasKt,0,600,'FMC_COMMAND')};
    for(const k of REF_KEYS)f[k]=e[k]==null?null:
     required(e[k],0,k==='landingFlaps'?40:600,'FMC_'+k);
    s.fmc=f;
   }
  }else if(e.type==='COMMAND_AUTHORITY'){
   // AUTO preserves the legacy MCP display-blanking adapter; explicit
   // authority is reserved for verified AFDS/FMC output. A blank MCP
   // window alone must not assert an FMC command without valid data.
   if(!['AUTO','MCP','FMC','NONE'].includes(e.source))
    throw Error('INVALID_COMMAND_AUTHORITY');
   s.commandAuthority=e.source;
  }else if(e.type==='CONFIG'){
   const config={...s.config};
   if(Object.hasOwn(e,'flapsPosition'))config.flapsPosition=optional(e.flapsPosition,0,40,'FLAPS');
   for(const k of ['gearExtended','inFlight','flapsRetracting']){
    if(Object.hasOwn(e,k)){
     if(![true,false,null].includes(e[k]))throw Error('INVALID_'+k);
     config[k]=e[k];
    }
   }
   if(Object.hasOwn(e,'phase')){
    if(![null,'GROUND','TAKEOFF','CLIMB','CRUISE','DESCENT','APPROACH','LANDING','GO_AROUND'].includes(e.phase))
     throw Error('INVALID_FLIGHT_PHASE');
    config.phase=e.phase;
   }
   if(Object.hasOwn(e,'gearState')){
    if(![null,...GEAR_STATES].includes(e.gearState))throw Error('INVALID_GEAR_STATE');
    config.gearState=e.gearState;
    config.gearExtended=e.gearState==='DOWN'?true:e.gearState==='UP'?false:null;
   }else if(Object.hasOwn(e,'gearExtended'))
    config.gearState=e.gearExtended===true?'DOWN':e.gearExtended===false?'UP':null;
   s.config=config;
  }else if(e.type==='LIMITS'){
   if(typeof e.valid!=='boolean')throw Error('LIMIT_VALIDITY_REQUIRED');
   if(!e.valid)s.limits={valid:false,...blankFields(LIMIT_KEYS)};
   else{
    const o={valid:true};
    for(const k of LIMIT_KEYS)o[k]=e[k]==null?null:required(e[k],0,600,'LIMIT_'+k);
    s.limits=o;
   }
  }else if(e.type==='TRAINING_FLAP_PROFILE'){
   // Pedestal detent is visually operated, not a verified aircraft sensor.
   // This signal is an independent PRESENTATION LAYER: never mutate the
   // real flap configuration, AFDS limits or aircraft speed-control bus.
   if(e.source!=='INSTRUCTOR_VISUAL_DETENT')throw Error('INVALID_TRAINING_FLAP_SOURCE');
   const detent=required(e.detent,0,40,'TRAINING_FLAP_DETENT');
   if(![0,1,2,5,10,15,25,30,40].includes(detent))
    throw Error('INVALID_TRAINING_FLAP_DETENT');
   if(detent===0){
    s.trainingFlap=null;
   }else{
    const max=required(e.maximumKt,0,600,'TRAINING_FLAP_MAX'),
     buffer=e.bufferKt==null?null:required(e.bufferKt,0,100,'TRAINING_FLAP_BUFFER');
    if(buffer!==null&&buffer>max)throw Error('INVALID_TRAINING_FLAP_BUFFER');
    s.trainingFlap={detent,maximumKt:max,bufferKt:buffer,source:e.source};
   }
  }else if(e.type==='TRAINING_GEAR_PROFILE'){
   // Instructor gear choices affect only the speed-tape visual overlay.
   // This never commands the gear, FCC, servos or ADC sensor feeds.
   if(e.source!=='INSTRUCTOR_VISUAL_GEAR')throw Error('INVALID_TRAINING_GEAR_SOURCE');
   if(e.gearState===null||e.gearState==='UNKNOWN')s.trainingGear=null;
   else{
    if(!GEAR_STATES.includes(e.gearState))throw Error('INVALID_TRAINING_GEAR_STATE');
    s.trainingGear={state:e.gearState,source:e.source};
   }
  }else if(e.type==='FAILURES'){
   for(const k of Object.keys(s.failures)){
    if(Object.hasOwn(e,k)){
     if(typeof e[k]!=='boolean')throw Error('INVALID_FAILURE_'+k);
     s.failures[k]=e[k];
    }
   }
  }else throw Error('UNKNOWN_TAPE_EVENT_'+e.type);
  s.revision+=1;return s;
 }
 function view(s){
  if(s?.schema!==SCHEMA)throw Error('INVALID_TAPE_STATE');
  const adcValid=['VALID','TRAINING'].includes(s.adc.quality)&&!s.failures.speed&&within(s.adc.casKt);
  const cas=adcValid?s.adc.casKt:null;
  // FCOM 10.40.6: ADC display defaults to 45 kt at low IAS.
  // Actual CAS remains unchanged, but presentation is clamped and magnified.
  const lowSpeedDefault=adcValid&&cas<=45;
  const tapeCenterKt=adcValid?Math.max(45,Math.min(420,cas)):null;
  const window=42;
  const range=tapeCenterKt===null?null:{minKt:tapeCenterKt-window,maxKt:tapeCenterKt+window};
  const validLimits=s.limits.valid&&!s.failures.speedLimit;
  const lim=validLimits?s.limits:blankFields(LIMIT_KEYS);
  const config=s.config;
  const maximumCandidates=[];
  const gearState=config.gearState??(config.gearExtended===true?'DOWN':config.gearExtended===false?'UP':null);
  const gearLimit=GEAR_SPEED_LIMITS[gearState]??null;
  if(within(lim.vmoMmoCasKt))maximumCandidates.push({reason:'VMO_MMO',speedKt:lim.vmoMmoCasKt});
  if(gearLimit)maximumCandidates.push({reason:'GEAR',speedKt:gearLimit.iasKt});
  if(config.flapsPosition!==null&&config.flapsPosition>0&&within(lim.flapPlacardKt))
   maximumCandidates.push({reason:'FLAPS',speedKt:lim.flapPlacardKt});
  // Unknown gear/flap configuration or an applicable missing placard must
  // never be presented as a verified safe maximum speed.
  const maxCoverage=within(lim.vmoMmoCasKt)&&
   (gearState!==null)&&
   (config.flapsPosition===0||(config.flapsPosition!==null&&within(lim.flapPlacardKt)));
  const limiting=maxCoverage&&maximumCandidates.length?
   maximumCandidates.reduce((a,b)=>a.speedKt<=b.speedKt?a:b):null;
  // A user-entered FCOM-style yellow buffer is separate from Boeing's
  // High-Speed Buffet and Next Flap Placard cues. It is not an automatic
  // speed reversion trigger and must never change AFDS command values.
  let flapBuffer=null;
  if(validLimits&&limiting?.reason==='FLAPS'&&within(lim.flapBufferKt)&&
     within(lim.flapPlacardKt)&&lim.flapBufferKt<=lim.flapPlacardKt){
   flapBuffer={lowerKt:lim.flapPlacardKt-lim.flapBufferKt,
    upperKt:lim.flapPlacardKt,bufferKt:lim.flapBufferKt,training:false};
  }
  // When the only input is a visual pedestal detent, show a clearly
  // labelled training overlay, never a certified/AFDS usable limit.
  const t=s.trainingFlap;
  const trainingFlapLimit=!s.failures.speedLimit&&!limiting&&t&&t.detent>0?
   {detent:t.detent,maximumKt:t.maximumKt,bufferKt:t.bufferKt,
    bufferStartKt:t.bufferKt===null?null:t.maximumKt-t.bufferKt,
    source:'INSTRUCTOR_VISUAL_DETENT'}:null;
  const g=s.trainingGear;
  const trainingGearLimit=!s.failures.speedLimit&&!limiting&&g&&GEAR_SPEED_LIMITS[g.state]?
   {state:g.state,maximumKt:GEAR_SPEED_LIMITS[g.state].iasKt,
    maximumMach:GEAR_SPEED_LIMITS[g.state].mach,source:g.source}:null;
  // Prefer the lower visual training limit; verified operating limits
  // retain authority. This overlay is never applied to speedProtection.
  const trainingOperatingLimit=trainingFlapLimit&&trainingGearLimit?
   (trainingFlapLimit.maximumKt<=trainingGearLimit.maximumKt?
    {...trainingFlapLimit,reason:'FLAPS'}:{...trainingGearLimit,reason:'GEAR'}):
   trainingFlapLimit?{...trainingFlapLimit,reason:'FLAPS'}:
   trainingGearLimit?{...trainingGearLimit,reason:'GEAR'}:null;
  if(!flapBuffer&&trainingFlapLimit&&trainingOperatingLimit?.reason==='FLAPS'&&
     trainingFlapLimit.bufferKt!==null)
   flapBuffer={lowerKt:trainingFlapLimit.bufferStartKt,
    upperKt:trainingFlapLimit.maximumKt,
    bufferKt:trainingFlapLimit.bufferKt,training:true};
  const f=s.fmc;
  const preferFmc=s.commandAuthority==='FMC'||
   (s.commandAuthority==='AUTO'&&s.mcp.displayBlank===true);
  const allowMcp=s.commandAuthority==='MCP'||
   (s.commandAuthority==='AUTO'&&s.mcp.displayBlank!==true);
  const commanded=s.commandAuthority!=='NONE'&&f.valid&&preferFmc&&within(f.commandCasKt)?
   {source:'FMC',speedKt:f.commandCasKt}:
   allowMcp&&s.mcp.powered===true&&!s.mcp.displayBlank&&within(s.mcp.selectedCasKt)?
   {source:'MCP',speedKt:s.mcp.selectedCasKt}:null;
  const ga=s.toga?.active===true&&within(s.toga?.targetSpeedKt)?
   {source:'TOGA_FD',speedKt:s.toga.targetSpeedKt}:null;
  const command=!s.failures.selectedSpeed&&s.commandAuthority!=='NONE'?
   (ga||commanded):null;
  let commandedPosition=null;
  if(command&&range)commandedPosition=command.speedKt>range.maxKt?'ABOVE':
   command.speedKt<range.minKt?'BELOW':'ON_TAPE';
  const validFmc=f.valid;
  const reference=(key)=>validFmc&&within(f[key])?f[key]:null;
  const marks={
   v1Kt:s.failures.v1?null:reference('v1Kt'),
   vrKt:reference('vrKt'),vrefKt:reference('selectedVrefKt'),
   flapsUpKt:config.flapsPosition===0?lim.flapsUpManeuverKt:null,
   retractKt:config.inFlight===true&&config.flapsPosition!==null&&config.flapsPosition>0&&
    ['TAKEOFF','GO_AROUND'].includes(config.phase)?lim.flapRetractionKt:null,
   nextFlapPlacardKt:config.inFlight===true&&config.flapsPosition!==null&&config.flapsPosition>0&&
    config.flapsRetracting===false&&f.valid===true&&f.landingFlaps!==null&&
    f.landingFlaps!==config.flapsPosition?
    lim.nextFlapPlacardKt:null,
   minimumManeuverKt:lim.minimumManeuverKt,stickShakerKt:lim.stickShakerKt,
   highSpeedBuffetKt:s.adc.pressureAltitudeFt!==null&&s.adc.pressureAltitudeFt>25000&&
    f.grossWeightAvailable===true?lim.highSpeedBuffetKt:null,
   maximumOperatingKt:limiting?.speedKt??null,
   trainingFlapLimit,trainingGearLimit,trainingOperatingLimit,flapBuffer
  };
  // A confirmed SPD or SPD LIM failure does not masquerade as a dead EADI.
  // No source connected (UNKNOWN) is not itself a hardware failure.
  const flags={SPD:s.failures.speed||s.adc.quality==='INVALID',
   SEL_SPD_INOP:s.failures.selectedSpeed,V1_INOP:s.failures.v1,
   SPD_LIM:s.failures.speedLimit,MACH:s.failures.mach};
  const trend=adcValid&&s.adc.trendVisible&&s.adc.accelerationKtS!==null?
   {delta10Kt:s.adc.accelerationKtS*10,
    predictedKt:cas+s.adc.accelerationKtS*10}:null;
  let effectiveTargetKt=command?.speedKt??null,limitReason=null;
  if(effectiveTargetKt!==null&&validLimits){
   if(within(lim.minimumAfdsKt)&&effectiveTargetKt<lim.minimumAfdsKt){
    effectiveTargetKt=lim.minimumAfdsKt;limitReason='MINIMUM_AFDS_SPEED';
   }
   if(limiting&&effectiveTargetKt>limiting.speedKt){
    effectiveTargetKt=limiting.speedKt;limitReason=limiting.reason;
   }
  }
  return {schema:'B737_CLASSIC_SPEED_TAPE_VIEW_V1',version:VERSION,seat:s.seat,
   revision:s.revision,quality:s.adc.quality,
   provenance:s.adc.quality==='TRAINING'?'TRAINING_SCENARIO':
    s.adc.quality==='VALID'?'SIMULATOR_ADC':'UNKNOWN',
   casKt:cas,tapeCenterKt,range,lowSpeedDefault,
   // Ground/airborne indication from CONFIG; UNKNOWN stays null.
   inFlight:config.inFlight,
   commandAuthority:s.commandAuthority,
   rollingDigitsVisible:adcValid&&cas>45,trend,command,commandedPosition,
   effectiveTargetKt,limitReason,marks,flags,
   // Advisory ONLY. No implied mode switch or authority over AFDS servos.
   speedProtection:{active:limitReason!==null,reason:limitReason,
    commandKt:command?.speedKt??null,effectiveKt:effectiveTargetKt,
    minimumKt:within(lim.minimumAfdsKt)?lim.minimumAfdsKt:null,
    maximumKt:limiting?.speedKt??null,
    limitsComplete:maxCoverage},
   maxLimitReason:limiting?.reason??null,
   gearState,gearOperatingLimitKt:gearLimit?.iasKt??null,
   gearOperatingLimitMach:gearLimit?.mach??null,
   actualMach:adcValid?s.adc.mach:null,
   gearMachLimitReached:adcValid&&gearLimit?.mach!=null&&s.adc.mach!==null&&
    s.adc.mach>=gearLimit.mach,
   trainingFlapSource:trainingFlapLimit?.source??null,
   trainingGearSource:trainingGearLimit?.source??null,
   coverage:{vmo:within(lim.vmoMmoCasKt),
    gear:gearState!==null,
    flaps:config.flapsPosition===0||(config.flapsPosition!==null&&within(lim.flapPlacardKt)),
    complete:maxCoverage}};
 }
 return Object.freeze({VERSION,SCHEMA,GEAR_SPEED_LIMITS,initialState,transition,view,LIMIT_KEYS,REF_KEYS});
});
}catch(error){queueMicrotask(()=>{throw error});}
;await 0;
})();
