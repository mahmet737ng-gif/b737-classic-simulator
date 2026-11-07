/* MCP-HIT-0001: actual pointer targets ABOVE the MCP photo artwork.
 * Decouples interaction from photographic sprite transparency, overlapping
 * layers and SVG lamps. Coordinates are the approved source-photo holes.
 * The HEADING assembly has TWO independent targets: SQUARE bank angle outer
 * selector (10/15/20/25/30), CIRCULAR heading inner selector (000..359).
 * Other targets: COURSE L / IAS-MACH / ALT / COURSE R / V/S wheel.
 * No continuous clock, polling or background simulation.
 */
(function(win,doc){
"use strict";
const W=2172,H=433,G=win.B737McpRotaryGestureV1,R=win.B737McpFCOMCh4NumericV1;
if(!G?.create||!R?.step)throw Error("MCP physical hitbox requires FCOM and gesture authorities");
const mounted=new WeakSet(),roots=[],active={pointer:null,surface:null},counters=Object.create(null);
const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
const pct=(v,total)=>v/total*100+"%";
const descriptors=()=> {
 const holes=win.B737McpSocketRegistrationV2?.knobRects;
 const hardware=win.B737McpSocketRegistrationV2?.hardwareRects;
 if(!holes||!hardware)return [];
 const rect=id=>holes[id]||[];
 const centered=(id,label,kind="round")=>{
  const [x,y,w,h]=rect(id);
  return {id,label,kind,x:x+w/2,y:y+h/2,w,h,control:id};
 };
 const heading=rect("heading");
 const hx=heading[0]+heading[2]/2,hy=heading[1]+heading[3]/2;
 const [vx,vy,vw,vh]=hardware.VS_WHEEL;
 return [
  centered("courseL","Captain COURSE selector"),
  centered("speed","IAS/MACH selector"),
  {id:"bankAngle",label:"BANK ANGLE outer square selector",kind:"square",
   x:hx,y:hy,w:104,h:104,control:"bankAngle"},
  {id:"heading",label:"HEADING inner circular selector",kind:"round",
   x:hx,y:hy,w:56,h:56,control:"heading"},
  centered("altitude","ALTITUDE selector"),
  centered("courseR","First Officer COURSE selector"),
  {id:"verticalSpeed",label:"VERTICAL SPEED wheel",kind:"wheel",
   x:vx+vw/2,y:vy+vh/2,w:vw,h:vh,control:"verticalSpeed"}
 ];
};
function change(id,n,method){
 if(!Number.isInteger(n)||n===0)return;
 let done=false;
 if(id==="bankAngle"){
  const api=win.B737McpOwner13V1;
  if(api?.adjustBank){
   api.adjustBank(n,method);
   done=true;
  }
 }else if(id==="verticalSpeed"){
  const api=win.B737McpHardwareV1;
  if(api?.rotateVS){api.rotateVS(n,method);done=true;}
 }else{
  const api=win.B737McpVisualV3;
  if(api?.rotateKnob){done=api.rotateKnob(id,n,method)===true;}
 }
 if(done)counters[id]=(counters[id]||0)+Math.abs(n);
}
function createSurface(root,d){
 const el=doc.createElement("span");
 el.className="mcp-native-hit-surface mcp-hit-"+d.id;
 el.dataset.mcpHit=d.id;
 el.setAttribute("role","slider");
 el.setAttribute("tabindex","0");
 el.setAttribute("aria-label",d.label+"; tap left/right, swipe or scroll to change");
 Object.assign(el.style,{
  position:"absolute",left:pct(d.x,W),top:pct(d.y,H),
  width:pct(d.w,W),height:pct(d.h,H),
  transform:"translate(-50%,-50%)",zIndex:d.id==="heading"?"61":"60",
  display:"block",border:"0",padding:"0",margin:"0",
  background:"transparent",opacity:"1",
  borderRadius:d.kind==="round"?"50%":"0",
  boxSizing:"border-box",
  pointerEvents:"auto",touchAction:"none",userSelect:"none",
  cursor:d.kind==="wheel"?"ns-resize":"ew-resize"
 });
 el.style.webkitUserSelect="none";
 if(new URLSearchParams(win.location.search).get("mcpHitQA")==="1"){
  el.style.outline="2px solid "+(d.id==="heading"?"#37ebff":d.id==="bankAngle"?"#ffb640":"#59ffad");
  el.style.background="rgba(38,180,220,.12)";
 }
 const tapDirection=e=>{
  const b=el.getBoundingClientRect();
  return d.kind==="wheel"?(e.clientY<b.top+b.height/2?1:-1):
   (e.clientX<b.left+b.width/2?-1:1);
 };
 const gesture=G.create({
  axis:d.kind==="wheel"?"y":"auto",
  pixelsPerDetent:()=>{
   const box=el.getBoundingClientRect();
   return clamp((d.kind==="wheel"?box.height*.055:box.width*.12),5,18);
  },
  tapDirection,onDetents:(count,meta)=>change(d.id,count,meta.method)
 });
 function activePointer(e){return active.pointer===(e.pointerId??1)&&active.surface===d.id;}
 function down(e){
  if(e.pointerType==="mouse"&&e.button!==0)return;
  if(active.pointer!==null){
   // Multitouch pinch: cancel any active rotation, never mix fingers.
   if(e.pointerType==="touch"&&e.pointerId!==active.pointer){
    gesture.cancel();active.pointer=null;active.surface=null;
   }
   return;
  }
  if(!gesture.down(e))return;
  active.pointer=e.pointerId??1;active.surface=d.id;
  e.preventDefault();e.stopPropagation();
  el.focus({preventScroll:true});
  try{el.setPointerCapture(e.pointerId)}catch(_){}
 }
 function move(e){
  if(!activePointer(e))return;
  e.preventDefault();e.stopPropagation();gesture.move(e);
 }
 function finish(e,cancel){
  if(!activePointer(e))return;
  e.preventDefault();e.stopPropagation();
  if(cancel)gesture.cancel();else gesture.up(e);
  active.pointer=null;active.surface=null;
  if(el.hasPointerCapture?.(e.pointerId))el.releasePointerCapture(e.pointerId);
 }
 el.addEventListener("pointerdown",down);
 el.addEventListener("pointermove",move);
 el.addEventListener("pointerup",e=>finish(e,false));
 el.addEventListener("pointercancel",e=>finish(e,true));
 el.addEventListener("lostpointercapture",e=>finish(e,true));
 el.addEventListener("wheel",e=>{
  e.preventDefault();e.stopPropagation();
  gesture.wheel(e.deltaY,e.deltaMode);
 },{passive:false});
 el.addEventListener("keydown",e=>{
  const sign=["ArrowUp","ArrowRight"].includes(e.key)?1:
   ["ArrowDown","ArrowLeft"].includes(e.key)?-1:0;
  if(sign){e.preventDefault();e.stopPropagation();change(d.id,sign,"keyboard");}
  if(e.key==="Home"||e.key==="End"){
   e.preventDefault();e.stopPropagation();
   const id=d.id==="speed"&&win.B737McpVisualV3?.getState?.()?.speedMode==="MACH"?"machHundredths":d.id;
   const bank=id==="bankAngle",spec=R.SPECS[id];
   if(bank)win.B737McpOwner13V1?.setBankAngle?.(e.key==="Home"?10:30,"keyboard");
   else if(spec){
    const before=(d.id==="verticalSpeed"?
     win.B737McpHardwareV1?.getState?.()?.VS_WHEEL:
     win.B737McpVisualV3?.getState?.()?.[id])??0;
    const end=e.key==="Home"?spec.min:spec.max;
    if(d.id==="verticalSpeed")win.B737McpHardwareV1?.setState?.("VS_WHEEL",end);
    else win.B737McpVisualV3?.setValue?.(id,end);
    if(before!==end)counters[d.id]=(counters[d.id]||0)+1;
   }
  }
 });
 el.addEventListener("click",e=>{e.preventDefault();e.stopPropagation()});
 root.append(el);
 return el;
}
function mount(){
 const ds=descriptors();
 if(ds.length!==7)return;
 for(const root of doc.querySelectorAll('[data-piece="mcp"]')){
  if(mounted.has(root))continue;
  if(!root.querySelector('.mcp-v3-knob[data-control="heading"]'))continue;
  mounted.add(root);roots.push(root);
  for(const d of ds)createSurface(root,d);
  root.dataset.mcpRotaryInput="active";
 }
}
function audit(){
 return {schema:"MCP-HIT-0001",roots:roots.length,targets:roots.flatMap(root=>
  [...root.querySelectorAll(".mcp-native-hit-surface")].map(el=>{
   const b=el.getBoundingClientRect();
   const target=doc.elementFromPoint?.(b.left+b.width/2,b.top+b.height/2);
   const reachable=target===el||el.contains?.(target)===true;
   return {id:el.dataset.mcpHit,center:[b.left+b.width/2,b.top+b.height/2],
    width:b.width,height:b.height,reachable,topTarget:target?.className||target?.tagName||null};
  })),detents:{...counters},active:{...active}};
}
win.B737McpRotaryHitSurfacesV1=Object.freeze({mount,audit,descriptors});
win.addEventListener("b737:cockpit-mounted",mount);
doc.addEventListener("DOMContentLoaded",mount);
if(doc.readyState!=="loading")mount();
})(window,document);
