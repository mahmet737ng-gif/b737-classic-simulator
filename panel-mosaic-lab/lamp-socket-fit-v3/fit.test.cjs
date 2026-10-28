#!/usr/bin/env node
'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const geom=JSON.parse(fs.readFileSync(path.join(__dirname,'geometry-142.json'),'utf8'));
const manifest=JSON.parse(fs.readFileSync(path.join(root,'lights-reference-v2/manifest.json'),'utf8'));
const overhead=JSON.parse(fs.readFileSync(path.join(root,'interactive-overhead/lights.json'),'utf8'));
const cockpit=JSON.parse(fs.readFileSync(path.join(root,'cockpit/lights.json'),'utf8'));
assert.equal(geom.slots.length,142);
assert.equal(geom.slots.filter(x=>x.panel==='OH').length,112);
assert.equal(geom.slots.filter(x=>x.panel==='MP').length,30);
const seen=new Set();
for(const [bank,db] of [['OH',overhead],['MP',cockpit]]){
 for(const c of db.lights){
  assert(!seen.has(c.id),'Duplicate socket: '+c.id);
  seen.add(c.id);
  const s=geom.slots.find(a=>a.id===c.id);
  assert(s,'Missing socket '+c.id);
  assert.equal(s.panel,bank);
  assert.deepEqual(s.sourceRect,c.sourceRect,'Original pixel coordinates changed for '+c.id);
  const [x,y,w,h]=s.fittedRect;
  assert(x>=0&&y>=0&&w>0&&h>0,'Invalid or negative bounds: '+c.id);
  assert(w>=c.sourceRect[2]&&h>=c.sourceRect[3],'Fit shrank socket '+c.id);
  assert(w<=c.sourceRect[2]+12&&h<=c.sourceRect[3]+12,'Excessive expansion: '+c.id);
  assert(manifest.sourceAssetToMaster[bank+':'+s.asset],'Missing lamp master '+c.id);
 }
}
let collisions=0;
for(let i=0;i<geom.slots.length;i++)for(let j=i+1;j<geom.slots.length;j++){
 const a=geom.slots[i],b=geom.slots[j];
 if(a.panel!==b.panel||a.photo!==b.photo)continue;
 const [ax,ay,aw,ah]=a.fittedRect,[bx,by,bw,bh]=b.fittedRect;
 if(Math.min(ax+aw,bx+bw)>Math.max(ax,bx)&&Math.min(ay+ah,by+bh)>Math.max(ay,by))collisions++;
}
assert.equal(collisions,0,'Two expanded lenses intersect on the same source photo');
const masterDir=path.join(root,'lights-reference-v2');
for(const master of manifest.masters){
 for(const [state,file] of Object.entries(master.assets)){
  const text=fs.readFileSync(path.join(masterDir,file),'utf8');
  assert(text.includes('<svg')&&text.includes('viewBox='),'Invalid SVG '+file);
  assert(text.includes('font-weight="700"'),'Source typography changed '+file);
 }
}
const script=fs.readFileSync(path.join(__dirname,'live-fit.js'),'utf8');
assert(script.includes("new DOMParser()")&&script.includes("object-fit:fill"),'Missing non-raster fitting step');
assert(script.includes("sourceRect")&&script.includes("scale("),'Fitting no longer source anchored');
for(const p of ['cockpit/index.html','interactive-overhead/index.html']){
 const s=fs.readFileSync(path.join(root,p),'utf8');
 assert(s.includes('../lamp-socket-fit-v3/live-fit.js?v=LGT-SOCKET-FIT-003'),'Missing opt-in live loader '+p);
}
console.log('LGT-SOCKET-FIT-003 PASS: '+geom.slots.length+' preserved calibrated source rectangles, 0 overlaps, '+manifest.masters.length+' masters, SVG typography preserved, independent opt-in loaders.');
