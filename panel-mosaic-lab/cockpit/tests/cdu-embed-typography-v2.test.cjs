'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'../../..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
test('Unified dual-CDU embed uses approved v2 typography and refreshed cache key',()=>{
 const html=read('panel-mosaic-lab/cockpit/cdu-stage.html');
 assert.match(html,/cdu-screen\.css/);
 assert.match(html,/cdu-embed\.css\?v=CDU-TYPE-REF-0003/);
 assert.ok(html.indexOf('cdu-screen.css')<html.indexOf('cdu-embed.css'),'approved locked face policy loads before scoped typography');
 const source=read('panel-mosaic-lab/cockpit/cdu-embed.css');
 assert.match(source,/\.fmc-screen\s+\.fmc-lines\s*\{\s*font-size:34px!important;/);
 assert.match(source,/color:#29ff31!important;/);
 assert.match(source,/\.fmc-screen\s+\.fmc-lines\s+\.fmc-line\.fmc-small\s*\{[^}]*font-size:26px!important;/s);
 assert.match(source,/\.fmc-screen\s+\.fmc-lines\s+\.fmc-line\.scratch\s*\{[^}]*font-size:29px!important;/s);
 assert.match(source,/\.fmc-screen\s+\.fmc-lines\s+\.fmc-line\s*\{[^}]*height:7\.4%!important;/s);
});
test('Source asset, keypad locations, and fonts remain outside scope of typography patch',()=>{
 const source=read('panel-mosaic-lab/cockpit/cdu-embed.css');
 assert.doesNotMatch(source,/@font-face|\.hotspot|#clickmap|\.bbox_px/i);
 assert.doesNotMatch(source,/font-family\s*:/i);
 const locked=read('assets/fonts/boeing-cdu/cdu-screen.css');
 assert.match(locked,/BoeingCDULarge/);
 assert.match(locked,/BoeingCDUSmall/);
 const html=read('panel-mosaic-lab/cockpit/cdu-stage.html');
 assert.match(html,/assets\/cdu-approved-unlit\.png/);
 const manifest=JSON.parse(read('panel-mosaic-lab/cockpit/assembly.json'));
 const cdus=manifest.embeddedInstruments;
 assert.equal(cdus.length,2);
 for(const seat of ['CAPT','FO']){
  const item=cdus.find(x=>x.seat===seat);
  assert.ok(item,'missing '+seat+' CDU');
  assert.match(item.embeddedUrl,/TYPE-REF-0003$/);
  assert.equal(item.nativeWidth,1199);
  assert.equal(item.nativeHeight,1312);
 }

});

test('Inline typography fallback and computed-style reports are mounted for both CDUs',()=>{
 const html=read('panel-mosaic-lab/cockpit/cdu-stage.html');
 assert.match(html,/id="unified-cdu-font-profile-v3"/);
 assert.match(html,/#cdu-stage \.fmc-screen #fmc-lines\s*\{[^}]*font-size:34px!important;/s);
 assert.match(html,/cdu-font-diagnostics-v3\.js\?v=CDU-TYPE-REF-0003/);
 const js=read('panel-mosaic-lab/cockpit/cdu-font-diagnostics-v3.js');
 assert.match(js,/getComputedStyle/);
 assert.match(js,/kind:'typography'/);
 const parent=read('panel-mosaic-lab/cockpit/app.js');
 assert.match(parent,/d\.kind==='typography'/);
 assert.match(parent,/s\.typography\.fontPx/);
});