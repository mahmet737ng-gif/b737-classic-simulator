/* B737 Classic FIRE HANDEL visual renderer (version 1.0.0).
 * Uses only the SIX approved immutable images. Rotation is an image transform;
 * it never fires extinguishing bottles or changes aircraft systems.
 */
(function(root,factory){
  if(typeof module === 'object' && module.exports) module.exports=factory();
  else root.B737FireHandleRotation=factory();
})(typeof globalThis !== 'undefined' ? globalThis : this,function(){
  'use strict';
  const VERSION='1.0.0';
  const UNITS=Object.freeze(['APU','ENG1','ENG2']);
  const LIGHTS=Object.freeze(['ON','OFF']);
  const ANGLES=Object.freeze([-45,0,45]);
  const BASE='../panel-mosaic-lab/assets/locked/2026-10-23/';
  const SOURCES=Object.freeze({
    APU:Object.freeze({ON:BASE+'FIRE_HANDEL_APU_ON.webp',OFF:BASE+'FIRE_HANDEL_APU_OFF.webp'}),
    ENG1:Object.freeze({ON:BASE+'FIRE_HANDEL_ENG1_ON.webp',OFF:BASE+'FIRE_HANDEL_ENG1_OFF.webp'}),
    ENG2:Object.freeze({ON:BASE+'FIRE_HANDEL_ENG2_ON.webp',OFF:BASE+'FIRE_HANDEL_ENG2_OFF.webp'})
  });
  function validate(unit,angle,light){
    if(!UNITS.includes(unit)) throw new RangeError('Unknown handle: '+unit);
    if(!ANGLES.includes(angle)) throw new RangeError('Angle must be -45, 0 or +45 degrees');
    if(!LIGHTS.includes(light)) throw new RangeError('Light must be ON or OFF');
  }
  function selectAsset(unit,light){
    validate(unit,0,light); return SOURCES[unit][light];
  }
  function createState(unit,angle=0,light='OFF'){
    validate(unit,angle,light);
    return Object.freeze({unit,angle_deg:angle,light,handle_position:'IN',
      visual_only:true,discharge_command:false,
      image:selectAsset(unit,light),transform:'rotate('+angle+'deg)',
      transform_origin:'50% 50%'});
  }
  function describe(unit,angle=0,light='OFF'){
    return {asset:selectAsset(unit,light),angle_deg:angle,light,unit,
      rotation_label:angle===-45?'LEFT':angle===45?'RIGHT':'CENTER',
      state:createState(unit,angle,light)};
  }
  function allVariants(){
    return UNITS.flatMap(unit=>LIGHTS.flatMap(light=>ANGLES.map(angle=>describe(unit,angle,light))));
  }
  function controller(unit,initial={}){
    let state=createState(unit,initial.angle_deg??0,initial.light??'OFF');
    const listeners=new Set();
    function notify(previous,reason){
      const event={type:'b737:fire-handle-visual-change',previous,state,reason,
        unit:state.unit,angle_deg:state.angle_deg,light:state.light,
        handle_position:'IN',discharge_command:false};
      listeners.forEach(fn=>fn(event));
      if(typeof window!=='undefined'&&typeof window.dispatchEvent==='function'){
        window.dispatchEvent(new CustomEvent('b737:fire-handle-visual-change',{detail:event}));
      }
    }
    return Object.freeze({
      getState:()=>state,
      setAngle(angle){const next=createState(unit,angle,state.light);if(angle===state.angle_deg)return state;const prior=state;state=next;notify(prior,'ROTATE');return state;},
      setLight(light){const next=createState(unit,state.angle_deg,light);if(light===state.light)return state;const prior=state;state=next;notify(prior,'LIGHT');return state;},
      reset(){const previous=state;state=createState(unit,0,'OFF');notify(previous,'RESET');return state;},
      subscribe(fn){if(typeof fn!=='function')throw new TypeError('Listener must be a function');listeners.add(fn);return()=>listeners.delete(fn);}
    });
  }
  return Object.freeze({VERSION,UNITS,LIGHTS,ANGLES,SOURCES,createState,selectAsset,describe,allVariants,controller});
});
