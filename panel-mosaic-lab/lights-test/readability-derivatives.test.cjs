'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'../..'),readFile=p=>fs.readFileSync(path.join(root,p),'utf8');
const read=p=>JSON.parse(readFile(p)),sha=s=>crypto.createHash('sha256').update(s).digest('hex');
const manifest=read('panel-mosaic-lab/lights-test/readability-derivatives-v1.json');
assert.equal(manifest.states.length,12);assert.equal(manifest.originalPhotoChanges,0);
assert.equal(manifest.originalArtworkChanges,0);
for(const scope of ['interactive-overhead','cockpit']){
 const reg=read('panel-mosaic-lab/'+scope+'/lights.json');
 const over=read('panel-mosaic-lab/'+scope+'/readability-faces.json');
 assert.equal(over.sourceRegistrationVersion,reg.version);
 for(const [id,face] of Object.entries(over.instances)){
  const lamp=reg.lights.find(x=>x.id===id);assert.ok(lamp,id);
  assert.equal(lamp.asset,face.asset);assert.deepEqual(lamp.sourceRect,face.sourceRect);
  assert.deepEqual(Object.keys(face.states).sort(),Object.keys(reg.assets[lamp.asset]).sort(),id);
 }
}
for(const f of manifest.states){
 const src=readFile(f.originalSource),dst=readFile(f.derived),srcText=[...src.matchAll(/<text\b[^>]*>(.*?)<\/text>/gs)].map(x=>x[1]),dstText=[...dst.matchAll(/<text\b[^>]*>(.*?)<\/text>/gs)].map(x=>x[1]);
 assert.deepEqual(dstText,srcText,'Do not change letters or line count '+f.id);
 assert.equal(sha(src),f.originalSha256);
 assert.equal(sha(dst),f.derivedSha256);
 assert.ok(!f.derived.includes('/locked/'));
 assert.doesNotMatch(dst,/transform="scale\(/);
 const r=read('panel-mosaic-lab/'+(f.scope==='main'?'cockpit':'interactive-overhead')+'/readability-faces.json');
 assert.equal(r.instances[f.id].states[f.state].sha256,f.derivedSha256);
}
console.log('PASS: 6 lamp face readability overrides/12 states; exact legends and input SHA, immutable source photos, unchanged physical positions.');
