'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '..');
const read = p => JSON.parse(fs.readFileSync(path.join(root,p),'utf8'));
const bindings = read('engine/maps/lht-ata-unified-bindings-v1.json');
const systemMap = read('engine/maps/technical-database-systems-panels.v1.json');
const toggles = read('panel-mosaic-lab/interactive-overhead/registry.json');
const rotaries = read('panel-mosaic-lab/interactive-overhead/rotary-guards.json');
const lights = read('panel-mosaic-lab/interactive-overhead/lights.json');
test('23 source sections retain the original 2813 physical pages without gaps', () => {
  assert.equal(bindings.sections.length,23);
  let last = 0;
  for(const s of bindings.sections){assert.equal(s.pdf_pages.start,last+1);assert.ok(s.pdf_pages.end>=s.pdf_pages.start);last=s.pdf_pages.end;}
  assert.equal(last,2813);
  assert.equal(new Set(bindings.sections.map(s=>s.section_id)).size,23);
});
test('every subsystem box and observed control port exists in the actual Unified registries',()=>{
  const subs = new Map(systemMap.subsystems.map(s=>[s.id,s.boxes]));
  const control = {toggle: new Set(toggles.controls.map(s=>s.id)),rotary:new Set(rotaries.rotaries.map(s=>s.id)),lamp:new Set(lights.lights.map(s=>s.id))};
  for(const section of bindings.sections){
    for(const item of section.subsystems){assert.ok(subs.has(item.id),item.id);assert.deepEqual(item.region_ids,subs.get(item.id),item.id);}
    for(const p of section.control_ports)assert.ok(control[p.kind]?.has(p.id),p.kind+':'+p.id);
  }
});
test('source never masquerades as validated flight control laws; 737-300/500 cargo applicability isolated',()=>{
  assert.equal(bindings.policy.read_only,true);assert.equal(bindings.policy.no_control_laws_created,true);
  assert.equal(bindings.policy.source_pdf_not_distributed,true);
  assert.ok(bindings.sections.find(x=>x.section_id==='section-22').variant_scope.includes('300/500'));
  assert.deepEqual(bindings.sections.find(x=>x.section_id==='section-08').subsystems.map(x=>x.id),['ICE.WING_AICE']);
  assert.equal(bindings.sections.find(x=>x.section_id==='section-10').subsystems.length,0);
});
test('Unified mounts read-only browser exactly once, without replacing existing cockpit controls',()=>{
  const page=fs.readFileSync(path.join(root,'panel-mosaic-lab/cockpit/index.html'),'utf8');
  assert.equal(page.split('lht-ata-unified-browser-v1.js').length-1,1);
  assert.ok(page.includes('id="cbPanelOpen"'));
  assert.ok(page.includes('irs-13seg-display-v2.js?v=IRS-FILAMENT-0002'));
});