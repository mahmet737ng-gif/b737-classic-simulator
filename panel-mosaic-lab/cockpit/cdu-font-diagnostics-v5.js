/* Observable on-screen CDU typography. One report per actual mounted iframe.
 * May read computed pixels only; never mutates CDU engine or button/photo art.
 */
(function(root){
 'use strict';
 const VERSION='CDU-SCREEN-FIT-0005';
 const seat=new URLSearchParams(root.location.search).get('seat');
 if(!['CAPT','FO'].includes(seat))return;
 const q=s=>root.document.querySelector(s);
 function inspect(){
  const text=q('#fmc-lines'),main=q('#fmc-lines .fmc-line:not(.fmc-header):not(.fmc-small):not(.scratch)'),
   label=q('#fmc-lines .fmc-line.fmc-small');
  if(!text||!main)return {version:VERSION,ready:false,reason:'SCREEN_NOT_READY'};
  const style=root.getComputedStyle(main),sm=label&&root.getComputedStyle(label);
  const nativePx=parseFloat(style.fontSize),labelPx=sm?parseFloat(sm.fontSize):null;
  const color=style.color,face=style.fontFamily,smallFace=sm?.fontFamily||null;
  const correct=nativePx>=91.5&&nativePx<=92.5&&
    (!label||labelPx>=71.5&&labelPx<=72.5)&&
    /rgb\(41,\s*255,\s*49\)/i.test(color)&&
    /BoeingCDULarge/i.test(face)&&/BoeingCDUSmall/i.test(smallFace||'')&&
    root.document.documentElement.dataset.cduScreenFit===VERSION;
  return {version:VERSION,ready:true,correct,nativePx,labelPx,color,
   fontFamily:face,labelFamily:smallFace,fitActive:root.document.documentElement.dataset.cduScreenFit===VERSION,
   note:'Native iframe font sizes; final screenshot scales with CDU parent CSS transform'};
 }
 function report(){
  const result=inspect();
  root.document.documentElement.dataset.cduTypographyVerified=String(result.correct===true);
  if(root.parent!==root&&root.parent?.postMessage)
   root.parent.postMessage({type:'b737:unified-cdu',seat,kind:'typography',...result},root.location.origin);
  return result;
 }
 root.B737CduTypographyV5=Object.freeze({inspect,report,version:VERSION});
 if(root.document.readyState==='loading')root.document.addEventListener('DOMContentLoaded',report,{once:true});else report();
 if(root.document.fonts?.ready)root.document.fonts.ready.then(report).catch(()=>report());
})(window);
