/* ISN-14 APU governed-load trainer. Estimated per-consumer kVA; no verified
 * B737 Classic installation WDM/feeder map or APU fuel/governor performance.
 * Electrical source ownership remains with ISN electrical V7/Pack; these
 * projections DO NOT select a generator or assert aircraft measured sensors.
 */
(function(root,factory){'use strict';const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.B737ISNAPULoadDynamicsV1=api;})(typeof globalThis!=='undefined'?globalThis:null,function(){
 'use strict';
 const ORIGIN='SIM_APU_LOAD_ESTIMATE_NOT_FCOM_CALIBRATED';
 const CATALOG=Object.freeze({
  AVIONICS:Object.freeze({side:1,kva:8,label:'Avionics (training)'}),
  CABIN_LIGHTS:Object.freeze({side:1,kva:3,label:'Cabin lights (training)'}),
  GALLEY:Object.freeze({side:2,kva:16,label:'Galley (training)'}),
  AIR_CONDITIONING_FANS:Object.freeze({side:2,kva:10,label:'Air conditioning fans (training)'})
 });
 const CONFIG=Object.freeze({ratedKva:90,baseEGTC:390,maxElectricalEGTRiseC:130,
  bleedEGTRiseC:55,baseFuelKgHr:110,electricalFuelRiseKgHr:85,
  bleedFuelRiseKgHr:38,loadResponseMs:2500,egtResponseMs:6000,
  rpmRatedPct:95.5,rpmDroopPerRatedStepPct:0.35,rpmDroopRecoveryMs:2400,
  fuelResponseMs:4000,pumpFuelKva:1.4,pumpHydKva:10});
 const round=(x,d=2)=>Number(x.toFixed(d));
 const clip=(x,a,b)=>Math.max(a,Math.min(b,x));
 const smooth=(a,b,dt,tau)=>b+(a-b)*Math.exp(-dt/tau);
 function initial(){return {electricalKva:0,bleedFraction:0,egtC:CONFIG.baseEGTC,
  fuelFlowKgHr:CONFIG.baseFuelKgHr,rpmDeviationPct:0,lastTargetKva:0};}
 function demand({selectedSources={},switches={},bleedValveOpen=false,pumpSnapshot=null}={}){
  const sides=[1,2].filter(side=>selectedSources[side]==='APU');
  const contributing=[];
  for(const [id,item] of Object.entries(CATALOG)){
   if(switches[id]===true&&sides.includes(item.side))
    contributing.push({id,kva:item.kva,side:item.side,origin:'EXPLICIT_TRAINER_CONSUMER_ASSUMPTION'});
  }
  // Only count the existing Pack pumps where instructor TRAINING_SURROGATE
  // explicitly assigned a bus. The actual feeder bus stays source-UNKNOWN.
  if(pumpSnapshot?.mode==='TRAINING_SURROGATE'){
   const transferSource=pumpSnapshot.electrical?.feed?.transferSource??{};
   for(const [id,p] of Object.entries(pumpSnapshot.pumps??{})){
    if(p.operating!==true||!/^transfer[12]$/.test(p.sourceBus??''))continue;
    const generatorFeed=transferSource[p.sourceBus];
    const selectedSide=generatorFeed==='GENERATOR_BUS_1'?1:generatorFeed==='GENERATOR_BUS_2'?2:null;
    if(!selectedSide||!sides.includes(selectedSide))continue;
    const kva=id.startsWith('hyd.')?CONFIG.pumpHydKva:CONFIG.pumpFuelKva;
    contributing.push({id,kva,side:selectedSide,origin:'INSTRUCTOR_SURROGATE_BUS_NOT_WDM_VERIFIED'});
   }
  }
  return {kva:round(contributing.reduce((sum,x)=>sum+x.kva,0)),
   bleedOn:bleedValveOpen===true,connectedBuses:sides,contributing,
   provenance:ORIGIN};
 }
 function step(prior,load,dtMs){
  if(!prior||!load||!Number.isFinite(dtMs)||dtMs<0||dtMs>120000)
   throw Error('Valid load, APU governor state and nonnegative elapsed time required');
  const targetKva=clip(load.kva,0,CONFIG.ratedKva);
  const delta=targetKva-prior.lastTargetKva;
  const droop=clip(prior.rpmDeviationPct-
   Math.max(0,delta)/CONFIG.ratedKva*CONFIG.rpmDroopPerRatedStepPct+
   Math.max(0,-delta)/CONFIG.ratedKva*.08,-.42,.1);
  const rpmDeviationPct=smooth(droop,0,dtMs,CONFIG.rpmDroopRecoveryMs);
  const electricalKva=smooth(prior.electricalKva,targetKva,dtMs,CONFIG.loadResponseMs);
  const bleedFraction=smooth(prior.bleedFraction,load.bleedOn?1:0,dtMs,CONFIG.loadResponseMs);
  const electricalFraction=clip(electricalKva/CONFIG.ratedKva,0,1);
  const egtTarget=CONFIG.baseEGTC+CONFIG.maxElectricalEGTRiseC*electricalFraction+
   CONFIG.bleedEGTRiseC*bleedFraction;
  const fuelTarget=CONFIG.baseFuelKgHr+CONFIG.electricalFuelRiseKgHr*electricalFraction+
   CONFIG.bleedFuelRiseKgHr*bleedFraction;
  return {electricalKva,bleedFraction,egtC:smooth(prior.egtC,egtTarget,dtMs,CONFIG.egtResponseMs),
   fuelFlowKgHr:smooth(prior.fuelFlowKgHr,fuelTarget,dtMs,CONFIG.fuelResponseMs),
   rpmDeviationPct,lastTargetKva:targetKva};
 }
 function project(state,load){
  const electricalRatio=clip(state.electricalKva/CONFIG.ratedKva,0,1);
  return {loadDemandKva:load.kva,actualLoadKva:round(state.electricalKva),
   generatorLoadPercent:round(100*electricalRatio),
   powerDemandPercent:round(20+60*electricalRatio+20*state.bleedFraction),
   rpmPct:round(CONFIG.rpmRatedPct+state.rpmDeviationPct),
   egtC:round(state.egtC),fuelFlowKgHr:round(state.fuelFlowKgHr),
   connectedBuses:load.connectedBuses,consumers:load.contributing,
   ratedKvaEstimate:CONFIG.ratedKva,source:ORIGIN};
 }
 return Object.freeze({ORIGIN,CATALOG,CONFIG,initial,demand,step,project});
});
