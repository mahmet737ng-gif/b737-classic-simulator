'use strict';
const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const url=process.env.B737_TEST_ORIGIN||'http://127.0.0.1:8788';
const dir='artifacts/le-photolens-v2';fs.mkdirSync(dir,{recursive:true});
(async()=>{
 const browser=await chromium.launch(process.env.CHROME_PATH?{headless:true,executablePath:process.env.CHROME_PATH}:{headless:true});
 try{
  const page=await browser.newPage({viewport:{width:1280,height:960}});
  const errors=[];page.on('pageerror',e=>errors.push(String(e)));
  await page.goto(url+'/panel-mosaic-lab/le-devices/index.html',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.B737LEPhotoLensV2?.status()?.some(s=>s.mounted&&s.lenses===26),null,{timeout:45000});
  const check=await page.evaluate(()=>{
   const parent=document.querySelector('.b737-le-devices');
   const source=parent.querySelector('svg.b737-le-devices__lamps');
   const layer=parent.querySelector('svg.b737-le-photolens-v2');
   const parts=[...source.querySelectorAll('path[data-device][data-level]')];
   const faces=[...layer.querySelectorAll('[data-lens-id]')];
   const fit=parts.every((p,i)=>{
    const b=p.getBBox(),small=faces[i].querySelector('path').getBBox();
    return small.x>b.x&&small.y>b.y&&small.x+small.width<b.x+b.width&&small.y+small.height<b.y+b.height;
   });
   return {parts:parts.length,faces:faces.length,fit,
    bg:parent.querySelector('.b737-le-devices__background').naturalWidth,
    invisibleSource:getComputedStyle(parts[0]).fill==='rgba(0, 0, 0, 0)',
    testButton:!!parent.querySelector('.b737-le-devices__test')};
  });
  assert.equal(check.parts,26);assert.equal(check.faces,26);assert.ok(check.fit,'Any lens is outside photo lamp aperture: '+JSON.stringify(check));
  assert.ok(check.bg>0,'Original locked image missing');
  assert.ok(check.invisibleSource,'Flat neon core fill is still visible');
  assert.ok(check.testButton,'TEST button missing');
  await page.evaluate(()=>window.B737LeadingEdgeDevices.setGlobalLampTest(true));
  await page.waitForTimeout(300);
  const bright=await page.evaluate(()=>[...document.querySelectorAll('.b737-le-photolens-v2 [data-lens-id]')].map(n=>+n.querySelector('[data-optic-layer="illuminated-glass"]').style.opacity));
  assert.equal(bright.length,26);assert.ok(bright.every(v=>v>.9),'All 26 bright lenses must light');
  await page.screenshot({path:path.join(dir,'26-on-bright.png'),fullPage:false});
  await page.evaluate(()=>window.B737LeadingEdgeDevices.setBrightness('DIM'));
  await page.waitForTimeout(160);
  const dim=await page.evaluate(()=>[...document.querySelectorAll('.b737-le-photolens-v2 [data-lens-id]')].map(n=>+n.querySelector('[data-optic-layer="illuminated-glass"]').style.opacity));
  assert.ok(dim.every(v=>v>.5&&v<.6),'DIM must dim all 26 independently');
  await page.screenshot({path:path.join(dir,'26-on-dim.png'),fullPage:false});
  await page.evaluate(()=>{window.B737LeadingEdgeDevices.setGlobalLampTest(false);window.B737LeadingEdgeDevices.reset();});
  await page.waitForTimeout(250);
  const off=await page.evaluate(()=>[...document.querySelectorAll('.b737-le-photolens-v2 [data-lens-id]')].map(n=>+n.querySelector('[data-optic-layer="illuminated-glass"]').style.opacity));
  assert.ok(off.every(v=>v===0),'Off lamps must expose physical unlit glass');
  const genuineOff=await page.evaluate(()=>[...document.querySelectorAll('.b737-le-photolens-v2 [data-lens-id]')].every(n=>{
   const dark=n.querySelector('[data-optic-layer="unlit-glass"]');
   const lit=n.querySelector('[data-optic-layer="illuminated-glass"]');
   return dark&&lit&&getComputedStyle(dark).fill!=='none'&&
     +lit.style.opacity===0&&dark.getBBox().width>=lit.getBBox().width;
  }));
  assert.ok(genuineOff,'OFF lenses must have a real opaque dark glass layer masking painted bitmap');
  await page.screenshot({path:path.join(dir,'26-off.png'),fullPage:false});
  await page.evaluate(()=>window.B737LeadingEdgeDevices.setDevice('SLAT_1','TRANSIT'));
  await page.waitForTimeout(250);
  const one=await page.evaluate(()=>[...document.querySelectorAll('.b737-le-photolens-v2 [data-lens-id]')].filter(n=>+n.querySelector('[data-optic-layer="illuminated-glass"]').style.opacity>0).map(n=>n.dataset.lensId));
  assert.deepEqual(one,['SLAT_1|TRANSIT']);
  await page.close();
  const unified=await browser.newPage({viewport:{width:1600,height:950}});
  await unified.goto(url+'/panel-mosaic-lab/cockpit/index.html',{waitUntil:'domcontentloaded',timeout:90000});
  await unified.waitForFunction(()=>{
   const f=document.getElementById('overheadFrame');
   return f?.contentWindow?.B737LEPhotoLensV2?.status()?.some(s=>s.mounted&&s.lenses===26);
  },null,{timeout:90000});
  const result=await unified.evaluate(()=>{const doc=document.getElementById('overheadFrame').contentDocument;return {lens:doc.querySelectorAll('.b737-le-photolens-v2 [data-lens-id]').length,original:doc.querySelectorAll('.b737-le-devices__lamps path[data-device]').length};});
  assert.equal(result.lens,26);assert.equal(result.original,26);
  await unified.screenshot({path:path.join(dir,'unified-mounted.png'),fullPage:false});
  console.log('PASS: 26 photo-fitted lenses, BRIGHT/DIM/OFF, independent signal, real Unified iframe integration',JSON.stringify({check,result,errors:errors.slice(0,3)}));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});