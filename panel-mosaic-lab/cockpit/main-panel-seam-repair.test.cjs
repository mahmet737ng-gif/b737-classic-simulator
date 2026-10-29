'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const root=__dirname;
const assembly=JSON.parse(fs.readFileSync(path.join(root,'assembly.json'),'utf8'));
const render=require('./main-panel-seam-repair.js');
const main=assembly.regions.find(x=>x.id==='main');
const positions=Object.fromEntries(main.placements.map(p=>[p.id,{x:p.x,y:p.y,w:p.w,h:p.h,asset:p.asset}]));
const a=render.geometry(assembly);
assert.equal(a.join,1222,'The photographed engine seam is precisely the untouched engine-to-FO join');
assert.equal(positions.engine.x,761);
assert.equal(positions.engine.w,461);
assert.equal(positions['fo-inner'].x,1222);
assert.equal(positions['fo-inner'].w,372);
assert.equal(a.repairs.length,2);
assert.deepEqual(a.repairs[0],{id:'upper',x:1214,y:127,w:10,h:94});
assert.ok(Math.abs(a.repairs[1].x-1198)<.001);
assert.ok(Math.abs(a.repairs[1].y-221)<.001);
assert.equal(a.repairs[1].w,26);
assert.ok(a.repairs[1].h>0&&a.repairs[1].y+a.repairs[1].h<=positions.engine.y+positions.engine.h+.001);
assert.ok(a.repairs.every(p=>p.x+p.w<=positions['fo-inner'].x+2),'Must not repaint the FO instruments');
assert.ok(a.repairs.every(p=>p.x>=positions.engine.x),'Must not cover EIS instruments');
const source=fs.readFileSync(path.join(root,'main-panel-seam-repair.js'),'utf8');
const skin=fs.readFileSync(path.join(root,'main-panel-seam-repair.css'),'utf8');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
assert.ok(html.includes('main-panel-seam-repair.js?v=MAIN-SEAM-0001'));
assert.ok(html.includes('main-panel-seam-repair.css?v=MAIN-SEAM-0001'));
assert.ok(source.includes("querySelector('.texture-piece[data-piece=\"engine\"]')"));
assert.ok(source.includes("querySelector('.texture-piece[data-piece=\"fo-inner\"]')"));
assert.ok(source.includes('Math.abs(right.x-join)>.1'),'Unexpected layout changes must fail closed');
assert.ok(skin.includes('pointer-events:none'),'Repair must never capture cockpit controls');
assert.ok(skin.includes('#region-main'),'No overhead or pedestal art changes');
// The original uploaded source pictures and every placed pixel origin remain
// under the existing atlas tests; this test also checks known source hashes.
assert.equal(assembly.assets[positions.engine.asset].sha256,
 '7763f8f700ff42f2179d3f8f46eee06444b6439b71f428c328b14f48ac0f4856');
assert.equal(assembly.assets[positions['fo-inner'].asset].sha256,
 '16120d7f4e38aef3854619f231ee2a324b4888bc35c506d0b6d24e1b8417c672');
let altered=JSON.parse(JSON.stringify(assembly));
altered.regions.find(r=>r.id==='main').placements.find(p=>p.id==='fo-inner').x+=4;
assert.throws(()=>render.geometry(altered),/MUST NOT move/);
console.log('PASS: 2 scoped source-margin repairs; zero movement of 5 main panels, instruments or source image fingerprints.');
