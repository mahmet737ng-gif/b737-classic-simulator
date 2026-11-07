/* MCP source-backed, fail-dark AFDS and FCOM Ch4 numeric integration. */
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const Rules=require('../../engine/afds/mcp-fcom-ch4-numeric-v1.js');
const Core=require('../../engine/afds/mcp-mode-core-v1.js');
const E=require('../../engine/systems/electrical-v7.js');
const root=__dirname,file=p=>fs.readFileSync(path.join(root,p),'utf8');
const bridge=file('mcp-afds-bridge-v1.js'),visual=file('mcp-visual-v3.js'),
 hardware=file('mcp-hardware-v1.js'),digits=file('mcp-independent-digits-v1.js');
const unified=file('index.html'),standalone=file('../mcp-panel/index.html');
const base={generator1:false,generator2:false,transfer1:false,transfer2:false,main1:false,
 main2:false,acStandby:false,groundService:false,dc1:false,dc2:false,battery:false,
 hotBattery:false,switchedHotBattery:false,dcStandby:false};
const snap=(bus,revision=1)=>({schema:'B737_ELECTRICAL_V7_RESULT',bus,revision});
const send=(state,action)=>Core.transition(state,action);
let state=Core.initialState();
assert.equal(Core.output(state).power,null);
assert.equal(Core.output(state).speedDisplayMode,'IAS');
assert.equal(state.values.speed,110);
assert.equal(state.values.altitude,10000);
assert.equal(Core.output(state).displayBlank.verticalSpeed,true);
state=send(state,{type:'FD',side:'left',on:true});
state=send(state,{type:'AT_ARM',armed:true});
state=send(state,{type:'BUTTON',id:'HDG_SEL'});
assert.equal(state.lastRejection,'MCP_BUS_OR_CB_NOT_POWERED');
state=send(state,{type:'OBSERVE_POWER',active:true,instructor:true});
assert.equal(state.lastRejection,'MCP_POWER_OWNED_BY_ELECTRICAL_V7');
assert.equal(Core.output(state).power,null,'manual controls never manufacture MCP electrical supply');
state=send(state,{type:'ELECTRICAL',snapshot:snap({...base,hotBattery:true,battery:true,electronic1:false},2)});
assert.equal(Core.output(state).power,false);
assert.equal(Core.output(state).course2Power,true,'F/O COURSE remains independently battery supplied');
state=send(state,{type:'ELECTRICAL',snapshot:snap({...base,dc1:true,electronic1:true,battery:true,hotBattery:true},3)});
assert.equal(Core.output(state).power,true);
state=send(state,{type:'BUTTON',id:'HDG_SEL'});
assert.equal(Core.output(state).lamps.HDG_SEL,true);
state=send(state,{type:'BUTTON',id:'LNAV'});
assert.equal(state.lastRejection,'FMC_ROUTE_EVIDENCE_REQUIRED');
state=send(state,{type:'EVIDENCE',key:'fmcRouteReady',value:true});
state=send(state,{type:'BUTTON',id:'LNAV'});
assert.equal(state.modes.lateral,'LNAV');
state=send(state,{type:'BUTTON',id:'VNAV'});
assert.equal(Core.output(state).displayBlank.speed,true,'FCOM 4.10.3 VNAV blanks IAS/MACH');
state=send(state,{type:'SPEED_MODE',mode:'MACH'});
assert.equal(state.lastRejection,'IAS_MACH_DISPLAY_BLANK');
state=send(state,{type:'BUTTON',id:'VS'});
assert.equal(Core.output(state).displayBlank.verticalSpeed,false);
assert.equal(Core.output(state).displayBlank.speed,false);
state=send(state,{type:'SPEED_MODE',mode:'MACH'});
assert.equal(Core.output(state).speedDisplayMode,'MACH');
state=send(state,{type:'VALUE',id:'machHundredths',value:82});
assert.equal(state.values.machHundredths,82);
assert.throws(()=>send(state,{type:'VALUE',id:'machHundredths',value:83}),/FCOM Chapter 4/);
assert.throws(()=>send(state,{type:'VALUE',id:'verticalSpeed',value:1050}),/FCOM Chapter 4/);
state=send(state,{type:'VALUE',id:'verticalSpeed',value:-7900});
assert.equal(Rules.format('verticalSpeed',state.values.verticalSpeed),'-7900');
state=send(state,{type:'BUTTON',id:'VS'});
assert.equal(Core.output(state).displayBlank.verticalSpeed,true);
state=send(state,{type:'BUTTON',id:'APP'});
assert.equal(state.lastRejection,'APP_CAPTURE_INPUT_UNVERIFIED');
state=send(state,{type:'ELECTRICAL',snapshot:snap(base,4)});
assert.equal(Core.output(state).power,false);
assert.equal(Core.output(state).course2Power,false);
assert.equal(state.modes.lateral,null);
assert.equal(state.modes.vertical,null);
assert.ok(Object.values(Core.output(state).lamps).every(v=>v===false));
assert.equal(Core.globalPowerPossible(base),false);
assert.equal(Core.globalPowerPossible({...base,hotBattery:true}),true);
assert.equal(Core.globalPowerPossible({...base,acStandby:null}),null);
const raw=E.evaluate(E.initialState());
assert.equal(Core.globalPowerPossible(raw.bus),true);
for(const [text,regex] of [[bridge,/B737ISNCockpitV1/],[bridge,/B737_ELECTRICAL_V7_RESULT/],
 [bridge,/mcp-hardware-change/],[bridge,/mcp-button-request/],[bridge,/mcp-value-change/],
 [bridge,/type:"SPEED_MODE"/],[bridge,/setSpeedMode/],[visual,/setPower:\(powered\)/],
 [visual,/setLamps:\(states\)/],[visual,/setSpeedMode/],
 [hardware,/Rules\.step\("verticalSpeed"/],[digits,/slots:5/]])assert.match(text,regex);
assert.doesNotMatch(bridge,/Confirm observed MCP power/);
for(const html of [unified,standalone]){
 assert.match(html,/mcp-fcom-ch4-numeric-v1\.js\?v=MCP-FCOM4-0001/);
 assert.match(html,/mcp-mode-core-v1\.js\?v=MCP-HIT-0001-BANK-LIMIT/);
 assert.match(html,/mcp-afds-bridge-v1\.js\?v=MCP-HIT-0001-BANK-SYNC/);
}
console.log('PASS MCP Chapter 4: power, independent COURSE2, no manual power, modes, C/O, FCOM numeric limits, blanking and glass');
