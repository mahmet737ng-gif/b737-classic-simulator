'use strict';
const assert=require('node:assert/strict');
const {test}=require('node:test');
const Net=require('../avionics-data-network-v1.js');
const Fmc=require('../../integration/avionics-fmc-computer-v1.js');
const publish=(p,topic,value,origin='TRAINING_SCENARIO')=>p.publish(topic,value,{origin});
test('network declares fixed domains and no unconnected topic is assumed valid',()=>{
 const n=Net.createNetwork();assert(n.topics().length>=25);
 for(const id of ['navigation.gps1','airdata.adc1','fuel.quantity','electrical.fmcFeeds']){
  const x=n.read(id);assert.equal(x.quality,'UNKNOWN');assert.equal(x.value,null);
 }
});
test('only owner publisher writes owned topic; second owner registration rejected',()=>{
 const n=Net.createNetwork();const gps=n.producer('GPS');const irs=n.producer('IRS');
 assert.throws(()=>publish(gps,'irs.left',{positionValid:true,lat:0,lon:0}),/TOPIC_NOT_OWNED/);
 assert.throws(()=>n.producer('GPS'),/DUPLICATE_OWNER/);
 assert.throws(()=>n.producer('X_HACKER'),/UNREGISTERED_OWNER/);
 assert.equal(n.read('irs.left').quality,'UNKNOWN');
});
test('fan-out is immutable and subscriber failure does not block next consumer',()=>{
 const errors=[],n=Net.createNetwork({onError:e=>errors.push(e)}),p=n.producer('IRS');
 const got=[];n.subscribe('irs.left',()=>{throw Error('subscriber crash')},{replay:false});
 n.subscribe('irs.left',x=>{got.push(x);x.value.lat=50},{replay:false});
 publish(p,'irs.left',{positionValid:true,lat:31,lon:51});
 assert.equal(n.read('irs.left').value.lat,31);
 assert.equal(got.length,1);assert.equal(errors.length,1);
});
test('deduplicate repeated observations, refresh TTL, expire stale, and unsubscribe',()=>{
 let now=10,n=Net.createNetwork({now:()=>now}),p=n.producer('IRS'),events=0;
 const off=n.subscribe('irs.left',()=>events++,{replay:false});
 publish(p,'irs.left',{positionValid:false,lat:null,lon:null});
 const rev=n.getRevision();
 now=1700;publish(p,'irs.left',{positionValid:false,lat:null,lon:null});
 assert.equal(n.getRevision(),rev);assert.equal(n.read('irs.left').quality,'VALID');
 now=3801;assert.equal(n.read('irs.left').quality,'STALE');
 off();publish(p,'irs.left',{positionValid:true,lat:0,lon:0});
 assert.equal(events,1);
});
test('validation rejects impossible GPS, ADC, and fuel inputs',()=>{
 const n=Net.createNetwork(),gps=n.producer('GPS'),adc=n.producer('ADC'),fuel=n.producer('FUEL');
 assert.throws(()=>publish(gps,'navigation.gps1',{lat:120,lon:51,fixValid:true}),/SIGNAL_RANGE/);
 assert.throws(()=>publish(adc,'airdata.adc1',{pressureAltitudeFt:90000}),/SIGNAL_RANGE/);
 assert.throws(()=>publish(fuel,'fuel.quantity',{totalKg:-1}),/SIGNAL_RANGE/);
 assert.throws(()=>gps.publish('navigation.gps1',{lat:0,lon:0},{origin:'UNVERIFIED'}),/UNVERIFIED_CANNOT_BE_VALID/);
});
test('FMC computation waits for valid position, route and direct feed evidence',()=>{
 let now=0,n=Net.createNetwork({now:()=>now});const f=Fmc.connect(n);
 const route=n.producer('CDU'),irs=n.producer('IRS'),feed=n.producer('FMC_FEEDS');
 publish(route,'crew.flightplan',{origin:'OIII',dest:'OIMM',active:true,legsVerified:true,discontinuitiesUnknown:false},'CREW_ENTRY');
 publish(irs,'irs.left',{positionValid:true,lat:35.6,lon:51.3});
 let x=f.getState();assert.equal(x.guidance.routeEvidenceReady,false);
 publish(feed,'electrical.fmcFeeds',{FMC1:{feed:'UNKNOWN'},FMC2:{feed:'UNKNOWN'}});
 assert.equal(f.getState().guidance.routeEvidenceReady,false);
 publish(feed,'electrical.fmcFeeds',{FMC1:{feed:'PRESENT'},FMC2:{feed:'UNKNOWN'}});
 x=f.getState();assert.equal(x.guidance.routeEvidenceReady,true);
 assert.equal(x.guidance.canCommandAircraft,false);
 assert.equal(x.position.source,'irs.left');
 assert.equal(x.predictions.n1TargetPercent,null);
});
test('GPS wins, invalid GPS falls back to valid right IRS without synthesized radio fix',()=>{
 const n=Net.createNetwork();const f=Fmc.connect(n);
 const irs=n.producer('IRS'),gps=n.producer('GPS'),dme=n.producer('DME');
 publish(irs,'irs.left',{positionValid:false,lat:null,lon:null});
 publish(irs,'irs.right',{positionValid:true,lat:34.2,lon:51.5});
 assert.equal(f.getState().position.source,'irs.right');
 publish(gps,'navigation.gps1',{fixValid:true,lat:35.3,lon:51.4},'SIMULATOR_TELEMETRY');
 assert.equal(f.getState().position.source,'navigation.gps1');
 publish(gps,'navigation.gps1',{fixValid:false,lat:35.3,lon:51.4},'SIMULATOR_TELEMETRY');
 assert.equal(f.getState().position.source,'irs.right');
 publish(dme,'navigation.dme1',{distanceNm:24});
 const s=f.getState();assert.equal(s.radioUpdate.fixComputed,false);
 assert.equal(s.radioUpdate.availableCandidates.length,1);
});
test('source expiry removes readiness even without new event',()=>{
 let now=0;const n=Net.createNetwork({now:()=>now}),f=Fmc.connect(n);
 const irs=n.producer('IRS'),route=n.producer('CDU'),feeds=n.producer('FMC_FEEDS');
 publish(irs,'irs.left',{positionValid:true,lat:35,lon:51});
 publish(route,'crew.flightplan',{origin:'OIII',dest:'OIMM',active:true,legsVerified:true,discontinuitiesUnknown:false},'CREW_ENTRY');
 publish(feeds,'electrical.fmcFeeds',{FMC1:{feed:'PRESENT'}});
 assert.equal(f.getState().guidance.routeEvidenceReady,true);
 now=3000;assert.equal(f.getState().guidance.routeEvidenceReady,false);
 assert.equal(n.read('irs.left').quality,'STALE');
});
