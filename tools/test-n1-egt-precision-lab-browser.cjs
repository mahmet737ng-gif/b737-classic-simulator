'use strict';
/* Dedicated real Chromium N1/EGT photographic calibration lab QA.
 * Original photographic source and needle are NOT replaced with mock assets.
 */
const assert=require('node:assert/strict');
const {chromium}=require('playwright');
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
 const page=await browser.newPage({viewport:{width:1536,height:1060},deviceScaleFactor:1});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 try{
  const response=await page.goto('http://127.0.0.1:8788/panel-mosaic-lab/cockpit/n1-egt-precision-lab.html',
   {waitUntil:'networkidle',timeout:60000});
  assert.equal(response.status(),200);
  await page.waitForFunction(()=>window.B737N1EGTPrecisionLabV1?.photoReady()===true,
   null,{timeout:45000});
  const base=await page.evaluate(()=>{
   const api=window.B737N1EGTPrecisionLabV1;
   return {source:api.sourceState(),entries:api.entries.map(e=>({
    ...e,profile:api.getProfile(e.signal,e.engine)
   })),originalPhotos:document.querySelectorAll('[data-source-photograph="original-owner-asset"]').length,
   pointers:document.querySelectorAll('[data-photo-pointer]').length,
   gauges:document.querySelectorAll('article[data-gauge]').length};
  });
  assert.equal(base.entries.length,4);assert.equal(base.originalPhotos,4);
  assert.equal(base.pointers,4);assert.equal(base.gauges,4);
  for(const e of base.entries){
   assert.equal(e.profile.status,'PHOTO_VERIFIED',e.id+' real white ticks not verified');
   assert.equal(e.profile.values[0],0,'First photographed white mark must be absolute zero');
   assert.equal(e.profile.values.at(-1),e.max,'Last white mark must match maximum');
   assert.equal(e.profile.values.length,e.signal==='n1'?13:11,'Every physical major mark must be registered');
  }
  let checked=0,maxAngleError=0,maxDisplayedError=0;
  assert.equal(await page.evaluate(()=>window.B737N1EGTPrecisionLabV1.NEEDLE_VISUAL_OFFSET_DEG),
   -1.8,'Photo-only needle correction should be -1.8 degrees');
  const valuesByGauge={};
  for(const e of base.entries){
   const marks=[...e.profile.values],tests=[...marks,...marks.slice(0,-1).map((x,i)=>(x+marks[i+1])/2)];
   let seed=31917+Number(e.engine.at(-1))*7+(e.signal==='egt'?13:0);
   for(let i=0;i<50;i++){seed=(Math.imul(seed,1664525)+1013904223)>>>0;tests.push(seed/4294967296*e.max);}
   for(const value of tests){
    const report=await page.evaluate(({id,value})=>{
     const lab=window.B737N1EGTPrecisionLabV1,angle=lab.setValue(id,value);
     const pointer=document.querySelector('[data-photo-pointer="'+id+'"]');
     const digits=document.querySelector('[data-photo-digits="'+id+'"]');
     const painted=Number(pointer?.getAttribute('transform')?.match(/rotate\(([-0-9.]+)\)/)?.[1]);
     return {angle:angle.angle,renderAngle:angle.renderAngle,
      visualOffsetDeg:angle.visualOffsetDeg,value:angle.value,text:angle.text,
      rendered:Number(pointer?.dataset.angle),painted,
      calibration:Number(pointer?.dataset.calibratedAngle),
      digit:digits?.dataset.text,source:digits?.dataset.value,
      glyphs:digits?.querySelectorAll('circle').length||0,
      photoHref:document.querySelector('article[data-gauge="'+id+'"] [data-source-photograph]')?.getAttribute('href'),
      needleHref:pointer?.querySelector('image')?.getAttribute('href')};
    },{id:e.id,value});
    assert.equal(report.value,value,'Slider state changed unexpectedly');
    assert.equal(report.digit,report.text,e.id+' rendered dot readout not the ECU value');
    assert.ok(report.glyphs>10,e.id+' visible original dot glyphs absent');
    assert.ok(report.photoHref?.includes('p2-conventional-full-owner-20261030.png'));
    assert.ok(report.needleHref?.includes('conventional-needle-photo-v1.svg'));
    const delta=Math.abs(report.rendered-report.renderAngle);
    assert.ok(delta<=.000051,e.id+' photo needle not on compensated tick '+value);
    assert.ok(Math.abs(report.painted-report.renderAngle)<=.000051,
     e.id+' rendered SVG transform does not apply -1.8° photo correction');
    assert.ok(Math.abs(report.calibration-report.angle)<=.000051,
     e.id+' detent calibration changed instead of visual needle');
    assert.ok(Math.abs(report.renderAngle-report.angle+1.8)<=.0000001,
     e.id+' photographic needle bias changed');
    assert.equal(report.visualOffsetDeg,-1.8);
    maxAngleError=Math.max(maxAngleError,delta);
    const err=Math.abs(Number(report.text)-value);
    assert.ok(err<=(e.signal==='n1'?.050001:.500001),e.id+' numeric mismatch '+value);
    maxDisplayedError=Math.max(maxDisplayedError,err);checked++;
   }
   valuesByGauge[e.id]=tests.length;
  }
  await page.getByRole('button',{name:'نمایش خطوط کالیبراسیون'}).click();
  const marks=await page.evaluate(()=>[...document.querySelectorAll('[data-calibration-marks]')].map(g=>({
   id:g.getAttribute('data-calibration-marks'),opacity:g.style.opacity,
   ticks:g.querySelectorAll('[data-tick-angle]').length
  })));
  assert.equal(marks.length,4);
  for(const m of marks){assert.equal(m.opacity,'1');assert.equal(m.ticks,m.id.startsWith('n1')?13:11);}
  await page.locator('#random-audit').click();
  const audit=await page.evaluate(()=>window.B737N1EGTPrecisionLabV1.audit({count:1000,seed:191737}));
  assert.equal(audit.pass,true);assert.ok(audit.checks>=1000);
  for(const e of base.entries)await page.evaluate(({id,v})=>
   window.B737N1EGTPrecisionLabV1.setValue(id,v),{id:e.id,v:e.initial});
  await page.screenshot({path:'/tmp/b737-n1-egt-precision-lab.png',fullPage:true,timeout:25000});
  assert.deepEqual(errors,[]);
  console.log('N1_EGT_PRECISION_LAB_PASS',JSON.stringify({
   photoVerified:true,photoAssetCount:base.originalPhotos,pointers:base.pointers,
   tests:checked,perGauge:valuesByGauge,zeroEndpointsValidated:true,
   visualNeedleOffsetDeg:-1.8,maxPointerAngleError:maxAngleError,
   maxDisplayQuantizationError:maxDisplayedError,
   visualMarks:marks,randomAuditChecks:audit.checks}));
 }finally{await page.close();await browser.close();}
})().catch(error=>{console.error('N1_EGT_PRECISION_LAB_FAIL',error.stack||error);process.exitCode=1;});