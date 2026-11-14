/* CONV-FO-EADI-SOCKET-0001
 * Independent FO Conventional CRT glass registration. Never modify or reuse
 * the owner-final EIS geometry to position this display.
 *
 * Measured from the owner's 2026-11-08 close-up:
 *   source photo 1286 x 1223 pixels
 *   approximate INSIDE black glass [456,190,345,280] source pixels.
 * Anchored via photographed PULL UP and ALTITUDE ALERT lamp apertures.
 * Display border follows rounded black glass, NOT the aluminium bezel.
 *
 * The owner F/O picture is registered in native MAIN coords at
 *   (1374,127), raw 695 wide, source scale 695/1286.
 * Conventional FO photo is additionally enlarged by 726/695.
 * Thus the active photo width is exactly 726 native units.
 * Compute the CRT box using that one photo-to-stage transformation.
 *
 * Only the Conventional FO EADI uses this module; no aircraft state,
 * painting logic, or instrument internals are changed here.
 */
(function(root,factory){
 'use strict';
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.B737ConventionalEadiSocketV1=api;
})(typeof window==='object'?window:globalThis,function(){
 'use strict';
 const VERSION='CONV-FO-EADI-SOCKET-0001';
 const PHOTO=Object.freeze({sourceWidth:1286,sourceHeight:1223,
  x:1374,y:127,displayWidth:726});
 const GLASS_SOURCE=Object.freeze({x:456,y:190,w:345,h:280});
 const f=PHOTO.displayWidth/PHOTO.sourceWidth;
 const nativeRect=Object.freeze({
  x:PHOTO.x+GLASS_SOURCE.x*f,
  y:PHOTO.y+GLASS_SOURCE.y*f,
  w:GLASS_SOURCE.w*f,
  h:GLASS_SOURCE.h*f
 });
 function point(x,y){return {x:PHOTO.x+x*f,y:PHOTO.y+y*f};}
 return Object.freeze({VERSION,PHOTO,GLASS_SOURCE,nativeRect,point,
  cornerRadius:'10% / 11%',mode:'CONVENTIONAL',seat:'FO'});
});
