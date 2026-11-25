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
  const getStatus=()=>run?{status:run.status,type:run.type,scenario:run.scenario,triggerKt:run.scenario==='V1'?THRESHOLD:null,
   ...(run.status==='ARMED'?{}:{engine:run.engine,observedIasKt:run.observedIasKt??null,error:run.error??null})}:{status:'IDLE'};
  function arm({type,state,ready,scenario='V1',persisting=false}={}){
   if(run)throw Error('Reset V1 before arming a new flight');
   const final=scenario==='FINAL_10',ground=scenario==='GROUND_FIRE';
   if(!TYPES.includes(type)||ready!==true||!(final?state?.preset==='FINAL_10'&&state.airborne===true&&state.phase==='FINAL_APPROACH':(scenario==='V1'||ground)&&state?.preset==='READY_FOR_TAKEOFF'&&state.phase==='GROUND_READY'&&state.airborne===false&&state.iasKt===0))throw Error(final?'10 NM FINAL state not confirmed':'READY FOR TAKEOFF ground state not confirmed');
   const r=random();if(!Number.isFinite(r)||r<0||r>=1)throw Error('Invalid engine randomization');
   run={type,scenario,persisting:ground&&persisting===true,startElapsedSec:state.elapsedSec||0,engine:r<.5?'engine1':'engine2',status:'ARMED'};
   return getStatus();
  }
  function observe(before,after){
   if(run?.status!=='ARMED')return getStatus();
   const final=run.scenario==='FINAL_10',ground=run.scenario==='GROUND_FIRE';
   if(ground){if(after?.preset!=='READY_FOR_TAKEOFF'||after.airborne!==false||after.iasKt>1||after.elapsedSec-run.startElapsedSec<10)return getStatus();}
   else if(final){if(before?.preset!=='FINAL_10'||after?.preset!=='FINAL_10'||before.airborne!==true||after.airborne!==true||!(after.elapsedSec>before.elapsedSec))return getStatus();}
   else if(before?.preset!=='READY_FOR_TAKEOFF'||after?.preset!==before.preset||
      before.phase!=='TAKEOFF_ROLL'||before.airborne!==false||
      !['TAKEOFF_ROLL','INITIAL_CLIMB'].includes(after.phase)||
      !Number.isFinite(before.iasKt)||!Number.isFinite(after.iasKt)||
      before.iasKt>=THRESHOLD||after.iasKt<THRESHOLD)return getStatus();
   run.status='TRIGGERING';run.observedIasKt=after.iasKt;
   try{
    const result=inject({engine:run.engine,type:run.type,scenario:run.scenario,persisting:run.persisting,triggerKt:final||ground?null:THRESHOLD,observedIasKt:after.iasKt});
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
  function armFinal(type,state){
   if(new URLSearchParams(win.location.search).has('crewRoom'))throw Error('Engine-out final shared-cockpit synchronization is not yet validated');
   const owner=win.B737ISNCockpitV1,phase=owner?.getStartState?.()?.phase;
   const final=win.B737Final10ApproachPresetV1?.getStatus?.();
   const paused=win.B737UnifiedFlightScenarioV1?.getDiagnostics?.()?.paused===true;
   if(!owner?.injectFlightEngineFailure||final?.complete!==true||!paused||phase?.engine1!=='RUNNING'||phase?.engine2!=='RUNNING')throw Error('10 NM FINAL cockpit readiness not confirmed');
   return controller.arm({type,state,ready:true,scenario:'FINAL_10'});
  }
  function armGround(type,state){
   if(!['PERSISTING','CONTROLLABLE'].includes(type))throw Error('Invalid ground fire type');
   const owner=win.B737ISNCockpitV1,phase=owner?.getStartState?.()?.phase;
   if(!owner?.injectFlightEngineFailure||phase?.engine1!=='RUNNING'||phase?.engine2!=='RUNNING')throw Error('Both engines must be running');
   return controller.arm({type:'FIRE',state,ready:true,scenario:'GROUND_FIRE',persisting:type==='PERSISTING'});
  }
  return Object.freeze({...controller,arm,armFinal,armGround});
 }
 return Object.freeze({TYPES,THRESHOLD,create,install});
});
