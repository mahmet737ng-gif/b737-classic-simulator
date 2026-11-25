/* Unified Boeing CDU 24-column screen v6.
 * 24 full-width "A" characters exactly fill the native scratchpad column.
 * This is calculated from the original locked BoeingCDULarge glyph widths in
 * the real browser, not by guessing font-size or re-scaling the panel bitmap.
 * Classic IDENT, PERF INIT, RTE, LEGS and DEP/ARR references determine
 * visual hierarchy: smaller field labels, full-size values/LSK prompts and
 * an LSK-registered 6-row grid. Only the FO runtime is loaded in Unified.
 */
(function(root){
 'use strict';
 const VERSION='CDU-24COL-0008';
 const PHOTO_PROFILE=Object.freeze({
  id:'OWNER-CLASSIC-CDU-LEGS-PHOTO-20261031',
  smallCapHeightToLarge:0.62,headerToLarge:0.90,
  lskPromptToLarge:1.00,dataToLarge:1,scratchToLarge:1
 });
 const Metrics=root.B737CDU24ColumnMetricsV1;
 const seat=new URLSearchParams(root.location.search).get('seat');
 if((seat&&!['CAPT','FO'].includes(seat))||!Metrics)return;
 const box=root.document.getElementById('fmc-lines');
 const screen=root.document.getElementById('fmc-screen');
 if(!box||!screen)return;
 const canvas=root.document.createElement('canvas');
 const ctx=canvas.getContext('2d');
 if(!ctx)return;
 const TOP={header:.5,label:[6.9,20.4,35.8,50.8,66.3,76.3],
  value:[12.7,27.8,43.2,58.3,73.7,84.6],scratch:93.2};
 // The physical LSK coordinates are immutable; only these displayed text
 // rows are repositioned. Last pair is capped above the scratchpad.
 const NATIVE_HEIGHT=1312,SCREEN_TOP=.0765*NATIVE_HEIGHT,
  SCREEN_HEIGHT=.375*NATIVE_HEIGHT;
 function rowRegistration(){
  const controls=root.CDU_MAP?.controls;
  if(!Array.isArray(controls))return TOP;
  const rows=Array.from({length:6},(_,i)=>
    controls.find(c=>c.id==='CDU_CAPT_LSK_L'+(i+1)));
  if(rows.some(c=>!Array.isArray(c?.bbox_px)||c.bbox_px.length!==4))return TOP;
  const centers=rows.map(c=>(c.bbox_px[1]+c.bbox_px[3])/2);
  if(centers.some((n,i)=>!Number.isFinite(n)||(i>0&&n<=centers[i-1])))return TOP;
  const pct=cy=>(cy-SCREEN_TOP)/SCREEN_HEIGHT*100;
  return {
   header:TOP.header,scratch:TOP.scratch,
   label:centers.map(cy=>pct(Math.min(cy-19,SCREEN_TOP+SCREEN_HEIGHT*.932-32)-29)),
   value:centers.map(cy=>pct(Math.min(cy-19,SCREEN_TOP+SCREEN_HEIGHT*.932-32)))
  };
 }
 let scheduled=false,lastResult=null,lockedCalibration=null;
 // Native physical CDU width is fixed at 1199px. The same scratchpad must
 // NEVER be remeasured against the freshly repainted page's temporary CSS.
 // Recalibrate only when the actual glyph family or width really changes.
 function cachedModel(available,family,smallFamily){
  if(!lockedCalibration)return null;
  if(Math.abs(lockedCalibration.widthPx-available)>.5||
     lockedCalibration.fontFamily!==family||
     lockedCalibration.smallFontFamily!==smallFamily)return null;
  return lockedCalibration;
 }
 function lockFontGrid(model){
  // fmc-lines survives box.replaceChildren(), unlike its fresh 14 rows.
  // CSS variables therefore give new rows the calibrated font sizes in the
  // SAME paint as their insertion; the observer may later register LSK tops.
  for(const [name,value] of Object.entries({
   '--cdu-locked-value-size':model.mainPx,
   '--cdu-locked-label-size':model.labelPx,
   '--cdu-locked-header-size':model.headerPx,
   '--cdu-locked-prompt-size':model.promptPx,
   '--cdu-locked-scratch-size':model.scratchPx
  }))box.style.setProperty(name,Number(value.toFixed(2))+'px');
  box.dataset && (box.dataset.cduFontGridLocked='true');
 }
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
  if(span.classList.contains('cdu-lsk-prompt'))typography(span,basePx);
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
   // Keep large LSK prompts and data legible; never shrink a long
   // string to a tiny unrelated font size. Overlength data is clipped.
   typography(span,Math.max(basePx*.84,basePx*(w-2)/needed));
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
 function isEntryPromptText(text){
  const v=String(text??'').trim();
  return !/[<>]/.test(v)&&(/[□]/.test(v)||/-{2,}/.test(v)||v==='TRAINER');
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
 function capHeight(family,px){
  ctx.font='400 '+px+'px '+family;
  const m=ctx.measureText('HMWA3');
  const h=(m.actualBoundingBoxAscent||0)+(m.actualBoundingBoxDescent||0);
  return Number.isFinite(h)&&h>0?h:px*.72;
 }
 function labelSize(large,small,largeFamily,smallFamily){
  // The field title must be just slightly smaller than the LSK value.
  // Match cap height rather than the numerical CSS font size.
  const dataCap=capHeight(largeFamily,large);
  const smallCap=capHeight(smallFamily,100);
  return Math.min(large,100*dataCap*PHOTO_PROFILE.smallCapHeightToLarge/smallCap);
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
  const cached=cachedModel(available,family,smallFamily);
  if(cached)return cached;
  const fonts=root.document.fonts;
  if(fonts&&typeof fonts.check==='function'&&
     (!fonts.check('100px "BoeingCDULarge"',Metrics.TEST)||
      !fonts.check('100px "BoeingCDUSmall"',Metrics.TEST)))
   return {ready:false,reason:'WAITING_FOR_APPROVED_BOEING_FONTS'};
  const large=Metrics.calibrate(ctx,available,family);
  const little=Metrics.calibrate(ctx,available,smallFamily);
  if(!large.valid||!little.valid)return {ready:false,reason:'FONT_NOT_READY_OR_METRIC_MISMATCH',large,little};
  lockedCalibration={ready:true,large,little,fontFamily:family,smallFontFamily:smallFamily,
   widthPx:available,mainPx:large.fontSizePx,
   labelPx:labelSize(large.fontSizePx,little.fontSizePx,family,smallFamily),
   headerPx:large.fontSizePx*PHOTO_PROFILE.headerToLarge,
   promptPx:large.fontSizePx*PHOTO_PROFILE.lskPromptToLarge,
   scratchPx:large.fontSizePx};
  lockFontGrid(lockedCalibration);
  return lockedCalibration;
 }
 function apply(){
  const model=calibrate();if(!model.ready){lastResult=model;return model;}
  lockFontGrid(model); // Persist across all 14-row DOM replacements.
  const lines=[...box.querySelectorAll('.fmc-line')];
  const header=lines.find(l=>l.classList.contains('fmc-header'));
  const pairs=lines.filter(l=>l.classList.contains('fmc-pairline')&&!l.classList.contains('scratch'));
  const standard=pairs.length===12&&pairs.filter(l=>l.classList.contains('fmc-small')).length===6;
  const scratch=lines.find(l=>l.classList.contains('scratch'));
  const main=model.mainPx,small=model.labelPx,grid=rowRegistration();
  const pageId=root.document.getElementById('page-now')?.textContent;
  const ownerIdent=pageId==='IDENT'&&
   root.CDU_PAGES?.IDENT?.variant==='OWNER_CLASSIC_IDENT_20261031';
  // Keep the 24-column scratchpad font at its calibrated baseline.
  // Apply the requested multipliers only to the LSK page rows.
  const pageValuePx=main,pageLabelPx=small; // One font profile for every CDU page
  const promptsMoved=putPromptsOnLSKLines(pairs,standard);
  box.style.setProperty('color','#29e637','important');
  box.style.setProperty('font-size',main+'px','important');
  if(header){
   header.style.setProperty('top',grid.header+'%','important');
   header.style.setProperty('height','7%','important');
   typography(header,model.headerPx);
   for(const span of header.querySelectorAll('span'))fitFragment(span,model.headerPx,false);
  }
  for(let i=0;i<pairs.length;i++){
   const line=pairs[i],label=line.classList.contains('fmc-small'),row=Math.floor(i/2);
   // IDENT uses the owner's two 12-column date lines. A calibrated, uniform
   // character size fits them without cumulative X/Y transforms or clipping.
   const px=label?pageLabelPx:pageValuePx;
   // Special FCOM overlays retain their authored registration and font scale.
   if(standard&&row<6)
    line.style.setProperty('top',grid[label?'label':'value'][row]+'%','important');
   line.style.setProperty('height',(label?'5.7%':'7%'),'important');
   line.style.setProperty('overflow','visible','important');
   typography(line,px);
   for(const span of line.querySelectorAll('span')){
    if(span.classList.contains('cdu-square-glyphs'))continue;
    if(span.classList.contains('cdu-leg-degree')){span.style.setProperty('font-size',(pageLabelPx*.78)+'px','important');continue;}
    if(span.classList.contains('cdu-leg-angle')){typography(span,pageLabelPx*1.12);span.style.setProperty('text-indent','1ch','important');continue;}
    if(span.classList.contains('cdu-leg-distance')){typography(span,pageLabelPx);span.style.setProperty('text-align','left','important');continue;}
    if(ownerIdent){
     typography(span,px);
     span.style.setProperty('font-family',label?'"BoeingCDUSmall"':'"BoeingCDULarge"','important');
     span.style.setProperty('transform','none','important');
     span.style.setProperty('overflow','visible','important');
     continue;
    }
    const prompt=isLSKPrompt(span,label);
    const entry=!label&&!prompt&&isEntryPromptText(span.textContent);
    if(prompt)span.classList.add('cdu-lsk-prompt');
    if(entry)span.classList.add('cdu-entry-placeholder');
    if(!standard){
     fitFragment(span,prompt?model.promptPx:px,false);
     continue;
    }
    // Uniform-sized text across the entire 24-column CDU display.
    const effectivePx=px;
    typography(span,effectivePx);
    // Physical reference: no per-field squeeze or stretch of letterforms.
    // The 24-column width is set by the scratchpad metric, not by contents.
    span.style.setProperty('overflow',span.classList.contains('cdu-square-entry')?'visible':'hidden','important');
    span.style.setProperty('transform','none','important');
   }
  }
  if(scratch){
   scratch.style.setProperty('top',grid.scratch+'%','important');
   scratch.style.setProperty('height','8.5%','important');
   typography(scratch,model.scratchPx);
   const left=scratch.querySelector('.fmc-left');
   if(left){left.style.removeProperty('font-size');left.style.setProperty('letter-spacing','0px','important');}
   keepScratchInside(scratch);
  }
  root.document.documentElement.dataset.cduScreenFit=VERSION;
  lastResult={ready:true,version:VERSION,standard,columns:Metrics.COLUMNS,
   identReference:ownerIdent?{largePx:main,smallPx:small}:null,
   fontSizePx:model.scratchPx,labelPx:model.labelPx,
   pageValuePx,pageLabelPx,pageValueMultiplier:1,pageLabelMultiplier:1,
   entryPromptPx:main,entryPromptMultiplier:1,
   navigationPromptPx:main,navigationPromptMultiplier:1,
   headerPx:model.headerPx,promptPx:model.promptPx,photoProfile:PHOTO_PROFILE.id,promptsMoved,
   large:model.large,little:model.little,widthPx:model.widthPx,
   scratchLength:(scratch?.querySelector('.fmc-left')?.textContent||'').length,
   source:'OWNER_LEGS_PHOTO_20261031_ROLE_TYPOGRAPHY_24_COLUMNS_LSK_GRID_V8'};
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
  version:VERSION,columns:Metrics.COLUMNS,rowRegistration,photoProfile:PHOTO_PROFILE});
 apply();
 if(root.document.fonts){
  root.document.fonts.ready?.then(schedule).catch(()=>{});
  root.document.fonts.load?.('100px "BoeingCDULarge"','AAAAAAAA').then(schedule).catch(()=>{});
  root.document.fonts.load?.('100px "BoeingCDUSmall"','AAAAAAAA').then(schedule).catch(()=>{});
 }
 root.addEventListener('resize',schedule);
})(window);
