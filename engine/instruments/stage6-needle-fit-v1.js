/* Stage 6 needle fit QA: immutable-sprite geometry only.
 * Does not change owner-approved needle drawings or apply live control.
 */
(function(root,factory){
 'use strict';
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.B737Stage6NeedleFitV1=api;
})(typeof globalThis==='object'?globalThis:this,function(){
 'use strict';
 const finite=n=>typeof n==='number'&&Number.isFinite(n);
 const checkPoint=(p,k)=>{
  if(!p||![p.x,p.y].every(finite))throw Error(k+' requires finite x/y');
  return p;
 };
 const rad=d=>d*Math.PI/180;
 const screenBearing=(p,t)=>{
  checkPoint(p,'Pivot');checkPoint(t,'Tip');
  return Math.atan2(t.x-p.x,p.y-t.y)*180/Math.PI;
 };
 function projectTip(pivot,radius,bearing){
  checkPoint(pivot,'Pivot');
  if(!finite(radius)||radius<=0||!finite(bearing))throw Error('Need valid native radius and angle');
  return Object.freeze({x:pivot.x+radius*Math.sin(rad(bearing)),
                        y:pivot.y-radius*Math.cos(rad(bearing))});
 }
 function fitSourceTick({pivot,photoTick,needleTipRadiusPx,bearingDeg,certifiedSource=false}){
  checkPoint(pivot,'Source pivot');
  checkPoint(photoTick,'Native photo tick endpoint');
  if(!finite(needleTipRadiusPx)||needleTipRadiusPx<=0)throw Error('Needle radius required');
  if(!finite(bearingDeg))throw Error('Source bearing required');
  const photoRadius=Math.hypot(photoTick.x-pivot.x,photoTick.y-pivot.y);
  if(photoRadius<1)throw Error('Photo mark at pivot is invalid');
  const tip=projectTip(pivot,needleTipRadiusPx,bearingDeg);
  const angularError=((screenBearing(pivot,photoTick)-bearingDeg+540)%360)-180;
  const tipDistancePx=Math.hypot(photoTick.x-tip.x,photoTick.y-tip.y);
  return Object.freeze({
   predictedTip:tip,photoRadiusPx:photoRadius,needleTipRadiusPx,
   radiusDifferencePx:needleTipRadiusPx-photoRadius,
   angularErrorDeg:angularError,tipDistancePx,
   approved:false,status:certifiedSource?'needs_independent_sprite_owner_signoff':'photo_tick_unverified'
  });
 }
 function nativeToMosaic({sourcePivot,sourceSize,placement,angleDeg,needleTipRadiusPx}){
  checkPoint(sourcePivot,'Source pivot');
  if(!sourceSize||![sourceSize.width,sourceSize.height].every(finite)||
     sourceSize.width<=0||sourceSize.height<=0)throw Error('Native source dimensions required');
  if(!placement||![placement.x,placement.y,placement.w,placement.h].every(finite)||
     placement.w<=0||placement.h<=0)throw Error('Panel placement required');
  if(!finite(angleDeg))throw Error('Bearing required');
  const sx=placement.w/sourceSize.width,sy=placement.h/sourceSize.height;
  const pivot={x:placement.x+sourcePivot.x*sx,y:placement.y+sourcePivot.y*sy};
  const tip=needleTipRadiusPx==null?null:projectTip(sourcePivot,needleTipRadiusPx,angleDeg);
  return Object.freeze({pivot,
   tip:tip?{x:placement.x+tip.x*sx,y:placement.y+tip.y*sy}:null,
   geometryStatus:Math.abs(sx-sy)<1e-7?'uniform_scale':'anisotropic_affine_requires_renderer_alignment',
   scaleX:sx,scaleY:sy});
 }
 function calibrateSprite({spritePivot,spriteTip,sourcePivot,sourcePhotoTick,sourceBearingDeg}){
  checkPoint(spritePivot,'Sprite pivot');checkPoint(spriteTip,'Sprite tip');
  checkPoint(sourcePivot,'Photo pivot');checkPoint(sourcePhotoTick,'Source tick');
  if(!finite(sourceBearingDeg))throw Error('Known bearing required');
  const nativeSpriteRadius=Math.hypot(spriteTip.x-spritePivot.x,spriteTip.y-spritePivot.y);
  if(nativeSpriteRadius===0)throw Error('Zero-length sprite');
  const targetLength=Math.hypot(sourcePhotoTick.x-sourcePivot.x,sourcePhotoTick.y-sourcePivot.y);
  const spriteReferenceBearing=screenBearing(spritePivot,spriteTip);
  return Object.freeze({spriteReferenceBearing,
   requestedRotationDeg:sourceBearingDeg-spriteReferenceBearing,
   requiredUniformScale:targetLength/nativeSpriteRadius,
   unscaledRadiusPx:nativeSpriteRadius,targetRadiusPx:targetLength,
   approved:false,needsOwnerFitReview:true});
 }
 return Object.freeze({fitSourceTick,nativeToMosaic,calibrateSprite,projectTip,screenBearing});
});
