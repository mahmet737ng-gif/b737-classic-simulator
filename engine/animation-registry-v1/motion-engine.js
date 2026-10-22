/* Reusable B737 Classic motion driver. Aircraft logic is external; animation cannot bypass an interlock. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;root.B737_MOTION=api;})(typeof globalThis==='object'?globalThis:this,function(){
'use strict';
const clamp=(x,a,b)=>Math.min(b,Math.max(a,x));
function createRegistryEngine(registry){
 if(!registry?.panels)throw Error('Missing animation registry');
 const defs=new Map(),states=new Map(),views=new Map(),listeners=new Map();
 for(const panel of Object.values(registry.panels))for(const d of panel.controls){if(defs.has(d.id))throw Error('Duplicate '+d.id);defs.set(d.id,d);const s=d.state_model;
  states.set(d.id,{value: s.initial??(s.kind==='detents'?s.values[0]:s.kind==='latched'?false:s.kind==='momentary'?'released':0),turns:0,pressed:false,angle:0});}
 function read(id){if(!states.has(id))throw Error('Unregistered control: '+id);return {...states.get(id)};}
 function spec(id){const d=defs.get(id);if(!d)throw Error('Unregistered control: '+id);return d;}
 function subscribe(id,fn){const set=listeners.get(id)||new Set();set.add(fn);listeners.set(id,set);return ()=>set.delete(fn);}
 function emit(id){const state=read(id);for(const fn of listeners.get(id)||[])fn(state,spec(id));}
 function _animateVisual(id,previous){
  const d=spec(id),st=states.get(id),v=views.get(id);if(!v)return;
  const el=v.element,style=d.motion.style;
  if(style==='rotate'||style==='tilt'){
   const rot=v.angleForState?v.angleForState(st.value,st,d): (d.state_model.kind==='detents'?d.state_model.values.indexOf(st.value)*(d.motion.preview_step_degrees??12): st.turns*(d.motion.preview_step_degrees??12));
   if(!Number.isFinite(rot))throw Error('Invalid animation angle '+id);
   st.angle=rot;
   const px=(d.motion.style==='tilt'?'rotateX':'rotate')+'('+rot+'deg)';
   const dur=v.reducedMotion?0:d.motion.duration_ms;
   el.style.transition=`transform ${dur}ms ${d.motion.easing}`;
   el.style.transform=px;
  }else if(style==='press'){
    el.style.transition=`transform ${v.reducedMotion?0:70}ms ease-out, filter ${v.reducedMotion?0:100}ms ease-out`;
    el.style.transform=st.pressed?'translateY(1.5px) scale(0.96)':'translateY(0px) scale(1)';
    el.style.filter=st.pressed?'brightness(0.82)':'brightness(1)';
  }
 }
 function attach(id,element,options={}){
  spec(id);if(!element?.style)throw Error('Target has no style');
  views.set(id,{element,reducedMotion:!!options.reducedMotion,angleForState:options.angleForState});
  _animateVisual(id);return {dispose:()=>views.delete(id)};
 }
 function input(id,event,direction=1){
  const d=spec(id),st=states.get(id),s=d.state_model;
  if(!['step','press','release','select'].includes(event))throw Error('Unknown event '+event);
  if(event==='press'){
   st.pressed=true;
   if(s.kind==='latched')st.value=!st.value;
  }else if(event==='release'){
   st.pressed=false;
  }else if(event==='step'){
   const sign=Math.sign(direction);if(!sign)return read(id);
   if(s.kind==='detents'){
    const idx=s.values.indexOf(st.value);const next=(s.wrap ? (idx+sign+s.values.length)%s.values.length : clamp(idx+sign,0,s.values.length-1));
    st.value=s.values[next];
   }else if(s.kind==='relative'){
    const dynamicVS=id==='MCP.VS_THUMBWHEEL' ? (Math.abs(st.value)>=1000?100:50) : null;
    const delta=(dynamicVS??s.step??1)*sign;
    if(s.initial==null && s.min==null && s.max==null)st.value+=sign;
    else st.value=clamp(st.value+delta,s.min??-Infinity,s.max??Infinity);
    st.turns+=sign;
   }else if(s.kind==='latched')st.value=!st.value;
   else if(s.kind==='momentary')st.pressed=true;
  }else if(event==='select'){
   if(s.kind==='detents'){if(!s.values.some(v=>v===direction))throw Error('Not valid state '+direction);st.value=direction;}
   else if(s.kind==='latched'){if(typeof direction!=='boolean')throw Error('Boolean state required');st.value=direction;}
   else if(s.kind==='relative'){if(!Number.isFinite(direction))throw Error('Number required');st.value=clamp(direction,s.min??-Infinity,s.max??Infinity);}
   else throw Error('Cannot select momentary state');
  }
  _animateVisual(id);emit(id);return read(id);
 }
 function press(id){input(id,'press');return ()=>input(id,'release');}
 function setViewReducedMotion(id,on){const v=views.get(id);if(v)v.reducedMotion=on;}
 function reset(){for(const [id,d]of defs){const s=d.state_model;states.set(id,{value:s.initial??(s.kind==='detents'?s.values[0]:s.kind==='latched'?false:s.kind==='momentary'?'released':0),turns:0,pressed:false,angle:0});_animateVisual(id);emit(id)}}
 return {spec,read,subscribe,attach,input,press,reset,setViewReducedMotion,size:defs.size,ids:[...defs.keys()]};
}
return {createRegistryEngine};
});