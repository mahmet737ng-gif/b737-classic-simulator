'use strict';
// CONV-LAMP-PIXEL-0003 — source-photograph aperture regression.
// Pixel evidence: owner's 1920x1080 screenshot 2026-11-04 23:39.
// The six Landing Gear glass rectangles were independently measured in that
// screenshot. The ORIGINAL Conventional sourceRects reproduce all six
// at the exact photographed bezels; screenshot-derived native offsets do not.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const base=__dirname;
const conv=require('./conventional-lamp-registration-v1.js');
const calibration=JSON.parse(fs.readFileSync(path.join(base,'main-panel-socket-calibration-v1.json')));
const lamps=JSON.parse(fs.readFileSync(path.join(base,'lights.json'))).lights;
const source=fs.readFileSync(path.join(base,'conventional-lamp-registration-v1.js'),'utf8');
const fitter=fs.readFileSync(path.join(base,'../lamp-socket-fit-v3/live-fit.js'),'utf8');
const entry=fs.readFileSync(path.join(base,'index.html'),'utf8');
const photo={width:1463,height:1075};
const layout={x:761,y:127,matrix:[613/photo.width,0,0,475.5578947368421/photo.height,0,0]};
const fitted=Object.fromEntries(Object.entries(conv.sockets).map(([id,box])=>{
 assert.ok(lamps.some(l=>l.id===id),'Unknown lamp '+id);
 const [x,y,w,h]=box;
 assert.ok(x>=0&&y>=0&&x+w<=photo.width&&y+h<=photo.height);
 const p=conv.placement(layout,box);
 assert.ok(p.x>=layout.x&&p.x+p.w<=1374&&p.y>=layout.y&&p.y+p.h<=layout.y+475.558);
 return[id,p];
}));
assert.equal(Object.keys(fitted).length,22,'All 22 photographed Conventional lights fitted');
assert.ok(!/\b(?:const|let|var)\s+photoApertures\b/.test(source),'Retired screenshot-derived native offsets must not be declared');
assert.ok(!source.includes('nativePlacement'),'Exactly one source-photo coordinate transform');
assert.ok(source.includes('const p=placement(layout,box),sel='));
assert.ok(source.includes('html[data-engine-indication="CONVENTIONAL"] #region-main'),
 'Do not adjust any EIS lamp positions');
assert.ok(source.includes("win.CustomEvent('b737:conventional-lamp-geometry')"),
 'Refit after photo registration');
assert.ok(fitter.includes('win.getComputedStyle(obj.node)'));
assert.ok(fitter.includes("win.addEventListener('b737:conventional-lamp-geometry'"));
const screenshotSlots={
 'main-gear-nose-red':[1068,219,65,31],
 'main-gear-nose-green':[1068,251,65,30],
 'main-gear-left-red':[1036,286,57,31],
 'main-gear-left-green':[1036,317,57,31],
 'main-gear-right-red':[1100,286,63,31],
 'main-gear-right-green':[1100,317,63,31]
};
// Independent screenshot-to-stage registration, sourced from the real
// Conventional photo left/top reference and native photo display width:
// photo top-left (95,98) and per-source-pixel display (0.735,0.778).
// The critical test compares with the photographed EMPTY boxes, not with
// the model's own predicted centers (which previously gave false PASS).
for(const[id,truth]of Object.entries(screenshotSlots)){
 const [sx,sy,sw,sh]=conv.sockets[id],actual=[
   95+0.735*sx,98+0.778*sy,0.735*sw,0.778*sh];
 const tolerance=2.5;
 actual.forEach((n,i)=>assert.ok(Math.abs(n-truth[i])<tolerance,
   id+' PHOTO SLOT geometry drift at index '+i+': '+n+' vs '+truth[i]));
}
for(const[id,a]of Object.entries(fitted))for(const[next,b]of Object.entries(fitted)){
 if(id>=next)continue;
 const overlap=Math.max(0,Math.min(a.x+a.w,b.x+b.w)-Math.max(a.x,b.x))*
   Math.max(0,Math.min(a.y+a.h,b.y+b.h)-Math.max(a.y,b.y));
 assert.ok(overlap<0.01,id+' overlaps '+next+' in source photo');
}
assert.deepEqual(calibration.sockets['main-gear-nose-red'].sourceRect,[249,149,73,38]);
assert.deepEqual(calibration.sockets['main-gear-left-green'].sourceRect,[209,281,72,35]);
assert.deepEqual(calibration.sockets['main-gear-right-green'].sourceRect,[294,281,71,34]);
assert.ok(entry.includes('conventional-lamp-registration-v1.js?v=CONV-LAMP-PIXEL-0003'));
console.log('PASS: all 22 original photo apertures, all six photographed landing gear bezels +/-2.5 screenshot px, zero overlaps, EIS unchanged.');
