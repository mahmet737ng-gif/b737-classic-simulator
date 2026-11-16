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
  assert.equal(await page.locator('#ehsi').getAttribute('data-renderer'),'EHSI-CLASSIC-REBUILD-0009-EXPANDED-HEADING-360');
  assert.equal(await page.locator('#ehsi').getAttribute('data-mode'),'MAP');
  assert.equal(await page.locator('#ehsi [data-segment="compass-rose"]').count(),1);
  const mapArc=await page.locator('#ehsi [data-segment="compass-rose"] > polyline').getAttribute('points');
  assert.equal(await page.locator('#ehsi [data-segment="aircraft"]').count(),1);
  const mapLabel=page.locator('#ehsi [data-segment="active-route"] [data-text="KAVIR"]');
  assert.equal(await mapLabel.getAttribute('font-size'),'20','reference-sized map waypoint identifier');
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
   const backgrounds=await page.locator('#ehsi > rect').evaluateAll(nodes=>nodes.map(node=>node.getAttribute('fill')));
   assert.deepEqual(backgrounds,['#000'],'Every EHSI format has a black display background');
   const bytes=await page.locator('#ehsiStage').screenshot({path:path.join(out,name+'.png'),animations:'disabled'});
   shots[name]=crypto.createHash('sha256').update(bytes).digest('hex');
  }
  // Browser-level 737 Classic reference: off-scale MCP selected heading
  // keeps the magenta vector on the glass; a 70-degree arc is NOT the whole
  // rose, but it must remain continuous through 359 -> 000 rotation.
  await page.evaluate(()=>window.B737EFISDisplayLab.dispatch({
   type:'set',path:'ehsi.selectedHeading',value:340}));
  assert.equal(await page.locator('#ehsi [data-segment="heading-bug"]').count(),0,
   '95° offscale MCP heading does not paint an impossible on-arc bug');
  assert.equal(await page.locator('#ehsi [data-segment="heading-bug-vector"][data-heading-offscale="true"]').count(),1,
   'Offscale 95° still shows the magenta radial selected heading line');
  await page.locator('#ehsiStage').screenshot({
   path:path.join(out,'ehsi-expanded-heading-offscale-95.png'),animations:'disabled'});
  await page.evaluate(()=>{
   const lab=window.B737EFISDisplayLab;
   lab.dispatch({type:'set',path:'ehsi.track',value:359});
   lab.dispatch({type:'set',path:'ehsi.heading',value:359});
   lab.dispatch({type:'set',path:'ehsi.selectedHeading',value:2});
  });
  assert.equal(await page.locator('#ehsi [data-segment="heading-bug"]').count(),1,
   '359° to 002° wraps into the visible arc');
  assert.equal(await page.locator('#ehsi [data-segment="heading-bug-vector"][data-relative-heading="3"]').count(),1);
  assert.equal(await page.locator('#ehsi [data-segment="compass-rose"] [data-text="0"]').count(),1,
   'Zero-degree compass index crosses 359-to-000 smoothly');
  await page.locator('#ehsiStage').screenshot({
   path:path.join(out,'ehsi-expanded-heading-wrap-359-to-002.png'),animations:'disabled'});
  await page.locator('[data-scenario="normal"]').click();
  await screenshot('ehsi-map');
  await page.locator('[data-ehsi-mode="FULL_NAV"]').click();
  assert.equal(await page.locator('#ehsi').getAttribute('data-mode'),'FULL_NAV');
  assert.equal(await page.locator('#ehsi [data-segment="course-deviation"]').count(),1);
  const fullRose=page.locator('#ehsi [data-segment="compass-rose"]');
  assert.equal(await fullRose.locator(':scope > line').count(),72);
  assert.equal(await fullRose.locator(':scope > [transform^="rotate"]').count(),12);
  const display=await page.locator('#ehsi').boundingBox();
  assert.ok(Math.abs(display.width/display.height-350/411)<.01,'EHSI remains portrait in a FULL format');
  const shared=await page.evaluate(()=>{
   const api=window.B737EFISDisplayLab;
   const value=api.getState(),core=window.EFISDisplayLabCore,eadi=window.EFISDisplayLabEadi;
   const set=(s,path,value)=>core.apply(s,{type:'set',path,value});
   const normal=eadi.fmaInput(value,core.evaluate(value));
   const cws=set(value,'eadi.afds','CWS BOTH');
   const fma=eadi.fmaInput(cws,core.evaluate(cws));
   const flap=set(value,'eadi.flaps',30);
   const gear=set(set(value,'eadi.gearState','EXTENDING'),'eadi.flaps',0);
   return {normal:normal.pitch.active,cws:[fma.afds.active,fma.afds.secondary,fma.afds.tertiary],
    flap:eadi.tapeInput(flap,core.evaluate(flap)).marks.trainingOperatingLimit.maximumKt,
    gear:eadi.tapeInput(gear,core.evaluate(gear)).marks.trainingOperatingLimit.maximumKt};
  });
  assert.deepEqual(shared,{normal:'VNAV PTH',cws:['CMD','CWS P','CWS R'],flap:180,gear:270});
  await screenshot('ehsi-full-nav');
  await page.locator('[data-ehsi-mode="PLAN"]').click();
  assert.equal(await page.locator('#ehsi').getAttribute('data-mode'),'PLAN');
  assert.equal(await page.locator('#ehsi [data-segment="true-north"]').count(),1);
  assert.equal(await page.locator('#ehsi [data-segment="plan-compass"]').count(),1);
  assert.equal(await page.locator('#ehsi [data-segment="plan-compass"] > polyline').getAttribute('points'),mapArc);
  assert.equal(await page.locator('#ehsi [data-segment="heading-bug-vector"]').count(),0);
  assert.equal(await page.locator('#ehsi [data-segment="heading-bug"]').count(),0);
  assert.equal(await page.locator('#ehsi [data-segment="heading-bug"] line[stroke-dasharray]').count(),0);
  assert.equal(await page.locator('#ehsi [data-segment="aircraft"]').count(),0);
  assert.equal(await page.locator('#ehsi [data-segment="true-north"] [data-text="N"]').count(),1);
  await screenshot('ehsi-plan');
  assert.equal(new Set(Object.values(shots)).size,3,'Three modes must produce distinct rendered screenshots');
  // PLAN: fixed true-north route must NOT turn if HDG/TRK inputs change.
  const before=await page.locator('#ehsi [data-segment="plan-route"] line').evaluateAll(a=>a.map(x=>[x.getAttribute('x1'),x.getAttribute('y1'),x.getAttribute('x2'),x.getAttribute('y2')]));
  await page.locator('input[data-path="ehsi.track"]').fill('100');
  await page.locator('input[data-path="ehsi.heading"]').fill('120');
  const after=await page.locator('#ehsi [data-segment="plan-route"] line').evaluateAll(a=>a.map(x=>[x.getAttribute('x1'),x.getAttribute('y1'),x.getAttribute('x2'),x.getAttribute('y2')]));
  assert.deepEqual(after,before,'PLAN route must stay true north');
  // Select every remaining reference format through its normal entry point.
  const formats=[
   ['CTR MAP','CTR_MAP','active-route'],['EXP NAV','EXP_NAV','course-deviation'],
   ['EXP VOR','EXP_VOR','course-deviation'],['FULL VOR','FULL_VOR','course-deviation'],
   ['EXP ILS','EXP_ILS','glideslope'],['FULL ILS','FULL_ILS','glideslope']
  ];
  for(const [label,id,seg] of formats){
   await page.getByRole('button',{name:label,exact:true}).first().click();
   assert.equal(await page.locator('#ehsi').getAttribute('data-presentation'),id);
   assert.equal(await page.locator('#ehsi [data-segment="'+seg+'"]').count(),1);
   await screenshot('ehsi-'+id.toLowerCase().replaceAll('_','-'));
  }
  assert.equal(new Set(Object.values(shots)).size,9,'All nine formats produce distinct rendered screenshots');
  await page.locator('[data-scenario="tcas"]').click();
  assert.equal(await page.locator('#ehsi [data-segment="traffic-ra"]').count(),1);
  await page.locator('#efcp-tfc').click();
  assert.equal(await page.locator('#ehsi [data-segment="traffic-ra"]').count(),0);
  assert.ok((await page.locator('#ehsi').textContent()).includes('TRAFFIC'));
  await page.locator('[data-scenario="weather"]').click();
  assert.equal(await page.locator('#ehsi [data-segment="weather-returns"]').count(),1);
  await page.locator('input[data-path="power.remoteWxr"]').uncheck();
  assert.equal(await page.locator('#ehsi [data-segment="weather-returns"]').count(),0);
  await page.locator('[data-scenario="terrain"]').click();
  assert.equal(await page.locator('#ehsi [data-segment="terrain-returns"]').count(),1);
  await page.locator('[data-ehsi-mode="MAP"]').click();
  await page.locator('[data-scenario="navfail"]').click();
  assert.equal(await page.locator('#ehsi [data-segment="active-route"]').count(),0);
  assert.equal(await page.locator('#ehsi [data-segment="compass-rose"]').count(),0);
  await page.locator('[data-scenario="normal"]').click();
  await page.locator('input[data-path="power.ehsi"]').uncheck();
  assert.equal(await page.locator('#ehsi').getAttribute('data-mode'),'MAP');
  assert.equal(await page.locator('#ehsi [data-segment="compass-rose"]').count(),0);
  for(const [name,ias,axis] of [['ref-cmd',201.5,null],['ref-cws-r',201.5,'CWS R'],
   ['ref-cws-p',201.5,'CWS P'],['ref-312',312,null]]){
   await page.locator('[data-scenario="'+name+'"]').click();
   const values=await page.evaluate(()=>{
    const s=window.B737EFISDisplayLab.getState();
    const v=window.EFISDisplayLabCore.evaluate(s);
    return {ias:s.eadi.ias,axis:window.EFISDisplayLabEadi.fmaInput(s,v).afds.secondary||null};
   });
   assert.deepEqual(values,{ias,axis});
   for(const ch of [1,2]){
    assert.equal(await page.locator('#ehsi [data-segment="nav'+ch+'-head"]').count(),1);
    assert.equal(await page.locator('#ehsi [data-segment="nav'+ch+'-tail"]').count(),1);
   }
  }
  await page.locator('[data-scenario="approach"]').click();
  assert.equal((await page.evaluate(()=>window.B737EFISDisplayLab.getState())).eadi.radioAlt,120);
  await page.locator('#eadiStage').screenshot({path:path.join(out,'eadi-approach.png'),animations:'disabled'});
  await page.locator('input[data-path="power.eadi"]').uncheck();
  assert.equal(await page.locator('#eadiStatus').textContent(),'NO POWER');
  await page.locator('[data-scenario="normal"]').click();
  await page.screenshot({path:path.join(out,'desktop.png'),animations:'disabled'});
  await page.setViewportSize({width:390,height:844});
  await page.screenshot({path:path.join(out,'mobile.png'),animations:'disabled'});
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth+2),'Mobile no horizontal overflow');
  assert.deepEqual(errors,[],'No unhandled browser JS errors');
  console.log('EFIS BROWSER PASS: nine visual formats, selectors, TCAS, WXR, terrain, source failures and desktop/mobile.');
 }finally{if(browser)await browser.close();server.kill('SIGTERM')}
})().catch(e=>{console.error(e);process.exitCode=1});
