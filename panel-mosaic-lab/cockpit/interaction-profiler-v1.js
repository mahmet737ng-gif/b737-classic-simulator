/* Unified opt-in interaction profiler.
 * Enable with ?profiler=1. No network, no persistent storage, no aircraft writes.
 * Timing labels deliberately distinguish observable DOM changes from aircraft state.
 */
(function(root){
 'use strict';
 if(!root?.document||new URLSearchParams(root.location.search).get('profiler')!=='1')return;
 if(root.B737InteractionProfilerV1)return;
 const VERSION='UNIFIED-PROFILER-0002', MAX=160, samples=[],eventTimings=[],longTasks=[],work=[], attached=new WeakSet();
 const origin=root.performance.timeOrigin, active=new Set(), round=n=>Math.round(n*10)/10;
 let panel,summary,detail,panButton,panTest=null,measuringPan=false;
 function now(w=root){return w.performance.now()+w.performance.timeOrigin-origin;}
 function timestamp(w,e){const v=Number(e.timeStamp);return !Number.isFinite(v)?now(w):v>1e12?v-origin:v+w.performance.timeOrigin-origin;}
 function percentile(a,p){if(!a.length)return null;const v=a.filter(Number.isFinite).sort((x,y)=>x-y);return v.length?round(v[Math.max(0,Math.ceil(v.length*p)-1)]):null;}
 function stat(a){const v=a.filter(Number.isFinite);return {count:v.length,p50:percentile(v,.5),p95:percentile(v,.95),max:v.length?round(Math.max(...v)):null};}
 function keep(a,x){a.push(x);if(a.length>MAX)a.shift();}
 function markWork(name,durationMs){if(typeof name!=='string'||!Number.isFinite(durationMs)||durationMs<0)return;keep(work,{name:name.slice(0,70),durationMs:round(durationMs),timeMs:round(now())});paint();}
 function report(){
  const durations=key=>samples.map(s=>s[key]);
  return {version:VERSION,provisional:true,
   notes:['Click task completion is an event-loop bound, not isolated simulation time.',
    'Local DOM mutation is an observed control visual change, NOT proven aircraft-system state.',
    'Electrical event timing is temporal correlation only; another update may have caused it.',
    'Two requestAnimationFrame callbacks indicate a paint opportunity, not verified pixels on glass.',
    'Browser Event Timing is only reported when supported. Long tasks seen in several iframes can overlap and must not be summed as exclusive CPU time.',
    'Pointerup records completed taps even when the browser does not fire click; task duration uses the recorded trigger event.'],
   count:samples.length,interactionTriggers:Object.fromEntries([...new Set(samples.map(s=>s.trigger))].map(k=>[k,samples.filter(x=>x.trigger===k).length])),clickTaskMs:stat(durations('clickTaskMs')),
   tapToDomSignalMs:stat(durations('tapToDomSignalMs')),
   tapToPaintOpportunityMs:stat(durations('tapToPaintOpportunityMs')),
   tapToElectricalSignalMs:stat(durations('tapToElectricalSignalMs')),
   browserInputQueueMs:stat(eventTimings.map(x=>x.queueMs)),
   longTasks:{count:longTasks.length,totalDurationMs:round(longTasks.reduce((n,x)=>n+x.durationMs,0)),p95Ms:percentile(longTasks.map(x=>x.durationMs),.95),
    byFrame:Object.fromEntries([...new Set(longTasks.map(x=>x.frame))].map(frame=>[frame,stat(longTasks.filter(x=>x.frame===frame).map(x=>x.durationMs))]))},
   pan:panTest,workByName:Object.fromEntries([...new Set(work.map(x=>x.name))].map(name=>[name,stat(work.filter(x=>x.name===name).map(x=>x.durationMs))])),
   recentInteractions:samples.slice(-35),recentWork:work.slice(-35),recentInputEvents:eventTimings.slice(-35),
   recentLongTasks:longTasks.slice(-20)};
 }
 function value(n){return n==null?'—':n+' ms';}
 let refreshTimer=0;
 function paint(){
  if(refreshTimer)return;
  refreshTimer=root.setTimeout(update,140);
 }
 function update(){
  refreshTimer=0;
  if(!summary)return;
  const s=report();
  summary.textContent='Tap → paint P95: '+value(s.tapToPaintOpportunityMs.p95)+' · DOM change P95: '+value(s.tapToDomSignalMs.p95)+
   '\nInput queue P95: '+value(s.browserInputQueueMs.p95)+' · Electrical signal P95: '+value(s.tapToElectricalSignalMs.p95)+
   '\nCompleted taps: '+s.count+' · Long-task observations: '+s.longTasks.count+' · Pan FPS: '+(s.pan?.fps??'—');
  if(detail&&!detail.hidden)detail.textContent=JSON.stringify({recent:s.recentInteractions.slice(-8),work:s.workByName,pan:s.pan},null,2);
 }
 function ignore(node){return !node?.closest||!!node.closest('#unifiedInteractionProfiler');}
 function label(node){
  const n=node?.closest?.('[aria-label],[data-control],button,[role="switch"],[role="button"],[role="slider"],.mounted-switch,.mounted-light,.rotary,.knob,.toggle,.lever')||node;
  return String(n?.getAttribute?.('aria-label')||n?.getAttribute?.('data-control')||n?.id||n?.className?.baseVal||n?.className||n?.tagName||'control').slice(0,85);
 }
 function controlHost(node){
  return node?.closest?.('button,[role="switch"],[role="button"],[role="slider"],[data-control],.mounted-switch,.mounted-light,.rotary,.knob,.toggle,.lever')||node;
 }
 function onSignal(name){
  const t=now();
  for(const s of active){
   if(s.tapToElectricalSignalMs!=null||t-s.tapAt>1800||t<s.clickAt)continue;
   s.tapToElectricalSignalMs=round(t-s.tapAt);
   s.electricalSignalName=name;
  }
  paint();
 }
 const signals=['b737:electrical-network','b737:electrical-v7-state','b737:electrical-distribution-changed'];
 for(const name of signals)root.addEventListener(name,()=>onSignal(name),{passive:true});
 function attach(w,name){
  try{
   const doc=w.document;
   if(!doc||attached.has(doc))return;
   attached.add(doc);
   const starts=new Map();
   doc.addEventListener('pointerdown',e=>{
    if(e.isPrimary===false||ignore(e.target))return;
    starts.set(e.pointerId??1,{tapAt:timestamp(w,e),x:e.clientX,y:e.clientY,moved:false,control:label(e.target)});
    if(starts.size>12)starts.clear();
   },true);
   doc.addEventListener('pointermove',e=>{
    const p=starts.get(e.pointerId??1);
    if(p&&Math.hypot(e.clientX-p.x,e.clientY-p.y)>13)p.moved=true;
   },{capture:true,passive:true});
   doc.addEventListener('pointercancel',e=>starts.delete(e.pointerId??1),true);
   // Some mobile cockpit switches use pointerup rather than click. Capture
   // the completed stationary tap at pointerup, then merge a subsequent
   // synthetic click instead of reporting two separate interactions.
   const pendingClick=new Map();
   function sampleInteraction(e,pointer,trigger){
    const at=timestamp(w,e),tapAt=pointer&&at>=pointer.tapAt&&at-pointer.tapAt<2200?pointer.tapAt:at;
    const sample={frame:name,control:pointer?.control||label(e.target),trigger,
     tapAt:round(tapAt),clickAt:round(at),hasClick:trigger==='click',
     inputToClickMs:trigger==='click'?round(Math.max(0,at-tapAt)):null,
     clickTaskMs:null,tapToDomSignalMs:null,tapToPaintOpportunityMs:null,
     tapToElectricalSignalMs:null,electricalSignalName:null};
    keep(samples,sample);active.add(sample);
    const host=controlHost(e.target);
    let observer=null;
    if(host?.nodeType===1){
     observer=new w.MutationObserver(records=>{
      if(sample.tapToDomSignalMs!=null)return;
      const meaningful=records.some(r=>r.type!=='attributes'||r.oldValue!==r.target.getAttribute(r.attributeName));
      if(meaningful){sample.tapToDomSignalMs=round(Math.max(0,now(w)-tapAt));paint();}
     });
     try{observer.observe(host,{subtree:true,attributes:true,attributeOldValue:true,
      attributeFilter:['class','style','src','aria-checked','aria-pressed','data-state','data-position','data-frame','data-value'],
      characterData:true,childList:true});}catch{observer.disconnect();observer=null;}
    }
    w.queueMicrotask(()=>{sample.clickTaskMs=round(Math.max(0,now(w)-at));paint();});
    w.requestAnimationFrame(()=>w.requestAnimationFrame(()=>{
     sample.tapToPaintOpportunityMs=round(Math.max(0,now(w)-tapAt));paint();
    }));
    w.setTimeout(()=>{observer?.disconnect();active.delete(sample);paint();},1900);
    paint();
    return sample;
   }
   doc.addEventListener('pointerup',e=>{
    const key=e.pointerId??1,pointer=starts.get(key);
    starts.delete(key);
    if(!pointer||pointer.moved||Math.hypot(e.clientX-pointer.x,e.clientY-pointer.y)>13||ignore(e.target))return;
    const sample=sampleInteraction(e,pointer,'pointerup');
    pendingClick.set(key,sample);
    if(pendingClick.size>12)pendingClick.clear();
    w.setTimeout(()=>{if(pendingClick.get(key)===sample)pendingClick.delete(key);},1000);
   },true);
   doc.addEventListener('click',e=>{
    if(ignore(e.target))return;
    const key=e.pointerId??1,at=timestamp(w,e);
    let linked=pendingClick.get(key);
    if(!linked&&pendingClick.size===1)linked=[...pendingClick.values()][0];
    if(linked&&at>=linked.clickAt&&at-linked.clickAt<900){
     linked.hasClick=true;linked.inputToClickMs=round(Math.max(0,at-linked.tapAt));
     linked.clickAt=round(at);pendingClick.delete(key);
     paint();return;
    }
    const pointer=starts.get(key)||[...starts.values()].at(-1);
    starts.delete(key);
    if(pointer?.moved)return;
    sampleInteraction(e,pointer,'click');
   },true);
   if(typeof w.PerformanceObserver==='function'){
    try{
     const o=new w.PerformanceObserver(list=>{
      for(const e of list.getEntries())if(['click','pointerdown','pointerup'].includes(e.name)){
       keep(eventTimings,{frame:name,type:e.name,queueMs:round(Math.max(0,e.processingStart-e.startTime)),durationMs:round(e.duration)});
      }
      paint();
     });
     o.observe({type:'event',durationThreshold:16});
    }catch{}
    try{
     const o=new w.PerformanceObserver(list=>{
      for(const e of list.getEntries())keep(longTasks,{frame:name,durationMs:round(e.duration),timeMs:round(now(w))});
      paint();
     });
     o.observe({type:'longtask'});
    }catch{}
   }
  }catch(e){root.console?.warn('Profiler frame unavailable',name,e);}
 }
 function scanFrames(){
  attach(root,'main');
  for(const frame of root.document.querySelectorAll('iframe')){
   if(frame.dataset.unifiedProfilerObserved)continue;
   frame.dataset.unifiedProfilerObserved='1';
   const a=()=>{try{if(frame.contentWindow?.location?.origin===root.location.origin)attach(frame.contentWindow,frame.id||'embedded');}catch{}};
   frame.addEventListener('load',a);a();
  }
 }
 function measurePan(){
  if(measuringPan)return;
  measuringPan=true;panButton.disabled=true;panButton.textContent='Swipe / zoom now (5 seconds)';
  const t0=now(),gaps=[];let prior=null,count=0;
  const frame=t=>{
   count++;
   if(prior!=null)gaps.push(t-prior);
   prior=t;
   if(now()-t0<5000){root.requestAnimationFrame(frame);return;}
   const ms=now()-t0;
   panTest={fps:round((Math.max(0,count-1))*1000/ms),p95FrameMs:percentile(gaps,.95),
    maximumFrameMs:gaps.length?round(Math.max(...gaps)):null,slowFrames:gaps.filter(x=>x>34).length,
    durationMs:round(ms)};
   measuringPan=false;panButton.disabled=false;panButton.textContent='Measure pan / zoom (5s)';paint();
  };
  root.requestAnimationFrame(frame);
 }
 function init(){
  if(panel)return;
  panel=root.document.createElement('aside');panel.id='unifiedInteractionProfiler';
  panel.style.cssText='position:fixed;bottom:8px;right:8px;z-index:2147483500;width:min(345px,calc(100vw - 16px));max-height:50vh;overflow:auto;direction:ltr;text-align:left;background:#081925f0;color:#e9f5fc;border:1px solid #779fb4;border-radius:8px;box-shadow:0 3px 15px #000a;padding:8px;font:11px/1.5 system-ui';
  const heading=root.document.createElement('strong');heading.textContent='Unified · Interaction Profiler';
  const help=root.document.createElement('div');help.textContent='Diagnostic only: DOM change ≠ verified system state. No upload.';help.style.color='#bdd5df';
  summary=root.document.createElement('pre');summary.style.cssText='white-space:pre-wrap;margin:5px 0;font:11px/1.5 monospace';
  detail=root.document.createElement('pre');detail.hidden=true;detail.style.cssText='white-space:pre-wrap;word-break:break-word;font:10px/1.4 monospace';
  const btn=(title,fn)=>{const b=root.document.createElement('button');b.textContent=title;b.style.cssText='margin:3px;padding:4px 7px;background:#24506a;color:white;border:1px solid #9db9ca;border-radius:5px';b.addEventListener('click',fn);return b;};
  panButton=btn('Measure pan / zoom (5s)',measurePan);
  const toggle=btn('Details',()=>{detail.hidden=!detail.hidden;paint();});
  const copy=btn('Copy JSON',async()=>{
   const payload=JSON.stringify(report(),null,2);
   try{await root.navigator.clipboard.writeText(payload);}catch{const el=root.document.createElement('textarea');el.value=payload;panel.appendChild(el);el.select();root.document.execCommand('copy');el.remove();}
  });
  const clear=btn('Clear',()=>{samples.length=0;eventTimings.length=0;longTasks.length=0;work.length=0;panTest=null;active.clear();paint();});
  panel.append(heading,help,summary,panButton,toggle,copy,clear,detail);
  root.document.body.append(panel);
  scanFrames();
  root.addEventListener('b737:cockpit-mounted',scanFrames);
  paint();
 }
 root.B737InteractionProfilerV1=Object.freeze({version:VERSION,report,markWork,refresh:paint});
 if(root.document.readyState==='loading')root.document.addEventListener('DOMContentLoaded',init,{once:true});
 else init();
})(typeof window!=='undefined'?window:null);
