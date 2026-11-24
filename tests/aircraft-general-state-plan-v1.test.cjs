'use strict';
const assert=require('node:assert/strict');
const plan=require('../runtime/fast-unified/panel-mosaic-lab/cockpit/aircraft-general-state-plan-v1.js');
const opts={onGround:true,centerKg:454,headingMag:285};
for(const id of ['READY_FOR_START','READY_FOR_TAKEOFF']){
 for(const [centerKg,expected] of [[0,'OFF'],[453,'OFF'],[454,'ON']]){
  const p=plan.build(id,{...opts,centerKg});
  assert.equal(p.toggles['fuel-center-l'],expected);
  assert.equal(p.toggles['fuel-center-r'],expected);
 }
 const p=plan.build(id,opts);
 assert.equal(p.speedbrake,'DOWN');
 assert.equal(p.autobrake,'RTO');
 assert.equal(p.mcp.fdMaster,'FO');
 assert.equal(p.mcp.heading,285);
 assert.equal(p.parkingBrake,true);
}
const start=plan.build('READY_FOR_START',opts);
assert.equal(start.electrical.apuRunning,true);
assert.equal(start.engineLevers,'CUTOFF');
const t=plan.build('READY_FOR_TAKEOFF',opts);
assert.equal(t.flaps,5);assert.equal(t.mcp.iasKt,160);assert.equal(t.mcp.altitudeFt,10000);
assert.equal(t.mcp.courseL,285);assert.equal(t.mcp.courseR,285);
assert.equal(t.engineLevers,'IDLE');assert.equal(t.cpcsAirGround,'AIR');
assert.equal(t.electrical.groundConnected,false);
assert.equal(plan.build('COLD_DARK',{onGround:true}).hotBattery,true);
assert.throws(()=>plan.build('READY_FOR_START',{...opts,onGround:false}));
const vor={ident:'TRN',type:'VOR_DME',freqKhz:115300};
const ils={ident:'ITHL',type:'ILS_DME',freqKhz:109900,airport:'OIII',runway:'29L'};
const index={byIdent:i=>i==='TRN'?vor:null,STATIONS:[vor,ils]};
assert.equal(plan.resolveNav(index,'OIII','29R').ok,false);
const mem={CAPT:{},FO:{}};
const root={
 B737UnifiedVHFDualV1:{setFrequency(id,khz){mem[id.includes('capt')?'CAPT':'FO'].manualFrequencyKhz=khz;return true;}},
 B737UnifiedMechanicalFrequencyV1:{setNavAuto(seat,khz){mem[seat].autoFrequencyKhz=khz;return true;}},
 B737UnifiedVHFNavControlsV1:{setMode(seat,mode){mem[seat].mode=mode;return true;},getState(seat){const s=mem[seat];return {...s,activeFrequencyKhz:s.mode==='manual'?s.manualFrequencyKhz:s.autoFrequencyKhz};}}
};
assert.equal(plan.applyNav(root,index,'OIII','29L').ok,true);
assert.equal(mem.CAPT.manualFrequencyKhz,115300);
assert.equal(mem.FO.manualFrequencyKhz,109900);
assert.equal(mem.FO.autoFrequencyKhz,115300);
assert.equal(plan.applyNav({},index,'OIII','29L').ok,false);
console.log('Aircraft general state plan assertions passed (mock owners only)');
