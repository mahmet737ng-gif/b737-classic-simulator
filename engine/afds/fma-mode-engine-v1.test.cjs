'use strict';
const assert=require('node:assert/strict');
const e=require('./fma-mode-engine-v1.js');
const out=(other={})=>({
 schema:'B737_MCP_AFDS_OUTPUT_V1',power:true,
 controls:{atArm:true,fd:{left:true,right:false}},
 modes:{thrust:'SPEED',vertical:'ALT_HLD',lateral:'HDG_SEL',autopilot:'CMD_A'},
 ...other
});
assert.deepEqual(e.FIELDS,['at','pitch','roll','afds']);
assert.equal(e.VERSION,'B737-FMA-ENGINE-0001');
let s=e.fromMcp(out(),'CAPT');
assert.equal(s.at.active,'MCP SPD');
assert.equal(s.pitch.active,'ALT HOLD');
assert.equal(s.roll.active,'HDG SEL');
assert.equal(s.afds.active,'CMD');
assert.equal(e.color('at','ARM'),'white');
assert.equal(e.color('pitch','G/S','armed'),'white');
assert.equal(e.color('afds','1 CH'),'yellow');
assert.equal(e.color('at','MCP SPD'),'green');
assert.equal(e.fromMcp(out({power:null}),'CAPT').afds.active,'');
assert.equal(e.fromMcp(out({power:false}),'FO').at.active,'');
assert.equal(e.fromMcp(out({modes:{thrust:null,vertical:'VNAV',lateral:'LNAV',autopilot:null}}),'CAPT').pitch.active,'',
 'VNAV switch cannot prove VNAV SPD versus VNAV PTH');
assert.equal(e.fromMcp(out({controls:{atArm:true,fd:{left:true,right:false}},
 modes:{thrust:null,vertical:null,lateral:null,autopilot:null}}),'CAPT').at.active,'ARM');
assert.equal(e.fromMcp(out({controls:{atArm:false,fd:{left:true,right:false}}}),'CAPT').at.active,'');
assert.equal(e.fromMcp(out({modes:{thrust:null,vertical:'ALT_HLD',lateral:null,autopilot:null}}),'FO').afds.active,'');
assert.equal(e.fromMcp(out({modes:{thrust:null,vertical:'ALT_HLD',lateral:null,autopilot:null}}),'CAPT').afds.active,'FD');
const evidence=(fields,extra={})=>({
 schema:'B737_FMA_FCC_OBSERVATION_V1',confirmed:true,seat:'CAPT',
 fields,evidence:{...extra}
});
assert.throws(()=>e.withFcc(s,evidence({pitch:{active:'G/S'}})),/capture/);
assert.throws(()=>e.withFcc(s,evidence({roll:{active:'VOR\/LOC'}})),/capture/);
assert.throws(()=>e.withFcc(s,evidence({pitch:{active:'VNAV PTH'}})),/FMC/);
assert.throws(()=>e.withFcc(s,evidence({pitch:{active:'ALT ACQ'}})),/acquisition/);
assert.throws(()=>e.withFcc(s,evidence({pitch:{armed:'FLARE'}})),/FLARE/);
assert.throws(()=>e.withFcc(s,evidence({pitch:{active:'FLARE'}},
 {dualAp:true,locCaptured:true,gsCaptured:true,radioAltitudeFt:60})),/FLARE capture/);
const valid=evidence({pitch:{active:'G/S',armed:'FLARE'},roll:{active:'VOR/LOC'}},
 {gsCaptured:true,navCaptured:true,locCaptured:true,dualAp:true,radioAltitudeFt:1200});
const confirmed=e.project(out(),'CAPT',valid);
assert.equal(confirmed.pitch.active,'G/S');
assert.equal(confirmed.pitch.armed,'FLARE');
assert.equal(confirmed.roll.active,'VOR/LOC');
assert.equal(confirmed.pitch.origin,e.ORIGIN.FCC);
assert.equal(e.project(out(),'FO',null).pitch.active,'ALT HOLD');
assert.throws(()=>e.project(out(),'FO',valid),/seat-specific/);
assert.throws(()=>e.withFcc(s,evidence({pitch:{active:'INVALID'}})),/Invalid FMA/);
assert.equal(e.project({schema:'WRONG'},'CAPT'),null);
console.log('PASS: FCOM annunciation vocabulary, power gating, MCP selected modes, and source-validated FCC capture/FLARE.');
