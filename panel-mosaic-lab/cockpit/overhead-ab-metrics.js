/* PERF-0005: A/B paint telemetry (display-only; no backend modifications). */
(function(){
 'use strict';
 const gaps=[];let last=0,frames=0,latest=0;
 function frame(t){if(last){const delta=t-last;if(delta>0&&delta<2000){gaps.push(delta);if(gaps.length>180)gaps.shift();frames++;}}last=t;latest=t;requestAnimationFrame(frame);}
 requestAnimationFrame(frame);
 window.B737ABStageMetrics=Object.freeze({snapshot:()=>{
  const length=gaps.length,sorted=gaps.slice().sort((a,b)=>a-b),sum=gaps.reduce((s,v)=>s+v,0);
  return {mode:document.documentElement.dataset.overheadRenderAb||'unknown',
   fps:length&&sum?Math.round(length*10000/sum)/10:null,
   p95FrameMs:length?Math.round(sorted[Math.min(length-1,Math.floor(length*.95))]*10)/10:null,
   slowFrames:gaps.filter(d=>d>34).length,frames,visible:document.visibilityState==='visible',
   visualOverlays:document.querySelectorAll('#atlasAbsolute .toggle-layer,#atlasAbsolute .rg-layer,#atlasAbsolute .lights-layer').length,
   enginesReady:!!(window.B737OverheadLights&&window.B737RotaryGuards)};
 }});
})();
