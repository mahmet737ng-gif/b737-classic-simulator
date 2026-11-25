(async()=>{
;
/* ./cabin-rate-needle-unified.js?v=CRN-0001 */
try{
(function(){
 'use strict';
 const model=window.B737CabinRateNeedleModel,ns='http://www.w3.org/2000/svg';
 const sprite=new URL('./'+model.needle.asset+'?v=CRN-0001',document.baseURI).href;
 let frame=null,blade=null,input=null,output=null,currentOffset=model.needle.initialOffset;
 function svg(doc,parent,tag,attrs={}){const node=doc.createElementNS(ns,tag);for(const [key,value]of Object.entries(attrs))node.setAttribute(key,String(value));parent.append(node);return node;}
 function paint(){if(blade)blade.style.transform=`rotate(${model.bearing(currentOffset)}deg)`;if(input)input.value=String(currentOffset);if(output)output.textContent=currentOffset===0?'ZERO · 0°':`${currentOffset>0?'+':''}${currentOffset}° from zero`;}
 function setOffset(value){currentOffset=model.offset(value);paint();return currentOffset;}
 function mount(){
  const doc=frame?.contentDocument,host=doc?.getElementById('atlasAbsolute');if(!host)return false;
  const piece=host.querySelector(`.atlas-piece[data-key="${model.source.piece}"]`);if(!piece)return false;
  if(host.querySelector('[data-cabin-rate-needle]'))return true;
  const layer=svg(doc,host,'svg',{'data-cabin-rate-needle':'OH19',viewBox:`0 0 ${model.source.width} ${model.source.height}`,preserveAspectRatio:'none',role:'img','aria-label':'Cabin climb rate needle, zero by default'});
  Object.assign(layer.style,{position:'absolute',left:piece.style.left,top:piece.style.top,width:piece.style.width,height:piece.style.height,zIndex:'1003',pointerEvents:'none',overflow:'hidden'});
  const assembly=svg(doc,layer,'g',{transform:`translate(${model.pivot.x} ${model.pivot.y}) scale(${model.needle.tipRadius/220}) translate(-256 -256)`});
  blade=svg(doc,assembly,'g',{'data-cabin-rate-blade':''});Object.assign(blade.style,{transformOrigin:'256px 256px',transition:'transform 320ms ease-out'});
  svg(doc,blade,'image',{href:sprite,x:0,y:0,width:512,height:512});paint();return true;
 }
 function bind(){if(mount())return;const host=frame?.contentDocument?.getElementById('atlasAbsolute');if(!host)return;const observer=new MutationObserver(()=>{if(mount())observer.disconnect();});observer.observe(host,{childList:true});}
 function connect(){const next=document.getElementById('overheadFrame');if(!next||next===frame)return;frame=next;frame.addEventListener('load',()=>{blade=null;bind();});bind();}
 function controls(){
  const section=document.createElement('section');section.id='unifiedCabinRateNeedle';
  const title=document.createElement('h2');title.textContent='Cabin rate · CABIN CLIMB';section.append(title);
  const note=document.createElement('p');note.className='muted';note.textContent='Independent lower-gauge needle defaults precisely to zero. Movement is for visual testing only.';section.append(note);
  const label=document.createElement('label');label.textContent='Angle offset from ZERO';label.style.display='block';label.style.direction='ltr';
  input=document.createElement('input');Object.assign(input,{type:'range',min:'-145',max:'145',step:'1'});input.style.width='100%';input.style.accentColor='#edf0e8';input.addEventListener('input',()=>setOffset(Number(input.value)));
  output=document.createElement('output');output.style.display='block';output.style.textAlign='left';output.style.direction='ltr';label.append(input,output);section.append(label);
  const reset=document.createElement('button');reset.type='button';reset.textContent='Return to Zero';reset.addEventListener('click',()=>setOffset(0));section.append(reset);
  const previous=document.querySelector('#unifiedCabinDualNeedles');if(previous)previous.after(section);else document.querySelector('.overhead-tools').before(section);paint();
 }
 window.B737UnifiedCabinRateNeedle=Object.freeze({getOffset:()=>currentOffset,setOffset});
 window.addEventListener('b737:cabin-rate-needle-offset',event=>{if(window.B737UnifiedInstructorNonNormalV1?.pressureState?.()?.rapid)return;try{setOffset(event.detail);}catch(error){console.error(error);}});
 window.addEventListener('b737:cockpit-mounted',connect);connect();if(document.querySelector('.inspector'))controls();
})();

}catch(error){queueMicrotask(()=>{throw error});}
;await 0;
;
/* ./cabin-temperature-needle-model.js?v=CTN-0001 */
try{
(function(root,factory){
 'use strict';
 const model=factory();
 if(typeof module==='object'&&module.exports)module.exports=model;
 if(root)root.B737CabinTemperatureNeedleModel=model;
})(typeof globalThis==='object'?globalThis:this,function(){
 'use strict';
 // Source pixels of the immutable OH20 panel. Reuse the CABIN CLIMB sprite unchanged.
 const source=Object.freeze({piece:'OH20',width:1254,height:1254});
 const pivot=Object.freeze({x:618,y:681});
 const needle=Object.freeze({asset:'cabin-rate-needle.svg',tipRadius:158,initialTemperature:20});
 // Approximate visual angles measured from the six printed temperature labels.
 // This is display calibration only, not a cabin temperature system input.
 const ticks=Object.freeze([
  Object.freeze({celsius:0,bearing:-136}),
  Object.freeze({celsius:20,bearing:-90}),
  Object.freeze({celsius:40,bearing:-48}),
  Object.freeze({celsius:60,bearing:11}),
  Object.freeze({celsius:80,bearing:67}),
  Object.freeze({celsius:100,bearing:107})
 ]);
 function temperature(value){
  const n=Number(value);if(!Number.isFinite(n))throw Error('Cabin temperature must be finite');
  return Math.max(0,Math.min(100,n));
 }
 function bearing(value){
  const n=temperature(value);
  for(let i=1;i<ticks.length;i++)if(n<=ticks[i].celsius){
   const a=ticks[i-1],b=ticks[i];return a.bearing+(n-a.celsius)*(b.bearing-a.bearing)/(b.celsius-a.celsius);
  }
  return ticks.at(-1).bearing;
 }
 function placement(piece){
  if(!piece||![piece.x,piece.y,piece.w,piece.h].every(Number.isFinite)||piece.w<=0||piece.h<=0)throw Error('Invalid OH20 atlas placement');
  const inset=piece.artInset||{};
  const x=piece.x+(inset.left||0),y=piece.y+(inset.top||0);
  const w=piece.w-(inset.left||0)-(inset.right||0),h=piece.h-(inset.top||0)-(inset.bottom||0);
  if(w<=0||h<=0)throw Error('Invalid OH20 image bounds');
  return {x:x+pivot.x*w/source.width,y:y+pivot.y*h/source.height};
 }
 return Object.freeze({source,pivot,needle,ticks,temperature,bearing,placement});
});

}catch(error){queueMicrotask(()=>{throw error});}
;await 0;
;
/* ./cabin-temperature-needle-unified.js?v=CTN-0002-AIRCON400 */
try{
(function(){
 'use strict';
 const model=window.B737CabinTemperatureNeedleModel,ns='http://www.w3.org/2000/svg';
 const sprite=new URL('./'+model.needle.asset+'?v=CRN-0001',document.baseURI).href;
 let frame=null,blade=null,layer=null,assembly=null,input=null,output=null,currentTemperature=model.needle.initialTemperature;
// Owner-uploaded 737-400 source geometry (1122 × 1402); the 300/500 legacy
// OH20 strip remains calibrated to the original 1254 × 1254 artwork.
const aircon400=Object.freeze({width:1122,height:1402,pivotX:284,pivotY:268,tipRadius:158});
function syncFamily(){
  const plate=frame?.contentDocument?.querySelector('.atlas-piece[data-key="OH20"]');
  const strip=plate?.querySelector('.atlas-source-strip');
  if(!plate||!strip||!layer||!assembly)return;
  const fourHundred=window.B737AircraftProfileStore?.get()?.aircraftFamily==='B737-400';
  const source=fourHundred?aircon400:model.source;
  const pivot=fourHundred?{x:aircon400.pivotX,y:aircon400.pivotY}:model.pivot;
  layer.setAttribute('viewBox','0 0 '+source.width+' '+source.height);
  Object.assign(layer.style,fourHundred?{
    left:plate.style.left,top:plate.style.top,width:plate.style.width,height:plate.style.height
  }:{
    left:(parseFloat(plate.style.left)+parseFloat(strip.style.left))+'px',
    top:(parseFloat(plate.style.top)+parseFloat(strip.style.top))+'px',
    width:strip.style.width,height:strip.style.height
  });
  assembly.setAttribute('transform',`translate(${pivot.x} ${pivot.y}) scale(${(fourHundred?aircon400.tipRadius:model.needle.tipRadius)/220}) translate(-256 -256)`);
}
 function svg(doc,parent,tag,attrs={}){const node=doc.createElementNS(ns,tag);for(const [key,value]of Object.entries(attrs))node.setAttribute(key,String(value));parent.append(node);return node;}
 function paint(){if(blade)blade.style.transform=`rotate(${model.bearing(currentTemperature)}deg)`;if(input)input.value=String(currentTemperature);if(output)output.textContent=`${currentTemperature} °C`;
 }
 function setTemperature(value){currentTemperature=model.temperature(value);paint();return currentTemperature;}
 function mount(){
  const doc=frame?.contentDocument,host=doc?.getElementById('atlasAbsolute');if(!host)return false;
  const piece=host.querySelector(`.atlas-piece[data-key="${model.source.piece}"]`);if(!piece)return false;
  if(host.querySelector('[data-cabin-temperature-needle]'))return true;
  // OH20 artwork starts below an atlas artInset; use the actual image strip bounds.
  const strip=piece.querySelector('.atlas-source-strip');if(!strip)return false;
  layer=svg(doc,host,'svg',{'data-cabin-temperature-needle':'OH20',viewBox:`0 0 ${model.source.width} ${model.source.height}`,preserveAspectRatio:'none',role:'img','aria-label':'Cabin temperature indicator needle'});
  Object.assign(layer.style,{position:'absolute',left:`${parseFloat(piece.style.left)+parseFloat(strip.style.left)}px`,top:`${parseFloat(piece.style.top)+parseFloat(strip.style.top)}px`,width:strip.style.width,height:strip.style.height,zIndex:'1004',pointerEvents:'none',overflow:'hidden'});
  assembly=svg(doc,layer,'g',{transform:`translate(${model.pivot.x} ${model.pivot.y}) scale(${model.needle.tipRadius/220}) translate(-256 -256)`});
  blade=svg(doc,assembly,'g',{'data-cabin-temperature-blade':''});Object.assign(blade.style,{transformOrigin:'256px 256px',transition:'transform 320ms ease-out'});
  svg(doc,blade,'image',{href:sprite,x:0,y:0,width:512,height:512});syncFamily();paint();return true;
 }
 function bind(){if(mount())return;const host=frame?.contentDocument?.getElementById('atlasAbsolute');if(!host)return;const observer=new MutationObserver(()=>{if(mount())observer.disconnect();});observer.observe(host,{childList:true,subtree:true});}
 function connect(){const next=document.getElementById('overheadFrame');if(!next||next===frame)return;frame=next;frame.addEventListener('load',()=>{blade=null;layer=null;assembly=null;bind();});bind();}
 function controls(){
  const section=document.createElement('section');section.id='unifiedCabinTemperatureNeedle';
  const title=document.createElement('h2');title.textContent='Cabin temperature · TEMP';section.append(title);
  const note=document.createElement('p');note.className='muted';note.textContent='The same Cabin Rate needle artwork is used unchanged on the OH20 temperature gauge; this value is for visual testing only.';section.append(note);
  const label=document.createElement('label');label.textContent='Cabin temperature (°C)';label.style.display='block';label.style.direction='ltr';
  input=document.createElement('input');Object.assign(input,{type:'range',min:'0',max:'100',step:'1'});input.style.width='100%';input.style.accentColor='#edf0e8';input.addEventListener('input',()=>setTemperature(Number(input.value)));
  output=document.createElement('output');output.style.display='block';output.style.textAlign='left';output.style.direction='ltr';label.append(input,output);section.append(label);
  const reset=document.createElement('button');reset.type='button';reset.textContent='Restore 20°C';reset.addEventListener('click',()=>setTemperature(model.needle.initialTemperature));section.append(reset);
  const previous=document.querySelector('#unifiedCabinRateNeedle');if(previous)previous.after(section);else document.querySelector('.overhead-tools').before(section);paint();
 }
 window.B737UnifiedCabinTemperatureNeedle=Object.freeze({getTemperature:()=>currentTemperature,setTemperature});
 window.addEventListener('b737:cabin-temperature-needle-value',event=>{try{setTemperature(event.detail?.celsius);}catch(error){console.error(error);}});
 window.addEventListener('b737:cockpit-mounted',connect);window.addEventListener('b737:aircraft-profile-change',syncFamily);connect();if(document.querySelector('.inspector'))controls();
})();

}catch(error){queueMicrotask(()=>{throw error});}
;await 0;
;
/* ../../engine/systems/duct-pressure-live-v1.js?v=DPN-LIVE-0003-APU */
try{
/* B737 Classic OH21 two-duct functional TRAINER only.
 * One existing ECU/FCOM discrete Pneumatics V6 owns engine, bleed and pack
 * states. This module estimates indicated pressure under air consumers;
 * it does not invent a certified bleed mass-flow / engine performance model.
 * A valid explicit PSI sensor always overrides the estimate.
 */
(function(root,factory){
 'use strict';const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.B737DuctPressureLiveV1=api;
})(typeof globalThis==='object'?globalThis:null,function(){
 'use strict';
 const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
 const finite=v=>typeof v==='number'&&Number.isFinite(v);
 const SETTINGS=Object.freeze({
  packAutoEquivalentPsi:2.2,packHighEquivalentPsi:4.0,
  engineTaiEquivalentPsi:1.8,wingTaiEquivalentPsi:4.0,
  starterEquivalentPsi:12.0,sharedManifoldLossPsi:0.8,
  groundAirNominalPsi:30,oneSourceMaxSagPsi:25,
  maxRisePsiPerSec:13,maxFallPsiPerSec:17,
  maxNeedleAccelerationPsiPerSec2:70,
  needleNaturalFrequencyRadPerSec:3.5
 });
 const switchOn=value=>value===true||String(value||'').trim().toUpperCase()==='ON';
 function enginePressure(engine,open){
  if(open!==true||!engine||engine.phase!=='RUNNING'||!finite(engine.n1Percent))return 0;
  const n=clamp(engine.n1Percent,0,105);
  if(n<18)return 0;
  // Simplified 9th-stage idle support and regulated 5th-stage higher N1.
  if(n<28)return 24+(n-18)*0.8;
  if(n<55)return 32+(n-28)*(10/27);
  return 42;
 }
 function determinePack(side,controls,pack){
  const key=side==='L'?'pack-l':'pack-r';
  const selected=controls?.[key]||controls?.['pack'+side]||pack?.[side]?.selectedMode||'OFF';
  const trip=pack?.[side]?.tripOff===true||pack?.[side]?.operational===false;
  const flow=pack?.[side]?.flow;
  const effective=selected==='OFF'||trip?'OFF':selected==='HIGH'||flow==='HIGH'||flow==='APU_HIGH'?'HIGH':'AUTO';
  return {selected,effective,equivalentPsi:effective==='HIGH'?SETTINGS.packHighEquivalentPsi:
   effective==='AUTO'?SETTINGS.packAutoEquivalentPsi:0};
 }
 function project({ecu,bleed,controls={},pack=null,antiIce=null,starterValves=null,
  sensors=null,gaugePowered=true}={}){
  if(!ecu?.engines||!bleed)throw Error('ECU engines and actual pneumatic valve state required');
  const e1=enginePressure(ecu.engines.engine1,bleed.engine1ValveOpen);
  const e2=enginePressure(ecu.engines.engine2,bleed.engine2ValveOpen);
  // Pneumatics V6 reports an OPEN APU BLEED valve only when its observed
  // running source and control power are present. Do not additionally gate
  // that confirmed source on one particular ECU phase spelling. In some
  // restored/synchronized Unified sessions the pneumatic state can already
  // be READY while display phase is briefly stale.
  const apuValveOpen=bleed.apuBleedValveOpen===true;
  const apu=apuValveOpen?35:0;
  // External cart input is an existing discrete; 30 PSI is training-only.
  const ground=bleed.externalAirAttached===true?SETTINGS.groundAirNominalPsi:0;
  const packs={L:determinePack('L',controls,pack),R:determinePack('R',controls,pack)};
  const engineTai={
   L:switchOn(antiIce?.engine1??controls['engine-anti-ice-1']),
   R:switchOn(antiIce?.engine2??controls['engine-anti-ice-2'])
  };
  const wingTai=switchOn(antiIce?.wing??controls['wing-anti-ice']);
  const starts={
   L:starterValves?.L===true||starterValves?.engine1===true,
   R:starterValves?.R===true||starterValves?.engine2===true
  };
  // Cowl TAI is engine-compressor-sourced; with bleed OFF it must not
  // conjure duct pressure. Wing TAI and starters require duct air.
  const loads={};
  for(const side of ['L','R']){
   const engine=side==='L'?e1:e2;
   const localSource=side==='L'?Math.max(e1,apu):Math.max(e2,ground);
   loads[side]={
    pack:packs[side].equivalentPsi,
    starter:starts[side]?SETTINGS.starterEquivalentPsi:0,
    wingTAI:wingTai?SETTINGS.wingTaiEquivalentPsi:0,
    engineTAI:engine>0&&engineTai[side]?SETTINGS.engineTaiEquivalentPsi:0,
    sourcePsi:localSource
   };
   loads[side].total=loads[side].pack+loads[side].starter+
    loads[side].wingTAI+loads[side].engineTAI;
  }
  let L=loads.L.sourcePsi,R=loads.R.sourcePsi;
  if(bleed.isolationOpen===true){
   const sharedSource=Math.max(L,R);
   if(sharedSource>0){
    // Dual engines share demand with greater flow capacity than one source.
    // This is a static analogue, not a pressure-vs-mass-flow curve.
    const sourceCount=Number(L>0)+Number(R>0);
    const sharingFactor=sourceCount===2?1.7:1;
    const base=sharedSource-SETTINGS.sharedManifoldLossPsi;
    const sag=Math.min(SETTINGS.oneSourceMaxSagPsi,
     (loads.L.total+loads.R.total)/sharingFactor);
    L=Math.max(0,base-sag);R=L;
   }else{L=0;R=0;}
  }else{
   L=L>0?Math.max(0,L-Math.min(SETTINGS.oneSourceMaxSagPsi,loads.L.total)):0;
   R=R>0?Math.max(0,R-Math.min(SETTINGS.oneSourceMaxSagPsi,loads.R.total)):0;
  }
  const out={L:Math.round(clamp(L,0,100)*10)/10,
   R:Math.round(clamp(R,0,100)*10)/10,
   source:'TRAINING_ESTIMATE',quality:'NOT_MEASURED',
   isolationOpen:bleed.isolationOpen,
   engineSources:{L:e1,R:e2},apuSource:apu,apuValveOpen,groundSource:ground,
   packModes:{L:packs.L.effective,R:packs.R.effective},
   loads,consumers:{starter:{...starts},engineTAI:{...engineTai},wingTAI:wingTai},
   assumptions:'EQUIVALENT_PSI_LOAD_PROXY_NOT_ACTUAL_BLEED_PRESSURE_DROP'
  };
  for(const side of ['L','R']){
   if(finite(sensors?.[side])&&sensors[side]>=0){
    out[side]=clamp(sensors[side],0,100);
    out.source='MIXED_OR_MEASURED';
    out.quality='EXPLICIT_SENSOR_HAS_PRIORITY';
   }
  }
  // No claim that the electrical bus circuit is verified. Use explicit
  // existing Pneumatics V6 availability input only.
  if(gaugePowered===false){out.L=null;out.R=null;out.source='UNPOWERED_INDICATOR';}
  return out;
 }
 function initialDynamics(pressure={L:0,R:0}){
  const norm=side=>clamp(finite(pressure[side])?pressure[side]:0,0,100);
  return {L:{value:norm('L'),velocity:0},R:{value:norm('R'),velocity:0}};
 }
 // Critically damped, rate- and acceleration-limited inertial needle.
 // Per-frame integration runs at <= 20ms substeps to avoid jumps or
 // unpredictable changes from a 100ms ECU update cadence.
 function advanceDynamics(previous,target,dtMs){
  if(!previous?.L||!previous?.R)throw Error('Needle dynamics state missing');
  if(!finite(dtMs)||dtMs<0)throw Error('Invalid pressure dynamics elapsed time');
  const dt=clamp(dtMs,0,1000);
  const next={};
  for(const side of ['L','R']){
   let value=clamp(previous[side].value,0,100);
   let velocity=finite(previous[side].velocity)?previous[side].velocity:0;
   const goal=finite(target?.[side])?clamp(target[side],0,100):value;
   let remaining=dt/1000;
   while(remaining>1e-8){
    const step=Math.min(0.02,remaining);remaining-=step;
    const delta=goal-value;
    const omega=SETTINGS.needleNaturalFrequencyRadPerSec;
    const accel=clamp(omega*omega*delta-2*omega*velocity,
     -SETTINGS.maxNeedleAccelerationPsiPerSec2,SETTINGS.maxNeedleAccelerationPsiPerSec2);
    velocity+=accel*step;
    velocity=clamp(velocity,-SETTINGS.maxFallPsiPerSec,SETTINGS.maxRisePsiPerSec);
    const moved=value+velocity*step;
    // Never oscillate past target — a real indicator settles without a bounce.
    if((goal-value)*(goal-moved)<0){value=goal;velocity=0;}
    else value=clamp(moved,0,100);
    if(Math.abs(goal-value)<0.025&&Math.abs(velocity)<0.18){
     value=goal;velocity=0;
    }
   }
   next[side]={value,velocity};
  }
  return next;
 }
 function settled(state,target){
  return ['L','R'].every(side=>!finite(target?.[side])||
   (Math.abs(state[side].value-target[side])<0.035&&Math.abs(state[side].velocity)<0.19));
 }
 return Object.freeze({SETTINGS,enginePressure,determinePack,project,
  initialDynamics,advanceDynamics,settled});
});

}catch(error){queueMicrotask(()=>{throw error});}
;await 0;
;
/* ./duct-pressure-needles-model.js?v=DPN-0005-LR */
try{
(function(root,factory){
 'use strict';
 const model=factory();
 if(typeof module==='object'&&module.exports)module.exports=model;
 if(root)root.B737DuctPressureNeedlesModel=model;
})(typeof globalThis==='object'?globalThis:this,function(){
 'use strict';
 // OH21 owner artwork is immutable: all geometry uses its 1122 x 1402 source coordinates.
 const source=Object.freeze({piece:'OH21',width:1122,height:1402});
 const pivot=Object.freeze({x:544,y:439});
 // Owner's blue circle is the 0-PSI position (lower-right). The red ring
 // traces clockwise around the bottom, left and top, reaching 100 at right.
 // The previous -150 + 3*PSI mapping put 0 at the printed 20 mark.
 const scale=Object.freeze({minPsi:0,maxPsi:100,zeroBearingDeg:144,spanDeg:300,
  tickStepPsi:5,majorStepPsi:20,source:'2026-11-03 owner red sweep / blue zero'});
 const ticks=Object.freeze(Array.from({length:21},(_,i)=>{
  const psi=i*scale.tickStepPsi;
  return Object.freeze({psi,bearingDeg:scale.zeroBearingDeg+scale.spanDeg*psi/scale.maxPsi,
   major:psi%scale.majorStepPsi===0});
 }));
 const needles=Object.freeze([
  Object.freeze({id:'R',asset:'duct-pressure-needle-r.svg',label:'R DUCT PRESSURE · lower',tipRadius:148,initialPsi:0,layer:0}),
  Object.freeze({id:'L',asset:'duct-pressure-needle-l.svg',label:'L DUCT PRESSURE · upper',tipRadius:148,initialPsi:0,layer:1})
 ]);
 function psi(id,value){
  if(!needles.some(needle=>needle.id===id))throw Error('Unknown duct pressure needle '+id);
  const n=Number(value);if(!Number.isFinite(n))throw Error('Duct pressure must be finite');
  return Math.max(scale.minPsi,Math.min(scale.maxPsi,n));
 }
 function bearing(id,value){return scale.zeroBearingDeg+scale.spanDeg*psi(id,value)/scale.maxPsi;}
 function placement(piece){
  if(!piece||![piece.x,piece.y,piece.w,piece.h].every(Number.isFinite)||piece.w<=0||piece.h<=0)throw Error('Invalid OH21 atlas placement');
  return {x:piece.x+pivot.x*piece.w/source.width,y:piece.y+pivot.y*piece.h/source.height};
 }
 return Object.freeze({source,pivot,scale,ticks,needles,psi,bearing,placement});
});

}catch(error){queueMicrotask(()=>{throw error});}
;await 0;
;
/* ./duct-pressure-needles-unified.js?v=DPN-0007-APU-MOUNT */
try{
/* OH21 dual duct pressure: one needle per pneumatic side on a shared pivot.
 * Source artwork and protected hardware are unchanged.
 */
(function(){
 'use strict';
 const model=window.B737DuctPressureNeedlesModel,live=window.B737DuctPressureLiveV1;
 const ns='http://www.w3.org/2000/svg';
 const sprites=Object.fromEntries(model.needles.map(needle=>[needle.id,new URL('./'+needle.asset+'?v=DPN-0005-LR',document.baseURI).href]));
 const state=Object.fromEntries(model.needles.map(needle=>[needle.id,needle.initialPsi]));
 const blades=new Map(),inputs=new Map(),outputs=new Map();
 const target=Object.fromEntries(model.needles.map(needle=>[needle.id,needle.initialPsi]));
 let motion=live.initialDynamics(state);
 let animationFrame=0,lastFrameAt=null;
 let frame=null,layer=null,manualOverride=false,source='INITIAL_ZERO',lastLive=null,powered=true,status=null;
 let mountingObserver=null,mountingHost=null;
 let lastInputs=null;
 function animate(time){
  animationFrame=0;
  const dt=lastFrameAt===null?16:Math.min(80,Math.max(0,time-lastFrameAt));
  lastFrameAt=time;
  motion=live.advanceDynamics(motion,target,dt);
  for(const id of ['L','R']){
   state[id]=motion[id].value;
   paint(id);
  }
  if(!live.settled(motion,target))animationFrame=requestAnimationFrame(animate);
  else lastFrameAt=null;
 }
 function scheduleMotion(){
  if(!animationFrame)animationFrame=requestAnimationFrame(animate);
 }
 function svg(doc,parent,tag,attrs={}){
  const node=doc.createElementNS(ns,tag);
  for(const [key,value]of Object.entries(attrs))node.setAttribute(key,String(value));
  parent.append(node);return node;
 }
 function paint(id){
  const blade=blades.get(id);
  if(blade)blade.style.transform='rotate('+model.bearing(id,state[id])+'deg)';
  const input=inputs.get(id),output=outputs.get(id);
  if(input)input.value=String(manualOverride?target[id]:state[id]);
  if(output)output.textContent=state[id].toFixed(1)+' PSI';
 }
 function paintStatus(){
  if(layer){
   layer.dataset.source=source;layer.dataset.powered=String(powered);
   for(const blade of blades.values())blade.style.opacity=powered?'1':'.25';
  }
  if(status)status.textContent=(manualOverride?'INSTRUCTOR OVERRIDE':source)+
   (powered?'':' · AC INDICATION UNAVAILABLE');
 }
 function updateValues(values,origin){
  let changed=false;
  for(const id of ['L','R']){
   if(!Object.prototype.hasOwnProperty.call(values||{},id)||values[id]===null)continue;
   const next=model.psi(id,values[id]);
   if(Math.abs(target[id]-next)>0.005){target[id]=next;changed=true;}
  }
  if(changed)scheduleMotion();
  source=origin;paintStatus();
  return changed;
 }
 function setPsi(id,value){
  const next=model.psi(id,value);manualOverride=true;
  updateValues({[id]:next},'INSTRUCTOR_OVERRIDE');
  return next;
 }
 function setValues(values){
  manualOverride=true;updateValues(values,'INSTRUCTOR_OVERRIDE');
  return {...state};
 }
 function auto(){
  manualOverride=false;
  if(lastLive){
   powered=lastLive.L!==null&&lastLive.R!==null;
   updateValues(lastLive,'LIVE_'+lastLive.source);
  }else{source='AWAITING_ECU';paintStatus();}
  return {...state};
 }
 function mount(){
  const doc=frame?.contentDocument,host=doc?.getElementById('atlasAbsolute');
  if(!host)return false;
  const piece=host.querySelector('.atlas-piece[data-key="'+model.source.piece+'"]');
  if(!piece)return false;
  const old=host.querySelector('[data-duct-pressure-needles]');
  if(old&&old===layer&&blades.size===model.needles.length&&
   [...blades.values()].every(blade=>blade.isConnected))return true;
  // Recover from a replaced inner atlas or an interrupted iframe mount.
  // Never leave a stale, inert overlaid needle group behind.
  if(old)old.remove();
  blades.clear();
  layer=svg(doc,host,'svg',{'data-duct-pressure-needles':'OH21',
   viewBox:'0 0 '+model.source.width+' '+model.source.height,preserveAspectRatio:'none',
   role:'img','aria-label':'Dual duct pressure indicator L and R, 0 to 100 PSI'});
  Object.assign(layer.style,{position:'absolute',left:piece.style.left,top:piece.style.top,
   width:piece.style.width,height:piece.style.height,zIndex:'1005',
   pointerEvents:'none',overflow:'hidden'});
  for(const needle of model.needles){
   const assembly=svg(doc,layer,'g',{
    transform:'translate('+model.pivot.x+' '+model.pivot.y+') scale('+
     needle.tipRadius/220+') translate(-256 -256)'
   });
   const blade=svg(doc,assembly,'g',{'data-duct-pressure-blade':needle.id});
   Object.assign(blade.style,{transformOrigin:'256px 256px',transition:'none',
    willChange:'transform'});
   svg(doc,blade,'image',{href:sprites[needle.id],x:0,y:0,width:512,height:512});
   blades.set(needle.id,blade);paint(needle.id);
  }
  paintStatus();return true;
 }
 function bind(){
  if(mount()){
   mountingObserver?.disconnect();mountingObserver=null;mountingHost=null;
   return true;
  }
  const host=frame?.contentDocument?.getElementById('atlasAbsolute');
  if(!host)return false;
  if(mountingObserver&&mountingHost===host)return false;
  mountingObserver?.disconnect();
  mountingHost=host;
  mountingObserver=new MutationObserver(()=>bind());
  mountingObserver.observe(host,{childList:true});
  return false;
 }
 function connect(){
  const next=document.getElementById('overheadFrame');
  if(!next)return false;
  if(next!==frame){
   mountingObserver?.disconnect();mountingObserver=null;mountingHost=null;
   frame=next;
   frame.addEventListener('load',()=>{
    mountingObserver?.disconnect();mountingObserver=null;mountingHost=null;
    blades.clear();layer=null;bind();
   });
  }
  return bind();
 }
 function controls(){
  const section=document.createElement('section');section.id='unifiedDuctPressureNeedles';
  const title=document.createElement('h2');title.textContent='DUCT PRESSURE · L / R';section.append(title);
  const note=document.createElement('p');note.className='muted';
  note.textContent='OH21 · 0–100 PSI · Smooth, constrained needle response. PACK / STARTER / TAI loads affect estimated pressure; valid sensor data takes precedence.';
  section.append(note);
  status=document.createElement('p');status.className='muted';status.setAttribute('role','status');section.append(status);
  for(const needle of model.needles){
   const label=document.createElement('label');label.textContent=needle.label;
   label.style.display='block';label.style.direction='ltr';
   const input=document.createElement('input');
   Object.assign(input,{type:'range',min:'0',max:'100',step:'0.5'});
   input.style.width='100%';input.style.accentColor='#edf0e8';
   input.addEventListener('input',()=>setPsi(needle.id,Number(input.value)));
   const output=document.createElement('output');output.style.display='block';
   output.style.direction='ltr';output.style.textAlign='left';
   label.append(input,output);section.append(label);
   inputs.set(needle.id,input);outputs.set(needle.id,output);paint(needle.id);
  }
  const resume=document.createElement('button');resume.type='button';
  resume.textContent='AUTO · Reconnect to ECU';resume.addEventListener('click',auto);section.append(resume);
  const previous=document.querySelector('#unifiedCabinTemperatureNeedle');
  if(previous)previous.after(section);else document.querySelector('.overhead-tools')?.before(section);
  paintStatus();
 }
 function receiveLive(data){
  if(!live?.project||!data?.ecu||!data?.bleed)return;
  // ECU can become ready before or after the deferred Overhead iframe.
  // Each real snapshot retries the same idempotent mount, without spawning
  // a second gauge or a per-frame observer.
  if(!layer?.isConnected||blades.size!==model.needles.length)connect();
  lastInputs=data;
  try{
   const next=live.project(data);lastLive=next;
   if(manualOverride)return;
   powered=next.L!==null&&next.R!==null;
   updateValues(next,'LIVE_'+next.source);
  }catch(error){console.error('DUCT PRESSURE estimate unavailable',error);}
 }
 window.B737UnifiedDuctPressureNeedles=Object.freeze({
  getValues:()=>({...state}),getState:()=>({values:{...state},target:{...target},
   velocities:{L:motion.L.velocity,R:motion.R.velocity},source,powered,manualOverride,
   scale:model.scale,lastLive,mounted:!!layer?.isConnected&&blades.size===2,
   liveInputSummary:lastInputs?{
    apuPhase:lastInputs.ecu?.apu?.phase,
    apuRunning:lastInputs.apuRunning,
    apuValveOpen:lastInputs.bleed?.apuBleedValveOpen,
    isolationOpen:lastInputs.bleed?.isolationOpen,
    apuPressureEstimate:lastLive?.apuSource,
    indicatorPowered:lastInputs.gaugePowered
   }:null}),
  setPsi,setValues,resumeLive:auto
 });
 window.addEventListener('b737:duct-pressure-live-inputs',event=>receiveLive(event.detail));
 window.addEventListener('b737:duct-pressure-values',event=>{
  if(event.detail&&typeof event.detail==='object'&&
   (Number.isFinite(event.detail.L)||Number.isFinite(event.detail.R))){
   manualOverride=false;powered=true;
   updateValues(event.detail,'EXPLICIT_DUCT_SENSOR');
  }
 });
 window.addEventListener('b737:cockpit-mounted',connect);
 connect();if(document.querySelector('.inspector'))controls();
})();

}catch(error){queueMicrotask(()=>{throw error});}
;await 0;
;
/* ./oxygen-pressure-gauge-model.js?v=OXG-0001 */
try{
(function(root,factory){
 'use strict';
 const model=factory();
 if(typeof module==='object'&&module.exports)module.exports=model;
 if(root)root.B737OxygenPressureGaugeModel=model;
})(typeof globalThis==='object'?globalThis:this,function(){
 'use strict';
 // The OH01–OH06 artwork is frozen. Coordinates are native UPPER source pixels.
 const source=Object.freeze({piece:'UPPER',width:1731,height:909});
 const dial=Object.freeze({cx:1078,cy:636,radius:62,faceAsset:'oxygen-pressure-face.svg',needleAsset:'oxygen-pressure-needle.svg'});
 const ticks=Object.freeze([0,5,10,15,20].map(hundredsPsi=>Object.freeze({hundredsPsi,bearing:-124+hundredsPsi*12.4})));
 const initialPsi=1200; // Visual reference shows approximately 12 × 100 PSI; not a live system reading.
 function pressurePsi(value){
  const n=Number(value);if(!Number.isFinite(n))throw Error('Oxygen pressure must be finite');
  return Math.max(0,Math.min(2000,n));
 }
 function bearing(value){return -124+pressurePsi(value)*.124;}
 function placement(piece){
  if(!piece||![piece.x,piece.y,piece.w,piece.h].every(Number.isFinite)||piece.w<=0||piece.h<=0)throw Error('Invalid UPPER atlas placement');
  return {x:piece.x+dial.cx*piece.w/source.width,y:piece.y+dial.cy*piece.h/source.height,rx:dial.radius*piece.w/source.width,ry:dial.radius*piece.h/source.height};
 }
 return Object.freeze({source,dial,ticks,initialPsi,pressurePsi,bearing,placement});
});

}catch(error){queueMicrotask(()=>{throw error});}
;await 0;
;
/* ./oxygen-pressure-gauge-unified.js?v=OXG-0001&amp;cb=CB-UNIFIED-0001 */
try{
(function(){
 'use strict';
 const model=window.B737OxygenPressureGaugeModel,ns='http://www.w3.org/2000/svg';
 const faceUrl=new URL('./'+model.dial.faceAsset+'?v=OXG-0001',document.baseURI).href;
 const needleUrl=new URL('./'+model.dial.needleAsset+'?v=OXG-0001',document.baseURI).href;
 let frame=null,blade=null,input=null,output=null,currentPsi=model.initialPsi;
 function svg(doc,parent,tag,attrs={}){const node=doc.createElementNS(ns,tag);for(const [key,value]of Object.entries(attrs))node.setAttribute(key,String(value));parent.append(node);return node;}
 function paint(){if(blade)blade.style.transform=`rotate(${model.bearing(window.B737UnifiedCB?.available('oxygen.indicator')===false?0:currentPsi)}deg)`;if(input)input.value=String(currentPsi);if(output)output.textContent=`${currentPsi} PSI`;}
 window.addEventListener('b737:cb-state-change',paint);
 function setPressurePsi(value){currentPsi=model.pressurePsi(value);paint();return currentPsi;}
 function mount(){
  const doc=frame?.contentDocument,host=doc?.getElementById('atlasAbsolute');if(!host)return false;
  const piece=host.querySelector(`.atlas-piece[data-key="${model.source.piece}"]`);if(!piece)return false;
  if(host.querySelector('[data-oxygen-pressure-gauge]'))return true;
  const layer=svg(doc,host,'svg',{'data-oxygen-pressure-gauge':'UPPER',viewBox:`0 0 ${model.source.width} ${model.source.height}`,preserveAspectRatio:'none',role:'img','aria-label':'Crew oxygen pressure gauge, 0 to 2000 PSI'});
  Object.assign(layer.style,{position:'absolute',left:piece.style.left,top:piece.style.top,width:piece.style.width,height:piece.style.height,zIndex:'1006',pointerEvents:'none',overflow:'hidden'});
  const size=model.dial.radius*2;
  svg(doc,layer,'image',{href:faceUrl,x:model.dial.cx-model.dial.radius,y:model.dial.cy-model.dial.radius,width:size,height:size});
  const assembly=svg(doc,layer,'g',{transform:`translate(${model.dial.cx} ${model.dial.cy}) scale(${size/512}) translate(-256 -256)`});
  blade=svg(doc,assembly,'g',{'data-oxygen-pressure-blade':''});Object.assign(blade.style,{transformOrigin:'256px 256px',transition:'transform 320ms ease-out'});
  svg(doc,blade,'image',{href:needleUrl,x:0,y:0,width:512,height:512});paint();return true;
 }
 function bind(){if(mount())return;const host=frame?.contentDocument?.getElementById('atlasAbsolute');if(!host)return;const observer=new MutationObserver(()=>{if(mount())observer.disconnect();});observer.observe(host,{childList:true});}
 function connect(){const next=document.getElementById('overheadFrame');if(!next||next===frame)return;frame=next;frame.addEventListener('load',()=>{blade=null;bind();});bind();}
 function controls(){
  const section=document.createElement('section');section.id='unifiedOxygenPressureGauge';
  const title=document.createElement('h2');title.textContent='CREW OXYGEN · PRESSURE';section.append(title);
  const note=document.createElement('p');note.className='muted';note.textContent='Independent gauge and needle from the source photo. The 1200 PSI value is a visual test default and is not connected to the aircraft oxygen system.';section.append(note);
  const label=document.createElement('label');label.textContent='Oxygen pressure (PSI)';label.style.display='block';label.style.direction='ltr';
  input=document.createElement('input');Object.assign(input,{type:'range',min:'0',max:'2000',step:'10'});input.style.width='100%';input.style.accentColor='#f4eee2';input.addEventListener('input',()=>setPressurePsi(Number(input.value)));
  output=document.createElement('output');output.style.display='block';output.style.textAlign='left';output.style.direction='ltr';label.append(input,output);section.append(label);
  const reset=document.createElement('button');reset.type='button';reset.textContent='Restore Source Photo Value';reset.addEventListener('click',()=>setPressurePsi(model.initialPsi));section.append(reset);
  const previous=document.querySelector('#unifiedDuctPressureNeedles');if(previous)previous.after(section);else document.querySelector('.overhead-tools').before(section);paint();
 }
 window.B737UnifiedOxygenPressureGauge=Object.freeze({getPressurePsi:()=>currentPsi,setPressurePsi});
 window.addEventListener('b737:oxygen-pressure-value',event=>{try{setPressurePsi(event.detail?.psi);}catch(error){console.error(error);}});
 window.addEventListener('b737:cockpit-mounted',connect);connect();if(document.querySelector('.inspector'))controls();
})();

}catch(error){queueMicrotask(()=>{throw error});}
;await 0;
})();
