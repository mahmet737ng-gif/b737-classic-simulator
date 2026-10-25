'use strict';
/* Per-socket vectors must be loaded without changing the original model assets. */
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'../..');
const get=rel=>fs.readFileSync(path.resolve(root,rel),'utf8'),read=rel=>JSON.parse(get(rel));
const snapshot=read('panel-mosaic-lab/lights-test/instance-faces-rollout.json');
const contexts=[['overhead','panel-mosaic-lab/interactive-overhead'],['cockpit','panel-mosaic-lab/cockpit']];
assert.equal(snapshot.sourceArtworkModified,false);
assert.equal(snapshot.totalNewStates,74);
let mounted=0,states=0;
for(const [scope,directory] of contexts){
 const reg=read(directory+'/lights.json');
 const face=read(directory+'/instance-faces.json');
 const evidence=read('panel-mosaic-lab/lights-test/instance-faces-'+scope+'-evidence.json');
 const lights=new Map(reg.lights.map(c=>[c.id,c]));
 const originals=new Map(evidence.records.map(c=>[c.id+'_'+c.state,c]));
 const instances=Object.entries(face.instances);
 assert.equal(face.schema,'b737.lamps.instance-face.v1');
 assert.equal(face.originalImageEdits,0);
 assert.equal(instances.length,scope==='overhead'?35:2);
 assert.equal(reg.lights.length,scope==='overhead'?112:30);
 assert.equal(Object.keys(reg.assets).length,scope==='overhead'?68:23);
 for(const [id,entry] of instances){
  const c=lights.get(id);assert.ok(c,id);
  assert.equal(c.asset,entry.asset);
  assert.deepEqual(c.sourceRect,entry.sourceRect,id);
  const base=reg.assets[c.asset],labels=Object.keys(base);
  assert.deepEqual(Object.keys(entry.states).sort(),labels.sort(),id);
  mounted++;
  for(const state of labels){
   const e=originals.get(id+'_'+state),row=entry.states[state];
   assert.ok(e,id+' '+state);assert.deepEqual(e.sourceRect,entry.sourceRect);
   const src=get(e.source),derived=get(e.derived);
   const sig=crypto.createHash('sha256').update(src).digest('hex');
   assert.equal(sig,base[state].sha256,id+' frozen original '+state);
   assert.equal(crypto.createHash('sha256').update(derived).digest('hex'),row.sha256,id+' derived '+state);
   assert.equal(e.hash,row.sha256);
   const text=s=>[...s.matchAll(/<text\b[^>]*>.*?<\/text>/gs)].map(x=>x[0]);
   assert.deepEqual(text(src),text(derived),id+' preserve unscaled text');
   assert.match(derived,/data-fit="per-instance-translation-only"/);
   assert.doesNotMatch(derived,/transform="scale\(/);
   assert.ok(!e.derived.includes('/locked/'));
   const tag=derived.match(/^<svg\b[^>]*>/)?.[0];
   const [,,w,h]=entry.sourceRect;
   assert.ok(tag);assert.match(tag,new RegExp('\\bwidth="'+w+'"'));
   assert.match(tag,new RegExp('\\bheight="'+h+'"'));
   const box=tag.match(/viewBox="0 0 ([\d.]+) ([\d.]+)"/);assert.ok(box);
   assert.ok(Math.abs(Number(box[1])/Number(box[2])-w/h)<1e-5,id+' fit ratio');
   assert.equal(row.url,'../'+e.derived.replace('panel-mosaic-lab/','').replace(/^assets\//,'assets/').replace(/^[^/]+\//,''));
   states++;
  }
 }
}
assert.equal(mounted,37);assert.equal(states,74);
const overheadJS=get('panel-mosaic-lab/interactive-overhead/lights.js');
const mainJS=get('panel-mosaic-lab/cockpit/lights.js');
assert.match(overheadJS,/fetch\(url\('instance-faces\.json'\)/);
assert.match(mainJS,/fetch\(url\('instance-faces\.json'\)/);
assert.match(overheadJS,/instanceFaces\?\.instances/);
assert.match(mainJS,/instanceFaces\?\.instances/);
console.log('PASS: 37 independently fitting shared-annunciator instances / 74 signed light states, 68 + 23 original model assets intact; original source glyph and photographic aperture unchanged.');
