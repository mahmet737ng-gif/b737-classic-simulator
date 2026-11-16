'use strict';
const assert=require('node:assert/strict');
const {spawn}=require('node:child_process');
const path=require('node:path');
const {chromium}=require('playwright');

(async()=>{
 const root=path.resolve(__dirname,'../web-dist');
 const port=18767,origin='http://127.0.0.1:'+port;
 const server=spawn('python3',['-m','http.server',String(port),'--bind','127.0.0.1'],{cwd:root,stdio:'ignore'});
 let browser;
 try{
  for(let i=0;i<15;i++){
   try{if((await fetch(origin)).ok)break;}catch(_){}
   if(i===14)throw Error('Local Unified assets are unavailable');
   await new Promise(resolve=>setTimeout(resolve,250));
  }
  browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||undefined});
  for(const seat of ['CAPT','FO']){
   const page=await browser.newPage({viewport:{width:1380,height:950}});
   await page.goto(origin+'/panel-mosaic-lab/cockpit/cdu-stage.html?seat='+seat,{waitUntil:'domcontentloaded'});
   await page.waitForFunction(()=>window.B737CduScreenFitV6?.getState()?.ready===true);
   // This local fixture exercises the native CDU, using the same entry
   // handlers as the public build and an energized display.
   await page.evaluate(()=>{
    delete window.CDU_STAGE6_API;
    delete document.documentElement.dataset.cduAwaitingPower;
   });
   const key=id=>page.locator('#clickmap button[title$="CDU_CAPT_'+id+'"]').click();
   const count=()=>page.locator('.fmc-header-count').textContent();
   const labels=()=>page.locator('#fmc-lines .fmc-small > span').allTextContents();
   await key('RTE');
   assert.equal(await count(),'1/2');
   assert.ok((await labels()).includes('ORIGIN'));
   assert.ok((await labels()).includes('FLT NO.'));
   assert.ok(!(await labels()).includes('VIA'));
   const squares=await page.locator('.cdu-square-glyphs').evaluateAll(values=>values.map(glyph=>({
    characters:glyph.textContent.length,
    scale:new DOMMatrix(getComputedStyle(glyph).transform).a,
    overflow:getComputedStyle(glyph.parentElement).overflow,
    inside:glyph.getBoundingClientRect().width<=glyph.parentElement.getBoundingClientRect().width
   })));
   assert.deepEqual(squares,Array.from({length:2},()=>({characters:4,scale:2,overflow:'visible',inside:true})));
   await key('NEXT_PAGE');
   assert.equal(await count(),'2/2');
   assert.ok((await labels()).includes('VIA'));
   assert.ok((await labels()).includes('TO'));
   assert.ok(!(await labels()).includes('ORIGIN'));
   await page.keyboard.type('FIX01');
   await key('LSK_R1');
   assert.ok((await page.locator('#fmc-lines').textContent()).includes('FIX01'));
   await key('PREV_PAGE');
   assert.equal(await count(),'1/2');
   assert.ok(!(await page.locator('#fmc-lines').textContent()).includes('FIX01'));
   await key('NEXT_PAGE');
   assert.ok((await page.locator('#fmc-lines').textContent()).includes('FIX01'));
   await page.close();
  }
 }finally{server.kill();await browser?.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
