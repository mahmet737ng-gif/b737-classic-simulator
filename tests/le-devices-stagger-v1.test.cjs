'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
test('26 uniquely delayed LE windows, with unaffected actual sensor logic',()=>{
 const css=read('panel-mosaic-lab/le-devices/stagger-v1.css');
 const rules=[...css.matchAll(/path:nth-of-type\((\d+)\)\s*\{\s*--le-lamp-delay:\s*(\d+)ms;/g)];
 assert.equal(rules.length,26,'every LE window must receive its own delay');
 assert.deepEqual(rules.map(m=>+m[1]),Array.from({length:26},(_,i)=>i+1));
 assert.deepEqual([...new Set(rules.map(m=>+m[2]))].sort((a,b)=>a-b),Array.from({length:26},(_,i)=>i*4));
 assert.match(css,/transition-property:\s*fill;/);
 assert.doesNotMatch(css,/position:|transform:|width:|height:|pointer-events:/);
});
test('Unified and stand-alone trainer both load stagger style without mutating approved panel',()=>{
 const sources=[
  ['panel-mosaic-lab/cockpit/overhead-stage.html','../le-devices/stagger-v1.css?v=LE-STAGGER-0008'],
  ['panel-mosaic-lab/le-devices/index.html','./stagger-v1.css?v=LE-STAGGER-0008']
 ];
 for(const [p,stylesheet] of sources){
  const html=read(p);
  assert.ok(html.includes(stylesheet),p+' stagger style missing');
  assert.ok(html.includes('panel.js?v=LEDEV-0006'),p+' panel source must remain approved');
 }
});
