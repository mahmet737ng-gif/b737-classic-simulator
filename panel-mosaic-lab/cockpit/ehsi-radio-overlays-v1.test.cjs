const test=require('node:test'),assert=require('node:assert/strict');
const Overlay=require('./ehsi-radio-overlays-v1.js');
const valid=value=>({quality:'VALID',value});
const point={lat:35.7,lon:51.3};
const vor={stationLat:35.73,stationLon:51.36,radialDeg:120,
 bearingDeg:300,bearingReference:'TRUE',stationIdent:'TRN'};
const src={vhf:2,sg:2,course:135,magneticVariationDeg:5,heading:170};
const args={position:point,range:40,mode:'MAP',src,options:{vorAdf:true}};
test('selected COURSE 2 produces dashed line only from valid tuned NAV2',()=>{
 const x=Overlay.plan({...args,snapshot:{'navigation.vor2':valid(vor)}});
 assert.equal(x.course.channel,2);assert.equal(x.course.degree,135);
 assert.equal(x.course.trueDegree,140);assert.equal(x.course.near,true);
 assert.deepEqual(x.pointers.map(p=>p.label),['V2-120']);
});
test('stale station, untuned NAV and missing magnetic reference fail closed',()=>{
 for(const value of [undefined,{quality:'STALE',value:vor},{quality:'UNKNOWN',value:null}]){
  const x=Overlay.plan({...args,snapshot:{'navigation.vor2':value}});
  assert.equal(x.course,null);assert.equal(x.pointers.length,0);
 }
 assert.equal(Overlay.plan({...args,src:{...src,magneticVariationDeg:null},
  snapshot:{'navigation.vor2':valid(vor)}}).course,null);
});
test('valid NAV2 is independent of VOR/ADF display selection',()=>{
 const x=Overlay.plan({...args,options:{vorAdf:false},snapshot:{'navigation.vor2':valid(vor)}});
 assert.ok(x.course);assert.equal(x.pointers.length,0);
});
test('ADF bearing references convert correctly to magnetic',()=>{
 assert.equal(Overlay.adfMagnetic({bearingDeg:140,bearingReference:'TRUE'},src),135);
 assert.equal(Overlay.adfMagnetic({bearingDeg:20,bearingReference:'RELATIVE'},src),190);
 assert.equal(Overlay.adfMagnetic({bearingDeg:270,bearingReference:'MAGNETIC'},src),270);
});
test('ADF1 labels appear only on a valid signal, not an inferred NDB',()=>{
 const a={bearingDeg:35,bearingReference:'MAGNETIC'};
 const x=Overlay.plan({...args,snapshot:{'navigation.adf1':valid(a)}});
 assert.equal(x.pointers.length,1);assert.equal(x.pointers[0].label,'A1-035');
 assert.equal(x.pointers[0].stationLocated,false);
});
test('course label is hidden outside selected map range while receiver remains valid',()=>{
 const x=Overlay.plan({...args,range:10,snapshot:{'navigation.vor2':valid({
  ...vor,stationLat:35.9,stationLon:51.5})}});
 assert.ok(x.course);assert.equal(x.course.near,false);
});
test('PLAN and radio deviation modes do not receive duplicated map courses',()=>{
 for(const mode of ['PLAN','EXP_VOR_ILS','FULL_VOR_ILS']){
  const x=Overlay.plan({...args,mode,snapshot:{'navigation.vor2':valid(vor)}});
  assert.equal(x.course,null);
 }
});
