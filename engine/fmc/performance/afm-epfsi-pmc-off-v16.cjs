'use strict';
/* EP-FSI ASN29340 CFM56-3B-1 20K. AFM R32 p755-756 Appendix 2UK.
 * No proprietary curve points in PUBLIC module. Source data is private.
 */
const AIRFRAME=Object.freeze({registration:'EP-FSI',serial:29340,engine:'CFM56-3B-1',ratingLbf:20000});
const SOURCE=Object.freeze({id:'AFM-73733V-D6-8730.33V-R32-20180214',sourcePage:756,procedurePage:755,sha256:'3c7002212482f0c47a1735c2302ee304ef41ef4ca270591281b72f5f2a714105'});
class N1SourceError extends Error{constructor(code){super(code);this.name='N1SourceError';this.code=code;}}
const blocked=reason=>({status:'BLOCKED',reason,n1Pct:null,diagnosticN1Pct:null,autothrottleTarget:null});
function gate(c){
 if(!c||c.registration!=='EP-FSI'||c.serial!==29340||c.engine!=='CFM56-3B-1'||c.ratingLbf!==20000)throw new N1SourceError('AIRFRAME_MISMATCH');
 if(c.phase!=='TAKEOFF')throw new N1SourceError('INVALID_PHASE');
 if(c.pmcMode!=='OFF')throw new N1SourceError('PMC_NOT_OFF');
 if(!Number.isFinite(c.oatC)||!Number.isFinite(c.pressureAltitudeFt))throw new N1SourceError('MISSING_OAT_OR_PRESSURE_ALTITUDE');
 if(!Number.isFinite(c.iasKts)||c.iasKts<40||c.iasKts>60)throw new N1SourceError('THRUST_SETTING_SPEED_MUST_BE_40_TO_60_KT');
 if(!['AUTO','OFF','HIGH'].includes(c.acPacks))throw new N1SourceError('UNKNOWN_A_C_PACK_CONFIGURATION');
 if(!['OFF','COWL_TAI'].includes(c.antiIce))throw new N1SourceError('UNKNOWN_ANTI_ICE_CONFIGURATION');
 if(c.antiIce==='COWL_TAI'&&c.oatC>10)throw new N1SourceError('COWL_TAI_PROHIBITED_ABOVE_10C');
}
function interpolation(points,x){
 if(!Array.isArray(points)||points.length<2||!points.every(p=>p&&Number.isFinite(p.x)&&Number.isFinite(p.y)))throw new N1SourceError('INCOMPLETE_SOURCE_CURVE');
 for(let i=1;i<points.length;i++)if(points[i].x<=points[i-1].x)throw new N1SourceError('NONMONOTONIC_SOURCE_DOMAIN');
 if(!Number.isFinite(x)||x<points[0].x||x>points[points.length-1].x)throw new N1SourceError('OUTSIDE_DOCUMENTED_CURVE_NO_EXTRAPOLATION');
 for(let i=1;i<points.length;i++)if(x<=points[i].x){const a=points[i-1],b=points[i];return a.y+(b.y-a.y)*(x-a.x)/(b.x-a.x);}
 throw new N1SourceError('OUTSIDE_DOCUMENTED_CURVE_NO_EXTRAPOLATION');
}
function altitudeCurveAt(curves,alt,oat){
 if(!Array.isArray(curves)||curves.length<2)throw new N1SourceError('SOURCE_ALTITUDE_FAMILY_INCOMPLETE');
 for(let i=1;i<curves.length;i++)if(curves[i].altitudeFt<=curves[i-1].altitudeFt)throw new N1SourceError('NONMONOTONIC_SOURCE_ALTITUDES');
 if(alt<curves[0].altitudeFt||alt>curves[curves.length-1].altitudeFt)throw new N1SourceError('ALTITUDE_OUTSIDE_VERIFIED_GRID');
 for(let i=1;i<curves.length;i++)if(alt<=curves[i].altitudeFt){
  const a=curves[i-1],b=curves[i],y0=interpolation(a.points,oat),y1=interpolation(b.points,oat);
  return y0+(y1-y0)*(alt-a.altitudeFt)/(b.altitudeFt-a.altitudeFt);
 }
 throw new N1SourceError('ALTITUDE_OUTSIDE_VERIFIED_GRID');
}
function evaluate(c,d){
 gate(c);if(!d||d.sourcePage!==756)throw new N1SourceError('INCORRECT_SOURCE_PAGE');
 const base=altitudeCurveAt(d.altitudeCurves,c.pressureAltitudeFt,c.oatC);
 const cap=interpolation(d.maximumN1,c.oatC);
 const key=c.acPacks+':'+c.antiIce;
 if(!d.bleedCorrections||!Array.isArray(d.bleedCorrections[key]))throw new N1SourceError('BLEED_CASE_NOT_DIGITIZED');
 const bleed=altitudeCurveAt(d.bleedCorrections[key],c.pressureAltitudeFt,c.oatC);
 const precap=base+bleed,final=Math.min(precap,cap);
 if(![base,cap,bleed,precap,final].every(Number.isFinite)||final<0||final>106)throw new N1SourceError('N1_OUT_OF_PHYSICAL_RANGE');
 return {base,bleed,precap,cap,final,capBinding:precap>cap};
}
function signedSource(d){
 if(!d||d.sourcePage!==756||d.sourceDocSha!==SOURCE.sha256||!d.qa)return false;
 const q=d.qa;
 if(!q.completeCurves||!q.bleedCorrectionsVerified||!q.capCurveVerified||!q.goldenCasesPassed||!q.sourceEffectivityConfirmed)return false;
 if(!Array.isArray(q.independentReviewers)||q.independentReviewers.length<2)return false;
 if(new Set(q.independentReviewers.map(r=>r.id)).size<2||q.independentReviewers.some(r=>!r.id||!r.signedAt||!r.sha256||r.sha256!==d.releaseSha256))return false;
 return Array.isArray(q.goldens)&&q.goldens.length>=4&&q.goldens.every(v=>Number.isFinite(v.expectedN1Pct)&&v.signed===true);
}
function calculate(c,d){
 try{
  gate(c);
  if(!signedSource(d))return blocked('INDEPENDENT_COMPLETE_SOURCE_QA_NOT_SIGNED');
  const r=evaluate(c,d);
  return {status:'APPROVED_SOURCE_GRID_EVALUATION',n1Pct:r.final,capN1Pct:r.cap,preCapN1Pct:r.precap,bleedDeltaPct:r.bleed,capBinding:r.capBinding,autothrottleTarget:null,source:SOURCE,notForActualFlight:true};
 }catch(e){if(e instanceof N1SourceError)return blocked(e.code);throw e;}
}
function syntheticTest(c,d){
 if(!d||d.syntheticFixtureOnly!==true)return blocked('SYNTHETIC_FIXTURE_REQUIRED');
 try{
  const r=evaluate(c,d);
  return {status:'SYNTHETIC_DIAGNOSTIC_ONLY',reason:'NOT_AFM_N1',n1Pct:null,autothrottleTarget:null,diagnosticN1Pct:r.final,diagnosticCapN1Pct:r.cap,diagnosticBaseN1Pct:r.base,diagnosticCapBinding:r.capBinding};
 }catch(e){if(e instanceof N1SourceError)return blocked(e.code);throw e;}
}
module.exports=Object.freeze({AIRFRAME,SOURCE,N1SourceError,interpolation,altitudeCurveAt,gate,evaluate,signedSource,calculate,syntheticTest});