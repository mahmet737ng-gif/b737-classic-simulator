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
 const mainCB=window.B737UnifiedCB?.available?.("mcp.power");
 const courseCB=window.B737UnifiedCB?.available?.("mcp.course2");
 const fingerprint=JSON.stringify([observed.bus,mainCB,courseCB]);
 if(fingerprint===lastElectrical)return;
 lastElectrical=fingerprint;
 send({type:"ELECTRICAL",snapshot:observed});
}
for(const name of ["b737:cb-state-change","b737:electrical-distribution-changed",
 "b737:electrical-v7-state","b737:electrical-owner-ready",
 "b737:bus-failure-injection-changed"])
 window.addEventListener(name,electrical);
function statusLabel(out){
 const crs2=out.course2Power===true?"COURSE 2 ON":out.course2Power===false?"COURSE 2 OFF":"COURSE 2 UNKNOWN";
 if(out.power===false)return "MCP OFF · DC BUS 1 or CB open · "+crs2;
 if(out.power===null)return "MCP POWER UNKNOWN · waiting for Electrical V7 · "+crs2;
 return "MCP ON · DC BUS 1 / MCP CB (automatic trainer connection) · "+crs2;
}
function project(){
 const out=Core.output(state);
 const visual=window.B737McpVisualV3,hardware=window.B737McpHardwareV1;
 if(visual){
  visual.setPower?.(out.power);
  visual.setCourse2Power?.(out.course2Power);
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
  if(modeReadout){
  const m=out.modes;
  modeReadout.textContent="LAT "+(m.lateral||"—")+" · VERT "+(m.vertical||"—")+" · A/T "+(m.thrust||"—")+" · A/P "+(m.autopilot||"—")+
   (out.rejection?" | BLOCKED: "+out.rejection:"");
 }
}
function hardwareCommand(e){
 const d=e.detail;if(!d||d.method==="external")return;
 const map={FD_LEFT:{type:"FD",side:"left",on:d.value==="ON"},FD_RIGHT:{type:"FD",side:"right",on:d.value==="ON"},
 AT_ARM:{type:"AT_ARM",armed:d.value==="ARM"}};
 if(own(map,d.id))send(map[d.id]);
 else if(d.id==="VS_WHEEL")send({type:"VALUE",id:"verticalSpeed",value:d.value});
 else if(["CO","SPD_INTV","ALT_INTV"].includes(d.id)){
  // A momentary button must not remain visually latched if its control law
  // has not been source-validated. Accept the physical press, reject activation.
  if(window.B737McpHardwareV1?.getState()?.[d.id]===true)
   window.B737McpHardwareV1.setState(d.id,false);
  state.lastRejection=d.id+"_LOGIC_NOT_VALIDATED";
  project();notify();
 }
}
function requestMode(id){
 if(!id)return;
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
 send({type:"VALUE",id:d.control,value:d.value});
}
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
 note.textContent="MCP illumination is automatic from Electrical V7: DC BUS 1 / P18-1 D1 and separate COURSE 2 battery-bus CB. Trainer wiring, not certified aircraft WDM.";
 section.append(heading,status,modeReadout,note);
 target.prepend(section);
 project();
}
window.addEventListener("b737:cockpit-mounted",()=>{decorate();project();electrical()});
 window.addEventListener("b737:mcp-hardware-change",hardwareCommand);
window.addEventListener("b737:mcp-button-request",visualRequest);
window.addEventListener("b737:mcp-value-change",visualValue);
window.addEventListener("b737:visual-test",e=>{visualTest=!!e.detail?.active;project()});
document.addEventListener("DOMContentLoaded",()=>{decorate();project();electrical()});
if(document.readyState!=="loading"){decorate();project();electrical()}
window.B737McpAFDSBridgeV1=Object.freeze({
 getState:()=>JSON.parse(JSON.stringify(state)),
 getOutput:()=>Core.output(state),
 refreshElectrical:electrical,
 observePower:()=>Core.output(state), // compatibility: read-only, no manual power injection
 setEvidence:(key,value)=>send({type:"EVIDENCE",key,value}),
 press:requestMode,
 reset:()=>send({type:"RESET"})
});
})();