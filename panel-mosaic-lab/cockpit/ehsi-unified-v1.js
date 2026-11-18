/* Photo-registered Classic EHSI for the Unified cockpit. Source adapters are read-only. */
(function(root,factory){
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root?.document)root.B737UnifiedEHSI=api.mount(root);
})(globalThis,function(){
 'use strict';
 const VERSION='UNIFIED-EHSI-0004-HEADING-REFERENCE';
 const NS='http://www.w3.org/2000/svg';
 // Apertures measured inside the source glass. Children inherit each photo's
 // existing registration, including the FO mode-specific transform and lift.
 const CAPT={parent:'[data-piece="captain"]',box:[312,256,159,198],photo:[726,661.356]};
 const FO={
  EIS:{parent:'[data-piece="fo-outer"]',box:[26,215,153,200],photo:[475,592.164]},
  CONVENTIONAL:{parent:'#fo-owner-panel-v1',box:[452,522,344,370],photo:[1286,1223]}
 };
 const TOPICS=new Set(['electrical.buses','irs.left','irs.right','mcp.state','fmc.computed',
  'airdata.adc1','airdata.adc2','navigation.vor1','navigation.vor2','navigation.dme1','navigation.dme2',
  'navigation.ils1','navigation.ils2']);
 const SEATS=['CAPT','FO'];
 const FMC_MAP_TIMEOUT_MS=27500;
 const number=v=>Number.isFinite(v)?v:null;
 function liveModel(src,setup,physical,aspect,route,failure={}){
  const d=setup.ehsi,radio=d.mode.includes('VOR_ILS');
  const nav=src.ils||src.vor;
  const dme=src.dme&&(nav?.stationIdent===src.dme.stationIdent||!nav)?number(src.dme.distanceNm):null;
  const loc=number(src.ils?.localizerDots),gs=number(src.ils?.glideslopeDots);
  const mapValid=src.fmc?.operational===true&&(d.mode==='PLAN'||src.fmc.position?.quality==='VALID');
  const cdi=src.ils?loc:number(src.vor?.deviationDots);
  return {mode:d.mode,range:d.range,heading:src.heading,track:src.track,geoTrack:src.trueTrack,
   selectedHeading:src.selectedHeading,course:radio?src.course:null,trueRef:src.trueRef,
   trueAirspeed:number(src.adc?.tasKt),groundSpeed:src.groundSpeed,bank:src.bank,
   windDirection:src.windDirection,windSpeed:src.windSpeed,
   nav:{type:src.ils?'ILS':'VOR',valid:radio?(src.ils?loc!==null:!!src.vor):mapValid,
    source:(src.ils?'ILS ':'VOR ')+src.vhf,frequency:number(nav?.tunedFrequencyMHz),dme,cdi,
    gsValid:src.frontCourse===true&&gs!==null,gsDev:gs,toFrom:src.vor?.toFrom},
   bearings:src.bearings,route,mapObjects:[],syntheticAirport:false,showSyntheticBearing:false,options:d.options,
   efis:{displayPower:src.displayPowered&&src.video,sgValid:src.video,
    headingValid:src.heading!==null,trackValid:src.track!==null,trackSource:src.trackSource,verticalFailure:failure.active,mapFailurePending:failure.mapPending,
    brightness:physical.ehsi.brightness,wxBrightness:physical.ehsi.wxBrightness,displayAspect:aspect}};
 }
 // Selecting an airport/runway in DEP/ARR provides a verified PLAN anchor.
 // MAP and CTR MAP remain aircraft-centered when a real IRS/FMC position exists.
 function referenceAnchor(mode,route,aircraftPosition,flightLocation,sg){
  const working=sg?.modified||sg?.active;
  const runway=Object.values(working?.geometries||{}).find(g=>
   g?.kind==='RUNWAY'&&g.fixes?.some(p=>Number.isFinite(p.lat)&&Number.isFinite(p.lon)));
  const fix=runway?.fixes?.find(p=>Number.isFinite(p.lat)&&Number.isFinite(p.lon));
  const threshold=fix?{lat:fix.lat,lon:fix.lon,source:'VERIFIED_RUNWAY_THRESHOLD'}:null;
  const selected=flightLocation&&Number.isFinite(flightLocation.lat)&&Number.isFinite(flightLocation.lon)?
   flightLocation:null;
  const live=aircraftPosition&&Number.isFinite(aircraftPosition.lat)&&Number.isFinite(aircraftPosition.lon)?
   aircraftPosition:null;
  if(mode==='PLAN')return threshold??route?.points?.[route.centerIndex]??selected??live;
  return live??selected??threshold;
 }
 function mount(win){
  const {document:doc,EFISDisplayLabCore:core,EFISClassicEHSIV2:renderer,B737UnifiedEfisSources:sources}=win;
  if(!core||!renderer||!sources)return null;
  const state={},instructor={},screens={},painted={};
  for(const seat of SEATS){state[seat]=core.initial();state[seat].seat=seat;instructor[seat]=false;}
  let selected='CAPT',frame=0,expiry=0,fmcFailureStarted=null,fmcTimeout=0;
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
    const route=sources.route(src.fmc,origin.ehsi.mode,origin.ehsi.planStep);
    const model=preview?core.ehsiModel(setup):liveModel(src,origin,setup,screen.aspect,route,failure);
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
    const center=chosen||src.mapPosition; // Instructor-selected chart center has priority for preview
    if(!preview&&location&&center&&['MAP','CTR_MAP','PLAN'].includes(origin.ehsi.mode)){
     const extra=[],vor=src.vor;
     if(vor?.stationIdent&&Number.isFinite(vor.stationLat)&&Number.isFinite(vor.stationLon))
      extra.push({type:'VOR',ident:vor.stationIdent,lat:vor.stationLat,lon:vor.stationLon});
     model.mapObjects=location.mapObjects(center,origin.ehsi.options,origin.ehsi.range,extra);
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
    const mode=origin.ehsi.mode;
    // PLAN can be reviewed before position/track is available. MAP remains
    // aircraft-centered, including when the source is the selected IRS.
    const anchor=referenceAnchor(mode,route,src.mapPosition,
     win.B737UnifiedFlightLocationV1?.getLocation?.(),sg);
    // The reviewed runway is the reference origin in PLAN. Do not subtract
     // the unrelated FMC route's selected center waypoint a second time.
     const project=mode==='PLAN'?
      renderer.routeProjection({...model,route:{...model.route,points:[],centerIndex:0}}):
      Number.isFinite(src.trueTrack)?renderer.routeProjection(model):null;
    reference?.draw(screen.svg,sg,mode,origin.ehsi.range,
     src.displayPowered===true&&src.video===true&&!preview,sources.offsets,project,anchor,trajectoryFlight);
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
   if(core.MODES.includes(p.mode))x.ehsi.mode=p.mode;
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
   const length=src.fmc?.route?.displayRoute?.points?.length??0;
   if(!length||setup.ehsi.mode!=='PLAN')return;
   setup.ehsi.planStep=Math.max(0,Math.min(length-1,setup.ehsi.planStep+dir));
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
