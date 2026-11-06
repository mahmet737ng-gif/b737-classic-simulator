/* Unified Conventional photo gauge runtime.
 * The simulator's technical-backend frame is the sole authority. Do not
 * bypass CB, electrical, sensor, or failure logic by reading raw ECU twice.
 */
(function(){
 'use strict';
 const model=window.B737ConventionalIndicationSyncV1;
 const photo=window.B737PhotoDetentCalibrationV1;
 if(!model||!photo)throw Error('Conventional sync and photo calibration must load first');
 const needles=()=>window.B737ConventionalNeedlesV1;
 const digits=()=>window.B737EISDotReadoutsV1;
 const pendingDigits=new Map();
 let flushQueued=false;
 function flushDigits(){
  flushQueued=false;
  const batch=[...pendingDigits.values()];
  pendingDigits.clear();
  if(!batch.length)return;
  const display=digits();
  if(!display?.setBatchReadings)throw Error('Shared numeric batch display is missing');
  display.setBatchReadings(batch,'ENGINE_INDICATION_SYNC_V1');
 }
 function enqueueDigits(engine,signal,value){
  pendingDigits.set(signal+'_'+engine.slice(-1),{engine,signal,value});
  if(!flushQueued){flushQueued=true;queueMicrotask(flushDigits);}
 }
 const angle=(signal,engine,value)=>photo.angle(signal,engine,value);
 angle.profile=(signal,engine)=>photo.getProfile(signal,engine);
 angle.inverse=(signal,engine,degrees)=>photo.valueAt(signal,engine,degrees);
 const instance=model.create({
  angleFor:angle,
  needle:{setReading:(engine,signal,value,source)=>{
   if(!needles()?.setReading)throw Error('Photographic needle layer not mounted');
   return needles().setReading(engine,signal,value,source);
  }},
  digits:{setReading:(engine,signal,value,source)=>{
   if(source!=='ENGINE_INDICATION_SYNC_V1')throw Error('One numeric authority required');
   enqueueDigits(engine,signal,value);
  }}
 });
 function liveMode(){return document.documentElement.dataset.engineIndication==='CONVENTIONAL';}
 instance.setActive(liveMode());
 if(liveMode()&&!Object.keys(instance.snapshot().channels).length){
  // Show BLANK rather than stale ECU data until the technical backend loads.
  instance.intake({engines:{engine1:{indications:{}},engine2:{indications:{}}}});
 }
 function state(){
  const snapshot=instance.snapshot();
  const a=needles()?.getReadings?.()||{};
  const d=digits()?.getReadings?.()||{};
  const shown=digits()?.getDisplayed?.('CONVENTIONAL')||{};
  const registration=needles()?.getPhotoRegistration?.()||{};
  const parity={};
  for(const [id,channel]of Object.entries(snapshot.channels)){
   const physical=a[id],digital=d[id],display=shown[id],scale=registration[id];
   const isFuelUsed=channel.signal==='fuelFlow'&&
    document.querySelector('[data-conventional-readout="'+id+'"]')?.dataset.fuelDisplayMode==='USED';
   const hasNumber=Number.isFinite(channel.value);
   // Backend keys and photographed face keys differ on three gauges.
   // oilTemperature -> oilTemp, oilQuantity -> oilQty, vibration -> vib.
   const faceSignal=model.SIGNALS[channel.signal]?.needle||channel.signal;
   const expectedAngle=hasNumber?photo.angle(faceSignal,channel.engine,channel.value):scale?.zeroAngle;
   const actualAngle=Number(document.querySelector('[data-needle-pivot="'+id+'"]')?.dataset.renderAngle);
   const rawDigit=digital?.value,rawNeedle=physical?.value;
   const comparable=hasNumber&&digital&&physical&&!isFuelUsed;
   const valueMatch=comparable?Math.abs(rawNeedle-rawDigit)<1e-6:
    channel.state==='BLANK'?rawNeedle===null&&rawDigit===null:
    physical?.value===channel.value;
   parity[id]={state:channel.state,status:channel.status,source:channel.source,
    rawNeedle,rawDigit:rawDigit??null,displayedText:display?.text||null,
    expectedAngle,actualAngle,scaleSource:scale?.source||null,
    ...(isFuelUsed?{note:'FUEL_USED_DIGITAL_IS_ACCUMULATED_NOT_INSTANTANEOUS'}:{}),
    valueMatch,angleMatch:Number.isFinite(actualAngle)&&Number.isFinite(expectedAngle)
      ?Math.abs(actualAngle-expectedAngle)<.002:null};
  }
  return {...snapshot,parity};
 }
 const api=Object.freeze({
  VERSION:model.VERSION,intake:instance.intake,
  getState:state,getRegistration:()=>needles()?.getPhotoRegistration?.()||null,
  audit:(count=256)=>instance.audit({angle,random:count}),
  advance:instance.advance,setActive:instance.setActive,
  reset:instance.reset
 });
 window.B737ConventionalIndicationSyncV1=api;
 window.addEventListener('b737:engine-indication-view',()=>{
  instance.setActive(liveMode());
  if(liveMode()&&!Object.keys(instance.snapshot().channels).length)
   instance.intake({engines:{engine1:{indications:{}},engine2:{indications:{}}}});
 });
 window.addEventListener('b737:cockpit-mounted',()=>{if(liveMode())instance.setActive(true);});
})();
