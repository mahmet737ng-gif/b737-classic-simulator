'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const Location=require('../engine/flight/flight-location-reference-v1.js');
const airports={
 OIII:{icao:'OIII',lat:35.6891667,lon:51.3143333},
 OIMM:{icao:'OIMM',lat:36.2348333,lon:59.643}
};
test('FLT PHASE selected position remains a standalone Unified value',()=>{
 const events=[];
 const host={CustomEvent:class{constructor(type,init){this.type=type;this.detail=init.detail;}},
  dispatchEvent(e){events.push(e);}};
 const ref=Location.create(host,airports);
 assert.equal(ref.getLocation(),null);
 const chosen=ref.choose({lat:35.68,lon:51.31,icao:'OIII'});
 assert.equal(chosen.icao,'OIII');assert.equal(events[0].type,'b737:flight-location-reference');
 assert.equal(ref.getLocation().lat,35.68);
 assert.throws(()=>ref.choose({lat:92,lon:51}),/INVALID_FLIGHT_LOCATION/);
 ref.clear();assert.equal(ref.getLocation(),null);
});
test('airports are geographically projected and obey EFIS ARPT and range',()=>{
 const loc=Location.create(null,airports),center={lat:35.68,lon:51.31};
 const list=loc.mapObjects(center,{arpt:true,navAid:true,wpt:true},40);
 assert.ok(list.some(p=>p.name==='OIII'&&p.shape==='airport'));
 assert.ok(!list.some(p=>p.name==='OIMM'));
 assert.equal(loc.mapObjects(center,{arpt:false,navAid:false,wpt:false},40).length,0);
});
test('only verified catalog navaids can be displayed, no imaginary VOR',()=>{
 const loc=Location.create(null,airports),center={lat:35.68,lon:51.31};
 assert.equal(loc.setCatalog([{type:'VOR',ident:'FAKE',lat:35.7,lon:51.3}]),0);
 assert.equal(loc.mapObjects(center,{navAid:true,arpt:false,wpt:false},40).length,0);
 assert.equal(loc.setCatalog([{type:'VOR',ident:'TEST',lat:35.7,lon:51.3,verified:true}]),1);
 assert.deepEqual(loc.mapObjects(center,{navAid:true,arpt:false,wpt:false},40).map(p=>p.name),['TEST']);
 assert.equal(loc.mapObjects(center,{navAid:false,arpt:false,wpt:false},40).length,0);
});
test('cockpit uses FLT PHASE title and shares selected location between IRS/CDU/EHSI',()=>{
 const fs=require('node:fs'),path=require('node:path'),root=path.resolve(__dirname,'..');
 const read=p=>fs.readFileSync(path.join(root,p),'utf8');
 const panel=read('panel-mosaic-lab/cockpit/flight-scenario-panel-v1.js');
 assert.ok(panel.includes("launch.textContent='FLT PHASE'"));
 assert.ok(panel.includes('config.lat=v('));
 assert.ok(panel.includes('config.lon=v('));
 const index=read('panel-mosaic-lab/cockpit/index.html');
 assert.ok(index.includes('flight-location-reference-v1.js'));
 assert.ok(read('panel-mosaic-lab/cockpit/irs-trainer-unified-v1.js').includes('setScenarioPosition'));
 assert.ok(read('panel-mosaic-lab/cockpit/cdu-irs-adapter-v1.js').includes('FLT PHASE REF'));
 assert.ok(read('panel-mosaic-lab/cockpit/ehsi-unified-v1.js').includes('location.mapObjects('));
});


test('source-backed local Iranian VORs and airports appear around OIII without Railway',()=>{
 const publicFacilities=require('../engine/flight/iran-nav-reference-v1.js');
 const location=Location.create(null,airports);
 assert.equal(location.setCatalog(publicFacilities),8);
 const nearby=location.mapObjects(airports.OIII,{arpt:true,navAid:true,wpt:false},40);
 for(const ident of ['TRN','IKA','PIM','OIIE','OIIP'])
  assert.ok(nearby.some(x=>x.name===ident),'Missing '+ident);
 assert.ok(!nearby.some(x=>x.name==='MSD'));
 const onlyVor=location.mapObjects(airports.OIII,{arpt:false,navAid:true,wpt:false},40);
 assert.deepEqual(onlyVor.map(x=>x.name),['TRN','IKA','PIM']);
 assert.ok(onlyVor.every(x=>x.shape==='nav'));
});
