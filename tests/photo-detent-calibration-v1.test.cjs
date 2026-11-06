'use strict';
// Deterministic 16-gauge photo-detent audit with real pointer SVG transforms,
// absolute zeros, every printed line, 1/4 subdivisions and random ECU values.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const calibration=require('../engine/instruments/photo-detent-calibration-v1.js');
const glyph=require('../engine/instruments/eis-dot-digits-v1.js');
const root=path.join(__dirname,'..');
const source=fs.readFileSync(path.join(root,'panel-mosaic-lab/cockpit/conventional-engine-needles-v1.js'),'utf8');
const html=fs.readFileSync(path.join(root,'panel-mosaic-lab/cockpit/index.html'),'utf8');
const names=['n1','egt','n2','fuelFlow','oilPressure','oilTemp','oilQty','vib'];
const near=(a,b,eps=1e-7)=>Math.abs(a-b)<=eps;
assert.equal(Object.keys(calibration.REFERENCE).length,8);
assert.equal(Object.keys(calibration.CENTERS).length,8);
assert.ok(html.indexOf('photo-detent-calibration-v1.js')>=0);
assert.ok(html.indexOf('photo-detent-calibration-v1.js')<html.indexOf('conventional-engine-needles-v1.js'),
 'Load calibrated photo engine before any physical pointer');
for(const name of names)for(const engine of ['engine1','engine2']){
 const p=calibration.getProfile(name,engine);
 assert.equal(p.values.length,p.angles.length,'Paired photographed marks');
 assert.ok(p.values.length>=5);
 assert.ok(near(calibration.angle(name,engine,p.values[0]),p.angles[0]),
  name+' zero must be on FIRST physical white line');
 assert.ok(near(calibration.angle(name,engine,p.values.at(-1)),p.angles.at(-1)),
  name+' must end on LAST physical white line');
 const detents=calibration.detents(name,engine,4);
 assert.equal(detents.length,(p.values.length-1)*4+1);
 for(const line of detents){
  assert.ok(near(calibration.angle(name,engine,line.value),line.angle));
  assert.ok(near(calibration.valueAt(name,engine,line.angle),line.value,1e-6));
 }
 const audit=calibration.audit(name,engine,{count:2048,seed:17117});
 assert.equal(audit.pass,true,name+' '+engine+' randomized full-sweep error');
 assert.ok(audit.maxValueError<1e-6);
}
const n1=calibration.getProfile('n1','engine2');
const egt=calibration.getProfile('egt','engine1');
assert.equal(n1.values.length,13);
assert.equal(egt.values.length,11);
assert.equal(egt.values[0],0);
assert.equal(egt.values.at(-1),1000);
assert.equal(n1.values.at(-1),120);
assert.equal(calibration.getProfile('n2','engine1').status,'OWNER_LOCKED');
for(let p=0;p<=120;p+=2.5)
 assert.ok(near(calibration.angle('n2','engine1',p),45+p/10*22.5),
  'Owner-approved N2 calibration must not change');
for(let sample=0;sample<=120;sample+=.37){
 const display=glyph.format(sample,{decimals:1,integerDigits:3});
 assert.ok(Math.abs(Number(display)-sample)<=.05000001,'N1 numeric rounds live value without drift');
}
for(let sample=0;sample<=1000;sample+=.87){
 const display=glyph.format(sample,{decimals:0,integerDigits:3});
 if(sample<999.5)
  assert.ok(Math.abs(Number(display)-sample)<=.50000001,'EGT digital rounding follows same ECU reading');
}
// Browser-free SVG shim: getAngle must equal the actually rendered photo pointer.
class Elem{
 constructor(tag){this.tag=tag;this.attrs={};this.dataset={};this.style={};this.children=[];this.parentNode=null;}
 setAttribute(k,v){this.attrs[k]=String(v);}
 append(child){this.children.push(child);child.parentNode=this;return child;}
 remove(){if(this.parentNode)this.parentNode.children=this.parentNode.children.filter(x=>x!==this);}
}
const host=new Elem('div'),listeners=new Map();
const document={
 baseURI:'https://test.invalid/panel-mosaic-lab/cockpit/',
 createElementNS:(_,tag)=>new Elem(tag)
};
const window={B737PhotoDetentCalibrationV1:calibration,
 B737EngineIndicationModeV1:{wrap:()=>host,layout:()=>({cssMatrix:'matrix(1,0,0,1,0,0)'})},
 addEventListener:(name,fn)=>listeners.set(name,fn)};
vm.runInNewContext(source,{document,window,URL,console});
const physical=window.B737ConventionalNeedlesV1;
assert.equal(physical.getSpecs().length,16);
assert.equal(physical.getPhotoDetentAudit().pass,true);
const rotors=new Map();
for(const el of host.children[0].children.filter(el=>el.attrs['data-conventional-needle'])){
 rotors.set(el.attrs['data-conventional-needle'],el.children[0]);
}
assert.equal(rotors.size,16);
let sampleCount=0;
let rng=1941;
for(const signal of names)for(const engine of ['engine1','engine2']){
 const marks=calibration.getProfile(signal,engine).values;
 const values=[...marks,...calibration.detents(signal,engine,4).map(t=>t.value)];
 for(let i=0;i<256;i++){
  rng=(Math.imul(rng,1664525)+1013904223)>>>0;
  values.push(marks[0]+rng/4294967296*(marks.at(-1)-marks[0]));
 }
 for(const value of values){
  physical.setReading(engine,signal,value,'ENGINE_INDICATION_BACKEND_V2');
  const id=signal+'_'+engine.at(-1),pointer=rotors.get(id);
  const parsed=Number(pointer.attrs.transform.match(/rotate\(([-0-9.]+)\)/)[1]);
  const expected=calibration.angle(signal,engine,value);
  assert.ok(near(parsed,expected,.000501),
   id+' pointer is not on the same detent as live digital/ECU value '+value);
  assert.ok(near(physical.getReadings()[id].value,value,1e-8));
  sampleCount++;
 }
}
assert.ok(sampleCount>4500,'Full marked-and-random mechanical instrument coverage');
// Synthetic source image proves that detection is real pixel analysis, not
// simply returning a prefilled reference array.
const frame={width:1463,height:1075,data:new Uint8ClampedArray(1463*1075*4)};
for(const signal of ['n1','egt']){
 const [cx,cy]=calibration.CENTERS[signal][0];
 for(const angle of calibration.REFERENCE[signal].angles){
  for(let a=angle-.65;a<=angle+.65;a+=.32){
   const radians=a*Math.PI/180;
   for(let r=43;r<=70;r+=.5){
    const x=Math.round(cx+r*Math.sin(radians)),y=Math.round(cy-r*Math.cos(radians)),i=(y*1463+x)*4;
    frame.data[i]=frame.data[i+1]=frame.data[i+2]=245;frame.data[i+3]=255;
   }
  }
 }
 const result=calibration.photoScan(frame,signal,'engine1');
 assert.equal(result.passed,true,signal+' synthetic white-stroke scan must pass');
 assert.equal(calibration.applyPhotoScan(result),true);
 assert.equal(calibration.getProfile(signal,'engine1').status,'PHOTO_VERIFIED');
 assert.equal(calibration.getProfile(signal,'engine2').status,'PHOTO_MEASURED',
  'Engine 2 photograph must remain separately calibrated');
}
assert.equal(calibration.getProfile('n2','engine1').status,'OWNER_LOCKED');
const n2Result={signal:'n2',engine:'engine1',passed:true,angles:[44,88,130,180,229,280,320]};
assert.equal(calibration.applyPhotoScan(n2Result),false);
assert.equal(calibration.angle('n2','engine1',60),180);
const invalid=calibration.photoScan({width:1463,height:1075,data:new Uint8ClampedArray(1463*1075*4)},
 'n1','engine2');
assert.equal(invalid.passed,false,'Blank/ambiguous source photograph must fail closed');
assert.equal(calibration.applyPhotoScan(invalid),false);
console.log('PHOTO_DETENT_CALIBRATION_PASS',JSON.stringify({
 gauges:16,needleTests:sampleCount,randomPerGauge:256,
 measuredAbsoluteZeros:[n1.angles[0],egt.angles[0]],egtMax:1000,n2Preserved:true,
 ambiguousPhotoRejected:true
}));
