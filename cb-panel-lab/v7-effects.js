/* CB panel lab: source-located circuit association × Electrical V7 × fuel trainer.
 * No aircraft bus-to-CB feed has been asserted; fuel bus is labeled SURROGATE.
 */
(function(){
"use strict";
const C=window.B737_CB_Electrical, E=window.B737ElectricalV7,
 T=window.B737TrainerCore, Bridge=window.B737CBSystemsBridge;
if(!C||!E||!T||!Bridge){console.warn("CB/V7 dependencies unavailable");return;}
const net=C.network;
let elState=E.initialState(),trainingState=T.initialState(),last=null;
const section=document.createElement("section");
section.className="cb-electric";section.setAttribute("aria-label","Electrical V7 and CB dependent equipment");
section.innerHTML='<h3>CB → ELECTRICAL V7 → EQUIPMENT / TRAINING</h3>'+
'<p>Source: Classic MRG CB Index pp.135–136; Sepehran FCOM Electrical 6.20. The actual CB-to-bus wires remain UNVERIFIED. Fuel pump bus mapping below is a <b>trainer surrogate</b>, not EP-FSI wiring.</p>'+
'<div class="cb-btns"><button id="cbv-gen1">TEST GEN1 FAIL</button><button id="cbv-gen2">TEST GEN2 FAIL</button><button id="cbv-trans">BUS TRANS AUTO</button><button id="cbv-reset">RESET ELECTRICAL V7</button></div>'+
'<p id="cbv-summary"></p><div id="cbv-bus" class="cb-cells"></div><p>Protected circuits (CB open = protected circuit interrupted, NOT proof of every backup feed):</p>'+
'<div id="cbv-devices" class="cb-cells"></div><p id="cbv-caution"></p>'+
'<p class="cb-warn">No undocumented CB pull propagates a false bus outage into Electrical V7. A closed CB alone never asserts aircraft load powered.</p>';
const origin=document.querySelector(".cb-electric");origin.after(section);
const $=id=>section.querySelector("#"+id);
const safe=s=>String(s).replace(/[&<>"]/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[ch]));
function tile(name,state,info){
const color=state===false||state==="OPEN"?"#f9aab4":state===true||state==="CLOSED"?"#a9e8be":"#e8c784";
return '<span class="cb-chip" style="border-color:'+color+'"><b>'+safe(name)+'</b>: '+safe(state===null?"UNKNOWN":String(state))+(info?'<small style="display:block;font-size:10px">'+safe(info)+'</small>':"")+'</span>';
}
function render(){
const v=E.evaluate(elState),t=T.derive(trainingState),p=Bridge.project({cbNetwork:net,electricalV7Result:v,trainerResult:t,trainerState:trainingState});
last={v7:v,project:p};
$("cbv-summary").textContent="Electrical V7: GEN 1 "+(v.source[1]||"OFF")+" | GEN 2 "+(v.source[2]||"OFF")+" | BUS TRANS AUTO "+(elState.config.busTransferAuto?"ON":"OFF")+" | CB equipment mappings: "+p.linkedEquipment;
$("cbv-bus").innerHTML=[["Transfer 1",v.bus.transfer1],["Transfer 2",v.bus.transfer2],["DC 1",v.bus.dc1],["DC 2",v.bus.dc2],["Battery",v.bus.battery],["AC standby",v.bus.acStandby]].map(x=>tile(x[0],x[1])).join("");
$("cbv-devices").innerHTML=Bridge.ALLOCATIONS.map(a=>{
const c=p.circuits[a.load],fuel=a.load.startsWith("fuel."),f=fuel?p.overlay.fuel[a.load.slice(5)]:null;
const hyd=a.load.startsWith("hyd."),h=hyd?p.overlay.hyd[a.load.slice(4)]:null;
let detail=fuel?"FUEL TRAINING "+(f.operational===null?"UNKNOWN":f.operational?"RUN":"STOP")+" | "+f.surrogateBus:hyd?"HYD TRAINING "+(h.operating===null?"UNKNOWN":h.operating?"RUN":"STOP")+" | "+h.feedBus:"Real availability UNKNOWN";
return tile(a.load,c.protectionCircuit,detail);
}).join("");
const x=p.overlay.annunciations;
$("cbv-caution").textContent="Training FUEL caution: "+(x.fuelCautionTraining?"ON":"OFF")+" | HYD System A: "+String(p.overlay.systemHyd.A)+"; B: "+String(p.overlay.systemHyd.B)+" (engine-driven pumps remain independent; simplified projection).";
}
function fault(id){elState=E.apply(elState,{type:"FAULT",id,active:!elState.faults[id],instructor:true});render();}
$("cbv-gen1").onclick=()=>fault("GEN1_FAILED");
$("cbv-gen2").onclick=()=>fault("GEN2_FAILED");
$("cbv-trans").onclick=()=>{elState=E.apply(elState,{type:"CONTROL",key:"busTransferAuto",value:!elState.config.busTransferAuto});render();};
$("cbv-reset").onclick=()=>{elState=E.initialState();render();};
net.subscribe(evt=>{if(["PULL","PUSH","INJECT_TRIP","CLEAR_FAULT","RESET","VARIANT","RESTORE"].includes(evt.type))render();});
window.B737_CB_V7_Integration={evaluate:()=>last,electrical:()=>elState};
render();
})();