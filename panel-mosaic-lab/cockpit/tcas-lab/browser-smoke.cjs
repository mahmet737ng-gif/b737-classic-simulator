'use strict';
/* Browser smoke test: real approved photo, photographic detents, route clipping,
 * range zoom and TCAS ambient density. No operational ACAS capability implied.
 */
const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
const {pathToFileURL}=require('node:url');
const {chromium}=require('playwright');
(async()=>{
 const browser=await chromium.launch({headless:true,
  ...(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:{})});
 try{
  const page=await browser.newPage({viewport:{width:1540,height:1150},deviceScaleFactor:1});
  const errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.goto(pathToFileURL(path.join(__dirname,'index.html')).href,{waitUntil:'load'});
  await page.waitForFunction(()=>!!window.B737TcasEfisCPV1&&
   !!document.querySelector('#ehsi [data-segment="active-route"]'),{timeout:12000});
  const state=await page.evaluate(()=>({
   assetLoaded:document.querySelector('#efisCpMount .uefis-photo')?.naturalWidth>0,
   photoName:document.querySelector('#efisCpMount .uefis-photo')?.getAttribute('src'),
   rectTop:document.querySelector('#efisCpMount')?.getBoundingClientRect().top,
   ehsiBottom:document.querySelector('#ehsi')?.getBoundingClientRect().bottom,
   mode:document.querySelector('#ehsi')?.getAttribute('data-mode'),
   numTraffic:document.querySelectorAll('#ehsi [data-segment="traffic-other"]').length,
   fmcClipped:!!document.querySelector('#ehsi [data-segment="active-route"][clip-path="url(#ehsi-route-range)"]'),
   ellipseRx:document.querySelector('#ehsi clipPath[id="ehsi-route-range"] ellipse')?.getAttribute('rx')
  }));
  assert.equal(state.assetLoaded,true,'Original photographic EFIS CP must load');
  assert.ok(state.photoName.includes('efis-cp-photo-plate-v1.webp'));
  assert.ok(state.rectTop>=state.ehsiBottom,'Physical CP belongs below EHSI');
  assert.equal(state.mode,'CTR_MAP');
  assert.ok(state.numTraffic<=2,'No more than two OTHER contacts within 10 NM');
  assert.equal(state.fmcClipped,true,'FMC route is clipped to compass, not glass');
  assert.ok(Number(state.ellipseRx)>190,'360-degree compass scale is enlarged');
  const lineBefore=await page.locator('#ehsi [data-segment="route-segments"] line').first().getAttribute('y2');
  await page.locator('#efisCpMount .uefis-detent[data-detent="range"][data-value="20"]').click({force:true});
  assert.equal(await page.locator('#range').inputValue(),'20');
  const lineAfter=await page.locator('#ehsi [data-segment="route-segments"] line').first().getAttribute('y2');
  assert.ok(Number(lineAfter)>Number(lineBefore),'Physical range detent zooms FMC route out');
  const beforeTfc=await page.locator('#tfc').getAttribute('aria-pressed');
  await page.locator('#efisCpMount .uefis-tfc').click({force:true});
  assert.notEqual(await page.locator('#tfc').getAttribute('aria-pressed'),beforeTfc);
  assert.equal(await page.locator('#ehsi [data-segment="traffic-other"]').count(),0,'TFC OFF blanks contacts');
  await page.locator('#efisCpMount .uefis-tfc').click({force:true});
  assert.equal(await page.locator('#tfc').getAttribute('aria-pressed'),beforeTfc);
  await page.locator('#efisCpMount .uefis-detent[data-detent="mode"][data-value="MAP"]').click({force:true});
  assert.equal(await page.locator('#ehsi').getAttribute('data-mode'),'MAP');
  assert.equal(await page.locator('#ehsi clipPath[id="ehsi-route-range"] polygon').count(),1,
   'Expanded MAP route is clipped to a 70-degree sector');
  await page.locator('#efisCpMount .uefis-detent[data-detent="mode"][data-value="FULL_NAV"]').click({force:true});
  assert.equal(await page.locator('#ehsi').getAttribute('data-mode'),'FULL_NAV');
  assert.equal(await page.locator('#ehsi clipPath[id="ehsi-route-range"] ellipse').count(),1,
   'FULL NAV route stays within full compass circle');
  assert.equal(errors.length,0,'Page must have no uncaught JS errors: '+errors.join('; '));
  const artifacts=path.resolve('artifacts/tcas-lab');
  fs.mkdirSync(artifacts,{recursive:true});
  await page.screenshot({path:path.join(artifacts,'tcas-physical-efis-cp.png'),fullPage:true});
  console.log('PASS TCAS browser: approved EFIS photo/detents/TFC, 10 NM contact cap, enlarged full rose, expanded/full FMC clipping.');
 }finally{await browser.close();}
})().catch(err=>{console.error(err);process.exitCode=1;});
