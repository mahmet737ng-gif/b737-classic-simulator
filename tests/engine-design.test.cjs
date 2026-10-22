'use strict';
/* Design-contract checks, not flight-physics/FCOM conformance tests. */
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'..');
const read=p=>JSON.parse(fs.readFileSync(path.join(root,p),'utf8'));
const hash='b6c206418feb44b43bd134cb57a51dddd8bbe928859382d3864f3fbcc5cbc1c8';
for(const name of ['control','event','state']){
 const schema=read('engine/spec/'+name+'.schema.json');
 assert.equal(schema.$schema,'https://json-schema.org/draft/2020-12/schema');
 assert.equal(schema.type,'object');
 assert.ok(schema.required.length>=4);
}
const catalog=read('engine/spec/control-catalog.example.json');
assert.equal(catalog.image.width,6424);
assert.equal(catalog.image.height,2212);
assert.equal(catalog.image.sha256,hash);
assert.equal(catalog.image.repositoryImport,'PENDING');
const ids=catalog.controls.map(x=>x.id);
assert.equal(new Set(ids).size,ids.length,'Unique control IDs required');
for(const c of catalog.controls){
 assert.equal(c.geometry.imageSha256,hash);
 assert.equal(c.geometry.nativeWidth,6424);
 assert.equal(c.geometry.nativeHeight,2212);
 assert.ok(c.positions.includes(c.initial),'Initial state must be a listed detent');
 assert.match(c.reference.section,/[0-9]+[.][0-9]+/);
 assert.equal(c.status,'DRAFT','Example devices must not claim completed FCOM validation');
}
const gear=catalog.controls.find(c=>c.id==='landing-gear-lever');
const autobrake=catalog.controls.find(c=>c.id==='autobrake-selector');
assert.deepEqual(gear.positions,['UP','OFF','DN']);
assert.deepEqual(autobrake.positions,['RTO','OFF','1','2','3','MAX']);
assert.equal(autobrake.mechanics.guard,'pull-required');
const blueprint=fs.readFileSync(path.join(root,'docs/ENGINE_BLUEPRINT.md'),'utf8');
const tasks=fs.readFileSync(path.join(root,'docs/ENGINE_TASKS.md'),'utf8');
assert.ok(blueprint.includes(hash),'The artwork identity must be immutable');
for(const id of ['ENG-000','ENG-001','ENG-002','ENG-005','ENG-011','ENG-012','ENG-025']){
 assert.ok(tasks.includes(id),'Missing delivery task '+id);
}
console.log('Engine design contracts: OK (schema structural checks, catalog invariants, manual provenance, task ledger; no aircraft behavior validated)');
