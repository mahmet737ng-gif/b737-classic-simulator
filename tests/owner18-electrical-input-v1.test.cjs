'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const Input=require('../engine/runtime/owner18-electrical-input-v1');
const hardware=JSON.parse(fs.readFileSync(require('node:path').join(__dirname,'../panel-mosaic-lab/cockpit/guard-owner18-v1.json')));
test('every normalized electrical detent is read from the actual approved Owner18 output',()=>{
 for(const [id,detents]of Object.entries(Input.DETENTS)){
  assert.deepEqual(detents,hardware.controls.find(x=>x.id===id).states);
  for(const value of detents){
   const p=Input.merge({guards:{}},{[id]:{value,closed:false}});
   assert.deepEqual(p.guards[id],{value:value.toLowerCase(),guard:'open'});
  }
 }
});
test('actual guarded state overrides obsolete snapshot without changing either object',()=>{
 const packet={guards:{'battery-master':{value:'off',guard:'open'}},toggles:{'gen-1':'NEUTRAL'}},actual={'battery-master':{value:'ON',closed:true}};
 const before=JSON.stringify([packet,actual]),merged=Input.merge(packet,actual);
 assert.equal(merged.guards['battery-master'].value,'on');assert.equal(merged.guards['battery-master'].guard,'closed');
 assert.equal(JSON.stringify([packet,actual]),before);
});
test('latched mechanical disconnect remains disconnected after cover closes NORMAL',()=>{
 const id='generator-disconnect-1';
 assert.equal(Input.merge({guards:{}},{[id]:{value:'NORMAL',closed:true,effects:{[id+'-drive-disconnected']:true}}}).guards[id].value,'disconnect');
});
test('asynchronous missing mounts retain existing inputs; malformed actual outputs fail closed',()=>{
 assert.deepEqual(Input.merge({guards:{x:{value:'on'}}},{}),{guards:{x:{value:'on'}}});
 assert.throws(()=>Input.merge({guards:{}},{'standby-power':{value:'MAYBE',closed:true}}));
});
