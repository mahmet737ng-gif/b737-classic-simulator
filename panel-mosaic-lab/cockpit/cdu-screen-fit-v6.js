/* Unified Boeing CDU 24-column screen v6.
 * 24 full-width "A" characters exactly fill the native scratchpad column.
 * This is calculated from the original locked BoeingCDULarge glyph widths in
 * the real browser, not by guessing font-size or re-scaling the panel bitmap.
 * Every CDU refresh and either seat share this same calibrated character grid.
 */
(function(root){
 'use strict';
 const VERSION='CDU-24COL-0006';
 // Visually cross-checked with 737-300 IDENT / select-waypoint CRT screens,
 // Boeing RTE/PERF INIT/TAKEOFF/LEGS photos. Ratios, NOT guessed native pixels.
 // Physical font families, 24 A scratch width, LSK positions and artwork locked.
 const PHOTO_PROFILE=Object.freeze({
  id:'CLASSIC-CDU-PHOTO-HIERARCHY-0001',
  smallLabelToLarge:0.73,
  headerToLarge:0.88,
  lskPromptToLarge:0.95,
  largeValueToLarge:1.00,
  scratchToLarge:1.00
 });
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
  if(span.classList.contains('cdu-lsk-prompt'))
   typography(span,basePx);
  else span.style.removeProperty('font-size');
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
 // Source-authoritative action labels such as <INDEX or PERF INIT> are the
 // LARGE data-line LSK prompts; the SMALL row is reserved for field titles.
 // This is presentation-only; never mutate the FCOM source table or LSK map.
 function putPromptsOnLSKLines(pairs,standard){
  if(!standard)return 0;
  const pageId=root.document.getElementById('page-now')?.textContent;
  const rows=root.CDU_PAGES?.[pageId]?.rows;
  if(!Array.isArray(rows))return 0;
  let moved=0;
  for(let row=0;row<6;row++){
   const labelLine=pairs[row*2],valueLine=pairs[row*2+1];
   if(!labelLine?.classList?.contains('fmc-small')||
       !valueLine||valueLine.classList.contains('fmc-small'))continue;
   for(let col=0;col<2;col++){
    const cell=rows[row]?.[col];
    if(!cell?.action||cell.field||cell.value||!cell.label)continue;
    const cls=col===0?'.fmc-left':'.fmc-right';
    const label=labelLine.querySelector(cls),data=valueLine.querySelector(cls);
    // A dynamic source adapter may already own a value; never overwrite it.
    if(!label||!data||label.textContent!==cell.label||data.textContent?.trim())continue;
    data.textContent=label.textContent;
    label.textContent='';
    data.classList.add('cdu-lsk-prompt');
    moved++;
   }
  }
  return moved;
 }
 function isLSKPrompt(span,label){
  if(!span||label)return false;
  if(span.classList.contains('cdu-lsk-prompt'))return true;
  const t=String(span.textContent||'').trim();
  return t.length>0&&(/^[<]/.test(t)||/[>]$/.test(t));
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
  // Reference-only NAVDB overlays sometimes have no explicitly small labels.
  // That must NOT disable the 24-column scratchpad calibration for that page.
  const small=box.querySelector('.fmc-line.fmc-small .fmc-left')||left;
  if(!left)return {ready:false,reason:'MISSING_CDU_SCRATCHPAD'};
  const available=left.getBoundingClientRect().width;
  if(!(available>100))return {ready:false,reason:'SCREEN_WIDTH_NOT_MEASURABLE'};
  const family=fontFace(left),smallFamily=small===left?'BoeingCDUSmall':fontFace(small);
  const fonts=root.document.fonts;
  if(fonts&&typeof fonts.check==='function'&&
     (!fonts.check('100px "BoeingCDULarge"',Metrics.TEST)||
      !fonts.check('100px "BoeingCDUSmall"',Metrics.TEST)))
   return {ready:false,reason:'WAITING_FOR_APPROVED_BOEING_FONTS'};
  const large=Metrics.calibrate(ctx,available,family);
  const little=Metrics.calibrate(ctx,available,smallFamily);
  if(!large.valid||!little.valid)return {ready:false,reason:'FONT_NOT_READY_OR_METRIC_MISMATCH',large,little};
  return {ready:true,large,little,fontFamily:family,smallFontFamily:smallFamily,
   widthPx:available,mainPx:large.fontSizePx,
   labelPx:Math.min(little.fontSizePx*.78,
                    large.fontSizePx*PHOTO_PROFILE.smallLabelToLarge),
   headerPx:large.fontSizePx*PHOTO_PROFILE.headerToLarge,
   promptPx:large.fontSizePx*PHOTO_PROFILE.lskPromptToLarge,
   scratchPx:large.fontSizePx};
 }
 function apply(){
  const model=calibrate();if(!model.ready){lastResult=model;return model;}
  const lines=[...box.querySelectorAll('.fmc-line')];
  const header=lines.find(l=>l.classList.contains('fmc-header'));
  const pairs=lines.filter(l=>l.classList.contains('fmc-pairline')&&!l.classList.contains('scratch'));
  const standard=pairs.length===12&&pairs.filter(l=>l.classList.contains('fmc-small')).length===6;
  const scratch=lines.find(l=>l.classList.contains('scratch'));
  const main=model.mainPx,small=model.labelPx;
  const promptsMoved=putPromptsOnLSKLines(pairs,standard);
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
   for(const span of line.querySelectorAll('span')){
    const prompt=isLSKPrompt(span,label);
    const isCenter=span.classList.contains('fmc-center');
    // FCOM DEP/ARR triplets have small guidance plus large airport centres.
    const target=prompt?model.promptPx:
      isCenter&&!label?main:px;
    if(prompt)span.classList.add('cdu-lsk-prompt');
    fitFragment(span,target,false);
   }
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
   headerPx:model.headerPx,promptPx:model.promptPx,photoProfile:PHOTO_PROFILE.id,
   promptsMoved,
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
  version:VERSION,columns:Metrics.COLUMNS,photoProfile:PHOTO_PROFILE});
 apply();
 if(root.document.fonts){
  root.document.fonts.ready?.then(schedule).catch(()=>{});
  root.document.fonts.load?.('100px "BoeingCDULarge"','AAAAAAAA').then(schedule).catch(()=>{});
  root.document.fonts.load?.('100px "BoeingCDUSmall"','AAAAAAAA').then(schedule).catch(()=>{});
 }
 root.addEventListener('resize',schedule);
})(window);
