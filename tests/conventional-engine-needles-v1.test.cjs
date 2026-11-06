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
 egt:{unit:100,maximum:1000,sample:504},
 n2:{unit:10,maximum:120,sample:71.4},
 fuelFlow:{unit:1000,maximum:12000,sample:1200}
};
// Photo-extracted ALL white radial strokes, including the 10%/100°C
// intermediate graduations. EGT physically ENDS at 10, not 12.
const markedAngles={
 n1:[48.5,72.5,93.8,117.8,139,160.5,181.2,202.8,223.8,246,268.5,291.8,314.2],
 egt:[48.8,87.5,110.5,133,157.2,181.2,204.2,227.8,251.2,276,318.2],
 n2:[45,90,135,180,225,270,315],
 fuelFlow:[46,89,134,180,226,274,320]
};
const near=(a,b)=>Math.abs(a-b)<1e-9;
for(const [signal,{unit,maximum,sample}] of Object.entries(instrumentScale)){
 for(const engine of ['engine1','engine2']){
  const spec=specs.find(s=>s.engine===engine&&s.signal===signal);
  assert.ok(spec,'Missing calibrated gauge '+signal+'/'+engine);
  assert.equal(spec.max,maximum,signal+' must stop at last printed scale value');
  const angles=markedAngles[signal],registered=api.getDialCalibration()[signal];
  assert.deepEqual(JSON.parse(JSON.stringify(registered.photoTickAngles)),angles);
  const full=signal==='n1'||signal==='egt';
  const marks=full?Array.from({length:angles.length},(_,i)=>i):[0,2,4,6,8,10,12];
  const raw=marks.map(mark=>mark*unit);
  assert.deepEqual(JSON.parse(JSON.stringify(registered.dialLabels)),marks);
  assert.deepEqual(JSON.parse(JSON.stringify(registered.detentValues)),raw);
  for(let i=0;i<raw.length;i++){
   const actual=api.getAngle(engine,signal,raw[i]);
   assert.ok(near(actual,angles[i]),
    signal+' '+engine+' must hit physical white stroke '+marks[i]+': '+actual+' vs '+angles[i]);
   if(i+1<raw.length){
    // Half and quarter marks are continuous (no quantization / stalling).
    for(const fraction of [.25,.5,.75]){
     const v=raw[i]+(raw[i+1]-raw[i])*fraction;
     const expected=angles[i]+(angles[i+1]-angles[i])*fraction;
     assert.ok(near(api.getAngle(engine,signal,v),expected),
      signal+' '+engine+' smooth between adjacent white graduations '+i+' and '+(i+1));
    }
   }
  }
  const p=Math.min((angles.length-2),Math.floor(sample/unit/(full?1:2)));
  const stride=full?1:2,alpha=(sample/unit-p*stride)/stride;
  assert.ok(near(api.getAngle(engine,signal,sample),
    angles[p]+(angles[p+1]-angles[p])*alpha),
   signal+' live digital ECU value must follow the physical source-photo dial');
  assert.ok(near(api.getAngle(engine,signal,maximum+500),angles[angles.length-1]),
   'Beyond-scale value parks at last physical white stroke');
 }
}
assert.ok(near(api.getAngle('engine1','egt',504),182.12),
 '504°C = 5.04 on the 0..10 EGT dial, between ticks 5 and 6');
assert.ok(near(api.getAngle('engine1','n1',60),181.2),
 '60% N1 lands on the measured 6-mark line');
// Accepted N2 0–120% detents, angles and intermediate motion are unchanged.
for(const v of [0,12,35.7,60,71.4,84.4,100,120]){
 assert.ok(near(api.getAngle('engine1','n2',v),45+v/10*22.5),
  'Approved N2 motion is locked at '+v+'%');
}
const secondaryMarks={
 oilPressure:{labels:[0,20,40,60,80,100],angles:[133,193,253,314,380,452]},
 oilTemp:{labels:[-50,0,50,100,150,200],angles:[101,158,219,273,315,353]},
 oilQty:{labels:[0,1,2,3,4],angles:[35,99,156,219,278]},
 vib:{labels:[0,1,2,3,4,5],angles:[225,270,315,360,405,450]}
};
for(const [signal,{labels,angles}] of Object.entries(secondaryMarks)){
 const registered=api.getDialCalibration()[signal];
 assert.deepEqual(JSON.parse(JSON.stringify(registered.dialLabels)),labels,
  signal+' must retain the source-photo value detents');
 assert.deepEqual(JSON.parse(JSON.stringify(registered.photoTickAngles)),angles,
  signal+' must retain the source-photo tick centres');
 for(const engine of ['engine1','engine2']){
  for(let i=0;i<labels.length;i++){
   assert.ok(Math.abs(api.getAngle(engine,signal,labels[i])-angles[i])<1e-9,
    signal+' '+engine+' tick '+labels[i]+' must point at its printed marking');
   if(i<labels.length-1){
    const midpoint=(labels[i]+labels[i+1])/2;
    assert.ok(Math.abs(api.getAngle(engine,signal,midpoint)-
     (angles[i]+angles[i+1])/2)<1e-9,
     signal+' analog pointer must interpolate between adjacent physical strokes');
   }
  }
 }
}
assert.equal(api.getAngle('engine1','n2',60),180,
 'Secondary recalibration cannot alter the previously approved N2 needle');
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
 const actual=Number(rotor.attrs.transform.match(/rotate\(([-\d.]+)\)/)?.[1]);
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
