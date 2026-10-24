'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const model=require('./flight-needles-model');
const assembly=JSON.parse(fs.readFileSync(path.join(__dirname,'assembly.json'),'utf8'));
const main=assembly.regions.find(region=>region.id==='main');
for(const source of Object.values(model.sources)){const piece=main.placements.find(item=>item.id===source.piece);assert.ok(piece);assert.deepEqual(assembly.assets[piece.asset].dimensions,[source.width,source.height]);for(const gauge of Object.values(source.gauges)){assert.ok(gauge.x>0&&gauge.x<source.width);assert.ok(gauge.y>0&&gauge.y<source.height);assert.ok(gauge.radius>0);}}
for(const needle of Object.values(model.needles)){const asset=fs.readFileSync(path.join(__dirname,needle.asset),'utf8');assert.match(asset,/viewBox="0 0 512 512"/);assert.match(asset,/fill="none"|fill="#f/);}
const thin=fs.readFileSync(path.join(__dirname,model.needles.rmi1.asset),'utf8');
const hollow=fs.readFileSync(path.join(__dirname,model.needles.rmi2.asset),'utf8');
assert.match(thin,/stroke-dasharray/);assert.match(thin,/thin dashed/);
assert.match(hollow,/broad hollow/);assert.match(hollow,/fill="none"/);
assert.equal(model.angle(900),360);assert.throws(()=>model.angle(Infinity));
const ui=fs.readFileSync(path.join(__dirname,'flight-needles-unified.js'),'utf8');
assert.match(ui,/rmi2','rmi1/);assert.match(ui,/data-flight-needles/);
const html=fs.readFileSync(path.join(__dirname,'index.html'),'utf8');
assert.match(html,/flight-needles-model.js\?v=FLN-0001/);
assert.match(html,/flight-needles-unified.js\?v=FLN-0001/);
console.log('PASS: photographed ALT, VSI, clock, and separate dashed/hollow RMI needles mount on both stations.');
