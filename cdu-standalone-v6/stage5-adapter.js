/* Additive CDU v6 Stage5 adapter. Unlit/photo geometry and EFIS controls unchanged.
 * ACT after EXEC means committed REFERENCE preview only: NEVER LNAV or FMC active legs. */
(function(root,factory){'use strict';if(typeof module==='object'&&module.exports)module.exports=factory; if(root&&root.NPE_STAGE5_MODEL&&typeof state!=='undefined'&&typeof core!=='undefined')root.CDU_STAGE5_API=factory(root.NPE_STAGE5_MODEL,state,core,root.CDU_PAGES,()=>root.updateStage5View?.());})(typeof window==='undefined'?null:window,function(model,state,core,pages,refresh){
'use strict';
const clone=v=>JSON.parse(JSON.stringify(v));
const committed=()=>!!state.stage5Committed&&
 state.active?.ORIGIN===state.stage5Committed.origin&&
 state.active?.DEST===state.stage5Committed.destination&&
 !Object.keys(state.pending||{}).some(k=>['ORIGIN','DEST','RUNWAY','CO_ROUTE'].includes(k))&&
 !core.hasStagedRoute(state);
const data=()=>state.stage5Pending||(committed()?state.stage5Committed:null);
const currentlyEditing=()=>Object.keys(state.pending||{}).length||core.hasStagedRoute(state)||state.navdbActive||state.navdbPending;
function stagePlan(plan){
 const summary=model.validate(plan);
 if(currentlyEditing()||state.stage5Committed||state.stage5Pending)throw Error('Complete/clear current CDU modifications and existing route before staging Stage 5');
 state.stage5Pending=clone(plan);state.stage5AwaitingExec=false;state.stage5Page=1;
 state.stagedRoute={ORIGIN:summary.origin,DEST:summary.destination};state.message='';
 core.choose(state,pages,'RTE');refresh?.();return {status:'MOD_REFERENCE_ONLY',...summary};
}
function beforeKey(key){
 if(!state.stage5Pending)return false;
 const k=key.replace(/^CDU_CAPT_/,'');
 if(k!=='EXEC')return false;
 if(!state.stage5AwaitingExec){state.message='NAVDB ACTIVATE FIRST';return true;}
 const keys=Object.keys(state.pending||{});
 if(keys.some(k=>!['ORIGIN','DEST'].includes(k))||core.hasStagedRoute(state)||state.scratch){
   state.message='NAVDB MOD MISMATCH';return true;
 }
 return false;
}
function afterKey(key,pageBefore){
 if(!state.stage5Pending)return;
 const k=key.replace(/^CDU_CAPT_/,'');
 if(k==='LSK_L5'&&pageBefore==='RTE'&&state.page==='ACTIVATE'&&core.pendingCount(state)>0)state.stage5AwaitingExec=true;
 if(k==='EXEC'&&state.stage5AwaitingExec){
  if(core.pendingCount(state)!==0||core.hasStagedRoute(state)||state.active.ORIGIN!==state.stage5Pending.origin||state.active.DEST!==state.stage5Pending.destination)
    {state.message='NAVDB MOD NOT EXECUTED';return;}
  state.stage5Committed=state.stage5Pending;delete state.stage5Pending;
  state.stage5AwaitingExec=false;state.stage5Page=1;
  state.message='';
 }
}
function afterPage(key){
 if(!data())return;
 const k=key.replace(/^CDU_CAPT_/,'');
 if(!['NEXT_PAGE','PREV_PAGE'].includes(k)||!['LEGS','FLIGHT_PLAN'].includes(state.page))return;
 const which=state.page==='LEGS'?'LEGS':'RTE';const total=Math.max(1,Math.ceil(model.rows(data(),which).length/5));
 state.stage5Page=Math.min(total,Math.max(1,(state.stage5Page||1)+(k==='NEXT_PAGE'?1:-1)));
 if(state.message==='END OF PAGES')state.message='';
}
function paintedLine(box,y,left,right){
 const row=document.createElement('div');row.className='fmc-line fmc-pairline';row.style.top=y+'%';
 const l=document.createElement('span');l.className='fmc-left';l.textContent=left.slice(0,13);
 const r=document.createElement('span');r.className='fmc-right';r.textContent=right.slice(0,13);row.append(l,r);box.appendChild(row);
}
function paint(box){
 const plan=data();if(!plan)return;
 const page=['LEGS','FLIGHT_PLAN','RTE','DEP_ARR','DEPARTURES','ARRIVALS'].includes(state.page)?state.page:null;
 if(!page)return;
 const which=page==='LEGS'?'LEGS':page==='RTE'||page==='FLIGHT_PLAN'?'RTE':'DEP_ARR';
 let all=model.rows(plan,which);
 if(page==='DEPARTURES')all=all.filter(x=>x.kind==='SID');
 if(page==='ARRIVALS')all=all.filter(x=>x.kind!=='SID');
 const n=which==='DEP_ARR'?1:Math.min(Math.max(1,Math.ceil(all.length/5)),state.stage5Page||1);
 const slice=which==='DEP_ARR'?all:model.paginate(all,5,n).rows;
 box.replaceChildren();paintedLine(box,3.5,(committed()?'ACT ':'MOD ')+page,which==='DEP_ARR'?'1/1':n+'/'+Math.max(1,Math.ceil(all.length/5)));
 if(which==='DEP_ARR')slice.forEach((x,i)=>{paintedLine(box,13+i*24,x.kind+' '+x.ident,'RWY '+x.runway);paintedLine(box,19+i*24,'TRANS '+x.transition,'SOURCE ONLY')});
 else slice.forEach((x,i)=>{
  const y=12+i*15;
  if(x.type==='DISCONTINUITY'){paintedLine(box,y,'----- ROUTE -----','DISCONTINUITY');paintedLine(box,y+5,'VERIFY / RESOLVE','NO AUTO JOIN');return;}
  if(which==='LEGS'){paintedLine(box,y,(x.ident||'').slice(0,11),x.via||'');paintedLine(box,y+5,x.course==null?'TRUE ---':'T '+x.course.toFixed(1),x.distance==null?'--- NM':x.distance.toFixed(1)+' NM')}
  else {paintedLine(box,y,x.via||'DCT',x.to||'');paintedLine(box,y+5,x.status||'SOURCE','NO LNAV')}
 });
 if(page==='RTE'&&!committed())paintedLine(box,89,'<ACTIVATE L5','THEN EXEC');
 else paintedLine(box,89,'REF ONLY','NO LNAV/VNAV');
}
function snapshot(){return {stage:committed()?'ACT_REFERENCE_ONLY':state.stage5Pending?'MOD_REFERENCE_ONLY':'NONE',
  discontinued:data()?.qa.discontinuity_count||0,origin:data()?.origin||null,destination:data()?.destination||null,
  routeGuidance:false,fmcExecutable:false,displayableOnPlan:committed()};}
return Object.freeze({stagePlan,beforeKey,afterKey,afterPage,paint,snapshot,getCommitted:()=>state.stage5Committed||null});
});