'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const base=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(base,p),'utf8');
const html=read('panel-mosaic-lab/cockpit/index.html');
const stage=read('panel-mosaic-lab/cockpit/cdu-stage.html');
const bridge=read('panel-mosaic-lab/cockpit/irs-trainer-live-v1.js');
const cdu=read('panel-mosaic-lab/cockpit/cdu-irs-adapter-v1.js');
const engine=read('engine/systems/irs-trainer-web-v1.js');
for(const src of [
'../../engine/systems/irs-trainer-web-v1.js?v=IRS-LIVE-0001',
'./irs-trainer-live-v1.js?v=IRS-LIVE-0001',
'./irs-trainer-live-v1.css?v=IRS-LIVE-0001'
])assert(html.includes(src),'Missing live cockpit module '+src);
assert(stage.includes('../panel-mosaic-lab/cockpit/cdu-irs-unified-v1.js?v=IRS-LIVE-0001'),'CDU IRS iframe bridge missing');
for(const phrase of [
"b737:irs-visual-key","event.stopImmediatePropagation()",
"b737:irs-cdu-position-set","FMC_SET_IRS_POS","ISDU_LAT_ENT","ISDU_LON_ENT",
"b737:irs-sys-dspl-visual-change","b737:irs-dspl-sel-change",
"b737:simulator-telemetry","b737:irs-trainer-cdu-state",
"document.getElementById('irsSegmentDisplayMounted')","irs-live-msu-lamp",
"b737:cockpit-mounted","INSTRUCTOR TEST POWER","ELECTRICAL BUS STATE"
])assert(bridge.includes(phrase),'Missing cockpit integration boundary '+phrase);
for(const phrase of ["POS_INIT","LSK_R4","POS_REF","setFmcPosition","B737IRSTrainerUnified"])assert(cdu.includes(phrase),'Missing CDU boundary '+phrase);
assert(bridge.includes('root.B737IRSTrainerUnified=Object.freeze('));
assert(engine.includes("powerTestSeconds:3.5"));
assert(engine.includes("u.phase='SELFTEST'"));
assert(engine.includes("u.phase='ALIGNING'"));
assert(engine.includes("u.powerTestElapsedSec+=dt"));
assert(engine.includes("u.phase='NAV_READY'"));
assert(engine.includes("B737IRSTrainerCoreV1"));
const locked=JSON.parse(read('panel-mosaic-lab/cockpit/irs-13seg-owner-lock-v1.json'));
const lower=JSON.parse(read('panel-mosaic-lab/cockpit/irs-sys-dspl-owner-lock-v1.json'));
for(const slot of [...locked.frozenIndexMounts,...lower.indexMounts])
 assert.equal(html.split(slot).length-1,1,'Owner-locked mount was changed');
const core=require('../engine/systems/irs-trainer-core-v1.cjs');
let s=core.initialState();
for(const id of ['L','R']){
 s=core.apply(s,{type:'POWER',side:id,available:true});
 s=core.apply(s,{type:'SELECT_MODE',side:id,mode:id==='L'?'ALIGN':'NAV'});
}
s=core.apply(s,{type:'FMC_SET_IRS_POS',position:'N35395 E051254'});
assert.equal(core.status(s,'L').onDcLamp,true);
assert.equal(core.status(s,'R').onDcLamp,true);
assert.equal(core.status(s,'L').alignLamp,false);
s=core.tick(s,{dtSec:3.49,stationary:true,valid:false});
assert.equal(core.status(s,'L').phase,'SELFTEST');
assert.equal(core.status(s,'R').phase,'SELFTEST');
s=core.tick(s,{dtSec:0.01,stationary:true,valid:false});
assert.equal(core.status(s,'L').phase,'ALIGNING');
assert.equal(core.status(s,'R').phase,'ALIGNING');
assert.equal(core.status(s,'L').onDcLamp,false);
assert.equal(core.status(s,'L').alignLamp,true);
assert.equal(core.hdgStsCountdown(s,'R').value,7);
for(let i=0;i<120;i++)s=core.tick(s,{dtSec:5,stationary:true,valid:false});
assert.equal(core.status(s,'L').phase,'ALIGN_READY','OFF->ALIGN completes then waits for NAV');
assert.equal(core.status(s,'R').phase,'NAV_READY','OFF->NAV automatically aligns');
assert.equal(core.status(s,'L').positionValid,false);
assert.equal(core.status(s,'R').positionValid,true);
s=core.apply(s,{type:'SELECT_MODE',side:'L',mode:'NAV'});
assert.equal(core.status(s,'L').positionValid,true);
assert.equal(core.comparison(s).separationNm,0);
console.log('PASS IRS LIVE V1: 3.5s ON DC, direct NAV auto align, standalone ALIGN waits NAV, FMC/ISDU wiring, paired CDU, locked artwork.');
