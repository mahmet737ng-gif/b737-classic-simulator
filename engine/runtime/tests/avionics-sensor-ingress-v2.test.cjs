'use strict';
const assert=require('node:assert/strict');
const {test}=require('node:test');
const Net=require('../avionics-data-network-v1.js');
const FMC=require('../../integration/avionics-fmc-computer-v1.js');
const Ingress=require('../../integration/avionics-sensor-ingress-v2.js');
const eq={adc:[1,2],gps:[1],vor:[1],dme:[1,2]};
function fixture(){let now=200000;const n=Net.createNetwork({now:()=>now}),owners=new Map();
 const registry=name=>{if(!owners.has(name))owners.set(name,n.producer(name));return owners.get(name)};
 const ingress=Ingress.create({now:()=>now,getPublisher:registry});
 ingress.configure({sourceId:'XPLANE_115',equipment:eq});
 const frame=(sequence,sensors)=>({schema:'B737_SENSOR_FRAME_V2',sourceId:'XPLANE_115',sourceTimestampMs:now,sequence,sensors});
 return {n,ingress,frame,clock:value=>{now=value},registry};
}
test('explicit profile required, GPS not assumed installed',()=>{
 const n=Net.createNetwork(),i=Ingress.create({getPublisher:name=>n.producer(name)});
 assert.throws(()=>i.ingest({}),/NOT_CONFIGURED/);
 assert.throws(()=>i.configure({sourceId:'X',equipment:eq}),/SOURCE_ID_REQUIRED/);
 assert.throws(()=>i.configure({sourceId:'XPLANE_115',equipment:{gps:[1,3]}}),/EQUIPMENT_CHANNELS_REQUIRED/);
 i.configure({sourceId:'XPLANE_115',equipment:{adc:[],gps:[],vor:[],dme:[1]}});
 assert.deepEqual(i.diagnostics().channels,['dme1']);
 assert.throws(()=>i.configure({sourceId:'OTHER',equipment:eq}),/ALREADY_CONFIGURED/);
});
test('valid ADC, GPS and radio channels are published separately and FMC selects GPS',()=>{
 const {n,ingress,frame}=fixture(),f=FMC.connect(n);
 const report=ingress.ingest(frame(1,{
  adc1:{valid:true,pressureAltitudeFt:3200,casKt:240,mach:0.68,tatC:12},
  gps1:{valid:true,fixValid:true,lat:35.2,lon:51.3,gsKt:280,trackDeg:140},
  vor1:{valid:true,stationIdent:'THR',bearingDeg:88,tunedFrequencyMHz:110.1},
  dme1:{valid:true,stationIdent:'THR',distanceNm:24.5,tunedFrequencyMHz:110.1}}));
 assert.equal(report.accepted,true);
 assert.equal(n.read('airdata.adc1').value.casKt,240);
 assert.equal(n.read('navigation.gps1').value.fixValid,true);
 assert.equal(f.getState().position.source,'navigation.gps1');
 assert.equal(f.getState().airData.source,'airdata.adc1');
 assert.equal(f.getState().radioUpdate.fixComputed,false);
 assert.deepEqual(f.getState().radioUpdate.availableCandidates.sort(),['navigation.dme1','navigation.vor1']);
});
test('out-of-order sequence, source identity and timestamp are rejected atomically',()=>{
 const {n,ingress,frame,clock}=fixture();
 ingress.ingest(frame(1,{adc1:{valid:true,casKt:200}}));
 assert.throws(()=>ingress.ingest(frame(1,{adc1:{valid:true,casKt:230}})),/REPLAY_OR_OUT_OF_ORDER/);
 assert.throws(()=>ingress.ingest({...frame(2,{adc1:{valid:true,casKt:230}}),sourceId:'EVIL'}),/SOURCE_MISMATCH/);
 clock(205000);
 assert.throws(()=>ingress.ingest({...frame(2,{adc1:{valid:true,casKt:230}}),sourceTimestampMs:200000}),/STALE_OR_FUTURE/);
 assert.equal(n.read('airdata.adc1').value.casKt,200);
});
test('one impossible field rejects entire multi-channel packet with no partial commits',()=>{
 const {n,ingress,frame}=fixture();
 assert.throws(()=>ingress.ingest(frame(1,{adc1:{valid:true,casKt:230},gps1:{valid:true,fixValid:true,lat:100,lon:20}})),/INVALID_LAT/);
 assert.equal(n.read('airdata.adc1').quality,'UNKNOWN');
 assert.equal(n.read('navigation.gps1').quality,'UNKNOWN');
 assert.equal(ingress.diagnostics().lastSequence,-1);
});
test('uninstalled GPS2 not accepted even if sample appears valid',()=>{
 const {n,ingress,frame}=fixture();
 assert.throws(()=>ingress.ingest(frame(1,{gps2:{valid:true,fixValid:true,lat:36,lon:50}})),/UNINSTALLED_OR_UNAUTHORIZED_SENSOR/);
 assert.equal(n.read('navigation.gps2').quality,'UNKNOWN');
});
test('explicit sensor failure invalidates GPS fix and FMC falls back to IRS',()=>{
 const {n,ingress,frame,registry}=fixture(),f=FMC.connect(n);
 registry('IRS').publish('irs.left',{positionValid:true,lat:34,lon:52},{origin:'TRAINING_SCENARIO'});
 ingress.ingest(frame(1,{gps1:{valid:true,fixValid:true,lat:35,lon:51}}));
 assert.equal(f.getState().position.source,'navigation.gps1');
 ingress.ingest(frame(2,{gps1:{valid:false,failureCode:'SATELLITE_LOSS'}}));
 assert.equal(n.read('navigation.gps1').quality,'INVALID');
 assert.equal(f.getState().position.source,'irs.left');
});
test('silence causes stale, never kept-valid GPS or ADC',()=>{
 const {n,ingress,frame,clock}=fixture(),f=FMC.connect(n);
 ingress.ingest(frame(1,{adc1:{valid:true,casKt:210},gps1:{valid:true,fixValid:true,lat:35,lon:50}}));
 clock(204000);
 assert.equal(n.read('navigation.gps1').quality,'STALE');
 assert.equal(n.read('airdata.adc1').quality,'STALE');
 assert.equal(f.getState().position.quality,'UNKNOWN');
 assert.equal(f.getState().airData.quality,'UNKNOWN');
});
test('DME does not fabricate an intersection from station slant range',()=>{
 const {ingress,frame,n}=fixture();
 ingress.ingest(frame(1,{
 dme1:{valid:true,stationIdent:'THR',distanceNm:20,stationLat:35.7,stationLon:51.3},
 dme2:{valid:true,stationIdent:'QOM',distanceNm:80,stationLat:34.6,stationLon:50.9}}));
 const f=FMC.connect(n).getState();
 assert.equal(f.position.quality,'UNKNOWN');
 assert.equal(f.radioUpdate.fixComputed,false);
});
