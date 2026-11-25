(async()=>{
;
/* ../../engine/systems/unified-instructor-fcom-mrg-effects-v2.js?v=FCOM-MRG-INSTRUCTOR-V2-20261122 */
try{
/* B737 Classic Unified — FCOM/MRG instructor failure effects V2.
 * Training only; source: FCOM 2.10.11-13 / 7.20.7 / 10.20.8 /
 * 11.32.5-7 / 13.20.2-6, MRG IV.2 / IV.7 / IV.11 / IV.13.
 * Pure effects evaluated against cockpit-owned signals, not a second simulator.
 */
(function(root,factory){'use strict';const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root?.document)api.install(root);
})(typeof globalThis!=='undefined'?globalThis:null,function(){'use strict';
 const VERSION='FCOM-MRG-FAILURE-EFFECTS-20261122-V2';
 const MAP=Object.freeze({
 'irs.left':'navigation.irs.left','irs.right':'navigation.irs.right','irs.both':'navigation.irs.both',
 'fmc.left':'navigation.fmc.left','fmc.right':'navigation.fmc.right','fmc.both':'navigation.fmc.both',
 'hyd.a.loss':'hydraulic.a.total','hyd.b.loss':'hydraulic.b.total',
 'hyd.standbyPump':'hydraulic.standby.pump','hyd.ptu':'hydraulic.ptu','hyd.lgtu':'hydraulic.lgtu'
 });
 const IDS=new Set([...Object.values(MAP),'air.autoFail','air.cargoDoor',
 'engine.1.startValveOpen','engine.2.startValveOpen','electrical.buses.both',
 ...['cpt','fo'].flatMap(seat=>['eadi','ehsi','asi','altimeter','vsi','rdmi','ivsi'].map(unit=>'instrument.'+seat+'.'+unit))]);
 const normalize=id=>MAP[id]||(/^(cpt|fo)\.(eadi|ehsi|asi|altimeter|vsi|rdmi|ivsi)$/.test(id)?'instrument.'+id:id);
 const failed=(faults,id)=>faults.has(id);
 const pressure=alt=>14.696*Math.pow(Math.max(.00001,1-0.00000687535*Math.max(-1000,Math.min(60000,alt))),5.2559);
 function evaluate(faults,live={},elapsed=0,started={}){
  faults=new Set([...faults].map(normalize));
  const f=id=>failed(faults,id),aircraft=live.flight||{},n1=live.engine1||{},n2=live.engine2||{};
  const irs={left:!f('navigation.irs.left')&&!f('navigation.irs.both'),
   right:!f('navigation.irs.right')&&!f('navigation.irs.both')};
  const fmc={left:!f('navigation.fmc.left')&&!f('navigation.fmc.both'),
   right:!f('navigation.fmc.right')&&!f('navigation.fmc.both')};
  const side=live.fmcSourceSelector||'NORMAL';
  const sources={cpt:side==='BOTH ON R'?'right':'left',fo:side==='BOTH ON L'?'left':'right'};
  const displays={};for(const seat of ['cpt','fo']){
   displays[seat]={};for(const unit of ['eadi','ehsi','asi','altimeter','vsi','rdmi','ivsi']){
    const unitWorks=!f('instrument.'+seat+'.'+unit);
    const inertial=irs[(live.irsSource?.[seat]|| (seat==='cpt'?'left':'right'))];
    const usesIRS=['eadi','ehsi','rdmi'].includes(unit)||(['vsi','ivsi'].includes(unit)&&live.ivsSource!=='ADC');
    displays[seat][unit]={powered:unitWorks,valid:unitWorks&&(!usesIRS||inertial),
     flags:!unitWorks?'DISPLAY FAIL':usesIRS&&!inertial?'IRS INVALID':null,
     rawVhfNavAvailable:unitWorks&&unit==='ehsi'};
   }
  }
  const vtk={cpt:!fmc[sources.cpt],fo:!fmc[sources.fo]};
  const mapFailure={};for(const seat of ['cpt','fo']){
   const which=sources[seat],possible=['navigation.fmc.both','navigation.fmc.'+which].filter(f);
   mapFailure[seat]=vtk[seat]&&possible.some(id=>elapsed-(started[id]??elapsed)>=25);
  }
  const afdsChannel=live.afdsChannel==='B'?'B':'A';
  const fmcForAP=afdsChannel==='A'?fmc[sources.cpt]:fmc[sources.fo];
  const ac=live.ac||{},busBoth=f('electrical.buses.both')||!!live.bothBusInjected;
  const buses={ac1:!busBoth&&ac.bus1!==false,ac2:!busBoth&&ac.bus2!==false,
   engineGen1Producing:n1.running!==false&&(n1.n2??70)>=55,
   engineGen2Producing:n2.running!==false&&(n2.n2??70)>=55,
   genOffBus1:busBoth,genOffBus2:busBoth,
   batteryBus:ac.battery!==false};
  const hyd=live.hyd||{},a=!f('hydraulic.a.total')&&hyd.aPsi!==0,
   b=!f('hydraulic.b.total')&&hyd.bPsi!==0;
  const flaps=Number(aircraft.flapDeg||0),airborne=aircraft.airborne!==false;
  const standbyRequested=!!hyd.stbySelected||!!hyd.altFlapsArm||
   (flaps>0&&(airborne||(aircraft.wheelSpeedKts||0)>60)&&(!a||!b)&&hyd.flightControlOn!==false)||
   !!hyd.forceFight;
  const standby=standbyRequested&&!f('hydraulic.standby.pump')&&buses.ac2;
  const ptu=airborne&&a&&(n2.n2??70)<56&&flaps>0&&flaps<15&&
   !f('hydraulic.ptu')&&hyd.bFluidAvailable!==false;
  const lgtu=airborne&&(n1.n2??70)<56&&b&&hyd.gearLever==='UP'&&
   hyd.mainGearUpLocked===false&&!f('hydraulic.lgtu');
  const users={autopilotA:a,autopilotB:b,groundSpoilers:a,
   brakesNormal:b,brakesAlternate:a,autobrake:b,
   normalGear:a,retractGear:a||lgtu,normalNosewheelSteering:a,
   trailingFlapsNormal:b,leadingEdgeNormal:b||ptu,autoslat:b||ptu,
   yawDamper:b,rudder:a||b||standby,
   thrustReverser1:a||standby,thrustReverser2:b||standby};
  const start={};
  for(const [num,e] of [['1',n1],['2',n2]]){
   const stuck=f('engine.'+num+'.startValveOpen'),cutout=(e.n2??70)>=46;
   const valveOpen=stuck||(!cutout&&e.startSwitch==='GRD');
   start[num]={starterCutout:cutout,startSwitch:cutout?'OFF':(e.startSwitch||'OFF'),
    valveOpen,startValveOpenLight:valveOpen&&buses.batteryBus,stuck};
  }
  const press=live.pressure||{},dcpcs=live.panelType==='DCPCS';
  const autoFail=f('air.autoFail')||!!press.autoFail;
  const cab=Number.isFinite(press.cabinAltitudeFt)?press.cabinAltitudeFt:5500;
  const alt=Number.isFinite(aircraft.altitudeFt)?aircraft.altitudeFt:31000;
  const pOut={autoFail,mode:autoFail?(dcpcs?'ALTN':'STBY'):(press.mode||'AUTO'),
   autoFailLight:autoFail,standbyLight:autoFail&&!dcpcs,altnLight:autoFail&&dcpcs,
   cabinAltitudeFt:cab,cabinRateFpm:press.cabinRateFpm||0,
   differentialPsi:Math.max(0,pressure(cab)-pressure(alt)),
   cabinAltitudeWarning:cab>=10000,physicalLeak:f('air.cargoDoor'),
   manualControlEffective:!press.manualActuatorFailed&&!press.outflowValveStuck&&
    !press.uncontrolledLeak};
  return Object.freeze({version:VERSION,navigation:{irs,fmc,displays,vtk,mapFailure,
   fmcAlert:!fmc.left||!fmc.right,cduPowered:true,
   cduMessage:!fmc.left&&!fmc.right?'FMC FAIL':!fmc.left||!fmc.right?'SINGLE FMC OPERATION':null,
   lnavAvailable:fmcForAP,vnavAvailable:fmcForAP},
   flightInstruments:displays,afds:{channel:afdsChannel,
    autopilotAAvailable:a&&irs.left,autopilotBAvailable:b&&irs.right,
    lnavAvailable:fmcForAP,vnavAvailable:fmcForAP},
   electrical:buses,hydraulics:{aAvailable:a,bAvailable:b,standbyActive:standby,
    standbyRequested,ptuActive:ptu,lgtuActive:lgtu,users,
    cautions:{systemA:!a,systemB:!b,stbyRudderOn:standby}},
   engineStart:start,pressurization:pOut,warnings:{fmcAlert:!fmc.left||!fmc.right,
    startValve1:start['1'].startValveOpenLight,startValve2:start['2'].startValveOpenLight,
    cabinAltitude:cab>=10000,hydraulic:!a||!b}});
 }
 function createController(){
  let faults=new Set(),elapsed=0,started={},current=null;
  const subscribers=new Map();
  function publish(live={}){
   current=evaluate(faults,live,elapsed,started);
   for(const [name,fn] of subscribers)try{fn(current[name]||current);}catch(e){/* keep other channels running */}
   return current;
  }
  function replace(ids){
   const next=new Set();for(const id of ids){const key=normalize(id);if(!IDS.has(key))throw Error('Unknown failure '+id);next.add(key);if(!faults.has(key))started[key]=elapsed;}
   faults=next;return publish();
  }
  function tick(delta,live={}){if(!Number.isFinite(delta)||delta<0||delta>10)throw Error('Invalid delta');elapsed+=delta;return publish(live);}
  function registerConsumer(name,fn){if(typeof fn!=='function')throw TypeError('function required');
   subscribers.set(name,fn);return ()=>subscribers.delete(name);}
  return Object.freeze({replace,tick,publish,registerConsumer,getEffects:()=>current||publish(),
   getFaults:()=>[...faults],getDiagnostics:()=>({version:VERSION,elapsed,faults:[...faults],
    consumers:[...subscribers.keys()],nativeReady:subscribers.size>0})});
 }
 function install(win){
  if(win.B737UnifiedFcomFailureEngineV2)return win.B737UnifiedFcomFailureEngineV2;
  const controller=createController();
  function sample(){
   const s=win.B737UnifiedFlightScenarioV1?.getState?.()||{};
   const pressure=win.B737UnifiedInstructorNonNormalV1?.pressureState?.()||{};
   const power=win.B737UnifiedBusFailureInjectionV1?.live?.get?.();
   return {flight:s,pressure,ac:{battery:true},
    bothBusInjected:!!power?.active&&['transfer1@115VAC','transfer2@115VAC'].every(k=>power.offBusKeys.includes(k)),
    engine1:{n2:win.B737ISNCockpitV1?.getState?.()?.state?.engines?.[0]?.n2??70},
    engine2:{n2:win.B737ISNCockpitV1?.getState?.()?.state?.engines?.[1]?.n2??70}};
  }
  function push(kind){
   const output=controller.publish(sample());
   win.dispatchEvent(new CustomEvent('b737:unified-fcom-failure-effects-v2',{
    detail:{kind,output,diagnostics:controller.getDiagnostics(),source:'FCOM_MRG_INSTRUCTOR'}}));
  }
  win.addEventListener('b737:advanced-failures-changed',e=>{
   try{controller.replace(e.detail?.failures||[]);push('FAILURES');}
   catch(error){win.console?.error('Instructor failure rule',error);}
  });
  win.addEventListener('b737:instructor-scenario-loaded',()=>push('SCENARIO'));
  const api=Object.freeze({...controller,version:VERSION,
   tickLive:dt=>{const effects=controller.tick(dt,sample());push('TICK');return effects;},
   sampleLive:sample,refresh:()=>push('MANUAL_REFRESH')});
  win.B737UnifiedFcomFailureEngineV2=api;
  if(win.document.readyState==='loading')win.document.addEventListener('DOMContentLoaded',()=>{
   try{controller.replace(win.B737UnifiedAdvancedInstructorV1?.getFailures?.()||[]);push('HYDRATE');}catch(e){win.console?.warn(e);}
  },{once:true});
  else {try{controller.replace(win.B737UnifiedAdvancedInstructorV1?.getFailures?.()||[]);push('HYDRATE');}catch(e){}}
  return api;
 }
 return Object.freeze({VERSION,IDS,normalize,evaluate,createController,install});
});

}catch(error){queueMicrotask(()=>{throw error});}
;await 0;
;
/* ../../engine/flight/iran-radio-navaids-v1.js?v=IRAN-RADIONAV-0005 */
try{
/* B737 Classic Unified — educational VOR/DME and ILS geometry.
 * Community reference data only. NOT an AIRAC database, approved approach,
 * radio-propagation model, actual station status or flight-navigation source.
 * Runway threshold approximation is explicitly flagged for ILS; DME is
 * slant range to the modeled reference point, NOT a surveyed DME antenna.
 */
(function(root,factory){
 'use strict';const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root?.document)root.B737IranRadioNavaidsV1=api;
})(typeof globalThis!=='undefined'?globalThis:null,function(){
 'use strict';
 const R=Math.PI/180,EARTH_NM=3440.065,FT_PER_NM=6076.11549;
 const rad=n=>n*R,wrap=n=>(n%360+360)%360,delta=(a,b)=>((wrap(a-b)+540)%360)-180;
 const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
 // Existing OurAirports reference positions, published IR ENR references
 // and reference approach/runway locations. Nonoperational trainer data.
 const sites=[
  {ident:'TRN',type:'VOR_DME',freqKhz:115300,lat:35.696999,lon:51.283798,elevationFt:3960,source:'OURAIRPORTS_COMMUNITY'},
  {ident:'IKA',type:'VOR_DME',freqKhz:114300,lat:35.409698,lon:51.178501,elevationFt:3280,source:'OURAIRPORTS_COMMUNITY',note:'SIMULATED_ONLY_STATION_STATUS_UNVERIFIED'},
  {ident:'MSD',type:'VOR_DME',freqKhz:114000,lat:36.231201,lon:59.650600,elevationFt:3251,source:'OURAIRPORTS_COMMUNITY'},
  {ident:'SYZ',type:'VOR_DME',freqKhz:117800,lat:29.540199,lon:52.588799,elevationFt:4920,source:'OURAIRPORTS_COMMUNITY'},
  {ident:'IFN',type:'VORTAC',freqKhz:117100,lat:32.746389,lon:51.824722,elevationFt:5063,source:'PUBLIC_IR_ENR_REFERENCE'},
  {ident:'DHN',type:'VOR_DME',freqKhz:114500,lat:35.254167,lon:52.720278,elevationFt:2756,source:'PUBLIC_IR_ENR_REFERENCE'},
  // ITRN is shown as OIIE RWY 29L in user chart; OIII uses ITHL.
  {ident:'ITRN',type:'ILS_DME',freqKhz:110700,lat:35.4114,lon:51.165798,elevationFt:3305,courseTrueDeg:290,glideDeg:3,runway:'29L',airport:'OIIE',source:'USER_IRAN_CHART_2620',positionQuality:'PROVISIONAL_RWY_THR'},
  {ident:'IIKA',type:'ILS_DME',freqKhz:110300,lat:35.413101,lon:51.166000,elevationFt:3305,courseTrueDeg:288.88,glideDeg:3,runway:'29R',airport:'OIIE',source:'PUBLIC_OIIE_APPROACH_REF',positionQuality:'PROVISIONAL_RWY_THR'},
  // Mehrabad OIII RWY 29L: ident ITHL, frequency 109.90 MHz; threshold is a TRAINING proxy, not localizer/DME surveyed antenna.
  {ident:'ITHL',type:'ILS_DME',freqKhz:109900,lat:35.682400,lon:51.333599,elevationFt:3797,dmeElevationFt:3804,courseMagDeg:285,courseTrueDeg:289.75,glideDeg:3.3,tchFt:59,locMaxNm:18,gsMaxNm:10,runway:'29L',airport:'OIII',source:'JEPPESEN_OIII_11-1_IRAN2620_CHART',positionQuality:'PROVISIONAL_RWY_THR',dmePositionQuality:'COLOCATED_THRESHOLD_TRAINING_PROXY'},
  {ident:'IMSD',type:'ILS_DME',freqKhz:109900,lat:36.224098,lon:59.657100,elevationFt:3263,courseTrueDeg:313.74,glideDeg:3,runway:'31R',airport:'OIMM',source:'PUBLIC_OIMM_APPROACH_REF',positionQuality:'PROVISIONAL_RWY_THR'},
  {ident:'ISYZ',type:'ILS_DME',freqKhz:109900,lat:29.5391667,lon:52.5898333,elevationFt:4927,courseTrueDeg:294.4,glideDeg:3,runway:'29L',airport:'OISS',source:'PUBLIC_OISS_APPROACH_REF',positionQuality:'PROVISIONAL_AIRPORT_ARP'}
 ];
 const STATIONS=Object.freeze(sites.map(s=>Object.freeze(s)));
 const ALIASES=Object.freeze({MHD:'MSD'}); // MHD is an IATA airport code, not a separate VOR
 const byIdent=ident=>STATIONS.find(s=>s.ident===(ALIASES[String(ident).toUpperCase()]||String(ident).toUpperCase()))||null;
 function ground(from,to){
  const a=rad(from.lat),b=rad(to.lat),dl=rad(to.lon-from.lon),dp=b-a;
  const h=Math.sin(dp/2)**2+Math.cos(a)*Math.cos(b)*Math.sin(dl/2)**2;
  const distanceNm=2*EARTH_NM*Math.asin(Math.min(1,Math.sqrt(h)));
  const bearingTrue=wrap(Math.atan2(Math.sin(dl)*Math.cos(b),Math.cos(a)*Math.sin(b)-Math.sin(a)*Math.cos(b)*Math.cos(dl))/R);
  return {distanceNm,bearingTrue};
 }
 function dmeSlantNm(aircraft,station){
  const g=ground(aircraft,station).distanceNm;
  return Math.hypot(g,(Number(aircraft.altitudeFt)-Number(station.dmeElevationFt??station.elevationFt))/FT_PER_NM);
 }
 function validAircraft(a){return a&&Number.isFinite(a.lat)&&Math.abs(a.lat)<=90&&Number.isFinite(a.lon)&&Math.abs(a.lon)<=180&&Number.isFinite(a.altitudeFt);}
 function evaluate(aircraft,station,{variationDeg=null,courseMagDeg=null}={}){
  if(!validAircraft(aircraft)||!station)return null;
  const g=ground(aircraft,station),out={stationIdent:station.ident,stationLat:station.lat,stationLon:station.lon,
   tunedFrequencyMHz:station.freqKhz/1000,distanceNm:dmeSlantNm(aircraft,station),
   bearingDeg:g.bearingTrue,bearingReference:'TRUE',groundDistanceNm:g.distanceNm,
   quality:'TRAINING_GEOMETRY',source:station.source};
  if(station.type!=='ILS_DME'){
   const radialTrue=ground(station,aircraft).bearingTrue;
   const radialMag=Number.isFinite(variationDeg)?wrap(radialTrue-variationDeg):null;
   const toMag=Number.isFinite(variationDeg)?wrap(g.bearingTrue-variationDeg):null;
   const crs=Number.isFinite(courseMagDeg)?wrap(courseMagDeg):null;
   const to=crs!==null&&toMag!==null&&Math.abs(delta(toMag,crs))<=90;
   return {...out,radialMagDeg:radialMag,toFrom:crs===null||toMag===null?null:to?'TO':'FROM',
    deviationDots:crs===null||radialMag===null?null:clamp((to?delta(toMag,crs):delta(radialMag,crs))/2,-2.5,2.5)};
  }
  const fromThreshold=ground(station,aircraft);
  const approachRay=wrap(station.courseTrueDeg+180);
  const offAxis=delta(fromThreshold.bearingTrue,approachRay);
  const front=Math.abs(offAxis)<=35&&g.distanceNm<=(station.locMaxNm??18);
  const loc=front?clamp(offAxis/1.25,-2.5,2.5):null;
  const effectiveNm=Math.max(.03,g.distanceNm);
  const actualGlide=Math.atan2(aircraft.altitudeFt-station.elevationFt-(station.tchFt??50),effectiveNm*FT_PER_NM)/R;
  // 0.01NM numerical tolerance allows an exact 10NM great-circle final at
  // decimal-degree station coordinates (not an extra reception claim).
  const gsValid=front&&g.distanceNm<=(station.gsMaxNm??10)+.01&&Math.abs(actualGlide-station.glideDeg)<=5;
  return {...out,frontCourse:front,runway:station.runway,airport:station.airport,
   localizerDots:loc,glideslopeDots:gsValid?clamp((actualGlide-station.glideDeg)/.35,-2.5,2.5):null,
   glidepathAngleDeg:actualGlide,courseTrueDeg:station.courseTrueDeg,courseMagDeg:station.courseMagDeg??null,tchFt:station.tchFt??50,positionQuality:station.positionQuality};
 }
 function match(freqKhz,type,aircraft=null){
  if(!Number.isInteger(freqKhz))return null;
  const options=STATIONS.filter(s=>s.freqKhz===freqKhz&&(type==='ILS'?s.type==='ILS_DME':s.type!=='ILS_DME'));
  if(!options.length)return null;
  if(options.length===1)return options[0];
  if(!validAircraft(aircraft))return null;
  return options.sort((a,b)=>ground(aircraft,a).distanceNm-ground(aircraft,b).distanceNm)[0];
 }
 return Object.freeze({version:'IRAN-RADIONAV-TRAINING-0003',STATIONS,ALIASES,byIdent,ground,dmeSlantNm,evaluate,match,wrap,delta});
});

}catch(error){queueMicrotask(()=>{throw error});}
;await 0;
;
/* ./iran-radio-nav-unified-v1.js?v=IRAN-RADIONAV-0001&amp;ils=SHI-CH4-0004 */
try{
/* Unified B737 Classic — NAV tuning and actual training trajectory -> avionics bus.
 * Existing EFIS and RDMI instruments own rendering; no display DOM mutations.
 * Training model only; not real ILS radio propagation or AFDS guidance.
 */
(function(root){
 'use strict';
 const GEO=root.B737IranRadioNavaidsV1;
 if(!GEO||!root.document)return;
 const owners={},errors={},seats=['CAPT','FO'];
 let lastReason='NO_VALID_AIRCRAFT_POSITION',lastState={},started=false;
 function connect(){
  const net=root.B737UnifiedAvionicsNetworkV1;
  if(!net?.connectExternal)return false;
  for(const owner of ['VHF_NAV','DME','ILS']){
   if(owners[owner]||errors[owner])continue;
   try{owners[owner]=net.connectExternal(owner);}
   catch(err){errors[owner]=String(err.message||err);}
  }
  return Object.keys(owners).length>0;
 }
 function position(){
  const trainer=root.B737UnifiedFlightScenarioV1;
  const scene=trainer?.getDiagnostics?.()?.active===true?trainer.getState?.():null;
  if(scene&&Number.isFinite(scene.lat)&&Number.isFinite(scene.lon)&&Number.isFinite(scene.altitudeFt))
   return {lat:scene.lat,lon:scene.lon,altitudeFt:scene.altitudeFt,source:'FLIGHT_SCENARIO'};
  const s=root.B737UnifiedAvionicsNetworkV1?.getSnapshot?.();
  for(const key of ['irs.left','irs.right']){
   const record=s?.[key],v=record?.quality==='VALID'?record.value:null;
   if(v?.powered!==true||v?.positionValid!==true||!Number.isFinite(v.lat)||!Number.isFinite(v.lon))continue;
   const adc=s?.['airdata.adc'+(key==='irs.left'?1:2)];
   const alt=adc?.quality==='VALID'?adc.value?.pressureAltitudeFt:null;
   if(Number.isFinite(alt))return {lat:v.lat,lon:v.lon,altitudeFt:alt,source:'IRS_ADC'};
  }
  return null;
 }
 function magneticVariation(point){
  const mag=root.B737WMM2025V1?.evaluate?.({lat:point.lat,lon:point.lon,altitudeFt:point.altitudeFt});
  return mag?.valid===true&&Number.isFinite(mag.declinationDeg)?mag.declinationDeg:null;
 }
 function course(channel){
  const snapshot=root.B737UnifiedAvionicsNetworkV1?.getSnapshot?.();
  const record=snapshot?.['mcp.state'];
  if(record?.quality!=='VALID')return null;
  const mcp=record.value;
  if(mcp?.powered!==true||(channel===2&&mcp.course2Powered!==true))return null;
  const deg=channel===1?mcp.courseL:mcp.courseR;
  return Number.isFinite(deg)?deg:null;
 }
 function emit(owner,topic,payload,reason){
  const p=owners[owner];if(!p)return;
  try{p.publish(topic,payload,{quality:payload?'VALID':'UNKNOWN',
   origin:'TRAINING_SCENARIO',reason:payload?null:reason||'NO_TUNED_REFERENCE_SIGNAL'});}
  catch(err){errors[owner]=String(err.message||err);}
 }
 function refresh(){
  if(!connect())return false;
  const aircraft=position();
  lastReason=aircraft?'TRAINING_RADIONAV_ACTIVE':'NO_VALID_AIRCRAFT_POSITION';lastState={};
  for(let i=0;i<2;i++){
   const seat=seats[i],ch=i+1,ctl=root.B737UnifiedVHFNavControlsV1?.getState?.(seat);
   const frequencyKhz=ctl?.activeFrequencyKhz;
   const chReason=!aircraft?'POSITION_INVALID':!Number.isInteger(frequencyKhz)?'NAV_NOT_TUNED':null;
   if(chReason){
    emit('VHF_NAV','navigation.vor'+ch,null,chReason);
    emit('DME','navigation.dme'+ch,null,chReason);
    emit('ILS','navigation.ils'+ch,null,chReason);
    lastState[seat]={frequencyKhz:frequencyKhz??null,stationIdent:null,reason:chReason};continue;
   }
   const vor=GEO.match(frequencyKhz,'VOR',aircraft),ils=GEO.match(frequencyKhz,'ILS',aircraft);
   const source=ils||vor;
   const distance=source?GEO.ground(aircraft,source).distanceNm:Infinity;
   const inRange=!!source&&distance<=(ils?18:130);
   const variation=magneticVariation(source||aircraft);
   const calculated=inRange?GEO.evaluate(aircraft,source,{variationDeg:variation,courseMagDeg:course(ch)}):null;
   const ilsValid=!!ils&&calculated?.frontCourse===true;
   const vorValid=!!vor&&!!calculated;
   const vorData=vorValid?{
    stationIdent:vor.ident,stationLat:vor.lat,stationLon:vor.lon,
    tunedFrequencyMHz:vor.freqKhz/1000,bearingDeg:calculated.bearingDeg,
    bearingReference:'TRUE',radialDeg:calculated.radialMagDeg,
    toFrom:calculated.toFrom,deviationDots:calculated.deviationDots,
    trainingOnly:true,source:calculated.source}:null;
   const ilsData=ilsValid?{
    stationIdent:ils.ident,stationLat:ils.lat,stationLon:ils.lon,
    tunedFrequencyMHz:ils.freqKhz/1000,localizerDots:calculated.localizerDots,
    glideslopeDots:calculated.glideslopeDots,frontCourse:true,
    courseTrueDeg:ils.courseTrueDeg,courseMagDeg:ils.courseMagDeg??null,
    glideDeg:ils.glideDeg,tchFt:ils.tchFt??50,runway:ils.runway,
    trainingOnly:true,positionQuality:calculated.positionQuality,
    source:calculated.source}:null;
   const dmeData=(vorValid||ilsValid)?{
    stationIdent:source.ident,stationLat:source.lat,stationLon:source.lon,
    distanceNm:calculated.distanceNm,tunedFrequencyMHz:source.freqKhz/1000,
    trainingOnly:true,slantRange:true,source:calculated.source}:null;
   emit('VHF_NAV','navigation.vor'+ch,vorData,vor?'VOR_OUT_OF_RANGE':'NO_VOR_MATCH');
   emit('DME','navigation.dme'+ch,dmeData,'NO_VALID_DME');
   emit('ILS','navigation.ils'+ch,ilsData,ils?'ILS_NOT_IN_FRONT_COURSE':'NO_ILS_MATCH');
   lastState[seat]={frequencyKhz,stationIdent:vorValid||ilsValid?source.ident:null,
    type:vorValid?'VOR':ilsValid?'ILS':null,distanceNm:dmeData?.distanceNm??null,
    positionSource:aircraft.source,
    reason:vorValid||ilsValid?'TRAINING_GEOMETRY_VALID':'STATION_OUT_OF_RANGE_OR_NO_FRONT_COURSE'};
  }
  return true;
 }
 function schedule(){root.setTimeout?.(refresh,0);}
 for(const event of ['b737:vhf-nav-mode','b737:unified-vhf-frequency',
  'b737:nav-auto-frequency','b737:flight-scenario-state',
  'b737:flight-scenario-stopped','b737:efis-preset-change',
  'b737:irs-trainer-state'])root.addEventListener(event,schedule);
 function start(){if(started)return;started=true;refresh();root.setInterval?.(refresh,1000);}
 if(root.document.readyState==='loading')root.document.addEventListener('DOMContentLoaded',start,{once:true});else start();
 root.B737UnifiedIranRadioNavV1=Object.freeze({version:'IRAN-RADIONAV-UNIFIED-0001',refresh,
  getState:()=>JSON.parse(JSON.stringify({reason:lastReason,channels:lastState,ownerErrors:errors})),
  stationCatalog:GEO.STATIONS});
})(window);

}catch(error){queueMicrotask(()=>{throw error});}
;await 0;
;
/* ./final10-approach-preset-v1.js?v=FINAL10-ALL-OWNERS-0001 */
try{
/* FLT PHASE FINAL_10 — B737 Classic training initialization.
 * Instructor-approved initial state, never a new electrical, engine, flap
 * or autopilot state machine. Uses the existing cockpit owners and physical
 * controls; cannot bypass their bus/CB/guard interlocks.
 * Positions of all frozen OH images and 18 guarded switches stay untouched.
 */
(function(win){
 'use strict';
 const VERSION='FINAL10-INTEGRATED-0005-LOCKED-OWNER-COMPAT';
 const docs=win.document,GET=()=>win.B737UnifiedFlightScenarioV1?.getState?.();
 const rad=Math.PI/180,normal=x=>(x%360+360)%360;
 let serial=0,timer=null,check=null,flapPresetSentFor=null,flapPresetLastAt=0;
 const genPulseLastAt={1:0,2:0};
 const STRATEGY={
  OIII:{vor:'TRN',ilsByRunway:{'29L':'ITHL'}},
  OIMM:{vor:'MSD',ilsByRunway:{'31R':'IMSD'}},
  OISS:{vor:'SYZ',ilsByRunway:{'29L':'ISYZ'}}
 };
 // The 10 NM FINAL is READY only after EVERY owner reports success.
 // In particular the Flap lever, TE actuator and LE FULL must all agree.
 const REQUIRED_FINAL10=Object.freeze([
  'ENGINE_1','ENGINE_2','GEN1_ON_BUS','GEN2_ON_BUS','APU_OFF',
  'OH_bleed-apu','OH_bleed-eng-1','OH_bleed-eng-2','OH_pack-l','OH_pack-r',
  'OH_isolation-valve','OH_gen-1','OH_gen-2','OH_apu-gen-1','OH_apu-gen-2',
  'NAV1_VOR','NAV2_ILS','AUTOBRAKE_2','SPEED_BRAKE_ARMED',
  'LANDING_GEAR_DOWN','FLAP_LEVER_30','FLAP_ACTUAL_30','MCP',
  ...['landing-out-l','landing-out-r','landing-in-l','landing-in-r',
   'strobe','position-lights','anti-collision','logo','wing-lights',
   'runway-turnoff-l','runway-turnoff-r','taxi'].map(id=>'LIGHT_'+id)
 ]);
 const ready=()=>REQUIRED_FINAL10.every(key=>check?.[key]?.ok===true);

// Final-approach initialization uses only the approved LE/TE owner's public
// ports. The owner-locked trainer bridge itself stays byte-identical.
function prepareLockedFinal10Flaps(owner,overhead,session){
 if(typeof owner?.reset!=='function'||typeof owner?.dispatch!=='function'||
    typeof owner?.advance!=='function'||typeof owner?.flapActuator!=='function')
  throw Error('LOCKED_LE_OWNER_PORTS_UNAVAILABLE');
 owner.reset('NORMAL');
 owner.dispatch({type:'GROUND',value:false});
 // The *original* physical lever message enables the approved timed LE/TE laws.
 // Never bypass the locked owner's lever/actuator sequencing.
 overhead.postMessage({type:'b737:cockpit-command',action:'le-devices',
  originator:'physical-flap-lever',command:{type:'FLAP_LEVER',value:30}},
  win.location.origin);
 let attempts=0;
 const settle=()=>{
  if(session!==serial)return;
  const a=owner.flapActuator();
  if(a?.command!==30){
   if(++attempts<12)win.setTimeout(settle,35);
   else result('FLAP_OWNER_PRESET',false,'LOCKED_LE_OWNER_LEVER_ACK_TIMEOUT');
   return;
  }
  try{
   // Owner-authorized time laws, replayed without changing physical panel
   // assets or the frozen bridge. No UI animation is emitted between turns.
   for(let i=0;i<48;i++)owner.advance(1);
   const done=owner.flapActuator(),s=owner.snapshot?.();
   const ok=Math.abs((done?.actual??-1)-30)<0.4 &&
    done?.moving===false&&s?.leStage==='FULL'&&s?.center?.extended===true;
   result('FLAP_OWNER_PRESET',ok,ok?'LOCKED_OWNER_ACTUATOR_SETTLED_30':
    'LOCKED_OWNER_ACTUATOR_NOT_READY');
  }catch(error){result('FLAP_OWNER_PRESET',false,String(error?.message||error));}
 };
 win.setTimeout(settle,35);
}

 function magnetic(trueDeg,state){
  const w=win.B737WMM2025V1;
  const p=w?.evaluate?.({lat:state.lat,lon:state.lon,altitudeFt:state.altitudeFt});
  return p?.valid===true?normal(trueDeg-p.declinationDeg):null;
 }
 function result(key,ok,detail){
  if(!check)return;
  check[key]={ok:ok===true,detail:String(detail??(ok?'READY':'NOT_READY'))};
 }
 function child(){
  const f=docs.getElementById('overheadFrame');
  try{return f?.contentWindow?.B737OverheadToggles?f.contentWindow:null;}catch{return null;}
 }
 // Actuate existing NON-GUARDED OH switches through their approved selector.
 // This intentionally does not programmatically open/modify 18 owner guards.
 function physicalOh(winChild,id,target){
  const api=winChild?.B737OverheadToggles,doc=winChild?.document;
  const defs=api?.getRegistry?.()?.controls;
  const item=defs?.find?.(c=>c.id===id);
  if(!item||!item.states?.includes(target)||item.guarded===true||item.guard===true)return false;
  const before=api.getState?.()?.[id];
  if(before===target)return true;
  if(typeof api.setScenarioSwitch==='function')return api.setScenarioSwitch(id,target)?.accepted===true;
  const switchButton=doc.getElementById('toggle-'+id);
  if(!switchButton)return false;
  switchButton.dispatchEvent(new winChild.MouseEvent('click',{bubbles:true,cancelable:true,detail:0}));
  const choices=[...(doc.getElementById('toggleStates')?.querySelectorAll('button[data-state]')||[])];
  const choice=choices.find(x=>x.dataset.state===target);
  if(!choice)return false;
  choice.click();
  // On a spring-return engine generator selector the ON pulse is enough;
  // its displayed detent is permitted to return to NEUTRAL.
  return target==='ON'&&/^gen-[12]$/.test(id)||
   api.getState?.()?.[id]===target;
 }
 function applyOverhead(){
  const w=child();
  if(!w){result('OVERHEAD',false,'OVERHEAD_FRAME_NOT_READY');return;}
  // Engine start preset is applied BEFORE switching away from APU power.
  const eng=win.B737ISNCockpitV1;
  const phases=eng?.getStartState?.()?.phase||{};
  for(const n of [1,2]){
   const id='engine'+n;
   if(phases[id]==='RUNNING'){result('ENGINE_'+n,true,'RUNNING');continue;}
   try{
    const s=eng.engineTrainerAction({instructor:true,type:'PRESET_RUNNING',engine:id});
    result('ENGINE_'+n,eng.getStartState().phase[id]==='RUNNING',
      eng.getStartState().phase[id]||s?.type);
   }catch(error){result('ENGINE_'+n,false,error?.message);}
  }
  // A command to the spring-return GEN switch is not proof that a bus
  // actually accepted the generator. Verify the Electrical V7 source and
  // evaluated AC bus before treating the FINAL_10 preset as ready.
  for(const [id,target] of [
   ['bleed-apu','OFF'],['bleed-eng-1','ON'],['bleed-eng-2','ON'],
   ['pack-l','AUTO'],['pack-r','AUTO'],['isolation-valve','AUTO']
  ]){
   // Do not repeatedly pulse a spring-return generator selector after its
   // initial successful contactor command; each fresh load has a new check map.
   if(check?.['OH_'+id]?.ok===true)continue;
   const ok=physicalOh(w,id,target);
   result('OH_'+id,ok,ok?target:'SWITCH_NOT_READY_OR_INHIBITED');
  }
  // APU shutdown is a normal pilot selection on the existing OH switch;
  // it is not an APU fault or synthetic hidden ECU change.
  const running=eng?.getStartState?.()?.phase||{};
  const both=running.engine1==='RUNNING'&&running.engine2==='RUNNING';
  const electrical=eng?.getElectricalState?.();
  let evaluated=null;
  try{evaluated=electrical?win.B737ElectricalV7?.evaluate?.(electrical):null;}
  catch(error){result('ELECTRICAL_EVALUATION',false,error?.message);}
  const generator1=electrical?.source?.[1]==='GEN1'&&evaluated?.bus?.generator1===true;
  const generator2=electrical?.source?.[2]==='GEN2'&&evaluated?.bus?.generator2===true;
  for(const n of [1,2]){
   const connected=n===1?generator1:generator2;
   const source='GEN'+n,run=running['engine'+n]==='RUNNING';
   const ready=run&&electrical?.config?.['engine'+n+'Running']===true;
   const failed=electrical?.faults?.[source+'_FAILED']===true;
   const now=Date.now();
   if(!connected&&ready&&!failed&&now-genPulseLastAt[n]>=800){
    const pulsed=physicalOh(w,'gen-'+n,'ON');
    genPulseLastAt[n]=now;
    result('OH_gen-'+n,pulsed,
     pulsed?'GENERATOR_ON_PULSE_WAITING_FOR_BUS':'GENERATOR_PULSE_REJECTED');
   }else if(connected)result('OH_gen-'+n,true,'GENERATOR_CONNECTED_AND_POWERED');
   else result('OH_gen-'+n,false,failed?'GENERATOR_FAILED_OR_DISCONNECTED':
    ready?'WAITING_FOR_ACCEPTED_GENERATOR_CONTACTOR':'ENGINE_GENERATOR_NOT_READY');
   result(source+'_ON_BUS',connected,connected?source+' AC BUS CONNECTED':
    (electrical?.source?.[n]===source?'SOURCE_SELECTED_BUT_BUS_NOT_POWERED':
      failed?'GENERATOR_FAULT':'NOT_CONNECTED'));
  }
  // Removing APU generator contactors before the engine generators
  // connect disconnects DC BUS 2 and can inhibit the very GEN ON commands
  // needed to complete the preset. Keep the APU electrical source available
  // throughout the transfer. Only then command both APU selectors OFF.
  for(const n of [1,2]){
   const id='apu-gen-'+n;
   if(generator1&&generator2){
    const ok=physicalOh(w,id,'OFF');
    result('OH_'+id,ok,ok?'APU_GEN_OFF_AFTER_ENGINE_TRANSFER':
     'APU_GEN_SWITCH_NOT_READY');
   }else result('OH_'+id,false,'KEEP_APU_GENERATOR_WHILE_ENGINE_BUSES_CONNECT');
  }
  // Do not shut down APU until BOTH engine generators are genuinely
  // providing AC bus power. Switch detent ON alone is insufficient proof.
  if(both&&generator1&&generator2){
   const moved=physicalOh(w,'apu-start','OFF');
   const off=eng?.getStartState?.()?.phase?.apu==='OFF';
   result('APU_OFF',moved&&off,off?'APU_PHASE_OFF':
    moved?'APU_SHUTDOWN_IN_PROGRESS':'APU_SWITCH_NOT_ACCEPTED');
  }else result('APU_OFF',false,'WAITING_FOR_BOTH_ENGINE_GENERATORS_ON_BUS');
  const light={
   'landing-out-l':'ON','landing-out-r':'ON','landing-in-l':'ON','landing-in-r':'ON',
   'strobe':'ON','position-lights':'ON','anti-collision':'ON','logo':'ON',
   'wing-lights':'ON','runway-turnoff-l':'OFF','runway-turnoff-r':'OFF','taxi':'OFF'
  };
  for(const [id,state] of Object.entries(light)){
   const ok=physicalOh(w,id,state);result('LIGHT_'+id,ok,ok?state:'LIGHT_SWITCH_UNAVAILABLE');
  }
 }
 function applyNavigation(state){
  const map=STRATEGY[state.icao];
  if(!map){result('NAV',false,'NO_AIRPORT_PROFILE');return;}
  const index=win.B737IranRadioNavaidsV1;
  const capt=index?.byIdent?.(map.vor);
  const ils=index?.byIdent?.(map.ilsByRunway[state.runway]);
  const set=(seat,facility)=>{
   if(!facility)return false;
   const id='nav-'+seat.toLowerCase()+'-manual';
   return win.B737UnifiedVHFDualV1?.setFrequency?.(id,facility.freqKhz)===true&&
    win.B737UnifiedVHFNavControlsV1?.setMode?.(seat,'manual')===true;
  };
  result('NAV1_VOR',set('CAPT',capt),capt?capt.ident+' '+(capt.freqKhz/1000).toFixed(2):'VOR_NOT_FOUND');
  result('NAV2_ILS',set('FO',ils),ils?ils.ident+' '+(ils.freqKhz/1000).toFixed(2):
   'NO_ILS_FOR_SELECTED_RUNWAY');
 }
 function applyConfiguration(){
  const ab=win.B737AutobrakeUnified,lever=win.B737SpeedbrakeLever;
  try{
   // 10 NM final is airborne. Do not select 2 before the actual DC BUS 2,
   // anti-skid and hydraulic/brake prerequisites are available: an early
   // selection latches FAILED and lights AUTO BRAKE DISARM.
   const initial=ab?.getState?.();
   if(initial&&initial.inputs?.onGround!==false)
    ab?.updateSensors?.({onGround:false});
   // Refresh the SAME ATA32 owner against live DC BUS 2 and CB conditions.
   ab?.updateSensors?.({});
   const previous=ab?.getState?.(),input=previous?.inputs;
   const electrical=win.B737ISNCockpitV1?.getElectricalState?.();
   const dc2Powered=electrical&&win.B737ElectricalV7?.evaluate?.(electrical)?.bus?.dc2===true;
   const valid=dc2Powered===true&&!!input&&input.electricalAvailable===true&&
    input.antiskidOn===true&&input.antiskidFault===false&&
    input.hydraulicBAvailable===true&&input.normalBrakesOperative===true&&
    input.autobrakeFault===false&&input.solenoidPressurePsi<=1000;
   if(valid&&previous?.selector==='2'&&
      (previous.phase==='FAILED'||previous.phase==='DISARMED')){
    // Physically equivalent instructor selection OFF -> 2 clears only the
    // prior selection latch; it never clears an actual fault or bypasses CBs.
    ab.setSelector('OFF');
   }
   if(valid&&ab?.getState?.()?.selector!=='2')ab?.setSelector?.('2');
   const current=ab?.getState?.(),ready=current?.selector==='2'&&
    ['WAITING','ARMED'].includes(current.phase)&&current.disarmLight===false;
   result('AUTOBRAKE_2',ready,ready?'2 / ARMED / DISARM LIGHT OFF':
    valid?(current?.reason||'AUTOBRAKE_REARM_PENDING'):
    'WAITING_FOR_DC_BUS_2_ANTISKID_HYD_B_NORMAL_BRAKES');
  }catch(error){result('AUTOBRAKE_2',false,error?.message);}
  try{
   if(lever?.mounted?.()===true)lever.set('ARMED');
   const armed=docs.querySelector('#b737-speedbrake-groove')!==null&&
    win.B737CockpitLights?.getState?.()?.inputs?.speedBrakeArmedIndication===true;
   result('SPEED_BRAKE_ARMED',armed,armed?'ARMED':'PEDESTAL_LEVER_OR_SENSOR_NOT_READY');
  }catch(error){result('SPEED_BRAKE_ARMED',false,error?.message);}
  // Ensure the existing ATA32 landing gear selector is in DOWN and allow
  // the original hydraulic actuator time to reach all three downlocks.
  const gear=win.B737LandingGearUnifiedV1;
  try{
   const before=gear?.getState?.();
   if(before?.lever!=='DN')gear?.select?.('DN');
   const after=gear?.getState?.();
   const down=after?.lever==='DN'&&
    ['nose','left','right'].every(x=>after.gear?.[x]==='DOWN');
   result('LANDING_GEAR_DOWN',down,down?'THREE_GEAR_DOWN_LOCKED':
    after?'GEAR_DOWN_TRANSIT':'LANDING_GEAR_OWNER_NOT_READY');
  }catch(error){result('LANDING_GEAR_DOWN',false,error?.message);}
  const flap=win.B737FlapVisualTest;
  try{
   if(flap?.position!==30)flap?.presetFinal10?.();
   const physical=flap?.position===30;
   const link=win.B737LEDevicesUnifiedLink?.getState?.();
   const actual=link?.actualTe;
   // Retry if overhead announced READY before its LE trainer mounted.
   const currentOwner=readFlapOwner();
   const confirmed=(link?.projection?.scenario==='FINAL_10_READY'&&
    link?.projection?.lever===30&&link?.projection?.teTarget===30&&
    link?.projection?.teMoving===false)||
    (currentOwner?.lever===30&&currentOwner?.projection?.teTarget===30&&
    currentOwner?.projection?.teMoving===false&&
    currentOwner?.projection?.leStage==='FULL'&&
    currentOwner?.projection?.center?.extended===true&&
    Math.abs(currentOwner.actualTe-30)<.4);
   if(physical&&link?.overheadReady===true&&
      (!confirmed||!Number.isFinite(actual)||Math.abs(actual-30)>.4)&&
      (flapPresetSentFor!==serial||Date.now()-flapPresetLastAt>=1500)){
    const overhead=docs.getElementById('overheadFrame')?.contentWindow;
    if(overhead){
     try{
      const owner=overhead.B737LEDevicesTrainer;
      if(typeof owner?.presetFinal10ReadyFlaps==='function'){
       owner.presetFinal10ReadyFlaps({originator:'FLIGHT_SCENARIO_FINAL10'});
       result('FLAP_OWNER_PRESET',true,'OWNER_ATOMIC_CONFIG_ACKNOWLEDGED');
      }else{
       // Compatible with the actual 2026-10-28 owner-approved frozen bridge.
       prepareLockedFinal10Flaps(owner,overhead,serial);
       result('FLAP_OWNER_PRESET',false,'LOCKED_LE_OWNER_PRESET_STARTED');
      }
      flapPresetSentFor=serial;flapPresetLastAt=Date.now();
     }catch(error){result('FLAP_OWNER_PRESET',false,error?.message);}
    }
   }
   const now=win.B737LEDevicesUnifiedLink?.getState?.();
   const owner=readFlapOwner();
   const relayReady=physical&&now?.projection?.scenario==='FINAL_10_READY'&&
    now?.projection?.teTarget===30&&now?.projection?.teMoving===false&&
    Number.isFinite(now.actualTe)&&Math.abs(now.actualTe-30)<.4;
   // The frozen LE bridge can reject a legitimate post-reset revision.
   // Confirm the actual locked TE actuator and full LE stage instead.
   const ownerReady=physical&&owner?.lever===30&&
    owner?.projection?.teTarget===30&&owner?.projection?.teMoving===false&&
    owner?.projection?.leStage==='FULL'&&
    owner?.projection?.center?.extended===true&&
    Number.isFinite(owner.actualTe)&&Math.abs(owner.actualTe-30)<.4;
   const ready=relayReady||ownerReady;
   if(ownerReady&&!relayReady){
    win.B737FlapNeedles?.setCommon?.(owner.actualTe);
    win.B737CockpitLights?.setInputs?.({trailingFlaps:30,leadingEdge:'FULL'});
   }
   if(ready)result('FLAP_OWNER_PRESET',true,
    ownerReady?'VERIFIED_LIVE_ACTUATOR_30':'OWNER_PROJECTION_CONFIRMED');
   result('FLAP_LEVER_30',physical,physical?'30':'INSTRUCTOR_PRESET_NOT_READY');
   result('FLAP_ACTUAL_30',ready,ready?
    (ownerReady?owner.actualTe:now.actualTe).toFixed(1)+' DEG / STABLE':
    Number.isFinite(now?.actualTe)?now.actualTe.toFixed(1)+' DEG / WAITING_FOR_OWNER':
     'LE_PROJECTION_NOT_READY');
  }catch(error){result('FLAP_LEVER_30',false,error?.message);}
 }
 // Same-origin read-only observation of the already installed LE/TE owner.
 // Never synthesize actuator movement from a lever command.
 function readFlapOwner(){
  const child=docs.getElementById('overheadFrame')?.contentWindow;
  const owner=child?.B737LEDevicesTrainer;
  const actuator=owner?.flapActuator?.();
  const le=owner?.snapshot?.();
  const detents=[0,1,2,5,10,15,25,30,40];
  if(!detents.includes(le?.lever)||!Number.isFinite(actuator?.actual)||
     actuator.actual<0||actuator.actual>40||
     !Number.isFinite(actuator?.command)||actuator.command<0||
     actuator.command>40||!le?.center)return null;
  return {lever:le.lever,actualTe:actuator.actual,projection:{
   tePosition:actuator.actual,teTarget:actuator.command,
   teMoving:actuator.moving===true,leStage:le.leStage,
   center:le.center,mismatch:Array.isArray(le.mismatch)?le.mismatch:[],
   revision:le.revision
  }};
 }
 function applyMcp(state){
  const m=magnetic(state.runwayHeadingTrueDeg,state);
  if(!Number.isFinite(m)){result('MCP',false,'WMM2025_DECLINATION_MISSING');return;}
  try{
   win.B737McpAFDSBridgeV1?.refreshElectrical?.();
   const o=win.B737McpAFDSBridgeV1?.applyFinal10Preset?.({
    speedKt:142,headingMag:m,courseMag:m,altitudeFt:state.altitudeFt});
   result('MCP',o?.accepted===true,o?.accepted?'SPD142 HDG/CRS'+Math.round(m)+' ALT HOLD CMD B AT ARM':
    o?.reason||'MCP_OWNER_NOT_READY');
  }catch(error){result('MCP',false,error?.message);}
 }
 function publish(){
  const map=check?JSON.parse(JSON.stringify(check)):{};
  win.dispatchEvent(new CustomEvent('b737:final10-preset-status',{detail:{
   version:VERSION,serial,checks:map,complete:ready(),
   missing:REQUIRED_FINAL10.filter(key=>map[key]?.ok!==true)}}));
 }
 function apply(state){
  if(!state||state.preset!=='FINAL_10')return null;
  serial++;flapPresetSentFor=null;flapPresetLastAt=0;genPulseLastAt[1]=0;genPulseLastAt[2]=0;const my=serial;
  if(timer!==null){win.clearInterval(timer);timer=null;}
  check={};let count=0;
  const run=()=>{
   if(my!==serial){win.clearInterval(timer);timer=null;return;}
   const live=GET();
   if(live?.preset!=='FINAL_10'||live.icao!==state.icao||live.runway!==state.runway){
    win.clearInterval(timer);timer=null;return;}
   // Avoid reasserting physical controls once the setup is complete.
   if(REQUIRED_FINAL10.some(key=>!check[key]?.ok&&(
    key.startsWith('OH_')||key.startsWith('LIGHT_')||
    ['ENGINE_1','ENGINE_2','GEN1_ON_BUS','GEN2_ON_BUS','APU_OFF'].includes(key))))
    applyOverhead();
   if(!check.NAV1_VOR?.ok||!check.NAV2_ILS?.ok)applyNavigation(live);
   if(!check.FLAP_LEVER_30?.ok||!check.FLAP_ACTUAL_30?.ok||
      !check.AUTOBRAKE_2?.ok||!check.SPEED_BRAKE_ARMED?.ok||
      !check.LANDING_GEAR_DOWN?.ok)applyConfiguration();
   if(!check.MCP?.ok)applyMcp(live);
   publish();
   if(++count>=180||ready()){
    win.clearInterval(timer);timer=null;
   }
  };
  run();timer=win.setInterval(run,350);
  return {serial,started:true,version:VERSION};
 }
 function stop(){serial++;if(timer!==null){win.clearInterval(timer);timer=null;} }
 win.addEventListener('b737:flight-scenario-stopped',stop);
 win.B737Final10ApproachPresetV1=Object.freeze({version:VERSION,apply,stop,
  getStatus:()=>({version:VERSION,serial,complete:ready(),
   missing:REQUIRED_FINAL10.filter(key=>check?.[key]?.ok!==true),
   checks:check?JSON.parse(JSON.stringify(check)):{}}),
  getLiveFlapOwnerState:readFlapOwner});
})(window);

}catch(error){queueMicrotask(()=>{throw error});}
;await 0;
;
/* ../../engine/afds/classic-ils-afds-ch4-v1.js?v=ILS-FCC-SHI-0001 */
try{
/* B737 Classic CH4 ILS/VOR AFDS training geometry -> FCC evidence.
 * FCOM SHI 4.10.14-16, 4.20.20-29. Only models published training signals;
 * not certified radio propagation, FCC capture law, or autoland control.
 * LOC <= 0.5 dot, G/S <= 0.4 dot are documented capture bounds;
 * rates/gains/intercept predictions are openly instructor approximations.
 */
(function(root,factory){'use strict';const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.B737ClassicILSApproachCH4V1=api;
})(typeof globalThis!=='undefined'?globalThis:null,function(){
 'use strict';
 const VERSION='CLASSIC-ILS-AFDS-CH4-0001';
 const finite=Number.isFinite,clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
 const norm=x=>(x%360+360)%360;
 const diff=(a,b)=>((a-b+540)%360)-180;
 function radio(record){
  if(record?.quality!=='VALID'||!record.value)return null;
  return record.value;
 }
 function active(out){
  return out?.pending?.approach||out?.nav?.gs?'APP':
   out?.armed?.roll==='VOR/LOC'||out?.capture?.roll==='VOR_LOC'?'VOR_LOC':'OFF';
 }
 function evaluate({output,flight,snapshot,declinationDeg=null}={}){
  const blank={version:VERSION,valid:false,kind:'NONE',stationIdent:null,mode:active(output),
   navCaptureConfirmed:false,gsCaptureConfirmed:false,courseTrackValid:false,
   glideValid:false,dualIlsValid:false,reason:'NO_SIGNAL'};
  if(output?.power!==true||!flight||!snapshot)return {...blank,reason:'SOURCE_UNAVAILABLE'};
  const mode=active(output);
  const nav1=radio(snapshot['navigation.ils1']),nav2=radio(snapshot['navigation.ils2']);
  const vor1=radio(snapshot['navigation.vor1']),vor2=radio(snapshot['navigation.vor2']);
  const primary=output.modes?.autopilot==='CMD_B'?'FO':'CAPT';
  const selected=primary==='CAPT'?1:2;
  const ils=selected===1?nav1:nav2,vor=selected===1?vor1:vor2;
  const signal=ils||vor;
  if(!signal)return {...blank,mode,reason:'NAV_RECEIVER_NO_VALID_SIGNAL'};
  const ilsValid=!!ils&&ils.frontCourse===true&&
   finite(ils.localizerDots)&&finite(ils.courseTrueDeg);
  const vorValid=!!vor&&finite(vor.bearingDeg)&&
   finite(output.values?.[selected===1?'courseL':'courseR'])&&finite(declinationDeg);
  const kind=ilsValid?'ILS':vorValid?'VOR':'NONE';
  const valid=kind!=='NONE';
  const locDots=ilsValid?ils.localizerDots:vorValid?vor.deviationDots:null;
  const gsDots=ilsValid&&finite(ils.glideslopeDots)?ils.glideslopeDots:null;
  const crs=output.values?.[selected===1?'courseL':'courseR'];
  const vorCourse=vorValid?norm(crs+declinationDeg):null;
  const courseTrue=ilsValid?ils.courseTrueDeg:vorCourse;
  const courseMag=ilsValid&&finite(ils.courseMagDeg)?ils.courseMagDeg:crs;
  const selectedCourseAligned=ilsValid&&finite(declinationDeg)?
   Math.abs(diff(norm(crs+declinationDeg),courseTrue))<=15:vorValid;
  const lineValid=valid&&finite(locDots)&&selectedCourseAligned;
  const locCaptured=output.capture?.roll==='VOR_LOC'&&lineValid;
  const navCaptureConfirmed=mode!=='OFF'&&lineValid&&Math.abs(locDots)<=.5;
  const gsCaptureConfirmed=mode==='APP'&&locCaptured&&
   finite(gsDots)&&Math.abs(gsDots)<=.4;
  const dualIlsValid=ilsValid&&!!nav1&&!!nav2&&
   nav1.stationIdent===nav2.stationIdent&&
   nav1.tunedFrequencyMHz===nav2.tunedFrequencyMHz&&
   nav2.frontCourse===true&&finite(nav2.localizerDots)&&
   Math.abs(diff(norm(output.values.courseL+declinationDeg),
    norm(output.values.courseR+declinationDeg)))<=5&&
   output.course2Power===true;
  // Proportional track offset, no artificial FD deflection if signal absent.
  const correctedCourse=lineValid&&finite(courseTrue)?
   norm(courseTrue+clamp(locDots*5,-12,12)):null;
  const gsTrack=mode==='APP'&&locCaptured&&finite(gsDots);
  const gsKt=finite(flight.gsKt)?flight.gsKt:
   finite(flight.tasKt)?flight.tasKt:finite(flight.iasKt)?flight.iasKt:null;
  const glideDeg=ils?.glideDeg??3;
  const nominalVs=gsTrack&&finite(gsKt)?-gsKt*6076.11549/60*Math.tan(glideDeg*Math.PI/180):null;
  // Positive deviation represents aircraft above the GP in this radio model:
  // command stronger descent to return to the centerline.
  const gsVsFpm=finite(nominalVs)?clamp(nominalVs-gsDots*320,-2800,-150):null;
  return {version:VERSION,valid,kind,stationIdent:signal.stationIdent,mode,
   navCaptureConfirmed,gsCaptureConfirmed,dualIlsValid,
   locDeviationDots:finite(locDots)?locDots:null,gsDeviationDots:gsDots,
   gsBelowDots:finite(gsDots)?Math.max(0,-gsDots):null,
   courseTrackValid:locCaptured&&finite(correctedCourse),
   courseDeg:correctedCourse,glideValid:gsTrack&&finite(gsVsFpm),
   gsVsFpm,glideDeg,source:'TRAINING_NAV_AVIONICS',
   reason:!valid?'NAV_SIGNAL_UNVERIFIED':!selectedCourseAligned?'COURSE_MISMATCH':
    mode==='OFF'?'AFDS_NOT_ARMED':'GEOMETRY_VALID'};
 }
 return Object.freeze({VERSION,evaluate,active});
});

}catch(error){queueMicrotask(()=>{throw error});}
;await 0;
;
/* ./flight-envelope-le-bridge-v1.js?v=LE-PORTS-AERO-0001 */
try{
/* Instructor flight envelope -> OWNER FINAL LE Devices external dynamics port.
 * Do not modify the locked LE model, trainer bridge or physical lever.
 * Conditional autoslat demand is an IAS proxy, not certified AoA logic.
 */
(function(win){
 'use strict';
 const VALID='B737_FLIGHT_SCENARIO_STATE_V1';
 const source=()=>win.document.getElementById('overheadFrame')?.contentWindow;
 let ready=false,onGround=true,requested=false,previous=null;
 function transmit(force=false){
  const target=source(),key=JSON.stringify([onGround,requested]);
  if(!ready||!target||(!force&&previous===key))return false;
  target.postMessage({type:'b737:cockpit-command',action:'le-aircraft-dynamics',
   source:'INSTRUCTOR_LOW_SPEED_ENVELOPE_NOT_AOA',
   snapshot:{onGround,autoslatRequested:requested}},win.location.origin);
  previous=key;return true;
 }
 win.addEventListener('b737:flight-scenario-state',e=>{
  const f=e.detail;if(f?.schema!==VALID)return;
  onGround=f.airborne!==true;
  const p=win.B737LEDevicesUnifiedLink?.getState?.();
  requested=!onGround&&[1,2,5].includes(p?.lever)&&f.autoSlatRequest===true;
  transmit();
 });
 win.addEventListener('b737:flight-scenario-stopped',()=>{
  onGround=true;requested=false;transmit();
 });
 win.addEventListener('message',e=>{
  if(e.origin!==win.location.origin||e.source!==source()||
     e.data?.type!=='b737:cockpit-overhead'||e.data.kind!=='ready')return;
  ready=true;previous=null;transmit(true);
 });
 win.B737FlightEnvelopeLEBridgeV1=Object.freeze({snapshot:()=>({
  ready,onGround,requested,source:'INSTRUCTOR_LOW_SPEED_ENVELOPE_NOT_AOA'
 })});
})(window);

}catch(error){queueMicrotask(()=>{throw error});}
;await 0;
;
/* ./toga-unified-ch4-v1.js?v=CH4-TOGA-FD-SPEED-20261123&amp;ils=SHI-CH4-0004&amp;trainer=TOGA-145-FD-N1-110-125-0001 */
try{
/* TCAS-independent Unified TO/GA integration.
 * Source: Sepehran 737CL FCOM Ch 4 §§4.20.14–16,4.20.24–27.
 * All commands pass the SINGLE ISN-18 engine controller and AFDS FMA owner.
 * The reduced GA thrust fraction is a TRAINING proxy, not AFM N1 data.
 */
(function(win){'use strict';
 const T=win.B737ClassicTogaCH4V1;
 if(!T){win.console?.warn('TOGA CH4 core unavailable');return;}
 const doc=win.document;
 let state=T.initial(),lastMs=0,lastFma='',lastThrust='',errors=[];
 let thrustFeedback='NOT_REQUESTED';
 const getFlight=()=>win.B737UnifiedFlightScenarioV1;
 const mcp=()=>win.B737McpAFDSBridgeV1?.getOutput?.();
 const owner=()=>win.B737ISNCockpitV1;
 const engineRunning=(n)=>owner()?.getStartState?.()?.phase?.['engine'+n]==='RUNNING';
 const active=()=>['TO','GA'].includes(state.phase);
 const scenario=()=>getFlight()?.getState?.()??null;
 function context(light=false){
  const f=scenario(),m=mcp(),c=m?.controls||{},engines=light?null:owner()?.getPropulsionSnapshot?.()?.engines;
  return {groundReady:['GROUND_READY','TAKEOFF_ROLL'].includes(f?.phase),
   airborne:f?.airborne===true,
   // This Unified trainer explicitly requests V2+15. Pure Chapter 4 core
   // retains the FCOM V2+20 default for reference/profile tests.
   takeoffSpeedIncrementKt:15,
   vsFpm:f?.vsFpm,pitchDeg:f?.pitchDeg,
   massKg:f?.massKg,flapActualDeg:f?.flapActual,
   availableN1Percent:f?.propulsion?.n1Equivalent??null,
   sinceLiftoffSec:state.liftoffSec===null?0:
    Math.max(0,state.elapsedSec-state.liftoffSec),
   radioAltitudeFt:f?.radioAltitudeFt,iasKt:f?.iasKt,groundTrackDeg:f?.trueTrackDeg??f?.trueHeadingDeg,
   fdLeft:c.fd?.left===true,fdRight:c.fd?.right===true,
   allowFdAutoEngage:f?.airborne===true&&Number.isFinite(f?.radioAltitudeFt)&&f.radioAltitudeFt<2000,
   atArmed:c.atArm===true,
   apChannels:m?.dualApproach?.coupled===true?2:/^(?:CMD|CWS)_[AB]$/.test(m?.modes?.autopilot||'')?1:0,
   autopilotEngaged:/^(?:CMD|CWS)_[AB]$/.test(m?.modes?.autopilot||''),
   engine1Running:light?undefined:engineRunning(1),engine2Running:light?undefined:engineRunning(2),
   // Presence of both engines running is checked independently from pump/fuel faults.
   selectedSpeedKt:m?.values?.speed??f?.iasKt,
   v2Kt:win.B737UnifiedTakeoffDataV1?.get?.()?.v2Kt??null,
   flareArmed:m?.dualApproach?.flareArmed===true,touchedDown:f?.phase==='LANDING_ROLL',
   isTakeoffMode:state.phase==='TO',
   // FCOM 4.20.14-15 FSI/FST option: takeoff roll FMA HDG SEL, unlike
   // other variants with a BLANK lateral TO/GA mode. EP-FSI uses FSI.
   takeoffRollHdGSel:win.B737AircraftProfileStore?.get?.()?.aircraftModel==='737-300',
   // No digitized AFM N1 target exists. The reduced-GA-achieved gate is
   // explicitly a training approximation based on the observed same-ECU
   // throttle and N1; never an actual aircraft's reduced GA criterion.
   reducedGaN1Reached:engines&&['engine1','engine2'].some(id=>
    engines[id]?.running&&Number.isFinite(engines[id]?.n1Percent)&&
    Number.isFinite(engines[id]?.throttle)&&
    engines[id].throttle>=.82&&engines[id].n1Percent>=80)
  };
 }
 function banner(message,error=false){
  const el=doc.getElementById('flightScenarioStatus');
  if(el){el.textContent=message;el.dataset.error=String(error);}
 }
 function publishFma(){
  if(!active())return;
  const m=mcp();
  if(m?.power!==true)return;
  const fm=T.fma(state);
  if(state.phase==='GA'&&m?.modes?.lateral==='HDG_SEL')fm.roll='HDG SEL';
  else if(state.phase==='GA'&&m?.modes?.lateral==='LNAV')fm.roll='LNAV';
  else if(state.phase==='GA'&&m?.capture?.roll==='VOR_LOC')fm.roll='VOR/LOC';
  const fingerprint=JSON.stringify([fm,m.power,m.controls?.fd,state.fdAutoPopUp]);
  if(lastFma===fingerprint)return;
  lastFma=fingerprint;
  for(const seat of ['CAPT','FO']){
   win.dispatchEvent(new CustomEvent('b737:fma-fcc-observation',{detail:{
    schema:'B737_FMA_FCC_OBSERVATION_V1',confirmed:true,seat,
    source:'SIMULATED_FCC',evidence:{togaModeConfirmed:true},
    fields:{at:{active:fm.at},pitch:{active:fm.pitch},
     roll:{active:fm.roll},
     afds:{active:fm.afds==='CMD'||state.phase==='GA'||state.fdAutoPopUp===true||
      m.controls?.fd?.[seat==='CAPT'?'left':'right']===true?
      fm.afds:''}}
   }}));
  }
 }
 function thrust(){
  const fm=T.fma(state);
  if(!['TAKEOFF_LIMIT','GA_REDUCED','GA_FULL'].includes(fm.thrust))return;
  const finger=state.phase+':'+state.presses+':'+state.throttleFraction+':'+state.n1SelectedAfterArm;
  if(lastThrust===finger)return;
  const result=[];let attempts=0,reason='NO_RUNNING_ENGINE';
  for(const n of [1,2]){
   if(!engineRunning(n))continue;
   attempts++;
   try{
    const r=owner()?.togaThrottleCommand?.({engine:'engine'+n,
     value:state.throttleFraction,controller:'B737_TOGA_CH4_TRAINING',
     phase:state.phase});
    if(r?.accepted){
     result.push(n);
     doc.dispatchEvent(new CustomEvent('b737:throttle-state',{detail:{
      engine:n,percent:state.throttleFraction*100,source:'CH4_TOGA',visualOnly:true}}));
    }else reason=r?.reason||'THROTTLE_OWNER_NOT_READY';
   }catch(e){reason=String(e?.message||e);}
  }
  if(attempts>0&&result.length===attempts){
   lastThrust=finger;thrustFeedback='APPLIED_TO_'+result.join('_');
  }else{
   // A partial acceptance must not latch the whole TO/GA thrust command.
   // Retry against the SAME ECU until the running-engine set accepts it,
   // but never override THR HLD once that FCOM mode has been entered.
   thrustFeedback='NOT_APPLIED_'+reason;
   if(errors.at(-1)!==thrustFeedback)errors.push(thrustFeedback);
   if(errors.length>24)errors.shift();
  }
 }
 function press(source='INSTRUCTOR'){
  const flight=getFlight(),f=flight?.getState?.();
  if(!flight?.getDiagnostics?.()?.active||!f){
   banner('TO/GA BLOCKED · LOAD AN ACTIVE FLIGHT SCENARIO',true);return state;
  }
  const c=context(),was=state.phase;
  // Check the current engine snapshot on the SECOND GA push: do not block
  // forever merely because no periodic full-ECU poll ran in between.
  const before=state.phase==='GA'?T.advance(state,c,0):state;
  const next=T.press(before,c);
  if(next===state||next.reason===state.reason&&next.phase===state.phase){
   banner('TO/GA BLOCKED · '+next.reason,true);return state;
  }
  state=next;
  if((state.phase==='GA'&&was!=='GA')||(state.phase==='TO'&&was==='OFF'))
   win.B737McpAFDSBridgeV1?.beginToga?.(next.afdsMode==='CMD',next.singleEngine===true);
  if(state.phase==='OFF'){banner('TO/GA BLOCKED · '+state.reason,true);return state;}
  if((was==='OFF'||was==='TO')&&state.phase==='TO'&&f.phase==='GROUND_READY'){
   // FD TO/GA may engage with unavailable A/T, but a training takeoff ROLL
   // cannot accelerate under imaginary thrust while both engines are OFF.
   if(c.atArmed===true&&(c.engine1Running===true||c.engine2Running===true)){
    try{flight.command({type:'TAKEOFF_ROLL'});}catch(e){
     state=T.initial();banner('TO/GA BLOCKED · '+String(e.message||e),true);return state;
    }
   }else banner('TO/GA FD MODE · A/T ARMED AND RUNNING ENGINE REQUIRED FOR POWERED GROUND ROLL',true);
  }
  if(state.apDisengage===true){
   win.B737McpAFDSBridgeV1?.disconnectConfirmed?.({
    reason:'TOGA_BELOW_2000_RA',confirmed:true,source:'SIMULATED_FCC'
   });
  }
  publishFma();thrust();
  banner('TO/GA '+state.phase+' · '+state.reason+' · FMA '+state.atMode+
    ' / '+state.pitchMode+' / '+(state.rollMode||'BLANK')+' / '+state.afdsMode);
  win.dispatchEvent(new CustomEvent('b737:toga-mode',{detail:{...state,source}}));
  return state;
 }
 function tick(){
  const flight=getFlight(),current=flight?.getState?.();
  if(active()&&current){
   const ms=performance.now(),dt=lastMs?Math.min(.35,Math.max(0,(ms-lastMs)/1000)):0;
   const next=T.advance(state,context(true),dt);
   state=next;publishFma();thrust();
   lastMs=ms;
  }else lastMs=performance.now();
 }
 win.addEventListener('b737:toga-request',e=>press(e.detail?.source||'THRUST_LEVER'));
 // Engine indication emits an existing throttled shared-ECU packet; adapt the
 // 2-engine GA to a single-engine target using Chapter 4 F/D speed rules.
 win.addEventListener('b737:engine-indications-live-v2',()=>{
  if(!active())return;
  const next=T.advance(state,context(),0);
  if(next.singleEngine!==state.singleEngine||next.targetSpeedKt!==state.targetSpeedKt){
   if(next.singleEngine!==state.singleEngine)
    win.B737McpAFDSBridgeV1?.updateTogaEngine?.(next.singleEngine===true);
   state=next;lastFma='';publishFma();
   win.dispatchEvent(new CustomEvent('b737:toga-mode',{detail:{...state,source:'ENGINE_FEEDBACK'}}));
  }
 });
 function releaseToga(){
  if(state.phase==='OFF')return;
  state=T.initial();lastFma='';lastThrust='';thrustFeedback='NOT_REQUESTED';
  win.dispatchEvent(new CustomEvent('b737:toga-mode',{detail:{...state,source:'FCC_RELEASE'}}));
  win.dispatchEvent(new CustomEvent('b737:fma-fcc-clear'));
 }
 win.addEventListener('b737:flight-scenario-stopped',releaseToga);
 // Above 400ft RA selecting another pitch mode terminates TO/GA. Below
 // 400ft only turning BOTH FD OFF may terminate the protected phase.
 win.addEventListener('b737:mcp-button-request',e=>{
  const id=e.detail?.id;
  if(state.phase==='TO'&&id==='N1'&&
     (scenario()?.radioAltitudeFt??0)>=400&&mcp()?.modes?.thrust==='N1'){
   const next=T.selectN1(state,context());
   if(next.n1SelectedAfterArm===true){
    state=next;lastFma='';publishFma();thrust();
    win.dispatchEvent(new CustomEvent('b737:toga-mode',{detail:{...state,source:'MCP_N1'}}));
   }else banner('N1 NOT SELECTED · '+next.reason,true);
   return;
  }
  if(!active()||(scenario()?.radioAltitudeFt??0)<400)return;
  if(/^CMD_[AB]$/.test(id)&&mcp()?.modes?.autopilot===id){
   releaseToga();return;
  }
  if(['VNAV','LVL_CHG','ALT_HLD','VS'].includes(id))releaseToga();
 });
 win.addEventListener('b737:mcp-hardware-change',e=>{
  if(!active())return;
  if(!['FD_LEFT','FD_RIGHT'].includes(e.detail?.id))return;
  const controls=mcp()?.controls?.fd;
  if(state.phase==='GA'&&controls?.left===false&&controls?.right===false)releaseToga();
 });
 const api=Object.freeze({getState:()=>({...state}),press,tickForTest:tick,
  getDiagnostics:()=>({version:T.VERSION,errors:errors.slice(-12),
   thrustFeedback,lastAcceptedCommand:lastThrust||null})});
 win.B737UnifiedTOGACh4V1=api;
 if(typeof win.setInterval==='function')win.setInterval(tick,150);
})(window);

}catch(error){queueMicrotask(()=>{throw error});}
;await 0;
;
/* ./lvlchg-thrust-servo-ch4-v1.js?v=LVLCHG-THRUST-CH4-0001 */
try{
/* FCOM SHI 4.10.8-9 — LVL CHG A/T source-limited thrust.
 * DES: RETARD -> engine idle -> ARM. CLB: follows a VERIFIED FMC N1 limit
 * with a slow training servo; the EP-FSI V19 EST is VISUAL ONLY.
 * No alternate ECU / autopilot physics and no fake FCOM N1 tables.
 */
(function(win){'use strict';
 const VERSION='LVLCHG-THRUST-CH4-0001';
 const owner=()=>win.B737ISNCockpitV1;
 const output=()=>win.B737McpAFDSBridgeV1?.getOutput?.();
 const n1=()=>win.B737ManualN1LiveV1?.getState?.();
 let lastMode='',lastReason='NOT_ACTIVE',lastResult=[],lastSampleTime=0;
 const clamp=(x,a,b)=>Math.min(b,Math.max(a,x));
 function display(){
  const node=win.document.getElementById('flightLvlChgThrust');
  if(node)node.textContent='LVL CHG A/T · '+lastReason;
 }
 function tick(){
  const m=output(),mode=m?.modes||{};
  const active=m?.power===true&&m.controls?.atArm===true&&
   (mode.vertical==='LVL_CHG'||mode.vertical==='VNAV'&&m.fmcGuidance?.vertical===true)&&['N1','RETARD','ARM'].includes(mode.thrust);
  if(!active){lastMode='';lastReason='INACTIVE';display();return;}
  const source=owner();
  if(!source?.levelChangeThrottleCommand){
   lastReason='ENGINE ECU INTERFACE UNAVAILABLE';display();return;
  }
  if(mode.thrust==='ARM'){
   lastMode='ARM';lastReason='ARM · IDLE / THROTTLE SERVO RELEASED';display();return;
  }
  const engines=source.getPropulsionSnapshot?.()?.engines;
  if(!engines){lastReason='ENGINE N1 / THROTTLE FEEDBACK UNAVAILABLE';display();return;}
  const phase=mode.thrust==='N1'?'CLIMB':'DESCENT';
  if(phase==='CLIMB'){
   const lim=n1();
   const valid=lim?.[1]?.automaticSource==='FMC'&&lim?.[2]?.automaticSource==='FMC'&&
    [lim[1].automaticPct,lim[2].automaticPct].every(Number.isFinite);
   if(!valid){lastReason='N1 · VERIFIED FMC LIMIT NOT AVAILABLE · NO ENGINE COMMAND';
    display();return;}
  }
  const results=[];
  for(const side of [1,2]){
   const id='engine'+side,e=engines[id];
   if(!e?.running||!Number.isFinite(e.n1Percent)||!Number.isFinite(e.throttle))continue;
   let demand=0;
   if(phase==='CLIMB'){
    const target=n1()[side].automaticPct,err=target-e.n1Percent;
    if(Math.abs(err)<.15)continue;
    // Incremental feedback against the actual ECU-measured N1; command
    // limits and dynamics are only an instructor simulator approximation.
    demand=clamp(e.throttle+clamp(err*.004,-.02,.02),0,1);
   }
   if(phase==='DESCENT'&&e.throttle<=.01)continue;
   const r=source.levelChangeThrottleCommand({engine:id,value:demand,phase,
    controller:'B737_LVLCHG_CH4_TRAINING'});
   results.push({engine:id,accepted:r?.accepted===true,reason:r?.reason||null,demand});
   if(r?.accepted===true)
    win.document.dispatchEvent(new CustomEvent('b737:throttle-state',{
     detail:{engine:side,percent:demand*100,source:'LVL_CHG_CH4',visualOnly:true}}));
  }
  lastResult=results;lastMode=mode.thrust;
  lastReason=phase==='DESCENT'?
   (results.some(x=>x.accepted)?'RETARD · IDLE REQUEST SENT':'RETARD · VERIFYING IDLE'):
   (results.some(x=>x.accepted)?'N1 · TRACKING VERIFIED FMC LIMIT':'N1 · AT TARGET / NO RUNNING ENGINE');
  display();
 }
 function mount(){
  const d=win.document.getElementById('flightScenarioDialog');
  if(!d||win.document.getElementById('flightLvlChgThrust'))return;
  const p=win.document.createElement('p');p.id='flightLvlChgThrust';
  p.className='flight-sub';p.setAttribute('role','status');
  p.textContent='LVL CHG A/T · INACTIVE';
  const after=win.document.getElementById('flightAtPanel')||
   win.document.getElementById('flightFccPanel');
  if(after)after.after(p);else d.appendChild(p);
 }
 win.document.addEventListener('DOMContentLoaded',mount,{once:true});
 win.addEventListener('b737:cockpit-mounted',mount);
 if(win.document.readyState!=='loading')mount();
 if(typeof win.setInterval==='function')win.setInterval(tick,300);
 win.B737LevelChangeThrustCh4V1=Object.freeze({
  version:VERSION,tickForTest:tick,getState:()=>({mode:lastMode,reason:lastReason,commands:lastResult.map(x=>({...x}))})
 });
})(window);

}catch(error){queueMicrotask(()=>{throw error});}
;await 0;
})();
