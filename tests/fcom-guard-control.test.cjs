'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const mechanics=require('../flight-controls-panel/fcom-control-mechanics.js');
const registry=JSON.parse(fs.readFileSync(path.join(__dirname,'../flight-controls-panel/fcom-controls-registry.json'),'utf8'));
test('Every current guarded control matches the FCOM registry',()=>{
  assert.equal(registry.guarded.length,6);
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
  assert.equal(mechanics.definitions.emergencyExitLights.guarded,'armed');
  const light=mechanics.guardTransition('emergencyExitLights',{value:'on',guard:'open'},'close');
  assert.deepEqual(light.state,{value:'armed',guard:'closed'});
  for(const id of ['flightA','flightB','spoilerA','spoilerB'])assert.equal(mechanics.definitions[id].guarded,'on');
});
test('Unknown guard action and invalid detent fail closed',()=>{
  assert.equal(mechanics.guardTransition('fake',{value:'off',guard:'open'},'close').ok,false);
  assert.equal(mechanics.guardTransition('alternateFlapsArm',{value:'off',guard:'open'},'set','on').ok,false);
  assert.equal(mechanics.guardTransition('alternateFlapsArm',{value:'off',guard:'closed'},'nonsense').ok,false);
});
test('Horizontal NAV transfer mechanics preserve three detents with hard stops',()=>{
  for(const id of ['vhfNav','irs','efi']){
    assert.deepEqual([...mechanics.horizontal[id]],['left','normal','right']);
    assert.equal(mechanics.horizontalTransition(id,'normal','step',-1).value,'left');
    assert.equal(mechanics.horizontalTransition(id,'normal','step',1).value,'right');
    assert.equal(mechanics.horizontalTransition(id,'left','step',-1).value,'left');
    assert.equal(mechanics.horizontalTransition(id,'right','step',1).value,'right');
    assert.equal(mechanics.horizontalTransition(id,'right','choose','normal').value,'normal');
  }
  const html=fs.readFileSync(path.join(__dirname,'../flight-controls-panel/index.html'),'utf8');
  assert.match(html,/fcom-control-mechanics\.js/);
  assert.equal((html.match(/class="paddle-guard"/g)||[]).length,4);
  assert.equal((html.match(/class="toggle selector"/g)||[]).length,3);
  assert.equal(html.split('class="nav-frame nav-left"').length-1,3);
  assert.equal(html.split('class="nav-frame nav-center"').length-1,3);
  assert.equal(html.split('class="nav-frame nav-right"').length-1,3);
});

test('FCOM requires spring return for alt flap DOWN only',()=>{
  const alt=registry.other.find(c=>c.id==='altPosition');
  assert.deepEqual(alt.springReturn,{down:'off',up:null});
  const js=fs.readFileSync(path.join(__dirname,'../flight-controls-panel/flight-controls.js'),'utf8');
  assert.match(js,/state\.altPosition === 'down'/);
});

test('photo-matched three-position frames and actual JS source compile',()=>{
  const vm=require('node:vm');
  const dir=path.join(__dirname,'../flight-controls-panel');
  const html=fs.readFileSync(path.join(dir,'index.html'),'utf8');
  const css=fs.readFileSync(path.join(dir,'flight-controls.css'),'utf8');
  const js=fs.readFileSync(path.join(dir,'flight-controls.js'),'utf8');
  const map=JSON.parse(fs.readFileSync(path.join(dir,'nav-transfer-visual-calibration.json'),'utf8'));
  new vm.Script(js,{filename:'flight-controls.js'});
  assert.equal(map.nativeImageSize.width,893);
  assert.equal(map.nativeImageSize.height,1761);
  assert.ok(html.includes('flight-controls-front-empty-v1.webp'));
  for(const id of ['vhfNav','irs','efi']){
    const meta=map.switches.find(item=>item.id===id);
    assert.ok(meta,id+' missing calibration');
    const start=html.indexOf('<button class="toggle selector" data-control="'+id+'"');
    assert.ok(start>=0,id+' missing selector');
    const segment=html.slice(start,html.indexOf('</button>',start));
    for(const [detent,frameIndex] of [['left',0],['center',1],['right',2]]){
      assert.ok(segment.includes('class="nav-frame nav-'+detent+'"'),id+' '+detent);
      const offset=frameIndex*25;
      assert.ok(css.includes('.toggle.selector .nav-'+detent+'{background-position:'+offset+'% 50%}'),id+' atlas frame '+frameIndex);
    }
    const atlasPath=path.resolve(dir,'../shared-assets/toggle-switch-standard-v6/b737-toggle-five-shafts-centered-v8.webp');
    const atlas=fs.readFileSync(atlasPath);
    assert.ok(atlas.length>1000,'owner-approved atlas missing');
    assert.equal(atlas.toString('ascii',0,4),'RIFF');
    assert.equal(atlas.toString('ascii',8,12),'WEBP');
    assert.equal(require('node:crypto').createHash('sha256').update(atlas).digest('hex'),'1bf7934b77b32acac90d7ad10e41e3810a5ca65d70ff967c06f5ee171e3792f0','five aligned fixed-bezel frames unchanged');
    assert.ok(segment.includes('data:image/gif;base64,'),'legacy sprite image is not loaded');
    for(const [key,prefix] of [['x','--x'],['y','--y'],['width','--w'],['height','--h']]){
      const begin=segment.indexOf(prefix+':');
      assert.ok(begin>=0,id+' missing '+key);
      const actual=parseFloat(segment.slice(begin+prefix.length+1));
      assert.equal(actual,meta.boxPct[key],id+' '+key);
    }
  }
  assert.ok(css.includes('data-position="left"] .nav-left'));
  assert.ok(css.includes('data-position="normal"] .nav-center'));
  assert.ok(css.includes('data-position="right"] .nav-right'));
  assert.ok(css.includes('.toggle .frame-off{background-position:75% 50%}'),'OFF faces UP at the hardware bezel');
  assert.ok(css.includes('.toggle .frame-on{background-position:100% 50%}'),'ON faces DOWN at the hardware bezel');
  assert.ok(css.includes('.toggle[data-control="altPosition"][data-position="off"] .frame-center{opacity:1!important}'),'Alt flaps central OFF detent is centered');
  assert.ok(js.includes('const $$ = (selector'));
  assert.ok(!js.includes('$$$('));
  assert.ok(js.includes('pointermove')&&js.includes('setPointerCapture'));
});
