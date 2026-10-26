'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'../..');
const assets=[
 'panel-mosaic-lab/assets/locked/2026-10-23/Fire_Protection_Panel_Blank_With_Buttons.png',
 ...['ENG1','ENG2','APU'].flatMap(unit=>['ON','OFF'].map(light=>'panel-mosaic-lab/assets/locked/2026-10-23/FIRE_HANDEL_'+unit+'_'+light+'.webp')),
 ...['ENG_1_OVERHEAT','ENG_2_OVERHEAT','FAULT','APU_DET_INOP','L_BOTTLE_DISCHARGED','R_BOTTLE_DISCHARGED'].flatMap(lamp=>['OFF','ON'].map(state=>'panel-mosaic-lab/assets/locked/2026-10-23/LIGHTS/black-amber-v1/mounted/'+lamp+'_'+state+'.svg')),
 ...['OFF','ON'].map(state=>'panel-mosaic-lab/assets/locked/2026-10-23/LIGHTS/WHEEL_WELL_RED_'+state+'.svg'),
 ...['OFF','ON'].map(state=>'fire-protection-lab/assets/APU_BOTTLE_DISCHARGED_'+state+'.svg')
];
for(const file of assets)assert.ok(fs.existsSync(path.join(root,file)),'Missing read-only asset: '+file);
const ui=fs.readFileSync(path.join(root,'fire-protection-lab/index.html'),'utf8');
assert.match(ui,/B737FireProtection/);
for(const name of ['ENG_1_OVERHEAT','ENG_2_OVERHEAT','FAULT','APU_DET_INOP','WHEEL_WELL_RED','L_BOTTLE_DISCHARGED','R_BOTTLE_DISCHARGED','APU_BOTTLE_DISCHARGED'])assert.ok(ui.includes(name));
console.log('PASS: '+assets.length+' Fire Protection assets and UI mappings.');
