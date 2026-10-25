/* MCP-0005 / Hardware phase 2. Photo is never modified.
   Coordinates reference the 2172 x 433 blank MCP source image.
   Controls are visual training controls; AFDS authority is not claimed. */
(function(){
"use strict";
const W=2172,H=433;
const attached=new WeakSet(), all=[];
const controls=Object.freeze([
 {id:"AT_ARM",kind:"toggle",x:357,y:181,w:73,h:90,caption:"A/T ARM",state:"OFF"},
 {id:"FD_LEFT",kind:"toggle",x:210,y:350,w:54,h:76,caption:"F/D captain",state:"OFF"},
 {id:"FD_RIGHT",kind:"toggle",x:1990,y:350,w:54,h:76,caption:"F/D first officer",state:"OFF"},
 {id:"VS_WHEEL",kind:"wheel",x:1490,y:281,w:49,h:177,caption:"VERT SPEED wheel",state:0},
 {id:"CO",kind:"push",x:460,y:246,w:52,h:52,caption:"C/O",state:false},
 {id:"SPD_INTV",kind:"push",x:735,y:260,w:41,h:41,caption:"SPD INTV",state:false},
 {id:"ALT_INTV",kind:"push",x:1370,y:258,w:41,h:41,caption:"ALT INTV",state:false}
]);
const state=Object.fromEntries(controls.map(c=>[c.id,c.state]));
function change(id,value,method){
 const def=controls.find(c=>c.id===id);if(!def)return;
 const previous=state[id];
 if(def.kind==="toggle")value=value==="ARM"||value==="ON"?(id==="AT_ARM"?"ARM":"ON"):"OFF";
 if(def.kind==="push")value=Boolean(value);
 if(def.kind==="wheel"){
   value=Math.min(9900,Math.max(-9900,Math.round(Number(value)/100)*100));
   if(!Number.isFinite(value))return;
   window.B737McpVisualV3?.setValue("verticalSpeed",value);
 }
 state[id]=value;
 draw();
 if(previous!==value)window.dispatchEvent(new CustomEvent("b737:mcp-hardware-change",{detail:{id,kind:def.kind,value,previous,method,source:"MCP-0005-VISUAL"}}));
}
function draw(){
 for(const root of all)for(const el of root.querySelectorAll(".mcp-hw")){
  const id=el.dataset.mcpHardware,def=controls.find(c=>c.id===id);
  if(!def)continue;
  const v=state[id];
  el.dataset.state=String(v);
  el.setAttribute("aria-label",def.caption+" "+(typeof v==="boolean"?(v?"pressed":"released"):v));
  if(def.kind==="toggle")el.setAttribute("aria-pressed",String(v!=="OFF"));
  if(def.kind==="push")el.setAttribute("aria-pressed",String(v));
  if(def.kind==="wheel"){el.setAttribute("aria-valuenow",String(v));el.setAttribute("aria-valuetext",String(v)+" feet per minute");}
 }
}
function on(el,event,listener,options){el.addEventListener(event,listener,options);}
function mountControl(parent,c){
 const el=document.createElement("span");el.className="mcp-hw mcp-hw-"+c.kind;el.dataset.mcpHardware=c.id;
 el.tabIndex=0;el.setAttribute("role",c.kind==="wheel"?"slider":"button");
 el.style.left=(c.x/W*100)+"%";
 el.style.top=(c.y/H*100)+"%";
 el.style.width=(c.w/W*100)+"%";
 el.style.height=(c.h/H*100)+"%";
 if(c.kind==="toggle"){
  el.innerHTML='<span class="mcp-hw-toggle-foot"><span class="mcp-hw-toggle-metal"><span class="mcp-hw-toggle-head"></span></span></span>';
  on(el,"click",e=>{e.stopPropagation();change(c.id,state[c.id]==="OFF"?(c.id==="AT_ARM"?"ARM":"ON"):"OFF","click")});
  on(el,"keydown",e=>{if(e.key===" "||e.key==="Enter"){e.preventDefault();e.stopPropagation();change(c.id,state[c.id]==="OFF"?(c.id==="AT_ARM"?"ARM":"ON"):"OFF","keyboard")}});
 }else if(c.kind==="wheel"){
  el.setAttribute("aria-valuemin","-9900");el.setAttribute("aria-valuemax","9900");
  el.innerHTML='<span class="mcp-hw-wheel-axle"><span class="mcp-hw-wheel-tread"></span><span class="mcp-hw-wheel-glint"></span></span>';
  let last=null;
  on(el,"pointerdown",e=>{if(e.pointerType==="mouse"&&e.button!==0)return;e.stopPropagation();e.preventDefault();last=e.clientY;el.setPointerCapture(e.pointerId)});
  on(el,"pointermove",e=>{if(last===null)return;e.stopPropagation();let steps=Math.trunc((last-e.clientY)/9);if(steps){change(c.id,state[c.id]+steps*100,"drag");last-=steps*9}});
  on(el,"pointerup",e=>{last=null;e.stopPropagation()});
  on(el,"pointercancel",e=>{last=null;e.stopPropagation()});
  on(el,"lostpointercapture",()=>last=null);
  on(el,"wheel",e=>{e.preventDefault();e.stopPropagation();change(c.id,state[c.id]+(e.deltaY<0?100:-100),"wheel")},{passive:false});
  on(el,"keydown",e=>{if(["ArrowUp","ArrowDown","ArrowLeft","ArrowRight"].includes(e.key)){e.preventDefault();change(c.id,state[c.id]+(["ArrowUp","ArrowRight"].includes(e.key)?100:-100),"keyboard")}});
 }else{
  el.innerHTML='<span class="mcp-hw-push-bezel"><span class="mcp-hw-push-cap"></span></span>';
  on(el,"click",e=>{e.stopPropagation();change(c.id,!state[c.id],"click")});
  on(el,"keydown",e=>{if(e.key===" "||e.key==="Enter"){e.preventDefault();e.stopPropagation();change(c.id,!state[c.id],"keyboard")}});
 }
 on(el,"pointerdown",e=>e.stopPropagation());
 on(el,"wheel",e=>{if(c.kind!=="wheel")e.stopPropagation()},{passive:true});
 parent.append(el);
}
function mount(){
 document.querySelectorAll('[data-piece="mcp"]').forEach(parent=>{
  if(attached.has(parent))return;
  attached.add(parent);
  for(const c of controls)mountControl(parent,c);
  all.push(parent);
 });
 draw();
}
window.B737McpHardwareV1=Object.freeze({
 geometry:controls.map(c=>Object.freeze({...c})),
 getState:()=>({...state}),
 setState:(id,value)=>change(id,value,"external"),
 mount
});
window.addEventListener("b737:cockpit-mounted",mount);
document.addEventListener("DOMContentLoaded",mount);
if(document.readyState!=="loading")mount();
})();