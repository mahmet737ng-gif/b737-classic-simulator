'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const ROOT=path.resolve(__dirname,'../..'),read=p=>JSON.parse(fs.readFileSync(path.join(ROOT,p),'utf8'));
const sha=s=>crypto.createHash('sha256').update(s,'utf8').digest('hex');
const registry=read('panel-mosaic-lab/cockpit/lights.json'),m=read('panel-mosaic-lab/cockpit/typography-faces.json'),audit=read('panel-mosaic-lab/lights-test/main-type-audit-v1.json');
assert.equal(registry.lights.length,30);assert.equal(audit.records.length,60);
assert.equal(m.sourceRegistryVersion,registry.version);assert.equal(m.sourceImagesChanged,0);assert.equal(m.sourcePositionsChanged,0);
assert.equal(Object.keys(m.instances).length,30);
assert.equal(audit.sourcePhotosModified,0);
const line=s=>{const values=[...s.matchAll(/<text\b[^>]*>(.*?)<\/text>/gs)].map(x=>x[1]);for(let n=1;n<=4;n++)if(values.length%n===0&&values.every((x,i)=>x===values[i%n]))return values.slice(0,n);throw Error('inconsistent painted text')};
const viewed=new Set();
for(const row of audit.records){
 const reg=registry.lights.find(v=>v.id===row.id),entry=m.instances[row.id];
 assert.ok(reg&&entry,row.id);assert.deepEqual(reg.sourceRect,row.sourceRect);
 assert.deepEqual(entry.sourceRect,row.sourceRect);
 const original=fs.readFileSync(path.join(ROOT,row.source),'utf8');
 const revised=fs.readFileSync(path.join(ROOT,row.file),'utf8');
 assert.equal(sha(original),row.sourceSha256,row.id+' original hash');
 assert.equal(sha(revised),row.sha256,row.id+' derivative hash');
 assert.deepEqual(line(revised),line(original),row.id+' original words/order/case');
 assert.deepEqual(line(revised),row.legends,row.id+' auditable labels');
 const firstLineSet=[...revised.matchAll(/<text\\b[^>]*>.*?<\\/text>/gs)].slice(0,row.legends.length);
 assert.equal(firstLineSet.length,row.legends.length);
 for(let i=0;i<row.legends.length;i++){
  const text=firstLineSet[i][0],font=Number(text.match(/font-size="([\\d.]+)"/)[1]);
  assert.equal(font,row.targetSizes[i],row.id+' size must be bound to actual line '+i+' not regex character offset');
  assert.ok(text.includes('>'+row.legends[i]+'</text>'),row.id+' label and font association');
 }

 assert.ok(row.targetSizes.length===row.legends.length);
 assert.equal(row.sourcePhotoModified,false);assert.equal(row.sourceRectModified,false);
 assert.ok(revised.includes('data-fit="mip-native-ratio-no-letter-stretch"'));
 assert.ok(!revised.includes('transform="scale('));
 const tag=revised.match(/^<svg\b[^>]*>/)?.[0];assert.ok(tag);
 const w=+tag.match(/width="([\d.]+)"/)[1],h=+tag.match(/height="([\d.]+)"/)[1],
       vb=tag.match(/viewBox="0 0 ([\d.]+) ([\d.]+)"/);
 assert.equal(w,row.sourceRect[2]);assert.equal(h,row.sourceRect[3]);
 assert.ok(Math.abs((+vb[1]/+vb[2])-w/h)<1e-5,'correct native ratio '+row.id);
 const key=row.id+'|'+row.state;assert.ok(!viewed.has(key));viewed.add(key);
 assert.equal(entry.states[row.state].sha256,row.sha256);
 assert.deepEqual(Object.keys(entry.states).sort(),['OFF','ON']);
}
assert.equal(viewed.size,60);
const visual=fs.readFileSync(path.join(ROOT,'panel-mosaic-lab/cockpit/lights.js'),'utf8');
assert.match(visual,/typographyFaces\?\.instances/,'Unified render must prefer family-standard-derived font artwork');
console.log('PASS: All 30 main-panel positions / 60 OFF-ON images, source words, native ratio, original hashes, family standards, model positions unchanged.');
