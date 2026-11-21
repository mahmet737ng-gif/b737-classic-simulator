(async()=>{
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
/* ./toga-unified-ch4-v1.js?v=CH4-TOGA-ECU-RETRY-20261119&amp;ils=SHI-CH4-0004 */
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
  return {groundReady:f?.phase==='GROUND_READY',airborne:f?.airborne===true,
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
  const fingerprint=JSON.stringify([fm,m.power,m.controls?.fd]);
  if(lastFma===fingerprint)return;
  lastFma=fingerprint;
  for(const seat of ['CAPT','FO']){
   win.dispatchEvent(new CustomEvent('b737:fma-fcc-observation',{detail:{
    schema:'B737_FMA_FCC_OBSERVATION_V1',confirmed:true,seat,
    source:'SIMULATED_FCC',evidence:{togaModeConfirmed:true},
    fields:{at:{active:fm.at},pitch:{active:fm.pitch},
     roll:{active:fm.roll},
     afds:{active:fm.afds==='CMD'||state.phase==='GA'||
      m.controls?.fd?.[seat==='CAPT'?'left':'right']===true?
      fm.afds:''}}
   }}));
  }
 }
 function thrust(){
  const fm=T.fma(state);
  if(!['TAKEOFF_LIMIT','GA_REDUCED','GA_FULL'].includes(fm.thrust))return;
  const finger=state.phase+':'+state.presses+':'+state.throttleFraction;
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
  if(state.phase==='GA'&&was!=='GA')
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
  win.dispatchEvent(new CustomEvent('b737:fma-fcc-clear'));
 }
 win.addEventListener('b737:flight-scenario-stopped',releaseToga);
 // Above 400ft RA selecting another pitch mode terminates TO/GA. Below
 // 400ft only turning BOTH FD OFF may terminate the protected phase.
 win.addEventListener('b737:mcp-button-request',e=>{
  const id=e.detail?.id;
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
  if(controls?.left===false&&controls?.right===false)releaseToga();
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
   mode.vertical==='LVL_CHG'&&['N1','RETARD','ARM'].includes(mode.thrust);
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
;
/* ../../engine/instruments/flight-display-motion-v1.js?v=FLIGHT-DISPLAY-MOTION-0001 */
try{
/* Source-preserving visual interpolation for Unified photo gauges and EFIS.
 * Never changes avionics bus, flight physics, FCC modes, or failure flags.
 * One sampled state and one coalesced animation clock for all consumers.
 */
(function(root,factory){'use strict';const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.B737FlightDisplayMotionV1=api;
})(typeof globalThis!=='undefined'?globalThis:null,function(){
 'use strict';
 const VERSION='B737_FLIGHT_DISPLAY_MOTION_0001';
 const finite=n=>typeof n==='number'&&Number.isFinite(n);
 const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
 const settings=Object.freeze({
  iasKt:{tau:.18,rate:18},altitudeFt:{tau:.16,rate:200},
  vsFpm:{tau:.20,rate:650},pitchDeg:{tau:.11,rate:3.4},
  bankDeg:{tau:.11,rate:6},radioAltitudeFt:{tau:.17,rate:200},
  trueHeadingDeg:{tau:.13,rate:13},gsKt:{tau:.18,rate:18}
 });
 function stepValue(current,target,dt,{tau=.16,rate=200}={}){
  if(!finite(target))return current;
  if(!finite(current)||dt>1)return target;
  if(!finite(dt)||dt<=0)return current;
  const diff=target-current,change=diff*(-Math.expm1(-dt/tau));
  return current+clamp(change,-rate*dt,rate*dt);
 }
 function wrap360(a){return ((a%360)+360)%360;}
 function stepFrame(prev,raw,dt){
  if(!raw||raw.schema!=='B737_FLIGHT_SCENARIO_STATE_V1')return null;
  if(!prev||prev.icao!==raw.icao||raw.elapsedSec+1e-6<(prev.elapsedSec??0)||
     dt>1||raw.revision<prev.revision)
   return {...raw,presentationSource:VERSION};
  const next={...raw,presentationSource:VERSION};
  for(const [field,config]of Object.entries(settings)){
   if(!finite(raw[field]))continue;
   if(field==='trueHeadingDeg'){
    const previous=prev[field],delta=((raw[field]-previous+540)%360)-180;
    next[field]=wrap360(stepValue(0,delta,dt,config)+previous);
   }else next[field]=stepValue(prev[field],raw[field],dt,config);
  }
  return next;
 }
 return Object.freeze({VERSION,settings,stepValue,stepFrame});
});

}catch(error){queueMicrotask(()=>{throw error});}
;await 0;
;
/* ./flight-display-motion-unified-v1.js?v=FLIGHT-DISPLAY-MOTION-0002-PAUSE-HIDDEN */
try{
/* Unified instructor display smoothing: 30 fps while scenario is active.
 * Only presentation; actual flight, MCP, FCOM, sensors and faults retain authority.
 */
(function(win){
 'use strict';
 const Model=win.B737FlightDisplayMotionV1,VERSION='UNIFIED_FLIGHT_DISPLAY_MOTION_0001';
 if(!Model){win.console?.error('Missing flight presentation model');return;}
 let frame=null,active=false,lastTime=null,lastPaint=0,scheduled=false,paints=0;
 function readRaw(){
  const owner=win.B737UnifiedFlightScenarioV1;
  if(owner?.getDiagnostics?.()?.active!==true)return null;
  const sample=owner.getState?.();
  return sample?.schema==='B737_FLIGHT_SCENARIO_STATE_V1'?sample:null;
 }
 function reset(){
  frame=null;active=false;lastTime=null;lastPaint=0;
 }
 function tick(now){
  scheduled=false;
  const raw=readRaw();
  if(!raw){reset();return;}
  if(win.B737UnifiedFlightScenarioV1?.getDiagnostics?.()?.paused===true){
   if(!frame)frame=Model.stepFrame(null,raw,0);
   lastTime=null;
   return; // pause needs no continuous RAF/repainting
  }
  const dt=lastTime===null?0:Math.min(1.5,Math.max(0,(now-lastTime)/1000));
  lastTime=now;active=true;
  frame=Model.stepFrame(frame,raw,dt);
  if(now-lastPaint>=1000/(win.document?.hidden?8:30)){
   lastPaint=now;paints++;
   win.dispatchEvent(new CustomEvent('b737:flight-presentation-frame',{
    detail:{schema:'B737_FLIGHT_PRESENTATION_FRAME_V1',source:VERSION,
     originalRevision:raw.revision,frame}}));
  }
  schedule();
 }
 function schedule(){
  if(scheduled)return;
  scheduled=true;win.requestAnimationFrame(tick);
 }
 win.addEventListener('b737:flight-scenario-state',()=>schedule());
 win.addEventListener('b737:flight-scenario-stopped',reset);
 win.addEventListener('b737:flight-scenario-loaded',()=>{reset();schedule();});
 if(readRaw())schedule();
 win.B737UnifiedFlightDisplayMotionV1=Object.freeze({
  VERSION,getState:()=>({active,frame,paints}),
  sample:()=>frame,start:schedule,stop:reset,
  stepForTest:(raw,dt)=>{
   frame=Model.stepFrame(frame,raw,dt);active=!!frame;return frame;
  }});
})(window);

}catch(error){queueMicrotask(()=>{throw error});}
;await 0;
;
/* ../../engine/afds/autothrottle-speed-servo-v1.js?v=AT-SPEED-0001 */
try{
/* B737 Classic A/T SPEED servo — training-only deterministic controller.
 * MCP remains sole owner of A/T ARM, speed window and thrust mode.
 * ISN-18 remains sole engine N1/N2/EGT/fuel dynamics owner.
 * Values/rates are illustrative, NOT certified CFM56-3B-1 or AFM schedules.
 */
(function(root,factory){
 'use strict';
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.B737AutothrottleSpeedServoV1=api;
})(typeof globalThis!=='undefined'?globalThis:null,function(){
 'use strict';
 const VERSION='B737_AT_SPEED_SERVO_0001';
 const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
 const finite=(x,a,b)=>typeof x==='number'&&Number.isFinite(x)&&x>=a&&x<=b;
 const ENGINES=['engine1','engine2'];
 const IDLE_N1=32,FULL_N1=97;
 function holdN1(iasKt,vsFpm=0){
  if(!finite(iasKt,0,450)||!finite(vsFpm,-6000,6000))throw RangeError('INVALID_FLIGHT_VECTOR');
  // Consistent with the surrogate speed plant, NOT a CFM56 chart.
  return clamp(42+.105*iasKt+.0002*iasKt*iasKt+3*vsFpm/1000,IDLE_N1,92);
 }
 function throttleForN1(n1){
  return Math.pow(clamp((n1-IDLE_N1)/(FULL_N1-IDLE_N1),0,1),1/1.12);
 }
 function initial(){
  return {schema:VERSION,active:false,reason:'NOT_ACTIVE',integral:0,throttle:0,
   targetKt:null,iasKt:null,errorKt:null,demandN1:null,engineCount:0,revision:0};
 }
 function step(previous,input){
  if(previous?.schema!==VERSION)throw TypeError('INVALID_SERVO_STATE');
  const dt=input?.dtSec;
  if(!finite(dt,0,1))throw RangeError('INVALID_DT');
  const m=input.mcp||{},flight=input.flight||{},engines=input.engines||{};
  const out={...previous,revision:previous.revision+1,active:false,reason:'NOT_ACTIVE',
   targetKt:null,iasKt:null,errorKt:null,demandN1:null,engineCount:0,commands:[]};
  const deactivated=(reason)=>{out.reason=reason;out.integral=0;return out;};
  if(m.power!==true)return deactivated('MCP_NOT_POWERED');
  if(m.controls?.atArm!==true)return deactivated('AT_NOT_ARMED');
  if(m.modes?.thrust!=='SPEED')return deactivated('AT_SPEED_NOT_ENGAGED');
  if(m.speedDisplayMode!=='IAS'||m.displayBlank?.speed===true)return deactivated('IAS_TARGET_UNAVAILABLE');
  if(!finite(m.values?.speed,80,450))return deactivated('INVALID_SELECTED_IAS');
  if(flight.airborne===false)return deactivated('ON_GROUND_SPEED_SERVO_INHIBITED');
  if(input.inhibited===true)return deactivated('MANUAL_OVERRIDE');
  if(input.paused===true)return deactivated('SCENARIO_PAUSED');
  if(!finite(flight.iasKt,0,450)||!finite(flight.vsFpm??0,-6000,6000))
   return deactivated('MEASURED_AIRSPEED_UNAVAILABLE');
  const running=ENGINES.filter(id=>engines[id]?.running===true&&
   finite(engines[id]?.n1Percent,0,120)&&finite(engines[id]?.throttle,0,1));
  out.targetKt=m.values.speed;out.iasKt=flight.iasKt;out.errorKt=out.targetKt-out.iasKt;
  out.engineCount=running.length;
  if(!running.length)return deactivated('NO_RUNNING_ENGINES');
  const fresh=previous.active===true&&previous.engineCount===running.length;
  let integral=fresh?previous.integral:0;
  const kp=.75,ki=.006;
  const feedforward=holdN1(out.iasKt,flight.vsFpm??0);
  // Anti-windup: integrate only where the N1 range permits correction,
  // or when the error would move the demand back into the permitted range.
  const unsaturated=feedforward+kp*out.errorKt+ki*integral;
  const wouldWindup=unsaturated>92&&out.errorKt>0||unsaturated<IDLE_N1&&out.errorKt<0;
  if(!wouldWindup)integral=clamp(integral+dt*out.errorKt,-300,300);
  const n1=clamp(feedforward+kp*out.errorKt+ki*integral,IDLE_N1,92);
  const required=throttleForN1(n1);
  const measured=running.reduce((sum,id)=>sum+engines[id].throttle,0)/running.length;
  const baseline=fresh?previous.throttle:measured;
  // Training motorized-thrust-lever rate limit; engine N1 then follows
  // the independent ISN-18 response dynamics.
  const command=clamp(required,baseline-.22*dt,baseline+.22*dt);
  out.active=true;out.reason=running.length<2?'AT_SPEED_SINGLE_ENGINE_TRAINING':'AT_SPEED_ACTIVE';
  out.integral=integral;out.throttle=clamp(command,0,1);out.demandN1=n1;
  out.commands=running.map(engine=>({engine,throttle:out.throttle}));
  return out;
 }
 return Object.freeze({VERSION,initial,step,holdN1,throttleForN1});
});

}catch(error){queueMicrotask(()=>{throw error});}
;await 0;
})();
