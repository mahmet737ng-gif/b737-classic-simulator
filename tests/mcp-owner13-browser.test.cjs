'use strict';
const assert=require('node:assert/strict'),path=require('node:path'),fs=require('node:fs');
const {chromium}=require('playwright');
const out='/tmp/b737-owner13';fs.mkdirSync(out,{recursive:true});
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
 try{
  const page=await browser.newPage({viewport:{width:1900,height:1000},deviceScaleFactor:1});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  const u='http://127.0.0.1:8788/panel-mosaic-lab/mcp-panel/';
  assert.equal((await page.goto(u,{waitUntil:'domcontentloaded',timeout:60000})).status(),200);
  await page.waitForFunction(()=>window.B737McpOwner13V1?.getState().loaded===true&&
    document.querySelector('[data-piece="mcp"].mcp-owner13-active'),null,{timeout:60000});
  const v=await page.evaluate(()=>{
   const root=document.querySelector('[data-piece="mcp"]');
   return {report:window.B737McpOwner13V1.audit(),
    count:root.querySelectorAll('.mcp-owner13-art').length,
    hardware:[...root.querySelectorAll('[data-mcp-hardware]')].map(x=>x.dataset.mcpHardware),
    canvas:root.getBoundingClientRect().toJSON()};
  });
  assert.equal(v.report.atlasLoaded,true);
  for(const row of v.report.report){assert.equal(row.status,'DOM_CENTER_PASS',JSON.stringify(row));assert.ok(row.centerErrorPx<=0.1);}
  assert.equal(v.report.report.length,11);
  assert.ok(v.count>=11,'native visual components missing');
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
  await page.locator('[data-piece="mcp"]').screenshot({path:path.join(out,'mcp-owner13-armed.png'),animations:'disabled'});
  fs.writeFileSync(path.join(out,'audit.json'),JSON.stringify({report:v.report,states,errors},null,2));
  console.log('MCP_OWNER13_BROWSER_PASS',JSON.stringify({controls:v.report.report.length,pixelDomTolerance:0.1,
   visualHoleCenterValidation:'UNVERIFIED',sourcePhotoPreviewResolution:[192,192]}));
  await page.close();
 }finally{await browser.close();}
})().catch(e=>{console.error(e.stack||String(e));process.exitCode=1;});
