const test=require('node:test');const assert=require('node:assert/strict');
const fs=require('node:fs');const path=require('node:path');const vm=require('node:vm');
const dir=__dirname;
test('36 separated segments across 12 independent devices; momentary test restores states',()=>{
 const events=[];const listeners={};
 const window={addEventListener(n,cb){listeners[n]=cb;},dispatchEvent(event){events.push(event);}};
 const document={currentScript:{src:'https://example.org/panel.js'},readyState:'loading',addEventListener(){}};
 const CustomEvent=class{constructor(type,args){this.type=type;this.detail=args.detail;}};
 vm.runInNewContext(fs.readFileSync(path.join(dir,'panel.js'),'utf8'),{window,document,URL,CustomEvent});
 const api=window.B737LeadingEdgeDevices;assert.equal(api.devices.length,12);
 assert.equal(api.snapshot().windows,36);
 assert.equal(api.snapshot().brightness,'BRIGHT');
 assert.equal(api.snapshot().devices.SLAT_1,'RETRACTED');
 assert.equal(api.setDevice('SLAT_1','FULL_EXT'),true);
 api.setLampTest(true);assert.equal(api.snapshot().lampTest,true);
 api.setLampTest(false);assert.equal(api.snapshot().lampTest,false);
 assert.equal(api.snapshot().devices.SLAT_1,'FULL_EXT');
 assert.equal(api.setDevice('UNKNOWN','EXT'),false);
 assert.equal(api.setBrightness('DIM'),true);assert.equal(api.snapshot().brightness,'DIM');
 api.reset();assert.equal(api.snapshot().devices.SLAT_1,'RETRACTED');
 assert.ok(events.some(e=>e.type==='b737:le-devices-lamp-test'&&e.detail.pressed));
});
test('background is separate from active bulbs; recessed pushbutton has own asset',()=>{
 const svg=fs.readFileSync(path.join(dir,'panel-background.svg'),'utf8');
 const testArt=fs.readFileSync(path.join(dir,'recessed-test-button.svg'),'utf8');
 assert.match(svg,/viewBox="0 0 432 195"/);assert.match(svg,/LE DEVICES/);
 assert.ok(!svg.includes('#ffa600')&&!svg.includes('#35ef15'),'bright lamp colors must not be baked into static background');
 assert.match(testArt,/Recessed momentary TEST pushbutton/);
});