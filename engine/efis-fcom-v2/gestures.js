/* EFIS interaction adapter: pointer/touch swipe, mouse wheel, tap, keyboard.
 * UI gesture distances are UX thresholds; they are NOT aircraft detent angles.
 * This module NEVER changes FCOM-defined controls or detent inventories.
 */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;root.EFIS_GESTURES=api;})(typeof globalThis==='object'?globalThis:this,function(){
'use strict';
const SWIPE_STEP_PX=28;
const WHEEL_STEP_PX=80;
const MAX_STEPS_PER_EVENT=8;
function attach(el,{rotary,onStep,onPress}={}){
  if(typeof onStep!=='function'||typeof onPress!=='function')throw Error('Handlers required');
  let drag=null,ignoreClick=false,wheelRemainder=0,lastWheelSign=0;
  function steps(n){const sign=Math.sign(n);for(let i=0;i<Math.min(MAX_STEPS_PER_EVENT,Math.abs(n));i++)onStep(sign);}
  function down(e){if(e.button!==undefined&&e.button!==0)return;
    ignoreClick=false;
    if(!rotary)return;
    drag={id:e.pointerId,x:e.clientX,y:e.clientY,applied:0,moved:false};
    if(e.pointerId!==undefined)el.setPointerCapture?.(e.pointerId);
  }
  function move(e){if(!rotary||!drag||(e.pointerId!==undefined&&e.pointerId!==drag.id))return;
    const dx=e.clientX-drag.x,dy=e.clientY-drag.y;
    // Vertical: swipe up = CW/next, down = CCW/previous;
    // Horizontal: swipe right = CW/next, left = CCW/previous.
    const delta=Math.abs(dy)>=Math.abs(dx)?-dy:dx;
    const total=Math.trunc(delta/SWIPE_STEP_PX);
    const diff=total-drag.applied;
    if(diff){steps(diff);drag.applied=total;drag.moved=true;}
    if(Math.max(Math.abs(dx),Math.abs(dy))>=SWIPE_STEP_PX)drag.moved=true;
    if(drag.moved)e.preventDefault?.();
  }
  function finish(e){if(!drag)return;
    if(e.pointerId!==undefined&&e.pointerId!==drag.id)return;
    ignoreClick=drag.moved;
    if(e.pointerId!==undefined&&el.hasPointerCapture?.(e.pointerId))el.releasePointerCapture?.(e.pointerId);
    drag=null;
  }
  function click(e){if(ignoreClick){ignoreClick=false;e.preventDefault?.();return;}
    if(rotary)onStep(1);else onPress();
  }
  function wheel(e){if(!rotary)return;
    e.preventDefault?.();
    const px=e.deltaY*(e.deltaMode===1?16:e.deltaMode===2?800:1);
    if(!Number.isFinite(px)||px===0)return;
    const sign=Math.sign(px);
    if(sign!==lastWheelSign){wheelRemainder=0;lastWheelSign=sign;}
    wheelRemainder+=Math.abs(px);
    const n=Math.floor(wheelRemainder/WHEEL_STEP_PX);
    if(n){steps(-sign*n);wheelRemainder-=n*WHEEL_STEP_PX;}
  }
  function context(e){if(rotary){e.preventDefault?.();onStep(-1);}}
  function keys(e){if(!rotary)return;
    if(e.key==='ArrowUp'||e.key==='ArrowRight'){e.preventDefault?.();onStep(1);}
    else if(e.key==='ArrowDown'||e.key==='ArrowLeft'){e.preventDefault?.();onStep(-1);}
  }
  const listeners=[['pointerdown',down],['pointermove',move],['pointerup',finish],['pointercancel',finish],['click',click],['wheel',wheel,{passive:false}],['contextmenu',context],['keydown',keys]];
  for(const [name,fn,opts] of listeners)el.addEventListener(name,fn,opts);
  return {dispose(){for(const [name,fn,opts]of listeners)el.removeEventListener?.(name,fn,opts);},kind:rotary?'rotary':'push'};
}
return {attach,SWIPE_STEP_PX,WHEEL_STEP_PX};
});