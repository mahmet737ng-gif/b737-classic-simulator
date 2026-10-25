"use strict";
const {test}=require("node:test"),A=require("node:assert/strict"),fs=require("node:fs"),vm=require("node:vm"),path=require("node:path");
const CB=require("../engine/cb/cb-kernel.js"),V7=require("../engine/systems/electrical-v7.js");
const T=require("../engine/trainer/core.js"),B=require("../engine/cb/electrical-v7-integration.js");
const Index=require("../engine/cb/classic-mrg-index.v2.js");
const scope={window:{}};
vm.runInNewContext(fs.readFileSync(path.join(__dirname,"../cb-panel-lab/catalog.js"),"utf8"),scope);
const inventory=scope.window.CB_CATALOG;
const fresh=()=>({cb:new CB.BreakerNetwork(inventory),electric:V7.initialState(),trainer:T.initialState()});
const output=s=>B.project({cbNetwork:s.cb,electricalV7Result:V7.evaluate(s.electric),trainerResult:T.derive(s.trainer),trainerState:s.trainer});
test("MRG cross-index has 48 photo-and-position matched candidates, four OCR quarantines",()=>{
const a=Index.audit(inventory);
A.equal(Index.ASSOCIATIONS.length,52);
A.equal(a.valid.length,48);
A.equal(a.errors.length,4);
A.equal(a.quarantine.length,4);
A(a.errors.every(e=>e.id.includes("|C8")||e.id.includes("|E8")));
});
test("Published active source associations count is 51 for either pressure controller configuration",()=>{
const s=fresh();
A.equal(B.ALLOCATIONS.length,58);
A.equal(output(s).linkedEquipment,51);
s.cb.setVariant("DCPCS");
A.equal(output(s).linkedEquipment,51);
});
test("Repeated P6-4 physical CB has independent CPCS/DCPCS logical state",()=>{
const s=fresh();s.cb.action("P6-4|CPCS|B1","PULL");
A.equal(output(s).circuits["air.bleedIsolationControl"].protectionCircuit,"OPEN");
s.cb.setVariant("DCPCS");
A.equal(output(s).circuits["air.bleedIsolationControl"].protectionCircuit,"CLOSED");
s.cb.action("P6-4|DCPCS|B1","PULL");
A.equal(output(s).circuits["air.bleedIsolationControl"].protectionCircuit,"OPEN");
});
test("HF2/VHF2, transponder, landing light and aural warning ambiguities cannot drive system faults",()=>{
const s=fresh();
for(const id of ["P6-1|ALL|C2","P18-1|ALL|B2","P18-3|ALL|A12","P6-3|ALL|D18"]){
A(B.QUARANTINED.some(x=>x.id===id));
A(s.cb.action(id,"PULL").ok);
}
const p=output(s);A.equal(p.circuits["com.vhf2"],undefined);
A.equal(p.overlay.bus.generator1,true);A.equal(p.overlay.bus.generator2,true);
});
test("Pulling the fuel master caution lamp leaves cause true but visual lamp false",()=>{
const s=fresh();s.cb.action("P6-3|ALL|B7","PULL");s.cb.action("P6-3|ALL|C7","PULL");
A.equal(output(s).overlay.annunciations.fuelCautionTraining,true);
A.equal(output(s).overlay.annunciations.fuelLampTraining,true);
s.cb.action("P6-3|ALL|D10","PULL");
A.equal(output(s).overlay.annunciations.fuelCautionTraining,true);
A.equal(output(s).overlay.annunciations.fuelLampTraining,false);
s.cb.action("P6-3|ALL|D10","PUSH");
A.equal(output(s).overlay.annunciations.fuelLampTraining,true);
});
test("APU/GEN/TR panel control CB opens do not remove bus feeds without WDM proof",()=>{
const s=fresh(),before=V7.evaluate(s.electric).bus;
for(const id of ["P6-5|ALL|B1","P6-5|ALL|A2","P6-4|CPCS|A8","P6-11|ALL|A2"])
 A(s.cb.action(id,"PULL").ok);
const r=output(s);A.deepEqual(r.overlay.bus,before);
A.equal(r.circuits["apu.control"].protectedCircuitPower,false);
A.equal(r.circuits["apu.control"].devicePower,null);
A.equal(r.circuits["electrical.tr1Control"].devicePower,null);
});
test("A pulled protected circuit does not automatically prove whole equipment loses power",()=>{
for(const variant of ["CPCS","DCPCS"]){
const s=fresh();s.cb.setVariant(variant);
const refs=B.protectedCircuits(s.cb,V7.evaluate(s.electric));A.equal(refs.length,51);
for(const cb of refs){
 A(s.cb.action(cb.key,"PULL").ok,cb.key);
 const a=B.protectedCircuits(s.cb,V7.evaluate(s.electric)).find(t=>t.key===cb.key);
 A.equal(a.protectedCircuitPower,false,cb.key);
 A.equal(a.devicePower,null,cb.key);
 A(s.cb.action(cb.key,"PUSH").ok,cb.key);
}
}
});
test("Index rejects accidental photo-label drift rather than routing a different device",()=>{
const s=fresh(),original=s.cb.state.bind(s.cb);
s.cb.state=(id)=>id==="P18-1|ALL|A7"?{...original(id),label:"WRONG LABEL"}:original(id);
const r=output(s);
A.equal(r.circuits["warning.gpwsComputer"],undefined);
A.equal(r.circuits["nav.vorloc1"].protectionCircuit,"CLOSED");
});
test("CPCS/DCPCS switching does not alter true electrical V7 state",()=>{
const s=fresh(),reference=V7.evaluate(s.electric);
s.cb.action("P6-4|CPCS|B1","PULL");s.cb.setVariant("DCPCS");
A.deepEqual(output(s).overlay.bus,reference.bus);
A.deepEqual(output(s).overlay.rectifiers,reference.feed.tr);
});
