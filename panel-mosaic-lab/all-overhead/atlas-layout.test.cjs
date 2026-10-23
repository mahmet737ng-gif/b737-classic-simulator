'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=__dirname;
const atlas=JSON.parse(fs.readFileSync(path.join(root,'atlas-layout.json'),'utf8'));
const spec=JSON.parse(fs.readFileSync(path.join(root,'spec.json'),'utf8'));
const stage=fs.readFileSync(path.join(root,'stage.js'),'utf8');
const css=fs.readFileSync(path.join(root,'style.css'),'utf8');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
assert.deepEqual(atlas.canvas,{width:2220,height:3525});
assert.equal(atlas.placements.length,spec.images.length,'exactly one absolute plate per source PNG');
assert.equal(atlas.placements.length,18);
assert.deepEqual(new Set(atlas.placements.map(x=>x.id)),new Set(spec.images.map(x=>x.id)));
assert.equal(spec.version,'UPD-0009-atlas-absolute');
assert.equal(spec.coordinateLayout,'atlas-layout.json');
const placements=new Map(atlas.placements.map(x=>[x.id,x]));
assert.equal(placements.get('UPPER').y+placements.get('UPPER').h,1022);
assert.equal(atlas.firstLowerRowY,1031);
const columns=[
 ['OH07-08','OH09'],
 ['OH10','OH11','OH12'],
 ['OH13','OH14','OH18'],
 ['OH15','OH16','OH17','OH19-VOICE','OH19-DIFF'],
 ['OH20','OH21','OH22']
];
for(let i=0;i<columns.length;i++){
 const names=columns[i],column=atlas.physicalColumns[i];
 for(let k=0;k<names.length;k++){
  const p=placements.get(names[k]);
  assert.ok(p, 'missing '+names[k]);
  assert.equal(p.x,column.x,'atlas column x '+names[k]);
  assert.equal(p.w,column.width,'atlas physical column width '+names[k]);
  assert.ok(p.y>=atlas.firstLowerRowY,'lower region starts below top');
  if(k)assert.ok(p.y>=placements.get(names[k-1]).y+placements.get(names[k-1]).h,'no overlap '+names[k]);
 }
 const last=placements.get(names.at(-1));
 assert.equal(last.y+last.h,atlas.lowerSharedEdgeY,'all five columns have IDENTICAL lower edge');
}
assert.equal(atlas.lowerSharedEdgeY,3276,'pixel-true atlas lower alignment');
const footer=placements.get('OH23-25');
assert.equal(footer.y,atlas.bottomStripTopY);
assert.equal(footer.y,3281);
assert.equal(footer.x,3);
assert.equal(footer.w,2214);
assert.equal(footer.y+footer.h,3522);
for(const p of atlas.placements){
 assert.ok(Number.isInteger(p.x)&&Number.isInteger(p.y)&&Number.isInteger(p.w)&&Number.isInteger(p.h));
 assert.ok(p.w>0&&p.h>0);
 assert.ok(p.x>=0&&p.y>=0&&p.x+p.w<=2220&&p.y+p.h<=3525);
}
assert.ok(fs.existsSync(path.resolve(root,atlas.reference.image)),'original atlas referenced by viewer exists');
assert.ok(html.includes('id="atlasAbsolute"'));
assert.ok(html.includes('stage.js?v=UPD-0009-atlas-native-coordinates'));
assert.ok(stage.includes("fetch('./atlas-layout.json?ts='"),'new renderer requires atlas geometry');
assert.ok(stage.includes("style.height=place.h+'px'"),'source image natural height cannot change atlas plate height');
assert.ok(stage.includes("style.height=atlasLayout.canvas.height+'px'"),'atlas board has fixed real pixel height');
assert.ok(css.includes('.atlas-piece{position:absolute'),'no stacked column sizing');
assert.ok(css.includes('object-fit:cover')||stage.includes("objectFit:'cover'"),'source photo proportions preserved');
console.log('PASS: 18 source photos all absolute in 2220x3525 atlas, 5 exactly matching baseline edges y=3276, shared bottom strip y=3281, no overlaps, no legacy stacked layout.');
