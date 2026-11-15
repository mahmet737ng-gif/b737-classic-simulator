/* AFDS-ANN-UNIFIED-0001: photo-registered three-detent, spring-return TEST switch.
 * Only new DOM overlays; no edits to owner artwork, guards, EADI, MCP or lights registry.
 * FO installation initial position is PHOTO-CANDIDATE, not final pixel approval.
 */
(function(root){
"use strict";
const Core=root.B737AFDSAnnunciatorCoreV1;
if(!Core)return;
const VERSION="AFDS-ANN-UNIFIED-0001";
const ASSET="../assets/locked/2026-10-23/Switches/Toggle/";
const FRAMES=Object.freeze({TEST_1:ASSET+"b737-toggle-on.webp",
  NEUTRAL:ASSET+"b737-toggle-center.webp",TEST_2:ASSET+"b737-toggle-off.webp"});
const LAMPS=Object.freeze([
  {id:"AP",label:"A/P",x:1462.6,y:223.0,w:17.3,h:19.3},
  {id:"AT",label:"A/T",x:1484.9,y:223.0,w:17.3,h:19.3},
  {id:"FMC",label:"FMC",x:1507.4,y:223.0,w:17.3,h:19.3}
]);
const SWITCH=Object.freeze({seat:"FO",x:1527.5,y:224.0,w:19.2,h:19.2,
  source:"owner screenshot 2026-11-15, estimated native 2100x920 mapping; pixel QA pending"});
let state=Core.initial(),mountRoot=null,lever=null,activePointer=null,activeKey=null;
const frames=new Map(),lights=new Map();
function emit(){
 root.dispatchEvent(new CustomEvent("b737:afds-annunciator-state",{detail:{...Core.status(state),seat:"FO"}}));
}
function paint(){
 const outputs=Core.lamps(state);
 if(lever){
  lever.dataset.detent=state.detent;
  lever.setAttribute("aria-valuetext",state.detent.replace("_"," "));
  for(const [key,img]of frames)img.classList.toggle("afds-is-active",key===state.detent);
 }
 for(const [id,button]of lights){
  const mode=outputs[id]||"OFF";
  button.dataset.lamp=mode;
  button.setAttribute("aria-label",id+" P/RST "+mode.replaceAll("_"," "));
 }
 emit();
}
function transition(action){
 const next=Core.reduce(state,action);if(next===state)return Core.status(state);
 state=next;paint();return Core.status(state);
}
function selectDetent(value){if(value==="TEST_1"||value==="TEST_2")transition({type:"PRESS_TEST",detent:value});
  else transition({type:"RELEASE_TEST"});}
function posForPointer(e){
 const rect=lever.getBoundingClientRect();
 const delta=e.clientY-(rect.top+rect.height/2);
 // Touch gestures use up/down of the switch's CENTER as signed selection.
 return delta<0?"TEST_1":"TEST_2";
}
function releasePointer(e){
 if(activePointer===null||e?.pointerId!==undefined&&e.pointerId!==activePointer)return;
 if(lever&&activePointer!==null&&lever.hasPointerCapture?.(activePointer)){
  try{lever.releasePointerCapture(activePointer);}catch(_){}
 }
 activePointer=null;
 selectDetent("NEUTRAL");
}
function makeLever(doc){
 const btn=doc.createElement("button");
 btn.type="button";btn.className="afds-fo-test-lever";btn.id="afdsFoTestLever";
 btn.setAttribute("aria-label","First Officer AFDS TEST switch, momentary up TEST 1, down TEST 2");
 btn.setAttribute("aria-keyshortcuts","ArrowUp ArrowDown");
 Object.assign(btn.style,{left:SWITCH.x+"px",top:SWITCH.y+"px",
   width:SWITCH.w+"px",height:SWITCH.h+"px"});
 for(const [detent,url]of Object.entries(FRAMES)){
  const img=doc.createElement("img");img.alt="";img.draggable=false;
  img.src=url;img.dataset.detent=detent;
  img.className="afds-toggle-frame"+(detent==="NEUTRAL"?" afds-is-active":"");
  btn.append(img);frames.set(detent,img);
 }
 btn.addEventListener("pointerdown",e=>{
  if(e.button!==0 || activePointer!==null)return;
  e.preventDefault();activePointer=e.pointerId;
  try{btn.setPointerCapture(e.pointerId);}catch(_){}
  selectDetent(posForPointer(e));
 });
 btn.addEventListener("pointermove",e=>{
  if(activePointer!==e.pointerId)return;
  e.preventDefault();
  // Slow drag and rapid tap/swipe both select the detent indicated by finger direction.
  selectDetent(posForPointer(e));
 });
 for(const ev of ["pointerup","pointercancel","lostpointercapture"])btn.addEventListener(ev,releasePointer);
 btn.addEventListener("keydown",e=>{
  if(e.code!=="ArrowUp"&&e.code!=="ArrowDown")return;
  e.preventDefault();if(e.repeat)return;
  activeKey=e.code;selectDetent(e.code==="ArrowUp"?"TEST_1":"TEST_2");
 });
 btn.addEventListener("keyup",e=>{
  if(e.code===activeKey){e.preventDefault();activeKey=null;selectDetent("NEUTRAL");}
 });
 btn.addEventListener("blur",()=>{activeKey=null;releasePointer();selectDetent("NEUTRAL");});
 btn.addEventListener("click",e=>e.preventDefault());
 return btn;
}
function makeLamp(doc,item){
 const btn=doc.createElement("button");btn.type="button";
 btn.className="afds-fo-pshrst";btn.dataset.afdsLight=item.id;
 btn.id="afdsFoLight"+item.id;
 btn.title=item.label+" P/RST — press to acknowledge active alert";
 Object.assign(btn.style,{left:item.x+"px",top:item.y+"px",width:item.w+"px",height:item.h+"px"});
 const title=doc.createElement("span");title.className="afds-lamp-upper";title.textContent=item.label;
 const reset=doc.createElement("span");reset.className="afds-lamp-lower";reset.textContent="P/RST";
 btn.append(title,reset);
 btn.addEventListener("click",()=>{transition({type:"ACKNOWLEDGE",id:item.id});});
 lights.set(item.id,btn);
 return btn;
}
function mount(){
 const native=root.document.querySelector("#region-main .region-native");
 if(!native)return false;
 if(mountRoot===native&&lever?.isConnected)return true;
 if(mountRoot&&mountRoot!==native){frames.clear();lights.clear();lever=null;activePointer=null;}
 mountRoot=native;
 // All elements are siblings of existing photo layers, so the established
 // F/O proportional scaling follows the same native coordinate correction.
 for(const l of LAMPS)native.append(makeLamp(root.document,l));
 lever=makeLever(root.document);
 native.append(lever);
 paint();
 return true;
}
function attach(){
 if(mount())return;
 const stage=root.document.getElementById("scene")||root.document.body;
 if(!stage||!root.MutationObserver)return;
 const observer=new root.MutationObserver(()=>{
  if(mount())observer.disconnect();
 });
 observer.observe(stage,{subtree:true,childList:true});
}
const api=Object.freeze({VERSION,SWITCH,FRAMES,LAMPS,
 state:()=>Core.status(state),press:detent=>transition({type:"PRESS_TEST",detent}),
 release:()=>transition({type:"RELEASE_TEST"}),
 setAlert:(id,status)=>transition({type:"SET_ALERT",id,status}),
 acknowledge:id=>transition({type:"ACKNOWLEDGE",id}),
 mount});
root.B737AFDSAnnunciatorUnifiedV1=api;
root.addEventListener("blur",()=>{activeKey=null;releasePointer();selectDetent("NEUTRAL");});
root.document.addEventListener("visibilitychange",()=>{if(root.document.hidden){activeKey=null;releasePointer();selectDetent("NEUTRAL");}});
root.addEventListener("pagehide",()=>{activeKey=null;releasePointer();selectDetent("NEUTRAL");});
root.addEventListener("b737:cockpit-mounted",mount);
root.addEventListener("b737:engine-indication-view",mount);
if(root.document.readyState==="loading")root.document.addEventListener("DOMContentLoaded",attach,{once:true});
else attach();
})(window);