'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const Reference=require('../engine/efis/selected-heading-reference-v1.js');
globalThis.B737SelectedHeadingReferenceV1=Reference;
const Sources=require('../panel-mosaic-lab/cockpit/unified-efis-sources-v1.js');
const EHSI=require('../efis-display-lab/ehsi-v2.js');
const near=(a,b,t=.01)=>assert.ok(Math.abs(a-b)<=t,a+' != '+b);
const num=(x)=>typeof x==='number'&&Number.isFinite(x);
function snapshot({lat=35.689175,lon=51.314392,trainerOnly=true,magVar=null,heading=91,track=91,selected=134,source='EXTERNAL_TELEMETRY'}={}){
 const iru={powered:true,positionValid:true,attitudeValid:true,lat,lon,headingDeg:heading,trackDeg:track,
  pitchDeg:0,rollDeg:0,trainerOnly,source,magneticVariationDeg:magVar};
 return {'irs.left':{quality:'VALID',value:iru},'irs.right':{quality:'VALID',value:iru},
  'mcp.state':{quality:'VALID',value:{powered:true,headingDeg:selected}},
  'electrical.buses':{quality:'VALID',value:{bus:{}}}};
}
function src(x,airport){return Sources.resolve(snapshot(x),'CAPT',{}, {1:true,2:true},{},airport??null);}
test('regression: Tehran TRUE track 091 and MCP magnetic heading 134 generates bug at TRUE 139',()=>{
 const v=src({});
 assert.equal(v.trueRef,true);
 near(v.track,91);
 near(v.selectedHeading,139);
 assert.equal(v.headingReferenceSource,'TRAINING_NEARBY_WMM2020_ESTIMATE_OIII');
 assert.equal(v.selectedHeadingEstimated,true);
 const m=EHSI.model({mode:'MAP',heading:v.heading,track:v.track,selectedHeading:v.selectedHeading});
 const p=EHSI.selectedHeadingPresentation(m,EHSI.LAYOUT.MAP);
 assert.equal(p.onArc,false);assert.equal(p.offScale,true);assert.equal(p.vectorVisible,true);
 near(p.delta,48);
});
test('Mashhad and Shiraz use airport-specific explicitly labeled simulation variation',()=>{
 const mash=src({lat:36.234821,lon:59.642949,selected:320,heading:320,track:320});
 const shir=src({lat:29.5392,lon:52.589802,selected:290,heading:290,track:290});
 near(mash.selectedHeading,324.7);near(shir.selectedHeading,293.4);
 assert.ok(mash.headingReferenceSource.includes('OIMM'));
 assert.ok(shir.headingReferenceSource.includes('OISS'));
});
test('confirmed observed variation has priority over training approximation and compass becomes magnetic',()=>{
 const v=src({magVar:5.25,track:91,selected:134});
 assert.equal(v.trueRef,false);
 near(v.track,85.75);near(v.selectedHeading,134);
 assert.equal(v.headingReferenceSource,'OBSERVED_MAGNETIC_VARIATION');
});
test('no invented variation in real external source with no evidence',()=>{
 const v=src({trainerOnly:false,selected:134});
 assert.equal(v.selectedHeading,null);
 assert.equal(v.headingReferenceSource,'MAG_TO_TRUE_REFERENCE_UNAVAILABLE');
});
test('active OIII instructor scenario retains provenance after moving more than 90 NM from airport',()=>{
 const v=src({lat:36.4,lon:53.8,selected:134},'OIII');
 near(v.selectedHeading,139);
 assert.equal(v.headingReferenceSource,'TRAINING_SCENARIO_ORIGIN_ESTIMATE_OIII');
 const unscoped=src({lat:36.4,lon:53.8,selected:134});
 assert.equal(unscoped.selectedHeading,null);
});
test('heading wrap 359 to 000 is continuous and visible in expanded compass',()=>{
 const m=EHSI.model({mode:'EXP_NAV',heading:355,track:355,selectedHeading:15});
 const p=EHSI.selectedHeadingPresentation(m,EHSI.LAYOUT.EXP_NAV);
 near(p.delta,20);assert.equal(p.onArc,true);
 const off=EHSI.selectedHeadingPresentation(EHSI.model({
  mode:'EXP_NAV',heading:91,track:91,selectedHeading:139}),EHSI.LAYOUT.EXP_NAV);
 assert.equal(off.offScale,true);
 assert.equal(off.vectorVisible,true);
 assert.equal(Reference.resolve({selectedMagDeg:359,displayTrueRef:true,
  trainerOnly:true,positionValid:true,lat:35.69,lon:51.31}).selectedDisplayDeg,4);
});
test('no heading bug without selected value, disabled MCP or unaligned IRS',()=>{
 const v=src({selected:null});
 assert.equal(v.selectedHeading,null);
 assert.equal(Reference.resolve({selectedMagDeg:null}).selectedDisplayDeg,null);
 const old=snapshot();old['mcp.state'].value.powered=false;
 assert.equal(Sources.resolve(old,'CAPT',{}, {1:true,2:true},{},'OIII').selectedHeading,null);
});
