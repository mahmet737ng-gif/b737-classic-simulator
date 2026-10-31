'use strict';
// CI-only Chrome DevTools Protocol investigation of the *whole* Unified
// renderer. Render/CPU metrics do not include GPU/compositor cost; exclusive
// percentages cannot be inferred by summing independently reported phases.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'../web-dist'),prefix='/b737-classic-simulator/';
const out=path.resolve(__dirname,'../artifacts/perf-0006');
const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.webp':'image/webp','.png':'image/png','.woff2':'font/woff2'};
fs.mkdirSync(out,{recursive:true});
const server=http.createServer((req,res)=>{
 const url=new URL(req.url,'http://localhost');if(!url.pathname.startsWith(prefix)){res.writeHead(404);return res.end();}
 const file=path.resolve(root,decodeURIComponent(url.pathname.slice(prefix.length)));
 if(!file.startsWith(root+path.sep)){res.writeHead(403);return res.end();}
 try{const stat=fs.statSync(file);if(!stat.isFile()){res.writeHead(404);return res.end();}
  res.setHeader('Content-Type',types[path.extname(file)]||'application/octet-stream');fs.createReadStream(file).pipe(res);
 }catch{res.writeHead(404);res.end();}
});
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const metricMap=result=>Object.fromEntries(result.metrics.map(v=>[v.name,v.value]));
const focus=async page=>{
 await page.evaluate(()=>{
  const oh=document.getElementById('region-overhead');
  if(oh)oh.scrollIntoView({block:'center',inline:'center',behavior:'instant'});
 });
 await page.waitForFunction(()=>{try{return !!document.getElementById('overheadFrame')?.contentWindow?.B737ABStageMetrics?.snapshot()?.enginesReady;}catch{return false;}},null,{timeout:60000,polling:200});
};
function hotFunctions(profile){
 const byId=new Map(profile.nodes.map(n=>[n.id,n.callFrame]));
 const cost=new Map(),samples=profile.samples||[],deltas=profile.timeDeltas||[];
 for(let i=0;i<samples.length;i++){
  const call=byId.get(samples[i]);if(!call)continue;
  const url=call.url||'(anonymous/internal)';
  const key=(call.functionName||'(anonymous)')+' @ '+url.split('/').slice(-2).join('/');
  const entry=cost.get(key)||0;cost.set(key,entry+(deltas[i]||1000));
 }
 return [...cost.entries()].sort((a,b)=>b[1]-a[1]).slice(0,10).map(([name,us])=>({name,sampledMs:Math.round(us/1000)}));
}
async function trial(browser,base,mode){
 const context=await browser.newContext({viewport:{width:1580,height:920},deviceScaleFactor:1});
 const page=await context.newPage();const cdp=await context.newCDPSession(page);
 try{
  await page.goto(base+(mode==='FULL'?'unified-diagnostic-v6.html':'unified-diagnostic-static-v6.html'),
    {waitUntil:'domcontentloaded',timeout:60000});
  await page.waitForFunction(()=>document.documentElement.dataset.unifiedUsableMs,null,{timeout:60000});
  await focus(page);await wait(650);
  const status=await page.evaluate(()=>({
   mode:window.B737OverheadStaticTest?'STATIC':'FULL',
   stage:document.getElementById('overheadFrame').contentWindow.B737ABStageMetrics.snapshot(),
   uiZoom:document.getElementById('zoomValue')?.textContent,texture:window.B737ImageLoader?.stats()
  }));
  if(status.mode!==mode||!status.stage.enginesReady)throw Error('Mode or Overhead not ready: '+JSON.stringify(status));
  await cdp.send('Performance.enable');await cdp.send('Profiler.enable');
  await cdp.send('Profiler.setSamplingInterval',{interval:1000});
  const initial=metricMap(await cdp.send('Performance.getMetrics'));
  await cdp.send('Profiler.start');
  await page.evaluate(()=>{
   const viewport=document.getElementById('viewport');const mid=viewport.scrollTop;
   let direction=1;
   window.__perfV6Scroll=setInterval(()=>{
    if(viewport.scrollTop>mid+110)direction=-1;
    else if(viewport.scrollTop<mid-110)direction=1;
    viewport.scrollTop+=direction*9;
   },38);
  });
  const start=Date.now();await wait(3600);
  await page.evaluate(()=>{clearInterval(window.__perfV6Scroll);delete window.__perfV6Scroll;});
  const end=Date.now();
  const final=metricMap(await cdp.send('Performance.getMetrics'));
  const profile=(await cdp.send('Profiler.stop')).profile;
  const durations={};
  for(const name of ['TaskDuration','ScriptDuration','LayoutDuration','RecalcStyleDuration','PaintDuration','LayoutCount','RecalcStyleCount','Nodes','JSHeapUsedSize']){
   if(Number.isFinite(initial[name])&&Number.isFinite(final[name])){
    const value=name==='Nodes'||name==='JSHeapUsedSize'?final[name]:final[name]-initial[name];
    durations[name]=name.endsWith('Duration')?Math.round(value*1000):Math.round(value);
   }
  }
  const stage=await page.evaluate(()=>document.getElementById('overheadFrame').contentWindow.B737ABStageMetrics.snapshot());
  return {mode,elapsedMs:end-start,
   warning:'CDP task/script/layout/paint are renderer main-thread metrics, may overlap, and exclude GPU raster/compositor. Values are milliseconds, not exclusive load percentages.',
   stage:{fps:stage.fps,p95FrameMs:stage.p95FrameMs,slowFrames:stage.slowFrames,enginesReady:stage.enginesReady},
   metrics:durations,topCpuSamples:hotFunctions(profile),startup:status.uiZoom};
 }finally{await context.close();}
}
(async()=>{
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 let browser;try{
  browser=await chromium.launch({headless:true,...(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:{})});
  const base='http://127.0.0.1:'+server.address().port+prefix+'panel-mosaic-lab/cockpit/';
  const full=await trial(browser,base,'FULL'),staticLane=await trial(browser,base,'STATIC');
  const report={schema:'PERF-0006/CDP/1',environment:'CI/headless-Chromium/1580x920',full,static:staticLane};
  fs.writeFileSync(path.join(out,'cdp-profile.json'),JSON.stringify(report,null,2)+'\n');
  console.log('PERF-0006 CDP PROFILE '+JSON.stringify(report));
 }finally{if(browser)await browser.close();await new Promise(resolve=>server.close(resolve));}
})().catch(error=>{console.error(error);process.exitCode=1;});
