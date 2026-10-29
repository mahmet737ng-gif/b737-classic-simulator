'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const svg=fs.readFileSync(path.join(root,'panel-mosaic-lab/cockpit/assets/air-mix-valve-300500-reference-needle-v2.svg'),'utf8');
const finalSvg=fs.readFileSync(path.join(root,'panel-mosaic-lab/cockpit/assets/air-mix-valve-300500-needle-v1.svg'),'utf8');
const renderer=fs.readFileSync(path.join(root,'panel-mosaic-lab/cockpit/air-mix-valve-300500-unified-v1.js'),'utf8');
const html=fs.readFileSync(path.join(root,'panel-mosaic-lab/cockpit/index.html'),'utf8');
const model=require('../engine/systems/air-mix-valve-300500-v1.js');

test('owner-approved photo-derived pointer is a single broad, transparent white pointer with fixed shaft',()=>{
 assert.match(svg,/viewBox="0 0 256 256"/);
 assert.match(svg,/M 128 56 C 125 56 124 59/);
 assert.match(svg,/fill="url\(#white\)"/);
 assert.equal((svg.match(/<path\b/g)||[]).length,2,'one shadow + one white needle, never two different needles');
 assert.ok(!svg.includes('<rect'),'asset must have transparent dial background');
 assert.ok(!svg.includes('<circle'),'asset must not add a second pivot');
});

test('final metal pointer replaces reference only at runtime; archived white pointer remains unchanged',()=>{
 assert.match(finalSvg,/viewBox="0 0 256 256"/);
 assert.match(finalSvg,/fill="url\(#metal\)"/);
 assert.match(finalSvg,/<circle cx="128" cy="128"/);
 assert.ok(!finalSvg.includes('fill="url(#white)"'));
});

test('each OH20 gauge receives one calibrated moving image; baked photo needles remain masked',()=>{
 assert.match(renderer,/air-mix-valve-300500-needle-v1\.svg\?v=AIR-MIX-300500-FINAL-0001/);
 assert.match(renderer,/for\(const side of model\.SIDES\)/);
 assert.match(renderer,/concealPhotoNeedle\(doc,photographMask,side\)/);
 assert.match(renderer,/transform:'translate\(-2 2\)'/);
 assert.match(renderer,/data-air-mix-concealed-photo-needle/);
 assert.equal((renderer.match(/createSvg\(doc,rotary,'image'/g)||[]).length,1);
 assert.match(renderer,/pointerEvents:'none'/);
 assert.match(renderer,/preserveAspectRatio:'none'/);
 assert.ok(!renderer.includes('air-mix-valve-300500-reference-needle-v2.svg'),'archived broad reference must not override approved final metal pointer');
});

test('final 128-degree COLD/HOT sweep and independent physics',()=>{
 assert.deepEqual(model.SIDES,['CONT','PASS']);
 assert.deepEqual([model.angle(0),model.angle(0.5),model.angle(1)],[-64,0,64]);
 assert.deepEqual([model.GAUGES.CONT.x,model.GAUGES.CONT.y,model.GAUGES.PASS.x,model.GAUGES.PASS.y],[226,423,1023,423]);
 assert.equal(model.CONFIG.benchFullTravelSeconds,10);
 const inputs={CONT:{selector:'MANUAL COOL',packMode:'AUTO',actuatorPower:true,indicatorPower:true},PASS:{selector:'MANUAL WARM',packMode:'AUTO',actuatorPower:true,indicatorPower:true}};
 const after=model.step(model.create(),inputs,90);
 assert.deepEqual([after.positions.CONT,after.positions.PASS],[0,1]);
 assert.match(html,/air-mix-valve-300500-unified-v1\.js\?v=AIR-MIX-300500-FINAL-0001/);
});
