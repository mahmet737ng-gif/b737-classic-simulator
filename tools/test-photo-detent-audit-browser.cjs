'use strict';
// Real Chromium rendering proof: all 16 photo needles, independently traced
// marks, every detent, seeded random ECU values and digital/physical parity.
const assert=require('node:assert/strict');
const {chromium}=require('playwright');
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
 const page=await browser.newPage({viewport:{width:1920,height:1080},deviceScaleFactor:1});
 try{
  const response=await page.goto('http://127.0.0.1:8788/panel-mosaic-lab/cockpit/?v=PHOTO-DETENT-0001',
   {waitUntil:'domcontentloaded',timeout:60000});
  assert.equal(response.status(),200);
  await page.waitForFunction(()=>window.B737EngineIndicationModeV1?.setMode &&
   window.B737ConventionalNeedlesV1?.getPhotoDetentAudit &&
   window.B737PhotoDetentCalibrationV1?.inspectAll &&
   window.B737EISDotReadoutsV1?.setReading,null,{timeout:60000});
  await page.evaluate(()=>window.B737EngineIndicationModeV1.setMode('CONVENTIONAL'));
  await page.waitForFunction(()=>document.documentElement.dataset.engineIndication==='CONVENTIONAL'&&
   window.B737ConventionalNeedlesV1.getPhotoDetentAudit()?.photoEvidence?.status==='SCANNED',
   null,{timeout:60000});
  const report=await page.evaluate(()=>{
   const core=window.B737PhotoDetentCalibrationV1;
   const needles=window.B737ConventionalNeedlesV1;
   const digits=window.B737EISDotReadoutsV1;
   const audits=needles.getPhotoDetentAudit();
   const scans=audits.photoEvidence.scans;
   let rng=35179;
   const failures=[],results=[];
   function check(ok,message){if(!ok)failures.push(message);}
   for(const signal of Object.keys(core.REFERENCE))for(const engine of ['engine1','engine2']){
    const p=core.getProfile(signal,engine),id=signal+'_'+engine.at(-1);
    const rotor=document.querySelector('[data-needle-pivot="'+id+'"]');
    check(!!rotor,id+' physical photographic pointer missing');
    const marks=core.detents(signal,engine,4),samples=marks.map(m=>m.value);
    for(let i=0;i<96;i++){
     rng=(Math.imul(rng,1664525)+1013904223)>>>0;
     samples.push(p.values[0]+rng/4294967296*(p.values.at(-1)-p.values[0]));
    }
    let maxAngleError=0,maxDigitalError=0;
    for(const v of samples){
     needles.setReading(engine,signal,v,'ENGINE_INDICATION_BACKEND_V2');
     if(['n1','n2','egt','fuelFlow'].includes(signal))
      digits.setReading(engine,signal,v,'ENGINE_INDICATION_BACKEND_V2');
     const transform=rotor?.getAttribute('transform')||'';
     const actual=Number(transform.match(/rotate\(([-0-9.]+)\)/)?.[1]);
     const expected=core.angle(signal,engine,v);
     const diff=Math.abs(actual-expected);
     maxAngleError=Math.max(maxAngleError,diff);
     check(Number.isFinite(actual)&&diff<.00051,id+' needle differs from ECU at '+v);
     const datum=needles.getReadings()[id]?.value;
     check(Math.abs(datum-v)<1e-8,id+' needle source mismatch');
     if(['n1','n2','egt','fuelFlow'].includes(signal)){
      const text=document.querySelector('[data-conventional-readout="'+id+'"]')?.dataset.value;
      const precision=signal==='egt'?1:signal==='fuelFlow'?.01:.1;
      const factor=signal==='fuelFlow'?1000:1;
      const numeric=Number(text);
      const err=Math.abs(numeric*factor-v);
      if(numeric===numeric)maxDigitalError=Math.max(maxDigitalError,err);
      check(Number.isFinite(numeric)&&err<=(precision*factor)/2+.051,
       id+' displayed rolling number differs from same ECU value '+v+' text '+text);
     }
    }
    results.push({id,checks:samples.length,maxAngleError,maxDigitalError,
     status:p.status,zeroAngle:p.angles[0],lastAngle:p.angles.at(-1)});
   }
   for(const signal of ['n1','egt']){
    for(const engine of ['engine1','engine2']){
     const scan=scans.find(s=>s.signal===signal&&s.engine===engine);
     check(!!scan,signal+' '+engine+' photo detection missing');
     check(scan?.passed===true,signal+' '+engine+' white-line detection requires review');
     const physical=core.getProfile(signal,engine);
     check(physical.status==='PHOTO_VERIFIED',signal+' '+engine+' lacks verified photo calibration');
    }
   }
   check(core.getProfile('n2','engine1').status==='OWNER_LOCKED','N2 calibration changed');
   return{version:core.VERSION,scans,results,failures:failures.slice(0,30),
    failureCount:failures.length,auditOK:audits.pass};
  });
  console.log('PHOTO_DETENT_BROWSER_AUDIT',JSON.stringify(report));
  assert.equal(report.auditOK,true);
  assert.equal(report.results.length,16);
  assert.equal(report.failureCount,0,'Rendered engine needle/digital audit failed: '+JSON.stringify(report.failures));
  // The live ECU remains authoritative. Random diagnostic injections are
  // intentionally replaced by the real plant's next packet, so validate the
  // SETTLED ECU source, its visible dot string and the photo pointer together.
  await page.waitForFunction(()=>{
   const states=window.B737EISDotReadoutsV1?.getMotion('CONVENTIONAL');
   return states&&Object.values(states).length===8&&
    Object.values(states).every(slots=>slots.every(s=>!s||s.moving===false));
  },null,{timeout:40000});
  const settled=await page.evaluate(()=>{
   const found=[],font=window.B737EISDotDigitsV1;
   const dots=window.B737EISDotReadoutsV1;
   const needles=window.B737ConventionalNeedlesV1;
   const core=window.B737PhotoDetentCalibrationV1;
   const convSpecs=dots.getSpecs('CONVENTIONAL');
   for(const engine of [1,2])for(const signal of ['n1','egt','n2','fuelFlow']){
    const id=signal+'_'+engine;
    const group=document.querySelector('[data-conventional-readout="'+id+'"]');
    const spec=convSpecs.find(s=>s.id===id);
    const source=dots.getReadings()[id].value;
    const pointerValue=needles.getReadings()[id].value;
    const expected=font.format(source,spec);
    const visual=group?[...group.querySelectorAll('[data-eis-digit-tape]')]
     .filter(t=>t.getAttribute('visibility')==='visible').length:0;
    const fallback=group?[...group.querySelectorAll('[data-eis-digit-cell] use')]
     .filter(t=>t.getAttribute('visibility')==='visible').length:0;
    const pointer=document.querySelector('[data-needle-pivot="'+id+'"]');
    const actualAngle=Number(pointer?.getAttribute('transform')?.match(/rotate\\(([-0-9.]+)\\)/)?.[1]);
    const expectedAngle=core.angle(signal,'engine'+engine,pointerValue);
    found.push({id,actual:group?.dataset.value,expected,source,pointerValue,
     actualAngle,expectedAngle,visibleTapes:visual,visibleFixed:fallback,
     rect:group?.getBoundingClientRect()?.width||0});
   }
   return found;
  });
  for(const item of settled){
   assert.equal(item.actual,item.expected,item.id+' photographed number differs from settled ECU');
   assert.ok(item.visibleTapes+item.visibleFixed>0,
    item.id+' settled photo instrument has no visible digit glyphs');
   assert.ok(Number.isFinite(item.actualAngle)&&Math.abs(item.actualAngle-item.expectedAngle)<.00051,
    item.id+' pointer differs from its measured dial detent');
   assert.ok(item.rect>0,item.id+' readout has no physical browser window');
   if(Number.isFinite(item.source)&&Number.isFinite(item.pointerValue))
    assert.ok(Math.abs(item.source-item.pointerValue)<.01,
     item.id+' digit and needle follow different live ECU sources');
  }
  console.log('PHOTO_DETENT_SETTLED_DIGITS_PASS',JSON.stringify(settled));
  await page.screenshot({path:'/tmp/b737-photo-detents-random-qa.png',timeout:20000});
  await page.locator('.conventional-engine-photo-wrap-v1').screenshot({
   path:'/tmp/b737-photo-detents-closeup-qa.png',timeout:20000});
 }finally{await page.close();await browser.close();}
})().catch(err=>{console.error('PHOTO_DETENT_BROWSER_AUDIT_FAIL',err.stack||err);process.exitCode=1;});
