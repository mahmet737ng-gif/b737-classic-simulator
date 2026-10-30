'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.join(__dirname,'..');
const base='panel-mosaic-lab/cockpit/';
const manifest=JSON.parse(fs.readFileSync(path.join(root,base,'recessed-overhead-v2.json'),'utf8'));
const css=fs.readFileSync(path.join(root,base,'recessed-overhead-v2.css'),'utf8');
const js=fs.readFileSync(path.join(root,base,'recessed-overhead-v2.js'),'utf8');
const html=fs.readFileSync(path.join(root,base,'overhead-stage.html'),'utf8');
const le=fs.readFileSync(path.join(root,'panel-mosaic-lab/le-devices/panel.js'),'utf8');
const atlas=JSON.parse(fs.readFileSync(path.join(root,'panel-mosaic-lab/all-overhead/atlas-layout.json'),'utf8'));
assert.equal(manifest.buttons.length,12,'12 new buttons plus 1 integrated LE');
assert.equal(new Set(manifest.buttons.map(x=>x.id)).size,12);
assert.equal(manifest.buttons.length+Number(!!manifest.legacyIntegrated),13);
assert.deepEqual([...new Set(manifest.buttons.map(x=>x.piece))].sort(),['OH10','OH15','OH18','OH21','UPPER']);
for(const b of manifest.buttons){
 const size=manifest.photoBasis[b.piece];assert.ok(size&&b.cx>0&&b.cy>0&&b.cx<size[0]&&b.cy<size[1]&&b.d>0,b.id+' in source bounds');
 const placement=atlas.placements.find(p=>p.id===b.piece);assert.ok(placement,b.id+' original atlas tile exists');
 const px=placement.x+(b.cx/size[0])*placement.w,py=placement.y+(b.cy/size[1])*placement.h;
 assert.ok(px>placement.x&&px<placement.x+placement.w&&py>placement.y&&py<placement.y+placement.h,b.id+' registered on atlas tile');
}
assert.equal(manifest.buttons.filter(b=>b.quality==='provisional').length,0,
 'RESID VOLTS socket has been aligned from owner screenshot');
const residual=manifest.buttons.find(b=>b.id==='residual-volts');
assert.deepEqual([residual.piece,residual.cx,residual.cy,residual.d,residual.quality],
 ['OH10',917,1273,112,'screenshot-aligned'],
 'RESID VOLTS moves 8 native px left and 45 native px down without changing diameter');
const codeButton=js.match(/\\{\"id\":\"residual-volts\"[^}]*\\}/);
assert.ok(codeButton,'same RESID geometry must exist in live runtime registry');
const installed=JSON.parse(codeButton[0]);
assert.deepEqual([installed.cx,installed.cy,installed.d,installed.quality],
 [residual.cx,residual.cy,residual.d,residual.quality],
 'runtime placement must exactly match image-space manifest');
const sx=544/1095,sy=737/1436;
const projectedX=853.5+(residual.cx-925)*sx;
const projectedY=799.5+(residual.cy-1228)*sy;
assert.ok(Math.hypot(projectedX-849.5,projectedY-822.5)<1,
 'button and socket circle centers must align within 1 screenshot pixel');
assert.match(html,/recessed-overhead-v2\\.js\\?v=RECESS-0003-RESID-SOCKET-CENTER/,
 'new JS must load without stale cached RESID position');

assert.match(css,/__cap\[data-pressed="true"\][^{]*\{[^}]*scale\(\.79\)/);
assert.match(css,/\.b737-recess-unit\{[^}]*pointer-events:none/);
assert.match(css,/\.b737-recess-unit__cap\{[^}]*pointer-events:auto/);
assert.match(css,/\.b737-le-devices \.b737-le-devices__test\{/);
assert.match(js,/pointerdown/);assert.match(js,/pointerup/);assert.match(js,/lostpointercapture/);
assert.match(html,/recessed-overhead-v2\.css/);assert.match(html,/recessed-overhead-v2\.js/);
assert.match(le,/b737:le-devices-lamp-test/);
assert.equal(manifest.legacyIntegrated.expectedLocation.length,2);
new vm.Script(js,{filename:'recessed-overhead-v2.js'});
const art=fs.readFileSync(path.join(root,base,'assets/recessed-pushbutton-v2.svg'),'utf8');
assert.match(art,/<svg /);assert.match(art,/<\/svg>/);
console.log('RECESS-0002 PASS: 13 positions incl LE, atlas registration, no duplicate IDs, immovable bezel, cap-only hit area, 79% concentric press, pointer release, loaded routes, JS parse.');
console.log('RECESS-0003 NOTE: RESID VOLTS centered using screenshot circle-fit; native full-resolution visual sign-off still pending.');
