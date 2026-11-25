(async()=>{
;
/* ./ehsi-fcom-ch1032-live-v1.js?v=FCOM1032-LIVE-0001 */
try{
/* FCOM 10.32 EHSI rule layer. Owner-supplied SEPEHRAN 737CL FCOM Vol 2.
 * This file only decorates valid flight instrument data and explicitly
 * injected instructor test cases. It never invents sensor measurements.
 */
(function(root,factory){
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root?.document)root.B737FCOM1032LiveV1=api;
})(globalThis,function(){
 'use strict';
 const NS='http://www.w3.org/2000/svg';
 const COLORS=Object.freeze({white:'#eff5f5',green:'#41f585',
  magenta:'#ef6afc',cyan:'#65edfa',amber:'#ffb748',red:'#fa4554'});
 const MODES=['MAP','CTR_MAP','FULL_NAV','EXP_NAV','FULL_VOR_ILS','EXP_VOR_ILS','PLAN'];
 function windVisible(previous,speed,valid=true){
  if(valid!==true||!Number.isFinite(speed)||speed<0)return false;
  return previous===true?speed>=4:speed>6;
 }
 function makeSeatState(){
  const wind=new Map();
  return Object.freeze({
   prepare(seat,model,valid=true){
    if(!MODES.includes(model?.mode))throw Error('INVALID_FCOM_EHSI_MODE');
    const visible=windVisible(wind.get(seat)===true,model.windSpeed,valid);
    wind.set(seat,visible);
    if(!visible){
     model.windSpeed=null;
     model.windDirection=null;
    }
    model.fcom32WindVisible=visible;
    return model;
   },
   reset(seat){if(seat===undefined)wind.clear();else wind.delete(seat)},
   isWindVisible(seat){return wind.get(seat)===true}
  });
 }
 const MSG=Object.freeze({
  courseChangeAlert:{message:'ALERT',color:'amber',modes:['EXP_NAV','FULL_NAV'],slot:'center'},
  excessData:{message:'EXCESS DATA',color:'amber',modes:['MAP','CTR_MAP','EXP_NAV','PLAN'],slot:'left'},
  rnpAdvisory:{message:'UNABLE REQD NAV PERF-RNP',color:'amber',modes:['MAP','CTR_MAP'],slot:'center'},
  terrainFailure:{message:'TERR FAIL',color:'amber',modes:MODES,slot:'left'},
  terrainPosition:{message:'TERR POS',color:'amber',modes:MODES,slot:'left'},
  terrainInhibit:{message:'TERR INHIBIT',color:'amber',modes:MODES,slot:'left'},
  terrainRangeDisagree:{message:'TERR RANGE DISAGREE',color:'amber',modes:['MAP','CTR_MAP','EXP_NAV','EXP_VOR_ILS'],slot:'center'},
  mapTerrainRangeDisagree:{message:'MAP/TERR RANGE DISAGREE',color:'amber',modes:['MAP','CTR_MAP'],slot:'center'},
  terrainTest:{message:'TERR TEST',color:'cyan',modes:MODES,slot:'right'},
  terrainAlert:{message:'TERRAIN',color:'amber',modes:MODES,slot:'right'},
  wxrWeakStatus:{message:'WXR WEAK',color:'amber',modes:MODES,slot:'left'},
  wxrAttStatus:{message:'WXR ATT',color:'amber',modes:MODES,slot:'left'},
  wxrStabStatus:{message:'WXR STAB',color:'amber',modes:MODES,slot:'left'},
  mapRangeDisagree:{message:'MAP RANGE DISAGREE',color:'amber',modes:['MAP','CTR_MAP'],slot:'center'},
  wxrRangeDisagree:{message:'WXR RANGE DISAGREE',color:'amber',modes:['MAP','CTR_MAP','EXP_NAV','EXP_VOR_ILS'],slot:'center'},
  wxrMapRangeDisagree:{message:'WXR/MAP RANGE DISAGREE',color:'amber',modes:['MAP','CTR_MAP'],slot:'center'},
  wxrModeAndTilt:{message:'',color:'green',modes:['MAP','CTR_MAP','EXP_NAV','EXP_VOR_ILS'],slot:'left'},
 });
 const allowedMode=new Set(['MAP','CTR_MAP','FULL_NAV','EXP_NAV','FULL_VOR_ILS','EXP_VOR_ILS','PLAN']);
 function resolve(model={}, evidence={}){
  const result=[];
  if(!allowedMode.has(model.mode)||model.efis?.displayPower===false||model.efis?.sgValid===false)return result;
  const push=(id,on,extras={})=>{
   const rule=MSG[id];
   if(!rule||!rule.modes.includes(model.mode)||on!==true)return;
   result.push({id,...rule,...extras});
  };
  // A verified external evidence record is mandatory for all messages.
  // This is the same rule for live systems and isolated instructor labs.
  for(const [id,rec] of Object.entries(evidence)){
   if(rec?.valid!==true)continue;
   if(id==='terrainAlert')push(id,true,{color:rec.severity==='WARNING'?'red':'amber'});
   else if(id==='wxrModeAndTilt'){
    const mode=rec.mode;
    if(!['MAP','WX','WX+T','TEST'].includes(mode))continue;
    const tilt=Number.isFinite(rec.tiltDeg)?(rec.tiltDeg>=0?'+':'')+rec.tiltDeg.toFixed(1):'';
    const gain=rec.gainCalibrated===false?'VAR/':'';
    push(id,true,{message:gain+mode+(tilt?' '+tilt:'')});
   }else push(id,true);
  }
  // Precedence: combined mismatch displaces its two constituent messages.
  const has=id=>result.some(x=>x.id===id);
  if(has('wxrMapRangeDisagree'))return result.filter(x=>!['mapRangeDisagree','wxrRangeDisagree'].includes(x.id));
  if(has('mapTerrainRangeDisagree'))return result.filter(x=>x.id!=='terrainRangeDisagree');
  return result;
 }
 // Translate only explicitly validated observables into FCOM evidence.
 // No display text is inferred from missing FMC/EGPWS/WXR data.
 function liveEvidence(model,src,snapshot={}){
  const out={};
  const set=(id,on,extra={})=>{if(on===true)out[id]={valid:true,...extra}};
  const fmc=src?.fmc;
  if(fmc?.operational===true&&fmc.failed!==true){
   set('courseChangeAlert',Number.isFinite(fmc.courseChangeSeconds)&&fmc.courseChangeSeconds>=0&&
    fmc.courseChangeSeconds<=10&&fmc.rollToNextCourse!==true&&fmc.nextWaypointSequenced!==true);
   set('rnpAdvisory',Number.isFinite(fmc.anpNm)&&Number.isFinite(fmc.requiredRnpNm)&&
    fmc.specialRnpActive===true&&fmc.anpNm>fmc.requiredRnpNm);
  }
  const wx=model?.weather;
  if(wx?.sourceQuality==='VALID'){
   set('wxrWeakStatus',wx.calibrationFault===true);
   set('wxrAttStatus',wx.attitudeStabilizationLost===true);
   set('wxrStabStatus',wx.stabilizationOff===true);
   set('wxrModeAndTilt',wx.selected===true&&wx.healthy===true,{mode:wx.mode,tiltDeg:wx.tiltDeg,
    gainCalibrated:wx.gainCalibrated!==false});
   if(wx.healthy===true){
    set('mapRangeDisagree',wx.mapRangeDisagree===true);
    set('wxrRangeDisagree',wx.wxrRangeDisagree===true);
    set('wxrMapRangeDisagree',wx.mapRangeDisagree===true&&wx.wxrRangeDisagree===true);
   }
  }
  const terrain=model?.terrain;
  if(terrain?.sourceQuality==='VALID'){
   set('terrainFailure',terrain.failed===true);
   set('terrainPosition',terrain.positionUncertain===true);
   set('terrainInhibit',terrain.inhibited===true);
   set('terrainTest',terrain.testMode===true);
   set('terrainAlert',terrain.alert==='CAUTION'||terrain.alert==='WARNING',
    {severity:terrain.alert});
   if(terrain.failed!==true){
    set('terrainRangeDisagree',terrain.rangeMismatch===true);
    set('mapTerrainRangeDisagree',terrain.rangeMismatch===true&&terrain.mapRangeMismatch===true);
   }
  }
  const performance=model?.performance;
  if(performance?.sourceQuality==='VALID')set('excessData',performance.mapRefreshBelowLimit===true);
  return out;
 }
 function draw(svg,model,evidence={}){
  if(!svg)return [];
  svg.querySelector('[data-fcom1032-layer]')?.remove();
  const messages=resolve(model,evidence);
  if(!messages.length)return messages;
  const doc=svg.ownerDocument;
  const make=(parent,tag,attrs={},value)=>{
   const element=doc.createElementNS(NS,tag);
   for(const [key,val] of Object.entries(attrs))element.setAttribute(key,String(val));
   if(value!==undefined)element.textContent=String(value);
   parent.appendChild(element);return element;
  };
  const layer=make(svg,'g',{'data-fcom1032-layer':'true','pointer-events':'none'});
  const slots={center:{x:256,y:385,dy:20,anchor:'middle'},
   left:{x:58,y:250,dy:21,anchor:'start'},
   right:{x:451,y:245,dy:21,anchor:'end'}};
  const count={center:0,left:0,right:0};
  for(const item of messages){
   const slot=slots[item.slot],i=count[item.slot]++,y=slot.y+i*slot.dy;
   // Placement zones are calibrated EHSI glass coordinates. Do not resize the
   // approved EADI/EHSI photograph or its mounting aperture.
   const line=make(layer,'text',{x:slot.x,y,fill:COLORS[item.color],
    'text-anchor':slot.anchor,'font-family':'Lucida Console,monospace',
    'font-weight':'normal','font-size':item.message.length>22?12:16,
    'data-symbol':item.id},item.message);
   make(line,'title',{},'FCOM 10.32 '+item.id);
  }
  return messages;
 }
 return Object.freeze({version:'FCOM-10.32-LIVE-0001',
  COLORS,MSG,MODES,windVisible,makeSeatState,resolve,liveEvidence,draw});
});

}catch(error){queueMicrotask(()=>{throw error});}
;await 0;
;
/* ./ehsi-unified-v1.js?v=TCAS-CLASSIC-0001-IRAN-ILS-29L-0001 */
try{
/* Photo-registered Classic EHSI for the Unified cockpit. Source adapters are read-only. */
(function(root,factory){
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root?.document)root.B737UnifiedEHSI=api.mount(root);
})(globalThis,function(){
 'use strict';
 const VERSION='UNIFIED-EHSI-0005-FCOM-1031-FULL-NAV';
 const NS='http://www.w3.org/2000/svg';
 // Apertures measured inside the source glass. Children inherit each photo's
 // existing registration, including the FO mode-specific transform and lift.
 const CAPT={parent:'[data-piece="captain"]',box:[306,250,171,210],photo:[726,661.356]};
 const FO={
  EIS:{parent:'[data-piece="fo-outer"]',box:[21,210,163,210],photo:[475,592.164]},
  CONVENTIONAL:{parent:'#fo-owner-panel-v1',box:[444,514,360,386],photo:[1286,1223]}
 };
 const TOPICS=new Set(['electrical.buses','irs.left','irs.right','mcp.state','fmc.computed',
  'airdata.adc1','airdata.adc2','navigation.vor1','navigation.vor2','navigation.dme1','navigation.dme2',
  'navigation.ils1','navigation.ils2','navigation.adf1','navigation.adf2']);
 const SEATS=['CAPT','FO'];
 const FMC_MAP_TIMEOUT_MS=27500;
 const number=v=>Number.isFinite(v)?v:null;
 function liveModel(src,setup,physical,aspect,route,failure={},fmcNav=null){
  const d=setup.ehsi,radio=d.mode.includes('VOR_ILS');
  const nav=src.ils||src.vor;
  const dme=src.dme&&(nav?.stationIdent===src.dme.stationIdent||!nav)?number(src.dme.distanceNm):null;
  const loc=number(src.ils?.localizerDots),gs=number(src.ils?.glideslopeDots);
  const mapValid=src.fmc?.operational===true&&(d.mode==='PLAN'||src.fmc.position?.quality==='VALID');
  const cdi=src.ils?loc:number(src.vor?.deviationDots);
  const fmcMode=['FULL_NAV','EXP_NAV'].includes(d.mode);
  const fmcActive=!radio&&fmcNav?.valid===true;
  return {mode:d.mode,range:d.range,heading:src.heading,track:src.track,geoTrack:src.trueTrack,
   selectedHeading:src.selectedHeading,
   course:radio?src.course:fmcActive?fmcNav.course:null,trueRef:src.trueRef,
   waypointBearing:fmcActive?fmcNav.waypointBearing:null,
   fmcNavSource:fmcActive?fmcNav.source:null,
   trueAirspeed:number(src.adc?.tasKt),groundSpeed:src.groundSpeed,bank:src.bank,
   windDirection:src.windDirection,windSpeed:src.windSpeed,
   nav:{type:radio?(src.ils?'ILS':'VOR'):'FMC',
    valid:radio?(src.ils?loc!==null:!!src.vor):fmcMode?fmcActive:mapValid,
    source:radio?(src.ils?'ILS ':'VOR ')+src.vhf:'NAV',
    frequency:radio?number(nav?.tunedFrequencyMHz):null,dme:radio?dme:null,
    cdi:radio?cdi:fmcActive?fmcNav.cdi:null,
    vnavActive:fmcActive&&src.fmc?.guidance?.vnavActive===true,
    descent:src.fmc?.guidance?.descent===true,
    vnav:fmcActive&&Number.isFinite(src.fmc?.guidance?.vnavDeviationFt)?
     src.fmc.guidance.vnavDeviationFt:null,
    activeWaypoint:fmcActive?fmcNav.activeWaypoint:null,
    activeDistanceNm:fmcActive?fmcNav.distanceNm:null,
    activeEta:fmcActive?fmcNav.eta:null,
    gsValid:(typeof src.ils?.frontCourse==='boolean'?src.ils.frontCourse:src.frontCourse)===true&&gs!==null,gsDev:gs,toFrom:src.vor?.toFrom},
   bearings:src.bearings,route,mapObjects:[],syntheticAirport:false,showSyntheticBearing:false,options:d.options,
   efis:{displayPower:src.displayPowered&&src.video,sgValid:src.video,
    headingValid:src.heading!==null,trackValid:src.track!==null,trackSource:src.trackSource,verticalFailure:failure.active,mapFailurePending:failure.mapPending,
    brightness:physical.ehsi.brightness,wxBrightness:physical.ehsi.wxBrightness,displayAspect:aspect}};
 }
 // Selecting an airport/runway in DEP/ARR provides a verified PLAN anchor.
 // MAP and CTR MAP remain aircraft-centered when a real IRS/FMC position exists.

 function referencePlanPoints(sg){
  const geometries=Object.values((sg?.modified||sg?.active)?.geometries||{});
  const order=g=>g.kind==='RUNWAY'?0:g.kind==='SID'?1:g.kind==='RTE'?2:g.kind==='STAR'?3:g.kind==='APP'?4:5;
  const list=geometries.filter(g=>g.kind!=='RUNWAY').sort((a,b)=>order(a)-order(b)).flatMap(g=>g.fixes||[]);
  const runway=geometries.find(g=>g.kind==='RUNWAY')?.fixes?.[0];
  return [runway,...list].filter(p=>p&&Number.isFinite(p.lat)&&Number.isFinite(p.lon))
    .filter((p,i,a)=>!i||p.ident!==a[i-1].ident||p.lat!==a[i-1].lat||p.lon!==a[i-1].lon);
 }

 function referenceAnchor(mode,route,aircraftPosition,flightLocation,sg,planStep=0){
  const working=sg?.modified||sg?.active;
  const runway=Object.values(working?.geometries||{}).find(g=>
   g?.kind==='RUNWAY'&&g.fixes?.some(p=>Number.isFinite(p.lat)&&Number.isFinite(p.lon)));
  const fix=runway?.fixes?.find(p=>Number.isFinite(p.lat)&&Number.isFinite(p.lon));
  const threshold=fix?{lat:fix.lat,lon:fix.lon,source:'VERIFIED_RUNWAY_THRESHOLD'}:null;
  const selected=flightLocation&&Number.isFinite(flightLocation.lat)&&Number.isFinite(flightLocation.lon)?
   flightLocation:null;
  const live=aircraftPosition&&Number.isFinite(aircraftPosition.lat)&&Number.isFinite(aircraftPosition.lon)?
   aircraftPosition:null;
  if(mode==='PLAN'){const points=referencePlanPoints(sg);return points[Math.max(0,Math.min(points.length-1,planStep||0))]??route?.points?.[route.centerIndex]??threshold??selected??live;}
  return live??selected??threshold;
 }
 function mount(win){
  const {document:doc,EFISDisplayLabCore:core,EFISClassicEHSIV2:renderer,B737UnifiedEfisSources:sources}=win;
  if(!core||!renderer||!sources)return null;
  const state={},instructor={},screens={},painted={},planCenters={};
  const fcom32=win.B737FCOM1032LiveV1;
  const fcomState=fcom32?.makeSeatState?.();
  for(const seat of SEATS){state[seat]=core.initial();state[seat].seat=seat;instructor[seat]=false;}
  let selected='CAPT',frame=0,expiry=0,fmcFailureStarted=null,fmcTimeout=0;
   win.B737UnifiedCduPlanV1=Object.freeze({getMode:seat=>state[seat]?.ehsi?.mode??null,
    setCenter(seat,point){if(!SEATS.includes(seat)||state[seat].ehsi.mode!=='PLAN')return false;
     if(point!==null&&(!point||typeof point.ident!=='string'||!Number.isFinite(point.lat)||!Number.isFinite(point.lon)||Math.abs(point.lat)>90||Math.abs(point.lon)>180))return false;
     planCenters[seat]=point?{ident:point.ident,lat:point.lat,lon:point.lon}:null;schedule();return true;},
    getCenter:seat=>planCenters[seat]?{...planCenters[seat]}:null});
  const cockpit=doc.getElementById('unifiedEfisDialog');
  function syncControls(){
   const button=doc.getElementById('unifiedEfisDemo');
   if(button){button.checked=instructor[selected];}
   win.dispatchEvent(new CustomEvent('efislab-state',{detail:state[selected]}));
  }
  function select(seat){
   if(!SEATS.includes(seat))return;
   selected=seat;syncControls();
  }
  // A change made from the top EFIS inspector also turns the virtual
  // knob for the selected receiving seat; the pedestal and glass stay synced.
  function dispatch(event){
   const paths={'eadi.dh':'dh','eadi.brightness':'adi',
    'ehsi.mode':'mode','ehsi.range':'range',
    'ehsi.brightness':'hsi','ehsi.wxBrightness':'wxInner'};
   const pedestal=win.B737UnifiedEFISPedestalV1;
   if(pedestal?.operate&&event?.type==='set'&&Object.hasOwn(paths,event.path)){
    pedestal.operate(selected,paths[event.path],event.value);
    return state[selected];
   }
   if(pedestal?.operate&&event?.type==='option'&&
      ['wxr','tfc','vorAdf','navAid','arpt','rteData','wpt'].includes(event.name)){
    pedestal.operate(selected,event.name,event.value);
    return state[selected];
   }
   state[selected]=core.apply(state[selected],event);
   syncControls();schedule();
   return state[selected];
  }
  // Same controller contract used by the standalone EFIS controls.
  win.B737EFISDisplayLab=Object.freeze({getState:()=>JSON.parse(JSON.stringify(state[selected])),dispatch});
  function showControls(){
   if(!cockpit?.open)cockpit?.showModal();
  }
  function slot(seat){
   return seat==='CAPT'?CAPT:FO[doc.documentElement.dataset.engineIndication==='CONVENTIONAL'?'CONVENTIONAL':'EIS'];
  }
  function display(seat,native){
   const placement=slot(seat),parent=native.querySelector(placement.parent);
   if(!parent)return null;
   const existing=screens[seat];
   if(existing?.host.parentNode===parent)return existing;
   existing?.host.remove();
   const host=doc.createElement('div'),svg=doc.createElementNS(NS,'svg');
   const [x,y,w,h]=placement.box,[pw,ph]=placement.photo;
   host.dataset.unifiedEhsiSeat=seat;
   host.className='unified-ehsi-glass';
   Object.assign(host.style,{left:100*x/pw+'%',top:100*y/ph+'%',width:100*w/pw+'%',height:100*h/ph+'%'});
   svg.id='unifiedEhsi'+seat;svg.setAttribute('role','img');
   host.append(svg);parent.append(host);
   delete painted[seat];
   return screens[seat]={host,svg,aspect:w/h};
  }
  function trackExpiry(snapshot){
   if(expiry)win.clearTimeout(expiry);
   expiry=0;
   // Expiry does not emit a network event. Wake only for the next valid
   // external packet deadline, using the network's own registered TTL.
   const catalog=win.B737AvionicsDataNetworkV1?.CATALOG,now=Date.now();
   const deadlines=[...TOPICS]
    .filter(topic=>/^(airdata|navigation)\./.test(topic)&&snapshot?.[topic]?.quality==='VALID')
    .map(topic=>snapshot[topic].receivedAtMs+catalog?.[topic]?.ttl)
    .filter(deadline=>Number.isFinite(deadline));
   if(deadlines.length)expiry=win.setTimeout(schedule,Math.max(1,Math.min(...deadlines)-now+1));
  }
  function fmcFailure(snapshot){
   const record=snapshot?.['fmc.computed'];
   const active=record?.quality==='VALID'&&record.value?.failed===true;
   if(!active){
    fmcFailureStarted=null;
    if(fmcTimeout)win.clearTimeout(fmcTimeout);
    fmcTimeout=0;
    return {active:false,mapPending:false};
   }
   if(fmcFailureStarted===null){
    fmcFailureStarted=Date.now();
    fmcTimeout=win.setTimeout(()=>{fmcTimeout=0;schedule();},FMC_MAP_TIMEOUT_MS);
   }
   return {active:true,mapPending:Date.now()-fmcFailureStarted<FMC_MAP_TIMEOUT_MS};
  }
  function refresh(){
   const native=doc.querySelector('#region-main .region-native');
   if(!native)return;
   const snapshot=win.B737UnifiedAvionicsNetworkV1?.getSnapshot?.();
   trackExpiry(snapshot);
   const failure=fmcFailure(snapshot);
   const diagnostics=[];
   const sg=win.B737CduSgRouteV1?.snapshot();
   const reference=win.B737CduSgEHSIPreviewV1;
    const scenario=win.B737UnifiedFlightScenarioV1;
    const scenarioState=scenario?.getDiagnostics?.().active===true?
     scenario.getState?.():null;
    const trajectoryFlight=scenarioState?.icao===sg?.origin?scenarioState:null;
   for(const seat of SEATS){
    const screen=display(seat,native);
    if(!screen)continue;
    const setup=state[seat],preview=instructor[seat]&&sources.getPreset()!=='COLD_DARK';
    const src=sources.project(seat,snapshot),origin=state[seat]; // knobs belong to receiving seat regardless of SG transfer
    if(src.heading!==null&&src.displayPowered){
     const gauges=win.B737UnifiedFlightNeedles;
     const station=seat==='CAPT'?'captain':'firstOfficer';
     const last=gauges?.getAngles()?.[station];
     for(const pointer of src.bearings){
      const angle=((pointer.angle-src.heading+540)%360)-180,key='rmi'+pointer.channel;
      if(last?.[key]!==angle)gauges?.setAngle(station,key,angle);
     }
    }
    const planCenter=origin.ehsi.mode==='PLAN'?planCenters[seat]:null;
     const nativePoints=src.fmc?.route?.displayRoute?.points||[];
     const matching=planCenter?nativePoints.findIndex(p=>(p.name??p.ident)===planCenter.ident&&Math.abs(p.lat-planCenter.lat)<.0001&&Math.abs(p.lon-planCenter.lon)<.0001):-1;
     const route=sources.route(src.fmc,origin.ehsi.mode,matching>=0?matching:origin.ehsi.planStep);
     // Both the executed route and source overlay must project from the exact CDU review fix.
     if(planCenter){route.points=route.points.map(p=>({...p,...sources.offsets(planCenter,p)}));route.centerAnchor={x:0,y:0};}
    const fmcNav=sources.fullNavFromRoute?.(src,route);
    const model=preview?core.ehsiModel(setup):
     liveModel(src,origin,setup,screen.aspect,route,failure,fmcNav);
    if(!preview)model.positionDifferences=sources.positionDifference?.(snapshot,src)||[];
    if(!preview)fcomState?.prepare(seat,model,Number.isFinite(src.windSpeed)&&
     Number.isFinite(src.windDirection));
    if(!preview){
     const tcas=win.B737UnifiedTcasV1?.getState?.();
     if(tcas)model.traffic={...tcas,targets:(tcas.targets||[]).map(t=>({...t,
      bearing:Number.isFinite(t.bearing)&&Number.isFinite(src.magneticVariationDeg)?
       ((t.bearing-src.magneticVariationDeg)%360+360)%360:null}))};
    }
    // Shared flight-position reference is an instructor chart anchor,
    // not automatically a valid aligned IRS NAV solution.
    const location=win.B737UnifiedFlightLocationV1;
    const chosen=location?.getLocation?.();
    const center=planCenter||chosen||src.mapPosition; // PLAN uses the same center as LEGS
    if(!preview&&location&&center&&['MAP','CTR_MAP','PLAN'].includes(origin.ehsi.mode)){
     const extra=[],vor=src.vor;
     if(vor?.stationIdent&&Number.isFinite(vor.stationLat)&&Number.isFinite(vor.stationLon))
      extra.push({type:'VOR',ident:vor.stationIdent,lat:vor.stationLat,lon:vor.stationLon});
     // Chapter 10.32.16: off-route WPTs are eligible only at 10/20/40 NM.
     const opts={...origin.ehsi.options,wpt:origin.ehsi.options.wpt&&origin.ehsi.range<=40};
     model.mapObjects=location.mapObjects(center,opts,origin.ehsi.range,extra)
      .filter(p=>p.shape!=='nav'||origin.ehsi.range<=40||p.highAltitude===true);
     // Chapter 10.32.12: tuned VHF navaids are green, even when NAV AID is OFF.
     // Both radio channels are independently received and quality-gated.
     for(const channel of [1,2]){
      const record=snapshot?.['navigation.vor'+channel];
      const tuned=record?.quality==='VALID'?record.value:null;
      if(!tuned?.stationIdent||!Number.isFinite(tuned.stationLat)||!Number.isFinite(tuned.stationLon))continue;
      const offset=sources.offsets(center,{lat:tuned.stationLat,lon:tuned.stationLon});
      const distance=Math.hypot(offset.x,offset.y);
      if(distance>.98*origin.ehsi.range||distance<.03)continue;
      model.mapObjects=model.mapObjects.filter(p=>!(p.shape==='nav'&&p.name===tuned.stationIdent));
      model.mapObjects.push({name:tuned.stationIdent,x:offset.x,y:offset.y,on:true,
       shape:'nav',tuned:true,channel});
     }
     // Preview landmarks around a selected point before IRS alignment.
     // Real IRS positionValid and navigation quality remain unchanged.
     if(chosen||src.mapPosition)model.nav.valid=true; // Chart landmarks need a valid map anchor, not an FMC route
    }
    screen.host.dataset.sg=String(src.sg);
    screen.host.dataset.irs=src.irs===1?'L':'R';
    screen.host.dataset.controlSeat=seat;
    screen.host.dataset.controlMode=origin.ehsi.mode;
    screen.host.dataset.controlRange=String(origin.ehsi.range);
    // Selected HDG is shared MCP, selected CRS follows SG 1 or SG 2 and
    // the COURSE 2 battery feed (not a fabricated localizer capture).
    screen.host.dataset.mcpHeadingBug=src.selectedHeading==null?'':String(src.selectedHeading);
    screen.host.dataset.mcpHeadingReference=src.headingReferenceSource||'UNAVAILABLE';
    screen.host.dataset.magneticDisplay='true';
    screen.host.dataset.magneticVariationDeg=Number.isFinite(src.magneticVariationDeg)?
     src.magneticVariationDeg.toFixed(3):'';
    screen.host.dataset.headingMagnetic=Number.isFinite(src.heading)?String(src.heading):'';
    screen.host.dataset.trackMagnetic=Number.isFinite(src.track)?String(src.track):'';
    screen.host.dataset.mcpCourse=src.course==null?'':String(src.course);
    screen.host.dataset.mcpHeadingPower=String(src.mcp?.powered===true);
    screen.host.dataset.mcpCourse2Power=String(src.mcp?.course2Powered===true);
     screen.host.dataset.fullNavActiveWaypoint=model.nav?.activeWaypoint||'';
     screen.host.dataset.fullNavCourse=Number.isFinite(model.course)?String(model.course):'';
     screen.host.dataset.fullNavCdi=Number.isFinite(model.nav?.cdi)?String(model.nav.cdi):'';
     screen.host.dataset.fullNavEvidence=model.fmcNavSource??'UNAVAILABLE';
    const h=src.health||{};
    diagnostics.push(seat+' · SG '+src.sg+
     ' · IRS '+(h.irsPowered?'PWR':'NO PWR')+'/'+h.irsPhase+
     ' · ATT '+(h.attitudeValid?'VALID':'INVALID')+
     ' · TRK '+(h.trackDisplayValid?'VALID':'INVALID')+
     ' · ADC '+h.adcQuality+' · RA '+h.radioAltQuality+
     ' · EFIS '+(h.displayPowered?'PWR':'NO PWR')+
     ' · SG VIDEO '+(h.sgVideo?'OK':'FAIL')+
     ' · '+(src.fmc?.operational?'FMC ON':'FMC UNAVAILABLE'));
    model.efis.displayAspect=screen.aspect;
    const signature=JSON.stringify(model);
    if(painted[seat]!==signature){
     renderer.render(screen.svg,model);
     painted[seat]=signature;
    }
    // Chapter 10.32 fault/status annunciations require explicit verified
    // source values. Instructor preview is independent of flight instruments.
    if(!preview)fcom32?.draw(screen.svg,model,fcom32.liveEvidence(model,src,snapshot));
    else screen.svg.querySelector('[data-fcom1032-layer]')?.remove();
    // Course and VOR/ADF overlays use valid avionics packets only; this
    // additive layer does not modify the owner-approved EHSI photo geometry.
    const flightPos=scenarioState&&Number.isFinite(scenarioState.lat)&&
     Number.isFinite(scenarioState.lon)?scenarioState:null;
    if(!preview&&src.displayPowered===true&&src.video===true&&src.track!==null)
     win.B737UnifiedEhsiRadioOverlayV1?.draw(screen.svg,model,src,
      snapshot,flightPos||src.mapPosition,renderer);
    else screen.svg.querySelector('[data-radio-nav-overlay]')?.remove();
    const mode=origin.ehsi.mode;
    // PLAN can be reviewed before position/track is available. MAP remains
    // aircraft-centered, including when the source is the selected IRS.
    const anchor=planCenter||referenceAnchor(mode,route,src.mapPosition,
      win.B737UnifiedFlightLocationV1?.getLocation?.(),sg,origin.ehsi.planStep);
    // The reviewed runway is the reference origin in PLAN. Do not subtract
     // the unrelated FMC route's selected center waypoint a second time.
     const project=mode==='PLAN'?
      renderer.routeProjection({...model,route:{...model.route,points:[],centerIndex:0}}):
      Number.isFinite(src.trueTrack)?renderer.routeProjection(model):null;
    reference?.draw(screen.svg,sg,mode,origin.ehsi.range,
     src.displayPowered===true&&src.video===true&&!preview,sources.offsets,project,anchor,trajectoryFlight);
    // HOLD overlay uses the same projection/clip as the selected seat's route.
    screen.svg.querySelector('[data-fmc-holding]')?.remove();
    const guidance=win.B737FmcTrainingGuidanceV1,session=win.B737UnifiedFmc?.snapshot?.();
    if(guidance&&session&&anchor&&project&&['MAP','CTR_MAP','PLAN'].includes(mode)&&src.displayPowered===true&&src.video===true&&!preview){
     const ns='http://www.w3.org/2000/svg',g=doc.createElementNS(ns,'g');g.setAttribute('data-fmc-holding','true');
     const rangeId=(screen.svg.id||'ehsi')+'-route-range',plotId=(screen.svg.id||'ehsi')+'-plot';
     g.setAttribute('clip-path','url(#'+(screen.svg.querySelector('[id="'+rangeId+'"]')?rangeId:plotId)+')');
     const flight=scenarioState||{},live=win.B737UnifiedFccFlightV1?.getFmcGuidance?.()?.hold;
     const draw=(hold,key,mod)=>{
      if(!hold||!Number.isFinite(hold.inbound)||!Number.isFinite(hold.lat)||!Number.isFinite(hold.lon)||!['L','R'].includes(hold.dir))return;
      let points=!mod&&live?.key===key&&live.active?live.points:null;
      if(!points){const variation=win.B737CduSgBridgeV1?.magneticVariation?.(hold),gs=hold.speed??flight.gsKt??src.fmc?.motion?.gsKt;
       const altitude=flight.altitudeFt??src.fmc?.airData?.pressureAltitudeFt;
       if(!Number.isFinite(variation)||!Number.isFinite(gs)||gs<=0||!Number.isFinite(altitude))return;
       points=guidance.holdGeometry({...hold,hold},hold.inbound+variation,gs,altitude,20);}
      const xy=points.map(p=>{const o=sources.offsets(anchor,p);return project(o.x,o.y);});
      if(!xy.every(p=>p.every(Number.isFinite)))return;
      const path=doc.createElementNS(ns,'polyline');path.setAttribute('points',xy.map(p=>p.map(v=>v.toFixed(2)).join(',')).join(' '));path.setAttribute('fill','none');path.setAttribute('stroke',mod?'#65edfa':'#ef6afc');path.setAttribute('stroke-width','2');if(mod)path.setAttribute('stroke-dasharray','7 5');g.appendChild(path);
     };
     for(let i=1;i<=5;i++){const key='HOLD_'+i;for(const [bank,mod] of [[session.active,false],[session.pending,true],[session.stagedRoute,true]]){try{const hold=JSON.parse(bank?.[key]);if(hold.origin===(mod?(session.pending?.ORIGIN??session.stagedRoute?.ORIGIN??session.active?.ORIGIN):session.active?.ORIGIN)&&hold.dest===(mod?(session.pending?.DEST??session.stagedRoute?.DEST??session.active?.DEST):session.active?.DEST))draw(hold,key,mod);}catch(_){}}}
     const parser=win.B737RouteEngine?.publishedHold;
     if(parser){for(const [bank,mod] of [[sg?.active,false],[sg?.modified,true]]){if(!bank)continue;const origin=mod?(session.pending?.ORIGIN??session.stagedRoute?.ORIGIN??session.active?.ORIGIN):session.active?.ORIGIN,dest=mod?(session.pending?.DEST??session.stagedRoute?.DEST??session.active?.DEST):session.active?.DEST;for(const geometry of Object.values(bank.geometries||{})){for(const [i,raw] of (geometry.program?.input?.legs||[]).entries()){const h=parser(raw,geometry,i,origin,dest);if(!h)continue;let override=null;try{override=JSON.parse(mod?(session.pending?.[h.key]??session.stagedRoute?.[h.key]??session.active?.[h.key]):session.active?.[h.key]);}catch(_){}if(override?.deleted!==true)draw({...h,...override},h.key,mod);}}}}
     if(g.childNodes.length)screen.svg.appendChild(g);
    }
    screen.host.dataset.input=preview?'INSTRUCTOR':'UNIFIED';
   }
   const output=doc.getElementById('unifiedEfisSources');
   const status=diagnostics.join(' / ');
   if(output&&output.textContent!==status)output.textContent=status;
  }
  function schedule(){
   if(frame)return;
   frame=win.requestAnimationFrame(()=>{frame=0;refresh();});
  }
  // Two independent raster control panels installed on CAPT/FO pedestal.
  // Keep the existing EFIS modal, EHSI render owner, and avionics feed intact.
  win.addEventListener('b737:unified-efis-control',event=>{
   const d=event.detail||{},seat=d.seat,p=d.state;
   if(!SEATS.includes(seat)||!p||!state[seat])return;
   const x=state[seat];
   if(core.MODES.includes(p.mode)){if(p.mode!=='PLAN')delete planCenters[seat];x.ehsi.mode=p.mode;}
   if(core.RANGES.includes(p.range))x.ehsi.range=p.range;
   if(Number.isFinite(p.dh))x.eadi.dh=Math.max(-20,Math.min(999,Math.trunc(p.dh)));
   if(p.brightness){
    for(const [kind,target] of [['adi',x.eadi],['hsi',x.ehsi],['wxInner',x.ehsi]]){
     const value=p.brightness[kind];
     if(!Number.isFinite(value))continue;
     target[kind==='adi'||kind==='hsi'?'brightness':'wxBrightness']=Math.max(0,Math.min(1,value));
    }
   }
   for(const key of ['wxr','tfc','vorAdf','navAid','arpt','rteData','wpt'])
    if(typeof p.options?.[key]==='boolean')x.ehsi.options[key]=p.options[key];
   x.eadi.dhResetCount=p.dhResetCount;
   if(selected===seat)syncControls();
   schedule();
  });
  for(const id of ['unifiedEfisOpen','unifiedEfisHeader'])doc.getElementById(id)?.addEventListener('click',showControls);
  win.B737CduSgRouteV1?.subscribe?.(()=>schedule());
  win.addEventListener('b737:efis-preset-change',()=>{
   for(const seat of SEATS)instructor[seat]=false;
   syncControls();
   schedule();
  });
  doc.getElementById('unifiedEfisPhysical')?.addEventListener('click',()=>{
   cockpit.close();win.B737UnifiedEFISPedestalV1?.open?.(selected);
  });
  for(const dir of [-1,1])doc.getElementById(dir<0?'unifiedPlanPrev':'unifiedPlanNext')?.addEventListener('click',()=>{
   const src=sources.project(selected),setup=state[selected];
   const length=referencePlanPoints(win.B737CduSgRouteV1?.snapshot()).length||src.fmc?.route?.displayRoute?.points?.length||0;
   if(!length||setup.ehsi.mode!=='PLAN')return;
   const request={seat:selected,dir,handled:false};win.dispatchEvent(new CustomEvent('b737:cdu-plan-step',{detail:request}));
    if(!request.handled){delete planCenters[selected];setup.ehsi.planStep=Math.max(0,Math.min(length-1,setup.ehsi.planStep+dir));}
   schedule();
  });
  doc.getElementById('unifiedEfisClose')?.addEventListener('click',()=>cockpit.close());
  doc.getElementById('unifiedEfisSeat')?.addEventListener('change',e=>select(e.target.value));
  doc.getElementById('unifiedEfisDemo')?.addEventListener('change',e=>{
   instructor[selected]=e.target.checked;schedule();
  });
  doc.getElementById('unifiedFmcFail')?.addEventListener('change',e=>win.B737FmcSystemsBridgeV1?.setFailure?.(e.target.checked));
  for(const n of [1,2])doc.getElementById('unifiedSg'+n+'Fail')?.addEventListener('change',e=>sources.setSgFailure(n,e.target.checked));
  for(const event of ['b737:tcas-state','b737:efis-source-change','b737:cockpit-mounted','b737:engine-indication-view','b737:bus-consumer-snapshot','b737:mcp-afds-state','b737:flight-location-reference','b737:flight-scenario-state'])win.addEventListener(event,schedule);
  win.addEventListener('b737:avionics-data',e=>{if(TOPICS.has(e.detail?.topic))schedule();});
  schedule();
  return Object.freeze({version:VERSION,refresh,getSeatState:seat=>SEATS.includes(seat)?JSON.parse(JSON.stringify(state[seat])):null,getDisplay:seat=>SEATS.includes(seat)&&screens[seat]?.host?.isConnected?{seat:screens[seat].host.dataset.controlSeat,mode:screens[seat].host.dataset.controlMode,range:Number(screens[seat].host.dataset.controlRange),
     mcpHeadingBug:screens[seat].host.dataset.mcpHeadingBug===''?null:Number(screens[seat].host.dataset.mcpHeadingBug),
     mcpCourse:screens[seat].host.dataset.mcpCourse===''?null:Number(screens[seat].host.dataset.mcpCourse),
     mcpPower:screens[seat].host.dataset.mcpHeadingPower==='true',
     mcpHeadingReference:screens[seat].host.dataset.mcpHeadingReference,
     displayReference:'MAGNETIC',
     routeReference:screens[seat].svg.querySelector('[data-cdu-sg-reference]')?.getAttribute('data-route-state')??null,
     magneticVariationDeg:screens[seat].host.dataset.magneticVariationDeg===''?null:
      Number(screens[seat].host.dataset.magneticVariationDeg),
     headingMagneticDeg:screens[seat].host.dataset.headingMagnetic===''?null:
      Number(screens[seat].host.dataset.headingMagnetic),
     trackMagneticDeg:screens[seat].host.dataset.trackMagnetic===''?null:
      Number(screens[seat].host.dataset.trackMagnetic),
     mcpCourse2Power:screens[seat].host.dataset.mcpCourse2Power==='true'}:null});
 }
 return Object.freeze({VERSION,liveModel,mount,referenceAnchor});
});

}catch(error){queueMicrotask(()=>{throw error});}
;await 0;
;
/* ./efis-training-presets-v1.js?v=EFIS-PRESETS-DEFAULT-FULL-0002 */
try{
/* Instructor shortcuts for the shared IRS trainer and EFIS source selector. */
(function(root,factory){
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root.document)api.install(root);
})(globalThis,function(){
 'use strict';
 const SIDES=['L','R'];
 // Existing IRS test lab's Tehran training datum, rounded to ISDU precision.
 const DEFAULT_POSITION='N35395 E051254';
 function formatPosition({lat,lon}){
  const field=(value,width,positive,negative)=>{
   const minutes=Math.round(Math.abs(value)*600);
   return (value<0?negative:positive)+String(Math.floor(minutes/600)).padStart(width,'0')+
    String(minutes%600).padStart(3,'0');
  };
  return field(lat,2,'N','S')+' '+field(lon,3,'E','W');
 }
 function apply(win,preset){
  if(!['FULL_ALIGN','COLD_DARK','LIVE'].includes(preset))throw Error('Unknown EFIS preset');
  const irs=win.B737IRSTrainerUnified,core=win.B737IRSTrainerCoreV1,sources=win.B737UnifiedEfisSources;
  if(!irs||!core||!sources)throw Error('IRS is loading. Try again in a moment.');
  const before=irs.getState();
  if(preset==='FULL_ALIGN'){
   const blocked=SIDES.find(side=>win.B737UnifiedCB?.irsPower?.(side,true)===false);
   if(blocked)throw Error('IRS '+blocked+' has no feed through its circuit breakers.');
   const last=SIDES.map(side=>before.units[side]).find(u=>u.positionValid);
   const text=last?.position?formatPosition(last.position):DEFAULT_POSITION;
   const heading=Number.isFinite(last?.trueHeadingDeg)?last.trueHeadingDeg%360:90;
   const reference=core.trainingAlignmentReference(core.parseFmcPosition(text),heading);
   irs.setPowerMode('BENCH');
   for(const side of SIDES){
    if(before.units[side].mode!=='OFF')irs.setMode(side,'OFF');
    irs.setMode(side,'NAV');
   }
   irs.setFmcPosition(text,reference);
   irs.setBenchMotion({gsKt:0,trueTrackDeg:heading,trueHeadingDeg:heading});
   if(!SIDES.every(side=>irs.getState().units[side].positionValid))throw Error('Both IRS units did not finish alignment.');
  }else{
   if(preset==='COLD_DARK'){
    for(const side of SIDES)if(before.units[side].mode!=='OFF')irs.setMode(side,'OFF');
   }
   if(preset==='COLD_DARK'||sources.getPreset()==='FULL_ALIGN'&&before.motionSource==='BENCH_SIM')irs.stopMotion();
   irs.setPowerMode('AIRCRAFT');
  }
  sources.setPreset(preset);
  return irs.getState();
 }
 function install(win){
  const doc=win.document;
  const status=doc.getElementById('unifiedEfisPresetStatus');
  const buttons=[...doc.querySelectorAll('[data-efis-preset]')];
  if(!status||!buttons.length)return;
  const descriptions={FULL_ALIGN:'IRS L/R aligned · EFIS training supply enabled.',
   COLD_DARK:'IRS L/R OFF · EADI and EHSI dark.',LIVE:'Aircraft power and manual IRS operation.'};
  const showPreset=preset=>{
   for(const item of buttons)item.setAttribute('aria-pressed',String(item.dataset.efisPreset===preset));
   status.textContent=descriptions[preset];
  };
  let manuallyChanged=false;
  // The EFIS training mode defaults to FULL ALIGN on every fresh Unified load.
  // Run the actual IRS L/R alignment shortcut, not merely the selected button
  // visual or the EFIS source preset. This is an instructor simulation default
  // and must not bypass a pulled circuit breaker or a failed alignment.
  const bootDefault=()=>{
   if(manuallyChanged)return;
   try{
    const current=win.B737UnifiedEfisSources?.getPreset?.();
    if(current&&current!=='LIVE'){
     showPreset(current); // Preserve an earlier explicit mode.
     return;
    }
    apply(win,'FULL_ALIGN');
    showPreset('FULL_ALIGN');
   }catch(error){
    // Never claim aligned when alignment failed, e.g. a pulled IRS CB.
    showPreset(win.B737UnifiedEfisSources?.getPreset?.()||'LIVE');
    status.textContent='FULL ALIGN NOT READY · '+String(error?.message||error);
   }
  };
  if(doc.readyState==='complete')bootDefault();
  else doc.addEventListener('DOMContentLoaded',bootDefault,{once:true});
  for(const button of buttons)button.addEventListener('click',()=>{
   const preset=button.dataset.efisPreset;
   manuallyChanged=true;
   try{
    apply(win,preset);
    showPreset(preset);
   }catch(error){status.textContent=error.message;}
  });
 }
 return Object.freeze({apply,install});
});

}catch(error){queueMicrotask(()=>{throw error});}
;await 0;
})();
