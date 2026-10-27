/* IRS ISDU owner-photo keypad v3 — frontend only.
 * Photo: user-supplied "Aviation Keypad Panel Close-Up.png".
 * 12 independently clickable source-image keys, each cropped from the photo.
 * Placement: OH-02 in Unified's unfrozen parent overlay. NEVER alter frozen
 * UPD-0012 overhead mosaic, its pixel geometry, or owner18 guarded switches.
 * Key centers registered to user Unified screenshot at zoom 179%.
 * A screenshot measurement is a draft fit until live pixel inspection.
 */
(function(root){
  'use strict';
  const KEYS=Object.freeze([
    ['1','1',0,0],['2','N / 2',1,0],['3','3',2,0],
    ['4','W / 4',0,1],['5','H / 5',1,1],['6','E / 6',2,1],
    ['7','7',0,2],['8','S / 8',1,2],['9','9',2,2],
    ['ENT','ENT',0,3],['0','0',1,3],['CLR','CLR',2,3]
  ]);
  // Native atlas units; distinct mechanical centers for all twelve keys.
  const COL_CENTERS=Object.freeze([818.5,873.2,927.3]);
  const ROW_CENTERS=Object.freeze([391.6,436.9,479.3,523.5]);
  const KEY_W=40.0, KEY_H=40.0;
  const SRC='./assets/irs-owner-keycaps-v3.avif';
  const SCREENSHOT={zoom:1.79,centersPxX:[799,897,992],centersPxY:[643,723,799,879]};
  const settings=Object.freeze({version:'IRS-ISDU-KEYCAPS-0003',sourcePhoto:'Aviation Keypad Panel Close-Up.png',atlasSource:'OH-02',columns:COL_CENTERS,rows:ROW_CENTERS,keyWidth:KEY_W,keyHeight:KEY_H,screenshotCalibration:SCREENSHOT,verification:'screenshot-registered; live physical fit not yet owner-approved'});
  let station=null,last=null;
  function keyRect(col,row){
    return {left:COL_CENTERS[col]-KEY_W/2,top:ROW_CENTERS[row]-KEY_H/2,width:KEY_W,height:KEY_H};
  }
  function install(){
    const region=document.getElementById('region-overhead');
    if(!region)return null;
    let old=region.querySelector('#irsKeypadMounted');
    if(old && old.dataset.version==='IRS-ISDU-KEYCAPS-0003'){station=old;return old;}
    if(old)old.remove();
    station=document.createElement('div');
    station.id='irsKeypadMounted';
    station.className='irs-photo-keypad';
    station.dataset.version='IRS-ISDU-KEYCAPS-0003';
    station.dataset.mount='OH-02-UNIFIED';
    station.dataset.backend='DISCONNECTED';
    station.setAttribute('role','group');
    station.setAttribute('aria-label','IRS ISDU photographed keypad, 12 independent keys, frontend visual only');
    const photo=new Image();
    photo.decoding='async';
    photo.onload=()=>{if(station?.isConnected)station.dataset.art='loaded';};
    photo.onerror=()=>{if(station?.isConnected)station.dataset.art='fallback';};
    photo.src=SRC;
    for(const [id,legend,col,row] of KEYS){
      const key=document.createElement('button');
      const face=document.createElement('span');
      const p=keyRect(col,row);
      Object.assign(key.style,{left:p.left+'px',top:p.top+'px',width:p.width+'px',height:p.height+'px'});
      key.className='irs-photo-key';
      key.type='button';
      key.dataset.isduKey=id;
      key.dataset.col=String(col);
      key.dataset.row=String(row);
      key.setAttribute('aria-label','IRS '+legend);
      key.setAttribute('title','IRS '+legend);
      key.setAttribute('aria-pressed','false');
      face.className='irs-photo-key-face';
      face.style.backgroundPosition=(col*50)+'% '+(row*(100/3))+'%';
      face.setAttribute('aria-hidden','true');
      const fallback=document.createElement('span');
      fallback.className='irs-photo-key-fallback';
      fallback.textContent=legend;
      fallback.setAttribute('aria-hidden','true');
      key.append(face,fallback);
      const up=()=>{
        key.classList.remove('is-depressed');
        key.setAttribute('aria-pressed','false');
      };
      key.addEventListener('pointerdown',()=>key.classList.add('is-depressed'));
      key.addEventListener('pointerup',up);
      key.addEventListener('pointercancel',up);
      key.addEventListener('pointerleave',up);
      key.addEventListener('blur',up);
      key.addEventListener('click',event=>{
        event.stopPropagation();
        last=id;
        station.dataset.lastKey=id;
        key.classList.add('is-depressed');
        key.setAttribute('aria-pressed','true');
        // Momentary tactile visual cue; there is deliberately no IRS engine call.
        root.setTimeout(up,110);
        station.dispatchEvent(new CustomEvent('b737:irs-visual-key',{
          bubbles:true,detail:{key:id,source:'OH-02',backend:false}
        }));
      });
      station.append(key);
    }
    region.append(station);
    return station;
  }
  function focusIRS(){
    install();
    const vp=document.getElementById('viewport');
    const scene=document.getElementById('scene');
    const region=document.getElementById('region-overhead');
    if(!vp||!scene||!region)return;
    if(scene.classList.contains('reference-mode'))document.getElementById('reference')?.click();
    document.getElementById('native')?.click();  // 1:1 rather than initial fit-to-all
    document.getElementById('zoomIn')?.click();  // enlarged keypad for inspection
    const zoom=Number.parseFloat(scene.style.getPropertyValue('--zoom'))||1.25;
    const rx=Number.parseFloat(region.style.left)||0;
    const ry=Number.parseFloat(region.style.top)||0;
    const sx=Number.parseFloat(scene.style.left)||0;
    const sy=Number.parseFloat(scene.style.top)||0;
    const midx=(COL_CENTERS[0]+COL_CENTERS[2])/2;
    const midy=(ROW_CENTERS[0]+ROW_CENTERS[3])/2;
    vp.scrollLeft=Math.max(0,(rx+midx)*zoom+sx-vp.clientWidth/2);
    vp.scrollTop=Math.max(0,(ry+midy)*zoom+sy-vp.clientHeight/2);
  }
  function attachNav(){
    let b=document.getElementById('irsPanelJump');
    if(b){b.onclick=focusIRS; b.textContent='IRS KEYPAD';return;}
    const nav=document.querySelector('header nav');
    if(!nav)return;
    b=document.createElement('button');
    b.id='irsPanelJump';
    b.type='button';
    b.textContent='IRS KEYPAD';
    b.onclick=focusIRS;
    nav.append(b);
  }
  function ready(){
    attachNav();
    install();
    const observer=new MutationObserver(()=>{if(install())observer.disconnect();});
    observer.observe(document.documentElement,{childList:true,subtree:true});
    root.addEventListener('b737:cockpit-mounted',install);
  }
  root.B737ISDUOnPanel=Object.freeze({install,focus:focusIRS,getElement:()=>station,getLastKey:()=>last,geometry:settings});
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',ready,{once:true});
  else ready();
})(window);
