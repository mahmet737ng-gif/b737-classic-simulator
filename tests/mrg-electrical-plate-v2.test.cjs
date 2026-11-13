'use strict';
// Event-driven MRG plate regression: no DOM, browser, async loops, or aircraft
// actuator commands. Validates the same functional 24-channel lab topology.
const assert=require('node:assert/strict');
const test=require('node:test');
const fs=require('node:fs');
const path=require('node:path');
const Lab=require('../engine/systems/classic-bus-consumer-test-lab-v1.js');
const Plate=require('../bus-consumer-test-lab/mrg-electrical-plate-v2.js');
const root=path.resolve(__dirname,'..');
const css=fs.readFileSync(path.join(root,'bus-consumer-test-lab/mrg-electrical-plate-v2.css'),'utf8');
const html=fs.readFileSync(path.join(root,'bus-consumer-test-lab/v3.html'),'utf8');
const keys=Object.keys(Lab.SOURCE);
const reference=Object.fromEntries(keys.map(key=>[key,{powered:true}]));
const powerFor=(cuts=[])=>Lab.calculatePower(reference,cuts,'ALL_ON',true);
test('MRG vector page has a wide viewport and all 24 lab power classes',()=>{
 assert.equal(keys.length,24);
 assert.equal(Object.keys(Plate.BUS).length,24);
 for(const key of keys)assert.ok(Plate.BUS[key],'missing plate bus '+key);
 assert.match(Plate.VERSION,/0002$/);
 assert.match(fs.readFileSync(path.join(root,'bus-consumer-test-lab/mrg-electrical-plate-v2.js'),'utf8'),/viewBox:'0 0 765 714'/);
 assert.match(html,/mrg-electrical-plate-v2.js/);
 assert.doesNotMatch(html,/id="mrgV2Release"/);
 assert.match(css,/\.mrg-plate-layout\[data-has-failures="false"\]/);
 assert.match(css,/\.mrg-affected\[hidden\]/);
});
test('All-on scenario is green, with modelled feeder contacts closed',()=>{
 const power=powerFor();
 assert.equal(Object.values(power).filter(Boolean).length,24);
 assert.equal(Plate.classifyWire({bus:'main1@115VAC',from:'generator1@115VAC'},power,new Set()),'ON');
 const c=Plate.contactStates(power);
 for(const k of ['GB1','GB2','R3','R4','R1','R2','R41','R37_AC','R37_DC'])
  assert.equal(c[k],true,k+' must be closed in fully powered lab');
 for(const k of ['GEN1_EXTERNAL','GEN2_EXTERNAL','GEN1_APU','GEN2_APU','R9','R89'])
  assert.equal(c[k],null,k+' must not invent physical selector position');
});
test('GEN 1 direct OFF cascades its own branch while GEN 2 preserves transfer alternate',()=>{
 const cuts=['generator1@115VAC'], power=powerFor(cuts), forced=new Set(cuts);
 assert.equal(power['generator1@115VAC'],false);
 assert.equal(power['main1@115VAC'],false);
 assert.equal(power['electronic1@115VAC'],false);
 assert.equal(power['transfer1@115VAC'],true,'other generator transfer source remains available');
 assert.equal(power['transfer2@115VAC'],true);
 assert.equal(Plate.classifyWire({bus:'generator1@115VAC'},power,forced),'DIRECT');
 assert.equal(Plate.classifyWire({bus:'main1@115VAC',from:'generator1@115VAC'},power,forced),'DIRECT');
 assert.equal(Plate.classifyWire({bus:'main1@28VAC'},power,forced),'CASCADE');
 assert.equal(Plate.classifyWire({bus:'transfer1@115VAC',from:'generator1@115VAC'},power,forced),'DIRECT');
 assert.equal(Plate.classifyWire({bus:'transfer1@115VAC',from:'generator2@115VAC'},power,forced),'ON');
 const contacts=Plate.contactStates(power);
 assert.equal(contacts.GB1,false);
 assert.equal(contacts.GB2,true);
 assert.equal(contacts.R3,false);
 assert.equal(contacts.R4,true);
});
test('Hot battery interruption cascades to switched hot battery without killing battery bus',()=>{
 const cuts=['hotBattery@28VDC'], power=powerFor(cuts), forced=new Set(cuts);
 assert.equal(power['hotBattery@28VDC'],false);
 assert.equal(power['switchedHotBattery@28VDC'],false);
 assert.equal(power['battery@28VDC'],true);
 assert.equal(Plate.classifyWire({bus:'hotBattery@28VDC'},power,forced),'DIRECT');
 assert.equal(Plate.classifyWire({bus:'switchedHotBattery@28VDC'},power,forced),'CASCADE');
 assert.equal(Plate.contactStates(power).R41,false);
});
test('The wiring and contact indications use strong green/red with visible motion',()=>{
 assert.match(css,/stroke:#008d41!important/);
 assert.match(css,/stroke:#dc0929!important/);
 assert.match(css,/\.mrg-wire\[data-failure-type="CASCADE"\]/);
 assert.match(css,/transform:rotate\(48deg\)/);
 assert.match(css,/\.mrg-contact\[data-closed="true"\]/);
 assert.match(css,/\.mrg-contact\[data-closed="false"\]/);
 assert.match(css,/\.mrg-bus-node\[data-status="ON"\]/);
 assert.match(css,/\.mrg-bus-node\[data-status="CUT"\]/);
});
