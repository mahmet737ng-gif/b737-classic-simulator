const test=require('node:test');const assert=require('node:assert/strict');
const fs=require('node:fs');const path=require('node:path');const vm=require('node:vm');
const dir=__dirname;
function runtime(){
 const events=[];const listeners={};
 const window={addEventListener(n,cb){listeners[n]=cb;},dispatchEvent(ev){events.push(ev);}};
 const document={currentScript:{src:'https://example.org/le-devices/panel.js'},readyState:'loading',addEventListener(){}};
 const CustomEvent=class{constructor(type,args){this.type=type;this.detail=args.detail;}};
 vm.runInNewContext(fs.readFileSync(path.join(dir,'panel.js'),'utf8'),{window,document,URL,CustomEvent});
 return {api:window.B737LeadingEdgeDevices,events};
}
test('32 windows with proper 12 amber / 16 slat greens / 4 long flap greens',()=>{
 const {api,events}=runtime();
 assert.equal(api.devices.length,12);assert.equal(api.snapshot().windows,32);
 assert.equal(api.hasWindow('FLAP_1','EXT'),false);
 assert.equal(api.hasWindow('FLAP_1','FULL_EXT'),true);
 assert.equal(api.hasWindow('SLAT_8','EXT'),true);
 assert.equal(api.setWindow('FLAP_1','EXT',true),false);
 assert.equal(api.setDevice('FLAP_1','FULL_EXT'),true);
 assert.equal(api.setDevice('SLAT_1','FULL_EXT'),true);
 api.setLampTest(true);assert.equal(api.snapshot().lampTest,true);
 api.setLampTest(false);assert.equal(api.snapshot().lampTest,false);
 assert.equal(api.snapshot().devices.FLAP_1,'FULL_EXT');
 assert.equal(api.snapshot().devices.SLAT_1,'FULL_EXT');
 assert.ok(events.some(x=>x.type==='b737:le-devices-lamp-test'&&x.detail.pressed===true));
});
test('photo reference preserved and no invented fake hardware art mounted',()=>{
 const s=fs.readFileSync(path.join(dir,'panel.js'),'utf8');
 const f=fs.readFileSync(path.join(dir,'panel-photo-unlit-v5.webp'));
 assert.equal(f.toString('ascii',0,4),'RIFF');assert.equal(f.toString('ascii',8,12),'WEBP');
 assert.ok(f.byteLength>3000);
 assert.ok(s.includes("panel-photo-unlit-v5.webp?v=LEDEV-0005"));
 assert.ok(s.includes('frame.append(host);mount(host)'));
 assert.ok(!s.includes("const cap=document.createElement('img')"));
 const {api}=runtime();
 assert.equal(api.snapshot().placement.atlas.y,0.616);
 assert.equal(api.snapshot().placement.atlas.w,0.22);
});
test('flaps are one physical span equal to two consecutive slat-green rows',()=>{
 const assets=fs.readdirSync(path.join(dir,'segments')).filter(p=>p.endsWith('.svg'));
 assert.equal(assets.length,96);
 const startOf=a=>{const s=fs.readFileSync(path.join(dir,'segments',a),'utf8');const d=s.match(/<path d="([^"]+)"/);assert.ok(d,a);const xs=d[1].replace(/[MLZ]/g,' ').trim().split(/\s+/).map(Number);assert.equal(xs.length,8);return xs;};
 for(let i=1;i<=4;i++){
  const name='FLAP_'+i;const p=startOf('LE_'+name+'_FULL_EXT_BRIGHT.svg');
  assert.ok(Math.abs(p[7]-p[1]-50.5)<0.06,'one continuous FLAP 50.5px window');
  assert.ok(!assets.some(a=>a.startsWith('LE_'+name+'_EXT_')));
 }
 for(let i=1;i<=8;i++){
  const a=startOf('LE_SLAT_'+i+'_EXT_BRIGHT.svg'),b=startOf('LE_SLAT_'+i+'_FULL_EXT_BRIGHT.svg');
  assert.ok(Math.abs(a[7]-a[1]-25)<0.06);
  assert.ok(Math.abs(b[7]-b[1]-25)<0.06);
 }
});
