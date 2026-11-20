'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.join(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const base='panel-mosaic-lab/cockpit/';
const js=read(base+'unified-workspace-v1.js');
const css=read(base+'unified-workspace-v1.css');

test('FCOM Test Labs use visible explicit accordions, not clipped native details',()=>{
 assert.match(js,/function setGroupOpen\(section,open\)/);
 assert.match(js,/element\('section','workspace-group'/);
 assert.match(js,/element\('button','workspace-group-trigger'/);
 assert.doesNotMatch(js,/element\('details','workspace-group'/);
 assert.match(js,/SHOW ALL LABS/);
 assert.match(js,/COLLAPSE ALL/);
 assert.match(js,/setGroupOpen\(section,true\)/);
 assert.match(js,/setGroupOpen\(section,opening\)/);
 assert.match(css,/\.workspace-group-content:not\(\[hidden\]\)/);
 assert.match(css,/\.workspace-group-content\[hidden\]\{display:none!important\}/);
 assert.match(css,/\.workspace-lab-area\{[\s\S]*?display:flex!important/);
 assert.match(js,/item\.hidden=!match/);
});

test('all registered standalone test lab destinations exist at the exact cockpit-base URL',()=>{
 const part=js.split('const LABS=[')[1]?.split('];')[0];
 assert.ok(part,'Missing standalone test lab registry');
 const rows=[...part.matchAll(/\[(\d+),'([^']+)','([^']+)'\]/g)]
  .map(match=>({chapter:Number(match[1]),name:match[2],href:match[3]}));
 assert.equal(rows.length,37,'Review source and new links before changing the expected count');
 for(const row of rows){
  assert.ok(row.chapter>=1&&row.chapter<=15,row.name);
  if(row.href.startsWith('#')){
   assert.equal(row.href,'#flightFuelService');
   continue;
  }
  const normalized=row.href.endsWith('/')?row.href+'index.html':row.href;
  const target=new URL(normalized,'https://test.invalid/'+base+'index.html');
  const disk=path.join(root,decodeURI(target.pathname.slice(1)));
  assert.ok(fs.existsSync(disk),'Registered lab is missing: '+row.name+' ('+target.pathname+')');
 }
});

test('all 26 overhead test labs are bundled and discoverable in their FCOM chapters',()=>{
 const encoded=js.match(/const OVERHEAD_MENU_LABS=(\[[\s\S]*?\]);/);
 assert.ok(encoded,'Missing prebundled overhead catalog');
 const list=vm.runInNewContext('('+encoded[1]+')');
 const actual=JSON.parse(read(base+'overhead-test-labs-catalog-v1.json')).panels;
 assert.equal(list.length,actual.length);
 assert.equal(actual.length,26);
 assert.deepEqual([...list.map(row=>row[0])].sort(),actual.map(row=>row.id).sort());
 assert.match(js,/OVERHEAD_CHAPTER=Object\.freeze/);
 assert.match(js,/for\(const \[id,title\] of OVERHEAD_MENU_LABS\)addOverheadMenuItem/);
 assert.match(js,/api\.open\(id\)/,'Overhead entry must open live test modal');
 assert.match(js,/await new Promise\(resolve=>win\.setTimeout/,'Overhead entry must await lazy runtime');
 assert.ok(list.some(row=>row[0]==='OH04'));
 assert.ok(list.some(row=>row[0]==='OH25'));
});
