/* B737 Classic OH21 dual duct PSI — functional training estimator (not a sensor).
 * Does not change Pneumatics V6, the ECU, hardware switches or protected art.
 * Explicit, valid transducer readings take priority over the estimate.
 */
(function(root,factory){
 'use strict';const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.B737DuctPressureLiveV1=api;
})(typeof globalThis==='object'?globalThis:null,function(){
 'use strict';
 const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
 const finite=v=>typeof v==='number'&&Number.isFinite(v);
 function enginePressure(engine,open){
  if(open!==true||!engine||engine.phase!=='RUNNING'||!finite(engine.n1Percent))return 0;
  const n=clamp(engine.n1Percent,0,105);
  if(n<18)return 0;
  // Approximate Classic high-stage low-N1 / 5th-stage regulated pressure.
  // 32 psig at ground idle, approaching ~42 psig with increasing N1.
  if(n<28)return 24+(n-18)*0.8;
  if(n<55)return 32+(n-28)*(10/27);
  return 42;
 }
 function project({ecu,bleed,controls,sensors,gaugePowered=true}={}){
  if(!ecu?.engines||!bleed)throw Error('ECU engines and actual pneumatic valve state required');
  const e1=enginePressure(ecu.engines.engine1,bleed.engine1ValveOpen);
  const e2=enginePressure(ecu.engines.engine2,bleed.engine2ValveOpen);
  const apu=bleed.apuBleedValveOpen===true&&ecu.apu?.phase==='READY'?35:0;
  let L=Math.max(e1,apu),R=e2;
  // On the Classic, the APU feeds the left side of the crossover manifold.
  const isolation=bleed.isolationOpen;
  if(isolation===true){
   const shared=Math.max(L,R);
   L=shared>0?Math.max(0,shared-0.8):0;
   R=L;
  }
  // Two pack demand loads are only illustrative; no duct-flow sensor exists.
  const packL=controls?.['pack-l']||controls?.packL||'OFF';
  const packR=controls?.['pack-r']||controls?.packR||'OFF';
  if(packL!=='OFF'&&L>0)L=Math.max(0,L-(packL==='HIGH'?3:1.5));
  if(packR!=='OFF'&&R>0)R=Math.max(0,R-(packR==='HIGH'?3:1.5));
  const output={L:Math.round(clamp(L,0,100)*10)/10,R:Math.round(clamp(R,0,100)*10)/10,
   source:'TRAINING_ESTIMATE',quality:'NOT_MEASURED',isolationOpen:isolation,engineSources:{L:e1,R:e2},apuSource:apu};
  for(const side of ['L','R']){
   if(finite(sensors?.[side])&&sensors[side]>=0){
    output[side]=clamp(sensors[side],0,100);
    output.source='MIXED_OR_MEASURED';
    output.quality='EXPLICIT_SENSOR_HAS_PRIORITY';
   }
  }
  if(gaugePowered===false){output.L=null;output.R=null;output.source='UNPOWERED_INDICATOR';}
  return output;
 }
 return Object.freeze({enginePressure,project});
});
