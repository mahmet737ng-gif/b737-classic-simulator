/* Additional B737 Classic MRG indexed CB functional associations; source-limited.
 * No bus wiring, complete device disable, or load source is inferred.
 * Pages 134-136 are printed Classic pages, NOT NG page 137.
 */
(function(root,factory){const api=factory();if(typeof module==="object"&&module.exports)module.exports=api;if(root)root.B737ClassicMRGCBIndex=api;})(typeof globalThis!=="undefined"?globalThis:this,function(){"use strict";
const BASE_ASSOCIATIONS=Object.freeze([
  {
    "id": "P6-3|ALL|A2",
    "load": "door.warningCircuit",
    "label": "DOOR WARNING",
    "role": "CIRCUIT_ONLY",
    "printedPage": "134",
    "pdfPage": "143",
    "photoMatch": "DOOR WARN",
    "review": "CLASSIC_MRG_INDEX_AND_CATALOG_MATCH",
    "effectivity": "GENERIC_B737_CLASSIC_NOT_EP_FSI_WIRING",
    "upstreamBus": null
  },
  {
    "id": "P6-3|ALL|A7",
    "load": "fuel.groundFuelingControl",
    "label": "GROUND FUELING CONTROL",
    "role": "CONTROL_ONLY",
    "printedPage": "136",
    "pdfPage": "145",
    "photoMatch": "EP FUELING",
    "review": "CLASSIC_MRG_INDEX_AND_CATALOG_MATCH",
    "effectivity": "GENERIC_B737_CLASSIC_NOT_EP_FSI_WIRING",
    "upstreamBus": null
  },
  {
    "id": "P6-3|ALL|A17",
    "load": "brakes.autobrakeControl",
    "label": "AUTOBRAKE CONTROL",
    "role": "CONTROL_ONLY",
    "printedPage": "136",
    "pdfPage": "145",
    "photoMatch": "AUTO BRAKES CONT",
    "review": "CLASSIC_MRG_INDEX_AND_CATALOG_MATCH",
    "effectivity": "GENERIC_B737_CLASSIC_NOT_EP_FSI_WIRING",
    "upstreamBus": null
  },
  {
    "id": "P6-3|ALL|C5",
    "load": "fuel.crossfeedValveControl",
    "label": "FUEL CROSSFEED VALVE",
    "role": "CONTROL_ONLY",
    "printedPage": "136",
    "pdfPage": "145",
    "photoMatch": "CROSSFEED VALVE",
    "review": "CLASSIC_MRG_INDEX_AND_CATALOG_MATCH",
    "effectivity": "GENERIC_B737_CLASSIC_NOT_EP_FSI_WIRING",
    "upstreamBus": null
  },
  {
    "id": "P6-3|ALL|D8",
    "load": "warning.airConditioningLamp",
    "label": "MASTER CAUTION AIR COND LIGHT",
    "role": "INDICATOR_ONLY",
    "printedPage": "136",
    "pdfPage": "145",
    "photoMatch": "MASTER CAUTION AIR COND",
    "review": "CLASSIC_MRG_INDEX_AND_CATALOG_MATCH",
    "effectivity": "GENERIC_B737_CLASSIC_NOT_EP_FSI_WIRING",
    "upstreamBus": null
  },
  {
    "id": "P6-3|ALL|D9",
    "load": "warning.antiIceLamp",
    "label": "MASTER CAUTION ANTI ICE LIGHT",
    "role": "INDICATOR_ONLY",
    "printedPage": "136",
    "pdfPage": "145",
    "photoMatch": "MASTER CAUTION ANTI ICE",
    "review": "CLASSIC_MRG_INDEX_AND_CATALOG_MATCH",
    "effectivity": "GENERIC_B737_CLASSIC_NOT_EP_FSI_WIRING",
    "upstreamBus": null
  },
  {
    "id": "P6-3|ALL|D10",
    "load": "warning.fuelLamp",
    "label": "MASTER CAUTION FUEL LIGHT",
    "role": "INDICATOR_ONLY",
    "printedPage": "136",
    "pdfPage": "145",
    "photoMatch": "MASTER CAUTION FUEL",
    "review": "CLASSIC_MRG_INDEX_AND_CATALOG_MATCH",
    "effectivity": "GENERIC_B737_CLASSIC_NOT_EP_FSI_WIRING",
    "upstreamBus": null
  },
  {
    "id": "P6-4|CPCS|B1",
    "load": "air.bleedIsolationControl",
    "label": "BLEED ISOLATION CONTROL",
    "role": "CONTROL_ONLY",
    "printedPage": "134",
    "pdfPage": "143",
    "photoMatch": "BLEED AIR ISOLATION",
    "review": "CLASSIC_MRG_INDEX_AND_CATALOG_MATCH",
    "effectivity": "GENERIC_B737_CLASSIC_NOT_EP_FSI_WIRING",
    "upstreamBus": null
  },
  {
    "id": "P6-4|CPCS|B2",
    "load": "air.bleedRightControl",
    "label": "RIGHT BLEED VALVE CONTROL",
    "role": "CONTROL_ONLY",
    "printedPage": "134",
    "pdfPage": "143",
    "photoMatch": "BLEED AIR R",
    "review": "CLASSIC_MRG_INDEX_AND_CATALOG_MATCH",
    "effectivity": "GENERIC_B737_CLASSIC_NOT_EP_FSI_WIRING",
    "upstreamBus": null
  },
  {
    "id": "P6-4|CPCS|B3",
    "load": "air.bleedLeftControl",
    "label": "LEFT BLEED VALVE CONTROL",
    "role": "CONTROL_ONLY",
    "printedPage": "134",
    "pdfPage": "143",
    "photoMatch": "BLEED AIR L",
    "review": "CLASSIC_MRG_INDEX_AND_CATALOG_MATCH",
    "effectivity": "GENERIC_B737_CLASSIC_NOT_EP_FSI_WIRING",
    "upstreamBus": null
  },
  {
    "id": "P6-4|CPCS|C3",
    "load": "air.packRightValveControl",
    "label": "RIGHT PACK VALVE CONTROL",
    "role": "CONTROL_ONLY",
    "printedPage": "134",
    "pdfPage": "143",
    "photoMatch": "PACK R",
    "review": "CLASSIC_MRG_INDEX_AND_CATALOG_MATCH",
    "effectivity": "GENERIC_B737_CLASSIC_NOT_EP_FSI_WIRING",
    "upstreamBus": null
  },
  {
    "id": "P6-4|CPCS|C4",
    "load": "air.packLeftValveControl",
    "label": "LEFT PACK VALVE CONTROL",
    "role": "CONTROL_ONLY",
    "printedPage": "134",
    "pdfPage": "143",
    "photoMatch": "PACK L",
    "review": "CLASSIC_MRG_INDEX_AND_CATALOG_MATCH",
    "effectivity": "GENERIC_B737_CLASSIC_NOT_EP_FSI_WIRING",
    "upstreamBus": null
  },
  {
    "id": "P6-4|CPCS|E5",
    "load": "air.recircFanMotor",
    "label": "RECIRCULATION FAN",
    "role": "CIRCUIT_ONLY",
    "printedPage": "134",
    "pdfPage": "143",
    "photoMatch": "CABIN AIR RECIRC FAN",
    "review": "CLASSIC_MRG_INDEX_AND_CATALOG_MATCH",
    "effectivity": "GENERIC_B737_CLASSIC_NOT_EP_FSI_WIRING",
    "upstreamBus": null
  },
  {
    "id": "P6-4|CPCS|A8",
    "load": "electrical.tr1Control",
    "label": "TR 1 CONTROL/PROTECTION",
    "role": "CONTROL_ONLY",
    "printedPage": "135",
    "pdfPage": "144",
    "photoMatch": "TR UNIT NO.1",
    "review": "CLASSIC_MRG_INDEX_AND_CATALOG_MATCH",
    "effectivity": "GENERIC_B737_CLASSIC_NOT_EP_FSI_WIRING",
    "upstreamBus": null
  },
  {
    "id": "P6-4|CPCS|C8",
    "load": "electrical.tr2Control",
    "label": "TR 2 CONTROL/PROTECTION",
    "role": "CONTROL_ONLY",
    "printedPage": "135",
    "pdfPage": "144",
    "photoMatch": "TR UNIT NO.2",
    "review": "MRG_OCR_TR2_POSITION_NEEDS_VISUAL_SOURCE_CONFIRMATION",
    "effectivity": "GENERIC_B737_CLASSIC_NOT_EP_FSI_WIRING",
    "upstreamBus": null
  },
  {
    "id": "P6-4|CPCS|E8",
    "load": "electrical.tr3Control",
    "label": "TR 3 CONTROL/PROTECTION",
    "role": "CONTROL_ONLY",
    "printedPage": "135",
    "pdfPage": "144",
    "photoMatch": "TR UNIT NO.3",
    "review": "MRG_OCR_TR3_POSITION_NEEDS_VISUAL_SOURCE_CONFIRMATION",
    "effectivity": "GENERIC_B737_CLASSIC_NOT_EP_FSI_WIRING",
    "upstreamBus": null
  },
  {
    "id": "P6-5|ALL|A1",
    "load": "electrical.inverterControl",
    "label": "INVERTER CONTROL",
    "role": "CONTROL_ONLY",
    "printedPage": "135",
    "pdfPage": "144",
    "photoMatch": "INVERTER CONT",
    "review": "CLASSIC_MRG_INDEX_AND_CATALOG_MATCH",
    "effectivity": "GENERIC_B737_CLASSIC_NOT_EP_FSI_WIRING",
    "upstreamBus": null
  },
  {
    "id": "P6-5|ALL|A2",
    "load": "electrical.inverterPowerCircuit",
    "label": "INVERTER POWER",
    "role": "CIRCUIT_ONLY",
    "printedPage": "135",
    "pdfPage": "144",
    "photoMatch": "INVERTER PWR",
    "review": "CLASSIC_MRG_INDEX_AND_CATALOG_MATCH",
    "effectivity": "GENERIC_B737_CLASSIC_NOT_EP_FSI_WIRING",
    "upstreamBus": null
  },
  {
    "id": "P6-5|ALL|A3",
    "load": "electrical.batteryTransferControl",
    "label": "BATTERY TRANSFER CONTROL",
    "role": "CONTROL_ONLY",
    "printedPage": "135",
    "pdfPage": "144",
    "photoMatch": "BAT TRANS CONT",
    "review": "CLASSIC_MRG_INDEX_AND_CATALOG_MATCH",
    "effectivity": "GENERIC_B737_CLASSIC_NOT_EP_FSI_WIRING",
    "upstreamBus": null
  },
  {
    "id": "P6-5|ALL|B1",
    "load": "apu.control",
    "label": "APU CONTROL",
    "role": "CONTROL_ONLY",
    "printedPage": "135",
    "pdfPage": "144",
    "photoMatch": "APU CONT",
    "review": "CLASSIC_MRG_INDEX_AND_CATALOG_MATCH",
    "effectivity": "GENERIC_B737_CLASSIC_NOT_EP_FSI_WIRING",
    "upstreamBus": null
  },
  {
    "id": "P6-5|ALL|B2",
    "load": "electrical.batteryBusControlAuto",
    "label": "BATTERY BUS CONTROL AUTO",
    "role": "CONTROL_ONLY",
    "printedPage": "135",
    "pdfPage": "144",
    "photoMatch": "BAT BUS CONT AUTO",
    "review": "CLASSIC_MRG_INDEX_AND_CATALOG_MATCH",
    "effectivity": "GENERIC_B737_CLASSIC_NOT_EP_FSI_WIRING",
    "upstreamBus": null
  },
  {
    "id": "P6-5|ALL|B3",
    "load": "electrical.batteryBusControlManual",
    "label": "BATTERY BUS CONTROL MAN",
    "role": "CONTROL_ONLY",
    "printedPage": "135",
    "pdfPage": "144",
    "photoMatch": "BAT BUS CONT MANUAL",
    "review": "CLASSIC_MRG_INDEX_AND_CATALOG_MATCH",
    "effectivity": "GENERIC_B737_CLASSIC_NOT_EP_FSI_WIRING",
    "upstreamBus": null
  },
  {
    "id": "P6-5|ALL|C7",
    "load": "electrical.batteryBusDistribution",
    "label": "BATTERY BUS CB",
    "role": "DISTRIBUTION_UNKNOWN",
    "printedPage": "135",
    "pdfPage": "144",
    "photoMatch": "BAT BUS",
    "review": "CLASSIC_MRG_INDEX_AND_CATALOG_MATCH",
    "effectivity": "GENERIC_B737_CLASSIC_NOT_EP_FSI_WIRING",
    "upstreamBus": null
  },
  {
    "id": "P6-5|ALL|D4",
    "load": "electrical.externalPowerControl",
    "label": "EXTERNAL POWER CONTROL",
    "role": "CONTROL_ONLY",
    "printedPage": "135",
    "pdfPage": "144",
    "photoMatch": "EXT PWR CONT",
    "review": "CLASSIC_MRG_INDEX_AND_CATALOG_MATCH",
    "effectivity": "GENERIC_B737_CLASSIC_NOT_EP_FSI_WIRING",
    "upstreamBus": null
  },
  {
    "id": "P6-5|ALL|B4",
    "load": "electrical.externalPowerFuelingControl",
    "label": "EXTERNAL POWER/FUELING CONTROL",
    "role": "CONTROL_ONLY",
    "printedPage": "135",
    "pdfPage": "144",
    "photoMatch": "FUELING & EXT PWR CONT",
    "review": "CLASSIC_MRG_INDEX_AND_CATALOG_MATCH",
    "effectivity": "GENERIC_B737_CLASSIC_NOT_EP_FSI_WIRING",
    "upstreamBus": null
  },
  {
    "id": "P6-11|ALL|A2",
    "load": "electrical.genBus1Distribution",
    "label": "GENERATOR 1 BUS DISTRIBUTION",
    "role": "DISTRIBUTION_UNKNOWN",
    "printedPage": "135",
    "pdfPage": "144",
    "photoMatch": "MAIN DISTRIBUTION",
    "review": "CLASSIC_MRG_INDEX_AND_CATALOG_MATCH",
    "effectivity": "GENERIC_B737_CLASSIC_NOT_EP_FSI_WIRING",
    "upstreamBus": null
  },
  {
    "id": "P6-12|ALL|A2",
    "load": "electrical.genBus2Distribution",
    "label": "GENERATOR 2 BUS DISTRIBUTION",
    "role": "DISTRIBUTION_UNKNOWN",
    "printedPage": "135",
    "pdfPage": "144",
    "photoMatch": "MAIN DISTRIBUTION",
    "review": "CLASSIC_MRG_INDEX_AND_CATALOG_MATCH",
    "effectivity": "GENERIC_B737_CLASSIC_NOT_EP_FSI_WIRING",
    "upstreamBus": null
  },
  {
    "id": "P18-1|ALL|A6",
    "load": "nav.markerBeacon",
    "label": "MARKER BEACON",
    "role": "CIRCUIT_ONLY",
    "printedPage": "136",
    "pdfPage": "145",
    "photoMatch": "MARKER BEACON",
    "review": "CLASSIC_MRG_INDEX_AND_CATALOG_MATCH",
    "effectivity": "GENERIC_B737_CLASSIC_NOT_EP_FSI_WIRING",
    "upstreamBus": null
  },
  {
    "id": "P18-1|ALL|A7",
    "load": "warning.gpwsComputer",
    "label": "GPWS CONTROL/POWER",
    "role": "CIRCUIT_ONLY",
    "printedPage": "136",
    "pdfPage": "145",
    "photoMatch": "GND PROX WARN",
    "review": "CLASSIC_MRG_INDEX_AND_CATALOG_MATCH",
    "effectivity": "GENERIC_B737_CLASSIC_NOT_EP_FSI_WIRING",
    "upstreamBus": null
  },
  {
    "id": "P18-1|ALL|D1",
    "load": "afds.mcpDcCircuit",
    "label": "MCP DC POWER",
    "role": "CIRCUIT_ONLY",
    "printedPage": "134",
    "pdfPage": "143",
    "photoMatch": "AFDS MCP DC",
    "review": "CLASSIC_MRG_INDEX_AND_CATALOG_MATCH",
    "effectivity": "GENERIC_B737_CLASSIC_NOT_EP_FSI_WIRING",
    "upstreamBus": null
  },
  {
    "id": "P18-1|ALL|E3",
    "load": "afds.fcc1DcCircuit",
    "label": "FLIGHT CONTROL COMPUTER DC",
    "role": "CIRCUIT_ONLY",
    "printedPage": "134",
    "pdfPage": "143",
    "photoMatch": "FCC DC",
    "review": "CLASSIC_MRG_INDEX_AND_CATALOG_MATCH",
    "effectivity": "GENERIC_B737_CLASSIC_NOT_EP_FSI_WIRING",
    "upstreamBus": null
  },
  {
    "id": "P18-1|ALL|E4",
    "load": "afds.engageInterlock",
    "label": "AFDS ENGAGE INTERLOCK",
    "role": "CONTROL_ONLY",
    "printedPage": "134",
    "pdfPage": "143",
    "photoMatch": "ENGAGE INTLK A",
    "review": "CLASSIC_MRG_INDEX_AND_CATALOG_MATCH",
    "effectivity": "GENERIC_B737_CLASSIC_NOT_EP_FSI_WIRING",
    "upstreamBus": null
  },
  {
    "id": "P18-1|ALL|D5",
    "load": "flight.yawDamperAc",
    "label": "YAW DAMPER AC",
    "role": "CIRCUIT_ONLY",
    "printedPage": "135",
    "pdfPage": "144",
    "photoMatch": "YAW DAMPER AC",
    "review": "CLASSIC_MRG_INDEX_AND_CATALOG_MATCH",
    "effectivity": "GENERIC_B737_CLASSIC_NOT_EP_FSI_WIRING",
    "upstreamBus": null
  },
  {
    "id": "P18-1|ALL|D6",
    "load": "flight.yawDamperDc",
    "label": "YAW DAMPER DC",
    "role": "CIRCUIT_ONLY",
    "printedPage": "135",
    "pdfPage": "144",
    "photoMatch": "YAW DAMPER DC",
    "review": "CLASSIC_MRG_INDEX_AND_CATALOG_MATCH",
    "effectivity": "GENERIC_B737_CLASSIC_NOT_EP_FSI_WIRING",
    "upstreamBus": null
  },
  {
    "id": "P18-1|ALL|E6",
    "load": "flight.machTrimAc",
    "label": "MACH TRIM AC",
    "role": "CIRCUIT_ONLY",
    "printedPage": "135",
    "pdfPage": "144",
    "photoMatch": "MACH TRIM AC",
    "review": "CLASSIC_MRG_INDEX_AND_CATALOG_MATCH",
    "effectivity": "GENERIC_B737_CLASSIC_NOT_EP_FSI_WIRING",
    "upstreamBus": null
  },
  {
    "id": "P18-1|ALL|E7",
    "load": "flight.machTrimDc",
    "label": "MACH TRIM DC",
    "role": "CIRCUIT_ONLY",
    "printedPage": "135",
    "pdfPage": "144",
    "photoMatch": "MACH TRIM DC",
    "review": "CLASSIC_MRG_INDEX_AND_CATALOG_MATCH",
    "effectivity": "GENERIC_B737_CLASSIC_NOT_EP_FSI_WIRING",
    "upstreamBus": null
  },
  {
    "id": "P18-1|ALL|E5",
    "load": "warning.batteryLamp",
    "label": "BATTERY WARNING LIGHT",
    "role": "INDICATOR_ONLY",
    "printedPage": "135",
    "pdfPage": "144",
    "photoMatch": "WARN LIGHT BAT",
    "review": "CLASSIC_MRG_INDEX_AND_CATALOG_MATCH",
    "effectivity": "GENERIC_B737_CLASSIC_NOT_EP_FSI_WIRING",
    "upstreamBus": null
  },
  {
    "id": "P18-3|ALL|D1",
    "load": "ice.elevatorPilotHeatRight",
    "label": "ELEVATOR PILOT HEAT RIGHT",
    "role": "CIRCUIT_ONLY",
    "printedPage": "134",
    "pdfPage": "143",
    "photoMatch": "ELEVATOR PITOT R",
    "review": "CLASSIC_MRG_INDEX_AND_CATALOG_MATCH",
    "effectivity": "GENERIC_B737_CLASSIC_NOT_EP_FSI_WIRING",
    "upstreamBus": null
  },
  {
    "id": "P18-3|ALL|D2",
    "load": "ice.elevatorPilotHeatLeft",
    "label": "ELEVATOR PILOT HEAT LEFT",
    "role": "CIRCUIT_ONLY",
    "printedPage": "134",
    "pdfPage": "143",
    "photoMatch": "ELEVATOR PITOT L",
    "review": "CLASSIC_MRG_INDEX_AND_CATALOG_MATCH",
    "effectivity": "GENERIC_B737_CLASSIC_NOT_EP_FSI_WIRING",
    "upstreamBus": null
  },
  {
    "id": "P18-3|ALL|D3",
    "load": "ice.drainHeater",
    "label": "DRAIN HEATER",
    "role": "CIRCUIT_ONLY",
    "printedPage": "134",
    "pdfPage": "143",
    "photoMatch": "DRAIN HEATER",
    "review": "CLASSIC_MRG_INDEX_AND_CATALOG_MATCH",
    "effectivity": "GENERIC_B737_CLASSIC_NOT_EP_FSI_WIRING",
    "upstreamBus": null
  },
  {
    "id": "P18-3|ALL|D4",
    "load": "ice.alphaVaneRight",
    "label": "ALPHA VANE HEATER RIGHT",
    "role": "CIRCUIT_ONLY",
    "printedPage": "134",
    "pdfPage": "143",
    "photoMatch": "ALPHA VANE HTR R",
    "review": "CLASSIC_MRG_INDEX_AND_CATALOG_MATCH",
    "effectivity": "GENERIC_B737_CLASSIC_NOT_EP_FSI_WIRING",
    "upstreamBus": null
  },
  {
    "id": "P18-3|ALL|D5",
    "load": "ice.alphaVaneLeft",
    "label": "ALPHA VANE HEATER LEFT",
    "role": "CIRCUIT_ONLY",
    "printedPage": "134",
    "pdfPage": "143",
    "photoMatch": "ALPHA VANE HTR L",
    "review": "CLASSIC_MRG_INDEX_AND_CATALOG_MATCH",
    "effectivity": "GENERIC_B737_CLASSIC_NOT_EP_FSI_WIRING",
    "upstreamBus": null
  },
  {
    "id": "P18-3|ALL|C5",
    "load": "ice.temperatureProbeHeater",
    "label": "TEMPERATURE PROBE HEATER",
    "role": "CIRCUIT_ONLY",
    "printedPage": "134",
    "pdfPage": "143",
    "photoMatch": "TEMP PROBE",
    "review": "CLASSIC_MRG_INDEX_AND_CATALOG_MATCH",
    "effectivity": "GENERIC_B737_CLASSIC_NOT_EP_FSI_WIRING",
    "upstreamBus": null
  }
]);
// P6-4 has alternative CPCS/DCPCS pressure-control CBs at F1-F6 only.
// All other P6-4 CBs are the same physical circuit across variants, but state keys are variant-scoped.
const ASSOCIATIONS=Object.freeze(BASE_ASSOCIATIONS.flatMap(a => a.id.startsWith("P6-4|CPCS|") && !/\|F[1-6]$/.test(a.id)
 ? [a, Object.freeze({...a,id:a.id.replace("|CPCS|","|DCPCS|")})] : [a]));
const DISPUTES=Object.freeze([
  {
    "id": "P6-1|ALL|C2",
    "reason": "MRG_P135_HF2_AND_VHF2_DUPLICATE_LOCATION_REQUIRES_AIRFRAME_VERIFICATION",
    "status": "QUARANTINED_NO_AUTOMATIC_WIRING"
  },
  {
    "id": "P18-1|ALL|B2",
    "reason": "MRG_P136_TRANSPONDER1_B2_BUT_CATALOG_B2_TCAS_B3_ATC",
    "status": "QUARANTINED_NO_AUTOMATIC_WIRING"
  },
  {
    "id": "P18-3|ALL|A12",
    "reason": "MRG_P134_LANDING_LIGHTS_A13_TO_A16_BUT_CATALOG_A12_TO_A15",
    "status": "QUARANTINED_NO_AUTOMATIC_WIRING"
  },
  {
    "id": "P6-3|ALL|D18",
    "reason": "MRG_P136_LANDING_GEAR_AURAL_WARNING_BUT_CATALOG_PITOT_STATIC_CAPT",
    "status": "QUARANTINED_NO_AUTOMATIC_WIRING"
  }
]);
function audit(catalog){
 if(!catalog||!Array.isArray(catalog.panels))throw Error("CB catalog missing");
 const errors=[],seen=new Set(),valid=[];
 for(const a of ASSOCIATIONS){
  if(seen.has(a.id)){errors.push({id:a.id,reason:"DUPLICATE_INDEX"});continue;}seen.add(a.id);
  const parts=a.id.split("|"),p=catalog.panels.find(x=>x.id===parts[0]);
  if(!p){errors.push({id:a.id,reason:"PANEL_NOT_FOUND"});continue;}
  let lines=String(p.breakers||"");
  if(parts[0]==="P6-4"&&parts[1]==="DCPCS"&&/^F[1-6]$/.test(parts[2]))lines=String(p.altBreakers||"");
  const tokens=lines.split(";").map(t=>t.trim()).filter(Boolean);
  const entry=tokens.find(t=>t.split(":")[0]===parts[2]);
  if(!entry){errors.push({id:a.id,reason:"SLOT_NOT_FOUND"});continue;}
  const printed=entry.split("|")[1]||"";
  if(printed.toUpperCase()!==a.photoMatch.toUpperCase()){errors.push({id:a.id,reason:"PHOTO_LABEL_MISMATCH",expected:a.photoMatch,found:printed});continue;}
  if(a.review!=="CLASSIC_MRG_INDEX_AND_CATALOG_MATCH"){errors.push({id:a.id,reason:a.review});continue;}
  valid.push(a);
 }
 return {valid,errors,quarantine:DISPUTES};
}
return Object.freeze({ASSOCIATIONS,DISPUTES,audit});
});