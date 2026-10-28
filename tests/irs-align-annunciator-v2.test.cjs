'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const Core=require('../engine/systems/irs-trainer-core-v1.cjs');
const {initialState,apply,tick,status,hdgStsCountdown}=Core;
const frame={dtSec:5,stationary:true,valid:true,gsKt:0,trueTrackDeg:0,trueHeadingDeg:0};
const pos='N35395 E051254';
function start(mode='NAV',side='L',opts={}){
 let s=initialState(opts);
 s=apply(s,{type:'POWER',side,available:true});
 s=apply(s,{type:'SELECT_MODE',side,mode});
 return s;
}
function selftest(s){return tick(s,{...frame,dtSec:3.5});}
function seconds(s,amount){for(let i=0;i<amount/5;i++)s=tick(s,frame);return s;}
function setPos(s,side='L',p=pos,originPosition){
 return apply(s,{type:'FMC_SET_IRS_POS',sides:[side],position:p,originPosition});
}
function setEvidence(s,evidence,side='L'){
 return apply(s,{type:'SET_ALIGNMENT_CHECKS',side,evidence});
}
let s=start();
assert.equal(status(s,'L').alignLampMode,'OFF','Self-test ON DC is not steady ALIGN');
assert.equal(status(s,'L').onDcLamp,true);
s=selftest(s);
assert.equal(status(s,'L').alignLampMode,'STEADY');
assert.equal(status(s,'L').alignLamp,true);
assert.equal(status(s,'L').alignStatusCode,null);
assert.equal(status(s,'L').faultLamp,false);
assert.equal(hdgStsCountdown(s,'L').value,7,'Normal seven-minute countdown still works');
// MRG code 08 only once alignment has timed out without present position.
s=seconds(s,600);
assert.equal(status(s,'L').phase,'WAIT_POSITION');
assert.equal(status(s,'L').alignLampMode,'FLASHING');
assert.equal(status(s,'L').alignStatusCode,8);
assert.equal(status(s,'L').alignStatusText,'08');
assert.equal(status(s,'L').cduMessage,'ENTER IRS POS');
assert.equal(status(s,'L').faultLamp,false);
assert.equal(hdgStsCountdown(s,'L').value,'08');
assert.equal(hdgStsCountdown(s,'L').kind,'STATUS_CODE');
assert.equal(status(s,'L').alignLamp,true,'Lamp starts ON when flashing starts');
s=tick(s,{...frame,dtSec:0.5});
assert.equal(status(s,'L').alignLamp,false,'Blink OFF half-cycle reuses approved physical lamp');
s=tick(s,{...frame,dtSec:0.5});
assert.equal(status(s,'L').alignLamp,true,'Blink ON half-cycle reuses approved physical lamp');
s=setPos(s);
assert.equal(status(s,'L').phase,'NAV_READY');
assert.equal(status(s,'L').positionValid,true);
assert.equal(status(s,'L').alignLampMode,'OFF');
assert.equal(status(s,'L').alignStatusCode,null);
assert.equal(status(s,'L').cduMessage,null);
assert.equal(status(s,'L').faultLamp,false);

// Motion interrupts alignment, flashes 03 / IRS MOTION, never FAULT.
s=start();s=setPos(s);s=selftest(s);
s=tick(s,{...frame,stationary:false,gsKt:7});
assert.equal(status(s,'L').phase,'BLOCKED_MOVEMENT');
assert.equal(status(s,'L').alignLampMode,'FLASHING');
assert.equal(status(s,'L').alignStatusCode,3);
assert.equal(status(s,'L').cduMessage,'IRS MOTION');
assert.equal(hdgStsCountdown(s,'L').value,'03');
assert.equal(status(s,'L').faultLamp,false);
assert.equal(status(s,'L').positionValid,false);
s=tick(s,{...frame,stationary:false,gsKt:3});
assert.equal(status(s,'L').alignStatusCode,3,'Continuing movement cannot resume alignment');
s=tick(s,frame);
assert.equal(status(s,'L').phase,'ALIGNING','Post-1990 owner default starts new FULL alignment');
assert.equal(status(s,'L').alignLampMode,'STEADY');
assert.equal(status(s,'L').alignStatusCode,null);
assert.equal(status(s,'L').entrySource,null,'Do not silently trust old PPOS after motion');
assert.equal(status(s,'L').alignSecondsRemaining,600);
s=setPos(s);s=seconds(s,600);
assert.equal(status(s,'L').phase,'NAV_READY');

// Effectivity older than 1990 is a distinct explicit backend preset.
let old=start('NAV','L',{motionRecoveryPolicy:'REQUIRE_OFF_RESET'});
old=selftest(old);
old=tick(old,{...frame,stationary:false,gsKt:4});
assert.equal(status(old,'L').alignStatusCode,3);
old=tick(old,frame);
assert.equal(status(old,'L').phase,'BLOCKED_MOVEMENT');
assert.equal(status(old,'L').faultLamp,false);
old=apply(old,{type:'SELECT_MODE',side:'L',mode:'OFF'});
assert.equal(status(old,'L').phase,'SHUTDOWN');
old=seconds(old,30);
assert.equal(status(old,'L').phase,'OFF');
old=apply(old,{type:'SELECT_MODE',side:'L',mode:'NAV'});
assert.equal(status(old,'L').phase,'SELFTEST');
assert.equal(status(old,'L').alignStatusCode,null);

// Stored PPOS internal mismatch: first entry 12, identical second entry
// acknowledged as FCOM describes; 4NM ORIGIN advisory remains separate.
s=start();
s=setEvidence(s,{storedPositionConsistent:false,computedLatitudeConsistent:true});
s=setPos(s);
assert.equal(status(s,'L').alignStatusCode,12);
assert.equal(status(s,'L').alignLampMode,'FLASHING');
assert.equal(status(s,'L').faultLamp,false);
assert.equal(hdgStsCountdown(s,'L').value,'12');
s=setPos(s);
assert.equal(status(s,'L').alignStatusCode,null);
assert.equal(status(s,'L').entrySource,'FMC');
s=selftest(s);s=seconds(s,600);
assert.equal(status(s,'L').phase,'NAV_READY');
let origin=start();
origin=setPos(origin,'L',pos,{lat:34.0,lon:52.0});
assert.equal(status(origin,'L').warning,'VERIFY POSITION');
assert.equal(status(origin,'L').cduMessage,'VERIFY POSITION');
assert.equal(status(origin,'L').alignStatusCode,null,'CDU >4NM is NOT a code 12');
origin=selftest(origin);
assert.equal(status(origin,'L').alignLampMode,'STEADY');

// Computed latitude unreasonable: 04, twice same value causes system FAULT.
s=start();
s=setEvidence(s,{storedPositionConsistent:true,computedLatitudeConsistent:false});
s=setPos(s);
assert.equal(status(s,'L').alignStatusCode,4);
assert.equal(status(s,'L').alignStatusText,'04');
assert.equal(status(s,'L').cduMessage,'ENTER IRS POS');
assert.equal(status(s,'L').faultLamp,false);
assert.equal(hdgStsCountdown(s,'L').value,'04');
s=setPos(s);
assert.equal(status(s,'L').alignStatusCode,4);
assert.equal(status(s,'L').faultLamp,true,'Only second failed internal comparison triggers FAULT');
assert.throws(()=>setPos(s),/INTERNAL FAULT/,'Position entry alone must not clear a latched FAULT');
s=apply(s,{type:'SELECT_MODE',side:'L',mode:'OFF'});
s=seconds(s,30);
s=apply(s,{type:'SELECT_MODE',side:'L',mode:'ALIGN'});
assert.equal(status(s,'L').faultLamp,false);
assert.equal(status(s,'L').alignStatusCode,null);

// A single failed computed-latitude check can be cleared with explicitly
// corrected source evidence and a new, accepted position.
let corrected=start('ALIGN');
corrected=setEvidence(corrected,{computedLatitudeConsistent:false});
corrected=setPos(corrected);
assert.equal(status(corrected,'L').alignStatusCode,4);
corrected=setEvidence(corrected,{computedLatitudeConsistent:true});
corrected=setPos(corrected);
assert.equal(status(corrected,'L').alignStatusCode,null);
corrected=selftest(corrected);corrected=seconds(corrected,600);
assert.equal(status(corrected,'L').phase,'ALIGN_READY');
assert.equal(status(corrected,'L').alignLampMode,'STEADY',
 'After successful alignment, ALIGN selector remains lit until crew chooses NAV');
corrected=apply(corrected,{type:'SELECT_MODE',side:'L',mode:'NAV'});
assert.equal(status(corrected,'L').phase,'NAV_READY');

// Explicit independent channels: one side flashing, other normal.
let dual=initialState();
for(const side of ['L','R']){
 dual=apply(dual,{type:'POWER',side,available:true});
 dual=apply(dual,{type:'SELECT_MODE',side,mode:'NAV'});
}
dual=setEvidence(dual,{storedPositionConsistent:false},'R');
dual=setPos(dual,'L');
dual=apply(dual,{type:'FMC_SET_IRS_POS',sides:['R'],position:pos});
assert.equal(status(dual,'R').alignStatusCode,12);
assert.equal(status(dual,'L').alignStatusCode,null);
assert.equal(status(dual,'L').faultLamp,false);
dual=selftest(dual);
assert.equal(status(dual,'L').alignLampMode,'STEADY');
assert.equal(status(dual,'R').alignLampMode,'FLASHING');
assert.throws(()=>setEvidence(dual,{storedPositionConsistent:'maybe'},'L'),/true, false or null/);
assert.throws(()=>setEvidence(dual,{},'L'),/No recognized/);

// Check locked front-end is still source-pinned and no geometry assumptions
// have been introduced into this backend-only QA.
const lock=JSON.parse(fs.readFileSync(path.join(__dirname,'../panel-mosaic-lab/cockpit/irs-complete-redzone-lock-v1.json'),'utf8'));
assert.equal(Object.keys(lock.protectedBlobs).length,93);
console.log('PASS IRS ALIGN FCOM/MRG: steady/flash waveform, 03 motion, 04 unreasonable, 08 missing, 12 stored mismatch, CDU/ISDU codes, independent L/R, recovery, real FAULT latch and red-zone untouched');
