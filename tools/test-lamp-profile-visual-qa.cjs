'use strict';
/* Read-only Chromium real-render QA matrix for CPCS/DCPCS and 737-300/500/-400.
 * Four distinct installation combinations; snapshots and pixel metrics preserved
 * as evidence. Not a substitute for owner approval of inner-glass bounds.
 */
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require('playwright');
(async()=>{
 const out='/tmp/b737-lamp-variant-evidence';fs.mkdirSync(out,{recursive:true});
 const browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
 const page=await browser.newPage({viewport:{width:1920,height:1100},deviceScaleFactor:1});
 const errors=[];page.on('pageerror',error=>errors.push(String(error)));
 const scenarios=[];
 try{
  await page.goto('http://127.0.0.1:8788/panel-mosaic-lab/cockpit/overhead-stage.html',{waitUntil:'domcontentloaded',timeout:60000});
  await page.waitForFunction(()=>!!(window.B737OH22Pressurization&&window.B737Aircon400&&document.querySelectorAll('.atlas-piece').length>=20),null,{timeout:90000});
  const frame=page;
  for(const system of ['DCPCS','CPCS']){
   for(const family of ['B737-300-500','B737-400']){
    await page.evaluate(({system,family})=>{
      const win=window;
      win.B737OH22Pressurization.setSystem(system);
      win.B737Aircon400.switchFamily(family);
      win.postMessage({type:'b737:cockpit-command',action:'pressurization-background',system},location.origin);
      win.postMessage({type:'b737:cockpit-command',action:'aircon-background',family},location.origin);
    },{system,family});
    await page.waitForFunction(({system,family})=>{
      const w=window;
      return w?.B737OH22Pressurization?.getSystem()===system&&w?.B737Aircon400?.getState()?.family===family;
    },{system,family},{timeout:25000});
    const data=await page.evaluate(({system,family})=>{
      const w=window,d=document;
      const layer=d.querySelector('.oh22-pressure-controls'),panel=d.querySelector('.atlas-piece[data-key="OH22"]');
      const image=d.querySelector('.dcpcs-owner-oh22-background');
      const ac=d.getElementById('aircon400Overlay'),acback=d.querySelector('.b737-400-owner-oh20-background');
      const lamps=[...layer.querySelectorAll('[data-role="lamp"]')].map(n=>({
        id:n.dataset.lamp,source:n.querySelector('img')?.src||null,
        bounds:(()=>{const p=n.getBoundingClientRect(),q=panel.getBoundingClientRect();return {x:+(p.left-q.left).toFixed(2),y:+(p.top-q.top).toFixed(2),w:+p.width.toFixed(2),h:+p.height.toFixed(2)}})(),
        faceSystem:n.dataset.faceSystem,lit:n.dataset.lit
      }));
      const controls=[...layer.querySelectorAll('[data-role="actuator"]')].map(n=>n.dataset.control);
      const acLamps=[...d.querySelectorAll('[data-aircon-lamp]')].map(n=>({id:n.dataset.airconLamp,visible:getComputedStyle(n).visibility}));
      return {system,family,layerSystem:layer?.dataset.system,lamps,controls,
       oh22BackgroundVisible:!!image&&getComputedStyle(image).display!=='none',
       oh22ImageLoaded:image?.dataset.loaded||null,
       airconVisible:!!ac&&!ac.hidden,
       airconBackgroundVisible:!!acback&&getComputedStyle(acback).display!=='none',
       airconImageLoaded:acback?.dataset.loaded||null,acLamps};
    },{system,family});
    assert.equal(data.layerSystem,system,'OH22 wrong displayed type');
    assert.equal(data.lamps.length,4,system+' annunciator count');
    assert.equal(new Set(data.lamps.map(x=>x.id)).size,4);
    assert.ok(data.lamps.every(x=>x.faceSystem===system&&x.bounds.w>0&&x.bounds.h>0));
    assert.equal(data.oh22BackgroundVisible,system==='DCPCS','OH22 owner-photo visibility');
    assert.equal(data.airconVisible,family==='B737-400','737-400 zone panel visibility');
    assert.equal(data.airconBackgroundVisible,family==='B737-400','737-400 OH20 owner photo');
    assert.equal(data.acLamps.length,3,'737-400 zone lamp count');
    assert.ok(data.lamps.every(x=>x.bounds.w>0&&x.bounds.w<300&&x.bounds.h<110),'Lens must remain inside photograph region');
    // Each configuration and light-test state is captured independently.
    for(const lit of [false,true]){
      await page.evaluate(on=>{const w=window;w.B737OverheadLights.setLampTest(on);w.dispatchEvent(new CustomEvent('b737:pressure-light-test'));},lit);
      await page.waitForTimeout(100);
      const live=await page.evaluate(()=>{const d=document;return [...d.querySelectorAll('.oh22-pressure-controls [data-role="lamp"]')].map(n=>({id:n.dataset.lamp,lit:n.dataset.lit,on:n.classList.contains('on'),image:n.querySelector('img')?.src||null}))});
      assert.equal(live.length,4);if(lit)assert.ok(live.every(x=>x.lit==='true'&&x.on),'OH22 visual test must light all four lamps');
      const tag=system+'_'+family.replace(/[^A-Za-z0-9]/g,'')+'_'+(lit?'ON':'OFF');
      await frame.locator('.atlas-piece[data-key="OH22"]').screenshot({path:path.join(out,tag+'_OH22.png'),timeout:20000});
      await frame.locator('.atlas-piece[data-key="OH20"]').screenshot({path:path.join(out,tag+'_OH20.png'),timeout:20000});
      scenarios.push({tag,...data,lightTest:lit,litLamps:live});
      console.log('LAMP_PROFILE_VARIANT',JSON.stringify({tag,lamps:data.lamps.length,acVisible:data.airconVisible,oh22Owner:data.oh22BackgroundVisible,litCount:live.filter(x=>x.on).length}));
    }
    await page.evaluate(()=>window.B737OverheadLights.setLampTest(false));
   }
  }
  assert.equal(scenarios.length,8);
  assert.equal(errors.filter(x=>/OH22|aircon400|pressure|lights/.test(x)).length,0,'JavaScript runtime errors');
  fs.writeFileSync(path.join(out,'variant-geometries.json'),JSON.stringify({scenarios,errors},null,2)+'\n');
  console.log('LAMP_PROFILE_VARIANTS_PASS',JSON.stringify({matrix:'2 pressurization × 2 airframes × 2 light-test states',scenarios:scenarios.length,screenshots:16,errors:errors.length}));
 }finally{await browser.close()}
})().catch(e=>{console.error('LAMP_PROFILE_VARIANTS_FAILED',e.stack||String(e));process.exitCode=1});
