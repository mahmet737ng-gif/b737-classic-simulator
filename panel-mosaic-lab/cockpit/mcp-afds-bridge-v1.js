/* MCP Phase 3 / slice 1: real Electrical V7 evidence -> conservative AFDS
 * educational mode core -> visual/hardware projection. No invented LRU feed.
 */
(function(){
"use strict";
const Core=window.B737McpModeCoreV1;
if(!Core)throw Error("B737McpModeCoreV1 missing");
let state=Core.initialState(),lastElectrical="",visualTest=false,ready=false;
let status=null,modeReadout=null;
const own=(o,k)=>o&&Object.prototype.hasOwnProperty.call(o,k);
function notify(){window.dispatchEvent(new CustomEvent("b737:mcp-afds-state",{detail:Core.output(state)}));}
function send(action){
 state=Core.transition(state,action);
 project();notify();return Core.output(state);
}
/* One authoritative ATA24 V7 evaluation, only when the distribution / CB
 * actually changes. Never rely on a button in Controls or on recurrent
 * 100-ms engine-indication events to energize MCP numeric glass. */
function electrical(){
 const provider=window.B737ISNCockpitV1;
 if(!provider)return;
 let observed=null;
 try{
  const raw=provider.getElectricalState?.();
  if(raw&&window.B737ElectricalV7?.evaluate)
   observed=window.B737ElectricalV7.evaluate(raw);
 }catch(error){console.warn("MCP live bus snapshot",error);}
 if(observed?.schema!=="B737_ELECTRICAL_V7_RESULT")
  observed=provider.getState?.()?.state?.electrical;
 if(observed?.schema!=="B737_ELECTRICAL_V7_RESULT"||!observed.bus)return;
 // Use the existing ATA24 MRG bus-class projection, which includes injected
 // ELECTRONIC 1 28VDC failures. Electrical V7 dc1 is only its upstream proxy.
 const facade=window.B737UnifiedBusConsumerLiveV1;
 const elex1=facade?.getBus?.("electronic1","28VDC");
 const battery=facade?.getBus?.("battery","28VDC");
 const bit=(v)=>v===true?true:v===false?false:null;
 const bus={...observed.bus,electronic1:elex1?bit(elex1.powered):bit(observed.bus.dc1),
  battery:battery?bit(battery.powered):bit(observed.bus.battery)};
 const mainCB=window.B737UnifiedCB?.available?.("mcp.power");
 const courseCB=window.B737UnifiedCB?.available?.("mcp.course2");
 const fingerprint=JSON.stringify([bus,mainCB,courseCB]);
 if(fingerprint===lastElectrical)return;
 lastElectrical=fingerprint;
 send({type:"ELECTRICAL",snapshot:{...observed,bus}});
}
for(const name of ["b737:cb-state-change","b737:electrical-distribution-changed",
 "b737:electrical-v7-state","b737:electrical-owner-ready",
 "b737:bus-failure-injection-changed","b737:bus-consumer-snapshot"])
 window.addEventListener(name,electrical);
function statusLabel(out){
 const crs2=out.course2Power===true?"COURSE 2 ON":out.course2Power===false?"COURSE 2 OFF":"COURSE 2 UNKNOWN";
 if(out.power===false)return "MCP OFF · ELEX 1 28V DC or CB open · "+crs2;
 if(out.power===null)return "MCP POWER UNKNOWN · ELEX 1 feed not established · "+crs2;
 return "MCP ON · ELECTRONIC BUS 1 28V DC / MCP CB · "+crs2;
}
function project(){
 const out=Core.output(state);
 const visual=window.B737McpVisualV3,hardware=window.B737McpHardwareV1;
 if(visual){
  visual.setPower?.(out.power);
  visual.setCourse2Power?.(out.course2Power);
  visual.setSpeedMode?.(out.speedDisplayMode);
  if(!visualTest)visual.setLamps?.(out.lamps);
  for(const [id,v] of Object.entries(out.values)){
   if(visual.getState()?.[id]!==v)visual.setValue(id,v);
  }
 }
 if(hardware){
  const current=hardware.getState();
  for(const [id,value]of [
   ["AT_ARM",out.controls.atArm?"ARM":"OFF"],
   ["FD_LEFT",out.controls.fd.left?"ON":"OFF"],
   ["FD_RIGHT",out.controls.fd.right?"ON":"OFF"],
   ["VS_WHEEL",out.values.verticalSpeed]
  ])if(current[id]!==value)hardware.setState(id,value);
 }
 if(status)status.textContent=statusLabel(out);
 const circuit=document.querySelector(".mcp-afds-circuit-status");
 if(circuit){
  const cb=window.B737UnifiedCB;
  const label=v=>v===true?"ON":v===false?"OFF":"UNKNOWN";
  const cbText=v=>v===true?"CLOSED":v===false?"OPEN":"UNKNOWN";
  const f=out.feedStatus||{};
  const state=window.B737ISNCockpitV1?.getElectricalState?.();
  const apu=state?.config?.apuRunning===true;
  const apuOnBus=Object.values(state?.source||{}).includes("APU");
  const guide=out.power===false?
   (!state?"Electrical owner not initialized":
    apu&&!apuOnBus?"APU running but not connected to generator bus: select APU GEN ON":
    !apuOnBus&&!Object.values(state.source||{}).some(v=>v==="GEN1"||v==="GEN2"||v==="EXT")?
    "No AC source on distribution: connect GPU/APU GEN/engine GEN to a bus":
    f.electronic1===false?"ELEX 1 supply or its upstream source is OFF":"Check MCP circuit breaker"):"";
  circuit.textContent="ELEX1 28V: "+label(f.electronic1)+" · DC1 upstream: "+label(f.dc1)+
   " · MCP CB: "+cbText(cb?.available?.("mcp.power"))+
   "\nCOURSE2 BAT BUS: "+label(f.batteryBus)+
   " · CB: "+cbText(cb?.available?.("mcp.course2"))+(guide?"\nNEXT: "+guide:"");
 }
 if(modeReadout){
  const m=out.modes,arm=out.armed||{},cap=out.capture||{};
  const intent=out.pending?.approach?'APP ARMED':
   arm.roll==='VOR/LOC'?'VOR/LOC ARMED':'';
  const nav=out.flight?.navValid===true?(out.flight.navKind+' NAV VALID'):
   out.flight?.navValid===false?'NAV NOT RECEIVED':'NAV SOURCE PENDING';
  modeReadout.textContent="LAT "+(m.lateral||"—")+" · VERT "+(m.vertical||"—")+
   " · A/T "+(m.thrust||"—")+" · A/P "+(m.autopilot||"—")+
   (intent?" | "+intent:"")+
   (cap.roll==='VOR_LOC'?" | VOR/LOC CAPTURED":"")+
   (cap.pitch==='G/S'?" | G/S CAPTURED":"")+
   " | "+nav+(out.rejection?" | BLOCKED: "+out.rejection:"");
 }
}
function hardwareCommand(e){
 const d=e.detail;if(!d||d.method==="external")return;
 const map={FD_LEFT:{type:"FD",side:"left",on:d.value==="ON"},FD_RIGHT:{type:"FD",side:"right",on:d.value==="ON"},
 AT_ARM:{type:"AT_ARM",armed:d.value==="ARM"}};
 if(own(map,d.id))send(map[d.id]);
 else if(d.id==="VS_WHEEL")send({type:"VALUE",id:"verticalSpeed",value:d.value});
 else if(d.id==="CO"){
  // FCOM 4.10.3: C/O is an IAS/MACH push button, not a latched mode.
  // Restore the spring-return push visually; AFDS owns the display mode.
  if(d.value===true)send({type:"SPEED_MODE",
   mode:Core.output(state).speedDisplayMode==="MACH"?"IAS":"MACH"});
  if(window.B737McpHardwareV1?.getState()?.CO===true)
   window.B737McpHardwareV1.setState("CO",false);
 }
 else if(["SPD_INTV","ALT_INTV"].includes(d.id)){
  if(window.B737McpHardwareV1?.getState()?.[d.id]===true)
   window.B737McpHardwareV1.setState(d.id,false);
  state.lastRejection=d.id+"_LOGIC_NOT_VALIDATED";
  project();notify();
 }
}
// Read both live NAV receivers before adding the second CMD.
 // A one-second radio publication cadence cannot inhibit an already
 // valid dual ILS merely because the last flight sample was stale.
 function refreshSecondApproachChannel(id){
  const out=Core.output(state),first=out.modes?.autopilot;
  if(!/^CMD_[AB]$/.test(id)||!/^CMD_[AB]$/.test(first)||
     id===first||out.pending?.approach!==true)return;
  const frame=window.B737UnifiedFlightScenarioV1?.getState?.();
  if(!frame||!Number.isFinite(frame.radioAltitudeFt))return;
  window.B737UnifiedIranRadioNavV1?.refresh?.();
  const radio=window.B737UnifiedFccFlightV1?.getILS?.();
  if(radio?.dualIlsValid!==true||radio?.kind!=="ILS"||radio?.valid!==true)return;
  send({type:"FLIGHT_OBSERVATION",sample:{
   schema:"B737_AFDS_FLIGHT_OBSERVATION_V1",confirmed:true,
   source:"SIMULATED_FCC",navValid:true,navKind:"ILS",
   dualIlsValid:true,radioAltitudeFt:frame.radioAltitudeFt,
   navCaptureConfirmed:radio.navCaptureConfirmed===true,
   gsCaptureConfirmed:radio.gsCaptureConfirmed===true,
   gsDeviationDots:radio.gsDeviationDots??null,
   gsBelowDots:radio.gsBelowDots??null
  }});
 }
 function requestMode(id){
 if(!id)return;
 // The source-grounded TO/GA FCC controls pitch until 400 ft RA, not an
 // unrelated MCP pushbutton. Also inhibit a new single A/P engagement below
 // the takeoff/go-around floor. A dual A/P already engaged for FLARE is
 // handled by the TO/GA FCC logic and is not a new MCP button selection.
 const t=window.B737UnifiedTOGACh4V1?.getState?.();
 const f=window.B737UnifiedFlightScenarioV1?.getState?.();
 if((t?.phase==='TO'||t?.phase==='GA')&&f?.airborne===true&&
    Number.isFinite(f.radioAltitudeFt)&&f.radioAltitudeFt<400){
  const lockedPitch=['VNAV','LVL_CHG','VS','ALT_HLD'].includes(id);
  const lockedAp=/^(?:CMD|CWS)_[AB]$/.test(id);
  if(lockedPitch||lockedAp){
   state={...state,lastRejection:lockedPitch?'TOGA_PITCH_PROTECTED_BELOW_400_RA':
    'NEW_AP_ENGAGEMENT_INHIBITED_BELOW_400_RA',revision:state.revision+1};
   project();notify();return Core.output(state);
  }
 }
 // FCOM 4.20.16: engaging CMD after the FD-only takeoff at >=400ft
 // terminates TO/GA; pitch automatically becomes LVL CHG / MCP SPD,
 // with HDG SEL roll retained unless the crew has selected another mode.
 if((t?.phase==='TO'||t?.phase==='GA')&&/^CMD_[AB]$/.test(id)&&f?.airborne===true&&
    Number.isFinite(f.radioAltitudeFt)&&f.radioAltitudeFt>=400){
  state=Core.transition(state,{type:'BUTTON',id});
  if(state.modes.autopilot===id){
   if(state.modes.vertical!=='LVL_CHG')
    state=Core.transition(state,{type:'BUTTON',id:'LVL_CHG'});
   if(!state.modes.lateral)state=Core.transition(state,{type:'BUTTON',id:'HDG_SEL'});
  }
  project();notify();return Core.output(state);
 }
 refreshSecondApproachChannel(id);
 return send({type:"BUTTON",id});
}
function visualRequest(e){
 const id=e.detail?.id;
 if(!id)return;
 if(id==="AT_ARM")return; // handled exclusively by physical ARM toggle
 requestMode(id);
}
function visualValue(e){
 const d=e.detail;
 if(!d||d.method==="external"||!d.control)return;
 applySelectedValue(d.control,d.value);
}
function applySelectedValue(id,value){return send({type:"VALUE",id,value});}
function decorate(){
 if(ready)return;
 const target=document.querySelector("#inspector")||document.querySelector("header")||document.body;
 if(!target)return;
 ready=true;
 const section=document.createElement("section");section.className="mcp-afds-control";section.setAttribute("aria-label","MCP AFDS training power evidence");
 const heading=document.createElement("strong");heading.textContent="MCP · AFDS PHASE 3";
 status=document.createElement("p");status.className="mcp-afds-power-status";status.setAttribute("role","status");
  modeReadout=document.createElement("p");modeReadout.className="mcp-afds-mode-status";
 const note=document.createElement("small");
 note.textContent="MRG CL p.186: MCP Electronic Bus 1 · 28V DC / P18-1 D1. COURSE 2: Battery Bus · 28V DC / dedicated CB. Trainer bus mapping; EP-FSI WDM not verified.";
 const circuit=document.createElement("p");
 circuit.className="mcp-afds-circuit-status";
 circuit.setAttribute("role","status");
 section.append(heading,status,circuit,modeReadout,note);
 target.prepend(section);
 project();
}
window.addEventListener("b737:cockpit-mounted",()=>{decorate();project();electrical()});
 window.addEventListener("b737:mcp-hardware-change",hardwareCommand);
window.addEventListener("b737:mcp-button-request",visualRequest);
 window.addEventListener('b737:efis-transfer-ap-disconnect',()=>{
  if(state.modes.autopilot)send({type:'EFIS_SOURCE_TRANSFER'});
 });
window.addEventListener("b737:mcp-value-change",visualValue);
 // Flight-model observations update the *same* AFDS state as MCP commands.
 // Event-driven only; unconfirmed telemetry cannot drive a false capture.
 window.addEventListener("b737:afds-flight-observation",e=>{
  if(e.detail?.schema==="B737_AFDS_FLIGHT_OBSERVATION_V1")
   send({type:"FLIGHT_OBSERVATION",sample:e.detail});
 });
window.addEventListener('b737:speed-limit-fcc',event=>{
 const d=event.detail;
 if(d?.schema!=='B737_CH4_FCC_SPEED_LIMIT_SAMPLE_V1'||d.confirmed!==true||
    d.source!=='SIMULATED_FCC')return;
 try{send({type:'SPEED_LIMIT_FCC',sample:d});}
 catch(error){console.warn('CH4 qualified speed-limit rejection',error);}
});
window.addEventListener("b737:mcp-bank-limit-preview",e=>{
 const deg=e.detail?.angle;
 if([10,15,20,25,30].includes(deg)&&Core.output(state).bankAngleLimit!==deg)
  send({type:"BANK_ANGLE",value:deg});
});
window.addEventListener("b737:visual-test",e=>{visualTest=!!e.detail?.active;project()});
document.addEventListener("DOMContentLoaded",()=>{decorate();project();electrical()});
if(document.readyState!=="loading"){decorate();project();electrical()}
// Only a change of a currently active NAV receiver frequency permits
// leaving a fully captured APP. Editing the inactive drum does not count.
const observedNavFrequency={CAPT:null,FO:null};
function observeActiveNavFrequency(detail){
 const seat=detail?.seat,after=detail?.activeFrequencyKhz;
 if(!["CAPT","FO"].includes(seat))return;
 const before=observedNavFrequency[seat];
 observedNavFrequency[seat]=Number.isInteger(after)?after:null;
 if(!Number.isInteger(before)||!Number.isInteger(after)||before===after)return;
 const out=Core.output(state);
 if(out.pending.approach&&out.nav.loc&&out.nav.gs){
  send({type:"NAV_RETUNED",source:"VHF_NAV_HARDWARE",confirmed:true,
   seat,previousFrequencyKhz:before,activeFrequencyKhz:after});
 }
}
window.addEventListener("b737:vhf-nav-mode",e=>observeActiveNavFrequency(e.detail));
for(const seat of ["CAPT","FO"])
 observeActiveNavFrequency(window.B737UnifiedVHFNavControlsV1?.getState?.(seat));
// The existing MCP AFDS state machine remains the SOLE owner of mode/values.
// Scenario setup calls ordinary FCC-verified knob/paddle transitions, never
// sets the visible display text or overrides bus/CB power.
function applyFinal10Preset({speedKt,headingMag,courseMag,altitudeFt}={}){
 const input={speed:Math.round(speedKt),heading:Math.round(headingMag)%360,
  courseL:Math.round(courseMag)%360,courseR:Math.round(courseMag)%360,
  altitude:Math.round(altitudeFt/100)*100};
 if(![input.speed,input.heading,input.courseL,input.courseR,input.altitude].every(Number.isFinite))
  return {accepted:false,reason:'INVALID_FINAL_10_VALUES'};
 let out=Core.output(state);
 if(out.power!==true)return {accepted:false,reason:'MCP_NOT_POWERED'};
 for(const [id,value] of Object.entries(input))
  if(out.values[id]!==value){send({type:'VALUE',id,value});out=Core.output(state);
   if(out.rejection)return {accepted:false,reason:out.rejection,step:id};}
 if(out.controls?.atArm!==true)send({type:'AT_ARM',armed:true});
 out=Core.output(state);
 for(const side of ['left','right'])if(out.controls?.fd?.[side]!==true){
  send({type:'FD',side,on:true});out=Core.output(state);}
 for(const id of ['HDG_SEL','ALT_HLD','CMD_B']){
  out=Core.output(state);
  const chosen=id==='HDG_SEL'?out.modes.lateral==='HDG_SEL':
   id==='ALT_HLD'?out.modes.vertical==='ALT_HLD':out.modes.autopilot==='CMD_B';
  if(!chosen)send({type:'BUTTON',id});
  out=Core.output(state);
  if(out.rejection)return {accepted:false,reason:out.rejection,step:id};
 }
 return {accepted:true,output:Core.output(state)};
}
window.B737McpAFDSBridgeV1=Object.freeze({
 getState:()=>JSON.parse(JSON.stringify(state)),
 getOutput:()=>Core.output(state),
 applySelectedValue,
 applyCrewHardware:(id,value)=>{
  window.B737McpHardwareV1.setState(id,value);
  hardwareCommand({detail:{id,value}});
  return Core.output(state);
 },
 applyFinal10Preset,
 getApproachDiagnostics:()=>{
  const out=Core.output(state);
  const r=window.B737UnifiedFccFlightV1?.getILS?.()||null;
  const tuner=window.B737UnifiedVHFNavControlsV1;
  return {power:out.power,course2Power:out.course2Power,
   appArmed:out.pending.approach,vorLocArmed:out.selectors?.vorLoc===true||out.armed.roll==='VOR/LOC',
   gsArmed:out.armed.pitch==='G/S',capture:{...out.capture},
   fmaNav:{...out.nav},lastRejection:out.rejection,
   navSignal:r?{valid:r.valid,kind:r.kind,ident:r.stationIdent,
    locDots:r.locDeviationDots,gsDots:r.gsDeviationDots,reason:r.reason}:null,
   nav1FrequencyKhz:tuner?.getState?.('CAPT')?.activeFrequencyKhz??null,
   nav2FrequencyKhz:tuner?.getState?.('FO')?.activeFrequencyKhz??null};
 },
 refreshElectrical:electrical,
 observePower:()=>Core.output(state), // compatibility: read-only, no manual power injection
 setEvidence:(key,value)=>send({type:"EVIDENCE",key,value}),
 observeFlight:sample=>send({type:"FLIGHT_OBSERVATION",sample}),
 observeAltitudeCapture:sample=>send({type:"FCC_ALTITUDE_CAPTURE",...sample}),
 beginToga:(dualApGA,singleEngine)=>send({type:'TOGA_ENGAGED',confirmed:true,
  source:'SIMULATED_FCC',dualApGA:dualApGA===true,singleEngine:singleEngine===true}),
 updateTogaEngine:singleEngine=>send({type:'TOGA_ENGINE_STATUS',confirmed:true,
  source:'SIMULATED_FCC',singleEngine:singleEngine===true}),
 disconnectConfirmed:sample=>send({type:"AP_DISENGAGE_CONFIRMED",...sample}),
 press:requestMode,
 reset:()=>send({type:"RESET"})
});
})();
