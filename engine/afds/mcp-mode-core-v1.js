/* MCP AFDS integration slice 1: deterministic educational state machine.
 * Not an autopilot flight dynamics model; unobserved FMS/NAV, capture, and servo
 * conditions stay UNKNOWN. No EP-FSI-specific MCP breaker/feed is asserted.
 */
(function(root,factory){
 "use strict";const api=factory();if(typeof module==="object"&&module.exports)module.exports=api;
 if(root)root.B737McpModeCoreV1=api;
})(typeof globalThis!=="undefined"?globalThis:null,function(){
"use strict";
const STATES=Object.freeze({UNVERIFIED:"UNVERIFIED",ABSENT:"ABSENT",INSTRUCTOR_OBSERVED:"INSTRUCTOR_OBSERVED",SIMULATED_DC1:"SIMULATED_DC1"});
const lateral=Object.freeze(["HDG_SEL","LNAV","VOR_LOC"]);
const vertical=Object.freeze(["LVL_CHG","ALT_HLD","VS","VNAV"]);
const thrust=Object.freeze(["N1","SPEED"]);
const buttons=Object.freeze(["VNAV","LNAV","N1","SPEED","LVL_CHG","HDG_SEL","VOR_LOC","APP","ALT_HLD","VS","CMD_A","CWS_A","CMD_B","CWS_B"]);
const rejected=(s,reason)=>({...s,lastRejection:reason,revision:s.revision+1});
const clone=v=>JSON.parse(JSON.stringify(v));
function initialState(){return {
 schema:"B737_MCP_AFDS_V1",revision:0,
 electrical:{globalPowerPossible:null,feed:STATES.UNVERIFIED,mcpPower:null,course2Power:null,electronic1:null,dc1:null,batteryBus:null,rawRevision:null},
 fd:{left:false,right:false},autoThrottleArm:false,
 values:{courseL:261,courseR:261,speed:312,heading:134,altitude:31000,verticalSpeed:0},
 modes:{lateral:null,vertical:null,thrust:null,autopilot:null},
 evidence:{fmcRouteReady:null,approachCapture:null},
 pending:{approach:false},lastRejection:null
};}
function globalPowerPossible(bus){
 if(!bus||typeof bus!=="object")return null;
 // Evaluation is a global absence proof, NOT an MCP equipment-feed assignment.
 const keys=["generator1","generator2","transfer1","transfer2","main1","main2","acStandby","groundService","dc1","dc2","battery","hotBattery","switchedHotBattery","dcStandby"];
 // No MCP AC-only assumption: all possible AC and DC classes must be absent.
 if(keys.some(x=>!Object.hasOwn(bus,x)))return null;
 if(keys.some(x=>bus[x]===true))return true;
 if(keys.every(x=>bus[x]===false))return false;
 return null;
}
/* MCP-0008. Training electrical feeds are computed only when the V7 result
 * explicitly publishes DC BUS 1 / BAT BUS; never infer power from APU RUN,
 * a switch position, or an unrelated generator. P18-1 D1 = AFDS MCP DC;
 * P6-2 B2 = AFDS MCP CRS 2 (photo-labelled candidate CB assignments).
 * Course 2 retains a separate battery-bus indication path. This is trainer
 * wiring, not EP-FSI WDM certification. */
function projectPower(s){
 const e=s.electrical,global=e.globalPowerPossible;
 const mainCb=globalThis.B737UnifiedCB?.available('mcp.power');
 const course2Cb=globalThis.B737UnifiedCB?.available('mcp.course2');
 // MRG CL IV.6 p.186: MCP (DC) is on ELECTRONIC 1 - 28VDC,
 // not generically every load on DC BUS 1. Raw DC1 is a documented V7
 // proxy only when the finer electronic-bus power has not been published.
 const main=global===false||mainCb===false||e.electronic1===false?false:
  e.electronic1===true?true:null;
 const course2=global===false||course2Cb===false||e.batteryBus===false?false:
  e.batteryBus===true?true:null;
 // Never invent a powered MCP from an instructor UI click. Only ATA24 V7
 // bus telemetry and the actual registered circuit breaker can energize it.
 const feed=main===false?STATES.ABSENT:main===true?STATES.SIMULATED_DC1:STATES.UNVERIFIED;
 return {globalPowerPossible:global,feed,mcpPower:main,course2Power:course2,
  electronic1:e.electronic1,dc1:e.dc1,batteryBus:e.batteryBus,rawRevision:e.rawRevision};
}
function clearModes(s){s.modes={lateral:null,vertical:null,thrust:null,autopilot:null};s.pending.approach=false;}
function transition(state,action){
 if(!state||state.schema!=="B737_MCP_AFDS_V1")throw Error("AFDS state required");
 if(!action||typeof action.type!=="string")throw Error("AFDS action required");
 let s=clone(state);
 const done=()=>{s.lastRejection=null;s.revision++;return s;};
 if(action.type==="RESET")return initialState();
 if(action.type==="ELECTRICAL"){
  const source=action.snapshot;
  if(!source||source.schema!=="B737_ELECTRICAL_V7_RESULT"||!source.bus)throw Error("Electrical V7 evaluated snapshot required");
  s.electrical.globalPowerPossible=globalPowerPossible(source.bus);
  s.electrical.rawRevision=source.revision;
  const trit=v=>v===true?true:v===false?false:null;
  s.electrical.dc1=trit(source.bus.dc1);
  // When electronic1 is explicitly UNKNOWN, preserve that uncertainty.
  s.electrical.electronic1=Object.hasOwn(source.bus,"electronic1")?
   trit(source.bus.electronic1):s.electrical.dc1;
  s.electrical.batteryBus=trit(source.bus.battery);
  s.electrical=projectPower(s);
  if(s.electrical.mcpPower!==true)clearModes(s);
  return done();
 }
 if(action.type==="OBSERVE_POWER"){
  // Backward-compatible rejection for old training clients; no power mutation.
  return rejected(s,"MCP_POWER_OWNED_BY_ELECTRICAL_V7");
 }
 if(action.type==="EVIDENCE"){
  if(!["fmcRouteReady","approachCapture"].includes(action.key)||![true,false,null].includes(action.value))throw Error("Unrecognized AFDS evidence");
  s.evidence[action.key]=action.value;
  if(action.key==="fmcRouteReady"&&action.value!==true){
   if(s.modes.lateral==="LNAV")s.modes.lateral=null;
   if(s.modes.vertical==="VNAV")s.modes.vertical=null;
  }
  if(action.key==="approachCapture"&&action.value!==true)s.pending.approach=false;
  return done();
 }
 if(action.type==="FD"){
  if(!["left","right"].includes(action.side)||typeof action.on!=="boolean")throw Error("Invalid FD position");
  s.fd[action.side]=action.on;
  if(!s.fd.left&&!s.fd.right){clearModes(s);}
  return done();
 }
 if(action.type==="AT_ARM"){
  if(typeof action.armed!=="boolean")throw Error("Invalid A/T switch");
  s.autoThrottleArm=action.armed;if(!action.armed)s.modes.thrust=null;return done();
 }
 if(s.electrical.mcpPower!==true)return rejected(s,"MCP_BUS_OR_CB_NOT_POWERED");
 if(action.type==="VALUE"){
  const v=action.value,id=action.id;
  const bounds={courseL:[0,359,1],courseR:[0,359,1],heading:[0,359,1],speed:[100,399,1],altitude:[0,49900,100],verticalSpeed:[-9900,9900,100]};
  const b=bounds[id];
  if(!b||!Number.isFinite(v)||Math.round(v)!==v||v<b[0]||v>b[1]||v%b[2]!==0)throw Error("MCP value out of range");
  s.values[id]=v;return done();
 }
 if(action.type!=="BUTTON"||!buttons.includes(action.id))throw Error("Unrecognized MCP mode command");
 const id=action.id;
 if(id==="APP"){
  // APP press requests approach mode; actual capture/LOC/GS signals unmodeled.
  s.pending.approach=true;
  return rejected(s,"APP_CAPTURE_INPUT_UNVERIFIED");
 }
 if(id==="LNAV"||id==="VNAV"){
  if(s.evidence.fmcRouteReady!==true)return rejected(s,"FMC_ROUTE_EVIDENCE_REQUIRED");
 }
 if(id==="VOR_LOC")return rejected(s,"VOR_LOC_CAPTURE_INPUT_UNVERIFIED");
 if(id.startsWith("CMD_")||id.startsWith("CWS_")){
  if(!s.fd.left&&!s.fd.right)return rejected(s,"FLIGHT_DIRECTOR_NOT_SELECTED");
  const selected=s.modes.autopilot;
  s.modes.autopilot=selected===id?null:id;
  // Dual-channel autoland, CWS capture and servo are not modeled.
  if(s.modes.autopilot!==null)s.pending.approach=false;
  return done();
 }
 if(!s.fd.left&&!s.fd.right)return rejected(s,"FLIGHT_DIRECTOR_NOT_SELECTED");
 if(thrust.includes(id)){
  if(!s.autoThrottleArm)return rejected(s,"AUTOTHROTTLE_NOT_ARMED");
  s.modes.thrust=s.modes.thrust===id?null:id;return done();
 }
 if(lateral.includes(id)){s.modes.lateral=s.modes.lateral===id?null:id;return done();}
 if(vertical.includes(id)){s.modes.vertical=s.modes.vertical===id?null:id;return done();}
 return rejected(s,"NOT_SUPPORTED");
}
function output(s){
 const powered=s.electrical.mcpPower===true;
 const lampIds=["AT_ARM","VNAV","LNAV","VOR_LOC","N1","SPEED","LVL_CHG","HDG_SEL","APP","ALT_HLD","VS","CMD_A","CWS_A","CMD_B","CWS_B"];
 const lamps=Object.fromEntries(lampIds.map(x=>[x,false]));
 if(powered){
  lamps.AT_ARM=s.autoThrottleArm;
  for(const x of [...lateral,...vertical,...thrust])if(lamps[x]!==undefined)lamps[x]=s.modes[x==="N1"||x==="SPEED"?"thrust":lateral.includes(x)?"lateral":"vertical"]===x;
  for(const x of ["CMD_A","CMD_B","CWS_A","CWS_B"])lamps[x]=s.modes.autopilot===x;
  // APP indication never claims a capture without evidence.
  lamps.APP=s.pending.approach&&s.evidence.approachCapture===true;
 }
 return {schema:"B737_MCP_AFDS_OUTPUT_V1",power:s.electrical.mcpPower,course2Power:s.electrical.course2Power,powerEvidence:s.electrical.feed,
  electricalRevision:s.electrical.rawRevision,feedStatus:{electronic1:s.electrical.electronic1,dc1:s.electrical.dc1,batteryBus:s.electrical.batteryBus},lamps,values:{...s.values},controls:{fd:{...s.fd},atArm:s.autoThrottleArm},
  modes:{...s.modes},pending:{...s.pending},rejection:s.lastRejection,
  limitations:["TRAINING_ONLY_NO_FLIGHT_DYNAMICS","MCP_ELEX1_28VDC_AND_COURSE2_BAT_BUS_MRG_TRAINING_MAPPING_NOT_EPFSI_WDM_VERIFIED","NO_AUTOLAND_CAPTURE","NO_IAS_MACH_CHANGEOVER_LAW"]};
}
return Object.freeze({STATES,initialState,globalPowerPossible,transition,output});
});