/* Fixed 24-column Boeing CDU display metrics.  Only measures glyph advances,
 * never synthesizes or replaces the locked Boeing CDU font binaries.
 * The scratchpad is exactly 24 cells: 24 "A"s fit, the 25th does not.
 */
(function(root,factory){'use strict';const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.B737CDU24ColumnMetricsV1=api;})(typeof globalThis!=='undefined'?globalThis:null,function(){
 'use strict';
 const COLUMNS=24,TEST='A'.repeat(COLUMNS),TOO_LONG=TEST+'A';
 function measure(ctx,text,px,family){
  ctx.font='400 '+px+'px '+family;
  return ctx.measureText(text).width;
 }
 function calibrate(ctx,availablePx,family,{safetyPx=1.0}={}){
  if(!ctx||typeof ctx.measureText!=='function')throw Error('CANVAS_METRICS_REQUIRED');
  if(!Number.isFinite(availablePx)||availablePx<100)throw Error('INVALID_CDU_TEXT_WIDTH');
  if(typeof family!=='string'||!family.trim())throw Error('LOCKED_CDU_FONT_REQUIRED');
  const available=availablePx-Math.max(0,safetyPx);
  // Derive native font pixels from actual glyphs after document.fonts.ready.
  // No arbitrary 54/92px values and no per-page scratchpad shrinking.
  let low=0,high=1024;
  for(let i=0;i<30;i++){
   const mid=(low+high)/2;
   if(measure(ctx,TEST,mid,family)<=available)low=mid;
   else high=mid;
  }
  const px=Math.floor(low*100)/100; // stable across canvas/DOM rounding
  const width24=measure(ctx,TEST,px,family);
  const width25=measure(ctx,TOO_LONG,px,family);
  const valid=width24<=available+0.01&&width25>available;
  return Object.freeze({columns:COLUMNS,fontSizePx:px,availablePx:available,
   width24Px:width24,width25Px:width25,valid,
   reason:valid?'EXACT_24_COLUMN_FIT':'FONT_NOT_READY_OR_METRIC_MISMATCH'});
 }
 return Object.freeze({COLUMNS,TEST,TOO_LONG,calibrate});
});