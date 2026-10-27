/* IRS ISDU owner-photo keypad v4 — source-measured stationary bezel, moving black cap.
 * Photo: user-supplied "Aviation Keypad Panel Close-Up.png".
 * 12 independently clickable source-image keys, each cropped from the photo.
 * Placement: OH-02 in Unified's unfrozen parent overlay. NEVER alter frozen
 * UPD-0012 overhead mosaic, its pixel geometry, or owner18 guarded switches.
 * Physical key centers measured from immutable OH01-06 ORIGINAL 1731 × 909 RGBA source;
 * exact source-to-atlas mapping: nativeX=3+sourceX*2214/1731;
 * nativeY=3+sourceY*1019/909. The original background and owner18 locks are untouched.
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
  // Dark-well bounding boxes were pixel-segmented on the actual locked source:
  // cols (source px) centers [638,678.5,720], row centers [343.5,383.5,425,465.5].
  // Physical source dark wells: x=622..654 / 663..694 / 704..736;
  // y=327..360 / 368..400 / 409..441 / 449..481.
  // Each larger metal bezel masks its ORIGINAL background well and old metallic perimeter.
  const SOURCE_COLS=Object.freeze([638.0,678.5,720.0]);
  const SOURCE_ROWS=Object.freeze([343.5,383.5,425.0,465.5]);
  const sourceToNativeX=x=>3+x*2214/1731;
  const sourceToNativeY=y=>3+y*1019/909;
  const COL_CENTERS=Object.freeze(SOURCE_COLS.map(sourceToNativeX));
  const ROW_CENTERS=Object.freeze(SOURCE_ROWS.map(sourceToNativeY));
  const KEY_W=50.4, KEY_H=44.7;
  const SRC='./assets/irs-owner-keycaps-v3.avif';
  const settings=Object.freeze({version:'IRS-ISDU-BEZEL-FIX-0004',
    sourcePhoto:'Aviation Keypad Panel Close-Up.png',
    referencePhoto:'OH01-06-original-9d8ac0ac86bd.png',
    referencePhotoSha256:'9d8ac0ac86bdb92c040e9bdd97811ca381535d949bff94aa5b1a01e5de8e23df',
    atlasSource:'OH-02',
    sourceColumns:SOURCE_COLS,sourceRows:SOURCE_ROWS,
    columns:COL_CENTERS,rows:ROW_CENTERS,keyWidth:KEY_W,keyHeight:KEY_H,
    mechanicalBoundary:'photo metal bezel remains fixed; only black cap moves',
    acceptance:'source-pixel-registered, browser screenshot visual QA recommended'
  });
  let station=null,last=null;
  function keyRect(col,row){
    return {left:COL_CENTERS[col]-KEY_W/2,top:ROW_CENTERS[row]-KEY_H/2,width:KEY_W,height:KEY_H};
  }
  function install(){
    const region=document.getElementById('region-overhead');
    if(!region)return null;
    let old=region.querySelector('#irsKeypadMounted');
    if(old && old.dataset.version==='IRS-ISDU-BEZEL-FIX-0004'){station=old;return old;}
    if(old)old.remove();
    station=document.createElement('div');
    station.id='irsKeypadMounted';
    station.className='irs-photo-keypad';
    station.dataset.version='IRS-ISDU-BEZEL-FIX-0004';
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
      const key=document.createElement('div');
      const bezel=document.createElement('span');
      const blackCap=document.createElement('span');
      const press=document.createElement('button');
      const p=keyRect(col,row);
      Object.assign(key.style,{left:p.left+'px',top:p.top+'px',width:p.width+'px',height:p.height+'px'});
      key.className='irs-photo-key';
      key.dataset.isduKey=id;
      key.dataset.col=String(col);
      key.dataset.row=String(row);
      // Both full-resolution source layers use the ORIGINAL sprite:
      // a non-moving metal shell and a movable central black-button crop.
      // At rest their opaque/transparent masks reconstruct the exact source pixels.
      bezel.className='irs-photo-key-bezel';
      blackCap.className='irs-photo-key-cap';
      const spritePosition=(col*50)+'% '+(row*(100/3))+'%';
      bezel.style.backgroundPosition=spritePosition;
      blackCap.style.backgroundPosition=spritePosition;
      bezel.setAttribute('aria-hidden','true');
      blackCap.setAttribute('aria-hidden','true');
      // ONLY the black inner cap is interactive. The surrounding bezel has no hit target.
      press.className='irs-photo-key-press';
      press.type='button';
      press.setAttribute('aria-label','IRS '+legend);
      press.setAttribute('title','IRS '+legend);
      press.setAttribute('aria-pressed','false');
      const fallback=document.createElement('span');
      fallback.className='irs-photo-key-fallback';
      fallback.textContent=legend;
      fallback.setAttribute('aria-hidden','true');
      key.append(bezel,blackCap,press,fallback);
      const up=()=>{
        key.classList.remove('is-depressed');
        press.setAttribute('aria-pressed','false');
      };
      press.addEventListener('pointerdown',()=>key.classList.add('is-depressed'));
      press.addEventListener('pointerup',up);
      press.addEventListener('pointercancel',up);
      press.addEventListener('pointerleave',up);
      press.addEventListener('blur',up);
      press.addEventListener('click',event=>{
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
