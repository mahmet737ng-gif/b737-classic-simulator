/* Owner-approved IAS/MACH knob; original MCP source pixels are never altered. */
(function(){
"use strict";
const url=new URL("./assets/mcp-ias-mach-knob.webp",document.currentScript.src).href;
const placement=Object.freeze({sourceWidth:2172,sourceHeight:433,x:596,y:286,diameter:136,detentDegrees:12});
const knobs=new Set();let detent=0;
function paint(){for(const k of knobs)k.style.setProperty("--mcp-angle",detent*placement.detentDegrees+"deg");}
function step(d,method){detent+=d;paint();window.dispatchEvent(new CustomEvent("b737:mcp-ias-mach-detent",{detail:{control:"MCP.IAS_MACH",delta:d,detent,method}}));}
function mount(){
 document.querySelectorAll('[data-piece="mcp"]').forEach(parent=>{
 if(parent.querySelector(".mcp-ias-mach-knob"))return;
 const k=document.createElement("span");k.className="mcp-ias-mach-knob";k.setAttribute("role","img");
 k.setAttribute("aria-label","IAS/MACH rotary knob");k.title="IAS/MACH · drag or wheel";
 k.style.left=100*placement.x/placement.sourceWidth+"%";
 k.style.top=100*placement.y/placement.sourceHeight+"%";
 k.style.width=100*placement.diameter/placement.sourceWidth+"%";
 k.style.backgroundImage="url("+JSON.stringify(url)+")";
 let last=null;
 k.addEventListener("pointerdown",e=>{if(e.pointerType==="mouse"&&e.button!==0)return;e.stopPropagation();last=e.clientX;k.setPointerCapture(e.pointerId)});
 k.addEventListener("pointermove",e=>{if(last===null)return;e.stopPropagation();let n=Math.trunc((e.clientX-last)/12);if(n){for(let i=0;i<Math.abs(n);i++)step(Math.sign(n),"drag");last+=12*n}});
 for(const kind of ["pointerup","pointercancel"])k.addEventListener(kind,e=>{last=null;e.stopPropagation()});
 k.addEventListener("lostpointercapture",()=>last=null);
 k.addEventListener("wheel",e=>{e.stopPropagation();e.preventDefault();step(e.deltaY<0?1:-1,"wheel")},{passive:false});
 k.addEventListener("click",e=>e.stopPropagation());
 parent.append(k);knobs.add(k);
 });
 paint();
}
window.B737McpIasMachKnob=Object.freeze({placement,getDetent:()=>detent,setDetent(v){if(Number.isFinite(v)){detent=Math.trunc(v);paint();}}});
window.addEventListener("b737:cockpit-mounted",mount);
document.addEventListener("DOMContentLoaded",mount);
if(document.readyState!=="loading")mount();
})();
