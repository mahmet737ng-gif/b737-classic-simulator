'use strict';
/**
 * AFM p756 research only. Operates on caller-supplied, unapproved
 * MAXIMUM N1 cap samples (not engine takeoff N1). It cannot provide
 * an FMC target, override the AFM source gate, or extrapolate.
 * Private AFM graph data stays in Technical Database library v17.
 */
const AIRCRAFT={registration:'EP-FSI',msn:29340,engine:'CFM56-3B-1',ratingLbf:20000};
function sourceOnlyCapPreview({effectivity,pmcMode,oatC,capKnots}){
 if(!effectivity||Object.keys(AIRCRAFT).some(k=>effectivity[k]!==AIRCRAFT[k]))
   throw new TypeError('EP-FSI 29340 CFM56-3B-1 20K effectivity required');
 if(pmcMode!=='OFF')throw new Error('PMC OFF source only; installed PMC not verified');
 if(typeof oatC!=='number'||!Number.isFinite(oatC))throw new TypeError('finite OAT required');
 if(!Array.isArray(capKnots)||capKnots.length!==5)throw new TypeError('five private cap knots required');
 const knots=capKnots.map(x=>{
  if(!x||typeof x.oatC!=='number'||!Number.isFinite(x.oatC)||
     typeof x.capN1Pct!=='number'||!Number.isFinite(x.capN1Pct)||
     x.capN1Pct<0||x.capN1Pct>120)
    throw new TypeError('invalid provisional max cap input');
  return {oatC:x.oatC,capN1Pct:x.capN1Pct};
 }).sort((a,b)=>a.oatC-b.oatC);
 if(knots.some((x,i)=>i>0&&x.oatC<=knots[i-1].oatC))
   throw new TypeError('cap knot OAT must be distinct');
 if(oatC<knots[0].oatC||oatC>knots[knots.length-1].oatC)
   throw new RangeError('no extrapolation outside measured cap interval');
 const i=knots.findIndex((x,i)=>i<knots.length-1&&x.oatC<=oatC&&oatC<=knots[i+1].oatC);
 if(i<0)throw new RangeError('input outside source');
 const lo=knots[i],hi=knots[i+1],a=(oatC-lo.oatC)/(hi.oatC-lo.oatC);
 return Object.freeze({
  quantity:'MAXIMUM_N1_CAP_NOT_ENGINE_TARGET',
  oatC,previewCapPct:lo.capN1Pct*(1-a)+hi.capN1Pct*a,
  interval:[lo.oatC,hi.oatC],sampleCount:knots.length,
  qa:'PROVISIONAL_SINGLE_SOURCE_ONLY',
  approvedForFMC:false,finalTakeoffN1Pct:null,
  eligibility:'BLOCKED_BY_AFMSOURCE_QA'
 });
}
function finalTakeoffN1(){
 const err=new Error('Complete operating altitude curve and corrections are not approved');
 err.code='AFM_N1_QA_BLOCKED';throw err;
}
module.exports={sourceOnlyCapPreview,finalTakeoffN1,AIRCRAFT};
