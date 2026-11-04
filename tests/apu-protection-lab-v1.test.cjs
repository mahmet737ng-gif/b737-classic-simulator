'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const Lab=require('../panel-mosaic-lab/apu-test-lab/model.js');
const live={phase:'READY',rpmPct:95.5,egtC:390,oil:{pressurePsi:55}};
function advance(s,snap,seconds){for(let i=0;i<seconds*4;i++)s=Lab.step(s,snap,.25);return s;}
test('normal ready APU keeps oil pressure, EGT and RPM stable with no protective shutdown',()=>{
 const out=advance(Lab.initial(),live,50);
 assert.equal(out.trip,null);assert.ok(out.values.rpmPct>95&&out.values.rpmPct<96);
 assert.ok(out.values.oilPressurePsi>=54);
 assert.ok(out.values.oilTempC>=80);
});
test('over-speed injection crosses selectable 110-percent threshold and latches shutdown',()=>{
 let s=Lab.setFault(Lab.initial(),'OVERSPEED',true);
 s=advance(s,live,11);
 assert.equal(s.trip?.reason,'OVERSPEED');assert.ok(s.values.rpmPct>=110);
 assert.equal(Lab.lamps(s,live).overspeed,true);
});
test('high APU oil temperature is separate from engine oil and trips only after configured hold',()=>{
 let s=Lab.setFault(Lab.initial(),'HIGH_OIL_TEMP',true);
 s=advance(s,live,13);assert.equal(s.trip,null);
 s=advance(s,live,22);assert.equal(s.trip?.reason,'HIGH_OIL_TEMP');
 assert.ok(s.values.oilTempC>Lab.defaults.highOilTempC);
 assert.equal(Lab.lamps(s,live).highOilTemp,true);
});
test('low APU oil pump pressure is not the owner-selected 4 PSI starter lamp threshold',()=>{
 let s=Lab.setFault(Lab.initial(),'LOW_OIL_PRESSURE',true);
 s=advance(s,live,5);assert.equal(s.trip,null);
 s=advance(s,live,30);assert.equal(s.trip?.reason,'LOW_OIL_PRESSURE');
 assert.ok(s.values.oilPressurePsi<4);
 assert.equal(Lab.lamps(s,live).lowOil,true);
});
test('an APU start has low oil lamp without a running-phase protective trip',()=>{
 const start={phase:'STARTING',rpmPct:11,egtC:70,oil:{pressurePsi:0}};
 const s=advance(Lab.initial(),start,30);
 assert.equal(s.trip,null);assert.equal(Lab.lamps(s,start).lowOil,true);
});
test('sensor/ECU faults and multiple independent toggles can co-exist',()=>{
 let s=Lab.setFault(Lab.initial(),'SPEED_SENSOR',true);
 s=Lab.setFault(s,'GENERATOR_FAILURE',true);
 assert.deepEqual(s.active,['SPEED_SENSOR','GENERATOR_FAILURE']);
 s=advance(s,live,1);
 assert.equal(s.trip?.reason,'SPEED_SENSOR');
 s=Lab.setFault(s,'SPEED_SENSOR',false);assert.deepEqual(s.active,['GENERATOR_FAILURE']);
});
test('editable thresholds are range validated and separate from live shared ECU',()=>{
 const initial=Lab.initial(),configured=Lab.setLimits(initial,{overspeedPct:112,lowOilTripPsi:43});
 assert.equal(initial.limits.overspeedPct,110);
 assert.equal(configured.limits.lowOilTripPsi,43);
 assert.throws(()=>Lab.setLimits(initial,{overspeedPct:99}));
 assert.throws(()=>Lab.setLimits(initial,{highOilHoldSec:Infinity}));
 assert.throws(()=>Lab.step(initial,live,-0.1));
});
test('Unified HTML mounts lab lazily; source shutdown remains owned by the existing ECU chain',()=>{
 const root=path.join(__dirname,'..');
 const html=fs.readFileSync(path.join(root,'panel-mosaic-lab/cockpit/index.html'),'utf8');
 const chain=fs.readFileSync(path.join(root,'engine/integration/isn-apu-start-chain-v1.js'),'utf8');
 const shared=fs.readFileSync(path.join(root,'panel-mosaic-lab/cockpit/isn-cockpit.js'),'utf8');
 const overhead=fs.readFileSync(path.join(root,'panel-mosaic-lab/cockpit/overhead-test-labs-v1.js'),'utf8');
 assert.match(html,/id="apuLabButtonV1"/);
 assert.match(html,/id="apuLabFrameV1"/);
 assert.match(overhead,/id==='OH12'&&window.B737APULabShellV1/);
 assert.match(chain,/tripAPU\(reason\)/);assert.match(chain,/this.start.shutdownAPU\(\)/);
 assert.match(shared,/apuLabProtectionTrip:reason/);assert.match(shared,/apuLabSetHardwareFault:/);
});
