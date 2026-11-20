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
   !!document.querySelector('#ehsi [data-segment="active-route"]')&&
   document.querySelector('#ivsi')?.dataset.ivsiPhoto==='original',{timeout:12000});
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
   ivsiReady:document.querySelector('#ivsi')?.dataset.ivsiPhoto==='original',
   originalRenderer:!!window.B737ClassicPhotoIVSIV1?.renderLab,
   originalBezel:getComputedStyle(document.querySelector('.photo-ivsi-face')).backgroundImage.includes('tcas-photo/ivsi.webp'),
   scalePhoto:document.querySelector('#ivsi')?.width===403,
   photoGlassBounds:(()=>{
    const face=document.querySelector('.photo-ivsi-face').getBoundingClientRect();
    const glass=document.querySelector('#ivsi').getBoundingClientRect();
    return {x:(glass.left-face.left)/face.width,y:(glass.top-face.top)/face.height,
     width:glass.width/face.width,height:glass.height/face.height};
   })(),
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
  assert.equal(state.originalRenderer,true,'Must reuse original cockpit photo IVSI rendering code');
  assert.equal(state.originalBezel,true,'Original 630 x 624 IVSI bezel image is required');
  await page.waitForFunction(()=>Array.from(document.querySelectorAll('.ivsi-ta-photo,.ivsi-brightness-photo'))
    .length===2&&Array.from(document.querySelectorAll('.ivsi-ta-photo,.ivsi-brightness-photo'))
    .every(img=>img.naturalWidth>0),{timeout:5000});
  await page.locator('#ivsiTaSelect').click();
  assert.equal(await page.locator('#ivsi').getAttribute('data-ivsi-full-time'),'false',
   'TA SEL must switch the original photo IVSI to popup-only traffic');
  await page.locator('#ivsiTaSelect').click();
  assert.equal(await page.locator('#ivsi').getAttribute('data-ivsi-full-time'),'true',
   'TA SEL must restore full-time traffic');
  await page.locator('#ivsiBrightness').click();
  assert.equal(await page.locator('#ivsi').getAttribute('data-ivsi-brightness'),'0.95',
   'Original IVSI brightness knob must dim the instrument');
  await page.locator('#ivsiBrightness').press('ArrowUp');
  assert.equal(await page.locator('#ivsi').getAttribute('data-ivsi-brightness'),'1',
   'Original IVSI brightness knob must restore full brightness');
  assert.equal(state.scalePhoto,true,'Original photo IVSI glass must remain 403 x 403');
  assert.ok(Math.abs(state.photoGlassBounds.x-109/630)<.01&&
   Math.abs(state.photoGlassBounds.y-112/624)<.01,
   'IVSI glass must retain its original source-pixel position');
  assert.ok(Math.abs(state.photoGlassBounds.width-403/630)<.01&&
   Math.abs(state.photoGlassBounds.height-403/624)<.01,
   'IVSI glass must retain its original source-pixel dimensions');
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
  assert.equal(await page.locator('#converging').isDisabled(),true,
   'Passing preset must not accept a convergence override');
  // Simulate stale browser checkbox state without dispatching a new event.
  await page.evaluate(()=>{document.getElementById('converging').checked=true;});
  await page.locator('#start').click();
  assert.match(await page.locator('#scenarioStatus').textContent(),/SCENARIO: TA only.*RUNNING/,
   'LOAD must visibly start the selected scenario immediately');
  assert.equal(await page.locator('#play').textContent(),'PAUSE');
  await page.locator('#play').click(); // Pause auto-play before deterministic STEP tests.
  assert.equal(await page.locator('#ivsi').getAttribute('data-tcas-ra-id'),'NONE',
   'Passing traffic must never show a false descending RA at LOAD');
  const test=await page.evaluate(()=>{
   const stage=document.getElementById('status');
   const ivsi=document.getElementById('ivsi');
   for(let n=0;n<65;n++){
    document.getElementById('step').onclick();
    if(ivsi.getAttribute('data-tcas-ra-id')!=='NONE')return {falseRa:true,at:n};
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
