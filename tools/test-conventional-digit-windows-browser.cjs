'use strict';
// Actual Chromium photo-registration QA; this guards the rendered rectangle,
// not just JS parameters. The source photograph and approved N2 needle stay locked.
const assert=require('node:assert/strict');
const {chromium}=require('playwright');
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
 const page=await browser.newPage({viewport:{width:1920,height:1080},deviceScaleFactor:1});
 try{
  const response=await page.goto('http://127.0.0.1:8788/panel-mosaic-lab/cockpit/?v=CONV-REAL-RECT-0012',
    {waitUntil:'domcontentloaded',timeout:60000});
  assert.equal(response.status(),200);
  await page.waitForFunction(()=>window.B737EngineIndicationModeV1?.setMode &&
   window.B737EISDotReadoutsV1?.getSpecs && window.B737ConventionalNeedlesV1?.getSpecs,
   null,{timeout:50000});
  await page.evaluate(()=>window.B737EngineIndicationModeV1.setMode('CONVENTIONAL'));
  await page.waitForFunction(()=>document.documentElement.dataset.engineIndication==='CONVENTIONAL' &&
   document.querySelector('.conventional-engine-panel-v1')?.naturalWidth===1463 &&
   document.querySelectorAll('[data-conventional-backplate]').length===8,
   null,{timeout:50000});
  const info=await page.evaluate(()=>{
   const img=document.querySelector('.conventional-engine-panel-v1');
   const ir=img.getBoundingClientRect();
   const specs=window.B737EISDotReadoutsV1.getSpecs('CONVENTIONAL');
   const needles=window.B737ConventionalNeedlesV1.getSpecs();
   const calibration=window.B737ConventionalNeedlesV1.getDialCalibration();
   return {
    photo:{left:ir.left,top:ir.top,width:ir.width,height:ir.height},
    n2Angles:calibration.n2.photoTickAngles,
    items:specs.map(spec=>{
     const id=spec.id;
     const plate=document.querySelector('[data-conventional-backplate="'+id+'"]');
     const digits=document.querySelector('[data-conventional-readout="'+id+'"]');
     const r=plate.getBoundingClientRect(),n=needles.find(x=>x.id===id);
     const readoutRect=digits.getBoundingClientRect();
     const style=getComputedStyle(plate);
     return{id,signal:spec.signal,scale:spec.scale,cx:spec.cx,cy:spec.cy,needleX:n.cx,needleY:n.cy,
      centerX:((r.left+r.width/2-ir.left)/ir.width)*1463,
      centerY:((r.top+r.height/2-ir.top)/ir.height)*1075,
      sourceWidth:r.width/ir.width*1463,sourceHeight:r.height/ir.height*1075,
      plateRect:[r.left,r.top,r.width,r.height],
      textRect:[readoutRect.left,readoutRect.top,readoutRect.width,readoutRect.height],
      fill:style.fill,opacity:style.fillOpacity,
      plateBeforeText:plate.parentNode===digits.parentNode &&
       [...plate.parentNode.children].indexOf(plate)<[...digits.parentNode.children].indexOf(digits)};
    })
   };
  });
  assert.equal(info.items.length,8);
  assert.deepEqual(info.n2Angles,[45,90,135,180,225,270,315],
   'Do not change the owner-approved N2 needle calibration');
  for(const a of info.items){
   assert.ok(Math.abs(a.centerX-a.cx)<1.25,a.id+' backplate x not aligned to source photo');
   assert.ok(Math.abs(a.centerY-a.cy)<1.25,a.id+' backplate y not aligned to source photo');
   assert.equal(a.cx,a.needleX,a.id+' digit aperture must be centered on needle shaft');
   assert.equal(a.needleY-a.cy,a.signal==='n1'?42:41,a.id+' top red window vertical datum');
   assert.ok(Math.abs(a.sourceHeight-31*.8*a.scale)<.65,
    a.id+' full 31-unit aperture must match individual EGT/FF font scale: '+a.sourceHeight);
   assert.ok(a.needleY-(a.centerY+a.sourceHeight/2)>30,a.id+' no overlap with printed dial text');
   assert.ok(a.fill.includes('52, 55, 56'),a.id+' must have its own charcoal face');
   assert.equal(a.opacity,'1',a.id+' opaque plate');
   assert.equal(a.plateBeforeText,true,a.id+' painted behind its glyphs');
  }
  console.log('CONVENTIONAL_EIGHT_REAL_PIXEL_RECT_PASS',JSON.stringify(info));
  await page.screenshot({path:'/tmp/b737-conventional-numeric-qa.png',timeout:20000});
 } finally{await page.close();await browser.close();}
})().catch(e=>{console.error('CONVENTIONAL_EIGHT_REAL_PIXEL_RECT_FAIL',e.stack||e);process.exitCode=1;});
