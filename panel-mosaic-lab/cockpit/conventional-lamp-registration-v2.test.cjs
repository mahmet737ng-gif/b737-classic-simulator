'use strict';
// CONV-MP-GEAR-0002: Conventional-only registration. EIS remains an untouched
// independent photo and the original 30-lamp EIS calibration is immutable.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const base=__dirname;
const conv=require('./conventional-lamp-registration-v1.js');
const calibration=JSON.parse(fs.readFileSync(path.join(base,'main-panel-socket-calibration-v1.json')));
const lights=JSON.parse(fs.readFileSync(path.join(base,'lights.json'))).lights;
const layout={x:761,y:127,matrix:[613/1463,0,0,475.5578947368421/1075,0,0]};
const measured=conv.photoApertures;
const gear=['nose-red','nose-green','left-red','left-green','right-red','right-green'].map(s=>'main-gear-'+s);
assert.equal(Object.keys(measured).length,19,'19 independently calibrated Conventional apertures');
for(const id of gear)assert.ok(measured[id],id+' requires its own aperture');
const resolved=Object.fromEntries(Object.entries(measured).map(([id,source])=>{
 const p=conv.nativePlacement(layout,id,conv.sockets[id]);
 assert.ok([p.x,p.y,p.w,p.h].every(Number.isFinite)&&p.w>0&&p.h>0);
 assert.equal(p.skew,0,'Do not shear Conventional lamps');
 assert.ok(p.x>=0&&p.y>=0&&p.x+p.w<=2100&&p.y+p.h<=920,'Outside native panel: '+id);
 assert.ok(lights.some(l=>l.id===id),'Unknown light: '+id);
 return [id,p];
}));
for(const [id,a] of Object.entries(resolved))for(const [next,b] of Object.entries(resolved)){
 if(id>=next)continue;
 const area=Math.max(0,Math.min(a.x+a.w,b.x+b.w)-Math.max(a.x,b.x))*
  Math.max(0,Math.min(a.y+a.h,b.y+b.h)-Math.max(a.y,b.y));
 assert.ok(area<0.001,id+' overlaps '+next);
}
for(const color of ['red','green']){
 assert.ok(resolved['main-gear-left-'+color].x<resolved['main-gear-right-'+color].x);
 assert.ok(Math.abs(resolved['main-gear-left-'+color].y-resolved['main-gear-right-'+color].y)<0.001);
}
assert.ok(resolved['main-gear-nose-red'].y<resolved['main-gear-nose-green'].y);
assert.ok(resolved['main-gear-nose-green'].y<resolved['main-gear-left-green'].y);
assert.ok(Math.abs(resolved['main-gear-nose-red'].x-resolved['main-gear-nose-green'].x)<0.001);
assert.ok(resolved['main-gear-left-red'].x>1300);
assert.ok(resolved['main-gear-right-green'].x>1400);
assert.ok(conv.nativePlacement(layout,'main-speed-brake-armed',conv.sockets['main-speed-brake-armed']).x>0,
 'Unphotographed non-gear lamps retain previous registration');
// Verify EIS slots are not rewritten to the conventional photo.
assert.deepEqual(calibration.sockets['main-gear-nose-red'].sourceRect,[249,149,73,38]);
assert.deepEqual(calibration.sockets['main-gear-left-green'].sourceRect,[209,281,72,35]);
assert.deepEqual(calibration.sockets['main-gear-right-green'].sourceRect,[294,281,71,34]);
const source=fs.readFileSync(path.join(base,'conventional-lamp-registration-v1.js'),'utf8');
const fitter=fs.readFileSync(path.join(base,'../lamp-socket-fit-v3/live-fit.js'),'utf8');
const entry=fs.readFileSync(path.join(base,'index.html'),'utf8');
assert.ok(source.includes('html[data-engine-indication="CONVENTIONAL"] #region-main'),
 'Conventional rules must never affect EIS');
assert.ok(source.includes("win.CustomEvent('b737:conventional-lamp-geometry')"),
 'Emit refit after the Conventional CSS is applied');
assert.ok(fitter.includes("win.getComputedStyle(obj.node)"),
 'Use the computed Conventional geometry, not stale EIS inline dimensions');
assert.ok(fitter.includes("win.addEventListener('b737:conventional-lamp-geometry'"),
 'Refit after the override geometry changes');
assert.ok(entry.includes('conventional-lamp-registration-v1.js?v=CONV-MP-GEAR-0002'));
assert.ok(entry.includes('live-fit.js?v=LGT-SOCKET-FIT-010-CONV-GEAR'));
console.log('PASS: Conventional 19 fitted lamp slots, six aligned gear lenses, zero overlaps, EIS original registration preserved.');
