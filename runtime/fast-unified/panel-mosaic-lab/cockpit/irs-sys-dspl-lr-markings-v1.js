/* IRS-SYS-LR-MARKINGS-0001 · additive visual overlay only.
 * Exact source registration against LOCKED OH01-06 ORIGINAL 1731×909.
 * Preserves SYS DSPL heading / brackets, white rotary sprite, all 12 keys,
 * and all OWNER18 protected guarded switches.
 */
(function(root){
 'use strict';
 const src=Object.freeze({x:436,y:415,width:72,height:52});
 const map=Object.freeze({x:3,y:3,w:2214,h:1019,sourceW:1731,sourceH:909});
 const geometry=Object.freeze({
   source:src,
   left:map.x+src.x*map.w/map.sourceW,
   top:map.y+src.y*map.h/map.sourceH,
   width:src.width*map.w/map.sourceW,
   height:src.height*map.h/map.sourceH,
   version:'IRS-SYS-LR-MARKINGS-0001',
   xL:458.5,xR:485.8,
   headingUntouched:true,
   activePositions:Object.freeze(['L','R'])
 });
 let element=null;
 function install(){
   const region=document.getElementById('region-overhead');
   if(!region)return null;
   const previous=region.querySelector('#irsSysDsplLRMarkings');
   if(previous){element=previous;return previous;}
   const holder=document.createElement('div');
   holder.id='irsSysDsplLRMarkings';
   holder.className='irs-sys-dspl-lr-markings';
   holder.dataset.version=geometry.version;
   holder.setAttribute('aria-hidden','true');
   Object.assign(holder.style,{
     left:geometry.left+'px',top:geometry.top+'px',
     width:geometry.width+'px',height:geometry.height+'px'
   });
   const img=document.createElement('img');
   img.src='./assets/irs-sys-dspl-lr-markings-v1.svg';
   img.alt='';
   img.draggable=false;
   img.setAttribute('aria-hidden','true');
   holder.append(img);
   region.append(holder);
   element=holder;
   return holder;
 }
 function boot(){
   if(!install()){
     const observer=new MutationObserver(()=>{if(install())observer.disconnect();});
     observer.observe(document.documentElement,{childList:true,subtree:true});
   }
   root.addEventListener('b737:cockpit-mounted',install);
 }
 root.B737IRSSysDsplMarkings=Object.freeze({install,getElement:()=>element,geometry});
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});
 else boot();
})(window);
