'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {chromium}=require('playwright');
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
   document.querySelector('[data-focus="pedestal"]').click();document.querySelector('#native').click();
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
  const initialIndex=await shoe.evaluate(el=>parseFloat(el.style.top));
  await trim.focus();await page.keyboard.press('PageDown');
  assert.equal(await page.evaluate(()=>window.B737StabilizerTrim.get()),6);
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
  await page.evaluate(()=>window.B737UnifiedFlightScenarioV1.stop());
  const selector=fire.getByRole('button',{name:'ENG2 OVHT DET B',exact:true});
  await selector.click();
  assert.deepEqual(await page.evaluate(()=>window.B737UnifiedFireLights.getState().selectors),{ENG1:'NORMAL',ENG2:'B'});
  const test=fire.getByRole('button',{name:'Fire and overheat TEST OVHT / FIRE',exact:true});
  await test.focus();await page.keyboard.down('Space');
  await page.waitForFunction(()=>window.B737UnifiedFireLights.evaluate().activeFire.APU);
  assert.equal(await page.evaluate(()=>window.B737UnifiedFireLights.evaluate().outputs.APU.autoShutdown),false);
  await page.keyboard.up('Space');
  await page.waitForFunction(()=>!window.B737UnifiedFireLights.evaluate().activeFire.ENG1);
  await handle.click();assert.equal(await handle.getAttribute('data-pulled'),'false');
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
  await handle.focus();await page.keyboard.down('ArrowLeft');
  await page.waitForFunction(()=>window.B737UnifiedFireLights.getState().bottles.L,null,{timeout:7500});
  await page.keyboard.up('ArrowLeft');
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
