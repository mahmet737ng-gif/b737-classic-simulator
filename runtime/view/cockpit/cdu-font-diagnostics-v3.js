/* Verifies the actually applied CDU display typography inside each mounted iframe.
 * No image, font binary, hotspot or CDU engine edits.
 */
(function(root){
 'use strict';
 const VERSION='CDU-TYPE-REF-0003';
 const seat=new URLSearchParams(root.location.search).get('seat');
 if(!['CAPT','FO'].includes(seat))return;
 const query=s=>root.document.querySelector(s);
 function inspect(){
  const area=query('#fmc-lines'),sample=query('#fmc-lines .fmc-line:not(.fmc-small)'),
   label=query('#fmc-lines .fmc-line.fmc-small');
  if(!area||!sample)return {version:VERSION,ready:false,reason:'SCREEN_LINES_NOT_RENDERED'};
  const main=root.getComputedStyle(sample),small=label&&root.getComputedStyle(label);
  const fontPx=Number.parseFloat(main.fontSize);
  const color=main.color;
  const family=main.fontFamily;
  const correct=Number.isFinite(fontPx)&&fontPx>=33.5&&fontPx<=34.5&&
   /rgb\(41,\s*255,\s*49\)/i.test(color)&&
   /BoeingCDULarge/i.test(family)&&
   (!small||/BoeingCDUSmall/i.test(small.fontFamily));
  return {version:VERSION,ready:true,correct,fontPx,labelPx:small?Number.parseFloat(small.fontSize):null,
   color,fontFamily:family,labelFamily:small?.fontFamily||null};
 }
 function report(){
  const info=inspect();
  root.document.documentElement.dataset.cduTypographyProfile=VERSION;
  root.document.documentElement.dataset.cduTypographyVerified=String(info.correct===true);
  if(root.parent!==root&&root.parent?.postMessage)
   root.parent.postMessage({type:'b737:unified-cdu',seat,kind:'typography',...info},root.location.origin);
  return info;
 }
 root.B737CduTypographyV3=Object.freeze({inspect,report,version:VERSION});
 if(root.document.readyState==='loading')root.document.addEventListener('DOMContentLoaded',report,{once:true});
 else report();
 if(root.document.fonts?.ready)root.document.fonts.ready.then(report).catch(()=>report());
})(window);
