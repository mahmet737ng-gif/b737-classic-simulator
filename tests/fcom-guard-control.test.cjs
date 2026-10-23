'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const mechanics=require('../flight-controls-panel/fcom-control-mechanics.js');
const registry=JSON.parse(fs.readFileSync(path.join(__dirname,'../flight-controls-panel/fcom-controls-registry.json'),'utf8'));
test('Every current guarded control matches the FCOM registry',()=>{
  assert.equal(registry.guarded.length,5);
  for(const item of registry.guarded){
    const definition=mechanics.definitions[item.id];
    assert.ok(definition,item.id);
    assert.deepEqual(definition.detents,item.detents);
    assert.equal(definition.close,item.onClose);
    assert.equal(definition.guarded,item.guardedDetent);
    assert.match(item.fcom.folio,/^[0-9]/);
  }
});
test('Guard cannot be bypassed when closed',()=>{
  for(const [id,d] of Object.entries(mechanics.definitions)){
    const original={value:d.guarded,guard:'closed'};
    const response=mechanics.guardTransition(id,original,'set',d.detents[0]);
    assert.equal(response.ok,false,id);
    assert.equal(response.reason,'GUARD_CLOSED',id);
    assert.deepEqual(response.state,original,id);
  }
});
test('Closing guard moves only to FCOM guarded position',()=>{
  for(const [id,d] of Object.entries(mechanics.definitions)){
    const start={value:d.guarded,guard:'closed'};
    const open=mechanics.guardTransition(id,start,'open');
    assert.equal(open.ok,true,id);
    const other=d.detents.find(x=>x!==d.guarded);
    const changed=mechanics.guardTransition(id,open.state,'set',other);
    assert.equal(changed.ok,true,id);
    const close=mechanics.guardTransition(id,changed.state,'close');
    assert.equal(close.ok,true,id);
    assert.deepEqual(close.state,{value:d.guarded,guard:'closed'},id);
  }
});
test('Alt flaps OFF on guard close, other flight/spoiler controls ON',()=>{
  assert.equal(mechanics.definitions.alternateFlapsArm.guarded,'off');
  for(const id of ['flightA','flightB','spoilerA','spoilerB'])assert.equal(mechanics.definitions[id].guarded,'on');
});
test('Unknown guard action and invalid detent fail closed',()=>{
  assert.equal(mechanics.guardTransition('fake',{value:'off',guard:'open'},'close').ok,false);
  assert.equal(mechanics.guardTransition('alternateFlapsArm',{value:'off',guard:'open'},'set','on').ok,false);
  assert.equal(mechanics.guardTransition('alternateFlapsArm',{value:'off',guard:'closed'},'nonsense').ok,false);
});
test('Three physical horizontal detents with hard stops and no vertical sprite substitution',()=>{
  for(const id of ['vhfNav','irs','efi']){
    assert.deepEqual([...mechanics.horizontal[id]],['left','normal','right']);
    assert.equal(mechanics.horizontalTransition(id,'normal','step',-1).value,'left');
    assert.equal(mechanics.horizontalTransition(id,'normal','step',1).value,'right');
    assert.equal(mechanics.horizontalTransition(id,'left','step',-1).value,'left');
    assert.equal(mechanics.horizontalTransition(id,'right','step',1).value,'right');
    assert.equal(mechanics.horizontalTransition(id,'right','choose','normal').value,'normal');
  }
  const html=fs.readFileSync(path.join(__dirname,'../flight-controls-panel/index.html'),'utf8');
  assert.equal((html.match(/class="h-state h-left"/g)||[]).length,3);
  assert.equal((html.match(/class="h-state h-center"/g)||[]).length,3);
  assert.equal((html.match(/class="h-state h-right"/g)||[]).length,3);
  assert.match(html,/fcom-control-mechanics\.js/);
  assert.equal((html.match(/class="paddle-guard"/g)||[]).length,4);
});
test('FCOM requires spring return for alt flap DOWN only',()=>{
  const alt=registry.other.find(c=>c.id==='altPosition');
  assert.deepEqual(alt.springReturn,{down:'off',up:null});
  const js=fs.readFileSync(path.join(__dirname,'../flight-controls-panel/flight-controls.js'),'utf8');
  assert.match(js,/state\.altPosition === 'down'/);
});
