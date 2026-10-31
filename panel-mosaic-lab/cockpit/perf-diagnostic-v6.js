/* PERF-0006: opt-in browser diagnostics on isolated A/B routes.
 * Samples only while the user clicks Run; no uploads, no aircraft-state writes.
 * A longtask's duration is NOT equivalent to exclusive JS CPU time.
 */
(function(){
 'use strict';
 if(!window.B737PerfDiagnosticV6)return;
 const shell=document.createElement('section');shell.id='perfDiagV6';
 shell.style.cssText='position:fixed;bottom:12px;right:12px;z-index:2147483500;width:min(370px,calc(100vw - 28px));max-height:65vh;overflow:auto;direction:ltr;background:#071622f4;border:1px solid #669bb1;border-radius:10px;padding:12px;color:#edf6fb;font:12px/1.5 system-ui;box-shadow:0 5px 20px #0009';
 const title=document.createElement('div');title.style.fontWeight='700';title.textContent='PERF-0006 · PERFORMANCE DIAGNOSTIC';
 const help=document.createElement('p');help.textContent='Focus Overhead, then run. First 3s static, next 3s controlled pan. This measures frame pacing and long tasks, not per-system CPU usage.';
 help.style.cssText='margin:6px 0 8px;color:#bdd3df';
 const run=document.createElement('button');run.textContent='Run 6s test';run.style.cssText='background:#20546b;border:1px solid #8bcade;color:white;padding:6px;border-radius:6px;cursor:pointer';
 const copy=document.createElement('button');copy.textContent='Copy report';copy.disabled=true;copy.style.cssText='margin-left:7px;background:#203545;border:1px solid #8bcade;color:white;padding:6px;border-radius:6px;cursor:pointer';
 const output=document.createElement('pre');output.style.cssText='font:11px/1.5 ui-monospace,monospace;white-space:pre-wrap;word-break:break-word;max-height:35vh;overflow:auto;color:#b7e4ed';output.textContent='Not started. Use the same zoom and viewport in both routes.';
 shell.append(title,help,run,copy,output);(document.body||document.documentElement).append(shell);
 const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
 let report=null,busy=false;
 function stage(){try{return document.getElementById('overheadFrame')?.contentWindow?.B737ABStageMetrics?.snapshot()||null;}catch{return null;}}
 function countNodes(){let n=0;const roots=[document];try{const w=document.getElementById('overheadFrame')?.contentDocument;if(w)roots.push(w);}catch{}for(const root of roots)n+=root.getElementsByTagName('*').length;return n;}
 async function segment(ms,pan,entries){
  const vp=document.getElementById('viewport');
  const initial=vp?.scrollTop||0,initialLeft=vp?.scrollLeft||0;
  const gaps=[];let prev=0,active=true,direction=1,scrollTimer=0;
  const begin=performance.now(),old=entries.length;
  function frame(t){if(!active)return;if(prev){const d=t-prev;if(d>0&&d<2000)gaps.push(d);}prev=t;requestAnimationFrame(frame);}
  requestAnimationFrame(frame);
  const startStage=stage();
  if(pan&&vp){
   scrollTimer=setInterval(()=>{
    if(vp.scrollTop>initial+110)direction=-1;
    else if(vp.scrollTop<initial-110)direction=1;
    vp.scrollTop+=direction*9;
   },38);
  }
  await sleep(ms);
  active=false;if(scrollTimer)clearInterval(scrollTimer);
  if(pan&&vp){vp.scrollTop=initial;vp.scrollLeft=initialLeft;}
  const wall=performance.now()-begin,sum=gaps.reduce((s,v)=>s+v,0),ordered=gaps.slice().sort((a,b)=>a-b);
  const tasks=entries.slice(old);
  return {durationMs:Math.round(wall),frames:gaps.length,
   fps:sum?Math.round(gaps.length*10000/sum)/10:null,
   p95FrameMs:ordered.length?Math.round(ordered[Math.floor((ordered.length-1)*.95)]*10)/10:null,
   slowFrames:gaps.filter(x=>x>34).length,
   longTasks:tasks.length,longTaskMs:Math.round(tasks.reduce((s,t)=>s+t.duration,0)),
   maxLongTaskMs:Math.round(Math.max(0,...tasks.map(x=>x.duration))),
   overheadFpsAtStart:startStage?.fps??null,overheadFpsAtEnd:stage()?.fps??null};
 }
 async function measure(){
  if(busy)return;busy=true;run.disabled=true;copy.disabled=true;report=null;
  const entries=[],obs=typeof PerformanceObserver==='function'?new PerformanceObserver(list=>{
   for(const e of list.getEntries())if(e.entryType==='longtask')entries.push({start:e.startTime,duration:e.duration});
  }):null;
  try{
   if(obs)try{obs.observe({entryTypes:['longtask']});}catch{}
   const state=stage();
   output.textContent='Measuring still view (3s)...';
   const still=await segment(3000,false,entries);
   output.textContent='Measuring controlled pan (3s)...';
   const moving=await segment(3000,true,entries);
   const mem=performance.memory?.usedJSHeapSize;
   report={schema:'PERF-0006',timestamp:new Date().toISOString(),
    mode:window.B737OverheadStaticTest?'STATIC':'FULL',
    variation:window.B737UnifiedNoCduTest?'NO_FO_CDU':window.B737UnifiedLightOverheadTest?'REAL_F_OVERHEAD':'BASELINE',
    overheadReady:!!state?.enginesReady,stageAtEnd:stage(),
    viewport:{width:innerWidth,height:innerHeight,dpr:devicePixelRatio,
     zoom:document.getElementById('zoomValue')?.textContent?.trim()||null},
    approxDomNodes:countNodes(),jsHeapMB:mem?Math.round(mem/1e6):null,
    still,moving,notes:'RAF/long tasks are indirect browser measurements; CPU script/layout/paint breakdown requires CDP Chrome trace.'};
   output.textContent=JSON.stringify(report,null,2);copy.disabled=false;
  }catch(error){output.textContent='Diagnostic error: '+error.message;}
  finally{obs?.disconnect();busy=false;run.disabled=false;}
 }
 run.addEventListener('click',measure);
 copy.addEventListener('click',async()=>{
  if(!report)return;
  const result=JSON.stringify(report,null,2);
  try{await navigator.clipboard.writeText(result);copy.textContent='Copied';}
  catch{const a=document.createElement('textarea');a.value=result;document.body.append(a);a.select();document.execCommand('copy');a.remove();copy.textContent='Copied';}
 });
 window.B737PerfProbeV6=Object.freeze({snapshot:()=>report,run:measure});
})();
