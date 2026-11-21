'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const Source=require('../panel-mosaic-lab/cockpit/unified-efis-sources-v1.js');
const Unified=require('../panel-mosaic-lab/cockpit/ehsi-unified-v1.js');
const Render=require('../efis-display-lab/ehsi-v2.js');
const Radio=require('../panel-mosaic-lab/cockpit/ehsi-radio-overlays-v1.js');
const fmc={
 operational:true,failed:false,
 position:{quality:'VALID',latitudeDeg:35.7,longitudeDeg:51.3},
 guidance:{routeEvidenceReady:true},
 route:{active:true,legsVerified:true,discontinuitiesUnknown:false,
  displayRoute:{source:'PMDG_WORLD_2610_WITH_PROCEDURES_R1',points:[
   {name:'OIII',lat:35.7,lon:51.3,leg:'ACTIVE'},
   {name:'FIXONE',lat:35.8,lon:51.42,leg:'ACTIVE',eta:'1130.0Z'},
   {name:'OIMM',lat:36.2,lon:59.6,leg:'ACTIVE'}
  ]}}
};
const src={fmc,magneticVariationDeg:5,track:309,heading:310,selectedHeading:324,
 trueTrack:314,displayPowered:true,video:true,groundSpeed:142,windSpeed:9,windDirection:45,
 adc:{tasKt:147},bearings:[],mcp:{powered:true,course2Powered:true}};
const core=require('../efis-display-lab/core.js');
const setup=core.initial();
setup.ehsi.mode='FULL_NAV';
setup.ehsi.range=40;
const data=(f=fmc)=>Source.route(f,'FULL_NAV',1);
const full=(f=fmc)=>Source.fullNavFromRoute({...src,fmc:f},data(f));
test('FMCS active verified leg supplies actual geometric course/active fix and 2 NM/dot XTK',()=>{
 const route=data(),nav=full();
 assert.equal(route.activeIndex,1);
 assert.equal(route.verified,true);
 assert.equal(route.activeSource,'TRAINER_VERIFIED_LEG_ESTIMATE');
 assert.equal(nav.activeWaypoint,'FIXONE');
 assert.equal(nav.valid,true);
 assert.ok(nav.distanceNm>7&&nav.distanceNm<10);
 assert.ok(nav.course>25&&nav.course<65);
 assert.ok(Math.abs(nav.cdi)<.01);
 assert.equal(nav.eta,'1130.0Z');
 assert.equal(nav.source,'TRAINER_VERIFIED_LEG_ESTIMATE');
 const shifted={...route,points:route.points.map(p=>({...p}))};
 shifted.points[0].x=-2;shifted.points[0].y=-2;
 const changed=Source.fullNavFromRoute(src,shifted);
 assert.equal(changed.valid,true);
 assert.equal(changed.crossTrackNm/2,changed.cdi);
});
test('no route, failed FMC, invalid location, unverified route or discontinuity never create an active leg',()=>{
 const cases=[
  {...fmc,operational:false},
  {...fmc,failed:true},
  {...fmc,position:{quality:'UNKNOWN'}},
  {...fmc,guidance:{routeEvidenceReady:false}},
  {...fmc,route:{...fmc.route,discontinuitiesUnknown:true}},
  {...fmc,route:{...fmc.route,legsVerified:false}},
  {...fmc,route:{...fmc.route,displayRoute:{...fmc.route.displayRoute,source:'UNVERIFIED'}}},
  {...fmc,route:{...fmc.route,displayRoute:{...fmc.route.displayRoute,points:[
   fmc.route.displayRoute.points[0],{...fmc.route.displayRoute.points[1],leg:'DISCONTINUITY'}]}}}
 ];
 for(const each of cases){
  const got=Source.fullNavFromRoute({...src,fmc:each},data(each));
  assert.equal(got.valid,false,JSON.stringify(each.route?.displayRoute?.source));
 }
});
test('explicit FMC active leg index wins over proximity and does not become AFDS authority',()=>{
 const withIndex={...fmc,route:{...fmc.route,activeWaypointIndex:2}};
 const route=data(withIndex),out=Source.fullNavFromRoute({...src,fmc:withIndex},route);
 assert.equal(route.activeIndex,2);
 assert.equal(route.activeSource,'FMC_EXPLICIT');
 assert.equal(out.activeWaypoint,'OIMM');
 assert.equal(out.source,'FMC_EXPLICIT');
});
test('CAPT and FO FULL NAV live model share FMC course, not independent MCP CRS',()=>{
 const p=core.initial();p.ehsi.mode='FULL_NAV';
 const physical=core.initial();
 const a=Unified.liveModel({...src,course:105},p,physical,.8,data(),{},full());
 const b=Unified.liveModel({...src,course:275},p,physical,.8,data(),{},full());
 assert.equal(a.course,b.course);
 assert.equal(a.nav.cdi,b.nav.cdi);
 assert.equal(a.nav.activeWaypoint,'FIXONE');
 assert.equal(a.waypointBearing,full().waypointBearing);
 assert.equal(a.nav.source,'NAV');
 assert.equal(a.nav.type,'FMC');
 assert.equal(a.nav.valid,true);
 assert.equal(a.nav.activeEta,'1130.0Z');
});
test('FMC NAV without verified evidence must not replace valid radio course in VOR/ILS mode',()=>{
 const p=core.initial();p.ehsi.mode='FULL_VOR_ILS';
 const n=Unified.liveModel({...src,course:205,vor:{deviationDots:1.5}},p,core.initial(),.8,data(),{},full());
 assert.equal(n.course,205);
 assert.equal(n.nav.cdi,1.5);
 assert.equal(n.waypointBearing,null);
});
test('FULL NAV FCOM 10.31 header, course needle, selected heading and magenta waypoint bearing render',()=>{
 class El{
  constructor(tag,doc){this.tag=tag;this.ownerDocument=doc;this.children=[];this.attrs={};this.style={};}
  setAttribute(k,v){this.attrs[k]=String(v);}
  getAttribute(k){return this.attrs[k]??null}
  appendChild(c){this.children.push(c);c.parent=this;return c;}
  replaceChildren(...children){this.children=[...children]}
  querySelector(sel){return null}
 }
 const doc={createElementNS(_ns,tag){return new El(tag,doc)}};
 const svg=new El('svg',doc);svg.id='ehsi-full-fcom';
 const model=Unified.liveModel(src,setup,core.initial(),.8,data(),{},full());
 Render.render(svg,model);
 const flatten=e=>[e,...e.children.flatMap(flatten)],elements=flatten(svg);
 const segment=n=>elements.filter(x=>x.attrs['data-segment']===n);
 const words=new Set(elements.map(x=>x.attrs['data-text']).filter(Boolean));
 assert.ok(words.has('FIXONE'), 'active waypoint shown');
 assert.ok(words.has('1130.0Z'), 'FMC ETA shown');
 assert.ok(![...words].some(x=>x.startsWith('TAS')||x.startsWith('GS')),'TAS/GS absent in 10.31.8 FULL NAV');
 assert.equal(segment('course-deviation').length,1);
 assert.equal(segment('active-waypoint-bearing').length,1);
 assert.equal(segment('waypoint-bearing-pointer').length,1);
 assert.equal(segment('heading-bug-vector').length,1);
 assert.equal(segment('heading-bug').length,1);
 assert.equal(segment('compass-rose').length,1);
 assert.equal(svg.attrs['data-mode'],'FULL_NAV');
 assert.ok(segment('course-deviation')[0].children.length>0);
});
test('MCP dual green dashed overlays are not permitted in the FCOM FULL NAV presentation',()=>{
 const rec=value=>({quality:'VALID',value});
 const samples={'mcp.state':rec({powered:true,course2Powered:true,courseL:105,courseR:275}),
  'navigation.vor1':rec({stationLat:35.72,stationLon:51.32}),
  'navigation.vor2':rec({stationLat:35.74,stationLon:51.36})};
 const base={snapshot:samples,src:{sg:1,magneticVariationDeg:5},
  position:{lat:35.7,lon:51.3},range:40,options:{vorAdf:true}};
 assert.equal(Radio.plan({...base,mode:'FULL_NAV'}).courses.length,0);
 assert.deepEqual(Radio.plan({...base,mode:'MAP'}).courses.map(x=>x.degree),[105,275]);
});
test('FMC-to-IRS position difference requires FMC-supplied tolerance and valid IRS packets',()=>{
 const rec=value=>({quality:'VALID',value});
 const snapshot={'irs.left':rec({powered:true,positionValid:true,lat:35.72,lon:51.3}),
  'irs.right':rec({powered:true,positionValid:true,lat:35.7,lon:51.31})};
 assert.deepEqual(Source.positionDifference(snapshot,{...src,irs:1}),[]);
 const src2={...src,irs:1,fmc:{...fmc,positionDifferenceLimitNm:.2}};
 const diff=Source.positionDifference(snapshot,src2);
 assert.equal(diff.length,2);
 assert.equal(diff[0].side,'L');
});
