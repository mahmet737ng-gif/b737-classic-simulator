'use strict';
// Browser-level timing: physical original P5-10 button to actual displayed
// WING BODY lamp in the compiled web-dist (not just the ECU output).
const {chromium}=require('playwright');
const http=require('node:http'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'../web-dist'),prefix='/b737-classic-simulator/';
const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.webp':'image/webp','.png':'image/png','.ttf':'font/ttf','.woff2':'font/woff2'};
const server=http.createServer((req,res)=>{
 const u=new URL(req.url,'http://local');
 if(!u.pathname.startsWith(prefix)){res.writeHead(404);res.end();return}
 const file=path.resolve(root,decodeURIComponent(u.pathname.slice(prefix.length)));
 if(!file.startsWith(root+path.sep)){res.writeHead(403);res.end();return}
 let resolved=file;
 try{
  if(fs.statSync(resolved).isDirectory())resolved=path.join(resolved,'index.html');
  res.writeHead(200,{'Content-Type':types[path.extname(resolved)]||'application/octet-stream','Cache-Control':'no-store'});
  fs.createReadStream(resolved).pipe(res);
 }catch{res.writeHead(404);res.end()}
});
(async()=>{
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const browser=await chromium.launch({headless:true,...(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:{})});
 try{
  const page=await browser.newPage({viewport:{width:1580,height:920}});
  const url='http://127.0.0.1:'+server.address().port+prefix+'panel-mosaic-lab/cockpit/';
  await page.goto(url,{waitUntil:'domcontentloaded',timeout:90000});
  await page.waitForFunction(()=>window.B737AirconFCOMUnifiedV1?.getState()?.derived&&
   window.B737ISNCockpitV1?.getPneumaticState?.(),null,{timeout:90000});
  const f=page.frameLocator('#overheadFrame');
  await f.locator('[data-recessed-id="aircon-ovht-test"] .b737-recess-unit__cap').waitFor({state:'attached',timeout:90000});
  await page.waitForFunction(()=>{
   const doc=document.getElementById('overheadFrame')?.contentDocument;
   return doc?.querySelector('[data-light="wing-body-overheat-l"] [data-frame="ON"]')&&
    doc?.querySelector('[data-light="wing-body-overheat-r"] [data-frame="ON"]')&&
    document.getElementById('overheadFrame')?.contentWindow?.B737OverheadLights;
  },null,{timeout:90000});
  // Ensure a qualified power source; do not mask a genuine power failure.
  const base=await page.evaluate(()=>({
   ready:window.B737AirconFCOMUnifiedV1.getState()?.ovhtTest,
   left:document.getElementById('overheadFrame').contentWindow.B737OverheadLights.getState().frames['wing-body-overheat-l'],
   right:document.getElementById('overheadFrame').contentWindow.B737OverheadLights.getState().frames['wing-body-overheat-r']
  }));
  console.log('OVHT visual timing baseline '+JSON.stringify(base));
  await page.evaluate(()=>{
   const win=document.getElementById('overheadFrame').contentWindow;
   const doc=win.document;
   const button=doc.querySelector('[data-recessed-id="aircon-ovht-test"] .b737-recess-unit__cap');
   const l=doc.querySelector('.mounted-light[data-light="wing-body-overheat-l"]');
   const r=doc.querySelector('.mounted-light[data-light="wing-body-overheat-r"]');
   const log=[],origin=performance.timeOrigin;
   const stamp=()=>performance.timeOrigin+performance.now();
   const sample=(kind)=>({
    kind,at:stamp(),l:l?.dataset.frame,r:r?.dataset.frame,
    test:window.B737AirconFCOMUnifiedV1.getState()?.ovhtTest,
    ECU:window.B737ISNCockpitV1.getPneumaticState()?.inputs?.wingBodyTestHeld
   });
   window.__airconVisualTiming={log,sample};
   const observer=new MutationObserver(()=>{
    const event=sample('visible-change');
    if(log.at(-1)?.l!==event.l||log.at(-1)?.r!==event.r)log.push(event);
   });
   observer.observe(l,{attributes:true,attributeFilter:['data-frame']});
   observer.observe(r,{attributes:true,attributeFilter:['data-frame']});
   const moment=sample('before-press');log.push(moment);
   button.dispatchEvent(new win.PointerEvent('pointerdown',{
    bubbles:true,pointerId:7421,pointerType:'mouse',button:0,buttons:1,isPrimary:true
   }));
   log.push(sample('after-press'));
  });
  await page.waitForTimeout(4950);
  const early=await page.evaluate(()=>window.__airconVisualTiming.sample('before-five'));
  console.log('OVHT early '+JSON.stringify(early));
  assert.equal(early.l,'OFF','WING BODY L must not illuminate before five seconds');
  assert.equal(early.r,'OFF','WING BODY R must not illuminate before five seconds');
  await page.waitForFunction(()=>{
   const frame=document.getElementById('overheadFrame')?.contentDocument;
   return frame?.querySelector('.mounted-light[data-light="wing-body-overheat-l"]')?.dataset.frame==='ON'&&
    frame?.querySelector('.mounted-light[data-light="wing-body-overheat-r"]')?.dataset.frame==='ON';
  },null,{timeout:12000,polling:15});
  const result=await page.evaluate(()=>{
   const x=window.__airconVisualTiming;
   const on=x.log.find(v=>v.kind==='visible-change'&&v.l==='ON'&&v.r==='ON');
   return {events:x.log,observedDelayMs:on?.at-x.log[0]?.at,
    current:x.sample('after-five')};
  });
  console.log('OVHT full browser trace '+JSON.stringify(result));
  assert.ok(result.observedDelayMs>=4990,'Light must never switch ON before five seconds');
  assert.ok(result.observedDelayMs<5600,
   'Real visual WING BODY indication exceeds 5.6 seconds from physical PRESS: '+result.observedDelayMs);
  await page.evaluate(()=>{
   const win=document.getElementById('overheadFrame').contentWindow;
   win.document.querySelector('[data-recessed-id="aircon-ovht-test"] .b737-recess-unit__cap')
    .dispatchEvent(new win.PointerEvent('pointerup',{
     bubbles:true,pointerId:7421,pointerType:'mouse',button:0,buttons:0,isPrimary:true
    }));
  });
  await page.waitForFunction(()=>{
   const frame=document.getElementById('overheadFrame')?.contentDocument;
   return frame?.querySelector('.mounted-light[data-light="wing-body-overheat-l"]')?.dataset.frame==='OFF'&&
    frame?.querySelector('.mounted-light[data-light="wing-body-overheat-r"]')?.dataset.frame==='OFF';
  },null,{timeout:5000});
  console.log('PASS browser: actual P5-10 hold -> illuminated OH21 L/R WING BODY within 5.6s; release clears');
 }finally{await browser.close();await new Promise(resolve=>server.close(resolve))}
})().catch(error=>{console.error(error);server.close();process.exitCode=1});
