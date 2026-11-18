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
 const getFlight=()=>win.B737UnifiedFlightScenarioV1;
 const mcp=()=>win.B737McpAFDSBridgeV1?.getOutput?.();
 const owner=()=>win.B737ISNCockpitV1;
 const engineRunning=(n)=>owner()?.getStartState?.()?.phase?.['engine'+n]==='RUNNING';
 const active=()=>['TO','GA'].includes(state.phase);
 const scenario=()=>getFlight()?.getState?.()??null;
 function context(){
  const f=scenario(),m=mcp(),c=m?.controls||{},engines=owner()?.getPropulsionSnapshot?.()?.engines;
  return {groundReady:f?.phase==='GROUND_READY',airborne:f?.airborne===true,
   radioAltitudeFt:f?.radioAltitudeFt,iasKt:f?.iasKt,groundTrackDeg:f?.trueTrackDeg??f?.trueHeadingDeg,
   fdLeft:c.fd?.left===true,fdRight:c.fd?.right===true,atArmed:c.atArm===true,
   apChannels:/^(?:CMD|CWS)_[AB]$/.test(m?.modes?.autopilot||'')?1:0,
   autopilotEngaged:/^(?:CMD|CWS)_[AB]$/.test(m?.modes?.autopilot||''),
   engine1Running:engineRunning(1),engine2Running:engineRunning(2),
   // Presence of both engines running is checked independently from pump/fuel faults.
   selectedSpeedKt:m?.values?.speed??f?.iasKt,
   v2Kt:win.B737UnifiedTakeoffDataV1?.get?.()?.v2Kt??null,
   flareArmed:false,touchedDown:false,
   isTakeoffMode:state.phase==='TO',takeoffRollHdGSel:false,
   reducedGaN1Reached:engines&&['engine1','engine2'].some(id=>
    engines[id]?.running&&Number.isFinite(engines[id]?.n1Percent)&&
    engines[id].n1Percent>=90)
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
  const fm=T.fma(state),fingerprint=JSON.stringify([fm,m.power]);
  if(lastFma===fingerprint)return;
  lastFma=fingerprint;
  for(const seat of ['CAPT','FO']){
   win.dispatchEvent(new CustomEvent('b737:fma-fcc-observation',{detail:{
    schema:'B737_FMA_FCC_OBSERVATION_V1',confirmed:true,seat,
    source:'SIMULATED_FCC',evidence:{togaModeConfirmed:true},
    fields:{at:{active:fm.at},pitch:{active:fm.pitch},
     roll:{active:fm.roll},afds:{active:fm.afds}}
   }}));
  }
 }
 function thrust(){
  const fm=T.fma(state);
  if(!['TAKEOFF_LIMIT','GA_REDUCED','GA_FULL'].includes(fm.thrust))return;
  const finger=state.phase+':'+state.presses+':'+state.throttleFraction;
  if(lastThrust===finger)return;
  const result=[];
  for(const n of [1,2]){
   if(!engineRunning(n))continue;
   try{
    const r=owner()?.togaThrottleCommand?.({engine:'engine'+n,
     value:state.throttleFraction,controller:'B737_TOGA_CH4_TRAINING',
     phase:state.phase});
    if(r?.accepted){
     result.push(n);
     doc.dispatchEvent(new CustomEvent('b737:throttle-state',{detail:{
      engine:n,percent:state.throttleFraction*100,source:'CH4_TOGA',visualOnly:true}}));
    }
   }catch(e){errors.push(String(e?.message||e));}
  }
  if(result.length)lastThrust=finger;
 }
 function press(source='INSTRUCTOR'){
  const flight=getFlight(),f=flight?.getState?.();
  if(!flight?.getDiagnostics?.()?.active||!f){
   banner('TO/GA BLOCKED · LOAD AN ACTIVE FLIGHT SCENARIO',true);return state;
  }
  const c=context(),was=state.phase;
  const next=T.press(state,c);
  if(next===state||next.reason===state.reason&&next.phase===state.phase){
   banner('TO/GA BLOCKED · '+next.reason,true);return state;
  }
  state=next;
  if(state.phase==='OFF'){banner('TO/GA BLOCKED · '+state.reason,true);return state;}
  if(was==='OFF'&&state.phase==='TO'){
   try{flight.command({type:'TAKEOFF_ROLL'});}catch(e){
    state=T.initial();banner('TO/GA BLOCKED · '+String(e.message||e),true);return state;
   }
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
   const next=T.advance(state,context(),dt);
   state=next;publishFma();
   lastMs=ms;
  }else lastMs=performance.now();
 }
 win.addEventListener('b737:toga-request',e=>press(e.detail?.source||'THRUST_LEVER'));
 win.addEventListener('b737:flight-scenario-stopped',()=>{state=T.initial();lastFma='';lastThrust='';});
 const api=Object.freeze({getState:()=>({...state}),press,tickForTest:tick,
  getDiagnostics:()=>({version:T.VERSION,errors:errors.slice(-12)})});
 win.B737UnifiedTOGACh4V1=api;
 if(typeof win.setInterval==='function')win.setInterval(tick,150);
})(window);
