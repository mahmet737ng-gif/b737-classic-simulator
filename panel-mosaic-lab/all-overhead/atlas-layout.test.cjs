'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const root=__dirname;
const atlas=JSON.parse(fs.readFileSync(path.join(root,'atlas-layout.json'),'utf8'));
const spec=JSON.parse(fs.readFileSync(path.join(root,'spec.json'),'utf8'));
const stage=fs.readFileSync(path.join(root,'stage.js'),'utf8');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
assert.deepEqual(atlas.canvas,{width:2220,height:3525});
assert.equal(spec.images.length,18,'original GitHub locked sources remain eighteen');
assert.equal(atlas.placements.length,19,'one source OH07-08 is correctly split into two separate atlas slots');
assert.equal(atlas.version,'UPD-0011-visual-atlas-mapping');
assert.equal(spec.version,'UPD-0011-atlas-photo-order');
const sources=new Set(spec.images.map(x=>x.id)),mapped=new Map(atlas.placements.map(x=>[x.id,x]));
assert.equal(mapped.size,19,'each physical artwork slot unique');
for(const p of atlas.placements){
 assert.ok(sources.has(p.sourceId),'source-backed physical panel: '+p.id);
 assert.ok(Number.isInteger(p.x)&&Number.isInteger(p.y)&&Number.isInteger(p.w)&&Number.isInteger(p.h));
 assert.ok(p.x>=0&&p.y>=0&&p.x+p.w<=2220&&p.y+p.h<=3525);
 assert.ok(p.sourceDimensions?.length===2);
 const sr=p.sourceRect||{x:0,y:0,w:p.sourceDimensions[0],h:p.sourceDimensions[1]};
 const cp=p.contentCrop||{left:0,top:0,right:0,bottom:0};
 assert.ok(sr.x>=0&&sr.y>=0&&sr.x+sr.w<=p.sourceDimensions[0]&&sr.y+sr.h<=p.sourceDimensions[1],'sub-crop fits source '+p.id);
 assert.ok(sr.w-cp.left-cp.right>0&&sr.h-cp.top-cp.bottom>0);
 assert.ok(p.atlasPanelIds.length>0);
}
assert.deepEqual([mapped.get('OH07').y,mapped.get('OH07').h],[1031,1244]);
assert.deepEqual([mapped.get('OH08').y,mapped.get('OH08').h],[2280,244]);
assert.deepEqual([mapped.get('OH09').y,mapped.get('OH09').h],[2529,747]);
assert.equal(mapped.get('OH07').sourceId,mapped.get('OH08').sourceId,'OH07 and OH08 share the same immutable source PNG');
assert.equal(mapped.get('OH08').sourceRect.y,1216,'split nav selectors at original source physical plate boundary');
const groupNames=atlas.physicalColumns.map(c=>c.ids);
assert.deepEqual(groupNames,[['OH07','OH08','OH09'],['OH10','OH11','OH12'],['OH13','OH14','OH18'],['OH15','OH16','OH17','OH19-VOICE','OH19-DIFF'],['OH20','OH21','OH22']]);
for(const c of atlas.physicalColumns){
 for(let i=0;i<c.ids.length;i++){
  const p=mapped.get(c.ids[i]);
  assert.equal(p.x,c.x);assert.equal(p.w,c.width);
  if(i)assert.ok(mapped.get(c.ids[i-1]).y+mapped.get(c.ids[i-1]).h<p.y,'physical plate strips must not overlap: '+p.id);
 }
 assert.equal(mapped.get(c.ids.at(-1)).y+mapped.get(c.ids.at(-1)).h,3276,'all five columns meet bottom edge');
}
assert.deepEqual(mapped.get('OH18').atlasPanelIds,['OH-14'],'ground call / wiper belongs to atlas OH14 center strip');
assert.deepEqual(mapped.get('OH19-VOICE').atlasPanelIds,['OH-18'],'recorder is physical OH18');
assert.deepEqual(mapped.get('OH19-DIFF').atlasPanelIds,['OH-19'],'press differential is physical OH19');
assert.deepEqual([mapped.get('OH23-25').x,mapped.get('OH23-25').y,mapped.get('OH23-25').w],[3,3281,2214]);
assert.ok(fs.existsSync(path.resolve(root,atlas.reference.image)));
assert.ok(html.includes('id="atlasAbsolute"'));
assert.ok(html.includes('stage.js?v=UPD-0011-atlas-true-order'));
assert.ok(stage.includes('place.sourceRect||{x:0,y:0,w:sourceW,h:sourceH}'),'source rect split supported');
assert.ok(stage.includes("frame.dataset.atlasId"),'real atlas labels are not guessed from old filenames');
console.log('PASS: 19 atlas-correct displayed source plate slots from 18 immutable PNGs; split OH07/OH08, real OH14 Ground Call, true OH18/19, all bottom aligned.');
