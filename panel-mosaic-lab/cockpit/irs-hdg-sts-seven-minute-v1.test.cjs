'use strict';
const assert=require('node:assert/strict');
const path=require('node:path');
const fs=require('node:fs');
const {ALIGNMENT_DISPLAY_CAP_MINUTES,cappedAlignmentMinutes,getHDGStatusAlignmentTime:format}=require('../../engine/contracts/irs-hdg-sts-seven-minute-v1.cjs');
assert.equal(ALIGNMENT_DISPLAY_CAP_MINUTES,7);
const pairs=[
[17*60,7],[12*60,7],[10*60,7],[9*60,7],[8*60,7],
[7*60,7],[6*60+59,7],[6*60+1,7],
[6*60,6],[5*60+59,6],[5*60,5],
[4*60,4],[3*60,3],[2*60,2],[60,1],[59,1],[.01,1],
[0,null],[-1,null],[NaN,null],[Infinity,null],[undefined,null]
];
for(const [sec,want] of pairs)assert.equal(cappedAlignmentMinutes(sec),want,'7-minute clamp at '+String(sec));
function sample(o={}){
 return {displayMode:'HDG/STS',selectedIRS:'L',irsStates:{
    L:{phase:'ALIGNING',powerAvailable:true,remainingTimeValid:true,secondsRemaining:600},
    R:{phase:'ALIGNING',powerAvailable:true,remainingTimeValid:true,secondsRemaining:180}
 },...o};
}
let result=format(sample());
assert.deepEqual(result,{visible:true,value:7,text:'7',source:'L'},'10 minutes remaining MUST show 7');
result=format(sample({selectedIRS:'R'}));
assert.deepEqual(result,{visible:true,value:3,text:'3',source:'R'},'Selection must preserve separate L/R countdown');
result=format(sample({irsStates:{L:{phase:'HIGH_LAT_ALIGNING',powerAvailable:true,remainingTimeValid:true,secondsRemaining:17*60}}}));
assert.equal(result.value,7,'17 minute high-latitude align must hold at 7');
for(const displayMode of ['PPOS','WIND','TK/GS','TEST',null])assert.equal(format(sample({displayMode})).visible,false);
for(const phase of ['OFF','SHUTDOWN','ATT','NAV_READY','ALIGNED','FAST_REALIGN','BLOCKED','FAULT'])assert.equal(
 format(sample({irsStates:{L:{phase,powerAvailable:true,remainingTimeValid:true,secondsRemaining:500}}})).visible,false,
 'No countdown outside active normal / high-lat alignment: '+phase);
for(const replacement of [
 {powerAvailable:false},
 {remainingTimeValid:false},
 {alignmentBlocked:true},
 {fastRealign:true},
 {fault:true},
 {secondsRemaining:0},
 {secondsRemaining:-100},
 {secondsRemaining:NaN},
 {secondsRemaining:Infinity}
]){
 assert.equal(format(sample({irsStates:{L:{phase:'ALIGNING',powerAvailable:true,remainingTimeValid:true,secondsRemaining:650,...replacement}}})).visible,false);
}
assert.equal(format(sample({keyboardOverride:true})).visible,false);
assert.equal(format(sample({displayTestActive:true})).visible,false);
assert.equal(format(sample({selectedIRS:'invalid'})).visible,false);
assert.equal(format({displayMode:'HDG/STS',selectedIRS:'L',irsStates:{}}).visible,false);
assert.equal(format(undefined).visible,false);
const contract=JSON.parse(fs.readFileSync(path.join(__dirname,'../../engine/contracts/irs-isdu-fcom-modes-v1.json'),'utf8'));
const align=contract.modes['HDG/STS'].duringAlignment;
assert.match(align.remainingMinutes,/display 10 until time remaining is 9 minutes/,'Preserve actual cited FCOM text, do not falsify it');
assert.equal(align.simulatorOwnerOverride.displayCapMinutes,7,'Simulator MUST use owner-specified 7');
assert.equal(align.simulatorOwnerOverride.displayFloorMinutes,1);
assert.equal(contract.futureIntegration.ownerAlignmentCountdownContract,'engine/contracts/irs-hdg-sts-seven-minute-v1.cjs');
console.log('PASS owner IRS 7-minute HDG/STS ceiling: >7/9/10/17 show 7; exactly 6:00 shows 6; 6,5,4,3,2,1; hidden without valid selected alignment; FCOM divergence documented');
