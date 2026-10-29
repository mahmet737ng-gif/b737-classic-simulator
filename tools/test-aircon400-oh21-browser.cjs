'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {chromium}=require('playwright');
const base='http://127.0.0.1:8788/panel-mosaic-lab/cockpit/overhead-stage.html';
(async()=>{
 const browser=await chromium.launch({headless:true,...(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:{}),args:['--no-sandbox','--disable-dev-shm-usage']});
 fs.mkdirSync('artifacts/aircon400-oh21',{recursive:true});
 try{
  for(const family of ['B737-300-500','B737-400']){
   const page=await browser.newPage({viewport:{width:2600,height:1450},deviceScaleFactor:1});
   const errors=[];
   page.on('pageerror',e=>errors.push(String(e)));
   await page.addInitScript(family=>{
    const key='b737classic.aircraft-profile.v1';
    localStorage.setItem(key,JSON.stringify({
     schema:'b737-classic-aircraft-profile/1',aircraftFamily:family,
     pressurization:'CPCS',engineInstruments:'EIS'
    }));
   },family);
   const response=await page.goto(base,{waitUntil:'domcontentloaded',timeout:60000});
   assert.equal(response.status(),200,'overhead browser route');
   await page.waitForFunction(()=>window.B737Aircon400Oh21&&window.B737OverheadLights&&
    !!document.getElementById('toggle-recirc-fan')&&
    !!document.querySelector('.atlas-piece[data-key="OH21"]')&&
    !!document.querySelector('#aircon400Oh21Overlay .aircon400-recirculation-label'),null,{timeout:45000});
   // Real evidence requires full decode of original OH21 photograph.
   const plate=page.locator('.atlas-piece[data-key="OH21"]');
   await plate.scrollIntoViewIfNeeded({timeout:30000});
   await page.evaluate(()=>window.B737ImageLoader?.refresh());
   await page.waitForFunction(()=>{
    const photos=[...document.querySelectorAll('.atlas-piece[data-key="OH21"] img.atlas-photo')];
    return photos.length>0&&photos.every(im=>im.complete&&im.naturalWidth>=500&&im.naturalHeight>=500);
   },null,{timeout:45000});
   const decoded=await page.evaluate(()=>[...document.querySelectorAll('.atlas-piece[data-key="OH21"] img.atlas-photo')].map(im=>({
    src:im.currentSrc,width:im.naturalWidth,height:im.naturalHeight,ready:im.dataset.perfReady||'raw'
   })));
   assert.ok(decoded.every(x=>x.width>=500&&x.height>=500),'Original OH21 photograph must decode: '+JSON.stringify(decoded));
   const data=await page.evaluate(()=>{
    const model=window.B737Aircon400Oh21;
    const overlay=document.getElementById('aircon400Oh21Overlay');
    const labels=[...document.querySelectorAll('.aircon400-recirculation-label')];
    const fontMeasure=label=>{
     const s=getComputedStyle(label);
     const canvas=document.createElement('canvas'),ctx=canvas.getContext('2d');
     ctx.font=s.fontWeight+' '+s.fontSize+' '+s.fontFamily;
     return {name:label.textContent,kind:label.dataset.labelKind,
      painted:ctx.measureText(label.textContent).width,
      available:label.clientWidth,rect:label.getBoundingClientRect().toJSON(),
      background:s.backgroundColor,visible:s.visibility};
    };
    const rightToggle=document.querySelector('#toggle-recirc-fan');
    const leftToggle=document.querySelector('#toggle-recirc-fan-l-400');
    const cover=document.querySelector('#aircon400Oh21Underlay');
    const candidate=window.B737OH21OwnerPhotoV1?.status?.();
    const photo=document.querySelector('.owner-oh21-photo-layer-v1 img');
    return {state:model.getState(),hidden:overlay.hidden,
     candidatePhoto:{active:candidate?.active,loaded:!!photo?.isConnected,decoded:!!photo?.naturalWidth},
     labels:labels.map(fontMeasure),
     left:!!leftToggle,right:!!rightToggle,
     switches:{left:leftToggle?.getBoundingClientRect().toJSON(),right:rightToggle?.getBoundingClientRect().toJSON()},
     nativeTooltip:rightToggle?.getAttribute('title'),
     coverHidden:cover?.hidden,
     alerts:[...document.querySelectorAll('[role="alert"]')].map(x=>x.textContent).slice(0,6)};
   });
   assert.equal(data.hidden,family!=='B737-400','Only 400 shows variant layer');
   assert.ok(data.right,'Original right switch cannot disappear');
   if(family==='B737-300-500'){
    assert.equal(data.coverHidden,true,'300/500 source must not be masked by 400 artwork');
    assert.equal(data.nativeTooltip,'RECIRC FAN','Original 300/500 tooltip is restored');
   }
   assert.ok(data.left,'Clone left switch must be mounted');
   assert.deepEqual(errors.filter(x=>/aircon|SyntaxError/.test(x)),[],'No aircon script exceptions');
   if(family==='B737-400'){
    assert.equal(data.labels.length,6,'two identical titles and matching OFF/AUTO on BOTH sides');
    assert.equal(data.nativeTooltip,null,'The unexpected extra RECIRC FAN hover tooltip must be absent in 400');
    assert.equal(data.coverHidden,false,'400 native-right-control cover must remain mounted (may be photo-hidden)');
    if(data.candidatePhoto.active==='OH21_400')assert.ok(data.candidatePhoto.loaded&&data.candidatePhoto.decoded,'Owner 400 photo must be decoded and in the DOM');
    const titleLabels=data.labels.filter(x=>x.kind==='title');
    assert.equal(titleLabels.length,2);
    assert.equal(titleLabels[0].rect.width,titleLabels[1].rect.width,'Equal title widths');
    assert.equal(titleLabels[0].rect.height,titleLabels[1].rect.height,'Equal title heights');
    assert.equal(titleLabels[0].rect.top,titleLabels[1].rect.top,'Equal title baseline');
    assert.ok(Math.abs(titleLabels[0].painted-titleLabels[1].painted)<15,'L/R RECIRC font metrics match');
    const detents=data.labels.filter(x=>x.kind==='detent');
    assert.deepEqual(detents.map(x=>x.name),['OFF','AUTO','OFF','AUTO']);
    assert.equal(detents[0].rect.width,detents[2].rect.width);
    assert.equal(detents[1].rect.width,detents[3].rect.width);
    for(const l of data.labels){
     assert.ok(l.painted<=l.available-3,'Label overflows its lens: '+JSON.stringify(l));
     assert.equal(l.visible,data.candidatePhoto.loaded?'hidden':'visible','Legacy labels must be covered by the user photo');
     assert.notEqual(l.background,'rgb(216, 229, 239)','No giant pale label background');
    }
    const rects=data.labels.map(l=>l.rect);
    for(let i=0;i<rects.length;i++)for(let j=i+1;j<rects.length;j++){
     const a=rects[i],b=rects[j];
     assert.ok(a.right<=b.left||b.right<=a.left||a.bottom<=b.top||b.bottom<=a.top,
      'Overlapping live legend rectangles '+data.labels[i].name+' / '+data.labels[j].name);
    }
    const before=data.state;
    await page.evaluate(()=>document.getElementById('toggle-recirc-fan-l-400').click());
    const updated=await page.evaluate(()=>({
     controls:window.B737Aircon400Oh21.getState(),
     pneumatic:window.B737OverheadLights.getState().pneumatic.recircFans
    }));
    assert.equal(updated.controls.left,before.left==='AUTO'?'OFF':'AUTO','L position changes');
    assert.equal(updated.controls.right,before.right,'R position must not change');
    assert.equal(updated.pneumatic.L.selectedMode,updated.controls.left);
    assert.equal(updated.pneumatic.R.selectedMode,before.right);
    // Test the native right RECIRC toggle as a REAL switch. In OFF both
    // physical handles point up, the worst-case title collision geometry.
    await page.evaluate(()=>document.getElementById('toggle-recirc-fan').click());
    const bothOff=await page.evaluate(()=>({
     controls:window.B737Aircon400Oh21.getState(),
     pneumatic:window.B737OverheadLights.getState().pneumatic.recircFans
    }));
    assert.equal(bothOff.controls.left,'OFF','L OFF after user action');
    assert.equal(bothOff.controls.right,'OFF','R OFF after user action');
    assert.equal(bothOff.pneumatic.L.selectedMode,'OFF');
    assert.equal(bothOff.pneumatic.R.selectedMode,'OFF');
   }
   await plate.screenshot({
    path:'artifacts/aircon400-oh21/'+(family==='B737-400'?'400':'300-500')+'.png',
    animations:'disabled',timeout:45000
   });
   console.log('LIVE_BROWSER_OH21_PASS',family,JSON.stringify({photo:decoded,labels:data.labels,errors:errors.slice(0,3)}));
   await page.close();
  }
 }finally{await browser.close();}
})().catch(e=>{console.error('LIVE_BROWSER_OH21_FAIL',e.stack||String(e));process.exitCode=1;});
