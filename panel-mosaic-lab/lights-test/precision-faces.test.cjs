'use strict';
/* CI release QA for nine derived, non-uniform-scaling-free annunciators. */
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'../..'),get=p=>fs.readFileSync(path.resolve(root,p),'utf8'),read=p=>JSON.parse(get(p));
const manifest=read('panel-mosaic-lab/lights-test/precision-faces-v1.json');
const overhead=read('panel-mosaic-lab/interactive-overhead/lights.json');
const main=read('panel-mosaic-lab/cockpit/lights.json');
assert.equal(manifest.selectedLamps,9);
assert.equal(manifest.derivedStates,18);
assert.equal(manifest.derivatives.length,18);
assert.ok(['PH2-FIT-0001','PH2-FIT-0002'].includes(overhead.faceFitRevision));
assert.ok(['PH2-FIT-0001','PH2-FIT-0002'].includes(main.faceFitRevision));
assert.equal(Object.keys(overhead.assets).length,68,'Do not create fake legend types');
assert.equal(Object.keys(main.assets).length,23,'Do not create fake main-panel types');
const seen=new Set();
for(const record of manifest.derivatives){
 const key=record.lamp+'_'+record.state;assert.ok(!seen.has(key));seen.add(key);
 const reg=record.lamp.startsWith('main-')?main:overhead;
 const lamp=reg.lights.find(l=>l.id===record.lamp);assert.ok(lamp,record.lamp);
 const [,,w,h]=lamp.sourceRect;
 assert.deepEqual(record.SVGRoot,[w,h]);
 const dest=record.derived,source=record.oldSource;
 assert.ok(!dest.includes('/locked/'),dest);
 assert.ok(source.includes('/locked/2026-10-23/LIGHTS/'),source);
 const output=get(dest),original=get(source);
 assert.match(output,/<g transform="translate\(([\d.]+) 0\)" data-fit="uniform-translation-only">/);
 assert.doesNotMatch(output,/<g transform="scale\(/);
 assert.deepEqual([...output.matchAll(/<text\b[^>]*>.*?<\/text>/gs)].map(m=>m[0]),
                  [...original.matchAll(/<text\b[^>]*>.*?<\/text>/gs)].map(m=>m[0]),key+' exact typography');
 const rootTag=output.match(/^<svg\b[^>]*>/)?.[0];assert.ok(rootTag,key);
 assert.match(rootTag,new RegExp('\\bwidth="'+w+'"'));
 assert.match(rootTag,new RegExp('\\bheight="'+h+'"'));
 const vb=rootTag.match(/viewBox="0 0 ([\d.]+) ([\d.]+)"/);assert.ok(vb);
 assert.ok(Math.abs(Number(vb[1])/Number(vb[2])-w/h)<1e-5,key+' aspect');
 assert.equal(reg.assets[lamp.asset][record.state].sha256,record.sha256);
 assert.equal(crypto.createHash('sha256').update(output).digest('hex'),record.sha256);
}
console.log('PASS: 9 mounted annunciators, 18 independently hash-verified ON/OFF SVG faces; original glyphs and locked assets unchanged, each vector face matches native socket ratio.');
