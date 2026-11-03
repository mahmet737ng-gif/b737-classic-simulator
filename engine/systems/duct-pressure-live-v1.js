/* B737 Classic OH21 two-duct functional TRAINER only.
 * One existing ECU/FCOM discrete Pneumatics V6 owns engine, bleed and pack
 * states. This module estimates indicated pressure under air consumers;
 * it does not invent a certified bleed mass-flow / engine performance model.
 * A valid explicit PSI sensor always overrides the estimate.
 */
(function(root,factory){
 'use strict';const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.B737DuctPressureLiveV1=api;
})(typeof globalThis==='object'?globalThis:null,function(){
 'use strict';
 const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
 const finite=v=>typeof v==='number'&&Number.isFinite(v);
 const SETTINGS=Object.freeze({
  packAutoEquivalentPsi:2.2,packHighEquivalentPsi:4.0,
  engineTaiEquivalentPsi:1.8,wingTaiEquivalentPsi:4.0,
  starterEquivalentPsi:12.0,sharedManifoldLossPsi:0.8,
  groundAirNominalPsi:30,oneSourceMaxSagPsi:25,
  maxRisePsiPerSec:13,maxFallPsiPerSec:17,
  maxNeedleAccelerationPsiPerSec2:70,
  needleNaturalFrequencyRadPerSec:3.5
 });
 const switchOn=value=>value===true||String(value||'').trim().toUpperCase()==='ON';
 function enginePressure(engine,open){
  if(open!==true||!engine||engine.phase!=='RUNNING'||!finite(engine.n1Percent))return 0;
  const n=clamp(engine.n1Percent,0,105);
  if(n<18)return 0;
  // Simplified 9th-stage idle support and regulated 5th-stage higher N1.
  if(n<28)return 24+(n-18)*0.8;
  if(n<55)return 32+(n-28)*(10/27);
  return 42;
 }
 function determinePack(side,controls,pack){
  const key=side==='L'?'pack-l':'pack-r';
  const selected=controls?.[key]||controls?.['pack'+side]||pack?.[side]?.selectedMode||'OFF';
  const trip=pack?.[side]?.tripOff===true||pack?.[side]?.operational===false;
  const flow=pack?.[side]?.flow;
  const effective=selected==='OFF'||trip?'OFF':selected==='HIGH'||flow==='HIGH'||flow==='APU_HIGH'?'HIGH':'AUTO';
  return {selected,effective,equivalentPsi:effective==='HIGH'?SETTINGS.packHighEquivalentPsi:
   effective==='AUTO'?SETTINGS.packAutoEquivalentPsi:0};
 }
 function project({ecu,bleed,controls={},pack=null,antiIce=null,starterValves=null,
  sensors=null,gaugePowered=true}={}){
  if(!ecu?.engines||!bleed)throw Error('ECU engines and actual pneumatic valve state required');
  const e1=enginePressure(ecu.engines.engine1,bleed.engine1ValveOpen);
  const e2=enginePressure(ecu.engines.engine2,bleed.engine2ValveOpen);
  const apu=bleed.apuBleedValveOpen===true&&ecu.apu?.phase==='READY'?35:0;
  // External cart input is an existing discrete; 30 PSI is training-only.
  const ground=bleed.externalAirAttached===true?SETTINGS.groundAirNominalPsi:0;
  const packs={L:determinePack('L',controls,pack),R:determinePack('R',controls,pack)};
  const engineTai={
   L:switchOn(antiIce?.engine1??controls['engine-anti-ice-1']),
   R:switchOn(antiIce?.engine2??controls['engine-anti-ice-2'])
  };
  const wingTai=switchOn(antiIce?.wing??controls['wing-anti-ice']);
  const starts={
   L:starterValves?.L===true||starterValves?.engine1===true,
   R:starterValves?.R===true||starterValves?.engine2===true
  };
  // Cowl TAI is engine-compressor-sourced; with bleed OFF it must not
  // conjure duct pressure. Wing TAI and starters require duct air.
  const loads={};
  for(const side of ['L','R']){
   const engine=side==='L'?e1:e2;
   const localSource=side==='L'?Math.max(e1,apu):Math.max(e2,ground);
   loads[side]={
    pack:packs[side].equivalentPsi,
    starter:starts[side]?SETTINGS.starterEquivalentPsi:0,
    wingTAI:wingTai?SETTINGS.wingTaiEquivalentPsi:0,
    engineTAI:engine>0&&engineTai[side]?SETTINGS.engineTaiEquivalentPsi:0,
    sourcePsi:localSource
   };
   loads[side].total=loads[side].pack+loads[side].starter+
    loads[side].wingTAI+loads[side].engineTAI;
  }
  let L=loads.L.sourcePsi,R=loads.R.sourcePsi;
  if(bleed.isolationOpen===true){
   const sharedSource=Math.max(L,R);
   if(sharedSource>0){
    // Dual engines share demand with greater flow capacity than one source.
    // This is a static analogue, not a pressure-vs-mass-flow curve.
    const sourceCount=Number(L>0)+Number(R>0);
    const sharingFactor=sourceCount===2?1.7:1;
    const base=sharedSource-SETTINGS.sharedManifoldLossPsi;
    const sag=Math.min(SETTINGS.oneSourceMaxSagPsi,
     (loads.L.total+loads.R.total)/sharingFactor);
    L=Math.max(0,base-sag);R=L;
   }else{L=0;R=0;}
  }else{
   L=L>0?Math.max(0,L-Math.min(SETTINGS.oneSourceMaxSagPsi,loads.L.total)):0;
   R=R>0?Math.max(0,R-Math.min(SETTINGS.oneSourceMaxSagPsi,loads.R.total)):0;
  }
  const out={L:Math.round(clamp(L,0,100)*10)/10,
   R:Math.round(clamp(R,0,100)*10)/10,
   source:'TRAINING_ESTIMATE',quality:'NOT_MEASURED',
   isolationOpen:bleed.isolationOpen,
   engineSources:{L:e1,R:e2},apuSource:apu,groundSource:ground,
   packModes:{L:packs.L.effective,R:packs.R.effective},
   loads,consumers:{starter:{...starts},engineTAI:{...engineTai},wingTAI},
   assumptions:'EQUIVALENT_PSI_LOAD_PROXY_NOT_ACTUAL_BLEED_PRESSURE_DROP'
  };
  for(const side of ['L','R']){
   if(finite(sensors?.[side])&&sensors[side]>=0){
    out[side]=clamp(sensors[side],0,100);
    out.source='MIXED_OR_MEASURED';
    out.quality='EXPLICIT_SENSOR_HAS_PRIORITY';
   }
  }
  // No claim that the electrical bus circuit is verified. Use explicit
  // existing Pneumatics V6 availability input only.
  if(gaugePowered===false){out.L=null;out.R=null;out.source='UNPOWERED_INDICATOR';}
  return out;
 }
 function initialDynamics(pressure={L:0,R:0}){
  const norm=side=>clamp(finite(pressure[side])?pressure[side]:0,0,100);
  return {L:{value:norm('L'),velocity:0},R:{value:norm('R'),velocity:0}};
 }
 // Critically damped, rate- and acceleration-limited inertial needle.
 // Per-frame integration runs at <= 20ms substeps to avoid jumps or
 // unpredictable changes from a 100ms ECU update cadence.
 function advanceDynamics(previous,target,dtMs){
  if(!previous?.L||!previous?.R)throw Error('Needle dynamics state missing');
  if(!finite(dtMs)||dtMs<0)throw Error('Invalid pressure dynamics elapsed time');
  const dt=clamp(dtMs,0,1000);
  const next={};
  for(const side of ['L','R']){
   let value=clamp(previous[side].value,0,100);
   let velocity=finite(previous[side].velocity)?previous[side].velocity:0;
   const goal=finite(target?.[side])?clamp(target[side],0,100):value;
   let remaining=dt/1000;
   while(remaining>1e-8){
    const step=Math.min(0.02,remaining);remaining-=step;
    const delta=goal-value;
    const omega=SETTINGS.needleNaturalFrequencyRadPerSec;
    const accel=clamp(omega*omega*delta-2*omega*velocity,
     -SETTINGS.maxNeedleAccelerationPsiPerSec2,SETTINGS.maxNeedleAccelerationPsiPerSec2);
    velocity+=accel*step;
    velocity=clamp(velocity,-SETTINGS.maxFallPsiPerSec,SETTINGS.maxRisePsiPerSec);
    const moved=value+velocity*step;
    // Never oscillate past target — a real indicator settles without a bounce.
    if((goal-value)*(goal-moved)<0){value=goal;velocity=0;}
    else value=clamp(moved,0,100);
    if(Math.abs(goal-value)<0.025&&Math.abs(velocity)<0.18){
     value=goal;velocity=0;
    }
   }
   next[side]={value,velocity};
  }
  return next;
 }
 function settled(state,target){
  return ['L','R'].every(side=>!finite(target?.[side])||
   (Math.abs(state[side].value-target[side])<0.035&&Math.abs(state[side].velocity)<0.19));
 }
 return Object.freeze({SETTINGS,enginePressure,determinePack,project,
  initialDynamics,advanceDynamics,settled});
});
