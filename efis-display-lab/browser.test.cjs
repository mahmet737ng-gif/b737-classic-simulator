'use strict';
const assert=require('node:assert/strict');
const {chromium}=require('playwright');
const {spawn}=require('node:child_process');
const path=require('node:path'),fs=require('node:fs');
(async()=>{
 const root=path.resolve(__dirname,'..'),out=path.join(root,'artifacts/efis-lab');
 fs.mkdirSync(out,{recursive:true});
 const server=spawn('python3',['-m','http.server','18765','--bind','127.0.0.1'],{cwd:root,stdio:'ignore'});
 let browser;
 try{
  browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||undefined,args:['--no-sandbox']});
  const page=await browser.newPage({viewport:{width:1480,height:950}});
  let ok=false;const errors=[];page.on('pageerror',e=>errors.push(e.message));
  for(let i=0;i<15&&!ok;i++){try{await page.goto('http://127.0.0.1:18765/efis-display-lab/',{timeout:2500});ok=true}catch{await new Promise(r=>setTimeout(r,400))}}
  assert.ok(ok,'Local lab must load');
  await page.waitForFunction(()=>!!window.B737EFISDisplayLab);
  assert.equal(await page.locator('#auditRows tr').count(),25);
  assert.ok(await page.locator('#ehsi').evaluate(e=>e.querySelectorAll('*').length>20),'EHSI SVG must contain real rendered geometry');
  assert.equal((await page.evaluate(()=>window.B737EFISDisplayLab.runTests())).pass,true);
  await page.locator('[data-scenario="approach"]').click();
  assert.equal((await page.evaluate(()=>window.B737EFISDisplayLab.getState())).eadi.radioAlt,120);
  await page.locator('select[data-path="ehsi.mode"]').selectOption('PLAN');
  assert.ok((await page.locator('#ehsi').textContent()).includes('TRUE NORTH'));
  await page.locator('input[data-path="power.eadi"]').uncheck();
  assert.equal(await page.locator('#eadiStatus').textContent(),'NO POWER');
  await page.locator('[data-scenario="normal"]').click();
  await page.screenshot({path:path.join(out,'desktop.png')});
  await page.setViewportSize({width:390,height:844});
  await page.screenshot({path:path.join(out,'mobile.png')});
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth+2));
  assert.deepEqual(errors,[]);
  console.log('EFIS LAB BROWSER PASS');
 }finally{if(browser)await browser.close();server.kill('SIGTERM')}
})().catch(e=>{console.error(e);process.exitCode=1});
