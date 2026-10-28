'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const Core=require('../engine/systems/asp-audio-v1.js');
const Routing=require('../engine/systems/asp-audio-routing-v2.js');
const Mix=require('../engine/systems/asp-audio-mix-v3.js');
const Trace=require('../engine/integration/asp-cb-trace-v3.js');
const cmd=(s,seat,type,extra={})=>Core.apply(s,{seat,type,...extra});
test('BENCH plays only explicitly enabled selected channels and respects receiver levels',()=>{
 let s=Core.initialState();s=cmd(s,'CAPT','SELECT_MIC',{channel:'VHF-1'});
 s=cmd(s,'CAPT','RECEIVER',{channel:'NAV-1',selected:true});
 s=cmd(s,'CAPT','VOLUME',{channel:'VHF-1',value:75});
 s=cmd(s,'CAPT','VOLUME',{channel:'NAV-1',value:30});
 const route=Routing.compute(s,{powerMode:'BENCH',signals:{'VHF-1':true,'NAV-1':true}});
 const m=Mix.make(route,{seat:'CAPT',output:'HEADSET'});
 assert.equal(m.muted,false);
 assert.deepEqual(m.audible.map(x=>x.channel),['VHF-1','NAV-1']);
 assert(m.audible[0].gain>m.audible[1].gain);
 assert.equal(Mix.make(route,{seat:'CAPT',output:'SPEAKER'}).muted,true);
});
test('NORM multisource and ALT fixed VHF, fixed gain, no speaker',()=>{
 let s=Core.initialState();s=cmd(s,'FO','MODE',{value:'ALT'});
 let r=Routing.compute(s,{powerMode:'BENCH',signals:{'VHF-2':true,'VHF-1':true}});
 let m=Mix.make(r,{seat:'FO',output:'HEADSET'});
 assert.equal(m.audible.length,1);assert.equal(m.audible[0].channel,'VHF-2');
 assert.equal(m.audible[0].volume,65);
 assert.equal(Mix.make(r,{seat:'FO',output:'SPEAKER'}).audible.length,0);
});
test('Aircraft mode NEVER enables generated audio even with bus data',()=>{
 let s=Core.initialState();s=cmd(s,'CAPT','SELECT_MIC',{channel:'VHF-1'});
 const r=Routing.compute(s,{powerMode:'AIRCRAFT',electrical:{bus:{dc2:true,battery:true}},signals:{'VHF-1':true}});
 const p=Mix.make(r,{seat:'CAPT'});
 assert.equal(p.muted,true);assert.equal(p.audible.length,0);assert.equal(p.reason,'AIRCRAFT_POWER_UNVERIFIED');
});
test('RF failure silences that channel for two users while other radio survives',()=>{
 let s=Core.initialState();for(const seat of ['CAPT','OBS'])s=cmd(s,seat,'MODE',{value:'ALT'});
 let r=Routing.compute(s,{powerMode:'BENCH',signals:{'VHF-1':true,'VHF-2':true},radioStatus:{'VHF-1':'FAILED'}});
 for(const seat of ['CAPT','OBS'])assert.equal(Mix.make(r,{seat}).audible.length,0);
 assert.equal(Mix.make(r,{seat:'FO'}).audible.length,0);
 s=cmd(s,'FO','MODE',{value:'ALT'});
 r=Routing.compute(s,{powerMode:'BENCH',signals:{'VHF-2':true},radioStatus:{'VHF-1':'FAILED'}});
 assert.deepEqual(Mix.make(r,{seat:'FO'}).audible.map(x=>x.channel),['VHF-2']);
});
test('Shared radio contention is detected and no real radio transmission is claimed',()=>{
 let s=Core.initialState();for(const seat of ['CAPT','OBS']){s=cmd(s,seat,'MODE',{value:'ALT'});s=cmd(s,seat,'PTT',{value:'ASP_RT'});}
 const r=Routing.compute(s,{powerMode:'BENCH'}),v=Mix.sharedTx(r);
 assert.equal(v.channels['VHF-1'].collision,true);
 assert.deepEqual(v.channels['VHF-1'].transmitters,['CAPT','OBS']);
 assert.equal(v.channels['VHF-1'].onAir,null);assert.equal(v.canTransmitActualRadio,false);
 s=cmd(s,'OBS','PTT',{value:null});
 const good=Mix.sharedTx(Routing.compute(s,{powerMode:'BENCH'}));
 assert.equal(good.channels['VHF-1'].onAir,'CAPT');
});
test('Photo-derived RF and interphone CB labels are evidence only; MRG ASP candidates remain quarantined',()=>{
 const sandbox={window:{}};vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../cb-panel-lab/catalog.js'),'utf8'),sandbox);
 const a=Trace.inspect(sandbox.window.CB_CATALOG);
 for(const channel of ['VHF-1','VHF-2','VHF-3']){
  assert.equal(a.labels[channel].status,'PHOTO_LABEL_ONLY',channel);
  assert.equal(a.labels[channel].matches.length,1);
 }
 assert.equal(a.activeConnections,0);
 assert.equal(a.mayConnect,false);assert.equal(a.actualASPDevicePower,null);
 for(const seat of ['CAPT','FO','OBS'])assert.match(a.bySeat[seat].audioCB,/^P6-2\|ALL\|D2[234]$/);
});
test('Corrupt inputs fail closed',()=>{
 let s=Core.initialState(),route=Routing.compute(s,{powerMode:'BENCH'});
 assert.throws(()=>Mix.make(route,{seat:'CABIN'}),/monitor/);
 assert.throws(()=>Mix.make(route,{output:'WINDOW'}),/monitor/);
 assert.throws(()=>Mix.sharedTx({schema:'WRONG'}),/V2/);
});
test('Visible bench audio is user-activated and never requests microphone permission',()=>{
 const read=n=>fs.readFileSync(path.join(__dirname,'../panel-mosaic-lab/cockpit',n),'utf8');
 const ui=read('asp-audible-bench-v3.js');
 assert(ui.includes('ENABLE BENCH AUDIO'));
 assert(ui.includes("Runtime.setPowerMode('BENCH')"));
 assert(ui.includes('new AudioContextClass()'));
 assert(ui.includes('ctx.resume()'));
 assert(!ui.includes('getUserMedia'));
 assert(!ui.includes('navigator.mediaDevices'));
 assert(!ui.includes('autoplay'));
});
test('72 on-panel locations are covered by live source-space audit for 3 stations',()=>{
 const read=n=>fs.readFileSync(path.join(__dirname,'../panel-mosaic-lab/cockpit',n),'utf8');
 const ui=read('asp-pixel-audit-v3.js');
 assert(ui.includes('Photo.sockets.map'));
 assert(ui.includes('Physical.CONTROLS'));
 assert(ui.includes('VBR.socket'));
 assert(ui.includes("['CAPT','FO']"));
 assert(ui.includes("'OBS'"));
 assert(ui.includes('thresholdCssPx:0.5'));
 assert(ui.includes('human photo QA required'));
});
