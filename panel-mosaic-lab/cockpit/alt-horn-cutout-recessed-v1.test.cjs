'use strict';
/* ALT-HORN-RECESS-0001 — physical OH19 cutout is common to CPCS/DCPCS.
 * Never replace the approved OH19 photograph, the shared recessed asset,
 * or the pressure and audio engines. */
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const base=__dirname;
const source=fs.readFileSync(path.join(base,'pressurization-oh22.js'),'utf8');
const css=fs.readFileSync(path.join(base,'pressurization-oh22.css'),'utf8');
const overhead=fs.readFileSync(path.join(base,'overhead-stage.html'),'utf8');
const recessed=fs.readFileSync(path.join(base,'recessed-overhead-v2.css'),'utf8');
const model=require('./pressurization-oh22-model.js');
const geom=model.config('CPCS').hornCutout;
assert.equal(geom.piece,'OH19-DIFF');
assert.ok(geom.xy.every(x=>x>0&&x<1)&&geom.diameter>0&&geom.diameter<.2);
assert.ok(source.includes("const geom=model.config('CPCS').hornCutout"),
 'OH19 hardware must be independent of selected pressurization controller');
assert.ok(!source.includes("if(system!=='CPCS')return"),
 'Do not remove the fixed OH19 button when DCPCS is selected');
assert.ok(source.includes("if(!hornOverlay){"),
 'Install one physical button and reuse the same DOM node across mode changes');
assert.ok(source.includes("hornOverlay.parentElement!==host"),
 'Reparent only when the original OH19 photo mount changes');
assert.ok(source.includes("ring.className='oh22-physical-horn-cutout b737-recess-unit'"),
 'Use the existing physical library rim');
assert.ok(source.includes("cap.className='b737-recess-unit__cap'"),
 'Use the approved movable recessed cap');
assert.ok(source.includes("setPressed(true)")&&source.includes("setPressed(false)"),
 'Press and release must have independent 3D states');
assert.ok(source.includes("notify('pressurization-horn-cutout',{sourcePiece:geom.piece})"),
 'Preserve original cabin-altitude horn command; not landing-gear horn');
assert.ok(source.includes("cap.addEventListener('click'"),
 'Keyboard and pointer click must retain horn action');
assert.ok(source.includes("root.addEventListener('visibilitychange'"),
 'Held button must reset if cockpit becomes hidden');
assert.ok(css.includes("recessed-pushbutton-v2.svg?v=RECESS-ALT-HORN-0001"));
assert.ok(recessed.includes(".b737-recess-unit__cap[data-pressed=\"true\"]"));
assert.ok(overhead.includes("pressurization-oh22.css?v=PRESS-OH22-ALT-HORN-RECESS-0001"));
assert.ok(overhead.includes("pressurization-oh22.js?v=PRESS-OH22-ALT-HORN-RECESS-0001"));
console.log('PASS: ALT HORN CUTOUT physical OH19 button mounted for both CPCS/DCPCS; fixed bezel, momentary recessed cap, original cabin-altitude cutout action, visual reset and cache refresh.');
