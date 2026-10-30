/* Shared, low-overhead analogue needle motion for Unified OH12 instruments.
 * Readings own the targets; this module owns only visible angles.
 * No timer per needle: RAF runs while moving and stops at rest.
 * Native sprites, photo positions, scales and electrical logic are untouched.
 */
(function(root,factory){
 'use strict';
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.B737UnifiedNeedleMotionV1=api;
})(typeof globalThis!=='undefined'?globalThis:null,function(){
 'use strict';
 const finite=n=>typeof n==='number'&&Number.isFinite(n);
 // Closed-form critically damped spring. Retargeting preserves current velocity
 // rather than restarting an ease-out transition on every ECU update.
 function step(angle,velocity,target,seconds,omega=7){
  if(![angle,velocity,target,seconds,omega].every(finite)||
     seconds<0||omega<=0)throw Error('Invalid analogue needle motion');
  if(seconds===0)return {angle,velocity};
  const dt=Math.min(seconds,0.05);
  const displacement=angle-target,term=velocity+omega*displacement;
  const decay=Math.exp(-omega*dt);
  return {angle:target+(displacement+term*dt)*decay,
   velocity:(velocity-omega*term*dt)*decay};
 }
 function create(initial,{omega=7,epsilon=0.025,speedEpsilon=0.15,
  min=-Infinity,max=Infinity,requestFrame=null,cancelFrame=null}={}){
  if(!finite(initial)||!finite(omega)||omega<=0||
     !finite(epsilon)||epsilon<=0||!finite(speedEpsilon)||speedEpsilon<=0||
     !(min<=initial&&initial<=max))throw Error('Invalid analogue needle parameters');
  const raf=requestFrame||(typeof requestAnimationFrame==='function'?requestAnimationFrame:null);
  const caf=cancelFrame||(typeof cancelAnimationFrame==='function'?cancelAnimationFrame:null);
  if(typeof raf!=='function'||typeof caf!=='function')
   throw Error('Animation frame scheduler is required');
  let angle=initial,target=initial,velocity=0,painter=null,ticket=null,lastMs=null;
  function cancel(){
   if(ticket!==null){caf(ticket);ticket=null;}
   lastMs=null;
  }
  function schedule(){if(painter&&ticket===null)ticket=raf(frame);}
  function frame(now){
   ticket=null;
   if(!painter)return;
   if(!finite(now))throw Error('Invalid RAF timestamp');
   const gap=lastMs===null?16.667:Math.max(0,now-lastMs);
   // A background-tab pause must not turn into a several-second jump.
   if(gap>250)velocity=0;
   lastMs=now;
   const next=step(angle,velocity,target,Math.min(gap,50)/1000,omega);
   angle=Math.max(min,Math.min(max,next.angle));
   velocity=next.velocity;
   if((angle===min&&velocity<0)||(angle===max&&velocity>0))velocity=0;
   if(Math.abs(angle-target)<=epsilon&&Math.abs(velocity)<=speedEpsilon){
    angle=target;velocity=0;lastMs=null;painter(angle);return;
   }
   painter(angle);schedule();
  }
  function setTarget(next){
   if(!finite(next)||next<min||next>max)throw Error('Needle target outside instrument scale');
   if(Math.abs(next-target)<1e-9)return target;
   target=next;
   if(painter)schedule();
   return target;
  }
  function bind(fn){
   if(typeof fn!=='function')throw Error('Needle paint callback required');
   painter=fn;painter(angle);
   if(Math.abs(target-angle)>epsilon||Math.abs(velocity)>speedEpsilon)schedule();
  }
  function unbind(){cancel();painter=null;}
  function snap(next=target){
   if(!finite(next)||next<min||next>max)throw Error('Invalid needle snap');
   cancel();angle=target=next;velocity=0;
   if(painter)painter(angle);
  }
  function snapshot(){return {angle,target,velocity,moving:ticket!==null};}
  return Object.freeze({setTarget,bind,unbind,snap,snapshot});
 }
 return Object.freeze({step,create,VERSION:'NEEDLE-SMOOTH-0001'});
});
