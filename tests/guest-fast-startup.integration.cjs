'use strict';
// Browser timing of the REAL authenticated Gateway + compiled Unified. Uses
// test-only credentials and a CI PostgreSQL container, never production login.
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 const base='http://127.0.0.1:3000';
 const data=[];
 try {
  for(const cold of [true,false]){
   const context=await browser.newContext({viewport:{width:1440,height:900},deviceScaleFactor:1});
   const page=await context.newPage();
   const errors=[];
   page.on('pageerror',err=>errors.push(err.message));
   await page.goto(base+'/login',{waitUntil:'domcontentloaded'});
   await page.locator('#user').fill('ci-reviewer');
   await page.locator('#pass').fill('ci-only-fixture');
   await Promise.all([page.waitForURL(/\/panel-mosaic-lab\/cockpit\/$/,{timeout:45000}),
     page.locator('button[type="submit"]').click()]);
   const result=await page.evaluate(async()=>{
    const limit=performance.now()+70000;
    while(performance.now()<limit){
     const ready=Number(document.documentElement.dataset.unifiedCockpitReadyMs);
     if(ready>0)break;
     await new Promise(resolve=>setTimeout(resolve,200));
    }
    const d=document.documentElement.dataset,profile=window.B737AircraftProfileStore?.get();
    const full=window.CockpitStartupGate?.inspectFull?.(window,profile)||null;
    const tags=[...document.querySelectorAll('script[src]')];
    const resources=performance.getEntriesByType('resource');
    return {cockpitReadyMs:Number(d.unifiedCockpitReadyMs)||null,
     mainReadyMs:Number(d.unifiedUsableMs)||null,
     complete:!!full?.complete,parts:full,
     jsTags:tags.length,bundles:tags.filter(x=>x.src.includes('desktop-bundle-')).length,
     resources:resources.length,
     images:resources.filter(x=>/\.(?:png|jpe?g|svg|webp|avif)(?:\?|$)/i.test(x.name)).length,
     failed:resources.filter(x=>x.responseStatus>=400).slice(0,15).map(x=>x.name)};
   });
   result.mode=cold?'fresh-context':'second-context';
   result.pageErrors=errors.slice(0,10);
   data.push(result);
   console.log('AUTHENTICATED UNIFIED GATEWAY STARTUP:',JSON.stringify(result));
   assert.ok(result.bundles>10,'Gateway served uncompiled source instead of fast runtime');
   assert.ok(result.jsTags<=130,'Gateway is not reducing simulator script requests');
   assert.ok(result.complete,'Complete interactive cockpit did not initialize');
   assert.ok(result.cockpitReadyMs>0,'Full cockpit readiness milestone missing');
   await context.close();
  }
  console.log('GATEWAY COMPILED BOOT TEST PASSED; budget is 5000ms:',JSON.stringify(data.map(x=>({mode:x.mode,ms:x.cockpitReadyMs,within5s:x.cockpitReadyMs<=5000}))));
 }catch(error){console.error('GATEWAY BOOT TEST FAILED',error.stack||error);process.exitCode=1;}
 finally{await browser.close();}
})();
