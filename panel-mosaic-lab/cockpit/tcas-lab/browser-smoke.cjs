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
   dh:document.querySelector('#efisCpMount .uefis-dh-window')?.textContent?.trim(),
   visibleRouteLabels:Array.from(document.querySelectorAll('#ehsi [data-segment="route-fix-label"]')).map(el=>({
    name:el.getAttribute('data-fix'),fitted:el.getAttribute('data-label-fitted'),
    drawn:!!el.querySelector('[data-text]')})),
   rectTop:document.querySelector('#efisCpMount')?.getBoundingClientRect().top,
   ehsiBottom:document.querySelector('#ehsi')?.getBoundingClientRect().bottom,
   mode:document.querySelector('#ehsi')?.getAttribute('data-mode'),
   ambientTraffic:document.querySelectorAll('#ehsi [data-segment="traffic-other"][data-target-id^="OTHER-"]').length,
   ivsiReady:document.querySelector('#ivsi')?.getAttribute('data-ra-id')!==null,
   ivsiNeedle:document.querySelectorAll('#ivsi [data-layer="vs-needle"]').length,
   displayRects:['eadi','ehsi','ivsi'].map(id=>{
    const r=document.getElementById(id)?.getBoundingClientRect();
    return r?{left:r.left,right:r.right,top:r.top}:null;
   }),
   fmcClipped:!!document.querySelector('#ehsi [data-segment="active-route"][clip-path="url(#ehsi-route-range)"]'),
   ellipseRx:document.querySelector('#ehsi clipPath[id="ehsi-route-range"] ellipse')?.getAttribute('rx')
  }));
  assert.equal(state.assetLoaded,true,'Original photographic EFIS CP must load');
  assert.equal(state.dh,'-20','TCAS photographic EFIS CP default DH is -20');
  assert.ok(state.visibleRouteLabels.length>0,'Cruise FMC fix name must be visible');
  assert.ok(state.visibleRouteLabels.every(p=>p.fitted==='true'&&p.drawn),
   'All rendered route labels must be fully inside compass scale');
  assert.ok(state.photoName.includes('efis-cp-photo-plate-v1.webp'));
  assert.ok(state.rectTop>=state.ehsiBottom,'Physical CP belongs below EHSI');
  assert.equal(state.mode,'CTR_MAP');
  assert.ok(state.ambientTraffic<=2,'No more than two ambient OTHER contacts within 10 NM');
  assert.equal(state.ivsiReady,true,'Integrated IVSI must render on first paint');
  assert.equal(state.ivsiNeedle,1,'IVSI must display one actual VS needle');
  assert.ok(state.displayRects.every(Boolean),'EADI/EHSI/IVSI must all have visible DOM frames');
  assert.ok(state.displayRects[0].right<=state.displayRects[1].left+12 &&
   state.displayRects[1].right<=state.displayRects[2].left+12,
   'All three displays must align left-to-right on desktop');
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
  await page.selectOption('#scenario','TA_ONLY');
  await page.locator('#converging').check();
  await page.locator('#start').click();
  assert.equal(await page.locator('#ivsi').getAttribute('data-ra-id'),'NONE',
   'Passing traffic must never show a false descending RA at LOAD');
  const test=await page.evaluate(()=>{
   const stage=document.getElementById('status');
   const ivsi=document.getElementById('ivsi');
   for(let n=0;n<65;n++){
    document.getElementById('step').onclick();
    if(ivsi.getAttribute('data-ra-id')!=='NONE')return {falseRa:true,at:n};
   }
   return {falseRa:false,status:stage.textContent};
  });
  assert.equal(test.falseRa,false,'TA ONLY passing geometry generated an RA during progression');
  assert.equal(errors.length,0,'Page must have no uncaught JS errors: '+errors.join('; '));
  const artifacts=path.resolve('artifacts/tcas-lab');
  fs.mkdirSync(artifacts,{recursive:true});
  await page.screenshot({path:path.join(artifacts,'tcas-physical-efis-cp.png'),fullPage:true});
  console.log('PASS TCAS browser: approved EFIS photo/detents/TFC, 10 NM contact cap, enlarged full rose, expanded/full FMC clipping.');
 }finally{await browser.close();}
})().catch(err=>{console.error(err);process.exitCode=1;});
