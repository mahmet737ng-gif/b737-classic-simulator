/* IRS-INDEX-0002 — the upper DSPL SEL retains its cues, while L/R IRS MSU
 * now use the approved photo rotary and the photo-printed markings.
 * DO NOT change original photos, knob size, detent angles, event handlers,
 * locked lower SYS DSPL, owner18 guards or aircraft control state.
 */
(function(root){
 'use strict';
 const SVG='http://www.w3.org/2000/svg';
 // The upper rotor already uses the owner's exact five angular positions.
 const UPPER_MODES=Object.freeze(['TEST','TK/GS','PPOS','WIND','HDG/STS']);
 const MSU_MODES=Object.freeze(['OFF','ALIGN','NAV','ATT']);
 const MSU_ANGLES=Object.freeze([-70,-38,25,69]); // photographic pointer, four original label directions
 const upperBase=180; // existing upper reference pointer faces LEFT at angle 0
 const msuBase=-90;  // existing MSU lever tip faces UP before mode rotation
 let mountedUpper=false,mountedMsu=0,watch=null;
 const mk=(name,attrs={})=>{
  const node=document.createElementNS(SVG,name);
  for(const [key,value] of Object.entries(attrs))node.setAttribute(key,String(value));
  return node;
 };
 const polar=(center,radius,degrees)=>{
  const a=degrees*Math.PI/180;
  return {x:center+radius*Math.cos(a),y:center+radius*Math.sin(a)};
 };
 function strokeLine(svg,one,two,stroke,width,className){
  const el=mk('line',{x1:one.x.toFixed(4),y1:one.y.toFixed(4),x2:two.x.toFixed(4),y2:two.y.toFixed(4),
   stroke,'stroke-width':width,'stroke-linecap':'round'});
  if(className)el.setAttribute('class',className);
  svg.appendChild(el);return el;
 }
 function tickFace(kind,angles){
  const center=kind==='upper'?44:50,inner=kind==='upper'?33.8:42.8,outer=kind==='upper'?40.5:48.7,base=kind==='upper'?upperBase:msuBase;
  const svg=mk('svg',{viewBox:'0 0 '+(center*2)+' '+(center*2),preserveAspectRatio:'none',
   'aria-hidden':'true','data-irs-tick-bank':kind});
  svg.classList.add('irs-rotary-fixed-ticks','irs-rotary-fixed-ticks-'+kind);
  for(let i=0;i<angles.length;i++){
   const from=polar(center,inner,base+angles[i]),to=polar(center,outer,base+angles[i]);
   strokeLine(svg,from,to,'#263136',kind==='upper'?4.2:4.5,'irs-detent-tick-outline');
   const t=strokeLine(svg,from,to,'#fdfdfa',kind==='upper'?2.6:2.8,'irs-detent-tick');
   t.setAttribute('data-detent-index',String(i));
   t.setAttribute('data-detent-mode',kind==='upper'?UPPER_MODES[i]:MSU_MODES[i]);
  }
  return svg;
 }
 function pointerFace(kind){
  const upper=kind==='upper',c=upper?44:50,r1=upper?21.5:29,r2=upper?31.0:39.0;
  const svg=mk('svg',{viewBox:'0 0 '+(c*2)+' '+(c*2),preserveAspectRatio:'none',
   'aria-hidden':'true','data-irs-pointer':kind});
  svg.classList.add('irs-rotary-reference-pointer','irs-rotary-reference-pointer-'+kind);
  const base=upper?upperBase:msuBase;
  const a=polar(c,r1,base),b=polar(c,r2,base);
  // Black tip sits INSIDE the bezel edge, not inside the stationary label area.
  strokeLine(svg,a,b,'#07090a',upper?3.7:4.1,'irs-index-ink');
  return svg;
 }
 function setupUpper(){
  const knob=document.getElementById('irsUpperDsplMounted');
  const api=root.B737IRSDisplaySelector;
  if(!knob||!api?.geometry)return false;
  const outer=knob.querySelector('.irs-upper-mode-rotor');
  if(!outer)return false;
  const angles=api.geometry.modeAngles;
  if(!Array.isArray(angles)||angles.length!==5||angles.some(n=>!Number.isFinite(n)))return false;
  if(!knob.querySelector('[data-irs-tick-bank="upper"]')){
   // Fixed ticks are children of the stationary mount and do NOT rotate.
   knob.insertBefore(tickFace('upper',angles),outer);
  }
  if(!outer.querySelector('[data-irs-pointer="upper"]')){
   // The photo retains its texture; the ink mark rotates with only outer mode rotor.
   outer.appendChild(pointerFace('upper'));
  }
  mountedUpper=true;return true;
 }
 function setupMsu(){
  const rootPanel=document.getElementById('irsTrainerMSU');if(!rootPanel)return 0;
  let count=0;
  for(const side of ['L','R']){
   const knob=rootPanel.querySelector('[data-msu-mini="'+side+'"]');
   if(!knob)continue;
   // The photographed panel already has marks. Remove synthetic MSU
   // detent strokes and pointer instead of painting over approved artwork.
   for(const old of [...knob.querySelectorAll('[data-irs-tick-bank="msu"]'),...knob.querySelectorAll('[data-irs-pointer="msu"]')])old.remove();
   knob.dataset.irsIndexVersion='IRS-INDEX-0002';
   if(knob.querySelector('.irs-msu-owner-photo'))count++;
  }
  mountedMsu=count;return count;
 }
 function install(){return {upper:setupUpper(),msu:setupMsu()};}
 function boot(){
  install();
  if(!mountedUpper||mountedMsu!==2){
   watch=new MutationObserver(()=>{
    install();
    if(mountedUpper&&mountedMsu===2){watch.disconnect();watch=null;}
   });
   watch.observe(document.documentElement,{childList:true,subtree:true});
  }
 }
 root.addEventListener('b737:cockpit-mounted',install);
 root.B737IRSRotaryIndices=Object.freeze({
  install,
  audit:()=>{
   const upper=document.getElementById('irsUpperDsplMounted'),msu=document.getElementById('irsTrainerMSU');
   const entries=[{name:'UPPER DSPL SEL',el:upper,count:5},...['L','R'].map(n=>({name:'IRS '+n,el:msu?.querySelector('[data-msu-mini="'+n+'"]'),count:0}))];
   return entries.map(x=>({
    name:x.name,ready:!!x.el,
    tickCount:x.el?.querySelectorAll('.irs-detent-tick').length||0,
    expected:x.count,pointerCount:x.el?.querySelectorAll('.irs-index-ink').length||0,
    mode:x.name==='UPPER DSPL SEL'?root.B737IRSDisplaySelector?.getState?.().mode:x.el?.dataset.mode,
    pass:!!x.el&&(x.name==='UPPER DSPL SEL'
     ?x.el.querySelectorAll('.irs-detent-tick').length===5&&x.el.querySelectorAll('.irs-index-ink').length===1
     :x.el.querySelectorAll('.irs-detent-tick').length===0&&x.el.querySelectorAll('.irs-index-ink').length===0&&!!x.el.querySelector('.irs-msu-owner-photo'))
   }));
  },
  angles:Object.freeze({upperBase,upper:Object.freeze([0,35,65,125,150]),msuBase,msu:MSU_ANGLES})
 });
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})(window);
