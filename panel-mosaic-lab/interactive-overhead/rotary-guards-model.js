(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.B737RotaryGuardModel=api;})(typeof globalThis==='undefined'?null:globalThis,function(){
 'use strict';
 const copy=x=>JSON.parse(JSON.stringify(x));
 function detentAngles(c){
  if(!c.panelMarks)return c.angles;
  const [px,py]=c.panelPivot;
  return c.panelMarks.map(([x,y])=>Math.atan2(x-px,py-y)*180/Math.PI-(c.pointerZero||0));
 }
 function angle(c,value){return c.mode==='continuous'?c.angleMin+(value-c.min)/(c.max-c.min)*(c.angleMax-c.angleMin):detentAngles(c)[c.states.indexOf(value)];}
 function nearest(c,degrees){const a=detentAngles(c);let index=0;for(let i=1;i<a.length;i++)if(Math.abs(a[i]-degrees)<Math.abs(a[index]-degrees))index=i;return c.states[index];}
 function normalize(c,value){
  if(c.mode!=='continuous')return c.states.includes(value)?value:c.default;
  if(typeof value!=='number'||!Number.isFinite(value))return c.default;
  if(c.wrap){const span=c.max-c.min+c.step;value=((value-c.min)%span+span)%span+c.min;}
  return Math.max(c.min,Math.min(c.max,Math.round((value-c.min)/c.step)*c.step+c.min));
 }
 function validate(registry,layout,mapPoint){
  const ids=new Set(),slots=new Map(layout.placements.map(p=>[p.id,p]));
  for(const c of [...registry.rotaries,...registry.guards]){
   if(ids.has(c.id))throw Error('Duplicate rotary/guard: '+c.id);ids.add(c.id);
   if(!slots.has(c.placementId))throw Error('Unknown plate: '+c.id);mapPoint(c,slots.get(c.placementId));
   if(c.kind==='rotary'){
    if(c.mode==='continuous'){if(!(c.min<c.max&&c.step>0&&c.angleMin<c.angleMax))throw Error('Invalid rotary range: '+c.id);}
    else {
     const a=detentAngles(c);
     if(!c.states.includes(c.default)||c.states.length!==a.length||a.some((v,i)=>!Number.isFinite(v)||(i&&v<=a[i-1])))throw Error('Invalid rotary detents: '+c.id);
     if(c.panelMarks&&(!Array.isArray(c.panelPivot)||c.panelPivot.length!==2||c.panelPivot.some(v=>!Number.isFinite(v))||c.panelMarks.some(p=>!Array.isArray(p)||p.length!==2||p.some(v=>!Number.isFinite(v)))))throw Error('Invalid calibration marks: '+c.id);
     if(c.panelMarks&&c.angles.some((v,i)=>Math.abs(v-a[i])>.6))throw Error('Stale detent calibration: '+c.id);
    }
   }else if(!c.states.includes(c.default.value)||(!c.closePolicy.preserve&&!c.states.includes(c.closePolicy.force)))throw Error('Missing per-control guard policy: '+c.id);
  }
  return true;
 }
 function controller(registry,saved={},notify=()=>{},mechanics){
  const rotaries=new Map(registry.rotaries.map(c=>[c.id,c])),guards=new Map(registry.guards.map(c=>[c.id,c]));
  const state={rotaries:{},guards:{}};
  for(const c of rotaries.values())state.rotaries[c.id]=normalize(c,saved.rotaries?.[c.id]??c.default);
  for(const c of guards.values()){
   const v=saved.guards?.[c.id];let value=c.states.includes(v?.value)?v.value:c.default.value;
   const guard=['open','closed'].includes(v?.guard)?v.guard:c.default.guard;
   if(guard==='closed'&&c.closePolicy.force)value=c.closePolicy.force;
   state.guards[c.id]={value,guard};
  }
  function setRotary(id,value,reason='set'){
   const c=rotaries.get(id);if(!c||(c.mode!=='continuous'&&!c.states.includes(value))||(c.mode==='continuous'&&(typeof value!=='number'||!Number.isFinite(value))))return false;
   const next=normalize(c,value),previous=state.rotaries[id];if(next===previous)return false;
   state.rotaries[id]=next;notify({id,kind:'rotary',previous,next,reason});return true;
  }
  function stepRotary(id,delta,reason='step'){
   const c=rotaries.get(id);if(!c)return false;
   return setRotary(id,c.mode==='continuous'?state.rotaries[id]+Math.sign(delta)*c.step:c.states[Math.max(0,Math.min(c.states.length-1,c.states.indexOf(state.rotaries[id])+Math.sign(delta)))],reason);
  }
  function turnRotary(id,degrees){
   const c=rotaries.get(id);if(!c)return false;
   return setRotary(id,c.mode==='continuous'?c.min+(degrees-c.angleMin)/(c.angleMax-c.angleMin)*(c.max-c.min):nearest(c,degrees),'drag');
  }
  function cycleRotary(id){return stepRotary(id,1,'tap');} // hard stop; no detent wrap
  function guardAction(id,action,value){
   const c=guards.get(id);if(!c)return {ok:false,reason:'UNKNOWN_CONTROL'};
   const previous=state.guards[id];let result;
   if(c.mechanicsId){
    if(!mechanics)return {ok:false,reason:'MECHANICS_UNAVAILABLE'};
    result=mechanics.guardTransition(c.mechanicsId,previous,action,value);
   }else if(action==='open')result={ok:true,state:{...previous,guard:'open'}};
   else if(action==='close')result={ok:true,state:{value:c.closePolicy.force||previous.value,guard:'closed'}};
   else if(action==='set')result=previous.guard!=='open'?{ok:false,reason:'GUARD_CLOSED'}:!c.states.includes(value)?{ok:false,reason:'INVALID_DETENT'}:{ok:true,state:{value,guard:'open'}};
   else result={ok:false,reason:'UNKNOWN_ACTION'};
   if(!result.ok)return result;
   const next=result.state;if(previous.value===next.value&&previous.guard===next.guard)return {ok:true,state:copy(next)};
   state.guards[id]=next;notify({id,kind:'guarded',previous:copy(previous),next:copy(next),reason:action});return {ok:true,state:copy(next)};
  }
  function reset(){
   for(const c of rotaries.values())setRotary(c.id,c.default,'reset');
   for(const c of guards.values()){
    const previous=state.guards[c.id],next=copy(c.default);state.guards[c.id]=next;
    notify({id:c.id,kind:'guarded',previous:copy(previous),next:copy(next),reason:'reset'});
   }
  }
  return {setRotary,stepRotary,turnRotary,cycleRotary,guardAction,reset,rotary:id=>state.rotaries[id],guard:id=>copy(state.guards[id]),angle:id=>angle(rotaries.get(id),state.rotaries[id]),snapshot:()=>copy(state)};
 }
 return Object.freeze({angle,detentAngles,nearest,normalize,validate,controller});
});
