/* AFDS-ANN-UNIFIED-0002 — 737 Classic CAPT/FO physical P/RST test.
 * Five-pose Small Silver sprite is explicitly owner-selected here.
 * Photo apertures remain untouched. All coordinates are native MAIN 2100x920.
 * Sign legends alone illuminate. No invented auto-flight warning source.
 */
(function(root){
"use strict";
const Core=root.B737AFDSAnnunciatorCoreV1;
if(!Core)return;
const VERSION="AFDS-ANN-UNIFIED-0002";
const SPRITE="../../shared-assets/toggle-switch-small/Small_Silver_5Positions.webp";
// Sprite cells LEFT, CENTER, RIGHT, UP, DOWN (1024 square each).
const POSE=Object.freeze({TEST_1:"75% 0%",NEUTRAL:"25% 0%",TEST_2:"100% 0%"});
const INSTALL=Object.freeze({
  CAPT:Object.freeze({
    source:"captain 3942x3591 source / 1536x1399 photo apertures",
    sourcePiece:"captain",
    lamps:Object.freeze([
      {id:"AP",x:597.0,y:202.2,w:21.4,h:22.3},
      {id:"AT",x:623.5,y:202.2,w:21.4,h:22.3},
      {id:"FMC",x:650.0,y:202.2,w:21.4,h:22.3}
    ]),
    toggle:{cx:683.2,cy:212.9,cell:42,hit:21}
  }),
  FO:Object.freeze({
    source:"owner 1649x928 screenshot 2026-11-15; photo black apertures, native inverse zoom",
    sourcePiece:"fo-inner",
    lamps:Object.freeze([
      {id:"AP",x:1449.1,y:216.9,w:21.8,h:21.1},
      {id:"AT",x:1475.0,y:216.9,w:21.8,h:21.1},
      {id:"FMC",x:1499.9,y:216.9,w:22.1,h:21.1}
    ]),
    toggle:{cx:1532.4,cy:226.5,cell:44,hit:20.8}
  })
});
const states={CAPT:Core.initial(),FO:Core.initial()};
const visual=new Map(),lamps={CAPT:new Map(),FO:new Map()};
const held={CAPT:null,FO:null};
let mountRoot=null;
function nameFor(id){return id==="AP"?"A/P":id==="AT"?"A/T":"FMC";}
function dispatch(seat){
 root.dispatchEvent(new CustomEvent("b737:afds-annunciator-state",
  {detail:{...Core.status(states[seat]),seat,version:VERSION}}));
}
function paint(seat){
 const output=Core.lamps(states[seat]),v=visual.get(seat);
 if(v){v.dataset.detent=states[seat].detent;
  v.style.backgroundPosition=POSE[states[seat].detent];}
 for(const [id,button]of lamps[seat]){
  const mode=output[id]||"OFF";
  button.dataset.lamp=mode;
  button.setAttribute("aria-label",nameFor(id)+" P/RST "+mode.replaceAll("_"," "));
 }
 dispatch(seat);
}
function transition(seat,action){
 if(!INSTALL[seat])return null;
 const next=Core.reduce(states[seat],action);
 if(next!==states[seat]){states[seat]=next;paint(seat);}
 return Core.status(states[seat]);
}
function release(seat){
 held[seat]=null;
 return transition(seat,{type:"RELEASE_TEST"});
}
function releaseAll(){for(const seat of Object.keys(INSTALL))release(seat);}
function select(seat,detent){
 return transition(seat,detent==="TEST_1"||detent==="TEST_2"
  ?{type:"PRESS_TEST",detent}:{type:"RELEASE_TEST"});
}
function acknowledge(id){
 // Real A/P, A/T, FMC alerts are mirrored to both crew sides.
 for(const seat of Object.keys(INSTALL))transition(seat,{type:"ACKNOWLEDGE",id});
}
function setAlert(id,status){
 for(const seat of Object.keys(INSTALL))transition(seat,{type:"SET_ALERT",id,status});
 return Core.status(states.CAPT);
}
function createToggle(doc,seat,def){
 const {cx,cy,cell,hit}=def.toggle;
 const art=doc.createElement("span");
 art.className="afds-silver-toggle";
 art.dataset.afdsSeat=seat;
 art.dataset.detent="NEUTRAL";
 art.setAttribute("aria-hidden","true");
 art.style.left=(cx-cell/2)+"px";art.style.top=(cy-cell/2)+"px";
 art.style.width=cell+"px";art.style.height=cell+"px";
 art.style.backgroundImage='url("'+SPRITE+'")';
 art.style.backgroundPosition=POSE.NEUTRAL;
 const btn=doc.createElement("button");btn.type="button";
 btn.className="afds-toggle-hit";
 btn.dataset.afdsSeat=seat;
 btn.id="afds"+(seat==="CAPT"?"Capt":"Fo")+"TestLever";
 btn.style.left=(cx-hit/2)+"px";btn.style.top=(cy-hit/2)+"px";
 btn.style.width=hit+"px";btn.style.height=hit+"px";
 btn.setAttribute("aria-label",seat+" AFDS TEST 1 / neutral / TEST 2; spring loaded");
 btn.setAttribute("aria-keyshortcuts","ArrowUp ArrowDown");
 const detentFrom=(e)=>{
  const rect=btn.getBoundingClientRect();
  return e.clientY < rect.top+rect.height/2?"TEST_1":"TEST_2";
 };
 btn.addEventListener("pointerdown",e=>{
  if(e.button!==0||held[seat]!==null)return;
  e.preventDefault();held[seat]={kind:"pointer",id:e.pointerId};
  try{btn.setPointerCapture(e.pointerId);}catch(_){}
  select(seat,detentFrom(e));
 });
 btn.addEventListener("pointermove",e=>{
  if(held[seat]?.kind!=="pointer"||held[seat].id!==e.pointerId)return;
  e.preventDefault();select(seat,detentFrom(e));
 });
 function up(e){
  if(held[seat]?.kind!=="pointer"||held[seat].id!==e.pointerId)return;
  held[seat]=null;select(seat,"NEUTRAL");
  try{if(btn.hasPointerCapture(e.pointerId))btn.releasePointerCapture(e.pointerId);}catch(_){}
 }
 for(const ev of ["pointerup","pointercancel","lostpointercapture"])btn.addEventListener(ev,up);
 btn.addEventListener("keydown",e=>{
  if(e.code!=="ArrowUp"&&e.code!=="ArrowDown")return;
  e.preventDefault();if(e.repeat)return;
  held[seat]={kind:"key",id:e.code};
  select(seat,e.code==="ArrowUp"?"TEST_1":"TEST_2");
 });
 btn.addEventListener("keyup",e=>{
  if(held[seat]?.kind==="key"&&held[seat].id===e.code){
    e.preventDefault();release(seat);
  }
 });
 btn.addEventListener("blur",()=>release(seat));
 btn.addEventListener("click",e=>e.preventDefault());
 visual.set(seat,art);
 return [art,btn];
}
function createLamp(doc,seat,rect){
 const btn=doc.createElement("button");btn.type="button";
 btn.className="afds-legend-window";
 btn.dataset.afdsSeat=seat;btn.dataset.afdsLight=rect.id;
 btn.id="afds"+(seat==="CAPT"?"Capt":"Fo")+"Light"+rect.id;
 btn.title=nameFor(rect.id)+" P/RST — acknowledge";
 Object.assign(btn.style,{left:rect.x+"px",top:rect.y+"px",
  width:rect.w+"px",height:rect.h+"px"});
 const upper=doc.createElement("span");upper.className="afds-legend-main";
 upper.textContent=nameFor(rect.id);
 const lower=doc.createElement("span");lower.className="afds-legend-reset";
 lower.textContent="P/RST";
 btn.append(upper,lower);
 btn.addEventListener("click",()=>acknowledge(rect.id));
 lamps[seat].set(rect.id,btn);return btn;
}
function mount(){
 const native=root.document.querySelector("#region-main .region-native");
 if(!native)return false;
 if(mountRoot===native&&visual.get("FO")?.isConnected&&visual.get("CAPT")?.isConnected)return true;
 if(mountRoot!==native){
  mountRoot=native;visual.clear();lamps.CAPT.clear();lamps.FO.clear();
 }
 // Avoid duplicate controls on reentry; preserve previous test state.
 for(const seat of Object.keys(INSTALL)){
  native.querySelectorAll('[data-afds-seat="'+seat+'"].afds-silver-toggle, [data-afds-seat="'+seat+'"].afds-toggle-hit, [data-afds-seat="'+seat+'"].afds-legend-window').forEach(x=>x.remove());
  lamps[seat].clear();
  for(const lamp of INSTALL[seat].lamps)native.append(createLamp(root.document,seat,lamp));
  for(const node of createToggle(root.document,seat,INSTALL[seat]))native.append(node);
  paint(seat);
 }
 return true;
}
function start(){
 if(mount())return;
 const stage=root.document.getElementById("scene")||root.document.body;
 if(!stage||!root.MutationObserver)return;
 const observer=new root.MutationObserver(()=>{
  if(mount())observer.disconnect();
 });
 observer.observe(stage,{subtree:true,childList:true});
}
root.B737AFDSAnnunciatorUnifiedV1=Object.freeze({
 VERSION,SPRITE,POSE,INSTALL,
 state:seat=>Core.status(states[seat||"FO"]),
 getState:seat=>Core.status(states[seat||"FO"]),
 press:(detent,seat="FO")=>select(seat,detent),
 release:(seat="FO")=>release(seat),
 setAlert,acknowledge,mount
});
root.addEventListener("blur",releaseAll);
root.document.addEventListener("visibilitychange",()=>{if(root.document.hidden)releaseAll();});
root.addEventListener("pagehide",releaseAll);
root.addEventListener("b737:cockpit-mounted",mount);
root.addEventListener("b737:engine-indication-view",mount);
if(root.document.readyState==="loading")root.document.addEventListener("DOMContentLoaded",start,{once:true});
else start();
})(window);