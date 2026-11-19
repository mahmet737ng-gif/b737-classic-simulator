'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'../..');
const directory='panel-mosaic-lab/assets/locked/2026-10-23/Switches/Fire_Handles';
for(const unit of ['ENG1','ENG2','APU']){
 for(const state of ['ON','OFF'])assert.ok(fs.existsSync(path.join(root,directory,'FIRE_HANDEL_'+unit+'_'+state+'.webp')));
}
assert.equal(fs.readdirSync(path.join(root,directory)).length,6);
const ui=fs.readFileSync(path.join(root,'fire-protection-lab/index.html'),'utf8');
assert.match(ui,/B737UnifiedFireLampModel\.SLOTS/);
assert.match(ui,/dataset\.illuminated/);
console.log('PASS: canonical handles and shared illuminated lens construction.');
