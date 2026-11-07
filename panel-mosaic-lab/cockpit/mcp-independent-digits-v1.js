/* MCP-DIGITS-0001 | Independent amber 7-segment windows.
 * The former common MCP SVG remained dark in the live cockpit despite valid
 * segment geometry. Mount digital glass ABOVE that photo/SVG in six own DOM
 * windows. No other panel art, light, knob, AFDS mode or CB logic is changed.
 * All rendering responds to the existing AFDS + MCP value events, not polling.
 * ?mcpDigitsTest=1 is a VISUAL-ONLY diagnostic and never energizes a bus.
 */
(function(win){
"use strict";
const NS="http://www.w3.org/2000/svg",W=2172,H=433,qa=new URLSearchParams(win.location.search).get("mcpDigitsTest")==="1";
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
const segmentsOn=Object.freeze({0:"abcdef",1:"bc",2:"abged",3:"abgcd",4:"fgbc",5:"afgcd",6:"afgecd",7:"abc",8:"abcdefg",9:"abfgcd","-":"g"});
const roots=new Map();let currentKey="",witness=null;
function elem(tag,attrs={}){
 const el=document.createElementNS(NS,tag);
 for(const [name,value]of Object.entries(attrs))el.setAttribute(name,String(value));
 return el;
}
function createWindow(d){
 const host=document.createElement("span");
 host.className="mcp-digital-window-v1";host.dataset.mcpDigitalWindow=d.id;
 host.setAttribute("aria-label",d.id+" amber MCP digital display");
 Object.assign(host.style,{position:"absolute",display:"block",left:(100*d.x/W)+"%",
  top:(100*d.y/H)+"%",width:(100*d.w/W)+"%",height:(100*d.h/H)+"%",
  zIndex:"16",overflow:"hidden",boxSizing:"border-box",
  background:"#070b0a",borderRadius:"2px",pointerEvents:"none",
  isolation:"isolate",contain:"paint",lineHeight:"0"});
 const glass=elem("svg",{viewBox:"0 0 "+d.w+" "+d.h,preserveAspectRatio:"none",
  width:"100%",height:"100%","aria-hidden":"true"});
 glass.style.cssText="display:block;width:100%;height:100%;overflow:hidden;pointer-events:none";
 host.append(glass);return {host,glass,d};
}
function printable(id,state){
 const raw=state?.[id],v=Number.isFinite(raw)?Math.trunc(raw):0;
 if(id==="verticalSpeed")return String(v);
 return String(v).padStart(id==="altitude"?5:3,"0");
}
function drawGlass(view,lit,value){
 const {glass,d,host}=view;host.dataset.powered=lit?"true":"false";
 if(!lit){glass.replaceChildren();return;}
 const chars=value.split("");
 const count=chars.length;
 const scale=Math.min(1,(d.w-12)/(35*count+7*Math.max(0,count-1)),(d.h-8)/59);
 const stride=42*scale,full=count*35*scale+(count-1)*7*scale;
 const first=(d.w-full)/2,top=(d.h-59*scale)/2;
 const group=elem("g");
 for(let i=0;i<count;i++){
  const cell=elem("g",{transform:"translate("+(first+i*stride)+" "+top+") scale("+scale+")"});
  const active=segmentsOn[chars[i]]||"";
  for(const [part,path]of Object.entries(segments)){
   const on=active.includes(part);
   const el=elem("path",{d:path,fill:"none",stroke:on?"#ffdc85":"#3e321a",
    "stroke-width":on?4.2:3.8,"stroke-linecap":"round","stroke-linejoin":"round",
    opacity:on?1:.12});
   if(on)el.style.filter="drop-shadow(0 0 1.3px #fff2b6) drop-shadow(0 0 2.2px #e9ab39)";
   cell.append(el);
  }
  group.append(cell);
 }
 glass.replaceChildren(group);
}
function power(){
 const visual=win.B737McpVisualV3?.auditDisplays?.();
 const afds=win.B737McpAFDSBridgeV1?.getOutput?.();
 return {main:visual?.mainPowered??afds?.power??null,
  right:visual?.course2Powered??afds?.course2Power??null,
  cbMain:win.B737UnifiedCB?.available?.("mcp.power")??null,
  cbRight:win.B737UnifiedCB?.available?.("mcp.course2")??null,
  dc1:win.B737ISNCockpitV1?.getState?.()?.state?.electrical?.bus?.dc1??null,
  batteryBus:win.B737ISNCockpitV1?.getState?.()?.state?.electrical?.bus?.battery??null};
}
function redraw(force=false){
 if(!roots.size){if(qa)updateWitness();return;}
 const values=win.B737McpVisualV3?.getState?.()||{};
 const p=power();
 const key=JSON.stringify([qa,values.courseL,values.speed,values.heading,
  values.altitude,values.verticalSpeed,values.courseR,p.main,p.right]);
 if(!force&&key===currentKey){if(qa)updateWitness();return;}
 currentKey=key;
 for(const list of roots.values())for(const view of list){
  const lit=qa||(view.d.id==="courseR"?p.right:p.main)===true;
  drawGlass(view,lit,printable(view.d.id,values));
 }
 if(qa)updateWitness();
}
function setupWitness(){
 if(!qa||witness||!document.body)return;
 witness=document.createElement("div");witness.id="mcp-digital-qa-witness";
 Object.assign(witness.style,{position:"fixed",top:"72px",left:"10px",
  zIndex:"2147483000",pointerEvents:"none",direction:"ltr",
  padding:"9px 12px",border:"2px solid #ffdc7e",borderRadius:"6px",
  background:"#171309",color:"#ffdf91",font:"bold 12px/1.6 Consolas,monospace",
  whiteSpace:"pre-line",boxShadow:"0 2px 13px #000a"});
 document.body.append(witness);updateWitness();
}
function updateWitness(){
 if(!qa)return;setupWitness();if(!witness)return;
 const p=power();
 witness.textContent="MCP DIGITAL QA ACTIVE (VISUAL ONLY)\n"+
  "Windows: "+Array.from(roots.values()).reduce((n,arr)=>n+arr.length,0)+
  " | JS: RUNNING\n"+
  "DC BUS 1: "+String(p.dc1)+" | BAT BUS: "+String(p.batteryBus)+"\n"+
  "MCP CB: "+String(p.cbMain)+" | COURSE 2 CB: "+String(p.cbRight)+"\n"+
  "MCP: "+String(p.main)+" | COURSE 2: "+String(p.right);
}
function mount(){
 setupWitness();let mounted=false;
 for(const root of document.querySelectorAll('[data-piece="mcp"]')){
  if(roots.has(root))continue;
  const views=areas.map(createWindow);
  for(const view of views)root.append(view.host);
  // Suppress ONLY the superseded numeric drawings. Mode-lamp hit targets,
  // switches and all photo assets keep their existing owners.
  root.dataset.mcpIndependentDigits="true";
  roots.set(root,views);mounted=true;
 }
 if(mounted)currentKey="";
 redraw(mounted);
}
const css=document.createElement("style");
css.id="mcp-independent-digits-v1-style";
css.textContent='[data-piece="mcp"][data-mcp-independent-digits="true"]>.mcp-v3-overlay [data-mcp-display]{display:none!important}';
document.head.append(css);
win.B737McpIndependentDigitsV1=Object.freeze({
 audit:()=>({schema:"MCP-DIGITS-0001",qa,rootCount:roots.size,
  windowCount:Array.from(roots.values()).reduce((n,arr)=>n+arr.length,0),
  power:power(),windows:Array.from(roots.values()).flat().map(v=>({id:v.d.id,lit:v.host.dataset.powered,
   htmlRect:{x:v.host.getBoundingClientRect().x,y:v.host.getBoundingClientRect().y,
    w:v.host.getBoundingClientRect().width,h:v.host.getBoundingClientRect().height}}))}),
 refresh:()=>{mount();redraw(true)}
});
for(const event of ["b737:mcp-afds-state","b737:mcp-value-change","b737:cb-state-change",
 "b737:electrical-owner-ready","b737:electrical-v7-state","b737:cockpit-mounted"]){
 win.addEventListener(event,()=>event==="b737:cockpit-mounted"?mount():redraw());
}
document.addEventListener("DOMContentLoaded",mount);
if(document.readyState!=="loading")mount();
})(window);
