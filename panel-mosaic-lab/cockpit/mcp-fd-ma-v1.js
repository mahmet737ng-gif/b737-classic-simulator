/* MCP-FD-MA-0002 | round MA lens visual revision; FCOM 4.10.13, 4.20.3.
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
 left:Object.freeze({x:203,y:250,w:46,h:46}),
 right:Object.freeze({x:1903,y:250,w:46,h:46})
});
const defaults=()=>({kind:"NORMAL",radioAltitudeFt:null,
 locCaptured:false,gsCaptured:false,fccAvailable:{left:null,right:null}});
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
 if(output?.power!==true){s.reason="MCP_POWER_UNVERIFIED";return s;}
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
let state=initialState(),evidence=defaults(),latest=null,visualTest=false,hostWindow=null;
const roots=new WeakSet(),mounted=[];
function installStyle(){
 if(!hostWindow?.document||hostWindow.document.getElementById("mcp-fd-ma-0001-style"))return;
 const el=hostWindow.document.createElement("style");
 el.id="mcp-fd-ma-0001-style";
 el.textContent=[
 /* Owner specified: ROUND black lamp, WHITE MA in both OFF and ON. */
 '[data-piece="mcp"]>.mcp-fd-ma{position:absolute;z-index:7;display:block;box-sizing:border-box;',
 'transform:translate(-50%,-50%);pointer-events:none;user-select:none;overflow:hidden;',
 'border:2px solid #3d4140;border-radius:50%!important;',
 'background:radial-gradient(circle at 36% 24%,#222727 0%,#0a0d0d 40%,#010202 80%);',
 'box-shadow:0 1px 2px #000d,inset 0 1px 3px #000,inset 0 0 1px 1px #101919}',
 '[data-piece="mcp"]>.mcp-fd-ma:before{content:"";position:absolute;inset:4%;',
 'border-radius:50%;border:1px solid #545b5680;box-shadow:inset 0 0 4px #000b;pointer-events:none}',
 '[data-piece="mcp"]>.mcp-fd-ma svg{display:block;width:100%;height:100%;overflow:visible}',
 '[data-piece="mcp"]>.mcp-fd-ma .mcp-fd-ma-label{fill:#f6f7f4;stroke:none;',
 'font:700 16px Arial,Helvetica,sans-serif;letter-spacing:-.35px;paint-order:stroke fill}',
 /* The lens remains black when powered. Only reflected light and white MA glow change. */
 '[data-piece="mcp"]>.mcp-fd-ma[data-on="true"]{',
 'border-color:#727d76;',
 'background:radial-gradient(circle at 45% 33%,#282f2d 0%,#0c1411 49%,#020403 86%);',
 'box-shadow:0 0 3px 1px #e7fff299,0 0 9px 2px #d7ffe252,',
 'inset 0 0 5px 1px #e7ffe536,inset 0 1px 3px #030807}',
 '[data-piece="mcp"]>.mcp-fd-ma[data-on="true"] .mcp-fd-ma-label{',
 'fill:#fff;filter:drop-shadow(0 0 1.3px #fff) drop-shadow(0 0 2.7px #d0ffe4)}'
 ].join("");
 (hostWindow.document.head||hostWindow.document.documentElement).append(el);
}
function render(){
 for(const root of mounted)for(const side of ["left","right"]){
  const el=root.querySelector('[data-mcp-ma="'+side+'"]');if(!el)continue;
  const on=visualTest||state.lamps[side]===true;
  el.dataset.on=String(on);
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
   // The fixed SVG viewBox scales the white glyph with the 46px circular lens.
   el.innerHTML='<svg viewBox="0 0 46 46" preserveAspectRatio="xMidYMid meet" aria-hidden="true" focusable="false"><text class="mcp-fd-ma-label" x="23" y="23.6" text-anchor="middle" dominant-baseline="central">MA</text></svg>';
   el.style.left=p.x/W*100+"%";el.style.top=p.y/H*100+"%";
   el.style.width=p.w/W*100+"%";el.style.height=p.h/H*100+"%";
   // Font geometry is set by the SVG viewBox, not viewport-dependent CSS.
   root.append(el);
  }
 }
 render();
}
function getState(){return JSON.parse(JSON.stringify({state,evidence,visualTest,position}));}
function applyOutput(out){
 if(!out||out.schema!=="B737_MCP_AFDS_OUTPUT_V1")return getState();
 latest=out;state=evaluate(state,out,evidence);render();
 if(hostWindow)hostWindow.dispatchEvent(new CustomEvent("b737:mcp-ma-state",{detail:getState()}));
 return getState();
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
 win.addEventListener("b737:mcp-afds-state",e=>applyOutput(e.detail));
 win.addEventListener("b737:cockpit-mounted",mount);
 win.addEventListener("b737:visual-test",e=>{visualTest=e.detail?.active===true;render()});
 win.document.addEventListener("DOMContentLoaded",()=>{
  mount();applyOutput(win.B737McpAFDSBridgeV1?.getOutput?.());
 });
 if(win.document.readyState!=="loading"){
  mount();applyOutput(win.B737McpAFDSBridgeV1?.getOutput?.());
 }
}
return Object.freeze({initialState,evaluate,position,getState,applyOutput,setEvidence,mount,bind,
 resetEvidence:()=>{evidence=defaults();if(latest)applyOutput(latest);return getState()}});
});