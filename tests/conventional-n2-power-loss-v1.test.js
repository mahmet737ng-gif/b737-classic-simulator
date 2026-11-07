/* node tests/conventional-n2-power-loss-v1.test.js
 * B737 Classic ATA77: MRG generic Non-EIS DC1/DC2 N2 LRU power mapping.
 * Test/backend contracts; visual SVG glyph/needle methods are checked
 * for source wiring but final cockpit pixel behavior requires browser QA.
 */
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const base=path.resolve(__dirname,'..');
const Backend=require('../engine/instruments/engine-indication-backend-v1.js');
const Sync=require('../engine/instruments/conventional-indication-sync-v1.js');
const db=require('../engine/instruments/engine-indication-technical-db-v1.json');
const index=require('../engine/systems/mrg-classic-340-consumer-bus-index-v1.json');
const model=Backend.validate(db);
assert.equal(model,true);
assert.equal(db.instruments.n2.wiring.CONVENTIONAL[1].bus,'dc1');
assert.equal(db.instruments.n2.wiring.CONVENTIONAL[2].bus,'dc2');
const expected=[
 ['Engine 1 N2 Indication (non-EIS)','dc1','28VDC'],
 ['Engine 2 N2 Indication (non-EIS)','dc2','28VDC']];
for(const [name,bus,voltage] of expected)
 assert.ok(index.rows.some(r=>r.item===name&&r.feedBus===bus&&r.feedVoltage===voltage));
const observed={engine1:{n2:{valid:true,value:59.5,unit:'%',origin:'TEST_ECU'}},
 engine2:{n2:{valid:true,value:61.3,unit:'%',origin:'TEST_ECU'}}};
const buses={battery:true,dc1:true,dc2:true,dcStandby:true,transfer1:true,transfer2:true};
const calculate=(mode,change)=>Backend.calculate(db,{mode,observed,
 electrical:{schema:'B737_ELECTRICAL_V7_RESULT',bus:{...buses,...change}}});
const normal=calculate('CONVENTIONAL',{}),loss=calculate('CONVENTIONAL',{dc1:false});
const first=loss.engines.engine1.indications.n2;
const second=loss.engines.engine2.indications.n2;
assert.equal(normal.engines.engine1.indications.n2.status,'VALID');
assert.equal(first.status,'POWER_LOSS');
assert.equal(first.power,'OFF');
assert.equal(first.digital,'BLANK');
assert.equal(first.pointer,'OFF_SCALE');
const projected=Sync.project(first,'n2');
assert.equal(projected.state,'BLANK');
assert.equal(projected.value,null);
assert.equal(projected.digital,null);
assert.equal(second.status,'VALID');
assert.equal(calculate('EIS',{dc1:false}).engines.engine1.indications.n2.status,'VALID');
assert.equal(calculate('CONVENTIONAL',{dc1:true}).engines.engine1.indications.n2.status,'VALID');
const readouts=fs.readFileSync(path.join(base,'panel-mosaic-lab/cockpit/eis-dot-readouts-v1.js'),'utf8');
const needles=fs.readFileSync(path.join(base,'panel-mosaic-lab/cockpit/conventional-engine-needles-v1.js'),'utf8');
const bridge=fs.readFileSync(path.join(base,'panel-mosaic-lab/cockpit/engine-indication-live-v2.js'),'utf8');
assert.match(readouts,/setConventionalPowerLoss/);
assert.match(readouts,/part\.group\.style\.display=lost\?'none':''/);
assert.match(needles,/setIndicationPowerLoss/);
assert.match(bridge,/result\.engines\[id\]\?\.indications\?\.\[signal\]\?\.status==='POWER_LOSS'/);
assert.match(bridge,/setConventionalPowerLoss/);
assert.match(bridge,/setIndicationPowerLoss/);
console.log('PASS Conventional N2 DC1 isolation, blank digital, unpowered pointer, engine2/EIS unaffected and recovery');