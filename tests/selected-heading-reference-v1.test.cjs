'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const WMM=require('../engine/efis/wmm2025-magnetic-model-v1.js');
const Reference=require('../engine/efis/selected-heading-reference-v1.js');
const Sources=require('../panel-mosaic-lab/cockpit/unified-efis-sources-v1.js');
const EHSI=require('../efis-display-lab/ehsi-v2.js');
const near=(a,b,t=.03)=>assert.ok(Math.abs(a-b)<=t,a+' != '+b);
function snapshot({lat=35.689175,lon=51.314392,trainerOnly=true,magVar=null,
 magSource=null,heading=91,track=91,selected=134,source='EXTERNAL_TELEMETRY'}={}){
 const iru={powered:true,positionValid:true,attitudeValid:true,lat,lon,
  headingDeg:heading,trackDeg:track,pitchDeg:0,rollDeg:0,trainerOnly,source,
  magneticVariationDeg:magVar,magneticVariationSource:magSource};
 return {'irs.left':{quality:'VALID',value:iru},'irs.right':{quality:'VALID',value:iru},
  'mcp.state':{quality:'VALID',value:{powered:true,headingDeg:selected}},
  'electrical.buses':{quality:'VALID',value:{bus:{}}}};
}
const src=(x,scenario=null,seat='CAPT')=>Sources.resolve(snapshot(x),seat,{},{1:true,2:true},{},scenario);
test('regression Tehran: true track 091 displays 086 MAG, MCP HDG 134 stays 134 MAG',()=>{
 const x=src({});
 assert.equal(x.trueRef,false);assert.equal(x.reference,'MAGNETIC');
 assert.equal(x.headingReferenceSource,'NOAA_NCEI_BGS_WMM2025');
 const mag=WMM.evaluate({lat:35.689175,lon:51.314392});
 near(x.track,91-mag.declinationDeg);
 near(x.heading,91-mag.declinationDeg);
 near(x.selectedHeading,134);
 near(x.magneticVariationDeg,mag.declinationDeg);
 const model=EHSI.model({mode:'MAP',heading:x.heading,track:x.track,selectedHeading:x.selectedHeading});
 const v=EHSI.selectedHeadingPresentation(model,EHSI.LAYOUT.MAP);
 assert.equal(v.onArc,false);assert.equal(v.offScale,true);
 assert.equal(v.vectorVisible,true);
 near(v.delta,134-(91-mag.declinationDeg));
});
test('Mashhad and Shiraz retain MCP bug MAG while field varies with position',()=>{
 const mash=src({lat:36.234821,lon:59.642949,selected:320,heading:320,track:320});
 const shir=src({lat:29.5392,lon:52.589802,selected:290,heading:290,track:290});
 near(mash.selectedHeading,320);near(shir.selectedHeading,290);
 assert.ok(mash.magneticVariationDeg>4&&mash.magneticVariationDeg<5);
 assert.ok(shir.magneticVariationDeg>3&&shir.magneticVariationDeg<4);
 assert.notEqual(mash.magneticVariationDeg,shir.magneticVariationDeg);
 assert.equal(mash.trueRef,false);assert.equal(shir.trueRef,false);
});
test('supplied confirmed IRS variation has priority over WMM2025 computed value',()=>{
 const x=src({magVar:5.25,magSource:'DIRECT_IRS_SENSOR',track:91});
 near(x.track,85.75);near(x.selectedHeading,134);
 assert.equal(x.headingReferenceSource,'DIRECT_IRS_SENSOR');
 assert.equal(x.selectedHeadingEstimated,false);
});
test('WMM2025 magnetic reference works for valid real-position source, not just trainer',()=>{
 const x=src({trainerOnly:false,selected:134});
 assert.equal(x.selectedHeading,134);
 assert.equal(x.trueRef,false);
 assert.ok(x.magneticVariationDeg>4);
});
test('moving aircraft changes WMM declination without airport-radius lookup',()=>{
 const atOrigin=src({lat:35.689175,lon:51.314392,track:95});
 const enroute=src({lat:33,lon:55.7,track:95});
 assert.equal(enroute.selectedHeading,134);
 assert.notEqual(enroute.magneticVariationDeg,atOrigin.magneticVariationDeg);
 const bySite=WMM.evaluate({lat:33,lon:55.7});
 near(enroute.track,95-bySite.declinationDeg);
});
test('scenario position overrides old IRS position for current WMM, retaining MAG',()=>{
 const old=src({lat:35.689175,lon:51.314392,track:95});
 const scene=src({lat:35.689175,lon:51.314392,track:95},
  {lat:29.5392,lon:52.589802,altitudeFt:20000,icao:'OISS'});
 assert.notEqual(old.magneticVariationDeg,scene.magneticVariationDeg);
 near(scene.selectedHeading,134);
 const reference=WMM.evaluate({lat:29.5392,lon:52.589802,altitudeFt:20000});
 near(scene.track,95-reference.declinationDeg);
});
test('HDG bug wraps 359 to 000 as MAG without converting selected bug to TRUE',()=>{
 const m=EHSI.model({mode:'EXP_NAV',heading:355,track:355,selectedHeading:15});
 near(EHSI.selectedHeadingPresentation(m,EHSI.LAYOUT.EXP_NAV).delta,20);
 const ref=Reference.resolve({selectedMagDeg:359,positionValid:true,lat:35.69,lon:51.31});
 assert.equal(ref.selectedDisplayDeg,359);
 assert.equal(ref.reference,'MAGNETIC');
});
test('unknown position is not falsely labeled TRUE or converted with invented variation',()=>{
 const r=Reference.resolve({selectedMagDeg:134,positionValid:false,lat:null,lon:null});
 assert.equal(r.selectedDisplayDeg,null);assert.equal(r.declinationDeg,null);
 const old=snapshot();old['irs.left'].value.lat=null;old['irs.left'].value.lon=null;
 old['irs.left'].value.magneticVariationDeg=null;
 const x=Sources.resolve(old,'CAPT',{},{1:true,2:true},{});
 assert.equal(x.trueRef,false);
 assert.equal(x.heading,null);assert.equal(x.track,null);assert.equal(x.selectedHeading,null);
});
test('MCP powered and both pilot seats get same heading bug but each IRQ selected',()=>{
 const a=src({},null,'CAPT'),b=src({},null,'FO');
 near(a.selectedHeading,b.selectedHeading);
 const snap=snapshot();snap['mcp.state'].value.powered=false;
 const x=Sources.resolve(snap,'CAPT',{},{1:true,2:true},{});
 assert.equal(x.selectedHeading,null);
});

test('a WMM-tagged IRS value is recomputed at moving scenario coordinates, not frozen at origin',()=>{
 const origin=WMM.evaluate({lat:35.689175,lon:51.314392}).declinationDeg;
 const x=src({magVar:origin,magSource:'NOAA_NCEI_BGS_WMM2025',
  lat:35.689175,lon:51.314392,track:100},
  {lat:29.5392,lon:52.589802,altitudeFt:15000,icao:'OISS'});
 const newVar=WMM.evaluate({lat:29.5392,lon:52.589802,altitudeFt:15000}).declinationDeg;
 near(x.magneticVariationDeg,newVar);
 assert.equal(x.selectedHeading,134);
 assert.equal(x.trueRef,false);
 assert.equal(x.headingReferenceSource,'NOAA_NCEI_BGS_WMM2025');
});
