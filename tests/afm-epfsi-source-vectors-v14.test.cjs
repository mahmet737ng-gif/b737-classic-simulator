'use strict';
/* v14 source-identified case templates. These are NOT numeric Boeing golden vectors. */
const assert=require('node:assert/strict');
const n=require('../engine/fmc/performance/afm-epfsi-n1-v10.cjs');
const m=require('../engine/fmc/performance/afm-epfsi-mct-v13.cjs');
const a={registration:'EP-FSI',serial:29340,engine:'CFM56-3B-1',ratingLbf:20000};
const cases=[
 ['TO baseline', 'TAKEOFF','NORMAL',128,0],
 ['TO PMC OFF lower labelled altitude','TAKEOFF','OFF',756,-2000],
 ['TO PMC OFF sea level','TAKEOFF','OFF',756,0],
 ['TO PMC OFF upper labelled altitude','TAKEOFF','OFF',756,10000],
 ['TO PMC OFF high bleed','TAKEOFF','OFF',756,4000],
 ['GO AROUND with PMC OFF inherits AFM base','GO_AROUND','OFF',129,5000],
 ['MCT lower Mach source','MAX_CONTINUOUS','NORMAL',130,10000],
 ['MCT upper labelled Mach source','MAX_CONTINUOUS','NORMAL',130,10000],
];
let passed=0;
for(const [name,phase,pmcMode,page,pressureAltitudeFt] of cases){
 const c={...a,phase,pmcMode,pressureAltitudeFt};
 const o=n.requestN1(c);
 assert.equal(o.source?.pdfPage,page,name+' source page');
 assert.equal(o.n1Pct,null,name+' must not invent expected N1');
 assert.equal(o.status,'BLOCKED',name+' should remain blocked before final QA');
 assert.equal(o.forAutothrottle,false,name+' A/T must remain off');
 if(phase==='MAX_CONTINUOUS'){
  const r=m.requestMctN1(c);
  assert.equal(r.n1Pct,null);
  assert.equal(r.autothrottleTarget,null);
  assert.equal(r.source.pdfPage,130);
 }
 passed++;
}
const wrong=n.requestN1({...a,serial:29339,phase:'TAKEOFF',pmcMode:'NORMAL'});
assert.equal(wrong.reason,'WRONG_AIRCRAFT');
assert.equal(n.requestN1({...a,phase:'TAKEOFF',pmcMode:'UNKNOWN'}).reason,'PMC_STATE_UNVERIFIED');
assert.equal(n.CHARTS['TAKEOFF:OFF'].pdfPage,756);
assert.equal(m.STAGES.length,6);
console.log('PASS v14: '+passed+' source-routed case templates, 0 certified numeric N1 and 0 A/T output');
