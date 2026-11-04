'use strict';
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const script=fs.readFileSync('panel-mosaic-lab/cockpit/performance/lossless-integrator.js','utf8');
function run(opt) {
 const asset={width:100,height:200,sourceBytes:1000,sourceSha256:'a'.repeat(64),levels:[{extent:384,url:'preview.webp'},{extent:2000,url:'panel.png',original:true}]};
 const context={globalThis:{B737PerformanceAssets:{images:{'panel.png':asset}},B737LosslessAssets:{images:{'panel.png':opt}}}};
 vm.runInNewContext(script,context);
 return asset.levels.at(-1);
}
const valid={url:'panel-mosaic-lab/cockpit/performance/lossless/abcdef-exact.webp',sourceSha256:'a'.repeat(64),width:100,height:200,bytes:600,sha256:'b'.repeat(64),pixelIdentical:true};
assert.equal(run(valid).url,valid.url);
assert.equal(run({...valid,pixelIdentical:false}).url,'panel.png');
assert.equal(run({...valid,sourceSha256:'mismatch'}).url,'panel.png');
assert.equal(run({...valid,width:99}).url,'panel.png');
assert.equal(run({...valid,bytes:1001}).url,'panel.png');
console.log('PASS: full-resolution lossless overrides only; original sources preserved');
