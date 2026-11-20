(async()=>{
;
/* ../desktop-shell/startup-gate.js?v=UNIFIED-READY-0006 */
try{
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.CockpitStartupGate=api;})(typeof window==='undefined'?globalThis:window,function(){
 'use strict';
 function intersects(a,b){return a.width>0&&a.height>0&&a.right>b.left&&a.left<b.right&&a.bottom>b.top&&a.top<b.bottom;}
 function visibleImagesReady(w){
  const d=w.document,viewport=d.getElementById('viewport')?.getBoundingClientRect();
  if(!viewport)return false;
  const images=[...d.querySelectorAll('#region-main .texture-piece > img')].filter(img=>{
   const style=w.getComputedStyle(img);
   return style.display!=='none'&&style.visibility!=='hidden'&&style.opacity!=='0'&&intersects(img.parentElement.getBoundingClientRect(),viewport);
  });
  return images.length>0&&images.every(img=>img.complete&&img.naturalWidth>0);
 }
 function imagesReady(root,selector,minimum=1){
  const images=root?.querySelectorAll(selector);
  return (images?.length||0)>=minimum&&Array.from(images,img=>img.complete&&img.naturalWidth>0).every(Boolean);
 }
 function inspectFull(w,profile,main=inspect(w,profile)){
  const d=w.document;
  const result={electrical:false,overhead:false,cdu:false,pedestal:false,instruments:false,complete:false};
  try{
   result.electrical=w.B737ISNCockpitV1?.startupSynchronized?.()===true;
   const overhead=d.getElementById('overheadFrame')?.contentDocument;
   const releaseArt=w.B737GatewayBoot?.art;
   const needlesRestored=
    (!releaseArt?.oh10||Boolean(overhead?.querySelector('.atlas-piece[data-key="OH10"][data-static-needle-photo="CLEANED"]')))&&
    (!releaseArt?.oh12||Boolean(overhead?.querySelector('.atlas-piece[data-key="OH12"][data-apu-egt-photo="CLEANED"]')));
   result.overhead=main.overhead&&needlesRestored&&imagesReady(overhead,'#atlasAbsolute .atlas-photo')&&
    (profile.pressurization!=='DCPCS'||imagesReady(overhead,'.dcpcs-owner-oh22-background > img'))&&
    (profile.aircraftFamily!=='B737-400'||imagesReady(overhead,'.b737-400-owner-oh20-background > img'))&&
    imagesReady(overhead,'.asp-control-image');
   result.cdu=main.cdu&&(w.B737UnifiedNoCduTest||['CAPT','FO'].every(seat=>
    imagesReady(d.getElementById('cduFrame'+seat)?.contentDocument,'#cdu-stage img.base')));
   result.pedestal=imagesReady(d,'#region-pedestal .texture-piece > img')&&
    w.B737ThrottlePositions?.mounted?.()===true&&
    d.querySelectorAll('#region-pedestal .engine-start-lever').length===2&&
    (!releaseArt?.engine1||d.querySelectorAll('.engine-start-lever-art image[data-boot-ready="true"]').length===2)&&
    imagesReady(d,'#region-pedestal .fire-handle-control > img',3)&&
    imagesReady(d,'.throttle-state-sprite',10)&&imagesReady(d,'.asp-control-image');
   const eadiSeats=['CAPT','FO'];
   result.instruments=eadiSeats.every(seat=>
    Number(d.querySelector('[data-eadi-stage1-seat="'+seat+'"]')?.dataset.eadiPaintCount)>0&&
    !!d.getElementById('unifiedEhsi'+seat))&&
    !!d.querySelector(profile.engineInstruments==='CONVENTIONAL'?
     '.conventional-engine-needle-layer-v1 [data-render-angle]':'[data-isn-engine-gauges] [data-pointer]');
   result.complete=main.usable&&result.electrical&&result.overhead&&result.cdu&&result.pedestal&&result.instruments;
  }catch{}
  return result;
 }
 function inspect(w,profile){
  const result={profile:false,main:false,controls:false,overhead:false,cdu:false,usable:false};
  try{
   const d=w.document,p=w.B737AircraftProfileStore?.get();
   result.profile=!!p&&['aircraftFamily','pressurization','engineInstruments'].every(k=>p[k]===profile[k]);
   result.main=!!d.getElementById('region-main')&&visibleImagesReady(w);
   if(p?.engineInstruments==='CONVENTIONAL'){
    const photos=[d.querySelector('.conventional-engine-panel-v1'),d.querySelector('#fo-owner-panel-v1 > img')];
    result.main=result.main&&d.documentElement.dataset.engineIndication==='CONVENTIONAL'&&photos.every(img=>img&&img.complete&&img.naturalWidth>0);
   }
   result.controls=!!w.B737ISNCockpitV1&&!!d.querySelector('[data-mcp-hardware="AT_ARM"]');
   result.overhead=!!d.querySelector('#overheadStatus')?.textContent?.includes('Connected');
   result.cdu=!!d.querySelector('.cdu-station[data-seat="CAPT"].ready')&&!!d.querySelector('.cdu-station[data-seat="FO"].ready');
   result.usable=result.profile&&result.main&&result.controls;
  }catch{}
  return result;
 }
 return {inspect,inspectFull,visibleImagesReady,intersects};
});

}catch(error){queueMicrotask(()=>{throw error});}
;await 0;
;
/* ./performance-metrics.js?v=PERF-FAST-SW-0008 */
try{
/* User-visible load diagnostics; bounded resource buffer and no telemetry/upload. */
(function(){
 'use strict';performance.setResourceTimingBufferSize(3000);const began=performance.now();let mainReady=null,mainSharpReady=null,cockpitReady=null,systemsReady=null,painting=false,cockpitPainting=false,readyState=null;
 const cockpitMilestones={};
 function resources(w=window,prefix='top'){const result=[];try{for(const e of [...w.performance.getEntriesByType('resource'),...w.performance.getEntriesByType('navigation')])result.push({frame:prefix,url:e.name,bytes:e.transferSize,body:e.encodedBodySize,start:e.startTime,end:e.responseEnd,cache:e.transferSize===0&&e.encodedBodySize>0});for(const f of w.document.querySelectorAll('iframe'))if(f.contentWindow)result.push(...resources(f.contentWindow,prefix+'/'+f.id));}catch{}return result;}
 function status(){const profile=window.B737AircraftProfileStore?.get();return profile&&window.CockpitStartupGate?.inspect(window,profile);}
 function fullStatus(){
  const profile=window.B737AircraftProfileStore?.get();
  const current=profile&&window.CockpitStartupGate?.inspectFull(window,profile);
  if(current)for(const [part,ready] of Object.entries(current))
   if(ready&&part!=='complete')cockpitMilestones[part]??=Math.round(performance.now());
  return current;
 }
 function ready(){
  if(mainReady!==null||painting)return;
  if(!status()?.usable)return;
  painting=true;
  requestAnimationFrame(()=>requestAnimationFrame(()=>{
   painting=false;if(!status()?.usable)return;
   mainReady=performance.now();performance.mark('b737:unified-usable');
   document.documentElement.dataset.unifiedUsableMs=String(Math.round(mainReady));
   window.dispatchEvent(new CustomEvent('b737:unified-usable',{detail:{mainReadyMs:mainReady}}));
  }));
 }
 function trySystemsReady(){
  if(systemsReady!==null)return;
  // Live ECU ownership and shared FMC state are independent of photo paint.
  // A cold/dark or inoperative instrument must never be falsely marked live.
  if(window.B737ISNCockpitV1?.startupSynchronized?.()!==true||
     !window.B737UnifiedFmc||!window.B737AircraftProfileStore?.get?.())return;
  systemsReady=performance.now();
  document.documentElement.dataset.unifiedSystemsReadyMs=String(Math.round(systemsReady));
  performance.mark('b737:systems-ready');
  window.dispatchEvent(new CustomEvent('b737:systems-ready',{detail:{systemsReadyMs:systemsReady}}));
 }
 function tryCockpitReady(){
  if(cockpitReady!==null||cockpitPainting||mainReady===null||mainSharpReady===null||!fullStatus()?.complete)return;
  cockpitPainting=true;
  requestAnimationFrame(()=>requestAnimationFrame(()=>{
   cockpitPainting=false;
   const state=fullStatus();
   if(!state?.complete)return;
   readyState=state;
   cockpitReady=performance.now();
   performance.mark('b737:unified-cockpit-ready');
   document.documentElement.dataset.unifiedCockpitReadyMs=String(Math.round(cockpitReady));
   document.documentElement.dataset.unifiedFullyOperationalMs=String(Math.round(cockpitReady));
   performance.mark('b737:fully-operational');
   window.dispatchEvent(new CustomEvent('b737:fully-operational',{detail:{fullyOperationalMs:cockpitReady}}));
  }));
 }
 // Keep first usable paint separate from the complete interactive cockpit.
 function pollReady(){
  ready();trySharp();trySystemsReady();tryCockpitReady();
  const elapsed=performance.now();
  if(cockpitReady===null&&elapsed<180000)setTimeout(pollReady,elapsed<15000?100:250);
 }
 pollReady();
 function sharpStatus(){
  const area=document.getElementById('viewport')?.getBoundingClientRect();
  if(!area)return {visible:0,sharp:0,ready:false};
  let visible=0,sharp=0;
  const dpr=Math.min(window.devicePixelRatio||1,2);
  for(const img of document.querySelectorAll('#region-main .texture-piece > img')){
   const host=img.parentElement,r=host?.getBoundingClientRect();
   if(!r||r.right<area.left||r.left>area.right||r.bottom<area.top||r.top>area.bottom)continue;
   visible++;
   const rect=img.getBoundingClientRect();
   const desired=Math.max(rect.width,rect.height)*dpr;
   const quality=Number(img.dataset.perfExtent)||0;
   // The full original is the upper limit even on ultra-high-DPI displays.
   const native=Math.max(Number(img.getAttribute('width'))||0,Number(img.getAttribute('height'))||0);
   if(img.complete&&img.naturalWidth>0&&(quality>=desired||(native>0&&quality>=native)))sharp++;
  }
  return {visible,sharp,ready:visible>0&&visible===sharp};
 }
 function trySharp(){
  if(mainSharpReady!==null||mainReady===null)return;
  if(!sharpStatus().ready)return;
  mainSharpReady=performance.now();
  document.documentElement.dataset.unifiedSharpMs=String(Math.round(mainSharpReady));
  window.dispatchEvent(new CustomEvent('b737:unified-sharp',{detail:{mainSharpReadyMs:mainSharpReady}}));
 }
 function render(){ready();trySharp();const out=document.getElementById('performanceStats');if(!out)return;
  // The inspector drawer is normally hidden: walking thousands of Performance
  // ResourceTiming records in three browsing contexts every second is wasted
  // main-thread work. Keep the on-demand diagnostic API fully available.
  if(out.closest('#inspector')&&!document.body.classList.contains('side-open'))return;
  const samples=resources();const bytes=samples.reduce((n,e)=>n+(e.bytes||0),0),sharp=sharpStatus();
  const texture=window.B737ImageLoader?.stats();
  out.dataset.measurement=JSON.stringify({visualReadyMs:Number(document.documentElement.dataset.unifiedVisualReadyMs)||null,systemsReadyMs:systemsReady,fullyOperationalMs:cockpitReady,cockpitReadyMs:cockpitReady,mainReadyMs:mainReady,mainSharpReadyMs:mainSharpReady,sharp,texture,elapsedMs:performance.now(),transferBytes:bytes,encodedBytes:samples.reduce((n,e)=>n+(e.body||0),0),requests:samples.length,largeOriginals:samples.filter(e=>/\.png(?:[?]|$)/.test(e.url)&&e.body>500000).map(e=>({url:e.url,bytes:e.body,transfer:e.bytes}))});
  out.textContent='VISUAL: '+((Number(document.documentElement.dataset.unifiedVisualReadyMs)||0)/1000||0).toFixed(1)+'s · SYSTEMS: '+(systemsReady===null?'Connecting':(systemsReady/1000).toFixed(1)+'s')+' · '+(mainReady===null?'Main view loading':'Main view: '+(mainReady/1000).toFixed(1)+' seconds')+' · FULLY OPERATIONAL: '+(cockpitReady===null?'Loading':(cockpitReady/1000).toFixed(1)+' seconds')+' · Sharpness: '+(mainSharpReady===null?sharp.sharp+'/'+sharp.visible:(mainSharpReady/1000).toFixed(1)+' seconds')+' · Concurrent Decode: '+(texture?.decoding??0)+' · Transfer: '+(bytes/1e6).toFixed(2)+' MB';}
 const timer=setInterval(()=>{ready();trySharp();render();},1000);
 setTimeout(()=>{clearInterval(timer);render();},60000);
 window.addEventListener('b737:texture-ready',()=>{trySharp();render();});
 window.addEventListener('b737:performance-view',render);
 document.getElementById('inspectorToggle')?.addEventListener('click',()=>queueMicrotask(render));
 window.B737LoadDiagnostics=Object.freeze({
  snapshot:()=>({started:began,visualReadyMs:Number(document.documentElement.dataset.unifiedVisualReadyMs)||null,systemsReadyMs:systemsReady,fullyOperationalMs:cockpitReady,cockpitReadyMs:cockpitReady,cockpit:fullStatus(),readyState,cockpitMilestones:{...cockpitMilestones},mainReadyMs:mainReady,mainSharpReadyMs:mainSharpReady,sharp:sharpStatus(),textures:window.B737ImageLoader?.stats(),status:status(),elapsedMs:performance.now(),resources:resources()}),
  measureFps:(durationMs=3000)=>new Promise(resolve=>{
   const length=Math.max(500,Math.min(10000,Number(durationMs)||3000));
   const start=performance.now();let last=null,count=0,slowFrames=0,longestFrameMs=0;
   function frame(now){
    if(last!==null){
     const delta=now-last;count++;
     longestFrameMs=Math.max(longestFrameMs,delta);
     if(delta>34)slowFrames++;
    }
    last=now;
    if(now-start>=length)resolve({fps:Math.round(count*1000/(now-start)*10)/10,slowFrames,longestFrameMs:Math.round(longestFrameMs),sampleMs:Math.round(now-start)});
    else requestAnimationFrame(frame);
   }
   requestAnimationFrame(frame);
  })
 });
 if(!window.B737GatewayBoot&&window.B737PerformanceAssets&&'serviceWorker'in navigator&&location.protocol!=='file:'){
  // Register after first usable paint. Cache future requests on demand rather
  // than scanning/copying every resource while the rest of the cockpit starts.
  window.addEventListener('b737:unified-usable',()=>{
   const out=document.getElementById('performanceStats');
   navigator.serviceWorker.register('./sw.js?v=PERF-0005',{scope:'./',updateViaCache:'none'})
    .then(()=>navigator.serviceWorker.ready)
    .then(()=>{if(out)out.dataset.cache='ready';})
    .catch(()=>{if(out)out.dataset.cache='unavailable';});
  },{once:true});
 }
})();

;(function tapLagAddon(){
 /* TAP-LAG-0001 — opt-in interaction timing; no state writes or uploads. */
 if(new URLSearchParams(location.search).get('tapLag')!=='1')return;
 const taps=[],events=[],longTasks=[],attached=new WeakSet();
 let box,stats,lines,panButton,panResult=null,panRunning=false;
 const round=n=>Math.round(n*10)/10;
 function percentile(values,p){if(!values.length)return null;const a=[...values].sort((x,y)=>x-y);return round(a[Math.max(0,Math.ceil(a.length*p)-1)]);}
 function aggregate(values){return {count:values.length,median:percentile(values,.5),p95:percentile(values,.95),max:values.length?round(Math.max(...values)):null};}
 function report(){return {version:'TAP-LAG-0001',warning:'RAF bound is paint opportunity, NOT verified physical switch state change',
  tapToPaintOpportunity:aggregate(taps.map(x=>x.tapMs)),clickToPaintOpportunity:aggregate(taps.map(x=>x.clickMs)),
  eventInputDelay:aggregate(events.map(x=>x.delayMs)),browserEventCount:events.length,
  longTaskCount:longTasks.length,longTaskTotalMs:round(longTasks.reduce((a,b)=>a+b.durationMs,0)),pan:panResult,
  recentTaps:taps.slice(-30),recentBrowserEvents:events.slice(-20)};}
 function render(){if(!stats)return;const r=report();stats.textContent=`Tap → next paint opportunity: ${r.tapToPaintOpportunity.count} samples\nMedian ${r.tapToPaintOpportunity.median??'—'} ms · P95 ${r.tapToPaintOpportunity.p95??'—'} ms · Max ${r.tapToPaintOpportunity.max??'—'} ms\nBrowser input queue P95 ${r.eventInputDelay.p95??'—'} ms · Long tasks ${r.longTaskCount}\nPan FPS ${r.pan?.fps??'—'} · 95% frame ${r.pan?.p95FrameMs??'—'} ms`;
  lines.textContent=taps.slice(-5).map(x=>`${x.frame} · ${x.control}: ${x.tapMs} ms`).join('\n')||'Tap switches in the cockpit to collect samples.';}
 function attach(w,frame){
  try{
   if(!w?.document||attached.has(w))return;attached.add(w);
   const starts=new Map();
   const valid=e=>e.target instanceof w.Element&&!e.target.closest('#unifiedTapLagDiagnostic')&&(frame!=='main'||!!e.target.closest('#viewport'));
   w.document.addEventListener('pointerdown',e=>{
    if(!valid(e)||e.isPrimary===false)return;
    starts.set(e.pointerId??0,{at:e.timeStamp,control:String(e.target.getAttribute('aria-label')||e.target.id||e.target.className||e.target.tagName).slice(0,48)});
    if(starts.size>12)starts.clear();
   },true);
   w.document.addEventListener('click',e=>{
    if(!valid(e))return;
    const id=e.pointerId??0,s=starts.get(id)||[...starts.values()].at(-1),clickAt=e.timeStamp;
    const at=s&&clickAt>=s.at&&clickAt-s.at<3000?s.at:clickAt;
    starts.delete(id);
    w.requestAnimationFrame(()=>w.requestAnimationFrame(paintAt=>{
     taps.push({frame,control:s?.control||String(e.target.id||e.target.tagName),tapMs:round(Math.max(0,paintAt-at)),clickMs:round(Math.max(0,paintAt-clickAt))});
     if(taps.length>150)taps.shift();render();
    }));
   },true);
   if(w.PerformanceObserver){
    try{const o=new w.PerformanceObserver(list=>{for(const e of list.getEntries()){
     if(!['click','pointerdown','pointerup'].includes(e.name))continue;
     events.push({frame,type:e.name,delayMs:round(Math.max(0,e.processingStart-e.startTime)),totalMs:round(e.duration)});
     if(events.length>150)events.shift();}render();});o.observe({type:'event',durationThreshold:16});}catch{}
    try{const o=new w.PerformanceObserver(list=>{for(const e of list.getEntries()){
     longTasks.push({frame,durationMs:round(e.duration)});if(longTasks.length>150)longTasks.shift();}render();});o.observe({type:'longtask'});}catch{}
   }
  }catch{}
 }
 function frames(){for(const el of document.querySelectorAll('iframe')){
   if(el.dataset.tapLagTracked)return;el.dataset.tapLagTracked='1';
   const join=()=>{try{attach(el.contentWindow,el.id||'embedded');}catch{}};
   el.addEventListener('load',join);join();
 }}
 function pan(){if(panRunning)return;panRunning=true;panButton.disabled=true;panButton.textContent='Swipe now for five seconds...';
  const begin=performance.now(),gaps=[];let prev=null,n=0;
  const frame=t=>{n++;if(prev!==null)gaps.push(t-prev);prev=t;
   if(t-begin<5000){requestAnimationFrame(frame);return;}
   panResult={fps:round(n*1000/(t-begin)),p95FrameMs:percentile(gaps,.95),maxFrameMs:round(Math.max(0,...gaps)),slowFrames:gaps.filter(v=>v>34).length};
   panRunning=false;panButton.disabled=false;panButton.textContent='Measure pan (5s)';render();};requestAnimationFrame(frame);
 }
 function start(){
  box=document.createElement('aside');box.id='unifiedTapLagDiagnostic';box.style.cssText='position:fixed;bottom:8px;left:8px;z-index:2147483000;width:min(350px,calc(100vw - 16px));max-height:42vh;overflow:auto;border:1px solid #739fb4;border-radius:9px;background:#071925f2;color:#e5f3ff;padding:9px;direction:ltr;text-align:left;font:11px/1.5 system-ui';
  const title=document.createElement('strong');title.textContent='Unified · Tap latency diagnostic';
  const note=document.createElement('p');note.textContent='Approximate next-paint timing, not exact switch-state timing. No data leaves the device.';note.style.color='#a8c8da';
  stats=document.createElement('pre');stats.style.whiteSpace='pre-wrap';lines=document.createElement('pre');lines.style.whiteSpace='pre-wrap';
  panButton=document.createElement('button');panButton.textContent='Measure pan (5s)';panButton.onclick=pan;
  const copy=document.createElement('button');copy.textContent='Copy JSON';copy.onclick=async()=>{const value=JSON.stringify(report(),null,2);try{await navigator.clipboard.writeText(value);}catch{const t=document.createElement('textarea');t.value=value;document.body.append(t);t.select();document.execCommand('copy');t.remove();}};
  for(const b of [panButton,copy])b.style.cssText='margin:3px;color:white;background:#20566e;border:1px solid #8fb9ce;border-radius:5px;padding:4px 6px';
  box.append(title,note,stats,lines,panButton,copy);document.body.append(box);
  attach(window,'main');frames();window.addEventListener('b737:cockpit-mounted',frames);
  window.B737TapLagDiagnostic=Object.freeze({report,measurePan:pan});render();
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();

/* PROFILER-0001: opt-in diagnostics, zero cost in normal sessions. */
;(function(){
 if(new URLSearchParams(location.search).get('profiler')!=='1')return;
 const script=document.createElement('script');
 script.src='./interaction-profiler-v1.js?v=PROFILER-0007';
 script.async=true;
 document.head.appendChild(script);
})();

}catch(error){queueMicrotask(()=>{throw error});}
;await 0;
})();
