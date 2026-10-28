const test=require('node:test'),assert=require('node:assert/strict');
const LE=require('../engine/systems/le-devices-classic-v1.js');
const run=(cmds,mode)=>LE.execute(cmds,mode);
const lever=(v)=>({type:'FLAP_LEVER',value:v}),tick=(s)=>({type:'TICK',seconds:s});
test('4 flaps + 6 slats, no undocumented seventh or eighth slat',()=>{
 assert.equal(LE.FLAPS.length,4);assert.equal(LE.SLATS.length,6);assert.equal(LE.DEVICES.length,10);
 assert.equal(Object.keys(LE.evaluate(LE.initialState()).overhead.windows).length,26);
});
test('normal UP, flaps 1, 5, 10, 40 all have physical individual indications',()=>{
 const up=run([]);assert.equal(up.center.transit,false);assert.equal(up.center.extended,false);
 for(const d of LE.DEVICES)assert.equal(up.indication[d],'RETRACTED');
 for(const f of [1,2,5,10,15,25,30,40]){
  const p=run([lever(f),tick(15)]);
  assert.equal(p.center.transit,false,'no amber center '+f);assert.equal(p.center.extended,true,'green center '+f);
  for(const x of LE.FLAPS)assert.equal(p.indication[x],'FULL_EXT');
  for(const x of LE.SLATS)assert.equal(p.indication[x],f>=10?'FULL_EXT':'EXT');
 }
});
test('moving LE devices illuminates amber; detents are not instantaneous',()=>{
 const p=run([lever(1),tick(1)]);
 assert.equal(p.center.transit,true);assert.equal(p.center.extended,false);
 assert.equal(p.overhead.windows['FLAP_2|TRANSIT'],true);
 assert.equal(p.overhead.windows['SLAT_4|TRANSIT'],true);
});
test('in-flight autoslat drives full and inhibits only center transit',()=>{
 const p=run([lever(5),tick(10),{type:'GROUND',value:false},{type:'AUTOSLAT',value:true},tick(1)]);
 assert.equal(p.overhead.windows['SLAT_2|TRANSIT'],true);
 assert.equal(p.center.transit,false);assert.equal(p.autoslatInhibit,true);
 const done=run([lever(5),tick(10),{type:'GROUND',value:false},{type:'AUTOSLAT',value:true},tick(10)]);
 assert.equal(done.indication.SLAT_6,'FULL_EXT');
});
test('hydraulic B loss freezes devices; standby alternate extends but cannot retract',()=>{
 let s=LE.initialState('EMERGENCY');s=LE.apply(s,lever(15));s=LE.apply(s,tick(9));
 assert.equal(s.position.SLAT_1,0);
 s=LE.apply(s,{type:'ALTERNATE_EXTEND',value:true});s=LE.apply(s,tick(15));
 assert.equal(LE.evaluate(s).indication.FLAP_3,'FULL_EXT');assert.equal(LE.evaluate(s).indication.SLAT_1,'FULL_EXT');
 s=LE.apply(s,{type:'ALTERNATE_EXTEND',value:false});s=LE.apply(s,lever(0));s=LE.apply(s,tick(20));
 assert.equal(s.position.SLAT_1,2,'standby hydraulic cannot retract');
});
test('jam or wrong sensor leads to improper LE indication and center TRANSIT',()=>{
 const p=run([lever(10),{type:'JAM',device:'FLAP_2',value:true},tick(15)]);
 assert.deepEqual(p.mismatch,['FLAP_2']);assert.equal(p.center.transit,true);
 const faulty=run([lever(1),tick(15),{type:'SENSOR',device:'SLAT_1',value:'TRANSIT'}]);
 assert.equal(faulty.overhead.windows['SLAT_1|TRANSIT'],true);
 assert.equal(faulty.center.transit,true);
});
test('classic power buses stay separate; no direct hot battery assumption',()=>{
 const overheadOnly=run([lever(1),tick(15),{type:'POWER',bus:'dc1',value:false}]);
 assert.equal(overheadOnly.overhead.windows['FLAP_1|FULL_EXT'],true);
 assert.equal(overheadOnly.center.extended,false);
 const centerOnly=run([lever(1),tick(15),{type:'POWER',bus:'transfer1',value:false}]);
 assert.equal(centerOnly.overhead.windows['FLAP_1|FULL_EXT'],false);
 assert.equal(centerOnly.center.extended,true);
 const unknown=run([{type:'POWER',bus:'transfer1',value:null}]);
 assert.equal(unknown.overhead.windows['SLAT_1|TRANSIT'],null);
});
test('momentary TEST illuminates healthy windows only with overhead power and restores original state',()=>{
 const on=run([lever(1),tick(15),{type:'TEST',value:true}]);
 assert.equal(Object.values(on.overhead.windows).filter(Boolean).length,26);
 const off=run([lever(1),tick(15),{type:'TEST',value:true},{type:'TEST',value:false}]);
 assert.equal(off.overhead.windows['FLAP_1|TRANSIT'],false);
 assert.equal(off.overhead.windows['FLAP_1|FULL_EXT'],true);
 const dark=run([{type:'POWER',bus:'transfer1',value:false},{type:'TEST',value:true}]);
 assert.equal(Object.values(dark.overhead.windows).filter(Boolean).length,0);
});
test('sensor faults and failed lamps independent of dynamics',()=>{
 const f=run([lever(1),tick(15),{type:'LAMP_FAILURE',device:'SLAT_1',level:'EXT',value:true}]);
 assert.equal(f.position.SLAT_1,1);
 assert.equal(f.overhead.windows['SLAT_1|EXT'],false);
 assert.equal(f.center.extended,true);
 assert.throws(()=>run([{type:'SENSOR',device:'FLAP_1',value:'EXT'}]));
 assert.throws(()=>run([{type:'ALTERNATE_EXTEND',value:true}]));
});
test('invalid values are rejected; immutable prior states and deterministic replay',()=>{
 const s=LE.initialState();const prior=JSON.stringify(s);
 const n=LE.apply(s,lever(1));assert.equal(JSON.stringify(s),prior);
 assert.equal(n.lever,1);
 assert.throws(()=>LE.apply(s,lever(7)));
 assert.throws(()=>LE.apply(s,{type:'TICK',seconds:-1}));
 assert.deepEqual(LE.execute([lever(2),tick(8)]),LE.execute([lever(2),tick(8)]));
});
test('non-normal preset freezes all LE devices until hydraulic supply is restored',()=>{
 const noB=run([lever(15),tick(20)],'NON_NORMAL');
 assert.equal(noB.mismatch.length,10);
 assert.equal(noB.overhead.windows['SLAT_1|TRANSIT'],false,'retracted frozen slat has no false amber');
 assert.equal(noB.center.transit,true,'forward amber warns of improper LE position');
});
