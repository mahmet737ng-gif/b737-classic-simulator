'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'../../..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');

test('Both mounted CDU iframes use the measured 24-column Boeing font grid',()=>{
 const html=read('panel-mosaic-lab/cockpit/cdu-stage.html');
 assert.match(html,/cdu-screen\.css/);
 assert.match(html,/cdu-embed\.css\?v=CDU-24COL-0006/);
 assert.match(html,/engine\/ch11\/cdu-24-column-metrics-v1\.js\?v=CDU-24COL-0006/);
 assert.match(html,/cdu-screen-fit-v6\.js\?v=CDU-24COL-0006/);
 assert.match(html,/cdu-font-diagnostics-v6\.js\?v=CDU-24COL-0006/);
 assert.ok(html.indexOf('cdu-screen.css')<html.indexOf('cdu-embed.css'));
 assert.ok(html.indexOf('cdu-24-column-metrics-v1.js')<html.indexOf('cdu-screen-fit-v6.js'));
 assert.match(html,/id="unified-cdu-24col-profile-v6"/);
 const manifest=JSON.parse(read('panel-mosaic-lab/cockpit/assembly.json'));
 const instruments=manifest.embeddedInstruments;
 assert.equal(instruments.length,2);
 for(const seat of ['CAPT','FO']){
  const item=instruments.find(i=>i.seat===seat);
  assert.ok(item);
  assert.match(item.embeddedUrl,new RegExp('seat='+seat+'.*24COL-0006-DEPARR-FCOM-114032-0001-CH11-COMPOSITOR-0001));
  assert.equal(item.nativeWidth,1199);
  assert.equal(item.nativeHeight,1312);
 }
});
test('Font family and color stay approved, but pixel size comes from a real 24-A width test',()=>{
 const css=read('panel-mosaic-lab/cockpit/cdu-embed.css');
 assert.match(css,/color:#29ff31!important/);
 assert.doesNotMatch(css,/@font-face|\.hotspot|#clickmap|\.bbox_px/i);
 const policy=read('assets/fonts/boeing-cdu/cdu-screen.css');
 assert.match(policy,/BoeingCDULarge/);
 assert.match(policy,/BoeingCDUSmall/);
 const metrics=read('engine/ch11/cdu-24-column-metrics-v1.js');
 assert.match(metrics,/COLUMNS=24/);
 assert.match(metrics,/TOO_LONG=TEST\+'A'/);
 assert.match(metrics,/width25>available/);
 const runtime=read('panel-mosaic-lab/cockpit/cdu-screen-fit-v6.js');
 assert.match(runtime,/Metrics\.calibrate\(ctx,available,family\)/);
 assert.match(runtime,/\.fmc-left\.full/);
 assert.match(runtime,/root\.document\.fonts\.ready/);
 const proof=read('panel-mosaic-lab/cockpit/cdu-font-diagnostics-v6.js');
 assert.match(proof,/width24Px<=expected\.availablePx/);
 assert.match(proof,/width25Px>expected\.availablePx/);
});
test('Unified host reports 24/25 widths without changing aircraft instruments',()=>{
 const app=read('panel-mosaic-lab/cockpit/app.js');
 const page=read('panel-mosaic-lab/cockpit/index.html');
 assert.match(app,/d\.version==='CDU-24COL-0006'/);
 assert.match(app,/width24Px:d\.width24Px/);
 assert.match(app,/width25Px:d\.width25Px/);
 assert.match(page,/app\.js\?v=[^"]*CDU-24COL-0006/);
 const stage=read('panel-mosaic-lab/cockpit/cdu-stage.html');
 assert.match(stage,/assets\/cdu-approved-unlit\.png/);
 assert.match(stage,/id="clickmap"/);
});
));
  assert.equal(item.nativeWidth,1199);
  assert.equal(item.nativeHeight,1312);
 }
});
test('Font family and color stay approved, but pixel size comes from a real 24-A width test',()=>{
 const css=read('panel-mosaic-lab/cockpit/cdu-embed.css');
 assert.match(css,/color:#29ff31!important/);
 assert.doesNotMatch(css,/@font-face|\.hotspot|#clickmap|\.bbox_px/i);
 const policy=read('assets/fonts/boeing-cdu/cdu-screen.css');
 assert.match(policy,/BoeingCDULarge/);
 assert.match(policy,/BoeingCDUSmall/);
 const metrics=read('engine/ch11/cdu-24-column-metrics-v1.js');
 assert.match(metrics,/COLUMNS=24/);
 assert.match(metrics,/TOO_LONG=TEST\+'A'/);
 assert.match(metrics,/width25>available/);
 const runtime=read('panel-mosaic-lab/cockpit/cdu-screen-fit-v6.js');
 assert.match(runtime,/Metrics\.calibrate\(ctx,available,family\)/);
 assert.match(runtime,/\.fmc-left\.full/);
 assert.match(runtime,/root\.document\.fonts\.ready/);
 const proof=read('panel-mosaic-lab/cockpit/cdu-font-diagnostics-v6.js');
 assert.match(proof,/width24Px<=expected\.availablePx/);
 assert.match(proof,/width25Px>expected\.availablePx/);
});
test('Unified host reports 24/25 widths without changing aircraft instruments',()=>{
 const app=read('panel-mosaic-lab/cockpit/app.js');
 const page=read('panel-mosaic-lab/cockpit/index.html');
 assert.match(app,/d\.version==='CDU-24COL-0006'/);
 assert.match(app,/width24Px:d\.width24Px/);
 assert.match(app,/width25Px:d\.width25Px/);
 assert.match(page,/app\.js\?v=[^"]*CDU-24COL-0006/);
 const stage=read('panel-mosaic-lab/cockpit/cdu-stage.html');
 assert.match(stage,/assets\/cdu-approved-unlit\.png/);
 assert.match(stage,/id="clickmap"/);
});
