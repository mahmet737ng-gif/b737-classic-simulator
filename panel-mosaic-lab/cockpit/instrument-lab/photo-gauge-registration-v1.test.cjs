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
 assert.equal(Reg.VERSION,'PHOTO-GAUGE-REGISTRATION-0002-NATIVE-BEZEL');
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
  assert.deepEqual([a.piece,a.width,a.height,a.x,a.y],
   [b.piece,b.width,b.height,ref.x,ref.y],kind);
  // Needle tip radius and photographic face/border radius are different.
  if(kind!=='rmi')assert.equal(a.radius,ref.radius);
 }
 const p=airspeed.firstOfficer,s=Reg.get('EIS','firstOfficer','airspeed');
 assert.deepEqual([s.piece,s.width,s.height,s.x,s.y,s.radius],
  [p.piece,p.width,p.height,p.pivot.x,p.pivot.y,p.tipRadius]);
});
test('F/O Conventional analog gauges are mounted to the real approved owner photo, not hidden EIS textures',()=>{
 assert(Object.isFrozen(owner.pivots),'approved owner socket centers must be immutable');
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
test('Captain photo face width matches original panel bezels and never covers the next gauge',()=>{
 const gauges={airspeed:[340,790,825],altimeter:[249,590,630],
  ivsi:[248,600,635],rmi:[223,610,645]};
 for(const [kind,[radius,min,max]]of Object.entries(gauges)){
  const entry=Reg.get('EIS','captain',kind),r=Reg.rectangle(entry,geometry[kind]);
  assert.equal(entry.radius,radius);
  assert(r.width>=min&&r.width<=max,kind+' full-size photographed face');
  assert.equal(entry.piece,'captain');
  assert.equal(Object.values(r.clip).reduce((a,b)=>a+b,0),0);
 }
 for(const [one,two]of [['airspeed','rmi'],['altimeter','ivsi']]){
  const a=Reg.rectangle(Reg.get('EIS','captain',one),geometry[one]);
  const b=Reg.rectangle(Reg.get('EIS','captain',two),geometry[two]);
  assert(b.y-a.y-a.height>=6,'Captain faces separated '+one+'/'+two);
 }
});
test('FO photo RMI fits original ~281px bezel and cannot overlap ASI',()=>{
 const asi=Reg.get('EIS','firstOfficer','airspeed');
 const rmi=Reg.get('EIS','firstOfficer','rmi');
 const a=Reg.rectangle(asi,geometry.airspeed),b=Reg.rectangle(rmi,geometry.rmi);
 assert.equal(rmi.radius,100);
 assert.equal(rmi.piece,asi.piece);
 assert(b.width>=275&&b.width<=285);
 assert(b.x+b.width<=rmi.width,'FO RMI inside own photo piece');
 assert.equal(Object.values(b.clip).reduce((a,b)=>a+b,0),0);
 assert(b.y-a.y-a.height>=1.5,'No physical ASI/RMI overlap');
 assert(b.y-a.y-a.height<12,'Small real metal seam retained');
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
