/* MCP-0003: source-coordinate, non-destructive illuminated MCP controls.
 * The approved background images and locked overhead remain untouched.
 * Preview states are VISUAL ONLY, not a certified flight-control system.
 * MCP-0005: second-pass hole-center alignment and confined LCD/LED lens regions;
 * visual preview defaults all annunciators OFF; lamp test can illuminate on demand.
 */
(function(){
"use strict";
const NS="http://www.w3.org/2000/svg";
const W=2172,H=433, mounted=new WeakSet(), instances=[];
const ASSET_URL=new URL("./assets/mcp-ias-mach-knob.webp",document.currentScript.src).href;
const initial=()=>({
  courseL:261,courseR:261,speed:312,heading:134,altitude:31000,verticalSpeed:0,
  lamps:Object.fromEntries(["AT_ARM","VNAV","LNAV","VOR_LOC","N1","SPEED","LVL_CHG","HDG_SEL","APP","ALT_HLD","VS","CMD_A","CWS_A","CMD_B","CWS_B"].map(k=>[k,false]))
});
const values=initial();
// Main and COURSE 2 indications have separate electrical supply routes.
let powerState=null,course2PowerState=null;
/* Explicit visual QA only: never alters electrical, CB, or AFDS state. */
const digitQa=new URLSearchParams(location.search).get("mcpDigitsTest")==="1";
/* MCP-0007: individual glass-aperture fits, measured against the actual
 * 2172×433 locked MCP photograph and cross-checked with cockpit screenshot.
 * These are INSIDE the metal bezels (not button/knob sockets). In particular,
 * F/O COURSE begins to the right of CMD B; no black mask may cover CMD B.
 * The shared source-coordinate SVG keeps fits correct at every cockpit zoom.
 */
const displays=[
 {id:"courseL",     x:85,  y:112,w:112,h:59,digits:3},
 {id:"speed",       x:485, y:115,w:147,h:56,digits:3},
 {id:"heading",     x:826, y:113,w:119,h:58,digits:3},
 {id:"altitude",    x:1127,y:114,w:171,h:56,digits:5},
 {id:"verticalSpeed",x:1376,y:118,w:171,h:56,digits:4},
 {id:"courseR",     x:1932,y:120,w:121,h:55,digits:3}
];
const lamps=[
 {id:"AT_ARM",x:322,y:129,w:45,h:8},
 {id:"VNAV",x:743,y:161,w:48,h:10},
 {id:"LNAV",x:1008,y:161,w:48,h:10},
 {id:"VOR_LOC",x:988,y:264,w:48,h:10},
 {id:"N1",x:264,y:374,w:54,h:10},
 {id:"SPEED",x:384,y:374,w:54,h:10},
 {id:"LVL_CHG",x:702,y:374,w:59,h:10},
 {id:"HDG_SEL",x:849,y:374,w:58,h:10},
 {id:"APP",x:998,y:374,w:62,h:10},
 {id:"ALT_HLD",x:1178,y:374,w:58,h:10},
 {id:"VS",x:1312,y:374,w:58,h:10},
 {id:"CMD_A",x:1657,y:177,w:51,h:10},
 {id:"CWS_A",x:1657,y:272,w:51,h:10},
 {id:"CMD_B",x:1827,y:177,w:51,h:10},
 {id:"CWS_B",x:1827,y:272,w:51,h:10}
];
const knobs=[
 {id:"courseL",label:"COURSE L",x:88,y:252,d:93,type:"course"},
 {id:"speed",label:"IAS/MACH",x:558,y:275,d:110,type:"ias"},
 {id:"heading",label:"HEADING",x:860,y:245,d:89,type:"plain"},
 {id:"altitude",label:"ALTITUDE",x:1198,y:244,d:92,type:"plain"},
 {id:"courseR",label:"COURSE R",x:2110,y:249,d:95,type:"course"}
];
const on=(root,name,fn,opt)=>root.addEventListener(name,fn,opt);
function svgElement(tag,attrs={},txt){
 const n=document.createElementNS(NS,tag);for(const [k,v] of Object.entries(attrs))n.setAttribute(k,String(v));
 if(txt!==undefined)n.textContent=txt;return n;
}
function group(parent,attrs){const n=svgElement("g",attrs);parent.append(n);return n}
/* Thin rounded, slightly slanted amber light-pipes copied in proportion and
 * light response from the user's photographed B737 Classic MCP. Coordinates
 * remain in a 35x59 digit cell, independent of window/zoom pixel size. */
const segmentPaths=Object.freeze({
 a:"M9 4.5 L27 4.5",b:"M30 8.5 L29 24",c:"M29 35 L28 50",
 d:"M8 54.5 L26 54.5",e:"M6 35 L5 50",f:"M7 8.5 L6 24",
 g:"M8.5 29.5 L27 29.5"
});
const mask={0:"abcdef",1:"bc",2:"abged",3:"abgcd",4:"fgbc",5:"afgcd",6:"afgecd",7:"abc",8:"abcdefg",9:"abfgcd","-":"g"};
function numericText(id){
 const v=values[id];
 if(id==="verticalSpeed"){return v<0?"-"+String(Math.abs(v)):String(v);}
 return String(v).padStart(id==="altitude"?5:3,"0");
}
function drawDigit(g,x,y,size,character){
 const node=group(g,{transform:"translate("+x+" "+y+") scale("+size/35+")"});
 const active=mask[character]||"";
 for(const [seg,d] of Object.entries(segmentPaths)){
  const lit=active.includes(seg);
  node.append(svgElement("path",{d,fill:"none",stroke:lit?"#ffdf91":"#503916",
   "stroke-width":lit?4.35:3.8,"stroke-linecap":"round","stroke-linejoin":"round",
   opacity:lit?1:.13,class:lit?"mcp-lit-segment":"mcp-off-segment"}));
 }
}
function drawDisplay(svg,d){
 const g=group(svg,{"data-mcp-display":d.id});
 // MCP-0005: one exact clipping boundary for black LCD glass and all segments.
 const clip=svgElement("clipPath",{id:"mcp-v5-"+d.id});
 clip.append(svgElement("rect",{x:d.x+2,y:d.y+2,width:d.w-4,height:d.h-4,rx:2}));
 svg.querySelector("defs").append(clip);
 g.setAttribute("clip-path","url(#mcp-v5-"+d.id+")");
 g.append(svgElement("rect",{x:d.x+2,y:d.y+2,width:d.w-4,height:d.h-4,rx:1.6,fill:"#070b0b",opacity:.97}));
 // Keep the display face black when the respective bus or breaker is dead.
 if(!digitQa&&(d.id==="courseR"?course2PowerState:powerState)!==true)return;
 const chars=numericText(d.id);
 const count=chars.length;
 // Digit size is constrained by each *real* glass aperture, not a shared
 // full-panel CSS width. This keeps every segment inside its own housing.
 const countWidth=count*35+(count-1)*6.8;
 const scale=Math.min(1,(d.w-12)/countWidth,(d.h-7)/59);
 const cell=35*scale,spacing=6.8*scale;
 const total=count*cell+(count-1)*spacing;
 const start=d.x+(d.w-total)/2;
 const top=d.y+(d.h-59*scale)/2;
 for(let i=0;i<count;i++)drawDigit(g,start+i*(cell+spacing),top,cell,chars[i]);
}
function repaint(){
 for(const obj of instances){
  const {svg,parent}=obj;svg.querySelectorAll("[data-mcp-display]").forEach(n=>n.remove());
  svg.querySelectorAll("clipPath[id^=mcp-v5-]").forEach(n=>n.remove());
  for(const d of displays)drawDisplay(svg,d);
  for(const l of lamps){const el=svg.querySelector('[data-mcp-lamp="'+l.id+'"]');if(el)el.setAttribute("data-on",String(!!values.lamps[l.id]));}
  for(const el of parent.querySelectorAll(".mcp-v3-knob")){const n=knobs.find(k=>k.id===el.dataset.control);if(n){el.style.setProperty("--mcp-turn",String((values[n.id]-({"courseL":261,"courseR":261,"speed":312,"heading":134,"altitude":31000}[n.id]||0))*(n.type==="ias"?12:3))+"deg");}}
 }
}
function event(type,detail){window.dispatchEvent(new CustomEvent("b737:mcp-"+type,{detail:{source:"MCP-0003",...detail}}));}
function setValue(id,v,method){
 if(!Object.hasOwn(values,id)||id==="lamps"||!Number.isFinite(v))return;
 const before=values[id];let next=Math.trunc(v);
 if(id==="courseL"||id==="courseR"||id==="heading")next=((next%360)+360)%360;
 if(id==="speed")next=Math.max(100,Math.min(399,next));
 if(id==="altitude")next=Math.max(0,Math.min(49900,next));
 if(id==="verticalSpeed")next=Math.max(-9900,Math.min(9900,next));
 if(next===before)return;
 values[id]=next;repaint();
 if(next!==before){
  event("value-change",{control:id,value:next,previous:before,method});
  if(id==="speed")window.dispatchEvent(new CustomEvent("b737:mcp-ias-mach-detent",{detail:{control:"MCP.IAS_MACH",delta:next-before,detent:next-312,method}}));
 }
}
function step(id,d,method){
 const increments={courseL:1,courseR:1,speed:1,heading:1,altitude:100,verticalSpeed:100};
 if(Object.hasOwn(increments,id))setValue(id,values[id]+d*increments[id],method);
}
function mountKnob(parent,n){
 const el=document.createElement("span");
 el.className="mcp-v3-knob mcp-v3-"+n.type;
 el.dataset.control=n.id;
 el.setAttribute("role","button");el.setAttribute("tabindex","0");
 el.setAttribute("aria-label",n.label+" rotary knob");
 el.style.left=n.x/W*100+"%";el.style.top=n.y/H*100+"%";el.style.width=n.d/W*100+"%";
 if(n.type==="ias"){
  el.style.backgroundImage='url("'+ASSET_URL+'")';
 }else if(n.type==="course"){
  el.innerHTML='<span class="mcp-v3-course-face" aria-hidden="true"></span>';
 }else el.innerHTML='<span class="mcp-v3-plain-face"></span>';
 let last=null;
 on(el,"pointerdown",e=>{if(e.pointerType==="mouse"&&e.button!==0)return;e.stopPropagation();e.preventDefault();last=e.clientX;el.setPointerCapture(e.pointerId)});
 on(el,"pointermove",e=>{if(last===null)return;e.stopPropagation();const div=Math.trunc((e.clientX-last)/10);if(div){step(n.id,div,"drag");last+=div*10;}});
 for(const type of ["pointerup","pointercancel"])on(el,type,e=>{last=null;e.stopPropagation()});
 on(el,"lostpointercapture",()=>last=null);
 on(el,"wheel",e=>{e.preventDefault();e.stopPropagation();step(n.id,e.deltaY<0?1:-1,"wheel")},{passive:false});
 on(el,"keydown",e=>{if(["ArrowLeft","ArrowDown","ArrowUp","ArrowRight"].includes(e.key)){e.preventDefault();step(n.id,["ArrowUp","ArrowRight"].includes(e.key)?1:-1,"keyboard");}});
 on(el,"click",e=>e.stopPropagation());
 parent.append(el);
}
function mountLamp(svg,l){
 const g=group(svg,{"data-mcp-lamp":l.id,"data-on":String(!!values.lamps[l.id]),class:"mcp-v3-lamp"});
 const dark=svgElement("rect",{x:l.x,y:l.y,width:l.w,height:l.h,rx:2,fill:"#070d09",class:"mcp-v3-lamp-dark"});
 const glow=svgElement("rect",{x:l.x,y:l.y,width:l.w,height:l.h,rx:2,fill:"#25ff55",opacity:.24,class:"mcp-v3-light"});
 const face=svgElement("rect",{x:l.x,y:l.y,width:l.w,height:l.h,rx:2,fill:"url(#mcp3Green)",class:"mcp-v3-light"});
 const reflector=svgElement("path",{d:"M"+(l.x+3)+" "+(l.y+2)+"h"+(l.w-6),stroke:"#dcffe1","stroke-width":1.8,opacity:.85,class:"mcp-v3-light"});
 const hit=svgElement("rect",{x:l.x-8,y:l.y-24,width:l.w+16,height:48,fill:"transparent",class:"mcp-v3-lamp-hit",tabindex:0,role:"button","aria-label":l.id.replaceAll("_"," ")});
 g.append(dark,glow,face,reflector,hit);
 function toggle(e){e.stopPropagation();if(window.B737McpAFDSBridgeV1){window.dispatchEvent(new CustomEvent("b737:mcp-button-request",{detail:{id:l.id,method:"button"}}));return;}
  values.lamps[l.id]=!values.lamps[l.id];repaint();event("lamp-toggle",{control:l.id,active:values.lamps[l.id],method:"click"});}
 on(hit,"click",toggle);
 on(hit,"keydown",e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();toggle(e)}});
}
function mount(){
 document.querySelectorAll('[data-piece="mcp"]').forEach(parent=>{
  if(mounted.has(parent))return;mounted.add(parent);
  const svg=svgElement("svg",{class:"mcp-v3-overlay",viewBox:"0 0 "+W+" "+H,"aria-label":"MCP illuminated numerals and annunciator lights",preserveAspectRatio:"none"});
  const defs=svgElement("defs");
  defs.innerHTML='<filter id="mcp3Glow" x="-90%" y="-200%" width="280%" height="500%"><feGaussianBlur stdDeviation="5"/></filter><linearGradient id="mcp3Green" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#a2ffae"/><stop offset=".3" stop-color="#37ff65"/><stop offset="1" stop-color="#13a834"/></linearGradient>';
  svg.append(defs);for(const l of lamps)mountLamp(svg,l);
  parent.append(svg);
  for(const n of knobs)mountKnob(parent,n);
  instances.push({parent,svg});
 });
 if(digitQa)mountDigitDiagnostics();
 repaint();
}
function mountDigitDiagnostics(){
 if(document.getElementById("mcp-digit-qa-status"))return;
 const el=document.createElement("aside");
 el.id="mcp-digit-qa-status";
 el.setAttribute("role","status");
 Object.assign(el.style,{position:"fixed",bottom:"42px",right:"14px",zIndex:"10000",pointerEvents:"none",
  color:"#ffe49e",background:"#070c12ee",border:"1px solid #b88d37",borderRadius:"5px",
  padding:"9px 12px",font:"12px/1.55 ui-monospace,Consolas,monospace",
  whiteSpace:"pre-line",direction:"ltr",maxWidth:"380px"});
 function render(){
  const bus=window.B737ISNCockpitV1?.getState?.()?.state?.electrical?.bus;
  const out=window.B737McpAFDSBridgeV1?.getOutput?.();
  el.textContent="MCP SEVEN-SEGMENT VISUAL QA ONLY\n"+
   "Digits forced visible; NO electrical change\n"+
   "DC1: "+String(bus?.dc1??"UNKNOWN")+" | BAT BUS: "+String(bus?.battery??"UNKNOWN")+"\n"+
   "CB MCP: "+String(window.B737UnifiedCB?.available("mcp.power")??"UNKNOWN")+
   " | CB CRS2: "+String(window.B737UnifiedCB?.available("mcp.course2")??"UNKNOWN")+"\n"+
   "AFDS Power: "+String(out?.power??"UNKNOWN")+
   " | CRS2 Power: "+String(out?.course2Power??"UNKNOWN");
 }
 for(const event of ["b737:electrical-owner-ready","b737:electrical-v7-state","b737:cb-state-change","b737:mcp-afds-state"])window.addEventListener(event,render);
 document.body.append(el);render();
}
window.B737McpVisualV3=Object.freeze({
 geometry:Object.freeze({width:W,height:H,displays:displays.map(x=>({...x})),lamps:lamps.map(x=>({...x})),knobs:knobs.map(x=>({...x}))}),
 getState:()=>JSON.parse(JSON.stringify(values)),
 setValue:(id,v)=>setValue(id,v,"external"),
 setLamp:(id,state)=>{if(Object.hasOwn(values.lamps,id)&&values.lamps[id]!==!!state){values.lamps[id]=!!state;repaint()}},
 setLamps:(states)=>{let changed=false;for(const id of Object.keys(values.lamps)){const next=states?.[id]===true;if(values.lamps[id]!==next){values.lamps[id]=next;changed=true;}}if(changed)repaint()},
 setPower:(powered)=>{if(![true,false,null].includes(powered))throw Error("MCP power must be true/false/null");if(powerState!==powered){powerState=powered;repaint()}},
 setCourse2Power:(powered)=>{if(![true,false,null].includes(powered))throw Error("MCP COURSE 2 power must be true/false/null");if(course2PowerState!==powered){course2PowerState=powered;repaint()}},
 auditDisplays:()=>({mainPowered:powerState,course2Powered:course2PowerState,visualQaOverride:digitQa,values:{...values},windows:displays.map(d=>({id:d.id,x:d.x,y:d.y,width:d.w,height:d.h,lit:digitQa||(d.id==="courseR"?course2PowerState:powerState)===true}))}),
 mount
});
window.addEventListener("b737:visual-test",e=>{for(const id of Object.keys(values.lamps))values.lamps[id]=!!e.detail?.active;repaint()});
window.B737McpIasMachKnob=Object.freeze({placement:Object.freeze({sourceWidth:W,sourceHeight:H,x:558,y:275,diameter:110,detentDegrees:12}),getDetent:()=>values.speed-312,setDetent(v){if(Number.isFinite(v))setValue("speed",312+Math.trunc(v),"external")}});
window.addEventListener("b737:cockpit-mounted",mount);
document.addEventListener("DOMContentLoaded",mount);
if(document.readyState!=="loading")mount();
})();
