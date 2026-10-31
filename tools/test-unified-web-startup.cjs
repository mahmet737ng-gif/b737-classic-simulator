'use strict';
// CI-only browser evidence against the exact static artifact served at a Pages subpath.
const {chromium}=require('playwright'),http=require('node:http'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
// The frozen IRS background cleaner has a known observer teardown race. Its
// independent red-zone gate verifies the exact approved bytes before this
// browser test. Keep its error separate from CDU/startup failures; never
// suppress a different error or an error from another script.
function lockedIrsObserverRace(error){
 const message=String(error),stack=String(error?.stack||'');
 return message==="TypeError: Cannot read properties of null (reading 'disconnect')"&&
  /irs-background-hash-clean-v1\.js(?:\?[^:\n]*)?:116:\d+/.test(stack);
}
const root=path.resolve(__dirname,'../web-dist'),out=path.resolve(__dirname,'../artifacts/unified-web-startup'),prefix='/b737-classic-simulator/';
const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.webp':'image/webp','.png':'image/png','.ttf':'font/ttf','.woff2':'font/woff2'};
fs.mkdirSync(out,{recursive:true});
const server=http.createServer((req,res)=>{
 const u=new URL(req.url,'http://local');if(!u.pathname.startsWith(prefix)){res.writeHead(404);return res.end();}
 let file=path.resolve(root,decodeURIComponent(u.pathname.slice(prefix.length)));
 if(!file.startsWith(root+path.sep)&&file!==root){res.writeHead(403);return res.end();}
 try{if(fs.statSync(file).isDirectory())file=path.join(file,'index.html');const stat=fs.statSync(file),etag='"'+stat.size+'-'+stat.mtimeMs+'"';
  res.setHeader('Content-Type',types[path.extname(file)]||'application/octet-stream');res.setHeader('Cache-Control','public, max-age=0, must-revalidate');res.setHeader('ETag',etag);
  if(req.headers['if-none-match']===etag){res.writeHead(304);return res.end();}
  fs.createReadStream(file).on('error',()=>res.destroy()).pipe(res);
 }catch{res.writeHead(404);res.end();}
});
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const origin='http://127.0.0.1:'+server.address().port,url=origin+prefix+'panel-mosaic-lab/cockpit/';
 const browser=await chromium.launch({headless:true,...(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:{})}),samples=[];
 const context=await browser.newContext({viewport:{width:1580,height:920}});
 try{
  const page=await context.newPage(),errors=[],lockedIrsErrors=[];
  page.on('pageerror',e=>{
   if(lockedIrsObserverRace(e))lockedIrsErrors.push(String(e));
   else errors.push(String(e?.stack||e));
  });
  for(const mode of ['fresh-cache','retained-cache','conventional-profile']){
   if(mode==='conventional-profile'){
    await page.locator('#aircraftSettingsOpen').click();
    await page.locator('input[name="engineInstruments"][value="CONVENTIONAL"]').check();
    await page.locator('#aircraftSettingsForm button[type="submit"]').click();
   }
   await page.goto(url,{waitUntil:'commit',timeout:60000});
   await page.waitForFunction(()=>document.documentElement.dataset.unifiedUsableMs,null,{timeout:60000,polling:25});
   const sample=await page.evaluate(()=>{
    const diagnostic=window.B737LoadDiagnostics.snapshot(),control=document.querySelector('[data-mcp-hardware="FD_LEFT"]'),before=window.B737McpHardwareV1.getState().FD_LEFT;
    const start=performance.now();control.click();const responded=window.B737McpHardwareV1.getState().FD_LEFT!==before;control.click();
    return {mainReadyMs:diagnostic.mainReadyMs,profile:window.B737AircraftProfileStore.get(),status:diagnostic.status,interaction:{responded,restored:window.B737McpHardwareV1.getState().FD_LEFT===before,roundTripMs:performance.now()-start},scriptTags:document.scripts.length};
   });
   sample.mode=mode;samples.push(sample);console.log(JSON.stringify(sample));
   assert.ok(sample.status.usable&&sample.interaction.responded&&sample.interaction.restored,'Real visible cockpit controls must respond');
   assert.equal(sample.profile.engineInstruments,mode==='conventional-profile'?'CONVENTIONAL':'EIS');
   assert.ok(sample.interaction.roundTripMs<200,'Live control response exceeds 200ms');
   await page.screenshot({path:path.join(out,mode+'.png')});
   // Startup readiness must not skip the actual secondary systems. Wait and
   // verify overhead + both CDUs, then exercise the real Settings dialog.
   await page.waitForFunction(()=>{const s=window.CockpitStartupGate.inspect(window,window.B737AircraftProfileStore.get());return s.overhead&&s.cdu;},null,{timeout:60000});
   await page.locator('#aircraftSettingsOpen').click();await page.locator('#aircraftSettingsDialog').waitFor({state:'visible'});await page.locator('#aircraftSettingsClose').click();
   await page.evaluate(async()=>{await navigator.serviceWorker.ready;if(!navigator.serviceWorker.controller)await new Promise(r=>navigator.serviceWorker.addEventListener('controllerchange',r,{once:true}));});
  }
  assert.equal(errors.length,0,'Uncaught page errors: '+errors.join('\n'));
  assert.ok(lockedIrsErrors.length<=3,'Frozen IRS observer error exceeded one per page load');
  console.log('Isolated frozen IRS observer errors: '+lockedIrsErrors.length);
  assert.ok(samples.every(x=>x.mainReadyMs<=5000),'Five-second local web startup budget exceeded');
 }finally{
  fs.writeFileSync(path.join(out,'benchmark.json'),JSON.stringify({targetMs:5000,environment:'headless Chromium; local HTTP; Pages subpath; retained cache includes service worker',samples},null,2));
  fs.copyFileSync(path.join(out,'benchmark.json'),path.join(root,'panel-mosaic-lab/cockpit/startup-benchmark.json'));
  await context.close();await browser.close();await new Promise(r=>server.close(r));
 }
})().catch(error=>{console.error(error);server.close();process.exitCode=1;});
