/* Single-cockpit instructor scenario. 140 kt is a fixed training trigger,
 * not a performance-calculated V1. One event from the authoritative flight step. */
(function(root,factory){
 const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;
 if(root?.document)root.B737EngineFailureV1Scenario=api.install(root);
})(typeof globalThis!=='undefined'?globalThis:null,function(){
 'use strict';
 const TYPES=Object.freeze(['FLAME_OUT','FIRE','SEVERE_DAMAGE','SEPARATION']);
 const THRESHOLD=140;
 function create({inject,clear=()=>{},random=Math.random}={}){
  if(typeof inject!=='function')throw Error('Live engine owner is required');
  let run=null;
  const getStatus=()=>run?{status:run.status,type:run.type,triggerKt:THRESHOLD,
   ...(run.status==='ARMED'?{}:{engine:run.engine,observedIasKt:run.observedIasKt??null,error:run.error??null})}:{status:'IDLE'};
  function arm({type,state,ready}={}){
   if(run)throw Error('Reset V1 before arming a new flight');
   if(!TYPES.includes(type)||state?.preset!=='READY_FOR_TAKEOFF'||state.phase!=='GROUND_READY'||
      state.airborne!==false||state.iasKt!==0||ready!==true)throw Error('READY FOR TAKEOFF ground state not confirmed');
   const r=random();if(!Number.isFinite(r)||r<0||r>=1)throw Error('Invalid engine randomization');
   run={type,engine:r<.5?'engine1':'engine2',status:'ARMED'};
   return getStatus();
  }
  function observe(before,after){
   if(run?.status!=='ARMED'||before?.preset!=='READY_FOR_TAKEOFF'||after?.preset!==before.preset||
      before.phase!=='TAKEOFF_ROLL'||before.airborne!==false||
      !['TAKEOFF_ROLL','INITIAL_CLIMB'].includes(after.phase)||
      !Number.isFinite(before.iasKt)||!Number.isFinite(after.iasKt)||
      before.iasKt>=THRESHOLD||after.iasKt<THRESHOLD)return getStatus();
   run.status='TRIGGERING';run.observedIasKt=after.iasKt;
   try{
    const result=inject({engine:run.engine,type:run.type,triggerKt:THRESHOLD,observedIasKt:after.iasKt});
    if(result?.accepted!==true)throw Error('Live engine owner did not acknowledge failure');
    run.status='FIRED';
   }catch(error){run.status='ERROR';run.error=String(error?.message||error);}
   return getStatus();
  }
  function reset(){
   if(run&&run.status!=='ARMED')clear();
   run=null;return getStatus();
  }
  return Object.freeze({arm,observe,reset,getStatus});
 }
 function install(win){
  const controller=create({
   inject:command=>{
    const result=win.B737ISNCockpitV1?.injectFlightEngineFailure?.(command);
    if(result?.accepted===true)win.dispatchEvent(new win.CustomEvent('b737:v1-engine-failure',{detail:{...command,accepted:true}}));
    return result;
   },
   clear:()=>win.B737ISNCockpitV1?.clearFlightEngineFailures?.()
  });
  function arm(type,state){
   if(new URLSearchParams(win.location.search).has('crewRoom'))throw Error('V1 shared-cockpit synchronization is not yet validated');
   const p=win.B737PoweredGeneralPresetsV1?.getStatus?.();
   const owner=win.B737ISNCockpitV1,phase=owner?.getStartState?.()?.phase;
   const needed=['FLAPS','MCP','AUTOBRAKE_RTO','pitot-a','pitot-b','galley'];
   const missing=needed.filter(k=>p?.checks?.[k]!==true);
   if(!owner?.injectFlightEngineFailure||!p?.settled||!p?.coreReady||p?.state!=='READY_FOR_TAKEOFF'||
      phase?.engine1!=='RUNNING'||phase?.engine2!=='RUNNING'||missing.length)
     throw Error('READY FOR TAKEOFF NOT CONFIRMED'+(missing.length?' — '+missing.join(', '):''));
   return controller.arm({type,state,ready:true});
  }
  return Object.freeze({...controller,arm});
 }
 return Object.freeze({TYPES,THRESHOLD,create,install});
});
