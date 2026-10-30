/* B737 Classic authoritative CDU screen compositor v1
 * Training application only, NOT FOR FLIGHT.
 * Exactly ONE presenter owns the live CDU text DOM per update.
 * Optional NAVDB overlays paint into a DETACHED staging node, not the live DOM.
 * A specific FCOM-verified page always wins over lab/reference overlays.
 * Approved bitmap, fonts, interactive map and locked IRS frontend are untouched.
 */
(function(root,factory){'use strict';const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.CDU_SCREEN_COMPOSITOR_V1=api;
})(typeof globalThis!=='undefined'?globalThis:null,function(){
 'use strict';
 const PROFILE=Object.freeze({version:'FCOM-SCREEN-COMPOSITOR-0001',columns:24,rows:14,
  geometry:'BOEING_CDU_APPROVED_1199x1312',fontPolicy:'BoeingCDULarge/BoeingCDUSmall'});
 const CANONICAL=Object.freeze(['DEP_ARR']);
 const has=v=>v!==null&&typeof v==='object';
 const activePlan=st=>st.stage6PendingPlan||null;
 function choose(st){
  if(!st||typeof st.page!=='string')throw Error('CDU_STATE_REQUIRED');
  const p=st.page;
  // Explicit FCOM canonical INDEX cannot be replaced by a reference plan.
  if(CANONICAL.includes(p))return {owner:'FCOM_NATIVE',reason:'FCOM_11.40.32_LAYOUT'};
  if(['DEPARTURES','ARRIVALS'].includes(p)&&st.stage6View?.mode)
   return {owner:'STAGE6',reason:'NAVDB_PROCEDURE_SELECTOR'};
  if(['RTE','LEGS','ACTIVATE'].includes(p)&&activePlan(st))
   return {owner:'STAGE6',reason:'NAVDB_PENDING_MOD'};
  if(['LEGS','FLIGHT_PLAN','RTE','DEPARTURES','ARRIVALS'].includes(p)&&
     (st.stage5Pending||st.stage5Committed))
   return {owner:'STAGE5',reason:'AIRAC_REFERENCE_PLAN'};
  if(p==='LEGS'&&(st.navdbActive||st.navdbPending))
   return {owner:'NAVDB_LEGS',reason:'REFERENCE_ROUTE'};
  if(p==='PROG'&&st.stage8Monitor)
   return {owner:'PROGRESS',reason:'READ_ONLY_REFERENCE'};
  return {owner:'FCOM_NATIVE',reason:'TRAINER_OR_SOURCE_PAGE'};
 }
 function compose({state,frame,renderers={},onError=null}={}){
  if(!has(state)||!frame||typeof frame.replaceChildren!=='function')
   throw Error('CDU_FRAME_AND_STATE_REQUIRED');
  const plan=choose(state);
  const baseline=[...frame.childNodes];
  // Preserve the real scratchpad in every page, including a special NAVDB view.
  // The scratchpad's content and layout are owned by the CDU engine, NOT overlays.
  const scratch=baseline.find(el=>el.classList?.contains('scratch'))||null;
  let used=plan.owner,errors=[];
  if(used!=='FCOM_NATIVE'){
   const painter=renderers[used];
   if(typeof painter!=='function'){
    errors.push('PRESENTER_NOT_CONNECTED_'+used);
    used='FCOM_NATIVE';
   }else{
    try{
     painter(frame);
    }catch(err){
     // Prevent an experimental overlay error from destroying the core CDU screen.
     errors.push('PRESENTER_ERROR_'+used+':'+String(err?.message||err));
     frame.replaceChildren(...baseline);
     used='FCOM_NATIVE';
    }
   }
  }
  if(used!=='FCOM_NATIVE'&&state.page==='LEGS'&&state.stage10Advisory){
   try{renderers.STAGE10_ADVISORY?.(frame);}
   catch(err){errors.push('ADVISORY_ERROR:'+String(err?.message||err));}
  }
  // Re-append original scratch even if overlay used replaceChildren; no duplicate.
  const scratchRows=[...frame.childNodes].filter(el=>el.classList?.contains('scratch'));
  if(scratchRows.length)for(const row of scratchRows)frame.removeChild(row);
  if(scratch)frame.appendChild(scratch);
  if(!frame.querySelector?.('.fmc-header')){
   // All displayed pages must have a page title and a page number.
   const heading=baseline.find(el=>el.classList?.contains('fmc-header'));
   if(heading)frame.insertBefore(heading,frame.firstChild);
  }
  if(errors.length&&typeof onError==='function')onError(errors);
  return {owner:used,reason:plan.reason,errors,frame,version:PROFILE.version,
   preservedScratch:!!scratch,sourceVerified:used==='FCOM_NATIVE'&&state.page==='DEP_ARR',
   children:frame.childNodes.length};
 }
 return Object.freeze({PROFILE,CANONICAL,choose,compose});
});
