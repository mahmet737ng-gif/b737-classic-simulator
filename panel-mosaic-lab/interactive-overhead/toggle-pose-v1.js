/* TGL-0005: explicit image orientation for physically vertical/horizontal switches.
 * State ordering is preserved verbatim; aircraft systems must NEVER be inverted here.
 */
(function(root,factory){
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.B737TogglePoseMap=api;
})(typeof globalThis==='undefined'?null:globalThis,function(){
 'use strict';
 const TOP='vertical-on',MIDDLE='vertical-center',BOTTOM='vertical-off';
 function frameKeys(control){
   if(control.axis==='horizontal')return ['horizontal-left','horizontal-center','horizontal-right'];
   if(control.states.length===2)return [TOP,BOTTOM]; // TOP OFF / BOTTOM ON
   if(control.states.length===3)return [TOP,MIDDLE,BOTTOM];
   throw Error('Unrecognized toggle detent count: '+control.id);
 }
 function landingFrames(control){
   // Outer lights are 3 detents (EXTEND,OFF,ON); inboard lights are OFF/ON.
   if(control.states.length===2)return [0,2]; // UP/OFF, DOWN/ON
   if(control.states.length===3)return [0,1,2];
   throw Error('Unrecognized landing-light detent count: '+control.id);
 }
 return Object.freeze({frameKeys,landingFrames});
});