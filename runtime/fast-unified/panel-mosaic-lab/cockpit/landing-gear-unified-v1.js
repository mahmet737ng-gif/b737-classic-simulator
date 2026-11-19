/* ATA32-GEAR-0005 — B737 Classic landing gear selector and shared indicator state.
 * Additive panel control: no protected image, guarded switch or electrical owner is changed.
 * Transit timing and System A pressure cutoff are TRAINING ESTIMATES, not AFM calibration.
 */
(function(root,factory){
  'use strict';
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.B737LandingGearCoreV1=api.core;
  if(!root?.document)return;
  const doc=root.document,POS=api.core.POS,VISUAL=api.core.VISUAL;
  let state=api.core.initial(),track=null,handle=null,aux=null,lastPublished='',lastAt=0;
  let flaps=0,radioAltitude=null,ground=null,hydPsi=null,lever1=null,lever2=null;
  let warning=null,gearHorn=false,audioContext=null,audioOsc=null,audioGain=null,ticker=0;
  const safeNumber=v=>Number.isFinite(v)?v:null;
  const emit=(name,detail)=>root.dispatchEvent(new root.CustomEvent(name,{detail}));
  const sprite=new URL('./assets/landing-gear-classic-3state.webp?v=ATA32-GEAR-0005',doc.currentScript?.src||root.location.href).href;
  // The lever drives the aircraft sensors; cockpit and aft indications subscribe
  // to this same source of truth, never to a separate visual-test state.

  function source(){
    const live=root.B737ISNCockpitV1?.getECUState?.();
    const scene=root.B737UnifiedFlightScenarioV1?.getState?.();
    if(typeof scene?.airborne==='boolean')ground=!scene.airborne;
    else if(typeof live?.aircraft?.onGround==='boolean')ground=live.aircraft.onGround;
    const lab=doc.getElementById('hydraulicLiveLabV1');
    const out=root.B737HydraulicLabV1?.getOutput?.();
    const labPsi=safeNumber(out?.pressurePsi?.A);
    // ISN-18 source is engines.engine1.hydraulic.engineDrivenPressurePsi;
    // hydraulics.systemA.pressurePsi does not exist on all live ECU versions.
    const livePsi=safeNumber(live?.hydraulics?.systemA?.pressurePsi);
    const enginePsi=safeNumber(live?.engines?.engine1?.hydraulic?.engineDrivenPressurePsi);
    let switches=null;
    try{switches=doc.getElementById('overheadFrame')?.contentWindow?.B737OverheadToggles?.getState?.()||null;}catch{}
    const edpPsi=switches?.['hyd-eng-1']==='OFF'?null:enginePsi;
    const elecPsi=switches?.['hyd-elec-2']==='OFF'?null:
      out?.pumps?.['hyd-elec-2']?.delivering?safeNumber(out.pumps['hyd-elec-2'].pressurePsi):null;
    const pumpPsi=edpPsi!==null||elecPsi!==null?Math.max(edpPsi??0,elecPsi??0):null;
    const labOverride=lab?.open===true||(out?.faults?.length||0)>0;
    hydPsi=labOverride?labPsi:(livePsi??pumpPsi??labPsi);
    const propulsion=root.B737ISNCockpitV1?.getPropulsionSnapshot?.();
    for(const [i,id] of ['engine1','engine2'].entries()){
      const fraction=safeNumber(propulsion?.engines?.[id]?.throttle);
      if(fraction!==null)i===0?lever1=fraction*45:lever2=fraction*45;
    }
    return {onGround:ground,hydraulicSystemAPsi:hydPsi};
  }

  function hornState(){
    if(!root.B737WarningEngine?.WarningEngine)return false;
    if(!warning){
      const family=root.B737AircraftProfileV1?.getState?.()?.aircraftFamily||
        root.B737AircraftSettings?.getState?.()?.aircraftFamily||'B737-300';
      warning=new root.B737WarningEngine.WarningEngine({
        variant:/400/.test(family)?'737-400':/500/.test(family)?'737-500':'737-300'
      });
    }
    const output=warning.update({
      gearDownLocked:POS.every(id=>state.gear[id]==='DOWN'),
      onGround:ground!==false,flaps:flaps,
      thrustLever1Angle:lever1??45,thrustLever2Angle:lever2??45,
      radioAltitudeFt:radioAltitude
    });
    return output.active.some(x=>x.id==='gearHorn');
  }
  function ensureAudio(){
    if(audioContext)return;
    const Ctx=root.AudioContext||root.webkitAudioContext;
    if(!Ctx)return;
    try{
      audioContext=new Ctx();
      audioGain=audioContext.createGain();audioGain.gain.value=0;
      audioGain.connect(audioContext.destination);
      audioOsc=audioContext.createOscillator();audioOsc.type='sawtooth';
      audioOsc.frequency.value=450;audioOsc.connect(audioGain);audioOsc.start();
      audioGain.gain.value=gearHorn?0.022:0;
    }catch(err){audioContext=null;console.warn('Training gear horn unavailable',err);}
  }
  function sound(on){
    if(on===gearHorn)return;
    gearHorn=on;
    if(audioGain&&audioContext?.state==='running')
      audioGain.gain.setTargetAtTime(on?0.022:0,audioContext.currentTime,0.04);
    emit('b737:landing-gear-horn',{active:on,asset:'gearHorn',source:'WARNING_ENGINE_FCOM15',audio:'SYNTHETIC_TRAINING_PLACEHOLDER'});
  }

  function publish(force=false){
    if(track){track.dataset.detent=state.lever;track.setAttribute('aria-valuenow',String({UP:0,OFF:1,DN:2}[state.lever]));track.setAttribute('aria-label','Landing gear selector '+state.lever+'. Tap or drag: UP, OFF, DOWN.');
      if(handle){handle.style.backgroundPosition={UP:'0% 50%',OFF:'50% 50%',DN:'100% 50%'}[state.lever];
        handle.style.top=VISUAL.top[state.lever]+'px';}}
    const l=api.core.lamps(state,{onGround:ground,radioAltitudeFt:radioAltitude,thrustIdle:lever1!==null&&lever2!==null&&(lever1<=10||lever2<=10)});
    if(aux){
      for(const id of POS){const el=aux.querySelector('[data-aux-gear="'+id+'"]');
        if(el){el.dataset.on=String(l.auxiliary[id]);el.setAttribute('aria-label',id+' landing gear down locked '+l.auxiliary[id]);}}
    }
    const detail={schema:'ATA32-GEAR-0005',lever:state.lever,gear:{...state.gear},
      selectedTarget:state.target,systemAPsi:hydPsi,onGround:ground,
      normalHydraulicAvailable:Number.isFinite(hydPsi)?hydPsi>=api.core.HYD_MIN_PSI:null,
      nominalCycleSeconds:api.core.NOMINAL_CYCLE_SEC,
      main:l.main,auxiliaryOverhead:l.auxiliary,limitations:['TRAINING_TRANSIT_TIMING','AFT_OVERHEAD_GEOMETRY_UNVERIFIED']};
    const signature=JSON.stringify({lever:state.lever,gear:state.gear,target:state.target,
      onGround:ground,hydraulicAvailable:detail.normalHydraulicAvailable});
    if(!force&&signature===lastPublished)return;
    lastPublished=signature;
    const patch={gearLever:state.lever,gearNose:state.gear.nose,gearLeft:state.gear.left,gearRight:state.gear.right};
    if(typeof ground==='boolean')patch.aircraftOnGround=ground;
    if(Number.isFinite(radioAltitude))patch.radioAltitude=Math.max(0,Math.min(60000,radioAltitude));
    if(lever1!==null&&lever2!==null)patch.thrustIdle=lever1<=10||lever2<=10;
    const current=root.B737CockpitLights?.getState?.()?.inputs;
    if(!current||Object.keys(patch).some(k=>current[k]!==patch[k]))
      emit('b737:cockpit-sensors',patch);
    emit('b737:landing-gear-state',detail);
    // Read-only consumers (AFT OH, master-caution and instructor scenarios) may
    // subscribe without taking ownership of gear actuation.
    emit('b737:landing-gear-indications',{
      lever:state.lever,gear:{...state.gear},main:l.main,aftOverhead:l.auxiliary,
      hydraulicSystemAPsi:hydPsi,transit:POS.some(id=>state.gear[id]==='TRANSIT')
    });
    const frame=doc.getElementById('overheadFrame');
    // Shared, read-only auxiliary-lamp source. No guessed rear-overhead socket.
    frame?.contentWindow?.postMessage({type:'b737:cockpit-command',action:'landing-gear-indicator-snapshot',detail},root.location.origin);
  }
  function advance(){
    source();
    const now=root.performance.now(),seconds=lastAt?Math.min(0.3,(now-lastAt)/1000):0;
    lastAt=now;
    if(seconds>0)state=api.core.step(state,seconds,hydPsi);
    const nextHorn=hornState();
    sound(nextHorn);
    publish();
    const active=state.target&&POS.some(id=>state.gear[id]!==state.target)&&Number.isFinite(hydPsi)&&hydPsi>=api.core.HYD_MIN_PSI;
    if(!active&&ticker){root.clearInterval(ticker);ticker=0;lastAt=0;}
  }
  function run(){
    if(!ticker){lastAt=0;ticker=root.setInterval(advance,125);}
    advance();
  }
  function select(position,opts={}){
    const info=source();
    const next=api.core.select(state,position,{...info,lockOverride:opts.lockOverride===true});
    if(next.lastReject){emit('b737:landing-gear-selection-rejected',{position,reason:next.lastReject});return false;}
    state=next;
    if(track)track.dataset.detent=position;
    if(ticker){root.clearInterval(ticker);ticker=0;lastAt=0;}
    run();publish(true);return true;
  }
  function mount(){
    if(track?.isConnected)return true;
    const host=doc.querySelector('#region-main .region-native');
    if(!host)return false;
    // Native canvas coordinates: locked FO-inner photo x=1222,y=127,
    // source dimensions 918x1713, rendered 372x694.157.
    const x=1222+VISUAL.photoX*(372/918)-VISUAL.width/2;
    const y=127+VISUAL.photoY*(694.156862745098/1713);
    // The photographic selector slot is ~270 native pixels high. The previous 412px
    // pointer box and 0/145/292px art translations placed DN below the real cutout.
    // Keep the original horizontal mount: only vertical travel and hit zones change.
    const box=doc.createElement('div');box.id='b737LandingGearSelector';box.tabIndex=0;
    box.setAttribute('role','slider');box.setAttribute('aria-valuemin','0');
    box.setAttribute('aria-valuemax','2');box.setAttribute('aria-valuenow','2');
    box.style.cssText='position:absolute;left:'+x.toFixed(2)+'px;top:'+y.toFixed(2)+'px;width:'+VISUAL.width+'px;height:'+VISUAL.height+'px;z-index:21;cursor:pointer;touch-action:none;user-select:none;outline-offset:3px;background:transparent';
    const art=doc.createElement('div');art.className='b737-gear-handle';
    art.style.cssText='position:absolute;left:8px;width:'+VISUAL.artWidth+'px;height:'+VISUAL.artHeight+'px;pointer-events:none;background-image:url("'+sprite+'");background-size:300% 100%;background-repeat:no-repeat;filter:drop-shadow(0 2px 3px #0008)';
    box.append(art);host.append(box);track=box;handle=art;
    function press(event){
      if(event.type==='pointerdown'){if(event.button!==0)return;box.setPointerCapture?.(event.pointerId);ensureAudio();audioContext?.resume?.();}
      if(event.type==='pointerup'){
        const r=box.getBoundingClientRect();
        // Detent hit zones track the three physical wheel centers, not the old oversized box.
        select(api.core.detentAtY((event.clientY-r.top)*VISUAL.height/r.height));}
    }
    box.addEventListener('pointerdown',press);
    box.addEventListener('pointerup',press);
    box.addEventListener('keydown',e=>{
      const next={Home:'UP',End:'DN',ArrowUp:state.lever==='DN'?'OFF':'UP',
        ArrowDown:state.lever==='UP'?'OFF':'DN', ' ':'OFF'}[e.key];
      if(next){e.preventDefault();ensureAudio();audioContext?.resume?.();select(next);}
    });
    // Status-only auxiliary indicators until the physical AFT overhead
    // photo and exact pixel-calibrated sockets are available.
    const inspector=doc.getElementById('inspector');
    if(inspector&&!doc.getElementById('b737GearAftIndicatorStatus')){
      const section=doc.createElement('section');section.id='b737GearAftIndicatorStatus';section.dir='ltr';
      section.innerHTML='<h3>AFT OVERHEAD · Gear indicators (read-only status)</h3><div style="display:flex;gap:10px">'+
        POS.map(id=>'<span data-aux-gear="'+id+'" data-on="false" style="font:600 11px system-ui;border:1px solid #576c5b;padding:6px;color:#b5cbbb">'+id.toUpperCase()+'</span>').join('')+
        '</div><small>Connected to the same gear sensors. Physical aft panel placement pending verified artwork.</small>';
      const style=doc.createElement('style');style.textContent='#b737GearAftIndicatorStatus [data-on="true"]{background:#135934;color:#a5ffc7!important;box-shadow:0 0 10px #29e67c77}';
      section.append(style);inspector.append(section);aux=section;
    }
    emit('b737:landing-gear-mounted',{source:'FO_INNER_PANEL',graphic:'3STATE_WHEEL_HANDLE',version:'ATA32-GEAR-0005'});
    publish(true);return true;
  }
  root.addEventListener('b737:cockpit-mounted',mount);
  root.addEventListener('b737:cockpit-lights-ready',()=>{mount();publish(true);});
  root.addEventListener('load',mount);
  if(doc.readyState!=='loading')mount();
  root.addEventListener('b737:unified-ecu-observation',()=>{
    source();if(ticker)return;
    if(state.target&&POS.some(id=>state.gear[id]!==state.target)&&Number.isFinite(hydPsi)&&hydPsi>=api.core.HYD_MIN_PSI)run();
    else{sound(hornState());publish();}
  });
  root.addEventListener('b737:flight-scenario-state',e=>{
    if(typeof e.detail?.airborne==='boolean')ground=!e.detail.airborne;
    radioAltitude=safeNumber(e.detail?.radioAltitudeFt);
    if(ticker)advance();else sound(hornState());
  });
  root.addEventListener('b737:trailing-flaps',e=>{
    const n=Number(e.detail?.position);
    if(Number.isFinite(n)&&n>=0&&n<=40){flaps=n;sound(hornState());}
  });
  root.addEventListener('b737:sixpack-acknowledge',()=>{}); // MC must never silence a gear horn.
  root.addEventListener('b737:landing-gear-horn-cutout-request',()=>{
    warning?.cutoutGear?.();sound(hornState());
  });
  root.B737LandingGearUnifiedV1=Object.freeze({
    select,getState:()=>({ ...state,gear:{...state.gear},pressureA:hydPsi,onGround:ground,horn:gearHorn}),
    cutoutHorn:()=>{warning?.cutoutGear?.();sound(hornState());},
    refresh:()=>{source();publish(true);return api.core.lamps(state);},
    getSpriteUrl:()=>sprite,getVisualSpec:()=>VISUAL,
    getNominalCycleSeconds:()=>api.core.NOMINAL_CYCLE_SEC,
    version:'ATA32-GEAR-0005'
  });
  root.setTimeout(mount,250);
})(typeof window!=='undefined'?window:globalThis,function(){
  'use strict';
  const POS=Object.freeze(['nose','left','right']);
  const NOMINAL_CYCLE_SEC=Object.freeze({nose:4.5,left:5.1,right:5.8});
  // Pilot-requested training calibration: nose locks first; left main precedes
  // right main by 0.7 seconds for BOTH normal extension and retraction.
  // Not an AFM-certified transit time; faults and hydraulic pauses override it.
  const HYD_MIN_PSI=2200; // Training threshold, not certified AFM data
  // Packed sprite wheel centers vary with silhouette: UP=34, OFF=60, DN=85.
  // Anchor each WHEEL to the physical slot, not a uniform top-left offset.
  const VISUAL=Object.freeze({photoX:313,photoY:335,width:88,height:248,
    artWidth:72,artHeight:120,artWheelY:Object.freeze({UP:34,OFF:60,DN:85}),
    top:Object.freeze({UP:6,OFF:65,DN:125}),
    wheelY:Object.freeze({UP:40,OFF:125,DN:210})});
  const detentAtY=y=>y<82.5?'UP':y<167.5?'OFF':'DN';
  const initial=()=>({lever:'DN',target:'DOWN',
    gear:{nose:'DOWN',left:'DOWN',right:'DOWN'},
    progress:{nose:1,left:1,right:1},elapsed:{nose:0,left:0,right:0},lastReject:null});
  function select(s,lever,info={}){
    if(!['UP','OFF','DN'].includes(lever))throw Error('Landing gear selector UP/OFF/DN required');
    if(lever==='UP'&&info.onGround!==false&&info.lockOverride!==true)
      return {...s,lastReject:'GROUND_SAFETY_INTERLOCK'};
    const target=lever==='UP'?'UP':lever==='DN'?'DOWN':null;
    // OFF removes selector pressure, not the existing uplock/downlock.
    // Reversing direction does not reset physical progress.
    return {...s,lever,target,lastReject:null,elapsed:{nose:0,left:0,right:0}};
  }
  function step(s,dt,psi){
    if(!Number.isFinite(dt)||dt<0)throw Error('Valid elapsed seconds required');
    if(!s.target||!Number.isFinite(psi)||psi<HYD_MIN_PSI||dt===0)return s;
    const n={...s,gear:{...s.gear},progress:{...s.progress},elapsed:{...s.elapsed}};
    const goal=s.target==='UP'?0:1;
    for(const id of POS){
      const p=Number.isFinite(n.progress[id])?n.progress[id]:
        n.gear[id]==='DOWN'?1:n.gear[id]==='UP'?0:.5;
      const next=Math.max(0,Math.min(1,p+Math.sign(goal-p)*Math.min(Math.abs(goal-p),dt/NOMINAL_CYCLE_SEC[id])));
      n.progress[id]=next;
      n.gear[id]=next<=1e-6?'UP':next>=1-1e-6?'DOWN':'TRANSIT';
      n.elapsed[id]=n.gear[id]===n.target?0:(n.elapsed[id]||0)+dt;
    }
    return n;
  }
  const lamps=(s,flight={})=>({
    main:Object.fromEntries(POS.map(id=>{
      const g=s.gear[id],approach=flight.onGround===false&&
        Number.isFinite(flight.radioAltitudeFt)&&flight.radioAltitudeFt<800&&flight.thrustIdle===true;
      return [id,{green:g==='DOWN',red:g==='TRANSIT'||g==='UNSAFE'||
        s.lever==='UP'&&g!=='UP'||s.lever==='DN'&&g!=='DOWN'||
        s.lever==='OFF'&&g!=='UP'||approach&&g!=='DOWN'}];
    })),
    auxiliary:Object.fromEntries(POS.map(id=>[id,s.gear[id]==='DOWN']))
  });
  return {core:Object.freeze({POS,VISUAL,HYD_MIN_PSI,NOMINAL_CYCLE_SEC,detentAtY,initial,select,step,lamps})};
});
