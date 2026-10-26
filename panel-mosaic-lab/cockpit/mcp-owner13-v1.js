/* MCP-OWNER13-0001 | Owner artwork placement only; no original MCP panel pixels edited.
 * Photo atlas cells correspond, IN ORDER, to the thirteen uploaded file names in
 * owner13-source-map.json. The author-provided individual source PNGs remain
 * authoritative. The compressed atlas is a PREVIEW derivative, not full resolution.
 * Existing motor, AFDS and equipment logic remain in the mounted controllers. */
(function(){
"use strict";
const W=2172,H=433,URL="./assets/mcp-switches/owner13-photo-part";
const SOURCE=Object.freeze({
 courseL:0,courseR:0,speed:4,heading:10,headingSEL:11,bankRing:12,
 AT_ARM:{OFF:2,ARM:3},FD_LEFT:{OFF:8,ON:9},FD_RIGHT:{OFF:8,ON:9},
 VS_WHEEL:1,CO:7
});
const geometry=Object.freeze({
 courseL:{x:88,y:252,d:93},courseR:{x:2110,y:249,d:95},
 speed:{x:558,y:275,d:110},heading:{x:860,y:245,d:89},
 bankRing:{x:860,y:245,d:112},headingSEL:{x:860,y:245,d:47},
 AT_ARM:{x:357,y:181,w:66,h:68},FD_LEFT:{x:203,y:321,w:36,h:51},
 FD_RIGHT:{x:1903,y:321,w:36,h:51},VS_WHEEL:{x:1490,y:281,w:49,h:177},
 CO:{x:460,y:246,w:52,h:52}
});
let loaded=false,bankAngle=20;const mounted=new WeakSet();
function cell(node,index){const col=index%4,row=Math.floor(index/4);
 node.style.backgroundPosition=(col*100/3)+"% "+(row*100/3)+"%";
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
 if(root.querySelector("[data-mcp-bank-limit]"))return;
 const g=geometry.bankRing;
 const ring=art(12,"mcp-owner13-art mcp-owner13-bank");
 ring.setAttribute("data-mcp-bank-limit","");
 ring.setAttribute("role","slider");ring.setAttribute("tabindex","0");
 ring.setAttribute("aria-label","Bank angle limit");
 ring.setAttribute("aria-valuemin","10");ring.setAttribute("aria-valuemax","30");
 ring.style.left=(g.x/W*100)+"%";ring.style.top=(g.y/H*100)+"%";
 ring.style.width=(g.d/W*100)+"%";ring.style.height=(g.d/H*100)+"%";
 const turn=()=>{ring.style.setProperty("--bank-turn",(bankAngle-20)*3+"deg");ring.setAttribute("aria-valuenow",String(bankAngle));};
 const step=d=>{bankAngle=Math.max(10,Math.min(30,bankAngle+d*5));turn();
  window.dispatchEvent(new CustomEvent("b737:mcp-bank-limit-preview",{detail:{angle:bankAngle,source:"OWNER13",validatedFlightLogic:false}}));};
 ring.addEventListener("wheel",e=>{e.preventDefault();e.stopPropagation();step(e.deltaY<0?1:-1)},{passive:false});
 ring.addEventListener("keydown",e=>{if(["ArrowUp","ArrowRight","ArrowDown","ArrowLeft"].includes(e.key)){e.preventDefault();step(["ArrowUp","ArrowRight"].includes(e.key)?1:-1);}});
 ring.addEventListener("click",e=>{e.stopPropagation();step(1)});
 root.append(ring);turn();
 const knob=root.querySelector('.mcp-v3-knob[data-control="heading"]');
 if(knob&&!knob.querySelector(".mcp-owner13-inner")){
  const inner=art(11,"mcp-owner13-art mcp-owner13-inner");
  knob.append(inner);
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
 }
 return {schema:"mcp-owner13-preview-audit",sourceSize:[W,H],atlasLoaded:loaded,
  pendingOwnerArtwork:["Black switch panel with lights on.png","Black switch panel with lights removed.png"],
  backgroundHoleScan:"NOT_DONE",report};
}
async function load(){
 try{
  const parts=await Promise.all([0,1,2,3].map(async i=>{
   const response=await fetch(URL+i+".b64",{cache:"no-cache"});
   if(!response.ok)throw Error("Missing owner reference photo part "+i);
   return (await response.text()).replace(/\\s+/g,"");
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