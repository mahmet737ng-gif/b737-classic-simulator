/* ATA32-GEAR-0001 — B737 Classic landing gear selector and shared indicator state.
 * Additive panel control: no protected image, guarded switch or electrical owner is changed.
 * Transit timing and System A pressure cutoff are TRAINING ESTIMATES, not AFM calibration.
 */
(function(root,factory){
  'use strict';
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.B737LandingGearCoreV1=api.core;
  if(!root?.document)return;
  const doc=root.document,POS=api.core.POS;
  let state=api.core.initial(),track=null,handle=null,aux=null,lastPublished='',lastAt=0;
  let flaps=0,radioAltitude=null,ground=null,hydPsi=null,lever1=null,lever2=null;
  let warning=null,gearHorn=false,audioContext=null,audioOsc=null,audioGain=null,ticker=0;
  const safeNumber=v=>Number.isFinite(v)?v:null;
  const emit=(name,detail)=>root.dispatchEvent(new root.CustomEvent(name,{detail}));
  const sprite=new URL('./assets/landing-gear-classic-3state.webp',doc.currentScript?.src||root.location.href).href;
  // The lever drives the aircraft sensors; cockpit and aft indications subscribe
  // to this same source of truth, never to a separate visual-test state.

  function source(){
    const live=root.B737ISNCockpitV1?.getECUState?.();
    const scene=root.B737UnifiedFlightScenarioV1?.getState?.();
    const airborne=scene?.airborne;
    if(typeof airborne==='boolean')ground=!airborne;
    else if(typeof live?.aircraft?.onGround==='boolean')ground=live.aircraft.onGround;
    const lab=doc.getElementById('hydraulicLiveLabV1');
    const labOutput=lab?.open?root.B737HydraulicLabV1?.getOutput?.():null;
    hydPsi=safeNumber(labOutput?.pressurePsi?.A)??safeNumber(live?.hydraulics?.systemA?.pressurePsi);
    const propulsion=root.B737ISNCockpitV1?.getPropulsionSnapshot?.();
    for(const [i,id] of ['engine1','engine2'].entries()){
      const angle=safeNumber(propulsion?.engines?.[id]?.throttle);
      // Throttle fraction->angle is an explicit training approximation.
      if(angle!==null) i===0?lever1=angle*45:lever2=angle*45;
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
        handle.style.top={UP:'0px',OFF:'145px',DN:'292px'}[state.lever];}}
    const l=api.core.lamps(state);
    if(aux){
      for(const id of POS){const el=aux.querySelector('[data-aux-gear="'+id+'"]');
        if(el){el.dataset.on=String(l.auxiliary[id]);el.setAttribute('aria-label',id+' landing gear down locked '+l.auxiliary[id]);}}
    }
    const detail={schema:'ATA32-GEAR-0002',lever:state.lever,gear:{...state.gear},
      selectedTarget:state.target,systemAPsi:hydPsi,onGround:ground,
      normalHydraulicAvailable:Number.isFinite(hydPsi)?hydPsi>=2200:null,
      main:l.main,auxiliaryOverhead:l.auxiliary,limitations:['TRAINING_TRANSIT_TIMING','AFT_OVERHEAD_GEOMETRY_UNVERIFIED']};
    const signature=JSON.stringify({lever:state.lever,gear:state.gear,target:state.target,
      onGround:ground,hydraulicAvailable:detail.normalHydraulicAvailable});
    if(!force&&signature===lastPublished)return;
    lastPublished=signature;
    const patch={gearLever:state.lever,gearNose:state.gear.nose,gearLeft:state.gear.left,gearRight:state.gear.right};
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
    const active=state.target&&POS.some(id=>state.gear[id]!==state.target);
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
    const x=1222+285*(372/918)-44;
    const y=127+335*(694.156862745098/1713);
    const box=doc.createElement('div');box.id='b737LandingGearSelector';box.tabIndex=0;
    box.setAttribute('role','slider');box.setAttribute('aria-valuemin','0');
    box.setAttribute('aria-valuemax','2');box.setAttribute('aria-valuenow','2');
    box.style.cssText='position:absolute;left:'+x.toFixed(2)+'px;top:'+y.toFixed(2)+'px;width:88px;height:412px;z-index:21;cursor:pointer;touch-action:none;user-select:none;outline-offset:3px;background:transparent';
    const art=doc.createElement('div');art.className='b737-gear-handle';
    art.style.cssText='position:absolute;left:8px;width:72px;height:120px;pointer-events:none;background-image:url("'+sprite+'");background-size:300% 100%;background-repeat:no-repeat;filter:drop-shadow(0 2px 3px #0008)';
    box.append(art);host.append(box);track=box;handle=art;
    function press(event){
      if(event.type==='pointerdown'){if(event.button!==0)return;box.setPointerCapture?.(event.pointerId);ensureAudio();audioContext?.resume?.();}
      if(event.type==='pointerup'){
        const r=box.getBoundingClientRect(),f=(event.clientY-r.top)/r.height;
        select(f<.33?'UP':f<.67?'OFF':'DN');}
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
    emit('b737:landing-gear-mounted',{source:'FO_INNER_PANEL',graphic:'3STATE_WHEEL_HANDLE',version:'ATA32-GEAR-0002'});
    publish(true);return true;
  }
  root.addEventListener('b737:cockpit-mounted',mount);
  root.addEventListener('b737:cockpit-lights-ready',()=>{mount();publish(true);});
  root.addEventListener('load',mount);
  if(doc.readyState!=='loading')mount();
  root.addEventListener('b737:unified-ecu-observation',()=>{
    const changed=source();if(ticker)return;
    if(changed.onGround!==null&&state.lever==='UP')publish();
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
    getSpriteUrl:()=>sprite,
    version:'ATA32-GEAR-0001'
  });
  root.setTimeout(mount,250);
})(typeof window!=='undefined'?window:globalThis,function(){
  'use strict';
  const POS=Object.freeze(['nose','left','right']);
  const seconds=Object.freeze({nose:6,left:7,right:7.5}); // Training only
  const initial=()=>({lever:'DN',target:'DOWN',gear:{nose:'DOWN',left:'DOWN',right:'DOWN'},elapsed:{nose:0,left:0,right:0},lastReject:null});
  function select(s,lever,info={}){
    if(!['UP','OFF','DN'].includes(lever))throw Error('Landing gear selector UP/OFF/DN required');
    if(lever==='UP'&&info.onGround!==false&&info.lockOverride!==true)
      return {...s,lastReject:'GROUND_SAFETY_INTERLOCK'};
    const target=lever==='UP'?'UP':lever==='DN'?'DOWN':null;
    return {...s,lever,target,lastReject:null,
      elapsed:target===s.target?{...s.elapsed}:{nose:0,left:0,right:0}};
  }
  function step(s,dt,psi){
    if(!Number.isFinite(dt)||dt<0)throw Error('Valid elapsed seconds required');
    if(!s.target||!Number.isFinite(psi)||psi<2200||dt===0)return s;
    const n={...s,gear:{...s.gear},elapsed:{...s.elapsed}};
    for(const id of POS){
      if(n.gear[id]===n.target)continue;
      n.elapsed[id]=(n.elapsed[id]||0)+dt;
      n.gear[id]=n.elapsed[id]>=seconds[id]?n.target:'TRANSIT';
      if(n.gear[id]===n.target)n.elapsed[id]=0;
    }
    return n;
  }
  const lamps=s=>({
    main:Object.fromEntries(POS.map(id=>[id,{green:s.gear[id]==='DOWN',
      red:s.gear[id]==='TRANSIT'||s.gear[id]==='UNSAFE'||
      s.lever==='UP'&&s.gear[id]!=='UP'||s.lever==='DN'&&s.gear[id]!=='DOWN'}])),
    auxiliary:Object.fromEntries(POS.map(id=>[id,s.gear[id]==='DOWN']))
  });
  return {core:Object.freeze({POS,initial,select,step,lamps})};
});
