const assert=require('node:assert/strict');const fs=require('node:fs');const path=require('node:path');
const reg=JSON.parse(fs.readFileSync(path.join(__dirname,'../data/animation-registry.json')));
const {createRegistryEngine}=require('../motion-engine.js');
const motor=createRegistryEngine(reg);
assert.equal(reg.panels.EFIS.controls.length,14);assert.equal(reg.panels.MCP.controls.length,23);assert.equal(motor.size,37);
assert.equal(new Set(motor.ids).size,37);
for(const panel of Object.values(reg.panels))for(const c of panel.controls){assert.ok(c.source.section);assert.ok(c.source.pdf_page);assert.ok(c.motion.style);assert.ok(c.id.startsWith(c.panel+'.'));if(c.panel==='MCP')assert.equal(c.geometry.status,'not_yet_pixel_calibrated');if(c.motion.preview_step_degrees)assert.match(c.motion.visual_geometry,/non-certified/);}
assert.equal(reg.panels.MCP.controls.some(x=>x.id==='MCP.AP_DISENGAGE_BAR'),false);
assert.deepEqual(motor.spec('MCP.BANK_ANGLE_SELECTOR').state_model.values,[10,15,20,25,30]);
assert.equal(motor.spec('MCP.ALTITUDE_SELECTOR').physical_constraint,'FCOM states 100 ft increments');
assert.ok(motor.spec('EFIS.EHSI_RANGE').concentric);
for(const c of reg.panels.EFIS.controls)assert.equal(c.geometry.status,'mapped_from_source_figure');
console.log('PASS: 37 registry entries, source references, source-only physical constraints');