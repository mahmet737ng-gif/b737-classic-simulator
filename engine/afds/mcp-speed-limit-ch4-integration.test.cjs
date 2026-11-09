'use strict';
const assert=require('node:assert/strict');
globalThis.B737McpFCOMCh4NumericV1=require('./mcp-fcom-ch4-numeric-v1.js');
const M=require('./mcp-mode-core-v1.js');
const Limit=require('./classic-speed-limit-ch4-v1.js');
const keys=['generator1','generator2','transfer1','transfer2','main1','main2','acStandby','groundService','dc1','dc2','battery','hotBattery','switchedHotBattery','dcStandby'];
const bus=Object.fromEntries(keys.map(k=>[k,['dc1','battery','hotBattery'].includes(k)]));bus.electronic1=true;
let s=M.initialState(),out=()=>M.output(s);
const send=a=>(s=M.transition(s,a),out());
const o=(x={})=>({schema:'B737_CH4_FCC_SPEED_LIMIT_SAMPLE_V1',source:'SIMULATED_FCC',confirmed:true,
 actualCasKt:150,minimumSpeedKt:160,vmoMmoCasKt:340,gearExtended:false,
 flapsPosition:0,atAvailable:true,nearMinimum:false,nearHighLimit:false,
 vnavLevelSegment:false,vnavLevelCapture:false,...x});
assert.equal(M.output(M.initialState()).speedLimit,null);
assert.equal(send({type:'SPEED_LIMIT_FCC',sample:o()}).rejection,'MCP_BUS_OR_CB_NOT_POWERED');
send({type:'ELECTRICAL',snapshot:{schema:'B737_ELECTRICAL_V7_RESULT',revision:2,bus}});
send({type:'FD',side:'left',on:true});
send({type:'AT_ARM',armed:true});
send({type:'BUTTON',id:'VS'});
assert.equal(out().modes.vertical,'VS');
const no=send({type:'SPEED_LIMIT_FCC',sample:o({source:'INSTRUCTOR_SCENARIO'})});
assert.equal(no.rejection,'QUALIFIED_CH4_FCC_SAMPLE_REQUIRED');
assert.equal(out().modes.vertical,'VS');
let z=send({type:'SPEED_LIMIT_FCC',sample:o()});
assert.equal(z.modes.vertical,'LVL_CHG');
assert.equal(z.speedLimit.speedConditionSymbol,'UNDERSPEED');
assert.equal(z.speedLimit.effectiveCommandKt,165);
send({type:'BUTTON',id:'ALT_HLD'});
z=send({type:'SPEED_LIMIT_FCC',sample:o()});
assert.equal(z.modes.vertical,'ALT_HLD','ALT HOLD must not revert');
assert.equal(z.speedLimit.minimumReversionInhibitedBy,'ALT_HOLD');
send({type:'BUTTON',id:'VS'});
send({type:'VALUE',id:'speed',value:200});
z=send({type:'SPEED_LIMIT_FCC',sample:o({actualCasKt:190,minimumSpeedKt:160,
 performanceInsufficient:true,speedIncreasing:false})});
assert.equal(z.modes.vertical,'LVL_CHG','V/S performance more than 5 kt under selected -> LVL CHG');
assert.equal(z.speedLimit.speedConditionSymbol,'PERFORMANCE');
assert.equal(send({type:'SPEED_LIMIT_FCC',sample:o({actualCasKt:340,minimumSpeedKt:160,
 atAvailable:false,nearHighLimit:true})}).speedLimit.reversion,'AFDS_VMO_SPEED_CONTROL');
assert.equal(out().modes.vertical,'LVL_CHG','VMO fallback must not guess a pitch selector');
assert.equal(typeof Limit.view(Limit.initialState()),'object','null is an object in JS');
delete globalThis.B737McpFCOMCh4NumericV1;
console.log('PASS — live MCP AFDS FCOM Chapter 4 speed condition / mode reversion and exclusions');
