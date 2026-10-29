'use strict';
const {chromium}=require('playwright');
const base=process.env.LIVE_SITE || 'https://mahmet737ng-gif.github.io/b737-classic-simulator/';
(async()=>{
 const browser=await chromium.launch(process.env.CHROME_PATH?{headless:true,executablePath:process.env.CHROME_PATH}:{headless:true});
 try {
  for(const target of ['panel-mosaic-lab/cockpit/?v=LE-PHOTOLENS-0002','panel-mosaic-lab/le-devices/?v=LE-PHOTOLENS-0002']){
   const page=await browser.newPage({viewport:{width:1440,height:900},deviceScaleFactor:1});
   const errors=[],failed=[],http=[];
   page.on('pageerror',e=>errors.push(e.stack||String(e)));
   page.on('requestfailed',r=>failed.push({url:r.url(),error:r.failure()?.errorText}));
   page.on('response',r=>{if(r.status()>=400)http.push({status:r.status(),url:r.url()});});
   let response=null,loaded=false;
   try{
    response=await page.goto(base+target,{waitUntil:'domcontentloaded',timeout:75000});
    await page.waitForTimeout(9000);
    const result=await page.evaluate(()=>{
     const f=document.querySelector('#overheadFrame');
     const child=(()=>{try{return f?.contentDocument;}catch{return null}})();
     return {title:document.title,ready:document.readyState,htmlLength:document.documentElement.outerHTML.length,
       bodyText:document.body?.innerText?.slice(0,180),frame:!!f,frameSrc:f?.src,frameReady:child?.readyState,
       frameLenses:child?.querySelectorAll('.b737-le-photolens-v2 [data-lens-id]').length,
       standaloneLenses:document.querySelectorAll('.b737-le-photolens-v2 [data-lens-id]').length,
       panelCount:document.querySelectorAll('[data-b737-le-devices]').length};
    });
    loaded=true;
    console.log('LIVE_PROBE',JSON.stringify({target,status:response?.status(),result,errors:errors.slice(0,20),failed:failed.slice(0,30),http:http.slice(0,30)}));
    const name=target.includes('cockpit')?'cockpit':'le-devices';
    await page.screenshot({path:'/tmp/live-'+name+'.png',timeout:15000});
   }catch(e){
    console.error('LIVE_PROBE_FAIL',JSON.stringify({target,status:response?.status(),error:String(e),errors:errors.slice(0,20),failed:failed.slice(0,25),http:http.slice(0,25)}));
    process.exitCode=1;
   }finally{await page.close();}
   if(!loaded)continue;
  }
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});