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
const k=js.indexOf('"id":"residual-volts"');
assert.ok(k>=0,'same RESID geometry must exist in live runtime registry');
const installed=JSON.parse(js.slice(js.lastIndexOf('{',k),js.indexOf('}',k)+1));
assert.deepEqual([installed.cx,installed.cy,installed.d,installed.quality],
 [residual.cx,residual.cy,residual.d,residual.quality],
 'runtime placement must exactly match image-space manifest');
const sx=544/1095,sy=737/1436;
const projectedX=853.5+(residual.cx-925)*sx;
const projectedY=799.5+(residual.cy-1228)*sy;
assert.ok(Math.hypot(projectedX-849.5,projectedY-822.5)<1,
 'button and socket circle centers must align within 1 screenshot pixel');
assert.ok(html.includes('recessed-overhead-v2.js?v=RECESS-0003-RESID-SOCKET-CENTER'),
 'new JS must load without stale cached RESID position');

// 2026-11-04 owner photograph: the original OH18 camera frame reveals
// old ATTEND, GRD CALL and right RAIN REPELLENT bezels offset up/left of
// their painted bores. Register ONLY those three corrected source points.
const oh18Aligned={
 'attend':[188,435,192],
 'ground-call':[643,435,192],
 'rain-repellent-right':[570,1045,176]
};
for(const [id,expected]of Object.entries(oh18Aligned)){
 const item=manifest.buttons.find(x=>x.id===id);
 assert.ok(item,id+' must exist');
 assert.equal(item.piece,'OH18',id+' must stay on the original OH18 artwork');
 assert.deepEqual([item.cx,item.cy,item.d],expected,id+' must remain centered on approved screenshot bore');
 assert.equal(item.quality,'screenshot-aligned');
 const pos=js.indexOf('"id":"'+id+'"');
 assert.ok(pos>=0,'actual runtime entry required for '+id);
 const installed=JSON.parse(js.slice(js.lastIndexOf('{',pos),js.indexOf('}',pos)+1));
 assert.deepEqual([installed.cx,installed.cy,installed.d,installed.quality],
  [...expected,'screenshot-aligned'],'actual interactive button matches the photo manifest');
}
const leftRain=manifest.buttons.find(x=>x.id==='rain-repellent-left');
assert.deepEqual([leftRain.cx,leftRain.cy,leftRain.d,leftRain.quality],[236,1035,176,'photo'],
 'left RAIN REPELLENT was already aligned; must not be moved or resized');
const otherOh18=manifest.buttons.filter(x=>x.piece==='OH18');
assert.equal(otherOh18.length,4,'No duplicate OH18 control overlays');
assert.equal(new Set(otherOh18.map(x=>x.id)).size,4);
const srcRatio=235/816;
assert.ok(Math.abs((oh18Aligned.attend[0]-160)*srcRatio-8.064)<.1,
 'On the reference atlas, ATTEND is shifted only its measured 8.1px horizontally');
assert.ok(html.includes('oh18=PHOTO-SOCKET-FIT-0001'),
 'OH18 JS must be cache-busted so screenshot corrections reach deployed cockpit');

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
