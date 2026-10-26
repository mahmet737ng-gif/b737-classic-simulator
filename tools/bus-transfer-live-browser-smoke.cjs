'use strict';
/* Actual same-origin Unified dialog + frame test. Approval geometry unchanged. */
const assert=require('node:assert/strict'),{chromium}=require('playwright');
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
 try{
  const page=await browser.newPage({viewport:{width:1600,height:960}});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:8788/panel-mosaic-lab/cockpit/index.html',
   {waitUntil:'domcontentloaded',timeout:60000});
  await page.waitForFunction(()=>window.B737ISNCockpitV1?.getLiveGatewayState()?.initialized===true,null,{timeout:95000});
  await page.click('#busTransferGuardReviewOpen');
  const dlg=page.locator('#busTransferGuardReviewDialog');
  await dlg.waitFor({state:'visible'});
  const frameEl=dlg.locator('iframe');
  const frame=page.frameLocator('#busTransferGuardReviewDialog iframe');
  await frame.locator('#busTransferLiveOff:not([disabled])').waitFor({timeout:25000});
  const snap=()=>page.evaluate(()=>window.B737ISNCockpitV1.getAircraftSnapshot());
  const first=await snap();assert.equal(first.electrical.schema,'B737_ELECTRICAL_V7_RESULT');
  const original=first.electrical.revision;
  // Actual open preview guard sends event, but does not assert native OH12 pixel mount.
  await frame.locator('#busTransferLiveOff').click();
  await frame.locator('#busTransferLiveOff[aria-pressed="true"]').waitFor();
  const off=await snap();
  assert.equal(off.electrical.feed.tie,false);assert.equal(off.electrical.revision,original+1);
  assert.equal(off.loads.coverage.loadsKnownBus,0);
  // Close both reference covers: must not be able to switch, even though control visible.
  await frame.locator('#busTransferGuardClose').click();
  await frame.locator('.station.opened .cover').count().then(n=>assert.equal(n,0));
  await frame.locator('#busTransferLiveAuto').click();
  assert.match(await frame.locator('#busTransferLiveStatus').innerText(),/اول گارد/);
  assert.equal((await snap()).electrical.revision,off.electrical.revision);
  // Open one physical preview cover and restore AUTO.
  await frame.locator('#busTransferGuardOpen').click();
  await frame.locator('#busTransferLiveAuto').click();
  await frame.locator('#busTransferLiveAuto[aria-pressed="true"]').waitFor();
  const auto=await snap();assert.equal(auto.electrical.feed.tie,true);
  assert.equal(auto.electrical.revision,off.electrical.revision+1);
  await frame.locator('#busTransferLiveAuto').click();
  assert.equal((await snap()).electrical.revision,auto.electrical.revision);
  const audit=await page.evaluate(()=>window.B737ISNCockpitV1.getArchitectureAudit());
  assert.ok(audit.findings.some(f=>f.id==='BUS_TRANSFER_NOT_PHYSICALLY_WIRED'),
   'True source socket still uncalibrated; preview must not count as real mounting');
  assert.equal(errors.length,0,'browser JavaScript exceptions: '+JSON.stringify(errors));
  await dlg.screenshot({path:'/tmp/b737-bus-transfer-live-proof.png',animations:'disabled'});
  console.log('PASS BUS_TRANSFER_LIVE_CHROMIUM',JSON.stringify({before:original,off:off.electrical.revision,
   auto:auto.electrical.revision,tieOff:off.electrical.feed.tie,tieAuto:auto.electrical.feed.tie,
   unmountedSourceSocket:true}));
 }finally{await browser.close();}
})().catch(e=>{console.error('FAIL BUS_TRANSFER_LIVE_CHROMIUM',e.stack||String(e));process.exitCode=1});
