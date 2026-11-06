'use strict';
const assert=require('node:assert/strict');
const {chromium}=require('playwright');
// Pixel/DOM audit in the same deployed Unified that the user opens.
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
 const page=await browser.newPage({viewport:{width:1920,height:1080},deviceScaleFactor:1});
 const errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 try{
  const res=await page.goto('http://127.0.0.1:8788/panel-mosaic-lab/cockpit/?v=CONV-ONE-SOURCE-001',
   {waitUntil:'domcontentloaded',timeout:60000});
  assert.equal(res.status(),200);
  await page.waitForFunction(()=>
   window.B737EngineIndicationModeV1?.setMode &&
   window.B737ConventionalIndicationSyncV1?.intake &&
   window.B737UnifiedEngineIndicationsV2?.getState &&
   window.B737EISDotReadoutsV1?.getDisplayed &&
   window.B737ConventionalNeedlesV1?.getPhotoRegistration,
   null,{timeout:50000});
  await page.evaluate(()=>window.B737EngineIndicationModeV1.setMode('CONVENTIONAL'));
  await page.waitForFunction(()=>
   document.documentElement.dataset.engineIndication==='CONVENTIONAL'&&
   window.B737ConventionalNeedlesV1.getPhotoDetentAudit()?.photoEvidence?.status==='SCANNED'&&
   document.querySelectorAll('[data-conventional-readout]').length===8&&
   document.querySelectorAll('[data-needle-pivot]').length===16,
   null,{timeout:60000});
  const report=await page.evaluate(async()=>{
   const sync=window.B737ConventionalIndicationSyncV1;
   const photo=window.B737PhotoDetentCalibrationV1;
   const needles=window.B737ConventionalNeedlesV1;
   const dots=window.B737EISDotReadoutsV1;
   const fonts=window.B737EISDotDigitsV1;
   const registration=needles.getPhotoRegistration();
   const failures=[],measured=[];
   const signals=['n1','egt','n2','fuelFlow','oilPressure','oilTemperature','oilQuantity','vibration'];
   const values={n1:60,egt:500,n2:60,fuelFlow:1200,oilPressure:76,
    oilTemperature:85,oilQuantity:3.8,vibration:1.4};
   const keys={n1:'n1',egt:'egt',n2:'n2',fuelFlow:'fuelFlow',oilPressure:'oilPressure',
    oilTemperature:'oilTemp',oilQuantity:'oilQty',vibration:'vib'};
   function frame(patch={}){
    const engines={};
    for(const side of ['engine1','engine2']){
     const indications={};
     for(const signal of signals){
      indications[signal]={status:'VALID',pointer:'TRACKING',value:values[signal],
       digitalValue:values[signal],power:'ON'};
     }
     engines[side]={indications};
    }
    if(patch?.signal)engines[patch.engine||'engine1'].indications[patch.signal]=patch.reading;
    return{mode:'CONVENTIONAL',engines};
   }
   function check(ok,label){if(!ok)failures.push(label);}
   async function evaluateSample(signal,engine,value){
    values[signal]=value;
    // A fresh backend frame is fed into the real Unified coordinator.
    sync.reset();
    sync.intake(frame());
    await Promise.resolve(); // one numeric batch flush before browser paint
    const id=keys[signal]+'_'+engine.slice(-1);
    const reading=needles.getReadings()[id];
    const channel=sync.getState().channels[id];
    const pointer=document.querySelector('[data-needle-pivot="'+id+'"]');
    const angle=Number(pointer?.dataset.renderAngle);
    const expected=photo.angle(keys[signal],engine,value);
    check(Math.abs(angle-expected)<.0011,id+' pointer misses photo tick: '+value);
    check(Math.abs(reading.value-value)<1e-8,id+' pointer differs from ECU: '+value);
    check(Math.abs(channel.value-value)<1e-8,id+' coordinator differs from ECU: '+value);
    if(['n1','egt','n2','fuelFlow'].includes(signal)){
     const digits=dots.getDisplayed('CONVENTIONAL')[id];
     const numeric=dots.getReadings()[id];
     const spec=dots.getSpecs('CONVENTIONAL').find(s=>s.id===id);
     const expectedText=fonts.format(value,spec);
     check(digits?.text===expectedText,id+' displayed text not from same indicated value');
     check(numeric?.value===value,id+' numeric source not synchronized');
     check(digits?.phase==='REST',id+' independent wheel phase was not stopped');
     check(digits?.source==='ENGINE_INDICATION_SYNC_V1',id+' old direct ECU observation still owns numeral');
    }
    measured.push({id,value,angle,expected});
   }
   const p1=registration.n1_1,p2=registration.n1_2,eg1=registration.egt_1;
   check(p1.values.length===13&&p2.values.length===13,'N1 all white lines must be registered');
   check(eg1.values.length===11,'EGT all white marks must be registered');
   check(photo.getProfile('n2','engine1').status==='OWNER_LOCKED','N2 calibration was altered');
   for(const engine of ['engine1','engine2'])for(const signal of signals){
    const p=photo.getProfile(keys[signal],engine);
    await evaluateSample(signal,engine,p.values[0]);
    await evaluateSample(signal,engine,p.values.at(-1));
    if(signal==='n1'||signal==='egt'){
     for(const point of [p.values[1],p.values[3],(p.values[4]+p.values[5])/2])
      await evaluateSample(signal,engine,point);
    }
   }
   for(const sample of [0,10,22,45,60,91.3,100,120])
    await evaluateSample('n1','engine1',sample);
   for(const sample of [0,100,290,445,500,687,800,1000])
    await evaluateSample('egt','engine2',sample);
   // Verify a live shift: same synchronized target and same intermediate
   // display-frame value, not two unrelated animation timelines.
   await evaluateSample('n1','engine1',91.3);
   values.n1=15.5;
   sync.intake(frame());
   await Promise.resolve();
   let previous=91.3;
   for(let i=0;i<50;i++){
    sync.advance(1/30);
    await Promise.resolve();
    const pointerValue=needles.getReadings().n1_1.value;
    const digitValue=dots.getReadings().n1_1.value;
    check(Math.abs(pointerValue-digitValue)<1e-8,'Animated N1 numeric/needle diverged');
    check(pointerValue<=previous+.00001,'N1 needle moved backwards in response');
    previous=pointerValue;
   }
   check(Math.abs(previous-15.5)<.01,'Animated N1 failed to settle');
   // CB open and sensor failed are distinct nonnumeric states; never leave
   // the old live digit 91% while the physical pointer is parked.
   const faultCases=[
    ['n1','POWER_LOSS','PROTECTED_CIRCUIT_CB_OPEN'],
    ['egt','SENSOR_FAILED','TEST_SENSOR_FAILURE']
   ];
   for(const [signal,status,reason] of faultCases){
    sync.reset();
    sync.intake(frame({signal,reading:{status,pointer:'OFF_SCALE',
     value:null,reason,power:status==='POWER_LOSS'?'OFF':'ON'}}));
    await Promise.resolve();
    const key=signal+'_1',state=sync.getState();
    check(state.channels[key].state==='BLANK',key+' failure state not projected');
    check(needles.getReadings()[key].value===null,key+' pointer fabricated live reading');
    check(dots.getReadings()[key].value===null,key+' stale live numeral remained after failure');
    check(state.parity[key].valueMatch===true,key+' failure state is not internally consistent');
   }
   // A new valid backend snapshot must recover both channels.
   sync.reset();
   values.n1=91.3;values.egt=687;
   sync.intake(frame());await Promise.resolve();
   check(needles.getReadings().n1_1.value===91.3,'N1 recovery failed');
   check(dots.getReadings().n1_1.value===91.3,'Digital N1 recovery failed');
   const out=sync.getState();
   const mismatch=Object.entries(out.parity).filter(([id,p])=>p.valueMatch!==true||p.angleMatch!==true);
   check(mismatch.length===0,'Final live/angle mismatch: '+JSON.stringify(mismatch));
   return{failures:failures.slice(0,30),failureCount:failures.length,
    measured:measured.length,scales:Object.keys(registration).length,
    sampleMeasurements:measured.filter(x=>x.id==='n1_1'||x.id==='egt_2').slice(-15),
    parity:out.parity,version:sync.VERSION};
  });
  console.log('UNIFIED_ONE_SOURCE_PIXEL_AUDIT',JSON.stringify(report));
  assert.equal(report.scales,16);
  assert.ok(report.measured>=40);
  assert.equal(report.failureCount,0,'Unified end-to-end parity regression '+JSON.stringify(report.failures));
  await page.screenshot({path:'/tmp/b737-conventional-one-source-parity.png',timeout:20000});
  await page.locator('.conventional-engine-photo-wrap-v1').screenshot({
   path:'/tmp/b737-conventional-one-source-photo-closeup.png',timeout:20000});
  // EIS must not inherit the Conventional-only synchronized motion policy.
  await page.evaluate(()=>window.B737EngineIndicationModeV1.setMode('EIS'));
  await page.waitForFunction(()=>document.documentElement.dataset.engineIndication==='EIS',null,{timeout:5000});
  assert.equal(await page.evaluate(()=>window.B737ConventionalIndicationSyncV1.getState().active),false);
  assert.deepEqual(errors,[]);
  console.log('UNIFIED_ONE_SOURCE_BROWSER_PASS',JSON.stringify({measurements:report.measured,
   scales:report.scales,failed:report.failureCount,EISIsolated:true}));
 }finally{await page.close();await browser.close();}
})().catch(err=>{console.error('UNIFIED_ONE_SOURCE_BROWSER_FAIL',err.stack||err);process.exitCode=1;});
