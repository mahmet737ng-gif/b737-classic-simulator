/* ISN-03: physical Engine 1/2 start-lever placement on the owner's active bare
 * throttle-quadrant photograph. Frozen source archive and other controls untouched.
 */
(function(root,factory){'use strict';const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.B737EngineStartLeverModel=api;})(typeof globalThis!=='undefined'?globalThis:null,function(){
 'use strict';
 const SOURCE=Object.freeze({width:800,height:1000,window:{x:0,y:0,w:800,h:800*740.9857819905213/606}});
 const SLOTS=Object.freeze({engine1:Object.freeze({x:324,label:'1'}),engine2:Object.freeze({x:411,label:'2'})});
 const DETENTS=Object.freeze({IDLE:855,CUTOFF:928});
 const HANDLE=Object.freeze({w:35,h:40});
 function placement(piece,device,position){
  if(!SLOTS[device]||!Object.hasOwn(DETENTS,position))throw Error('Invalid physical start lever');
  if(!piece||![piece.x,piece.y,piece.w,piece.h].every(Number.isFinite)||piece.w<=0||piece.h<=0)throw Error('Invalid throttle plate placement');
  const scale=piece.w/SOURCE.window.w;
  if(Math.abs(piece.h-SOURCE.window.h*scale)>.5)throw Error('Throttle quadrant crop has changed');
  const px=SLOTS[device].x,py=DETENTS[position];
  return {left:piece.x+(px-SOURCE.window.x-HANDLE.w/2)*scale,
   top:piece.y+(py-SOURCE.window.y-HANDLE.h/2)*scale,
   width:HANDLE.w*scale,height:HANDLE.h*scale};
 }
 return Object.freeze({SOURCE,SLOTS,DETENTS,HANDLE,placement});
});
