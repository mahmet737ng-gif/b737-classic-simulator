'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const socket=require('./conventional-eadi-socket-v1.js');
const adapter=require('./fo-proportional-scale-v1.js');
const baseline=JSON.parse(fs.readFileSync(__dirname+'/eis-main-final-layout-v1.json','utf8'));
const w=socket.PHOTO.displayWidth/socket.PHOTO.sourceWidth;
const p=socket.GLASS_SOURCE,r=socket.nativeRect;
assert.equal(socket.mode,'CONVENTIONAL');
assert.equal(socket.seat,'FO');
assert.equal(socket.PHOTO.displayWidth,726);
assert.ok(Math.abs(r.x-(1374+p.x*w))<1e-8);
assert.ok(Math.abs(r.y-(127+p.y*w))<1e-8);
assert.ok(Math.abs(r.w-p.w*w)<1e-8);
assert.ok(Math.abs(r.h-p.h*w)<1e-8);
assert.ok(r.x>=1374&&r.x+r.w<=2100,'CRT inside owner photo horizontally');
assert.ok(r.y>=127&&r.y+r.h<127+726*1223/1286,'CRT inside owner photo vertically');
assert.ok(Math.abs(r.x-1631.430793157076)<.00001);
assert.ok(Math.abs(r.y-234.26283048211508)<.00001);
assert.ok(Math.abs(r.w-194.76671850699844)<.00001);
assert.ok(Math.abs(r.h-158.0715396578538)<.00001);
// Previous screenshot: FO black glass starts above and to the right of the
// 0002 overlay. This is the correction to the actual black CRT socket, not
// a cosmetic translation of the attitude card within the wrong glass.
const prev={x:1623.3992805755397,y:269.4840287769784,
 w:181.1761726618705,h:153.70307913669063};
assert.ok(r.y<prev.y-30,'FO CRT must be lifted over 30 native units');
assert.ok(r.x>prev.x+5,'FO CRT is centered farther right than the old overlay');
assert.ok(r.w>prev.w+10,'FO CRT must cover the genuine glass width');
// The generic scaling adapter must explicitly exclude only this mode's FO
// EADI, and must retain its EIS ownership and frozen EIS transform values.
const foHost={
 matches:s=>s.includes('[data-eadi-stage1-seat="FO"]'),
 getAttribute:()=>null
};
assert.equal(adapter.classification(foHost,{},'CONVENTIONAL'),null);
assert.equal(adapter.classification(foHost,{},'EIS'),'EIS');
assert.deepEqual(JSON.parse(JSON.stringify(adapter.PROFILES.EIS)),
 baseline.foEis.profile);
assert.equal(adapter.EIS_OUTER_LIFT,baseline.foEis.outerLift);
// Runtime re-registers host geometry when the profile changes, without
// replacing the original canvas, changing its aircraft-state hooks, or
// shifting Captain's EADI by any Convention-specific value.
const eadi=fs.readFileSync(__dirname+'/eadi-stage1-unified-v1.js','utf8');
assert.match(eadi,/function rectFor\(seat,mode=activeMode\(\)\)/);
assert.match(eadi,/root\.B737ConventionalEadiSocketV1/);
assert.match(eadi,/stations\[seat\]\.host\.dataset\.eadiMode!==activeMode\(\)/);
assert.match(eadi,/host\.dataset\.eadiMode=mode/);
const index=fs.readFileSync(__dirname+'/index.html','utf8');
assert.ok(index.indexOf('conventional-eadi-socket-v1.js')<
 index.indexOf('eadi-stage1-unified-v1.js'));
assert.ok(index.includes('EADI-STAGE1-0010-CONV-FO-CRT'));
assert.ok(index.includes('FO-PROPORTIONAL-SCALE-0004-CONV-CRT-ISOLATED'));
console.log('PASS: Conventional FO EADI mounted on owner CRT black glass; EIS geometry remains final and independent.');
