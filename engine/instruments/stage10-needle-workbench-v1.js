/* B737 Classic / Stage 10: read-only unified analogue motion sandbox.
 * Stage8 signal -> Stage5 provisional scale -> Stage9 simulated response.
 * Does NOT contain any DOM mutation, needle renderer, sprite write, or
 * escalation path from candidate calibration to a released instrument.
 */
(function(root,factory){'use strict';
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.B737Stage10NeedleWorkbenchV1=api;
})(typeof globalThis==='object'?globalThis:this,function(){'use strict';
 const finite=n=>typeof n==='number'&&Number.isFinite(n);
 const units=u=>({knots:'kt',kt:'kt',hertz:'Hz',CPS:'Hz','°C':'°C',
    'PSI':'psi',psi:'psi',ft:'ft',A:'A',Hz:'Hz'}[u]||u);
 const selectMode=route=>route.channel==='cabAlt'?'cabinAltitude':
    route.channel==='press'?'diffPressure':route.modeSelector?'UNVERIFIED_MODE':'primary';
 function create({routes,scales,scaleEngine,dynamics,profileRegistry=null,
    previewPowerPolicy='require_verified_feed',observedMaxAgeMs=5000}={}){
  if(routes?.schema!=='b737.stage8.pointer-routing.v1'||routes.routes?.length!==38||
     scales?.schema!=='b737.stage10.candidate-calibration-subset.v1'||
     scales.counts?.scaleModes!==7||scaleEngine?.compile===undefined||!dynamics?.create)
   throw Error('Exact stage8 routing, stage5 draft map and stage9 model required');
  if(!['require_verified_feed','training_qa_assume_power'].includes(previewPowerPolicy))
   throw Error('Invalid preview-only power option');
  if(!finite(observedMaxAgeMs)||observedMaxAgeMs<=0||observedMaxAgeMs>60000)
   throw Error('QA observed signal freshness window invalid');
  if(scales.readiness!=='PREVIEW_ONLY_0_PHOTO_APPROVAL'||routes.counts?.liveApproved!==0)
   throw Error('Geometry authorisation must remain blocked');
  if(profileRegistry&&(profileRegistry.schema!=='b737.stage9.pointer-response-contracts.v1'||
      profileRegistry.pointers?.length!==38||profileRegistry.counts?.certifiedMechanicalResponseProfiles!==0))
   throw Error('Invalid source stage9 response profile registry');
  const registryProfiles=new Map((profileRegistry?.pointers||[]).map(r=>[r.pointerId,r]));
  // Source-time evidence is independent from the monotonic animation clock.
  // Observed sensor timeMs MUST be Unix milliseconds; training plant values
  // remain QA-only and are never interpreted as certified live sensor feeds.
  const drivers=new Map(),results={},blocked={},lastObserved=new Map();
  for(const route of routes.routes){
   const mode=selectMode(route),key=route.faceId+':'+mode;
   const c=route.channel===null?null:scales.calibrations[key];
   if(!c){blocked[route.spriteId]=route.channel===null?'channel_not_resolved':'no_two_anchor_scale';continue;}
   if(c.approval?.allNativeTicksReviewed||c.approval?.shaftPivotPhotoReviewed)
    throw Error('Preview registry must not include promoted geometry');
   const compiled=scaleEngine.compile({...c,id:c.faceId});
   if(compiled.approved)throw Error('Stage10 preview must never load an approved map');
   const a=compiled.marks[0].angleUnwrappedDeg,b=compiled.marks.at(-1).angleUnwrappedDeg;
   if(!finite(a)||!finite(b)||a>=b)throw Error('Source scale direction ambiguous');
   const trainingProfile=route.faceId.startsWith('oh.elec.')?
     {mode:'slew',speedDegPerSec:120,requiresPower:true,lossBehavior:'hold'}:
     route.faceId==='oh.fuel.temperature'?
       {mode:'first_order',tauSeconds:2.0,requiresPower:true,lossBehavior:'hold'}:
       {mode:'second_order',omegaRadSec:5,dampingRatio:1.1,requiresPower:true,lossBehavior:'hold'};
   const entry=registryProfiles.get(route.spriteId);
   if(profileRegistry&&(!entry||entry.faceId!==route.faceId||!entry.response||entry.approvedForOperationalMotion))
    throw Error('Unverified stage9 response profile for '+route.spriteId);
   const profile=entry?entry.response:trainingProfile;
   drivers.set(route.spriteId,{route,compiled,profile,
     motion:dynamics.create({id:route.spriteId,profile,limits:{minAngleDeg:a,maxAngleDeg:b}})});
  }
  let priorTimeMs=null,priorObservationNowMs=null;
  function evaluate(pointerSnapshot,{nowMs=null,observationNowMs=null}={}){
   if(pointerSnapshot?.schema!=='b737.stage8.pointer-route-snapshot.v1'||
     Object.keys(pointerSnapshot.pointers||{}).length!==38)
    throw Error('Stage8 38-pointer snapshot required');
   if(nowMs!==null&&(!finite(nowMs)||nowMs<0))throw Error('Positive simulation clock required');
   if(observationNowMs!==null&&(!finite(observationNowMs)||observationNowMs<0))
    throw Error('Observed sensor wall clock invalid');
   if(nowMs!==null&&priorTimeMs!==null&&nowMs<priorTimeMs)
    throw Error('Source clock moved backward; reset workbench explicitly');
   if(observationNowMs!==null&&priorObservationNowMs!==null&&
      observationNowMs<priorObservationNowMs)
    throw Error('Observed source clock moved backward; reset workbench explicitly');
   const dt=nowMs!==null&&priorTimeMs!==null?
     Math.min(1,(nowMs-priorTimeMs)/1000):0;
   if(nowMs!==null)priorTimeMs=nowMs;
   if(observationNowMs!==null)priorObservationNowMs=observationNowMs;
   const output={},counts={total:38,geometryPreviewCapable:drivers.size,withQualifiedSignal:0,
      dynamicsEvaluated:0,blockedNoCalibration:0,missingData:0,powerUnknown:0,
      liveNeedlesMoved:0,observedRejected:0,staleObservations:0,
      replayedObservations:0};
   for(const [id,route] of Object.entries(pointerSnapshot.pointers)){
    if(!drivers.has(id)){
     output[id]=Object.freeze({status:'blocked',reason:blocked[id]||'unreviewed_geometry',
       angleDeg:null,targetAngleDeg:null,liveNeedleAuthorized:false});
     counts.blockedNoCalibration++;
     continue;
    }
    const driver=drivers.get(id),reading=route.signal;
    const observed=reading?.provenance==='OBSERVED_SENSOR_WITH_VALIDATION';
    let observedFault='none',sourceIntegrity='not_observed',observationAgeMs=null;
    if(observed){
     const at=reading.timeMs,prev=lastObserved.get(id);
     if(!finite(at)||at<0){
      observedFault='sensor_lost';sourceIntegrity='observed_timestamp_missing';
     }else if(observationNowMs===null){
      observedFault='sensor_lost';sourceIntegrity='observation_clock_missing';
     }else{
      const age=observationNowMs-at;
      if(age < -250){
       observedFault='sensor_lost';sourceIntegrity='observed_timestamp_future';
      }else if(age>observedMaxAgeMs){
       observedFault='data_stale';sourceIntegrity='observed_timestamp_stale';
       counts.staleObservations++;
      }else if(prev&&at<prev.timeMs){
       observedFault='sensor_lost';sourceIntegrity='observed_timestamp_replay';
       counts.replayedObservations++;
      }else if(prev&&at===prev.timeMs&&reading.value!==prev.value){
       observedFault='sensor_lost';sourceIntegrity='observed_timestamp_mutated';
       counts.replayedObservations++;
      }else{
       sourceIntegrity='fresh_observed';observationAgeMs=Math.max(0,age);
       lastObserved.set(id,{timeMs:at,value:reading.value});
      }
     }
     if(observedFault!=='none')counts.observedRejected++;
    }else if(reading?.provenance==='TRAINING_SIMULATION_ONLY'){
     sourceIntegrity='training_only_not_timestamp_certified';
    }
    const validSignal=!!reading?.valid&&finite(reading.value)&&
       units(reading.unit)===units(driver.compiled.unit)&&observedFault==='none';
    if(validSignal)counts.withQualifiedSignal++;
    else counts.missingData++;
    let target=null,angleTarget=null;
    if(validSignal){
     target=driver.compiled.locate(reading.value,{preview:true,outOfRange:'reject'});
     if((target.status==='preview_unverified')&&finite(target.angleDeg))
       angleTarget=target.angleDeg;
    }
    const trainingPowerAssumed=previewPowerPolicy==='training_qa_assume_power';
    const observedPower=reading?.electricalFeedStatus==='verified_equipment_feed_input'&&
       typeof reading?.powered==='boolean'?(reading.powered?'on':'off'):'unknown';
    const power=trainingPowerAssumed?'on':observedPower;
    if(power==='unknown')counts.powerUnknown++;
    const motion=driver.motion.update({
      targetAngleDeg:angleTarget,validSample:finite(angleTarget),dtSeconds:dt,
      sampleAgeMs:observationAgeMs,
      power,source:reading?.origin||route.spriteId,
      fault:observedFault!=='none'?observedFault:
       (reading?.status==='invalid_observed'?'sensor_disagree':'none')
    });
    if(finite(angleTarget))counts.dynamicsEvaluated++;
    output[id]=Object.freeze({
      status:observedFault!=='none'?motion.status:
       (finite(angleTarget)?motion.status:(target?.status||'source_unavailable')),
      sourceStatus:reading?.status||'unknown',sourceValue:validSignal?reading.value:null,
      sourceIntegrityStatus:sourceIntegrity,observedAgeMs:observationAgeMs,
      sourceUnit:reading?.unit||null,simulationAngleDeg:motion.angleDeg,
      simulationTargetDeg:motion.targetAngleDeg,
      simulatedVelocityDegPerSec:motion.velocityDegPerSec,
      sourceCandidateStatus:target?.status||null,
      previewPowerAssumed:trainingPowerAssumed,
      simulatedPowerStatus:power,
      previewOnly:true,
      liveNeedleAuthorized:false,
      spriteUnchanged:true
    });
   }
   Object.assign(results,output);
   return Object.freeze({
     schema:'b737.stage10.readonly-motion-snapshot.v1',
     counts:Object.freeze(counts),pointers:Object.freeze(output),
     releaseStatus:'RENDER_OUTPUT_BLOCKED_STAGE3_6_PIXEL_CERTIFICATION',
     previewPowerPolicy
   });
  }
  function reset(){
   priorTimeMs=null;priorObservationNowMs=null;lastObserved.clear();
   for(const x of drivers.values())x.motion.reset();
   for(const k of Object.keys(results))delete results[k];
  }
  return Object.freeze({evaluate,reset,getPreparedModels:()=>Object.freeze({count:drivers.size,
    ids:Object.freeze([...drivers.keys()])}),getLast:()=>Object.freeze({...results})});
 }
 return Object.freeze({create});
});
