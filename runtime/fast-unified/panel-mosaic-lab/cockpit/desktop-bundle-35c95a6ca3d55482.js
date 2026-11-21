(async()=>{
;
/* ./mcp-socket-registration-v2.js?v=MCP-KNOB-HOLE-0001 */
try{
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
 ["VOR_LOC",964,218,98,66],
 ["N1",240,321,98,68],["SPEED",356,322,98,68],
 ["LVL_CHG",669,325,105,67],["HDG_SEL",813,325,104,67],
 ["APP",956,326,109,67],["ALT_HLD",1144,327,106,68],
 ["VS",1273,328,103,67],
 ["CMD_A",1579,130,101,67],["CMD_B",1761,131,98,67],
 ["CWS_A",1581,228,96,65],["CWS_B",1761,229,97,65]
]);
/* MCP-KNOB-HOLE-0001: exact native black circular apertures detected from
 * 2172x433 immutable source PHOTO pixels, NOT from overlaid knobs.
 * courseL dark edge: center (90,242), radius 54 native px;
 * IAS/MACH dark edge: center (562,276), radius 47 native px;
 * courseR dark edge: center (2018,249), radius 49 native px.
 * The original 80/480 photo asset has transparent inset, which is calibrated
 * below so the VISIBLE alpha silhouette occupies equal area to the dark hole.
 * Other two rotary controls retain previously approved positions and sizes.
 */
const knobRects=Object.freeze({
 courseL:[36,188,108,108],speed:[515,229,94,94],
 heading:[823,194,81,86],altitude:[1157,193,86,86],
 courseR:[1969,200,98,98]
});
const knobPhotoPixels=Object.freeze({
 courseL:{side:480,opaque:113176,alpha:[63,21,440,404]},
 speed:{side:480,opaque:139783,alpha:[27,18,453,460]},
 courseR:{side:480,opaque:113176,alpha:[63,21,440,404]}
});
function photoFit(id){
 const a=knobPhotoPixels[id];
 if(!a)return null;
 const fraction=a.opaque/(a.side*a.side);
 // Matching geometric area: alpha mask area after scaling = pi*r^2.
 const factor=Math.sqrt((Math.PI/4)/fraction);
 const alphaCenterX=(a.alpha[0]+a.alpha[2])/(2*a.side);
 const alphaCenterY=(a.alpha[1]+a.alpha[3])/(2*a.side);
 return {
  factor,
  imageLeftPct:100*((1-factor)/2-(alphaCenterX-.5)*factor),
  imageTopPct:100*((1-factor)/2-(alphaCenterY-.5)*factor),
  alphaFraction:fraction
 };
}
const knobPhotoFits=Object.freeze(Object.fromEntries(Object.keys(knobPhotoPixels)
 .map(id=>[id,Object.freeze(photoFit(id))])));
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
  // Center BOTH x and y on the hole and set both dimensions from its
  // physical diameter (no width-only sizing, guessed scale, or CSS stretch).
  const fitted=knobPhotoFits[g.id],diameter=Math.max(hole[2],hole[3]);
  el.style.left=percent(x,W);
  el.style.top=percent(y,H);
  el.style.width=percent(diameter,W);
  if(fitted){
   el.style.height=percent(diameter,H);
   el.style.setProperty("--mcp-knob-photo-fill",(fitted.factor*100).toFixed(5)+"%");
   el.style.setProperty("--mcp-knob-photo-left",fitted.imageLeftPct.toFixed(5)+"%");
   el.style.setProperty("--mcp-knob-photo-top",fitted.imageTopPct.toFixed(5)+"%");
   el.dataset.mcpHoleCenter=x+","+y;
   el.dataset.mcpHoleDiameter=String(diameter);
   el.dataset.mcpHoleArea=(Math.PI*diameter*diameter/4).toFixed(2);
  }
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
 return {schema:"MCP-SOCKET-0003",sourcePanel:"B737_MCP_Blank_Panel.png",
  originalDimensions:[W,H],originalSha256:photoSha,
  apertureDetection:"original image RGB dark connected-component bounds; source file unmodified",
  knobFitAudit:Object.entries(knobPhotoFits).map(([id,p])=>{
   const [x,y,w,h]=knobRects[id],holeArea=Math.PI*w*h/4;
   const renderedArea=p.alphaFraction*p.factor*p.factor*w*h;
   return {id,holeCenter:[x+w/2,y+h/2],holeDiameter:w,
    holeAreaPx2:+holeArea.toFixed(2),renderedOpaqueAreaPx2:+renderedArea.toFixed(2),
    areaErrorPct:+(100*(renderedArea/holeArea-1)).toFixed(4),
    photoScale:+p.factor.toFixed(6),imageLeftPct:+p.imageLeftPct.toFixed(4),
    imageTopPct:+p.imageTopPct.toFixed(4)};
  }),records};
}
window.B737McpSocketRegistrationV2=Object.freeze({
 mount,audit,sourceSize:[W,H],sourceSha256:photoSha,
 buttonRects:buttonRects.map(x=>x.slice()),
 knobRects:Object.assign({},knobRects),
 knobPhotoFits,hardwareRects:Object.assign({},hardwareRects)
});
window.addEventListener("b737:cockpit-mounted",mount);
document.addEventListener("DOMContentLoaded",mount,{once:true});
if(document.readyState!=="loading")mount();
})();
}catch(error){queueMicrotask(()=>{throw error});}
;await 0;
;
/* ./mcp-rotary-hit-surfaces-v1.js?v=MCP-HIT-0001-LIVE-TOPMOST */
try{
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
const mounted=new WeakSet(),roots=[],active={pointer:null,surface:null,gesture:null},counters=Object.create(null);
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
    active.gesture?.cancel();active.pointer=null;active.surface=null;active.gesture=null;
   }
   return;
  }
  if(!gesture.down(e))return;
  active.pointer=e.pointerId??1;active.surface=d.id;active.gesture=gesture;
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
  active.pointer=null;active.surface=null;active.gesture=null;
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
  })),detents:{...counters},active:{pointer:active.pointer,surface:active.surface}};
}
win.B737McpRotaryHitSurfacesV1=Object.freeze({mount,audit,descriptors});
win.addEventListener("b737:cockpit-mounted",mount);
doc.addEventListener("DOMContentLoaded",mount);
if(doc.readyState!=="loading")mount();
})(window,document);

}catch(error){queueMicrotask(()=>{throw error});}
;await 0;
;
/* ../../engine/afds/classic-speed-limit-ch4-v1.js?v=SPEED-LIMIT-CH4-0002 */
try{
/* B737 Classic 300/400/500 SHI FCOM 4.10.3-5, 4.20.31-35.
 * Deterministic, evidence-gated speed-limit and reversion decision engine.
 * Does not invent a "slightly-before-limit" speed delta or certified data.
 */
(function(root,factory){'use strict';const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.B737ClassicSpeedLimitCh4V1=api;
})(typeof globalThis!=='undefined'?globalThis:null,function(){'use strict';
 const SCHEMA='B737_CLASSIC_CH4_SPEED_LIMIT_V1';
 const GEAR_SPEED_LIMITS=Object.freeze({
  DOWN:Object.freeze({iasKt:320,mach:0.82}),
  EXTENDING:Object.freeze({iasKt:270,mach:0.82}),
  RETRACTING:Object.freeze({iasKt:235,mach:null})
 });
 const GEAR_STATES=['UP','DOWN','EXTENDING','RETRACTING'];
 const PITCH=['VS','VNAV_PTH','VNAV_SPD','LVL_CHG','ALT_HOLD','G/S','CWS','OTHER',null];
 const BOOL=['gearExtended','atArmed','atAvailable','atSpeedControl','thrustAtIdle',
  'afdsEngaged','afdsSpeedControl','apEngaged','gsCaptured','vnavLevelSegment',
  'vnavLevelCapture','climb','climbMaintainable','performanceInsufficient',
  'speedIncreasing','nearHighLimit','nearMinimum','cwsMode'];
 const NUM=['actualCasKt','selectedMcpCasKt','selectedFmcCasKt','minimumSpeedKt',
  'vmoMmoCasKt','gearPlacardKt','flapPlacardKt','flapsPosition'];
 const finite=n=>typeof n==='number'&&Number.isFinite(n)&&n>=0&&n<=600;
 const initialState=()=>({schema:SCHEMA,revision:0,symbol:'NONE',
  previousSelectedKt:null,previousPitch:null,last:null});
 function verified(e){
  if(e?.type!=='FCC_SPEED_LIMIT'||e.confirmed!==true||
   !['SIMULATED_FCC','INSTRUCTOR_SCENARIO'].includes(e.source))
   throw Error('QUALIFIED_FCC_SPEED_LIMIT_REQUIRED');
  if(!PITCH.includes(e.pitchMode)||!['MCP','FMC',null].includes(e.commandSource))
   throw Error('INVALID_SPEED_MODE');
  for(const k of BOOL)if(e[k]!==undefined&&![true,false,null].includes(e[k]))
   throw Error('INVALID_CH4_FLAG_'+k);
  for(const k of NUM)if(e[k]!==undefined&&e[k]!==null&&!finite(e[k]))
   throw Error('INVALID_CH4_SPEED_'+k);
  if(e.flapsPosition>40)throw Error('INVALID_FLAPS');
  if(e.gearState!==undefined&&e.gearState!==null&&!GEAR_STATES.includes(e.gearState))
   throw Error('INVALID_GEAR_STATE');
  if(e.actualMach!==undefined&&e.actualMach!==null&&
     (typeof e.actualMach!=='number'||!Number.isFinite(e.actualMach)||e.actualMach<0||e.actualMach>1.5))
   throw Error('INVALID_ACTUAL_MACH');
  const x={...e};
  for(const k of [...BOOL,...NUM])if(x[k]===undefined)x[k]=null;
  if(x.actualMach===undefined)x.actualMach=null;
  x.gearState=x.gearState??(x.gearExtended===true?'DOWN':x.gearExtended===false?'UP':null);
  if((x.gearState==='UP'&&x.gearExtended===true)||(x.gearState==='DOWN'&&x.gearExtended===false))
   throw Error('CONFLICTING_GEAR_EVIDENCE');
  return x;
 }
 function transition(old,event){
  if(old?.schema!==SCHEMA)throw Error('INVALID_CH4_STATE');
  if(event?.type==='CLEAR')return initialState();
  const e=verified(event);
  const selected=e.commandSource==='MCP'?e.selectedMcpCasKt:
   e.commandSource==='FMC'?e.selectedFmcCasKt:null;
  const candidates=[];
  const gearLimit=GEAR_SPEED_LIMITS[e.gearState]??null;
  if(finite(e.vmoMmoCasKt))candidates.push({speed:e.vmoMmoCasKt,reason:'VMO_MMO'});
  if(gearLimit)candidates.push({speed:gearLimit.iasKt,reason:'GEAR_PLACARD'});
  if(e.flapsPosition!==null&&e.flapsPosition>0&&finite(e.flapPlacardKt))
   candidates.push({speed:e.flapPlacardKt,reason:'FLAP_PLACARD'});
  const complete=finite(e.vmoMmoCasKt)&&e.gearState!==null&&
   e.flapsPosition!==null&&(e.flapsPosition===0||finite(e.flapPlacardKt));
  const max=complete?candidates.reduce((a,b)=>a.speed<=b.speed?a:b):null;
  const min=finite(e.minimumSpeedKt)?e.minimumSpeedKt:null;
  const conflict=min!==null&&max!==null&&min>max.speed;
  const actual=finite(e.actualCasKt)?e.actualCasKt:null;
  const low=!conflict&&actual!==null&&min!==null&&
   (actual<=min||e.nearMinimum===true);
  const machExceeded=gearLimit?.mach!=null&&e.actualMach!==null&&
   e.actualMach>=gearLimit.mach;
  const highByCas=actual!==null&&max!==null&&
   (actual>=max.speed||e.nearHighLimit===true);
  const high=!conflict&&(highByCas||machExceeded);
  const perf=e.pitchMode==='VS'&&e.performanceInsufficient===true&&
   e.speedIncreasing===false&&actual!==null&&finite(e.selectedMcpCasKt)&&
   actual<e.selectedMcpCasKt-5;
  const speedChanged=selected!==null&&selected!==old.previousSelectedKt;
  const pitchChanged=old.previousPitch!==null&&e.pitchMode!==old.previousPitch;
  let symbol=old.symbol;
  if(symbol==='PERFORMANCE'&&(speedChanged||pitchChanged))symbol='NONE';
  if(symbol==='UNDERSPEED'&&min!==null&&
   ((actual!==null&&actual>=min+15)||(speedChanged&&selected>=min+15)))
   symbol='NONE';
  if(symbol==='OVERSPEED'&&max!==null&&speedChanged&&selected<=max.speed&&!high)
   symbol='NONE';
  if(actual===null||conflict)symbol='NONE';
  if(perf)symbol='PERFORMANCE';
  else if(low)symbol='UNDERSPEED';
  else if(high)symbol='OVERSPEED';
  let commanded=selected,clamp=null;
  if(commanded!==null&&!conflict){
   if(min!==null&&commanded<min){commanded=min;clamp='MINIMUM_SPEED';}
   if(max!==null&&commanded>max.speed){commanded=max.speed;clamp=max.reason;}
  }
  if(conflict)commanded=null;
  const inhibited=e.pitchMode==='ALT_HOLD'?'ALT_HOLD':
   e.gsCaptured===true||e.pitchMode==='G/S'?'GS_CAPTURED':
   e.pitchMode==='VNAV_PTH'&&e.vnavLevelSegment===true?'VNAV_LEVEL':
   e.pitchMode==='VNAV_PTH'&&e.vnavLevelCapture===true?'VNAV_CAPTURE':null;
  let reversion='NONE',reason=null;
  if(low&&!inhibited){
   if(e.pitchMode==='VS')reversion='LVL_CHG_MINIMUM';
   if(e.pitchMode==='VNAV_PTH'&&e.vnavLevelSegment===false&&
    e.vnavLevelCapture===false)reversion='LVL_CHG_MINIMUM';
   if(e.pitchMode==='LVL_CHG'&&e.climb===true&&e.climbMaintainable===false&&
    e.apEngaged===true)reversion='AP_DISENGAGE_FD_RETRACT';
   commanded=Math.max(commanded??(min+5),min+5);
   if(max!==null)commanded=Math.min(max.speed,commanded);
   reason='MINIMUM_SPEED';
  }else if(perf){
   reversion='LVL_CHG_PERFORMANCE';reason='VS_THRUST_INSUFFICIENT';
  }else if(high){
   reason=machExceeded&&!highByCas?'GEAR_MACH_LIMIT':max.reason;
   if(max.reason==='VMO_MMO'&&e.pitchMode==='VS'&&
    e.atSpeedControl===true&&e.thrustAtIdle===true)
    reversion='LVL_CHG_VMO';
   else if(e.atAvailable===false){
    if(max.reason==='VMO_MMO')reversion='AFDS_VMO_SPEED_CONTROL';
   }else if(e.atAvailable===true&&e.atArmed===true&&e.afdsEngaged===true&&
     e.afdsSpeedControl===false&&e.cwsMode===false&&e.atSpeedControl===false)
    reversion='AT_SPEED_PLACARD';
   else if(e.atSpeedControl===true||e.afdsSpeedControl===true)
    reversion='MAINTAIN_LIMIT';
  }
  if(conflict){symbol='NONE';reversion='NONE';reason='CONFLICTING_LIMITS';}
  const out={schema:SCHEMA,revision:old.revision+1,source:e.source,
   authorized:e.source==='SIMULATED_FCC',actualCasKt:actual,
   selectedCasKt:selected,minimumSpeedKt:min,maximumSpeedKt:max?.speed??null,
   gearState:e.gearState,gearOperatingLimitKt:gearLimit?.iasKt??null,
   gearOperatingLimitMach:gearLimit?.mach??null,actualMach:e.actualMach,
   gearMachLimitReached:machExceeded,
   maximumReason:max?.reason??null,upperLimitComplete:complete&&!conflict,
   conflictingLimits:conflict,effectiveCommandKt:commanded,
   clampReason:clamp,speedConditionSymbol:symbol,flashing:symbol!=='NONE',
   reversion,reversionReason:reason,minimumReversionInhibitedBy:inhibited,
   selectedOutOfEnvelope:selected!==null&&!conflict&&
    ((min!==null&&selected<min)||(max!==null&&selected>max.speed)),
   note:'FCC SIMULATOR DECISION; NO AUTOMATIC PHYSICAL SERVO'};
  return {schema:SCHEMA,revision:out.revision,symbol,previousSelectedKt:selected,
   previousPitch:e.pitchMode,last:out};
 }
 function view(s){if(s?.schema!==SCHEMA)throw Error('INVALID_CH4_STATE');
  return s.last?JSON.parse(JSON.stringify(s.last)):null;}
 return Object.freeze({VERSION:'SPEED-LIMIT-CH4-0002',SCHEMA,GEAR_SPEED_LIMITS,
  initialState,transition,view});
});
}catch(error){queueMicrotask(()=>{throw error});}
;await 0;
;
/* ../../engine/afds/mcp-mode-core-v1.js?v=LVLCHG-CH4-0001&amp;exclusive=MCP-FMA-0001&amp;cws=CWS-AXIS-0001&amp;cb=CB-UNIFIED-0008&amp;fd=FCOM-CH4-0002&amp;alt=ACQ-0001 */
try{
/* MCP AFDS integration slice 1: deterministic educational state machine.
 * Not an autopilot flight dynamics model; unobserved FMS/NAV, capture, and servo
 * conditions stay UNKNOWN. No EP-FSI-specific MCP breaker/feed is asserted.
 */
(function(root,factory){
 "use strict";const api=factory();if(typeof module==="object"&&module.exports)module.exports=api;
 if(root)root.B737McpModeCoreV1=api;
})(typeof globalThis!=="undefined"?globalThis:null,function(){
"use strict";
const Rules=typeof globalThis!=="undefined"?globalThis.B737McpFCOMCh4NumericV1:null;
// Decision-only Ch4 model. Browser module loads before this AFDS core;
 // CommonJS import is used only by deterministic Node regression tests.
const SpeedLimit=globalThis.B737ClassicSpeedLimitCh4V1||
 (typeof module==='object'&&typeof require==='function'?
 require('./classic-speed-limit-ch4-v1.js'):null);
const STATES=Object.freeze({UNVERIFIED:"UNVERIFIED",ABSENT:"ABSENT",INSTRUCTOR_OBSERVED:"INSTRUCTOR_OBSERVED",SIMULATED_DC1:"SIMULATED_DC1"});
const lateral=Object.freeze(["HDG_SEL","LNAV","VOR_LOC"]);
const vertical=Object.freeze(["LVL_CHG","ALT_HLD","VS","VNAV"]);
const thrust=Object.freeze(["N1","SPEED"]);
const FCOM_AP_DISCONNECT_REASONS=Object.freeze([
 "CONTROL_WHEEL_AP_DISCONNECT","AP_DISENGAGE_BAR_DOWN",
 "AP_ENGAGE_PADDLE_OFF","ILLUMINATED_AP_ENGAGE_SWITCH",
 "TOGA_BELOW_2000_RA","DUAL_AP_TOGA_AFTER_TOUCHDOWN",
 "CONTROL_WHEEL_TRIM","STAB_TRIM_AUTOPILOT_CUTOUT",
 "AP_A_HYDRAULIC_PRESSURE_LOST","AP_B_HYDRAULIC_PRESSURE_LOST",
 "LEFT_IRS_FAILURE","RIGHT_IRS_FAILURE","ELECTRICAL_POWER_LOST",
 "CRITICAL_SENSOR_INPUT_LOST","EFI_TRANSFER_REPOSITIONED",
 "RADIO_ALT_FAILURE_AFTER_LOC_GS_2S"
]);
// FCOM 4.10.4–4.10.11: one active command per A/T, pitch, roll, and
// AFDS channel. New selections replace the previous mode atomically.
// SPEED is A/T; LVL CHG is pitch MCP SPD, NOT another A/T SPEED command.
const MODE_OWNERS=Object.freeze({
 thrust, pitch:vertical, roll:lateral,
 afds:Object.freeze(["CMD_A","CWS_A","CMD_B","CWS_B"])
});
const autoSpeedPitch=mode=>mode==="ALT_HLD"||mode==="VS";
const buttons=Object.freeze(["VNAV","LNAV","N1","SPEED","LVL_CHG","HDG_SEL","VOR_LOC","APP","ALT_HLD","VS","CMD_A","CWS_A","CMD_B","CWS_B"]);
const rejected=(s,reason)=>({...s,lastRejection:reason,revision:s.revision+1});
const clone=v=>JSON.parse(JSON.stringify(v));
function initialState(){return {
 schema:"B737_MCP_AFDS_V1",revision:0,
 electrical:{globalPowerPossible:null,feed:STATES.UNVERIFIED,mcpPower:null,course2Power:null,electronic1:null,dc1:null,batteryBus:null,rawRevision:null},
 fd:{left:false,right:false},autoThrottleArm:false,
 values:{courseL:261,courseR:261,speed:110,machHundredths:60,heading:134,altitude:10000,verticalSpeed:0},
  speedDisplayMode:"IAS",bankAngleLimit:20,
 modes:{lateral:null,vertical:null,thrust:null,autopilot:null},
 evidence:{fmcRouteReady:null,approachCapture:null},
 autoThrustByPitch:false,lvlChgPhase:'UNKNOWN',
 pending:{approach:false},armed:{pitch:null,roll:null},
 capture:{pitch:null,roll:null},override:{pitch:false,roll:false,altHold:false},
 nav:{loc:false,gs:false},dualApproach:{second:null,coupled:false,flareArmed:false,flareEngaged:false,retard:false},flight:null,targets:{pitch:null,roll:null},
 speedLimit:SpeedLimit?.initialState?.()??null,flightDirectorBarsRetracted:false,
 lastRejection:null,lastAutopilotDisengagement:null
};}
function globalPowerPossible(bus){
 if(!bus||typeof bus!=="object")return null;
 // Evaluation is a global absence proof, NOT an MCP equipment-feed assignment.
 const keys=["generator1","generator2","transfer1","transfer2","main1","main2","acStandby","groundService","dc1","dc2","battery","hotBattery","switchedHotBattery","dcStandby"];
 // No MCP AC-only assumption: all possible AC and DC classes must be absent.
 if(keys.some(x=>!Object.hasOwn(bus,x)))return null;
 if(keys.some(x=>bus[x]===true))return true;
 if(keys.every(x=>bus[x]===false))return false;
 return null;
}
/* MCP-0008. Training electrical feeds are computed only when the V7 result
 * explicitly publishes DC BUS 1 / BAT BUS; never infer power from APU RUN,
 * a switch position, or an unrelated generator. P18-1 D1 = AFDS MCP DC;
 * P6-2 B2 = AFDS MCP CRS 2 (photo-labelled candidate CB assignments).
 * Course 2 retains a separate battery-bus indication path. This is trainer
 * wiring, not EP-FSI WDM certification. */
function projectPower(s){
 const e=s.electrical,global=e.globalPowerPossible;
 const mainCb=globalThis.B737UnifiedCB?.available('mcp.power');
 const course2Cb=globalThis.B737UnifiedCB?.available('mcp.course2');
 // MRG CL IV.6 p.186: MCP (DC) is on ELECTRONIC 1 - 28VDC,
 // not generically every load on DC BUS 1. Raw DC1 is a documented V7
 // proxy only when the finer electronic-bus power has not been published.
 const main=global===false||mainCb===false||e.electronic1===false?false:
  e.electronic1===true?true:null;
 const course2=global===false||course2Cb===false||e.batteryBus===false?false:
  e.batteryBus===true?true:null;
 // Never invent a powered MCP from an instructor UI click. Only ATA24 V7
 // bus telemetry and the actual registered circuit breaker can energize it.
 const feed=main===false?STATES.ABSENT:main===true?STATES.SIMULATED_DC1:STATES.UNVERIFIED;
 return {globalPowerPossible:global,feed,mcpPower:main,course2Power:course2,
  electronic1:e.electronic1,dc1:e.dc1,batteryBus:e.batteryBus,rawRevision:e.rawRevision};
}
function clearModes(s){
 s.modes={lateral:null,vertical:null,thrust:null,autopilot:null};
 s.pending.approach=false;
 s.armed={pitch:null,roll:null};s.capture={pitch:null,roll:null};
 s.override={pitch:false,roll:false,altHold:false};s.nav={loc:false,gs:false};
 s.dualApproach={second:null,coupled:false,flareArmed:false,flareEngaged:false,retard:false};
 s.targets={pitch:null,roll:null};s.flight=null;
 s.autoThrustByPitch=false;s.lvlChgPhase='UNKNOWN';
 s.speedLimit=SpeedLimit?.initialState?.()??null;
 s.flightDirectorBarsRetracted=false;
}
function selectPitch(s,id){
 const previous=s.modes.vertical;
 const next=previous===id?null:id;
 s.modes.vertical=next;
 s.capture.pitch=null;s.override.pitch=false;s.override.altHold=false;
 s.targets.pitch=null;if(!s.pending.approach)s.armed.pitch=null;
 // Transition from a pitch-owned auto A/T SPEED mode: the new pitch mode
 // replaces the old one, with exactly one illuminated pitch selector.
 if(s.autoThrustByPitch){
  s.modes.thrust=null;
  s.autoThrustByPitch=false;
 }
 if(next==="LVL_CHG"){
  // FCOM 4.10.9: if A/T SPEED was active, retain the selected IAS/MACH
  // as the pitch TARGET, not as a competing A/T MCP SPD annunciation.
  // With qualified active aircraft-altitude evidence the Chapter 4 LVL CHG
  // A/T can select N1 in climb or RETARD then ARM in descent. Without a
  // measured altitude, leave A/T in ARM rather than invent the direction.
  s.modes.thrust=null;s.lvlChgPhase='UNKNOWN';
  setLvlChgThrust(s);
 }else if(next==="VNAV"){
  // A generic VNAV selection cannot prove N1/RETARD/FMC SPD.
  s.modes.thrust=null;
 }else if(autoSpeedPitch(next)&&s.autoThrottleArm){
  // FCOM 4.10.5/4.10.11: V/S and ALT HOLD engage A/T SPEED.
  s.modes.thrust="SPEED";
  s.autoThrustByPitch=true;
 }
}
// FCOM SHI 4.10.8-9 and 4.20.15: no N1 auto reduction via LVL CHG
// during the first 150 s after liftoff. State is never inferred from the
// speed selector or a fixed training engine N1 percentage.
function setLvlChgThrust(s){
 if(s.modes.vertical!=='LVL_CHG'||s.autoThrottleArm!==true)return;
 const measured=s.flight?.altitudeFt,selected=s.values.altitude;
 if(!Number.isFinite(measured)||!Number.isFinite(selected))return;
 const diff=selected-measured;
 const direction=diff>50?'CLIMB':diff< -50?'DESCENT':'LEVEL';
 if(direction!==s.lvlChgPhase){
  s.lvlChgPhase=direction;
  s.modes.thrust=direction==='DESCENT'?'RETARD':null;
 }
 if(direction==='CLIMB'){
  const elapsed=s.flight?.secondsSinceLiftoff;
  // Flight phase is necessarily known if elapsed is present. Outside a
  // documented just-takeoff interval only qualified phase may enable N1.
  if(Number.isFinite(elapsed)&&elapsed<150)s.modes.thrust=null;
  else if(s.flight?.establishedEnroute===true||
          Number.isFinite(elapsed)&&elapsed>=150)s.modes.thrust='N1';
 }else if(direction==='DESCENT'&&s.modes.thrust==='RETARD'&&
   s.flight?.thrustIdleConfirmed===true)s.modes.thrust='ARM';
}
function transition(state,action){
 if(!state||state.schema!=="B737_MCP_AFDS_V1")throw Error("AFDS state required");
 if(!action||typeof action.type!=="string")throw Error("AFDS action required");
 let s=clone(state);
 const done=()=>{s.lastRejection=null;s.revision++;return s;};
 if(action.type==="RESET")return initialState();
 if(action.type==='TOGA_ENGAGED'){
  if(action.confirmed!==true||action.source!=='SIMULATED_FCC')
   return rejected(s,'TOGA_REQUIRES_CONFIRMED_FCC');
  s.pending.approach=false;s.armed={pitch:null,roll:null};
  s.capture={pitch:null,roll:null};s.nav={loc:false,gs:false};
  s.modes.lateral=null;s.modes.vertical=null;
  const preserveDual=s.dualApproach.coupled&&action.dualApGA===true;
  if(!preserveDual)s.dualApproach.second=null;
  s.dualApproach.coupled=false;s.dualApproach.flareArmed=false;
  s.dualApproach.flareEngaged=false;s.dualApproach.retard=false;
  s.flightDirectorBarsRetracted=false;
  return done();
 }
 if(action.type==="FCC_ALTITUDE_CAPTURE"){
  if(action.confirmed!==true||action.source!=="SIMULATED_FCC"||
     !["ACQUIRE","HOLD"].includes(action.stage))
   return rejected(s,"UNVERIFIED_FCC_ALTITUDE_CAPTURE");
  if(s.electrical.mcpPower!==true||!/^CMD_[AB]$/.test(s.modes.autopilot||""))
   return rejected(s,"NO_POWERED_CMD_FOR_ALT_CAPTURE");
  if(action.stage==="ACQUIRE"){
   if(!["VS","LVL_CHG"].includes(s.modes.vertical))
    return rejected(s,"ALT_ACQ_REQUIRES_VS_OR_LEVEL_CHANGE");
   s.capture.pitch="ALT_ACQ";s.armed.pitch=null;
  }else{
   if(s.capture.pitch!=="ALT_ACQ")
    return rejected(s,"ALT_HOLD_REQUIRES_CONFIRMED_ACQ");
   s.capture.pitch="ALT_HOLD";s.modes.vertical="ALT_HLD";
   s.armed.pitch=null;s.override.pitch=false;
   if(s.autoThrottleArm){s.modes.thrust="SPEED";s.autoThrustByPitch=true;}
  }
  return done();
 }
 if(action.type==="AP_DISENGAGE_CONFIRMED"){
  if(!["COCKPIT_HARDWARE","SIMULATED_FCC"].includes(action.source)||
    action.confirmed!==true||!FCOM_AP_DISCONNECT_REASONS.includes(action.reason))
   return rejected(s,"UNVERIFIED_AP_DISCONNECT_EVENT");
  if(!s.modes.autopilot)return rejected(s,"AUTOPILOT_NOT_ENGAGED");
  s.lastAutopilotDisengagement={reason:action.reason,source:action.source};
  s.modes.autopilot=null;s.dualApproach={second:null,coupled:false,flareArmed:false,flareEngaged:false,retard:false};s.override={pitch:false,roll:false,altHold:false};
  s.targets={pitch:null,roll:null};
  // With both F/Ds OFF, an A/P disconnect leaves no guidance owner.
  if(!s.fd.left&&!s.fd.right)clearModes(s);
  // FCOM: switching the A/P off does NOT turn F/D select switches off;
  // command bars may stay visible with valid pitch+roll F/D modes.
  return done();
 }
 if(action.type==="ELECTRICAL"){
  const source=action.snapshot;
  if(!source||source.schema!=="B737_ELECTRICAL_V7_RESULT"||!source.bus)throw Error("Electrical V7 evaluated snapshot required");
  s.electrical.globalPowerPossible=globalPowerPossible(source.bus);
  s.electrical.rawRevision=source.revision;
  const trit=v=>v===true?true:v===false?false:null;
  s.electrical.dc1=trit(source.bus.dc1);
  // When electronic1 is explicitly UNKNOWN, preserve that uncertainty.
  s.electrical.electronic1=Object.hasOwn(source.bus,"electronic1")?
   trit(source.bus.electronic1):s.electrical.dc1;
  s.electrical.batteryBus=trit(source.bus.battery);
  s.electrical=projectPower(s);
  if(s.electrical.mcpPower!==true){
   if(s.modes.autopilot)s.lastAutopilotDisengagement={
    reason:"ELECTRICAL_POWER_LOST",source:"SIMULATED_FCC"};
   clearModes(s);
  }
  return done();
 }
 if(action.type==="SPEED_LIMIT_FCC"){
  // Only an explicitly observed, qualified simulator FCC may change AFDS.
  // Instructor/test-lab speed values cannot drive real/virtual flight modes.
  const f=action.sample;
  if(!SpeedLimit||f?.schema!=='B737_CH4_FCC_SPEED_LIMIT_SAMPLE_V1'||
    f.confirmed!==true||f.source!=='SIMULATED_FCC')
   return rejected(s,'QUALIFIED_CH4_FCC_SAMPLE_REQUIRED');
  if(s.electrical.mcpPower!==true)return rejected(s,'MCP_BUS_OR_CB_NOT_POWERED');
  const pitch=s.nav.gs?'G/S':
   s.capture.pitch==='ALT_HOLD'||s.modes.vertical==='ALT_HLD'?'ALT_HOLD':
   s.modes.vertical==='VNAV'?
     (['VNAV_PTH','VNAV_SPD'].includes(f.vnavPitchMode)?f.vnavPitchMode:null):
   s.modes.vertical;
  const frame={...f,type:'FCC_SPEED_LIMIT',confirmed:true,source:'SIMULATED_FCC',
   pitchMode:pitch,
   commandSource:s.modes.vertical==='VNAV'?'FMC':
     s.speedDisplayMode==='IAS'?'MCP':null,
   selectedMcpCasKt:s.speedDisplayMode==='IAS'?s.values.speed:null,
   atArmed:s.autoThrottleArm,
   atSpeedControl:s.modes.thrust==='SPEED'||f.fmcAtSpeedConfirmed===true,
   afdsEngaged:s.fd.left||s.fd.right||!!s.modes.autopilot,
   afdsSpeedControl:s.modes.vertical==='LVL_CHG'||f.afdsSpeedConfirmed===true,
   apEngaged:!!s.modes.autopilot,
   gsCaptured:s.nav.gs,
   cwsMode:s.modes.autopilot?.startsWith('CWS_')===true||
    s.override.pitch===true};
  try{s.speedLimit=SpeedLimit.transition(s.speedLimit||SpeedLimit.initialState(),frame);}
  catch(error){return rejected(s,'INVALID_CH4_FCC_'+String(error.message||error));}
  const result=SpeedLimit.view(s.speedLimit);
  if(result.reversion==='LVL_CHG_MINIMUM'||result.reversion==='LVL_CHG_PERFORMANCE'||
   result.reversion==='LVL_CHG_VMO'){
   // Chapter 4's explicit mode transition; not a synthetic aircraft servo.
   s.modes.vertical='LVL_CHG';s.capture.pitch=null;s.override.pitch=false;
   s.targets.pitch=null;s.armed.pitch=null;
   s.modes.thrust=null;s.autoThrustByPitch=false;
  }else if(result.reversion==='AT_SPEED_PLACARD'&&s.autoThrottleArm){
   s.modes.thrust='SPEED';s.autoThrustByPitch=false;
  }else if(result.reversion==='AP_DISENGAGE_FD_RETRACT'){
   // FD SELECT switches remain ON; command bars retract independently.
   s.modes.autopilot=null;s.flightDirectorBarsRetracted=true;
  }
  // AFDS_VMO_SPEED_CONTROL is an evidence-gated demand, not a named
  // selector change: the FCOM does not specify which button illuminates.
  return done();
 }
 if(action.type==="OBSERVE_POWER"){
  // Backward-compatible rejection for old training clients; no power mutation.
  return rejected(s,"MCP_POWER_OWNED_BY_ELECTRICAL_V7");
 }
 if(action.type==="EFIS_SOURCE_TRANSFER"){
  // FCOM 4.20: repositioning EFI transfer disengages the autopilot.
  if(!s.modes.autopilot)return state;
  s.lastAutopilotDisengagement={reason:"EFI_TRANSFER_REPOSITIONED",source:"COCKPIT_HARDWARE"};
  s.modes.autopilot=null;s.override.pitch=false;s.override.roll=false;
  s.targets.pitch=null;s.targets.roll=null;
  return done();
 }
 if(action.type==="EVIDENCE"){
  if(!["fmcRouteReady","approachCapture"].includes(action.key)||![true,false,null].includes(action.value))throw Error("Unrecognized AFDS evidence");
  s.evidence[action.key]=action.value;
  if(action.key==="fmcRouteReady"&&action.value!==true){
   if(s.modes.lateral==="LNAV")s.modes.lateral=null;
   if(s.modes.vertical==="VNAV")s.modes.vertical=null;
  }
  if(action.key==="approachCapture"&&action.value!==true)s.pending.approach=false;
  return done();
 }
 if(action.type==="FLIGHT_OBSERVATION"){
  // Qualified simulated FCC/flight-model telemetry; never invent yoke force
  // thresholds, radio-course intercepts, or ALT ACQ distance.
  const f=action.sample;
  if(!f||f.schema!=="B737_AFDS_FLIGHT_OBSERVATION_V1"||
   f.confirmed!==true||f.source!=="SIMULATED_FCC")
   return rejected(s,"QUALIFIED_FLIGHT_SAMPLE_REQUIRED");
  if(s.electrical.mcpPower!==true)return rejected(s,"MCP_BUS_OR_CB_NOT_POWERED");
  for(const k of ["bankDeg","headingDeg","pitchDeg","altitudeFt",
   "radioAltitudeFt","tasKt","gsBelowDots","verticalSpeedFpm"])
   if(f[k]!==undefined&&!Number.isFinite(f[k]))
    return rejected(s,"INVALID_FLIGHT_SENSOR_"+k);
  for(const k of ['locDeviationDots','gsDeviationDots'])
   if(f[k]!==undefined&&f[k]!==null&&!Number.isFinite(f[k]))
    return rejected(s,'INVALID_NAV_DEVIATION_'+k);
  if(f.navKind!==undefined&&!["NONE","VOR","LOC","ILS"].includes(f.navKind))
   return rejected(s,"INVALID_NAV_SIGNAL_TYPE");
  for(const k of ['secondsSinceLiftoff'])if(f[k]!==undefined&&f[k]!==null&&
   (!Number.isFinite(f[k])||f[k]<0))return rejected(s,'INVALID_FLIGHT_TIMER_'+k);
  const flags=["establishedEnroute","thrustIdleConfirmed","navValid","gearDown","fdVorCaptured","fdLocCaptured",
   "pitchOverrideConfirmed","rollOverrideConfirmed","pitchForceReleased",
   "rollForceReleased","altAcquireConfirmed","altitudeHoldConfirmed",
   "navCaptureConfirmed","gsCaptureConfirmed","dualAutopilot","dualIlsValid",
   "controlWheelForceApplied","stabTrimAutopilotNormal","apDisengageBarUp"];
  if(flags.some(k=>f[k]!==undefined&&typeof f[k]!=="boolean"))
   return rejected(s,"INVALID_FLIGHT_SENSOR_FLAG");
  // An explicit lost/retuned front course invalidates captured navigation.
  if(f.navValid===false&&(s.nav.loc||s.nav.gs||s.armed.roll==='VOR/LOC')){
   const wasCoupled=s.dualApproach.coupled;
   s.nav={loc:false,gs:false};s.capture.roll=null;
   if(['G/S','FLARE'].includes(s.capture.pitch))s.capture.pitch=null;
   if(s.modes.lateral==='VOR_LOC')s.modes.lateral=null;
   if(s.pending.approach)s.armed.pitch='G/S';
   s.armed.roll=s.pending.approach?'VOR/LOC':null;
   s.dualApproach.coupled=false;s.dualApproach.flareArmed=false;
   s.dualApproach.flareEngaged=false;s.dualApproach.retard=false;
   if(wasCoupled){
    s.lastAutopilotDisengagement={reason:'CRITICAL_SENSOR_INPUT_LOST',source:'SIMULATED_FCC'};
    s.modes.autopilot=null;s.dualApproach.second=null;
    s.flightDirectorBarsRetracted=true;
   }
  }
  s.flight={...(s.flight||{}),...f};
  if(s.modes.vertical==='LVL_CHG')setLvlChgThrust(s);
  const cmd=/^CMD_[AB]$/.test(s.modes.autopilot||"");
  if(cmd&&f.dualAutopilot===true&&s.nav.loc&&s.nav.gs&&
   (f.pitchOverrideConfirmed||f.rollOverrideConfirmed)){
   // FCOM 4.10.16: override after dual-channel LOC + GS capture
   // disengages the A/P, not a CWS axis.
   s.modes.autopilot=null;s.override.pitch=false;s.override.roll=false;
   s.targets.pitch=null;s.targets.roll=null;return done();
  }
  if(cmd&&f.pitchOverrideConfirmed===true){
   if(!s.override.pitch)s.override.altHold=
    s.modes.vertical==="ALT_HLD"||s.capture.pitch==="ALT_HOLD";
   s.override.pitch=true;s.capture.pitch=null;s.targets.pitch=null;
  }
  if(cmd&&f.rollOverrideConfirmed===true){
   s.override.roll=true;s.capture.roll=null;s.targets.roll=null;
  }
  if(cmd&&f.pitchForceReleased===true&&s.override.pitch&&
   s.override.altHold&&Number.isFinite(f.altitudeFt)&&
   Math.abs(f.altitudeFt-s.values.altitude)>250)
   s.override.altHold=false; // CWS stays latched after release beyond 250 ft.
  if(cmd&&f.pitchForceReleased===true&&s.override.pitch&&
   s.override.altHold&&Number.isFinite(f.altitudeFt)&&
   Math.abs(f.altitudeFt-s.values.altitude)<=250){
   s.override.pitch=false;s.override.altHold=false;
   s.capture.pitch="ALT_ACQ";s.targets.pitch=null;
  }
  if(cmd&&f.altAcquireConfirmed===true&&
   axisControl(s,true).pitch==="CWS"&&!s.nav.gs){
   s.capture.pitch="ALT_ACQ";s.override.pitch=false;
   s.override.altHold=false;s.targets.pitch=null;
  }
  if(cmd&&f.altitudeHoldConfirmed===true&&s.capture.pitch==="ALT_ACQ"){
   s.capture.pitch="ALT_HOLD";s.modes.vertical="ALT_HLD";
   s.override.pitch=false;s.targets.pitch=null;s.armed.pitch=null;
  }
  const director=s.fd.left||s.fd.right||cmd;
  if(director&&s.armed.roll==="VOR/LOC"&&f.navCaptureConfirmed===true&&
   s.flight.navValid===true&&["VOR","LOC","ILS"].includes(s.flight.navKind)){
   s.capture.roll="VOR_LOC";s.modes.lateral="VOR_LOC";s.armed.roll=null;
   s.override.roll=false;s.targets.roll=null;
   if(["LOC","ILS"].includes(s.flight.navKind))s.nav.loc=true;
  }
  // FCOM 4.20.21 allows 2/5-dot capture from either side; 4.10.16
  // specifies below. The signed valid receiver sample is effectivity-gated
  // when exact airframe configuration is confirmed.
  const gsDelta=Number.isFinite(f.gsDeviationDots)?Math.abs(f.gsDeviationDots):
   Number.isFinite(f.gsBelowDots)?f.gsBelowDots:null;
  if(director&&s.pending.approach&&s.nav.loc&&s.armed.pitch==="G/S"&&
   f.gsCaptureConfirmed===true&&Number.isFinite(gsDelta)&&gsDelta<=.4){
   s.capture.pitch="G/S";s.modes.vertical=null;s.nav.gs=true;
   s.armed.pitch=null;s.override.pitch=false;s.targets.pitch=null;
   if(s.autoThrottleArm){s.modes.thrust="SPEED";s.autoThrustByPitch=true;}
  }
  // FCOM 4.20.21/22: second CMD must be selected above 800 ft RA,
  // then two-channel FLARE can arm after LOC+GS below 1500 ft RA.
  const ra=f.radioAltitudeFt;
  if(cmd&&s.dualApproach.second&&s.nav.loc&&s.nav.gs&&
      f.dualIlsValid===true&&Number.isFinite(ra)&&ra<1500){
   s.dualApproach.coupled=true;s.dualApproach.flareArmed=true;
  }
  if(s.dualApproach.coupled&&s.dualApproach.flareArmed&&
      Number.isFinite(ra)&&ra<=50&&s.nav.loc&&s.nav.gs){
   s.dualApproach.flareEngaged=true;s.capture.pitch='FLARE';
  }
  if(s.dualApproach.flareEngaged&&Number.isFinite(ra)&&ra<=27&&
      s.autoThrottleArm){
   s.dualApproach.retard=true;s.modes.thrust='RETARD';s.autoThrustByPitch=false;
  }
  if(axisControl(s,true).roll==="CWS"&&f.rollForceReleased===true&&
   Number.isFinite(f.bankDeg)&&Number.isFinite(f.headingDeg)){
   const inhibited=(Number.isFinite(f.radioAltitudeFt)&&
      f.radioAltitudeFt<1500&&f.gearDown===true)||
     (f.fdVorCaptured===true&&Number.isFinite(f.tasKt)&&f.tasKt<=250)||
     (f.fdLocCaptured===true&&s.pending.approach);
   s.targets.roll=Math.abs(f.bankDeg)<=6&&!inhibited?
    {type:"WINGS_LEVEL_HEADING_HOLD",bankDeg:0,headingDeg:f.headingDeg}:
    {type:"BANK_ATTITUDE_HOLD",bankDeg:f.bankDeg};
  }
  if(axisControl(s,true).pitch==="CWS"&&f.pitchForceReleased===true&&
   Number.isFinite(f.pitchDeg))
   s.targets.pitch={type:"PITCH_ATTITUDE_HOLD",pitchDeg:f.pitchDeg};
  return done();
 }
 if(action.type==="FD"){
  if(!["left","right"].includes(action.side)||typeof action.on!=="boolean")throw Error("Invalid FD position");
  s.fd[action.side]=action.on;
  // FCOM 4.10.19: both F/D OFF retract command bars, but an already
  // engaged A/P keeps flying its selected modes. Never clear an active AP.
  if(!s.fd.left&&!s.fd.right&&!s.modes.autopilot)clearModes(s);
  if(action.on)s.flightDirectorBarsRetracted=false;
  return done();
 }
 if(action.type==="BANK_ANGLE"){
  // FCOM Ch4, 4.10.15: outer bank angle selector detents 10/15/20/25/30.
  // Mechanical preselection can move with electrical power OFF.
  if(!Number.isInteger(action.value)||![10,15,20,25,30].includes(action.value))
   throw Error("FCOM Chapter 4 bank angle selector detent must be 10/15/20/25/30");
  s.bankAngleLimit=action.value;return done();
 }
 if(action.type==="AT_ARM"){
  if(typeof action.armed!=="boolean")throw Error("Invalid A/T switch");
  s.autoThrottleArm=action.armed;
  if(!action.armed){s.modes.thrust=null;s.autoThrustByPitch=false;}
  else if(autoSpeedPitch(s.modes.vertical)){
   s.modes.thrust="SPEED";s.autoThrustByPitch=true;
  }
  return done();
 }
 if(s.electrical.mcpPower!==true)return rejected(s,"MCP_BUS_OR_CB_NOT_POWERED");
 if(action.type==="SPEED_MODE"){
  if(!["IAS","MACH"].includes(action.mode))throw Error("Unknown IAS/MACH display mode");
  if(s.modes.vertical==="VNAV")return rejected(s,"IAS_MACH_DISPLAY_BLANK");
  s.speedDisplayMode=action.mode;return done();
 }
 if(action.type==="VALUE"){
  const id=action.id,v=action.value;
  if(!Rules?.valid||!Rules.valid(id,v))throw Error("MCP value out of FCOM Chapter 4 range or increment");
  const old=s.values[id];s.values[id]=v;
  if(id==='altitude'&&s.modes.vertical==='LVL_CHG')setLvlChgThrust(s);
  if(id==="altitude"&&s.capture.pitch==="ALT_ACQ"&&v!==old){
   // Any real MCP ALT detent during ALT ACQ cancels capture. Resume V/S
   // at the OBSERVED instantaneous rate, not the pre-capture selected rate.
   // MCP display is quantized to its existing 50-fpm selector increments;
   // the plant retains its continuous present vertical speed.
   s.capture.pitch=null;s.modes.vertical="VS";s.override.pitch=false;
   s.armed.pitch=null;s.targets.pitch=null;
   if(Number.isFinite(s.flight?.verticalSpeedFpm)){
    const observedVS=Math.max(-5000,Math.min(5000,s.flight.verticalSpeedFpm));
    s.values.verticalSpeed=Rules?.normalize?.('verticalSpeed',observedVS)??
     Math.round(observedVS/100)*100;
   }
  }else if(id==="altitude"&&s.modes.vertical==="ALT_HLD"&&
   Number.isFinite(s.flight?.altitudeFt)&&
   Math.abs(v-s.flight.altitudeFt)>100&&s.capture.pitch!=="ALT_ACQ"){
   // FCOM 4.10.10/11: arming is relative to present aircraft altitude,
   // not the previous MCP selector value. No unverified altitude assumption.
   s.armed.pitch="V/S";
  }
  return done();
 }
 if(action.type!=="BUTTON"||!buttons.includes(action.id))throw Error("Unrecognized MCP mode command");
 const id=action.id;
 if(id==="APP"){
  if(s.flight?.navKind!=="ILS"||s.flight.navValid!==true)
   return rejected(s,"APP_ILS_NAV_EVIDENCE_REQUIRED");
  s.pending.approach=!s.pending.approach;
  s.armed.roll=s.pending.approach?"VOR/LOC":null;
  s.armed.pitch=s.pending.approach?"G/S":null;
  if(!s.pending.approach){s.nav.loc=false;s.nav.gs=false;
   s.dualApproach={second:null,coupled:false,flareArmed:false,flareEngaged:false,retard:false};}
  return done();
 }
 if(id==="LNAV"||id==="VNAV"){
  if(s.evidence.fmcRouteReady!==true)return rejected(s,"FMC_ROUTE_EVIDENCE_REQUIRED");
 }
 if(id==="VOR_LOC"){
  if(s.flight?.navValid!==true||!["VOR","LOC","ILS"].includes(s.flight.navKind))
   return rejected(s,"VOR_LOC_NAV_EVIDENCE_REQUIRED");
  s.armed.roll=s.armed.roll==="VOR/LOC"?null:"VOR/LOC";
  s.pending.approach=false;s.armed.pitch=null;s.nav.loc=false;s.nav.gs=false;
  s.dualApproach={second:null,coupled:false,flareArmed:false,flareEngaged:false,retard:false};
  return done();
 }
 if(id.startsWith("CMD_")||id.startsWith("CWS_")){
  // FCOM SHI 4.10.19/4.20.2 permits CMD/CWS with both F/Ds OFF.
  // Neither F/D switch is an autopilot engagement interlock.
  // Engagement depends on control-wheel force, trim cutout and A/P bar.
  // FCOM SHI 4.20.2: known A/P engagement inhibits, never inferred from
  // absent/unverified evidence or from F/D switch state alone.
  if(s.flight?.controlWheelForceApplied===true)
   return rejected(s,"AP_ENGAGEMENT_INHIBITED_WHEEL_FORCE");
  if(s.flight?.stabTrimAutopilotNormal===false)
   return rejected(s,"AP_ENGAGEMENT_INHIBITED_STAB_TRIM_CUTOUT");
  if(s.flight?.apDisengageBarUp===false)
   return rejected(s,"AP_ENGAGEMENT_INHIBITED_DISENGAGE_BAR");
  const selected=s.modes.autopilot;
  if(id.startsWith('CMD_')&&selected?.startsWith('CMD_')&&id!==selected&&s.pending.approach){
   if(Number.isFinite(s.flight?.radioAltitudeFt)&&s.flight.radioAltitudeFt<800)
    return rejected(s,'DUAL_AP_SELECTION_INHIBITED_BELOW_800_RA');
   if(s.flight?.dualIlsValid!==true)
    return rejected(s,'DUAL_AP_REQUIRES_MATCHING_NAV1_NAV2_ILS');
   s.dualApproach.second=s.dualApproach.second===id?null:id;
   if(!s.dualApproach.second){
    s.dualApproach.coupled=false;s.dualApproach.flareArmed=false;
    s.dualApproach.flareEngaged=false;s.dualApproach.retard=false;
   }
   return done();
  }
  if(s.dualApproach.second===id){
   s.dualApproach.second=null;s.dualApproach.coupled=false;
   s.dualApproach.flareArmed=false;s.dualApproach.flareEngaged=false;
   s.dualApproach.retard=false;return done();
  }
  s.modes.autopilot=selected===id?null:id;
  s.dualApproach={second:null,coupled:false,flareArmed:false,flareEngaged:false,retard:false};
  if(selected===id)s.lastAutopilotDisengagement={
   reason:"ILLUMINATED_AP_ENGAGE_SWITCH",source:"COCKPIT_HARDWARE"};
  else s.lastAutopilotDisengagement=null;
  s.override={pitch:false,roll:false,altHold:false};
  s.targets={pitch:null,roll:null};
  if(selected===id&&!s.fd.left&&!s.fd.right)clearModes(s);
  return done();
 }
 if(!s.fd.left&&!s.fd.right&&!s.modes.autopilot)
  return rejected(s,"FLIGHT_DIRECTOR_NOT_SELECTED");
 if(thrust.includes(id)){
  if(!s.autoThrottleArm)return rejected(s,"AUTOTHROTTLE_NOT_ARMED");
  // A/T SPEED is incompatible with LVL CHG's pitch-owned speed
  // hold, and N1 is incompatible with V/S/ALT HOLD A/T speed hold.
  if(id==="SPEED"&&s.modes.vertical==="LVL_CHG")
   return rejected(s,"AT_SPEED_INCOMPATIBLE_WITH_LVL_CHG");
  if(id==="N1"&&autoSpeedPitch(s.modes.vertical))
   return rejected(s,"AT_N1_INCOMPATIBLE_WITH_PITCH_SPEED_HOLD");
  const was=s.modes.thrust;
  s.modes.thrust=was===id?null:id;
  s.autoThrustByPitch=false;
  return done();
 }
 if(lateral.includes(id)){
  // A new lateral selector replaces the former one, without requiring
  // a separate disengage click and without a second active roll lamp.
  s.modes.lateral=s.modes.lateral===id?null:id;
  s.capture.roll=null;s.override.roll=false;s.targets.roll=null;
  if(!s.pending.approach)s.armed.roll=null;
  return done();
 }
 if(vertical.includes(id)){
  // FCOM 4.10.9–11: ALT HOLD, LVL CHG and V/S are inhibited
  // following G/S capture in APP.
  if(s.nav.gs&&["ALT_HLD","LVL_CHG","VS"].includes(id))
   return rejected(s,"PITCH_MODE_INHIBITED_AFTER_GS_CAPTURE");
  selectPitch(s,id);return done();
 }
 return rejected(s,"NOT_SUPPORTED");
}
// Training-state autopilot axis engagement, sourced from the selected
// pitch/roll CMD modes. FCOM 4.10.18 and 4.20.9–10: the CMD autopilot
// falls back to CWS on either axis when that axis has no selected mode.
// This does not simulate yoke forces, aerodynamic servos or ALT/LOC capture.
function axisControl(s,powered){
 const ap=powered&&typeof s.modes.autopilot==="string"?s.modes.autopilot:"";
 const engaged=/^(?:CMD|CWS)_[AB]$/.test(ap);
 if(!engaged)return {pitch:"OFF",roll:"OFF"};
 const manual=ap.startsWith("CWS_");
 return {pitch:manual||s.override.pitch||
   (!s.capture.pitch&&s.modes.vertical===null)?"CWS":"CMD",
  roll:manual||s.override.roll||
   (!s.capture.roll&&s.modes.lateral===null)?"CWS":"CMD"};
}
function output(s){
 const powered=s.electrical.mcpPower===true;
 const lampIds=["AT_ARM","VNAV","LNAV","VOR_LOC","N1","SPEED","LVL_CHG","HDG_SEL","APP","ALT_HLD","VS","CMD_A","CWS_A","CMD_B","CWS_B"];
 const lamps=Object.fromEntries(lampIds.map(x=>[x,false]));
 if(powered){
  lamps.AT_ARM=s.autoThrottleArm;
  for(const x of [...lateral,...vertical,...thrust])if(lamps[x]!==undefined)lamps[x]=s.modes[x==="N1"||x==="SPEED"?"thrust":lateral.includes(x)?"lateral":"vertical"]===x;
  for(const x of ["CMD_A","CMD_B","CWS_A","CWS_B"])lamps[x]=s.modes.autopilot===x;
  if(s.dualApproach.second==='CMD_A')lamps.CMD_A=true;
  if(s.dualApproach.second==='CMD_B')lamps.CMD_B=true;
  // APP indication never claims a capture without evidence.
  // FCOM 4.10.16: APP illuminates when armed, not only after capture.
  // Extinguish it after both localizer and glideslope have captured.
  lamps.APP=s.pending.approach&&!(s.nav.loc&&s.nav.gs);
  // FCOM 4.10.14: VOR/LOC pushbutton illuminates while armed,
  // independently of the green VOR/LOC roll capture annunciation.
  lamps.VOR_LOC=lamps.VOR_LOC||(s.armed.roll==="VOR/LOC"&&!s.pending.approach);
 }
 return {schema:"B737_MCP_AFDS_OUTPUT_V1",power:s.electrical.mcpPower,course2Power:s.electrical.course2Power,powerEvidence:s.electrical.feed,
  electricalRevision:s.electrical.rawRevision,feedStatus:{electronic1:s.electrical.electronic1,dc1:s.electrical.dc1,batteryBus:s.electrical.batteryBus},lamps,values:{...s.values},
   speedDisplayMode:s.speedDisplayMode,bankAngleLimit:s.bankAngleLimit,displayBlank:{speed:s.modes.vertical==="VNAV",verticalSpeed:s.modes.vertical!=="VS"},
   controls:{fd:{...s.fd},atArm:s.autoThrottleArm},
  speedLimit:SpeedLimit?.view(s.speedLimit)??null,
  flightDirectorBarsRetracted:s.flightDirectorBarsRetracted,
  lastAutopilotDisengagement:s.lastAutopilotDisengagement?{...s.lastAutopilotDisengagement}:null,
  modes:{...s.modes},dualApproach:{...s.dualApproach},lvlChgPhase:s.lvlChgPhase,axisControl:axisControl(s,powered),
  armed:{...s.armed},capture:{...s.capture},nav:{...s.nav},
  flight:s.flight?{...s.flight}:null,
  axisDemand:{pitch:s.targets.pitch,roll:s.targets.roll},
  pending:{...s.pending},rejection:s.lastRejection,
  limitations:["TRAINING_ONLY_NO_FLIGHT_DYNAMICS","MCP_ELEX1_28VDC_AND_COURSE2_BAT_BUS_MRG_TRAINING_MAPPING_NOT_EPFSI_WDM_VERIFIED","NO_AUTOLAND_SERVO_DYNAMICS","AUTO_IAS_MACH_CROSSOVER_AT_FL260_REQUIRES_VALID_FLIGHT_ALTITUDE"]};
}
return Object.freeze({STATES,MODE_OWNERS,autoSpeedPitch,axisControl,initialState,globalPowerPossible,transition,output});
});
}catch(error){queueMicrotask(()=>{throw error});}
;await 0;
;
/* ./mcp-afds-bridge-v1.js?v=MCP-TOGA-CH4-0003&amp;cb=CB-UNIFIED-0008 */
try{
/* MCP Phase 3 / slice 1: real Electrical V7 evidence -> conservative AFDS
 * educational mode core -> visual/hardware projection. No invented LRU feed.
 */
(function(){
"use strict";
const Core=window.B737McpModeCoreV1;
if(!Core)throw Error("B737McpModeCoreV1 missing");
let state=Core.initialState(),lastElectrical="",visualTest=false,ready=false;
let status=null,modeReadout=null;
const own=(o,k)=>o&&Object.prototype.hasOwnProperty.call(o,k);
function notify(){window.dispatchEvent(new CustomEvent("b737:mcp-afds-state",{detail:Core.output(state)}));}
function send(action){
 state=Core.transition(state,action);
 project();notify();return Core.output(state);
}
/* One authoritative ATA24 V7 evaluation, only when the distribution / CB
 * actually changes. Never rely on a button in Controls or on recurrent
 * 100-ms engine-indication events to energize MCP numeric glass. */
function electrical(){
 const provider=window.B737ISNCockpitV1;
 if(!provider)return;
 let observed=null;
 try{
  const raw=provider.getElectricalState?.();
  if(raw&&window.B737ElectricalV7?.evaluate)
   observed=window.B737ElectricalV7.evaluate(raw);
 }catch(error){console.warn("MCP live bus snapshot",error);}
 if(observed?.schema!=="B737_ELECTRICAL_V7_RESULT")
  observed=provider.getState?.()?.state?.electrical;
 if(observed?.schema!=="B737_ELECTRICAL_V7_RESULT"||!observed.bus)return;
 // Use the existing ATA24 MRG bus-class projection, which includes injected
 // ELECTRONIC 1 28VDC failures. Electrical V7 dc1 is only its upstream proxy.
 const facade=window.B737UnifiedBusConsumerLiveV1;
 const elex1=facade?.getBus?.("electronic1","28VDC");
 const battery=facade?.getBus?.("battery","28VDC");
 const bit=(v)=>v===true?true:v===false?false:null;
 const bus={...observed.bus,electronic1:elex1?bit(elex1.powered):bit(observed.bus.dc1),
  battery:battery?bit(battery.powered):bit(observed.bus.battery)};
 const mainCB=window.B737UnifiedCB?.available?.("mcp.power");
 const courseCB=window.B737UnifiedCB?.available?.("mcp.course2");
 const fingerprint=JSON.stringify([bus,mainCB,courseCB]);
 if(fingerprint===lastElectrical)return;
 lastElectrical=fingerprint;
 send({type:"ELECTRICAL",snapshot:{...observed,bus}});
}
for(const name of ["b737:cb-state-change","b737:electrical-distribution-changed",
 "b737:electrical-v7-state","b737:electrical-owner-ready",
 "b737:bus-failure-injection-changed","b737:bus-consumer-snapshot"])
 window.addEventListener(name,electrical);
function statusLabel(out){
 const crs2=out.course2Power===true?"COURSE 2 ON":out.course2Power===false?"COURSE 2 OFF":"COURSE 2 UNKNOWN";
 if(out.power===false)return "MCP OFF · ELEX 1 28V DC or CB open · "+crs2;
 if(out.power===null)return "MCP POWER UNKNOWN · ELEX 1 feed not established · "+crs2;
 return "MCP ON · ELECTRONIC BUS 1 28V DC / MCP CB · "+crs2;
}
function project(){
 const out=Core.output(state);
 const visual=window.B737McpVisualV3,hardware=window.B737McpHardwareV1;
 if(visual){
  visual.setPower?.(out.power);
  visual.setCourse2Power?.(out.course2Power);
  visual.setSpeedMode?.(out.speedDisplayMode);
  if(!visualTest)visual.setLamps?.(out.lamps);
  for(const [id,v] of Object.entries(out.values)){
   if(visual.getState()?.[id]!==v)visual.setValue(id,v);
  }
 }
 if(hardware){
  const current=hardware.getState();
  for(const [id,value]of [
   ["AT_ARM",out.controls.atArm?"ARM":"OFF"],
   ["FD_LEFT",out.controls.fd.left?"ON":"OFF"],
   ["FD_RIGHT",out.controls.fd.right?"ON":"OFF"],
   ["VS_WHEEL",out.values.verticalSpeed]
  ])if(current[id]!==value)hardware.setState(id,value);
 }
 if(status)status.textContent=statusLabel(out);
 const circuit=document.querySelector(".mcp-afds-circuit-status");
 if(circuit){
  const cb=window.B737UnifiedCB;
  const label=v=>v===true?"ON":v===false?"OFF":"UNKNOWN";
  const cbText=v=>v===true?"CLOSED":v===false?"OPEN":"UNKNOWN";
  const f=out.feedStatus||{};
  const state=window.B737ISNCockpitV1?.getElectricalState?.();
  const apu=state?.config?.apuRunning===true;
  const apuOnBus=Object.values(state?.source||{}).includes("APU");
  const guide=out.power===false?
   (!state?"Electrical owner not initialized":
    apu&&!apuOnBus?"APU running but not connected to generator bus: select APU GEN ON":
    !apuOnBus&&!Object.values(state.source||{}).some(v=>v==="GEN1"||v==="GEN2"||v==="EXT")?
    "No AC source on distribution: connect GPU/APU GEN/engine GEN to a bus":
    f.electronic1===false?"ELEX 1 supply or its upstream source is OFF":"Check MCP circuit breaker"):"";
  circuit.textContent="ELEX1 28V: "+label(f.electronic1)+" · DC1 upstream: "+label(f.dc1)+
   " · MCP CB: "+cbText(cb?.available?.("mcp.power"))+
   "\nCOURSE2 BAT BUS: "+label(f.batteryBus)+
   " · CB: "+cbText(cb?.available?.("mcp.course2"))+(guide?"\nNEXT: "+guide:"");
 }
 if(modeReadout){
  const m=out.modes;
  modeReadout.textContent="LAT "+(m.lateral||"—")+" · VERT "+(m.vertical||"—")+" · A/T "+(m.thrust||"—")+" · A/P "+(m.autopilot||"—")+
   (out.rejection?" | BLOCKED: "+out.rejection:"");
 }
}
function hardwareCommand(e){
 const d=e.detail;if(!d||d.method==="external")return;
 const map={FD_LEFT:{type:"FD",side:"left",on:d.value==="ON"},FD_RIGHT:{type:"FD",side:"right",on:d.value==="ON"},
 AT_ARM:{type:"AT_ARM",armed:d.value==="ARM"}};
 if(own(map,d.id))send(map[d.id]);
 else if(d.id==="VS_WHEEL")send({type:"VALUE",id:"verticalSpeed",value:d.value});
 else if(d.id==="CO"){
  // FCOM 4.10.3: C/O is an IAS/MACH push button, not a latched mode.
  // Restore the spring-return push visually; AFDS owns the display mode.
  if(d.value===true)send({type:"SPEED_MODE",
   mode:Core.output(state).speedDisplayMode==="MACH"?"IAS":"MACH"});
  if(window.B737McpHardwareV1?.getState()?.CO===true)
   window.B737McpHardwareV1.setState("CO",false);
 }
 else if(["SPD_INTV","ALT_INTV"].includes(d.id)){
  if(window.B737McpHardwareV1?.getState()?.[d.id]===true)
   window.B737McpHardwareV1.setState(d.id,false);
  state.lastRejection=d.id+"_LOGIC_NOT_VALIDATED";
  project();notify();
 }
}
function requestMode(id){
 if(!id)return;
 // The source-grounded TO/GA FCC controls pitch until 400 ft RA, not an
 // unrelated MCP pushbutton. Also inhibit a new single A/P engagement below
 // the takeoff/go-around floor. A dual A/P already engaged for FLARE is
 // handled by the TO/GA FCC logic and is not a new MCP button selection.
 const t=window.B737UnifiedTOGACh4V1?.getState?.();
 const f=window.B737UnifiedFlightScenarioV1?.getState?.();
 if((t?.phase==='TO'||t?.phase==='GA')&&f?.airborne===true&&
    Number.isFinite(f.radioAltitudeFt)&&f.radioAltitudeFt<400){
  const lockedPitch=['VNAV','LVL_CHG','VS','ALT_HLD'].includes(id);
  const lockedAp=/^(?:CMD|CWS)_[AB]$/.test(id);
  if(lockedPitch||lockedAp){
   state={...state,lastRejection:lockedPitch?'TOGA_PITCH_PROTECTED_BELOW_400_RA':
    'NEW_AP_ENGAGEMENT_INHIBITED_BELOW_400_RA',revision:state.revision+1};
   project();notify();return Core.output(state);
  }
 }
 // FCOM 4.20.16: engaging CMD after the FD-only takeoff at >=400ft
 // terminates TO/GA; pitch automatically becomes LVL CHG / MCP SPD,
 // with HDG SEL roll retained unless the crew has selected another mode.
 if((t?.phase==='TO'||t?.phase==='GA')&&/^CMD_[AB]$/.test(id)&&f?.airborne===true&&
    Number.isFinite(f.radioAltitudeFt)&&f.radioAltitudeFt>=400){
  state=Core.transition(state,{type:'BUTTON',id});
  if(state.modes.autopilot===id){
   if(state.modes.vertical!=='LVL_CHG')
    state=Core.transition(state,{type:'BUTTON',id:'LVL_CHG'});
   if(!state.modes.lateral)state=Core.transition(state,{type:'BUTTON',id:'HDG_SEL'});
  }
  project();notify();return Core.output(state);
 }
 return send({type:"BUTTON",id});
}
function visualRequest(e){
 const id=e.detail?.id;
 if(!id)return;
 if(id==="AT_ARM")return; // handled exclusively by physical ARM toggle
 requestMode(id);
}
function visualValue(e){
 const d=e.detail;
 if(!d||d.method==="external"||!d.control)return;
 send({type:"VALUE",id:d.control,value:d.value});
}
function decorate(){
 if(ready)return;
 const target=document.querySelector("#inspector")||document.querySelector("header")||document.body;
 if(!target)return;
 ready=true;
 const section=document.createElement("section");section.className="mcp-afds-control";section.setAttribute("aria-label","MCP AFDS training power evidence");
 const heading=document.createElement("strong");heading.textContent="MCP · AFDS PHASE 3";
 status=document.createElement("p");status.className="mcp-afds-power-status";status.setAttribute("role","status");
  modeReadout=document.createElement("p");modeReadout.className="mcp-afds-mode-status";
 const note=document.createElement("small");
 note.textContent="MRG CL p.186: MCP Electronic Bus 1 · 28V DC / P18-1 D1. COURSE 2: Battery Bus · 28V DC / dedicated CB. Trainer bus mapping; EP-FSI WDM not verified.";
 const circuit=document.createElement("p");
 circuit.className="mcp-afds-circuit-status";
 circuit.setAttribute("role","status");
 section.append(heading,status,circuit,modeReadout,note);
 target.prepend(section);
 project();
}
window.addEventListener("b737:cockpit-mounted",()=>{decorate();project();electrical()});
 window.addEventListener("b737:mcp-hardware-change",hardwareCommand);
window.addEventListener("b737:mcp-button-request",visualRequest);
 window.addEventListener('b737:efis-transfer-ap-disconnect',()=>{
  if(state.modes.autopilot)send({type:'EFIS_SOURCE_TRANSFER'});
 });
window.addEventListener("b737:mcp-value-change",visualValue);
 // Flight-model observations update the *same* AFDS state as MCP commands.
 // Event-driven only; unconfirmed telemetry cannot drive a false capture.
 window.addEventListener("b737:afds-flight-observation",e=>{
  if(e.detail?.schema==="B737_AFDS_FLIGHT_OBSERVATION_V1")
   send({type:"FLIGHT_OBSERVATION",sample:e.detail});
 });
window.addEventListener('b737:speed-limit-fcc',event=>{
 const d=event.detail;
 if(d?.schema!=='B737_CH4_FCC_SPEED_LIMIT_SAMPLE_V1'||d.confirmed!==true||
    d.source!=='SIMULATED_FCC')return;
 try{send({type:'SPEED_LIMIT_FCC',sample:d});}
 catch(error){console.warn('CH4 qualified speed-limit rejection',error);}
});
window.addEventListener("b737:mcp-bank-limit-preview",e=>{
 const deg=e.detail?.angle;
 if([10,15,20,25,30].includes(deg)&&Core.output(state).bankAngleLimit!==deg)
  send({type:"BANK_ANGLE",value:deg});
});
window.addEventListener("b737:visual-test",e=>{visualTest=!!e.detail?.active;project()});
document.addEventListener("DOMContentLoaded",()=>{decorate();project();electrical()});
if(document.readyState!=="loading"){decorate();project();electrical()}
window.B737McpAFDSBridgeV1=Object.freeze({
 getState:()=>JSON.parse(JSON.stringify(state)),
 getOutput:()=>Core.output(state),
 refreshElectrical:electrical,
 observePower:()=>Core.output(state), // compatibility: read-only, no manual power injection
 setEvidence:(key,value)=>send({type:"EVIDENCE",key,value}),
 observeFlight:sample=>send({type:"FLIGHT_OBSERVATION",sample}),
 observeAltitudeCapture:sample=>send({type:"FCC_ALTITUDE_CAPTURE",...sample}),
 beginToga:dualApGA=>send({type:'TOGA_ENGAGED',confirmed:true,
  source:'SIMULATED_FCC',dualApGA:dualApGA===true}),
 disconnectConfirmed:sample=>send({type:"AP_DISENGAGE_CONFIRMED",...sample}),
 press:requestMode,
 reset:()=>send({type:"RESET"})
});
})();
}catch(error){queueMicrotask(()=>{throw error});}
;await 0;
;
/* ./mcp-fd-ma-v1.js?v=MCP-FD-MA-0011 */
try{
/* MCP-FD-MA-0011 | centered circular MA over original F/D annun hole; FCOM 4.10.13, 4.20.3.
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
 left:Object.freeze({x:201,y:220,w:42,h:42}),
 right:Object.freeze({x:1916,y:236,w:42,h:42})
});
const defaults=()=>({kind:"NORMAL",radioAltitudeFt:null,
 locCaptured:false,gsCaptured:false,fccAvailable:{left:null,right:null}});
/* A verified live AC bus is an educational power proxy, not a certified
 * FCC circuit breaker or MCP feeder assignment. No lights without AC evidence,
 * unless an instructor explicitly confirms MCP power.
 */
function acEvidence(electrical){
 if(electrical?.schema!=="B737_ELECTRICAL_V7_RESULT"||!electrical.bus)return null;
 const keys=["transfer1","transfer2","main1","main2","acStandby"];
 if(keys.some(k=>electrical.bus[k]===true))return true;
 if(keys.every(k=>electrical.bus[k]===false))return false;
 return null;
}
function maSupply(output,electrical){
 const live=acEvidence(electrical);
 // Live evidence is newer than a potentially stale global AFDS snapshot.
 // This is an educational AC proxy, not a certified FCC feed assignment.
 if(live===true)return {powered:true,source:"LIVE_AC_BUS_PROXY"};
 if(live===false)return {powered:false,source:"LIVE_AC_OFF"};
 if(output?.power===false)return {powered:false,source:"AFDS_MCP_POWER_OFF"};
 if(output?.power===true)return {powered:true,source:"INSTRUCTOR_CONFIRMED_MCP"};
 // When MCP feed mapping has not yet loaded, an ON physical flight director
 // provides TRAINING ONLY MA feedback; never override known power loss.
 const fd=output?.controls?.fd;
 if(fd?.left===true||fd?.right===true)
  return {powered:true,source:"TRAINING_FD_FEEDBACK_POWER_UNVERIFIED"};
 return {powered:null,source:"POWER_UNVERIFIED"};
}
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
 if((output?.maPower??output?.power)!==true){s.reason="MCP_AC_POWER_NOT_EVIDENCED";return s;}
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
let state=initialState(),evidence=defaults(),latest=null,visualTest=false,hostWindow=null,lastRefreshSignature=null;
const roots=new WeakSet(),mounted=[];
function installStyle(){
 if(!hostWindow?.document||hostWindow.document.getElementById("mcp-fd-ma-0001-style"))return;
 const el=hostWindow.document.createElement("style");
 el.id="mcp-fd-ma-0001-style";
 el.textContent=[
 /* Owner specified: ROUND black lamp, WHITE MA in both OFF and ON. */
 '[data-piece="mcp"]>.mcp-fd-ma{position:absolute;z-index:7;display:block;box-sizing:border-box;',
 'transform:translate(-50%,-50%);pointer-events:none;user-select:none;overflow:hidden;',
 'border:1px solid #3d4140;border-radius:50%!important;',
 'background:radial-gradient(circle at 36% 24%,#222727 0%,#0a0d0d 40%,#010202 80%);',
 'box-shadow:0 1px 2px #000d,inset 0 1px 3px #000,inset 0 0 1px 1px #101919}',
 '[data-piece="mcp"]>.mcp-fd-ma:before{content:"";position:absolute;inset:4%;',
 'border-radius:50%;border:1px solid #545b5680;box-shadow:inset 0 0 4px #000b;pointer-events:none}',
 '[data-piece="mcp"]>.mcp-fd-ma svg{display:block;width:100%;height:100%;overflow:visible}',
 '[data-piece="mcp"]>.mcp-fd-ma .mcp-fd-ma-label{fill:#f6f7f4;stroke:none;',
 'font:700 17px Arial,Helvetica,sans-serif;letter-spacing:-.35px;paint-order:stroke fill;opacity:.12;filter:none}',
 '[data-piece="mcp"]>.mcp-fd-ma[data-on="false"] .mcp-fd-ma-label{fill:#fff;opacity:.12!important;filter:none!important}',
 '[data-piece="mcp"]>.mcp-fd-ma[data-on="false"]{border-color:#222928!important;background:radial-gradient(circle at 40% 30%,#101413,#040606 70%,#010202 100%)!important;box-shadow:inset 0 1px 3px #000,inset 0 0 2px #090d0b!important}',
 /* The lens remains black when powered. Only reflected light and white MA glow change. */
 '[data-piece="mcp"]>.mcp-fd-ma[data-on="true"]{',
 'border-color:#69716b;',
 'background:radial-gradient(circle at 45% 33%,#282f2d 0%,#0c1411 49%,#020403 86%);',
 'box-shadow:0 0 0 .5px #d5f4db90,inset 0 0 4px 1px #4c9a5e8c,',
 'inset 0 1px 2px #030807}',
 '[data-piece="mcp"]>.mcp-fd-ma[data-on="true"] .mcp-fd-ma-label{',
 'fill:#fff;opacity:1!important;filter:drop-shadow(0 0 .45px #fff)!important}'
 ].join("");
 (hostWindow.document.head||hostWindow.document.documentElement).append(el);
}
function render(){
 for(const root of mounted)for(const side of ["left","right"]){
  const el=root.querySelector('[data-mcp-ma="'+side+'"]');if(!el)continue;
  const on=visualTest||state.lamps[side]===true;
  el.dataset.on=String(on);
  el.dataset.source=visualTest?"LAMP_TEST":state.reason;
  el.dataset.fdSource=state.fdSource||"AFDS_OUTPUT";
  el.dataset.powerSource=state.supply?.source||"POWER_UNVERIFIED";
  el.title=visualTest?"MA illuminated by ALL LIGHTS ON test":
   "MA "+(on?"ON":"OFF")+" | "+state.reason+" | "+(state.supply?.source||"POWER_UNVERIFIED");
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
   // MA-0011: independently map owner's red target circles into two subsequent live screenshots via SIFT/RANSAC photographic alignment. Capt target (684.38,527.95), former bezel (685.09,516.89); FO target (1083.80,593.77), former bezel (1083.05,583.15). +12 source-Y, seat-specific +/-1 source-X, preserving geometry and logic.
   el.innerHTML='<svg viewBox="0 0 42 42" preserveAspectRatio="xMidYMid meet" aria-hidden="true" focusable="false"><text class="mcp-fd-ma-label" x="21" y="21.5" text-anchor="middle" dominant-baseline="central">MA</text></svg>';
   el.style.left=p.x/W*100+"%";el.style.top=p.y/H*100+"%";
   el.style.width=p.w/W*100+"%";el.style.height=p.h/H*100+"%";
   // Font geometry is set by the SVG viewBox, not viewport-dependent CSS.
   root.append(el);
  }
 }
 render();
}
function getState(){return JSON.parse(JSON.stringify({state,evidence,visualTest,position}));}
function liveElectrical(){
 try{return hostWindow?.B737ISNCockpitV1?.getState?.()?.state?.electrical??null}
 catch(e){return null}
}
/* Master annunciator source: use physical F/D switches when AFDS output lags.
 * This reconciles lamp indication; it does not implement flight-control servos.
 */
function reconcileFd(out,physical){
 const l=physical?.FD_LEFT,r=physical?.FD_RIGHT;
 if(!["ON","OFF"].includes(l)||!["ON","OFF"].includes(r))return out;
 const fd={left:l==="ON",right:r==="ON"},afds=out?.controls?.fd||{};
 const mismatch=fd.left!==afds.left||fd.right!==afds.right;
 return {...out,controls:{...out.controls,fd},maFdSource:mismatch?
  "HARDWARE_DIRECT_AFDS_MISMATCH":"HARDWARE_VERIFIED"};
}
function hardware(){
 try{return hostWindow?.B737McpHardwareV1?.getState?.()??null}
 catch(e){return null}
}
function applyOutput(out){
 if(!out||out.schema!=="B737_MCP_AFDS_OUTPUT_V1")return getState();
 latest=out;
 const physical=reconcileFd(out,hardware());
 const supply=maSupply(physical,liveElectrical());
 state=evaluate(state,{...physical,maPower:supply.powered},evidence);
 state.supply=supply;
 state.fdSource=physical.maFdSource||"AFDS_OUTPUT";
 state.afdsFd={...out.controls.fd};
 state.physicalFd={...physical.controls.fd};
 render();
 if(hostWindow)hostWindow.dispatchEvent(new CustomEvent("b737:mcp-ma-state",{detail:getState()}));
 return getState();
}
function refresh(){
 const next=hostWindow?.B737McpAFDSBridgeV1?.getOutput?.()||latest;
 if(!next)return getState();
 // Do not render unnecessarily on repeated ECU/AFDS sensor broadcasts.
 const sig=JSON.stringify([next.power,next.controls?.fd,hardware()?.FD_LEFT,hardware()?.FD_RIGHT,
  next.modes?.autopilot,maSupply(reconcileFd(next,hardware()),liveElectrical()),evidence]);
 if(lastRefreshSignature===sig)return getState();
 lastRefreshSignature=sig;
 return applyOutput(next);
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
 win.addEventListener("b737:mcp-afds-state",e=>{lastRefreshSignature=null;applyOutput(e.detail)});
 win.addEventListener("b737:cockpit-mounted",()=>{mount();refresh()});
 // The F/D physical switch is authoritative; AFDS bridge runs first, then
 // this listener re-reads its output to prevent a disconnected annunciator.
 win.addEventListener("b737:mcp-hardware-change",e=>{
  if(e.detail?.id==="FD_LEFT"||e.detail?.id==="FD_RIGHT")refresh();
 });
 for(const event of ["b737:isn-start-indications","b737:electrical-network",
  "b737:electrical-v7-state","b737:electrical-owner-ready",
  "b737:unified-ecu-observation"])win.addEventListener(event,refresh);
 win.addEventListener("b737:visual-test",e=>{visualTest=e.detail?.active===true;render()});
 win.document.addEventListener("DOMContentLoaded",()=>{mount();refresh()});
 if(win.document.readyState!=="loading"){mount();refresh()}
}
return Object.freeze({initialState,evaluate,acEvidence,maSupply,reconcileFd,position,getState,applyOutput,refresh,setEvidence,mount,bind,
 audit:()=>({mountedRoots:mounted.length,indicators:mounted.map(root=>[...root.querySelectorAll("[data-mcp-ma]")].map(el=>({side:el.dataset.mcpMa,on:el.dataset.on,text:el.textContent,rect:{width:el.getBoundingClientRect().width,height:el.getBoundingClientRect().height}})))}),
 resetEvidence:()=>{evidence=defaults();if(latest)applyOutput(latest);return getState()}});
});
}catch(error){queueMicrotask(()=>{throw error});}
;await 0;
;
/* ./mcp-independent-digits-v1.js?v=MCP-HOLES-0001-SAME-GEOMETRY */
try{
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
const Rules=win.B737McpFCOMCh4NumericV1;
const qa=new URLSearchParams(win.location.search).get("mcpDigitsTest")==="1";
/* MCP-HOLES-0001: no second set of photo-space positions.
 * The photo-measured inner glass apertures in MCP Visual V3 are authoritative;
 * all six live numeric hosts inherit EXACT same centers and dimensions.
 * A missing geometry authority fails closed rather than guessing positions.
 */
const capacity=Object.freeze({
 courseL:{slots:3},speed:{slots:3},heading:{slots:3},
 altitude:{slots:5},verticalSpeed:{slots:5},courseR:{slots:3}
});
const geometry=win.B737McpVisualV3?.geometry?.displays;
if(!Array.isArray(geometry)||geometry.length!==6||
 geometry.some(d=>!Object.hasOwn(capacity,d.id)))throw Error("MCP native photo display geometry unavailable");
const areas=Object.freeze(geometry.map(d=>Object.freeze({
 id:d.id,x:d.x,y:d.y,w:d.w,h:d.h,slots:capacity[d.id].slots
})));
const segments=Object.freeze({
 a:"M9 4.5 L27 4.5",b:"M30 8.5 L29 24",c:"M29 35 L28 50",
 d:"M8 54.5 L26 54.5",e:"M6 35 L5 50",f:"M7 8.5 L6 24",
 g:"M8.5 29.5 L27 29.5"
});
const segOn=Object.freeze({0:"abcdef",1:"bc",2:"abged",3:"abgcd",4:"fgbc",
 5:"afgcd",6:"afgecd",7:"abc",8:"abcdefg",9:"abfgcd","-":"g"});
const roots=new Map();
const speedConditionStyle=document.createElement('style');
speedConditionStyle.id='mcp-fcom-ch4-speed-condition-style';
speedConditionStyle.textContent='@keyframes b737McpSpeedLimitFlash{0%,49%{opacity:1}50%,100%{opacity:0}}';
document.head.append(speedConditionStyle);
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
 // Symbol is a separate layer inside the same owner-approved MCP speed
 // aperture, not an altered photograph, knob, display location or frame.
 let condition=null;
 if(d.id==='speed'){
  condition=document.createElement('span');
  condition.dataset.mcpCh4SpeedCondition='true';
  condition.setAttribute('aria-label','MCP speed limiting condition');
  Object.assign(condition.style,{position:'absolute',top:'4%',left:'0px',
   width:'20%',height:'89%',display:'none',color:'#ffdc85',
   font:'bold 16px Arial,sans-serif',textAlign:'center',lineHeight:'2.1',
   pointerEvents:'none',textShadow:'0 0 5px #f9b953'});
  host.append(condition);
 }
 return {host,glass,d,condition};
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
 const backend=win.B737McpAFDSBridgeV1?.getOutput?.()||{};
 const numbers={};
 for(const {id} of areas)
  numbers[id]=Number.isFinite(visual[id])?Math.trunc(visual[id]):
   Number.isFinite(backend.values?.[id])?Math.trunc(backend.values[id]):0;
 numbers.machHundredths=Number.isFinite(visual.machHundredths)?
  visual.machHundredths:(backend.values?.machHundredths??60);
 numbers.speedMode=backend.speedDisplayMode||visual.speedMode||"IAS";
 numbers.displayBlank=backend.displayBlank||{verticalSpeed:true,speed:false};
 return numbers;
}
function stringFor(d,values){
 const blank=!qa&&(d.id==="speed"?values.displayBlank.speed:
  d.id==="verticalSpeed"?values.displayBlank.verticalSpeed:false);
 const value=d.id==="speed"&&values.speedMode==="MACH"?values.machHundredths:values[d.id];
 return Rules?.format(d.id,value,{mode:values.speedMode,blank})??"";
}
function paint(view,on,chars){
 const {glass,d,host,condition}=view;
 host.dataset.powered=on?"true":"false";
 if(condition){
  const evidence=win.B737McpAFDSBridgeV1?.getOutput?.()?.speedLimit;
  const symbol=on&&evidence?.authorized===true?evidence.speedConditionSymbol:'NONE';
  condition.style.display=symbol&&symbol!=='NONE'?'block':'none';
  // Chapter 4 figure depicts flashing A (low/performance) and 8 (high).
  condition.textContent=symbol==='OVERSPEED'?'8':'A';
  condition.style.animation=condition.style.display==='block'?
   'b737McpSpeedLimitFlash 1s steps(1,end) infinite':'none';
  host.dataset.speedCondition=symbol||'NONE';
 }
 host.dataset.characters=chars;
 if(!on||!chars){glass.replaceChildren();return;}
 // Fit a FIXED display capacity, never the length of a changing value.
 // The V/S window always reserves one narrow sign plus FOUR numeric slots.
 // MACH reserves a short decimal point and two digits; IAS reserves three.
 const cellWidth=35,spacing=6.5;
 const widths=Array.from({length:d.slots},(_,i)=>d.id==="verticalSpeed"&&i===0?23:
  d.id==="speed"&&chars[0]==="."&&i===0?14:cellWidth);
 const rawWidth=widths.reduce((n,v)=>n+v,0)+spacing*(widths.length-1);
 const scale=Math.min(1,(d.w-10)/rawWidth,(d.h-7)/59);
 const total=rawWidth*scale;
 const first=(d.w-total)/2,top=(d.h-59*scale)/2;
 const group=svg("g");let x=first;
 for(let i=0;i<d.slots;i++){
  const character=chars[i]||" ";
  const width=widths[i],digit=svg("g",{transform:"translate("+x+" "+top+") scale("+scale+")"});
  const mid=width/2;
  if(character==="+"||character==="-"){
   const horizontal=svg("path",{d:"M"+(mid-7)+" 29 L"+(mid+7)+" 29",
    stroke:"#ffdc85","stroke-width":4.2,"stroke-linecap":"round",fill:"none"});
   horizontal.style.filter="drop-shadow(0 0 2px #e9ab39)";
   digit.append(horizontal);
   if(character==="+")digit.append(svg("path",{d:"M"+mid+" 22 L"+mid+" 36",
    stroke:"#ffdc85","stroke-width":4.2,"stroke-linecap":"round",fill:"none"}));
  }else if(character==="."){
   const dot=svg("circle",{cx:mid,cy:51,r:3.2,fill:"#ffdc85"});
   dot.style.filter="drop-shadow(0 0 2px #e9ab39)";digit.append(dot);
  }else if(character!==" "){
   const active=segOn[character]||"";
   // Center the 35-unit seven-segment artwork within its fixed cell.
   const segGroup=svg("g",{transform:"translate("+((width-cellWidth)/2)+" 0)"});
   for(const [name,path]of Object.entries(segments)){
    const lit=active.includes(name);
    const segment=svg("path",{d:path,fill:"none",stroke:lit?"#ffdc85":"#3e321a",
     "stroke-width":lit?4.2:3.8,"stroke-linecap":"round","stroke-linejoin":"round",
     opacity:lit?1:.12});
    if(lit)segment.style.filter="drop-shadow(0 0 1.3px #fff2b6) drop-shadow(0 0 2.2px #e9ab39)";
    segGroup.append(segment);
   }
   digit.append(segGroup);
  }
  group.append(digit);
  x+=(width+spacing)*scale;
 }
 glass.replaceChildren(group);
}
/* Recompute electrical supply only on a distribution/CB event, not on each
 * numeric detent, wheel tick or instrument repaint. */
function draw(force=false,refreshPower=false){
 if(refreshPower||!lastSupply)lastSupply=supply();
 const p=lastSupply,values=getNumbers();
 const key=JSON.stringify([qa,p.main,p.right,values,
  win.B737McpAFDSBridgeV1?.getOutput?.()?.speedLimit?.speedConditionSymbol]);
 if(!force&&key===lastKey)return;
 lastKey=key;
 for(const views of roots.values())for(const view of views){
  const on=qa||(view.d.id==="courseR"?p.right:p.main)===true;
  paint(view,on,stringFor(view.d,values));
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
   id:v.d.id,lit:v.host.dataset.powered,slots:v.d.slots,characters:v.host.dataset.characters,rect:{
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

}catch(error){queueMicrotask(()=>{throw error});}
;await 0;
;
/* ./ac-dc-metering-model.js?v=MET-0012-LOADER-GUARD */
try{
(function(root,factory){
 'use strict';
 const model=factory();
 if(typeof module==='object'&&module.exports)module.exports=model;
 if(root)root.B737AcDcMeteringModel=model;
})(typeof globalThis==='object'?globalThis:this,function(){
 'use strict';
 // Display-centre candidates fit from intact OH10 original circular metal rims; 
 // 4 strong Hough thresholds give the same centre. DO NOT mistake a bezel 
 // centre for a photographed shaft: require arc/tip confirmation for release. 
 // See engine/instruments/native-bezel-centre-evidence-v1.json.
 // Initial angles now represent provisional cold-dark mechanical resting positions. 
 // DC AMPS is center-zero; unpowered AC/DC voltmeters rest at their leftmost stop pending exact source-tick survey.
 const source=Object.freeze({piece:'OH10',width:1095,height:1436,tipRadius:85,spriteTipRadius:216,registration:'OWNER_SCREENSHOT_RED_ARC_FIT_NATIVE_ELLIPSE_NOT_SHAFT_CERTIFIED'});
 const meters=Object.freeze([
  Object.freeze({id:'dcAmps',label:'DC AMPS',x:307.386918,y:272.100000,tipRadius:164.101996,tipRadiusX:164.101996,tipRadiusY:159.161290,initialAngle:0}),
  Object.freeze({id:'cps',label:'CPS',x:781.879157,y:253.738710,tipRadius:145.368071,tipRadiusX:145.368071,tipRadiusY:140.991398,initialAngle:-54.21}),
  Object.freeze({id:'dcVolts',label:'DC VOLTS',x:310.770510,y:710.143011,tipRadius:174.654102,tipRadiusX:174.654102,tipRadiusY:169.395699,initialAngle:-45.50}),
  Object.freeze({id:'acVolts',label:'A.C.',x:785.307095,y:698.181720,tipRadius:153.533259,tipRadiusX:153.533259,tipRadiusY:148.910753,initialAngle:-51.40})
 ]);

 // Source-original native OH10 white graduation intersections, not metal
 // bezel circles; 11 DC AMPS marks -50..+50 each 10 A, 11 DC VOLTS marks
 // 0..40 each 4 V. Separate 100..130 V AC scale remains manual QA-only until
 // its unpowered parked position and actual AC bus sensor feed are resolved.
 const photoScale=Object.freeze({
  // CPS end/center visual anchors are TRAINING PROVISIONAL until all native tick rays and its true shaft are audited.
  cps:Object.freeze({unit:'Hz',values:Object.freeze([360,380,400,410,420]),angles:Object.freeze([-54.21,-27.105,0,23.39,46.78]),readoutApprovedForPreview:false,accuracy:'OWNER_RED_ARC_PROVISIONAL_NATIVE_REGISTRATION'}),
  dcAmps:Object.freeze({unit:'A',values:Object.freeze([-50,-40,-30,-20,-10,0,10,20,30,40,50]),angles:Object.freeze([-46.66,-37.3809,-28.3169,-19.2363,-9.8249,0,9.1325,17.9534,26.7118,35.2366,44.26]),readoutApprovedForPreview:false,accuracy:'OWNER_RED_ARC_PROVISIONAL_NATIVE_REGISTRATION'}),
  dcVolts:Object.freeze({unit:'V',values:Object.freeze([0,4,8,12,16,20,24,28,32,36,40]),angles:Object.freeze([-45.5,-36.1684,-27.4244,-18.5076,-9.6945,0,10.0057,18.8254,27.3445,35.6464,44.7]),readoutApprovedForPreview:false,accuracy:'OWNER_RED_ARC_PROVISIONAL_NATIVE_REGISTRATION'}),
  acVolts:Object.freeze({unit:'V',values:Object.freeze([100,102,104,106,108,110,112,114,116,118,120,122,124,126,128,130]),angles:Object.freeze([-51.4,-44.7535,-38.2574,-31.7398,-25.147,-18.0496,-10.2757,-3.5004,3.5478,10.1972,18.0981,25.2263,31.6363,37.9701,44.4344,51.16]),readoutApprovedForPreview:false,accuracy:'OWNER_RED_ARC_PROVISIONAL_NATIVE_REGISTRATION'})
 });
 function bearingForReading(id,value){
  const sc=photoScale[id];if(!sc)throw Error('Unknown photographic OH10 scale '+id);
  if(typeof value!=='number'||!Number.isFinite(value))throw Error('OH10 reading must be finite');
  const v=sc.values,a=sc.angles;
  if(value<v[0]||value>v[v.length-1])return null;
  for(let i=1;i<v.length;i++)if(value<=v[i]){
   return a[i-1]+(value-v[i-1])*(a[i]-a[i-1])/(v[i]-v[i-1]);
  }
  return a[a.length-1];
 }
 function readingForBearing(id,bearing){
  const sc=photoScale[id];if(!sc)throw Error('Unknown photographic OH10 scale '+id);
  if(typeof bearing!=='number'||!Number.isFinite(bearing))throw Error('OH10 bearing must be finite');
  const v=sc.values,a=sc.angles;
  if(bearing<a[0]-1e-8||bearing>a[a.length-1]+1e-8)return null;
  for(let i=1;i<a.length;i++)if(bearing<=a[i])
   return v[i-1]+(bearing-a[i-1])*(v[i]-v[i-1])/(a[i]-a[i-1]);
  return v[v.length-1];
 }
 // All four needles share the already-installed sprite. Treat no power / no
 // measurement as the photographed left mechanical rest, not as the lowest
 // printed live indication (especially AC 0V versus 100V and CPS 0Hz).
 function angleForIndication(id,reading){
  const meter=meters.find(m=>m.id===id);
  const sc=photoScale[id];
  if(!meter||!sc)throw Error('Unknown AC/DC metering indicator: '+id);
  if(reading===null||reading===undefined)return limitAngle(id,meter.initialAngle);
  if(typeof reading!=='number'||!Number.isFinite(reading))throw Error('Meter indication must be a finite numeric sample or null');
  if(reading<sc.values[0])return bounds(id).min;
  const limit=Math.min(sc.values[sc.values.length-1],reading);
  return bearingForReading(id,limit);
 }
 const indicationModes=Object.freeze({
  NORMAL:'NORMAL',RESIDUAL:'RESIDUAL'
 });
 function angleForAcVolts(value,{mode='NORMAL'}={}){
  if(!Object.values(indicationModes).includes(mode))throw Error('Invalid AC voltmeter mode');
  if(value===null||value===undefined)return angleForIndication('acVolts',null);
  if(typeof value!=='number'||!Number.isFinite(value))throw Error('Invalid AC volts sample');
  // Lufthansa ATA24: residual scale is 0..30V. The scale-track equivalence to
  // normal 100..130V is provisional until its native ticks are signed off.
  if(mode==='RESIDUAL'){
   if(value<0)return bounds('acVolts').min;
   return angleForIndication('acVolts',100+Math.min(30,value));
  }
  return angleForIndication('acVolts',value);
 }
 
 // Native image: one immutable white pointer image with a 216px master pivot-to-tip
 // distance. Native per-meter tip radii are calibrated parameters pointing at the
 // INNER END of the existing white graduations; never redraw these graduations.
 function bounds(id){
  const sc=photoScale[id];
  if(!sc)throw Error('Unknown OH10 needle travel bounds: '+id);
  return Object.freeze({min:sc.angles[0],max:sc.angles[sc.angles.length-1]});
 }
 function limitAngle(id,value){
  if(typeof value!=='number'||!Number.isFinite(value))throw Error('OH10 angle must be finite');
  const b=bounds(id);
  return Math.max(b.min,Math.min(b.max,value));
 }
 function tipPoint(id,bearing){
  const meter=meters.find(m=>m.id===id);
  if(!meter)throw Error('Unknown OH10 tip: '+id);
  const a=limitAngle(id,bearing)*Math.PI/180;
  const rx=meter.tipRadiusX||meter.tipRadius||source.tipRadius;
  const ry=meter.tipRadiusY||meter.tipRadius||source.tipRadius;
  return Object.freeze({x:meter.x+rx*Math.sin(a),y:meter.y-ry*Math.cos(a),radiusX:rx,radiusY:ry,angle:limitAngle(id,bearing)});
 }
 // User's screenshot measured four red inner-tick arcs. The cover is a
 // curved BLUE physical foreground. The existing white needle is clipped to
 // the black window and remains hidden below the photo's blue edge.
 // Screenshot/native registration is provisional; source bitmap is unchanged.
 const arcPhoto=Object.freeze({
  scaleX:0.902,scaleY:0.930,originX:216.8,originY:234,
  occlusion:Object.freeze({
   dcAmps:Object.freeze({mx:494.5,y:404.03,q:21.10,k:1.38}),
   cps:Object.freeze({mx:922,y:402.04,q:23.42,k:0.06}),
   dcVolts:Object.freeze({mx:494.5,y:807.03,q:22.32,k:2.88}),
   acVolts:Object.freeze({mx:921.5,y:805.67,q:26.53,k:-1.36})
  })
 });
 function blueBoundaryAt(id,xNative){
  const edge=arcPhoto.occlusion[id];
  if(!edge||typeof xNative!=='number'||!Number.isFinite(xNative))throw Error('Invalid OH10 face boundary query');
  const screenX=arcPhoto.originX+arcPhoto.scaleX*xNative;
  const t=(screenX-edge.mx)/110;
  const screenY=edge.y+edge.q*t*t+edge.k*t;
  return (screenY-arcPhoto.originY)/arcPhoto.scaleY;
 }
 function blackWindowPath(id){
  const meter=meters.find(m=>m.id===id),edge=arcPhoto.occlusion[id];
  if(!meter||!edge)throw Error('Unknown gauge face occlusion: '+id);
  const scaleX=source.spriteTipRadius/(meter.tipRadiusX||meter.tipRadius),scaleY=source.spriteTipRadius/(meter.tipRadiusY||meter.tipRadius),coords=[];
  // Native x to 512x512 centered sprite coordinates, sampling the traced
  // black/blue interface at 33 x positions (less than 0.1px curve error).
  for(let i=0;i<=64;i++){
   const spriteX=i*8,nativeX=meter.x+(spriteX-256)/scaleX;
   const nativeY=blueBoundaryAt(id,nativeX);
   coords.push([spriteX,256+(nativeY-meter.y)*scaleY]);
  }
  const bottom=coords.slice().reverse().map(p=>'L '+p[0].toFixed(3)+' '+p[1].toFixed(3)).join(' ');
  return 'M 0 0 L 512 0 '+bottom+' Z';
 }
 const motion=Object.freeze({maxSpeedDegPerSec:70,accelerationDegPerSec2:260,settleDeg:0.025,maxStepSeconds:0.05});
 function advanceNeedle(current,velocity,target,dtSeconds){
  if(![current,velocity,target,dtSeconds].every(v=>typeof v==='number'&&Number.isFinite(v)))throw Error('Non-finite OH10 animation argument');
  if(dtSeconds<0)throw Error('Negative needle animation time');
  const dt=Math.min(motion.maxStepSeconds,dtSeconds),dist=target-current,d=Math.abs(dist);
  if(d<=motion.settleDeg)return {angle:target,velocity:0,done:true};
  if(dt===0)return {angle:current,velocity:Math.min(motion.maxSpeedDegPerSec,Math.max(0,velocity)),done:false};
  const dir=Math.sign(dist),brakingDistance=velocity*velocity/(2*motion.accelerationDegPerSec2);
  const nextSpeed=Math.min(motion.maxSpeedDegPerSec,Math.max(5,velocity+(d<=brakingDistance+0.2?-motion.accelerationDegPerSec2:motion.accelerationDegPerSec2)*dt));
  const step=Math.min(d,nextSpeed*dt),next=current+dir*step;
  if(d-step<=motion.settleDeg)return {angle:target,velocity:0,done:true};
  return {angle:next,velocity:nextSpeed,done:false};
 }
 const angle=value=>{
  const n=Number(value);
  if(!Number.isFinite(n))throw Error('Meter needle angle must be finite');
  return Math.max(-70,Math.min(70,n));
 };
 function placement(piece,meter){
  if(!piece||!meters.includes(meter)||![piece.x,piece.y,piece.w,piece.h].every(Number.isFinite)||piece.w<=0||piece.h<=0)throw Error('Invalid OH10 needle placement');
  const sizeX=512*(meter.tipRadiusX||meter.tipRadius||source.tipRadius)/source.spriteTipRadius*piece.w/source.width;
  const sizeY=512*(meter.tipRadiusY||meter.tipRadius||source.tipRadius)/source.spriteTipRadius*piece.h/source.height;
  return {x:piece.x+meter.x*piece.w/source.width,y:piece.y+meter.y*piece.h/source.height,size:sizeX,sizeX,sizeY};
 }
 return Object.freeze({source,meters,angle,placement,photoScale,bearingForReading,readingForBearing,angleForIndication,angleForAcVolts,indicationModes,bounds,limitAngle,tipPoint,motion,advanceNeedle,arcPhoto,blueBoundaryAt,blackWindowPath});
});

}catch(error){queueMicrotask(()=>{throw error});}
;await 0;
})();
