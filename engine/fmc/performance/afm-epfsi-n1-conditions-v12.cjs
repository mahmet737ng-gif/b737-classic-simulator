'use strict';
/* Boeing 737-33V EP-FSI 29340 CFM56-3B-1/20K SOURCE-ONLY calculation graph.
 * AFM graph numbers/points stored privately, NOT included in this module.
 * Always returns numericN1=null until verified complete graph release exists.
 */
const CONFIG=Object.freeze({registration:'EP-FSI',serial:29340,engine:'CFM56-3B-1',ratingLbf:20000});
const MCT_STEPS=Object.freeze([
 {step:1,name:'PRESSURE_LIMIT',page:130,inputs:['pressureAltitudeFt','mach'],output:'correctedN1PressureLimit'},
 {step:2,name:'TEMPERATURE_LIMIT',page:130,inputs:['tatC','mach','refTatC','pressureAltitudeFt'],output:'correctedN1TemperatureLimit',note:'TAT correction only in published 2500–10000 ft window'},
 {step:3,name:'LOWER_LIMIT',page:130,inputs:['correctedN1PressureLimit','correctedN1TemperatureLimit'],output:'limitedCorrectedN1'},
 {step:4,name:'ALTITUDE_ADJUSTMENT',page:130,inputs:['limitedCorrectedN1','pressureAltitudeFt'],output:'altitudeAdjustedCorrectedN1'},
 {step:5,name:'BLEED_SUM',page:130,inputs:['altitudeAdjustedCorrectedN1','bleedConfig','antiIceMode'],output:'bleedAdjustedCorrectedN1'},
 {step:6,name:'NOMOGRAM',page:130,inputs:['bleedAdjustedCorrectedN1','tatC'],output:'n1GagePct'}
]);
function wrongAirframe(c){return !c||c.registration!==CONFIG.registration||c.serial!==CONFIG.serial||c.engine!==CONFIG.engine||c.ratingLbf!==CONFIG.ratingLbf;}
function blocked(reason,source,components=[]){return {status:'BLOCKED',reason,n1Pct:null,autothrottleTarget:null,source,components,verified:false};}
function selectCorrections(c){
 if(wrongAirframe(c))return blocked('WRONG_AIRFRAME',null);
 if(!['NORMAL','OFF'].includes(c.pmcMode))return blocked('PMC_STATE_UNKNOWN',null);
 if(!['TAKEOFF','GO_AROUND','MAX_CONTINUOUS'].includes(c.phase))return blocked('UNSUPPORTED_FLIGHT_PHASE',null);
 if(c.phase==='MAX_CONTINUOUS')return blocked('MCT_NOMOGRAM_UNVALIDATED',{pdfPage:130,section:'4.2/6'},MCT_STEPS);
 const takeoff=c.phase==='TAKEOFF', p=takeoff?(c.pmcMode==='OFF'?756:128):129;
 const source={pdfPage:p,section:takeoff?(p===756?'Appendix 2UK 4.2/2':'4.2/4'):'4.2/5'};
 const components=[];
 if(!['AUTO','OFF','HIGH'].includes(c.bleedConfig))return blocked('BLEED_CONFIGURATION_MISSING',source);
 if(!['OFF','COWL_TAI','NORMAL_ANTI_ICE'].includes(c.antiIceMode))return blocked('ANTIICE_CONFIGURATION_MISSING',source);
 if(c.antiIceMode==='COWL_TAI'&&Number.isFinite(c.oatC??c.tatC)&&(c.oatC??c.tatC)>10)
  return blocked('AFM_TAI_TEMPERATURE_LIMIT',source);
 const type=takeoff?'OAT_C':'TAT_C';
 if(!Number.isFinite(takeoff?c.oatC:c.tatC))return blocked(type+'_REQUIRED',source);
 if(!Number.isFinite(c.pressureAltitudeFt))return blocked('PRESSURE_ALTITUDE_REQUIRED',source);
 // The PMC-OFF p756 bleed chart is categorically different: don't reuse p128 corrections.
 if(p===756){
  components.push({kind:'PMC_OFF_BASE',source:{pdfPage:756},qa:'UNVALIDATED'});
  components.push({kind:'PMC_OFF_MAXIMUM_N1_CAP',source:{pdfPage:756},qa:'UNVALIDATED'});
  if(c.bleedConfig!=='AUTO'||c.antiIceMode!=='OFF')components.push({kind:'APP2UK_BLEED_ALT_CONFIGURATION',source:{pdfPage:756},qa:'UNVALIDATED'});
  return blocked('PMC_OFF_CHART_AND_CAP_UNVALIDATED',source,components);
 }
 if(c.bleedConfig==='OFF')components.push({kind:'A_C_BLEED_OFF',curve:1,temperature:type,source:{pdfPage:p},qa:'PROVISIONAL'});
 if(c.bleedConfig==='HIGH')components.push({kind:'A_C_BLEED_HIGH',curve:2,temperature:type,source:{pdfPage:p},qa:'PROVISIONAL'});
 if(c.antiIceMode==='COWL_TAI'){
  if(c.pressureAltitudeFt<=8000)components.push({kind:'COWL_TAI_NO_ADJUSTMENT_THROUGH_8000_FT',source:{pdfPage:p}});
  else if(c.pressureAltitudeFt<=15000)components.push({kind:'COWL_TAI_ALTITUDE_BLEND',lowerCurve:3,upperCurve:4,altitudeFt:c.pressureAltitudeFt,source:{pdfPage:p},qa:'NUMERIC_QA_PENDING'});
  else return blocked('COWL_TAI_OUTSIDE_SOURCE_ALTITUDE_RULE',source,components);
 }
 if(!takeoff&&c.antiIceMode==='NORMAL_ANTI_ICE')components.push({kind:'NORMAL_ANTI_ICE',curve:5,temperature:'TAT_C',source:{pdfPage:129},qa:'PROVISIONAL'});
 if(!takeoff&&c.oneEngineOperating)components.push({kind:'ONE_ENGINE_OPERATING',curve:6,temperature:'TAT_C',source:{pdfPage:129},qa:'PROVISIONAL'});
 return blocked('INCOMPLETE_AFM_NUMERIC_CURVES_OR_CORRECTIONS',source,components);
}
function mctPipeline(c){
 if(wrongAirframe(c))return blocked('WRONG_AIRFRAME',null);
 if(c.phase!=='MAX_CONTINUOUS')return blocked('NOT_MCT_PHASE',{pdfPage:130});
 return blocked('MCT_SIX_STEP_NOMOGRAM_NUMERIC_QA_PENDING',{pdfPage:130},MCT_STEPS);
}
module.exports=Object.freeze({CONFIG,MCT_STEPS,selectCorrections,mctPipeline});
