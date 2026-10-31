/* PERF-0004 composite A/B. Do not mutate the frozen renderer or owner assets. */
(function(){
 'use strict';
 document.documentElement.dataset.compositeOverheadTest='true';
 const original=window.B737ImageLoader;
 if(!original)throw Error('Composite test requires the existing image loader');
 const wrapped=Object.create(original);
 wrapped.assign=function(img,src){
  if(img.classList.contains('atlas-photo')){
   img.dataset.compositeOmitted='true';
   // Preserve registration, dimensions and DOM nodes for all 18 guard controls.
   return img;
  }
  return original.assign(img,src);
 };
 wrapped.clone=function(img){
  if(img.dataset.compositeOmitted==='true'){
   const node=img.cloneNode(false);node.removeAttribute('src');
   return node;
  }
  return original.clone(img);
 };
 window.B737ImageLoader=wrapped;
 const background=new Image();
 background.decoding='async';
 background.onload=()=>{document.documentElement.dataset.compositeImageReady='true';};
 background.onerror=()=>{document.documentElement.dataset.compositeImageError='true';};
 background.src=new URL('../cockpit/assets/overhead-composite-test.webp',document.baseURI).href;
})();
