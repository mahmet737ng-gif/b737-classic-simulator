/* Opt-in browser diagnostics. The recording stays in this tab. */
(function(){
 'use strict';
 const seed=window.B737BootTraceSeed;
 if(!seed)return;
 const limit=6000,recordingMs=180000,timeline=[],observers=[],frames=new WeakSet();
 const origin=performance.timeOrigin,entryTypes=window.PerformanceObserver?.supportedEntryTypes||[];
 let dropped=0,stoppedAt=null,frameRequest=0,zoomUntil=0,lastFrame=null,pendingPaint=null;
 const round=n=>Number.isFinite(n)?Math.round(n*10)/10:null;
 function path(value,base=location.href){
  try{
   const url=new URL(value,base);
   if(url.protocol!=='https:'&&url.protocol!=='http:')return '['+url.protocol+']';
   return url.origin===location.origin?url.pathname:'[external resource]';
  }catch{return '[unavailable]';}
 }
 function add(type,at,data={}){
  if(stoppedAt!==null)return;
  if(timeline.length===limit){dropped++;return;}
  timeline.push({atMs:round(at),type,...data});
 }
 function resource(e,frame,offset){
  const status=e.responseStatus||undefined;
  add(e.entryType,e.startTime+offset,{
   frame,file:path(e.name),initiator:e.initiatorType,durationMs:round(e.duration),
   requestMs:round(e.requestStart?e.requestStart-e.startTime:null),
   responseWaitMs:round(e.requestStart&&e.responseStart?e.responseStart-e.requestStart:null),
   downloadMs:round(e.responseStart?e.responseEnd-e.responseStart:null),
   transferredBytes:e.transferSize,bodyBytes:e.encodedBodySize,status,
   serviceWorker:e.workerStart>0,cache:e.deliveryType||undefined
  });
 }
 function monitor(win,frame){
  if(frames.has(win.performance))return;
  const target=win.performance,offset=target.timeOrigin-origin;
  frames.add(target);
  add('document',offset,{frame,file:path(win.location.href)});
  for(const type of ['navigation','resource','mark','measure','paint','longtask','long-animation-frame']){
   const consume=e=>{
    if(type==='resource'||type==='navigation'){resource(e,frame,offset);return;}
    if(type==='long-animation-frame'){
     add(type,e.startTime+offset,{frame,durationMs:round(e.duration),blockingMs:round(e.blockingDuration),
      scripts:(e.scripts||[]).map(script=>({
       file:script.sourceURL?path(script.sourceURL,win.location.href):null,
       startMs:round(script.startTime+offset),durationMs:round(script.duration),
       forcedLayoutMs:round(script.forcedStyleAndLayoutDuration),invokerType:script.invokerType
      }))});
     return;
    }
    if((type==='mark'||type==='measure')&&!e.name.startsWith('b737:'))return;
    add(type,e.startTime+offset,{frame,name:e.name,durationMs:round(e.duration)});
   };
   if(win.PerformanceObserver?.supportedEntryTypes?.includes(type)){
    try{
     const observer=new win.PerformanceObserver(list=>list.getEntries().forEach(consume));
     observer.observe({type,buffered:true});
     observers.push({observer,consume});
     continue;
    }catch{}
   }
   target.getEntriesByType(type).forEach(consume);
  }
  if(win!==window)win.addEventListener('error',event=>recordError(event,frame,offset),true);
 }
 function recordError(event,frame,offset=0){
  const source=event.filename||event.target?.currentSrc||event.target?.src||event.target?.href;
  if(source)add('error',event.timeStamp+offset,{frame,file:path(source),kind:event.error?.name||'resource'});
 }
 function scanFrames(win=window,name='Unified'){
  try{
   if(win!==window&&win.location.href==='about:blank')return;
   monitor(win,name);
   for(const frame of win.document.querySelectorAll('iframe[id]')){
    if(frame.contentWindow)scanFrames(frame.contentWindow,name+'/'+frame.id);
   }
  }catch{}
 }
 function frameTick(now){
  if(lastFrame!==null)add('zoom-frame',lastFrame,{durationMs:round(now-lastFrame)});
  lastFrame=now;
  if(pendingPaint){
   if(pendingPaint.firstFrame===null)pendingPaint.firstFrame=now;
   else{
    add('zoom-paint-opportunity',pendingPaint.start,{durationMs:round(now-pendingPaint.start),
     firstFrameMs:round(pendingPaint.firstFrame-pendingPaint.start),updates:pendingPaint.updates});
    pendingPaint=null;
   }
  }
  if(now<zoomUntil||pendingPaint)frameRequest=requestAnimationFrame(frameTick);
  else{frameRequest=0;lastFrame=null;}
 }
 function zoom(kind,start,scale,geometryEnd,input){
  if(stoppedAt!==null)return;
  const now=performance.now();
  add('zoom-work',start,{kind,scale:round(scale*100),durationMs:round(now-start),
   geometryMs:geometryEnd===undefined?undefined:round(geometryEnd-start),
   updateMs:geometryEnd===undefined?undefined:round(now-geometryEnd),
   inputDelayMs:input===undefined?undefined:round(Math.max(0,start-input))});
  if(!pendingPaint)pendingPaint={start,firstFrame:null,updates:0};
  pendingPaint.updates++;
  zoomUntil=now+400;
  if(!frameRequest)frameRequest=requestAnimationFrame(frameTick);
 }
 function report(){
  for(const {observer,consume} of observers)observer.takeRecords().forEach(consume);
  const diagnostics=window.B737LoadDiagnostics?.snapshot();
  return {
   schema:'unified-boot-trace/1',elapsedMs:round(stoppedAt??performance.now()),
   viewport:{width:innerWidth,height:innerHeight,dpr:devicePixelRatio,touch:navigator.maxTouchPoints>0},
   browser:{longTasks:entryTypes.includes('longtask'),
    longAnimationFrames:entryTypes.includes('long-animation-frame')},
   readiness:{fullMs:round(diagnostics?.cockpitReadyMs),mainMs:round(diagnostics?.mainReadyMs),
    sharpMs:round(diagnostics?.mainSharpReadyMs),phases:diagnostics?.cockpitMilestones,
    state:diagnostics?.cockpit},
   dropped,timeline:[...timeline].sort((a,b)=>a.atMs-b.atMs)
  };
 }
 function stop(){
  if(stoppedAt!==null)return;
  scanFrames();
  for(const {observer,consume} of observers){observer.takeRecords().forEach(consume);observer.disconnect();}
  stoppedAt=performance.now();
  clearInterval(scanTimer);
  if(frameRequest)cancelAnimationFrame(frameRequest);
 }
 const scanTimer=setInterval(scanFrames,350);
 function phase(name,start,end=performance.now()){
  add('app-phase',start,{name,durationMs:round(end-start)});
 }
 function texture(id,timeOrigin,url,extent,kind,start,end,ok){
  add('texture',start+timeOrigin-origin,{frame:id||'Unified',file:path(url),extent,kind,
   durationMs:round(end-start),ok});
 }
 window.B737BootTrace=Object.freeze({zoom,phase,texture,report,stop});
 add('trace-enabled',seed.started);
 scanFrames();
 for(const event of seed.errors)recordError(event,'Unified');
 window.removeEventListener('error',seed.onError,true);
 delete window.B737BootTraceSeed;
 window.addEventListener('error',event=>recordError(event,'Unified'),true);
 setTimeout(stop,recordingMs);
 function mount(){
  const panel=document.createElement('aside');
  panel.id='unifiedBootTrace';
  panel.setAttribute('aria-label','Unified performance recording');
  panel.style.cssText='position:fixed;right:10px;bottom:10px;z-index:2147483000;max-width:min(360px,calc(100vw - 20px));padding:10px;background:#102434;color:#eff9ff;border:1px solid #7ab5cb;border-radius:8px;font:13px system-ui;text-align:left';
  const state=document.createElement('div');
  state.setAttribute('role','status');
  const copy=document.createElement('button');
  copy.type='button';copy.textContent='Copy report';
  const download=document.createElement('button');
  download.type='button';download.textContent='Download JSON';
  copy.onclick=async()=>{
   const contents=JSON.stringify(report());
   try{
    await navigator.clipboard.writeText(contents);
    copy.textContent='Copied';
   }catch{
    const field=document.createElement('textarea');
    field.value=contents;field.setAttribute('aria-label','Performance report JSON');
    field.style.cssText='display:block;width:100%;height:60px';
    panel.querySelector('textarea')?.remove();
    panel.append(field);field.focus();field.select();
    copy.textContent='Select and copy JSON';
   }
  };
  download.onclick=()=>{
   const url=URL.createObjectURL(new Blob([JSON.stringify(report(),null,2)],{type:'application/json'}));
   const link=document.createElement('a');link.href=url;link.download='unified-boot-trace.json';link.click();
   setTimeout(()=>URL.revokeObjectURL(url),1000);
  };
  panel.append(state,copy,download);
  document.body.append(panel);
  function refresh(){
   const ms=document.documentElement.dataset.unifiedCockpitReadyMs;
   const message=stoppedAt!==null?'Recording ended. The report is ready.':
    ms?'Full cockpit ready in '+(Number(ms)/1000).toFixed(2)+' s. Zoom now, then copy the report.':
     'Recording startup. Copy a report even if startup stalls.';
   if(state.textContent!==message)state.textContent=message;
   if(stoppedAt===null)setTimeout(refresh,500);
  }
  refresh();
 }
 if(document.body)mount();
 else document.addEventListener('DOMContentLoaded',mount,{once:true});
})();
