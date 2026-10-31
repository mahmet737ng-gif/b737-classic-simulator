/* User-visible load diagnostics; bounded resource buffer and no telemetry/upload. */
(function(){
 'use strict';performance.setResourceTimingBufferSize(3000);const began=performance.now();let mainReady=null,painting=false;
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
 function render(){ready();const out=document.getElementById('performanceStats');if(!out)return;
  // The inspector drawer is normally hidden: walking thousands of Performance
  // ResourceTiming records in three browsing contexts every second is wasted
  // main-thread work. Keep the on-demand diagnostic API fully available.
  if(out.closest('#inspector')&&!document.body.classList.contains('side-open'))return;
  const samples=resources();const bytes=samples.reduce((n,e)=>n+(e.bytes||0),0);out.dataset.measurement=JSON.stringify({mainReadyMs:mainReady,elapsedMs:performance.now(),transferBytes:bytes,encodedBytes:samples.reduce((n,e)=>n+(e.body||0),0),requests:samples.length,largeOriginals:samples.filter(e=>/\.png(?:[?]|$)/.test(e.url)&&e.body>500000).map(e=>({url:e.url,bytes:e.body,transfer:e.bytes}))});out.textContent=(mainReady===null?'نمای اصلی در حال آماده‌شدن':'نمای اصلی: '+(mainReady/1000).toFixed(1)+' ثانیه')+' · انتقال ثبت‌شده: '+(bytes/1e6).toFixed(2)+' MB · '+samples.length+' درخواست';}
 const timer=setInterval(render,1000);setTimeout(()=>{clearInterval(timer);render();},60000);window.addEventListener('b737:texture-ready',render);window.addEventListener('b737:performance-view',render);
 document.getElementById('inspectorToggle')?.addEventListener('click',()=>queueMicrotask(render));
 window.B737LoadDiagnostics=Object.freeze({snapshot:()=>({started:began,mainReadyMs:mainReady,status:status(),elapsedMs:performance.now(),resources:resources()})});
 if(window.B737PerformanceAssets&&'serviceWorker'in navigator&&location.protocol!=='file:')window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js?v=PERF-0002',{scope:'./',updateViaCache:'none'}).then(()=>navigator.serviceWorker.ready).then(registration=>{registration.active?.postMessage({type:'b737:prime-used-textures',urls:resources().map(r=>r.url)});const out=document.getElementById('performanceStats');if(out)out.dataset.cache='ready';}).catch(()=>{const out=document.getElementById('performanceStats');if(out)out.dataset.cache='unavailable';}),{once:true});
})();
