/* MCP-DIGITS-0004 | Native live MCP amber seven-segment displays.
 * All six displays are automatic Electrical V7 consumers. No Controls preview
 * toggle or instructor-observed power can energize them. The old preview is
 * retired; ?mcpDigitsTest=1 is an explicit visual-only diagnostics URL.
 * Photo, buttons, AFDS mode logic, and knob geometry are left unchanged.
 * Repaints only on MCP value or electrical distribution / breaker events.
 */
(function(win){
"use strict";
const NS="http://www.w3.org/2000/svg",W=2172,H=433;
const qa=new URLSearchParams(win.location.search).get("mcpDigitsTest")==="1";
const areas=Object.freeze([
 {id:"courseL",x:85,y:112,w:112,h:59},
 {id:"speed",x:485,y:115,w:147,h:56},
 {id:"heading",x:826,y:113,w:119,h:58},
 {id:"altitude",x:1127,y:114,w:171,h:56},
 {id:"verticalSpeed",x:1376,y:118,w:171,h:56},
 {id:"courseR",x:1932,y:120,w:121,h:55}
]);
const segments=Object.freeze({
 a:"M9 4.5 L27 4.5",b:"M30 8.5 L29 24",c:"M29 35 L28 50",
 d:"M8 54.5 L26 54.5",e:"M6 35 L5 50",f:"M7 8.5 L6 24",
 g:"M8.5 29.5 L27 29.5"
});
const segOn=Object.freeze({0:"abcdef",1:"bc",2:"abged",3:"abgcd",4:"fgbc",
 5:"afgcd",6:"afgecd",7:"abc",8:"abcdefg",9:"abfgcd","-":"g"});
const roots=new Map();
let lastKey="",witness=null,lastSupply=null;
function svg(tag,attrs={}){
 const e=document.createElementNS(NS,tag);
 for(const [k,v] of Object.entries(attrs))e.setAttribute(k,String(v));
 return e;
}
function makeWindow(d){
 const host=document.createElement("span");
 host.className="mcp-digital-window-v1";
 host.dataset.mcpDigitalWindow=d.id;
 host.setAttribute("aria-label",d.id+" live amber MCP display");
 Object.assign(host.style,{position:"absolute",display:"block",
  left:(d.x/W*100)+"%",top:(d.y/H*100)+"%",
  width:(d.w/W*100)+"%",height:(d.h/H*100)+"%",
  zIndex:"16",overflow:"hidden",boxSizing:"border-box",
  borderRadius:"2px",background:"#070b0a",pointerEvents:"none",
  isolation:"isolate",lineHeight:"0"});
 const glass=svg("svg",{viewBox:"0 0 "+d.w+" "+d.h,
  preserveAspectRatio:"none",width:"100%",height:"100%","aria-hidden":"true"});
 glass.style.cssText="display:block;width:100%;height:100%;overflow:hidden;pointer-events:none";
 host.append(glass);
 return {host,glass,d};
}
function getElectrical(){
 let observed=null;
 const owner=win.B737ISNCockpitV1;
 try{
  const state=owner?.getElectricalState?.();
  if(state&&win.B737ElectricalV7?.evaluate)observed=win.B737ElectricalV7.evaluate(state);
 }catch(e){console.warn("MCP numeric electrical read",e);}
 if(observed?.schema!=="B737_ELECTRICAL_V7_RESULT")
  observed=owner?.getState?.()?.state?.electrical;
 return observed?.schema==="B737_ELECTRICAL_V7_RESULT"?observed:null;
}
function supply(){
 const bus=getElectrical()?.bus;
 const facade=win.B737UnifiedBusConsumerLiveV1;
 const elex=facade?.getBus?.("electronic1","28VDC");
 const battery=facade?.getBus?.("battery","28VDC");
 const cb=win.B737UnifiedCB;
 const cbMain=cb?.available?.("mcp.power")??null;
 const cbCourse2=cb?.available?.("mcp.course2")??null;
 const availability=(bit,breaker)=>{
  if(bit===false||breaker===false)return false;
  if(bit===true)return true;
  return null;
 };
 // Actual source: MRG CL p.186 ELECTRONIC 1 28VDC (not all DC1
 // consumers); COURSE 2 is separately connected to BATTERY BUS.
 // When the MRG bus-class bridge is still loading, DC1 is only its
 // upstream V7 proxy and must NOT override an explicit ELEX-1 failure.
 const electronic1=elex?elex.powered:bus?.dc1??null;
 const batteryPower=battery?battery.powered:bus?.battery??null;
 const main=availability(electronic1,cbMain);
 const right=availability(batteryPower,cbCourse2);
 return {main,right,electronic1,dc1:bus?.dc1??null,battery:batteryPower,
  cbMain,cbCourse2};
}
function getNumbers(){
 const visual=win.B737McpVisualV3?.getState?.()||{};
 const backend=win.B737McpAFDSBridgeV1?.getOutput?.()?.values||{};
 const result={};
 for(const {id} of areas)
  result[id]=Number.isFinite(visual[id])?Math.trunc(visual[id]):
   Number.isFinite(backend[id])?Math.trunc(backend[id]):0;
 return result;
}
function digits(id,v){
 if(id==="verticalSpeed")return String(v);
 return String(v).padStart(id==="altitude"?5:3,"0");
}
function paint(view,on,number){
 const {glass,d,host}=view;
 host.dataset.powered=on?"true":"false";
 if(!on){glass.replaceChildren();return;}
 const chars=digits(d.id,number);
 const n=chars.length;
 const scale=Math.min(1,(d.w-12)/(35*n+7*Math.max(0,n-1)),(d.h-8)/59);
 const total=(35*n+7*(n-1))*scale;
 const first=(d.w-total)/2,top=(d.h-59*scale)/2;
 const group=svg("g");
 for(let i=0;i<n;i++){
  const digit=svg("g",{transform:"translate("+(first+i*42*scale)+" "+top+") scale("+scale+")"});
  const active=segOn[chars[i]]||"";
  for(const [name,path] of Object.entries(segments)){
   const lit=active.includes(name);
   const seg=svg("path",{d:path,fill:"none",stroke:lit?"#ffdc85":"#3e321a",
    "stroke-width":lit?4.2:3.8,"stroke-linecap":"round",
    "stroke-linejoin":"round",opacity:lit?1:.12});
   if(lit)seg.style.filter="drop-shadow(0 0 1.3px #fff2b6) drop-shadow(0 0 2.2px #e9ab39)";
   digit.append(seg);
  }
  group.append(digit);
 }
 glass.replaceChildren(group);
}
/* Recompute electrical supply only on a distribution/CB event, not on each
 * numeric detent, wheel tick or instrument repaint. */
function draw(force=false,refreshPower=false){
 if(refreshPower||!lastSupply)lastSupply=supply();
 const p=lastSupply,values=getNumbers();
 const key=JSON.stringify([qa,p.main,p.right,values]);
 if(!force&&key===lastKey)return;
 lastKey=key;
 for(const views of roots.values())for(const view of views){
  const on=qa||(view.d.id==="courseR"?p.right:p.main)===true;
  paint(view,on,values[view.d.id]);
 }
 if(qa)updateWitness(p);
}
function updateWitness(p){
 if(!qa)return;
 if(!witness){
  if(!document.body)return;
  witness=document.createElement("div");witness.id="mcp-digital-qa-witness";
  Object.assign(witness.style,{position:"fixed",top:"72px",left:"10px",
   zIndex:"2147483000",pointerEvents:"none",direction:"ltr",whiteSpace:"pre-line",
   padding:"9px",background:"#171309",color:"#ffdf91",
   border:"2px solid #ffdc7e",font:"12px/1.5 Consolas,monospace"});
  document.body.append(witness);
 }
 witness.textContent="MCP DIGITAL QA · VISUAL ONLY\n"+
 "Window count: "+Array.from(roots.values()).reduce((n,a)=>n+a.length,0)+
 "\nELEX1: "+p.electronic1+" (upstream DC1: "+p.dc1+") | BAT BUS: "+p.battery+
 "\nCB MCP: "+p.cbMain+" | CB CRS2: "+p.cbCourse2;
}
function mount(){
 // Remove any orphaned preview toggle left by the retired version.
 document.getElementById("mcpDigitsPreviewToggle")?.remove();
 let added=false;
 for(const root of document.querySelectorAll('[data-piece="mcp"]')){
  if(roots.has(root))continue;
  const windows=areas.map(makeWindow);
  for(const view of windows)root.append(view.host);
  root.dataset.mcpIndependentDigits="true";
  roots.set(root,windows);added=true;
 }
 draw(added,added);
}
const css=document.createElement("style");
css.id="mcp-independent-digits-v1-style";
css.textContent='[data-piece="mcp"][data-mcp-independent-digits="true"]>.mcp-v3-overlay [data-mcp-display]{display:none!important}';
document.head.append(css);
win.B737McpIndependentDigitsV1=Object.freeze({
 audit:()=>({schema:"MCP-DIGITS-0004",qa,preview:false,rootCount:roots.size,
  windowCount:Array.from(roots.values()).reduce((n,a)=>n+a.length,0),
  power:lastSupply||supply(),values:getNumbers(),windows:Array.from(roots.values()).flat().map(v=>({
   id:v.d.id,lit:v.host.dataset.powered,rect:{
    x:v.host.getBoundingClientRect().x,y:v.host.getBoundingClientRect().y,
    w:v.host.getBoundingClientRect().width,h:v.host.getBoundingClientRect().height}}))}),
 refresh:()=>{mount();draw(true,true)},
 setPreview:()=>false  // retained as a safe no-op for old callers
});
for(const event of ["b737:mcp-afds-state","b737:mcp-value-change","b737:mcp-hardware-change"])
 win.addEventListener(event,()=>draw());
for(const event of ["b737:electrical-distribution-changed","b737:electrical-v7-state",
 "b737:cb-state-change","b737:electrical-owner-ready","b737:bus-failure-injection-changed","b737:bus-consumer-snapshot"])
 win.addEventListener(event,()=>draw(false,true));
win.addEventListener("b737:cockpit-mounted",mount);
document.addEventListener("DOMContentLoaded",mount);
if(document.readyState!=="loading")mount();
})(window);
