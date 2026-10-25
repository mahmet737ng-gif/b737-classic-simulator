/* B737 Classic CB Panel Lab: isolated state adapter, NOT verified aircraft wiring. */
(function(){
"use strict";
const API=window.B737_CB_Kernel, catalog=window.CB_CATALOG;
if(!API||!catalog){console.warn("CB kernel/catalog unavailable");return;}
const storageKey="b737classic.cb.v1", net=new API.BreakerNetwork(catalog);
const demoCB=API.keyFor("P6-5","A1"),demoConsumer="SANDBOX_INDICATOR_NOT_AIRCRAFT";
net.addRoute({breaker:demoCB,bus:"SANDBOX_28V",consumer:demoConsumer,mode:"SANDBOX"});
net.setBus("SANDBOX_28V",true,"SANDBOX");
let selected=demoCB,error="";
try{const raw=localStorage.getItem(storageKey);if(raw){const r=net.restore(JSON.parse(raw));if(!r.ok)error="Stored state rejected: "+r.reason;}}catch(e){error="Local storage unavailable";}
function save(){try{localStorage.setItem(storageKey,JSON.stringify(net.snapshot()));}catch(e){error="Local storage unavailable";}}
function syncVisual(){const lab=window.B737_CB_LAB;if(!lab)return;lab.setVariant(net.variant);for(const b of net.activeEntries())lab.setPulled(b.id,b.pulled);}
const style=document.createElement("style");style.textContent=[
".cb-electric{border:1px solid #59707d;border-radius:12px;background:#18242c;padding:16px 19px;margin:16px 0;display:grid;gap:12px;color:#e6f1f5;direction:ltr;font:13px/1.6 Arial,sans-serif}",
".cb-electric h3{font-size:16px;margin:0}.cb-electric p{margin:0;color:#b9cdd7}",
".cb-electric .cb-cells{display:flex;flex-wrap:wrap;gap:8px}",
".cb-electric .cb-chip{padding:7px 10px;border:1px solid #465c65;background:#243640;border-radius:7px}",
".cb-electric button{font:inherit;padding:7px 13px;min-height:36px;cursor:pointer;background:#344851;border:1px solid #628295;border-radius:7px;color:white}",
".cb-electric .cb-warn{color:#ffcf9b}.cb-electric .cb-fault{color:#ff8890}",
".cb-electric .cb-btns{display:flex;gap:8px;align-items:center;flex-wrap:wrap}"
].join("\n");document.head.append(style);
const region=document.createElement("section");region.className="cb-electric";region.setAttribute("aria-label","CB electrical test status");
region.innerHTML='<h3>CIRCUIT BREAKERS · ELECTRICAL LAB</h3>'+
'<p>11-panel CB catalog and independent state kernel. <b>Aircraft wiring is UNKNOWN until individually traced.</b> The TEST indicator below is synthetic, NOT Boeing circuitry.</p>'+
'<div class="cb-cells" id="cbp-cells"></div>'+
'<div class="cb-btns"><button id="cbp-trip">Inject TEST trip</button><button id="cbp-clear">Clear TEST fault</button><button id="cbp-bus">Toggle synthetic 28V supply</button></div>'+
'<p id="cbp-selected"></p><p id="cbp-consumer"></p><p id="cbp-message" role="status"></p>';
const summary=document.querySelector(".summary");summary.after(region);
const els={cells:region.querySelector("#cbp-cells"),selected:region.querySelector("#cbp-selected"),consumer:region.querySelector("#cbp-consumer"),message:region.querySelector("#cbp-message")};
function render(){
const r=net.report(),b=net.state(selected),p=net.consumer(demoConsumer,"SANDBOX");
els.cells.innerHTML='<span class="cb-chip">Panels: '+r.panels+'/11</span><span class="cb-chip">CBs: '+r.breakers+'</span><span class="cb-chip">Pulled: '+r.pulled+'</span><span class="cb-chip">Trips: '+r.tripped+'</span><span class="cb-chip">Verified feeds: '+r.verifiedRoutes+'</span><span class="cb-chip">Mode: '+r.variant+'</span>';
els.selected.textContent=b?"Selected "+b.id+" / "+b.label+" / "+(b.tripped?"TRIPPED":b.pulled?"PULLED":"PUSHED")+" | aircraft consumer UNKNOWN":"No breaker selected";
els.consumer.textContent="SANDBOX indicator = "+p.status+" | test CB P6-5 A1; no effect on aircraft.";
els.message.textContent=error||"Unverified routes have no electrical effects.";
els.message.className=error?"cb-fault":"cb-warn";
}
window.addEventListener("b737-cb-command",e=>{
const d=e.detail||{};if(!net.state(d.key))return;
const r=net.action(d.key,d.action);
if(!r.ok){error="Blocked "+r.reason;e.preventDefault();}else{error="";selected=d.key;save();}
render();
});
window.addEventListener("b737-cb-variant",e=>{net.setVariant(e.detail.variant);error="";save();syncVisual();render();});
window.addEventListener("b737-cb-reset",()=>{net.reset();error="";save();render();});
region.querySelector("#cbp-trip").addEventListener("click",()=>{
const r=net.action(selected,"INJECT_TRIP","Synthetic training fault");
if(r.ok){window.B737_CB_LAB&&window.B737_CB_LAB.setPulled(selected,true);save();error="Trip injected: clear TEST fault before Push.";}else error=r.reason;
render();
});
region.querySelector("#cbp-clear").addEventListener("click",()=>{const r=net.action(selected,"CLEAR_FAULT");if(r.ok){save();error="Test fault cleared; CB still pulled until manually pushed.";}else error=r.reason;render();});
region.querySelector("#cbp-bus").addEventListener("click",()=>{const old=net.busStates.get("SANDBOX_28V");net.setBus("SANDBOX_28V",!(old&&old.powered),"SANDBOX");save();render();});
window.B737_CB_Electrical={network:net,report:()=>net.report()};
syncVisual();render();
})();