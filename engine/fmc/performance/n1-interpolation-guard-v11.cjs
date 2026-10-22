'use strict';
/* Generic interpolation validator for aircraft simulator. NO Boeing curves shipped.
 * Only signoff-complete, correctly scoped, non-extrapolated datasets can produce
 * calculations. EP-FSI AFM v11 digitized traces deliberately fail these gates.
 */
const EXPECTED=Object.freeze({serial:29340,engine:'CFM56-3B-1',ratingLbf:20000});
class N1DatasetBlocked extends Error{constructor(reason){super(reason);this.name='N1DatasetBlocked';this.reason=reason;}}
function assertSource(d){
 if(!d||d.serial!==EXPECTED.serial||d.engine!==EXPECTED.engine||d.ratingLbf!==EXPECTED.ratingLbf)throw new N1DatasetBlocked('WRONG_AIRCRAFT');
 if(!d.qa||d.qa.reviewA===d.qa.reviewB||!d.qa.reviewA||!d.qa.reviewB)throw new N1DatasetBlocked('INDEPENDENT_REVIEW_PENDING');
 if(d.qa.completeCurves!==true)throw new N1DatasetBlocked('FULL_CURVES_NOT_VALIDATED');
 if(d.qa.bleedCorrectionsVerified!==true||d.qa.antiIceCorrectionsVerified!==true)throw new N1DatasetBlocked('CORRECTIONS_UNVERIFIED');
 if(d.qa.maxLimitsVerified!==true)throw new N1DatasetBlocked('MAX_N1_LIMIT_UNVERIFIED');
 if(d.qa.scopedGoldenVectorsPassed!==true)throw new N1DatasetBlocked('GOLDEN_VECTORS_PENDING');
 if(!Array.isArray(d.altitudeFt)||!Array.isArray(d.temperatureC)||d.altitudeFt.length<2||d.temperatureC.length<2)throw new N1DatasetBlocked('INCOMPLETE_AXIS');
 const asc=a=>a.every((v,i)=>Number.isFinite(v)&&(i===0||v>a[i-1]));
 if(!asc(d.altitudeFt)||!asc(d.temperatureC))throw new N1DatasetBlocked('NON_MONOTONIC_GRID');
 if(!Array.isArray(d.n1Pct)||d.n1Pct.length!==d.altitudeFt.length||!d.n1Pct.every(r=>Array.isArray(r)&&r.length===d.temperatureC.length&&r.every(Number.isFinite)))throw new N1DatasetBlocked('INCOMPLETE_GRID');
}
function bracket(axis,value){if(!Number.isFinite(value)||value<axis[0]||value>axis[axis.length-1])throw new N1DatasetBlocked('OUTSIDE_VALIDATED_CHART_RANGE');for(let i=0;i<axis.length-1;i++){if(value>=axis[i]&&value<=axis[i+1])return [i,(value-axis[i])/(axis[i+1]-axis[i])];}throw new N1DatasetBlocked('OUTSIDE_VALIDATED_CHART_RANGE')}
function bilinear(d,pressureAltitudeFt,temperatureC){
 assertSource(d);
 const [ia,fa]=bracket(d.altitudeFt,pressureAltitudeFt),[it,ft]=bracket(d.temperatureC,temperatureC);
 const y=d.n1Pct;
 const a=y[ia][it]*(1-ft)+y[ia][it+1]*ft;
 const b=y[ia+1][it]*(1-ft)+y[ia+1][it+1]*ft;
 const result=a*(1-fa)+b*fa;
 if(result<0||result>106)throw new N1DatasetBlocked('N1_OUTPUT_INVALID');
 return Object.freeze({status:'INTERPOLATED_GRID_VALUE',n1Pct:result,sourceId:d.sourceId,
  caution:'Only generic grid interpolation. Operational N1 requires documented context, caps and corrections.'});
}
function tryInterpolate(d,a,t){try{return bilinear(d,a,t)}catch(e){if(e instanceof N1DatasetBlocked)return {status:'BLOCKED',n1Pct:null,reason:e.reason};throw e}}
module.exports=Object.freeze({EXPECTED,N1DatasetBlocked,assertSource,bilinear,tryInterpolate});