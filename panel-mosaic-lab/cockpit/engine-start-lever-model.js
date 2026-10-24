/* ISN-03: physical Engine 1/2 start-lever placement on the existing blank
 * throttle-quadrant photograph. Source artwork, crop and mosaic are immutable.
 */
(function(root,factory){'use strict';const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.B737EngineStartLeverModel=api;})(typeof globalThis!=='undefined'?globalThis:null,function(){
 'use strict';
 const SOURCE=Object.freeze({width:1145,height:1373,window:{x:20,y:30,w:1055,h:1290}});
 const SLOTS=Object.freeze({engine1:Object.freeze({x:483,label:'1'}),engine2:Object.freeze({x:606,label:'2'})});
 const DETENTS=Object.freeze({IDLE:987,CUTOFF:1114});
 const HANDLE=Object.freeze({w:60,h:49});
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
