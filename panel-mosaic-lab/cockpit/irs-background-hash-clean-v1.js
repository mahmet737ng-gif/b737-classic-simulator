/* IRS-HASH-CLEAN-0001
 * Remove only four obsolete white printed detent hashes from the UNFROZEN
 * original owner bare IRS panel preview. Leave the approved photo file itself
 * byte-identical; derive an in-memory non-destructive copy for the body image.
 * DO NOT change photographic labels, the new five calibrated ticks, the
 * rotary knobs, registered apertures, lower locked SYS DSPL, or guard switches.
 */
(function(root){
'use strict';
const VERSION='IRS-HASH-CLEAN-0001';
const EXPECT={width:1097,height:1434};
// Original full-resolution owner bare-panel source coordinates, NOT screen px.
// These four ROIs cover the leftover legacy marks that appear in addition
// to the calibrated five white tick overlays.
// Two stray slashes near the collar; two stray horizontal dashes at 3 o'clock.
const LEGACY=Object.freeze([
 Object.freeze({id:'legacy-tkgs-slash',x:452,y:337,w:13,h:16}),
 Object.freeze({id:'legacy-wind-slash',x:486,y:339,w:13,h:16}),
 Object.freeze({id:'legacy-near-right-dash',x:492,y:360,w:21,h:13}),
 Object.freeze({id:'legacy-far-right-dash',x:520,y:360,w:19,h:13})
]);
let status={installed:false,processing:false,reason:'pending',patched:0};
let watch=null,photo=null,revoker=null;
// Local 4-neighbour Laplace inpainting: boundary metal pixels are fixed.
// Every source pixel outside the four tiny masks stays pixel-identical.
function inpaint(data,width,height,roi){
 const margin=1;
 const x0=Math.max(1,roi.x),y0=Math.max(1,roi.y);
 const x1=Math.min(width-2,roi.x+roi.w-1),y1=Math.min(height-2,roi.y+roi.h-1);
 if(x1<=x0||y1<=y0)return;
 const ix=(x,y)=>4*(y*width+x);
 const areaW=x1-x0+1,areaH=y1-y0+1;
 const work=new Float32Array(areaW*areaH*3);
 for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++){
  const p=((y-y0)*areaW+x-x0)*3;
  // Initialize with the perimeter colour average; no bright donor from a
  // different control, because the source blue panel has a soft gradient.
  const bx=x===x0?x0-1:x===x1?x1+1:x;
  const by=y===y0?y0-1:y===y1?y1+1:y;
  let q=ix(bx,by);
  for(let c=0;c<3;c++)work[p+c]=data[q+c];
 }
 const original=new Uint8ClampedArray(data);
 for(let t=0;t<250;t++){
  let k=0;
  for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++){
   const p=((y-y0)*areaW+x-x0)*3;
   for(let c=0;c<3;c++){
    const sample=(a,b)=>{
     if(a<x0||a>x1||b<y0||b>y1)return original[ix(a,b)+c];
     return work[((b-y0)*areaW+a-x0)*3+c];
    };
    // Gauss-Seidel update converges to the local source-metal continuum.
    work[p+c]=.25*(sample(x-1,y)+sample(x+1,y)+sample(x,y-1)+sample(x,y+1));
   }
   k++;
  }
 }
 for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++){
  const p=((y-y0)*areaW+x-x0)*3,q=ix(x,y);
  // 1px feather at border to prevent the patch outline from showing.
  const d=Math.min(x-x0,x1-x,y-y0,y1-y);
  const mix=d===0?.6:1;
  for(let c=0;c<3;c++)data[q+c]=Math.round(original[q+c]*(1-mix)+work[p+c]*mix);
  // Keep original alpha untouched.
 }
}
function derive(image){
 const cv=document.createElement('canvas');
 cv.width=image.naturalWidth;cv.height=image.naturalHeight;
 const ctx=cv.getContext('2d',{willReadFrequently:true});
 if(!ctx)throw Error('Canvas 2D unavailable');
 ctx.drawImage(image,0,0);
 const pixels=ctx.getImageData(0,0,cv.width,cv.height);
 for(const roi of LEGACY)inpaint(pixels.data,cv.width,cv.height,roi);
 ctx.putImageData(pixels,0,0);
 return cv;
}
function apply(){
 const body=document.querySelector('#irsBarePanelRegistered img.irs-registered-panel-body');
 if(!body||body.dataset.irsLegacyHashesClean==='true'||status.processing)return !!body&&body.dataset.irsLegacyHashesClean==='true';
 if(!body.complete||!body.naturalWidth){
  if(!body.dataset.irsLegacyHashLoadHook){
   body.dataset.irsLegacyHashLoadHook='true';
   body.addEventListener('load',apply,{once:true});
  }
  return false;
 }
 if(body.naturalWidth!==EXPECT.width||body.naturalHeight!==EXPECT.height){
  status.reason='Unexpected original owner panel dimensions — kept unchanged';return false;
 }
 status.processing=true;
 try{
  const cv=derive(body);
  const newURL=cv.toDataURL('image/png');
  if(!newURL.startsWith('data:image/png;base64,'))throw Error('PNG derivation failed');
  body.src=newURL;
  body.dataset.irsLegacyHashesClean='true';
  body.dataset.irsPanelPhotoProvenance='owner-original-retained-derived-in-memory';
  status={installed:true,processing:false,reason:'4 legacy background ticks inpainted; 5 live detents unchanged',patched:LEGACY.length};
  if(watch){watch.disconnect();watch=null;}
  return true;
 }catch(error){
  status={installed:false,processing:false,reason:String(error.message||error),patched:0};
  root.console?.warn('IRS background dash cleanup:',error);
  return false;
 }
}
function boot(){
 apply();
 if(status.installed)return;
 watch=new MutationObserver(()=>{
  if(apply()){watch.disconnect();watch=null;}
 });
 watch.observe(document.documentElement,{childList:true,subtree:true});
}
root.addEventListener('b737:cockpit-mounted',apply);
root.B737IRSBackgroundHashClean=Object.freeze({
 apply,status:()=>({...status}),legacySourceRects:()=>LEGACY.map(x=>({...x}))
});
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});
else boot();
})(window);
