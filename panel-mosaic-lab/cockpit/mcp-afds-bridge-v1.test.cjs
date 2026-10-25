/* MCP-AFDS-0001 conservative integration regressions. */
const assert=require("node:assert/strict");
const fs=require("node:fs"),path=require("node:path");
const Core=require("../../engine/afds/mcp-mode-core-v1.js");
const root=__dirname;
const js=fs.readFileSync(path.join(root,"mcp-afds-bridge-v1.js"),"utf8");
const visual=fs.readFileSync(path.join(root,"mcp-visual-v3.js"),"utf8");
const hw=fs.readFileSync(path.join(root,"mcp-hardware-v1.js"),"utf8");
const unified=fs.readFileSync(path.join(root,"index.html"),"utf8");
const standalone=fs.readFileSync(path.join(root,"../mcp-panel/index.html"),"utf8");
const noPower={generator1:false,generator2:false,transfer1:false,transfer2:false,main1:false,main2:false,
 acStandby:false,groundService:false,dc1:false,dc2:false,battery:false,hotBattery:false,
 switchedHotBattery:false,dcStandby:false};
const snap=(bus,revision=1)=>({schema:"B737_ELECTRICAL_V7_RESULT",bus,revision});
const advance=(s,a)=>Core.transition(s,a);
const view=Core.output;
let s=Core.initialState();
assert.equal(s.electrical.mcpPower,null);
assert.equal(view(s).powerEvidence,"UNVERIFIED");
assert.deepEqual(Object.values(view(s).lamps).filter(Boolean),[]);
s=advance(s,{type:"FD",side:"left",on:true});
s=advance(s,{type:"AT_ARM",armed:true});
assert.equal(s.fd.left,true);
assert.equal(s.autoThrottleArm,true);
s=advance(s,{type:"BUTTON",id:"HDG_SEL"});
assert.equal(s.lastRejection,"MCP_POWER_NOT_OBSERVED");
assert.equal(s.modes.lateral,null);
s=advance(s,{type:"OBSERVE_POWER",active:true,instructor:true});
assert.equal(view(s).power,true);
s=advance(s,{type:"BUTTON",id:"HDG_SEL"});
assert.equal(view(s).lamps.HDG_SEL,true);
s=advance(s,{type:"BUTTON",id:"LNAV"});
assert.equal(s.lastRejection,"FMC_ROUTE_EVIDENCE_REQUIRED");
assert.equal(s.modes.lateral,"HDG_SEL");
s=advance(s,{type:"EVIDENCE",key:"fmcRouteReady",value:true});
s=advance(s,{type:"BUTTON",id:"LNAV"});
assert.equal(s.modes.lateral,"LNAV");
assert.equal(view(s).lamps.HDG_SEL,false);
assert.equal(view(s).lamps.LNAV,true);
s=advance(s,{type:"BUTTON",id:"VNAV"});
s=advance(s,{type:"BUTTON",id:"VS"});
assert.equal(s.modes.vertical,"VS");
assert.equal(view(s).lamps.VNAV,false);
assert.equal(view(s).lamps.VS,true);
s=advance(s,{type:"BUTTON",id:"N1"});
s=advance(s,{type:"BUTTON",id:"SPEED"});
assert.equal(s.modes.thrust,"SPEED");
assert.equal(view(s).lamps.N1,false);
assert.equal(view(s).lamps.SPEED,true);
s=advance(s,{type:"BUTTON",id:"APP"});
assert.equal(s.lastRejection,"APP_CAPTURE_INPUT_UNVERIFIED");
assert.equal(view(s).lamps.APP,false);
s=advance(s,{type:"BUTTON",id:"CMD_A"});
s=advance(s,{type:"BUTTON",id:"CMD_B"});
assert.equal(s.modes.autopilot,"CMD_B");
assert.equal(view(s).lamps.CMD_A,false);
assert.equal(view(s).lamps.CMD_B,true);
assert.equal(Core.globalPowerPossible(noPower),false);
assert.equal(Core.globalPowerPossible({...noPower,hotBattery:true}),true);
assert.equal(Core.globalPowerPossible({...noPower,acStandby:null}),null);
s=advance(s,{type:"ELECTRICAL",snapshot:snap(noPower,4)});
assert.equal(view(s).power,false);
assert.equal(s.modes.lateral,null);
assert.equal(s.modes.vertical,null);
assert.equal(s.modes.thrust,null);
assert.equal(s.modes.autopilot,null);
assert.ok(Object.values(view(s).lamps).every(x=>x===false));
s=advance(s,{type:"OBSERVE_POWER",active:true,instructor:true});
assert.equal(s.lastRejection,"GLOBAL_AC_ABSENT"); // reject observed power under proven global power loss
assert.equal(view(s).power,false);
s=advance(s,{type:"ELECTRICAL",snapshot:snap({...noPower,battery:true},5)});
assert.equal(view(s).power,true); // previous instructor-observed evidence remains explicit, not inferred from the battery
s=advance(s,{type:"OBSERVE_POWER",active:false,instructor:true});
assert.equal(view(s).power,null);
s=advance(s,{type:"EVIDENCE",key:"fmcRouteReady",value:null});
assert.equal(s.evidence.fmcRouteReady,null);
assert.throws(()=>advance(s,{type:"OBSERVE_POWER",active:true,instructor:false}),/instructor/);
s=advance(s,{type:"OBSERVE_POWER",active:true,instructor:true});
assert.throws(()=>advance(s,{type:"VALUE",id:"speed",value:500}),/out of range/);
// Source integration: real Electrical V7, not only a fabricated bus object.
const E=require("../../engine/systems/electrical-v7.js");
let real=E.initialState();
let proj=E.evaluate(real);
assert.equal(Core.globalPowerPossible(proj.bus),true);
let rState=Core.initialState();
rState=advance(rState,{type:"ELECTRICAL",snapshot:proj});
assert.equal(view(rState).power,null); // energized buses do not prove MCP feeder.
real=E.apply(real,{type:"CONTROL",key:"engine1Running",value:false});
real=E.apply(real,{type:"CONTROL",key:"engine2Running",value:false});
real=E.apply(real,{type:"CONTROL",key:"standbySelector",value:"OFF"});
real=E.apply(real,{type:"FAULT",id:"BATTERY_DEPLETED",active:true,instructor:true});
proj=E.evaluate(real);
assert.equal(Core.globalPowerPossible(proj.bus),false);
rState=advance(rState,{type:"ELECTRICAL",snapshot:proj});
assert.equal(view(rState).power,false);
assert.ok(Object.values(view(rState).lamps).every(x=>x===false));
// Unsupported intervention commands cannot remain permanently illuminated.
assert.match(js,/setState\(d.id,false\)/);

// Cold and dark is never mistaken for a known aircraft MCP feeder.
assert.match(js,/B737ISNCockpitV1/);
assert.match(js,/B737_ELECTRICAL_V7_RESULT/);
assert.match(js,/TRAINING/);
assert.match(js,/b737:mcp-hardware-change/);
assert.match(js,/b737:mcp-button-request/);
assert.match(js,/b737:mcp-value-change/);
assert.match(visual,/setPower:\(powered\)/);
assert.match(visual,/setLamps:\(states\)/);
assert.match(hw,/b737:mcp-hardware-change/);
for(const html of [unified,standalone]){
 assert.match(html,/engine\/afds\/mcp-mode-core-v1\.js\?v=MCP-AFDS-0001/);
 assert.match(html,/mcp-afds-bridge-v1\.js\?v=MCP-AFDS-0001/);
 assert.match(html,/mcp-afds-bridge-v1\.css\?v=MCP-AFDS-0001/);
}
console.log("MCP AFDS phase3 V1: electrical tri-state, mode exclusions, guards, wiring and controls PASS");
