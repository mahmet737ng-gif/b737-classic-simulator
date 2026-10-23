/* SIMULATOR ONLY read-only EHSI telemetry from trusted same-origin Stage9 lab.
 * All original EFIS control artwork, rotary physics, hitboxes and navigation
 * authority are untouched. No AFDS/FMC/servo commands are emitted.
 */
(function(root,factory){
 'use strict';
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.CDU_STAGE9_ADVISORY=api;
})(typeof window==='undefined'?null:window,function(){
 'use strict';
 const SOURCE='NPE_STAGE9_SIMULATOR_REFERENCE_GUIDANCE_v1';
 function valid(v){return !!v && v.version===SOURCE && v.reference_only===true &&
  v.fmc_legs_executable===false&&v.command_authority==='SIMULATED_ADVISORY_ONLY'&&
  Array.isArray(v.aircraft_actuator_commands)&&v.aircraft_actuator_commands.length===0&&
  Array.isArray(v.afds_commands)&&v.afds_commands.length===0&&
  ['SIM_REFERENCE_TRACK','SUSPENDED','END_OF_CONTIGUOUS_GROUP','OFF','ARMED'].includes(v.mode)&&
  (v.desired_true_track_deg==null||(Number.isFinite(v.desired_true_track_deg)&&v.desired_true_track_deg>=0&&v.desired_true_track_deg<=360));}
 function safe(v){if(!valid(v))return null;
  return Object.freeze({mode:v.mode,leg_index:v.leg_index??null,
   to:String(v.to||'').slice(0,8),desired_true_track_deg:v.desired_true_track_deg??null,
   signed_cross_track_nm:Number.isFinite(v.signed_cross_track_nm)?v.signed_cross_track_nm:null,
   distance_to_fix_nm:Number.isFinite(v.distance_to_fix_nm)?v.distance_to_fix_nm:null,
   guidance:false,kind:'SIM_REFERENCE_DIAGNOSTIC'});
 }
 function render(state,svg){
  const existing=svg?.querySelector?.('[data-stage9-advisory]');existing?.remove?.();
  if(!state?.stage9Advisory||!svg||state.ehsi?.mode!=='PLAN')return {displayed:false};
  const v=state.stage9Advisory;
  const doc=svg.ownerDocument||document;const ns='http://www.w3.org/2000/svg';
  const group=doc.createElementNS(ns,'g');group.setAttribute('data-stage9-advisory','SIM_ONLY');
  svg.appendChild(group);
  function elt(type,attrs,txt){const n=doc.createElementNS(ns,type);Object.entries(attrs||{}).forEach(([k,val])=>n.setAttribute(k,String(val)));if(txt!==undefined)n.textContent=String(txt);group.appendChild(n);return n;}
  elt('rect',{x:44,y:339,width:352,height:67,rx:5,fill:'#091924',opacity:.96});
  elt('text',{x:220,y:356,'text-anchor':'middle',fill:'#ffbd7a','font-size':11},'SIM REF · '+v.mode);
  elt('text',{x:220,y:374,'text-anchor':'middle',fill:'#d7f3fa','font-size':11},
   v.to?`${v.to} · TRUE ${v.desired_true_track_deg??'---'}° · XTK ${v.signed_cross_track_nm??'---'} NM`:'REFERENCE ONLY');
  elt('text',{x:220,y:393,'text-anchor':'middle',fill:'#ffbd7a','font-size':10},'NOT LNAV / VNAV / AFDS COMMANDS');
  return {displayed:true,mode:v.mode,actuatorCommands:0};
 }
 return Object.freeze({valid,safe,render});
});
// The private Stage9 lab (same origin) can send read-only telemetry to the
// approved cockpit instrument image. This listener never changes controls.
if(typeof window!=='undefined'&&typeof window.addEventListener==='function'){
 window.addEventListener('message',event=>{
  if(event.origin!==window.location.origin||event.source!==window.parent||
     event.data?.type!=='B737_STAGE9_SIM_REFERENCE')return;
  const safe=window.CDU_STAGE9_ADVISORY?.safe(event.data?.payload);
  if(!safe)return;
  if(typeof state!=='undefined')state.stage9Advisory=safe;
  window.updateStage5View?.();
 });
}