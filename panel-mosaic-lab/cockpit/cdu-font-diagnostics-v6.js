/* Live CDU 24-column proof, posted from each actual Unified CDU iframe.
 * 24 A glyphs are measured against the native scratchpad width; 25 do not fit.
 */
(function(root){
 'use strict';
 const VERSION='CDU-24COL-0006';
 const seat=new URLSearchParams(root.location.search).get('seat');
 if(!['CAPT','FO'].includes(seat))return;
 function inspect(){
  const model=root.B737CduScreenFitV6?.getState?.();
  const span=root.document.querySelector('#fmc-lines .fmc-line.scratch .fmc-left.full');
  if(!model?.ready||!span)return {version:VERSION,ready:false,
   reason:model?.reason||'SCREEN_NOT_CALIBRATED'};
  const style=root.getComputedStyle(span);
  const actualFontPx=parseFloat(style.fontSize);
  const gotFamily=style.fontFamily;
  const expected=model.large;
  const charCount=(span.textContent||'').length;
  const correct=expected.valid&&model.columns===24&&
   expected.width24Px<=expected.availablePx+0.01&&
   expected.width25Px>expected.availablePx&&
   Math.abs(actualFontPx-model.scratchPx)<.2&&
   /BoeingCDULarge/i.test(gotFamily)&&
   charCount<=24;
  return {version:VERSION,ready:true,correct,columns:24,
   actualFontPx,fontPx:actualFontPx,labelPx:model.labelPx,
   widthPx:expected.availablePx,width24Px:expected.width24Px,
   width25Px:expected.width25Px,
   charCount,color:style.color,fontFamily:gotFamily,
   source:model.source,reason:correct?'EXACT_24_A_FIT':'CDU_FONT_GRID_NOT_CALIBRATED'};
 }
 function report(){
  const data=inspect();
  root.document.documentElement.dataset.cduTypographyVerified=String(data.correct===true);
  if(root.parent!==root)root.parent.postMessage({
   type:'b737:unified-cdu',seat,kind:'typography',...data
  },root.location.origin);
  return data;
 }
 root.B737CduTypographyV6=Object.freeze({version:VERSION,inspect,report});
 if(root.document.readyState==='loading')
  root.document.addEventListener('DOMContentLoaded',report,{once:true});
 else report();
 if(root.document.fonts?.ready)root.document.fonts.ready.then(report).catch(()=>{});
})(window);
