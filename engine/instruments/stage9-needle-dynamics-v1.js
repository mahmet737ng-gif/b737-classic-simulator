/* B737 Classic / Stage 9 — deterministic, source-gated analogue needle dynamics.
 * Parameter defaults are TRAINING TEST ONLY, never claimed as instrument LRU
 * transfer functions. No DOM or Unified needle write APIs are used.
 */
(function(root,factory){'use strict';
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.B737Stage9NeedleDynamicsV1=api;
})(typeof globalThis==='object'?globalThis:this,function(){'use strict';
 const valid=n=>typeof n==='number'&&Number.isFinite(n);
 const clip=(n,min,max)=>Math.max(min,Math.min(max,n));
 const MODES=Object.freeze(['direct','slew','first_order','second_order']);
 const failures=Object.freeze(['none','sensor_lost','sensor_disagree','needle_jammed','power_lost','data_stale']);
 function create({id,profile,limits,initialAngleDeg=null}={}){
  if(typeof id!=='string'||!id||!profile||!MODES.includes(profile.mode))
   throw Error('Explicit needle ID and response model required');
  const {mode}=profile;
  if(mode==='slew'&&(!valid(profile.speedDegPerSec)||profile.speedDegPerSec<=0))
   throw Error('Slew rate required');
  if(mode==='first_order'&&(!valid(profile.tauSeconds)||profile.tauSeconds<=0))
   throw Error('First-order time constant required');
  if(mode==='second_order'&&(!valid(profile.omegaRadSec)||profile.omegaRadSec<=0||
      !valid(profile.dampingRatio)||profile.dampingRatio<=0))
   throw Error('Second-order frequency and damping required');
  if(!limits||!valid(limits.minAngleDeg)||!valid(limits.maxAngleDeg)||
      limits.minAngleDeg>=limits.maxAngleDeg)
   throw Error('Source-constrained mechanical stops required');
  if(initialAngleDeg!==null&&!valid(initialAngleDeg))throw Error('Initial angle must be finite');
  if(profile.lossBehavior!==undefined&&!['hold','invalidate'].includes(profile.lossBehavior))
   throw Error('Unsupported loss behavior: no invented zero/reset');
  if(profile.staleThresholdMs!==undefined&&
     (!valid(profile.staleThresholdMs)||profile.staleThresholdMs<=0))
   throw Error('Invalid freshness threshold');
  let angle=initialAngleDeg===null?null:clip(initialAngleDeg,limits.minAngleDeg,limits.maxAngleDeg);
  let velocity=0,lastTarget=null,status='uninitialized',steps=0,lastEvidence=null;
  const snapshot=()=>Object.freeze({id,status,angleDeg:angle,targetAngleDeg:lastTarget,
    velocityDegPerSec:velocity,direction:Math.abs(velocity)<1e-6?'stationary':velocity>0?'clockwise':'counterclockwise',
    steps,lastEvidence,liveNeedleAuthorized:false,physicalCertification:'UNVERIFIED_TRAINING_DYNAMICS'});
  function update({targetAngleDeg=null,validSample=false,dtSeconds=0,
      sampleAgeMs=null,power='unknown',fault='none',source=null}={}){
   if(!valid(dtSeconds)||dtSeconds<0||dtSeconds>30)throw Error('Invalid elapsed interval');
   if(!['on','off','unknown','not_required'].includes(power))throw Error('Explicit power state required');
   if(!failures.includes(fault))throw Error('Unrecognised fault');
   if(sampleAgeMs!==null&&(!valid(sampleAgeMs)||sampleAgeMs<0))throw Error('Invalid sample age');
   if(validSample&&(!valid(targetAngleDeg)||typeof source!=='string'||!source))
     throw Error('Qualified sample must have finite angle and source provenance');
   const stale=validSample&&sampleAgeMs!==null&&valid(profile.staleThresholdMs)&&
       sampleAgeMs>profile.staleThresholdMs;
   const failure=fault!=='none'?fault:
      power==='off'?'power_lost':(profile.requiresPower!==false&&power!=='on'?'power_unverified':
       stale?'data_stale':!validSample?'signal_unavailable':null);
   steps++;
   if(failure){
    status=failure;
    lastEvidence=source;
    // HOLD is the only generic fail-safe without a verified per-instrument
    // loss-of-power park or spring-rest mechanic. Do not synthesize rest zero.
    if(profile.lossBehavior==='invalidate'){angle=null;velocity=0;lastTarget=null;}
    else velocity=0;
    return snapshot();
   }
   const target=clip(targetAngleDeg,limits.minAngleDeg,limits.maxAngleDeg);
   lastTarget=target;lastEvidence=source;
   if(angle===null){angle=target;velocity=0;status='initialized';return snapshot();}
   if(fault==='needle_jammed'){status='needle_jammed';velocity=0;return snapshot();}
   if(mode==='direct'){
    const prev=angle;angle=target;velocity=dtSeconds>0?(target-prev)/dtSeconds:0;
   }else if(mode==='slew'){
    const prev=angle;
    const permitted=profile.speedDegPerSec*dtSeconds;
    angle+=clip(target-angle,-permitted,permitted);
    velocity=dtSeconds>0?(angle-prev)/dtSeconds:0;
   }else if(mode==='first_order'){
    const prev=angle;
    const fraction=1-Math.exp(-dtSeconds/profile.tauSeconds);
    angle+=(target-angle)*fraction;
    velocity=dtSeconds>0?(angle-prev)/dtSeconds:0;
   }else{
    // Deterministic sub-stepping avoids instability at variable render FPS.
    let remaining=dtSeconds;
    while(remaining>0){
     const h=Math.min(remaining,0.008);
     const accel=profile.omegaRadSec**2*(target-angle)-
        2*profile.dampingRatio*profile.omegaRadSec*velocity;
     velocity+=accel*h;
     angle+=velocity*h;
     if(angle<=limits.minAngleDeg&&velocity<0)velocity=0;
     if(angle>=limits.maxAngleDeg&&velocity>0)velocity=0;
     angle=clip(angle,limits.minAngleDeg,limits.maxAngleDeg);
     remaining-=h;
     if(remaining<1e-10)remaining=0;
    }
   }
   if(angle<=limits.minAngleDeg&&velocity<0)velocity=0;
   if(angle>=limits.maxAngleDeg&&velocity>0)velocity=0;
   angle=clip(angle,limits.minAngleDeg,limits.maxAngleDeg);
   status=Math.abs(angle-target)<1e-7?'settled':'tracking';
   return snapshot();
  }
  function reset({angleDeg=null}={}){
   if(angleDeg!==null&&!valid(angleDeg))throw Error('Reset angle invalid');
   angle=angleDeg===null?null:clip(angleDeg,limits.minAngleDeg,limits.maxAngleDeg);
   velocity=0;lastTarget=null;status='uninitialized';steps=0;lastEvidence=null;
   return snapshot();
  }
  return Object.freeze({update,snapshot,reset,id,limits:Object.freeze({...limits}),
    profile:Object.freeze({...profile})});
 }
 return Object.freeze({create,MODES,failures});
});
