'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),C=require('../engine/tcas/classic-tcas-v2.js');
const own=()=>({airborne:true,altitudeFt:10000,radioAltitudeFt:6000,tasKt:220,gsKt:220,pitchDeg:2,vsFpm:0,trueHeadingDeg:0,trueTrackDeg:0,elapsedSec:0});
const bench={xpdr1:true,xpdr2:true,adc1:true,adc2:true,radioAlt:true,irs:true,aligned:true,computer:true};
function run(id,seconds,respond=false,change={}){let o={...own(),...change},s=C.create(id,o),c=C.controls(),history=[];
 for(let t=0;t<seconds;t++){
  if(respond&&s.output?.ra){const r=s.output.ra;o.vsFpm=r.min??r.max??0;o.pitchDeg=C.pitchForVs(o.vsFpm,{...o,vsFpm:0,pitchDeg:2});}
  o.altitudeFt+=o.vsFpm/60;o.radioAltitudeFt+=o.vsFpm/60;o.elapsedSec++;
  s=C.step(s,o,1,c,bench);history.push(s.output);
 }return {s,o,c,history};}
test('same-level zero-rate intruder has a moving range and TA/RA progression determined by geometry',()=>{
 const r=run('SAME_LEVEL',30),first=r.history[0].targets[0],last=r.history.at(-1).targets[0];
 assert.ok(first.distance>last.distance);assert.equal(first.relativeAltitude,0);assert.equal(first.verticalRate,0);
 assert.ok(r.history.some(x=>x.advisory==='TA'));assert.ok(r.history.some(x=>x.advisory==='RA'));
 assert.equal(r.history.at(-1).ra.id,'CLIMB');
});
test('converging/diverging altitude and arrows reflect measured intruder rates',()=>{
 const a=run('CONVERGING_ABOVE',10).history,b=run('DIVERGING_ABOVE',10).history;
 assert.ok(a[0].targets[0].relativeAltitude>a.at(-1).targets[0].relativeAltitude);
 assert.equal(a[0].targets[0].verticalRelation,'CONVERGING');assert.equal(a[0].targets[0].verticalRate,-1200);
 assert.equal(b[0].targets[0].verticalRelation,'DIVERGING');assert.equal(b.at(-1).advisory,null);
});
test('pilot pitch response changes relative separation and ends RA before the unresponsive encounter',()=>{
 const responded=run('CLIMB',40,true),unresponsive=run('CLIMB',40,false);
 assert.ok(responded.history.some(x=>x.clearOfConflict));assert.equal(unresponsive.history.at(-1).clearOfConflict,false);
 assert.ok(Math.abs(responded.history.at(-1).targets[0].relativeAltitude)>Math.abs(unresponsive.history.at(-1).targets[0].relativeAltitude));
});
test('reversal follows an intruder maneuver and stronger rate is subsequent only',()=>{
 const r=run('REVERSAL_CLIMB',35).history;
 const ids=r.map(x=>x.ra?.id).filter(Boolean);assert.equal(ids[0],'DESCEND');assert.ok(ids.includes('REVERSAL_CLIMB'));
 const i=run('INCREASE_CLIMB',35).history.map(x=>x.ra?.id).filter(Boolean);assert.equal(i[0],'CLIMB');assert.ok(i.includes('INCREASE_CLIMB'));
});
test('transponder modes, dual feeds, altitude source, octal code, IDENT and test eligibility',()=>{
 const o=own(),c=C.controls();assert.throws(()=>C.transponder({...c,code:'1888'},o,bench),/OCTAL/);
 for(const mode of ['STBY','ALT_OFF','ALT_ON','TA_ONLY','TA_RA']){
  const x=C.transponder({...c,mode},o,bench);assert.equal(x.surveillance,['TA_ONLY','TA_RA'].includes(mode));
  assert.equal(x.altitudeReporting,!['STBY','ALT_OFF'].includes(mode));
 }
 assert.equal(C.transponder(c,o,{...bench,xpdr1:false}).failed,true);
 assert.equal(C.transponder({...c,unit:2},o,{...bench,xpdr1:false}).failed,false);
 assert.equal(C.transponder(c,o,{...bench,adc1:false}).altitudeReporting,false);
 assert.equal(C.transponder({...c,altSource:2},o,{...bench,adc1:false}).altitudeReporting,true);
 const s=C.create('CLIMB',o);
 assert.equal(C.output(s,o,{...c,mode:'TEST'},{...bench,aligned:false}).stage,'TEST FAIL');
 assert.equal(C.output(s,{...o,airborne:false},{...c,mode:'TEST'},bench).stage,'TEST OK');
 assert.equal(C.transponder({...c,mode:'TEST'},o,bench).displayedCode,'8888');
});
test('actual inhibits, missing sources and source failures suppress RA without erasing other EFIS inputs',()=>{
 const r=run('CLIMB',24),s=r.s,c=C.controls();
 for(const [o,feeds,patch] of [[{radioAltitudeFt:999},bench,{}],[{}, {...bench,radioAlt:false},{}],[{}, {...bench,adc1:false},{}],[{},bench,{mode:'TA_ONLY'}],[{},bench,{priorityWarning:true}]])
  assert.equal(C.output(structuredClone(s),{...r.o,...o},{...c,...patch},feeds).ra,null);
 assert.equal(C.output(s,r.o,c,{...bench,xpdr1:false}).mode,'FAIL');
 assert.equal(C.output(s,r.o,c,{...bench,radioAlt:null}).ra,null);
 assert.equal(C.output(s,r.o,c,{...bench,computer:null}).mode,'FAIL');
});
test('MRG invalid RA is an own-aircraft echo and changing transponder removes that echo',()=>{
 const o=own(),s=C.create('INVALID_RA',o),c=C.controls();
 const a=C.output(s,o,c,bench);assert.equal(a.targets.at(-1).relativeAltitude,0);assert.equal(a.targets.at(-1).distance,0);assert.equal(a.voiceAllowed,false);
 const b=C.output(s,o,{...c,unit:2},bench);assert.ok(!b.targets.some(t=>t.invalidEcho));
});
test('unknown altitude cannot produce RA; non-transponder targets disappear; offscale uses a physical crossing encounter',()=>{
 assert.ok(run('NO_ALTITUDE',35).history.every(x=>!x.ra));assert.equal(run('NO_TRANSPONDER',30).s.output.targets.length,0);
 const off=run('OFFSCALE',40).history.find(x=>x.advisory==='RA');assert.ok(off);assert.ok(off.targets[0].bearing>35&&off.targets[0].bearing<55);
 const n=run('NO_BEARING',30).s.output;assert.equal(n.targets[0].bearing,null);assert.ok(n.advisory);
});
