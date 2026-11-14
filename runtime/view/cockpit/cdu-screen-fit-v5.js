/* Unified embedded CDU typography / geometry v5.
 * Live text layer ONLY. Approved photo, hotspots, font binaries, backend remain immutable.
 * Works after every page redraw: the CDU v6 app replaces all .fmc-line nodes.
 */
(function(root){
 'use strict';
 const VERSION='CDU-SCREEN-FIT-0005';
 const seat=new URLSearchParams(root.location.search).get('seat');
 if(!['CAPT','FO'].includes(seat))return;
 const TOP=Object.freeze({header:0.5,label:[10,24.5,39,53.5,68,82.5],value:[16.5,31,45.5,60,74.5,89],scratch:94.5});
 const FONT=Object.freeze({header:86,label:72,value:92,scratch:72,custom:64});
 const minSize=40;
 const box=root.document.getElementById('fmc-lines');
 if(!box)return;
 const canvas=root.document.createElement('canvas');
 const ctx=canvas.getContext('2d');
 const size=(elem,px)=>elem.style.setProperty('font-size',px+'px','important');
 function fitSpans(line,requested){
  const spans=line.querySelectorAll('span');
  for(const span of spans){
   const text=span.textContent||'';
   if(!text.trim())continue;
   span.style.removeProperty('font-size'); // Re-evaluate at full size after font load or DOM refresh.
   let px=requested;
   const computed=root.getComputedStyle(span);
   const width=span.getBoundingClientRect().width||line.getBoundingClientRect().width*(span.classList.contains('full')?1:0.475);
   if(!width||!ctx)continue;
   for(;px>minSize;px--){
    ctx.font='400 '+px+'px '+computed.fontFamily;
    // Reserve a small safety margin at both boundaries for antialiasing.
    if(ctx.measureText(text).width<=width-5)break;
   }
   if(px<requested)size(span,px);
  }
 }
 function apply(){
  const lines=[...box.querySelectorAll('.fmc-line')];
  if(!lines.length)return {ready:false,reason:'NO_CDU_TEXT'};
  const scratch=lines.find(x=>x.classList.contains('scratch'));
  const scratchActive=!!scratch?.textContent.trim();
  const pairs=lines.filter(x=>x.classList.contains('fmc-pairline')&&!x.classList.contains('scratch'));
  const lastPairNonempty=pairs.slice(-2).some(x=>x.textContent.trim());
  const dense=scratchActive&&lastPairNonempty;
  const standard=(pairs.length===12&&pairs.filter(x=>x.classList.contains('fmc-small')).length===6);
  const header=lines.find(x=>x.classList.contains('fmc-header'));
  if(header){
   header.style.setProperty('top',TOP.header+'%','important');
   header.style.setProperty('height','11.5%','important');
   size(header,FONT.header);fitSpans(header,FONT.header);
  }
  for(let i=0;i<pairs.length;i++){
   const line=pairs[i],label=line.classList.contains('fmc-small');
   const row=Math.floor(i/2),target=label?TOP.label[row]:TOP.value[row];
   if(standard&&target===undefined)continue;
   // Source-backed NAV/DEP overlays replace the ordinary 12 rows. Their own
   // carefully placed row coordinates must not be overwritten by this adapter.
   if(standard)line.style.setProperty('top',target+'%','important');
   line.style.setProperty('height',(label?'8.0%':standard?'12.0%':'6.0%'),'important');
   let requested=standard?(dense&&row===5?(label?54:62):FONT[label?'label':'value']):FONT.custom;
   if(!standard){
    // Preserve source-page geometry; on tightly packed custom overlays,
    // choose the largest font that does not collide with the next row.
    const currentTop=parseFloat(line.style.top)||0;
    const future=pairs.slice(i+1).map(next=>parseFloat(next.style.top)).filter(x=>Number.isFinite(x)&&x>currentTop);
    const gap=future.length?Math.min(...future)-currentTop:9;
    requested=Math.min(FONT.custom,Math.max(40,Math.round(gap*7.4)));
   }
   size(line,requested);fitSpans(line,requested);
  }
  if(scratch){
   scratch.style.setProperty('top',TOP.scratch+'%','important');
   scratch.style.setProperty('height','6.1%','important');
   size(scratch,FONT.scratch);fitSpans(scratch,FONT.scratch);
  }
  root.document.documentElement.dataset.cduScreenFit=VERSION;
  return {ready:true,version:VERSION,pairs:pairs.length,standard,dense,displayRows:lines.length};
 }
 let scheduled=false;
 function schedule(){
  if(scheduled)return;
  scheduled=true;
  root.requestAnimationFrame(()=>{scheduled=false;apply();root.B737CduTypographyV5?.report?.();});
 }
 const observer=new MutationObserver(schedule);
 observer.observe(box,{childList:true,subtree:true,characterData:true});
 root.B737CduScreenFitV5=Object.freeze({version:VERSION,apply,schedule});
 apply();
 if(root.document.fonts?.ready)root.document.fonts.ready.then(schedule).catch(()=>{});
})(window);
