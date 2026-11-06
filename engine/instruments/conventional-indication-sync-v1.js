/* Conventional Engine Indication Synchronizer V1.
 * Exactly one authoritative value/status from EngineIndicationsV1, shared
 * by the photographed needle and the numerical window.
 * No second ECU, no real aircraft usage. EIS mode is unaffected.
 */
(function(root,factory){
 'use strict';
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.B737ConventionalIndicationSyncV1=api;
})(typeof globalThis==='object'?globalThis:null,function(){
 'use strict';
 const VERSION='CONV-ONE-ECU-ONE-SCALE-ONE-MOTION-0001';
 const SIGNALS=Object.freeze({
  n1:{needle:'n1',display:'n1',speed:75,quantum:.1},
  egt:{needle:'egt',display:'egt',speed:520,quantum:1},
  n2:{needle:'n2',display:'n2',speed:90,quantum:.1},
  fuelFlow:{needle:'fuelFlow',display:'fuelFlow',speed:14000,quantum:10},
  oilPressure:{needle:'oilPressure',speed:250,quantum:.2},
  oilTemperature:{needle:'oilTemp',speed:200,quantum:.2},
  oilQuantity:{needle:'oilQty',speed:20,quantum:.01},
  vibration:{needle:'vib',speed:12,quantum:.01}
 });
 const DIGIT_SIGNALS=Object.freeze(['n1','egt','n2','fuelFlow']);
 const finite=v=>typeof v==='number'&&Number.isFinite(v);
 const clone=v=>JSON.parse(JSON.stringify(v));
 const clamp=(value,lo,hi)=>Math.min(hi,Math.max(lo,value));
 const key=(engine,signal)=>signal+'_'+engine.slice(-1);
 const specs=Object.freeze(Object.entries(SIGNALS).flatMap(([signal,options])=>
  ['engine1','engine2'].map(engine=>Object.freeze({signal,engine,id:key(engine,options.needle),...options}))));
 function project(reading,signal,{fuelMode='RATE'}={}){
  if(!reading||typeof reading.status!=='string')return Object.freeze({
   status:'NO_INDICATION',state:'BLANK',value:null,digital:null,reason:'NO_BACKEND_RESULT'});
  const numeric=finite(reading.value),held=reading.pointer==='HOLD_LAST'&&numeric;
  const active=(reading.status==='VALID'||reading.status==='SENSOR_FAILURE_TRANSIENT')&&numeric;
  const state=active?'TRACK':held?'HOLD':'BLANK';
  const value=state==='BLANK'?null:reading.value;
  const digital=signal==='fuelFlow'&&fuelMode==='USED'&&state==='TRACK'&&finite(reading.digitalValue)
   ?reading.digitalValue:value;
  return Object.freeze({status:reading.status,state,value,digital,
   reason:reading.reason||null,quality:reading.feedQuality||null,
   power:reading.power||'UNKNOWN',pointer:reading.pointer||'UNKNOWN',
   raw:numeric?reading.value:null});
 }
 function create({angleFor=null,needle=null,digits=null,clock=null}={}){
  const frames=new Map(),events=[];
  let lastClock=null,active=true,latest=null,renderCount=0;
  let drive=null,rafId=null,lastRenderTime=null;
  const resolveClock=typeof clock==='function'?clock:()=>typeof performance!=='undefined'?performance.now():Date.now();
  const enqueue=fn=>{
   if(typeof requestAnimationFrame==='function')return requestAnimationFrame(fn);
   return null; // Node tests call advance(dt) explicitly; no free-running timers.
  };
  function intake(result,{fuelMode='RATE'}={}){
   if(!result?.engines)throw Error('Backend indication result required');
   latest=result;
   for(const s of specs){
    const r=result.engines?.[s.engine]?.indications?.[s.signal];
    const p=project(r,s.signal,{fuelMode});
    // Read the very same photo-detent range used by the physical needle.
    // Backend raw values remain authoritative and are preserved separately,
    // but impossible readings are marked SATURATED at the display boundary.
    const range=angleFor?.profile?.(s.needle,s.engine);
    const min=range?.values?.[0],max=range?.values?.at(-1);
    const limit=v=>finite(v)&&finite(min)&&finite(max)?clamp(v,min,max):v;
    const target=limit(p.value);
    const digital=p.digital===p.value?target:p.digital;
    const saturated=finite(p.value)&&target!==p.value;
    const old=frames.get(s.id);
    const changed=!old||old.target!==target||old.state!==p.state||
     old.digital!==digital||old.status!==p.status||old.saturated!==saturated;
    const state={
     ...s,target,digital,state:p.state,status:p.status,saturated,
     rawBackendValue:p.raw,reason:p.reason,power:p.power,quality:p.quality,
     value:old?.value??(target??null),source:'ENGINE_INDICATION_BACKEND_V2',
     tick:old?.tick||0,emitted:old?.emitted??null,emittedDigital:old?.emittedDigital??null
    };
    if(p.state==='BLANK')state.value=null;
    else if(old?.value===null||old?.value===undefined)state.value=target;
    // Channel starts at true value on entry to Conventional. No 0 -> 90 sweep
    // when simply switching panels or remounting the original photograph.
    frames.set(s.id,state);
    if(changed)events.push({id:s.id,status:p.status,state:p.state,target,
      rawBackendValue:p.raw,saturated,power:p.power,reason:p.reason});
   }
   if(events.length>128)events.splice(0,events.length-128);
   // No redundant SVG refresh when the authoritative ECU packet carries
   // the same already-rendered value (important for 30fps cockpit budgets).
   if(active)paintAll(false);
   start();
   return snapshot();
  }
  function paintOne(s,force=false){
   const number=finite(s.value)?s.value:null;
   const digitalNumber=s.signal==='fuelFlow'&&s.state==='TRACK'&&
      finite(s.digital)&&s.digital!==s.target?s.digital:number;
   // The first backend frame must claim every gauge, including BLANK.
   // Otherwise a null channel retains the old unowned needle/ECU data.
   const valueChanged=force||s.tick===0||s.emitted!==number;
   const digitalChanged=force||s.tick===0||s.emittedDigital!==digitalNumber;
   if(valueChanged&&needle?.setReading){
    // Null has a distinct failure state. No fabricated 0 data point.
    needle.setReading(s.engine,s.needle,number,'ENGINE_INDICATION_SYNC_V1');
    s.emitted=number;
   }
   if(s.display&&digitalChanged&&digits?.setReading){
    digits.setReading(s.engine,s.display,digitalNumber,'ENGINE_INDICATION_SYNC_V1');
    s.emittedDigital=digitalNumber;
   }
   if(valueChanged||digitalChanged)renderCount++;
   s.tick++;
  }
  function paintAll(force=false){
   if(!active)return;
   for(const s of frames.values())paintOne(s,force);
  }
  function advance(dt=1/30){
   if(!finite(dt)||dt<0||dt>.5)throw Error('Display delta out of range');
   let moving=false;
   for(const s of frames.values()){
    if(s.state==='BLANK'){s.value=null;continue;}
    if(!finite(s.target)){s.value=null;continue;}
    if(!finite(s.value)){s.value=s.target;continue;}
    const diff=s.target-s.value,maxTravel=s.speed*dt;
    if(Math.abs(diff)>Math.max(s.quantum*.2,1e-5)){
     s.value+=clamp(diff,-maxTravel,maxTravel);
     if(Math.abs(s.target-s.value)<=Math.max(s.quantum*.2,1e-5))s.value=s.target;
    }else s.value=s.target;
    if(Math.abs(s.target-s.value)>1e-6)moving=true;
   }
   paintAll();
   return moving;
  }
  function animation(ts){
   rafId=null;
   if(!active)return;
   const time=finite(ts)?ts:resolveClock();
   if(lastRenderTime===null)lastRenderTime=time;
   const dt=clamp((time-lastRenderTime)/1000,0,.1);
   if(dt>=1/30){
    lastRenderTime=time;
    if(advance(dt))start();
   }else start();
  }
  function start(){
   if(!active||rafId!==null||typeof requestAnimationFrame!=='function')return;
   const moving=[...frames.values()].some(s=>finite(s.target)&&finite(s.value)&&
    Math.abs(s.target-s.value)>1e-6);
   if(moving)rafId=enqueue(animation);
  }
  function setActive(enabled){
   active=Boolean(enabled);
   if(!active&&rafId!==null&&typeof cancelAnimationFrame==='function')cancelAnimationFrame(rafId);
   rafId=null;lastRenderTime=null;
   if(active){paintAll(true);start();}
  }
  function reset(){frames.clear();events.length=0;lastRenderTime=null;}
  function snapshot(){return {
   version:VERSION,active,renderCount,channels:Object.fromEntries([...frames].map(([id,s])=>
    [id,{signal:s.signal,engine:s.engine,value:s.value,target:s.target,
     digital:s.emittedDigital,state:s.state,status:s.status,power:s.power,
     reason:s.reason,rawBackendValue:s.rawBackendValue,saturated:s.saturated,
     source:s.source,tick:s.tick}])),
   recentEvents:events.slice(-20)
  };}
  function audit({angle=angleFor,random=128}={}){
   if(typeof angle!=='function')throw Error('Photo calibration registry required');
   let checks=0,maxError=0,seed=193737;
   for(const s of specs){
    const ranges=angle.profile?.(s.needle,s.engine);
    if(!ranges){continue;}
    const marks=ranges.values;
    for(const value of [...marks,...marks.slice(0,-1).flatMap((x,i)=>[
      (x+marks[i+1])/2,x+(marks[i+1]-x)/4,x+3*(marks[i+1]-x)/4])]){
     const a=angle(s.needle,s.engine,value);
     const inverse=angle.inverse(s.needle,s.engine,a);
     const error=Math.abs(inverse-value);maxError=Math.max(error,maxError);checks++;
    }
    for(let i=0;i<random;i++){
     seed=(Math.imul(seed,1664525)+1013904223)>>>0;
     const x=marks[0]+seed/4294967296*(marks[marks.length-1]-marks[0]);
     const error=Math.abs(angle.inverse(s.needle,s.engine,angle(s.needle,s.engine,x))-x);
     maxError=Math.max(maxError,error);checks++;
    }
   }
   return {checks,maxError,pass:checks===0?false:maxError<1e-6};
  }
  return Object.freeze({intake,advance,setActive,reset,snapshot,audit,paintAll});
 }
 return Object.freeze({VERSION,SIGNALS,DIGIT_SIGNALS,specs,project,create});
});