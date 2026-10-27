/* ISDU-ONPANEL-0002
   Frontend-only mount of the owner's FCOM Honeywell ISDU keypad.
   Anchors inside Unified region-overhead > OH-02, NOT any frozen overhead file.
   Coordinates are an initial pixel registration against approved OH-02 geometry,
   not an owner-approved subpixel measurement. No backend writes.
*/
(function(root){
 'use strict';
 const SOURCE={w:1731,h:909};
 const UPPER={x:3,y:3,w:2214,h:1019};
 const OH02={x0:383,y0:57,x1:771,y1:715};
 const KEYPAD_SOURCE={x:584,y:165,w:153,h:211};
 const LETTERS=['1','N 2','3','W 4','H 5','E 6','7','S 8','9','ENT','0','CLR'];
 const KEY_IDS=['1','2','3','4','5','6','7','8','9','ENT','0','CLR'];
 const px=(n,size,sourceSize,offset)=>offset+n*size/sourceSize;
 const geom={
  x:px(KEYPAD_SOURCE.x,UPPER.w,SOURCE.w,UPPER.x),
  y:px(KEYPAD_SOURCE.y,UPPER.h,SOURCE.h,UPPER.y),
  w:KEYPAD_SOURCE.w*UPPER.w/SOURCE.w,
  h:KEYPAD_SOURCE.h*UPPER.h/SOURCE.h
 };
 const settings={keypad:geom,source:KEYPAD_SOURCE,oh02:OH02,sourceSize:SOURCE};
 let station=null,last=null;
 function install(){
  if(station&&station.isConnected)return station;
  const region=document.getElementById('region-overhead');
  if(!region)return null;
  if(region.querySelector('#irsKeypadMounted')){station=region.querySelector('#irsKeypadMounted');return station;}
  station=document.createElement('div');
  station.id='irsKeypadMounted';
  station.className='irs-panel-keypad';
  station.dataset.module='IRS-ISDU-HONEYWELL';
  station.dataset.mount='OH-02-UNIFIED';
  station.dataset.backend='DISCONNECTED';
  station.setAttribute('role','group');
  station.setAttribute('aria-label','Honeywell IRS keypad on aft overhead OH-02 (visual test only)');
  Object.assign(station.style,{left:geom.x+'px',top:geom.y+'px',width:geom.w+'px',height:geom.h+'px'});
  const photo=document.createElement('div');photo.className='irs-panel-source-art';
  const img=document.createElement('img');
  img.src='./assets/irs-honeywell-fcom-keypad.avif';
  img.alt='Source image: Honeywell ISDU 12-button keypad';
  img.draggable=false;
  img.addEventListener('load',()=>{station.dataset.art='loaded';});
  img.addEventListener('error',()=>{station.dataset.art='fallback';});
  photo.append(img);
  station.append(photo);
  const pad=document.createElement('div');pad.className='irs-panel-key-grid';
  for(let i=0;i<KEY_IDS.length;i++){
    const b=document.createElement('button');
    b.type='button';
    b.className='irs-panel-key';
    b.dataset.isduKey=KEY_IDS[i];
    b.setAttribute('aria-label','IRS '+LETTERS[i]);
    b.textContent=LETTERS[i];
    b.addEventListener('click',function(ev){
      ev.stopPropagation();
      for(const old of pad.querySelectorAll('.isdu-pressed'))old.classList.remove('isdu-pressed');
      b.classList.add('isdu-pressed');
      last=KEY_IDS[i];
      station.dataset.lastKey=last;
      station.dispatchEvent(new CustomEvent('b737:irs-visual-key',{bubbles:true,detail:{key:last,source:'OH02',backend:false}}));
    });
    pad.append(b);
  }
  station.append(pad);
  // The key grid must remain local to the ISDU, never intercept neighboring locked controls.
  region.append(station);
  return station;
 }
 function focusIRS(){
  install();
  const native=document.getElementById('native');
  const vp=document.getElementById('viewport');
  const scene=document.getElementById('scene');
  const region=document.getElementById('region-overhead');
  if(!native||!vp||!scene||!region)return;
  const ref=document.getElementById('reference');
  if(scene.classList.contains('reference-mode')&&ref)ref.click();
  native.click();
  const zoom=Number.parseFloat(scene.style.getPropertyValue('--zoom'))||1;
  const x=Number.parseFloat(region.style.left)||0,y=Number.parseFloat(region.style.top)||0;
  const sx=Number.parseFloat(scene.style.left)||0,sy=Number.parseFloat(scene.style.top)||0;
  vp.scrollLeft=Math.max(0,(x+geom.x+geom.w/2)*zoom+sx-vp.clientWidth/2);
  vp.scrollTop=Math.max(0,(y+geom.y+geom.h/2)*zoom+sy-vp.clientHeight/2);
  document.getElementById('irsPanelJump')?.setAttribute('aria-pressed','true');
 }
 function addJump(){
  if(document.getElementById('irsPanelJump'))return;
  const nav=document.querySelector('header nav');
  if(!nav)return;
  const b=document.createElement('button');
  b.id='irsPanelJump';b.type='button';b.textContent='IRS KEYPAD';b.setAttribute('aria-pressed','false');
  b.addEventListener('click',focusIRS);
  nav.append(b);
 }
 function whenReady(){
  addJump();
  const observer=new MutationObserver(()=>{if(install())observer.disconnect();});
  observer.observe(document.documentElement,{childList:true,subtree:true});
  install();
  window.addEventListener('b737:cockpit-mounted',install);
 }
 root.B737ISDUOnPanel=Object.freeze({install,focus:focusIRS,getElement:()=>station,geometry:settings,getLastKey:()=>last});
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',whenReady,{once:true});else whenReady();
})(window);
