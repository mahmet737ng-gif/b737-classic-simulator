/* MCP Phase 3 / slice 1: real Electrical V7 evidence -> conservative AFDS
 * educational mode core -> visual/hardware projection. No invented LRU feed.
 */
(function(){
"use strict";
const Core=window.B737McpModeCoreV1;
if(!Core)throw Error("B737McpModeCoreV1 missing");
let state=Core.initialState(),lastElectrical="",visualTest=false,ready=false;
let status=null,button=null,modeReadout=null;
const own=(o,k)=>o&&Object.prototype.hasOwnProperty.call(o,k);
function notify(){window.dispatchEvent(new CustomEvent("b737:mcp-afds-state",{detail:Core.output(state)}));}
function send(action){
 state=Core.transition(state,action);
 project();notify();return Core.output(state);
}
function electrical(){
 const provider=window.B737ISNCockpitV1;
 if(!provider?.getState)return;
 const result=provider.getState();
 const electrical=result?.state?.electrical;
 if(electrical?.schema!=="B737_ELECTRICAL_V7_RESULT")return;
 const fingerprint=JSON.stringify([electrical.revision,electrical.bus]);
 if(fingerprint===lastElectrical)return;
 lastElectrical=fingerprint;
 send({type:"ELECTRICAL",snapshot:electrical});
}
function statusLabel(out){
 if(out.power===false)return "MCP POWER OFF · proven global AC/DC loss";
 if(out.power===null)return "MCP POWER UNKNOWN · equipment feed not verified";
 return "MCP ON · instructor-observed training power (not verified wiring)";
}
function project(){
 const out=Core.output(state);
 const visual=window.B737McpVisualV3,hardware=window.B737McpHardwareV1;
 if(visual){
  visual.setPower?.(out.power);
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
 if(button){
  button.disabled=out.power===false;
  button.textContent=out.power===true?"Clear observed MCP power":"Confirm observed MCP power · TRAINING";
  button.setAttribute("aria-pressed",String(out.power===true));
 }
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
 button=document.createElement("button");button.type="button";button.className="mcp-afds-observe";
 button.title="Trainer observation only. No assumption of aircraft-specific wiring.";
 button.addEventListener("click",()=>{send({type:"OBSERVE_POWER",active:!state.observedPower,instructor:true})});
 modeReadout=document.createElement("p");modeReadout.className="mcp-afds-mode-status";
 const note=document.createElement("small");
 note.textContent="Source-gated: electrical bus presence does not certify MCP feeder. LNAV/VNAV/APP require actual evidence.";
 section.append(heading,status,button,modeReadout,note);
 target.prepend(section);
 project();
}
window.addEventListener("b737:cockpit-mounted",()=>{decorate();project();electrical()});
window.addEventListener("b737:isn-start-indications",electrical);
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
 observePower:active=>send({type:"OBSERVE_POWER",active:!!active,instructor:true}),
 setEvidence:(key,value)=>send({type:"EVIDENCE",key,value}),
 press:requestMode,
 reset:()=>send({type:"RESET"})
});
})();