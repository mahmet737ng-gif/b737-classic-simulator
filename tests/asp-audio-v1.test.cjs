'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const A=require('../engine/systems/asp-audio-v1.js');
const run=(s,seat,type,rest={})=>A.apply(s,{seat,type,...rest});
test('ALT fixed transmit/receive per FCOM each station independently',()=>{
 let s=A.initialState();
 for(const seat of A.SEATS){s=run(s,seat,'MODE',{value:'ALT'});const p=A.project(s,{powerMode:'BENCH'}).stations[seat];
 assert.equal(p.micSelection,A.FIXED[seat]);assert.equal(p.whiteMicLamp,A.FIXED[seat]);
 assert.deepEqual(p.receiverMonitor,[A.FIXED[seat]]);assert.equal(p.receiverVolume,'PRESET');
 assert.equal(p.overheadSpeakerAvailable,false);assert.equal(p.warningsViaStation,false);
 assert.equal(p.handMicAvailable,false);assert.equal(p.flightInterphone,false);assert.equal(p.serviceInterphone,false);assert.equal(p.paViaAsp,false);
 }
 assert.equal(A.project(s,{powerMode:'BENCH'}).stations.OBS.micSelection,'VHF-1');
});
test('NORM MIC is mutually exclusive, receiver selectors independent and mask selectable',()=>{
 let s=A.initialState();
 s=run(s,'CAPT','SELECT_MIC',{channel:'VHF-1'});
 s=run(s,'CAPT','SELECT_MIC',{channel:'VHF-2'});
 s=run(s,'CAPT','RECEIVER',{channel:'NAV-1',selected:true});
 s=run(s,'CAPT','RECEIVER',{channel:'ADF-2',selected:true});
 s=run(s,'CAPT','MIC_SOURCE',{value:'MASK'});
 const p=A.project(s,{powerMode:'BENCH'}).stations.CAPT;
 assert.equal(p.micSelection,'VHF-2');assert.deepEqual(p.receiverMonitor,['VHF-2','NAV-1','ADF-2']);
 assert.equal(p.microphone,'MASK');assert.equal(p.maskBoomSelectorFunctional,true);
 assert.equal(A.project(s,{powerMode:'BENCH'}).stations.FO.micSelection,null);
});
test('ALT blocks MIC, receiver and volume edits, preserves prior configuration on return NORM',()=>{
 let s=A.initialState();s=run(s,'FO','SELECT_MIC',{channel:'VHF-3'});
 s=run(s,'FO','RECEIVER',{channel:'MKR',selected:true});
 s=run(s,'FO','MODE',{value:'ALT'});
 s=run(s,'FO','SELECT_MIC',{channel:'VHF-1'});s=run(s,'FO','RECEIVER',{channel:'MKR',selected:false});s=run(s,'FO','VOLUME',{channel:'MKR',value:90});
 assert.equal(A.project(s,{powerMode:'BENCH'}).stations.FO.micSelection,'VHF-2');
 s=run(s,'FO','MODE',{value:'NORM'});const p=A.project(s,{powerMode:'BENCH'}).stations.FO;
 assert.equal(p.micSelection,'VHF-3');assert(p.receiverMonitor.includes('MKR'));assert.equal(s.stations.FO.volumes.MKR,50);
});
test('ALT MIC PTT works on preset radio, INT and hand mic are inoperative',()=>{
 let s=run(A.initialState(),'CAPT','MODE',{value:'ALT'});
 for(const ptt of ['ASP_IC','WHEEL_INT','HAND']){
  s=run(s,'CAPT','PTT',{value:ptt});assert.equal(A.project(s,{powerMode:'BENCH'}).stations.CAPT.transmitRadio,null);
 }
 for(const ptt of ['ASP_RT','WHEEL_MIC']){
  s=run(s,'CAPT','PTT',{value:ptt});const p=A.project(s,{powerMode:'BENCH'}).stations.CAPT;
  assert.equal(p.transmitRadio,'VHF-1');assert.equal(p.transmitPermission,true);
 }
});
test('NORM interphone via wheel INT, no observer overhead speaker',()=>{
 let s=A.initialState();s=run(s,'OBS','SELECT_MIC',{channel:'PA'});s=run(s,'OBS','RECEIVER',{channel:'SPKR',selected:true});
 s=run(s,'OBS','PTT',{value:'ASP_IC'});const o=A.project(s,{powerMode:'BENCH'}).stations.OBS;
 assert.equal(o.transmitRadio,'FLT INT');assert.equal(o.overheadSpeakerAvailable,false);
});
test('unverified electrical/CB cannot falsely assert real transmit capability',()=>{
 let s=run(A.initialState(),'FO','MODE',{value:'ALT'});s=run(s,'FO','PTT',{value:'ASP_RT'});
 const real=A.project(s,{powerMode:'AIRCRAFT',electrical:{bus:{dc2:true,battery:true}}}).stations.FO;
 assert.equal(real.transmitRadio,'VHF-2');assert.equal(real.transmitPermission,null);
 assert.equal(real.cbStatus,'QUARANTINED_CATALOG_MISMATCH');
 assert.equal(real.cbCandidate,'P6-2|ALL|D22');assert.equal(real.power.state,'UNKNOWN');
 assert.equal(A.project(s,{powerMode:'BENCH'}).stations.FO.transmitPermission,true);
});
test('faults independent and instructor-only',()=>{
 let s=A.initialState();assert.throws(()=>run(s,'OBS','FAULT',{fault:'normalControlFault',active:true}),/Instructor/);
 s=run(s,'OBS','FAULT',{fault:'normalControlFault',active:true,instructor:true});
 assert.equal(A.project(s).stations.OBS.functional,false);
 s=run(s,'OBS','MODE',{value:'ALT'});assert.equal(A.project(s).stations.OBS.functional,true);
 s=run(s,'OBS','FAULT',{fault:'alternateFault',active:true,instructor:true});assert.equal(A.project(s).stations.OBS.functional,false);
});
test('input rejects invalid seat, detent, channels and volume',()=>{
 const s=A.initialState();
 assert.throws(()=>run(s,'other','MODE',{value:'ALT'}),/seat/);
 assert.throws(()=>run(s,'CAPT','MODE',{value:'AUTO'}),/mode/);
 assert.throws(()=>run(s,'FO','SELECT_MIC',{channel:'ADF-1'}),/MIC/);
 assert.throws(()=>run(s,'OBS','VOLUME',{channel:'SPKR',value:150}),/volume/);
});
test('integration is additive: no pixel/position edits to owner-approved ASP or protected panels',()=>{
 const ui=fs.readFileSync(path.join(__dirname,'../panel-mosaic-lab/cockpit/asp-audio-runtime-v1.js'),'utf8');
 const bare=fs.readFileSync(path.join(__dirname,'../panel-mosaic-lab/cockpit/asp-bare-overlay-v1.js'),'utf8');
 assert.match(ui,/b737:asp-control/);assert.match(ui,/data-asp-alt-norm/);
 assert.match(bare,/panelId:'OH-04'/);
 assert.match(bare,/x:20,y:649,w:375,h:297/);
 assert.match(bare,/x:744,y:649,w:375,h:297/);
});
