/* Unified embedded CDU typography / geometry v4.
 * Live text layer ONLY. Approved photo, hotspots, font binaries, backend remain immutable.
 * Works after every page redraw: the CDU v6 app replaces all .fmc-line nodes.
 */
(function(root){
 'use strict';
 const VERSION='CDU-SCREEN-FIT-0004';
 const seat=new URLSearchParams(root.location.search).get('seat');
 if(!['CAPT','FO'].includes(seat))return;
 const TOP=Object.freeze({header:3,label:[12,26,40,54,68,82],value:[19,33,47,61,75,89],scratch:93.8});
 const FONT=Object.freeze({header:54,label:39,value:54,scratch:42});
 const minSize=27;
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
  const header=lines.find(x=>x.classList.contains('fmc-header'));
  if(header){
   header.style.setProperty('top',TOP.header+'%','important');
   header.style.setProperty('height','10.9%','important');
   size(header,FONT.header);fitSpans(header,FONT.header);
  }
  for(let i=0;i<Math.min(pairs.length,12);i++){
   const line=pairs[i],label=line.classList.contains('fmc-small');
   const row=Math.floor(i/2),target=label?TOP.label[row]:TOP.value[row];
   if(target===undefined)continue;
   line.style.setProperty('top',target+'%','important');
   line.style.setProperty('height',(label?'8.0%':'11.0%'),'important');
   const requested=dense&&row===5?(label?29:39):FONT[label?'label':'value'];
   size(line,requested);fitSpans(line,requested);
  }
  if(scratch){
   scratch.style.setProperty('top',TOP.scratch+'%','important');
   scratch.style.setProperty('height','6.1%','important');
   size(scratch,FONT.scratch);fitSpans(scratch,FONT.scratch);
  }
  root.document.documentElement.dataset.cduScreenFit=VERSION;
  return {ready:true,version:VERSION,pairs:pairs.length,dense,displayRows:lines.length};
 }
 let scheduled=false;
 function schedule(){
  if(scheduled)return;
  scheduled=true;
  root.requestAnimationFrame(()=>{scheduled=false;apply();root.B737CduTypographyV4?.report?.();});
 }
 const observer=new MutationObserver(schedule);
 observer.observe(box,{childList:true,subtree:true,characterData:true});
 root.B737CduScreenFitV4=Object.freeze({version:VERSION,apply,schedule});
 apply();
 if(root.document.fonts?.ready)root.document.fonts.ready.then(schedule).catch(()=>{});
})(window);
