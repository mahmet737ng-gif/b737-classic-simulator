/* B737 Classic MRG 142-161: electrical-gauge numeric QA, NOT needle rotation.
 * Source: Classic-only pages of MRG Electrical; NG rows explicitly excluded.
 * Meter selections describe a bus reading versus TR current, not identical sensor signals.
 */
(function(root,factory){const api=factory();if(typeof module==="object"&&module.exports)module.exports=api;if(root)root.B737MrgElectricalNeedleAudit=api;})(typeof globalThis!=="undefined"?globalThis:this,function(){
"use strict";
const PROVENANCE=Object.freeze({
 source:"B737 MRG (3,4,5,NG) High Quality — IV.6 Electrical, Classic (CL) passages only",
  drive:"printed pp.142-143 / PDF pp.151-152",
  electricalPanel:"printed pp.148-149 / PDF pp.157-158",
  busTransfer:"printed p.151 / PDF p.160",
  classicSchematic:"printed p.152 / PDF p.161",
  faults:"printed pp.144-147 / PDF pp.153-156",
  trFailure:"printed pp.161-162 / PDF pp.170-171",
  standby:"printed pp.159-160 / PDF pp.168-169"
});
const SELECTORS=Object.freeze(["TR1","TR2","TR3","BATTERY","AUX_BATTERY","BAT_BUS","STBY_PWR"]);
const EXPECTED=Object.freeze({
 TR1:Object.freeze({volts:[24,30],amps:[20,25],voltageRepresents:"DC_BUS_1_NOT_RAW_TR_OUTPUT",bus:"dc1",tr:"TR1"}),
 TR2:Object.freeze({volts:[24,30],amps:[20,25],voltageRepresents:"DC_BUS_2_NOT_RAW_TR_OUTPUT",bus:"dc2",tr:"TR2"}),
 TR3:Object.freeze({volts:[24,30],amps:[10,15],voltageRepresents:"RESPECTIVE_DC_BUS_SELECTION_UNCONFIRMED",bus:null,tr:"TR3"}),
 BATTERY:Object.freeze({volts:[22,30],amps:[0,0],voltageRepresents:"BATTERY",bus:"battery",tr:null}),
 AUX_BATTERY:Object.freeze({volts:[22,30],amps:[0,0],voltageRepresents:"OPTIONAL_AUX_BATTERY",bus:null,tr:null}),
 BAT_BUS:Object.freeze({volts:[24,30],amps:null,voltageRepresents:"BATTERY_BUS",bus:"battery",tr:null}),
 STBY_PWR:Object.freeze({volts:[24,30],amps:null,voltageRepresents:"STANDBY_DC_SEPARATE_FROM_AC_WARNING",bus:"dcStandby",tr:null})
});
const OIL_LIMITS=Object.freeze({classicCsdLowPressurePsi:120,classicCsdHighTempC:157,
  oilTempSource:"CSD DRIVE oil temperature, not the coolant or the 54-gauge screenshot measured angle",
  thresholdsStrict:"pressure <120psi; temperature >157degC",ngValuesExcluded:["IDG 165 PSI","IDG 182degC"]});
function finite(v){return typeof v==="number"&&Number.isFinite(v);}
function rangeResult(value,range,eligible=true){
 if(!range)return {status:"NOT_INDICATED",range:null,observed:finite(value)?value:null};
 if(!eligible)return {status:"POWER_PATH_UNRESOLVED",range,observed:finite(value)?value:null};
 if(!finite(value))return {status:"NO_OBSERVATION",range,observed:null};
 return {status:value>=range[0]&&value<=range[1]?"WITHIN_MRG_REFERENCE":"OUTSIDE_MRG_REFERENCE",range,observed:value};
}
function evaluate({selector="TR1",electrical=null,observed={},drive=null}={}){
 if(!SELECTORS.includes(selector))throw Error("Unsupported Classic meter selector");
 if(electrical&&(electrical.schema!=="B737_ELECTRICAL_V7_RESULT"||!electrical.feed||!electrical.bus))throw Error("Expected Electrical V7 evaluation");
 const exp=EXPECTED[selector];
 const feed=electrical?exp.bus===null?null:electrical.bus[exp.bus]:null;
 const trPowered=electrical&&exp.tr?electrical.feed.tr[exp.tr]:null;
 const eligibleVoltage=feed===true;
 // With source enabled but no observed sensor, NEVER synthesize a center-of-scale numeric value.
 const volts=rangeResult(observed.dcVolts,exp.volts,eligibleVoltage);
 let amps;
 if(!exp.amps)amps=rangeResult(observed.dcAmps,null,false);
 else if(exp.tr&&trPowered===false)amps=rangeResult(observed.dcAmps,[0,0],true);
 else if(exp.tr)amps=rangeResult(observed.dcAmps,exp.amps,trPowered===true);
 else amps=rangeResult(observed.dcAmps,exp.amps,feed===true);
 const driveState=drive?{
   lowOilPressure:finite(drive.oilPressurePsi)?drive.oilPressurePsi<OIL_LIMITS.classicCsdLowPressurePsi:null,
   highOilTemp:finite(drive.oilTempC)?drive.oilTempC>OIL_LIMITS.classicCsdHighTempC:null,
   rawOilTempC:finite(drive.oilTempC)?drive.oilTempC:null,
   rawOilPressurePsi:finite(drive.oilPressurePsi)?drive.oilPressurePsi:null
 }:null;
 const qa=[];
 if(exp.voltageRepresents.includes("UNCONFIRMED"))qa.push("TR3_DISPLAY_VOLTAGE_BUS_MAPPING_NOT_SOURCE_PROVEN");
 if(electrical?.bus.dc1===null||electrical?.bus.dc2===null)qa.push("DC_BUS_STATE_UNKNOWN_NEEDS_WIRING_QA");
 if(electrical?.apuAutomaticShutdownRequested===true)qa.push("CLASSIC_MRG_P148_APU_BAT_OFF_ON_GROUND_AC_GENERATOR_LOSS; APU_PHYSICAL_SHUTDOWN_ENGINE_LINK_PENDING");
 if(exp.tr&&trPowered===false&&feed===true)qa.push("TR_OPEN_BUT_DC_BUS_BACKFED: DC_VOLTS_MAY_READ_NORMAL_WITH_TR_AMPS_ZERO");
 if(selector==="STBY_PWR"&&electrical?.lamps?.standbyPowerOff===true)
   qa.push("CLASSIC_STANDBY_PWR_OFF_LAMP_PROVES_AC_STANDBY_OFF_ONLY; DC_STANDBY_MUST_BE_MEASURED");
 return {schema:"b737.mrg.electrical-needle-numeric-audit.v1",selector,source:PROVENANCE,
   selectedVoltageSource:exp.voltageRepresents,dcBusVoltageObserved:volts,
   selectedTRAmpsObserved:amps,standbyDcAmpsDisplayed:exp.amps!==null,
   upstreamBus:feed,trSourceAvailable:trPowered,
   drive:driveState,sourceLimits:OIL_LIMITS,qa,
   targetAngleDeg:null,geometryCertification:"BLOCKED_PENDING_NATIVE_OH10_OH11_OH12_TICK_AND_PIVOT_QA",
   note:"This is an observation/range audit, not an authoritative sensor simulator or an angle map."};
}
const RISK=Object.freeze([
 {id:"OH10_DC_AMPS_PIVOT",overlay:[310,168],photoCandidate:[310,192],status:"CONFLICT_OPEN"},
 {id:"OH10_CPS_PIVOT",overlay:[715,190],photoCandidate:[780,192],status:"CONFLICT_OPEN"},
 {id:"OH10_DC_VOLTS",scale:"no all-major/minor native tick signoff",status:"PIXEL_QA_PENDING"},
 {id:"OH10_AC_VOLTS",scale:"normal output 115 VAC schematic is not meter-angle certification",status:"PIXEL_QA_PENDING"},
 {id:"OH11_DRIVE_OIL_TEMP_1_2",scale:"inlet/rise and thermal CSD constraints, photo ticks unfinished",status:"PIXEL_QA_PENDING"},
 {id:"OH12_AC_AMPS_1_2_APU",scale:"no full measured current scale source",status:"PIXEL_QA_PENDING"}
]);
return Object.freeze({PROVENANCE,EXPECTED,SELECTORS,OIL_LIMITS,RISK,evaluate});
});