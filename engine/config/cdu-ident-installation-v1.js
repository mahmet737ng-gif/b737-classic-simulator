/* Shared Unified Settings -> dual CDU IDENT installation mapping.
 * This is an explicitly selected TRAINER configuration; it does not certify
 * S/N 29340's real engine installation, FMC software, or AFM performance.
 */
(function(root,factory){'use strict';const a=factory();
 if(typeof module==='object'&&module.exports)module.exports=a;
 if(root)root.B737CDUIdentInstallationV1=a;
})(typeof globalThis!=='undefined'?globalThis:null,function(){
 'use strict';
 const VERSION='CDU-ENGINE-IDENT-0001';
 const RATINGS=Object.freeze({
  'CFM56-3B1':Object.freeze({label:'CFM56-3 B1',rating:'18.5K',ratingLbf:18500}),
  'CFM56-3B3':Object.freeze({label:'CFM56-3 B3',rating:'20K',ratingLbf:20000}),
  'CFM56-3C1':Object.freeze({label:'CFM56-3 C1',rating:'23.5K',ratingLbf:23500})
 });
 const MODELS=Object.freeze(['737-300','737-400','737-500']);
 const family=model=>model==='737-400'?'B737-400':'B737-300-500';
 function select(profile){
  const model=profile?.aircraftModel,variant=profile?.engineVariant;
  if(!MODELS.includes(model)||!Object.hasOwn(RATINGS,variant))
   throw Error('INVALID_TRAINER_INSTALLATION');
  if(profile.aircraftFamily&&profile.aircraftFamily!==family(model))
   throw Error('INCONSISTENT_AIRCRAFT_MODEL_AND_FAMILY');
  const engine=RATINGS[variant];
  return Object.freeze({version:VERSION,aircraftModel:model,aircraftFamily:family(model),
   engineVariant:variant,engineLabel:engine.label,engineRating:engine.rating,
   ratingLbf:engine.ratingLbf,provenance:'USER_SELECTED_TRAINER_CONFIGURATION',
   MODEL:Object.freeze({quality:'VALID',origin:'SELECTED_TRAINER_AIRCRAFT_MODEL',value:model}),
   ENG_RATING:Object.freeze({quality:'VALID',origin:'SELECTED_TRAINER_ENGINE_RATING',value:engine.rating})
  });
 }
 function verify(value){
  try{
   if(!value||value.version!==VERSION||
      value.provenance!=='USER_SELECTED_TRAINER_CONFIGURATION')return false;
   const expected=select(value);
   return ['aircraftModel','aircraftFamily','engineVariant','engineLabel','engineRating','ratingLbf'].every(k=>value[k]===expected[k])&&
      ['MODEL','ENG_RATING'].every(k=>['quality','origin','value'].every(f=>value[k]?.[f]===expected[k][f]));
  }catch{return false;}
 }
 return Object.freeze({VERSION,RATINGS,MODELS,select,verify});
});
