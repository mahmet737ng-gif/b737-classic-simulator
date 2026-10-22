/* Input adapter: wheel/swipe/tap; maintains momentary press until release, suppresses ghost click. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;root.B737_POINTER=api;})(typeof globalThis==='object'?globalThis:this,function(){
'use strict';
function bind(element,engine,id,opts={}){
 const spec=engine.spec(id);const momentary=spec.state_model.kind==='momentary';const adjustable=['detents','relative'].includes(spec.state_model.kind);
 const threshold=opts.swipeThreshold??28;let down=null,wheelAcc=0,suppressClick=false;
 function pdown(e){if(e.button!==undefined&&e.button!==0)return;down={id:e.pointerId,x:e.clientX,y:e.clientY,applied:0,moved:false};if(momentary)engine.input(id,'press');try{element.setPointerCapture?.(e.pointerId)}catch{}}
 function pmove(e){if(!down || (e.pointerId!=null && e.pointerId!==down.id) || !adjustable)return;const dx=e.clientX-down.x,dy=down.y-e.clientY;const offset=(Math.abs(dx)>Math.abs(dy)?dx:dy),n=Math.trunc(offset/threshold),diff=n-down.applied;
  if(diff){for(let k=0;k<Math.min(8,Math.abs(diff));k++)engine.input(id,'step',Math.sign(diff));down.applied=n;down.moved=true;suppressClick=true;e.preventDefault?.()}}
 function pup(e){if(!down)return;if(e.pointerId!=null&&e.pointerId!==down.id)return; if(momentary)engine.input(id,'release');down=null;}
 function cancel(e){pup(e)}
 function click(e){if(suppressClick){suppressClick=false;e.preventDefault?.();return;} if(momentary){if(!down){engine.input(id,'press');engine.input(id,'release')}return;} if(adjustable)engine.input(id,'step',1);else engine.input(id,'press');}
 function wheel(e){if(!adjustable)return;e.preventDefault?.(); const sign=-Math.sign(e.deltaY); if(!sign)return; const pixels=Math.abs(e.deltaY)*(e.deltaMode===1?16:e.deltaMode===2?800:1);wheelAcc+=pixels;const n=Math.min(8,Math.floor(wheelAcc/80));if(n){for(let k=0;k<n;k++)engine.input(id,'step',sign);wheelAcc-=n*80;}}
 function key(e){if(['ArrowUp','ArrowRight'].includes(e.key)){e.preventDefault?.();engine.input(id,'step',1)}else if(['ArrowDown','ArrowLeft'].includes(e.key)){e.preventDefault?.();engine.input(id,'step',-1)}else if(e.key===' '||e.key==='Enter'){e.preventDefault?.();if(momentary){engine.input(id,'press');engine.input(id,'release')}else engine.input(id,'step',1)}}
 function blur(){if(down){if(momentary)engine.input(id,'release');down=null;}}
 const handlers=[['pointerdown',pdown],['pointermove',pmove],['pointerup',pup],['pointercancel',cancel],['lostpointercapture',cancel],['click',click],['wheel',wheel,{passive:false}],['keydown',key],['blur',blur]];
 for(const [n,fn,options]of handlers)element.addEventListener(n,fn,options);
 if(element.style)element.style.touchAction=adjustable?'none':'manipulation';
 return {dispose(){blur();handlers.forEach(([n,fn,options])=>element.removeEventListener?.(n,fn,options));}};
}
return {bind};
});