'use strict';
// EXTL-INBOARD-L-CENTER-0003 — DOM-to-SOURCE-PIXEL audit in Chromium.
// A geometry-only JSON test previously passed while users could still see
// the old INBOARD LEFT switch floating over "ON". Verify the real mounted
// switch centre against the exact pixel of the photographic vacant bezel.
const assert=require('node:assert/strict');
const {chromium}=require('playwright');
(async()=>{
 const browser=await chromium.launch({
  headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
 const page=await browser.newPage({viewport:{width:1280,height:880},deviceScaleFactor:1});
 const errors=[];
 page.on('pageerror',e=>errors.push(String(e.message).slice(0,220)));
 try{
  const response=await page.goto(
   'http://127.0.0.1:8788/panel-mosaic-lab/interactive-overhead/?standalone=1&v=EXTL-INBOARD-L-CENTER-0003',
   {waitUntil:'domcontentloaded',timeout:60000});
  assert.equal(response.status(),200);
  try{
   await page.waitForFunction(()=>{
    const el=document.querySelector('#toggle-landing-in-l');
    const photo=document.querySelector('.atlas-piece[data-key="OH23-25"] img.atlas-photo');
    return Boolean(el&&photo?.complete&&photo.naturalWidth&&
      window.B737OverheadToggles?.getState);
   },null,{timeout:45000});
  }catch(e){
   const debug=await page.evaluate(()=>({
    href:location.href,ready:document.readyState,title:document.title,
    toggle:document.getElementById('toggle-landing-in-l')?.outerHTML.slice(0,350),
    panel:document.querySelector('.atlas-piece[data-key="OH23-25"]')?.outerHTML.slice(0,450),
    images:document.querySelectorAll('img').length,
    toggleCount:document.getElementById('toggleCount')?.textContent,
    scripts:[...document.scripts].map(x=>x.src.split('/').slice(-2).join('/')).slice(-12)
   }));
   console.log('INBOARD_LEFT_BROWSER_STARTUP_DIAGNOSTICS',JSON.stringify({debug,errors}));
   throw e;
  }
  const target=page.locator('#toggle-landing-in-l');
  await target.scrollIntoViewIfNeeded();
  const audit=await page.evaluate(()=>{
   const ids=['landing-out-l','landing-out-r','landing-in-l','landing-in-r'];
   const nodes=ids.map(id=>document.getElementById('toggle-'+id));
   const photo=document.querySelector('.atlas-piece[data-key="OH23-25"] img.atlas-photo');
   const photoRect=photo.getBoundingClientRect();
   const relative=(x,y)=>({
    x:photoRect.left+x/photo.naturalWidth*photoRect.width,
    y:photoRect.top+y/photo.naturalHeight*photoRect.height});
   const controls=Object.fromEntries(ids.map((id,i)=>{
    const rect=nodes[i].getBoundingClientRect();
    return[id,{center:{x:rect.left+rect.width/2,y:rect.top+rect.height/2},
      dataset:nodes[i].dataset.photoSocketCenter||null,
      physicalPx:{left:nodes[i].style.left,top:nodes[i].style.top},
      state:nodes[i].dataset.state}];
   }));
   const sourcePositions={
    'landing-out-l':[235,318],'landing-out-r':[318,318],
    'landing-in-l':[398,318],'landing-in-r':[520,318]};
   const expected=Object.fromEntries(Object.entries(sourcePositions).map(
    ([id,[x,y]])=>[id,relative(x,y)]));
   let photoPixels=null;
   try{
    const canvas=document.createElement('canvas');
    canvas.width=photo.naturalWidth;canvas.height=photo.naturalHeight;
    const ctx=canvas.getContext('2d',{willReadFrequently:true});
    ctx.drawImage(photo,0,0,canvas.width,canvas.height);
    const sample=(x,y)=>Array.from(ctx.getImageData(x,y,1,1).data).slice(0,3);
    photoPixels={
     emptyLeft:sample(398,318),
     formerOn:sample(459,318),
     inboardRight:sample(520,318)
    };
   }catch(e){photoPixels={error:String(e)};}
   return{controls,expected,sourcePositions,
    photoSize:[photo.naturalWidth,photo.naturalHeight],
    photoPixels,registration:document.getElementById('toggle-landing-in-l').dataset.registration};
  });
  assert.equal(audit.registration,'EXTL-INBOARD-L-CENTER-0003');
  assert.equal(audit.controls['landing-in-l'].dataset,'398,318');
  for(const [id,item]of Object.entries(audit.controls)){
   for(const d of ['x','y']){
    const error=Math.abs(item.center[d]-audit.expected[id][d]);
    assert.ok(error<=1.25,id+' photographic '+d+' misalignment '+error.toFixed(2)+'px');
   }
  }
  const inL=audit.controls['landing-in-l'].center;
  const onLabel=audit.expected['landing-in-l'];
  const oldWrongPoint={
   x:onLabel.x+(459-398)*(audit.expected['landing-in-r'].x-onLabel.x)/(520-398),
   y:onLabel.y
  };
  // The overhead atlas is fit-to-viewport. Apply the distance threshold
  // in SOURCE pixels, not fixed browser pixels (which change with zoom).
  const viewPixelsPerSource=(audit.expected['landing-in-r'].x-inL.x)/(520-398);
  const formerSourceDelta=Math.abs(inL.x-oldWrongPoint.x)/viewPixelsPerSource;
  assert.ok(formerSourceDelta>50,
    'Former ON-label mount must remain >50 source px away from true L hole: '+formerSourceDelta);
  const sources=await page.evaluate(()=>window.B737OverheadToggles.getRegistry().controls
   .filter(x=>x.id.startsWith('landing-'))
   .map(x=>({id:x.id,sourcePoint:x.sourcePoint})));
  assert.deepEqual(sources.map(x=>x.sourcePoint),
   [[235,318],[318,318],[398,318],[520,318]],
   'Only INBOARD L is registered at the empty centre; all three other controls stay unchanged');
  const before=await page.evaluate(()=>window.B737OverheadToggles.getState());
  await target.click({force:true});
  await page.waitForFunction(()=>window.B737OverheadToggles.getState()['landing-in-l']==='ON');
  await page.locator('.atlas-piece[data-key="OH23-25"]').screenshot({
   path:'/tmp/inboard-left-centered-on-real-photo.png',timeout:20000});
  await target.click({force:true});
  const after=await page.evaluate(()=>window.B737OverheadToggles.getState());
  assert.equal(after['landing-in-l'],'OFF','OFF/ON/ OFF remains interactive');
  for(const id of ['landing-out-l','landing-out-r','landing-in-r']){
   assert.equal(after[id],before[id],'Do not alter '+id);
  }
  console.log('INBOARD_LEFT_SOURCE_PHOTO_PIXEL_AUDIT_PASS',JSON.stringify(audit));
  console.log('INBOARD_LEFT_LANDING_SWITCH_OFF_ON_PASS');
  if(errors.length)console.log('OTHER_PAGE_ERRORS',JSON.stringify(errors.slice(0,6)));
 }finally{await page.close();await browser.close();}
})().catch(error=>{
 console.error('INBOARD_LEFT_SOURCE_PHOTO_PIXEL_AUDIT_FAIL',error.stack||String(error));
 process.exitCode=1;
});
