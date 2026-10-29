'use strict';
const test=require('node:test'), assert=require('node:assert/strict'), fs=require('node:fs'), path=require('node:path');
const root=path.join(__dirname,'..');
const asset=fs.readFileSync(path.join(root,'panel-mosaic-lab/cockpit/assets/aircon-300500-owner-approved-round-knob-v3.webp'));
const js=fs.readFileSync(path.join(root,'panel-mosaic-lab/cockpit/aircon-300500-slim-knob-unified-v1.js'),'utf8');
const index=fs.readFileSync(path.join(root,'panel-mosaic-lab/cockpit/index.html'),'utf8');
test('Approved slim rotary image is a standalone valid RIFF WebP, not an SVG wrapper',()=>{
 assert.equal(asset.toString('ascii',0,4),'RIFF');
 assert.equal(asset.toString('ascii',8,12),'WEBP');
 assert.equal(asset.readUInt32LE(4)+8,asset.length);
 assert.ok(asset.length>1000);
});
test('Two independent existing 300/500 control sockets receive image, preserving rotation',()=>{
 assert.match(js,/const ids=\['control-cabin-temp','pass-cabin-temp'\]/);
 assert.match(js,/aircon-300500-owner-approved-round-knob-v3\.webp/);
 assert.match(js,/transform-origin','50% 50%'/);
 assert.match(js,/const imageW=w,imageH=imageW/,'reference-sized dial knob must hide center hole');
 assert.ok(!js.includes('style.setProperty(\'transform\''),'Do not override engine rotation');
 assert.ok(!js.includes('createElement(\'button\''),'Must reuse physical controls');
});
test('Unified loads cache-busted fix without editing locked overhead',()=>{
 assert.match(index,/aircon-300500-slim-knob-unified-v1\.js\?v=AIRCON-300500-ROUND-0004/);
});
