/* AIRCON-OVHT-DELAY-0003: owner-requested 5-second qualification.
 * Classic FCOM SP.2.1: hold minimum 5 sec; this trainer deliberately
 * waits the full five seconds before issuing any detector-test indication.
 * Genuine overheat faults remain independent and instantaneous.
 */
(function(root,factory){'use strict';const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.B737AirconOVHTQualificationV1=api;
})(typeof globalThis==='object'?globalThis:null,function(){
 'use strict';
 const DELAY_MS=5000;
 function create({clock=()=>Date.now(),schedule=(fn,ms)=>setTimeout(fn,ms),
  cancel=id=>clearTimeout(id),onQualified=()=>{},onReleased=()=>{},delayMs=DELAY_MS}={}){
  if(!Number.isFinite(delayMs)||delayMs<0)throw Error('Invalid OVHT qualification delay');
  let held=false,qualified=false,at=null,timer=null,sequence=0;
  function qualify(seq){
   timer=null;
   if(!held||seq!==sequence||qualified)return;
   const elapsed=clock()-at;
   if(elapsed<delayMs){
    timer=schedule(()=>qualify(seq),Math.max(1,delayMs-elapsed));
    return;
   }
   // Mark complete only if downstream ECU accepts this genuine qualified
   // test. Failures stay observable/retriable instead of leaving a phantom
   // active annunciation in a test-state object.
   onQualified();
   qualified=true;
  }
  function press(physicalStartedAtMs){
   if(held)return snapshot();
   const now=clock();
   // The original physical switch is in the Overhead iframe. Its PRESS
   // message may reach the Unified ECU only after a busy main-thread task.
   // Honor the physical timestamp (transformed to the caller's monotonic
   // clock) instead of starting a fresh five seconds after IPC latency.
   const valid=Number.isFinite(physicalStartedAtMs)&&physicalStartedAtMs<=now&&
    now-physicalStartedAtMs<=60000;
   held=true;qualified=false;at=valid?physicalStartedAtMs:now;
   const seq=++sequence,remaining=Math.max(0,delayMs-(now-at));
   if(remaining===0)qualify(seq);
   else timer=schedule(()=>qualify(seq),remaining);
   return snapshot();
  }
  function release(){
   if(!held)return snapshot();
   ++sequence;held=false;
   if(timer!==null){cancel(timer);timer=null}
   const wasQualified=qualified;
   try{
    if(wasQualified)onReleased();
   }finally{qualified=false;at=null}
   return snapshot();
  }
  function snapshot(){return Object.freeze({
   held,qualified,elapsedMs:held?Math.max(0,clock()-at):0,
   remainingMs:held&&!qualified?Math.max(0,delayMs-(clock()-at)):0,
   delayMs
  })}
  return Object.freeze({press,release,snapshot});
 }
 return Object.freeze({DELAY_MS,create});
});
