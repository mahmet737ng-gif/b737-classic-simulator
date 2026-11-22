'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const G=require('../panel-mosaic-lab/cockpit/hydraulic-brake-gauge-main-v1.js');
test('Frontal brake source has 0 to 4 thousand PSI detents at FO gauge pivot',()=>{
 assert.deepEqual(G.DETENTS.map(x=>x.psi),[0,1000,2000,3000,4000]);
 assert.deepEqual(G.DETENTS.map(x=>x.angle),[110,180,269,358,425]);
 assert.equal(G.CAL.cx,473);assert.equal(G.CAL.cy,568);
 assert.equal(G.CAL.width,918);assert.equal(G.CAL.height,1713);
 assert.equal(G.angle(null),null);
 for(let p=0;p<=4000;p+=25)assert.ok(Number.isFinite(G.angle(p)));
});
test('FO photo untouched, live indicator reads OH17 accumulator and brake actions',()=>{
 const f=path.join(__dirname,'../panel-mosaic-lab/cockpit');
 const s=fs.readFileSync(path.join(f,'hydraulic-brake-gauge-main-v1.js'),'utf8');
 const html=fs.readFileSync(path.join(f,'index.html'),'utf8');
 assert.ok(html.includes('hydraulic-brake-gauge-main-v1.js'));
 assert.ok(s.includes('data-piece="fo-inner"'));
 assert.ok(s.includes("output?.indications?.['fo.hyd_brake_pressure']"));
 assert.ok(s.includes("core.command({type:'BRAKE',count})"));
});
