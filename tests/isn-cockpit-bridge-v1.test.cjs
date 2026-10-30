'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const read=rel=>JSON.parse(fs.readFileSync(path.join(__dirname,'..',rel)));
const source=rel=>fs.readFileSync(path.join(__dirname,'..',rel),'utf8');
const Pack=require('../engine/integration/isn-electrical-pack-v1');
const Electrical=require('../engine/systems/electrical-v7');
const Loads=require('../engine/systems/electrical-loads-v8');
const TrainerCore=require('../engine/trainer/core');
const {WarningEngine}=require('../audio/warning-engine');
const Adapter=require('../engine/integration/isn-cockpit-bridge-v1');
const make=()=>new Adapter.Bridge(new Pack.Session({Electrical,Loads,TrainerCore,WarningEngine}));

const registry=read('panel-mosaic-lab/interactive-overhead/registry.json');
const lamps=read('panel-mosaic-lab/interactive-overhead/lights.json');
const guards=read('panel-mosaic-lab/interactive-overhead/rotary-guards.json');
const upper=read('panel-mosaic-lab/interactive-overhead/lights-controls.json');
const controls=new Map(registry.controls.map(c=>[c.id,c]));
const mountedLamps=new Map(lamps.lights.map(c=>[c.id,c]));
const guardsMap=new Map([...guards.guards,...upper.guards].map(c=>[c.id,c]));
assert.equal(Object.keys(Adapter.PUMPS).length,8);
assert.equal(new Set(Object.values(Adapter.PUMPS)).size,8);
for(const [control,pump] of Object.entries(Adapter.PUMPS)){
 assert.ok(controls.has(control),'real pump control '+control);
 assert.deepEqual(controls.get(control).states,['OFF','ON']);
 assert.ok(mountedLamps.has(control),'real LOW PRESS lamp '+control);
 assert.ok(mountedLamps.get(control).controls.includes(control),'lamp registered to control '+control);
 assert.equal(mountedLamps.get(control).rule,pump.startsWith('fuel.')?'fuel-pressure':'hyd-pressure');
 assert.equal(Adapter.LAMPS[pump],control);
}
assert.equal(Adapter.PUMPS['hyd-elec-2'],'hyd.electricPumpA');
assert.equal(Adapter.PUMPS['hyd-elec-1'],'hyd.electricPumpB');
assert.equal(TrainerCore.LABELS.elecA,'ELEC 2 / SYS A');
assert.equal(TrainerCore.LABELS.elecB,'ELEC 1 / SYS B');
for(const id of Object.values(Adapter.ELECTRICAL_LAMPS))assert.ok(mountedLamps.has(id),'real electrical lamp '+id);
assert.equal(guardsMap.size,0,'No old graphical guarded controls are mounted; integration accepts separately injected electrical training scenarios');
assert.equal(controls.has('bus-transfer'),false,'no invented physical BUS TRANSFER switch');
const initial={toggles:Object.fromEntries(registry.controls.map(c=>[c.id,c.default])),
 // Integration fixtures describe electrical test signals, not a visual guarded-switch installation.
 guards:{'battery-master':{value:'on',guard:'closed'},'standby-power':{value:'auto',guard:'closed'},
         'generator-disconnect-1':{value:'normal',guard:'closed'},'generator-disconnect-2':{value:'normal',guard:'closed'}},
 rotaries:{},context:{onGround:true,engine1Running:true,engine2Running:true,apuRunning:false,groundPowerAttached:false}};
const bridge=make();let r=bridge.synchronize(initial),s=r.state;
assert.equal(r.initialized,true);
assert.equal(r.coverage.pumpControls,8);
assert.equal(r.coverage.pumpLamps,8);
assert.equal(r.coverage.electricalLamps,8);
assert.equal(r.lamps['ground-power-available'],s.electrical.lamps.groundPowerAvailable);
assert.equal(r.lamps['standby-power-off'],s.electrical.lamps.standbyPowerOff);
assert.equal(r.coverage.busTransferPhysicalControl,false);
assert.equal(s.mode,'SOURCE_GATED');
for(const [control,pump] of Object.entries(Adapter.PUMPS)){
 assert.equal(s.pumps[pump].switchOn,initial.toggles[control]==='ON');
 assert.equal(s.pumps[pump].powered,null);
 assert.equal(s.pumps[pump].sourceBus,null);
 assert.equal(r.lamps[control],s.pumps[pump].lowPressure);
}
assert.equal(s.pumps['hyd.electricPumpA'].switchOn,false);
assert.equal(s.pumps['hyd.electricPumpB'].switchOn,true);
const beforeEvents=s.recentEvents.length;
bridge.synchronize(initial);
assert.equal(bridge.get().state.recentEvents.length,beforeEvents,'duplicate iframe state is idempotent');

bridge.handleEvent({id:'fuel-1-fwd',kind:'toggle',next:'OFF'});
assert.equal(bridge.get().state.pumps['fuel.main1FwdPump'].switchOn,false);
assert.equal(bridge.get().lamps['fuel-1-fwd'],true,'main LOW PRESS with pump off');
bridge.handleEvent({id:'fuel-center-l',kind:'toggle',next:'OFF'});
assert.equal(bridge.get().lamps['fuel-center-l'],false,'center LOW PRESS inhibited by switch OFF');
bridge.handleEvent({id:'fuel-1-fwd',kind:'toggle',next:'ON'});
assert.equal(bridge.get().lamps['fuel-1-fwd'],null,'UNKNOWN is never rendered as verified OFF');
assert.ok(bridge.get().state.recentEvents.at(-1).changes.some(c=>c.path==='fuel.main1FwdPump.lowPressure'));

bridge.handleEvent({id:'generator-disconnect-1',kind:'guarded',next:{value:'disconnect',guard:'open'}});
r=bridge.get();assert.equal(r.state.electrical.bus.generator1,false);
assert.equal(r.state.electrical.bus.transfer1,true,'GEN2 crossfeed in Electrical V7');
assert.equal(r.lamps['gen-off-bus-1'],true);
bridge.instructor({type:'ELECTRICAL',action:{type:'CONTROL',key:'busTransferAuto',value:false}});
r=bridge.get();assert.equal(r.state.electrical.bus.transfer1,false);
assert.equal(r.lamps.transferBusOff1,true);
assert.equal(r.state.pumps['fuel.main1FwdPump'].powered,null,'no inferred LRU bus loss');
bridge.instructor({type:'ELECTRICAL',action:{type:'CONTROL',key:'busTransferAuto',value:true}});
bridge.handleEvent({id:'generator-disconnect-1',kind:'guarded',next:{value:'normal',guard:'open'}});
assert.equal(bridge.get().state.electrical.bus.generator1,true);
bridge.handleEvent({id:'gen-1',kind:'toggle',next:'OFF'});
assert.equal(bridge.get().state.electrical.bus.generator1,false);
bridge.handleEvent({id:'gen-1',kind:'toggle',next:'NEUTRAL'});
assert.equal(bridge.get().state.electrical.bus.generator1,false,'NEUTRAL does not connect generator');
bridge.handleEvent({id:'gen-1',kind:'toggle',next:'ON'});
assert.equal(bridge.get().state.electrical.bus.generator1,true);
bridge.handleEvent({id:'gen-1',kind:'toggle',next:'NEUTRAL'});
assert.equal(bridge.get().state.electrical.bus.generator1,true,'spring return keeps latched source');

bridge.instructor({type:'OBSERVED_POWER',id:'fuel.main1FwdPump',value:false,instructor:true});
r=bridge.get();assert.equal(r.lamps['fuel-1-fwd'],true);
assert.equal(r.state.pumps['fuel.main1FwdPump'].powerEvidence,'INDEPENDENT_INSTRUCTOR_SENSOR');
bridge.instructor({type:'OBSERVED_POWER',id:'fuel.main1FwdPump',value:true,instructor:true});
assert.equal(bridge.get().lamps['fuel-1-fwd'],false);
bridge.instructor({type:'PUMP_FAULT',id:'hyd.electricPumpA',value:true,instructor:true});
assert.equal(bridge.get().lamps['hyd-elec-2'],true);
bridge.instructor({type:'PUMP_OVERHEAT',id:'hyd.electricPumpB',value:true,instructor:true});
assert.equal(bridge.get().lamps['hyd-elec-1-overheat'],true);
assert.equal(bridge.get().state.warnings.masterCautionHyd,null,'no invented HYD master caution');
assert.equal(bridge.get().state.warnings.audio.active.length,0,'no invented aural pump alarm');
bridge.instructor({type:'MODE',value:'TRAINING_SURROGATE',instructor:true});
assert.equal(bridge.get().state.pumps['fuel.main1FwdPump'].powerEvidence,'TRAINING_SURROGATE_UNVERIFIED_BUS_ASSIGNMENT');
bridge.instructor({type:'MODE',value:'SOURCE_GATED',instructor:true});
assert.equal(bridge.get().state.pumps['fuel.main1FwdPump'].sourceBus,null);
bridge.instructor({type:'WARNING_SENSOR',key:'engine1Fire',value:true});
assert.ok(bridge.get().state.warnings.audio.active.some(a=>a.id==='fireBell'));
bridge.instructor({type:'ACK_FIRE'});
assert.ok(!bridge.get().state.warnings.audio.active.some(a=>a.id==='fireBell'));
bridge.instructor({type:'WARNING_SENSOR',key:'engine1Fire',value:false});
const beforeReplay=bridge.get().state;
bridge.replay();
assert.deepEqual(bridge.get().state,beforeReplay,'ISN-02 command replay reproduces event trace and projections');
bridge.reset();assert.equal(bridge.get().state.mode,'SOURCE_GATED');
assert.equal(bridge.get().state.pumps['fuel.main1FwdPump'].switchOn,true,'reset rehydrates real cockpit switches');

const external=make();
external.synchronize({...initial,context:{...initial.context,groundPowerAttached:true}});
external.handleEvent({id:'ground-power',kind:'toggle',next:'ON'});
assert.deepEqual(external.get().state.electrical.source,{1:'EXT',2:'EXT'},'ground power selection feeds both bus sources');
external.handleEvent({id:'ground-power',kind:'toggle',next:'OFF'});
assert.deepEqual(external.get().state.electrical.source,{1:null,2:null},'ground power OFF clears both EXT selections');
external.synchronize({...initial,context:{...initial.context,onGround:false}});
assert.equal(external.get().state.sensors.onGround,false,'onGround sensor routes to warning system too');

// The only embedded entry is outside frozen all-overhead; the final assets
// and source-renderer hashes are checked separately by verify-final-overhead.py.
const host=source('panel-mosaic-lab/cockpit/index.html');
const child=source('panel-mosaic-lab/cockpit/overhead-bridge.js');
assert.match(host,/isn-cockpit-bridge-v1\.js/);
assert.match(host,/isn-cockpit\.js/);
const hostScripts=[...host.matchAll(/<script src="([^"]+)"/g)].map(m=>m[1].split('?')[0]);
for(const src of hostScripts)assert.ok(fs.existsSync(path.resolve(__dirname,'../panel-mosaic-lab/cockpit',src)),'Unified script resolves '+src);
assert.match(child,/kind:'control-event'/);
assert.match(child,/kind:'controls-state'/);
assert.match(child,/if\(base\.lampTest\)return/);
assert.match(child,/cockpit-visual-test/);
console.log('ISN-02 physical registry mapping, events, power, lamps, UNKNOWN, warnings and UI guard: PASS');
