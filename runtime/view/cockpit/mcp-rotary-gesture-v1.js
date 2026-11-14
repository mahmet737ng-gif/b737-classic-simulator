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
