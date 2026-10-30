'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const E=require('../engine/systems/electrical-v7');
const model=require('../panel-mosaic-lab/cockpit/drive-amps-needle-model');
const root=path.join(__dirname,'..');
test('both engine GEN OFF BUS lamps require engine running and generator not powering its bus',()=>{
 let s=E.initialState();
 for(const engine of [1,2])s=E.apply(s,{type:'CONTROL',key:'engine'+engine+'Running',value:false});
 assert.equal(E.evaluate(s).lamps.genOffBus1,false);
 assert.equal(E.evaluate(s).lamps.genOffBus2,false);
 s=E.apply(s,{type:'CONTROL',key:'engine1Running',value:true});
 s=E.apply(s,{type:'SELECT_SOURCE',source:'OFF',side:1});
 assert.equal(E.evaluate(s).lamps.genOffBus1,true);
 assert.equal(E.evaluate(s).lamps.genOffBus2,false);
 s=E.apply(s,{type:'SELECT_SOURCE',source:'GEN1',side:1});
 assert.equal(E.evaluate(s).lamps.genOffBus1,false);
 s=E.apply(s,{type:'CONTROL',key:'engine2Running',value:true});
 s=E.apply(s,{type:'SELECT_SOURCE',source:'OFF',side:2});
 assert.equal(E.evaluate(s).lamps.genOffBus2,true);
});
test('APU A.C. AMPS 0A belongs to the lower-left marked tick',()=>{
 assert.equal(model.needle?.initialAngle,undefined);
 assert.equal(model.needles.find(n=>n.id==='apuAcAmps').initialAngle,-74);
 for(const [amps,bearing] of [[0,-74],[50,-37],[100,0],[150,37],[200,74]])
  assert.equal(model.bearingForApuAmps(amps),bearing);
});
test('Unified APU ammeter is zero unless the physical generator is READY and actually feeding AC',()=>{
 const src=fs.readFileSync(path.join(root,'panel-mosaic-lab/cockpit/electrical-demand-live-unified-v1.js'),'utf8');
 let selected={1:'APU',2:null},amps=52,ready=false,connected=[];
 const calls=[],handlers={};
 const document={getElementById:()=>null,readyState:'complete',addEventListener:()=>{}};
 const own={getElectricalState:()=>({rev:1}),
   getState:()=>({state:{electrical:{schema:'B737_ELECTRICAL_V7_RESULT',revision:1,source:selected,bus:{}}}}),
   getECUState:()=>({apu:{generator:{ready,connectedBusSides:connected}}})};
 const window={
  B737ElectricalDemandEstimateV1:{VERSION:'TEST',project:()=>({
    sourceAmps:{GEN1:0,GEN2:0,APU:amps,EXT:0},
    sourceToBus:selected,trAmps:{TR1:0,TR2:0,TR3:0},batteryAmps:0,
    loads:[],totals:{},battery:{}
  })},
  B737ISNCockpitV1:own,B737DriveAmpsNeedleModel:model,
  B737UnifiedDriveAmpsNeedles:{setAmps:()=>{},setAngle:(id,a)=>calls.push({id,a})},
  addEventListener:(name,fn)=>{handlers[name]=fn;},
  dispatchEvent:()=>{}
 };
 vm.runInNewContext(src,{window,document,location:{origin:'https://example.com'},
  CustomEvent:class{constructor(type,opts){this.type=type;this.detail=opts?.detail;}},
  setInterval:()=>{},console});
 assert.equal(calls.at(-1).a,-74,'Generator initially OFF -> 0A even if old ledger reports 52A');
 ready=true;connected=[1];window.B737UnifiedLoadMeterV1.refresh();
 assert.equal(calls.at(-1).a,model.bearingForApuAmps(52),'Gen ready and selected -> live amps');
 selected={1:'GEN1',2:null};window.B737UnifiedLoadMeterV1.refresh();
 assert.equal(calls.at(-1).a,-74,'Bus disconnected -> zero even if old source amps is stale');
 selected={1:'APU',2:null};connected=[];window.B737UnifiedLoadMeterV1.refresh();
 assert.equal(calls.at(-1).a,-74,'No confirmed connected sides -> zero');
 connected=[1];amps=0;window.B737UnifiedLoadMeterV1.refresh();
 assert.equal(calls.at(-1).a,-74,'Available generator with no load -> zero amps');
});
test('APU GEN OFF BUS relies on ready source and evaluated live bus',()=>{
 const s=fs.readFileSync(path.join(root,'panel-mosaic-lab/cockpit/isn-cockpit.js'),'utf8');
 assert.match(s,/apuGenerator\.ready===true&&!apuOnBus/);
 assert.match(s,/bridge\.get\(\)\.state\.electrical\.source/);
 const cleaner=fs.readFileSync(path.join(root,'panel-mosaic-lab/cockpit/apu-egt-static-needle-cleaner-v1.js'),'utf8');
 assert.match(cleaner,/apuAmpsFootprint/);
 assert.match(cleaner,/OH12-BUS-TRANS-09319c17e7d0.png/);
});
