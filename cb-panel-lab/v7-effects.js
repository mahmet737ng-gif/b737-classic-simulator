/* B737 Classic CB functional index ↔ Electrical V7 training adapter.
 * Only opened protection circuits are asserted; EP-FSI bus wiring stays unverified.
 */
(function(){"use strict";
const C=window.B737_CB_Electrical,E=window.B737ElectricalV7,T=window.B737TrainerCore;
const B=window.B737CBSystemsBridge,Index=window.B737ClassicMRGCBIndex;
if(!C||!E||!T||!B||!Index){console.warn("CB MRG/V7 dependencies unavailable");return;}
const network=C.network;
let v7State=E.initialState(),trainerState=T.initialState(),last=null;
const section=document.createElement("section");section.className="cb-electric";
section.setAttribute("aria-label","Classic CB and Electrical V7 protected-circuit test");
section.innerHTML=[
'<h3>B737 CLASSIC CB → ELECTRICAL V7 → PROTECTED CIRCUITS</h3>',
'<p>Classic MRG index pp.134–136; source/photo-matched associations only. ',
'Exact EP-FSI CB feed wiring remains unverified.</p>',
'<div class="cb-btns">',
'<button id="cbv-gen1">INJECT GEN1 FAIL</button>',
'<button id="cbv-gen2">INJECT GEN2 FAIL</button>',
'<button id="cbv-transfer">BUS TRANS AUTO</button>',
'<button id="cbv-reset">RESET V7</button></div>',
'<p id="cbv-summary"></p><div id="cbv-bus" class="cb-cells"></div>',
'<p>Each entry denotes its protected circuit, NOT the entire equipment.</p>',
'<div id="cbv-devices" class="cb-cells"></div>',
'<p id="cbv-caution"></p><p id="cbv-audit" class="cb-warn"></p>'
].join("");
document.querySelector(".cb-electric").after(section);
const $=id=>section.querySelector("#"+id);
const esc=s=>String(s).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
function tile(name,val,detail){
 const edge=val===false||val==="OPEN"?"#f9aab4":val===true||val==="CLOSED"?"#a9e8be":"#e8c784";
 return '<span class="cb-chip" style="border-color:'+edge+'"><b>'+esc(name)+'</b>: '+
 esc(val===null?"UNKNOWN":String(val))+(detail?'<small style="display:block;font-size:10px">'+esc(detail)+'</small>':"")+'</span>';
}
function render(){
 const e=E.evaluate(v7State),t=T.derive(trainerState);
 const p=B.project({cbNetwork:network,electricalV7Result:e,trainerResult:t,trainerState:trainerState});
 last={electrical:e,projection:p};
 $("cbv-summary").textContent="GEN1 "+(e.source[1]||"OFF")+" | GEN2 "+(e.source[2]||"OFF")+
  " | BUS TRANS "+(v7State.config.busTransferAuto?"AUTO":"OFF")+
  " | Active source-indexed CB associations "+p.linkedEquipment;
 $("cbv-bus").innerHTML=[["GEN BUS1",e.bus.generator1],["GEN BUS2",e.bus.generator2],
  ["TRANSFER1",e.bus.transfer1],["TRANSFER2",e.bus.transfer2],
  ["DC1",e.bus.dc1],["DC2",e.bus.dc2],["BATTERY",e.bus.battery],
  ["AC STANDBY",e.bus.acStandby]].map(row=>tile(row[0],row[1])).join("");
 $("cbv-devices").innerHTML=Object.values(p.circuits).map(c=>{
   const f=c.load.startsWith("fuel.")?p.overlay.fuel[c.load.slice(5)]:null;
   const h=c.load.startsWith("hyd.")?p.overlay.hyd[c.load.slice(4)]:null;
   const detail=f&&f.surrogateBus?
    "FUEL TRAINER "+(f.operational===null?"UNKNOWN":f.operational?"RUN":"STOP")+" / "+f.surrogateBus:
    h&&h.feedBus?"HYD TRAINER "+(h.operating===null?"UNKNOWN":h.operating?"RUN":"STOP")+" / "+h.feedBus:
    "Protected "+c.role+"; full equipment power UNKNOWN";
   return tile(c.key+" · "+c.load,c.protectionCircuit,detail);
 }).join("");
 const w=p.overlay.annunciations;
 $("cbv-caution").textContent="Fuel warning CONDITION (trainer): "+(w.fuelCautionTraining?"ACTIVE":"INACTIVE")+
  " | Fuel LAMP (trainer): "+(w.fuelLampTraining?"ON":"OFF")+
  " | HYD A: "+String(p.overlay.systemHyd.A)+" / B: "+String(p.overlay.systemHyd.B)+
  ". Pulling a lamp CB cannot clear the warning cause.";
 const qa=Index.audit(window.CB_CATALOG);
 $("cbv-audit").textContent="MRG-photo matched variant entries: "+qa.valid.length+
  " | OCR conflicts: "+qa.errors.length+" | disputed locations: "+qa.quarantine.length+
  " | EP-FSI-specific CB upstream wiring proven: ZERO.";
}
function fault(id){v7State=E.apply(v7State,{type:"FAULT",id,active:!v7State.faults[id],instructor:true});render();}
$("cbv-gen1").onclick=()=>fault("GEN1_FAILED");
$("cbv-gen2").onclick=()=>fault("GEN2_FAILED");
$("cbv-transfer").onclick=()=>{v7State=E.apply(v7State,{type:"CONTROL",key:"busTransferAuto",value:!v7State.config.busTransferAuto});render();};
$("cbv-reset").onclick=()=>{v7State=E.initialState();render();};
network.subscribe(e=>{if(["PULL","PUSH","INJECT_TRIP","CLEAR_FAULT","RESET","VARIANT","RESTORE"].includes(e.type))render();});
window.B737_CB_V7_Integration={evaluate:()=>last,electrical:()=>v7State};
render();
})();