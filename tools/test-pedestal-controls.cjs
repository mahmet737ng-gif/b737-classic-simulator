'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const trimModel=require('../panel-mosaic-lab/cockpit/stabilizer-trim-quadrant.js');
const path=require('node:path');
const {chromium}=require('playwright');
assert.deepEqual(trimModel.limits('MANUAL'),[0,17]);
assert.deepEqual(trimModel.limits('MAIN_ELECTRIC'),[2.5,12.5]);
assert.deepEqual(trimModel.limits('MAIN_ELECTRIC',0,'737-400'),[2.8,12.5]);
assert.deepEqual(trimModel.limits('MAIN_ELECTRIC',5),[.25,12.5]);
assert.deepEqual(trimModel.limits('AUTOPILOT'),[.25,14]);
assert.equal(trimModel.indexY(0),520);
assert.equal(trimModel.step(16,17,[.25,14]),16);
assert.equal(trimModel.step(16,15,[.25,14]),15);
const output=path.resolve('artifacts/pedestal-qa');
fs.mkdirSync(output,{recursive:true});
(async()=>{
 const browser=await chromium.launch({headless:true,...(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:{})});
 const page=await browser.newPage({viewport:{width:1600,height:1000}});
 const errors=[];page.on('pageerror',err=>errors.push(String(err.stack)));
 try{
  await page.goto('http://127.0.0.1:8788/panel-mosaic-lab/cockpit/',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.B737ThrottlePositions?.mounted()&&window.B737ISNCockpitV1&&
   window.B737McpAFDSBridgeV1&&document.querySelectorAll('.fire-handle-control').length===3,null,{timeout:55000});
  await page.evaluate(()=>{
   document.querySelector('#native').click();
   window.pedestalPresses=[];window.addEventListener('b737:toga-request',e=>window.pedestalPresses.push(e.detail.source));
  });
  const fire=page.locator('[data-piece="fire-protection"]');
  const quadrant=page.locator('[data-piece="throttle-quadrant"]');
  const handle=fire.locator('[data-unit="ENG1"]');
  assert.equal(await fire.locator('.fire-toggle-silver').count(),4);
  assert.equal(await fire.locator('.fire-lamp').count(),11);
  await quadrant.scrollIntoViewIfNeeded();
  await page.waitForFunction(()=>[...document.querySelectorAll('.pedestal-trim-plane img,.pedestal-trim-index')].every(i=>i.complete&&i.naturalWidth>0));
  const trim=quadrant.getByRole('slider',{name:'CAPT manual stabilizer trim wheel'});
  const lever=quadrant.getByRole('slider',{name:'Engine 1 thrust lever'});
  const shoe=quadrant.locator('.pedestal-trim-index').first();
  const gripSeam=await page.evaluate(()=>{
   const [left,right]=[...document.querySelectorAll('.throttle-sprite-hit')].map(node=>node.getBoundingClientRect());
   return (right.left-left.right)/left.width;
  });
  assert.ok(gripSeam>=0 && gripSeam<.035,'white grips meet at a narrow seam in IDLE');
  const initialIndex=await shoe.evaluate(el=>parseFloat(el.style.top));
  await trim.focus();await page.keyboard.press('PageDown');
  assert.equal(await page.evaluate(()=>window.B737StabilizerTrim.get()),6);
  await page.waitForFunction(()=>document.querySelector('.pedestal-trim-index').style.top!=='56.4%');
  assert.ok(await shoe.evaluate(el=>parseFloat(el.style.top))>initialIndex);
  assert.equal(await quadrant.getByRole('slider',{name:'FO manual stabilizer trim wheel'}).getAttribute('aria-valuenow'),'6');
  await lever.focus();await page.keyboard.press('Home');
  const idle=await lever.evaluate(el=>parseFloat(el.style.top));
  await page.keyboard.press('End');
  const full=await lever.evaluate(el=>parseFloat(el.style.top));
  assert.ok(idle-full>45,'lever reaches both ends of its registered slot');
  await page.keyboard.press('Home');
  await quadrant.screenshot({path:path.join(output,'quadrant-idle.png')});
  // Electrical setup uses the existing simulator, never an injected bus snapshot.
  await page.evaluate(()=>{
   const owner=window.B737ISNCockpitV1;
   for(const key of ['batterySwitch','groundPowerAttached','groundPowerQualityGood'])
    owner.instructor({type:'ELECTRICAL',action:{type:'CONTROL',key,value:true}});
   owner.instructor({type:'ELECTRICAL',action:{type:'SELECT_SOURCE',side:1,source:'EXT'}});
   for(const engine of ['engine1','engine2'])owner.engineTrainerAction({type:'PRESET_RUNNING',engine,instructor:true});
  });
  await page.waitForFunction(()=>window.B737McpAFDSBridgeV1.getOutput().power&&window.B737UnifiedFireLights.getState().power.batteryBus);
  await page.evaluate(()=>{
   window.B737UnifiedFlightScenarioV1.loadScenario({airport:'OIII',runway:'29L',preset:'RUNWAY_READY'});
   const desired={FD_LEFT:'ON',FD_RIGHT:'ON',AT_ARM:'ARM'};
   for(const [id,value] of Object.entries(desired)){
    if(window.B737McpHardwareV1.getState()[id]!==value)document.querySelector('[data-mcp-hardware="'+id+'"]').click();
   }
  });
  await page.waitForFunction(()=>{const c=window.B737McpAFDSBridgeV1.getOutput().controls;return c.fd.left&&c.fd.right&&c.atArm;});
  await quadrant.getByRole('button',{name:'Press TO/GA switch on throttle 1'}).click();
  await page.waitForFunction(()=>window.B737UnifiedTOGACh4V1.getState().phase==='TO'&&window.B737ThrottlePositions.get(2)===100);
  await quadrant.screenshot({path:path.join(output,'quadrant-takeoff.png')});
  await page.evaluate(()=>{
   window.B737UnifiedFlightScenarioV1.stop();
   window.B737UnifiedFlightScenarioV1.loadScenario({airport:'OIII',runway:'29L',preset:'FINAL_5'});
  });
  await quadrant.getByRole('button',{name:'Press TO/GA switch on throttle 2'}).click();
  await page.waitForFunction(()=>window.B737UnifiedTOGACh4V1.getState().phase==='GA');
  const ga=await page.evaluate(()=>({mode:window.B737UnifiedTOGACh4V1.getState(),buttons:window.pedestalPresses}));
  assert.equal(ga.mode.pitchMode,'TO/GA');assert.equal(ga.mode.thrustDemand,'GA_REDUCED');
  assert.deepEqual(ga.buttons,['THROTTLE_1','THROTTLE_2']);
  await page.waitForFunction(()=>Object.values(window.B737ISNCockpitV1.getPropulsionSnapshot().engines)
   .some(e=>e.running&&e.throttle>=.82&&e.n1Percent>=80),null,{timeout:45000});
  await quadrant.getByRole('button',{name:'Press TO/GA switch on throttle 1'}).click();
  await page.waitForFunction(()=>window.B737UnifiedTOGACh4V1.getState().thrustDemand==='GA_FULL'&&
   window.B737ThrottlePositions.get(1)===100&&window.B737ThrottlePositions.get(2)===100);
  await page.evaluate(()=>window.B737UnifiedFlightScenarioV1.stop());
  const selector=fire.getByRole('button',{name:'ENG2 OVHT DET B',exact:true});
  await selector.click();
  assert.deepEqual(await page.evaluate(()=>window.B737UnifiedFireLights.getState().selectors),{ENG1:'NORMAL',ENG2:'B'});
  const test=fire.getByRole('button',{name:'Fire and overheat TEST OVHT / FIRE',exact:true});
  const initialHandles=await fire.locator('.fire-handle-control img').evaluateAll(imgs=>imgs.map(i=>i.src));
  await test.focus();await page.keyboard.down('Space');
  await page.waitForFunction(()=>window.B737UnifiedFireLights.evaluate().activeFire.APU);
  assert.equal(await page.evaluate(()=>window.B737UnifiedFireLights.evaluate().outputs.APU.autoShutdown),false);
  assert.equal(await fire.locator('.fire-handle-control[data-lit="true"]').count(),3);
  assert.deepEqual(await fire.locator('.fire-handle-control img').evaluateAll(imgs=>imgs.map(i=>i.src)),initialHandles);
  assert.equal(await fire.locator('[data-fire-lamp="ENG1_OVERHEAT"]').getAttribute('data-illuminated'),'true');
  await page.keyboard.up('Space');
  await page.waitForFunction(()=>!window.B737UnifiedFireLights.evaluate().activeFire.ENG1);
  const ext=fire.getByRole('button',{name:'EXT TEST',exact:true});
  await ext.focus();await page.keyboard.down('ArrowLeft');
  assert.equal(await fire.locator('.fire-lamp[data-kind="round"][data-illuminated="true"]').count(),3);
  await page.keyboard.up('ArrowLeft');
  assert.equal(await fire.locator('.fire-lamp[data-kind="round"][data-illuminated="true"]').count(),0);
  await ext.focus();await page.keyboard.down('ArrowRight');
  assert.equal(await fire.locator('.fire-lamp[data-kind="round"][data-illuminated="true"]').count(),3);
  await page.keyboard.up('ArrowRight');
  await handle.click();assert.equal(await handle.getAttribute('data-pulled'),'false');
  const release=fire.getByRole('button',{name:'Fire handle manual lock release · arm next pull'});
  await release.click();
  // Exercise the one-shot release on the APU handle. This intentionally
  // avoids changing either running engine before the independent fire test.
  const apu=fire.locator('[data-unit="APU"]');
  await apu.click();assert.equal(await apu.getAttribute('data-pulled'),'true');
  assert.equal(await release.getAttribute('aria-pressed'),'false');
  await apu.click();assert.equal(await apu.getAttribute('data-pulled'),'false');
  const launch=fire.getByRole('button',{name:'Fire Protection Test Lab · triple click'});
  await launch.click({clickCount:3,position:{x:18,y:14}});
  const lab=page.locator('#unifiedFireLab');
  await lab.waitFor({state:'visible'});
  assert.equal(await lab.locator('[data-caution]').count(),16);
  assert.equal(await lab.locator('[data-readout="ENG1"]').count(),11);
  assert.equal(await lab.locator('.b737-sp-console').count(),2);
  assert.equal(await lab.locator('[data-readout="ENG1"]').nth(1).textContent(),'85.0%');
  assert.equal(await lab.locator('[data-readout="ENG2"]').nth(1).textContent(),'85.0%');
  assert.equal(await lab.locator('[data-readout="APU"]').first().textContent(),'RUNNING');
  const liveBefore=await page.evaluate(()=>window.B737UnifiedFireLights.getState());
  const labTest=lab.getByRole('button',{name:'Fire and overheat TEST OVHT / FIRE',exact:true});
  await lab.locator('#p8-lab-power input[value="acTransfer1"]').uncheck();
  await labTest.focus();await page.keyboard.down('Space');
  for(const id of ['FAULT','APU_DET_INOP','APU_BOTTLE_DISCHARGED'])
   assert.equal(await lab.locator('[data-fire-lamp="'+id+'"]').getAttribute('data-illuminated'),'true');
  assert.equal(await lab.locator('[data-fire-lamp="WHEEL_WELL"]').getAttribute('data-illuminated'),'false');
  await page.keyboard.up('Space');
  await lab.locator('#p8-lab-scenario').selectOption('APU_DET');
  await lab.getByRole('button',{name:'Apply Scenario'}).click();
  await page.waitForFunction(()=>document.querySelector('#unifiedFireLab [data-caution="CAPT.OVHT/DET"]').dataset.lit==='true');
  await page.screenshot({path:path.join(output,'fire-lab.png')});
  await lab.getByRole('button',{name:'Reset Lab'}).click();
  await lab.locator('#p8-lab-scenario').selectOption('FALSE_HANDLE');
  await lab.getByRole('button',{name:'Apply Scenario'}).click();
  assert.equal(await lab.locator('[data-unit="ENG1"]').getAttribute('data-lit'),'true');
  assert.match(await lab.locator('#p8-lab-cues-ENG1').textContent(),/OVERHEAT OFF.*BELL OFF/);
  await lab.locator('#p8-lab-scenario').selectOption('ENG1_FIRE');
  await lab.getByRole('button',{name:'Apply Scenario'}).click();
  await page.waitForFunction(()=>window.B737UnifiedFireLab.snapshot().equipment.ENG1.stage==='FIRE',null,{timeout:10000});
  assert.match(await lab.locator('#p8-lab-cues-ENG1').textContent(),/FIRE HANDLE ON.*OVERHEAT ON.*BELL ON/);
  assert.deepEqual(await page.evaluate(()=>window.B737UnifiedFireLights.getState()),liveBefore);
  await lab.getByRole('button',{name:'Reset Lab'}).click();
  await lab.getByRole('button',{name:'Close'}).click();
  await lab.waitFor({state:'hidden'});
  await fire.screenshot({path:path.join(output,'fire-stowed.png')});
  const before=await handle.boundingBox();
  await page.evaluate(()=>window.B737UnifiedFireLights.dispatch({type:'SET_FIRE',unit:'ENG1',active:true}));
  await handle.click();
  await page.waitForFunction(()=>window.B737ISNCockpitV1.getStartState().phase.engine1==='FUEL_STARVATION');
  assert.equal(await page.evaluate(()=>window.B737ISNCockpitV1.getStartState().phase.engine2),'RUNNING');
  assert.equal(await handle.getAttribute('data-pulled'),'true');
  await page.waitForTimeout(200);
  const pulled=await handle.boundingBox();assert.ok(pulled.width>before.width*1.15);
  await fire.screenshot({path:path.join(output,'fire-pulled.png')});
  const grip=await handle.boundingBox();
  const x=grip.x+grip.width/2,bottom=grip.y+grip.height*.76,top=grip.y+grip.height*.24;
  await page.mouse.move(x,bottom);await page.mouse.down();await page.mouse.move(x-grip.width*.4,bottom,{steps:3});
  assert.equal(await handle.getAttribute('data-angle'),'0','lower half cannot rotate the handle');
  await page.mouse.up();
  await page.mouse.move(x,top);await page.mouse.down();await page.mouse.move(x-grip.width*.43,top,{steps:4});
  assert.equal(await handle.getAttribute('data-angle'),'-45','upper lateral drag reaches discharge detent');
  const hinge=await handle.evaluate(node=>{
   const style=getComputedStyle(node);
   const [x,y]=style.transformOrigin.split(' ').map(parseFloat);
   return [x/node.offsetWidth,y/node.offsetHeight];
  });
  assert.ok(Math.abs(hinge[0]-.5)<.02&&Math.abs(hinge[1]-1)<.02,'bottom hinge');
  await page.waitForFunction(()=>window.B737UnifiedFireLights.getState().bottles.L,null,{timeout:7500});
  await page.mouse.up();
  assert.equal(await handle.getAttribute('data-angle'),'0');
  assert.equal(await page.evaluate(()=>window.B737UnifiedFireLights.getState().engineFire.ENG1),false);
  console.log('PASS: both physical TO/GA buttons, live flight modes and throttle travel, bitmap trim wheels and indices, fire switch tests, mechanical release, engine isolation and discharge.');
 }catch(error){
  console.error('Pedestal diagnostics',await page.evaluate(()=>({power:window.B737UnifiedFireLights?.getState().power,
   engines:window.B737ISNCockpitV1?.getStartState().phase,mcp:window.B737McpAFDSBridgeV1?.getOutput(),
   toga:window.B737UnifiedTOGACh4V1?.getState(),feedback:window.B737UnifiedTOGACh4V1?.getDiagnostics(),
   buttons:window.pedestalPresses})).catch(()=>null),errors.slice(-6));
  throw error;
 }finally{await browser.close();}
})().catch(err=>{console.error(err);process.exitCode=1;});
