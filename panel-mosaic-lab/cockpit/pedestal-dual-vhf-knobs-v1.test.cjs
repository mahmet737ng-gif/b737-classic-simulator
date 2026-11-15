const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
test('VHF photographic knob geometry and independent axes',()=>{
 const base=__dirname;
 const source=fs.readFileSync(path.join(base,'pedestal-dual-vhf-knobs-v1.js'),'utf8');
 const eventHandlers={};
 const window={addEventListener:(name,fn)=>{eventHandlers[name]=fn;},dispatchEvent:()=>{}};
 const document={currentScript:{src:'https://example.test/pedestal-dual-vhf-knobs-v1.js'},
  readyState:'loading',addEventListener:()=>{}};
 vm.runInNewContext(source,{window,document,URL,location:{href:'https://example.test'},
  CustomEvent:class CustomEvent{},MutationObserver:class MutationObserver{}});
 const api=window.B737UnifiedVHFDualV1;
 assert.equal(api.slots.length,3);
 assert.deepEqual(Array.from(api.slots,x=>x.id),['comm-left','comm-right','nav-manual']);
 assert.deepEqual(Array.from(new Set(Array.from(api.slots,x=>x.plate))),['vhf-comm','vhf-nav']);
 for(const s of api.slots){
  assert(s.cx>s.d/2&&s.cy>s.d/2);
  assert(s.cx+s.d/2<s.sw&&s.cy+s.d/2<s.sh);
 }
 const comm=api.slots.filter(s=>s.kind==='COMM');
 assert(Math.abs(comm[0].cy-comm[1].cy)<0.01);
 assert.equal(api.version,'PD-VHF-DUAL-0001');
 assert(fs.existsSync(path.join(base,'assets/vhf-concentric-ivory-v1.webp')));
 const image=fs.readFileSync(path.join(base,'assets/vhf-concentric-ivory-v1.webp'));
 assert.equal(image.toString('ascii',0,4),'RIFF');
 assert.equal(image.toString('ascii',8,12),'WEBP');
});
