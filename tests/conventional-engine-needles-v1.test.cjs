'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const base=path.join(__dirname,'..','panel-mosaic-lab','cockpit');
const js=fs.readFileSync(path.join(base,'conventional-engine-needles-v1.js'),'utf8');
const css=fs.readFileSync(path.join(base,'conventional-engine-needles-v1.css'),'utf8');
const face=fs.readFileSync(path.join(base,'assets','conventional-engine-face-v1.svg'),'utf8');
const needle=fs.readFileSync(path.join(base,'assets','conventional-needle-photo-v1.svg'),'utf8');
const index=fs.readFileSync(path.join(base,'index.html'),'utf8');
const profile=require('../engine/config/aircraft-profile-v1.js');
assert.equal(profile.DEFAULTS.engineInstruments,'EIS');
assert.ok(index.includes('conventional-engine-needles-v1.js'));
assert.ok(index.includes('conventional-engine-needles-v1.css'));
assert.match(css,/#region-main \.conventional-engine-photo-wrap-v1>/);
assert.match(fs.readFileSync(path.join(base,'engine-indication-mode-v1.css'),'utf8'),/data-engine-indication="CONVENTIONAL"/);
assert.match(css,/z-index:8/,'The photographic needles must display over Conventional digits');
const digitCss=fs.readFileSync(path.join(base,'eis-dot-readouts-v1.css'),'utf8');
assert.match(digitCss,/conventional-dot-readouts-v1[^\n]+z-index:6/,
 'Photo-digit layer must remain below needles');
assert.equal((face.match(/data-conventional-red-lamp-socket/g)||[]).length,6);
const encoded=needle.match(/data:image\/webp;base64,([A-Za-z0-9+/=]+)/)?.[1];
assert.ok(encoded,'Photo-derived pointer must be embedded for offline GitHub Pages use');
assert.equal(Buffer.from(encoded,'base64').subarray(0,4).toString('utf8'),'RIFF');
// Browser-free DOM shim to verify exact sixteen nodes and state updates.
class Elem {
 constructor(tag){this.tag=tag;this.children=[];this.attrs={};this.dataset={};this.style={};this.parentNode=null;}
 setAttribute(k,v){this.attrs[k]=String(v)}
 append(child){this.children.push(child);child.parentNode=this}
 appendChild(child){this.append(child);return child}
 remove(){if(this.parentNode)this.parentNode.children=this.parentNode.children.filter(c=>c!==this);this.parentNode=null}
}
const host=new Elem('button');const listeners=new Map();
const doc={
 baseURI:'https://example.test/b737/panel-mosaic-lab/cockpit/',
 createElementNS:(_,tag)=>new Elem(tag),
 querySelector:selector=>selector.includes('data-piece="engine"')?host:null,
 addEventListener:()=>{}
};
const matrix='matrix(0.7,0,0,0.8,0,0)';
const win={B737EngineIndicationModeV1:{wrap:()=>host,layout:()=>({cssMatrix:matrix})},addEventListener:(key,fn)=>listeners.set(key,fn)};
vm.runInNewContext(js,{document:doc,window:win,URL,console});
const api=win.B737ConventionalNeedlesV1;
const specs=api.getSpecs();
assert.equal(specs.length,16);
const instrumentScale={
 n1:{unit:10,maximum:120,sample:35.7},
 egt:{unit:100,maximum:1200,sample:504},
 n2:{unit:10,maximum:120,sample:71.4},
 fuelFlow:{unit:1000,maximum:12000,sample:1200}
};
for(const [signal,{unit,maximum,sample}] of Object.entries(instrumentScale)){
 for(const engine of ['engine1','engine2']){
  const spec=specs.find(s=>s.engine===engine&&s.signal===signal);
  assert.ok(spec,'Missing calibrated gauge '+signal+'/'+engine);
  assert.equal(spec.max,maximum,signal+' must cover 12 printed scale units');
  for(const printed of [0,2,4,6,8,10,12]){
   const actual=api.getAngle(engine,signal,printed*unit);
   const expected=45+printed*22.5;
   assert.ok(Math.abs(actual-expected)<1e-9,
    signal+' '+engine+' printed tick '+printed+' maps to '+expected+'°, got '+actual+'°');
  }
  assert.ok(Math.abs(api.getAngle(engine,signal,sample)-
    (45+(sample/unit)*22.5))<1e-9,
   signal+' numerical ECU reading must match photographic analog scale');
  assert.equal(api.getAngle(engine,signal,maximum+500),315,
   'Over-range values must park at marked upper stop');
 }
}
assert.ok(Math.abs(api.getAngle('engine1','egt',504)-158.4)<1e-9,
 '504°C must indicate 5.04 on the 0..12 x100 EGT scale');
assert.equal(new Set(specs.map(s=>s.id)).size,16);
assert.deepEqual(JSON.parse(JSON.stringify(specs.map(s=>[s.cx,s.cy]))),[
 [427,427],[600,427],[427,596],[600,596],
 [425,747],[600,747],[426,910],[600,910],
 [805,431],[973,431],[805,591],[973,591],
 [803,748],[970,748],[803,909],[970,909]
]);
assert.equal(host.children.length,1);
const layer=host.children[0],groups=layer.children.filter(c=>c.tag==='g');
assert.equal(groups.length,16);
assert.equal(layer.attrs.viewBox,'0 0 1463 1075');
assert.equal(layer.style.transform,matrix,'Pointers retain the exact photograph affine transform');
assert.equal(layer.attrs.preserveAspectRatio,'none','Needles must share the stretched PNG coordinate system');
for(const group of groups){
 const rotor=group.children[0];
 assert.equal(rotor.children[0].tag,'image');
 assert.ok(rotor.children[0].attrs.href.endsWith('conventional-needle-photo-v1.svg?v=CONV-NEEDLE-0001'));
 assert.ok(rotor.attrs.transform.includes('translate('));
}
assert.equal(api.getReadings().n2_1.source,'UNSOURCED_PARKED');
listeners.get('b737:isn-start-indications')({detail:{engines:{
 engine1:{n2:{value:61.5},egt:{value:545}},engine2:{n2:{value:60},egt:{value:530}}
}}});
assert.equal(api.getReadings().n2_1.value,61.5);
assert.equal(api.getReadings().egt_2.value,530);
assert.equal(api.getReadings().n2_1.source,'ISN_START_SOURCE');
assert.equal(api.getReadings().oilPressure_1.source,'UNSOURCED_PARKED');
assert.equal(api.setReading('engine1','oilPressure',145),100);
assert.throws(()=>api.setReading('engine1','n1',NaN),/Non-finite/);
assert.throws(()=>api.setReading('engine3','n2',35),/Unknown engine/);
api.resetParked();
assert.equal(api.getReadings().n2_1.value,0);
assert.equal(api.getReadings().oilPressure_1.value,0);
// Real pointer transforms must follow the same value that is displayed in the
// live numerical engine readout (not merely report a matching getAngle result).
const realPointers=new Map(groups.map(g=>[g.attrs['data-conventional-needle'],g.children[0]]));
for(const [signal,{sample}] of Object.entries(instrumentScale)){
 api.setReading('engine1',signal,sample,'ENGINE_INDICATION_BACKEND_V2');
 const rotor=realPointers.get(signal+'_1');
 const expected=api.getAngle('engine1',signal,sample);
 const actual=Number(rotor.attrs.transform.match(/rotate\\(([-\\d.]+)\\)/)?.[1]);
 assert.ok(Number.isFinite(actual),'Missing rendered photo needle '+signal);
 assert.ok(Math.abs(actual-expected)<.001,
  signal+' visible pointer angle must equal digital ECU numeric value');
 assert.equal(api.getReadings()[signal+'_1'].value,sample);
 assert.equal(api.getReadings()[signal+'_1'].source,'ENGINE_INDICATION_BACKEND_V2');
}
// The old start estimates are not allowed to race against the ECU authority.
listeners.get('b737:isn-start-indications')({detail:{engines:{
 engine1:{n2:{value:10},egt:{value:900}}
}}});
assert.equal(api.getReadings().n2_1.value,71.4);
assert.equal(api.getReadings().egt_1.value,504);
assert.equal(api.getReadings().egt_1.source,'ENGINE_INDICATION_BACKEND_V2');
api.resetParked();
assert.equal(api.getReadings().egt_1.value,0);
assert.equal(api.getReadings().egt_1.source,'UNSOURCED_PARKED');
console.log('PASS: sixteen photo-derived conventional pointers, exact dial centers, EIS isolation, N2/EGT live wiring and explicit parked-state policy.');
