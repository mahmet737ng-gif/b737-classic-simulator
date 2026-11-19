(async()=>{
;
/* ../../engine/afds/mcp-fcom-ch4-numeric-v1.js?v=MCP-FCOM4-0001 */
try{
/* B737 Classic MCP numeric rules — Sepehran B737CL FCOM D6-27370-300/400/500-SHI.
 * Chapter 4: 4.10.3–4.10.4 (IAS/MACH), 4.10.7–4.10.8 (ALT/V/S),
 * 4.10.13–4.10.15 (heading/course). Numeric VMO/MMO 340/.820
 * corroborated by that FCOM's FMC 11.40.44; Chapter 4 describes
 * maximum IAS/MACH as Vmo/Mmo, not an unconditional aircraft-specific limit.
 * Heading/course 000–359 in 1° rotary detents are simulation angular
 * conventions; Chapter 4 describes selector action, not the explicit endpoints.
 * Trainer-only; NOT a source for aircraft operation.
 */
(function(root,factory){'use strict';
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.B737McpFCOMCh4NumericV1=api;
})(typeof globalThis!=='undefined'?globalThis:null,function(){'use strict';
 const SPECS=Object.freeze({
  courseL:Object.freeze({min:0,max:359,step:1,slots:3,unit:'deg',source:'4.10.13–4.10.15; angle convention'}),
  courseR:Object.freeze({min:0,max:359,step:1,slots:3,unit:'deg',source:'4.10.13–4.10.15; angle convention'}),
  heading:Object.freeze({min:0,max:359,step:1,slots:3,unit:'deg',source:'4.10.13–4.10.15; angle convention'}),
  speed:Object.freeze({min:110,max:340,step:1,slots:3,unit:'KIAS',source:'4.10.3–4.10.4; Vmo reference 11.40.44'}),
  machHundredths:Object.freeze({min:60,max:82,step:1,slots:3,unit:'Mach/100',source:'4.10.4; Mmo reference 11.40.44'}),
  altitude:Object.freeze({min:0,max:50000,step:100,slots:5,unit:'feet',source:'4.10.7–4.10.8'}),
  verticalSpeed:Object.freeze({min:-7900,max:6000,step:null,slots:5,unit:'ft/min',source:'4.10.8'})
 });
 const INITIAL=Object.freeze({courseL:261,courseR:261,speed:110,
  machHundredths:60,heading:134,altitude:10000,verticalSpeed:0});
 function finite(v){return typeof v==='number'&&Number.isFinite(v)}
 function normalize(id,value){
  const spec=SPECS[id];if(!spec||!finite(value))return null;
  if(id==='courseL'||id==='courseR'||id==='heading')return ((Math.round(value)%360)+360)%360;
  const rounded=id==='verticalSpeed'?
   (Math.abs(value)<1000?Math.round(value/50)*50:Math.round(value/100)*100):
   Math.round(value/spec.step)*spec.step;
  return Math.min(spec.max,Math.max(spec.min,rounded));
 }
 function valid(id,value){
  const s=SPECS[id];if(!s||!finite(value)||!Number.isInteger(value)||value<s.min||value>s.max)return false;
  if(id==='verticalSpeed')return Math.abs(value)<1000?value%50===0:value%100===0;
  return value%s.step===0;
 }
 function nextVerticalSpeed(current,dir){
  const v=normalize('verticalSpeed',current);
  if(v===null)return null;
  const sign=Math.sign(dir);if(!sign)return v;
  const towardZero=v!==0&&Math.sign(v)!==sign;
  const increment=Math.abs(v)>1000||Math.abs(v)===1000&&!towardZero?100:50;
  return normalize('verticalSpeed',v+sign*increment);
 }
 function step(id,value,detents){
  if(!SPECS[id]||!finite(value)||!finite(detents))return null;
  let current=normalize(id,value);const count=Math.min(2000,Math.abs(Math.trunc(detents)));
  const sign=Math.sign(detents);
  for(let i=0;i<count;i++){
   if(id==='verticalSpeed')current=nextVerticalSpeed(current,sign);
   else if(id==='courseL'||id==='courseR'||id==='heading')current=((current+sign)%360+360)%360;
   else current=Math.max(SPECS[id].min,Math.min(SPECS[id].max,current+sign*SPECS[id].step));
  }
  return current;
 }
 function format(id,value,{mode='IAS',blank=false}={}){
  if(blank)return '';
  if(id==='speed'&&mode==='MACH'){
   const v=normalize('machHundredths',value);
   return v===null?'':'.'+String(v).padStart(2,'0');
  }
  if(!Object.hasOwn(SPECS,id))return '';
  const v=normalize(id,value);
  if(v===null)return '';
  if(id==='verticalSpeed')return (v===0?' ':v<0?'-':'+')+
   String(Math.abs(v)).padStart(4,'0');
  return String(v).padStart(SPECS[id].slots,'0');
 }
 return Object.freeze({VERSION:'MCP-FCOM4-0001',SPECS,INITIAL,normalize,valid,step,format,
  maxSpeed:{kias:340,machHundredths:82,source:'FCOM 11.40.44 maximum default; verify effectivity Vmo/Mmo'}});
});

}catch(error){queueMicrotask(()=>{throw error});}
;await 0;
;
/* ./mcp-rotary-gesture-v1.js?v=MCP-GESTURE-0001-SWIPE-VELOCITY */
try{
/* MCP-GESTURE-0001 — pointer-driven physical detents shared by five rotary
 * knobs and the V/S wheel. Pure interaction; no timers or electrical polls.
 * Slow touch => precise one-detent motion. Faster touch => accelerated detents.
 * The FCOM Chapter 4 selector rules, NOT this gesture model, own increments,
 * min/max, IAS/MACH mode and V/S's 50/100 fpm transition.
 */
(function(root,factory){'use strict';
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.B737McpRotaryGestureV1=api;
})(typeof globalThis!=='undefined'?globalThis:null,function(){'use strict';
 const VERSION="MCP-GESTURE-0001";
 function clamp(a,lo,hi){return Math.min(hi,Math.max(lo,a))}
 function acceleration(pxPerMs){
  // screen-space thresholds: 100px/s (precision) to 1800px/s (quick flick).
  if(pxPerMs<.20)return 1;
  if(pxPerMs<.55)return 1.5;
  if(pxPerMs<1.00)return 2.5;
  if(pxPerMs<1.80)return 4;
  return 6;
 }
 function create(opts={}){
  if(typeof opts.onDetents!=='function')throw Error("MCP gesture requires detent callback");
  const forcedAxis=opts.axis==="y"?"y":opts.axis==="x"?"x":"auto";
  const getPixels=typeof opts.pixelsPerDetent==="function"?opts.pixelsPerDetent:()=>8;
  let current=null,wheelRemainder=0;
  const audit=()=>({active:!!current,pointerId:current?.id??null,
   axis:current?.axis??null,total:current?.total??0,steps:current?.steps??0,
   accum:current?.accum??0});
  const cancel=()=>{current=null};
  function down(e){
   if(current){
    // Do not change MCP detents while a second finger begins a pinch.
    if(e?.pointerType==="touch"&&e.pointerId!==current.id)current=null;
    return false;
   }
   if(e?.pointerType==="mouse"&&e.button!==0)return false;
   if(!Number.isFinite(e?.clientX)||!Number.isFinite(e?.clientY))return false;
   current={id:e.pointerId??1,pointerType:e.pointerType||"mouse",x:e.clientX,y:e.clientY,
    lastX:e.clientX,lastY:e.clientY,lastT:Number.isFinite(e.timeStamp)?e.timeStamp:0,
    axis:forcedAxis==="auto"?null:forcedAxis,accum:0,total:0,steps:0,moved:false};
   return true;
  }
  function move(e){
   const s=current;if(!s||(e.pointerId??1)!==s.id)return 0;
   if(!Number.isFinite(e.clientX)||!Number.isFinite(e.clientY))return 0;
   const dx=e.clientX-s.lastX,dy=e.clientY-s.lastY;
   const totalX=e.clientX-s.x,totalY=e.clientY-s.y;
   const travel=Math.hypot(totalX,totalY);
   if(travel>=4)s.moved=true;
   if(!s.axis&&travel>=4)s.axis=Math.abs(totalX)>=Math.abs(totalY)?"x":"y";
   const timestamp=Number.isFinite(e.timeStamp)?e.timeStamp:s.lastT+16;
   const dt=clamp(timestamp-s.lastT||16,8,120);
   s.lastX=e.clientX;s.lastY=e.clientY;s.lastT=timestamp;
   if(!s.axis)return 0;
   const delta=s.axis==="x"?dx:-dy; // clockwise/right/up = positive
   const speed=Math.abs(delta)/dt;
   const multiplier=acceleration(speed);
   s.accum+=delta*multiplier;
   const pixelStep=clamp(Number(getPixels())||8,5,24);
   let steps=Math.trunc(s.accum/pixelStep);
   steps=clamp(steps,-60,60);
   if(steps){
    s.accum-=steps*pixelStep;
    s.steps+=Math.abs(steps);
    if(Math.abs(s.accum)>pixelStep*3)s.accum=clamp(s.accum,-pixelStep*3,pixelStep*3);
    opts.onDetents(steps,{method:"drag",pointerType:s.pointerType,
     axis:s.axis,speedPxMs:speed,acceleration:multiplier});
   }
   s.total=travel;
   return steps;
  }
  function up(e){
   const s=current;
   if(!s||(e.pointerId??1)!==s.id)return false;
   move(e);
   if(!s.moved&&s.steps===0){
    // A single tap changes EXACTLY one detent; left half decreases, right
    // half increases. No tap repeats or inertial movement after release.
    const direction=forcedAxis==="y"
     ?(typeof opts.tapDirection==="function"?opts.tapDirection(e):1)
     :(typeof opts.tapDirection==="function"?opts.tapDirection(e):1);
    if(direction)opts.onDetents(Math.sign(direction),
     {method:"tap",pointerType:s.pointerType,axis:s.axis||forcedAxis,speedPxMs:0,acceleration:1});
   }
   current=null;
   return true;
  }
  function wheel(deltaY,deltaMode=0){
   if(!Number.isFinite(deltaY)||deltaY===0)return 0;
   // A notched mouse wheel is one tick; high-resolution touchpad deltas
   // accumulate and only emit an actual detent after meaningful movement.
   const normalized=deltaMode===1?deltaY*40:deltaMode===2?deltaY*120:deltaY;
   wheelRemainder+=normalized;
   let clicks=Math.trunc(wheelRemainder/100);
   clicks=clamp(clicks,-20,20);
   if(clicks){
    wheelRemainder-=clicks*100;
    opts.onDetents(-clicks,{method:"wheel",pointerType:"wheel",axis:forcedAxis,
     acceleration:1});
   }
   return -clicks;
  }
  return Object.freeze({down,move,up,cancel,wheel,audit});
 }
 return Object.freeze({VERSION,create,acceleration});
});

}catch(error){queueMicrotask(()=>{throw error});}
;await 0;
})();
