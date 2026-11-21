(async()=>{
;
/* ../../engine/instruments/flight-dynamics-gauge-model-v1.js?v=FLIGHT-GAUGE-0001 */
try{
/* Unified B737 Classic flight-to-gauge source mapping, instructor scenario only.
 * Stateless, testable; not a replacement for air data, baro compensation or
 * certified instrument calibration. Dial geometry based on existing photo
 * needle reference: upper pointer 0 deg, IVSI 0 FPM at 9 o'clock (-90deg).
 */
(function(root,factory){'use strict';const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.B737FlightDynamicsGaugesV1=api;
})(typeof globalThis!=='undefined'?globalThis:null,function(){
 'use strict';
 const VERSION='FLIGHT_DYNAMICS_GAUGES_0001';
 const VSI_TICKS=Object.freeze([[0,0],[500,25],[1000,42],[2000,58],[4000,75],[6000,90]]);
 const clamp=(x,a,b)=>Math.min(b,Math.max(a,x));
 const finite=(x,a,b)=>typeof x==='number'&&Number.isFinite(x)&&x>=a&&x<=b;
 function altimeterAngle(ft){
  if(!finite(ft,-2000,65000))throw RangeError('ALTIMETER_ALTITUDE');
  // Hundred-foot needle, one clockwise revolution per 1000 ft.
  return ((ft%1000)+1000)%1000*360/1000;
 }
 function interpolate(x,points){
  const v=clamp(x,points[0][0],points.at(-1)[0]);
  for(let i=1;i<points.length;i++)if(v<=points[i][0]){
   const a=points[i-1],b=points[i];return a[1]+(v-a[0])/(b[0]-a[0])*(b[1]-a[1]);
  }
  return points.at(-1)[1];
 }
 function ivsiAngle(fpm){
  if(!finite(fpm,-10000,10000))throw RangeError('IVSI_FPM');
  return -90+Math.sign(fpm)*interpolate(Math.abs(fpm),VSI_TICKS);
 }
 function sample(frame){
  if(!frame||frame.schema!=='B737_FLIGHT_SCENARIO_STATE_V1'||
   !finite(frame.altitudeFt,-2000,65000)||!finite(frame.iasKt,0,450)||
   !finite(frame.vsFpm,-10000,10000))throw TypeError('INVALID_FLIGHT_INSTRUMENT_SOURCE');
  const altitudeFt=frame.altitudeFt,iasKt=frame.iasKt,vsFpm=frame.vsFpm;
  return Object.freeze({schema:VERSION,source:'UNIFIED_FLIGHT_SCENARIO',
   quality:'TRAINING_SIMULATED',revision:frame.revision,
   altitudeFt,standbyAltitudeFt:altitudeFt,indicatedSpeedKt:iasKt,verticalSpeedFpm:vsFpm,
   altimeterNeedleDeg:altimeterAngle(altitudeFt),standbyNeedleDeg:altimeterAngle(altitudeFt),
   ivsiNeedleDeg:ivsiAngle(vsFpm),
   airspeedPointerKt:clamp(iasKt,60,400),airspeedBelowScale:iasKt<60,
   note:'SIM MSL WITH STANDARD BARO ASSUMPTION; PHOTO NEEDLES UNCALIBRATED'});
 }
 return Object.freeze({VERSION,altimeterAngle,ivsiAngle,sample,VSI_TICKS});
});

}catch(error){queueMicrotask(()=>{throw error});}
;await 0;
;
/* ./flight-instrument-dynamics-v1.js?v=FLT-UI-SLIM-0001 */
try{
/* Unified flight dynamics -> CAPT/FO analog primary flight instruments.
 * Drives existing physical needle APIs (no competing SVG layer or pixel drift).
 * Standby barometric model is independent source, with diagnostic readout until
 * its center-panel mechanical needle registration is photographically verified.
 * Scenario feed is explicitly TRAINING, never an operational sensor.
 */
(function(win){
 'use strict';
 const Model=win.B737FlightDynamicsGaugesV1;
 if(!Model){win.console?.error('Flight dynamics gauge mapping dependency absent');return;}
 const doc=win.document,VERSION='UNIFIED_FLIGHT_GAUGE_BRIDGE_0001';
 const by=id=>doc.getElementById(id);
 let last=null,active=false,previous=null,latest=null,queued=false,paints=0,error=null;
 let accumulatedAltitudeAngle=null;
 const stations=['captain','firstOfficer'];
 const clone=x=>x===null?null:JSON.parse(JSON.stringify(x));
 const validApi=()=>typeof win.B737UnifiedFlightNeedles?.setAngle==='function'&&
  typeof win.B737UnifiedAirspeedPointers?.setAirspeedKts==='function';
 function capture(){
  if(previous||!validApi())return;
  const fn=win.B737UnifiedFlightNeedles,air=win.B737UnifiedAirspeedPointers;
  previous={angles:fn.getAngles(),airspeed:air.getValues()};
 }
 function draw(sample){
  if(!sample||!validApi())return false;
  capture();
  const fn=win.B737UnifiedFlightNeedles,asi=win.B737UnifiedAirspeedPointers;
  const first=accumulatedAltitudeAngle===null;
  if(first)accumulatedAltitudeAngle=sample.altimeterNeedleDeg;
  else{
   const previousWrapped=((accumulatedAltitudeAngle%360)+360)%360;
   const smallestDelta=((sample.altimeterNeedleDeg-previousWrapped+540)%360)-180;
   accumulatedAltitudeAngle+=smallestDelta;
  }
  for(const station of stations){
   if(typeof fn.setContinuousAngle==='function'){
    fn.setContinuousAngle(station,'altimeter',accumulatedAltitudeAngle,{instant:first});
    fn.setContinuousAngle(station,'verticalSpeed',sample.ivsiNeedleDeg,{instant:first});
   }else{
    fn.setAngle(station,'altimeter',sample.altimeterNeedleDeg);
    fn.setAngle(station,'verticalSpeed',sample.ivsiNeedleDeg);
   }
   asi.setAirspeedKts(sample.airspeedPointerKt,station);
  }
  last=sample;active=true;paints++;
  win.dispatchEvent(new CustomEvent('b737:standby-altimeter-sample',{detail:{
   schema:'B737_STANDBY_ALTIMETER_SAMPLE_V1',
   quality:'TRAINING_SIMULATED',source:sample.source,
   altitudeFt:sample.standbyAltitudeFt,needleAngleDeg:sample.standbyNeedleDeg,
   standardBaroAssumption:true,physicalDialRegistration:'PENDING_VERIFIED_GEOMETRY'
  }}));
  return true;
 }
 function schedule(frame){
  latest=frame;
  if(queued)return;
  queued=true;
  win.requestAnimationFrame(()=>{
   queued=false;
   const current=latest;latest=null;
   if(!current)return;
   try{
    if(!draw(Model.sample(current)))error='GAUGE_NOT_READY';
    else error=null;
   }catch(e){error=String(e?.message||e);win.console?.warn('Flight gauge bridge',e);}
  });
 }
 function stopped(){
  latest=null;active=false;last=null;accumulatedAltitudeAngle=null;
  if(previous&&validApi()){
   const fn=win.B737UnifiedFlightNeedles,asi=win.B737UnifiedAirspeedPointers;
   try{
    for(const station of stations){
     for(const key of ['altimeter','verticalSpeed'])
      if(Number.isFinite(previous.angles?.[station]?.[key])){
       const angle=previous.angles[station][key];
       if(typeof fn.setContinuousAngle==='function')
        fn.setContinuousAngle(station,key,angle,{instant:true});
       else fn.setAngle(station,key,angle);
      }
     if(Number.isFinite(previous.airspeed?.[station]?.airspeedKts))
      asi.setAirspeedKts(previous.airspeed[station].airspeedKts,station);
    }
   }catch(e){error='RESTORE: '+String(e?.message||e);}
  }
  previous=null;
  win.dispatchEvent(new CustomEvent('b737:standby-altimeter-sample',{detail:{
   schema:'B737_STANDBY_ALTIMETER_SAMPLE_V1',quality:'UNKNOWN',
   source:'SCENARIO_STOPPED',altitudeFt:null,physicalDialRegistration:'PENDING_VERIFIED_GEOMETRY'
  }}));
 }
 win.addEventListener('b737:flight-scenario-state',event=>{
  if(event.detail?.schema==='B737_FLIGHT_SCENARIO_STATE_V1')schedule(event.detail);
 });
 win.addEventListener('b737:flight-scenario-stopped',stopped);
 function mount(){
  // An active scenario can predate this deferred bundle; attach without
  // requiring a second LOAD press.
  const scn=win.B737UnifiedFlightScenarioV1;
  if(scn?.getDiagnostics?.()?.active===true){
   const snap=scn.getState?.();if(snap)schedule(snap);
  }
 }
 win.addEventListener('b737:cockpit-mounted',mount);
 if(doc.readyState==='loading')doc.addEventListener('DOMContentLoaded',mount,{once:true});
 else mount();
 win.B737UnifiedFlightGaugeBridgeV1=Object.freeze({
  VERSION,getState:()=>({active,sample:clone(last),paints,error,previousCaptured:!!previous,
   registration:{altimeter:['captain','firstOfficer'],airspeed:['captain','firstOfficer'],
    ivsi:['captain','firstOfficer'],standbyAltimeter:'DATA_ONLY_PENDING_DIAL_REGISTRATION'}}),
  update:frame=>draw(Model.sample(frame)),stop:stopped,mount
 });
})(window);

}catch(error){queueMicrotask(()=>{throw error});}
;await 0;
;
/* ./fcc-flight-runtime-v1.js?v=FLT-UI-SLIM-0001&amp;fd=EADI-DIRECT-0002 */
try{
/* Live scenario FCC coupler, EADI F/D source, and FCOM §4.20 A/P protections.
 * Reads only already-modeled flight/airdata and existing MCP AFDS owners.
 * Never asserts LOC, G/S, LNAV, or VNAV capture without signal evidence.
 */
(function(win){
 'use strict';
 const Guidance=win.B737FccFlightGuidanceV1,Protection=win.B737FcomCh4APProtectionV1;
 if(!Guidance||!Protection){win.console.error('FCC/AFDS guidance dependency missing');return;}
 const doc=win.document,by=id=>doc.getElementById(id);
 const VERSION='B737_UNIFIED_FCC_FLIGHT_RUNTIME_0001';
 let fcc=Guidance.createState(),protect=Protection.initial(),last=null;
 let directorServo={pitch:null,roll:null,lastMs:null};
 let owner=null,sourceError=null,lastAp=null,lastProtectionMs=0;
 // Per-seat copy of this FCC's cues for any late avionics-gateway paint.
 let liveDirector={CAPT:null,FO:null},directorAtMs=0;
 const faults={hydA:false,hydB:false,irsL:false,irsR:false,criticalSensor:false,radioAlt:false};
 const clone=x=>JSON.parse(JSON.stringify(x));
 const isActive=()=>win.B737UnifiedFlightScenarioV1?.getDiagnostics?.()?.active===true;
 const mcp=()=>win.B737McpAFDSBridgeV1?.getOutput?.()||null;
 const flight=()=>isActive()?win.B737UnifiedFlightScenarioV1?.getState?.():null;
 function navInput(frame){
  // Not enough evidence that a position/symbol is an active valid FMC leg:
  // do not steer LNAV/VNAV merely because a route was typed into the CDU.
  // MCP HDG SEL, however, has a genuine MAG->TRUE conversion at the current
  // location via WMM2025; never treat magnetic selector as true heading.
  const field=win.B737WMM2025V1?.evaluate?.({
   lat:frame?.lat,lon:frame?.lon,altitudeFt:frame?.altitudeFt});
  return {fmcTrackValid:false,fmcVerticalValid:false,courseTrackValid:false,
   magneticVariationDeg:field?.valid===true?field.declinationDeg:null,
   magneticVariationSource:field?.source??null};
 }
 function guidance(frame,output){
  if(!frame||!output)return null;
  const res=Guidance.evaluate(fcc,output,frame,navInput(frame));
  fcc=res.state;last=res;
  return res;
 }
 function directorPublisher(){
  if(owner)return owner;
  try{
   owner=win.B737UnifiedAvionicsNetworkV1?.connectExternal?.('FCC')||null;
   if(owner)sourceError=null;
  }catch(e){sourceError=String(e?.message||e);win.console.warn('FCC publisher',e);}
  // Retry on later frames if avionics initializes after the flight scenario.
  return owner;
 }
 function paintDirector(frame){
  const out=mcp(),view=guidance(frame,out);
  if(!view)return;
  const p=directorPublisher();
  // The same command demand drives FCC director bars and the flight plant.
  // Limit bar motion independently to avoid abrupt mode-change visual jumps.
  const now=performance.now();
  const dt=directorServo.lastMs===null?.1:
   Math.min(.5,Math.max(0,(now-directorServo.lastMs)/1000));
  directorServo.lastMs=now;
  const slew=(from,to,rate)=>Math.abs(to-from)<=dt*rate?to:
   from+Math.sign(to-from)*dt*rate;
  const showPitch=['captain','firstOfficer'].some(side=>view.fdAxes?.[side]?.pitch);
  const showRoll=['captain','firstOfficer'].some(side=>view.fdAxes?.[side]?.roll);
  const toga=win.B737UnifiedTOGACh4V1?.getState?.();
  const togaGuidance=toga?.phase==='TO'||toga?.phase==='GA';
  // TO/GA guidance remains subject to independent director-axis validity.
  // No blank mode may gain an invented cross-axis command.
  const pitchGoal=togaGuidance?toga.fdPitchDeg:view.pitchCommandDeg;
  const rollGoal=togaGuidance?0:view.rollCommandDeg;
  if(showPitch&&Number.isFinite(pitchGoal))
   directorServo.pitch=directorServo.pitch===null?frame.pitchDeg:
    slew(directorServo.pitch,pitchGoal,2.2);
  else directorServo.pitch=null;
  if(showRoll&&Number.isFinite(rollGoal))
   directorServo.roll=directorServo.roll===null?frame.bankDeg:
    slew(directorServo.roll,rollGoal,5.2);
  else directorServo.roll=null;
  for(const [n,side] of [[1,'captain'],[2,'firstOfficer']]){
   const pitchActive=view.fdAxes?.[side]?.pitch===true;
   const rollActive=view.fdAxes?.[side]?.roll===true;
   const enabled=pitchActive||rollActive;
   const value={enabled,
    pitchDeg:pitchActive?directorServo.pitch:null,
    rollDeg:rollActive?directorServo.roll:null,
    locCaptured:out?.nav?.loc===true,gsCaptured:out?.nav?.gs===true,
    source:'SIMULATED_FCC_FCOM_CH4_TRAINING',seat:side==='captain'?'CAPT':'FO'};
   liveDirector[n===1?'CAPT':'FO']=value;
   if(p)try{
    p.publish('afds.director'+n,value,{quality:'VALID',origin:'TRAINING_SCENARIO'});
   }catch(e){sourceError=String(e?.message||e);owner=null;}
  }
  directorAtMs=now;
  const label=by('flightFccStatus');if(label)label.textContent=
   out?.modes?.autopilot+' · '+view.status+
   (view.reasons.length?' · '+view.reasons.join('; '):'')+
   ' · FD CAPT '+(view.fd.captain?'SHOW':'HIDDEN')+
   ' · FD FO '+(view.fd.firstOfficer?'SHOW':'HIDDEN');
 }
 function releaseDirector(){
  liveDirector={CAPT:null,FO:null};directorAtMs=0;
  if(owner)for(const topic of ['afds.director1','afds.director2'])
   try{owner.publish(topic,{enabled:false,source:'SCENARIO_STOPPED'},
     {quality:'UNKNOWN',origin:'TRAINING_SCENARIO',reason:'SCENARIO_STOPPED'});}catch(_){}
 }
 function follow(frame){
  const out=mcp(),res=guidance(frame,out);
  if(!res)return {actions:[],status:'NO_FCC'};
  return {actions:res.actions,altAcquireConfirmed:res.altAcquireConfirmed,
   altitudeHoldConfirmed:res.altitudeHoldConfirmed,status:res.status,
   reasons:res.reasons,fd:res.fd};
 }
 function disconnect(reason,source='SIMULATED_FCC'){
  const current=mcp();
  if(!/^(CMD|CWS)_[AB]$/.test(current?.modes?.autopilot||''))return false;
  const result=win.B737McpAFDSBridgeV1?.disconnectConfirmed?.({
   reason,source,confirmed:true});
  if(result?.lastAutopilotDisengagement?.reason===reason){
   lastAp={reason,source,timeMs:Date.now()};
   win.dispatchEvent(new CustomEvent('b737:autopilot-disengaged',{
    detail:{schema:'B737_AP_DISENGAGEMENT_V1',...lastAp}}));
   const label=by('flightFccDisconnect');if(label)label.textContent=reason;
   return true;
  }
  return false;
 }
 function protectFlight(frame){
  const now=Date.now();if(now-lastProtectionMs<200)return;
  lastProtectionMs=now;
  const a=mcp();if(!/^(CMD|CWS)_[AB]$/.test(a?.modes?.autopilot||''))return;
   // System-specific hydraulic failure is provided only by source-observed
  // hydraulic data. A simulated <500 PSI threshold is not an AFM trip value.
  // Read full ATA29 *system* pressure, including electric backup pumps.
  // ISN18's generic hydraulics.state currently exposes engine-driven pump
  // pressure only, which must NOT falsely trip an operating electric-pump-fed
  // hydraulic system when an engine is stopped.
  const hydraulicLab=win.B737HydraulicLabV1?.getOutput?.();
  const systemA=hydraulicLab?.pressurePsi?.A;
  const systemB=hydraulicLab?.pressurePsi?.B;
  const hydVerified=Number.isFinite(systemA)&&Number.isFinite(systemB);
  const raSignal=win.B737UnifiedAvionicsNetworkV1?.getSignal?.('airdata.radioAltitude1');
  const irs=win.B737IRSTrainerUnified?.getState?.();
  const left=irs?.units?.L,right=irs?.units?.R;
  const actualLeftFault=left?.phase==='FAULT'||left?.faultLight==='ON'||left?.fault===true;
  const actualRightFault=right?.phase==='FAULT'||right?.faultLight==='ON'||right?.fault===true;
  const obs={radioAltitudeFt:frame?.radioAltitudeFt??raSignal?.value?.heightFt??null,
   hydraulicAAvailable:faults.hydA?false:hydVerified?systemA>=500:null,
   hydraulicBAvailable:faults.hydB?false:hydVerified?systemB>=500:null,
   hydraulicsVerified:faults.hydA||faults.hydB||hydVerified,
   leftIrsFault:faults.irsL||actualLeftFault,
   rightIrsFault:faults.irsR||actualRightFault,
   irsVerified:faults.irsL||faults.irsR||actualLeftFault||actualRightFault,
   criticalSensorFailureVerified:faults.criticalSensor,
   criticalSensorFailed:faults.criticalSensor,
   raFailureVerified:faults.radioAlt||
    raSignal?.quality==='INVALID'&&raSignal.reason==='RADIO_ALTIMETER_FAILED',
   radioAltimeterInoperative:faults.radioAlt||
    raSignal?.quality==='INVALID'&&raSignal.reason==='RADIO_ALTIMETER_FAILED'};
  const v=Protection.evaluate(protect,a,obs,now);protect=v.state;
  if(v.disengage)disconnect(v.reason);
 }
 function confirmedHardware(reason,extra={}){
  const frame=flight(),output=mcp();
  if(!output)return false;
  const ra=win.B737UnifiedAvionicsNetworkV1?.getSignal?.('airdata.radioAltitude1');
  const input={...extra,radioAltitudeFt:frame?.radioAltitudeFt??ra?.value?.heightFt??null,
    hardware:{source:'COCKPIT_HARDWARE',reason,confirmed:true}};
  const result=Protection.evaluate(protect,output,input,Date.now());
  protect=result.state;
  return result.disengage&&disconnect(result.reason,'COCKPIT_HARDWARE');
 }
 // Hydraulic, IRS and electrical protections apply during any powered A/P
 // session, not only when instructor flight dynamics is actively loaded.
 win.setInterval(()=>protectFlight(flight()),400);
 // Qualified scene telemetry shares the same MCP state as physical switches.
 // LVL CHG never derives climb/descent from the button alone; aircraft altitude
 // and observed engine idle establish A/T N1 versus RETARD -> ARM.
 function publishFlightObservation(frame){
  const out=mcp(),bridge=win.B737McpAFDSBridgeV1;
  if(!bridge?.observeFlight||out?.power!==true)return;
  const to=win.B737UnifiedTOGACh4V1?.getState?.();
  const insideTakeoff=to?.phase==='TO';
  const sinceLiftoff=insideTakeoff&&frame.airborne&&
   Number.isFinite(to?.liftoffSec)?Math.max(0,to.elapsedSec-to.liftoffSec):null;
  const all=win.B737ISNCockpitV1?.getPropulsionSnapshot?.()?.engines;
  const observed=Object.values(all||{}).filter(e=>e?.running===true);
  const idle=observed.length>0&&observed.every(e=>Number.isFinite(e.throttle)&&e.throttle<=.06);
  bridge.observeFlight({schema:'B737_AFDS_FLIGHT_OBSERVATION_V1',
   confirmed:true,source:'SIMULATED_FCC',altitudeFt:frame.altitudeFt,
   radioAltitudeFt:frame.radioAltitudeFt,verticalSpeedFpm:frame.vsFpm,
   headingDeg:frame.trueHeadingDeg,bankDeg:frame.bankDeg,pitchDeg:frame.pitchDeg,
   secondsSinceLiftoff:sinceLiftoff,
   establishedEnroute:frame.phase==='AIRBORNE'&&!insideTakeoff,
   thrustIdleConfirmed:idle,
   stabTrimAutopilotNormal:win.B737StabilizerTrim?.getCutouts?.().AUTOPILOT!=='CUTOUT',
   navValid:false,navKind:'NONE'});
 }
 win.addEventListener('b737:flight-scenario-state',e=>{
  const frame=e.detail;
  if(frame?.schema!=='B737_FLIGHT_SCENARIO_STATE_V1'||!isActive())return;
  publishFlightObservation(frame);
  paintDirector(frame);protectFlight(frame);
 });
 win.addEventListener('b737:mcp-afds-state',()=>{
  const frame=flight();if(frame)paintDirector(frame);
 });
 win.addEventListener('b737:flight-scenario-stopped',()=>{
  releaseDirector();fcc=Guidance.createState();protect=Protection.initial();last=null;
  directorServo={pitch:null,roll:null,lastMs:null};
 });
 win.addEventListener('b737:afds-hardware-disconnect',e=>{
  if(e.detail?.source==='MCP_HARDWARE'&&e.detail?.reason==='AP_DISENGAGE_BAR_DOWN')
   confirmedHardware('AP_DISENGAGE_BAR_DOWN');
 });
 win.addEventListener('b737:pilot-ap-disconnect',e=>{
  if(e.detail?.confirmed===true&&e.detail?.source==='COCKPIT_HARDWARE')
   confirmedHardware('CONTROL_WHEEL_AP_DISCONNECT');
 });
 win.addEventListener('b737:pilot-trim-command',e=>{
  if(e.detail?.confirmed===true&&e.detail?.source==='COCKPIT_HARDWARE')
   confirmedHardware('CONTROL_WHEEL_TRIM');
 });
 win.addEventListener('b737:stab-trim-autopilot-cutout',e=>{
  if(e.detail?.confirmed!==true||!['NORMAL','CUTOUT'].includes(e.detail.position))return;
  const cutout=e.detail.position==='CUTOUT';
  if(cutout)confirmedHardware('STAB_TRIM_AUTOPILOT_CUTOUT');
  win.B737McpAFDSBridgeV1?.observeFlight?.({
   schema:'B737_AFDS_FLIGHT_OBSERVATION_V1',source:'SIMULATED_FCC',
   confirmed:true,stabTrimAutopilotNormal:!cutout
  });
 });
 win.addEventListener('b737:toga-pressed',e=>{
  if(e.detail?.confirmed===true&&e.detail?.source==='COCKPIT_HARDWARE')
   confirmedHardware('TOGA_BELOW_2000_RA',{touchdown:e.detail?.touchdown===true});
 });
 win.B737UnifiedFccFlightV1=Object.freeze({
  VERSION,follow,
  getDirector:seat=>{
   const key=String(seat).toUpperCase()==='FO'?'FO':'CAPT';
   if(!isActive()||!directorAtMs||performance.now()-directorAtMs>1500)return null;
   return liveDirector[key]?{...liveDirector[key]}:null;
  },
  getState:()=>({fcc:clone(fcc),protection:clone(protect),last:clone(last),
   lastDisengagement:lastAp?{...lastAp}:null,sourceError,faults:{...faults}}),
  disconnectConfirmed:confirmedHardware,protectionSample:sample=>{
   const result=Protection.evaluate(protect,mcp(),sample,Date.now());
   protect=result.state;
   return result.disengage?disconnect(result.reason):false;
  }});
})(window);

}catch(error){queueMicrotask(()=>{throw error});}
;await 0;
})();
