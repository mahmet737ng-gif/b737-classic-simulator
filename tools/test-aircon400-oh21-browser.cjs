'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {chromium}=require('playwright');
const base='http://127.0.0.1:8788/panel-mosaic-lab/cockpit/overhead-stage.html';
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
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
    return {state:model.getState(),hidden:overlay.hidden,
     labels:labels.map(fontMeasure),
     left:!!document.querySelector('#toggle-recirc-fan-l-400'),
     right:!!document.querySelector('#toggle-recirc-fan'),
     alerts:[...document.querySelectorAll('[role="alert"]')].map(x=>x.textContent).slice(0,6)};
   });
   assert.equal(data.hidden,family!=='B737-400','Only 400 shows variant layer');
   assert.ok(data.right,'Original right switch cannot disappear');
   assert.ok(data.left,'Clone left switch must be mounted');
   assert.deepEqual(errors.filter(x=>/aircon|SyntaxError/.test(x)),[],'No aircon script exceptions');
   if(family==='B737-400'){
    assert.equal(data.labels.length,4,'two compact titles and OFF/AUTO on left');
    for(const l of data.labels){
     assert.ok(l.painted<=l.available-3,'Label overflows its lens: '+JSON.stringify(l));
     assert.equal(l.visible,'visible');
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
   }
   await page.locator('.atlas-piece[data-key="OH21"]').screenshot({
    path:'artifacts/aircon400-oh21/'+(family==='B737-400'?'400':'300-500')+'.png',
    animations:'disabled',timeout:45000
   });
   console.log('LIVE_BROWSER_OH21_PASS',family,JSON.stringify({labels:data.labels,errors:errors.slice(0,3)}));
   await page.close();
  }
 }finally{await browser.close();}
})().catch(e=>{console.error('LIVE_BROWSER_OH21_FAIL',e.stack||String(e));process.exitCode=1;});
