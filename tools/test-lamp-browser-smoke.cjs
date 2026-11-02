'use strict';
const assert=require('node:assert/strict');
const {chromium}=require('playwright');
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
 const diagnostics=[];
 const base='http://127.0.0.1:8788/panel-mosaic-lab';
 async function inspect(url,kind,expected,ids){
  const page=await browser.newPage({viewport:{width:1660,height:1000},deviceScaleFactor:1});
  const errors=[];
  page.on('pageerror',error=>errors.push(String(error).slice(0,500)));
  const response=await page.goto(url,{waitUntil:'domcontentloaded',timeout:60000});
  assert.equal(response.status(),200,kind+' page route');
  const sel=kind==='overhead'?'.mounted-light[data-light]':'.cockpit-light[data-cockpit-light]';
  try{
   await page.waitForFunction(arg=>document.querySelectorAll(arg.selector).length===arg.n,
     {selector:sel,n:expected},{timeout:25000});
  }catch(error){
   const inspect=await page.evaluate(selector=>({
    count:document.querySelectorAll(selector).length,
    overheadPieces:document.querySelectorAll('.atlas-piece').length,
    mainRegion:!!document.getElementById('region-main'),
    mounted:document.querySelectorAll('.mounted-light').length,
    cockpit:document.querySelectorAll('.cockpit-light').length,
    alerts:[...document.querySelectorAll('[role=alert]')].map(x=>x.textContent).slice(0,8),
    status:document.getElementById('lightsStatus')?.textContent,
    lightScripts:[...document.scripts].map(x=>x.src).filter(x=>/light|stage/.test(x)).slice(-12)
   }),sel);
   console.error('BROWSER_DOM_DIAGNOSTIC',kind,JSON.stringify({inspect,errors}));
   throw error;
  }
  const mounted=await page.locator(sel).count();
  assert.equal(mounted,expected,kind+' all mounted lights');

  if(kind==='overhead'){
   // Real DOM regression of the photographed OH14 three-detent selector.
   // Do not depend on source artwork being cropped or moved.
   const lever=page.locator('#oh14EmergencyExitPhysical');
   await lever.scrollIntoViewIfNeeded();
   const actualBounds=await lever.boundingBox();
   assert.ok(actualBounds?.width>10&&actualBounds?.height>40,'OH14 physical switch hitbox must be actually visible');
   await page.evaluate(()=>window.B737OverheadLights.setAircraftElectricalPower(false));
   const sample=()=>page.evaluate(()=>{
    const lamp=document.querySelector('.mounted-light[data-light="emergency-not-armed"]');
    const litImage=lamp?.querySelector('img.light-face[data-frame="ON"]');
    const darkImage=lamp?.querySelector('img.light-face[data-frame="OFF"]');
    const snap=window.B737OverheadLights.getState();
    return {position:snap.context.emergencyExitLightsPosition,
     illuminated:snap.lights['emergency-not-armed'],lampFrame:lamp?.dataset.frame,
     photoPower:snap.power,vis:litImage?getComputedStyle(litImage).opacity:null,
     offImageOpacity:darkImage?getComputedStyle(darkImage).opacity:null};
   });
   const initial=await sample();
   const clickDetent=async fraction=>{
     await lever.click({position:{x:actualBounds.width*.5,y:actualBounds.height*fraction}});
     return sample();
   };
   const off=await clickDetent(.18);
   const armed=await clickDetent(.50);
   const on=await clickDetent(.88);
   const oh14=await page.evaluate(()=>{
    const lamp=document.querySelector('.mounted-light[data-light="emergency-not-armed"]');
    const litImage=lamp.querySelector('img.light-face[data-frame="ON"]');
    const darkImage=lamp.querySelector('img.light-face[data-frame="OFF"]');
    const extraFit=lamp.querySelector('.lamp-socket-fit-face');
    const target=document.getElementById('oh14EmergencyExitPhysical');
    return {visual:{
      blend:getComputedStyle(litImage).mixBlendMode,fill:getComputedStyle(litImage).objectFit,
      background:getComputedStyle(lamp).backgroundColor,
      pointerEvents:getComputedStyle(target).pointerEvents,
      litSrc:litImage.getAttribute('src'),darkSrc:darkImage.getAttribute('src'),
      fittedLayerCount:lamp.querySelectorAll('.lamp-socket-fit-face').length,
      fittedLayerVisibility:extraFit?getComputedStyle(extraFit).display:'ABSENT',
      photoGlassOwner:lamp.dataset.lensOwner},
      instances:document.querySelectorAll('.mounted-light[data-light="emergency-not-armed"]').length};
   });
   oh14.initial=initial;oh14.off=off;oh14.armed=armed;oh14.on=on;
   oh14.hit={width:actualBounds.width,height:actualBounds.height};
   assert.equal(oh14.missingTarget,undefined,'OH14 photographed physical lever hotspot missing');
   assert.equal(oh14.missingLamp,undefined,'OH14 NOT ARMED lamp missing');
   assert.equal(oh14.instances,1,'OH14 must have exactly one active mounted lamp');
   assert.deepEqual(oh14.initial.position,'ON','Initial photographed lever is in ON detent');
   assert.deepEqual([oh14.off.position,oh14.armed.position,oh14.on.position],['OFF','ARMED','ON']);
   assert.deepEqual([oh14.off.illuminated,oh14.armed.illuminated,oh14.on.illuminated],[true,false,false]);
   assert.equal(oh14.visual.blend,'screen','OH14 must blend amber emission into one original bezel');
   assert.equal(oh14.visual.pointerEvents,'auto','OH14 click target MUST be hit-testable');
   assert.equal(oh14.off.photoPower,false,'Test must exercise AC-unavailable case');
   assert.equal(oh14.off.lampFrame,'ON','OFF detent should activate electrical NOT ARMED frame even with AC off');
   assert.equal(oh14.on.lampFrame,'OFF','ON detent extinguishes NOT ARMED');
   assert.equal(oh14.on.offImageOpacity,'0','Original photo should not receive ghost unlit lettering');
   assert.ok(oh14.visual.litSrc?.includes('oh14-not-armed-emission-on.svg'),'Luminous face must contain no painted bezel');
   assert.ok(oh14.visual.darkSrc?.includes('oh14-not-armed-emission-off.svg'),'Unlit face must contain no painted bezel');
   assert.equal(oh14.visual.fittedLayerCount,0,'OH14 must not mount a second fitted glass at all');
   assert.equal(oh14.visual.photoGlassOwner,'PHOTO_GLASS_EMISSION_ONLY');
   assert.equal(oh14.visual.fill,'fill','Emission source must fit original photo socket');
   assert.equal(oh14.visual.background,'rgba(0, 0, 0, 0)','Photo bezel must remain visible');
   assert.ok(oh14.hit.width>10&&oh14.hit.height>40,'physical switch target is outside panel');
   console.log('OH14_PHYSICAL_SELECTOR_BROWSER_PASS',JSON.stringify(oh14));
  }
  for(const id of ids){
   const att=kind==='overhead'?'data-light':'data-cockpit-light';
   const target=page.locator(sel+'['+att+'="'+id+'"]');
   assert.equal(await target.count(),1,kind+' '+id);
   const img=target.locator('img').first();
   await img.waitFor({state:'attached',timeout:10000});
   const src=await img.getAttribute('src');
   assert.ok(src&&src.includes('/lights-reference-v2/svg/'),kind+' expected installed reference-style v2 lamp '+id+' '+src);
   const installed=await page.evaluate(()=>window.B737LampAppearance?.status());
   assert.equal(installed?.mode,'BRIGHT',kind+' default global brightness');
   assert.equal(installed?.ready,true,kind+' shared lamp library failed to load');
   assert.equal(installed?.masters,87,kind+' missing shared lamp design');
   const good=await page.evaluate(async url=>{
    const image=new Image();image.src=url;
    try{await image.decode();return {loaded:true,w:image.naturalWidth,h:image.naturalHeight}}
    catch(e){return {loaded:false,error:String(e)}}
   },src);
   assert.equal(good.loaded,true,kind+' cannot decode SVG '+id+': '+JSON.stringify(good));
   assert.ok(good.w>0&&good.h>0);
   diagnostics.push({kind,id,image:src.substring(src.lastIndexOf('/')+1),size:[good.w,good.h]});
  }
  const fullManifestURL=new URL(kind==='main'?'typography-faces.json':'instance-faces.json',page.url()).href;
  const allFaces=await page.evaluate(async manifestURL=>{
    const response=await fetch(manifestURL,{cache:'no-store'});
    if(!response.ok)return {error:'manifest status '+response.status};
    const data=await response.json();
    const records=Object.entries(data.instances).flatMap(([id,inst])=>
      Object.entries(inst.states).map(([state,frame])=>({
       id,state,sourceRect:inst.sourceRect,url:new URL(frame.url,manifestURL).href
      })));
    const results=await Promise.all(records.map(async face=>{
      const im=new Image();im.src=face.url;
      try{await im.decode();return {...face,loaded:im.naturalWidth===face.sourceRect[2]&&im.naturalHeight===face.sourceRect[3],width:im.naturalWidth,height:im.naturalHeight}}
      catch(e){return {...face,loaded:false,error:String(e)}}
    }));
    return {total:results.length,failed:results.filter(x=>!x.loaded)};
  },fullManifestURL);
  assert.ok(!allFaces.error,kind+' '+allFaces.error);
  assert.equal(allFaces.total,kind==='overhead'?70:60,'all source SVG states counted');
  assert.deepEqual(allFaces.failed,[],kind+' cannot display one or more physical face states');
  console.log('BROWSER_ALL_INSTANCE_STATES_PASS',kind,JSON.stringify({states:allFaces.total,bad:allFaces.failed.length}));
  const bad=errors.filter(msg=>/lights|instance.face|cannot|SyntaxError/.test(msg));
  assert.deepEqual(bad,[],kind+' browser JavaScript errors');
  console.log('BROWSER_PANEL_PASS',kind,JSON.stringify({mounted,example:diagnostics.filter(x=>x.kind===kind),errors:errors.slice(0,5)}));
  await page.close();
 }
 try{
  await inspect(base+'/interactive-overhead/?standalone=1&debugLights=1','overhead',112,
    ['ram-door-r','ram-door-l','stby-pressure','pack-trip-l','window-r-fwd-on']);
  await inspect(base+'/cockpit/?debugLights=1','main',30,
    ['main-pull-up-captain','main-pull-up-fo']);
  // Critical Unified regression: the overhead iframe is not the standalone overhead route.
  // The shared V2 asset resolver must load there before lights.js (112 actual installed lamps).
  const unified=await browser.newPage({viewport:{width:1660,height:1000},deviceScaleFactor:1});
  const errors=[];
  unified.on('pageerror',e=>errors.push(String(e)));
  try{
   const response=await unified.goto(base+'/cockpit/?debugLights=1',{waitUntil:'domcontentloaded',timeout:60000});
   assert.equal(response.status(),200,'Unified root route');
   const oh=unified.frameLocator('#overheadFrame');
   await oh.locator('.mounted-light[data-light]').first().waitFor({state:'attached',timeout:40000});
   assert.equal(await oh.locator('.mounted-light[data-light]').count(),112,'Unified embedded Overhead must mount all 112 light sockets');
   const installed=await oh.locator('body').evaluate(()=>window.B737LampAppearance?.status()||null);
   assert.equal(installed?.ready,true,'Unified iframe must import shared V2 appearance registry');
   assert.equal(installed?.mode,'BRIGHT','Unified embedded Overhead must default BRIGHT');
   assert.equal(installed?.masters,87,'Unified embedded Overhead must reuse 87 masters');
   const sample=await oh.locator('.mounted-light[data-light="stby-pressure"] img[data-frame="ON"]').evaluate(img=>img.getAttribute('src')||img.dataset.perfSource||null);
   assert.ok(sample?.includes('/lights-reference-v2/svg/LOW_PRESSURE__AMBER__BRIGHT.svg'),'Embedded Overhead does not register installed BRIGHT asset: '+sample);
   // Unified now has a fixed header lamp-test button; no overhead-focus tab exists.
   const button=unified.locator('#visualLampTest');
   await button.click();
   await unified.waitForFunction(()=>document.querySelector('#visualLampTest')?.getAttribute('aria-pressed')==='true');
   await oh.locator('.mounted-light[data-light="stby-pressure"] img[data-visual-on="true"]').waitFor({state:'attached',timeout:8000});
   const lit=await oh.locator('body').evaluate(()=>{
    const lamps=[...document.querySelectorAll('.mounted-light[data-light]')];
    return {
     total:lamps.length,
     testEnabled:document.documentElement.classList.contains('cockpit-visual-test'),
     active:lamps.filter(node=>node.querySelector('img[data-visual-on="true"]')).length,
     broken:lamps.filter(node=>[...node.querySelectorAll('img')].some(img=>img.dataset.visualOn==='true'&&img.hasAttribute('src')&&img.complete&&img.naturalWidth===0)).map(node=>node.dataset.light).slice(0,15)
    };
   });
   assert.equal(lit.total,112,'Unified Overhead lamp geometry disturbed');
   assert.equal(lit.testEnabled,true,'Unified cockpit did not forward visual lamp test into Overhead');
   assert.equal(lit.active,112,'All 112 Overhead annunciators must illuminate during unified visual test');
   assert.deepEqual(lit.broken,[],'Some active Unified V2 SVGs are broken');
   const serious=errors.filter(x=>/LampAppearance|Cannot read properties of undefined|LGT-GLOBAL/i.test(x));
   assert.deepEqual(serious,[],'Unified overhead has a lamp runtime exception');
   await button.click();
   console.log('UNIFIED_EMBEDDED_OVERHEAD_PASS',JSON.stringify({total:lit.total,active:lit.active,defaultMode:installed.mode,masters:installed.masters}));
  }finally{await unified.close();}
  console.log('BROWSER_SMOKE_SUCCESS',JSON.stringify({total:142,sampled:diagnostics.length,srcDecodePass:true}));
 }finally{await browser.close()}
})().catch(error=>{console.error('BROWSER_SMOKE_FAILED',error.stack||String(error));process.exitCode=1});
