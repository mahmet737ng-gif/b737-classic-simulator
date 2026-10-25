(function(){
 'use strict';
 // Startup policy applies only demonstrably safe physical/stop positions.
 // It never converts an unverified scale into a flight-ready reading.
 const policyUrl=new URL('../../engine/instruments/cold-dark-indicator-policy-v1.json',document.baseURI).href;
 let ready=false,last=null,lastApplied=null,simActive=false;
 const report=()=>last;
 function safeApply(context){
   if(!ready)throw Error('Cold-dark registry not loaded');
   const resolver=window.B737ColdDarkIndicatorV1;
   const state=resolver.snapshot(context);
   last=state;
   const applied=[], skipped=[];
   const call=(fn,id)=>{try{fn();applied.push(id);}catch(error){skipped.push(id+': '+error.message);}};
   const isSafe=(id,value)=>state[id]?.status==='physical_value_known'&&state[id].value===value;
   // Existing APIs take calibrated visual offsets, not physical values.
   // Apply ONLY gauges where those existing models already define a known
   // zero/low-stop reference. Never manufacture numeric->angle calibrations.
   if(isSafe('oh.cabin.rate',0)&&window.B737UnifiedCabinRateNeedle)
     call(()=>window.B737UnifiedCabinRateNeedle.setOffset(0),'oh.cabin.rate');
   if(isSafe('oh.duct.pressure_lr',0)&&window.B737UnifiedDuctPressureNeedles)
     call(()=>window.B737UnifiedDuctPressureNeedles.setValues({L:0,R:0}),'oh.duct.pressure_lr');
   const air1=state['capt.airspeed'],air2=state['fo.airspeed'];
   if(air1?.status==='low_stop_if_offscale'&&air2?.status==='low_stop_if_offscale'&&
     window.B737UnifiedAirspeedPointers)
     call(()=>window.B737UnifiedAirspeedPointers.setAirspeedKts(60),'capt.airspeed / fo.airspeed');
   if(state['oh.fuel.temperature']?.status==='physical_value_known'&&window.B737UnifiedFuelTemperature)
     call(()=>window.B737UnifiedFuelTemperature.setTemperature(state['oh.fuel.temperature'].value),
       'oh.fuel.temperature');
   if(state['oh.crew_oxygen.pressure']?.status==='physical_value_known'&&window.B737UnifiedOxygenPressureGauge)
     call(()=>window.B737UnifiedOxygenPressureGauge.setPressurePsi(state['oh.crew_oxygen.pressure'].value),
       'oh.crew_oxygen.pressure');
   if(state['fo.flap_position']?.status==='physical_value_known'&&window.B737FlapNeedles)
     call(()=>window.B737FlapNeedles.setCommon(state['fo.flap_position'].value),
       'fo.flap_position');
   // Gen drive oil / AC/DC / press/alt / APU EGT:
   // no falsely calibrated zero angle. They remain visually provisional.
   lastApplied=Object.freeze({attempted:Object.keys(state).length,applied,skipped,
     status:'PHYSICAL_BASELINE_NO_UNVERIFIED_ANGLE_WRITES'});
   show();
   return lastApplied;
 }
 function show(){
   const elt=document.querySelector('#coldDarkGaugeQA');
   if(!elt||!last)return;
   const unresolved=Object.values(last).filter(v=>v.status==='requires_system_state'
     ||v.status==='identity_unresolved'||v.status==='selector_unknown').length;
   const cabin=last['oh.cabin.diff_pressure_altitude']?.needles;
   const numericCabin=cabin?.cabAlt?.status==='physical_value_known'
    ?' · CAB ALT زمین: '+cabin.cabAlt.value.toFixed(0)+' ft (DIFF '+cabin.press?.value+' psi)'
    :' · CAB ALT: نیازمند ارتفاع فرودگاه/سنسور';
   elt.querySelector('output').textContent=
    'پوشش '+Object.keys(last).length+' گیج · صفرهای فیزیکی مستقل از برق · '+
    'نیازمند دادهٔ محیط/سیستم: '+unresolved+numericCabin+
    ' · نیدل‌های دارای کالیبراسیون تصویری تأییدشده: ۰'+
    ' · اعمال نمایش‌های امن: '+(lastApplied?.applied.join('، ')||'—');
 }
 function panel(){
   const inspector=document.querySelector('.inspector');if(!inspector||document.querySelector('#coldDarkGaugeQA'))return;
   const section=document.createElement('section');section.id='coldDarkGaugeQA';
   const head=document.createElement('h2');head.textContent='Cold & Dark · Instrument QA';
   const note=document.createElement('p');note.className='muted';
   note.textContent='هر گیج با منطق فیزیکی خودش بررسی می‌شود؛ فشار اکسیژن، دما، ارتفاع فرودگاه، فلپ و تریم به‌اجبار صفر نمی‌شوند. کالیبراسیون تصویریِ نامعتبر روی پنل اعمال نمی‌شود.';
   const out=document.createElement('output');out.style.display='block';out.style.direction='rtl';
   section.append(head,note,out);inspector.append(section);show();
 }
 function cleanColdDark(){
   const current=window.B737ISNCockpitV1?.getStartState?.();
   const sources=current?.sources;
   const running=sources&&(sources.engine1?.running||sources.engine2?.running||sources.apu?.running);
   return !running;
 }
 window.addEventListener('b737:isn-start-indications',e=>{
   const engines=e.detail?.engines;
   if(engines&&(Number(engines.engine1?.n2?.value)>0||Number(engines.engine2?.n2?.value)>0))
     simActive=true;
 });
 window.B737UnifiedColdDarkIndicators=Object.freeze({
   getStatus:()=>lastApplied, getSnapshot:()=>last,
   apply(context={}){
     if(simActive||!cleanColdDark())return Object.freeze({status:'skipped_active_system'});
     return safeApply(context);
   }});
 function load(){
   panel();
   fetch(policyUrl,{cache:'no-cache'})
    .then(response=>{if(!response.ok)throw Error('Policy status '+response.status);return response.json();})
    .then(policy=>{
      if(Object.keys(policy.entries||{}).length!==54)throw Error('Cold dark inventory completeness guard failed');
      window.B737ColdDarkIndicatorPolicyV1=Object.freeze(policy);
      ready=true;
      const ground=window.B737GroundAirfieldContext?.()||{};
      if(!simActive&&cleanColdDark())safeApply(ground);
      else{last=window.B737ColdDarkIndicatorV1.snapshot(ground);show();}
    }).catch(error=>{
      const out=document.querySelector('#coldDarkGaugeQA output');
      if(out)out.textContent='عدم دسترسی به رجیستری وضعیت خاموش: '+error.message;
      console.error('Cold dark gauge initial condition unavailable:',error);
    });
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',load,{once:true});else load();
 window.addEventListener('b737:cockpit-mounted',panel);
 window.addEventListener('b737:cold-dark-state',event=>{
   if(ready&&!simActive&&cleanColdDark()){
     try{safeApply(event.detail||{});}catch(error){console.error(error);}
   }
 });
})();