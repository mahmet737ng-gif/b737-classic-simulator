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
