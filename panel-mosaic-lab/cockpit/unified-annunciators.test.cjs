'use strict';
/* Node: node panel-mosaic-lab/cockpit/unified-annunciators.test.cjs */
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {test}=require('node:test');
const root=path.resolve(__dirname,'../assets/locked/2026-10-23/LIGHTS');
const registry=JSON.parse(fs.readFileSync(path.resolve(__dirname,'../lights-test/registry.json'),'utf8'));
const model=require('../lights-test/asset-model.js');
test('all unified gallery annunciators resolve real local state files',()=>{
 assert.ok(registry.lights.length>0);
 const ids=new Set();let files=0;
 for(const light of registry.lights){
  assert.equal(ids.has(light.id),false,'duplicate '+light.id);ids.add(light.id);
  assert.equal(light.defaultState,'OFF');
  assert.ok(light.states.includes('OFF'));
  assert.ok(light.states.some(s=>s!=='OFF'));
  assert.deepEqual(light.states.filter(s=>!light.assets[s]),[],'missing mapped state '+light.id);
  for(const state of light.states){
   const relative=light.assets[state];
   assert.match(relative,/^[A-Za-z0-9_./-]+\.svg$/);
   assert.equal(relative.includes('..'),false);
   const file=path.resolve(root,relative);
   assert.ok(file.startsWith(root+path.sep),'invalid path '+relative);
   assert.ok(fs.existsSync(file),'absent '+relative);
   const svg=fs.readFileSync(file,'utf8');
   assert.match(svg,/<svg\b/);
   assert.match(svg,new RegExp('width="'+light.face.width+'"'));
   assert.match(svg,new RegExp('height="'+light.face.height+'"'));
   files++;
  }
 }
 const merged=model.merge(registry);
 assert.equal(merged.length,registry.lights.length);
 assert.equal(new Set(merged.map(x=>x.id)).size,registry.lights.length);
 assert.ok(files>=registry.lights.length*2);
 console.log('Unified annunciator library:',registry.lights.length,'types;',files,'existing SVG state faces');
});
test('Unified loads canonical library without relying on external GitHub API',()=>{
 const js=fs.readFileSync(path.join(__dirname,'unified-lights.js'),'utf8');
 const html=fs.readFileSync(path.join(__dirname,'index.html'),'utf8');
 assert.match(js,/fetch\('../lights-test\/registry\.json/);
 assert.match(js,/sync\(\{renderNow:false,force:false\}\)/);
 assert.match(js,/whenReady:/);
 assert.match(html,/id="unifiedLightsOpen"/);
 assert.match(html,/unified-lights\.js\?v=LGT-0021/);
});
