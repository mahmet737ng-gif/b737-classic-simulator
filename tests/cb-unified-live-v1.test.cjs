'use strict';
const {test,afterEach}=require('node:test'),A=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm');
const Kernel=require('../engine/cb/cb-kernel'),Gates=require('../engine/cb/unified-circuit-gates-v1');
const E=require('../engine/systems/electrical-v7'),P=require('../engine/systems/pneumatics-v6');
const C=require('../engine/systems/cpcs-v5'),D=require('../engine/systems/dcpcs-v4');
const scope={window:{}};vm.runInNewContext(fs.readFileSync('cb-panel-lab/catalog.js','utf8'),scope);
const catalog=scope.window.CB_CATALOG;
function setup(variant='CPCS'){const cb=Gates.create(catalog,Kernel,{variant});global.B737UnifiedCB=cb;return cb;}
function pull(cb,id){A.equal(cb.network.action(id,'PULL').ok,true,id);}
function push(cb,id){A.equal(cb.network.action(id,'PUSH').ok,true,id);}
afterEach(()=>{delete global.B737UnifiedCB;});
test('Every declared physical identity exists; CPCS/DCPCS alternate slots stay exclusive',()=>{
 for(const variant of ['CPCS','DCPCS']){const cb=setup(variant);
  for(const [name,def]of Object.entries(Gates.DEFINITIONS))for(const raw of def.keys){
   const id=raw.replace('|ACTIVE|','|'+variant+'|');A.ok(cb.network.state(id),name+' '+id);
  }
  for(const def of Object.values(Gates.DEFINITIONS))for(const id of def.keys){
   if(id.includes('|ACTIVE|'))A.equal(cb.closed(id),true);
  }
  const before=cb.report().total;cb.setVariant(variant==='CPCS'?'DCPCS':'CPCS');A.notEqual(cb.report().total,before);
 }
});
test('Every mapped protection opens its consumer; push does not erase any independent fault',()=>{
 const cb=setup();
 for(const [name,def]of Object.entries(Gates.DEFINITIONS))for(const raw of def.keys){
  const id=raw.replace('|ACTIVE|','|CPCS|');if(!cb.network.isActive(cb.network.state(id)))continue;
  pull(cb,id);A.equal(cb.available(name),false,name);A.equal(cb.gate(name,null),false);push(cb,id);
 }
 cb.network.action('P6-3|ALL|B7','INJECT_TRIP','pump short');
 A.equal(cb.available('fuel.main1FwdPump'),false);A.equal(cb.network.action('P6-3|ALL|B7','PUSH').ok,false);
 A.equal(cb.available('fuel.main2FwdPump'),true);
 cb.network.action('P6-3|ALL|B7','CLEAR_FAULT');push(cb,'P6-3|ALL|B7');
 A.equal(cb.available('fuel.main1FwdPump'),true);
});
test('Generator CB isolation retains opposite-side transfer and push preserves generator failure',()=>{
 const cb=setup(),s=E.initialState();pull(cb,'P6-4|CPCS|D10');
 const r=E.evaluate(s);A.equal(r.bus.generator1,false);A.equal(r.bus.generator2,true);A.equal(r.bus.transfer1,true);
 const broken=E.apply(s,{type:'FAULT',id:'GEN1_FAILED',active:true,instructor:true});
 push(cb,'P6-4|CPCS|D10');A.equal(E.evaluate(broken).bus.generator1,false);A.equal(s.config.engine1Running,true);
});
test('TR circuits preserve DC tie backup; charger alternate path remains independent',()=>{
 const cb=setup(),s=E.initialState();pull(cb,'P6-4|CPCS|A8');
 A.equal(E.evaluate(s).feed.tr.TR1,false);A.equal(E.evaluate(s).bus.dc1,true);
 pull(cb,'P6-4|CPCS|D8');A.equal(E.evaluate(s).feed.chargerSource,'MAIN_2');
 pull(cb,'P6-4|CPCS|F8');A.equal(E.evaluate(s).feed.chargerSource,null);A.equal(E.evaluate(s).bus.hotBattery,true);
});
test('Pack loss changes real air output without moving switches or destroying independent trips',()=>{
 const cb=setup(),s=P.initial();A.equal(P.derive(s).pack.L.operational,true);
 pull(cb,'P6-4|CPCS|C4');let r=P.derive(s);A.equal(r.pack.L.operational,false);A.equal(r.pack.R.operational,true);A.equal(s.controls.packL,'AUTO');
 s.latched.packL=true;push(cb,'P6-4|CPCS|C4');A.equal(P.derive(s).pack.L.operational,false);A.equal(s.latched.packL,true);
});
test('Bleed, isolation, recirc and detector circuits have separate downstream effects',()=>{
 const cb=setup(),s=P.initial();s.controls.engineBleed1='OFF';s.controls.engineBleed2='OFF';s.controls.apuBleed='ON';s.inputs.apuRunning=true;s.controls.isolation='OPEN';
 A.equal(P.derive(s).duct.R.anySupply,true);
 pull(cb,'P6-4|CPCS|B1');A.equal(P.derive(s).bleed.isolationOpen,null);A.equal(P.derive(s).duct.L.anySupply,true);A.equal(P.derive(s).duct.R.anySupply,null);
 pull(cb,'P6-4|CPCS|E5');A.equal(P.derive(s).recircFanRunning,false);
 s.inputs.wingBodyTestHeld=true;pull(cb,'P6-4|CPCS|D4');A.equal(P.derive(s).lamps.wingBodyOverheatL,false);A.equal(s.inputs.wingBodyTestHeld,true);
});
test('CPCS automatic loss transfers to standby; independent manual DC remains available',()=>{
 const cb=setup(),s=C.initial();pull(cb,'P6-4|CPCS|F1');
 let r=C.derive(s);A.equal(r.operatingMode,'STBY');A.equal(r.outflow.actuationAvailable,true);
 pull(cb,'P6-4|CPCS|F4');A.equal(C.derive(s).outflow.actuationAvailable,false);
 const manual=C.apply(s,{type:'MODE',value:'MAN_DC'});A.equal(C.derive(manual).outflow.actuationAvailable,true);
});
test('DCPCS loses one controller without losing the other; manual CB stops actual valve travel',()=>{
 const cb=setup('DCPCS');let s=D.initial();pull(cb,'P6-4|DCPCS|F2');
 let r=D.derive(s);A.equal(r.activeController,2);A.equal(r.controllerHealthy[1],false);A.equal(r.controllerHealthy[2],true);
 s=D.apply(s,{type:'MODE',value:'MAN'});s=D.apply(s,{type:'MANUAL_SWITCH',value:'CLOSE'});
 pull(cb,'P6-4|DCPCS|F1');const before=s.manualValveFraction;
 s=D.apply(s,{type:'ADVANCE',ms:5000});A.equal(s.manualValveFraction,before);A.equal(D.derive(s).outflowCommand,'NO_DRIVE_AVAILABLE');
});
test('Persisted trips survive a reload and invalid snapshots cannot energize a pulled circuit',()=>{
 const a=setup();a.network.action('P6-3|ALL|B7','INJECT_TRIP','short');
 const b=setup();A.equal(b.restore(a.snapshot()).ok,true);A.equal(b.available('fuel.main1FwdPump'),false);
 A.equal(b.restore({schema:1,variant:'CPCS',breakers:[{id:'bad',pulled:false,tripped:false,fault:null}]}).ok,false);
 A.equal(b.available('fuel.main1FwdPump'),false);
});
test('Actual fuel/hyd pump outputs stop independently while switches and instructor failures persist',()=>{
 const cb=setup(),Loads=require('../engine/systems/electrical-loads-v8'),TrainerCore=require('../engine/trainer/core'),{WarningEngine}=require('../audio/warning-engine'),Pack=require('../engine/integration/isn-electrical-pack-v1');
 const s=new Pack.Session({Electrical:E,Loads,TrainerCore,WarningEngine});
 for(const [key,value]of Object.entries({batterySwitch:true,engine1Running:true,engine2Running:true}))s.send({type:'ELECTRICAL',action:{type:'CONTROL',key,value}});
 for(const side of [1,2])s.send({type:'ELECTRICAL',action:{type:'SELECT_SOURCE',side,source:'GEN'+side}});
 s.send({type:'MODE',value:'TRAINING_SURROGATE',instructor:true});
 for(const id of ['fuel.main1FwdPump','fuel.main2FwdPump','hyd.electricPumpA','hyd.electricPumpB'])s.send({type:'PUMP_SWITCH',id,value:true});
 pull(cb,'P6-3|ALL|B7');pull(cb,'P6-12|ALL|C2');let r=s.compute(null);
 A.equal(r.pumps['fuel.main1FwdPump'].operating,false);A.equal(r.pumps['fuel.main2FwdPump'].operating,true);
 A.equal(r.pumps['hyd.electricPumpA'].operating,false);A.equal(r.pumps['hyd.electricPumpB'].operating,true);
 A.equal(s.pumps['fuel.main1FwdPump'].switchOn,true);
 s.send({type:'PUMP_FAULT',id:'fuel.main1FwdPump',value:true,instructor:true});push(cb,'P6-3|ALL|B7');
 A.equal(s.compute(null).pumps['fuel.main1FwdPump'].operating,false);
});
test('Start/ignition CBs act on real start chain, not engine-running switches',()=>{
 const cb=setup(),Loads=require('../engine/systems/electrical-loads-v8'),TrainerCore=require('../engine/trainer/core'),{WarningEngine}=require('../audio/warning-engine'),Pack=require('../engine/integration/isn-electrical-pack-v1'),EngineAPU=require('../engine/integration/isn-engine-apu-v1'),Start=require('../engine/integration/isn-start-sequence-v1'),{Chain}=require('../engine/integration/isn-apu-start-chain-v1');
 const session=new Start.Session({EngineAPU,ElectricalPack:Pack,Electrical:E,Loads,TrainerCore,WarningEngine,Pneumatics:P}),chain=new Chain(session);
 chain.synchronize({toggles:{'bleed-apu':'ON','pack-l':'OFF','pack-r':'OFF','isolation-valve':'OPEN'},guards:{'battery-master':{value:'on'}},rotaries:{'ignition-source':'BOTH'},context:{onGround:true}});
 chain.event({id:'apu-start',kind:'toggle',next:'START'});chain.advance(1400);
 session.core.pack.send({type:'ELECTRICAL',action:{type:'SELECT_SOURCE',source:'APU',side:1}});chain.syncPower();
 pull(cb,'P6-2|ALL|A7');chain.event({id:'engine-start-1',kind:'rotary',next:'GRD'});A.equal(chain.phase.engine1,'BLOCKED');A.match(chain.lastError,/CB OPEN/);
 push(cb,'P6-2|ALL|A7');chain.event({id:'engine-start-1',kind:'rotary',next:'GRD'});chain.advance(850);
 pull(cb,'P6-2|ALL|B8');pull(cb,'P6-2|ALL|B7');chain.lever('engine1','IDLE');chain.advance(200);
 A.notEqual(chain.phase.engine1,'LIGHT_OFF_SEQUENCE');
 push(cb,'P6-2|ALL|B8');chain.maybeLightoff('engine1');A.equal(chain.phase.engine1,'LIGHT_OFF_SEQUENCE');chain.advance(5000);A.equal(chain.phase.engine1,'RUNNING');
 pull(cb,'P6-2|ALL|B8');chain.advance(100);A.equal(chain.phase.engine1,'RUNNING','Ignition loss does not kill a self-sustaining engine');
 pull(cb,'P6-5|ALL|B1');chain.advance(0);A.notEqual(chain.phase.apu,'READY');
});
test('Browser state bridge reloads across frames, preserves malformed-state protection and profile isolation',()=>{
 const store=new Map(),listeners={},events=[];
 const win={B737UnifiedCircuitGatesV1:Gates,B737_CB_Kernel:Kernel,CB_CATALOG:catalog,
 addEventListener:(type,cb)=>(listeners[type]??=[]).push(cb),dispatchEvent:e=>events.push(e)};
 const context={window:win,localStorage:{getItem:k=>store.get(k)??null},location:{origin:'https://example.org'},document:{querySelectorAll:()=>[]},console:{warn:()=>{}},CustomEvent:class{constructor(type,opts){this.type=type;this.detail=opts.detail;}}};win.parent=win;
 vm.runInNewContext(fs.readFileSync('panel-mosaic-lab/cockpit/cb-unified-live-v1.js','utf8'),context);
 const external=Gates.create(catalog,Kernel);pull(external,'P6-3|ALL|B7');store.set(Gates.STORAGE,JSON.stringify(external.snapshot()));
 listeners.storage.forEach(fn=>fn({key:Gates.STORAGE}));A.equal(win.B737UnifiedCB.available('fuel.main1FwdPump'),false);
 store.set(Gates.STORAGE,'{broken');listeners.storage.forEach(fn=>fn({key:Gates.STORAGE}));A.equal(win.B737UnifiedCB.available('fuel.main1FwdPump'),false);A.ok(win.B737UnifiedCB.report().error);
 store.set(Gates.STORAGE,JSON.stringify(external.snapshot()));store.set(Gates.PROFILE,JSON.stringify({pressurization:'DCPCS'}));listeners.storage.forEach(fn=>fn({key:Gates.PROFILE}));A.equal(win.B737UnifiedCB.report().variant,'DCPCS');A.equal(win.B737UnifiedCB.available('fuel.main1FwdPump'),false);A.ok(events.some(e=>e.type==='b737:cb-state-change'));
});
test('Fire detector CB removes sensing, reports loss, and retains physical fire and independent engine channel',()=>{
 const cb=setup(),F=require('../fire-protection-lab/engine'),s=F.defaults();
 s.engineFire.ENG1=true;s.engineFire.ENG2=true;A.equal(F.evaluate(s).activeFire.ENG1,true);
 pull(cb,'P6-2|ALL|A24');let r=F.evaluate(s);A.equal(r.activeFire.ENG1,false);A.equal(r.activeFire.ENG2,true);A.equal(r.indications.FAULT,true);A.equal(s.engineFire.ENG1,true);
 s.apuFire=true;pull(cb,'P6-2|ALL|A23');r=F.evaluate(s);A.equal(r.activeFire.APU,false);A.equal(r.indications.APU_DET_INOP,true);
 push(cb,'P6-2|ALL|A24');A.equal(F.evaluate(s).activeFire.ENG1,true);
});
test('Individual engine indication CB blanks only its display channel in EIS and conventional',()=>{
 const cb=setup(),M=require('../engine/instruments/engine-indication-backend-v1'),db=require('../engine/instruments/engine-indication-technical-db-v1.json');
 const observed={engine1:{},engine2:{}};for(const side of ['engine1','engine2'])for(const [p,unit]of Object.entries({n1:'%',n2:'%',egt:'°C',fuelFlow:'kg/h',oilPressure:'psi',oilTemperature:'°C',oilQuantity:'%FULL',vibration:'units'}))observed[side][p]={valid:true,value:50,unit,origin:'TEST'};
 const bus=E.evaluate(E.initialState());pull(cb,'P6-2|ALL|D3');
 for(const mode of ['EIS','CONVENTIONAL']){const r=M.calculate(db,{mode,electrical:bus,observed});A.equal(r.engines.engine1.indications.n1.status,'POWER_LOSS');A.equal(r.engines.engine2.indications.n1.status,'VALID');A.equal(r.engines.engine1.indications.n2.status,'VALID');}
 A.equal(observed.engine1.n1.value,50,'Sensor/physical rotor is unaffected');
});
test('IRS backend loses one unit only after both its AC and DC paths are cut',()=>{
 const cb=setup(),Core=require('../engine/systems/irs-trainer-web-v1');
 global.B737UnifiedCB={...cb,irsPower:(side,upstream)=>upstream&&(cb.available('irs.'+side+'.ac')!==false||cb.available('irs.'+side+'.dc')!==false)};
 let s=Core.initialState();for(const side of ['L','R'])s=Core.apply(s,{type:'POWER',side,available:true});
 pull(cb,'P18-2|ALL|D4');s=Core.tick(s,{dtSec:.1,stationary:true,valid:false});A.equal(s.units.L.powered,true);
 pull(cb,'P18-2|ALL|D5');s=Core.tick(s,{dtSec:.1,stationary:true,valid:false});A.equal(s.units.L.powered,false);A.equal(s.units.R.powered,true);
 push(cb,'P18-2|ALL|D4');s=Core.apply(s,{type:'POWER',side:'L',available:true});A.equal(s.units.L.powered,true);
});
