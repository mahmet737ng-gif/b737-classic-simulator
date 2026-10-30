/* Unified Boeing CDU 24-column screen v6.
 * 24 full-width "A" characters exactly fill the native scratchpad column.
 * This is calculated from the original locked BoeingCDULarge glyph widths in
 * the real browser, not by guessing font-size or re-scaling the panel bitmap.
 * Every CDU refresh and either seat share this same calibrated character grid.
 */
(function(root){
 'use strict';
 const VERSION='CDU-24COL-0006';
 const Metrics=root.B737CDU24ColumnMetricsV1;
 const seat=new URLSearchParams(root.location.search).get('seat');
 if(!['CAPT','FO'].includes(seat)||!Metrics)return;
 const box=root.document.getElementById('fmc-lines');
 const screen=root.document.getElementById('fmc-screen');
 if(!box||!screen)return;
 const canvas=root.document.createElement('canvas');
 const ctx=canvas.getContext('2d');
 if(!ctx)return;
 const TOP={header:.5,label:[10,24.5,39,53.5,68,82.5],
  value:[16.5,31,45.5,60,74.5,86],scratch:93.2};
 let scheduled=false,lastResult=null;
 function size(el,px){
  if(!el)return;
  el.style.setProperty('font-size',Number(px.toFixed(2))+'px','important');
 }
 function typography(el,px){
  size(el,px);
  el.style.setProperty('line-height','.90','important');
  el.style.setProperty('letter-spacing','0px','important');
  el.style.setProperty('font-kerning','none','important');
 }
 function fontFace(el){return root.getComputedStyle(el).fontFamily;}
 function fitFragment(span,basePx,fullAllowed){
  if(!span)return;
  span.style.removeProperty('font-size');
  const content=span.textContent||'';
  if(!content||!content.trim())return;
  // The scratchpad MUST NOT shrink to fit arbitrary text: 24 columns
  // are determined once from exactly 24 A, never from current contents.
  if(fullAllowed)return;
  const w=span.getBoundingClientRect().width;
  if(!(w>0))return;
  const family=fontFace(span);
  ctx.font='400 '+basePx+'px '+family;
  const needed=ctx.measureText(content).width;
  if(needed>w-2){
   typography(span,Math.max(1,basePx*(w-2)/needed));
  }
 }
 function keepScratchInside(scratch){
  const left=scratch?.querySelector('.fmc-left');
  if(!left)return;
  // Use the native screen edge rather than the parent page's zoom factor.
  const boxBottom=screen.getBoundingClientRect().bottom;
  const lineBottom=left.getBoundingClientRect().bottom;
  if(Number.isFinite(boxBottom)&&Number.isFinite(lineBottom)&&lineBottom>boxBottom-2){
   const shift=Math.min(90,lineBottom-boxBottom+3);
   const top=parseFloat(root.getComputedStyle(scratch).top)||0;
   scratch.style.setProperty('top',Math.max(0,top-shift)+'px','important');
  }
 }
 function calibrate(){
  const scratch=box.querySelector('.fmc-line.scratch');
  const left=scratch?.querySelector('.fmc-left.full');
  const small=box.querySelector('.fmc-line.fmc-small .fmc-left');
  if(!left||!small)return {ready:false,reason:'MISSING_CDU_TEXT_OR_SCRATCHPAD'};
  const available=left.getBoundingClientRect().width;
  if(!(available>100))return {ready:false,reason:'SCREEN_WIDTH_NOT_MEASURABLE'};
  const family=fontFace(left),smallFamily=fontFace(small);
  const fonts=root.document.fonts;
  if(fonts&&typeof fonts.check==='function'&&
     (!fonts.check('100px "BoeingCDULarge"',Metrics.TEST)||
      !fonts.check('100px "BoeingCDUSmall"',Metrics.TEST)))
   return {ready:false,reason:'WAITING_FOR_APPROVED_BOEING_FONTS'};
  const large=Metrics.calibrate(ctx,available,family);
  const little=Metrics.calibrate(ctx,available,smallFamily);
  if(!large.valid||!little.valid)return {ready:false,reason:'FONT_NOT_READY_OR_METRIC_MISMATCH',large,little};
  return {ready:true,large,little,fontFamily:family,smallFontFamily:smallFamily,
   widthPx:available,mainPx:large.fontSizePx,labelPx:little.fontSizePx*.78,
   headerPx:large.fontSizePx*.84,scratchPx:large.fontSizePx};
 }
 function apply(){
  const model=calibrate();if(!model.ready){lastResult=model;return model;}
  const lines=[...box.querySelectorAll('.fmc-line')];
  const header=lines.find(l=>l.classList.contains('fmc-header'));
  const pairs=lines.filter(l=>l.classList.contains('fmc-pairline')&&!l.classList.contains('scratch'));
  const standard=pairs.length===12&&pairs.filter(l=>l.classList.contains('fmc-small')).length===6;
  const scratch=lines.find(l=>l.classList.contains('scratch'));
  const main=model.mainPx,small=model.labelPx;
  box.style.setProperty('color','#29ff31','important');
  box.style.setProperty('font-size',main+'px','important');
  if(header){
   header.style.setProperty('top',TOP.header+'%','important');
   header.style.setProperty('height','10%','important');
   typography(header,model.headerPx);
   for(const span of header.querySelectorAll('span'))fitFragment(span,model.headerPx,false);
  }
  for(let i=0;i<pairs.length;i++){
   const line=pairs[i],label=line.classList.contains('fmc-small'),row=Math.floor(i/2);
   const px=label?small:main;
   // Special FCOM overlays retain their authored vertical registration.
   if(standard&&row<6)line.style.setProperty('top',TOP[label?'label':'value'][row]+'%','important');
   line.style.setProperty('height',(label?'8%':'10.5%'),'important');
   typography(line,px);
   for(const span of line.querySelectorAll('span'))fitFragment(span,px,false);
  }
  if(scratch){
   scratch.style.setProperty('top',TOP.scratch+'%','important');
   scratch.style.setProperty('height','8.5%','important');
   typography(scratch,model.scratchPx);
   const left=scratch.querySelector('.fmc-left');
   if(left){left.style.removeProperty('font-size');left.style.setProperty('letter-spacing','0px','important');}
   keepScratchInside(scratch);
  }
  root.document.documentElement.dataset.cduScreenFit=VERSION;
  lastResult={ready:true,version:VERSION,standard,columns:Metrics.COLUMNS,
   fontSizePx:model.scratchPx,labelPx:model.labelPx,
   large:model.large,little:model.little,widthPx:model.widthPx,
   scratchLength:(scratch?.querySelector('.fmc-left')?.textContent||'').length,
   source:'MEASURED_BOEING_CDU_GLYPHS'};
  return lastResult;
 }
 function schedule(){
  if(scheduled)return;
  scheduled=true;
  root.requestAnimationFrame(()=>{scheduled=false;apply();root.B737CduTypographyV6?.report?.();});
 }
 const observer=new MutationObserver(schedule);
 observer.observe(box,{childList:true,subtree:true,characterData:true});
 root.B737CduScreenFitV6=Object.freeze({apply,schedule,getState:()=>lastResult,
  version:VERSION,columns:Metrics.COLUMNS});
 apply();
 if(root.document.fonts){
  root.document.fonts.ready?.then(schedule).catch(()=>{});
  root.document.fonts.load?.('100px "BoeingCDULarge"','AAAAAAAA').then(schedule).catch(()=>{});
  root.document.fonts.load?.('100px "BoeingCDUSmall"','AAAAAAAA').then(schedule).catch(()=>{});
 }
 root.addEventListener('resize',schedule);
})(window);
