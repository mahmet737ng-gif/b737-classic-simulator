/* User-visible load diagnostics; bounded resource buffer and no telemetry/upload. */
(function(){
 'use strict';performance.setResourceTimingBufferSize(3000);const began=performance.now();let mainReady=null,mainSharpReady=null,painting=false;
 function resources(w=window,prefix='top'){const result=[];try{for(const e of [...w.performance.getEntriesByType('resource'),...w.performance.getEntriesByType('navigation')])result.push({frame:prefix,url:e.name,bytes:e.transferSize,body:e.encodedBodySize,start:e.startTime,end:e.responseEnd,cache:e.transferSize===0&&e.encodedBodySize>0});for(const f of w.document.querySelectorAll('iframe'))if(f.contentWindow)result.push(...resources(f.contentWindow,prefix+'/'+f.id));}catch{}return result;}
 function status(){const profile=window.B737AircraftProfileStore?.get();return profile&&window.CockpitStartupGate?.inspect(window,profile);}
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
 // Measure the real painted main view and live controls, independently of
 // hidden/offscreen textures or the two secondary CDU ready handshakes.
 function pollReady(){ready();if(mainReady===null&&performance.now()<60000)setTimeout(pollReady,50);}
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
  out.dataset.measurement=JSON.stringify({mainReadyMs:mainReady,mainSharpReadyMs:mainSharpReady,sharp,texture,elapsedMs:performance.now(),transferBytes:bytes,encodedBytes:samples.reduce((n,e)=>n+(e.body||0),0),requests:samples.length,largeOriginals:samples.filter(e=>/\.png(?:[?]|$)/.test(e.url)&&e.body>500000).map(e=>({url:e.url,bytes:e.body,transfer:e.bytes}))});
  out.textContent=(mainReady===null?'نمای اصلی در حال آماده‌شدن':'نمای اصلی: '+(mainReady/1000).toFixed(1)+' ثانیه')+' · وضوح: '+(mainSharpReady===null?sharp.sharp+'/'+sharp.visible:(mainSharpReady/1000).toFixed(1)+' ثانیه')+' · Decode هم‌زمان: '+(texture?.decoding??0)+' · انتقال: '+(bytes/1e6).toFixed(2)+' MB';}
 const timer=setInterval(()=>{ready();trySharp();render();},1000);
 setTimeout(()=>{clearInterval(timer);render();},60000);
 window.addEventListener('b737:texture-ready',()=>{trySharp();render();});
 window.addEventListener('b737:performance-view',render);
 document.getElementById('inspectorToggle')?.addEventListener('click',()=>queueMicrotask(render));
 window.B737LoadDiagnostics=Object.freeze({
  snapshot:()=>({started:began,mainReadyMs:mainReady,mainSharpReadyMs:mainSharpReady,sharp:sharpStatus(),textures:window.B737ImageLoader?.stats(),status:status(),elapsedMs:performance.now(),resources:resources()}),
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
 if(window.B737PerformanceAssets&&'serviceWorker'in navigator&&location.protocol!=='file:')window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js?v=PERF-0003',{scope:'./',updateViaCache:'none'}).then(()=>navigator.serviceWorker.ready).then(registration=>{registration.active?.postMessage({type:'b737:prime-used-textures',urls:resources().map(r=>r.url)});const out=document.getElementById('performanceStats');if(out)out.dataset.cache='ready';}).catch(()=>{const out=document.getElementById('performanceStats');if(out)out.dataset.cache='unavailable';}),{once:true});
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
 script.src='./interaction-profiler-v1.js?v=PROFILER-0005';
 script.async=true;
 document.head.appendChild(script);
})();
