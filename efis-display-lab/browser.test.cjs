'use strict';
const assert=require('node:assert/strict');
const {chromium}=require('playwright');
const {spawn}=require('node:child_process');
const path=require('node:path'),fs=require('node:fs'),crypto=require('node:crypto');
(async()=>{
 const root=path.resolve(__dirname,'..'),out=path.join(root,'artifacts/efis-lab');
 fs.mkdirSync(out,{recursive:true});
 const server=spawn('python3',['-m','http.server','18765','--bind','127.0.0.1'],{cwd:root,stdio:'ignore'});
 let browser;
 try{
  browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||undefined,args:['--no-sandbox']});
  const page=await browser.newPage({viewport:{width:1520,height:990}});
  let ok=false;const errors=[];page.on('pageerror',e=>errors.push(e.message));
  for(let i=0;i<15&&!ok;i++){try{await page.goto('http://127.0.0.1:18765/efis-display-lab/',{timeout:2500});ok=true}catch{await new Promise(r=>setTimeout(r,400))}}
  assert.ok(ok,'Local lab must load');
  await page.waitForFunction(()=>!!window.B737EFISDisplayLab);
  assert.equal(await page.locator('#auditRows tr').count(),25);
  assert.equal((await page.evaluate(()=>window.B737EFISDisplayLab.runTests())).pass,true);
  assert.equal(await page.locator('#ehsi').getAttribute('data-renderer'),'EHSI-CLASSIC-REBUILD-0002');
  assert.equal(await page.locator('#ehsi').getAttribute('data-mode'),'MAP');
  assert.equal(await page.locator('#ehsi [data-segment="compass-rose"]').count(),1);
  assert.equal(await page.locator('#ehsi [data-segment="aircraft"]').count(),1);
  const shots={};
  async function screenshot(name){
   const bytes=await page.locator('#ehsiStage').screenshot({path:path.join(out,name+'.png'),animations:'disabled'});
   shots[name]=crypto.createHash('sha256').update(bytes).digest('hex');
  }
  await screenshot('ehsi-map');
  await page.locator('[data-ehsi-mode="FULL_NAV"]').click();
  assert.equal(await page.locator('#ehsi').getAttribute('data-mode'),'FULL_NAV');
  assert.equal(await page.locator('#ehsi [data-segment="course-deviation"]').count(),1);
  assert.equal(await page.locator('#ehsi [data-segment="compass-rose"] circle').count(),1);
  await screenshot('ehsi-full-nav');
  await page.locator('[data-ehsi-mode="PLAN"]').click();
  assert.equal(await page.locator('#ehsi').getAttribute('data-mode'),'PLAN');
  assert.equal(await page.locator('#ehsi [data-segment="true-north"]').count(),1);
  assert.equal(await page.locator('#ehsi [data-segment="heading-bug"]').count(),0);
  assert.equal(await page.locator('#ehsi [data-segment="aircraft"]').count(),0);
  assert.ok((await page.locator('#ehsi').textContent()).includes('NORTH UP'));
  await screenshot('ehsi-plan');
  assert.equal(new Set(Object.values(shots)).size,3,'Three modes must produce distinct rendered screenshots');
  // PLAN: fixed true-north route must NOT turn if HDG/TRK inputs change.
  const before=await page.locator('#ehsi [data-segment="plan-route"] line').evaluateAll(a=>a.map(x=>[x.getAttribute('x1'),x.getAttribute('y1'),x.getAttribute('x2'),x.getAttribute('y2')]));
  await page.locator('input[data-path="ehsi.track"]').fill('100');
  await page.locator('input[data-path="ehsi.heading"]').fill('120');
  const after=await page.locator('#ehsi [data-segment="plan-route"] line').evaluateAll(a=>a.map(x=>[x.getAttribute('x1'),x.getAttribute('y1'),x.getAttribute('x2'),x.getAttribute('y2')]));
  assert.deepEqual(after,before,'PLAN route must stay true north');
  // Unsupported VOR presentation must never fall back to old generic map drawing.
  await page.locator('select[data-path="ehsi.mode"]').selectOption('FULL_VOR_ILS');
  assert.ok((await page.locator('#ehsi').textContent()).includes('PENDING MODE REBUILD'));
  assert.equal(await page.locator('#ehsi [data-segment="compass-rose"]').count(),0);
  await page.locator('[data-ehsi-mode="MAP"]').click();
  await page.locator('[data-scenario="navfail"]').click();
  assert.equal(await page.locator('#ehsi [data-segment="active-route"]').count(),0);
  assert.ok((await page.locator('#ehsi').textContent()).includes('HEADING / TRACK INVALID'));
  await page.locator('[data-scenario="normal"]').click();
  await page.locator('input[data-path="power.ehsi"]').uncheck();
  assert.equal(await page.locator('#ehsi').getAttribute('data-mode'),'MAP');
  assert.equal(await page.locator('#ehsi [data-segment="compass-rose"]').count(),0);
  await page.locator('[data-scenario="normal"]').click();
  await page.locator('[data-scenario="approach"]').click();
  assert.equal((await page.evaluate(()=>window.B737EFISDisplayLab.getState())).eadi.radioAlt,120);
  await page.locator('input[data-path="power.eadi"]').uncheck();
  assert.equal(await page.locator('#eadiStatus').textContent(),'NO POWER');
  await page.locator('[data-scenario="normal"]').click();
  await page.screenshot({path:path.join(out,'desktop.png'),animations:'disabled'});
  await page.setViewportSize({width:390,height:844});
  await page.screenshot({path:path.join(out,'mobile.png'),animations:'disabled'});
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth+2),'Mobile no horizontal overflow');
  assert.deepEqual(errors,[],'No unhandled browser JS errors');
  console.log('EFIS EHSI V2 BROWSER PASS: MAP/FULL NAV/PLAN distinct, north-up stable, unsupported gate, failures, desktop/mobile.');
 }finally{if(browser)await browser.close();server.kill('SIGTERM')}
})().catch(e=>{console.error(e);process.exitCode=1});
