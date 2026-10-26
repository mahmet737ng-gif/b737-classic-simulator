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
  lamps:Object.fromEntries(["AT_ARM","VNAV","LNAV","N1","SPEED","LVL_CHG","HDG_SEL","APP","ALT_HLD","VS","CMD_A","CWS_A","CMD_B","CWS_B"].map(k=>[k,false]))
});
const values=initial();
let powerState=null; // equipment supply unresolved until explicit observed evidence
const displays=[
 {id:"courseL",x:85,y:112,w:112,h:59,digits:3},
 {id:"speed",x:480,y:112,w:155,h:59,digits:3},
 {id:"heading",x:817,y:112,w:118,h:59,digits:3},
 {id:"altitude",x:1130,y:112,w:151,h:59,digits:5},
 {id:"verticalSpeed",x:1381,y:112,w:161,h:59,digits:4},
 {id:"courseR",x:1860,y:112,w:157,h:59,digits:3}
];
const lamps=[
 {id:"AT_ARM",x:322,y:129,w:45,h:8},
 {id:"VNAV",x:743,y:161,w:48,h:10},
 {id:"LNAV",x:1008,y:161,w:48,h:10},
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
function segmentPolygons(){
 return {
  a:"5,1 28,1 24,6 10,6",
  b:"30,2 34,7 34,24 30,28 27,24 27,9",
  c:"30,31 34,35 34,52 30,57 27,50 27,35",
  d:"6,54 28,54 24,59 10,59",
  e:"4,31 8,35 8,50 4,57 1,52 1,35",
  f:"4,2 8,9 8,24 4,28 1,24 1,7",
  g:"6,29 10,26 26,26 30,29 26,32 10,32"
 };
}
const mask={0:"abcdef",1:"bc",2:"abged",3:"abgcd",4:"fgbc",5:"afgcd",6:"afgecd",7:"abc",8:"abcdefg",9:"abfgcd","-":"g"};
function numericText(id){
 const v=values[id];
 if(id==="verticalSpeed"){return v<0?"-"+String(Math.abs(v)).padStart(3,"0"):String(v).padStart(4,"0");}
 return String(v).padStart(id==="altitude"?5:3,"0");
}
function drawDigit(g,x,y,size,character){
 const node=group(g,{transform:"translate("+x+" "+y+") scale("+size/35+")"});
 for(const [seg,points] of Object.entries(segmentPolygons())){
  node.append(svgElement("polygon",{points,fill:(mask[character]||"").includes(seg)?"#ffcd30":"#3e3517",opacity:(mask[character]||"").includes(seg)?1:.16,class:(mask[character]||"").includes(seg)?"mcp-lit-segment":"mcp-off-segment"}));
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
 if(powerState!==true)return; // original photographed digits must be masked when unpowered/unknown
 const chars=numericText(d.id);
 const count=chars.length;
 const size=count>=5?24.5:29.5;
 const aw=size, spacing=count>=5?5.7:6.1;
 const total=count*aw+(count-1)*spacing;
 const start=d.x+(d.w-total)/2;
 const height=size*59/35;
 for(let i=0;i<chars.length;i++)drawDigit(g,start+i*(aw+spacing),d.y+(d.h-height)/2,size,chars[i]);
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
  el.innerHTML='<span class="mcp-v3-course-face"><svg viewBox="0 0 100 100" aria-hidden="true"><path d="M56 49 C62 39 69 25 77 23 Q83 23 83 30 C79 40 67 54 60 59 L72 70 Q74 77 67 78 L54 66 L46 79 Q42 83 37 78 L37 62 L23 59 Q19 56 22 49 L36 47 L41 36 Q48 27 55 32 L54 44 Z" fill="#db3626" stroke="#84211b" stroke-width="3.2"/><path d="M58 46 C68 38 73 31 77 28 M44 63 L42 75" fill="none" stroke="#ff7950" stroke-width="4.1" stroke-linecap="round" opacity=".65"/></svg></span>';
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
 repaint();
}
window.B737McpVisualV3=Object.freeze({
 geometry:Object.freeze({width:W,height:H,displays:displays.map(x=>({...x})),lamps:lamps.map(x=>({...x})),knobs:knobs.map(x=>({...x}))}),
 getState:()=>JSON.parse(JSON.stringify(values)),
 setValue:(id,v)=>setValue(id,v,"external"),
 setLamp:(id,state)=>{if(Object.hasOwn(values.lamps,id)){values.lamps[id]=!!state;repaint()}},
 setLamps:(states)=>{for(const id of Object.keys(values.lamps))values.lamps[id]=states?.[id]===true;repaint()},
 setPower:(powered)=>{if(![true,false,null].includes(powered))throw Error("MCP power must be true/false/null");powerState=powered;repaint()},
 mount
});
window.addEventListener("b737:visual-test",e=>{for(const id of Object.keys(values.lamps))values.lamps[id]=!!e.detail?.active;repaint()});
window.B737McpIasMachKnob=Object.freeze({placement:Object.freeze({sourceWidth:W,sourceHeight:H,x:558,y:275,diameter:110,detentDegrees:12}),getDetent:()=>values.speed-312,setDetent(v){if(Number.isFinite(v))setValue("speed",312+Math.trunc(v),"external")}});
window.addEventListener("b737:cockpit-mounted",mount);
document.addEventListener("DOMContentLoaded",mount);
if(document.readyState!=="loading")mount();
})();