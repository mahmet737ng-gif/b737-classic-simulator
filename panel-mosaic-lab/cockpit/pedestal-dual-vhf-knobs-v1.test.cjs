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
 assert.equal(api.slots.length,6);
 assert.deepEqual(Array.from(api.slots,x=>x.id),['comm-capt-left','comm-capt-right','comm-fo-left','comm-fo-right','nav-capt-manual','nav-fo-manual']);
 assert.deepEqual(Array.from(new Set(Array.from(api.slots,x=>x.plate))),['vhf-comm-capt','vhf-comm-fo','vhf-nav-capt','vhf-nav-fo']);
 for(const s of api.slots){
  assert(s.cx>s.d/2&&s.cy>s.d/2);
  assert(s.cx+s.d/2<s.sw&&s.cy+s.d/2<s.sh);
 }
 const comm=api.slots.filter(s=>s.kind==='COMM');
 assert(comm.every(s=>Math.abs(comm[0].cy-s.cy)<0.01));
 assert.equal(new Set(Array.from(api.slots,s=>s.id)).size,6);
 assert.equal(api.slots.filter(s=>s.kind==='NAV').length,2);
 assert.equal(api.slots.filter(s=>s.kind==='COMM').length,4);
 assert.equal(api.version,'PD-VHF-DUAL-0004');
 assert(fs.existsSync(path.join(base,'assets/vhf-concentric-ivory-v1.webp')));
 const image=fs.readFileSync(path.join(base,'assets/vhf-concentric-ivory-v1.webp'));
 assert.equal(image.toString('ascii',0,4),'RIFF');
 assert.equal(image.toString('ascii',8,12),'WEBP');
});


test('outer and inner shafts wrap independently with zero carry in both directions',()=>{
 const script=fs.readFileSync(path.join(__dirname,'pedestal-dual-vhf-knobs-v1.js'),'utf8');
 const window={addEventListener:()=>{},dispatchEvent:()=>{}};
 const document={currentScript:{src:'https://example.test/pedestal-dual-vhf-knobs-v1.js'},readyState:'loading',addEventListener:()=>{}};
 vm.runInNewContext(script,{window,document,URL,location:{href:'https://example.test/'},CustomEvent:class{},MutationObserver:class{}});
 const {nextFrequency:next}=window.B737UnifiedVHFDualV1;
 // NAV whole MHz range: 108-117, decimal 00-95 with 50 kHz step
 assert.equal(next('NAV',108300,'outer',-1),117300);
 assert.equal(next('NAV',117300,'outer',+1),108300);
 assert.equal(next('NAV',117950,'outer',+1),108950);
 assert.equal(next('NAV',108000,'outer',-1),117000);
 assert.equal(next('NAV',110950,'inner',+1),110000);
 assert.equal(next('NAV',110000,'inner',-1),110950);
 assert.equal(next('NAV',117950,'inner',+1),117000);
 assert.equal(next('NAV',108000,'inner',-1),108950);
 assert.equal(next('NAV',110300,'outer',1),111300);
 assert.equal(next('NAV',110300,'inner',1),110350);
 // COMM MHz 118-136 and 25 kHz decimals 000-975. No carry.
 assert.equal(next('COMM',118975,'outer',-1),136975);
 assert.equal(next('COMM',136025,'outer',+1),118025);
 assert.equal(next('COMM',118975,'inner',+1),118000);
 assert.equal(next('COMM',136000,'inner',-1),136975);
 assert.equal(next('COMM',125975,'inner',+1),125000);
 assert.equal(next('COMM',125000,'inner',-1),125975);
 assert.equal(next('COMM',125550,'inner',-1),125525);
 assert.equal(next('COMM',125550,'outer',-1),124550);
 for(const kind of ['COMM','NAV']){
  const wholeStart=kind==='NAV'?108:118,wholeSize=kind==='NAV'?10:19;
  const innerStep=kind==='NAV'?50:25,innerSize=1000/innerStep;
  const base=wholeStart*1000+innerStep*6;
  let f=base;
  for(let i=0;i<wholeSize;i++)f=next(kind,f,'outer',1);
  assert.equal(f,base,'whole MHz dial returns to same value after full revolution');
  for(let i=0;i<innerSize;i++)f=next(kind,f,'inner',1);
  assert.equal(f,base,'decimal dial returns to same value with no integer carry');
 }
 assert.equal(next('NAV',107950,'outer',1),null);
 assert.equal(next('COMM',118012,'inner',1),null);
 assert.equal(next('COMM',118000,'invalid',1),null);
});
