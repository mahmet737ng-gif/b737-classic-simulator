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
  // Physical CP visual source, registered detents, independent coaxial shafts.
  await page.waitForFunction(()=>!!window.B737EFISCP);
  assert.equal(await page.locator('.efcp-face .efcp-knob').count(),6);
  assert.equal(await page.locator('.efcp-face .efcp-detent').count(),13);
  assert.equal(await page.locator('.efcp-face .efcp-key').count(),7);
  // Full-circle physical assets and geometry: not a partially clipped sprite.
  for(const kind of ['mode','range','hsi','wxInner']){
   const rotor=page.locator('.efcp-knob[data-knob="'+kind+'"] .efcp-rotor');
   assert.ok((await rotor.getAttribute('src')).endsWith('-v2.svg'));
   assert.equal(await rotor.evaluate(i=>i.complete&&i.naturalWidth===240&&i.naturalHeight===240),true,'SVG complete circle '+kind);
  }
  const circle=await page.locator('#efcp-tfc').evaluate(b=>{
   const rect=b.getBoundingClientRect(),st=getComputedStyle(b);
   return {w:rect.width,h:rect.height,radius:st.borderRadius,cx:rect.x+rect.width/2,cy:rect.y+rect.height/2};
  });
  const rangeCircle=await page.locator('.efcp-knob[data-knob="range"]').evaluate(b=>{
   const rect=b.getBoundingClientRect();return {cx:rect.x+rect.width/2,cy:rect.y+rect.height/2};
  });
  assert.ok(Math.abs(circle.w-circle.h)<1,'TFC must be a full 360 circle');
  assert.equal(circle.radius,'50%','TFC physical bezel is circular');
  assert.ok(Math.abs(circle.cx-rangeCircle.cx)<1 && Math.abs(circle.cy-rangeCircle.cy)<1,'TFC precisely centered within range knob');
  for(const key of ['wxr','vorAdf','navAid','arpt','rteData','wpt']){
   const button=page.locator('.efcp-key[data-switch="'+key+'"]');
   assert.equal(await button.locator('.efcp-key-well').count(),1);
   assert.equal(await button.locator('.efcp-key-bottom').count(),1);
   assert.equal(await button.locator('.efcp-on').count(),1);
  }

  assert.equal((await page.evaluate(()=>window.B737EFISCP.getState())).eadi.dh,200);
  await page.locator('[data-detent="mode"][data-value="PLAN"]').click();
  assert.equal((await page.evaluate(()=>window.B737EFISCP.getState())).ehsi.mode,'PLAN');
  await page.locator('[data-detent="range"][data-value="320"]').click();
  assert.equal((await page.evaluate(()=>window.B737EFISCP.getState())).ehsi.range,320);
  await page.locator('#efcp-tfc').click();
  assert.equal((await page.evaluate(()=>window.B737EFISCP.getState())).ehsi.options.tfc,true);
  assert.equal(await page.locator('#efcp-tfc').getAttribute('aria-pressed'),'true');
  await page.locator('[data-switch="wxr"]').click();
  assert.equal(await page.locator('[data-switch="wxr"]').getAttribute('aria-pressed'),'true');
  const outer=page.locator('.efcp-knob[data-knob="hsi"]'),outerBox=await outer.boundingBox();
  await outer.click({position:{x:outerBox.width*.15,y:outerBox.height*.5},modifiers:['Shift']});
  let physical=await page.evaluate(()=>window.B737EFISCP.getState());
  assert.equal(physical.ehsi.brightness,.96);
  assert.equal(physical.ehsi.wxBrightness,1,'outer must not turn inner');
  await page.locator('.efcp-knob[data-knob="wxInner"]').click({modifiers:['Shift']});
  physical=await page.evaluate(()=>window.B737EFISCP.getState());
  assert.equal(physical.ehsi.brightness,.96,'inner must not turn outer');
  assert.equal(physical.ehsi.wxBrightness,.96);
  assert.equal(await page.locator('#ehsi [data-segment="plan-route"]').first().evaluate(n=>n.style.opacity),'0.96','inner BRT actually dims map geometry');
  await page.locator('[data-scenario="normal"]').click();
  await page.locator('.efcp-face').screenshot({path:path.join(out,'efis-physical-panel.png'),animations:'disabled'});
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
  assert.equal(await page.locator('#ehsi [data-segment="plan-compass"]').count(),1);
  assert.equal(await page.locator('#ehsi [data-segment="heading-bug"]').count(),1);
  assert.equal(await page.locator('#ehsi [data-segment="heading-bug"] line[stroke-dasharray]').count(),0);
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
