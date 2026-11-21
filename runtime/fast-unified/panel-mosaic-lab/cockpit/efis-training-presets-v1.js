/* Instructor shortcuts for the shared IRS trainer and EFIS source selector. */
(function(root,factory){
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root.document)api.install(root);
})(globalThis,function(){
 'use strict';
 const SIDES=['L','R'];
 // Existing IRS test lab's Tehran training datum, rounded to ISDU precision.
 const DEFAULT_POSITION='N35395 E051254';
 function formatPosition({lat,lon}){
  const field=(value,width,positive,negative)=>{
   const minutes=Math.round(Math.abs(value)*600);
   return (value<0?negative:positive)+String(Math.floor(minutes/600)).padStart(width,'0')+
    String(minutes%600).padStart(3,'0');
  };
  return field(lat,2,'N','S')+' '+field(lon,3,'E','W');
 }
 function apply(win,preset){
  if(!['FULL_ALIGN','COLD_DARK','LIVE'].includes(preset))throw Error('Unknown EFIS preset');
  const irs=win.B737IRSTrainerUnified,core=win.B737IRSTrainerCoreV1,sources=win.B737UnifiedEfisSources;
  if(!irs||!core||!sources)throw Error('IRS is loading. Try again in a moment.');
  const before=irs.getState();
  if(preset==='FULL_ALIGN'){
   const blocked=SIDES.find(side=>win.B737UnifiedCB?.irsPower?.(side,true)===false);
   if(blocked)throw Error('IRS '+blocked+' has no feed through its circuit breakers.');
   const last=SIDES.map(side=>before.units[side]).find(u=>u.positionValid);
   const text=last?.position?formatPosition(last.position):DEFAULT_POSITION;
   const heading=Number.isFinite(last?.trueHeadingDeg)?last.trueHeadingDeg%360:90;
   const reference=core.trainingAlignmentReference(core.parseFmcPosition(text),heading);
   irs.setPowerMode('BENCH');
   for(const side of SIDES){
    if(before.units[side].mode!=='OFF')irs.setMode(side,'OFF');
    irs.setMode(side,'NAV');
   }
   irs.setFmcPosition(text,reference);
   irs.setBenchMotion({gsKt:0,trueTrackDeg:heading,trueHeadingDeg:heading});
   if(!SIDES.every(side=>irs.getState().units[side].positionValid))throw Error('Both IRS units did not finish alignment.');
  }else{
   if(preset==='COLD_DARK'){
    for(const side of SIDES)if(before.units[side].mode!=='OFF')irs.setMode(side,'OFF');
   }
   if(preset==='COLD_DARK'||sources.getPreset()==='FULL_ALIGN'&&before.motionSource==='BENCH_SIM')irs.stopMotion();
   irs.setPowerMode('AIRCRAFT');
  }
  sources.setPreset(preset);
  return irs.getState();
 }
 function install(win){
  const doc=win.document;
  const status=doc.getElementById('unifiedEfisPresetStatus');
  const buttons=[...doc.querySelectorAll('[data-efis-preset]')];
  if(!status||!buttons.length)return;
  const descriptions={FULL_ALIGN:'IRS L/R aligned · EFIS training supply enabled.',
   COLD_DARK:'IRS L/R OFF · EADI and EHSI dark.',LIVE:'Aircraft power and manual IRS operation.'};
  const showPreset=preset=>{
   for(const item of buttons)item.setAttribute('aria-pressed',String(item.dataset.efisPreset===preset));
   status.textContent=descriptions[preset];
  };
  let manuallyChanged=false;
  // The EFIS training mode defaults to FULL ALIGN on every fresh Unified load.
  // Run the actual IRS L/R alignment shortcut, not merely the selected button
  // visual or the EFIS source preset. This is an instructor simulation default
  // and must not bypass a pulled circuit breaker or a failed alignment.
  const bootDefault=()=>{
   if(manuallyChanged)return;
   try{
    const current=win.B737UnifiedEfisSources?.getPreset?.();
    if(current&&current!=='LIVE'){
     showPreset(current); // Preserve an earlier explicit mode.
     return;
    }
    apply(win,'FULL_ALIGN');
    showPreset('FULL_ALIGN');
   }catch(error){
    // Never claim aligned when alignment failed, e.g. a pulled IRS CB.
    showPreset(win.B737UnifiedEfisSources?.getPreset?.()||'LIVE');
    status.textContent='FULL ALIGN NOT READY · '+String(error?.message||error);
   }
  };
  if(doc.readyState==='complete')bootDefault();
  else doc.addEventListener('DOMContentLoaded',bootDefault,{once:true});
  for(const button of buttons)button.addEventListener('click',()=>{
   const preset=button.dataset.efisPreset;
   manuallyChanged=true;
   try{
    apply(win,preset);
    showPreset(preset);
   }catch(error){status.textContent=error.message;}
  });
 }
 return Object.freeze({apply,install});
});
