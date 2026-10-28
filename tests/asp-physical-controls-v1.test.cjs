'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const Core=require('../engine/systems/asp-audio-v1.js');
const M=require('../engine/interaction/asp-physical-commands-v1.js');
const Route=require('../engine/systems/asp-audio-routing-v2.js');
function send(s,c){return Core.apply(s,M.command(c.seat,c.kind,c.value));}
test('source SVG physical holes: no UI coordinate inventions',()=>{
 for(const kind of Object.keys(M.CONTROLS)){
  const {x,y}=M.CONTROLS[kind];
  for(const file of ['asp-bare-pedestal-v3.svg','asp-bare-aft-overhead-v3.svg']){
   const raw=fs.readFileSync(path.join(__dirname,'../panel-mosaic-lab/cockpit/assets',file),'utf8');
   assert(raw.includes('cx="'+x+'" cy="'+y+'" r="31"'),kind+' '+file);
  }
 }
});
test('PTT returns to neutral and cannot latch in transmit',()=>{
 let s=Core.initialState();
 s=send(s,{seat:'CAPT',kind:'PTT',value:'ASP_RT'});
 assert.equal(s.stations.CAPT.ptt,'ASP_RT');
 s=send(s,{seat:'CAPT',kind:'PTT',value:null});
 assert.equal(s.stations.CAPT.ptt,null);
 assert.equal(Core.project(s,{powerMode:'BENCH'}).stations.CAPT.transmitRadio,null);
});
test('PTT two momentary detents are upper R/T and lower I/C; MASK/BOOM latches',()=>{
 assert.equal(M.topBottom('PTT',.1),'ASP_RT');assert.equal(M.topBottom('PTT',.8),'ASP_IC');
 assert.equal(M.topBottom('MASK_BOOM',.1),'MASK');assert.equal(M.topBottom('MASK_BOOM',.8),'BOOM');
 assert(M.CONTROLS.PTT.spring);assert(!M.CONTROLS.MASK_BOOM.spring);
});
test('Mask selection persists after PTT release and is independent for three stations',()=>{
 let s=Core.initialState();
 s=send(s,{seat:'CAPT',kind:'MASK_BOOM',value:'MASK'});
 s=send(s,{seat:'CAPT',kind:'PTT',value:'ASP_RT'});
 s=send(s,{seat:'CAPT',kind:'PTT',value:null});
 assert.equal(s.stations.CAPT.microphone,'MASK');
 assert.equal(s.stations.FO.microphone,'BOOM');
 assert.equal(s.stations.OBS.microphone,'BOOM');
});
test('NORM PTT R/T follows MIC selector and I/C bypasses it',()=>{
 let s=Core.initialState();
 s=Core.apply(s,{seat:'FO',type:'SELECT_MIC',channel:'VHF-3'});
 s=send(s,{seat:'FO',kind:'PTT',value:'ASP_RT'});
 assert.equal(Route.compute(s,{powerMode:'BENCH'}).stations.FO.transmitter.channel,'VHF-3');
 s=send(s,{seat:'FO',kind:'PTT',value:'ASP_IC'});
 assert.equal(Route.compute(s,{powerMode:'BENCH'}).stations.FO.transmitter.channel,'FLT INT');
 s=send(s,{seat:'FO',kind:'PTT',value:null});
 assert.equal(Route.compute(s,{powerMode:'BENCH'}).stations.FO.transmitter.channel,null);
});
test('ALT PTT R/T transmits on station-specific fixed VHF, I/C blocked',()=>{
 let s=Core.initialState();
 for(const seat of M.SEATS){
  s=send(s,{seat,kind:'ALT_NORM',value:'ALT'});
  s=send(s,{seat,kind:'MASK_BOOM',value:'MASK'});
  s=send(s,{seat,kind:'PTT',value:'ASP_RT'});
  const p=Route.compute(s,{powerMode:'BENCH'}).stations[seat];
  assert.equal(p.transmitter.channel,Core.FIXED[seat]);
  assert.equal(p.transmitter.microphone,'MASK');
  s=send(s,{seat,kind:'PTT',value:'ASP_IC'});
  assert.equal(Route.compute(s,{powerMode:'BENCH'}).stations[seat].transmitter.enabled,false);
 }
});
test('invalid seat, detent or missing value fails closed',()=>{
 assert.throws(()=>M.command('OBS','MASK_BOOM','AUTO'),/Invalid ASP detent/);
 assert.throws(()=>M.command('FA','PTT','ASP_RT'),/Unknown ASP station/);
 assert.throws(()=>M.command('CAPT','ALT_NORM',null),/Invalid ASP detent/);
});
test('observer physical commands are passed to authoritative parent, not second audio backend',()=>{
 const js=fs.readFileSync(path.join(__dirname,'../panel-mosaic-lab/cockpit/asp-physical-controls-v1.js'),'utf8');
 assert.match(js,/b737:asp-obs-physical-ready/);
 assert.match(js,/e\.source!==parentFrame\(\)/);
 assert.match(js,/e\.origin!==root\.location\.origin/);
 assert.match(js,/root\.parent\.postMessage/);
 assert(!js.includes('Core.initialState('));
});
test('hardware release on pointer up, cancel, focus loss, page blur and tab visibility',()=>{
 const js=fs.readFileSync(path.join(__dirname,'../panel-mosaic-lab/cockpit/asp-physical-controls-v1.js'),'utf8');
 for(const key of ['pointerup','pointercancel','lostpointercapture','keyup','visibilitychange','blur'])
  assert(js.includes(key),key);
 assert(js.includes('press(null)'));
});
test('only additive assets and three cockpit ASP faces are involved',()=>{
 const root=path.join(__dirname,'../panel-mosaic-lab/cockpit');
 const js=fs.readFileSync(path.join(root,'asp-physical-controls-v1.js'),'utf8');
 const index=fs.readFileSync(path.join(root,'index.html'),'utf8');
 const overhead=fs.readFileSync(path.join(root,'overhead-stage.html'),'utf8');
 assert(index.includes('asp-physical-controls-v1.js?v=ASP-PHYSICAL-0001'));
 assert(overhead.includes('asp-physical-controls-v1.js?v=ASP-PHYSICAL-0001'));
 assert(js.includes("const localSeats=isObserver?['OBS']:['CAPT','FO']"));
 const css=fs.readFileSync(path.join(root,'asp-physical-controls-v1.css'),'utf8');
 assert(css.includes('.asp-bare-mounted .asp-physical-switch'));
 assert(!js.includes('guard-owner18'));assert(!js.includes('irs-'));
});
