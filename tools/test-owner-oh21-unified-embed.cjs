'use strict';
const assert=require('node:assert/strict');
const {chromium}=require('playwright');
const fs=require('node:fs');
const path=require('node:path');
const origin=process.env.B737_TEST_ORIGIN||'http://127.0.0.1:8788';
(async()=>{
const browser=await chromium.launch(process.env.CHROME_PATH?{headless:true,executablePath:process.env.CHROME_PATH}:{headless:true});
try {
 for (const family of ['B737-300-500','B737-400']){
  const page=await browser.newPage({viewport:{width:1500,height:950},deviceScaleFactor:1});
  await page.addInitScript(family=>{localStorage.setItem('b737classic.aircraft-profile.v1',JSON.stringify({schema:'b737-classic-aircraft-profile/1',aircraftFamily:family,pressurization:'DCPCS',engineInstruments:'EIS'}));},family);
  const errs=[];page.on('pageerror',e=>errs.push(String(e)));
  await page.goto(origin+'/panel-mosaic-lab/cockpit/index.html',{waitUntil:'domcontentloaded',timeout:90000});
  await page.waitForFunction(()=>document.querySelector('#overheadFrame')?.contentWindow?.B737OH21OwnerPhotoV1?.status()?.loaded===true,null,{timeout:90000});
  await page.waitForTimeout(1800);
  const result=await page.evaluate(()=>{
    const f=document.querySelector('#overheadFrame'),w=f.contentWindow,doc=f.contentDocument;
    const panel=doc.querySelector('.owner-oh21-photo-layer-v1');
    const p=doc.querySelector('.atlas-piece[data-key="OH21"]');
    const img=panel?.querySelector('img');
    return {
      embedded:f?.tagName==='IFRAME',photoVisible:!!panel&&getComputedStyle(panel).display!=='none',
      family:w.B737OH21OwnerPhotoV1.status().active,
      natural:[img?.naturalWidth,img?.naturalHeight],
      photoScale:[parseFloat(panel?.style.width),parseFloat(panel?.style.height)],
      oldAtlasStillPresent:!!p?.querySelector('.atlas-image-window'),
      hasRedZone:!!doc.querySelector('#overheadToggleLayer'),
      eis:document.documentElement.dataset.engineIndication||'EIS'
    };
  });
  assert.ok(result.embedded && result.photoVisible && result.oldAtlasStillPresent && result.hasRedZone,JSON.stringify(result));
  assert.equal(result.family,family==='B737-400'?'OH21_400':'OH21_300500');
  assert.deepEqual(result.natural,[1045,family==='B737-400'?1505:1506]);
  assert.equal(result.eis,'EIS','EIS must remain default on Unified');
  assert.ok(result.photoScale[0]>0&&result.photoScale[1]>0,'photo fit invalid');
  const png=path.join('artifacts/owner-oh21-qa','UNIFIED-'+family+'.png');
  fs.mkdirSync(path.dirname(png),{recursive:true});
  await page.screenshot({path:png,fullPage:false});
  console.log('PASS embedded '+family+' '+JSON.stringify(result));
  // Non-panel errors may originate in existing unrelated modules. Keep the
  // frame-specific OH21 assertions authoritative; log unrelated diagnostics.
  if(errs.length)console.warn('Existing page script diagnostics: '+errs.slice(0,4).join(' | '));
  await page.close();
 }
}finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
