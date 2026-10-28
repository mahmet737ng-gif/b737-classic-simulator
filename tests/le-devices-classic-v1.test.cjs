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
 assert.equal(noB.overhead.windows['SLAT_1|TRANSIT'],true,'retracted frozen slat disagrees with commanded extension');
 assert.equal(noB.center.transit,true,'forward amber warns of improper LE position');
});

test('REGRESSION: FLAPS 5 -> 15, jam SLAT 2 at EXT: green OFF, amber ON; peers reach FULL',()=>{
 let s=LE.initialState();
 s=LE.apply(s,lever(5));
 s=LE.apply(s,tick(10));
 let p=LE.evaluate(s);
 for(const id of LE.SLATS){
  assert.equal(p.position[id],1);
  assert.equal(p.overhead.windows[id+'|EXT'],true);
  assert.equal(p.overhead.windows[id+'|TRANSIT'],false);
 }
 s=LE.apply(s,{type:'JAM',device:'SLAT_2',value:true});
 s=LE.apply(s,lever(15));
 p=LE.evaluate(s);
 assert.equal(p.position.SLAT_2,1,'mechanically jammed slat remains at EXT');
 assert.equal(p.indication.SLAT_2,'EXT','observed/mechanical position remains EXT for diagnostics');
 assert.equal(p.overhead.indication.SLAT_2,'TRANSIT','command disagreement overrides observed detent');
 assert.equal(p.overhead.windows['SLAT_2|EXT'],false,'stale green EXT must go out immediately');
 assert.equal(p.overhead.windows['SLAT_2|FULL_EXT'],false);
 assert.equal(p.overhead.windows['SLAT_2|TRANSIT'],true);
 assert.equal(p.center.transit,true);
 s=LE.apply(s,tick(5));
 p=LE.evaluate(s);
 for(const id of LE.SLATS.filter(x=>x!=='SLAT_2')){
  assert.equal(p.position[id],2,id+' must complete transition');
  assert.equal(p.overhead.windows[id+'|FULL_EXT'],true,id+' green FULL EXT on');
  assert.equal(p.overhead.windows[id+'|TRANSIT'],false,id+' amber off');
 }
 assert.equal(p.position.SLAT_2,1,'jam persists after the others reach full');
 assert.equal(p.overhead.indication.SLAT_2,'TRANSIT');
 assert.equal(p.overhead.windows['SLAT_2|EXT'],false);
 assert.equal(p.overhead.windows['SLAT_2|FULL_EXT'],false);
 assert.equal(p.overhead.windows['SLAT_2|TRANSIT'],true);
 assert.deepEqual(p.mismatch,['SLAT_2']);
 assert.equal(p.center.extended,false);
});
test('uncommanded intermediate positions and other jammed devices do not show stale green',()=>{
 let s=LE.initialState();
 s=LE.apply(s,lever(15));s=LE.apply(s,tick(10));
 s=LE.apply(s,{type:'JAM',device:'SLAT_4',value:true});
 s=LE.apply(s,lever(0)); // retract requested; jam stays at FULL_EXT
 const p=LE.evaluate(s);
 assert.equal(p.indication.SLAT_4,'FULL_EXT');
 assert.equal(p.overhead.windows['SLAT_4|FULL_EXT'],false);
 assert.equal(p.overhead.windows['SLAT_4|TRANSIT'],true);
 assert.equal(p.overhead.windows['SLAT_4|EXT'],false);
});
test('jam at the already-commanded detent leaves its valid green lamp on',()=>{
 const p=run([lever(5),tick(10),{type:'JAM',device:'SLAT_2',value:true}]);
 assert.equal(p.mismatch.length,0);
 assert.equal(p.overhead.windows['SLAT_2|EXT'],true);
 assert.equal(p.overhead.windows['SLAT_2|TRANSIT'],false);
});
test('sensor disagreement is annunciated as amber and extinguishes green',()=>{
 const p=run([lever(15),tick(10),{type:'SENSOR',device:'SLAT_2',value:'EXT'}]);
 assert.equal(p.position.SLAT_2,2);
 assert.equal(p.indication.SLAT_2,'EXT'); // sensor-reported detent
 assert.equal(p.overhead.indication.SLAT_2,'TRANSIT');
 assert.equal(p.overhead.windows['SLAT_2|EXT'],false);
 assert.equal(p.overhead.windows['SLAT_2|FULL_EXT'],false);
 assert.equal(p.overhead.windows['SLAT_2|TRANSIT'],true);
});
test('with a jam, momentary TEST overrides all lamps then returns to amber-only mismatch',()=>{
 let s=LE.initialState();
 for(const command of [lever(5),tick(10),{type:'JAM',device:'SLAT_2',value:true},lever(15),tick(5)])s=LE.apply(s,command);
 s=LE.apply(s,{type:'TEST',value:true});
 let p=LE.evaluate(s);
 assert.equal(Object.values(p.overhead.windows).filter(Boolean).length,26);
 s=LE.apply(s,{type:'TEST',value:false});p=LE.evaluate(s);
 assert.equal(p.overhead.windows['SLAT_2|EXT'],false);
 assert.equal(p.overhead.windows['SLAT_2|FULL_EXT'],false);
 assert.equal(p.overhead.windows['SLAT_2|TRANSIT'],true);
});
