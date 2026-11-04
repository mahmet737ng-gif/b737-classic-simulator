'use strict';
const assert=require('node:assert/strict');
const {chromium}=require('playwright');

(async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
 const base='http://127.0.0.1:8788/panel-mosaic-lab';
 try{
  for(const kind of ['overhead','main']){
   const page=await browser.newPage({viewport:{width:1660,height:1000}});
   const errors=[];page.on('pageerror',e=>errors.push(String(e)));
   try{
    const url=kind==='overhead'?base+'/interactive-overhead/?standalone=1':base+'/cockpit/';
    const response=await page.goto(url,{waitUntil:'domcontentloaded',timeout:60000});
    assert.equal(response.status(),200,kind+' route');
    await page.waitForFunction(mode=>{
     const api=mode==='overhead'?window.B737OverheadLights:window.B737CockpitLights;
     return Boolean(api?.getState?.()?.frames)&&document.querySelectorAll(
      mode==='overhead'?'.mounted-light[data-light]':'.cockpit-light[data-cockpit-light]'
     ).length===(mode==='overhead'?112:30);
    },kind,{timeout:45000});
    const state=await page.evaluate(mode=>{
     const api=mode==='overhead'?window.B737OverheadLights:window.B737CockpitLights;
     const attribute=mode==='overhead'?'data-light':'data-cockpit-light';
     const sel=mode==='overhead'?'.mounted-light':'.cockpit-light';
     const frames=api.getState().frames;
     const id=Object.keys(frames).find(k=>frames[k]==='OFF'&&document.querySelector(sel+'['+attribute+'="'+k+'"]'));
     if(!id)return {error:'No normally unlit lamp'};
     const node=document.querySelector(sel+'['+attribute+'="'+id+'"]');
     const before=JSON.stringify(api.getState().frames);
     node.dispatchEvent(new PointerEvent('pointerdown',{pointerId:171,button:0,pointerType:'mouse',bubbles:true}));
     const held={frame:node.dataset.frame,test:node.dataset.pushTest};
     const noSourceChange=JSON.stringify(api.getState().frames)===before;
     document.dispatchEvent(new PointerEvent('pointerup',{pointerId:171,button:0,pointerType:'mouse',bubbles:true}));
     const released={frame:node.dataset.frame,test:node.dataset.pushTest};
     node.dispatchEvent(new KeyboardEvent('keydown',{key:' ',bubbles:true}));
     const keyOn=node.dataset.frame;
     node.dispatchEvent(new KeyboardEvent('keyup',{key:' ',bubbles:true}));
     const keyOff=node.dataset.frame;
     return {id,held,released,noSourceChange,keyOn,keyOff,hit:getComputedStyle(node).pointerEvents};
    },kind);
    assert.ok(!state.error,kind+' '+state.error);
    assert.deepEqual(state.held,{frame:'ON',test:'true'},kind+' hold');
    assert.deepEqual(state.released,{frame:'OFF',test:'false'},kind+' release');
    assert.equal(state.noSourceChange,true,kind+' sensor/engine unchanged');
    assert.equal(state.keyOn,'ON',kind+' keyboard ON');
    assert.equal(state.keyOff,'OFF',kind+' keyboard OFF');
    assert.equal(state.hit,'auto',kind+' hit-test enabled');
    console.log('PUSH_TO_TEST_PASS',kind,JSON.stringify(state));
    if(kind==='main'){
     await page.waitForFunction(()=>document.querySelectorAll('.fire-lamp[data-fire-lamp]').length===11,null,{timeout:45000});
     const fire=await page.evaluate(()=>{
      const api=window.B737UnifiedFireLights,live=api.systemIndications();
      const id=Object.keys(live).find(k=>!live[k]);
      const node=id&&document.querySelector('.fire-lamp[data-fire-lamp="'+id+'"]');
      if(!node)return {error:'Unlit Fire lamp not mounted'};
      const img=node.querySelector('img'),before=JSON.stringify(live);
      node.dispatchEvent(new PointerEvent('pointerdown',{pointerId:172,button:0,pointerType:'mouse',bubbles:true}));
      const held={test:node.dataset.pushTest,src:img.dataset.source};
      const unchanged=JSON.stringify(api.systemIndications())===before;
      document.dispatchEvent(new PointerEvent('pointerup',{pointerId:172,button:0,pointerType:'mouse',bubbles:true}));
      const released={test:node.dataset.pushTest,src:img.dataset.source};
      return {id,held,released,unchanged,hit:getComputedStyle(node).pointerEvents};
     });
     assert.ok(!fire.error,fire.error);
     assert.equal(fire.held.test,'true');
     assert.ok(fire.held.src.endsWith(fire.id+'_ON.webp'),'Fire ON face during test');
     assert.equal(fire.released.test,'false');
     assert.ok(fire.released.src.endsWith(fire.id+'_OFF.webp'),'Fire restores OFF source');
     assert.equal(fire.unchanged,true,'Fire protection signals unaffected');
     assert.equal(fire.hit,'auto');
     console.log('PUSH_TO_TEST_PASS fire',JSON.stringify(fire));
    }
    const serious=errors.filter(x=>/SyntaxError|ReferenceError.*push|TypeError.*push/i.test(x));
    assert.deepEqual(serious,[],kind+' lamp runtime errors');
   }finally{await page.close();}
  }
  console.log('PUSH_TO_TEST_ALL_PASS');
 }finally{await browser.close();}
})().catch(e=>{console.error('PUSH_TO_TEST_FAILED',e.stack||String(e));process.exitCode=1});
