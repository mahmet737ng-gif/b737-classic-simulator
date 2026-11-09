/* Unified Speed Tape cockpit trainer source — evidence-labelled and non-authoritative.
 * Uses a known simulated IAS only when no ADC device is present; never writes
 * airdata.adc1/adc2 or aircraft control. Real/failed ADC takes precedence.
 * UI stays in Inspector; original EADI glass and owner photos are untouched.
 */
(function(root,factory){
 'use strict';
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root?.document){root.B737UnifiedSpeedTapeTrainerV1=api;api.bind(root);}
})(typeof window==='object'?window:null,function(){
 'use strict';
 const VERSION='SPEED-TAPE-TRAINING-0001';
 let win=null,ready=false,enabled=true,overrideKt=null;
 let flap30MaximumKt=180,lastVisualFlapDetent=null;
 const originalAdcSeen={CAPT:false,FO:false};
 const lastValue={CAPT:null,FO:null},lastTime={CAPT:0,FO:0};
 let panel=null;
 function finite(v){return typeof v==='number'&&Number.isFinite(v)&&v>=0&&v<=600;}
 function source(seat){
  const signal=win?.B737UnifiedAvionicsNetworkV1?.getSignal?.(
   seat==='CAPT'?'airdata.adc1':'airdata.adc2');
  // A valid, failed or expired real sensor must never be substituted by
  // the trainer. UNKNOWN means no sensor has ever been connected.
  if(signal?.quality&&signal.quality!=='UNKNOWN')
   originalAdcSeen[seat]=true;
  return signal;
 }
 function active(seat){
  if(!enabled||originalAdcSeen[seat])return false;
  const quality=win?.B737UnifiedSpeedTapeV1?.getState?.(seat)?.adc?.quality;
  return quality!=='VALID'&&quality!=='INVALID';
 }
 function getTrainingContext(){
  const s=win?.B737UnifiedAvionicsNetworkV1?.getSignal?.('flightcontext.state');
  return s?.quality==='VALID'&&s.origin==='TRAINING_SCENARIO'?s.value:null;
 }
 function sync(){
  const render=win?.B737UnifiedSpeedTapeV1;
  if(!ready||!render?.observe)return false;
  const ctx=getTrainingContext();
  const speed=overrideKt===null?ctx?.iasKt:overrideKt;
  const alt=ctx?.pressureAltitudeFt;
  for(const seat of ['CAPT','FO']){
   source(seat);
   if(!active(seat)){
    if(!enabled&&render.getState(seat)?.adc?.quality==='TRAINING')
     render.observe(seat,{type:'TRAINING_CLEAR'});
    lastValue[seat]=null;continue;
   }
   if(!finite(speed)){
    if(render.getState(seat)?.adc?.quality==='TRAINING')
     render.observe(seat,{type:'TRAINING_CLEAR'});
    lastValue[seat]=null;continue;
   }
   const safeAlt=typeof alt==='number'&&Number.isFinite(alt)&&alt>=-2000&&alt<=70000?alt:null;
   const fp=JSON.stringify([speed,safeAlt]);
   if(fp===lastValue[seat])continue;
   const timeMs=Math.max(Date.now(),lastTime[seat]+150);
   lastTime[seat]=timeMs;
   render.observe(seat,{type:'TRAINING_CAS',origin:'TRAINING_SCENARIO',
    casKt:speed,pressureAltitudeFt:safeAlt,timeMs});
   lastValue[seat]=fp;
  }
  updatePanel();return true;
 }
 function syncVisualFlap(detent){
  const renderer=win?.B737UnifiedSpeedTapeV1;
  const profile=win?.B737ClassicFlapSpeedProfileV1;
  if(!ready||!renderer?.observe||!profile?.get)return false;
  const d=detent??lastVisualFlapDetent??win?.B737FlapVisualTest?.position;
  if(!profile.DETENTS.includes(Number(d)))return false;
  lastVisualFlapDetent=Number(d);
  const value=profile.get(d,{flap30MaximumKt});
  for(const seat of ['CAPT','FO']){
   renderer.observe(seat,{type:'TRAINING_FLAP_PROFILE',source:'INSTRUCTOR_VISUAL_DETENT',
    detent:value.detent,maximumKt:value.maximumKt,bufferKt:value.bufferKt});
  }
  updatePanel();return true;
 }
 function setFlap30MaximumKt(value){
  if(![180,185].includes(Number(value)))throw Error('INVALID_FLAP30_VARIANT');
  flap30MaximumKt=Number(value);
  syncVisualFlap();updatePanel();
  return flap30MaximumKt;
 }
 function updatePanel(){
  if(!panel)return;
  const ctx=getTrainingContext(),live=ctx?.iasKt;
  panel.querySelector('[data-speed-status]').textContent=enabled?
   'TRAINING IAS '+(overrideKt===null?(finite(live)?live.toFixed(1)+' kt':'UNAVAILABLE'):
    overrideKt.toFixed(1)+' kt')+' · not an ADC':
   'ADC ONLY · no synthetic speed';
  panel.querySelector('[data-speed-slider]').disabled=!enabled;
  panel.querySelector('[data-speed-auto]').disabled=!enabled;
  panel.querySelector('[data-speed-toggle]').checked=enabled;
  if(overrideKt!==null)panel.querySelector('[data-speed-slider]').value=String(overrideKt);
  else if(finite(live))panel.querySelector('[data-speed-slider]').value=String(live);
  panel.querySelector('[data-speed-reading]').textContent=overrideKt===null?'SIM IAS':overrideKt.toFixed(1)+' kt';
  const flap=panel.querySelector('[data-flap-profile-status]');
  if(flap){
   const detent=lastVisualFlapDetent;
   const value=detent===null?null:
    win?.B737ClassicFlapSpeedProfileV1?.get?.(detent,{flap30MaximumKt});
   flap.textContent=value?.maximumKt!=null?
    'TRN FLAP '+detent+' / MAX '+value.maximumKt+
    ' kt / BUFFER '+(value.bufferKt===null?'UNSPECIFIED':value.bufferKt+' kt'):
    'TRN FLAP LIMIT: '+(detent===0?'UP / NONE':'not connected');
  }
  const option=panel.querySelector('[data-flap30-variant]');
  if(option)option.value=String(flap30MaximumKt);
 }
 function setEnabled(value){
  enabled=value===true;
  if(!enabled){
   const render=win?.B737UnifiedSpeedTapeV1;
   if(render)for(const seat of ['CAPT','FO']){
    if(render.getState(seat)?.adc?.quality==='TRAINING')render.observe(seat,{type:'TRAINING_CLEAR'});
    lastValue[seat]=null;
   }
  }
  sync();updatePanel();return enabled;
 }
 function setIAS(value){
  if(value!==null&&!finite(value))throw Error('INVALID_TRAINING_IAS');
  overrideKt=value;
  for(const seat of ['CAPT','FO'])lastValue[seat]=null;
  sync();return overrideKt;
 }
 function mount(){
  if(panel||!win?.document?.createElement)return false;
  const owner=win.document.querySelector('#unifiedControlCenter')||
   win.document.querySelector('#inspector');
  if(!owner)return false;
  panel=win.document.createElement('section');
  panel.className='unified-speed-tape-trainer';
  panel.setAttribute('aria-label','Speed tape instructor training mode');
  panel.style.cssText='border:1px solid #4b6077;border-radius:9px;padding:12px;margin:12px 0;color:inherit';
  panel.innerHTML='<strong>SPEED TAPE · INSTRUCTOR</strong>'+
   '<p style="font-size:12px;line-height:1.5;margin:5px 0" data-speed-status>TRAINING IAS</p>'+
   '<label style="display:flex;gap:8px;font-size:12px"><input type="checkbox" data-speed-toggle checked> Use labelled simulated IAS when ADC is not connected</label>'+
   '<label style="display:block;font-size:12px;margin-top:8px">IAS <output data-speed-reading>SIM IAS</output></label>'+
   '<input type="range" data-speed-slider min="0" max="420" step=".1" value="180" style="width:100%">'+
   '<button type="button" data-speed-auto style="margin:6px">Follow simulator IAS</button>'+
   '<p style="font-size:11px;opacity:.8">TRN on glass = training source. Verified ADC overrides this display. No changes to flight-control or ADC network.</p>'+
   '<p data-flap-profile-status style="font-size:12px;line-height:1.5">TRN FLAP LIMIT: not connected</p>'+
   '<label style="font-size:12px">Flap 30 training max (180 image / 185 list) '+
   '<select data-flap30-variant style="margin:5px;color:inherit;background:#213448">'+
   '<option value="180">180 kt — image</option><option value="185">185 kt — list</option>'+
   '</select></label>'+
   '<p style="font-size:11px;opacity:.8">Visual flap detents display TRN LIMIT only; this does not command the AFDS.</p>'+
   '<p><a href="./speed-limit-ch4-lab.html" target="_blank" rel="noopener" style="color:#9ad1ff">FCOM CH4 SPEED LIMITS · TEST LAB</a></p>';
  owner.appendChild(panel);
  panel.querySelector('[data-speed-toggle]').addEventListener('change',e=>setEnabled(e.target.checked));
  panel.querySelector('[data-speed-slider]').addEventListener('input',e=>setIAS(Number(e.target.value)));
  panel.querySelector('[data-speed-auto]').addEventListener('click',()=>setIAS(null));
  panel.querySelector('[data-flap30-variant]').addEventListener('change',
   e=>setFlap30MaximumKt(Number(e.target.value)));
  updatePanel();return true;
 }
 function bind(root){
  if(ready)return true;
  if(!root?.B737UnifiedSpeedTapeV1?.observe)return false;
  win=root;ready=true;
  root.addEventListener('b737:avionics-data',e=>{
   if(['airdata.adc1','airdata.adc2','flightcontext.state'].includes(e.detail?.topic))
    sync();
  });
  // The existing pedestal dispatches CustomEvent on DOCUMENT with
  // bubbles:false. A window listener never receives that event.
  const flapEventTarget=root.document?.addEventListener?root.document:root;
  flapEventTarget.addEventListener('b737:flap-detent-visual-test',event=>{
   if(event.detail?.visualOnly!==true)return;
   syncVisualFlap(event.detail.detent);
  });
  flapEventTarget.addEventListener('b737:flap-ready',event=>{
   syncVisualFlap(event.detail?.position);
  });
  root.addEventListener('b737:cockpit-mounted',()=>{mount();sync();syncVisualFlap()});
  if(root.document?.readyState==='loading')
   root.document.addEventListener('DOMContentLoaded',()=>{mount();sync();syncVisualFlap()},{once:true});
  else mount();
  sync();syncVisualFlap();return true;
 }
 function snapshot(){return {version:VERSION,enabled,overrideKt,
  flap30MaximumKt,lastVisualFlapDetent,
  realAdcSeen:{...originalAdcSeen},sourceLabel:'TRAINING_SCENARIO_NOT_ADC'};}
 return Object.freeze({VERSION,bind,sync,syncVisualFlap,setFlap30MaximumKt,setEnabled,setIAS,snapshot});
});
