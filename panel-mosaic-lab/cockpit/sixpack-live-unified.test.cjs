'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const dir=__dirname;
const mapper=require('./sixpack-live-integration-v1.js');
function core(){
 const listeners=new Map(),events=[];
 const window={addEventListener(type,fn){if(!listeners.has(type))listeners.set(type,[]);listeners.get(type).push(fn);},
  dispatchEvent(e){events.push(e);for(const cb of listeners.get(e.type)||[])cb(e);}};
 const document={readyState:'loading',addEventListener(){},getElementById(){return null;},querySelectorAll(){return []}};
 class CustomEvent{constructor(type,{detail}={}){this.type=type;this.detail=detail;}}
 const js=fs.readFileSync(path.join(dir,'sixpack-glareshield-v1.js'),'utf8');
 vm.runInNewContext(js,{window,document,CustomEvent},{timeout:3000});
 return {api:window.B737SixPack,window,events};
}
const names=[['CAPT','FLT CONT'],['CAPT','ELEC'],['CAPT','IRS'],['CAPT','APU'],['CAPT','FUEL'],['CAPT','OVHT/DET'],
 ['FO','ANTI-ICE'],['FO','ENG'],['FO','HYD'],['FO','OVERHEAD'],['FO','DOORS'],['FO','AIR COND']];
const key=([side,name])=>side+'.'+name.replace('ANTI-ICE','ANTI ICE');
test('all 12 real annunciators accept all 4096 input combinations',()=>{
 const {api}=core();
 for(let mask=0;mask<4096;mask++){
  const patch=Object.fromEntries(names.map((pair,i)=>[key(pair),(mask&(1<<i))?['OH:fault'+i]:[]]));
  assert.equal(api.setLiveConditions(patch),true);
  const actual=api.getEffectiveState();
  for(let i=0;i<12;i++)assert.equal(actual[key(names[i])],Boolean(mask&(1<<i)),mask+'/'+i);
 }
});
test('both Master Caution buttons acknowledge but do not clear source faults, Recall restores',()=>{
 const {api}=core();
 api.setLiveConditions({'CAPT.ELEC':['ELEC:GEN1_FAILED'],'FO.DOORS':['OH:door-fwd-entry']});
 assert.equal(api.getEffectiveState()['CAPT.MASTER CAUTION'],true);
 assert.equal(api.getEffectiveState()['FO.MASTER CAUTION'],true);
 api.acknowledge();
 assert.equal(api.getEffectiveState()['CAPT.MASTER CAUTION'],false);
 assert.equal(api.getEffectiveState()['CAPT.ELEC'],false);
 assert.deepEqual(Array.from(api.getLiveReasons()['FO.DOORS']),['OH:door-fwd-entry']);
 api.press('FO');
 for(const n of names)assert.equal(api.getEffectiveState()[key(n)],true);
 api.release('FO');
 assert.equal(api.getEffectiveState()['CAPT.ELEC'],true);
 assert.equal(api.getEffectiveState()['FO.DOORS'],true);
 assert.equal(api.getEffectiveState()['FO.MASTER CAUTION'],true);
});
test('new fault in same acknowledged system re-arms, cleared fault goes out',()=>{
 const {api}=core();
 api.setLiveConditions({'CAPT.ELEC':['ELEC:GEN1_FAILED']});
 api.acknowledge();
 assert.equal(api.getEffectiveState()['CAPT.ELEC'],false);
 api.setLiveConditions({'CAPT.ELEC':['ELEC:GEN1_FAILED','ELEC:GEN2_FAILED']});
 assert.equal(api.getEffectiveState()['CAPT.ELEC'],true);
 api.setLiveConditions({'CAPT.ELEC':[]});
 assert.equal(api.getEffectiveState()['CAPT.ELEC'],false);
});
test('FIRE WARN uses independent explicit warning and bell cutout, not OVERHEAT',()=>{
 const {api}=core();
 api.setLiveConditions({'CAPT.OVHT/DET':['FIRE:ENG1_OVERHEAT']});
 assert.equal(api.getEffectiveState()['CAPT.FIRE WARN'],false);
 api.setFireWarning(true);
 assert.equal(api.getEffectiveState()['CAPT.FIRE WARN'],true);
 assert.equal(api.getEffectiveState()['FO.FIRE WARN'],true);
 api.acknowledgeFire();
 assert.equal(api.getEffectiveState()['CAPT.FIRE WARN'],false);
 api.setFireWarning(false);api.setFireWarning(true);
 assert.equal(api.getEffectiveState()['CAPT.FIRE WARN'],true);
});
test('overhead mapper ignores unpowered, alignment, blue valves, and lamp test',()=>{
 const frames={'door-fwd-entry':'ON','irs-l-align':'ON','wing-valve-l':'BRIGHT_BLUE','flight-pressure-a':'ON'};
 const active=mapper.overhead({frames,power:true,lampTest:false});
 assert.deepEqual(active['FO.DOORS'],['OH:door-fwd-entry']);
 assert.deepEqual(active['CAPT.FLT CONT'],['OH:flight-pressure-a']);
 assert.equal(active['CAPT.IRS'].length,0);
 assert.equal(mapper.overhead({frames,power:false})['FO.DOORS'].length,0);
 assert.equal(mapper.overhead({frames,power:true,lampTest:true}),null);
});
test('electrical and fire take named real fault/indicator signals only',()=>{
 const elec=mapper.electrical({state:{faults:{GEN1_FAILED:true,APU_FAILED:true,MADE_UP:true}}});
 assert.deepEqual(elec['CAPT.ELEC'],['ELEC:GEN1_FAILED']);
 assert.deepEqual(elec['CAPT.APU'],['ELEC:APU_FAILED']);
 const f=mapper.fire({indications:{ENG1_OVERHEAT:true,WHEEL_WELL:true}});
 assert.deepEqual(f['CAPT.OVHT/DET'],['FIRE:ENG1_OVERHEAT']);
});
test('live integration authenticates overhead iframe and merges electrical/fire source feeds',()=>{
 const listeners=new Map(),writes=[],warnings=[],iframe={};
 const window={location:{origin:'https://unified.test'},
  document:{getElementById(id){return id==='overheadFrame'?{contentWindow:iframe}:null;}},
  addEventListener(type,fn){if(!listeners.has(type))listeners.set(type,[]);listeners.get(type).push(fn);},
  dispatchEvent(e){for(const cb of listeners.get(e.type)||[])cb(e);},CustomEvent:class{constructor(type,{detail}={}){this.type=type;this.detail=detail;}},
  B737SixPack:{setLiveConditions(state){writes.push(state);},setFireWarning(state){warnings.push(state);}},
  B737UnifiedElectricalLive:{snapshot(){return {faults:{}}}},
  B737UnifiedFireLights:{systemIndications(){return {WHEEL_WELL:false}}}
 };
 const api=mapper.install(window);
 const dispatch=(name,detail)=>window.dispatchEvent(new window.CustomEvent(name,{detail}));
 const overhead=frames=>({type:'b737:cockpit-overhead',kind:'state',frames,power:true,lampTest:false});
 const message=(source,origin,data)=>{for(const fn of listeners.get('message')||[])fn({source,origin,data});};
 const baseline=writes.length;
 message({},window.location.origin,overhead({'door-fwd-entry':'ON'}));
 message(iframe,'https://invalid.test',overhead({'door-fwd-entry':'ON'}));
 assert.equal(writes.length,baseline);
 message(iframe,window.location.origin,overhead({'door-fwd-entry':'ON'}));
 assert.deepEqual(writes.at(-1)['FO.DOORS'],['OH:door-fwd-entry']);
 dispatch('b737:electrical-v7-state',{state:{faults:{GEN1_FAILED:true}}});
 assert.deepEqual(writes.at(-1)['CAPT.ELEC'],['ELEC:GEN1_FAILED']);
 dispatch('b737:unified-fire-indicators-state',{indications:{ENG2_OVERHEAT:true,WHEEL_WELL:true}});
 assert.deepEqual(writes.at(-1)['CAPT.OVHT/DET'],['FIRE:ENG2_OVERHEAT']);
 assert.equal(warnings.at(-1),true);
 dispatch('b737:fire-warning-state',{active:false});
 assert.equal(warnings.at(-1),true,'wheel well warning remains active despite external clear');
 dispatch('b737:unified-fire-indicators-state',{indications:{WHEEL_WELL:false}});
 assert.equal(warnings.at(-1),false);
 const count=writes.length;
 message(iframe,window.location.origin,overhead({'door-fwd-entry':'ON'}));
 assert.equal(writes.length,count,'unchanged overhead snapshot does not cause repaint');
 assert.equal(api.snapshot().sources.overhead,true);
});

test('IRS live source excludes normal alignment and SELFTEST ON DC; captures both side faults',()=>{
 const normal={schema:'b737.irs-unified-v1',units:{
  L:{powered:true,mode:'ALIGN',phase:'SELFTEST',onDcLamp:true,alignLamp:true,faultLamp:false,alignLampFlashing:false},
  R:{powered:true,mode:'NAV',faultLamp:false,alignLampFlashing:false}}};
 assert.equal(mapper.irs(normal)['CAPT.IRS'].length,0);
 normal.units.L.faultLamp=true;
 normal.units.R.alignLampFlashing=true;normal.units.R.alignStatusCode=7;
 assert.deepEqual(mapper.irs(normal)['CAPT.IRS'],['IRS:L:FAULT','IRS:R:ALIGN_BLOCK_7']);
 normal.units.L.powered=false;
 assert.equal(mapper.irs(normal)['CAPT.IRS'].length,1);
});
test('Window Heat live output drives ANTI-ICE only for illuminated supplied amber OVERHEAT',()=>{
 const packet={schema:'B737_WINDOW_HEAT_V1_RESULT',channels:{
  L_FWD:{overheatOn:true,indicationPowered:true},
  L_SIDE:{overheatOn:true,indicationPowered:false},
  R_FWD:{greenOn:true,overheatOn:false,indicationPowered:true}
 }};
 assert.deepEqual(mapper.windowHeat(packet)['FO.ANTI ICE'],['WH:L_FWD:OVERHEAT']);
 assert.equal(mapper.windowHeat({...packet,channels:{L_FWD:{overheatOn:false}}})['FO.ANTI ICE'].length,0);
});
test('TAT normal ground amber excluded; demanded heat failure routed as ANTI-ICE caution',()=>{
 const normal={faults:{HEATER_FAIL:false},amberOn:true,lampPower:true,heaterRequested:false,onGround:true};
 assert.equal(mapper.tatProbe(normal)['FO.ANTI ICE'].length,0);
 assert.deepEqual(mapper.tatProbe({...normal,heaterRequested:true,faults:{HEATER_FAIL:true}})['FO.ANTI ICE'],
  ['TAT:HEAT_DEMAND_UNSATISFIED']);
 assert.equal(mapper.tatProbe({...normal,heaterRequested:true,lampPower:false})['FO.ANTI ICE'].length,0);
});
test('real Electrical V7 relay IDs work and nonexistent old names cannot cause alert',()=>{
 const elec=mapper.electrical({state:{faults:{TRANSFER1_RELAY_FAILED:true,
  TRANSFER2_RELAY_FAILED:true,STATIC_INVERTER_FAILED:true,TRANSFER_BUS_1_FAILED:true}}});
 assert.deepEqual(elec['CAPT.ELEC'],[
  'ELEC:TRANSFER1_RELAY_FAILED','ELEC:TRANSFER2_RELAY_FAILED','ELEC:STATIC_INVERTER_FAILED']);
});
test('live IRS and Window Heat take priority over OH approximations; no duplicate caution',()=>{
 const listeners=new Map(),latest=[],iframe={};
 const win={location:{origin:'https://unified.test'},document:{
  getElementById(id){return id==='overheadFrame'?{contentWindow:iframe}:null;}},
  addEventListener(n,fn){if(!listeners.has(n))listeners.set(n,[]);listeners.get(n).push(fn);},
  dispatchEvent(e){for(const f of listeners.get(e.type)||[])f(e);},
  CustomEvent:class{constructor(t,{detail}={}){this.type=t;this.detail=detail;}},
  B737SixPack:{setLiveConditions(s){latest.push(s);},setFireWarning(){}},
  B737UnifiedElectricalLive:{snapshot(){return {faults:{}}}},
  B737UnifiedFireLights:{systemIndications(){return {WHEEL_WELL:false}}}
 };
 mapper.install(win);
 function dispatch(type,detail){win.dispatchEvent(new win.CustomEvent(type,{detail}));}
 function incoming(frames){for(const fn of listeners.get('message')||[])fn({origin:win.location.origin,source:iframe,
  data:{type:'b737:cockpit-overhead',kind:'state',power:true,lampTest:false,frames}});}
 incoming({'irs-l-dc-fail':'ON','window-l-fwd-overheat':'ON','cowl-anti-ice-1':'ON'});
 assert.deepEqual(latest.at(-1)['CAPT.IRS'],['OH:irs-l-dc-fail']);
 dispatch('b737:irs-trainer-state',{units:{L:{powered:true,faultLamp:false},R:{powered:true,faultLamp:true}}});
 assert.deepEqual(latest.at(-1)['CAPT.IRS'],['IRS:R:FAULT']);
 win.B737WindowHeatUnifiedV1={getOutput:()=>({schema:'B737_WINDOW_HEAT_V1_RESULT',channels:{
  L_FWD:{overheatOn:false,indicationPowered:true}}})};
 dispatch('b737:window-heat-annunciations',{antiIceCaution:false});
 assert.deepEqual(latest.at(-1)['FO.ANTI ICE'],['OH:cowl-anti-ice-1']);
 dispatch('b737:tat-probe-output',{faults:{HEATER_FAIL:true},amberOn:true,
  lampPower:true,heaterRequested:true});
 assert.deepEqual(latest.at(-1)['FO.ANTI ICE'],['OH:cowl-anti-ice-1','TAT:HEAT_DEMAND_UNSATISFIED']);
});

test('CPCS/DCPCS actual failure indications drive AIR COND, not normal standby mode',()=>{
 assert.deepEqual(mapper.pressurization({system:'CPCS',lamps:{autoFail:true,offSchedDescent:false}})['FO.AIR COND'],
  ['PRESS:CPCS:AUTO_FAIL']);
 assert.deepEqual(mapper.pressurization({system:'DCPCS',lamps:{autoFail:false,offSchedDescent:true}})['FO.AIR COND'],
  ['PRESS:DCPCS:OFF_SCHED_DESCENT']);
 assert.equal(mapper.pressurization({system:'CPCS',lamps:{autoFail:false,standby:true}})['FO.AIR COND'].length,0);
 assert.equal(mapper.pressurization({system:'INVALID',lamps:{autoFail:true}}),null);
});
test('737-400 zone faults trigger AIR COND, 300/500 do not inherit 400 faults',()=>{
 const alarms={'cont-cab':true,'fwd-cab':false,'aft-cab':true};
 assert.deepEqual(mapper.airconZones({family:'B737-400',zoneFaults:alarms})['FO.AIR COND'],
  ['AIRCON400:cont-cab:ZONE_FAULT','AIRCON400:aft-cab:ZONE_FAULT']);
 assert.equal(mapper.airconZones({family:'B737-300-500',zoneFaults:alarms})['FO.AIR COND'].length,0);
});
test('pressurization and Aircon400 messages are accepted from only the authentic overhead iframe',()=>{
 const l=new Map(),events=[],frame={};
 const w={location:{origin:'https://unified.test'},document:{
  getElementById(id){return id==='overheadFrame'?{contentWindow:frame}:null;}},
  addEventListener(k,fn){if(!l.has(k))l.set(k,[]);l.get(k).push(fn);},
  dispatchEvent(e){events.push(e);for(const fn of l.get(e.type)||[])fn(e);},
  CustomEvent:class{constructor(t,{detail}={}){this.type=t;this.detail=detail;}},
  B737SixPack:{setLiveConditions(s){events.push({type:'ANNUNCIATOR_UPDATE',detail:s});},setFireWarning(){}}
 };
 mapper.install(w);
 const send=(source,origin,kind,data)=>{for(const fn of l.get('message')||[])fn({source,origin,
   data:{type:'b737:cockpit-overhead',kind,...data}});};
 const n=events.filter(x=>x.type==='ANNUNCIATOR_UPDATE').length;
 send({},w.location.origin,'pressurization-live-output',{system:'CPCS',lamps:{autoFail:true}});
 send(frame,'https://invalid.test','aircon400-zone-status',{family:'B737-400',zoneFaults:{'fwd-cab':true}});
 assert.equal(events.filter(x=>x.type==='ANNUNCIATOR_UPDATE').length,n);
 send(frame,w.location.origin,'pressurization-live-output',{system:'CPCS',lamps:{autoFail:true}});
 send(frame,w.location.origin,'aircon400-zone-status',{family:'B737-400',zoneFaults:{'fwd-cab':true}});
 let last=events.filter(x=>x.type==='ANNUNCIATOR_UPDATE').at(-1).detail;
 assert.deepEqual(last['FO.AIR COND'],['PRESS:CPCS:AUTO_FAIL','AIRCON400:fwd-cab:ZONE_FAULT']);
 send(frame,w.location.origin,'pressurization-live-output',{system:'CPCS',lamps:{autoFail:false}});
 last=events.filter(x=>x.type==='ANNUNCIATOR_UPDATE').at(-1).detail;
 assert.deepEqual(last['FO.AIR COND'],['AIRCON400:fwd-cab:ZONE_FAULT']);
});
