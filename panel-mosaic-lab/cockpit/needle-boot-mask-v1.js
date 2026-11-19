/* The direct Gateway serves small, pixel-verified masks produced by the
 * existing needle cleaners. The atlas retains its own source, LOD and
 * geometry. Standalone views continue to run the original cleaners. */
(function(root){
 'use strict';
 const assets=root.B737GatewayBoot?.art;
 if(!assets)return;
 const images=new Map();
 function load(key){
  const asset=assets[key];
  if(!asset)return null;
  if(!images.has(key)){
   const image=new Image();
   const job=new Promise((resolve,reject)=>{
    image.onload=()=>image.naturalWidth===asset.width&&image.naturalHeight===asset.height?
     resolve(image):reject(Error('Needle mask dimensions changed'));
    image.onerror=()=>reject(Error('Needle mask unavailable'));
    image.src=asset.url;
   });
   images.set(key,job);
  }
  return images.get(key);
 }
 function apply(piece,key){
  const pending=load(key);
  if(!pending)return null;
  return pending.then(image=>{
   if(!piece.isConnected)return false;
   const photos=piece.querySelectorAll('.atlas-source-strip > .atlas-photo');
   if(!photos.length)return null;
   for(const photo of photos){
    const strip=photo.parentElement;
    if(strip.querySelector('.boot-needle-mask'))continue;
    const layer=image.cloneNode(false);
    layer.className='boot-needle-mask';
    layer.style.cssText=photo.style.cssText;
    layer.style.pointerEvents='none';
    layer.alt='';layer.setAttribute('aria-hidden','true');layer.draggable=false;
    photo.after(layer);
   }
   return true;
  }).catch(()=>null);
 }
 root.B737NeedleBootMask=Object.freeze({apply});
})(window);
