/* DCPCS-only blank fluted altitude knobs; no changes to mode selector or CPCS. */
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const src=fs.readFileSync(path.join(__dirname,'pressurization-oh22.js'),'utf8');
const image=fs.readFileSync(path.join(__dirname,'dcpcs-altitude-knob-front-v1.webp'));
const model=require('./pressurization-oh22-model.js');
assert.equal(image.subarray(0,4).toString('ascii'),'RIFF');
assert.equal(image.subarray(8,12).toString('ascii'),'WEBP');
assert.ok(src.includes("system==='DCPCS'&&c.kind==='altitude'&&(c.id==='flight-alt'||c.id==='landing-alt')"));
assert.ok(src.includes('dcpcsAltitudeKnob?dcpcsAltitudeKnobAsset:(c.kind')); // Retain all other knobs.
assert.deepEqual(model.config('DCPCS').controls.filter(x=>x.kind==='altitude').map(x=>x.id),['flight-alt','landing-alt']);
assert.deepEqual(model.config('DCPCS').controls.find(x=>x.id==='press-mode').states,['AUTO','ALTN','MAN']);
assert.equal(model.config('CPCS').controls.find(x=>x.id==='press-mode').states.length,4);
const base='https://example.org/b737-classic-simulator/panel-mosaic-lab/all-overhead/';
const scriptUrl=new URL('../cockpit/pressurization-oh22.js',base).href;
assert.equal(new URL('./dcpcs-altitude-knob-front-v1.webp',scriptUrl).pathname,'/b737-classic-simulator/panel-mosaic-lab/cockpit/dcpcs-altitude-knob-front-v1.webp');
assert.ok(src.includes("document.currentScript?.src||new URL('../cockpit/pressurization-oh22.js',document.baseURI).href"),'Asset must be script-relative, never overhead-base relative');
const stage=fs.readFileSync(path.join(__dirname,'overhead-stage.html'),'utf8');
assert.ok(stage.includes('PRESS-OH22-DCPCS-FLUTED-URL-FIX-0002'),'Updated script must bypass cached wrong asset path');
console.log('PASS: one shared unmarked DCPCS altitude knob asset; both setters targeted, mode selector unchanged');
