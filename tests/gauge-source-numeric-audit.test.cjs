const test=require('node:test');
const assert=require('node:assert/strict');
const motion=require('../engine/instruments/gauge-motion-visual-audit-v1.json');
const transcription=require('../engine/instruments/printed-scale-labels-v1.json');
const photos=require('../engine/instruments/photo-anchor-checkpoints-v1.json');
test('All 53 instrument faces are covered by printable scale inventory',()=>{
 assert.equal(motion.faces.length,53);
 assert.equal(transcription.faces.length,53);
 const m=new Map(motion.faces.map(x=>[x.id,x]));
 assert.equal(new Set(m.keys()).size,53);
 for(const g of transcription.faces){
   assert.ok(m.has(g.id),g.id);
   assert.equal(g.geometryApproved,false);
   assert.ok(g.scales.length>0,g.id);
   assert.match(g.sourceHash,/^[a-f0-9]{64}$/);
   for(const scale of g.scales){
     assert.ok(scale.name);
     assert.ok(Array.isArray(scale.printed));
     assert.ok(Array.isArray(scale.interpreted));
     assert.ok(scale.status);
   }
 }
});
test('Every published scale remains blocked until all native ticks and pivots validated',()=>{
 assert.equal(motion.counts.approvedNumericCalibrations,0);
 for(const g of motion.faces){
   assert.equal(g.numericState,'NOT_CERTIFIED');
   assert.equal(g.geometryState,'NOT_CERTIFIED');
   assert.equal(g.printedRangeCandidate.approved,false);
 }
 for(const p of photos.gauges) assert.equal(p.approved,false);
});
test('Tricky scales remain independent and are not assumed linear',()=>{
 const id=x=>transcription.faces.find(g=>g.id===x);
 assert.equal(id('oh.drive_oil.1').scales.length,2);
 assert.equal(id('oh.cabin.diff_pressure_altitude').scales.length,2);
 assert.deepEqual(id('oh.elec.cps').scales[0].interpreted,[0,400,420]);
 assert.deepEqual(id('oh.fuel.temperature').scales[0].interpreted,[-40,-20,0,20,40]);
 assert.deepEqual(id('fo.flap_position').scales[0].interpreted,[0,1,2,5,10,15,25,30,40]);
 assert.deepEqual(id('capt.rmi').scales[0].interpreted,[0,30,60,90,120,150,180,210,240,270,300,330]);
 assert.equal(id('eng.egt.1').scales[0].interpreted.length,0);
 assert.equal(id('eng.n2.1').scales[0].interpreted.length,0);
});
