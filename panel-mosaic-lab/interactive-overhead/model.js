(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.B737OverheadToggleModel=api;})(typeof globalThis==='undefined'?null:globalThis,function(){
 'use strict';
 function mapPoint(control,placement){
  const [sw,sh]=placement.sourceDimensions;
  const region=placement.sourceRect||{x:0,y:0,w:sw,h:sh};
  const crop=placement.contentCrop||{left:0,top:0,right:0,bottom:0};
  const inset=placement.artInset||{};
  const left=inset.left||0,top=inset.top||0;
  const width=placement.w-left-(inset.right||0),height=placement.h-top-(inset.bottom||0);
  const sx=width/(region.w-crop.left-crop.right);
  let sy=height/(region.h-crop.top-crop.bottom);
  const [x,y]=control.sourcePoint;
  if(x<region.x+crop.left||x>region.x+region.w-crop.right||y<region.y+crop.top||y>region.y+region.h-crop.bottom)throw Error('Socket outside source crop: '+control.id);
  let targetY=(y-region.y-crop.top)*sy;
  if(placement.rowRegistration){
   const rows=placement.rowRegistration;
   const index=rows.findIndex((a,i)=>i<rows.length-1&&y>=a.sourceY&&y<=rows[i+1].sourceY);
   if(index<0)throw Error('Socket outside registered rows: '+control.id);
   const a=rows[index],b=rows[index+1];sy=(b.targetY-a.targetY)/(b.sourceY-a.sourceY);targetY=a.targetY+(y-a.sourceY)*sy;
  }
  return {x:placement.x+left+(x-region.x-crop.left)*sx,y:placement.y+top+targetY,diameter:control.bezelSourceDiameter*sx};
 }
 function validate(registry,layout){
  const ids=new Set(),placements=new Map(layout.placements.map(p=>[p.id,p]));
  for(const c of registry.controls){
   if(ids.has(c.id))throw Error('Duplicate toggle: '+c.id);ids.add(c.id);
   if(c.states.length!==(c.type==='toggle-2'?2:3)||!c.states.includes(c.default))throw Error('Invalid detents: '+c.id);
   if(!['vertical','horizontal'].includes(c.axis)||(c.type==='toggle-3-horizontal')!==(c.axis==='horizontal'))throw Error('Invalid movement axis: '+c.id);
   if(!placements.has(c.placementId))throw Error('Unknown plate: '+c.id);
   for(const [from,to]of Object.entries(c.springReturn||{}))if(!c.states.includes(from)||!c.states.includes(to))throw Error('Invalid return: '+c.id);
   mapPoint(c,placements.get(c.placementId));
  }
  return true;
 }
 function controller(registry,saved={},notify=()=>{}){
  const definitions=new Map(registry.controls.map(c=>[c.id,c])),state={};
  for(const c of definitions.values()){
   const restored=c.states.includes(saved[c.id])?saved[c.id]:c.default;
   state[c.id]=c.springReturn?.[restored]||restored;
  }
  function set(id,next,reason='set'){
   const c=definitions.get(id);if(!c||!c.states.includes(next))return false;
   const previous=state[id];if(previous===next)return false;
   state[id]=next;notify({id,previous,next,reason,type:c.type,axis:c.axis});return true;
  }
  function step(id,delta,reason='step'){
   const c=definitions.get(id);if(!c)return false;
   return set(id,c.states[Math.max(0,Math.min(c.states.length-1,c.states.indexOf(state[id])+Math.sign(delta)))],reason);
  }
  function release(id,reason='spring-return'){
   const c=definitions.get(id),next=c?.springReturn?.[state[id]];return next?set(id,next,reason):false;
  }
  function releaseAll(){for(const id of definitions.keys())release(id);}
  function cycle(id){const c=definitions.get(id);return c?set(id,c.states[(c.states.indexOf(state[id])+1)%c.states.length],'activate'):false;}
  function reset(){for(const c of definitions.values())set(c.id,c.default,'reset');}
  return {set,step,release,releaseAll,cycle,reset,get:id=>state[id],snapshot:()=>({...state})};
 }
 return Object.freeze({mapPoint,validate,controller});
});
