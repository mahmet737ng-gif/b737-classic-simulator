/* MCP AFDS integration slice 1: deterministic educational state machine.
 * Not an autopilot flight dynamics model; unobserved FMS/NAV, capture, and servo
 * conditions stay UNKNOWN. No EP-FSI-specific MCP breaker/feed is asserted.
 */
(function(root,factory){
 "use strict";const api=factory();if(typeof module==="object"&&module.exports)module.exports=api;
 if(root)root.B737McpModeCoreV1=api;
})(typeof globalThis!=="undefined"?globalThis:null,function(){
"use strict";
const Rules=typeof globalThis!=="undefined"?globalThis.B737McpFCOMCh4NumericV1:null;
const STATES=Object.freeze({UNVERIFIED:"UNVERIFIED",ABSENT:"ABSENT",INSTRUCTOR_OBSERVED:"INSTRUCTOR_OBSERVED",SIMULATED_DC1:"SIMULATED_DC1"});
const lateral=Object.freeze(["HDG_SEL","LNAV","VOR_LOC"]);
const vertical=Object.freeze(["LVL_CHG","ALT_HLD","VS","VNAV"]);
const thrust=Object.freeze(["N1","SPEED"]);
// FCOM 4.10.4–4.10.11: one active command per A/T, pitch, roll, and
// AFDS channel. New selections replace the previous mode atomically.
// SPEED is A/T; LVL CHG is pitch MCP SPD, NOT another A/T SPEED command.
const MODE_OWNERS=Object.freeze({
 thrust, pitch:vertical, roll:lateral,
 afds:Object.freeze(["CMD_A","CWS_A","CMD_B","CWS_B"])
});
const autoSpeedPitch=mode=>mode==="ALT_HLD"||mode==="VS";
const buttons=Object.freeze(["VNAV","LNAV","N1","SPEED","LVL_CHG","HDG_SEL","VOR_LOC","APP","ALT_HLD","VS","CMD_A","CWS_A","CMD_B","CWS_B"]);
const rejected=(s,reason)=>({...s,lastRejection:reason,revision:s.revision+1});
const clone=v=>JSON.parse(JSON.stringify(v));
function initialState(){return {
 schema:"B737_MCP_AFDS_V1",revision:0,
 electrical:{globalPowerPossible:null,feed:STATES.UNVERIFIED,mcpPower:null,course2Power:null,electronic1:null,dc1:null,batteryBus:null,rawRevision:null},
 fd:{left:false,right:false},autoThrottleArm:false,
 values:{courseL:261,courseR:261,speed:110,machHundredths:60,heading:134,altitude:10000,verticalSpeed:0},
  speedDisplayMode:"IAS",bankAngleLimit:20,
 modes:{lateral:null,vertical:null,thrust:null,autopilot:null},
 evidence:{fmcRouteReady:null,approachCapture:null},
 autoThrustByPitch:false,
 pending:{approach:false},armed:{pitch:null,roll:null},
 capture:{pitch:null,roll:null},override:{pitch:false,roll:false,altHold:false},
 nav:{loc:false,gs:false},flight:null,targets:{pitch:null,roll:null},
 lastRejection:null
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
function clearModes(s){
 s.modes={lateral:null,vertical:null,thrust:null,autopilot:null};
 s.pending.approach=false;
 s.armed={pitch:null,roll:null};s.capture={pitch:null,roll:null};
 s.override={pitch:false,roll:false,altHold:false};s.nav={loc:false,gs:false};
 s.targets={pitch:null,roll:null};s.flight=null;
 s.autoThrustByPitch=false;
}
function selectPitch(s,id){
 const previous=s.modes.vertical;
 const next=previous===id?null:id;
 s.modes.vertical=next;
 s.capture.pitch=null;s.override.pitch=false;s.override.altHold=false;
 s.targets.pitch=null;if(!s.pending.approach)s.armed.pitch=null;
 // Transition from a pitch-owned auto A/T SPEED mode: the new pitch mode
 // replaces the old one, with exactly one illuminated pitch selector.
 if(s.autoThrustByPitch){
  s.modes.thrust=null;
  s.autoThrustByPitch=false;
 }
 if(next==="LVL_CHG"){
  // FCOM 4.10.9: if A/T SPEED was active, retain the selected IAS/MACH
  // as the pitch TARGET, not as a competing A/T MCP SPD annunciation.
  // Without measured climb/descent, do NOT invent N1/RETARD capture.
  s.modes.thrust=null;
 }else if(next==="VNAV"){
  // A generic VNAV selection cannot prove N1/RETARD/FMC SPD.
  s.modes.thrust=null;
 }else if(autoSpeedPitch(next)&&s.autoThrottleArm){
  // FCOM 4.10.5/4.10.11: V/S and ALT HOLD engage A/T SPEED.
  s.modes.thrust="SPEED";
  s.autoThrustByPitch=true;
 }
}
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
 if(action.type==="FLIGHT_OBSERVATION"){
  // Qualified simulated FCC/flight-model telemetry; never invent yoke force
  // thresholds, radio-course intercepts, or ALT ACQ distance.
  const f=action.sample;
  if(!f||f.schema!=="B737_AFDS_FLIGHT_OBSERVATION_V1"||
   f.confirmed!==true||f.source!=="SIMULATED_FCC")
   return rejected(s,"QUALIFIED_FLIGHT_SAMPLE_REQUIRED");
  if(s.electrical.mcpPower!==true)return rejected(s,"MCP_BUS_OR_CB_NOT_POWERED");
  for(const k of ["bankDeg","headingDeg","pitchDeg","altitudeFt",
   "radioAltitudeFt","tasKt","gsBelowDots","verticalSpeedFpm"])
   if(f[k]!==undefined&&!Number.isFinite(f[k]))
    return rejected(s,"INVALID_FLIGHT_SENSOR_"+k);
  if(f.navKind!==undefined&&!["NONE","VOR","LOC","ILS"].includes(f.navKind))
   return rejected(s,"INVALID_NAV_SIGNAL_TYPE");
  const flags=["navValid","gearDown","fdVorCaptured","fdLocCaptured",
   "pitchOverrideConfirmed","rollOverrideConfirmed","pitchForceReleased",
   "rollForceReleased","altAcquireConfirmed","altitudeHoldConfirmed",
   "navCaptureConfirmed","gsCaptureConfirmed","dualAutopilot"];
  if(flags.some(k=>f[k]!==undefined&&typeof f[k]!=="boolean"))
   return rejected(s,"INVALID_FLIGHT_SENSOR_FLAG");
  s.flight={...(s.flight||{}),...f};
  const cmd=/^CMD_[AB]$/.test(s.modes.autopilot||"");
  if(cmd&&f.dualAutopilot===true&&s.nav.loc&&s.nav.gs&&
   (f.pitchOverrideConfirmed||f.rollOverrideConfirmed)){
   // FCOM 4.10.16: override after dual-channel LOC + GS capture
   // disengages the A/P, not a CWS axis.
   s.modes.autopilot=null;s.override.pitch=false;s.override.roll=false;
   s.targets.pitch=null;s.targets.roll=null;return done();
  }
  if(cmd&&f.pitchOverrideConfirmed===true){
   if(!s.override.pitch)s.override.altHold=
    s.modes.vertical==="ALT_HLD"||s.capture.pitch==="ALT_HOLD";
   s.override.pitch=true;s.capture.pitch=null;s.targets.pitch=null;
  }
  if(cmd&&f.rollOverrideConfirmed===true){
   s.override.roll=true;s.capture.roll=null;s.targets.roll=null;
  }
  if(cmd&&f.pitchForceReleased===true&&s.override.pitch&&
   s.override.altHold&&Number.isFinite(f.altitudeFt)&&
   Math.abs(f.altitudeFt-s.values.altitude)<=250){
   s.override.pitch=false;s.override.altHold=false;
   s.capture.pitch="ALT_ACQ";s.targets.pitch=null;
  }
  if(cmd&&f.altAcquireConfirmed===true&&
   axisControl(s,true).pitch==="CWS"&&!s.nav.gs){
   s.capture.pitch="ALT_ACQ";s.override.pitch=false;
   s.override.altHold=false;s.targets.pitch=null;
  }
  if(cmd&&f.altitudeHoldConfirmed===true&&s.capture.pitch==="ALT_ACQ"){
   s.capture.pitch="ALT_HOLD";s.modes.vertical="ALT_HLD";
   s.override.pitch=false;s.targets.pitch=null;s.armed.pitch=null;
  }
  if(cmd&&s.armed.roll==="VOR/LOC"&&f.navCaptureConfirmed===true&&
   s.flight.navValid===true&&["VOR","LOC","ILS"].includes(s.flight.navKind)){
   s.capture.roll="VOR_LOC";s.modes.lateral="VOR_LOC";s.armed.roll=null;
   s.override.roll=false;s.targets.roll=null;
   if(["LOC","ILS"].includes(s.flight.navKind))s.nav.loc=true;
  }
  if(cmd&&s.pending.approach&&s.nav.loc&&s.armed.pitch==="G/S"&&
   f.gsCaptureConfirmed===true&&Number.isFinite(f.gsBelowDots)&&
   f.gsBelowDots>=0&&f.gsBelowDots<=0.4){
   s.capture.pitch="G/S";s.modes.vertical=null;s.nav.gs=true;
   s.armed.pitch=null;s.override.pitch=false;s.targets.pitch=null;
  }
  if(axisControl(s,true).roll==="CWS"&&f.rollForceReleased===true&&
   Number.isFinite(f.bankDeg)&&Number.isFinite(f.headingDeg)){
   const inhibited=(Number.isFinite(f.radioAltitudeFt)&&
      f.radioAltitudeFt<1500&&f.gearDown===true)||
     (f.fdVorCaptured===true&&Number.isFinite(f.tasKt)&&f.tasKt<=250)||
     (f.fdLocCaptured===true&&s.pending.approach);
   s.targets.roll=Math.abs(f.bankDeg)<=6&&!inhibited?
    {type:"WINGS_LEVEL_HEADING_HOLD",bankDeg:0,headingDeg:f.headingDeg}:
    {type:"BANK_ATTITUDE_HOLD",bankDeg:f.bankDeg};
  }
  if(axisControl(s,true).pitch==="CWS"&&f.pitchForceReleased===true&&
   Number.isFinite(f.pitchDeg))
   s.targets.pitch={type:"PITCH_ATTITUDE_HOLD",pitchDeg:f.pitchDeg};
  return done();
 }
 if(action.type==="FD"){
  if(!["left","right"].includes(action.side)||typeof action.on!=="boolean")throw Error("Invalid FD position");
  s.fd[action.side]=action.on;
  if(!s.fd.left&&!s.fd.right){clearModes(s);}
  return done();
 }
 if(action.type==="BANK_ANGLE"){
  // FCOM Ch4, 4.10.15: outer bank angle selector detents 10/15/20/25/30.
  // Mechanical preselection can move with electrical power OFF.
  if(!Number.isInteger(action.value)||![10,15,20,25,30].includes(action.value))
   throw Error("FCOM Chapter 4 bank angle selector detent must be 10/15/20/25/30");
  s.bankAngleLimit=action.value;return done();
 }
 if(action.type==="AT_ARM"){
  if(typeof action.armed!=="boolean")throw Error("Invalid A/T switch");
  s.autoThrottleArm=action.armed;
  if(!action.armed){s.modes.thrust=null;s.autoThrustByPitch=false;}
  else if(autoSpeedPitch(s.modes.vertical)){
   s.modes.thrust="SPEED";s.autoThrustByPitch=true;
  }
  return done();
 }
 if(s.electrical.mcpPower!==true)return rejected(s,"MCP_BUS_OR_CB_NOT_POWERED");
 if(action.type==="SPEED_MODE"){
  if(!["IAS","MACH"].includes(action.mode))throw Error("Unknown IAS/MACH display mode");
  if(s.modes.vertical==="VNAV")return rejected(s,"IAS_MACH_DISPLAY_BLANK");
  s.speedDisplayMode=action.mode;return done();
 }
 if(action.type==="VALUE"){
  const id=action.id,v=action.value;
  if(!Rules?.valid||!Rules.valid(id,v))throw Error("MCP value out of FCOM Chapter 4 range or increment");
  const old=s.values[id];s.values[id]=v;
  if(id==="altitude"&&s.capture.pitch==="ALT_ACQ"&&Math.abs(v-old)>100){
   s.capture.pitch=null;s.modes.vertical="VS";s.override.pitch=false;
   if(Number.isFinite(s.flight?.verticalSpeedFpm))
    s.values.verticalSpeed=Math.max(-7900,Math.min(6000,
     Math.round(s.flight.verticalSpeedFpm/50)*50));
  }else if(id==="altitude"&&s.modes.vertical==="ALT_HLD"&&
   Math.abs(v-old)>100&&s.capture.pitch!=="ALT_ACQ")s.armed.pitch="V/S";
  return done();
 }
 if(action.type!=="BUTTON"||!buttons.includes(action.id))throw Error("Unrecognized MCP mode command");
 const id=action.id;
 if(id==="APP"){
  if(s.flight?.navKind!=="ILS"||s.flight.navValid!==true)
   return rejected(s,"APP_ILS_NAV_EVIDENCE_REQUIRED");
  s.pending.approach=!s.pending.approach;
  s.armed.roll=s.pending.approach?"VOR/LOC":null;
  s.armed.pitch=s.pending.approach?"G/S":null;
  if(!s.pending.approach){s.nav.loc=false;s.nav.gs=false;}
  return done();
 }
 if(id==="LNAV"||id==="VNAV"){
  if(s.evidence.fmcRouteReady!==true)return rejected(s,"FMC_ROUTE_EVIDENCE_REQUIRED");
 }
 if(id==="VOR_LOC"){
  if(s.flight?.navValid!==true||!["VOR","LOC","ILS"].includes(s.flight.navKind))
   return rejected(s,"VOR_LOC_NAV_EVIDENCE_REQUIRED");
  s.armed.roll=s.armed.roll==="VOR/LOC"?null:"VOR/LOC";
  s.pending.approach=false;s.armed.pitch=null;s.nav.loc=false;s.nav.gs=false;
  return done();
 }
 if(id.startsWith("CMD_")||id.startsWith("CWS_")){
  if(!s.fd.left&&!s.fd.right)return rejected(s,"FLIGHT_DIRECTOR_NOT_SELECTED");
  const selected=s.modes.autopilot;
  s.modes.autopilot=selected===id?null:id;
  s.override={pitch:false,roll:false,altHold:false};
  s.targets={pitch:null,roll:null};
  // Dual-channel autoland, CWS capture and servo are not modeled.
  // CMD engagement does not deselect an already armed approach.
  return done();
 }
 if(!s.fd.left&&!s.fd.right)return rejected(s,"FLIGHT_DIRECTOR_NOT_SELECTED");
 if(thrust.includes(id)){
  if(!s.autoThrottleArm)return rejected(s,"AUTOTHROTTLE_NOT_ARMED");
  // A/T SPEED is incompatible with LVL CHG's pitch-owned speed
  // hold, and N1 is incompatible with V/S/ALT HOLD A/T speed hold.
  if(id==="SPEED"&&s.modes.vertical==="LVL_CHG")
   return rejected(s,"AT_SPEED_INCOMPATIBLE_WITH_LVL_CHG");
  if(id==="N1"&&autoSpeedPitch(s.modes.vertical))
   return rejected(s,"AT_N1_INCOMPATIBLE_WITH_PITCH_SPEED_HOLD");
  const was=s.modes.thrust;
  s.modes.thrust=was===id?null:id;
  s.autoThrustByPitch=false;
  return done();
 }
 if(lateral.includes(id)){
  // A new lateral selector replaces the former one, without requiring
  // a separate disengage click and without a second active roll lamp.
  s.modes.lateral=s.modes.lateral===id?null:id;
  s.capture.roll=null;s.override.roll=false;s.targets.roll=null;
  if(!s.pending.approach)s.armed.roll=null;
  return done();
 }
 if(vertical.includes(id)){selectPitch(s,id);return done();}
 return rejected(s,"NOT_SUPPORTED");
}
// Training-state autopilot axis engagement, sourced from the selected
// pitch/roll CMD modes. FCOM 4.10.18 and 4.20.9–10: the CMD autopilot
// falls back to CWS on either axis when that axis has no selected mode.
// This does not simulate yoke forces, aerodynamic servos or ALT/LOC capture.
function axisControl(s,powered){
 const ap=powered&&typeof s.modes.autopilot==="string"?s.modes.autopilot:"";
 const engaged=/^(?:CMD|CWS)_[AB]$/.test(ap);
 if(!engaged)return {pitch:"OFF",roll:"OFF"};
 const manual=ap.startsWith("CWS_");
 return {pitch:manual||s.override.pitch||
   (!s.capture.pitch&&s.modes.vertical===null)?"CWS":"CMD",
  roll:manual||s.override.roll||
   (!s.capture.roll&&s.modes.lateral===null)?"CWS":"CMD"};
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
  electricalRevision:s.electrical.rawRevision,feedStatus:{electronic1:s.electrical.electronic1,dc1:s.electrical.dc1,batteryBus:s.electrical.batteryBus},lamps,values:{...s.values},
   speedDisplayMode:s.speedDisplayMode,bankAngleLimit:s.bankAngleLimit,displayBlank:{speed:s.modes.vertical==="VNAV",verticalSpeed:s.modes.vertical!=="VS"},
   controls:{fd:{...s.fd},atArm:s.autoThrottleArm},
  modes:{...s.modes},axisControl:axisControl(s,powered),
  armed:{...s.armed},capture:{...s.capture},nav:{...s.nav},
  flight:s.flight?{...s.flight}:null,
  axisDemand:{pitch:s.targets.pitch,roll:s.targets.roll},
  pending:{...s.pending},rejection:s.lastRejection,
  limitations:["TRAINING_ONLY_NO_FLIGHT_DYNAMICS","MCP_ELEX1_28VDC_AND_COURSE2_BAT_BUS_MRG_TRAINING_MAPPING_NOT_EPFSI_WDM_VERIFIED","NO_AUTOLAND_SERVO_DYNAMICS","AUTO_IAS_MACH_CROSSOVER_AT_FL260_REQUIRES_VALID_FLIGHT_ALTITUDE"]};
}
return Object.freeze({STATES,MODE_OWNERS,autoSpeedPitch,axisControl,initialState,globalPowerPossible,transition,output});
});