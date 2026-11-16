'use strict';
/* Sepehran 737CL FCOM 15.10.1-2, 15.20.1-4, 2.20.2.
 * Alerts are derived from real lit amber OH annunciator evidence.
 * The master-caution buttons are one logical system for both pilots.
 */
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const mapper=require('./sixpack-live-integration-v1.js');
const overhead=(frames,power=true,lampTest=false)=>
 mapper.overhead({power,lampTest,frames});
function sixpack(){
 const listeners=new Map(),win={};
 win.addEventListener=(k,cb)=>{if(!listeners.has(k))listeners.set(k,[]);listeners.get(k).push(cb);};
 win.dispatchEvent=e=>{for(const cb of listeners.get(e.type)||[])cb(e);};
 const document={readyState:'loading',addEventListener(){},
  getElementById(){return null;},querySelectorAll(){return []}};
 class CustomEvent{constructor(type,{detail}={}){this.type=type;this.detail=detail;}}
 vm.runInNewContext(fs.readFileSync(path.join(__dirname,'sixpack-glareshield-v1.js'),'utf8'),
  {window:win,document,CustomEvent},{timeout:3000});
 return win.B737SixPack;
}
const key='FO.AIR COND';
test('DUAL BLEED amber lamp immediately activates AIR COND and two MASTER CAUTION lights',()=>{
 const core=sixpack();
 const active=overhead({'dual-bleed':'ON'});
 assert.deepEqual(active[key],['OH:dual-bleed']);
 core.setLiveConditions(active);
 const effective=core.getEffectiveState();
 assert.equal(effective[key],true);
 assert.equal(effective['CAPT.MASTER CAUTION'],true);
 assert.equal(effective['FO.MASTER CAUTION'],true);
 assert.equal(effective['CAPT.ELEC'],false);
 const details=core.getLiveConditionDetails();
 assert.equal(details[key][0].mode,'IMMEDIATE');
 core.acknowledge();
 assert.equal(core.getEffectiveState()[key],false);
 assert.equal(core.getEffectiveState()['CAPT.MASTER CAUTION'],false);
 assert.equal(core.getEffectiveState()['FO.MASTER CAUTION'],false);
 assert.deepEqual(Array.from(core.getLiveReasons()[key]),['OH:dual-bleed']);
 core.recall('CAPT');
 assert.equal(core.getEffectiveState()[key],true);
 assert.equal(core.getEffectiveState()['FO.MASTER CAUTION'],true);
 core.acknowledge();
 core.setLiveConditions(overhead({'dual-bleed':'ON','pack-trip-l':'ON'}));
 assert.equal(core.getEffectiveState()[key],true,'new PACK TRIP alert retriggers MC');
 assert.equal(core.getEffectiveState()['CAPT.MASTER CAUTION'],true);
 core.setLiveConditions(overhead({}));
 assert.equal(core.getEffectiveState()[key],false,'clearing physical fault clears AIR COND reason');
 assert.equal(core.getEffectiveState()['CAPT.MASTER CAUTION'],false);
});
test('Both independent blue GEN OFF BUS and APU GEN OFF BUS lights are informational',()=>{
 const core=sixpack();
 const blue=['gen-off-bus-1','gen-off-bus-2','apu-gen-off-bus','ground-power-available'];
 for(const state of ['BRIGHT_BLUE','ON','FLASH']){
  const frames=Object.fromEntries(blue.map(x=>[x,state]));
  const m=overhead(frames);
  assert.deepEqual(m['CAPT.ELEC'],[]);
  assert.deepEqual(m[key],[]);
  core.setLiveConditions(m);
  assert.equal(core.getEffectiveState()['CAPT.MASTER CAUTION'],false);
  assert.equal(core.getEffectiveState()['FO.MASTER CAUTION'],false);
 }
 const ecu=mapper.electrical({state:{faults:{GEN1_FAILED:true,GEN2_FAILED:true,APU_FAILED:true}},
  evaluated:{lamps:{genOffBus1:true,genOffBus2:true,apuGenOffBus:true}}});
 assert.deepEqual(ecu['CAPT.ELEC'],[],'raw faults plus blue lamp must not bypass amber system indication');
 assert.deepEqual(ecu['CAPT.APU'],[],'APU generator failure is not APU FAULT lamp evidence');
});
test('Only documented amber ELEC warnings trigger, not failed generator alone',()=>{
 const core=sixpack();
 const cases=['standby-power-off','transferBusOff1','transferBusOff2','busOff1','busOff2',
  'drive-1-drive-pressure','drive-2-drive-pressure',
  'drive-1-drive-temperature','drive-2-drive-temperature'];
 for(const label of cases){
  const data=overhead({[label]:'ON'});
  assert.deepEqual(data['CAPT.ELEC'],['OH:'+label],label);
  core.setLiveConditions(data);
  assert.equal(core.getEffectiveState()['CAPT.MASTER CAUTION'],true,label);
  assert.equal(core.getEffectiveState()['CAPT.ELEC'],true,label);
  assert.equal(core.getEffectiveState()['FO.ENG'],false,label+' belongs to ELEC not ENG');
  core.setLiveConditions(overhead({}));
 }
});
test('FCOM category inventory is 12 disjoint groups, and all mapped lens IDs are physical overhead assets',()=>{
 const registry=JSON.parse(fs.readFileSync(path.join(__dirname,'../interactive-overhead/lights.json'),'utf8'));
 const ids=new Set(registry.lights.map(x=>x.id));
 assert.equal(Object.keys(mapper.groups).length,12);
 const taken=new Map();
 for(const [group,parts]of Object.entries(mapper.groups)){
  assert(parts.length>0||group==='CAPT.OVHT/DET','empty category must have an independent source');
  for(const id of parts){
   assert(ids.has(id),group+'/'+id+' references a non-existent light');
   assert(!taken.has(id),'lamp must have exactly one category '+id+' in '+group+' and '+taken.get(id));
   taken.set(id,group);
   assert(!['gen-off-bus-1','gen-off-bus-2','apu-gen-off-bus','ground-power-available'].includes(id));
  }
 }
 assert(taken.get('dual-bleed')===key);
 assert(taken.get('drive-1-drive-pressure')==='CAPT.ELEC');
 assert(taken.get('pmc-inop-1')==='FO.ENG');
 assert(taken.get('pass-oxygen')==='FO.OVERHEAD');
});
test('Recall-only causes do not trip MASTER CAUTION; live amber requires powered untested overhead',()=>{
 const core=sixpack();
 core.setLiveConditions({'CAPT.FUEL':[{id:'FUEL:ONE_PUMP',mode:'RECALL_ONLY'}]});
 assert.equal(core.getEffectiveState()['CAPT.MASTER CAUTION'],false);
 assert.equal(core.getEffectiveState()['CAPT.FUEL'],false);
 core.recall('FO');
 assert.equal(core.getEffectiveState()['CAPT.FUEL'],true);
 assert.equal(core.getEffectiveState()['FO.MASTER CAUTION'],false);
 core.acknowledge();
 assert.equal(core.getEffectiveState()['CAPT.FUEL'],false);
 const denied=overhead({'dual-bleed':'ON'},false);
 assert.deepEqual(denied[key],[]);
 assert.equal(overhead({'dual-bleed':'ON'},true,true),null);
});
test('Never turn simulated blue advisory or overhead lamp test into physical MC event',()=>{
 const owner=fs.readFileSync(path.join(__dirname,'sixpack-live-integration-v1.js'),'utf8');
 assert(!/\['CAPT\.ELEC'\]:\[[^\]]*gen-off-bus/.test(owner));
 assert.match(owner,/FO\.AIR COND.*dual-bleed/);
 assert.match(owner,/lamps\[id\]===true/);
 assert(!owner.includes("result['CAPT.ELEC'].push('ELEC:'+id)"));
});
