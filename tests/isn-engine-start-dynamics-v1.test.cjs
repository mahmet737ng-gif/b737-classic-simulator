'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const Dynamics=require('../engine/integration/isn-engine-start-dynamics-v1');
const Gauge=require('../panel-mosaic-lab/cockpit/isn-engine-gauge-model');
assert.equal(Dynamics.sample('MOTORING',0).n2Percent,0);
assert.equal(Dynamics.sample('MOTORING',425).n2Percent,12.5);
assert.equal(Dynamics.sample('MOTORING',850).n2Percent,25);
assert.equal(Dynamics.sample('MOTORING',2000).n2Percent,25);
assert.equal(Dynamics.sample('LIGHT_OFF_SEQUENCE',0).egtC,0);
assert.equal(Dynamics.sample('LIGHT_OFF_SEQUENCE',500).n2Percent,35.5);
assert.equal(Dynamics.sample('LIGHT_OFF_SEQUENCE',500).egtC,210);
assert.equal(Dynamics.sample('LIGHT_OFF_SEQUENCE',1000).n2Percent,46);
assert.equal(Dynamics.sample('LIGHT_OFF_SEQUENCE',1000).egtC,420);
assert.equal(Dynamics.sample('LIGHT_OFF_SEQUENCE',0).origin,'TRAINING_SEQUENCE_SIMULATED');
assert.throws(()=>Dynamics.sample('MOTORING',-1));
assert.equal(Gauge.gauges.length,4);
assert.deepEqual(Gauge.gauges.map(g=>[g.id,g.cx,g.cy]),[
 ['egt1',535,723],['egt2',724,723],['n2_1',535,900],['n2_2',724,900]
]);
for(const g of Gauge.gauges){
 assert.ok(g.cx>0&&g.cy>0&&g.cx<Gauge.source.width&&g.cy<Gauge.source.height);
 assert.equal(Gauge.angle(null,g.max),null);
 assert.equal(Gauge.angle(0,g.max),-45);
 assert.equal(Gauge.angle(g.max,g.max),-315);
}
const html=fs.readFileSync(path.join(__dirname,'../panel-mosaic-lab/cockpit/index.html'),'utf8');
const overlay=fs.readFileSync(path.join(__dirname,'../panel-mosaic-lab/cockpit/isn-engine-gauges.js'),'utf8');
const host=fs.readFileSync(path.join(__dirname,'../panel-mosaic-lab/cockpit/isn-cockpit.js'),'utf8');
for(const name of ['isn-engine-gauges.css','isn-engine-gauge-model.js','isn-engine-gauges.js'])assert.ok(html.includes(name));
assert.ok(overlay.includes('data-piece="engine"'));
assert.ok(host.includes('b737:isn-start-indications'));
assert.ok(host.includes('isn-engine-start-dynamics-v1.js'));
console.log('PASS ISN-05 training interpolation and four source-aligned engine-panel gauges.');

// A normal start must not flatten near 46%; injected failures may level off.
for(const entryN2 of [5,20,25]){
 const read=t=>Dynamics.sample('LIGHT_OFF_SEQUENCE',t,{fuelEntryN2:entryN2}).n2Percent;
 const rate=(46-entryN2)/1000;
 for(const [a,b] of [[900,950],[950,990],[990,999]])
  assert.ok(Math.abs((read(b)-read(a))/(b-a)-rate)<1e-10,'No pre-cutout N2 plateau');
 assert.ok(read(999)<46);assert.equal(read(1000),46);
}
for(const fault of ['hungStart','noLightOff']){
 const a=Dynamics.sample('LIGHT_OFF_SEQUENCE',1000,{[fault]:true});
 const b=Dynamics.sample('LIGHT_OFF_SEQUENCE',1500,{[fault]:true});
 assert.ok(a.n2Percent<46);assert.equal(a.n2Percent,b.n2Percent);
}
