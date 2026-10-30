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
 assert.match(html,/cdu-embed\.css\?v=CDU-TYPE-REF-0002/);
 assert.ok(html.indexOf('cdu-screen.css')<html.indexOf('cdu-embed.css'),'approved locked face policy loads before scoped typography');
 const source=read('panel-mosaic-lab/cockpit/cdu-embed.css');
 assert.match(source,/\.fmc-screen\s+\.fmc-lines\s*\{\s*font-size:2\.60cqw!important;/);
 assert.match(source,/color:#29ff31!important;/);
 assert.match(source,/\.fmc-screen\s+\.fmc-lines\s+\.fmc-line\.fmc-small\s*\{[^}]*font-size:2\.00cqw!important;/s);
 assert.match(source,/\.fmc-screen\s+\.fmc-lines\s+\.fmc-line\.scratch\s*\{[^}]*font-size:2\.30cqw!important;/s);
 assert.match(source,/\.fmc-screen\s+\.fmc-lines\s+\.fmc-line\s*\{[^}]*height:6\.8%!important;/s);
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
});
