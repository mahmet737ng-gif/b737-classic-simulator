/* MCP-SOCKET-0001 — register EXISTING MCP controls against the original 2172×433 photo.
 * No aircraft art or controls are created. Optional ?mcpBoxes=1 displays QA boxes.
 * Existing owner-provided native coordinates are authoritative pending photographic recheck. */
(function(){
"use strict";
const W=2172,H=433, mounted=new WeakSet();
const buttons=Object.freeze([
 ["VNAV",767,159,104,63],["LNAV",1032,159,104,63],
 ["N1",291,375,98,57],["SPEED",411,375,98,57],
 ["LVL_CHG",729,375,103,57],["HDG_SEL",878,375,98,57],
 ["APP",1029,375,100,57],["ALT_HLD",1207,375,100,57],
 ["VS",1341,375,100,57],["CMD_A",1682,185,108,64],
 ["CWS_A",1682,281,108,64],["CMD_B",1852,185,108,64],
 ["CWS_B",1852,281,108,64]
]);
const escapeId=s=>String(s).replace(/[^A-Za-z0-9_-]/g,"");
const percent=(a,scale)=>(a/scale*100)+"%";
function box(el,x,y,w,h){
 if(!el)return;
 el.style.left=percent(x,W);el.style.top=percent(y,H);
 el.style.width=percent(w,W);el.style.height=percent(h,H);
}
function register(root){
 const knobs=window.B737McpVisualV3?.geometry?.knobs||[];
 const hardware=window.B737McpHardwareV1?.geometry||[];
 for(const g of knobs){
  const el=root.querySelector('.mcp-v3-knob[data-control="'+escapeId(g.id)+'"]');
  if(!el)continue;
  el.style.left=percent(g.x,W);el.style.top=percent(g.y,H);
  el.style.width=percent(g.d,W); // existing aspect-ratio:1/1, never resize artwork independently
  el.dataset.mcpSocketSource="original-2172x433";
 }
 for(const g of hardware){
  const el=root.querySelector('[data-mcp-hardware="'+escapeId(g.id)+'"]');
  if(!el)continue;
  box(el,g.x,g.y,g.w,g.h);
  el.dataset.mcpSocketSource="original-2172x433";
 }
 for(const [id,x,y,w,h] of buttons){
  const art=root.querySelector('[data-owner13-push="'+id+'"]');
  if(art){box(art,x,y,w,h);art.dataset.mcpSocketSource="original-2172x433";}
  // Use the existing lamp click-target, not an extra button overlay.
  const hit=root.querySelector('[data-mcp-lamp="'+id+'"] .mcp-v3-lamp-hit');
  if(hit){
   hit.setAttribute("x",String(x-w/2));hit.setAttribute("y",String(y-h/2));
   hit.setAttribute("width",String(w));hit.setAttribute("height",String(h));
  }
 }
 if(new URLSearchParams(location.search).get("mcpBoxes")==="1")drawBoxes(root,knobs,hardware);
}
function drawBoxes(root,knobs,hardware){
 if(root.querySelector('.mcp-socket-qa'))return;
 const NS="http://www.w3.org/2000/svg";
 const svg=document.createElementNS(NS,"svg");
 svg.setAttribute("viewBox","0 0 "+W+" "+H);
 svg.setAttribute("preserveAspectRatio","none");
 svg.setAttribute("aria-label","MCP socket calibration only");
 svg.classList.add("mcp-socket-qa");
 Object.assign(svg.style,{position:"absolute",inset:"0",width:"100%",height:"100%",zIndex:"15",pointerEvents:"none",overflow:"visible"});
 const draw=(kind,id,x,y,w,h)=>{
  const shape=document.createElementNS(NS,kind);
  const attr=kind==="circle"?{cx:x,cy:y,r:w/2}:{x:x-w/2,y:y-h/2,width:w,height:h};
  for(const [k,v] of Object.entries(attr))shape.setAttribute(k,String(v));
  shape.setAttribute("fill","none");shape.setAttribute("stroke",kind==="circle"?"#36d8ff":"#ff5a45");
  shape.setAttribute("stroke-width","2.5");svg.append(shape);
  const t=document.createElementNS(NS,"text");
  t.setAttribute("x",String(x-w/2));t.setAttribute("y",String(y-h/2-5));
  t.setAttribute("font-size","17");t.setAttribute("font-weight","600");
  t.setAttribute("fill","#f8d25b");t.textContent=id;svg.append(t);
 };
 for(const g of knobs)draw("circle",g.id,g.x,g.y,g.d,g.d);
 for(const g of hardware)draw("rect",g.id,g.x,g.y,g.w,g.h);
 for(const [id,x,y,w,h] of buttons)draw("rect",id,x,y,w,h);
 root.append(svg);
}
function mount(){
 document.querySelectorAll('[data-piece="mcp"]').forEach(root=>{
  if(!mounted.has(root)){
   mounted.add(root);
   const observer=new MutationObserver(list=>{
    if(list.some(v=>Array.from(v.addedNodes).some(n=>n.nodeType===1&&(n.matches?.('.mcp-owner13-push,.mcp-hw,.mcp-v3-knob')||n.querySelector?.('.mcp-owner13-push')))))register(root);
   });
   observer.observe(root,{childList:true});
  }
  register(root);
 });
}
function audit(){
 const roots=Array.from(document.querySelectorAll('[data-piece="mcp"]'));
 return {schema:"MCP-SOCKET-0001",photo:[W,H],sourcePhotoPixelAudit:"NOT_VERIFIED",renderedRoots:roots.length,
  records:roots.map(root=>{
   const knobs=window.B737McpVisualV3?.geometry?.knobs||[],hw=window.B737McpHardwareV1?.geometry||[];
   const b=root.getBoundingClientRect(), sx=b.width/W,sy=b.height/H;
   const r=[];
   for(const [id,kind,x,y,w,h] of [
    ...knobs.map(g=>[g.id,"knob",g.x,g.y,g.d,g.d]),
    ...hw.map(g=>[g.id,"hardware",g.x,g.y,g.w,g.h]),
    ...buttons.map(([id,x,y,w,h])=>[id,"push",x,y,w,h])
   ]){
    const selector=kind==="knob"?'.mcp-v3-knob[data-control="'+id+'"]':kind==="hardware"?'[data-mcp-hardware="'+id+'"]':'[data-owner13-push="'+id+'"]';
    const el=root.querySelector(selector);
    if(!el){r.push({id,kind,status:"MISSING"});continue;}
    const a=el.getBoundingClientRect(), cx=(a.left+a.width/2-b.left)/sx,cy=(a.top+a.height/2-b.top)/sy;
    r.push({id,kind,sourceCenter:[x,y],sourceBounds:[x-w/2,y-h/2,x+w/2,y+h/2],
     centerErrorPx:+Math.hypot(cx-x,cy-y).toFixed(2),status:Math.hypot(cx-x,cy-y)<1?"CENTER_PASS":"CHECK"});
   }
   return r;
  })};
}
window.B737McpSocketRegistrationV1=Object.freeze({mount,audit,buttons:buttons.map(a=>a.slice())});
window.addEventListener("b737:cockpit-mounted",mount);
document.addEventListener("DOMContentLoaded",mount,{once:true});
if(document.readyState!=="loading")mount();
})();