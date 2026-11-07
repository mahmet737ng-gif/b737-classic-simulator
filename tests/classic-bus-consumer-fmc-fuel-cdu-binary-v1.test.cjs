'use strict';
/* Functional MRG power determination: source-quality notes must never
 * make known, usable FMC/CDU/fuel-pump feeds amber in the isolated lab.
 */
const assert=require('node:assert/strict');
const E=require('../engine/systems/electrical-v7.js');
const Core=require('../engine/systems/classic-bus-consumer-engine-v1.js');
const Lab=require('../engine/systems/classic-bus-consumer-test-lab-v1.js');
const index=require('../engine/systems/mrg-classic-340-consumer-bus-index-v1.json');
const make=()=>Lab.makeSession({Core,Electrical:E,index,
 mode:'CONVENTIONAL',pressurization:'DCPCS',aircraftModel:'737-300'});
const lab=make();
const target=row=>/^Fuel (?:Pump Control|Boost Pump) - /.test(row.name)||
 row.name==='FMC'||/^CDU (?:Captain|FO)$/.test(row.name);
const rows=()=>Object.values(lab.snapshot().consumers);
const item=name=>rows().filter(x=>x.name===name);
const device=name=>lab.snapshot().devices[name];
const checkBinary=title=>{
 const found=rows().filter(target);
 assert.ok(found.length>=16,'Every fuel controller, motor, FMC and CDU must be indexed');
 for(const row of found){
  assert.ok(['NORMAL','OFF'].includes(row.powerState),
   title+': '+row.name+' must be blue or red, found '+row.powerState);
  assert.equal(row.canOperate,row.powerState==='NORMAL',
   title+': electrical capability must agree with its binary power state');
 }
 assert.ok(['NORMAL','OFF'].includes(device('FMC').state),
  title+': composite FMC device must never be amber');
};
checkBinary('all 24 buses powered');
const duplicated=item('Fuel Pump Control - Main Tank 1 Fwd');
assert.equal(duplicated.length,2,'Both source audit references are retained');
assert.deepEqual(duplicated.map(x=>x.powerState),['NORMAL','NORMAL']);
assert.equal(duplicated[1].duplicateSourceOf,duplicated[0].id);
assert.equal(duplicated[0].quality,'MRG_SOURCE_REVIEW_PENDING',
 'Index QA evidence stays separate from powered state');
assert.equal(item('FMC')[0].source.sourceConfidence,'NEEDS_PHOTO_QA');
assert.equal(item('FMC')[0].powerState,'NORMAL','Photo QA does not silently cut power');
assert.equal(device('FMC').topology,'ANY_AVAILABLE', 'The canonical 3-feed topology labels FMC as an any-available source device');
assert.equal(item('CDU Captain')[0].feedBus,'electronic2');
assert.equal(item('CDU FO')[0].feedBus,'electronic1');
for(const key of lab.buses){
 lab.restore();
 lab.set(key,false);
 checkBinary('individual bus interruption '+key);
}
lab.restore();
lab.set('dc2@28VDC',false);
assert.deepEqual(item('Fuel Pump Control - Main Tank 1 Fwd').map(x=>x.powerState),
 ['OFF','OFF'],'Fuel pump controls immediately turn red when DC2 is absent');
assert.equal(item('Fuel Pump Control - Center Tank Right')[0].powerState,'OFF');
assert.equal(item('Fuel Boost Pump - Main Tank 1 Forward')[0].powerState,'NORMAL',
 'AC motor circuit and DC control channel remain separate electrical feeds');
lab.restore();
lab.set('electronic2@115VAC',false);
assert.equal(item('CDU Captain')[0].powerState,'OFF');
assert.equal(item('CDU FO')[0].powerState,'NORMAL');
assert.equal(item('FMC')[0].powerState,'NORMAL',
 'Electronic 1 alone provides remaining FMC electrical capability');
assert.equal(device('FMC').state,'NORMAL');
lab.set('electronic1@115VAC',false);
assert.equal(item('CDU FO')[0].powerState,'OFF');
assert.equal(item('FMC')[0].powerState,'OFF');
assert.equal(item('FMC')[1].powerState,'NORMAL',
 'FMC standby line is still energized');
assert.equal(device('FMC').state,'NORMAL',
 'Standby available keeps FMC blue even when both electronic buses are off');
lab.set('standby@115VAC',false);
assert.deepEqual(item('FMC').map(x=>x.powerState),['OFF','OFF']);
assert.equal(device('FMC').state,'OFF',
 'All three upstream FMC sources dead: red and struck through');
checkBinary('both electronics and standby interrupted');
lab.set('electronic1@115VAC',true);
assert.equal(item('FMC')[0].powerState,'NORMAL');
assert.equal(device('FMC').state,'NORMAL');
assert.equal(item('CDU FO')[0].powerState,'NORMAL');
lab.all(false);
checkBinary('all off');
assert.equal(lab.snapshot().coverage.NORMAL,0);
lab.all(true);
checkBinary('all on restored');
assert.equal(item('Rain Repellent - left (As installed)')[0].powerState,'NORMAL',
 'Electrical availability must be blue when DC1 powers the optional device');
assert.equal(item('Rain Repellent - left (As installed)')[0].installationStatus,'AS_INSTALLED_UNVERIFIED',
 'Blue electrical power must not certify that optional hardware was installed');
assert.equal(lab.snapshot().coverage.sourceRows,340);
assert.equal(lab.snapshot().coverage.logicalDevices,322);
console.log('PASS: ALL fuel pump / FMC / Captain and FO CDU entries determined BLUE/RED for 24 individual outages, mixed FMC feeds, DC2 loss and blackout; source QA retained');
