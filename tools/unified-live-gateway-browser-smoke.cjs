'use strict';
/* Real Chromium smoke: two physical-event postMessages from the actual nested
 * overhead iframe are delivered to the live Unified Gateway.
 * Does not alter or click approved cockpit artwork.
 */
const assert=require('node:assert/strict');
const {chromium}=require('playwright');
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
 try{
  const page=await browser.newPage({viewport:{width:1600,height:900},deviceScaleFactor:1});
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.goto('http://127.0.0.1:8788/panel-mosaic-lab/cockpit/index.html',
   {waitUntil:'domcontentloaded',timeout:60000});
  await page.waitForFunction(()=>Boolean(window.B737ISNCockpitV1?.getLiveGatewayState()?.initialized),
   null,{timeout:100000});
  const initial=await page.evaluate(()=>({
   gateway:window.B737ISNCockpitV1.getLiveGatewayState(),
   snapshot:window.B737ISNCockpitV1.getAircraftSnapshot(),
   audit:window.B737ISNCockpitV1.getArchitectureAudit()
  }));
  assert.equal(initial.gateway.singleElectricalOwner,true);
  assert.equal(initial.snapshot.electrical.schema,'B737_ELECTRICAL_V7_RESULT');
  assert.equal(initial.snapshot.singleElectricalOwner,true);
  assert.ok(initial.audit.findings.some(x=>x.id==='BUS_TRANSFER_NOT_PHYSICALLY_WIRED'),
   'The real physical BUS TRANSFER gap must not be concealed');
  const frameElement=await page.$('#overheadFrame');assert.ok(frameElement,'real embedded overhead iframe');
  const frame=await frameElement.contentFrame();assert.ok(frame,'overhead frame loaded');
  async function command(value){
   await frame.evaluate(next=>window.parent.postMessage({
    type:'b737:cockpit-overhead',kind:'control-event',
    event:{id:'battery-master',kind:'guarded',next:{value:next,guard:'open'}}
   },window.location.origin),value);
   await page.waitForFunction(next=>{
    const app=window.B737ISNCockpitV1;
    return app?.getAircraftSnapshot()?.electrical?.bus?.switchedHotBattery===(next==='on');
   },value,{timeout:12000});
  }
  const before=await page.evaluate(()=>window.B737ISNCockpitV1.getAircraftSnapshot().electrical.revision);
  await command('off');
  const afterOff=await page.evaluate(()=>window.B737ISNCockpitV1.getAircraftSnapshot().electrical.revision);
  await command('on');
  const afterOn=await page.evaluate(()=>window.B737ISNCockpitV1.getAircraftSnapshot().electrical.revision);
  assert.equal(afterOn,afterOff+1,'one electrical writer per new Battery ON detent');
  await command('on');
  const afterDup=await page.evaluate(()=>window.B737ISNCockpitV1.getAircraftSnapshot().electrical.revision);
  assert.equal(afterDup,afterOn,'no duplicate Battery ON on replayed iframe event');
  assert.ok(afterOff>=before,'power was not set by a fabricated source');
  assert.ok(!errors.some(x=>/B737UnifiedLiveGatewayV1|Cannot read|isn-cockpit\.js|ReferenceError/.test(x)),
   'Fatal Unified integration browser error(s): '+JSON.stringify(errors));
  await page.screenshot({path:'/tmp/b737-unified-live-gateway-proof.png',animations:'disabled'});
  console.log('PASS REAL_CHROMIUM_UNIFIED_LIVE_GATEWAY',JSON.stringify({
   electricalRevisionBefore:before,afterOff,afterOn,afterDuplicate:afterDup,
   sharedOwner:initial.gateway.singleElectricalOwner,
   physicalBusTransferStillUnwired:true,warningCount:errors.length
  }));
 }finally{await browser.close();}
})().catch(e=>{console.error('FAIL REAL_CHROMIUM_UNIFIED_LIVE_GATEWAY',e.stack||String(e));process.exitCode=1});
