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
