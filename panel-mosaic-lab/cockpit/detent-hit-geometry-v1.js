/* Shared transparent detent hit-box fitter for B737 Classic faceplates.
 * Source rectangles are measured printed-label boxes, not rotor touch areas.
 * Expands by at most the desired CSS pixels, uniformly limiting the
 * expansion so hit areas remain pairwise disjoint. No image/SVG changes.
 */
(function(root,factory){
 'use strict';const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.B737DetentHitGeometryV1=api;
})(typeof globalThis!=='undefined'?globalThis:null,function(){
 'use strict';
 const VERSION='DETENT-TEXT-HIT-0001';
 const finite=(n)=>typeof n==='number'&&Number.isFinite(n);
 function overlaps(a,b){
  return a.x<b.x+b.w-1e-6&&b.x<a.x+a.w-1e-6&&
   a.y<b.y+b.h-1e-6&&b.y<a.y+a.h-1e-6;
 }
 function rect(d,padX=0,padY=0){
  return {id:d.id,kind:d.kind??null,value:d.value??d.id,
   x:d.cx-d.w/2-padX,y:d.cy-d.h/2-padY,
   w:d.w+2*padX,h:d.h+2*padY,cx:d.cx,cy:d.cy};
 }
 function validate(specs){
  if(!Array.isArray(specs)||!specs.length)throw Error('DETTENT_LABELS_REQUIRED');
  const ids=new Set();
  for(const d of specs){
   if(typeof d.id!=='string'||!d.id||ids.has(d.id))throw Error('DUPLICATE_DETENT_LABEL_ID');
   ids.add(d.id);
   if(![d.cx,d.cy,d.w,d.h].every(finite)||d.w<=0||d.h<=0)throw Error('INVALID_DETENT_LABEL_GEOMETRY');
  }
 }
 function build(specs,{scaleX=1,scaleY=1,paddingPx=5}={}){
  validate(specs);
  if(!finite(scaleX)||!finite(scaleY)||scaleX<=0||scaleY<=0||
    !finite(paddingPx)||paddingPx<0||paddingPx>30)throw Error('INVALID_DETENT_SCALE_OR_PADDING');
  const boxes=specs.map(d=>rect(d));
  for(let i=0;i<boxes.length;i++)
   for(let j=i+1;j<boxes.length;j++)
    if(overlaps(boxes[i],boxes[j]))
     throw Error('PRINTED_DETENT_TEXT_BOXES_OVERLAP_'+specs[i].id+'_'+specs[j].id);
  // Binary search global safe expansion: one mathematically provable
  // non-overlapping padding for every label, never a nearest-label halo.
  function fits(p){
   const b=specs.map(d=>rect(d,p/scaleX,p/scaleY));
   for(let i=0;i<b.length;i++)
    for(let j=i+1;j<b.length;j++)
     if(overlaps(b[i],b[j]))return false;
   return true;
  }
  let low=0,high=paddingPx;
  if(!fits(high))for(let i=0;i<28;i++){
   const mid=(low+high)/2;
   if(fits(mid))low=mid;else high=mid;
  }
  else low=high;
  // Reserve a 0.2 physical pixel safety gap for scaling/rounding.
  const safe=Math.max(0,low-.2);
  const result=specs.map(d=>Object.freeze({...rect(d,safe/scaleX,safe/scaleY),paddingPx:safe}));
  return Object.freeze(result);
 }
 function at(box,x,y){
  return x>=box.x&&y>=box.y&&x<box.x+box.w&&y<box.y+box.h;
 }
 return Object.freeze({VERSION,build,overlaps,at});
});
