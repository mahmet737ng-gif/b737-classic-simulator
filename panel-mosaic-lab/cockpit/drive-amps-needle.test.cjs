'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const model=require('./drive-amps-needle-model');
const atlas=JSON.parse(fs.readFileSync(path.join(__dirname,'../all-overhead/atlas-layout.json'),'utf8'));
assert.equal(model.needles.length,5);
assert.deepEqual(model.needles.map(n=>n.piece),['OH11','OH11','OH12','OH12','OH12']);
assert.equal(new Set(model.needles.map(n=>n.id)).size,5);
assert.equal(model.needles[4].id,'apuAcAmps');
assert.equal(model.needles[4].window,'OH12_APU');
// Immutable source image QA rejected 128/135px oversized and 64px undersized pointers; near-original radii touch inner 0 ticks.
for(const needle of model.needles.slice(0,2)){assert.equal(needle.tipRadius,98);assert.equal(needle.initialAngle,-46);}
for(const needle of model.needles.slice(2,4)){assert.equal(needle.tipRadius,125);assert.equal(needle.initialAngle,model.bearingForAmps(needle.id,0));}
assert.equal(model.needles[4].tipRadius,124);assert.equal(model.needles[4].initialAngle,-74);
assert.deepEqual(model.apuAmpPhotoAngles,[-74,-37,0,37,74]);
for(const [amps,angle] of [[0,-74],[50,-37],[100,0],[150,37],[200,74]])
 assert.equal(model.bearingForApuAmps(amps),angle);
assert.equal(model.bearingForApuAmps(-1),-74);
assert.equal(model.bearingForApuAmps(201),74);
assert.throws(()=>model.bearingForApuAmps(NaN));
assert.equal(model.needles[3].x,753.481,'A.C. AMPS 2 centre must be re-derived from 21 radial printed strokes, not the bezel');

for(const [name,source]of Object.entries(model.panels)){
 const piece=atlas.placements.find(p=>p.id===name);assert.ok(piece,name);
 assert.deepEqual(piece.sourceDimensions,[source.width,source.height]);
 for(const needle of model.needles.filter(n=>n.piece===name)){
  const p=model.placement(piece,needle);
  assert.ok(p.x>piece.x&&p.x<piece.x+piece.w);
  assert.ok(p.y>piece.y&&p.y<piece.y+piece.h);
  assert.ok(p.size>90&&p.size<150,'Measured source stroke tip clearance, not arbitrary glyph radius');
  const window=model.windowPath(needle);
  assert.match(window,/^M \d+ \d+ L \d+ \d+ /);
  assert.match(window,/ Z$/);
 }
}
assert.equal(model.angle(-500),-90);assert.equal(model.angle(500),90);assert.throws(()=>model.angle(NaN));
const asset=fs.readFileSync(path.join(__dirname,'drive-amps-needle.svg'),'utf8');
assert.equal((asset.match(/<path /g)||[]).length,2);
assert.doesNotMatch(asset,/<circle|<text|<image/,'The shared file must contain only a transparent blade');
const ui=fs.readFileSync(path.join(__dirname,'drive-amps-needle-unified.js'),'utf8');
assert.ok(ui.includes('for(const needle of model.needles)'));
assert.ok(ui.includes('model.windowPath(needle)'),'Blade must stop at the traced half-round boundary');
assert.ok(ui.includes("new URL('./drive-amps-needle.svg?v=DAN-0001'"));
assert.ok(ui.includes('window.B737UnifiedDriveAmpsNeedles'));
assert.ok(ui.includes('model.bearingForAmps(id,amps)'));
assert.ok(ui.includes("min:calibrated?'0':'-90'"));
assert.ok(ui.includes("max:calibrated?'200':'90'"));
const html=fs.readFileSync(path.join(__dirname,'index.html'),'utf8');
assert.ok(html.includes('drive-amps-needle-model.js?v=DAN-APU-ZERO-0007'));
assert.ok(html.includes('drive-amps-needle-unified.js?v=DAN-APU-ZERO-0007'));
console.log('PASS: one shared white needle on both OH11 drive gauges, two upper OH12 A.C. amps gauges and APU A.C. amps.');
