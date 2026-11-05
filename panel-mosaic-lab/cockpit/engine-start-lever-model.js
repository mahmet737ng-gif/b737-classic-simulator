/* ISN-03: physical Engine 1/2 start-lever placement on the owner's active bare
 * throttle-quadrant photograph. Frozen source archive and other controls untouched.
 */
(function(root,factory){'use strict';const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.B737EngineStartLeverModel=api;})(typeof globalThis!=='undefined'?globalThis:null,function(){
 'use strict';
 const SOURCE=Object.freeze({width:800,height:1000,window:{x:0,y:0,w:800,h:800*740.9857819905213/606}});
 const SLOTS=Object.freeze({engine1:Object.freeze({x:330.5,label:'1'}),engine2:Object.freeze({x:404.5,label:'2'})});
 const HANDLE=Object.freeze({w:74,h:46});
 // Measured black slot on the unchanged 800x1000 owner photograph.
 // IDLE grip center meets the upper slot stop; CUTOFF retains its lower stop.
 const SLOT_TRACK=Object.freeze({top:847,bottom:941});
 const DETENTS=Object.freeze({IDLE:SLOT_TRACK.top,CUTOFF:SLOT_TRACK.bottom-HANDLE.h/2});
 // Hidden shaft reference only; the owner requested straight arms and no top disk.
 const PIVOT=Object.freeze({y:843,outerOffset:34});
 const clamp=x=>Math.max(0,Math.min(1,x));
 function travel(position){if(!Object.hasOwn(DETENTS,position))throw Error('Invalid physical start lever');return position==='IDLE'?1:0;}
 function geometry(device,fraction){
  if(!SLOTS[device]||!Number.isFinite(fraction))throw Error('Invalid physical start lever');
  const t=clamp(fraction),x=SLOTS[device].x,y=DETENTS.CUTOFF+(DETENTS.IDLE-DETENTS.CUTOFF)*t;
  const side=device==='engine1'?-1:1;
  // Frontal projection shortens as the arm rotates out of the panel plane.
  return {travel:t,x,y,pivotX:x+side*PIVOT.outerOffset,pivotY:PIVOT.y,
   jointX:x+side*(HANDLE.w/2-3),jointY:y+8};
 }
 function placementAt(piece,device,fraction){
  const g=geometry(device,fraction);
  if(!piece||![piece.x,piece.y,piece.w,piece.h].every(Number.isFinite)||piece.w<=0||piece.h<=0)throw Error('Invalid throttle plate placement');
  const scale=piece.w/SOURCE.window.w;
  if(Math.abs(piece.h-SOURCE.window.h*scale)>.5)throw Error('Throttle quadrant crop has changed');
  const px=g.x,py=g.y;
  return {left:piece.x+(px-SOURCE.window.x-HANDLE.w/2)*scale,
   top:piece.y+(py-SOURCE.window.y-HANDLE.h/2)*scale,
   width:HANDLE.w*scale,height:HANDLE.h*scale};
 }
 function placement(piece,device,position){return placementAt(piece,device,travel(position));}
 function dragTravel(start,startY,currentY,screenTravel){
  if(![start,startY,currentY,screenTravel].every(Number.isFinite)||screenTravel<=0)throw Error('Invalid lever drag');
  return clamp(start+(startY-currentY)/screenTravel);
 }
 function detentAt(fraction){return fraction>=.995?'IDLE':fraction<=.005?'CUTOFF':null;}
 return Object.freeze({SOURCE,SLOTS,DETENTS,HANDLE,SLOT_TRACK,PIVOT,travel,geometry,placementAt,placement,dragTravel,detentAt});
});
