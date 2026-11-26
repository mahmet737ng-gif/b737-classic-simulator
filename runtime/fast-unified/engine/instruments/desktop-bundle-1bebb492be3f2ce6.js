(async()=>{
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
  const fmc=m.modes?.thrust==='FMC_SPD'&&m.modes?.vertical==='VNAV'&&m.fmcGuidance?.vertical===true;
  if(m.modes?.thrust!=='SPEED'&&!fmc)return deactivated('AT_SPEED_NOT_ENGAGED');
  if(!fmc&&(m.speedDisplayMode!=='IAS'||m.displayBlank?.speed===true))return deactivated('IAS_TARGET_UNAVAILABLE');
  const target=fmc?m.fmcGuidance.targetKt:m.values?.speed;
  if(!finite(target,80,450))return deactivated('INVALID_SELECTED_IAS');
  if(flight.airborne===false)return deactivated('ON_GROUND_SPEED_SERVO_INHIBITED');
  if(input.inhibited===true)return deactivated('MANUAL_OVERRIDE');
  if(input.paused===true)return deactivated('SCENARIO_PAUSED');
  if(!finite(flight.iasKt,0,450)||!finite(flight.vsFpm??0,-6000,6000))
   return deactivated('MEASURED_AIRSPEED_UNAVAILABLE');
  const running=ENGINES.filter(id=>engines[id]?.running===true&&
   finite(engines[id]?.n1Percent,0,120)&&finite(engines[id]?.throttle,0,1));
  out.targetKt=target;out.iasKt=flight.iasKt;out.errorKt=out.targetKt-out.iasKt;
  out.engineCount=running.length;
  if(!running.length)return deactivated('NO_RUNNING_ENGINES');
  const fresh=previous.active===true&&previous.engineCount===running.length;
  let integral=fresh?previous.integral:0;
  const kp=.75,ki=.006;
  const feedforward=holdN1(out.iasKt,flight.vsFpm??0);
  // Anti-windup: integrate only where the N1 range permits correction,
  // or when the error would move the demand back into the permitted range.
  const limit=finite(input.n1LimitPct,IDLE_N1,120)?input.n1LimitPct:92;
  const unsaturated=feedforward+kp*out.errorKt+ki*integral;
  const wouldWindup=unsaturated>limit&&out.errorKt>0||unsaturated<IDLE_N1&&out.errorKt<0;
  if(!wouldWindup)integral=clamp(integral+dt*out.errorKt,-300,300);
  const n1=clamp(feedforward+kp*out.errorKt+ki*integral,IDLE_N1,limit);
  const required=throttleForN1(n1);
  const measured=running.reduce((sum,id)=>sum+engines[id].throttle,0)/running.length;
  const baseline=fresh?previous.throttle:measured;
  // Training motorized-thrust-lever rate limit; engine N1 then follows
  // the independent ISN-18 response dynamics.
  const command=Math.min(throttleForN1(limit),clamp(required,baseline-.22*dt,baseline+.22*dt));
  out.active=true;out.reason=running.length<2?'AT_SPEED_SINGLE_ENGINE_TRAINING':'AT_SPEED_ACTIVE';
  out.integral=integral;out.throttle=clamp(command,0,1);out.demandN1=n1;
  out.commands=running.map(engine=>({engine,throttle:out.throttle}));
  return out;
 }
 return Object.freeze({VERSION,initial,step,holdN1,throttleForN1});
});

}catch(error){queueMicrotask(()=>{throw error});}
;await 0;
;
/* ./autothrottle-unified-v1.js?v=FLT-UI-SLIM-0001 */
try{
/* Unified A/T SPEED -> shared ISN-18 ENG 1+2 -> flight speed feedback v1.
 * The MCP mode core is authoritative. Never energize a stopped engine or
 * manufacture indications. Instructor RUNNING preset requires explicit click.
 */
(function(win){
 'use strict';
 const Servo=win.B737AutothrottleSpeedServoV1,VERSION='UNIFIED_AT_ENGINE_BRIDGE_0001';
 if(!Servo){win.console?.error('A/T servo dependency missing');return;}
 const doc=win.document,by=id=>doc.getElementById(id);
 let state=Servo.initial(),last=0,manualOverride=false,errors=[],lastCommands={};
 const clone=x=>JSON.parse(JSON.stringify(x));
 function activeMode(m){
  return m?.power===true&&m.controls?.atArm===true&&(m.modes?.thrust==='SPEED'||m.modes?.thrust==='FMC_SPD'&&m.fmcGuidance?.vertical===true);
 }
 function getSources(){
  const mcp=win.B737McpAFDSBridgeV1?.getOutput?.()||null;
  const scenario=win.B737UnifiedFlightScenarioV1;
  const status=scenario?.getDiagnostics?.();
  const flight=status?.active===true?scenario.getState?.():null;
  const owner=win.B737ISNCockpitV1;
  // Keep idle-window overhead negligible: ISN ECU snapshots contain large
  // diagnostics trees and are only required when A/T can run or panel is open.
  const needEngines=activeMode(mcp);
  const propulsion=needEngines?owner?.getPropulsionSnapshot?.():null;
  const chain=needEngines&&!propulsion?owner?.getStartState?.():null;
  const ecu=needEngines&&!propulsion?owner?.getECUState?.():null;
  const engines={};
  for(const n of [1,2]){
   const id='engine'+n;
   engines[id]=propulsion?.engines?.[id]?
    {...propulsion.engines[id]}:
    {running:chain?.phase?.[id]==='RUNNING',
     n1Percent:ecu?.engines?.[id]?.n1Percent??null,
     throttle:chain?.runningEnvelope?.throttle?.[id]??null};
  }
  // When the Scenario Lab is not running, accept only a VALID ADC source.
  // The external producer remains responsible for moving IAS in that case.
  const network=win.B737UnifiedAvionicsNetworkV1;
  const adc=!flight&&activeMode(mcp)?network?.getSignal?.('airdata.adc1'):null;
  const airGround=!flight&&activeMode(mcp)?network?.getSignal?.('aircraft.airground'):null;
  const ias=Number.isFinite(flight?.iasKt)?flight.iasKt:
   adc?.quality==='VALID'?(adc.value?.iasKt??adc.value?.casKt):null;
  const airborne=flight?flight.airborne:
   airGround?.quality==='VALID'&&airGround.value?.onGround===true?false:null;
  return {mcp,flight:{iasKt:ias,vsFpm:flight?.vsFpm??0,airborne},
   engines,scenarioActive:status?.active===true,paused:status?.paused===true,
   ecu,owner};
 }
 function notify(){
  win.dispatchEvent(new CustomEvent('b737:autothrottle-speed-state',{detail:clone(state)}));
 }
 function tick(){
  const now=performance.now();
  const dt=last?Math.min(.5,Math.max(0,(now-last)/1000)):.2;
  last=now;
  const src=getSources();
  if(!activeMode(src.mcp)){manualOverride=false;lastCommands={};}
  try{
   state=Servo.step(state,{dtSec:dt,mcp:src.mcp,flight:src.flight,
    engines:src.engines,paused:src.paused,inhibited:manualOverride,n1LimitPct:win.B737PerformanceEngineV07?.coupledLimits?.()?.atLimitPct});
   if(state.active){
    if(typeof src.owner?.autoThrottleCommand!=='function'){
     state={...state,active:false,reason:'ISN18_THROTTLE_INTERFACE_MISSING',commands:[]};
    }else for(const command of state.commands){
     if(Math.abs(command.throttle-(lastCommands[command.engine]??-1))<.008)continue;
     const result=src.owner.autoThrottleCommand({
      engine:command.engine,value:command.throttle,controller:Servo.VERSION});
     if(result?.accepted!==true){
      state={...state,active:false,reason:result?.reason||'ENGINE_THROTTLE_REJECTED',commands:[]};
      break;
     }
     lastCommands[command.engine]=command.throttle;
     const number=command.engine==='engine1'?1:2;
     // This is a photo sprite only. The real ECU has already accepted the
     // continuous throttle; visually it is quantized to five photo stages.
     doc.dispatchEvent(new CustomEvent('b737:throttle-state',{detail:{
      engine:number,percent:command.throttle*100,source:'A/T SPEED',visualOnly:true}}));
    }
   }
  }catch(error){
   const message=String(error?.message||error);
   if(errors.at(-1)!==message){errors.push(message);if(errors.length>12)errors.shift();}
   state={...state,active:false,reason:'A/T_COMMAND_ERROR: '+message,commands:[]};
  }
  notify();
 }
 function manualIntervention(event){
  const d=event?.detail;
  if(![1,2].includes(d?.engine)&&!['engine1','engine2'].includes(d?.engine))return;
  if(!Number.isFinite(d.percent)&&!Number.isFinite(d.throttle))return;
  if(activeMode(win.B737McpAFDSBridgeV1?.getOutput?.()))manualOverride=true;
 }
 doc.addEventListener('b737:throttle-position',manualIntervention);
 win.addEventListener('b737:manual-engine-throttle',manualIntervention);
 const publicApi=Object.freeze({
  getState:()=>clone(state),getDiagnostics:()=>({version:VERSION,manualOverride,errors:[...errors]}),
  tickForTest:tick,resetManualOverride:()=>{manualOverride=false;},
  version:VERSION
 });
 win.B737UnifiedAutothrottleV1=publicApi;
 function boot(){
  win.setInterval(tick,200);
 }
 if(doc.readyState==='loading')doc.addEventListener('DOMContentLoaded',boot,{once:true});
 else boot();
})(window);

}catch(error){queueMicrotask(()=>{throw error});}
;await 0;
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
try{
/* Simulator-only FMC guidance. FCOM SHI 4.10.6-7, 4.10.13.
 * Uses executed, typed source legs only. Numerical gains/TOD are training estimates,
 * not Boeing performance or control-law data. No interface to real aircraft.
 */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.B737FmcTrainingGuidanceV1=api;})(typeof globalThis==='object'?globalThis:null,function(){
 'use strict';
 const finite=Number.isFinite,clamp=(x,a,b)=>Math.min(b,Math.max(a,x)),norm=x=>(x%360+360)%360,delta=(a,b)=>((b-a+540)%360)-180;
 const coord=p=>p&&finite(p.lat)&&finite(p.lon)&&Math.abs(p.lat)<=90&&Math.abs(p.lon)<=180&&!(p.lat===0&&p.lon===0);
 const vec=(a,b)=>({x:delta(a.lon,b.lon)*60*Math.cos(a.lat*Math.PI/180),y:(b.lat-a.lat)*60});
 const length=p=>Math.hypot(p.x,p.y),bearing=p=>norm(Math.atan2(p.x,p.y)*180/Math.PI),dot=(a,b)=>a.x*b.x+a.y*b.y,cross=(a,b)=>a.x*b.y-a.y*b.x;
 const alt=v=>{const m=/^(FL)?(\d{2,5})([AB])?$/.exec(String(v||''));if(!m)return null;const ft=Number(m[2])*(m[1]?100:1);return ft<=41000?{ft,restriction:m[3]||''}:null;};
 const speed=v=>{const x=String(v||'').split('/')[0];return /^\d{2,3}$/.test(x)&&Number(x)>=100&&Number(x)<=350?Number(x):null;};
 function compile(session,source){
  const a=session?.active||{},origin=a.ORIGIN,dest=a.DEST;
  if(session?.routeActivated!==true||!origin||!dest||origin===dest||source?.connected!==true||(source.activeContext?.origin??source.origin)!==origin||(source.activeContext?.destination??source.destination)!==dest)return null;
  const bank=source.active,geo=bank?.geometries||{},legs=[];let previous=null;
  const validFix=(p)=>coord(p)&&typeof p.ident==='string'&&/^[A-Z0-9._-]{1,24}$/.test(p.ident);
  const start=geo['RUNWAY_DEP@'+origin]?.fixes?.[0]||session.activeNavFixEvidence?.ORIGIN;
  if(validFix(start))previous={lat:start.lat,lon:start.lon,ident:start.ident};
  function gap(reason){if(legs.at(-1)?.type!=='GAP')legs.push({type:'GAP',reason});previous=null;}
  function fixed(p,raw={},kind='RTE'){
   if(!validFix(p)){gap('UNVERIFIED_FIX');return;}
   if(previous?.ident===p.ident&&length(vec(previous,p))<.05)return;
   const af=Number(raw.Altitude??raw.alt),sf=Number(raw.Speed??raw.speed),r=raw.AltitudeRestriction??raw.restriction;
   legs.push({type:'FIX',ident:p.ident,lat:p.lat,lon:p.lon,from:previous,
    kind,turnDir:['Left','Right'].includes(raw.Sp_Turn??raw.turn)?raw.Sp_Turn??raw.turn:null,altitude:finite(af)&&af>0?{ft:af,restriction:r==='above'?'A':r==='below'?'B':''}:null,
    speed:finite(sf)&&sf>=100&&sf<=350?sf:null,flyOver:/over/i.test(String(raw.Flytype??raw.Fly??raw.fly??''))});
   previous={ident:p.ident,lat:p.lat,lon:p.lon};
  }
  function append(g,kind){
   const raw=g?.program?.input?.legs;
   if(g?.program?.version!=='IRAN-ROUTE-PREVIEW-V2'||!Array.isArray(raw)){gap('UNSUPPORTED_PROCEDURE');return;}
   for(const [rawIndex,l] of raw.entries()){
    const t=l.Type??l.type,id=l.Name??l.ident,lat=Number(l.Latitude??l.lat),lon=Number(l.Longitude??l.lon);
    if(t==='Runway'&&kind==='SID'&&!legs.length){if(validFix({ident:id,lat,lon}))previous={ident:id,lat,lon};continue;}
    if(t==='Hold'){
     const published=globalThis.B737RouteEngine?.publishedHold?.(l,g,rawIndex,origin,dest);
     if(!published){gap('INVALID_PUBLISHED_HOLD');continue;}
     fixed({ident:id,lat,lon},l,kind);const target=legs.at(-1);if(target?.type!=='FIX'||target.ident!==id){gap('INVALID_HOLD_FIX');continue;}
     let override=null;try{override=JSON.parse(a[published.key]);}catch(_){}
     if(override?.deleted!==true){const h={...published,...override,key:published.key,ident:published.ident,lat:published.lat,lon:published.lon,origin,dest,published:true};if(!finite(h.inbound)||!['L','R'].includes(h.dir)){gap('INVALID_HOLD_OVERRIDE');continue;}target.hold=h;target.flyOver=true;}
     continue;
    }
    if(t==='Normal'||t==='Runway'){fixed({ident:id,lat,lon},l,kind);continue;}
    if(t==='ConstHdgtoAlt'){
     const h=Number(l.Hdg_Crs_value??l.heading),target=Number(l.Altitude??l.alt);
     if(!finite(h)||h<0||h>360||!finite(target)||target<0||target>41000){gap('INVALID_CONDITIONAL');continue;}
     legs.push({type:'ALTITUDE',kind,ident:'('+target+')',headingMag:norm(h),altitude:{ft:target,restriction:'A'},from:previous,climb:kind==='SID'});previous=null;continue;
    }
    if(['DmeIntc','VorRadialIntc','Intc'].includes(t)){
     const h=Number(l.Hdg_Crs_value??l.heading),d=Number(l.DMEtoIntercept??l.dme),radial=Number(l.RadialtoIntercept??l.radial),ref={lat,lon,ident:id};
     if(!coord(ref)||!finite(h)||h<0||h>360||!(t==='DmeIntc'?finite(d)&&d>0:finite(radial)&&radial>=0&&radial<=360)){gap('INVALID_INTERCEPT');continue;}
     legs.push({type:t==='DmeIntc'?'DME':'RADIAL',kind,ident:t==='DmeIntc'?'('+id+'-'+d+')':t==='Intc'?'(INTC)':'('+id+String(radial).padStart(3,'0')+')',headingMag:norm(h),station:ref,from:previous,target:t==='DmeIntc'?d:norm(radial)});previous=null;continue;
    }
    gap(t==='Discontinuity'?'ROUTE_DISCONTINUITY':'UNSUPPORTED_'+String(t));
   }
  }
  if(bank?.selections?.['SID@'+origin])append(geo['SID@'+origin],'SID');
  const rows=Object.keys(a).map(k=>/^TO(\d+)$/.exec(k)).filter(Boolean).map(m=>Number(m[1])).sort((x,y)=>x-y);
  for(const n of rows){const g=geo['RTE@'+n],to=a['TO'+n];if(!to)continue;
   if(g?.program?.input?.legs?.length&&g.fixes?.at(-1)?.ident===to)append(g,'RTE');
   else {const evidence=session.activeNavFixEvidence?.['TO'+n];if((!a['VIA'+n]||['DIRECT','DCT'].includes(a['VIA'+n]))&&evidence?.ident===to)fixed(evidence);else gap('UNVERIFIED_AIRWAY');}
  }
  for(const kind of ['STAR','APP'])if(bank?.selections?.[kind+'@'+dest])append(geo[kind+'@'+dest],kind);
  if(!legs.length)return null;
  // User-entered constraints override the same executed row, never MOD.
  for(let i=0;i<legs.length;i++){const l=legs[i];if(!l.ident)continue;const key='LEG_CONSTRAINT_'+[origin,dest,i,l.ident].join('_').replace(/[^A-Z0-9_]/g,'_');const v=a[key];if(typeof v==='string'){const [s,h]=v.split('/');l.speed=speed(s)??l.speed;l.altitude=alt(h)??l.altitude;}}
  for(let i=1;i<=5;i++){
   const key='HOLD_'+i;let hold;try{hold=JSON.parse(a[key]);}catch(_){continue;}
   if(!coord(hold)||!finite(hold.inbound)||hold.inbound<0||hold.inbound>=360||!['L','R'].includes(hold.dir)||hold.origin!==origin||hold.dest!==dest)continue;
   const same=(l,p)=>l.type==='FIX'&&p&&l.ident===p.ident&&length(vec(l,p))<.05;
   if(hold.ppos){const matches=legs.map((l,j)=>same(l,hold.anchor)?j:-1).filter(j=>j>=0);if(matches.length!==1)continue;const j=matches[0];legs.splice(j,0,{type:'FIX',kind:'RTE',ident:'PPOS',lat:hold.lat,lon:hold.lon,from:null,flyOver:true,hold:{...hold,key}});}
   else{const matches=legs.filter(l=>same(l,hold));if(matches.length!==1)continue;matches[0].hold={...hold,key};matches[0].flyOver=true;}
  }
  return {origin,dest,legs,revision:session.routeRevision||0,performance:{...a},destinationPoint:geo['RUNWAY_ARR@'+dest]?.fixes?.[0]||session.activeNavFixEvidence?.DEST||null};
 }
 function segment(from,to,p,heading){
  const ab=vec(from,to),ap=vec(from,p),len=length(ab);if(len<.001)return null;
  const u={x:ab.x/len,y:ab.y/len},along=dot(ap,u),xtk=cross(u,ap);
  const nearest=clamp(along,0,len),dist=length({x:ap.x-u.x*nearest,y:ap.y-u.y*nearest});
  const course=bearing(u),hd=heading*Math.PI/180,h={x:Math.sin(hd),y:Math.cos(hd)},den=cross(h,u);
  const t=Math.abs(den)>1e-6?cross({x:-ap.x,y:-ap.y},u)/den:Infinity;
  const intersection=finite(t)?dot({x:ap.x+h.x*t,y:ap.y+h.y*t},u):Infinity;
  const engage=dist<=3||(Math.abs(delta(heading,course))<=90&&t>=0&&intersection>=0&&intersection<len);
  return {len,along,xtk,course,engage,track:norm(course+clamp(Math.atan2(xtk,Math.max(1,Math.min(4,len-along)))*180/Math.PI,-45,45))};
 }

 // TRAINING ESTIMATES ONLY. No Boeing drag/thrust/fuel/ECON tables supplied.
 // ISA pressure and compressible CAS/Mach conversion, not an actual-aircraft performance database.
 function atmosphere(ft,isa=0){
  const h=clamp(ft,0,41000)*.3048,base=Math.min(h,11000),T=288.15-.0065*base,p=101325*Math.pow(T/288.15,5.25588)*Math.exp(-Math.max(0,h-11000)*9.80665/(287.05287*216.65));
  return {p,T:Math.max(150,T+isa)};
 }
 function casAtMach(m,ft){const {p}=atmosphere(ft),q=p*(Math.pow(1+.2*m*m,3.5)-1);return 661.4788*Math.sqrt(5*(Math.pow(1+q/101325,2/7)-1));}
 function tasAtCas(cas,ft,isa){const {p,T}=atmosphere(ft,isa),q=101325*(Math.pow(1+.2*Math.pow(cas/661.4788,2),3.5)-1),m=Math.sqrt(5*(Math.pow(1+q/p,2/7)-1));return m*Math.sqrt(1.4*287.05287*T)/.514444;}
 const num=v=>/^\d+(?:\.\d+)?$/.test(String(v??''))?Number(v):null;
 const signedNum=v=>/^[+-]?\d+(?:\.\d+)?$/.test(String(v??''))?Number(v):null;
 function perfInputs(a,fuelKg){
  const [g,c]=String(a.GW_CG||'').split('/'),z=num(a.ZFW),f=finite(fuelKg)&&fuelKg>=0?fuelKg:num(a.FUEL)!==null?num(a.FUEL)*1000:null;
  const gw=z!==null&&f!==null?z*1000+f:num(g)!==null?num(g)*1000:null,crz=alt(a.CRZ_ALT)?.ft??null,ci=num(a.CI),res=num(a.RESERVES);
  const [wd,ws]=String(a.CRZ_WIND||'').split('/').map(num),std=crz!==null?15-1.9812*Math.min(crz,36089)/1000:null;
  const isa=a.PERF_TEMP_SOURCE==='OAT'&&std!==null&&signedNum(a.TC_OAT)!==null?signedNum(a.TC_OAT)-std:signedNum(a.ISA_DEV)??0;
  return {gw,z,fuelKg:f,cg:num(c)??18.5,ci,res,crz,isa,windFromDeg:wd??0,windKt:ws??0,transitionAltitudeFt:alt(a.TRANS_ALT)?.ft??18000,
   ready:finite(gw)&&gw>0&&f!==null&&gw>f&&finite(crz)&&crz>0&&Number.isInteger(ci)&&ci>=0&&ci<=200&&res!==null&&res>=0&&res<=99.9};
 }
 function speedBounds(a,phase,ft){
  const prefix=phase==='CLIMB'?'CLB':phase==='DESCENT'?'DES':'CRZ';
  const parse=(v,d)=>{const x=String(v||d).split('/');return [num(x[0]),/^\.\d{2,3}$/.test(x[1]||'')?Number(x[1]):null];};
  const lo=parse(a[prefix+'_MIN'],'210/.400'),hi=parse(a[prefix+'_MAX'],'340/.820');
  if([...lo,...hi].some(x=>x===null))return null;
  const max=Math.min(340,hi[0],casAtMach(Math.min(.82,hi[1]),ft));
  // The CAS/Mach crossover is the lesser speed of each schedule.
  const min=Math.min(lo[0],casAtMach(lo[1],ft));
  return min<=max?{min,max,prefix}:null;
 }
 function phaseSpeed(a,d,phase,ft,track,leg){
  const b=speedBounds(a,phase,ft);if(!b||!d.ready)return null;
  const raw=String(a[b.prefix+'_SPEED']||'').split('/')[0];
  const manual=/^\.\d{2,3}$/.test(raw)?casAtMach(Number(raw),ft):speed(raw);
  const wind=d.windKt*Math.cos(delta(track??0,d.windFromDeg)*Math.PI/180);
  // Heuristic school-trainer schedule; deliberately separate from certified predictions.
  const rangeCas=(phase==='CLIMB'?250:phase==='DESCENT'?250:255)*Math.sqrt(d.gw/50000);
  const range=Math.max(190,Math.min(rangeCas,casAtMach(.70,ft)));
  const fast=Math.max(range,Math.min(320,casAtMach(.80,ft)));
  const econ=clamp(range+(fast-range)*d.ci/200+Math.max(0,wind)*.07-Math.max(0,-wind)*.035,range,Math.max(range,fast));
  let target=manual!==null?Math.min(manual,340,casAtMach(.82,ft)):clamp(econ,b.min,b.max);
  const rest=/^(\d{2,3})\/(\d{3,5})$/.exec(String(a[b.prefix+'_REST']||''));
  if(rest&&ft<Number(rest[2]))target=Math.min(target,Number(rest[1]));
  else if(ft<10000&&manual===null)target=Math.min(target,250);
  if(finite(leg?.speed)&&leg.speed>0)target=Math.min(target,leg.speed);
  return {targetKt:Math.round(target),source:manual!==null?'MANUAL':'ECON_TRAINING',bounds:b,wind};
 }
 function routeForecast(plan,index,frame,conditions){
  const a=plan.performance,d=perfInputs(a,conditions.fuelKg),api=globalThis.B737TrajectoryPredictorV1;
  const empty={quality:'UNAVAILABLE',ready:false,reason:'PERF_OR_TRAJECTORY_REQUIRED',waypoints:[],destination:null};
  if(!d.ready||!coord(frame)||!api)return empty;
  let prev=frame,complete=true;const legs=[];
  for(let j=index;j<plan.legs.length;j++){
   const l=plan.legs[j];if(l.type!=='FIX'||!coord(l)||l.hold){complete=false;break;}
   const v=vec(prev,l),nm=length(v),course=bearing(v);
   const al=l.altitude?String(l.altitude.ft)+(l.altitude.restriction||''):'-----';
   legs.push({ident:l.ident,index:j,segmentNm:nm,courseTrueDeg:course,constraint:(l.speed??'----')+'/'+al,lat:l.lat,lon:l.lon});prev=l;
  }
  if(!legs.length)return empty;
  if(complete&&coord(plan.destinationPoint)){
   const v=vec(prev,plan.destinationPoint),nm=length(v);
   if(nm>.01)legs.push({ident:plan.dest,index:plan.legs.length,segmentNm:nm,courseTrueDeg:bearing(v),lat:plan.destinationPoint.lat,lon:plan.destinationPoint.lon});
  }else complete=false;
  const airport=globalThis.B737FlightScenarioCoreV1?.AIRPORTS?.[plan.dest];
  const elevation=[plan.destinationPoint?.elevationFt,airport?.elevationFt,airport?.elevation,airport?.altitudeFt].find(finite);
  const endFt=elevation??0;
  return api.solve({legs,startFt:frame.altitudeFt,endFt,crz:d.crz,gw:d.gw,fuelKg:d.fuelKg,ci:d.ci,isa:d.isa,windFromDeg:d.windFromDeg,windKt:d.windKt,transitionAltitudeFt:d.transitionAltitudeFt,nowMs:conditions.utcMs,origin:plan.origin,dest:plan.dest,complete,reservesKg:d.res*1000,onGround:frame.airborne===false,assumedDestinationAltitude:elevation===undefined,
   speedAt:(phase,ft,course,weight,restriction)=>phaseSpeed(a,{...d,gw:weight},phase,ft,course,{speed:restriction?.speed})?.targetKt})??empty;
 }
 function rtaCommand(plan,index,frame,conditions,forecast,selected){
  const a=plan.performance,wpt=a.RTA_WPT;if(!wpt||!a.RTA_TIME||!finite(conditions.utcMs)||!selected||!forecast.ready)return null;
  const matches=forecast.waypoints.filter(x=>x.ident===wpt);if(matches.length!==1||!forecast.complete)return null;
  const x=matches[0],legs=forecast.waypoints.filter(y=>y.index<=x.index);
  // Constant-altitude cruise RTA approximation only; no climb/descent/hold solve.
  if(!frame.airborne||legs.some(y=>y.phase!=='CRUISE')||Math.abs(frame.altitudeFt-forecast.crz)>500)return null;
  const match=/^(\d{2})(\d{2})(?:(\d{2}))?([AB])?$/.exec(a.RTA_TIME);if(!match)return null;
  const day=new Date(conditions.utcMs);day.setUTCHours(+match[1],+match[2],+(match[3]||0),0);
  let t=day.getTime();if(t<conditions.utcMs-12*3600000)t+=86400000;
  const seconds=(t-conditions.utcMs)/1000,tol=num(a.RTA_TOL)??30,b=selected.bounds;
  if(seconds<=0||!b)return {wpt,targetMs:t,errorSec:(x.etaMs-t)/1000,toleranceSec:tol,status:'UNABLE RTA',targetKt:selected.targetKt};
  const travel=cas=>legs.reduce((sum,l)=>{
   const restricted=finite(l.speedRestrictionKt)?Math.min(cas,l.speedRestrictionKt):cas;
   const wind=forecast.windKt*Math.cos(delta(l.courseTrueDeg,forecast.windFromDeg)*Math.PI/180);
   const gs=tasAtCas(restricted,frame.altitudeFt,forecast.isa)-wind;
   return gs>30?sum+l.segmentNm/gs*3600:Infinity;
  },0);
  const error=travel(selected.targetKt)-seconds;
  const within=err=>Math.abs(err)<=tol||match[4]==='A'&&err>=-tol||match[4]==='B'&&err<=tol;
  let lo=b.min,hi=b.max;
  for(let i=0;i<22;i++){const mid=(lo+hi)/2;if(travel(mid)>seconds)lo=mid;else hi=mid;}
  const target=within(error)?selected.targetKt:Math.round((lo+hi)/2);
  const predicted=travel(target),after=predicted-seconds;
  const unable=!within(travel(b.min)-seconds)&&!within(travel(b.max)-seconds)&&(seconds>travel(b.min)+tol||seconds<travel(b.max)-tol);
  const status=within(after)?'ON TIME':unable?'UNABLE RTA':after>0?'LATE':'EARLY';
  return {wpt,targetMs:t,errorSec:after,toleranceSec:tol,status,targetKt:target,distanceNm:x.distanceNm,eta:finite(predicted)?new Date(conditions.utcMs+predicted*1000).toISOString().slice(11,16).replace(':','')+'Z':null,quality:'TRAINING_ESTIMATE'};

 }

 function vertical(plan,leg,frame,mcp,index,remaining,liveFuel,conditions={}){
  const a=plan.performance,crz=alt(a.CRZ_ALT),m=mcp?.values?.altitude,now=frame.altitudeFt;
  const numeric=x=>/^\d+(?:\.\d+)?$/.test(String(x??'').split('/')[0])?Number(String(x).split('/')[0]):null;
  const z=numeric(a.ZFW),gw=numeric(a.GW_CG),fuel=finite(liveFuel)&&liveFuel>=0?liveFuel/1000:numeric(a.FUEL);
  const ci=numeric(a.CI),res=numeric(a.RESERVES);
  const ready=crz&&crz.ft>0&&finite(m)&&finite(now)&&fuel!==null&&fuel>=0&&(z!==null&&z>0||gw!==null&&gw>fuel)&&res!==null&&res>=0&&res<=99.9&&ci!==null&&Number.isInteger(ci)&&ci>=0&&ci<=200&&finite(frame.radioAltitudeFt)&&frame.radioAltitudeFt>=400&&frame.airborne===true;
  if(!ready)return {valid:false,engage:false,reason:'PERF_INIT_OR_RA_REQUIRED'};
  let distance=remaining,nextConstraint=null;
  for(let i=index;i<plan.legs.length;i++){
   const l=plan.legs[i];if(l.type==='GAP')break;
   if(i>index){if(l.type!=='FIX'||!coord(l.from))break;distance+=length(vec(l.from,l));}
   if(['STAR','APP','RTE'].includes(l.kind)&&l.altitude&&l.altitude.ft<crz.ft-200&&l.altitude.restriction!=='A'){nextConstraint={...l.altitude,distance};break;}
  }
  const tod=nextConstraint?Math.max(0,(now-nextConstraint.ft)/318):null;
  const descent=nextConstraint&&leg.kind!=='SID'&&now>nextConstraint.ft+100&&nextConstraint.distance<=tod+1&&m<now-50&&(now>=crz.ft-100||conditions.wasDescending===true||['STAR','APP'].includes(leg.kind));
  let target=crz.ft,phase=now<crz.ft-100?'CLIMB':'CRUISE';
  if(descent){phase='DESCENT';target=nextConstraint.ft;}
  if(phase==='CLIMB'&&leg.altitude&&leg.altitude.restriction!=='A')target=Math.min(target,leg.altitude.ft);
  if(phase==='CLIMB'&&leg.type==='ALTITUDE'&&crz.ft<leg.altitude.ft)return {valid:false,engage:false,reason:'CRZ_ALT_BELOW_CONDITIONAL'};
  if(phase==='DESCENT'&&leg.altitude&&leg.altitude.restriction==='A')target=Math.max(target,leg.altitude.ft);
  const opposed=(target-now)*(m-now)<-2500&&phase!=='CRUISE';
  if(opposed)return {valid:false,engage:false,reason:'MCP_FMC_ALTITUDES_OPPOSED'};
  const commanded=phase==='CLIMB'?Math.min(target,m):phase==='DESCENT'?Math.max(target,m):crz.ft;
  const d=perfInputs(a,liveFuel),track=coord(leg)?bearing(vec(frame,leg)):frame.trueHeadingDeg;
  const selected=phaseSpeed(a,d,phase,now,track,leg);
  if(!selected)return {valid:false,engage:false,reason:'PERFORMANCE_SPEED_UNAVAILABLE'};
  const forecast=conditions.forecast??routeForecast(plan,index,frame,{...conditions,fuelKg:liveFuel});
  const rta=phase==='CRUISE'&&selected.source!=='MANUAL'?rtaCommand(plan,index,frame,conditions,forecast,selected):null;
  const targetKt=rta?Math.min(rta.targetKt,finite(leg.speed)?leg.speed:Infinity):selected.targetKt,err=commanded-now;
  const descentPathFt=phase==='DESCENT'?Math.max(commanded,target+nextConstraint.distance*318):null;
  const pathVs=phase==='DESCENT'?clamp(-Math.max(0,frame.gsKt||0)*5.3+(descentPathFt-now)*1.2,-3000,0):phase==='CLIMB'?clamp(1500-(targetKt-frame.iasKt)*10,0,2200):0;
  const vs=Math.abs(err)<=80?clamp(err*2,-160,160):phase==='DESCENT'?Math.max(pathVs,err*2):phase==='CLIMB'?Math.min(pathVs,err*2):clamp(err*2,-800,800);
  return {valid:finite(vs),engage:finite(vs),phase,targetKt,speedSource:rta?'RTA_TRAINING':selected.source,rta,targetAltitudeFt:commanded,vsFpm:vs,
   mode:phase==='CLIMB'&&Math.abs(err)>100?'VNAV SPD':'VNAV PTH',thrust:phase==='CRUISE'||Math.abs(err)<=100?'FMC SPD':phase==='CLIMB'?(conditions.n1Ready===true?'N1':'ARM'):(conditions.idle===true?'ARM':'RETARD'),todNm:tod};
 }
 // Approximate simulator racetrack; no certified holding performance model.
 function holdGeometry(fix,course,gs,altitude,bank=20){
  const hold=fix.hold,sign=hold.dir==='L'?-1:1,rad=course*Math.PI/180;
  const radius=clamp((Math.max(100,gs)*.514444)**2/(9.80665*Math.tan(clamp(bank,10,30)*Math.PI/180))/1852,.2,8);
  const L=hold.dist??Math.max(.2,gs*(hold.time??(altitude>14000?1.5:1))/60);
  const p=(x,y)=>({lat:fix.lat+(x*Math.cos(rad)-y*Math.sin(rad))/60,lon:fix.lon+(x*Math.sin(rad)+y*Math.cos(rad))/(60*Math.cos(fix.lat*Math.PI/180))});
  const pts=[p(0,0)];for(let i=1;i<=12;i++){const t=Math.PI*i/12;pts.push(p(radius*Math.sin(t),sign*radius*(1-Math.cos(t))));}
  pts.push(p(-L,2*sign*radius));for(let i=1;i<=12;i++){const t=Math.PI*i/12;pts.push(p(-L-radius*Math.sin(t),sign*radius*(1+Math.cos(t))));}
  pts.push(p(0,0));return pts;
 }
 function holdEntry(fix,course,arrival,gs,altitude,bank){
  const race=holdGeometry(fix,course,gs,altitude,bank),dir=fix.hold.dir==='L'?-1:1,d=dir*delta(course,arrival);
  // Conventional sector approximation for training; not a protected-airspace calculation.
  const kind=d>110?'TEARDROP':d< -70?'PARALLEL':'DIRECT';
  if(kind==='DIRECT')return {kind,points:race,race};
  const L=fix.hold.dist??gs*(fix.hold.time??(altitude>14000?1.5:1))/60;
  const project=(brg,nm)=>({lat:fix.lat+Math.cos(brg*Math.PI/180)*nm/60,lon:fix.lon+Math.sin(brg*Math.PI/180)*nm/(60*Math.cos(fix.lat*Math.PI/180))});
  if(kind==='TEARDROP'){const p=project(norm(course+180-dir*30),L);return {kind,points:[race[0],p,race[13],...race.slice(14)],race};}
  const end=project(norm(course+180),L),intercept=project(norm(course+180),Math.max(.3,L*.45));
  return {kind,points:[race[0],end,project(norm(course+180-dir*45),L*.65),intercept,race[0]],race};
 }
 // Explicitly approximate training performance, separate from certified Boeing tables.
 function holdBestSpeed(performance,fuelKg){
  const raw=String(performance.GW_CG||'').split('/')[0],z=String(performance.ZFW||'');
  const valid=x=>/^\d+(?:\.\d+)?$/.test(x)&&Number(x)>0;
  const gw=valid(z)&&finite(fuelKg)?Number(z)+fuelKg/1000:valid(raw)?Number(raw):null;
  return finite(gw)&&gw>=25&&gw<=80?Math.round(clamp(210*Math.sqrt(gw/50),170,260)):null;
 }
 function holdStats(plan,index,frame,conditions,holding){
  const out={},gs=frame.gsKt,now=conditions.utcMs,flow=conditions.fuelFlowKgHr,availableFuel=conditions.fuelKg;
  if(!finite(gs)||gs<30)return out;
  const bestKt=holdBestSpeed(plan.performance,availableFuel),res=Number(plan.performance.RESERVES);
  for(let i=index;i<plan.legs.length;i++){
   const l=plan.legs[i];if(l.type==='GAP')break;if(!l.hold)continue;
   const h=l.hold;let distance=0,valid=true,prev=frame;
   for(let j=index;j<=i;j++){const x=plan.legs[j];if(x.type!=='FIX'){valid=false;break;}distance+=length(vec(prev,x));prev=x;}
   if(holding?.key===h.key){const pts=holding.points,step=holding.step;if(pts?.[step]){distance=length(vec(frame,pts[step]));for(let k=step+1;k<pts.length;k++)distance+=length(vec(pts[k-1],pts[k]));valid=true;}}
   const etaMs=valid&&finite(now)?now+distance/gs*3600000:null;
   const eta=finite(etaMs)?new Date(etaMs).toISOString().slice(11,16).replace(':','')+'Z':null;
   let rest=0,complete=true;prev=l;
   for(let j=i+1;j<plan.legs.length;j++){const x=plan.legs[j];if(x.type!=='FIX'){complete=false;break;}rest+=length(vec(prev,x));prev=x;}
   const destination=plan.destinationPoint;
   if(!coord(destination)||length(vec(prev,destination))>3)complete=false;
   const availableMinutes=valid&&complete&&finite(flow)&&flow>0&&finite(availableFuel)&&String(plan.performance.RESERVES??'').trim()!==''&&finite(res)&&res>=0?Math.max(0,(availableFuel-res*1000-(distance+rest)/gs*flow)/flow*60):null;
   let efcMinutes=null;if(h.efc&&finite(etaMs)){const t=new Date(etaMs);const [hh,mm]=[Number(h.efc.slice(0,2)),Number(h.efc.slice(2))];let end=Date.UTC(t.getUTCFullYear(),t.getUTCMonth(),t.getUTCDate(),hh,mm);if(end<etaMs)end+=86400000;efcMinutes=(end-etaMs)/60000;}
   out[h.key]={bestKt,eta,availableMinutes,efcMinutes,projectedDestinationFuelKg:availableMinutes!==null&&finite(efcMinutes)?Math.max(0,availableFuel-flow*((distance+rest)/gs+efcMinutes/60)):null,quality:'TRAINING_ESTIMATE'};
  }
  return out;
 }
function followHold(points,step,frame,gs){
 const n=points.length-1;let j=Math.max(1,Math.min(step,n)),s=segment(points[j-1],points[j],frame,frame.trueHeadingDeg);
 // Follow the nearest point on a short future window; monotonic progress.
 let best=Infinity,along=0;
 for(let k=j;k<=Math.min(n,j+5);k++){
  const a=points[k-1],b=points[k],ab=vec(a,b),ap=vec(a,frame),l=length(ab);
  if(l<.0001)continue;
  const t=clamp(dot(ap,ab)/(l*l),0,1);
  const dist=length({x:ap.x-ab.x*t,y:ap.y-ab.y*t});
  if(dist<best){best=dist;step=k;along=t*l;}
 }
 j=step;s=segment(points[j-1],points[j],frame,frame.trueHeadingDeg);
 if(j===n&&(length(vec(frame,points[n]))<=.22||s&&s.along>=s.len&&Math.abs(s.xtk)<.22))return {done:true,step:j};
 let look=Math.max(.35,Math.min(1.15,gs/3600*14)),target=points[n];
 for(let k=j;k<=n;k++){
  const a=points[k-1],b=points[k],l=length(vec(a,b)),offset=k===j?along:0;
  if(look<=l-offset&&l>0){const f=(offset+look)/l;target={lat:a.lat+(b.lat-a.lat)*f,lon:a.lon+(b.lon-a.lon)*f};break;}
  look-=Math.max(0,l-offset);
 }
 return {done:false,step:j,track:bearing(vec(frame,target)),xtk:s?.xtk??null};
}
 function create(){
  let holding=null,completed=new Map();
  let plan=null,signature='',index=0,from=null,previousAltitude=null,previousCondition=null,lastElapsed=null,wasDescending=false;
  function reset(){holding=null;completed.clear();plan=null;signature='';index=0;from=null;previousAltitude=null;previousCondition=null;lastElapsed=null;wasDescending=false;}
  function evaluate(session,source,frame,mcp,conditions={}){
   const off={fmcTrackValid:false,fmcVerticalValid:false,lnavEngage:false,vnavEngage:false,reason:'NO_EXECUTED_ROUTE'};
   if(!session?.routeActivated){reset();return off;}
   const a=session.active||{},revision=session.routeRevision||0;
   // Pending changes to the reference context cannot replace the committed plan.
   if(source?.connected!==true){reset();return {...off,reason:'NAV_SOURCE_LOST'};}
   if((source.activeContext?.origin??source.origin)===a.ORIGIN&&(source.activeContext?.destination??source.destination)===a.DEST){
    const sig=JSON.stringify([revision,a,source.activeRevision??source.active]);
    if(sig!==signature){const next=compile(session,source);if(next){const sameGeometry=plan?.origin===next.origin&&plan?.dest===next.dest&&JSON.stringify(plan.legs)===JSON.stringify(next.legs);const old=plan?.legs?.[index],match=old?.ident?next.legs.map((l,i)=>l.ident===old.ident&&l.type===old.type?i:-1).filter(i=>i>=0):[];const newPpos=next.legs.findIndex(l=>l.hold?.ppos&&!plan?.legs?.some(x=>x.hold?.key===l.hold.key));index=newPpos>=0?newPpos:match.length===1?match[0]:0;if(!next.legs[index]?.hold||next.legs[index].hold.key!==holding?.key)holding=null;if(!sameGeometry){from=null;previousAltitude=null;previousCondition=null;wasDescending=false;}plan=next;}else{plan=null;index=0;}signature=sig;}
   }else if(!plan||plan.origin!==a.ORIGIN||plan.dest!==a.DEST||plan.revision!==revision){reset();return off;}
   if(!plan)return off;
   if(!conditions.power||!conditions.positionValid||!coord(frame)||!finite(frame.trueHeadingDeg)||!finite(frame.altitudeFt))return {...off,reason:'FMC_OR_IRS_UNAVAILABLE'};
   if(finite(lastElapsed)&&finite(frame.elapsedSec)&&frame.elapsedSec<lastElapsed){index=0;from=null;previousAltitude=null;previousCondition=null;wasDescending=false;holding=null;completed.clear();}
   lastElapsed=frame.elapsedSec;
   let leg=plan.legs[index];
   if(leg?.hold&&completed.get(leg.hold.key)===JSON.stringify(leg.hold)){index++;from={lat:leg.lat,lon:leg.lon};leg=plan.legs[index];}
   if(!leg||leg.type==='GAP')return {...off,reason:leg?.reason||'END_OF_ROUTE',activeIndex:index};
   if(leg.type==='ALTITUDE'){
    const crossed=finite(previousAltitude)&&(leg.climb?previousAltitude<leg.altitude.ft&&frame.altitudeFt>=leg.altitude.ft:previousAltitude>leg.altitude.ft&&frame.altitudeFt<=leg.altitude.ft);
    if(crossed){index++;from={lat:frame.lat,lon:frame.lon};leg=plan.legs[index];}
   }
   if(leg&&['DME','RADIAL'].includes(leg.type)){
    const stationVariation=conditions.variationAt?.(leg.station)??conditions.variation;
    const v=leg.type==='DME'?length(vec(leg.station,frame))-leg.target:finite(stationVariation)?delta(leg.target,norm(bearing(vec(leg.station,frame))-stationVariation)):null;
    if(finite(v)&&finite(previousCondition)&&Math.abs(v-previousCondition)<180&&((previousCondition<0&&v>=0)||(previousCondition>0&&v<=0))){index++;from={lat:frame.lat,lon:frame.lon};leg=plan.legs[index];previousCondition=null;}else previousCondition=v;
   }
   previousAltitude=frame.altitudeFt;
   if(!leg||leg.type==='GAP')return {...off,reason:leg?.reason||'END_OF_ROUTE',activeIndex:index};
   let track=null,engage=false,remaining=null,course=null,xtk=null,bearingTo=null;
   let holdStatus=null,holdExited=null;
   const hold=leg.hold,mag=hold?(conditions.variationAt?.(leg)??conditions.variation):null;
   if(hold&&finite(mag)&&frame.airborne===true){
    const inbound=norm(hold.inbound+mag),atFix=length(vec(frame,leg))<=.22;
    const arrival=coord(leg.from)?bearing(vec(leg.from,leg)):frame.trueHeadingDeg;
    const gs=Math.max(100,frame.gsKt||frame.iasKt||180),bank=20;
    const config=JSON.stringify([hold.inbound,hold.dir,hold.time,hold.dist,hold.speed]);
    const geometry=()=>holdGeometry(leg,inbound,gs,frame.altitudeFt,bank);
    const arrivalSeg=coord(leg.from)?segment(leg.from,leg,frame,frame.trueHeadingDeg):null;
    if(!holding&&(atFix||arrivalSeg&&arrivalSeg.along>=arrivalSeg.len&&Math.abs(arrivalSeg.xtk)<.25)){
     const entry=holdEntry(leg,inbound,arrival,gs,frame.altitudeFt,bank);
     holding={key:hold.key,points:entry.points,race:entry.race,entry:entry.kind,step:1,laps:0,config,exitInhibited:false,exitPath:false};
    }
    if(holding?.key===hold.key){
     if(holding.config!==config){holding.config=config;holding.exitInhibited=true;}
     if(hold.exit&&!holding.exitInhibited&&!holding.exitPath){
      holding.exitPath=true;holding.points=[{lat:frame.lat,lon:frame.lon},{lat:leg.lat,lon:leg.lon}];holding.step=1;
     }
     let p=followHold(holding.points,holding.step,frame,gs);holding.step=p.step;
     if(p.done){
       if(hold.exit&&holding.exitPath){holdExited={key:hold.key,ident:leg.ident,expected:plan.performance[hold.key]};completed.set(hold.key,JSON.stringify(hold));holding=null;index++;from={lat:leg.lat,lon:leg.lon};leg=plan.legs[index];if(!leg||leg.type==='GAP')return {...off,holdExited,reason:leg?.reason||'END_OF_ROUTE',activeIndex:index};}
       else{holding.race=geometry();holding.points=holding.race;holding.step=1;holding.laps++;holding.exitInhibited=false;p=followHold(holding.points,holding.step,frame,gs);holding.step=p.step;}
     }
     if(holding){
      track=p.track;course=inbound;engage=true;remaining=length(vec(frame,leg));bearingTo=bearing(vec(frame,leg));xtk=p.xtk;
      holdStatus={key:hold.key,active:true,exit:hold.exit===true,exitInhibited:holding.exitInhibited,lap:holding.laps,entry:holding.entry,points:holding.race,phase:holding.exitPath?'EXIT':holding.points!==holding.race?'ENTRY':holding.step<=12?'OUTBOUND TURN':holding.step===13?'OUTBOUND':holding.step<=25?'INBOUND TURN':'INBOUND'};
     }
    }
   }
   if(holdStatus){/* the holding controller owns lateral guidance until exit */}
   else if(['ALTITUDE','DME','RADIAL'].includes(leg.type)){if(finite(conditions.variation)){track=norm(leg.headingMag+conditions.variation);course=track;engage=coord(leg.from)&&length(vec(leg.from,frame))<=3||Math.abs(delta(frame.trueHeadingDeg,track))<=90;}}
   else{
    if(!from)from=coord(leg.from)?leg.from:{lat:frame.lat,lon:frame.lon};
    let s=segment(from,leg,frame,frame.trueHeadingDeg);remaining=length(vec(frame,leg));
    const next=plan.legs[index+1],turn=next?.type==='FIX'&&coord(next)?Math.abs(delta(s?.course??0,bearing(vec(leg,next)))):0;
    const bank=clamp(mcp?.bankAngleLimit||20,10,30)*Math.PI/180,radius=finite(frame.gsKt)?((frame.gsKt*.514444)**2/(9.80665*Math.tan(bank)))/1852:0;
    const lead=!leg.flyOver&&s&&next?.type==='FIX'&&turn>2&&turn<150?Math.min(radius*Math.tan(turn*Math.PI/360),s.len*.45,length(vec(leg,next))*.45):0;
    if(!leg.hold&&(remaining<=.12||s&&(s.along>=s.len&&Math.abs(s.xtk)<.35||lead>0&&s.along>=s.len-lead&&Math.abs(s.xtk)<.2))){
     index++;from={lat:leg.lat,lon:leg.lon};leg=plan.legs[index];
     if(!leg||leg.type==='GAP')return {...off,reason:leg?.reason||'END_OF_ROUTE',activeIndex:index};
     if(['ALTITUDE','DME','RADIAL'].includes(leg.type)){if(finite(conditions.variation)){track=norm(leg.headingMag+conditions.variation);course=track;engage=true;}}else{s=segment(from,leg,frame,frame.trueHeadingDeg);remaining=length(vec(frame,leg));}
    }
    if(leg.type==='FIX'&&s){track=s.track;course=s.course;xtk=s.xtk;bearingTo=bearing(vec(frame,leg));engage=s.engage;
     const desiredTurn=leg.turnDir==='Left'?-1:leg.turnDir==='Right'?1:0;
     const turnError=delta(frame.trueHeadingDeg,track);if(desiredTurn&&Math.abs(turnError)>90&&Math.sign(turnError)!==desiredTurn)track=norm(frame.trueHeadingDeg+desiredTurn*60);
    }
   }
   const forecast=routeForecast(plan,index,frame,conditions);
   const v=vertical(plan,leg,frame,mcp,index,remaining??0,conditions.fuelKg,{...conditions,wasDescending,forecast});
   const metrics=holdStats(plan,index,frame,conditions,holding),nextHold=plan.legs.slice(index).find(l=>l.hold);
   if(v.valid&&nextHold?.hold){const h=nextHold.hold,best=metrics[h.key]?.bestKt,target=h.speed??best,eta=metrics[h.key]?.eta;const close=holdStatus||leg===nextHold&&finite(remaining)&&finite(frame.gsKt)&&remaining/frame.gsKt*60<=3;if(close&&finite(target)){v.targetKt=target;}}
   if(holdStatus&&v.valid){const holdAltitude=finite(mcp?.values?.altitude)?mcp.values.altitude:frame.altitudeFt;v.targetAltitudeFt=holdAltitude;v.vsFpm=clamp((holdAltitude-frame.altitudeFt)*2,-1200,1200);v.mode='VNAV PTH';v.thrust='FMC SPD';}
   wasDescending=v.phase==='DESCENT';
   return {fmcTrackValid:finite(track),trackDeg:track,lnavEngage:engage&&finite(track),
    fmcVerticalValid:finite(track)&&v.valid===true,vnavEngage:finite(track)&&v.engage===true,
    vsFpm:v.vsFpm,vnavMode:v.mode,targetKt:v.targetKt,thrust:v.thrust,targetAltitudeFt:v.targetAltitudeFt,
    hold:holdStatus,holdExited,holdMetrics:metrics,activeIndex:index,activeIdent:leg.ident,distanceNm:remaining,courseTrueDeg:course,crossTrackNm:xtk,bearingTrueDeg:bearingTo,reason:v.reason||'TRAINING_ROUTE_GUIDANCE',vertical:v,performance:forecast,rta:v.rta??null};
  }
  return {evaluate,reset};
 }
 return Object.freeze({compile,segment,vertical,perfInputs,phaseSpeed,routeForecast,rtaCommand,casAtMach,tasAtCas,holdGeometry,holdEntry,holdStats,holdBestSpeed,create});
});

}catch(error){queueMicrotask(()=>{throw error});}
;await 0;
;
/* ./fcc-flight-runtime-v1.js?v=FCC-FD-SPEED-20261123&amp;fd=EADI-DIRECT-0002&amp;ils=SHI-CH4-0004 */
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
 const fmcTrainer=win.B737FmcTrainingGuidanceV1.create();let lastFmc=null,lastFmcSignature='',lastFmcAt=-Infinity;
 let sessionCache=null,sourceCache=null,sessionAttached=false,sourceAttached=false;
 function attachFmc(){if(!sessionAttached&&win.B737UnifiedFmc?.subscribe){sessionAttached=true;win.B737UnifiedFmc.subscribe(v=>{sessionCache=v;});}if(!sourceAttached&&win.B737CduSgRouteV1?.subscribe){sourceAttached=true;win.B737CduSgRouteV1.subscribe(v=>{sourceCache=v;});}}
 let directorServo={pitch:null,roll:null,lastMs:null};
 let owner=null,sourceError=null,lastAp=null,lastProtectionMs=0;
 let lastRetardAt=0,retardFeedback='NOT_REQUESTED';
 // Per-seat copy of this FCC's cues for any late avionics-gateway paint.
 let liveDirector={CAPT:null,FO:null},directorAtMs=0;
 const faults={hydA:false,hydB:false,irsL:false,irsR:false,criticalSensor:false,radioAlt:false};
 const clone=x=>JSON.parse(JSON.stringify(x));
 const isActive=()=>win.B737UnifiedFlightScenarioV1?.getDiagnostics?.()?.active===true;
 const mcp=()=>win.B737McpAFDSBridgeV1?.getOutput?.()||null;
 const flight=()=>isActive()?win.B737UnifiedFlightScenarioV1?.getState?.():null;
 const finiteNumber=Number.isFinite;
 function navInput(frame,output=mcp()){
  const field=win.B737WMM2025V1?.evaluate?.({lat:frame?.lat,lon:frame?.lon,
   altitudeFt:frame?.altitudeFt});
  const variation=field?.valid===true?field.declinationDeg:null;
  const net=win.B737UnifiedAvionicsNetworkV1,snap={};
  for(const topic of ['navigation.ils1','navigation.ils2','navigation.vor1','navigation.vor2'])
   snap[topic]=net?.getSignal?.(topic)||null;
  const radio=win.B737ClassicILSApproachCH4V1?.evaluate?.({
   output,flight:frame,snapshot:snap,declinationDeg:variation})||null;
  const t=win.B737UnifiedTOGACh4V1?.getState?.();
  const togaActive=t?.phase==='TO'||t?.phase==='GA';
  const computed=net?.getSignal?.('fmc.computed');const value=computed?.quality==='VALID'?computed.value:null;
  const engineValues=win.B737ISNCockpitV1?.getPropulsionSnapshot?.()?.engines;
  const running=Object.values(engineValues||{}).filter(x=>x?.running===true),idle=running.length>0&&running.every(x=>finiteNumber(x.throttle)&&x.throttle<=.06);
  const limit=win.B737ManualN1LiveV1?.getState?.(),n1Ready=[1,2].every(n=>limit?.[n]?.automaticSource==='FMC'&&finiteNumber(limit[n].automaticPct));
  attachFmc();
  const sample=frame&&isActive()?fmcTrainer.evaluate(sessionCache??win.B737UnifiedFmc?.snapshot?.(),sourceCache??win.B737CduSgRouteV1?.snapshot?.(),frame,output,{power:value?.operational===true&&value.failed!==true,positionValid:value?.position?.quality==='VALID',variation,variationAt:p=>{const w=win.B737WMM2025V1?.evaluate?.({lat:p.lat,lon:p.lon,altitudeFt:0});return w?.valid===true?w.declinationDeg:null;},n1Ready,idle,utcMs:net?.getSignal?.('clock.utc')?.quality==='VALID'?net.getSignal('clock.utc').value?.epochMs:null,fuelFlowKgHr:(()=>{const a=[1,2].map(n=>net?.getSignal?.('propulsion.engine'+n));return a.every(x=>x?.quality==='VALID'&&finiteNumber(x.value?.fuelFlowKgHr))?a.reduce((sum,x)=>sum+x.value.fuelFlowKgHr,0):null;})(),fuelKg:value?.fuel?.quality==='VALID'?value.fuel.totalKg:null}):{fmcTrackValid:false,fmcVerticalValid:false,lnavEngage:false,vnavEngage:false};
  lastFmc={...sample,position:frame&&sample.fmcTrackValid?{lat:frame.lat,lon:frame.lon}:null,observedAtMs:Date.now()};
  if(sample.holdExited?.expected)win.B737UnifiedFmc?.completeHold?.(sample.holdExited);
  return {...sample,
   courseTrackValid:radio?.courseTrackValid===true,courseDeg:radio?.courseDeg??null,
   glideValid:radio?.glideValid===true,gsVsFpm:radio?.gsVsFpm??null,
   togaActive,togaFdAutoPopUp:togaActive&&t.fdAutoPopUp===true,
   togaPitchDeg:togaActive?t.fdPitchDeg:null,
   togaTrackDeg:togaActive?t.fdRollTrackDeg:null,
   togaVsFpm:togaActive?(t.singleEngine?1000:1500):null,
   radio,magneticVariationDeg:variation,magneticVariationSource:field?.source??null};
 }
 function refreshFmcGuidance(frame=flight(),force=false){
  const now=performance.now();if(!force&&now-lastFmcAt<150)return;lastFmcAt=now;
  const g=navInput(frame,mcp());
  const sample={confirmed:true,source:'SIMULATED_FCC',lateral:g.fmcTrackValid===true,vertical:g.fmcVerticalValid===true,lnavEngage:g.lnavEngage===true,vnavEngage:g.vnavEngage===true,mode:g.vnavMode||null,targetKt:g.targetKt??null,thrust:g.thrust||null};
  const sig=JSON.stringify(sample),current=mcp()?.fmcGuidance;
  if(sig===lastFmcSignature&&current)return;lastFmcSignature=sig;
  win.B737McpAFDSBridgeV1?.observeFmcGuidance?.(sample);
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
  const rollGoal=togaGuidance&&!out?.modes?.lateral?0:view.rollCommandDeg;
  if(showPitch&&Number.isFinite(pitchGoal))
   // FCOM ground-roll detents must appear immediately at -10/+15.
   // Once airborne speed control starts, pitch command remains rate limited.
   directorServo.pitch=toga?.phase==='TO'&&toga.speedGuidanceActive!==true?
    pitchGoal:directorServo.pitch===null?frame.pitchDeg:
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
 // After FLARE capture the FCC commands the existing A/T engine servos
 // to IDLE during the last 27 ft. 0.42 is an openly TRAINING-only initial
 // lever fraction, not an AFM thrust schedule.
 function applyRetard(frame){
  const m=mcp(),ra=frame?.radioAltitudeFt;
  if(m?.dualApproach?.retard!==true||m?.dualApproach?.flareEngaged!==true||
      m?.controls?.atArm!==true||!Number.isFinite(ra))return;
  const now=performance.now();if(now-lastRetardAt<150)return;
  lastRetardAt=now;
  const value=Math.max(0,Math.min(.42,(ra/27)*.42));
  const engineOwner=win.B737ISNCockpitV1;
  for(const engine of ['engine1','engine2']){
   try{
    const result=engineOwner?.ilsRetardThrottleCommand?.({
     engine,value,controller:'B737_ILS_FCC_CH4_TRAINING'});
    retardFeedback=result?.accepted===true?'ISN_ECU_RETARD_ACTIVE':
     result?.reason||'ILS_RETARD_OWNER_NOT_READY';
   }catch(error){retardFeedback='ILS_RETARD_ERROR_'+String(error?.message||error);}
  }
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
  const radio=navInput(frame,out).radio;
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
   flightElapsedSec:frame.elapsedSec,onGround:frame.phase==='LANDING_ROLL',
   establishedEnroute:frame.phase==='AIRBORNE'&&!insideTakeoff,
   thrustIdleConfirmed:idle,
   stabTrimAutopilotNormal:win.B737StabilizerTrim?.getCutouts?.().AUTOPILOT!=='CUTOUT',
   navValid:radio?.valid===true,navKind:radio?.kind??'NONE',
   dualIlsValid:radio?.dualIlsValid===true,
   navCaptureConfirmed:radio?.navCaptureConfirmed===true,
   gsCaptureConfirmed:radio?.gsCaptureConfirmed===true,
   locDeviationDots:radio?.locDeviationDots??null,
   gsDeviationDots:radio?.gsDeviationDots??null,
   gsBelowDots:radio?.gsBelowDots??null});
 }
 win.addEventListener('b737:flight-scenario-state',e=>{
  const frame=e.detail;
  if(frame?.schema!=='B737_FLIGHT_SCENARIO_STATE_V1'||!isActive())return;
  refreshFmcGuidance(frame);publishFlightObservation(frame);
  applyRetard(frame);paintDirector(frame);protectFlight(frame);
 });
 win.addEventListener('b737:mcp-afds-state',()=>{
  const frame=flight();if(frame)paintDirector(frame);
 });
 win.addEventListener('b737:flight-scenario-stopped',()=>{
  releaseDirector();fcc=Guidance.createState();protect=Protection.initial();last=null;fmcTrainer.reset();lastFmcSignature='';refreshFmcGuidance(null,true);
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
  VERSION,follow,refreshFmcGuidance:()=>refreshFmcGuidance(flight(),true),getFmcGuidance:()=>lastFmc?clone(lastFmc):null,
  getDirector:seat=>{
   const key=String(seat).toUpperCase()==='FO'?'FO':'CAPT';
   if(!isActive()||!directorAtMs||performance.now()-directorAtMs>1500)return null;
   return liveDirector[key]?{...liveDirector[key]}:null;
  },
  getILS:()=>navInput(flight(),mcp()).radio,
  getRetardFeedback:()=>retardFeedback,
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
