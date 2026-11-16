'use strict';
/* Opt-in Electron/Chromium performance audit. No aircraft state or art changes.
 * Timeline durations overlap and are not exclusive CPU time. */
const CATEGORIES='devtools.timeline,disabled-by-default-devtools.timeline,blink,cc,v8';
const EVENT_NAMES=new Set(['FunctionCall','EvaluateScript','EventDispatch','TimerFire','FireAnimationFrame','RunMicrotasks','RecalculateStyles','UpdateLayoutTree','Layout','Paint','PrePaint','CompositeLayers','UpdateLayerTree','RasterTask','DrawFrame','MajorGC','MinorGC','V8.GCScavenger']);
function accumulate(totals,events){
 for(const event of events||[]){
  if(event.ph!=='X'||!EVENT_NAMES.has(event.name)||!Number.isFinite(event.dur)||event.dur<0)continue;
  const old=totals.get(event.name)||{name:event.name,count:0,totalMs:0,maxMs:0};
  old.count++;old.totalMs+=event.dur/1000;old.maxMs=Math.max(old.maxMs,event.dur/1000);totals.set(event.name,old);
 }
}
function hotFunctions(profile){
 if(!profile?.nodes?.length)return [];
 const nodes=new Map(profile.nodes.map(n=>[n.id,n])),parents=new Map();
 for(const n of profile.nodes)for(const c of n.children||[])parents.set(c,n.id);
 const inclusive=new Map(),self=new Map();
 for(const id of profile.samples||[]){
  self.set(id,(self.get(id)||0)+1);
  let n=id;const seen=new Set();
  while(n&&!seen.has(n)){seen.add(n);inclusive.set(n,(inclusive.get(n)||0)+1);n=parents.get(n);}
 }
 const micros=(profile.endTime-profile.startTime)/Math.max(1,profile.samples?.length||0);
 return [...inclusive].map(([id,count])=>{
  const f=nodes.get(id)?.callFrame||{};
  return {function:f.functionName||'(anonymous)',file:String(f.url||'').split('/').at(-1),
   line:(f.lineNumber??-1)+1,inclusiveMs:Math.round(count*micros/1000),selfMs:Math.round((self.get(id)||0)*micros/1000)};
 }).filter(f=>f.file).sort((a,b)=>b.selfMs-a.selfMs||b.inclusiveMs-a.inclusiveMs).slice(0,35);
}
const FRAME_SAMPLER=`(async()=>{
 const w=document.getElementById('cockpit')?.contentWindow;
 if(!w)return {error:'Cockpit iframe unavailable'};
 const contexts=[['cockpit',w]];
 try{const o=w.document.getElementById('overheadFrame')?.contentWindow;if(o)contexts.push(['overhead',o]);}catch{}
 const read=(label,ctx)=>new Promise(resolve=>{
  const start=ctx.performance.now(),deltas=[],tasks=[];let prev=0,callbacks=0,active=true,obs=null;
  try{obs=new ctx.PerformanceObserver(list=>{for(const e of list.getEntries())if(e.entryType==='longtask')tasks.push(e.duration);});obs.observe({entryTypes:['longtask']});}catch{}
  function frame(t){if(!active)return;callbacks++;if(prev&&t>prev)deltas.push(t-prev);prev=t;ctx.requestAnimationFrame(frame);}
  ctx.requestAnimationFrame(frame);
  setTimeout(()=>{active=false;obs?.disconnect();const elapsed=ctx.performance.now()-start,sorted=deltas.slice().sort((a,b)=>a-b);
   resolve({context:label,visible:!ctx.document.hidden,overheadReady:!!ctx.B737OverheadLights,
    enginesReady:!!ctx.B737RotaryGuards,elapsedMs:Math.round(elapsed),
    fps:Math.round(callbacks*10000/elapsed)/10,p95GapMs:sorted.length?Math.round(sorted[Math.floor((sorted.length-1)*.95)]*10)/10:null,
    maxGapMs:sorted.length?Math.round(sorted.at(-1)*10)/10:null,
    longTaskCount:tasks.length,longTaskMs:Math.round(tasks.reduce((a,b)=>a+b,0))});},8000);
 });
 return {capturedAt:new Date().toISOString(),samples:await Promise.all(contexts.map(([name,ctx])=>read(name,ctx)))};
})()`;
async function capture(webContents,{sampleCode=FRAME_SAMPLER,timeoutMs=13000}={}){
 const dbg=webContents.debugger;
 if(dbg.isAttached())throw Error('DevTools debugger is already attached');
 const totals=new Map();let complete;
 const finished=new Promise(resolve=>{complete=resolve;});
 const message=(_event,method,params)=>{
  if(method==='Tracing.dataCollected')accumulate(totals,params?.value);
  if(method==='Tracing.tracingComplete')complete(true);
 };
 let attached=false,tracing=false,profiler=false;
 const errors=[];let profile=null,frames=null,traceComplete=false;
 try{
  dbg.attach('1.3');attached=true;dbg.on('message',message);
  await dbg.sendCommand('Profiler.enable');await dbg.sendCommand('Profiler.start');profiler=true;
  await dbg.sendCommand('Tracing.start',{categories:CATEGORIES,options:'record-as-much-as-possible',transferMode:'ReportEvents'});tracing=true;
  try{frames=await webContents.executeJavaScript(sampleCode,true);}
  catch(err){errors.push('frame sampler: '+String(err.message||err));await new Promise(resolve=>setTimeout(resolve,8000));}
  try{const response=await dbg.sendCommand('Profiler.stop');profile=response.profile;}
  catch(err){errors.push('CPU profiler: '+String(err.message||err));}
  profiler=false;
  await dbg.sendCommand('Tracing.end');tracing=false;
  let traceTimer;
  traceComplete=await Promise.race([finished,new Promise(resolve=>{traceTimer=setTimeout(()=>resolve(false),timeoutMs);})]);
  clearTimeout(traceTimer);
 }finally{
  if(tracing)try{await dbg.sendCommand('Tracing.end');}catch{}
  if(profiler)try{await dbg.sendCommand('Profiler.stop');}catch{}
  if(attached){dbg.removeListener('message',message);try{dbg.detach();}catch{}}
 }
 return {schema:'B737_WINDOWS_RUNTIME_AUDIT_V1',timestamp:new Date().toISOString(),
  note:'Read-only sample; trace times may overlap and CPU profiling may not include all child targets.',
  frames,hotFunctions:hotFunctions(profile),
  timeline:[...totals.values()].map(x=>({...x,totalMs:Math.round(x.totalMs),maxMs:Math.round(x.maxMs)})).sort((a,b)=>b.totalMs-a.totalMs),
  traceComplete,errors};
}
module.exports={capture,accumulate,hotFunctions,FRAME_SAMPLER};
