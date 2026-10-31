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
