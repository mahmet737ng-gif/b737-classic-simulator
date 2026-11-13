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
 assert.match(Plate.VERSION,/0003$/);
 assert.match(fs.readFileSync(path.join(root,'bus-consumer-test-lab/mrg-electrical-plate-v2.js'),'utf8'),/viewBox:'0 0 900 680'/);
 assert.match(html,/mrg-electrical-plate-v2.js/);
 assert.doesNotMatch(html,/id="mrgV2Release"/);
 assert.match(html,/mrg-electrical-controls-v3.js/);
 assert.match(html,/MRG-PLATE-V3-0001/);
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


const Network=require('../bus-consumer-test-lab/mrg-electrical-controls-v3.js');
const Electrical=require('../engine/systems/electrical-v7.js');
const Core=require('../engine/systems/classic-bus-consumer-engine-v1.js');
const index=require('../engine/systems/mrg-classic-340-consumer-bus-index-v1.json');

test('Generator symbols directly toggle power, cascade, and 340 source consumer projection',()=>{
 const session=Lab.makeSession({Core,Electrical,index});
 const control=Network.createControls();
 session.setCascade(true);
 session.setPowerModel(control.compute);
 assert.equal(Object.values(session.busStates).filter(Boolean).length,24);
 assert.equal(session.snapshot().coverage.activeRows,340);
 control.changeSource('GEN1');session.refresh();
 assert.equal(session.busStates['generator1@115VAC'],false);
 assert.equal(session.busStates['main1@115VAC'],false);
 assert.equal(session.busStates['electronic1@115VAC'],false);
 assert.equal(session.busStates['transfer1@115VAC'],true,'GEN2 alternate remains');
 assert.ok(Object.values(session.snapshot().consumers).some(row=>row.powerState==='OFF'));
 control.changeSource('GEN2');session.refresh();
 assert.equal(session.busStates['dc1@28VDC'],false);
 assert.equal(session.busStates['dc2@28VDC'],false);
 control.changeSource('APU');session.refresh();
 assert.equal(session.busStates['generator1@115VAC'],true);
 assert.equal(session.busStates['generator2@115VAC'],true);
 assert.equal(control.copy().relays.GEN1_APU,true);
 assert.equal(control.copy().relays.GEN2_APU,true);
 assert.equal(Object.values(session.busStates).filter(Boolean).length,24);
});

test('Clicking each source selector/relay changes only its intended lab feed and preserves alternate paths',()=>{
 const control=Network.createControls();
 const get=()=>control.compute({reference,forcedOff:[],baseline:'ALL_ON',cascade:true});
 assert.equal(Object.values(get()).filter(Boolean).length,24);
 control.changeRelay('R3');control.changeRelay('R4');
 let p=get();
 assert.equal(p['transfer1@115VAC'],false);
 assert.equal(p['transfer2@115VAC'],false);
 assert.equal(p['dc1@28VDC'],false);
 assert.equal(p['dc2@28VDC'],false);
 assert.equal(p['main1@115VAC'],true);
 assert.equal(p['main2@115VAC'],true);
 assert.equal(control.derivedContacts().R3,false);
 control.reset();
 control.changeRelay('R1');p=get();
 assert.equal(p['hotBattery@28VDC'],false);
 assert.equal(p['switchedHotBattery@28VDC'],false);
 assert.equal(p['battery@28VDC'],true);
 control.reset();
 control.changeRelay('GB1');p=get();
 assert.equal(p['generator1@115VAC'],false);
 assert.equal(p['main1@115VAC'],false);
 assert.equal(p['generator2@115VAC'],true);
 control.reset();
 for(const id of Object.keys(Network.RELAY_FEEDS))assert.ok(Object.hasOwn(control.copy().relays,id),'Unwired relay: '+id);
});

test('No title survives within the SVG master and landscape viewport really fills holder',()=>{
 const js=fs.readFileSync(path.join(root,'bus-consumer-test-lab/mrg-electrical-plate-v2.js'),'utf8');
 assert.doesNotMatch(js,/text\(parent,308,55,'ELECTRICAL POWER SCHEMATIC'/);
 assert.match(js,/preserveAspectRatio:'none'/);
 assert.match(js,/scale\(1.80 0.955\)/);
 assert.match(js,/function toggleSource\(key\)/);
 assert.match(js,/function toggleRelay\(key\)/);
 assert.match(css,/\.mrg-sheet-holder svg\{/);
 assert.match(css,/width:100%!important;height:clamp/);
 assert.match(css,/\.mrg-source-hitbox/);
 assert.match(css,/\.mrg-contact .mrg-hit-area/);
});
