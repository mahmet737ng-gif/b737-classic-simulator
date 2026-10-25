'use strict';
// End-to-end reproduction of Fuel Lever IDLE browser click at N2=25%.
// No artificial fuel availability, physical pump source guards are preserved.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const app=fs.readFileSync(path.join(__dirname,'../isn-ecu-start-lab/app.js'),'utf8');
const html=fs.readFileSync(path.join(__dirname,'../isn-ecu-start-lab/index.html'),'utf8');
assert.match(html,/id="errors"[^>]*aria-live="assertive"/);
const ECU=require('../engine/integration/isn-13-18-ecu-testbench-v1');
const libs={
 B737ElectricalV7:require('../engine/systems/electrical-v7'),
 B737ElectricalLoadsV8:require('../engine/systems/electrical-loads-v8'),
 B737TrainerCore:require('../engine/trainer/core'),
 B737WarningEngine:require('../audio/warning-engine'),
 B737PneumaticsV6:require('../engine/systems/pneumatics-v6'),
 B737ISNElectricalPackV1:require('../engine/integration/isn-electrical-pack-v1'),
 B737ISNEngineAPUV1:require('../engine/integration/isn-engine-apu-v1'),
 B737ISNStartSequenceV1:require('../engine/integration/isn-start-sequence-v1'),
 B737ISNAPUStartChainV1:require('../engine/integration/isn-apu-start-chain-v1'),
 B737ISNThrustPerformanceV1:require('../engine/integration/isn-thrust-performance-v1'),
 B737ISN0912RuntimeV1:require('../engine/integration/isn-09-12-runtime-v1'),
 B737ISN1318ECUTestbenchV1:ECU
};
const nodes={};
const element=id=>nodes[id]??=( {textContent:'',innerHTML:'',value:200,addEventListener(){} } );
let clickHandler=null;
let timerSeq=0;
const intervals=new Map();
const document={getElementById:element,querySelector:element,addEventListener(name,fn){if(name==='click')clickHandler=fn;}};
vm.runInNewContext(app,{document,window:libs,console,
 setInterval(fn,ms){assert.equal(ms,100);const id=++timerSeq;intervals.set(id,fn);return id;},
 clearInterval(id){intervals.delete(id);}}, {filename:'isn-ecu-start-lab/app.js'});
const click=act=>{assert.ok(clickHandler,'DOM click handler installed');clickHandler({target:{closest:()=>({dataset:{act}})}});};
const advance5=n=>{for(let i=0;i<n;i++)click('step5');};
click('battery');click('apuStart');advance5(17);
assert.match(element('apu').textContent,/APU 95.5% RPM/);
click('apuGen');click('apuBleed');
click('loadAvionics');click('loadLights');
click('start1');advance5(8);
assert.match(element('clock').textContent,/125.0 s/);
assert.match(element('engines').innerHTML,/PHASE <strong>AWAIT_FUEL_LEVER_IDLE/);
assert.match(element('engines').innerHTML,/FUEL SUPPLY <strong class="amber">NO_AVAILABLE_FUEL_PATH/);
click('idle1');
assert.match(element('errors').textContent,/NO_AVAILABLE_FUEL_PATH/,
 'Rejected IDLE must be clearly visible next to start controls');
assert.match(element('engines').innerHTML,/FUEL LEVER <strong>CUTOFF/);
click('fuel');
assert.match(element('[data-act="fuel"]').textContent,/4\/4 ON/);
assert.match(element('engines').innerHTML,/FUEL SUPPLY <strong class="ok">AVAILABLE/);
click('idle1');
assert.equal(element('errors').textContent,'');
assert.match(element('engines').innerHTML,/FUEL LEVER <strong>IDLE/);
assert.match(element('engines').innerHTML,/PHASE <strong>LIGHT_OFF_SEQUENCE/);
advance5(1);
assert.match(element('engines').innerHTML,/FUEL LEVER <strong>IDLE/);
const cards=element('engines').innerHTML;
assert.match(cards,/FUEL FLOW<\/span><b>\d+\.\d+ <small>kg\/h/);
advance5(9);
assert.match(element('engines').innerHTML,/PHASE <strong>RUNNING/);
click('start2');advance5(8);
assert.match(element('engines').innerHTML,/PHASE <strong>AWAIT_FUEL_LEVER_IDLE/);
click('idle2');
assert.equal(element('errors').textContent,'');
assert.match(element('engines').innerHTML,/PHASE <strong>LIGHT_OFF_SEQUENCE/);
console.log('PASS ECU Fuel Lever DOM E2E: N2 25 idle blocked with pumps OFF and visible error; pump switches ON restores fuel; real button leads to LIGHT_OFF and RUNNING; second engine independent.');
