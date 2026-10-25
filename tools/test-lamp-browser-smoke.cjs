'use strict';
const assert=require('node:assert/strict');
const {chromium}=require('playwright');
const fs=require('node:fs');
const path=require('node:path');
const approved=fs.readFileSync(path.resolve(__dirname,'../panel-mosaic-lab/all-overhead/stage.js'),'utf8');
const adapter=fs.readFileSync(path.resolve(__dirname,'../panel-mosaic-lab/interactive-overhead/stage.js'),'utf8');
assert.equal(adapter.slice(adapter.indexOf("'use strict';")),approved.replace("fetch('./spec.json?ts='","fetch('../all-overhead/spec.json?ts='").replace("fetch('./atlas-layout.json?ts='","fetch('../all-overhead/atlas-layout.json?ts='"),'Interactive stage must be byte-identical to approved atlas engine except local config fetches');
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
   assert.ok(src&&src.includes('/assets/lights/instance-fit-v1/'),kind+' expected fitted lens '+id+' '+src);
   const good=await page.evaluate(async url=>{
    const image=new Image();image.src=url;
    try{await image.decode();return {loaded:true,w:image.naturalWidth,h:image.naturalHeight}}
    catch(e){return {loaded:false,error:String(e)}}
   },src);
   assert.equal(good.loaded,true,kind+' cannot decode SVG '+id+': '+JSON.stringify(good));
   assert.ok(good.w>0&&good.h>0);
   diagnostics.push({kind,id,image:src.substring(src.lastIndexOf('/')+1),size:[good.w,good.h]});
  }
  const bad=errors.filter(msg=>/lights|instance.face|cannot|SyntaxError/.test(msg));
  assert.deepEqual(bad,[],kind+' browser JavaScript errors');
  console.log('BROWSER_PANEL_PASS',kind,JSON.stringify({mounted,example:diagnostics.filter(x=>x.kind===kind),errors:errors.slice(0,5)}));
  await page.close();
 }
 try{
  await inspect(base+'/interactive-overhead/?debugLights=1','overhead',112,
    ['ram-door-r','ram-door-l','stby-pressure','pack-trip-l','window-r-fwd-on']);
  await inspect(base+'/cockpit/?debugLights=1','main',30,
    ['main-pull-up-captain','main-pull-up-fo']);
  console.log('BROWSER_SMOKE_SUCCESS',JSON.stringify({total:142,sampled:diagnostics.length,srcDecodePass:true}));
 }finally{await browser.close()}
})().catch(error=>{console.error('BROWSER_SMOKE_FAILED',error.stack||String(error));process.exitCode=1});
