/* B737 Classic low-speed instructor aerodynamics surrogate.
 * FCOM describes autoslats on TE flap 1/2/5 approaching stall and system B/PTU.
 * It does NOT supply a universal stall or shaker IAS: those require
 * aircraft/weight/CG/configuration/AoA-specific performance data.
 * The coefficients below are explicit TRAINING ASSUMPTIONS, NOT AFM/FCOM V-speeds.
 * Never publish these outputs as ADC sensor or certified FCC performance.
 */
(function(root,factory){'use strict';const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.B737ClassicLowSpeedEnvelopeV1=api;
})(typeof globalThis!=='undefined'?globalThis:null,function(){
 'use strict';
 const VERSION='B737_CLASSIC_LOW_SPEED_TRAINER_0001';
 const REF_MASS_KG=54000,AREA_M2=91.04,RHO=1.225,GRAVITY=9.80665;
 const DETENTS=Object.freeze([0,1,2,5,10,15,25,30,40]);
 // Illustrative maximum-lift schedule, NOT type-approved aerodynamic tables.
 const CL=Object.freeze([1.62,1.82,1.91,2.05,2.24,2.42,2.62,2.76,2.88]);
 const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
 const finite=x=>typeof x==='number'&&Number.isFinite(x);
 function interpolateFlap(flap){
  const n=clamp(flap,0,40);
  for(let i=1;i<DETENTS.length;i++)if(n<=DETENTS[i]){
   const k=(n-DETENTS[i-1])/(DETENTS[i]-DETENTS[i-1]);
   return CL[i-1]+k*(CL[i]-CL[i-1]);
  }
  return CL.at(-1);
 }
 function evaluate(input){
  if(!input||!finite(input.iasKt)||input.iasKt<0||input.iasKt>600||
     !finite(input.flapActual)||input.flapActual<0||input.flapActual>40||
     !DETENTS.includes(input.flapLever)||!finite(input.bankDeg)||Math.abs(input.bankDeg)>90||
     typeof input.airborne!=='boolean')throw Error('INVALID_LOW_SPEED_TRAINING_INPUT');
  const massSource=finite(input.massKg)?'OBSERVED_TRAINING_MASS':'ASSUMED_54000_KG';
  const massKg=massSource==='OBSERVED_TRAINING_MASS'?input.massKg:REF_MASS_KG;
  if(massKg<30000||massKg>75000)throw Error('INVALID_TRAINING_MASS');
  const eligible=input.airborne&&[1,2,5].includes(input.flapLever);
  const observedSlatsFull=input.slatsFull===true&&eligible;
  const computedSlatExtension=finite(input.slatExtension)?
   clamp(input.slatExtension,0,1):0;
  const slatExtension=eligible?
   Math.max(observedSlatsFull?1:0,computedSlatExtension):0;
  const slatsFull=slatExtension>=.999;
  const bank=clamp(input.bankDeg,-65,65);
  const loadFactor=1/Math.cos(bank*Math.PI/180);
  const clMax=interpolateFlap(input.flapActual)*(1+.055*slatExtension);
  const stallKt=Math.sqrt(2*massKg*GRAVITY*loadFactor/(RHO*AREA_M2*clMax))/.514444;
  // These margins are demonstrative for trainer visuals, not shaker switch values.
  const shakerKt=stallKt*1.09,minManeuverKt=stallKt*1.30;
  const threshold=input.autoSlatPreviouslyRequested===true?1.20:1.12;
  const autoSlatRequest=eligible&&input.iasKt<=shakerKt*threshold;
  const belowShaker=input.airborne&&input.iasKt<=shakerKt;
  const belowStall=input.airborne&&input.iasKt<stallKt;
  const shortfall=belowStall?clamp((stallKt-input.iasKt)/stallKt,0,.5):0;
  const sinkDemandFpm=shortfall*2300;
  const flapDragKtSec= input.airborne?(0.22*Math.pow(input.flapActual/40,1.1)+
   (.065*slatExtension)):0;
  return {schema:VERSION,source:'INSTRUCTOR_AERO_PROXY_NOT_FCOM_DATA',
   massKg,massSource,flapLever:input.flapLever,flapActual:input.flapActual,
   slatsFull,slatExtension,
   slatEffectSource:observedSlatsFull?'LE_OWNER_FULL_CONFIRMED':
    slatExtension>0?'TRAINING_AUTO_SLAT_DELAY_PROXY':'NOT_EXTENDED',
   clMax,loadFactor,stallKt,stickShakerKt:shakerKt,minimumManeuverKt:minManeuverKt,
   buffer:{lowerKt:shakerKt,upperKt:minManeuverKt},
   belowShaker,belowStall,sinkDemandFpm,flapDragKtSec,
   autoSlatRequest,autoSlatEligible:eligible,
   autoSlatTrigger:'TRAINING_IAS_LOAD_PROXY_NOT_VALIDATED_AOA',
   calibrated:false};
 }
 return Object.freeze({VERSION,REF_MASS_KG,DETENTS,evaluate,interpolateFlap});
});