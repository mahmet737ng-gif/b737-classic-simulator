'use strict';
/* Physical CAPT/FO photo instrument geometry regression.
 * Original art/transform anchors stay untouched. No viewport guesses.
 */
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const Reg=require('./photo-gauge-registration-v1.js');
const cockpit=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(cockpit,p),'utf8');
const gauges=read('instrument-lab/gauges.js');
const geometry=JSON.parse(gauges.match(/const geometry = (\{[^\n]+\});/)[1]);
const originals=require('../flight-needles-model.js');
const airspeed=require('../airspeed-pointers-model.js');
const owner=require('../fo-owner-panel-v1.js');
test('Every photo gauge canvas uses exact single pivot and uniform source-photo units',()=>{
 assert.equal(Reg.VERSION,'PHOTO-GAUGE-REGISTRATION-0001');
 for(const mode of ['EIS','CONVENTIONAL'])for(const seat of ['captain','firstOfficer'])
  for(const kind of Reg.kinds){
   const entry=Reg.get(mode,seat,kind);
   const box=Reg.rectangle(entry,geometry[kind]);
   const ratio=entry.radius/Reg.ref[kind];
   assert(Math.abs(box.x+geometry[kind].pivot[0]*ratio-entry.x)<1e-8);
   assert(Math.abs(box.y+geometry[kind].pivot[1]*ratio-entry.y)<1e-8);
   assert(Math.abs(box.width/box.height-geometry[kind].size[0]/geometry[kind].size[1])<1e-12,
    'Do not stretch flight instrument photo');
   assert(box.centerX>=0&&box.centerX<entry.width,'off-photo pivot X');
   assert(box.centerY>=0&&box.centerY<entry.height,'off-photo pivot Y');
   assert(Math.abs(box.left-entry.x*100/entry.width+
     geometry[kind].pivot[0]*ratio*100/entry.width)<1e-7);
   for(const n of Object.values(box.clip))assert(Number.isFinite(n)&&n>=0&&n<50);
   assert.equal(Reg.selector(entry),entry.piece==='fo-owner'?'#fo-owner-panel-v1':
    '.texture-piece[data-piece="'+entry.piece+'"]');
  }
});
test('Captain gauges remain identical in both display styles',()=>{
 for(const kind of Reg.kinds)
  assert.deepEqual(Reg.get('EIS','captain',kind).piece,
   Reg.get('CONVENTIONAL','captain',kind).piece);
});
test('EIS photo instrument centers are the original measured glass-source centers',()=>{
 for(const [kind,key,place] of [
  ['altimeter','altimeter','firstOfficerOuter'],
  ['ivsi','verticalSpeed','firstOfficerOuter'],
  ['rmi','rmi','firstOfficerInner']]){
  const a=Reg.get('EIS','firstOfficer',kind),b=originals.sources[place];
  const ref=b.gauges[key];
  assert.deepEqual([a.piece,a.width,a.height,a.x,a.y,a.radius],
   [b.piece,b.width,b.height,ref.x,ref.y,ref.radius],kind);
 }
 const p=airspeed.firstOfficer,s=Reg.get('EIS','firstOfficer','airspeed');
 assert.deepEqual([s.piece,s.width,s.height,s.x,s.y,s.radius],
  [p.piece,p.width,p.height,p.pivot.x,p.pivot.y,p.tipRadius]);
});
test('F/O Conventional analog gauges are mounted to the real approved owner photo, not hidden EIS textures',()=>{
 for(const kind of Reg.kinds){
  const p=Reg.get('CONVENTIONAL','firstOfficer',kind);
  assert.equal(p.piece,'fo-owner');
  assert.equal(p.width,owner.source.width);
  assert.equal(p.height,owner.source.height);
  assert.equal(p.anchor,'OWNER_20261030');
 }
 for(const [kind,key] of [['altimeter','altimeter'],['ivsi','verticalSpeed'],['rmi','rmi1']]){
  const x=Reg.get('CONVENTIONAL','firstOfficer',kind),ref=owner.pivots[key];
  assert.deepEqual([x.x,x.y,x.radius],ref);
 }
});
test('F/O EIS RMI is clipped at its own right photo edge, never obscuring EHSI',()=>{
 const r=Reg.get('EIS','firstOfficer','rmi');
 const b=Reg.rectangle(r,geometry.rmi);
 assert(b.x+b.width>r.width,'verify old photo overflow reproduced');
 assert(b.clip.right>8&&b.clip.right<13,'only out-of-piece bezel region gets clipped');
 assert.equal(b.clip.left,0);
 const renderedRight=b.x+b.width*(1-b.clip.right/100);
 assert(Math.abs(renderedRight-r.width)<.000001);
 // Airspeed and outboard analog faces stay unaltered unless they cross a source seam.
 for(const kind of ['airspeed','altimeter','ivsi']){
  const e=Reg.get('EIS','firstOfficer',kind);
  const v=Reg.rectangle(e,geometry[kind]);
  assert.equal(v.clip.left+v.clip.right+v.clip.top+v.clip.bottom,0,kind);
 }
});
test('Unified cannot leave FO gauges mounted on invisible EIS photo when switching to Conventional',()=>{
 const impl=read('instrument-lab/unified.js');
 const page=read('index.html');
 assert.match(impl,/registration\.get\(mode,station,kind\)/);
 assert.match(impl,/gauge\.canvas\.parentNode!==host/);
 assert.match(impl,/gauge\?\.canvas\.remove\(\)/);
 assert.match(impl,/gauge\.canvas\.style\.clipPath/);
 assert.match(impl,/b737:engine-indication-view/);
 assert.match(impl,/gauge\.canvas\.dataset\.gaugePiece/);
 assert.match(impl,/getPlacements:\(\)=>/);
 assert(page.includes('photo-gauge-registration-v1.js?v=PHOTO-GAUGE-REG-0001'));
 assert(page.indexOf('photo-gauge-registration-v1.js')<
  page.indexOf('instrument-lab/unified.js?v=PHOTO-GAUGES-0004-SOCKET-MODE-CLIP'));
});
