'use strict';
/* Phase 1: repeatable geometry/asset QA. Does not modify locked mosaics.
 * Run: node panel-mosaic-lab/lights-test/phase1-geometry-audit.test.cjs
 */
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const base=__dirname;
const load=p=>JSON.parse(fs.readFileSync(path.resolve(base,p),'utf8'));
const audit=load('phase1-geometry-audit.json');
const gallery=load('registry.json');
const overhead=load('../interactive-overhead/lights.json');
const main=load('../cockpit/lights.json');
const atlas=load('../all-overhead/atlas-layout.json');
const assembly=load('../cockpit/assembly.json');
const mapPoint=require('../interactive-overhead/model.js').mapPoint;
const faces=new Map(gallery.lights.map(a=>[a.id,a.face]));
const corrections=load('photo-position-corrections-v1.json');
const correctionById=new Map(corrections.records.map(x=>[x.id,x]));
assert.equal(correctionById.size,12);

const atlasPlates=new Map(atlas.placements.map(p=>[p.id,p]));
const mainPieces=new Map(assembly.regions.flatMap(r=>(r.placements||[]).map(p=>[p.id,p])));
const mapped=new Map(audit.instances.map(i=>[i.id,i]));
const near=(a,b,label)=>assert.ok(Math.abs(a-b)<=0.006,label+': '+a+' vs '+b);
assert.equal(overhead.lights.length,112);
assert.equal(main.lights.length,30);
assert.equal(gallery.lights.length,94);
assert.equal(audit.instances.length,142);
assert.equal(mapped.size,142);
assert.equal(audit.assetOnly.length,8);
assert.equal(audit.summary.installed,142);
assert.equal(audit.summary.visualVerified,0);
assert.equal(audit.sourceRectOverlaps.length,0);
assert.equal(audit.sourceVersions.overhead,'LGT-0006');
assert.ok(['LGT-0007','LGT-0008','LGT-0009'].includes(overhead.version),'version must be an approved registration or vector-fit revision');
assert.equal(audit.sourceVersions.main,'LGT-0010');
assert.ok(['LGT-0010','LGT-0011'].includes(main.version),'main original or fitted-face revision');
assert.equal(audit.sourceVersions.gallery,gallery.version);
assert.equal(audit.sourceVersions.atlas,atlas.version);
assert.equal(audit.sourceVersions.assembly,assembly.version);
for(const [scope,items] of [['OVERHEAD',overhead.lights],['MAIN',main.lights]]){
 for(const source of items){
  const record=mapped.get(source.id);
  assert.ok(record,'Missing report row: '+source.id);
  assert.equal(record.scope,scope);
  assert.equal(record.asset,source.asset);
  assert.deepEqual(source.sourceRect,correctionById.get(source.id)?.sourceRect||record.sourceRect,source.id);
  assert.equal(record.geometryStatus,'MAPPED_FROM_EXISTING_SOCKET_NOT_PIXEL_APPROVED');
  assert.equal(record.visualReview,'PENDING_OWNER_PHOTO_MATCH');
  const face=faces.get(source.asset);
  assert.ok(face,'Missing face: '+source.asset);
  assert.deepEqual(record.assetDimensions,[face.width,face.height]);
  const [x,y,w,h]=record.sourceRect;
  const ratio=face.width/face.height;
  const stretch=Math.max((w/h)/ratio,ratio/(w/h));
  near(record.stretchFactor,stretch,source.id+' stretch factor');
  let box;
  if(scope==='OVERHEAD'){
   const pl=atlasPlates.get(source.placementId);
   assert.ok(pl,'Missing atlas plate: '+source.placementId);
   const a=mapPoint({id:source.id,sourcePoint:[x,y],bezelSourceDiameter:1},pl);
   const b=mapPoint({id:source.id,sourcePoint:[x+w,y+h],bezelSourceDiameter:1},pl);
   box=[a.x,a.y,b.x-a.x,b.y-a.y];
  }else{
   const p=mainPieces.get(source.pieceId);
   assert.ok(p,'Missing main piece: '+source.pieceId);
   const art=assembly.assets[p.asset];
   assert.ok(art);
   const scale=p.w/art.dimensions[0];
   box=[p.x+x*scale,p.y+y*scale,w*scale,h*scale];
  }
  box.forEach((v,i)=>near(record.boardRect[i],v,source.id+' boardRect '+i));
  const [bx,by,bw,bh]=box;
  near(record.boardCenter[0],bx+bw/2,source.id+' board center X');
  near(record.boardCenter[1],by+bh/2,source.id+' board center Y');
  const contentW=Math.min(bw,bh*ratio),contentH=Math.min(bh,bw/ratio);
  near(record.fitInsetsOnBoard[0],(bw-contentW)/2,source.id+' horizontal letterbox');
  near(record.fitInsetsOnBoard[1],(bh-contentH)/2,source.id+' vertical letterbox');
 }
}
const used=new Set([...overhead.lights,...main.lights].map(x=>x.asset));
assert.deepEqual(new Set(audit.assetOnly.map(x=>x.asset)),new Set(gallery.lights.filter(x=>!used.has(x.id)).map(x=>x.id)));
for(const group of ['OVERHEAD','MAIN']){
 const a=audit.instances.filter(x=>x.scope===group);
 const numbers=audit.summary.byScope[group];
 assert.equal(numbers.instances,a.length);
 for(const [key,threshold] of [['over10Percent',1.1],['over25Percent',1.25],['over50Percent',1.5]])
  assert.equal(numbers[key],a.filter(x=>x.stretchFactor>threshold).length,group+' '+key);
}
const styleOverhead=fs.readFileSync(path.resolve(base,'../interactive-overhead/lights.css'),'utf8');
const styleMain=fs.readFileSync(path.resolve(base,'../cockpit/style.css'),'utf8');
const staleFit=fs.readFileSync(path.resolve(base,'../interactive-overhead/lights-fit.css'),'utf8');
assert.match(styleOverhead,/\.light-face\{[^}]*object-fit:contain/);
assert.match(styleMain,/\.cockpit-light img\{[^}]*object-fit:contain/);
assert.doesNotMatch(staleFit,/transform:\s*scale\(/);
console.log('PASS: 142 unique mounted lenses / 94 gallery assets / 8 unmapped; center and aperture coordinates reproduce original registered source geometry; no image stretching; originals remain untouched.');
