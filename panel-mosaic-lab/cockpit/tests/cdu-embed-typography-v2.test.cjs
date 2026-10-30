'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'../../..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
test('Unified dual-CDU embed uses large v4 typography and refreshed cache key',()=>{
 const html=read('panel-mosaic-lab/cockpit/cdu-stage.html');
 assert.match(html,/cdu-screen\.css/);
 assert.match(html,/cdu-embed\.css\?v=CDU-SCREEN-FIT-0004/);
 assert.ok(html.indexOf('cdu-screen.css')<html.indexOf('cdu-embed.css'),'approved locked face policy loads before scoped typography');
 const source=read('panel-mosaic-lab/cockpit/cdu-embed.css');
 assert.match(source,/\.fmc-screen\s+\.fmc-lines\s*\{\s*font-size:54px!important;/);
 assert.match(source,/color:#29ff31!important;/);
 assert.match(source,/\.fmc-screen\s+\.fmc-lines\s+\.fmc-line\.fmc-small\s*\{[^}]*font-size:39px!important;/s);
 assert.match(source,/\.fmc-screen\s+\.fmc-lines\s+\.fmc-line\.scratch\s*\{[^}]*font-size:42px!important;/s);
 assert.match(source,/\.fmc-screen\s+\.fmc-lines\s+\.fmc-line\s*\{[^}]*height:11\.0%!important;/s);
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
  assert.match(item.embeddedUrl,/SCREEN-FIT-0004$/);
  assert.equal(item.nativeWidth,1199);
  assert.equal(item.nativeHeight,1312);
 }

});

test('Inline typography fallback and computed-style reports are mounted for both CDUs',()=>{
 const html=read('panel-mosaic-lab/cockpit/cdu-stage.html');
 assert.match(html,/id="unified-cdu-font-profile-v4"/);
 assert.match(html,/#cdu-stage \.fmc-screen #fmc-lines\s*\{[^}]*font-size:54px!important;/s);
 assert.match(html,/cdu-font-diagnostics-v4\.js\?v=CDU-SCREEN-FIT-0004/);
 const js=read('panel-mosaic-lab/cockpit/cdu-font-diagnostics-v4.js');
 assert.match(js,/getComputedStyle/);
 assert.match(js,/kind:'typography'/);
 const parent=read('panel-mosaic-lab/cockpit/app.js');
 assert.match(parent,/d\.kind==='typography'/);
 assert.match(parent,/s\.typography\.nativePx/);
});
test('Live per-frame typography reflows only the screen, not overlaid reference geometry',()=>{
 const html=read('panel-mosaic-lab/cockpit/cdu-stage.html');
 assert.match(html,/cdu-screen-fit-v4\.js\?v=CDU-SCREEN-FIT-0004/);
 assert.match(html,/cdu-font-diagnostics-v4\.js\?v=CDU-SCREEN-FIT-0004/);
 const script=read('panel-mosaic-lab/cockpit/cdu-screen-fit-v4.js');
 assert.match(script,/MutationObserver/);
 assert.match(script,/FONT=Object\.freeze\(\{header:54,label:39,value:54,scratch:42\}\)/);
 assert.match(script,/if\(standard\)line\.style\.setProperty\('top'/);
 assert.match(script,/span\.style\.removeProperty\('font-size'\)/);
 assert.doesNotMatch(script,/(?:setAttribute|removeChild|replaceChildren)\s*\(/);
 const report=read('panel-mosaic-lab/cockpit/cdu-font-diagnostics-v4.js');
 assert.match(report,/getComputedStyle/);
 assert.match(report,/nativePx>=53\.5/);
 const parent=read('panel-mosaic-lab/cockpit/index.html');
 assert.match(parent,/app\.js\?v=[^"]*CDU-SCREEN-FIT-0004/);
});
