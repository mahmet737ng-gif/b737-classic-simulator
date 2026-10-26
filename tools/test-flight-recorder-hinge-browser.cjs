'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {chromium}=require('playwright');
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
 const out='/tmp/b737-flight-recorder-hinge';fs.mkdirSync(out,{recursive:true});
 const page=await browser.newPage({viewport:{width:1920,height:1100},deviceScaleFactor:1});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 try{
  await page.goto('http://127.0.0.1:8788/panel-mosaic-lab/interactive-overhead/?standalone=1&debugLights=1',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.B737RotaryGuards&&window.B737OverheadLights&&document.querySelector('.recorder-hinge-unit')&&document.querySelector('[data-light="flight-recorder-off"]'),null,{timeout:60000});
  const guard=page.locator('.recorder-hinge-unit'),lamp=page.locator('.mounted-light[data-light="flight-recorder-off"]'),cover=guard.locator('.recorder-hinge-cover'),lever=guard.locator('.recorder-hinge-lever');
  const datum=await page.evaluate(()=>{
   const g=document.querySelector('.recorder-hinge-unit'),l=document.querySelector('[data-light="flight-recorder-off"]');
   const a=g.getBoundingClientRect(),b=l.getBoundingClientRect();
   return {guardROI:g.dataset.sourceRect,sourceLamp:window.B737OverheadLights.getRegistry().lights.find(x=>x.id==='flight-recorder-off').sourceRect,
    sourceGuard:window.B737RotaryGuards.getRegistry().guards.find(x=>x.id==='flight-recorder-test').sourceRect,
    displayGap:+(b.left-a.right).toFixed(2),centerYDifference:+((a.top+a.height/2)-(b.top+b.height/2)).toFixed(2),
    a:{x:a.x,y:a.y,w:a.width,h:a.height},b:{x:b.x,y:b.y,w:b.width,h:b.height}};
  });
  assert.deepEqual(datum.sourceGuard,[1365,438,113,34]);assert.deepEqual(datum.sourceLamp,[1485,439,40,31]);
  assert.ok(datum.displayGap>3&&datum.displayGap<20,'Hinged guard is left of the OFF lamp with gap, not overlapping');
  assert.ok(Math.abs(datum.centerYDifference)<2,'Flight recorder guard must be vertically centred with OFF lamp');
  const sample=async(label)=>{
   const a=await guard.boundingBox(),b=await lamp.boundingBox();
   const x=Math.floor(Math.min(a.x,b.x)-24),y=Math.floor(Math.min(a.y,b.y)-55);
   const width=Math.ceil(Math.max(a.x+a.width,b.x+b.width)-x+24),height=Math.ceil(Math.max(a.y+a.height,b.y+b.height)-y+35);
   const bytes=await page.screenshot({path:path.join(out,label+'.png'),clip:{x:Math.max(0,x),y:Math.max(0,y),width,height},animations:'disabled'});
   if(label.endsWith('-ON'))console.log('FLIGHT_HINGE_CHROMIUM_PREVIEW',bytes.toString('base64'));
  };
  await page.evaluate(()=>window.B737OverheadLights.setScenario({onGround:true,engine1Running:false,engine2Running:false}));
  await page.waitForFunction(()=>window.B737OverheadLights.getState().lights['flight-recorder-off']===true);
  await sample('NORMAL-ground-OFF-ON');
  assert.equal(await lever.isDisabled(),true,'Lever cannot be moved with hinged cover closed');
  await cover.click();
  assert.equal(await lever.isDisabled(),false,'Opening left hinge unlocks TEST position');
  await lever.click();
  await page.waitForFunction(()=>window.B737OverheadLights.getState().lights['flight-recorder-off']===false);
  await sample('TEST-ground-OFF-OFF');
  await cover.click();
  const final=await page.evaluate(()=>window.B737RotaryGuards.getState().guards['flight-recorder-test']);
  assert.deepEqual(final,{value:'normal',guard:'closed'});
  await page.waitForFunction(()=>window.B737OverheadLights.getState().lights['flight-recorder-off']===true);
  assert.ok(!errors.some(x=>/recorder|guard|lamp|lights/.test(x)),JSON.stringify(errors));
  fs.writeFileSync(path.join(out,'evidence.json'),JSON.stringify({schema:'b737.flight-recorder.left-hinge.v1',sourcePlacement:datum,
   switchStates:'NORMAL(closed) -> OPEN -> TEST(light out) -> CLOSE/NORMAL(light on)',originalSourcePixelsChanged:0,errors},null,2)+'\n');
  console.log('FLIGHT_HINGE_BROWSER_PASS',JSON.stringify({displayGap:datum.displayGap,dy:datum.centerYDifference,states:4,images:2,jsErrors:errors.length}));
 }finally{await browser.close()}
})().catch(e=>{console.error('FLIGHT_HINGE_BROWSER_FAILURE',e.stack||String(e));process.exitCode=1});
