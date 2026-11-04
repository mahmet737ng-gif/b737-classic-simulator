'use strict';
// CONV-CONTROLS-0001 — real Chromium QA against rendered original photo.
const assert=require('node:assert/strict');
const {chromium}=require('playwright');
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
 const page=await browser.newPage({viewport:{width:1920,height:1080},deviceScaleFactor:1});
 const issues=[];page.on('pageerror',e=>issues.push(String(e.message).slice(0,300)));
 try{
  const response=await page.goto('http://127.0.0.1:8788/panel-mosaic-lab/cockpit/?v=CONV-CONTROLS-0001',
    {waitUntil:'domcontentloaded',timeout:60000});
  assert.equal(response?.status(),200,'Unified route');
  await page.waitForFunction(()=>Boolean(window.B737EngineIndicationModeV1?.setMode)&&
    Boolean(window.B737GuardOwner18?.inspect?.()?.antiskid),null,{timeout:30000});
  const before=await page.evaluate(()=>{
    const g=document.querySelector('#region-main .owner18-guard-control[data-guard-id="antiskid"]');
    return {mode:document.documentElement.dataset.engineIndication,
      x:parseFloat(getComputedStyle(g).left),y:parseFloat(getComputedStyle(g).top),
      originalX:parseFloat(g.style.left),originalY:parseFloat(g.style.top)};
  });
  assert.equal(before.mode,'EIS');
  assert.ok(Math.abs(before.x-before.originalX)<.02&&Math.abs(before.y-before.originalY)<.02,
    'EIS physical anti-skid geometry must match approved original');
  await page.evaluate(()=>window.B737EngineIndicationModeV1.setMode('CONVENTIONAL'));
  await page.waitForFunction(()=>document.documentElement.dataset.engineIndication==='CONVENTIONAL'&&
    window.B737ConventionalPhysicalControlsV1?.getState()?.ready===true,null,{timeout:30000});
  const geometry=await page.evaluate(()=>{
    const photo=document.querySelector('.conventional-engine-panel-v1');
    const g=document.querySelector('#region-main .owner18-guard-control[data-guard-id="antiskid"]');
    const knob=document.querySelector('.b737-conv-autobrake-rotary');
    const r=photo.getBoundingClientRect(),s=g.getBoundingClientRect(),k=knob.getBoundingClientRect();
    const calc=([x,y])=>({x:r.left+r.width*x/1463,y:r.top+r.height*y/1075});
    const anti=calc([1153.5,620]),auto=calc([1147.6,844.8]);
    const css=getComputedStyle(knob);
    return {
      anti:{actual:{x:s.left+s.width/2,y:s.top+s.height/2},want:anti,
        state:g.dataset.value,cover:g.dataset.cover},
      brake:{actual:{x:k.left+k.width/2,y:k.top+k.height/2},want:auto,
        state:knob.dataset.detent,display:css.display,asset:knob.querySelector('img')?.src,
        naturalW:knob.querySelector('img')?.naturalWidth},
      count:document.querySelectorAll('.b737-conv-autobrake-rotary').length,
      mode:document.documentElement.dataset.engineIndication
    };
  });
  assert.equal(geometry.mode,'CONVENTIONAL');
  assert.equal(geometry.count,1,'One real autobrake knob, not duplicates');
  for(const pair of [geometry.anti,geometry.brake]){
    for(const xy of ['x','y'])assert.ok(Math.abs(pair.actual[xy]-pair.want[xy])<2.2,
      xy+' must align to photographed centre, not screenshot approximation: '+JSON.stringify(pair));
  }
  assert.equal(geometry.brake.display,'block');
  assert.equal(geometry.brake.naturalW,288,'Only approved 288px database knob');
  assert.ok(geometry.brake.asset.includes('/Switches/Rotary/rotary-standard-v1.webp'));
  assert.equal(geometry.brake.state,'OFF');
  await page.locator('.b737-conv-autobrake-rotary').scrollIntoViewIfNeeded();
  await page.locator('.b737-conv-autobrake-rotary').click({force:true});
  assert.equal(await page.evaluate(()=>window.B737ConventionalPhysicalControlsV1.getDetent()),'1');
  await page.locator('.b737-conv-autobrake-rotary').hover({force:true});
  await page.mouse.wheel(0,-120);
  assert.equal(await page.evaluate(()=>window.B737ConventionalPhysicalControlsV1.getDetent()),'2');
  await page.locator('.b737-conv-autobrake-rotary').focus();
  await page.keyboard.press('ArrowRight');
  assert.equal(await page.evaluate(()=>window.B737ConventionalPhysicalControlsV1.getDetent()),'3');
  await page.evaluate(()=>{
    window.B737ConventionalPhysicalControlsV1.setDetent('2','browser-qa');
    window.B737GuardOwner18.set('antiskid','OFF');
  });
  assert.equal(await page.locator('[data-guard-id="antiskid"]').getAttribute('data-value'),'OFF');
  await page.evaluate(()=>window.B737GuardOwner18.set('antiskid','ON',true));
  // User-facing single-click behavior: a CLOSED guard must not swallow the
  // first click. It must open and toggle actual hardware ON -> OFF.
  const antiSwitch=page.locator('#region-main .owner18-guard-control[data-guard-id="antiskid"]');
  await page.waitForFunction(()=>Boolean(window.B737CockpitLights?.setInputs),null,{timeout:25000});
  await antiSwitch.scrollIntoViewIfNeeded();
  await antiSwitch.click({force:true});
  let antiState=await page.evaluate(()=>{
    const g=document.querySelector('#region-main .owner18-guard-control[data-guard-id="antiskid"]');
    return {state:g.dataset.value,cover:g.dataset.cover,
      photo:g.querySelector('.owner18-switch-photo')?.src,
      sensor:window.B737CockpitLights.getState().inputs.antiskidOn};
  });
  assert.equal(antiState.state,'OFF','First Conventional click turns ANTISKID OFF');
  assert.equal(antiState.cover,'open','Guard opens and exposes OFF position');
  assert.ok(antiState.photo.endsWith('Black_Guarded_Open_UP.png'),'OFF uses its approved hardware photo');
  assert.equal(antiState.sensor,false,'OFF drives actual INOP sensor');
  await page.waitForTimeout(450);
  await antiSwitch.click({force:true});
  antiState=await page.evaluate(()=>{
    const g=document.querySelector('#region-main .owner18-guard-control[data-guard-id="antiskid"]');
    return {state:g.dataset.value,cover:g.dataset.cover,
      photo:g.querySelector('.owner18-switch-photo')?.src,
      sensor:window.B737CockpitLights.getState().inputs.antiskidOn};
  });
  assert.equal(antiState.state,'ON','Second Conventional click turns ANTISKID ON');
  assert.ok(antiState.photo.endsWith('Black_Guarded_Open_DOWN.png'),'ON uses its approved hardware photo');
  assert.equal(antiState.sensor,true,'ON reconnects actual INOP sensor');
  await antiSwitch.focus();
  await page.keyboard.press('ArrowDown');
  assert.equal(await antiSwitch.getAttribute('data-value'),'OFF','ArrowDown selects OFF');
  await page.keyboard.press('ArrowUp');
  assert.equal(await antiSwitch.getAttribute('data-value'),'ON','ArrowUp selects ON');
  await antiSwitch.hover({force:true});
  await page.mouse.wheel(0,120);
  assert.equal(await antiSwitch.getAttribute('data-value'),'OFF','Scroll down selects OFF');
  await page.mouse.wheel(0,-120);
  assert.equal(await antiSwitch.getAttribute('data-value'),'ON','Scroll up selects ON');
  await antiSwitch.click({button:'right',force:true});
  assert.equal(await antiSwitch.getAttribute('data-cover'),'closed',
    'Right-click closes the existing guarded hardware');
  assert.equal(await antiSwitch.getAttribute('data-value'),'ON',
    'Close returns the original protected ON detent');
  console.log('CONVENTIONAL_ANTISKID_ON_OFF_INTERACTION_PASS',JSON.stringify(antiState));

  // Verify every detent's TRUE pointer direction. The knob sprite's tip
  // points straight up before rotation; rotations must match panel legends.
  const direction=await page.evaluate(()=>{
    const api=window.B737ConventionalPhysicalControlsV1;
    const img=document.querySelector('.b737-conv-autobrake-rotary img');
    img.style.transition='none';
    const result={};
    for(const d of api.detents){
      api.setDetent(d,'pointer-qa');
      const m=new DOMMatrixReadOnly(getComputedStyle(img).transform);
      result[d]=Math.round(Math.atan2(m.b,m.a)*180/Math.PI);
    }
    api.setDetent('OFF','pointer-qa');
    return result;
  });
  assert.deepEqual(direction,{RTO:-135,OFF:-90,'1':-45,'2':0,'3':45,MAX:90});
  console.log('AUTOBRAKE_POINTER_AXLE_PASS',JSON.stringify(direction));
  // Actual pedestal events, not artificial changes to the lamp model, must
  // feed the shared engine regardless of active EIS/Conventional background.
  const mechanical=await page.evaluate(()=>{
    const get=()=>window.B737AutobrakeUnified.getState().inputs;
    document.dispatchEvent(new CustomEvent('b737:throttle-position',{
      detail:{engine:1,percent:25,stage:'quarter',source:'PEDESTAL'}
    }));
    const oneAdvanced=get().thrustIdle;
    document.dispatchEvent(new CustomEvent('b737:throttle-position',{
      detail:{engine:1,percent:0,stage:'idle',source:'PEDESTAL'}
    }));
    const bothIdle=get().thrustIdle;
    document.dispatchEvent(new CustomEvent('b737:speedbrake-position',{
      detail:{detent:'UP',source:'PEDESTAL'}
    }));
    const speedbrakeUp=get().speedBrakeDown;
    document.dispatchEvent(new CustomEvent('b737:speedbrake-position',{
      detail:{detent:'DOWN',source:'PEDESTAL'}
    }));
    const speedbrakeStowed=get().speedBrakeDown;
    return {oneAdvanced,bothIdle,speedbrakeUp,speedbrakeStowed};
  });
  assert.deepEqual(mechanical,{oneAdvanced:false,bothIdle:true,
    speedbrakeUp:false,speedbrakeStowed:true});
  console.log('PEDESTAL_AUTOBRAKE_SENSOR_LINK_PASS',JSON.stringify(mechanical));
  await page.waitForFunction(()=>Boolean(window.B737CockpitLights?.setInputs),null,{timeout:25000});
  await page.evaluate(()=>{
    const frame=document.getElementById('overheadFrame');
    window.dispatchEvent(new MessageEvent('message',{
      origin:location.origin,source:frame.contentWindow,
      data:{type:'b737:cockpit-overhead',kind:'state',power:true}
    }));
    window.B737CockpitLights.setInputs({power:true,autobrakeDisarmed:false,autobrakeArmed:false,antiskidOn:true});
  });
  const status=()=>page.evaluate(()=>{
    const state=window.B737CockpitLights.getState();
    return {wow:state.inputs.aircraftOnGround,test:state.inputs.autobrakeRtoSelfTest,
      fault:state.inputs.autobrakeDisarmed,frame:state.frames['main-autobrake'],
      power:state.overheadPower,
      detent:window.B737ConventionalPhysicalControlsV1.getDetent()};
  });
  assert.equal((await status()).power,true,'Powered lamp source for real browser test');
  await page.evaluate(()=>{
    const api=window.B737ConventionalPhysicalControlsV1;
    api.setOnGround(false);api.setDetent('OFF');api.setDetent('RTO');
  });
  assert.equal((await status()).test,false,'RTO selected in flight cannot start test');
  assert.equal((await status()).frame,'OFF','No flight self-test light');
  await page.evaluate(()=>{
    const api=window.B737ConventionalPhysicalControlsV1;
    api.setOnGround(true);api.setDetent('OFF');api.setDetent('RTO');
  });
  assert.equal((await status()).test,true,'Ground RTO starts self-test');
  assert.equal((await status()).frame,'ON','DISARM lamp lit during test');
  await page.screenshot({path:'/tmp/b737-conv-rto-disarm-on.png',timeout:25000});
  await page.waitForTimeout(950);
  assert.equal((await status()).frame,'ON','Lamp remains illuminated before 1500 ms');
  await page.waitForTimeout(700);
  assert.equal((await status()).test,false,'Test ends automatically after 1.5 seconds');
  assert.equal((await status()).frame,'OFF','Lamp dark after 1.5 seconds without fault');
  await page.evaluate(()=>{
    const api=window.B737ConventionalPhysicalControlsV1;
    api.setDetent('OFF');api.setDetent('RTO');api.setDetent('1');
  });
  assert.equal((await status()).test,false,'Leaving RTO cancels any running test');
  await page.evaluate(()=>{
    const api=window.B737ConventionalPhysicalControlsV1;
    api.setDetent('OFF');api.setDetent('RTO');
    window.B737AutobrakeUnified.updateSensors({autobrakeFault:true});
  });
  await page.waitForTimeout(1700);
  assert.equal((await status()).test,false,'Self-test timer cleared');
  assert.equal((await status()).frame,'ON','A real DISARM fault remains ON after timer');
  await page.evaluate(()=>{
    window.B737ConventionalPhysicalControlsV1.setDetent('OFF');
    window.B737AutobrakeUnified.updateSensors({autobrakeFault:false});
  });
  assert.equal((await status()).frame,'OFF');
  console.log('GROUND_RTO_1500MS_SELF_TEST_PASS',JSON.stringify(await status()));
  await page.screenshot({path:'/tmp/b737-conv-skid-autobrake-browser.png',timeout:25000});
  console.log('CONVENTIONAL_PHYSICAL_CONTROLS_PHOTO_PASS',JSON.stringify(geometry));
  // Shared autobrake logic must outlive switching between the two photo
  // configurations; no second 1500ms timer or duplicate state in EIS.
  await page.evaluate(()=>{
    const shared=window.B737AutobrakeUnified;
    shared.setOnGround(true);
    shared.setSelector('2');
    shared.updateSensors({autobrakeFault:false,antiskidOn:true});
  });
  const priorCommon=await page.evaluate(()=>window.B737AutobrakeUnified.getState());
  assert.equal(priorCommon.selector,'2');
  await page.evaluate(()=>window.B737EngineIndicationModeV1.setMode('EIS'));
  await page.waitForFunction(()=>document.documentElement.dataset.engineIndication==='EIS',null,{timeout:20000});
  const eis=await page.evaluate(()=>{
    const g=document.querySelector('#region-main .owner18-guard-control[data-guard-id="antiskid"]');
    const knob=document.querySelector('.b737-conv-autobrake-rotary');
    return{left:parseFloat(getComputedStyle(g).left),top:parseFloat(getComputedStyle(g).top),
      inlineLeft:parseFloat(g.style.left),inlineTop:parseFloat(g.style.top),
      knobDisplay:getComputedStyle(knob).display};
  });
  assert.ok(Math.abs(eis.left-before.originalX)<.03,'EIS original guard X retained');
  assert.ok(Math.abs(eis.top-before.originalY)<.03,'EIS original guard Y retained');
  assert.equal(eis.knobDisplay,'none','Conventional knob must not show in EIS');
  const eisCommon=await page.evaluate(()=>window.B737AutobrakeUnified.getState());
  assert.equal(eisCommon.selector,'2','EIS and Conventional share one selector');
  assert.equal(eisCommon.phase,priorCommon.phase,'Mode switch preserves actual autobrake state');
  await page.evaluate(()=>window.B737AutobrakeUnified.updateSensors({antiskidOn:false}));
  const eisDisarm=await page.evaluate(()=>({
    state:window.B737AutobrakeUnified.getState(),
    panel:window.B737CockpitLights.getState()
  }));
  assert.equal(eisDisarm.state.disarmLight,true,'ANTISKID OFF must disarm in EIS');
  assert.equal(eisDisarm.panel.inputs.autobrakeDisarmed,true,
    'EIS DISARM lens must receive the same engine output');
  await page.evaluate(()=>{
    window.B737AutobrakeUnified.setSelector('OFF');
    window.B737AutobrakeUnified.updateSensors({antiskidOn:true});
  });
  console.log('SAME_AUTOBRAKE_ENGINE_EIS_CONVENTIONAL_PASS');
  // The approved EIS guard must retain its original click policy: the first
  // click only opens its cover, unlike the Conventional single-click toggle.
  await page.evaluate(()=>window.B737GuardOwner18.set('antiskid','ON',true));
  await page.locator('#region-main .owner18-guard-control[data-guard-id="antiskid"]').click({force:true});
  assert.equal(await page.locator('[data-guard-id="antiskid"]').getAttribute('data-value'),
    'ON','EIS first click opens cover without cycling the switch');
  assert.equal(await page.locator('[data-guard-id="antiskid"]').getAttribute('data-cover'),
    'open','EIS guard opens normally');
  await page.evaluate(()=>window.B737GuardOwner18.set('antiskid','ON',true));

  console.log('EIS_ORIGINAL_ANTISKID_PRESERVED_PASS',JSON.stringify(eis));
  if(issues.length)console.log('OTHER_BROWSER_ERRORS',issues.slice(0,8));
 }finally{await page.close();await browser.close();}
})().catch(e=>{console.error('CONVENTIONAL_PHYSICAL_CONTROLS_BROWSER_FAIL',e.stack||String(e));process.exitCode=1;});
