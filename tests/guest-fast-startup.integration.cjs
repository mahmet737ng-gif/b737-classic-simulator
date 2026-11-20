'use strict';
// Browser timing of the REAL authenticated Gateway + compiled Unified. Uses
// test-only credentials and a CI PostgreSQL container, never production login.
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const {openHttpsFixture}=require('./https-fixture.cjs');
(async()=>{
 const browser=await chromium.launch({
  headless:true,args:['--no-sandbox'],
  ...(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:{})
 });
 const upstream='http://127.0.0.1:3000';
 let proxy;
 const data=[];
 const direct='/panel-mosaic-lab/unified/';
 const legacy='/panel-mosaic-lab/cockpit/';
 try {
  proxy=await openHttpsFixture(upstream);
  for(const mode of ['fresh-context','737-400-retained-worker','limited-connection']){
   const limited=mode==='limited-connection';
   const retained=mode==='737-400-retained-worker';
   const base=limited?proxy.origin:upstream;
   const context=await browser.newContext({viewport:{width:1440,height:900},deviceScaleFactor:1,ignoreHTTPSErrors:limited});
   const page=await context.newPage();
   const errors=[];
   page.on('pageerror',err=>errors.push(err.message));
   const unauthorized=await context.request.get(base+direct,{maxRedirects:0});
   assert.equal(unauthorized.status(),303);
   assert.equal(unauthorized.headers().location,'/login?e=expired');
   if(retained||limited)await context.addInitScript(()=>{
    if(window!==window.top)return;
    localStorage.setItem('b737classic.aircraft-profile.v1',JSON.stringify({
     schema:'b737-classic-aircraft-profile/1',aircraftFamily:'B737-400',
     pressurization:'DCPCS',engineInstruments:'EIS'
    }));
   });
   await page.goto(base+'/login',{waitUntil:'domcontentloaded'});
   await page.locator('#user').fill('ci-reviewer');
   await page.locator('#pass').fill('ci-only-fixture');
   if(limited){
    const connection=await context.newCDPSession(page);
    await connection.send('Network.enable');
    await connection.send('Network.emulateNetworkConditions',{
     offline:false,latency:250,downloadThroughput:256000,uploadThroughput:128000
    });
    const login=await context.request.post(base+'/api/login',{
     form:{username:'ci-reviewer',password:'ci-only-fixture'},maxRedirects:0
    });
    assert.equal(login.status(),303);
    assert.equal(login.headers().location,'/');
    await page.goto(base+direct+'?bootTrace=1',{waitUntil:'commit'});
   }else{
    await Promise.all([page.waitForURL(base+direct,{timeout:45000,waitUntil:'domcontentloaded'}),
     page.locator('button[type="submit"]').click()]);
   }
   if(retained){
    // Retain a legacy worker in the same profile. The sibling route and all
    // three iframes must bypass it, with the authenticated session intact.
    await page.goto(base+legacy,{waitUntil:'domcontentloaded'});
    await page.waitForFunction(()=>navigator.serviceWorker.controller);
    await page.goto(base+direct+'?bootTrace=1',{waitUntil:'commit'});
   }
   const result=await page.evaluate(async()=>{
    const limit=performance.now()+140000;
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
     complete:!!full?.complete,parts:full,profile:profile?.aircraftFamily,
     directWorker:navigator.serviceWorker.controller?.scriptURL||null,
     framePaths:['overheadFrame','cduFrameCAPT','cduFrameFO'].map(id=>document.getElementById(id)?.contentWindow?.location.pathname),
     workerStarts:['overheadFrame','cduFrameCAPT','cduFrameFO'].map(id=>document.getElementById(id)?.contentWindow?.performance.getEntriesByType('navigation')[0]?.workerStart),
     navTiming:performance.getEntriesByType('navigation')[0]?.serverTiming.map(x=>x.name),
     protocol:performance.getEntriesByType('navigation')[0]?.nextHopProtocol,
     documentBytes:performance.getEntriesByType('navigation')[0]?.encodedBodySize,
     lampPackFetches:resources.filter(resource=>resource.name.includes('/boot-lamp-sources.json')).length,
     packedLampCount:Object.keys(await window.B737BootLampSources||{}).length,
     priorityPreviewCount:window.B737GatewayBoot?.previews?.cockpitControls?.length||0,
     versionedScriptCount:tags.filter(tag=>new URL(tag.src).searchParams.has('unifiedRelease')).length,
     pendingPedestal:['#region-pedestal .texture-piece > img','#region-pedestal .fire-handle-control > img','.throttle-state-sprite','.asp-control-image']
      .flatMap(selector=>[...document.querySelectorAll(selector)]
       .filter(img=>!img.complete||img.naturalWidth<=0)
       .map(img=>img.currentSrc?new URL(img.currentSrc).pathname:selector)).slice(0,20),
     bootMasks:[...document.querySelector('#overheadFrame').contentDocument.querySelectorAll('[data-needle-restoration="RELEASE_MASK"]')].map(piece=>piece.dataset.key).sort(),
     bootLevers:[...document.querySelectorAll('.engine-start-lever-art image')].map(img=>img.getAttribute('href')),
     gaugeFaces:[...document.querySelectorAll('#region-main svg[data-gauge] > image[data-perf-source]')]
      .map(img=>img.getAttribute('href')),
     pedestalFaceplates:[...document.querySelectorAll('#unified-pedestal-faceplates img,#unified-pedestal-cargo-replacement img')]
      .map(img=>img.currentSrc||img.src),
     unnecessaryOriginals:resources.filter(resource=>/OH10-ELEC-LOSSLESS|OH12-BUS-TRANS|engine-start-lever-reference/.test(resource.name)).map(resource=>new URL(resource.name).pathname),
     copiedTrace:window.B737BootTrace?.report().readiness.fullMs||null,
     jsTags:tags.length,bundles:tags.filter(x=>x.src.includes('desktop-bundle-')).length,
     resources:resources.length,
     images:resources.filter(x=>/\.(?:png|jpe?g|svg|webp|avif)(?:\?|$)/i.test(x.name)).length,
     failed:resources.filter(x=>x.responseStatus>=400).slice(0,15).map(x=>x.name),
     marks:performance.getEntriesByType('mark').filter(x=>/b737:|ready/i.test(x.name)).slice(0,25).map(x=>[x.name,Math.round(x.startTime)]),
     lastResources:resources.slice().sort((a,b)=>b.responseEnd-a.responseEnd).slice(0,16).map(x=>[new URL(x.name).pathname.slice(-110),Math.round(x.startTime),Math.round(x.responseEnd),x.encodedBodySize]),
     slowResources:resources.slice().sort((a,b)=>b.duration-a.duration).slice(0,15).map(x=>[new URL(x.name).pathname.slice(-110),Math.round(x.duration),Math.round(x.startTime),x.encodedBodySize]),
     buckets:resources.reduce((acc,x)=>{const key=Math.floor(x.responseEnd/1000);acc[key]=(acc[key]||0)+1;return acc;},{}),
     bytes:resources.reduce((total,x)=>total+(x.encodedBodySize||0),0)};
   });
   result.mode=mode;
   result.pageErrors=errors.slice(0,10);
   data.push(result);
   console.log('AUTHENTICATED UNIFIED GATEWAY STARTUP:',JSON.stringify(result));
   assert.ok(result.bundles>10,'Gateway served uncompiled source instead of fast runtime');
   assert.ok(result.jsTags<=130,'Gateway is not reducing simulator script requests');
   assert.ok(result.priorityPreviewCount>=14,'Priority preview list missing');
   assert.ok(result.versionedScriptCount>=60,'Compiled resources lack release-keyed browser caching');
   assert.ok(result.complete,'Complete interactive cockpit did not initialize');
   assert.equal(result.directWorker,null);
   assert.deepEqual(result.framePaths,[direct+'overhead-stage.html',direct+'cdu-stage.html',direct+'cdu-stage.html']);
   assert.deepEqual(result.workerStarts,[0,0,0]);
   assert.ok(result.navTiming.includes('unified-direct'),'Missing delivery provenance');
   assert.ok(result.packedLampCount>200,'Embedded lamp source pack missing');
   assert.equal(result.lampPackFetches,0,'Lamp boot should require no separate pack request');
   if(limited)assert.equal(result.protocol,'h2');
   assert.deepEqual(result.bootMasks,['OH10','OH12']);
   assert.equal(result.bootLevers.length,2);
   assert.ok(result.gaugeFaces.length>=8,'Fitted captain and first officer gauge faces missing');
   assert.equal(result.pedestalFaceplates.length,6);
   assert.ok([...result.gaugeFaces,...result.pedestalFaceplates].every(url=>
    /-q96-(?:384|768)\.webp$/.test(url)),'Startup must use fitted gauge and faceplate photographs');
   assert.ok(result.bootLevers.every(url=>/boot-art/.test(url)),'Lever sprites must use the release crops');
   assert.deepEqual(result.unnecessaryOriginals,[],'Boot must avoid full-size cleaner and lever sources');
   if(retained||limited)assert.equal(result.profile,'B737-400');
   if(retained){
    assert.ok(result.copiedTrace>0,'Full readiness missing from opt-in trace');
   }
   assert.ok(result.cockpitReadyMs>0,'Full cockpit readiness milestone missing');
   await context.close();
  }
  console.log('GATEWAY COMPILED BOOT TEST PASSED; budget is 5000ms:',JSON.stringify(data.map(x=>({mode:x.mode,ms:x.cockpitReadyMs,within5s:x.cockpitReadyMs<=5000}))));
 }catch(error){console.error('GATEWAY BOOT TEST FAILED',error.stack||error);process.exitCode=1;}
 finally{await browser.close();await proxy?.close();}
})();
