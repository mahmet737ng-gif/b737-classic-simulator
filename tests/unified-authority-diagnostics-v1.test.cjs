'use strict';
const assert=require('node:assert/strict'),test=require('node:test');
const fs=require('node:fs'),path=require('node:path');
const Diagnostics=require('../engine/runtime/unified-authority-diagnostics-v1.js');
const Electrical=require('../engine/systems/electrical-v7.js');
const Loads=require('../engine/systems/electrical-loads-v8.js');
function inputs(){
 const e=Electrical.evaluate(Electrical.initialState()),l=Loads.project(e);
 const lamps=Object.fromEntries(Object.entries(Diagnostics.ELECTRICAL_LAMPS).map(([key,id])=>[id,e.lamps[key]]));
 return {bridge:{state:{electrical:e,loads:l},lamps,coverage:{busTransferPhysicalControl:false},rejected:[]},
 ecu:{schema:'b737.isn.ecu-start-test.v1'}};
}
test('read-only live audit acknowledges missing actual BUS TRANSFER physical control',()=>{
 const a=Diagnostics.audit(inputs());
 assert.equal(a.status,'BLOCKED');assert.ok(a.findings.some(x=>x.id==='BUS_TRANSFER_NOT_PHYSICALLY_WIRED'));
 assert.ok(a.checks.includes('ELECTRICAL_V7_PROJECTED'));
});
test('annunciator mismatch is a P0, not a passing pretty light',()=>{
 const i=inputs();i.bridge.lamps.busOff1=!i.bridge.lamps.busOff1;
 const a=Diagnostics.audit(i);
 assert.ok(a.findings.some(x=>x.id==='LAMP_STATE_MISMATCH'&&x.severity==='P0'));
});
test('zero claimed success when live ECU unavailable or projection missing',()=>{
 let i=inputs();delete i.ecu;assert.ok(Diagnostics.audit(i).findings.some(x=>x.id==='ECU_NOT_OBSERVED'));
 i=inputs();delete i.bridge.state.electrical;
 assert.equal(Diagnostics.audit(i).status,'BLOCKED');
});
test('reject count is highlighted and variant hardcoding is not concealed',()=>{
 const i=inputs();i.bridge.rejected=[{reason:'source invalid'}];
 const a=Diagnostics.audit({...i,profile:'B737-300'});
 assert.ok(a.findings.some(x=>x.id==='REJECTED_COMMANDS'));
 assert.ok(a.findings.some(x=>x.id==='WARN_VARIANT_HARDCODED_400'));
});
test('cannot mutate live ECU, bridge or source from auditor',()=>{
 const i=inputs(),before=JSON.stringify(i);
 Diagnostics.audit(i);assert.equal(JSON.stringify(i),before);
});
test('real Unified wires diagnostics to existing ECU without a second electrical engine',()=>{
 const code=fs.readFileSync(path.join(__dirname,'../panel-mosaic-lab/cockpit/isn-cockpit.js'),'utf8');
 assert.match(code,/B737UnifiedAuthorityDiagnosticsV1/);
 assert.match(code,/getArchitectureAudit:\(\)=>/);
 assert.doesNotMatch(code,/new\s+window\.B737AircraftSessionV1/);
});
