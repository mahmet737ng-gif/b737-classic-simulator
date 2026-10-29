'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const root=path.join(__dirname,'..','panel-mosaic-lab','cockpit');
const reg=JSON.parse(fs.readFileSync(path.join(root,'panel-photo-registry.v1.json'),'utf8'));
assert.equal(reg.schema,'b737.owner.photo.panel-registration/1');
assert.equal(reg.locked_originals,'NEVER_WRITE');
const panels=reg.panels;
assert.deepEqual(Object.keys(panels).sort(),['OH21_300500','OH21_400','P2_CONVENTIONAL']);
const assertInside=(x,y,p,name)=>assert.ok(x>=0&&y>=0&&x<p.width&&y<p.height,p.file+': '+name+' outside source');
for(const [key,p] of Object.entries(panels)){
 const img=fs.readFileSync(path.join(root,'assets',p.file));
 assert.equal(img.toString('ascii',0,4),'RIFF',key+' WebP RIFF header');
 assert.equal(img.toString('ascii',8,12),'WEBP',key+' WebP header');
 assert.equal(crypto.createHash('sha256').update(img).digest('hex'),p.sha256,key+' source has changed');
 assert.ok(img.length>100000,key+' implausibly small photo');
 for(const [group,points] of Object.entries(p)){
  if(!['controls','instrument_pivots','registration_anchors','gauge_pivots'].includes(group))continue;
  for(const [name,xy] of Object.entries(points))assertInside(xy[0],xy[1],p,group+'.'+name);
 }
 for(const [name,[x,y,w,h]]of Object.entries(p.lights||{})){
  assertInside(x,y,p,name+' start');assert.ok(x+w<=p.width&&y+h<=p.height,key+' light box exceeds photo: '+name);
 }
}
for(const key of ['OH21_400','OH21_300500']){
 const p=panels[key];
 assert.equal(Object.keys(p.lights).length,9);
 for(const n of ['recirc-fan','pack-l','pack-r','isolation-valve','bleed-eng-1','bleed-apu','bleed-eng-2','aircon-ovht-test','trip-reset'])assert.ok(p.controls[n]);
}
assert.equal(Object.keys(panels.OH21_400.controls).length,10);
assert.equal(Object.keys(panels.OH21_300500.controls).length,9);
assert.ok(panels.OH21_400.controls['recirc-fan-l']);
assert.ok(!panels.OH21_300500.controls['recirc-fan-l']);
assert.equal(Object.keys(panels.P2_CONVENTIONAL.instrument_pivots).length,16);
assert.equal(panels.P2_CONVENTIONAL.activation_policy,'STAGED_UNTIL_NATIVE_P2_GEOMETRY_MATCH_AND_NEEDLE_QA');
const loaded=fs.readFileSync(path.join(root,'oh21-owner-photo-registration-v1.js'),'utf8');
assert.match(loaded,/function revert\(/);
assert.match(loaded,/function fit\(/);
assert.match(loaded,/new Image\(\)/);
const overhead=fs.readFileSync(path.join(root,'overhead-stage.html'),'utf8');
assert.match(overhead,/oh21-owner-photo-registration-v1\.js/);
const locked=fs.readFileSync(path.join(root,'../all-overhead/final-lock.json'),'utf8');
assert.match(locked,/FINAL_LOCKED/);
console.log('PASS: owner OH21 sources, both families, 9 lens targets, 19 mapped controls, 16 P2 pivots, fail-safe rollback and freeze guard');
