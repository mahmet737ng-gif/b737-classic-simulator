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
 function bind(win){
  let requested={},applied={},preset='LIVE';
  const faults={1:false,2:false};
  const notify=()=>win.dispatchEvent(new CustomEvent('b737:efis-source-change'));
  function trainingSupply(bus,voltage){
   return preset==='FULL_ALIGN'&&win.B737UnifiedBusFailureInjectionV1?.live?.isUnavailable(bus,voltage)!==true;
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
 return Object.freeze({resolve,route,fullNavFromRoute,offsets,bind});
});
