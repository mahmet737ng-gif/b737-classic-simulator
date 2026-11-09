'use strict';
const assert=require('node:assert/strict'),E=require('./classic-speed-limit-ch4-v1.js');
let s=E.initialState();
const frame=(o={})=>({type:'FCC_SPEED_LIMIT',confirmed:true,source:'SIMULATED_FCC',
 actualCasKt:220,commandSource:'MCP',selectedMcpCasKt:220,selectedFmcCasKt:null,
 minimumSpeedKt:160,vmoMmoCasKt:340,gearExtended:false,gearPlacardKt:null,
 flapsPosition:0,flapPlacardKt:null,pitchMode:'VS',atAvailable:true,
 atArmed:true,atSpeedControl:true,afdsEngaged:true,afdsSpeedControl:false,
 thrustAtIdle:false,apEngaged:true,gsCaptured:false,vnavLevelSegment:false,
 vnavLevelCapture:false,climb:false,climbMaintainable:true,
 performanceInsufficient:false,speedIncreasing:true,
 nearHighLimit:false,nearMinimum:false,cwsMode:false,...o});
const go=o=>(s=E.transition(s,frame(o)),E.view(s));
assert.throws(()=>E.transition(s,{type:'FCC_SPEED_LIMIT'}),/QUALIFIED/);
assert.throws(()=>E.transition(s,frame({minimumSpeedKt:-1})),/INVALID_CH4_SPEED/);
assert.equal(go().reversion,'NONE');
assert.equal(go({selectedMcpCasKt:145}).effectiveCommandKt,160);
assert.equal(go({actualCasKt:158,selectedMcpCasKt:145}).reversion,'LVL_CHG_MINIMUM');
assert.equal(E.view(s).effectiveCommandKt,165);
assert.equal(E.view(s).speedConditionSymbol,'UNDERSPEED');
assert.equal(go({actualCasKt:168,selectedMcpCasKt:145}).speedConditionSymbol,'UNDERSPEED');
assert.equal(go({actualCasKt:175,selectedMcpCasKt:145}).speedConditionSymbol,'NONE');
assert.equal(go({actualCasKt:158,selectedMcpCasKt:145}).speedConditionSymbol,'UNDERSPEED');
assert.equal(go({actualCasKt:165,selectedMcpCasKt:175}).speedConditionSymbol,'NONE');
assert.equal(go({actualCasKt:150,selectedMcpCasKt:170,pitchMode:'ALT_HOLD'}).reversion,'NONE');
assert.equal(go({actualCasKt:150,selectedMcpCasKt:170,pitchMode:'VS',gsCaptured:true}).reversion,'NONE');
assert.equal(go({actualCasKt:150,selectedMcpCasKt:170,pitchMode:'VNAV_PTH',vnavLevelSegment:true}).reversion,'NONE');
assert.equal(go({actualCasKt:150,selectedMcpCasKt:170,pitchMode:'VNAV_PTH',vnavLevelSegment:false,vnavLevelCapture:false}).reversion,'LVL_CHG_MINIMUM');
assert.equal(go({actualCasKt:150,selectedMcpCasKt:170,pitchMode:'LVL_CHG',climb:true,climbMaintainable:false}).reversion,'AP_DISENGAGE_FD_RETRACT');
assert.equal(go({actualCasKt:210,selectedMcpCasKt:220,performanceInsufficient:true,speedIncreasing:false,pitchMode:'VS'}).reversion,'LVL_CHG_PERFORMANCE');
assert.equal(go({actualCasKt:215,selectedMcpCasKt:220,performanceInsufficient:true,speedIncreasing:false}).reversion,'NONE');
assert.equal(go({actualCasKt:215,selectedMcpCasKt:230,performanceInsufficient:true,speedIncreasing:true}).reversion,'NONE');
assert.equal(go({actualCasKt:210,selectedMcpCasKt:220,performanceInsufficient:true,speedIncreasing:false}).speedConditionSymbol,'PERFORMANCE');
assert.equal(go({actualCasKt:220,selectedMcpCasKt:225}).speedConditionSymbol,'NONE');
assert.equal(go({actualCasKt:251,selectedMcpCasKt:290,gearExtended:true,gearPlacardKt:270,flapsPosition:5,flapPlacardKt:250,
 nearHighLimit:true,atSpeedControl:false,afdsSpeedControl:false}).reversion,'AT_SPEED_PLACARD');
assert.equal(E.view(s).maximumSpeedKt,250);
assert.equal(E.view(s).maximumReason,'FLAP_PLACARD');
assert.equal(E.view(s).speedConditionSymbol,'OVERSPEED');
assert.equal(go({actualCasKt:251,selectedMcpCasKt:290,gearExtended:true,gearPlacardKt:null}).upperLimitComplete,false);
assert.equal(E.view(s).maximumSpeedKt,null);
assert.equal(go({actualCasKt:339,selectedMcpCasKt:330,nearHighLimit:true,pitchMode:'VS',atSpeedControl:true,thrustAtIdle:true}).reversion,'LVL_CHG_VMO');
assert.equal(go({actualCasKt:340,selectedMcpCasKt:330,atAvailable:false,atSpeedControl:false}).reversion,'AFDS_VMO_SPEED_CONTROL');
assert.equal(go({actualCasKt:256,selectedMcpCasKt:250,flapsPosition:5,flapPlacardKt:250,atAvailable:false,atSpeedControl:false}).reversion,'NONE');
assert.equal(go({actualCasKt:218,selectedMcpCasKt:220,source:'INSTRUCTOR_SCENARIO'}).authorized,false);
assert.equal(go({actualCasKt:215,selectedMcpCasKt:220,minimumSpeedKt:350,vmoMmoCasKt:340}).conflictingLimits,true);
assert.equal(E.view(s).effectiveCommandKt,null);
console.log('PASS FCOM 4.20.31-35 speed limits, 5/15-kt thresholds and exact reversion mode boundaries');
