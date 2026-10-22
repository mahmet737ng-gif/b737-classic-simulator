'use strict';
/* Source-traceable N1 chart selector for EP-FSI 29340 CFM56-3B-1/20K.
 * No proprietary graph data or numerical N1 output; validated data is not yet available.
 * CDU uses this only as an isolated future data adapter.
 */
const AIRCRAFT=Object.freeze({registration:'EP-FSI',serial:29340,engine:'CFM56-3B-1',ratingLbf:20000,sourceId:'AFM-73733V-D6-8730.33V-R32-20180214'});
const CHARTS=Object.freeze({
 'TAKEOFF:NORMAL':Object.freeze({id:'N1-TO-PMC-NORMAL',pdfPage:128,printedRef:'Section 4.2 Page 4'}),
 'GO_AROUND:NORMAL':Object.freeze({id:'N1-GA-PMC-NORMAL',pdfPage:129,printedRef:'Section 4.2 Page 5'}),
 'MAX_CONTINUOUS:NORMAL':Object.freeze({id:'N1-MCT-PMC-NORMAL',pdfPage:130,printedRef:'Section 4.2 Page 6'}),
 'TAKEOFF:OFF':Object.freeze({id:'N1-TO-PMC-OFF',pdfPage:756,printedRef:'Appendix 2UK Section 4.2 Page 2'})
});
class AircraftMismatch extends Error{constructor(){super('EP-FSI/29340/CFM56-3B-1/20K required');this.name='AircraftMismatch';}}
function checkAirframe(a){if(!a||a.registration!=='EP-FSI'||a.serial!==29340||a.engine!=='CFM56-3B-1'||a.ratingLbf!==20000)throw new AircraftMismatch();}
function selectN1Chart(a){
 checkAirframe(a);
 if(a.pmcMode!=='NORMAL'&&a.pmcMode!=='OFF')return {status:'BLOCKED',reason:'PMC_STATE_UNVERIFIED',chart:null};
 if(!['TAKEOFF','GO_AROUND','MAX_CONTINUOUS'].includes(a.phase))return {status:'BLOCKED',reason:'INVALID_PHASE',chart:null};
 const chart=CHARTS[a.phase+':'+a.pmcMode];
 if(!chart)return {status:'BLOCKED',reason:'NO_VERIFIED_CHART_FOR_PHASE_AND_PMC',chart:null};
 return {status:'SOURCE_IDENTIFIED_NUMERIC_QA_PENDING',chart,sourceId:AIRCRAFT.sourceId};
}
function requestN1(a){const s=selectN1Chart(a);return {status:'BLOCKED',n1Pct:null,reason:s.chart?'NO_VERIFIED_NUMERIC_N1_CURVES':s.reason,source:s.chart?{...s.chart,sourceId:AIRCRAFT.sourceId}:null};}
function cduN1Adapter(a){const r=requestN1(a);return {field:'N1_LIMIT',value:null,calculated:false,source:r.source,status:r.status,reason:r.reason};}
module.exports=Object.freeze({AIRCRAFT,CHARTS,AircraftMismatch,checkAirframe,selectN1Chart,requestN1,cduN1Adapter});