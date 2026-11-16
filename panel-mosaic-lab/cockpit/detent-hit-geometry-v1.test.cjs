'use strict';
/* Guard exact 737 Classic text-centered detent tap zones.
 * This runs without a browser, using the production geometry implementation.
 */
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const fit=require('./detent-hit-geometry-v1.js');
const read=p=>fs.readFileSync(path.join(__dirname,p),'utf8');
function extract(text,name){
 const match=text.match(new RegExp('const '+name+'=\\{([\\s\\S]*?)\\};'));
 if(!match)throw Error('MISSING_LITERAL_'+name);
 return vm.runInNewContext('({'+match[1]+'})');
}
function printed(text){
 const match=text.match(/const PRINTED=Object\.freeze\(\{([\s\S]*?)\}\);/);
 if(!match)throw Error('MISSING_PRINTED_AUTOBRAKE');
 return vm.runInNewContext('({'+match[1]+'})');
}
function assertDisjoint(boxes){
 for(let i=0;i<boxes.length;i++)
  for(let j=i+1;j<boxes.length;j++)
   assert.equal(fit.overlaps(boxes[i],boxes[j]),false,
    'touch zones must never overlap '+boxes[i].id+'/'+boxes[j].id);
 for(const box of boxes){
  assert(fit.at(box,box.cx,box.cy),'center of printed legend must select itself '+box.id);
  assert(box.paddingPx>=0&&box.paddingPx<=5,'at most five CSS px padding');
 }
}
const fixed=['RTO','OFF','1','2','3','MAX'];
for(const [kind,file] of [['EIS','eis-autobrake-physical-v1.js'],['CONVENTIONAL','conventional-physical-controls-v1.js']]){
 test(kind+' autobrake printed labels are independently touchable at wide and narrow scales',()=>{
  const src=read(file),P=printed(src);
  assert.deepEqual(Object.keys(P).sort(),fixed.slice().sort());
  assert.match(src,/B737DetentHitGeometryV1/);
  assert.match(src,/geometry\.build\(/);
  assert.match(src,/printed-label-tap/);
  for(const diameter of [24,36,80,105,160]){
   const specs=Object.entries(P).map(([id,[dx,dy,w,h]])=>
    ({id,cx:300+dx*diameter,cy:300+dy*diameter,w:w*diameter,h:h*diameter}));
   const boxes=fit.build(specs,{paddingPx:5});
   assert.equal(boxes.length,6);
   assertDisjoint(boxes);
  }
 });
}
test('CAPT and FO EFIS mode/range hit rectangles match exact source photo labels and never overlap',()=>{
 const src=read('efis-pedestal-raster-v1.js');
 const modes=extract(src,'MODE_HITS'),ranges=extract(src,'RANGE_HITS');
 const texts=extract(src,'LABEL_HIT_SIZE');
 const geometry=Object.entries({mode:modes,range:ranges}).flatMap(([kind,loc])=>
  Object.entries(loc).map(([value,[cx,cy]])=>{
   const [w,h]=texts[kind][value];
   return {id:kind+':'+value,kind,value,cx,cy,w,h};
  }));
 assert.equal(geometry.length,13);
 for(const width of [275,365,730,900,1100]){
  const height=width*1086/1448;
  const boxes=fit.build(geometry,{scaleX:width/1448,scaleY:height/1086,paddingPx:5});
  assert.equal(boxes.length,13);
  assertDisjoint(boxes);
  assert.deepEqual(boxes.map(x=>x.id).sort(),geometry.map(x=>x.id).sort());
 }
 assert.match(src,/new root\.ResizeObserver\(fitTextHitAreas\)/);
 assert.match(src,/const hitButtons=new Map\(\)/);
 assert.doesNotMatch(src,/panel\.addEventListener\('click',event=>\{/,
  'No whole-face detent guessing or invisible broad fallback');
 assert.match(src,/change\(seat,kind,spec\.value\)/,'direct seat-specific detent command');
 const css=read('efis-pedestal-raster-v1.css');
 assert.match(css,/\.uefis-detent:hover\{opacity:0/,'mouse hover never reveals invisible halos');
});
test('Nearest printed label selector returns a unique answer and never invents a detent off-label',()=>{
 const source=read('efis-pedestal-raster-v1.js');
 assert.match(source,/function nearestLabel\(/);
 assert.match(source,/geometry\.at\(box,x,y\)/);
 const a=fit.build([{id:'1',cx:10,cy:10,w:8,h:8},{id:'2',cx:40,cy:10,w:8,h:8}],{paddingPx:5});
 assert.equal(a.filter(x=>fit.at(x,10,10)).length,1);
 assert.equal(a.filter(x=>fit.at(x,40,10)).length,1);
 assert.equal(a.filter(x=>fit.at(x,25,25)).length,0);
});
