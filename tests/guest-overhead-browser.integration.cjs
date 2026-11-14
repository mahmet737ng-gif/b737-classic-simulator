'use strict';
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
(async()=>{
 let browser;
 const unexpected=[];
 const base='http://127.0.0.1:3000';
 try{
  browser=await chromium.launch({headless:true,args:['--no-sandbox']});
  const page=await browser.newPage({viewport:{width:1650,height:930},deviceScaleFactor:1});
  page.on('pageerror',e=>unexpected.push('Uncaught JS: '+e.message));
  page.on('response',r=>{
   if(r.status()>=400 && r.url().startsWith(base))
     unexpected.push('HTTP '+r.status()+' '+new URL(r.url()).pathname);
  });
  await page.goto(base+'/login');
  await page.locator('#user').fill('ci-reviewer');
  await page.locator('#pass').fill('ci-only-fixture');
  await page.locator('button[type="submit"]').click();
  await page.waitForURL(/\/panel-mosaic-lab\/cockpit\/$/,{timeout:45000});
  await page.waitForSelector('#region-overhead',{timeout:90000});
  await page.waitForFunction(
   ()=>document.getElementById('viewLabel')?.textContent?.includes('اورهد'),
   null,{timeout:90000}
  );
  const result=await page.evaluate(()=>{
   const main=document.querySelector('#region-main'),pedestal=document.querySelector('#region-pedestal');
   const original=document.querySelector('#overheadFrame');
   return {
    mainHidden:getComputedStyle(main).visibility==='hidden',
    pedestalHidden:getComputedStyle(pedestal).visibility==='hidden',
    overheadFrame:original?.getAttribute('src')||original?.dataset?.deferredUrl||null,
    hasElectrical:!!window.B737ElectricalV7,
    hasFailureBridge:!!window.B737UnifiedBusFailureInjectionV1,
    hasSettings:!!document.getElementById('aircraftSettingsOpen'),
    hasCB:!!document.getElementById('cbPanelOpen'),
    hasBus:!!document.getElementById('busConsumerTestLabOpen'),
    hasLogout:!!document.getElementById('guestLogoutForm')
   };
  });
  console.log('FULL ORIGINAL COCKPIT:',JSON.stringify(result));
  for(const key of ['mainHidden','pedestalHidden','hasElectrical','hasFailureBridge','hasSettings','hasCB','hasBus','hasLogout'])
   assert(result[key],key+' not configured');
  assert(result.overheadFrame?.includes('overhead-stage.html'),'Not loading the actual original overhead stage');
  const child=page.frameLocator('#overheadFrame');
  await child.locator('#atlasAbsolute .atlas-piece').first().waitFor({timeout:120000});
  await child.locator('.mounted-toggle').first().waitFor({timeout:120000});
  await child.locator('.mounted-light').first().waitFor({timeout:120000});
  const counts=await child.locator('body').evaluate(node=>{
   const document=node.ownerDocument;
   const visibleBroken=[...document.images].filter(img=>
     img.complete&&img.naturalWidth===0&&img.getClientRects().length>0);
   return {
     originalPlates:document.querySelectorAll('#atlasAbsolute .atlas-piece').length,
     physicalSwitches:document.querySelectorAll('.mounted-toggle').length,
     lamps:document.querySelectorAll('.mounted-light').length,
     brokenImages:visibleBroken.slice(0,25).map(img=>img.getAttribute('src')),
   };
  });
  console.log('ORIGINAL OVERHEAD:',JSON.stringify(counts));
  assert(counts.originalPlates>=18,'Approved photo atlas incomplete');
  assert(counts.physicalSwitches>=25,'Physical switches unavailable');
  assert(counts.lamps>=75,'Annunciator overlays unavailable');
  await page.screenshot({path:'original-overhead-github-through-railway.png'});
  const missing=unexpected.filter(x=>!/favicon\.ico|\.map|recorder/i.test(x));
  console.log('BROWSER_ERRORS:',JSON.stringify(missing.slice(0,40)));
  assert.equal(counts.brokenImages.length,0,'Overhead shows broken image icons');
  if(missing.length)throw new Error('Browser logged '+missing.length+' failures: '+missing.slice(0,5).join('; '));
  console.log('FULL GITHUB OVERHEAD BROWSER: PASS');
 }catch(e){
  console.error('FULL GITHUB OVERHEAD BROWSER FAILED',e.stack||e);
  process.exitCode=1;
 }finally{await browser?.close();}
})();
