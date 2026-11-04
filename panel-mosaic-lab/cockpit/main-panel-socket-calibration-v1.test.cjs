'use strict';
// Per-annunciator calibration acceptance. Geometry is measured against original
// Main Panel photographs; production registries and aircraft logic stay intact.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const base=__dirname;
const reg=JSON.parse(fs.readFileSync(path.join(base,'lights.json'),'utf8'));
const asm=JSON.parse(fs.readFileSync(path.join(base,'assembly.json'),'utf8'));
const cal=JSON.parse(fs.readFileSync(path.join(base,'main-panel-socket-calibration-v1.json'),'utf8'));
assert.equal(cal.schema,'b737.main-panel-socket-calibration.v1');
assert.equal(reg.lights.length,30);
assert.equal(Object.keys(cal.sockets).length,reg.lights.length);
const allPlacements=asm.regions.flatMap(r=>r.placements||[]);
for(const lamp of reg.lights){
 const m=cal.sockets[lamp.id];assert.ok(m, 'Unregistered '+lamp.id);
 assert.equal(m.pieceId,lamp.pieceId);
 assert.equal(m.sourceRect.length,4);
 const piece=allPlacements.find(p=>p.id===lamp.pieceId);
 const asset=asm.assets[piece.asset];assert.ok(asset);
 const [x,y,w,h]=m.sourceRect;
 assert.ok([x,y,w,h].every(Number.isFinite)&&w>0&&h>0&&x>=0&&y>=0,'Bad lens '+lamp.id);
 assert.ok(x+w<=asset.dimensions[0]&&y+h<=asset.dimensions[1],'Source-image bounds '+lamp.id);
 assert.deepEqual(m.center,[x+w/2,y+h/2],'Incorrect aperture center '+lamp.id);
 for(const other of reg.lights){
  if(other.id===lamp.id||other.pieceId!==lamp.pieceId)continue;
  const [ox,oy,ow,oh]=cal.sockets[other.id].sourceRect;
  const intersection=Math.max(0,Math.min(x+w,ox+ow)-Math.max(x,ox))*
    Math.max(0,Math.min(y+h,oy+oh)-Math.max(y,oy));
  assert.equal(intersection,0,'Overlapping photo sockets '+lamp.id+' / '+other.id);
 }
}
const fitter=fs.readFileSync(path.join(base,'../lamp-socket-fit-v3/live-fit.js'),'utf8');
const renderer=fs.readFileSync(path.join(base,'lights.js'),'utf8');
const css=fs.readFileSync(path.join(base,'style.css'),'utf8');
const html=fs.readFileSync(path.join(base,'index.html'),'utf8');
assert.ok(fitter.includes("sourceRect:slot?slot.sourceRect:original.sourceRect"));
assert.ok(fitter.includes("if(row.bank==='MP')return {x,y,w,h,p:{l:0,r:0,t:0,b:0}}"));
assert.ok(!fitter.includes('const size=mp?1.10:1'));
assert.ok(renderer.includes("measured=socketCalibration?.sockets?.[c.id]"));
assert.ok(renderer.includes("node.dataset.apertureCenter=center.join(',')"));
assert.ok(renderer.includes("function emissionOnly(source)"));
assert.ok(!css.includes('left:10%;top:10%;'));
assert.ok(!css.includes('width:110%;height:110%;'));
assert.ok(html.includes('lights.js?v=LAMP-PTT-MP-SOCKET-0003'));
assert.ok(html.includes('live-fit.js?v=LGT-SOCKET-FIT-011-CONV-GLASS'));
console.log('PASS: 30 unique native-photo apertures and centers, 0 overlaps, no global shifts, both render layers and versioned loads registered.');
