"use strict";
const {test}=require("node:test");
const A=require("node:assert/strict");
const fs=require("node:fs"),vm=require("node:vm"),path=require("node:path");
const CB=require("../engine/cb/cb-kernel.js");
const V7=require("../engine/systems/electrical-v7.js");
const Fuel=require("../engine/trainer/core.js");
const Effects=require("../engine/cb/electrical-v7-integration.js");
const scope={window:{}};
vm.runInNewContext(fs.readFileSync(path.join(__dirname,"../cb-panel-lab/catalog.js"),"utf8"),scope);
const catalog=scope.window.CB_CATALOG;
const init=()=>({cb:new CB.BreakerNetwork(catalog),electrical:V7.initialState(),trainer:Fuel.initialState()});
const evaluate=x=>Effects.project({cbNetwork:x.cb,electricalV7Result:V7.evaluate(x.electrical),trainerResult:Fuel.derive(x.trainer),trainerState:x.trainer});
const pump=name=>Effects.ALLOCATIONS.find(x=>x.load==="fuel."+name);
test("Source-identified 11 circuits exist with exact keys and MRG folios",()=>{
const x=init();A.equal(Effects.ALLOCATIONS.length,11);
for(const a of Effects.ALLOCATIONS){A(x.cb.state(a.key),a.key);A.match(a.location,/MRG p\.13[56]/);A.equal(a.bus,null);}
});
test("V7 original AC/DC system is not altered by CB projection",()=>{
const x=init(),baseline=V7.evaluate(x.electrical),out=evaluate(x);
A.deepEqual(out.overlay.bus,baseline.bus);A.equal(out.originalV7BusesUnmodified,true);A.equal(out.linkedEquipment,9);
});
test("CB pushed does not imply certified aircraft equipment power",()=>{
const x=init(),p=evaluate(x);A.equal(p.circuits["fuel.leftFwd"].devicePower,null);A.equal(p.circuits["com.vhf1"].devicePower,null);
A.equal(p.circuits["nav.vorloc1"].devicePower,null);
});
test("MRG P6-3 B7 pull stops LEFT MAIN FWD in trainer projection",()=>{
const x=init(),id=pump("leftFwd").key;A.equal(evaluate(x).overlay.fuel.leftFwd.operational,true);
A(x.cb.action(id,"PULL").ok);const e=evaluate(x);
A.equal(e.overlay.fuel.leftFwd.operational,false);A.equal(e.overlay.fuel.leftFwd.lowPressure,true);
A.equal(e.overlay.fuel.rightFwd.operational,true);
A.equal(e.circuits["fuel.leftFwd"].devicePower,false);
});
test("Each 6 mapped fuel CBs independently disconnects only its circuit",()=>{
for(const a of Effects.ALLOCATIONS.filter(x=>x.load.startsWith("fuel."))){
const x=init(),p=a.load.slice(5);x.cb.action(a.key,"PULL");const e=evaluate(x);
A.equal(e.overlay.fuel[p].cbOpen,true);
for(const [name,v] of Object.entries(e.overlay.fuel))if(name!==p)A.equal(v.cbOpen,false,name);
}
});
test("CB PUSH restores supply path, but not certified aircraft bus status",()=>{
const x=init(),id=pump("rightAft").key;
x.cb.action(id,"PULL");A.equal(evaluate(x).overlay.fuel.rightAft.operational,false);
x.cb.action(id,"PUSH");A.equal(evaluate(x).overlay.fuel.rightAft.operational,true);
A.equal(evaluate(x).circuits["fuel.rightAft"].electricalBus,"UNKNOWN_UNTRACED");
});
test("Center pump OFF does not illuminate center low pressure when CB pulled",()=>{
const x=init(),id=pump("centerLeft").key;x.cb.action(id,"PULL");
const f=evaluate(x).overlay.fuel.centerLeft;A.equal(f.selected,false);A.equal(f.lowPressure,false);
});
test("Center pump switch ON and pulled circuit yields center low-pressure training signal",()=>{
const x=init();x.trainer=Fuel.apply(x.trainer,{type:"CONTROL",path:"fuel.centerLeft",value:true});
x.cb.action(pump("centerLeft").key,"PULL");
const e=evaluate(x);A.equal(e.overlay.fuel.centerLeft.lowPressure,true);A.equal(e.overlay.fuel.centerLeft.operational,false);
});
test("Both left main protected circuits open yield simplified training caution",()=>{
const x=init();x.cb.action(pump("leftFwd").key,"PULL");x.cb.action(pump("leftAft").key,"PULL");
A.equal(evaluate(x).overlay.annunciations.fuelCautionTraining,true);
});
test("Opposite generator source recovers transfer bus 1 with BUS TRANS AUTO",()=>{
const x=init();x.electrical=V7.apply(x.electrical,{type:"FAULT",id:"GEN1_FAILED",active:true,instructor:true});
const e=evaluate(x);A.equal(e.overlay.bus.transfer1,true);A.equal(e.overlay.fuel.leftFwd.operational,true);
});
test("GEN1 fault + BUS TRANS OFF removes transfer1 training supply but not transfer2",()=>{
const x=init();
x.electrical=V7.apply(x.electrical,{type:"FAULT",id:"GEN1_FAILED",active:true,instructor:true});
x.electrical=V7.apply(x.electrical,{type:"CONTROL",key:"busTransferAuto",value:false});
const e=evaluate(x);A.equal(e.overlay.bus.transfer1,false);A.equal(e.overlay.fuel.leftFwd.operational,false);
A.equal(e.overlay.fuel.rightFwd.operational,true);A.equal(e.overlay.fuel.leftFwd.cbOpen,false);
});
test("VHF1, VHF2, VOR1 protected circuits isolate individually; backup remains unknown",()=>{
const x=init();
for(const [key,load] of [["P18-2|ALL|D12","com.vhf1"],["P6-1|ALL|C2","com.vhf2"],["P18-1|ALL|A1","nav.vorloc1"]]){
A(x.cb.action(key,"PULL").ok);
const e=evaluate(x);A.equal(e.circuits[load].protectionCircuit,"OPEN");A.equal(e.circuits[load].devicePower,false);
A.equal(e.overlay[load.split(".")[0]][load.split(".")[1]].operational,null);
}
});
test("CPCS/DCPCS mutually exclusive cannot change P6-3 shared CB mappings",()=>{
const x=init();x.cb.setVariant("DCPCS");x.cb.action(pump("leftFwd").key,"PULL");
A.equal(evaluate(x).overlay.fuel.leftFwd.operational,false);
A.equal(x.cb.action("P6-4|CPCS|F1","PULL").reason,"INACTIVE_VARIANT");
});
test("Synthetic instructor TRIP has same training isolation and blocks PUSH",()=>{
const x=init(),id=pump("rightFwd").key;
A(x.cb.action(id,"INJECT_TRIP","synthetic instructor fault").ok);
A.equal(evaluate(x).overlay.fuel.rightFwd.operational,false);
A.equal(x.cb.action(id,"PUSH").reason,"FAULT_ACTIVE");
A(x.cb.action(id,"CLEAR_FAULT").ok);A(x.cb.action(id,"PUSH").ok);
A.equal(evaluate(x).overlay.fuel.rightFwd.operational,true);
});
test("Invalid projection without V7 source throws",()=>{
const x=init();A.throws(()=>Effects.project({cbNetwork:x.cb,electricalV7Result:{}}),/Electrical V7/);
});

test("Hydraulic electric pump A at P6-12 C2 is on generator bus 2, not an invented transfer bus",()=>{
const x=init(),src=Effects.ALLOCATIONS.find(a=>a.load==="hyd.elecA");
A.equal(src.key,"P6-12|ALL|C2");A.equal(src.bus,"generator2");
A.equal(evaluate(x).overlay.hyd.elecA.operating,true);
});
test("Hydraulic electric pump B at P6-11 C2 is on generator bus 1",()=>{
const x=init(),src=Effects.ALLOCATIONS.find(a=>a.load==="hyd.elecB");
A.equal(src.key,"P6-11|ALL|C2");A.equal(src.bus,"generator1");
A.equal(evaluate(x).overlay.hyd.elecB.operating,true);
});
test("Pulling A electric pump CB does not remove engine-driven A hydraulic supply",()=>{
const x=init();x.cb.action("P6-12|ALL|C2","PULL");const e=evaluate(x);
A.equal(e.overlay.hyd.elecA.operating,false);A.equal(e.overlay.hyd.elecB.operating,true);
A.equal(e.overlay.systemHyd.A,true);
});
test("GEN1 bus fault kills electric B pump even if transfer1 is crossfed from GEN2",()=>{
const x=init();x.electrical=V7.apply(x.electrical,{type:"FAULT",id:"GEN1_FAILED",active:true,instructor:true});
const e=evaluate(x);A.equal(e.overlay.bus.transfer1,true);A.equal(e.overlay.bus.generator1,false);
A.equal(e.overlay.hyd.elecB.operating,false);A.equal(e.overlay.hyd.elecA.operating,true);
});
test("System B training supply goes away only when both engine-driven and electric B are unavailable",()=>{
const x=init();x.electrical=V7.apply(x.electrical,{type:"FAULT",id:"GEN1_FAILED",active:true,instructor:true});
A.equal(evaluate(x).overlay.systemHyd.B,true);
x.trainer=Fuel.apply(x.trainer,{type:"CONTROL",path:"engineHyd.B",value:false});
A.equal(evaluate(x).overlay.systemHyd.B,false);
});
test("Hydraulic CB reset restores its motor when generator bus is present",()=>{
const x=init();x.cb.action("P6-11|ALL|C2","PULL");
A.equal(evaluate(x).overlay.hyd.elecB.operating,false);
x.cb.action("P6-11|ALL|C2","PUSH");
A.equal(evaluate(x).overlay.hyd.elecB.operating,true);
});
