'use strict';
/** Hydraulic and fuel pressure network v0.2.
 * References: Sepehran 737CL FCOM 13.10.2 PDF1843 (nominal 3000 psi,
 * red max 3500 psi); 13.20.2-3 PDF1847-48; 12.20.1 PDF1834,
 * 12.20.2 PDF1835. Does not fabricate transient rates, pump flow,
 * absolute fuel psi or actual gauge readings. All quantitative readings
 * need external confirmed sensor input, validated by contract.
 */
const S='FCOM-SEPEHRAN-1937';
function requireReading(o,key,unit,max) {
 if(!o || !Object.prototype.hasOwnProperty.call(o,key)) return null;
 const n=o[key];
 if(n===null) return null;
 if(typeof n!=='number'||!Number.isFinite(n)||n<0 || (max!==null&&n>max)) throw new TypeError(key+' requires nonnegative finite '+unit);
 return n;
}
function pressureHydraulic(net,observations={}) {
 const out={};
 for(const id of ['A','B']){
  const h=net.hydraulic[id],s=h.systemPressure.state;
  const reading=requireReading(observations.hydraulicPsi,id,'psi',null);
  const consistency=reading===null?'NOT_OBSERVED':
    s==='LOW'&&reading>0?'MEASUREMENT_CONFLICT_CHECK_SENSOR':
    s==='AVAILABLE'&&reading===0?'MEASUREMENT_CONFLICT_CHECK_SENSOR':'OBSERVATION_PRESENT';
  out[id]={
   system:id,enginePumpOutput:h.engineDriven.outputPressureSensor.state,
   electricPumpOutput:h.electric.outputPressureSensor.state,
   combinedQualitative:s,
   gaugePsi:reading,measurementQuality:reading===null?'NO_MEASUREMENT':'EXTERNAL_OBSERVATION_UNVALIDATED',
   consistency,
   normalReferencePsi:3000,redMaximumReferencePsi:3500,
   simulatedPsi:null,
   model:'SOURCE_GROUNDED_QUALITATIVE_FLOW_PATH',
   unresolved:['pump displacement, reservoir depletion, load flow, response time and pressure decay not documented in FCOM'],
   source:{sourceId:S,section:'13.10.2;13.20.2-3',pdfPages:[1843,1847,1848]}
  };
 }
 return out;
}
function pressureFuel(net,observations={}){
 const mainIds=['MAIN1_FWD','MAIN1_AFT','MAIN2_FWD','MAIN2_AFT'];
 const centerIds=['CTR_LEFT','CTR_RIGHT'];
 const readings=observations.fuelPumpPsi||{};
 const pumps={};
 for(const id of [...mainIds,...centerIds]){
  const x=net.fuel[id],measured=requireReading(readings,id,'psi',null);
  pumps[id]={motor:x.motor,outletState:x.outputPressureSensor.state,
   measuredPsi:measured,simulatedPsi:null,
   observationQuality:measured===null?'NO_MEASUREMENT':'EXTERNAL_OBSERVATION_UNVALIDATED',
   model:'QUALITATIVE_SWITCH_PRESSURE_ONLY',
   source:{sourceId:S,section:'12.20.1;12.10.2-3',pdfPages:[1834,1826,1827]}};
 }
 const tank={};
 for(const [label,ids] of [['MAIN1',['MAIN1_FWD','MAIN1_AFT']],
  ['MAIN2',['MAIN2_FWD','MAIN2_AFT']],['CENTER',centerIds]]) {
  const pressure=ids.map(k=>pumps[k].outletState);
  tank[label]={pressureAvailability:pressure.includes('NORMAL')?'AVAILABLE':
    pressure.includes('UNKNOWN')?'UNKNOWN':'NO_AC_PUMP_PRESSURE',
    pumpIds:ids};
 }
 return {pumps,tank,
  sourceSelection:{preferredTank:tank.CENTER.pressureAvailability==='AVAILABLE'?'CENTER':
    tank.CENTER.pressureAvailability==='UNKNOWN'?'UNKNOWN':
    (tank.MAIN1.pressureAvailability==='AVAILABLE'||tank.MAIN2.pressureAvailability==='AVAILABLE'?
       'MAIN_TANKS':'SUCTION_FEED_POSSIBLE_NOT_MODELED'),
   criterion:'CENTER_CHECK_VALVES_OPEN_AT_LOWER_PRESSURE_THAN_MAIN; NO_NUMERICAL_PRESSURE_ASSUMED',
   source:{sourceId:S,section:'12.20.1-2',pdfPages:[1834,1835]}},
  unresolved:['fuel pressure PSI','suction feed envelope','fuel flow and engine demand','center auto shutoff delay']};
}
function evaluateFluidPressureNetwork(net,observations={}) {
 if(!net || !net.hydraulic || !net.fuel) throw new TypeError('pump network required');
 if(!observations||typeof observations!=='object')throw new TypeError('observations required');
 return {hydraulic:pressureHydraulic(net,observations),
  fuel:pressureFuel(net,observations),
  mode:'FCOM_CONSTRAINED_QUALITATIVE_WITH_OPTIONAL_MEASURED_PSI'};
}
module.exports={evaluateFluidPressureNetwork};
