'use strict';
const assert=require('node:assert/strict'),path=require('node:path'),fs=require('node:fs');
const {chromium}=require('playwright');
const out='/tmp/b737-owner13';fs.mkdirSync(out,{recursive:true});
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
 try{
  const page=await browser.newPage({viewport:{width:1900,height:1000},deviceScaleFactor:1});
  const errors=[];const consoleErrors=[];page.on('pageerror',e=>errors.push(e.message));page.on("console",m=>{if(["error","warning"].includes(m.type()))consoleErrors.push(m.text())});page.on("requestfailed",req=>consoleErrors.push(req.url()+" "+req.failure()?.errorText));
  const u='http://127.0.0.1:8788/panel-mosaic-lab/mcp-panel/';
  assert.equal((await page.goto(u,{waitUntil:'domcontentloaded',timeout:60000})).status(),200);
  try{await page.waitForFunction(()=>window.B737McpOwner13V1?.getState().loaded===true&&
    document.querySelector('[data-piece="mcp"].mcp-owner13-active'),null,{timeout:12000});}
  catch(e){
   const diagnostic=await page.evaluate(()=>({
    ready:document.readyState,owner:window.B737McpOwner13V1?.getState?.(),
    hardware:!!window.B737McpHardwareV1,visual:!!window.B737McpVisualV3,
    stageCount:document.querySelectorAll('[data-piece="mcp"]').length,
    knobs:document.querySelectorAll('[data-piece="mcp"] .mcp-v3-knob').length,
    hardwareCount:document.querySelectorAll('[data-piece="mcp"] .mcp-hw').length,
    refs:performance.getEntriesByType('resource').filter(x=>x.name.includes('owner13')).map(x=>({url:x.name,status:x.responseStatus}))
   }));
   console.log('OWNER13_BROWSER_DIAGNOSTIC',JSON.stringify({diagnostic,errors,consoleErrors}));
   throw e;
  }
  const v=await page.evaluate(()=>{
   const root=document.querySelector('[data-piece="mcp"]');
   return {report:window.B737McpOwner13V1.audit(),
    count:root.querySelectorAll('.mcp-owner13-art').length,
    hardware:[...root.querySelectorAll('[data-mcp-hardware]')].map(x=>x.dataset.mcpHardware),
    canvas:root.getBoundingClientRect().toJSON()};
  });
  assert.equal(v.report.atlasLoaded,true);
  for(const row of v.report.report){assert.equal(row.status,'DOM_CENTER_PASS',JSON.stringify(row));assert.ok(row.centerErrorPx<=0.1);}
  assert.equal(v.report.report.length,24);
  assert.ok(v.count>=24,'native visual components missing');
  assert.equal(errors.length,0,errors.join('\n'));
  await page.locator('[data-piece="mcp"]').screenshot({path:path.join(out,'mcp-owner13-before.png'),animations:'disabled'});
  for(const pair of [['AT_ARM','ARM'],['FD_LEFT','ON'],['FD_RIGHT','ON']]){
   await page.evaluate(([id,state])=>window.B737McpHardwareV1.setState(id,state),pair);
  }
  const states=await page.evaluate(()=>{
   const root=document.querySelector('[data-piece="mcp"]');
   return Object.fromEntries(['AT_ARM','FD_LEFT','FD_RIGHT'].map(id=>[id,{
     state:root.querySelector('[data-mcp-hardware="'+id+'"]').dataset.state,
     image:root.querySelector('[data-mcp-hardware="'+id+'"]>.mcp-owner13-art').dataset.ownerAssetIndex
   }]));
  });
  assert.equal(states.AT_ARM.image,'3');assert.equal(states.FD_LEFT.image,'9');assert.equal(states.FD_RIGHT.image,'9');
  // Both pushbutton states must use the owner's two original black switch files.
  await page.evaluate(()=>window.B737McpVisualV3.setLamp("VNAV",true));
  const modes=await page.evaluate(()=>{
   const root=document.querySelector('[data-piece="mcp"]');
   const on=root.querySelector('[data-owner13-push="VNAV"]').dataset.ownerAssetIndex;
   const off=root.querySelector('[data-owner13-push="LNAV"]').dataset.ownerAssetIndex;
   return {on,off};
  });
  assert.deepEqual(modes,{on:"5",off:"6"});
  await page.locator('[data-piece="mcp"]').screenshot({path:path.join(out,'mcp-owner13-armed.png'),animations:'disabled'});
  fs.writeFileSync(path.join(out,'audit.json'),JSON.stringify({report:v.report,states,errors},null,2));
  console.log('MCP_OWNER13_BROWSER_PASS',JSON.stringify({controls:v.report.report.length,pixelDomTolerance:0.1,
   visualHoleCenterValidation:'UNVERIFIED',sourcePhotoPreviewResolution:[192,192],photographicModeButtons:13}));
  await page.close();
 }finally{await browser.close();}
})().catch(e=>{console.error(e.stack||String(e));process.exitCode=1;});
