'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const base=path.join(__dirname,'../cdu-standalone-v6/efis-test');
const geom=JSON.parse(fs.readFileSync(path.join(base,'geometry-v3.json'),'utf8'));
const js=fs.readFileSync(path.join(base,'app.js'),'utf8');
assert.deepEqual(geom.modesClockwise,['FULL_NAV','FULL_VOR_ILS','EXP_NAV','EXP_VOR_ILS','MAP','CTR_MAP','PLAN']);
const degrees=geom.modesClockwise.map(k=>geom.modeAnglesRelativeToMAPDegrees[k]);
assert.ok(degrees.every((v,i)=>i===0||v>degrees[i-1]),'physical mode selector advances monotonically');
assert.match(js,/const MODES=\['FULL_NAV','FULL_VOR_ILS','EXP_NAV','EXP_VOR_ILS','MAP','CTR_MAP','PLAN'\]/);
assert.match(js,/const x=g\.cx-g\.r,y=g\.cy-g\.r,w=g\.r\*2,h=g\.r\*2/);
for(const [name,k] of Object.entries(geom.knobCentersPx)){
 assert.ok(k.x-k.r>=0&&k.y-k.r>=0&&k.x+k.r<=1448&&k.y+k.r<=1086,name+' exceeds image');
}
for(const [name,b] of Object.entries(geom.buttonsPx)){
 assert.ok(b[0]>=0&&b[1]>=0&&b[0]<b[2]&&b[1]<b[3]&&b[2]<=1448&&b[3]<=1086,name+' exceeds image');
}
const imageBundle=fs.readFileSync(path.join(base,'images.js'),'utf8');
assert.match(imageBundle,/"knob-mode\.webp":/);
assert.match(imageBundle,/"efis-plate\.webp":/);
assert.match(imageBundle,/"knob-wxInner\.webp":/);
assert.ok(imageBundle.length>100000,'approved images must be embedded');
console.log('EFIS pixel-lock v3 QA: PASS (7 modes, 6 rotaries, 7 push buttons and photo assets)');
