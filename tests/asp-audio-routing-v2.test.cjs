'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const A=require('../engine/systems/asp-audio-v1.js'),R=require('../engine/systems/asp-audio-routing-v2.js'),
 Audit=require('../engine/integration/asp-electrical-cb-v2.js');
const command=(s,seat,type,rest={})=>A.apply(s,{seat,type,...rest});
const trainer=(s,opt={})=>R.compute(s,{powerMode:'BENCH',...opt});
test('ALT transmits exclusively through VHF-1 CPT / VHF-2 FO / VHF-1 OBS, with R/T',()=>{
 let s=A.initialState();for(const seat of A.SEATS){s=command(s,seat,'MODE',{value:'ALT'});s=command(s,seat,'PTT',{value:'ASP_RT'});}
 const out=trainer(s);for(const seat of A.SEATS){const p=out.stations[seat];
  assert.equal(p.transmitter.channel,A.FIXED[seat]);assert.equal(p.transmitter.enabled,true);
  assert.equal(p.headset.volumePolicy,'PRESET');assert.equal(p.headset.channels.length,1);
  assert.equal(p.headset.channels[0].channel,A.FIXED[seat]);assert.equal(p.speaker.enabled,false);
  assert.equal(p.interphone.flight,false);assert.equal(p.passengerAddress.viaAsp,false);
 }
});
test('ALT prohibits I/C, wheel INT, hand microphone, independently per station',()=>{
 let s=command(A.initialState(),'FO','MODE',{value:'ALT'});
 for(const ptt of ['ASP_IC','WHEEL_INT','HAND']){
  s=command(s,'FO','PTT',{value:ptt});const p=trainer(s).stations.FO;
  assert.equal(p.transmitter.enabled,false);assert.equal(p.transmitter.channel,null);
 }
});
test('NORM interphone bypass transceiver and hand mic switches independently of MASK/BOOM',()=>{
 let s=command(A.initialState(),'CAPT','SELECT_MIC',{channel:'VHF-3'});
 s=command(s,'CAPT','PTT',{value:'ASP_IC'});
 assert.equal(trainer(s).stations.CAPT.transmitter.channel,'FLT INT');
 s=command(s,'CAPT','PTT',{value:'HAND'});
 const t=trainer(s).stations.CAPT.transmitter;
 assert.equal(t.channel,'VHF-3');assert.equal(t.microphone,'HAND');
});
test('NORM receiver monitoring is multi-source and transmitter receiver is forced on',()=>{
 let s=command(A.initialState(),'CAPT','SELECT_MIC',{channel:'VHF-1'});
 s=command(s,'CAPT','RECEIVER',{channel:'NAV-1',selected:true});
 s=command(s,'CAPT','RECEIVER',{channel:'ADF-2',selected:true});
 const p=trainer(s,{signals:{'VHF-1':true,'NAV-1':true,'ADF-2':false}}).stations.CAPT;
 assert.deepEqual(p.headset.heardBench,['VHF-1','NAV-1']);
 assert.equal(p.headset.channels.length,3);
 assert.equal(p.headset.volumePolicy,'RECEIVER_SELECTORS');
});
test('RF source fault shared across stations, while mode and selector remain independent',()=>{
 let s=A.initialState();
 for(const seat of ['CAPT','OBS']){s=command(s,seat,'MODE',{value:'ALT'});s=command(s,seat,'PTT',{value:'ASP_RT'});}
 s=command(s,'FO','SELECT_MIC',{channel:'VHF-2'});s=command(s,'FO','PTT',{value:'ASP_RT'});
 const p=trainer(s,{radioStatus:{'VHF-1':'FAILED','VHF-2':'AVAILABLE'}});
 for(const seat of ['CAPT','OBS']){assert.equal(p.stations[seat].transmitter.enabled,false);assert.equal(p.stations[seat].transmitter.routeStatus,'RADIO_FAILED');}
 assert.equal(p.stations.FO.transmitter.enabled,true);assert.equal(p.stations.FO.mode,'NORM');
});
test('No inferred actual transmit from DC2/Battery status or an unverified CB',()=>{
 let s=command(A.initialState(),'CAPT','MODE',{value:'ALT'});s=command(s,'CAPT','PTT',{value:'ASP_RT'});
 const p=R.compute(s,{powerMode:'AIRCRAFT',electrical:{bus:{dc2:true,battery:true}}}).stations.CAPT;
 assert.equal(p.transmitter.enabled,null);assert.equal(p.transmitter.routeStatus,'UNVERIFIED_REAL_TX');
 assert.equal(p.cbEffectApplied,false);assert.equal(p.electrical.state,'UNKNOWN');
});
test('NORM speaker only when selected, Observer never has overhead speaker',()=>{
 let s=A.initialState();
 s=command(s,'CAPT','RECEIVER',{channel:'SPKR',selected:true});
 s=command(s,'OBS','RECEIVER',{channel:'SPKR',selected:true});
 s=command(s,'CAPT','RECEIVER',{channel:'NAV-1',selected:true});
 let p=trainer(s,{signals:{'NAV-1':true}});
 assert.equal(p.stations.CAPT.speaker.enabled,true);assert.equal(p.stations.OBS.speaker.enabled,false);
 s=command(s,'CAPT','MODE',{value:'ALT'});p=trainer(s);
 assert.equal(p.stations.CAPT.speaker.enabled,false);
});
test('MRG speaker transmit muting only when as-installed explicit toggle enabled',()=>{
 let s=A.initialState();s=command(s,'CAPT','RECEIVER',{channel:'SPKR',selected:true});
 s=command(s,'FO','SELECT_MIC',{channel:'VHF-2'});s=command(s,'FO','PTT',{value:'WHEEL_MIC'});
 assert.equal(trainer(s).stations.CAPT.speaker.enabled,true);
 const p=trainer(s,{speakerInhibitOnTransmit:true}).stations.CAPT;
 assert.equal(p.speaker.enabled,false);assert.equal(p.speaker.inhibitedByOtherTransmit,true);
});
test('MRG P6-2 D22 D23 D24 conflicts with native photographic catalogue and must NOT control ASP',()=>{
 const sandbox={window:{}};vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../cb-panel-lab/catalog.js'),'utf8'),sandbox);
 const result=Audit.examine({catalog:sandbox.window.CB_CATALOG,electrical:{bus:{dc2:true,battery:true}}});
 for(const seat of A.SEATS){const p=result.stations[seat];assert.equal(p.catalogMatch,false);assert.match(p.sourceStatus,/QUARANTINED/);
  assert.equal(p.cbCanControlASP,false);assert.equal(p.devicePower,null);assert.equal(result.activeCBConnections,0);}
 assert.equal(result.stations.CAPT.actualCatalogLabel,'EXT BOTTLES RIGHT');
 assert.equal(result.stations.FO.actualCatalogLabel,'AURAL WARN');
 assert.equal(result.stations.OBS.actualCatalogLabel,'EXT BOTTLES LEFT');
});
test('Even a physically opened disputed CB does not shut down the unrelated ASP trainer',()=>{
 const fake={state:key=>({pulled:key.endsWith('D23'),tripped:false})};
 const evidence=Audit.examine({cbNetwork:fake});
 assert.equal(evidence.stations.CAPT.candidateCB.pulled,true);
 assert.equal(evidence.stations.CAPT.cbCanControlASP,false);
 const p=trainer(command(A.initialState(),'CAPT','MODE',{value:'ALT'}),{cbEvidence:evidence});
 assert.equal(p.stations.CAPT.headset.enabled,true);
 assert.equal(p.stations.CAPT.cbEffectApplied,false);
});
test('Invalid untrusted RF statuses, signal channels, and policy rejected',()=>{
 const s=A.initialState();assert.throws(()=>trainer(s,{radioStatus:{'VHF-1':'HOT'}}),/Invalid radio status/);
 assert.throws(()=>trainer(s,{signals:{'UNKNOWN':true}}),/Unknown signal/);
 assert.throws(()=>trainer(s,{signals:{'VHF-1':5}}),/Signal must be/);
 assert.throws(()=>trainer(s,{speakerInhibitOnTransmit:'true'}),/speaker-inhibit/);
});
test('No edits to frozen art, three station mount, 2 ASP overlay JS and new external integration',()=>{
 const idx=fs.readFileSync(path.join(__dirname,'../panel-mosaic-lab/cockpit/index.html'),'utf8');
 assert.match(idx,/asp-audio-routing-live-v2\.js/);assert.match(idx,/asp-audio-routing-v2\.js/);
 const js=fs.readFileSync(path.join(__dirname,'../panel-mosaic-lab/cockpit/asp-bare-overlay-v1.js'),'utf8');
 assert.match(js,/panelId:'OH-04'/);assert.match(js,/x:20,y:649,w:375,h:297/);
 assert.match(js,/x:744,y:649,w:375,h:297/);
});
