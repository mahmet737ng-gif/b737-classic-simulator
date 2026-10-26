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
  for(const id of ids){
   const att=kind==='overhead'?'data-light':'data-cockpit-light';
   const target=page.locator(sel+'['+att+'="'+id+'"]');
   assert.equal(await target.count(),1,kind+' '+id);
   const img=target.locator('img').first();
   await img.waitFor({state:'attached',timeout:10000});
   const src=await img.getAttribute('src');
   assert.ok(src&&src.includes(kind==='main'?'/assets/lights/main-type-v1/':'/assets/lights/instance-fit-v1/'),kind+' expected per-lamp fitted typography '+id+' '+src);
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
  console.log('BROWSER_SMOKE_SUCCESS',JSON.stringify({total:142,sampled:diagnostics.length,srcDecodePass:true}));
 }finally{await browser.close()}
})().catch(error=>{console.error('BROWSER_SMOKE_FAILED',error.stack||String(error));process.exitCode=1});
