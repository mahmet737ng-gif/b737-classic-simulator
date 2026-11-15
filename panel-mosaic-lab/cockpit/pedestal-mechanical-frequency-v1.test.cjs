const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const script=fs.readFileSync(path.join(__dirname,'pedestal-mechanical-frequency-v1.js'),'utf8');
function api(){
 const window={addEventListener:()=>{}};
 const document={readyState:'loading',addEventListener:()=>{}};
 vm.runInNewContext(script,{window,document,URL,location:{href:'https://test.local/'},MutationObserver:class{}});return window.B737UnifiedMechanicalFrequencyV1;
}
test('LAN COM/NAV published ranges and frequency steps are enforced',()=>{
 const a=api();
 assert.equal(a.version,'PD-ROLLING-FREQUENCY-0003');
 assert.equal(a.channels.COMM.min,118000);
 assert.equal(a.channels.COMM.max,136975);
 assert.equal(a.channels.COMM.step,25);
 assert.equal(a.channels.NAV.min,108000);
 assert.equal(a.channels.NAV.max,117950);
 assert.equal(a.channels.NAV.step,50);
 for(const x of [118000,118025,125550,136975]) assert(a.valid('COMM',x));
 for(const x of [117975,136980,137000,118012,136999]) assert(!a.valid('COMM',x));
 for(const x of [108000,110300,117950]) assert(a.valid('NAV',x));
 for(const x of [107950,108025,117975,118000]) assert(!a.valid('NAV',x));
});
test('five-drum classic display retains exact channel internally',()=>{
 const a=api();
 assert.equal(a.display(118000),'118.00');
 assert.equal(a.display(118025),'118.02');
 assert.equal(a.display(118050),'118.05');
 assert.equal(a.display(118075),'118.07');
 assert.equal(a.display(136975),'136.97');
 assert.equal(a.display(108000),'108.00');
 assert.equal(a.display(117950),'117.95');
 assert.equal(a.display(null),'---.--');
});
test('all two COM, two NAV sets own radio slots and one AUTO per NAV',()=>{
 const a=api();const windows=Array.from(a.windows);
 assert.equal(windows.length,8);
 assert.equal(windows.filter(x=>x.kind==='COMM').length,4);
 assert.equal(windows.filter(x=>x.kind==='NAV'&&!x.automatic).length,2);
 assert.equal(windows.filter(x=>x.automatic).length,2);
 for(const w of windows){
  assert(w.rect[0]>=0&&w.rect[1]>=0);
  assert(w.rect[0]+w.rect[2]<w.dim[0]);
  assert(w.rect[1]+w.rect[3]<w.dim[1]);
 }
});

test('NAV AUTO has a valid visible training seed and can be overridden by FMC',()=>{
 const a=api();
 assert.equal(a.defaultNavAutoKhz,110300);
 assert(a.valid('NAV',a.defaultNavAutoKhz));
 assert.equal(a.display(a.defaultNavAutoKhz),'110.30');
 assert(a.setNavAuto('CAPT',113900));
 assert(!a.setNavAuto('FO',117975));
 assert(!a.setNavAuto('INVALID',110300));
});
