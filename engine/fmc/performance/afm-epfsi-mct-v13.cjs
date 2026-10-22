'use strict';
/* EP-FSI ASN29340 CFM56-3B-1 20K, AFM R32 Section 4.2 Page 6 / PDF p130.
 * Only source stage geometry / mathematical order implemented.
 * NO approved Boeing curve lookup data present.
 * Synthetic execution returns trace-only, never an automatic N1 or A/T target.
 */
const PROFILE=Object.freeze({registration:'EP-FSI',serial:29340,engine:'CFM56-3B-1',ratingLbf:20000});
const SOURCE=Object.freeze({sourceId:'AFM-73733V-D6-8730.33V-R32-20180214',pdfPage:130,printedPage:'Section 4.2 Page 6',intermediateUnit:'CORRECTED_N1_OVER_SQRT_THETA1',finalUnit:'N1_GAGE_PERCENT'});
const STAGES=Object.freeze([
 'PRESSURE_LIMIT','TEMPERATURE_LIMIT_AND_TAT_CORRECTION','SELECT_LOWER_CORRECTED_LIMIT',
 'ALTITUDE_CORRECTION','SUM_APPLICABLE_BLEED_ADJUSTMENTS','FINAL_TAT_NOMOGRAM_TO_GAGE'
]);
const BLOCK='AWAITING_INDEPENDENTLY_VERIFIED_COMPLETE_AFM_CURVES';
function wrongAircraft(c){return !c||c.registration!==PROFILE.registration||c.serial!==PROFILE.serial||c.engine!==PROFILE.engine||c.ratingLbf!==PROFILE.ratingLbf;}
function base(c){if(wrongAircraft(c))return {status:'BLOCKED',reason:'WRONG_AIRFRAME',n1Pct:null,autothrottleTarget:null};if(!['NORMAL','OFF'].includes(c.pmcMode))return {status:'BLOCKED',reason:'PMC_UNKNOWN',n1Pct:null,autothrottleTarget:null};if(c.phase!=='MAX_CONTINUOUS')return {status:'BLOCKED',reason:'INVALID_PHASE',n1Pct:null,autothrottleTarget:null};return null;}
function requestMctN1(c){const error=base(c);return error||{status:'BLOCKED',reason:BLOCK,n1Pct:null,autothrottleTarget:null,source:SOURCE,stageNames:STAGES};}
function finite(name,v){if(typeof v!=='number'||!Number.isFinite(v))throw Error('MISSING_OR_INVALID_'+name);return v;}
function calculateSyntheticTrace(c,lookups){
 const error=base(c);if(error)return error;
 if(!lookups||lookups.sourceClass!=='SYNTHETIC_TEST_FIXTURE_ONLY')return {status:'BLOCKED',reason:'SYNTHETIC_ONLY_WITH_EXPLICIT_FIXTURE',n1Pct:null,autothrottleTarget:null};
 const {pressureAltitudeFt,mach,tatC,referenceTatC}=c;
 finite('ALTITUDE_FT',pressureAltitudeFt);finite('MACH',mach);finite('TAT_C',tatC);
 const fn=(name)=>{if(typeof lookups[name]!=='function')throw Error('MISSING_SYNTHETIC_'+name);return lookups[name];};
 const pressure=finite('PRESSURE_LIMIT',fn('pressureLimit')(pressureAltitudeFt,mach));
 const rawTemp=finite('TEMPERATURE_LIMIT',fn('temperatureLimit')(tatC,mach));
 const applyTatCorrection=pressureAltitudeFt>=2500&&pressureAltitudeFt<=10000;
 const tatDelta=applyTatCorrection?finite('TAT_DELTA',fn('tatCorrection')(pressureAltitudeFt,mach,finite('REFERENCE_TAT_C',referenceTatC))):0;
 const temp=rawTemp+tatDelta;
 const limited=Math.min(pressure,temp);
 const limitingBranch=pressure<=temp?'PRESSURE':'TEMPERATURE';
 const altitudeDelta=finite('ALTITUDE_DELTA',fn('altitudeCorrection')(pressureAltitudeFt));
 const adjusted=limited+altitudeDelta;
 const bleedAdjustments=fn('bleedAdjustments')(c);
 if(!Array.isArray(bleedAdjustments)||!bleedAdjustments.every(x=>typeof x==='number'&&Number.isFinite(x)))throw Error('BAD_SYNTHETIC_BLEED_ARRAY');
 const bleedDelta=bleedAdjustments.reduce((sum,x)=>sum+x,0);
 const corrected=adjusted+bleedDelta;
 const final=finite('NOMOGRAM',fn('nomogram')(corrected,tatC));
 if(final<0||final>106)throw Error('SYNTHETIC_FINAL_N1_OUT_OF_BOUNDS');
 const stages=[
  {index:1,name:STAGES[0],value:pressure,unit:SOURCE.intermediateUnit},
  {index:2,name:STAGES[1],value:temp,sourceTemp:rawTemp,tatCorrection:tatDelta,unit:SOURCE.intermediateUnit},
  {index:3,name:STAGES[2],value:limited,limitingBranch,unit:SOURCE.intermediateUnit},
  {index:4,name:STAGES[3],value:adjusted,altitudeDelta,unit:SOURCE.intermediateUnit},
  {index:5,name:STAGES[4],value:corrected,bleedDelta,unit:SOURCE.intermediateUnit},
  {index:6,name:STAGES[5],value:final,unit:SOURCE.finalUnit}
 ];
 return {status:'SYNTHETIC_TEST_TRACE_ONLY',reason:BLOCK,diagnosticSyntheticN1Pct:final,
  stages,n1Pct:null,autothrottleTarget:null,forCDU:false,source:SOURCE};
}
module.exports=Object.freeze({PROFILE,SOURCE,STAGES,requestMctN1,calculateSyntheticTrace});
