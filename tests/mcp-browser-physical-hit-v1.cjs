'use strict';
/* A REAL Chromium hit-test for the public photographic MCP (not a VM mock).
 * It checks elementFromPoint after all art layers, real mouse/touch events,
 * single-detent taps, screen-speed swipes, FCOM numeric changes, dual
 * square BANK ANGLE and inner HEADING. The standalone test page receives
 * an explicit TEST-ONLY V7 powered simulator feed; nothing in Unified is
 * bypassed and the battery or CB is not modified by this test.
 */
const fs=require('node:fs'),http=require('node:http'),path=require('node:path');
const assert=require('node:assert/strict');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'..');
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css',
 '.png':'image/png','.webp':'image/webp','.svg':'image/svg+xml',
 '.json':'application/json','.b64':'text/plain','.woff2':'font/woff2'};
const server=http.createServer((req,res)=>{
 const url=new URL(req.url,'http://127.0.0.1');
 const dest=path.resolve(root,'.'+decodeURIComponent(url.pathname));
 if(dest!==root&&!dest.startsWith(root+path.sep)){
  res.writeHead(403);res.end();return;
 }
 fs.stat(dest,(err,st)=>{
  const name=st?.isDirectory()?path.join(dest,'index.html'):dest;
  if(err){res.writeHead(404);res.end('not found');return;}
  fs.readFile(name,(e,data)=>{
   if(e){res.writeHead(404);res.end('not found');return;}
   res.writeHead(200,{'content-type':mime[path.extname(name)]||'application/octet-stream'});
   res.end(data);
  });
 });
});
async function run(){
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 const context=await browser.newContext({viewport:{width:1900,height:980},deviceScaleFactor:1,
  hasTouch:true,isMobile:false});
 // Isolated standalone visual training input, NOT a real aircraft/GitHub
 // electrical feed. Unified is tested separately without this override.
 await context.addInitScript(()=>{
  const bus={generator1:true,generator2:true,transfer1:true,transfer2:true,
   main1:true,main2:true,acStandby:true,groundService:true,
   dc1:true,dc2:true,battery:true,hotBattery:true,switchedHotBattery:true,
   dcStandby:true,electronic1:true};
  window.B737ISNCockpitV1={getState:()=>({state:{electrical:{
   schema:'B737_ELECTRICAL_V7_RESULT',bus,revision:1}}})};
  window.B737UnifiedCB={available:()=>true};
 });
 const page=await context.newPage();const errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 const base='http://127.0.0.1:'+server.address().port;
 await page.goto(base+'/panel-mosaic-lab/mcp-panel/',{waitUntil:'domcontentloaded',timeout:60000});
 await page.waitForFunction(()=>window.B737McpRotaryHitSurfacesV1?.audit()?.roots===1,{timeout:30000});
 await page.locator('[data-mcp-hit="heading"]').waitFor({state:'visible'});
 const found=await page.locator('[data-mcp-hit]').evaluateAll(nodes=>nodes.map(x=>x.dataset.mcpHit));
 assert.deepEqual(found,['courseL','speed','bankAngle','heading','altitude','courseR','verticalSpeed']);
 const state=()=>page.evaluate(()=>({visual:window.B737McpVisualV3.getState(),
  bank:window.B737McpOwner13V1.getState().bankAngle,
  hits:window.B737McpRotaryHitSurfacesV1.audit().detents,
  output:window.B737McpAFDSBridgeV1.getOutput()}));
 async function click(id,x=.75,y=.50){
  const locator=page.locator('[data-mcp-hit="'+id+'"]');
  const box=await locator.boundingBox();assert.ok(box,id+' must be positioned');
  const px=box.x+box.width*x,py=box.y+box.height*y;
  const top=await page.evaluate(([x,y])=>document.elementFromPoint(x,y)?.dataset?.mcpHit||'BLOCKED',[px,py]);
  assert.equal(top,id,id+' must be the actual TOP browser hit target, not a photo/SVG');
  await page.mouse.click(px,py);
 }
 const initial=await state();
 for(const key of ['courseL','speed','heading','altitude','courseR']){
  await click(key);
  const next=await state();
  assert.ok(next.visual[key]>initial.visual[key],key+' real click must change displayed value');
 }
 const beforeBank=await state();
 await click('bankAngle',.12,.50);
 const afterBank=await state();
 assert.equal(afterBank.bank,15,'outer square left tap lowers bank limit 20->15');
 assert.equal(afterBank.visual.heading,beforeBank.visual.heading,'outer bank must NOT change inner heading');
 assert.equal(afterBank.output.bankAngleLimit,15,'outer bank setting belongs to AFDS backend');
 await click('heading',.8,.5);
 const afterInner=await state();
 assert.equal(afterInner.bank,15,'inner heading must NOT rotate outer bank');
 assert.equal(afterInner.visual.heading,afterBank.visual.heading+1);
 await click('verticalSpeed',.5,.25);
 assert.equal((await state()).visual.verticalSpeed,50,'real V/S top tap = +50fpm');
 await page.evaluate(()=>window.B737McpVisualV3.setSpeedMode('MACH'));
 const beforeMach=await state();await click('speed');
 assert.equal((await state()).visual.machHundredths,beforeMach.visual.machHundredths+1,
  'IAS/MACH C/O mode changes the speed knob to .01 Mach detents');
 await page.evaluate(()=>window.B737McpVisualV3.setSpeedMode('IAS'));
 const speed=page.locator('[data-mcp-hit="speed"]');const box=await speed.boundingBox();
 const move=async duration=>{
  await page.evaluate(()=>window.B737McpVisualV3.setValue('speed',160));
  const x=box.x+box.width*.35,y=box.y+box.height*.5;
  await page.mouse.move(x,y);
  await page.mouse.down();
  await page.mouse.move(x+45,y,{steps:duration===0?1:8});
  if(duration)await page.waitForTimeout(duration);
  await page.mouse.up();
  return (await state()).visual.speed-160;
 };
 const delta=await move(0);
 assert.ok(delta>0,'real mouse drag increases speed');
 // Synthetic touch tap using browser's touchscreen event dispatcher.
 const tbox=await page.locator('[data-mcp-hit="courseR"]').boundingBox();
 const oldCourse=(await state()).visual.courseR;
 await page.touchscreen.tap(tbox.x+tbox.width*.8,tbox.y+tbox.height*.5);
 assert.equal((await state()).visual.courseR,oldCourse+1,'real touchscreen tap rotates COURSE R');
 // End-to-end check on full Unified (no stubbed live electrical source):
 // painted hitboxes must exist and be on top at selected points.
 const unified=await browser.newContext({viewport:{width:1900,height:940},deviceScaleFactor:1});
 const live=await unified.newPage();
 live.on('pageerror',e=>errors.push('UNIFIED '+e.message));
 await live.goto(base+'/panel-mosaic-lab/cockpit/',{waitUntil:'domcontentloaded',timeout:90000});
 await live.waitForFunction(()=>window.B737McpRotaryHitSurfacesV1?.audit()?.roots>0,{timeout:50000});
 const liveQA=await live.evaluate(()=>{
  const ids=['courseL','speed','heading','bankAngle','courseR','altitude','verticalSpeed'];
  return ids.map(id=>{
   const el=document.querySelector('[data-mcp-hit="'+id+'"]');
   if(!el)return {id,present:false};
   const b=el.getBoundingClientRect();
   const x=b.left+b.width*(id==='bankAngle'?.12:.5),y=b.top+b.height*.5;
   const top=document.elementFromPoint(x,y);
   return {id,present:true,top:top?.dataset?.mcpHit??null,w:b.width,h:b.height,
    pointerEvents:getComputedStyle(el).pointerEvents,touchAction:getComputedStyle(el).touchAction};
  });
 });
 for(const v of liveQA){
  assert.equal(v.present,true,'UNIFIED '+v.id+' must exist');
  assert.equal(v.top,v.id,'UNIFIED '+v.id+' must receive real pointer, top='+v.top);
  assert.equal(v.pointerEvents,'auto');
  assert.equal(v.touchAction,'none');
 }
 console.log('MCP BROWSER HIT PASS',JSON.stringify({initial:initial.visual,final:(await state()).visual,
  outerBank:(await state()).bank,unified:liveQA,
  pageErrors:errors.slice(0,12)}));
 await unified.close();await context.close();await browser.close();
}
run().catch(e=>{console.error('MCP REAL CHROMIUM HIT FAILURE',e);process.exitCode=1})
 .finally(()=>{server.close();});
