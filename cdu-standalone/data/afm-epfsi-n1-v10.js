(function(root,factory){'use strict';
const api=factory();
if(typeof module==='object'&&module.exports)module.exports=api;
if(root)root.EPFSI_N1_ENGINE=api;
})(typeof window!=='undefined'?window:null,function(){'use strict';
/* B737-33V EP-FSI ASN29340 CFM56-3B-1 / rating 20000 lbf.
   AFM D6-8730.33V Rev32. This module is a CLOSED-FAIL DATA ADAPTER.
   ZERO numerical AFM curves have been fully independently verified.
   This is NOT an approved aircraft performance calculator. */
const SOURCE_ID='AFM-73733V-D6-8730.33V-R32-20180214';
const EXPECTED=Object.freeze({registration:'EP-FSI',serial:29340,engine:'CFM56-3B-1',ratingLbf:20000});
const CHARTS=Object.freeze({
 'TAKEOFF:NORMAL':Object.freeze({id:'TO_NORMAL',pdfPage:128,section:'4.2/4',inputTemperature:'OAT_C',requireSpeedKts:[40,60],source:'AFM_BASE'}),
 'TAKEOFF:OFF':Object.freeze({id:'TO_PMC_OFF',pdfPage:756,section:'App2UK/4.2/2',inputTemperature:'OAT_C',requireSpeedKts:[40,60],source:'APPENDIX_2UK',limit:'MAXIMUM_N1'}),
 'GO_AROUND:NORMAL':Object.freeze({id:'GA_BASE',pdfPage:129,section:'4.2/5',inputTemperature:'TAT_C',referenceMach:0.22,source:'AFM_BASE'}),
 'MAX_CONTINUOUS:NORMAL':Object.freeze({id:'MCT_BASE',pdfPage:130,section:'4.2/6',inputTemperature:'TAT_C',method:'PRESSURE_TEMP_LOWER_LIMIT_THEN_NOMOGRAM',source:'AFM_BASE'})
});
const FLAGS=Object.freeze({CURVES_NOT_VALIDATED:'CURVES_NOT_VALIDATED',PMC_UNKNOWN:'PMC_UNKNOWN',WRONG_AIRCRAFT:'WRONG_AIRCRAFT',INVALID_CONTEXT:'INVALID_CONTEXT',MISSING_ENVIRONMENT:'MISSING_ENVIRONMENT',PHASE_UNSUPPORTED:'PHASE_UNSUPPORTED'});
function identityMatches(c){return !!c&&c.registration===EXPECTED.registration&&c.serial===EXPECTED.serial&&c.engine===EXPECTED.engine&&c.ratingLbf===EXPECTED.ratingLbf;}
function chartFor(c){
 if(!identityMatches(c))return {ok:false,reason:FLAGS.WRONG_AIRCRAFT};
 if(!['NORMAL','OFF'].includes(c.pmcMode))return {ok:false,reason:FLAGS.PMC_UNKNOWN};
 if(!['TAKEOFF','GO_AROUND','MAX_CONTINUOUS'].includes(c.phase))return {ok:false,reason:FLAGS.PHASE_UNSUPPORTED};
 /* Appendix 2UK Section 4.2 Page 1: all settings except Takeoff unchanged. */
 const inheritedBase=c.pmcMode==='OFF'&&c.phase!=='TAKEOFF';
 const key=c.phase+':'+(inheritedBase?'NORMAL':c.pmcMode);
 return {ok:true,chart:CHARTS[key],inheritedBase,sourceId:SOURCE_ID};
}
function requestN1(c){
 const selected=chartFor(c);
 if(!selected.ok)return {status:'BLOCKED',n1Pct:null,reason:selected.reason,source:null,forAutothrottle:false};
 const chart=selected.chart;
 const errors=[];
 if(c.phase==='TAKEOFF'){
  if(!Number.isFinite(c.pressureAltitudeFt)||!Number.isFinite(c.oatC))errors.push('PRESSURE_ALTITUDE_OR_OAT_REQUIRED');
  if(!Number.isFinite(c.iasKts)||c.iasKts<40||c.iasKts>60)errors.push('TAKEOFF_REFERENCE_SPEED_40_TO_60_KTS');
 }else if(c.phase==='GO_AROUND'){
  if(!Number.isFinite(c.pressureAltitudeFt)||!Number.isFinite(c.tatC))errors.push('PRESSURE_ALTITUDE_OR_TAT_REQUIRED');
  if(Number.isFinite(c.mach)&&Math.abs(c.mach-0.22)>0.005)errors.push('GO_AROUND_CHART_FIXED_MACH_0_22');
 }else{
  if(!Number.isFinite(c.pressureAltitudeFt)||!Number.isFinite(c.tatC)||!Number.isFinite(c.mach))errors.push('ALTITUDE_TAT_MACH_REQUIRED');
 }
 if(c.bleedMode==null)errors.push('BLEED_CONFIGURATION_REQUIRED');
 if(c.antiIceMode==null)errors.push('ANTI_ICE_CONFIGURATION_REQUIRED');
 const source={...chart,sourceId:SOURCE_ID,inheritedBase:selected.inheritedBase};
 return {status:'BLOCKED',n1Pct:null,reason:errors.length?FLAGS.MISSING_ENVIRONMENT:FLAGS.CURVES_NOT_VALIDATED,missing:errors,source,forAutothrottle:false};
}
function trainingManualN1(n1Pct){
 if(!Number.isFinite(n1Pct)||n1Pct<0||n1Pct>106)return {status:'REJECTED',reason:'OUT_OF_RANGE_0_TO_106_PCT',n1Pct:null,calculated:false,forAutothrottle:false};
 return {status:'MANUAL_TRAINING_ONLY',reason:'NOT_AFM_CALCULATED',n1Pct,calculated:false,forAutothrottle:false};
}
function cduAdapter(c){
 const a=requestN1(c);
 return {page:'N1 LIMIT',engine:'CFM56-3B-1',rating:'20K',registration:'EP-FSI',value:a.n1Pct,display:a.n1Pct===null?'---.-':a.n1Pct.toFixed(1),source:a.source,calculated:false,canDriveAutothrottle:false,reason:a.reason,missing:a.missing||[]};
}
return Object.freeze({SOURCE_ID,EXPECTED,CHARTS,FLAGS,identityMatches,chartFor,requestN1,trainingManualN1,cduAdapter});
});