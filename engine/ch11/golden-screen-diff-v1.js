/* Golden-reference visual acceptance gate for a normalized CDU framebuffer.
 * NEVER approves a page without a privately supplied FCOM golden image.
 * Source images are intentionally excluded from the public repository.
 * Pure RGBA test implementation: screenshot pipeline supplies same-size crops.
 */
(function(root,factory){'use strict';const a=factory();if(typeof module==='object'&&module.exports)module.exports=a;if(root)root.B737CDUGoldenDiffV1=a;
})(typeof globalThis!=='undefined'?globalThis:null,function(){
 'use strict';
 function validateImage(img){
  if(!img||!Number.isInteger(img.width)||!Number.isInteger(img.height)||img.width<2||img.height<2||
     !img.rgba||img.rgba.length!==img.width*img.height*4)throw Error('GOLDEN_RGBA_IMAGE_REQUIRED');
 }
 function isGreen(data,index,threshold){
  const i=index*4,r=data[i],g=data[i+1],b=data[i+2],alpha=data[i+3];
  return alpha>=220&&g>=threshold&&g>r*1.35&&g>b*1.35;
 }
 function scan(rgba,w,h,threshold){
  const out=new Uint8Array(w*h);let count=0;
  for(let i=0;i<out.length;i++)if(isGreen(rgba,i,threshold)){out[i]=1;count++;}
  return {bits:out,count};
 }
 function nearby(mask,w,h,x,y,tol){
  for(let dy=-tol;dy<=tol;dy++)for(let dx=-tol;dx<=tol;dx++){
   const tx=x+dx,ty=y+dy;if(tx>=0&&ty>=0&&tx<w&&ty<h&&mask[ty*w+tx])return true;
  }
  return false;
 }
 function compare({reference,actual,minInk=20,colorThreshold=68,tolerancePx=1,minimumF1=.97}={}){
  if(!reference)return {passed:false,status:'BLOCKED_NO_FCOM_GOLDEN_REFERENCE',reason:'NOT_AUTHORIZED_TO_CLAIM_VISUAL_MATCH'};
  if(!actual)return {passed:false,status:'BLOCKED_NO_UNIFIED_RENDER',reason:'BROWSER_CAPTURE_REQUIRED'};
  validateImage(reference);validateImage(actual);
  if(reference.width!==actual.width||reference.height!==actual.height)
   return {passed:false,status:'FRAME_GEOMETRY_MISMATCH',expected:[reference.width,reference.height],actual:[actual.width,actual.height]};
  if(!Number.isInteger(tolerancePx)||tolerancePx<0||tolerancePx>3)throw Error('INVALID_PIXEL_TOLERANCE');
  const w=reference.width,h=reference.height,a=scan(actual.rgba,w,h,colorThreshold),r=scan(reference.rgba,w,h,colorThreshold);
  if(r.count<minInk)return {passed:false,status:'EMPTY_OR_INVALID_FCOM_GOLDEN',inkPixels:r.count};
  if(a.count<minInk)return {passed:false,status:'EMPTY_OR_INVALID_CDU_RENDER',inkPixels:a.count};
  let matchesRef=0,matchesActual=0;
  for(let i=0;i<r.bits.length;i++){
   const x=i%w,y=Math.floor(i/w);
   if(r.bits[i]&&nearby(a.bits,w,h,x,y,tolerancePx))matchesRef++;
   if(a.bits[i]&&nearby(r.bits,w,h,x,y,tolerancePx))matchesActual++;
  }
  const recall=matchesRef/r.count,precision=matchesActual/a.count;
  const f1=(precision+recall)?2*precision*recall/(precision+recall):0;
  return {passed:f1>=minimumF1,status:f1>=minimumF1?'VISUAL_MATCH':'VISUAL_DIFF_FAIL',
   f1,precision,recall,inkReference:r.count,inkActual:a.count,
   tolerancePx,threshold:minimumF1,dimensions:[w,h]};
 }
 function certify(spec,evidence){
  if(!spec||!evidence)throw Error('SOURCE_AND_VISUAL_EVIDENCE_REQUIRED');
  if(spec.verification?.full==='FULLY_VERIFIED')throw Error('MANUAL_CERTIFICATION_REQUIRED_NO_AUTO_APPROVAL');
  const visual=compare({reference:evidence.fcomGolden,actual:evidence.runtimeImage});
  const behavior=evidence.interactionTestPassed===true;
  const effectivity=evidence.installedSoftwareVerified===true;
  const documented=evidence.fcomFolio===spec.source?.folio;
  return {certified:false,decision:visual.passed&&behavior&&effectivity&&documented?
   'READY_FOR_HUMAN_SIGNOFF':'INCOMPLETE_EVIDENCE',visual,behavior,effectivity,documented};
 }
 return Object.freeze({compare,certify});
});
