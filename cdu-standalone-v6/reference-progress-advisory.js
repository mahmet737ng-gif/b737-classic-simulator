/* Stage8 AIRAC 2610 private-source reference progress on existing CDU PROG.
 * Pure read-only, never changes CDU route/EXEC nor EFIS panel/hitboxes.
 */
(function(root,factory){'use strict';if(typeof module==='object'&&module.exports)module.exports=factory;
 if(root&&typeof state!=='undefined'&&typeof core!=='undefined'&&root.NPE_STAGE5_MODEL)
  root.CDU_REFERENCE_PROGRESS_API=factory(state,core,root.NPE_STAGE5_MODEL,()=>root.updateStage5View?.());
})(typeof window==='undefined'?null:window,function(state,core,model,refresh){
'use strict';
const fail=(message)=>{throw Error(message)};
const plain=x=>JSON.parse(JSON.stringify(x));
function current(){const route=state.stage5Committed;if(!route)return null;
 try{model.validate(route)}catch{return null}
 if(state.active?.ORIGIN!==route.origin||state.active?.DEST!==route.destination)return null;
 if(state.stage5Pending||state.stage6PendingPlan||state.stage6AwaitingExec||core.hasStagedRoute(state)||core.pendingCount(state))return null;
 return route;
}
function check(sample,reference){
 const plan=current();if(!plan)fail('Commit unchanged source route before CDU PROG preview');
 if(!sample||!reference||sample.version!=='NPE_STAGE8_REFERENCE_MONITOR_v1'||
    reference.version!=='NPE_STAGE8_REFERENCE_MONITOR_v1'||reference.airac!=='2610'||
    sample.fmc_executable!==false||reference.fmc_executable!==false||
    sample.status!=='REFERENCE_ADVISORY_ONLY_NO_AUTO_SEQUENCING'||
    sample.requires_manual_next_leg_selection!==true||reference.no_automatic_sequencing!==true||
    !Number.isInteger(sample.plan_id)||sample.plan_id!==reference.plan_id||
    state.stage6BasePlanId!==reference.plan_id||
    sample.plan_origin!==plan.origin||sample.plan_destination!==plan.destination||
    reference.origin!==plan.origin||reference.destination!==plan.destination)fail('Stage8 AIRAC/source route mismatch');
 if(sample.autopilot_guidance_enabled!==false||sample.lnav_commands?.length||sample.vnav_commands?.length||sample.afds_commands?.length)fail('Unexpected guidance commands');
 if(!Array.isArray(reference.manual_selectable_reference_chords)||
    plan.items.length<2||reference.discontinuities!==plan.qa.discontinuity_count)fail('Reference continuity invalid');
 const eps=.00001;
 const expected=[];
 for(let i=1;i<plan.items.length;i++){
  const p=plan.items[i-1],q=plan.items[i];
  if(p.type==='FIX'&&q.type==='FIX')expected.push({i,p,q});
 }
 if(reference.manual_selectable_reference_chords.length!==expected.length)fail('Reference FIX edge mismatch');
 for(const [j,e] of reference.manual_selectable_reference_chords.entries()){
  const {i,p,q}=expected[j];
  if(e.to_item_index!==i||e.from!==p.label||e.to!==q.label||
   Math.abs(e.start.lat-p.lat)>eps||Math.abs(e.start.lon-p.lon)>eps||
   Math.abs(e.end.lat-q.lat)>eps||Math.abs(e.end.lon-q.lon)>eps||
   !Number.isFinite(e.length_nm)||!Number.isFinite(q.reference_leg_distance_nm)||
   Math.abs(e.length_nm-q.reference_leg_distance_nm)>.30)fail('Reference point coordinates drift');
 }
 const selected=reference.manual_selectable_reference_chords.find(x=>x.to_item_index===sample.manual_item_index);
 if(!selected||selected.from!==sample.from_fix||selected.to!==sample.to_fix||
    !Number.isFinite(sample.cross_track_nm_right_positive)||
    !Number.isFinite(sample.along_track_nm)||!Number.isFinite(sample.direct_distance_to_fix_nm)||
    !Number.isFinite(sample.reference_true_course_deg)||
    sample.direct_distance_to_fix_nm<0||
    Math.abs(selected.true_initial_course_deg-sample.reference_true_course_deg)>.01)fail('Invalid diagnostic sample');
 return plan;
}
function show(sample,reference){check(sample,reference);state.stage8Monitor={sample:plain(sample),reference:plain(reference)};
 core.choose(state,rootPages(),'PROG');refresh?.();return {status:'REFERENCE_ONLY_ON_PROG',guidance:false};
}
function rootPages(){if(typeof pages!=='undefined')return pages;
 if(typeof window!=='undefined')return window.CDU_PAGES;
 return {};}
function row(box,y,left,right){const d=document.createElement('div');d.className='fmc-line fmc-pairline';d.style.top=y+'%';
 const l=document.createElement('span');l.className='fmc-left';l.textContent=left;
 const r=document.createElement('span');r.className='fmc-right';r.textContent=right;d.append(l,r);box.append(d);}
function paint(box){if(state.page!=='PROG'||!state.stage8Monitor)return;
 const {sample,reference}=state.stage8Monitor;try{check(sample,reference)}catch{delete state.stage8Monitor;return}
 box.replaceChildren();row(box,4,'PROG REF','AIRAC 2610');
 row(box,16,'NEXT REF FIX',sample.to_fix);
 row(box,31,'DTG DIRECT',sample.direct_distance_to_fix_nm.toFixed(1)+' NM');
 row(box,46,'XTK REF R+',sample.cross_track_nm_right_positive.toFixed(2)+' NM');
 row(box,61,'ALONG REF',sample.along_track_nm.toFixed(1)+' NM');
 row(box,76,sample.reference_phase==='ON_REFERENCE_SPAN'?'ON REF SPAN':'OFF REF SPAN','MANUAL LEG');
 row(box,91,'NOT LNAV','NO AUTO SEQ');
}
function snapshot(){return {visible:!!state.stage8Monitor&&!!current(),fmc_active:false};}
return Object.freeze({show,paint,snapshot,check});
});