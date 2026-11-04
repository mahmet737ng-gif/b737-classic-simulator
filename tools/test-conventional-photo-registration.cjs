'use strict';
// CONV-LAMP-PIXEL-0003: REAL Chromium photo/DOM QA, not internal arithmetic QA.
// Rejects a lamp placed over panel paint rather than its black source-photo glass.
const assert=require('node:assert/strict');
const {chromium}=require('playwright');
const path=require('node:path');
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
 const page=await browser.newPage({viewport:{width:1920,height:1080},deviceScaleFactor:1});
 const errors=[];page.on('pageerror',e=>errors.push(String(e).slice(0,500)));
 try{
  const response=await page.goto('http://127.0.0.1:8788/panel-mosaic-lab/cockpit/?v=CONV-LAMP-PIXEL-0003',
    {waitUntil:'domcontentloaded',timeout:60000});
  assert.equal(response?.status(),200,'Unified Cockpit route');
  await page.waitForFunction(()=>document.querySelectorAll('.cockpit-light[data-cockpit-light]').length===30&&
    Boolean(window.B737EngineIndicationModeV1?.setMode),null,{timeout:40000});
  await page.evaluate(()=>window.B737EngineIndicationModeV1.setMode('CONVENTIONAL'));
  await page.waitForFunction(()=>document.documentElement.dataset.engineIndication==='CONVENTIONAL'&&
    document.querySelector('.conventional-engine-panel-v1')?.naturalWidth===1463,
    null,{timeout:40000});
  await page.waitForFunction(()=>{
    const id='main-gear-nose-red';
    const n=document.querySelector('.cockpit-light[data-cockpit-light="'+id+'"]');
    return Boolean(n&&n.querySelector('.lamp-socket-fit-face')&&
      n.dataset.socketFitApplied==='true');
  },null,{timeout:25000});
  const report=await page.evaluate(()=>{
    const ids=['main-gear-nose-red','main-gear-nose-green',
      'main-gear-left-red','main-gear-left-green',
      'main-gear-right-red','main-gear-right-green'];
    const source={
      'main-gear-nose-red':[1324,156,88,40],
      'main-gear-nose-green':[1324,196,88,39],
      'main-gear-left-red':[1281,242,78,40],
      'main-gear-left-green':[1281,282,78,40],
      'main-gear-right-red':[1367,242,86,40],
      'main-gear-right-green':[1367,282,86,40]
    };
    const photo=document.querySelector('.conventional-engine-panel-v1');
    const r=photo.getBoundingClientRect();
    const canvas=document.createElement('canvas');canvas.width=1463;canvas.height=1075;
    const ctx=canvas.getContext('2d',{willReadFrequently:true});
    try{ctx.drawImage(photo,0,0,1463,1075);}catch(_){}
    const items=ids.map(id=>{
      const rect=source[id],node=document.querySelector('.cockpit-light[data-cockpit-light="'+id+'"]');
      const actual=node?.getBoundingClientRect();
      const wanted={x:r.left+rect[0]/1463*r.width,
        y:r.top+rect[1]/1075*r.height,
        w:rect[2]/1463*r.width,h:rect[3]/1075*r.height};
      const cs=node?getComputedStyle(node):null;
      const cx=Math.floor(rect[0]+rect[2]/2),cy=Math.floor(rect[1]+rect[3]/2);
      let sample=null;
      try{const color=ctx.getImageData(cx,cy,1,1).data;sample=[color[0],color[1],color[2]];}catch(e){sample=null;}
      return{id,rect,actual:actual&&{x:actual.left,y:actual.top,w:actual.width,h:actual.height},
        wanted,overflow:cs?.overflow,opacity:cs?.opacity,face:node?.querySelector('.lamp-socket-fit-face')?.complete,
        sample};
    });
    return {mode:document.documentElement.dataset.engineIndication,
      photoLoaded:photo.complete,photoWidth:r.width,photoHeight:r.height,items};
  });
  assert.equal(report.mode,'CONVENTIONAL');
  assert.equal(report.items.length,6);
  for(const item of report.items){
    assert.ok(item.actual,'Missing physical target '+item.id);
    for(const key of ['x','y','w','h']){
      assert.ok(Math.abs(item.actual[key]-item.wanted[key])<2.5,
        item.id+' '+key+' is not registered to real photographic glass: '+item.actual[key]+' vs '+item.wanted[key]);
    }
    assert.equal(item.overflow,'hidden',item.id+' light emission must stay in photo glass');
    assert.equal(item.face,true,item.id+' emission SVG must be decodable');
    if(item.sample)assert.ok(item.sample.reduce((a,b)=>a+b,0)/3<110,
      item.id+' original photo has no dark glass at calibrated centre: '+item.sample);
  }
  console.log('CONVENTIONAL_GEAR_SIX_REAL_BROWSER_PASS',JSON.stringify(report));
  await page.screenshot({path:'/tmp/b737-conventional-gear-pixel-qa.png',timeout:20000});
  await page.evaluate(()=>window.B737EngineIndicationModeV1.setMode('EIS'));
  await page.waitForFunction(()=>document.documentElement.dataset.engineIndication==='EIS',null,{timeout:25000});
  const restored=await page.evaluate(()=>{
    const node=document.querySelector('[data-cockpit-light="main-gear-nose-red"]');
    return{left:parseFloat(getComputedStyle(node).left),inlineLeft:parseFloat(node.style.left),
      overflow:getComputedStyle(node).overflow,
      mode:document.documentElement.dataset.engineIndication};
  });
  assert.equal(restored.mode,'EIS');
  assert.ok(Math.abs(restored.left-restored.inlineLeft)<1,'EIS must return to original calibration');
  assert.equal(restored.overflow,'visible','EIS overflow policy restored');
  console.log('CONVENTIONAL_TO_EIS_ROUND_TRIP_PASS',JSON.stringify(restored));
  if(errors.length)console.log('BROWSER_PAGE_ERRORS',errors.slice(0,8));
 }finally{await page.close();await browser.close();}
})().catch(e=>{console.error('CONVENTIONAL_GEAR_BROWSER_FAIL',e.stack||String(e));process.exitCode=1;});
