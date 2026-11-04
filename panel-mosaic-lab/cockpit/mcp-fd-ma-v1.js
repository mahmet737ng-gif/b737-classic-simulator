/* MCP-FD-MA-0006 | centered circular MA over original F/D annun hole; FCOM 4.10.13, 4.20.3.
 * Two non-clickable master FCC lamps over unmodified approved MCP artwork.
 * TRAINING ONLY - independent modes require explicit sensor/instructor evidence.
 */
(function(host,factory){
"use strict";
const api=factory();
if(typeof module==="object"&&module.exports)module.exports=api;
if(host&&host.document){host.B737McpFDMAV1=api;api.bind(host);}
})(typeof window!=="undefined"?window:null,function(){
"use strict";
const W=2172,H=433,position=Object.freeze({
 left:Object.freeze({x:203,y:220,w:42,h:42}),
 right:Object.freeze({x:1903,y:220,w:42,h:42})
});
const defaults=()=>({kind:"NORMAL",radioAltitudeFt:null,
 locCaptured:false,gsCaptured:false,fccAvailable:{left:null,right:null}});
/* A verified live AC bus is an educational power proxy, not a certified
 * FCC circuit breaker or MCP feeder assignment. No lights without AC evidence,
 * unless an instructor explicitly confirms MCP power.
 */
function acEvidence(electrical){
 if(electrical?.schema!=="B737_ELECTRICAL_V7_RESULT"||!electrical.bus)return null;
 const keys=["transfer1","transfer2","main1","main2","acStandby"];
 if(keys.some(k=>electrical.bus[k]===true))return true;
 if(keys.every(k=>electrical.bus[k]===false))return false;
 return null;
}
function maSupply(output,electrical){
 if(output?.power===false)return {powered:false,source:"AFDS_MCP_POWER_OFF"};
 if(output?.power===true)return {powered:true,source:"INSTRUCTOR_CONFIRMED_MCP"};
 const live=acEvidence(electrical);
 return {powered:live,source:live===true?"LIVE_AC_BUS_PROXY":live===false?"LIVE_AC_OFF":"POWER_UNVERIFIED"};
}
const initialState=()=>({firstFd:null,previousFd:{left:false,right:false},
 lamps:{left:false,right:false},master:null,independent:false,reason:"OFF"});
function evaluate(previous,output,evidence){
 const before=previous||initialState();
 const fd=output?.controls?.fd||{};
 const left=fd.left===true,right=fd.right===true;
 const prev=before.previousFd||{};
 let first=before.firstFd;
 if(!left&&!right)first=null;
 else if(first==="left"&&!left)first=right?"right":null;
 else if(first==="right"&&!right)first=left?"left":null;
 else if(first===null){
  if(left&&!prev.left&&!(right&&!prev.right))first="left";
  else if(right&&!prev.right&&!(left&&!prev.left))first="right";
  else if(left&&!right)first="left";
  else if(right&&!left)first="right";
 }
 const s={firstFd:first,previousFd:{left,right},
  lamps:{left:false,right:false},master:null,independent:false,reason:"OFF"};
 if(!left&&!right)return s;
 if((output?.maPower??output?.power)!==true){s.reason="MCP_AC_POWER_NOT_EVIDENCED";return s;}
 const ev=evidence||defaults(),available=ev.fccAvailable||{};
 const ap=output?.modes?.autopilot;
 const cmd=ap==="CMD_A"?"left":ap==="CMD_B"?"right":null;
 let master=cmd||first;
 if(master==="left"&&available.left===false)master=available.right===false?null:"right";
 if(master==="right"&&available.right===false)master=available.left===false?null:"left";
 if(!master){s.reason="MASTER_UNRESOLVED";return s;}
 const ra=ev.radioAltitudeFt;
 const below400=typeof ra==="number"&&Number.isFinite(ra)&&ra>=0&&ra<400;
 const independent=!cmd&&left&&right&&available.left!==false&&available.right!==false&&(
  ((ev.kind==="TO"||ev.kind==="GA")&&below400)||
  (ev.kind==="APP"&&ev.locCaptured===true&&ev.gsCaptured===true));
 s.master=master;s.independent=independent;
 s.reason=independent?"INDEPENDENT_FD":cmd?"AP_CMD_MASTER":"FIRST_FD_MASTER";
 s.lamps=independent?{left:true,right:true}:{left:master==="left",right:master==="right"};
 return s;
}
let state=initialState(),evidence=defaults(),latest=null,visualTest=false,hostWindow=null,lastRefreshSignature=null;
const roots=new WeakSet(),mounted=[];
function installStyle(){
 if(!hostWindow?.document||hostWindow.document.getElementById("mcp-fd-ma-0001-style"))return;
 const el=hostWindow.document.createElement("style");
 el.id="mcp-fd-ma-0001-style";
 el.textContent=[
 /* Owner specified: ROUND black lamp, WHITE MA in both OFF and ON. */
 '[data-piece="mcp"]>.mcp-fd-ma{position:absolute;z-index:7;display:block;box-sizing:border-box;',
 'transform:translate(-50%,-50%);pointer-events:none;user-select:none;overflow:hidden;',
 'border:1px solid #3d4140;border-radius:50%!important;',
 'background:radial-gradient(circle at 36% 24%,#222727 0%,#0a0d0d 40%,#010202 80%);',
 'box-shadow:0 1px 2px #000d,inset 0 1px 3px #000,inset 0 0 1px 1px #101919}',
 '[data-piece="mcp"]>.mcp-fd-ma:before{content:"";position:absolute;inset:4%;',
 'border-radius:50%;border:1px solid #545b5680;box-shadow:inset 0 0 4px #000b;pointer-events:none}',
 '[data-piece="mcp"]>.mcp-fd-ma svg{display:block;width:100%;height:100%;overflow:visible}',
 '[data-piece="mcp"]>.mcp-fd-ma .mcp-fd-ma-label{fill:#f6f7f4;stroke:none;',
 'font:700 17px Arial,Helvetica,sans-serif;letter-spacing:-.35px;paint-order:stroke fill;opacity:.12;filter:none}',
 '[data-piece="mcp"]>.mcp-fd-ma[data-on="false"] .mcp-fd-ma-label{fill:#fff;opacity:.12!important;filter:none!important}',
 '[data-piece="mcp"]>.mcp-fd-ma[data-on="false"]{border-color:#222928!important;background:radial-gradient(circle at 40% 30%,#101413,#040606 70%,#010202 100%)!important;box-shadow:inset 0 1px 3px #000,inset 0 0 2px #090d0b!important}',
 /* The lens remains black when powered. Only reflected light and white MA glow change. */
 '[data-piece="mcp"]>.mcp-fd-ma[data-on="true"]{',
 'border-color:#69716b;',
 'background:radial-gradient(circle at 45% 33%,#282f2d 0%,#0c1411 49%,#020403 86%);',
 'box-shadow:0 0 2px .3px #d9f6df55,inset 0 0 2px #b9eac044,',
 'inset 0 1px 2px #030807}',
 '[data-piece="mcp"]>.mcp-fd-ma[data-on="true"] .mcp-fd-ma-label{',
 'fill:#fff;opacity:1!important;filter:none!important}'
 ].join("");
 (hostWindow.document.head||hostWindow.document.documentElement).append(el);
}
function render(){
 for(const root of mounted)for(const side of ["left","right"]){
  const el=root.querySelector('[data-mcp-ma="'+side+'"]');if(!el)continue;
  const on=visualTest||state.lamps[side]===true;
  el.dataset.on=String(on);
  el.dataset.source=visualTest?"LAMP_TEST":state.reason;
  el.dataset.fdSource=state.fdSource||"AFDS_OUTPUT";
  el.title=visualTest?"MA illuminated by ALL LIGHTS ON test":
   "MA "+(on?"ON":"OFF")+" | "+state.reason+" | "+(state.supply?.source||"POWER_UNVERIFIED");
  el.setAttribute("aria-label","Flight Director MA "+side+" "+(on?"illuminated":"extinguished"));
 }
}
function mount(){
 if(!hostWindow?.document)return;installStyle();
 for(const root of hostWindow.document.querySelectorAll('[data-piece="mcp"]')){
  if(roots.has(root))continue;
  roots.add(root);mounted.push(root);
  for(const side of ["left","right"]){
   const p=position[side],el=hostWindow.document.createElement("span");
   el.className="mcp-fd-ma";el.dataset.mcpMa=side;el.dataset.on="false";
   el.setAttribute("role","img");
   // Compact 42x42 circular bezel centered on the black MA hole, clear of F/D lettering.
   el.innerHTML='<svg viewBox="0 0 42 42" preserveAspectRatio="xMidYMid meet" aria-hidden="true" focusable="false"><text class="mcp-fd-ma-label" x="21" y="21.5" text-anchor="middle" dominant-baseline="central">MA</text></svg>';
   el.style.left=p.x/W*100+"%";el.style.top=p.y/H*100+"%";
   el.style.width=p.w/W*100+"%";el.style.height=p.h/H*100+"%";
   // Font geometry is set by the SVG viewBox, not viewport-dependent CSS.
   root.append(el);
  }
 }
 render();
}
function getState(){return JSON.parse(JSON.stringify({state,evidence,visualTest,position}));}
function liveElectrical(){
 try{return hostWindow?.B737ISNCockpitV1?.getState?.()?.state?.electrical??null}
 catch(e){return null}
}
/* Master annunciator source: use physical F/D switches when AFDS output lags.
 * This reconciles lamp indication; it does not implement flight-control servos.
 */
function reconcileFd(out,physical){
 const l=physical?.FD_LEFT,r=physical?.FD_RIGHT;
 if(!["ON","OFF"].includes(l)||!["ON","OFF"].includes(r))return out;
 const fd={left:l==="ON",right:r==="ON"},afds=out?.controls?.fd||{};
 const mismatch=fd.left!==afds.left||fd.right!==afds.right;
 return {...out,controls:{...out.controls,fd},maFdSource:mismatch?
  "HARDWARE_DIRECT_AFDS_MISMATCH":"HARDWARE_VERIFIED"};
}
function hardware(){
 try{return hostWindow?.B737McpHardwareV1?.getState?.()??null}
 catch(e){return null}
}
function applyOutput(out){
 if(!out||out.schema!=="B737_MCP_AFDS_OUTPUT_V1")return getState();
 latest=out;
 const physical=reconcileFd(out,hardware());
 const supply=maSupply(out,liveElectrical());
 state=evaluate(state,{...physical,maPower:supply.powered},evidence);
 state.supply=supply;
 state.fdSource=physical.maFdSource||"AFDS_OUTPUT";
 state.afdsFd={...out.controls.fd};
 state.physicalFd={...physical.controls.fd};
 render();
 if(hostWindow)hostWindow.dispatchEvent(new CustomEvent("b737:mcp-ma-state",{detail:getState()}));
 return getState();
}
function refresh(){
 const next=hostWindow?.B737McpAFDSBridgeV1?.getOutput?.()||latest;
 if(!next)return getState();
 // Do not render unnecessarily on repeated ECU/AFDS sensor broadcasts.
 const sig=JSON.stringify([next.power,next.controls?.fd,hardware()?.FD_LEFT,hardware()?.FD_RIGHT,
  next.modes?.autopilot,maSupply(next,liveElectrical()),evidence]);
 if(lastRefreshSignature===sig)return getState();
 lastRefreshSignature=sig;
 return applyOutput(next);
}
function setEvidence(data){
 if(!data||typeof data!=="object")throw Error("Explicit evidence required");
 if(data.kind!==undefined){
  if(!["NORMAL","TO","GA","APP"].includes(data.kind))throw Error("Invalid FD mode");
  evidence.kind=data.kind;
 }
 if(Object.hasOwn(data,"radioAltitudeFt")){
  if(data.radioAltitudeFt!==null&&(!Number.isFinite(data.radioAltitudeFt)||data.radioAltitudeFt<0))throw Error("Invalid RA");
  evidence.radioAltitudeFt=data.radioAltitudeFt;
 }
 for(const key of ["locCaptured","gsCaptured"])if(Object.hasOwn(data,key)){
  if(typeof data[key]!=="boolean")throw Error("Capture status must be boolean");
  evidence[key]=data[key];
 }
 if(data.fccAvailable!==undefined){
  if(!data.fccAvailable||typeof data.fccAvailable!=="object")throw Error("FCC availability required");
  for(const side of ["left","right"])if(Object.hasOwn(data.fccAvailable,side)){
   const v=data.fccAvailable[side];
   if(v!==null&&typeof v!=="boolean")throw Error("FCC availability must be true/false/null");
   evidence.fccAvailable[side]=v;
  }
 }
 if(latest)applyOutput(latest);
 return getState();
}
function bind(win){
 hostWindow=win;
 win.addEventListener("b737:mcp-afds-state",e=>{lastRefreshSignature=null;applyOutput(e.detail)});
 win.addEventListener("b737:cockpit-mounted",()=>{mount();refresh()});
 // The F/D physical switch is authoritative; AFDS bridge runs first, then
 // this listener re-reads its output to prevent a disconnected annunciator.
 win.addEventListener("b737:mcp-hardware-change",e=>{
  if(e.detail?.id==="FD_LEFT"||e.detail?.id==="FD_RIGHT")refresh();
 });
 for(const event of ["b737:isn-start-indications","b737:electrical-network",
  "b737:electrical-v7-state","b737:electrical-owner-ready",
  "b737:unified-ecu-observation"])win.addEventListener(event,refresh);
 win.addEventListener("b737:visual-test",e=>{visualTest=e.detail?.active===true;render()});
 win.document.addEventListener("DOMContentLoaded",()=>{mount();refresh()});
 if(win.document.readyState!=="loading"){mount();refresh()}
}
return Object.freeze({initialState,evaluate,acEvidence,maSupply,reconcileFd,position,getState,applyOutput,refresh,setEvidence,mount,bind,
 audit:()=>({mountedRoots:mounted.length,indicators:mounted.map(root=>[...root.querySelectorAll("[data-mcp-ma]")].map(el=>({side:el.dataset.mcpMa,on:el.dataset.on,text:el.textContent,rect:{width:el.getBoundingClientRect().width,height:el.getBoundingClientRect().height}})))}),
 resetEvidence:()=>{evidence=defaults();if(latest)applyOutput(latest);return getState()}});
});