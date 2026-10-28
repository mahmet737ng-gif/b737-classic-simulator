/* IRS-UPPER-DSPL-0001 — independent coaxial DSPL SEL / BRT.
 * Owner reference: image(20261028-022751).png. Photographic alpha layers.
 * Lower SYS DSPL, its four mount tags, OWNER18 and frozen mosaic are untouched.
 */
(function(root){
 'use strict';
 const MODES=Object.freeze(['TEST','TK/GS','PPOS','WIND','HDG/STS']);
 // Relative to the photograph's left-facing pointer; align to existing stencils.
 const ANGLES=Object.freeze([0,35,65,125,150]);
 const source=Object.freeze({x:471.454545,y:368.699675});
 const map=Object.freeze({sourceWidth:1731,sourceHeight:909,width:2214,height:1019,x:3,y:3});
 const size=Object.freeze({width:88,height:79});
 const center=Object.freeze({x:map.x+source.x*map.width/map.sourceWidth,y:map.y+source.y*map.height/map.sourceHeight});
 const geometry=Object.freeze({version:'IRS-UPPER-DSPL-0001',source,map,size,center,pivot:[.5,.5],modeAngles:ANGLES,outerAsset:'irs-upper-mode-outer-v1.png',innerAsset:'irs-upper-brt-inner-v1.png'});
 let mode='PPOS',brightness=82,element=null,displayMask=null;
 const tracks=new Map(),ignoreClick={mode:false,brightness:false};
 const clamp=(x,lo,hi)=>Math.max(lo,Math.min(hi,x));
 function snapshot(){return {mode,brightness,outerAngle:ANGLES[MODES.indexOf(mode)],innerAngle:(brightness-82)*2.7,frontendOnly:true};}
 function notify(part,input){root.dispatchEvent(new CustomEvent('b737:irs-dspl-sel-change',{detail:{...snapshot(),part,input}}));}
 function render(){
  if(!element)return;
  const state=snapshot();element.dataset.mode=mode;element.dataset.brightness=String(brightness);
  element.querySelector('.irs-upper-mode-rotor').style.transform='rotate('+state.outerAngle+'deg)';
  element.querySelector('.irs-upper-brt-rotor').style.transform='rotate('+state.innerAngle+'deg)';
  const outer=element.querySelector('.irs-upper-mode-control'),inner=element.querySelector('.irs-upper-brt-control');
  outer.setAttribute('aria-valuenow',String(MODES.indexOf(mode)));outer.setAttribute('aria-valuetext',mode);
  outer.setAttribute('title','DSPL SEL: '+mode+' · outer ring');
  inner.setAttribute('aria-valuenow',String(brightness));inner.setAttribute('aria-valuetext',brightness+'%');
  inner.setAttribute('title','BRT: '+brightness+'% · inner knob');
  if(displayMask)displayMask.style.opacity=String(1-brightness/100);
  for(const unit of document.querySelectorAll('[data-isdu-unit]'))unit.style.setProperty('--isdu-brightness',String(brightness/100));
 }
 function setMode(value,input='api'){
  const next=String(value).toUpperCase();if(!MODES.includes(next))throw new RangeError('Unknown IRS DSPL SEL mode: '+value);
  const changed=next!==mode;mode=next;render();if(changed)notify('mode',input);return mode;
 }
 function setBrightness(value,input='api'){
  const n=Number(value);if(!Number.isFinite(n))throw new TypeError('IRS brightness must be a finite number');
  const next=Math.round(clamp(n,0,100)),changed=next!==brightness;brightness=next;render();if(changed)notify('brightness',input);return brightness;
 }
 function step(part,direction,input){
  if(part==='mode')setMode(MODES[clamp(MODES.indexOf(mode)+direction,0,MODES.length-1)],input);
  else setBrightness(brightness+direction,input);
 }
 function wire(button,part){
  button.addEventListener('pointerdown',event=>{
   if(event.pointerType==='mouse'&&event.button!==0)return;
   event.preventDefault();event.stopPropagation();button.focus?.({preventScroll:true});
   const rect=element.getBoundingClientRect();
   tracks.set(event.pointerId,{part,x:event.clientX,y:event.clientY,scale:rect.width/size.width||1,start:part==='mode'?MODES.indexOf(mode):brightness,moved:false});
   try{button.setPointerCapture(event.pointerId);}catch(_){}
  });
  button.addEventListener('pointermove',event=>{
   const t=tracks.get(event.pointerId);if(!t||t.part!==part)return;
   const dx=(event.clientX-t.x)/t.scale,dy=(event.clientY-t.y)/t.scale;
   if(Math.hypot(dx,dy)>5)t.moved=true;
   if(t.moved){
    const delta=dx-dy;
    if(part==='mode')setMode(MODES[clamp(t.start+Math.trunc(delta/18),0,MODES.length-1)],'drag');
    else setBrightness(t.start+delta*.6,'drag');
   }
   event.stopPropagation();
  });
  for(const name of ['pointerup','pointercancel','lostpointercapture'])button.addEventListener(name,event=>{
   const t=tracks.get(event.pointerId);if(!t||t.part!==part)return;
   if(t.moved&&name==='pointerup')ignoreClick[part]=true;
   tracks.delete(event.pointerId);event.stopPropagation();
  });
  button.addEventListener('click',event=>{
   event.preventDefault();event.stopPropagation();
   if(ignoreClick[part]){ignoreClick[part]=false;return;}
   step(part,(event.shiftKey?-1:1)*(part==='mode'?1:5),'click');
  });
  button.addEventListener('wheel',event=>{
   if(event.ctrlKey||event.metaKey)return;
   event.preventDefault();event.stopPropagation();if(!event.deltaY)return;
   step(part,(event.deltaY>0?1:-1)*(part==='mode'?1:2),'wheel');
  },{passive:false});
  button.addEventListener('keydown',event=>{
   const sign={ArrowRight:1,ArrowUp:1,ArrowLeft:-1,ArrowDown:-1}[event.key];
   if(sign){event.preventDefault();event.stopPropagation();step(part,sign*(event.shiftKey&&part==='brightness'?10:1),'keyboard');}
   else if(event.key==='Home'||event.key==='End'){
    event.preventDefault();event.stopPropagation();
    if(part==='mode')setMode(event.key==='Home'?MODES[0]:MODES.at(-1),'keyboard');
    else setBrightness(event.key==='Home'?0:100,'keyboard');
   }
  });
 }
 function control(part,label,min,max){
  const b=document.createElement('button');b.type='button';b.className='irs-upper-'+(part==='mode'?'mode':'brt')+'-control irs-upper-control';
  b.setAttribute('role','slider');b.setAttribute('aria-label',label);b.setAttribute('aria-valuemin',String(min));b.setAttribute('aria-valuemax',String(max));wire(b,part);return b;
 }
 function photo(cls,file){const img=document.createElement('img');img.className=cls;img.src='./assets/'+file;img.alt='';img.draggable=false;img.setAttribute('aria-hidden','true');return img;}
 function mount(){
  const region=document.getElementById('region-overhead');if(!region)return null;
  const existing=region.querySelector('#irsUpperDsplMounted');if(existing){element=existing;render();return element;}
  element=document.createElement('div');element.id='irsUpperDsplMounted';element.className='irs-upper-dspl-mount';element.dataset.version=geometry.version;
  element.setAttribute('role','group');element.setAttribute('aria-label','IRS coaxial DSPL SEL outer mode and BRT inner brightness');
  Object.assign(element.style,{left:(center.x-size.width/2)+'px',top:(center.y-size.height/2)+'px',width:size.width+'px',height:size.height+'px'});
  const outer=document.createElement('span');outer.className='irs-upper-mode-rotor';outer.append(photo('irs-upper-photo','irs-upper-mode-outer-v1.png'));
  // The owner-requested black reference mark belongs ONLY to the outer rotor.
  const marker=document.createElementNS('http://www.w3.org/2000/svg','svg');marker.setAttribute('viewBox','0 0 1024 1024');marker.setAttribute('preserveAspectRatio','none');marker.setAttribute('class','irs-upper-mode-index');marker.setAttribute('aria-hidden','true');
  const line=document.createElementNS('http://www.w3.org/2000/svg','line');
  for(const [key,value]of Object.entries({x1:115,y1:512,x2:245,y2:512,stroke:'#101010','stroke-width':18,'stroke-linecap':'round'}))line.setAttribute(key,String(value));marker.append(line);outer.append(marker);
  const inner=document.createElement('span');inner.className='irs-upper-brt-rotor';inner.append(photo('irs-upper-photo','irs-upper-brt-inner-v1.png'));
  element.append(outer,inner,control('mode','IRS DSPL SEL outer mode selector',0,4),control('brightness','IRS BRT inner brightness knob',0,100));
  // Dims only the existing display aperture; no invented navigation values.
  displayMask=document.createElement('div');displayMask.id='irsUpperDisplayDimmer';displayMask.className='irs-upper-display-dimmer';displayMask.setAttribute('aria-hidden','true');
  Object.assign(displayMask.style,{left:(map.x+431*map.width/map.sourceWidth)+'px',top:(map.y+238*map.height/map.sourceHeight)+'px',width:(302*map.width/map.sourceWidth)+'px',height:(43*map.height/map.sourceHeight)+'px'});
  region.append(displayMask,element);render();return element;
 }
 function boot(){
  mount();
  if(!element){const observer=new MutationObserver(()=>{if(mount())observer.disconnect();});observer.observe(document.documentElement,{childList:true,subtree:true});}
  root.addEventListener('b737:cockpit-mounted',mount);
 }
 root.B737IRSDisplaySelector=Object.freeze({modes:MODES,setMode,setBrightness,getState:snapshot,mount,geometry,getElement:()=>element});
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})(window);
