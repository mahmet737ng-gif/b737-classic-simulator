/* NPE Stage 5 / source-exact CDU preview model. No FMC path terminators or guidance.
 * Pure model. Never draws connections across unverified discontinuities. */
(function(root,factory){'use strict';const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.NPE_STAGE5_MODEL=api;})(typeof window==='undefined'?null:window,function(){
'use strict';
const MARKER='//AIRAC Cycle : 2610 (01/OCT/2026 - 29/OCT/2026) - Ver.1';
const VERSION='NPE_STAGE4_FLIGHT_PLAN_DRAFT_v1';
const TYPES=new Set(['AIRPORT','FIX','DISCONTINUITY','PROCEDURE']);
function assert(ok,why){if(!ok)throw Error('NAVDB: '+why)}
function coord(lat,lon){return typeof lat==='number'&&Number.isFinite(lat)&&lat>=-90&&lat<=90&&typeof lon==='number'&&Number.isFinite(lon)&&lon>=-180&&lon<=180}
function ident(v){return typeof v==='string'&&/^[A-Z0-9]{2,12}$/.test(v)}
function haversine(a,b){const p=x=>x*Math.PI/180;const d=p(b.lat-a.lat),l=p(b.lon-a.lon);const k=Math.sin(d/2)**2+Math.cos(p(a.lat))*Math.cos(p(b.lat))*Math.sin(l/2)**2;return 3440.065*2*Math.asin(Math.min(1,Math.sqrt(k)))}
function validate(plan){
 assert(plan&&typeof plan==='object'&&!Array.isArray(plan),'plan object required');
 assert(plan.airac==='2610'&&plan.engine===VERSION&&plan.source_marker===MARKER,'wrong source/AIRAC marker');
 assert(plan.fmc_legs_activated===0&&plan.autopilot_guidance_enabled===false&&/NOT_FMC_EXECUTABLE/.test(plan.status),'must be an inactive Stage 4 draft');
 assert(ident(plan.origin)&&ident(plan.destination)&&plan.origin!==plan.destination,'invalid ORIGIN/DEST');
 assert(Array.isArray(plan.items)&&plan.items.length>=2&&plan.items.length<=500,'invalid item count');
 assert(plan.items[0].type==='AIRPORT'&&plan.items[0].label===plan.origin&&plan.items.at(-1).type==='AIRPORT'&&plan.items.at(-1).label===plan.destination,'airport endpoints mismatch');
 assert(plan.qa&&plan.qa.source_chain?.airac==='2610'&&plan.qa.source_chain?.stage3_fmc_status==='NOT_EXECUTABLE','unverified provenance');
 let gaps=0;
 for(const row of plan.items){
   assert(row&&TYPES.has(row.type)&&typeof row.label==='string','unsupported item');
   assert(row.fmc_status==='NOT_EXECUTABLE'||row.fmc_status==='SOURCE_ONLY','forbidden active leg');
   if(row.type==='DISCONTINUITY'){
     gaps++;assert(row.required_action==='EXPLICIT_VERIFY_AND_RESOLVE','uncontrolled discontinuity');
   }
   if(row.type==='FIX')assert(ident(row.label)&&coord(row.lat,row.lon)&&typeof row.source_file==='string'&&Number.isInteger(row.source_line),'invalid sourced FIX');
   if(row.type==='PROCEDURE')assert(['SID','STAR','APP'].includes(row.kind)&&row.detail?.fmc_status==='NOT_EXECUTABLE'&&row.detail?.status==='SELECTED_SOURCE_ONLY'&&row.detail?.source_member?.startsWith('SidStars/'),'unverified procedure');
 }
 assert(plan.qa.discontinuity_count===gaps,'discontinuity count mismatch');
 for(const [key,kind] of [['selected_departure','SID'],['selected_arrival','STAR'],['selected_approach','APP']]){
  const value=plan[key];
  if(value){assert(value.kind===kind&&value.status==='SELECTED_SOURCE_ONLY'&&value.fmc_status==='NOT_EXECUTABLE'&&value.source_member?.startsWith('SidStars/'),'bad '+kind+' selection');}
 }
 return Object.freeze({origin:plan.origin,destination:plan.destination,airac:'2610',items:plan.items.length,discontinuities:gaps,executable:false});
}
function rows(plan,page){validate(plan);
 if(page==='LEGS')return plan.items.map((it,i)=>({index:i,type:it.type,ident:it.type==='DISCONTINUITY'?'----- DISCONTINUITY -----':it.label,
  via:it.type==='FIX'?(it.via||'DCT'):it.type==='PROCEDURE'?it.kind:'',
  distance:it.type==='FIX'&&Number.isFinite(it.reference_leg_distance_nm)?it.reference_leg_distance_nm:null,
  course:it.type==='FIX'&&Number.isFinite(it.reference_course_true_deg)?it.reference_course_true_deg:null,
  status:it.fmc_status}));
 if(page==='RTE')return (plan.enroute_sections||[]).map(x=>({via:x.via,to:x.to,status:x.status}));
 if(page==='DEP_ARR')return [['selected_departure','SID'],['selected_arrival','STAR'],['selected_approach','APP']].map(([field,kind])=>{
  const v=plan[field];return {kind,ident:v?.ident||'NONE',runway:v?.selected_runway||'---',transition:v?.selected_transition||'---',status:v?.status||'NOT_SELECTED'};
 });
 throw Error('Unsupported page');
}
function paginate(items,size,page){assert(Number.isInteger(page)&&page>0&&Number.isInteger(size)&&size>0,'invalid page');
 const count=Math.max(1,Math.ceil(items.length/size));assert(page<=count,'page out of range');return {page,count,rows:items.slice((page-1)*size,page*size)};
}
function safeReferenceLines(plan){
 validate(plan);const groups=[];let current=[];let previous=null;
 const flush=()=>{if(current.length>=2)groups.push(current);current=[];previous=null};
 for(const it of plan.items){
  if(it.type!=='FIX'){flush();continue;}
  const p={ident:it.label,lat:it.lat,lon:it.lon};
  if(!previous){current=[p];previous=p;continue;}
  // A missing published source chord cannot be extrapolated into a route.
  const declared=it.reference_leg_distance_nm;
  if(!Number.isFinite(declared)||declared<=0||Math.abs(haversine(previous,p)-declared)>0.3){flush();current=[p];previous=p;continue;}
  current.push(p);previous=p;
 }
 flush();return groups;
}
return Object.freeze({MARKER,validate,rows,paginate,safeReferenceLines});
});