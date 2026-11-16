'use strict';
const assert=require('node:assert/strict');
const {chromium}=require('playwright');
const {spawn}=require('node:child_process');
const fs=require('node:fs'),path=require('node:path');
(async()=>{
 const root=path.resolve(__dirname,'../..'),out=path.join(root,'artifacts/efis-pedestal');
 fs.mkdirSync(out,{recursive:true});
 const server=spawn('python3',['-m','http.server','18778','--bind','127.0.0.1'],{cwd:root,stdio:'ignore'});
 let browser;
 try{
  browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||undefined,args:['--no-sandbox']});
  const page=await browser.newPage({viewport:{width:1600,height:1000}});
  let loaded=false;
  for(let i=0;i<15&&!loaded;i++){try{await page.goto('http://127.0.0.1:18778/panel-mosaic-lab/cockpit/',{timeout:8000,waitUntil:'domcontentloaded'});loaded=true}catch{await new Promise(r=>setTimeout(r,500))}}
  assert.ok(loaded,'Unified must open');
  await page.waitForFunction(()=>!!window.B737UnifiedEFISPedestalV1&&document.querySelectorAll('[data-uefis-seat]').length===2,null,{timeout:60000});
  const panel=page.locator('#region-pedestal');
  assert.equal(await panel.locator('.uefis-seat').count(),2);
  assert.equal(await panel.locator('.uefis-face').count(),2);
  const mounts=await page.evaluate(()=>window.B737UnifiedEFISPedestalV1.positions);
  assert.deepEqual(mounts,{CAPT:[55,1290,365],FO:[735,1290,365]});
  const api=()=>window.B737UnifiedEFISPedestalV1;
  assert.equal(await page.evaluate(()=>window.B737UnifiedEFISPedestalV1.getState('CAPT').dh),200);
  await page.evaluate(()=>window.B737UnifiedEFISPedestalV1.open('CAPT'));
  const dialog=page.locator('.uefis-dialog');
  await dialog.waitFor({state:'visible'});
  for(const name of ['mode','range','dh','adi','hsi','wxInner']){
   const photo=dialog.locator('.uefis-knob.uefis-'+name+' img');
   assert.equal(await photo.evaluate(el=>el.complete&&el.naturalWidth>0),true,name+' image loaded');
  }
  await dialog.locator('[data-detent="mode"][data-value="PLAN"]').click();
  await dialog.locator('[data-detent="range"][data-value="320"]').click();
  assert.equal(await page.evaluate(()=>window.B737UnifiedEFISPedestalV1.getState('CAPT').mode),'PLAN');
  assert.equal(await page.evaluate(()=>window.B737UnifiedEFISPedestalV1.getState('CAPT').range),320);
  await dialog.locator('[data-push="tfc"]').click();
  assert.equal(await page.evaluate(()=>window.B737UnifiedEFISPedestalV1.getState('CAPT').options.tfc),true);
  await dialog.locator('[data-push="wxr"]').click();
  assert.equal(await dialog.locator('[data-push="wxr"]').getAttribute('aria-pressed'),'true');
  await page.waitForFunction(()=>window.B737EFISDisplayLab?.getState()?.ehsi?.mode==='PLAN',null,{timeout:25000});
  assert.equal(await page.evaluate(()=>window.B737EFISDisplayLab.getState().ehsi.range),320);
  await dialog.locator('.uefis-knob.uefis-dh').click({modifiers:['Shift']});
  assert.equal(await page.evaluate(()=>window.B737UnifiedEFISPedestalV1.getState('CAPT').dh),199);
  await dialog.screenshot({path:path.join(out,'efis-capt-modal.png'),animations:'disabled'});
  await dialog.locator('.uefis-dialog-close').click();
  await page.evaluate(()=>window.B737UnifiedEFISPedestalV1.open('FO'));
  assert.equal(await page.evaluate(()=>window.B737UnifiedEFISPedestalV1.getState('FO').dh),200,'FO state independent');
  await dialog.locator('[data-detent="mode"][data-value="FULL_NAV"]').click();
  assert.equal(await page.evaluate(()=>window.B737UnifiedEFISPedestalV1.getState('FO').mode),'FULL_NAV');
  assert.equal(await page.evaluate(()=>window.B737UnifiedEFISPedestalV1.getState('CAPT').mode),'PLAN');
  await dialog.screenshot({path:path.join(out,'efis-fo-modal.png'),animations:'disabled'});
  await dialog.locator('.uefis-dialog-close').click();
  await panel.locator('.region-native').screenshot({path:path.join(out,'efis-pedestal-both.png'),animations:'disabled',timeout:30000});
  console.log('PASS: real Unified CAPT/FO EFIS images, native pedestal slots, modes, TFC, DCPCS knobs, per-seat EHSI bridge.');
 }finally{if(browser)await browser.close();server.kill('SIGTERM')}
})().catch(e=>{console.error(e);process.exitCode=1});
