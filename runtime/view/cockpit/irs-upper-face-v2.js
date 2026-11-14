/* Additive text cleanup only; lower SYS DSPL and immutable overhead untouched */
(function(root){
'use strict';
const ROI=Object.freeze({x:396,y:310,width:168,height:70});
const MAP=Object.freeze({x:3,y:3,w:2214,h:1019,sourceW:1731,sourceH:909});
const rect=Object.freeze({left:MAP.x+ROI.x*MAP.w/MAP.sourceW,top:MAP.y+ROI.y*MAP.h/MAP.sourceH,
 width:ROI.width*MAP.w/MAP.sourceW,height:ROI.height*MAP.h/MAP.sourceH});
function install(){
 const region=document.getElementById('region-overhead');
 if(!region)return null;
 const exists=region.querySelector('#irsUpperFaceV2');
 if(exists)return exists;
 const layer=document.createElement('div');
 layer.id='irsUpperFaceV2';layer.className='irs-upper-face-v2';
 layer.dataset.phase='frontend-only';layer.dataset.source='OH01-06-original';
 Object.assign(layer.style,Object.fromEntries(Object.entries(rect).map(([key,value])=>[key,value+'px'])));
 for(const [src,cls] of [
 ['./assets/irs-upper-old-text-clean-v2.avif','irs-upper-old-text-clean'],
 ['./assets/irs-upper-mode-labels-v2.svg','irs-upper-five-labels']
 ]){
  const img=document.createElement('img');img.src=src;img.alt='';img.draggable=false;
  img.setAttribute('aria-hidden','true');img.className=cls;layer.append(img);
 }
 region.append(layer);return layer;
}
function boot(){
 if(!install()){
  const observer=new MutationObserver(()=>{if(install())observer.disconnect();});
  observer.observe(document.documentElement,{subtree:true,childList:true});
 }
 root.addEventListener('b737:cockpit-mounted',install);
}
root.B737IRSUpperFace=Object.freeze({install,rect,source:ROI});
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})(window);