/* MCP-OWNER13-0001 | Owner artwork placement only; no original MCP panel pixels edited.
 * Photo atlas cells correspond, IN ORDER, to the thirteen uploaded file names in
 * owner13-source-map.json. The author-provided individual source PNGs remain
 * authoritative. The compressed atlas is a PREVIEW derivative, not full resolution.
 * Existing motor, AFDS and equipment logic remain in the mounted controllers. */
(function(){
"use strict";
const W=2172,H=433,ASSET_BASE=new URL("./assets/mcp-switches/owner13-photo-part",document.currentScript.src).href;
const SOURCE=Object.freeze({
 courseL:0,courseR:0,speed:4,heading:10,headingSEL:11,bankRing:12,
 AT_ARM:{OFF:2,ARM:3},FD_LEFT:{OFF:8,ON:9},FD_RIGHT:{OFF:8,ON:9},
 VS_WHEEL:1,CO:7
});
const geometry=Object.freeze({
 courseL:{x:88,y:252,d:93},courseR:{x:2110,y:249,d:95},
 speed:{x:558,y:275,d:110},heading:{x:860,y:245,d:89},
 bankRing:{x:860,y:245,d:100},headingSEL:{x:860,y:245,d:56},
 AT_ARM:{x:357,y:181,w:66,h:68},FD_LEFT:{x:203,y:321,w:36,h:51},
 FD_RIGHT:{x:1903,y:321,w:36,h:51},VS_WHEEL:{x:1490,y:281,w:49,h:177},
 CO:{x:460,y:246,w:52,h:52}
});
let loaded=false,bankAngle=20;const mounted=new WeakSet();
/* Alpha-bound measurements from each original owner PNG; source frames have
 * very different transparent margins. Geometric centering uses full source
 * canvas and normalized alpha ROI (not a 48x48 transparent thumbnail box). */
const photoZoom=Object.freeze([
 [1.20,1.20],[2.78,1.19],[1.83,1.58],[1.83,1.49],
 [1.08,1.08],[1.18,2.21],[1.18,2.21],[2.16,2.18],
 [2.94,1.73],[2.94,1.73],[1.23,1.22],[1.43,1.44],[1.28,1.31]
]);
function cell(node,index){
 const col=index%4,row=Math.floor(index/4),[sx,sy]=photoZoom[index];
 // These offsets keep the selected atlas CELL center at element center
 // even after transparent-margin compensation.
 const px=(.5-(col+.5)*sx)/(1-4*sx)*100;
 const py=(.5-(row+.5)*sy)/(1-4*sy)*100;
 node.style.setProperty("--owner-bsize",(400*sx)+"% "+(400*sy)+"%");
 node.style.setProperty("--owner-bpos",px+"% "+py+"%");
 node.dataset.ownerAssetIndex=String(index);
}
function art(index,className="mcp-owner13-art"){
 const el=document.createElement("span");el.className=className;
 el.setAttribute("aria-hidden","true");cell(el,index);return el;
}
function addHardware(root,id,kind){
 const el=root.querySelector('[data-mcp-hardware="'+id+'"]');
 if(!el||el.querySelector(":scope > .mcp-owner13-art"))return;
 for(const child of el.children)child.style.visibility="hidden";
 const pic=art(typeof SOURCE[id]==="number"?SOURCE[id]:SOURCE[id].OFF);
 el.append(pic);
 if(kind==="toggle"){
  const update=()=>cell(pic,SOURCE[id][el.dataset.state]??SOURCE[id].OFF);
  update();new MutationObserver(update).observe(el,{attributes:true,attributeFilter:["data-state"]});
 }
}
function addKnob(root,id){
 const el=root.querySelector('.mcp-v3-knob[data-control="'+id+'"]');
 if(!el||el.querySelector(":scope > .mcp-owner13-art"))return;
 if(id!=="speed"){
  const face=el.querySelector(".mcp-v3-course-face,.mcp-v3-plain-face");
  if(face)face.style.visibility="hidden";
 }
 const pic=art(SOURCE[id]);
 el.append(pic);
}
function addBank(root){
 const knob=root.querySelector('.mcp-v3-knob[data-control="heading"]');
 if(!knob||knob.querySelector("[data-mcp-bank-limit]"))return;
 // Heading triangle is source file #10; keep it as backing artwork, but its
 // face is eclipsed by the true bank-angle ring and nested SEL.
 const ring=art(12,"mcp-owner13-art mcp-owner13-bank");
 ring.setAttribute("data-mcp-bank-limit","");
 ring.style.left="50%";ring.style.top="50%";
 ring.style.width=(geometry.bankRing.d/geometry.heading.d*100)+"%";
 ring.style.height=(geometry.bankRing.d/geometry.heading.d*100)+"%";
 ring.setAttribute("aria-hidden","true");
 knob.append(ring);
 const inner=art(11,"mcp-owner13-art mcp-owner13-inner");
 inner.style.width=(geometry.headingSEL.d/geometry.heading.d*100)+"%";
 inner.style.height=(geometry.headingSEL.d/geometry.heading.d*100)+"%";
 inner.style.left="50%";inner.style.top="50%";
 knob.append(inner);
 function changeBank(step){
  bankAngle=Math.max(10,Math.min(30,bankAngle+step*5));
  ring.style.setProperty("--bank-turn",(bankAngle-20)*3+"deg");
  knob.dataset.bankAngleLimit=String(bankAngle);
  window.dispatchEvent(new CustomEvent("b737:mcp-bank-limit-preview",
   {detail:{angle:bankAngle,source:"OWNER13",validatedFlightLogic:false}}));
 }
 const handle=e=>{
  if(!e.shiftKey)return;
  if(e.type==="wheel"){e.preventDefault();e.stopImmediatePropagation();changeBank(e.deltaY<0?1:-1);}
  if(e.type==="keydown"&&["ArrowUp","ArrowDown","ArrowRight","ArrowLeft"].includes(e.key)){
   e.preventDefault();e.stopImmediatePropagation();changeBank(["ArrowUp","ArrowRight"].includes(e.key)?1:-1);
  }
 };
 knob.addEventListener("wheel",handle,{capture:true,passive:false});
 knob.addEventListener("keydown",handle,true);
 knob.setAttribute("aria-label","HEADING select; Shift+wheel changes bank angle limit");
 changeBank(0);
}
const pushButtons=Object.freeze([
 // Socket envelopes are on the original 2172x433 panel, not viewport pixels.
 ["VNAV",767,159,104,63],["LNAV",1032,159,104,63],
 ["N1",291,375,98,57],["SPEED",411,375,98,57],
 ["LVL_CHG",729,375,103,57],["HDG_SEL",878,375,98,57],
 ["APP",1029,375,100,57],["ALT_HLD",1207,375,100,57],
 ["VS",1341,375,100,57],
 ["CMD_A",1682,185,108,64],["CWS_A",1682,281,108,64],
 ["CMD_B",1852,185,108,64],["CWS_B",1852,281,108,64]
]);
function addPushButtons(root){
 for(const [id,x,y,w,h] of pushButtons){
  const lamp=root.querySelector('[data-mcp-lamp="'+id+'"]');
  if(!lamp||root.querySelector('[data-owner13-push="'+id+'"]'))continue;
  const pic=art(6,"mcp-owner13-art mcp-owner13-push");
  pic.dataset.owner13Push=id;
  pic.style.left=(x/W*100)+"%";pic.style.top=(y/H*100)+"%";
  pic.style.width=(w/W*100)+"%";pic.style.height=(h/H*100)+"%";
  const paint=()=>cell(pic,lamp.getAttribute("data-on")==="true"?5:6);
  paint();
  new MutationObserver(paint).observe(lamp,{attributes:true,attributeFilter:["data-on"]});
  root.append(pic);
 }
}
function mount(){
 if(!loaded)return;
 for(const root of document.querySelectorAll('[data-piece="mcp"]')){
  if(mounted.has(root))continue;
  if(root.querySelectorAll(".mcp-v3-knob").length!==5||root.querySelectorAll(".mcp-hw").length<7)continue;
  mounted.add(root);root.classList.add("mcp-owner13-active");
  for(const id of ["courseL","courseR","speed","heading"])addKnob(root,id);
  for(const id of ["AT_ARM","FD_LEFT","FD_RIGHT","VS_WHEEL","CO"])addHardware(root,id,id.startsWith("FD_")||id==="AT_ARM"?"toggle":"other");
  addBank(root);
  addPushButtons(root);
 }
}
function audit(){
 const report=[];
 for(const root of document.querySelectorAll('[data-piece="mcp"]')){
  const box=root.getBoundingClientRect();
  for(const [id,g]of Object.entries(geometry)){
   const el=id==="bankRing"?root.querySelector("[data-mcp-bank-limit]"):
    id==="headingSEL"?root.querySelector(".mcp-owner13-inner"):
    root.querySelector('[data-control="'+id+'"],[data-mcp-hardware="'+id+'"]');
   if(!el){report.push({id,status:"NOT_MOUNTED"});continue;}
   const b=el.getBoundingClientRect(), scaleX=box.width/W,scaleY=box.height/H;
   const dx=(b.left+b.width/2-box.left)/scaleX-g.x;
   const dy=(b.top+b.height/2-box.top)/scaleY-g.y;
   report.push({id,center:[g.x,g.y],bounds:[+(g.x-(g.w??g.d)/2).toFixed(3),+(g.y-(g.h??g.d)/2).toFixed(3),
       +(g.x+(g.w??g.d)/2).toFixed(3),+(g.y+(g.h??g.d)/2).toFixed(3)],
    centerErrorPx:+Math.hypot(dx,dy).toFixed(5),
    status:Math.hypot(dx,dy)<=0.1?"DOM_CENTER_PASS":"DOM_CENTER_FAIL",
    holeEdgeVisualAudit:"NOT_CERTIFIED_FROM_SOURCE_PHOTO"});
  }
  for(const [id,x,y,w,h] of pushButtons){
   const el=root.querySelector('[data-owner13-push="'+id+'"]');
   if(!el){report.push({id:"BTN_"+id,status:"NOT_MOUNTED"});continue;}
   const b=el.getBoundingClientRect();
   const dx=((b.left+b.width/2-box.left)/(box.width/W))-x;
   const dy=((b.top+b.height/2-box.top)/(box.height/H))-y;
   report.push({id:"BTN_"+id,center:[x,y],
    bounds:[x-w/2,y-h/2,x+w/2,y+h/2],
    centerErrorPx:+Math.hypot(dx,dy).toFixed(5),
    status:Math.hypot(dx,dy)<.1?"DOM_CENTER_PASS":"DOM_CENTER_FAIL",
    holeEdgeVisualAudit:"NOT_CERTIFIED_FROM_SOURCE_PHOTO"});
  }
 }
 return {schema:"mcp-owner13-preview-audit",sourceSize:[W,H],atlasLoaded:loaded,
  pendingOwnerArtwork:["Black switch panel with lights on.png","Black switch panel with lights removed.png"],
  backgroundHoleScan:"NOT_DONE",report};
}
async function load(){
 try{
  const parts=await Promise.all([0,1,2,3].map(async i=>{
   const response=await fetch(ASSET_BASE+i+".b64",{cache:"no-cache"});
   if(!response.ok)throw Error("Missing owner reference photo part "+i);
   return (await response.text()).replace(/[^A-Za-z0-9+/=]/g,"");
  }));
  const base64=parts.join("");
  if(base64.length<1000||!/^[A-Za-z0-9+/]+=*$/.test(base64))throw Error("Invalid atlas payload");
  const uri='data:image/webp;base64,'+base64;
  const img=new Image();img.src=uri;await img.decode();
  if(img.naturalWidth!==192||img.naturalHeight!==192)throw Error("Atlas dimensions mismatch");
  document.documentElement.style.setProperty("--mcp-owner13-url",'url("'+uri+'")');
  loaded=true;mount();
 }catch(e){console.warn("OWNER13_ASSET_NOT_READY",String(e));}
}
window.B737McpOwner13V1=Object.freeze({geometry,SOURCE,audit,getState:()=>({loaded,bankAngle}),mount});
document.addEventListener("DOMContentLoaded",()=>{load();mount()});
window.addEventListener("b737:cockpit-mounted",mount);
if(document.readyState!=="loading")load();
})();