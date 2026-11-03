/* MCP-SOCKET-0002 | Native-pixel apertures from the locked 2172x433 MCP PNG.
 * Original SHA256: 9ee5a14d8b3bbf903e62ba65c1f0b3c52f23238abc1b1cd16fe31fea25548062
 * Each measured rectangular black aperture is taken from connected dark pixels
 * in that exact source image; unlike the superseded center estimates, positions
 * include the genuine button-row height and full MCP width.
 * Only existing DOM controls and existing owner13 photo layers are repositioned.
 * No source artwork, AFDS logic, control instances, or mechanical states modified.
 */
(function(){
"use strict";
const W=2172,H=433;
const photoSha="9ee5a14d8b3bbf903e62ba65c1f0b3c52f23238abc1b1cd16fe31fea25548062";
const mounted=new WeakSet();
const buttonRects=Object.freeze([
 ["VNAV",669,106,102,68],["LNAV",965,109,100,67],
 ["N1",240,321,98,68],["SPEED",356,322,98,68],
 ["LVL_CHG",669,325,105,67],["HDG_SEL",813,325,104,67],
 ["APP",956,326,109,67],["ALT_HLD",1144,327,106,68],
 ["VS",1273,328,103,67],
 ["CMD_A",1579,130,101,67],["CMD_B",1761,131,98,67],
 ["CWS_A",1581,228,96,65],["CWS_B",1761,229,97,65]
]);
// Existing five rotary controls. x/y/w/h are physical dark aperture bounds.
const knobRects=Object.freeze({
 courseL:[37,188,103,98],speed:[522,233,85,81],
 heading:[823,194,81,86],altitude:[1157,193,86,86],
 courseR:[1973,200,95,96]
});
// Existing hardware. Unmeasured round controls keep their APPROVED coordinates.
const hardwareRects=Object.freeze({
 AT_ARM:[315,136,66,70],FD_LEFT:[177,305,47,58],
 FD_RIGHT:[1886,316,45,56],VS_WHEEL:[1452,216,54,174],
 CO:[429,209,53,53]
});
const getKnobs=()=>window.B737McpVisualV3?.geometry?.knobs||[];
const getHardware=()=>window.B737McpHardwareV1?.geometry||[];
const percent=(x,scale)=>(x*100/scale)+"%";
const rectCenter=(r)=>[r[0]+r[2]/2,r[1]+r[3]/2];
function fit(el,r){
 if(!el||!r)return;
 const [x,y]=rectCenter(r);
 Object.assign(el.style,{left:percent(x,W),top:percent(y,H),
  width:percent(r[2],W),height:percent(r[3],H)});
 el.dataset.mcpSocketSource="native-original-photo";
}
function register(root){
 for(const g of getKnobs()){
  const hole=knobRects[g.id],el=root.querySelector('.mcp-v3-knob[data-control="'+g.id+'"]');
  if(!hole||!el)continue;
  const [x,y]=rectCenter(hole);
  // Existing knobs are round and retain their source sprites and handlers.
  el.style.left=percent(x,W);
  el.style.top=percent(y,H);
  el.style.width=percent(Math.max(hole[2],hole[3]),W);
  el.dataset.mcpSocketSource="native-original-photo";
 }
 for(const g of getHardware()){
  const el=root.querySelector('[data-mcp-hardware="'+g.id+'"]');
  if(!el)continue;
  const photoHole=hardwareRects[g.id];
  if(photoHole)fit(el,photoHole);
  // Preserve original geometry for SPD INTV and ALT INTV until native
  // boundaries are independently verified (no guessed socket relocation).
 }
 for(const [id,x,y,w,h] of buttonRects){
  const art=root.querySelector('[data-owner13-push="'+id+'"]');
  if(art)fit(art,[x,y,w,h]);
  const hit=root.querySelector('[data-mcp-lamp="'+id+'"] .mcp-v3-lamp-hit');
  if(hit){
   hit.setAttribute("x",String(x));hit.setAttribute("y",String(y));
   hit.setAttribute("width",String(w));hit.setAttribute("height",String(h));
  }
  // The original green lamp pixels deliberately STAY at their original
  // bottom-of-button positions; only the button art and its hitbox move.
 }
 if(new URLSearchParams(location.search).get("mcpBoxes")==="1")drawQA(root);
}
function drawQA(root){
 if(root.querySelector(".mcp-socket-qa"))return;
 const NS="http://www.w3.org/2000/svg",svg=document.createElementNS(NS,"svg");
 svg.setAttribute("viewBox","0 0 "+W+" "+H);
 svg.setAttribute("preserveAspectRatio","none");
 svg.setAttribute("aria-label","MCP native source photo hole outlines");
 svg.classList.add("mcp-socket-qa");
 Object.assign(svg.style,{position:"absolute",inset:"0",width:"100%",height:"100%",
  zIndex:"20",pointerEvents:"none",overflow:"hidden"});
 function outline(kind,id,r,verified){
  const [x,y,w,h]=r;
  const shape=document.createElementNS(NS,kind);
  const attrs=kind==="ellipse"?{cx:x+w/2,cy:y+h/2,rx:w/2,ry:h/2}:{x,y,width:w,height:h};
  for(const [key,val] of Object.entries(attrs))shape.setAttribute(key,String(val));
  shape.setAttribute("fill","none");
  shape.setAttribute("stroke",verified?(kind==="ellipse"?"#39d7ff":"#ff564f"):"#fac84c");
  shape.setAttribute("stroke-width","2");svg.append(shape);
  const t=document.createElementNS(NS,"text");
  t.textContent=id;t.setAttribute("x",String(x));t.setAttribute("y",String(Math.max(y-7,16)));
  t.setAttribute("font-size","16");t.setAttribute("font-weight","650");
  t.setAttribute("fill","#ffe286");svg.append(t);
 }
 for(const g of getKnobs())if(knobRects[g.id])outline("ellipse",g.id,knobRects[g.id],true);
 for(const g of getHardware()){
  const r=hardwareRects[g.id]||[g.x-g.w/2,g.y-g.h/2,g.w,g.h];
  outline(["CO","SPD_INTV","ALT_INTV","AT_ARM"].includes(g.id)?"ellipse":"rect",g.id,r,!!hardwareRects[g.id]);
 }
 for(const [id,x,y,w,h] of buttonRects)outline("rect",id,[x,y,w,h],true);
 root.append(svg);
}
function mount(){
 document.querySelectorAll('[data-piece="mcp"]').forEach(root=>{
  if(!mounted.has(root)){
   mounted.add(root);
   // Owner13 loads its original source sprites asynchronously: re-register
   // when they appear, without creating substitute buttons or redrawing the panel.
   new MutationObserver(list=>{
    if(list.some(item=>Array.from(item.addedNodes).some(n=>n.nodeType===1&&
      (n.matches?.(".mcp-owner13-push,.mcp-hw,.mcp-v3-knob")||
       n.querySelector?.(".mcp-owner13-push,.mcp-hw,.mcp-v3-knob")))))register(root);
   }).observe(root,{childList:true});
  }
  register(root);
 });
}
function audit(){
 const records=[];
 for(const root of document.querySelectorAll('[data-piece="mcp"]')){
  const parent=root.getBoundingClientRect(),sx=parent.width/W,sy=parent.height/H;
  const all=[
   ...getKnobs().filter(g=>knobRects[g.id]).map(g=>({id:g.id,kind:"knob",r:knobRects[g.id],selector:'.mcp-v3-knob[data-control="'+g.id+'"]'})),
   ...getHardware().map(g=>({id:g.id,kind:"hardware",
     r:hardwareRects[g.id]||[g.x-g.w/2,g.y-g.h/2,g.w,g.h],
     selector:'[data-mcp-hardware="'+g.id+'"]'})),
   ...buttonRects.map(([id,x,y,w,h])=>({id,kind:"button",r:[x,y,w,h],
     selector:'[data-owner13-push="'+id+'"]'}))
  ];
  for(const item of all){
   const el=root.querySelector(item.selector),[x,y]=rectCenter(item.r);
   if(!el){records.push({id:item.id,status:"NOT_MOUNTED"});continue;}
   const b=el.getBoundingClientRect(),cx=(b.left+b.width/2-parent.left)/sx,
     cy=(b.top+b.height/2-parent.top)/sy;
   const e=Math.hypot(cx-x,cy-y);
   records.push({id:item.id,kind:item.kind,center:[x,y],
     sourceBounds:item.r,centerErrorPx:+e.toFixed(2),
     status:e<1?"CENTER_PASS":"CHECK",pixelMapped:!!(knobRects[item.id]||hardwareRects[item.id]||buttonRects.some(a=>a[0]===item.id))});
  }
 }
 return {schema:"MCP-SOCKET-0002",sourcePanel:"B737_MCP_Blank_Panel.png",
  originalDimensions:[W,H],originalSha256:photoSha,
  apertureDetection:"original image RGB dark connected-component bounds; source file unmodified",
  records};
}
window.B737McpSocketRegistrationV2=Object.freeze({
 mount,audit,sourceSize:[W,H],sourceSha256:photoSha,
 buttonRects:buttonRects.map(x=>x.slice()),
 knobRects:Object.assign({},knobRects),
 hardwareRects:Object.assign({},hardwareRects)
});
window.addEventListener("b737:cockpit-mounted",mount);
document.addEventListener("DOMContentLoaded",mount,{once:true});
if(document.readyState!=="loading")mount();
})();