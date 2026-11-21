(async()=>{
;
/* ./toga-unified-ch4-v1.js?v=CH4-TOGA-ECU-RETRY-20261119 */
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
   fdLeft:c.fd?.left===true,fdRight:c.fd?.right===true,atArmed:c.atArm===true,
   apChannels:/^(?:CMD|CWS)_[AB]$/.test(m?.modes?.autopilot||'')?1:0,
   autopilotEngaged:/^(?:CMD|CWS)_[AB]$/.test(m?.modes?.autopilot||''),
   engine1Running:light?undefined:engineRunning(1),engine2Running:light?undefined:engineRunning(2),
   // Presence of both engines running is checked independently from pump/fuel faults.
   selectedSpeedKt:m?.values?.speed??f?.iasKt,
   v2Kt:win.B737UnifiedTakeoffDataV1?.get?.()?.v2Kt??null,
   flareArmed:false,touchedDown:false,
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
  const fm=T.fma(state),fingerprint=JSON.stringify([fm,m.power,m.controls?.fd]);
  if(lastFma===fingerprint)return;
  lastFma=fingerprint;
  for(const seat of ['CAPT','FO']){
   win.dispatchEvent(new CustomEvent('b737:fma-fcc-observation',{detail:{
    schema:'B737_FMA_FCC_OBSERVATION_V1',confirmed:true,seat,
    source:'SIMULATED_FCC',evidence:{togaModeConfirmed:true},
    fields:{at:{active:fm.at},pitch:{active:fm.pitch},
     roll:{active:fm.roll},
     afds:{active:fm.afds==='CMD'||m.controls?.fd?.[seat==='CAPT'?'left':'right']===true?
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
  return m?.power===true&&m.controls?.atArm===true&&m.modes?.thrust==='SPEED';
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
    engines:src.engines,paused:src.paused,inhibited:manualOverride});
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
})();
