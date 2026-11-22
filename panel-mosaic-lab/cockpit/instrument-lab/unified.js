(() => {
  'use strict';
  const photos=window.B737PhotoGauges;
  const airspeed=window.B737AirspeedPointersModel;
  const registration=window.B737PhotoGaugeRegistrationV1;
  if(!photos||!airspeed||!registration)return;
  const stations=['captain','firstOfficer'];
  const gauges=new Map();
  const settings={captain:{},firstOfficer:{},standby:{}};
  let standby, queued=false;
  function change(station,key,value,initial){
    if(key==='cursorManual'&&value) settings[station].cursor=initial;
    settings[station][key]=value;
    repaint();
  }
  function mountGauge(station,kind,mode){
    const key=station+':'+kind;
    const entry=registration.get(mode,station,kind);
    const host=document.querySelector(registration.selector(entry));
    const original=gauges.get(key);
    // The EIS outer photo is deliberately hidden in Conventional mode.
    // Never retain its overlay instead of painting on the visible owner photo.
    if(!host){
      if(original){original.canvas.remove();gauges.delete(key);}
      return false;
    }
    const rect=registration.rectangle(entry,photos.geometry[kind]);
    let gauge=original;
    if(!gauge||gauge.canvas.parentNode!==host){
      gauge?.canvas.remove();
      gauge=photos.createGauge(host,kind,{
        label:station+' '+kind,fitPhoto:true,
        lockOrangeBugs:kind==='airspeed',
        onChange:(...args)=>change(station,...args)
      });
      gauges.set(key,gauge);
    }
    Object.assign(gauge.canvas.style,{
      position:'absolute',
      left:rect.left.toFixed(7)+'%',top:rect.top.toFixed(7)+'%',
      width:rect.widthPct.toFixed(7)+'%',height:rect.heightPct.toFixed(7)+'%',
      overflow:'visible',pointerEvents:'none',zIndex:'4'
    });
    gauge.canvas.setAttribute('preserveAspectRatio','xMidYMid meet');
    const clip=rect.clip;
    gauge.canvas.style.clipPath='inset('+[
      clip.top,clip.right,clip.bottom,clip.left
    ].map(n=>n.toFixed(5)+'%').join(' ')+')';
    gauge.canvas.dataset.gaugeRegistration=registration.VERSION;
    gauge.canvas.dataset.gaugePiece=entry.piece;
    gauge.canvas.dataset.gaugeMode=mode;
    gauge.canvas.dataset.gaugeCenter=entry.x+','+entry.y;
    gauge.canvas.dataset.gaugeSource=entry.anchor;
    if(kind==='airspeed')
      host.querySelectorAll('[data-airspeed-pointers]').forEach(layer=>{
        layer.setAttribute('display','none');
        layer.setAttribute('aria-hidden','true');
      });
    const oldKind={altimeter:['altimeter'],ivsi:['verticalSpeed'],rmi:['rmi1','rmi2']}[kind]||[];
    for(const old of oldKind)
      host.querySelectorAll('[data-flight-needle="'+old+'"]').forEach(n=>n.setAttribute('display','none'));
    return true;
  }
  let lastMode=null;
  function mount(){
    const mode=registration.modeOf(document);
    for(const station of stations)
      for(const kind of registration.kinds)
        mountGauge(station,kind,mode);
    lastMode=mode;
    const slot=document.querySelector('.flight-gauge-bridge .flight-standby-row');
    if(slot && standby?.canvas.parentNode!==slot){
      standby=photos.createGauge(slot,'standby',{label:'Standby altimeter and IAS',fitPhoto:true,onChange:(...args)=>change('standby',...args)});
      standby.canvas.classList.add('flight-standby-dial');
      standby.canvas.style.cssText='width:clamp(110px,23vw,190px);height:auto';
      slot.querySelector('svg:not([data-gauge])')?.remove();
      const heading=slot.querySelector('strong');
      const copy=slot.querySelector('p');
      if(heading) heading.textContent='STANDBY ALT / IAS';
      if(copy) copy.textContent='Flight Scenario training data';
      slot.prepend(standby.canvas);
    }
    repaint();
  }
  function repaint(){
    if(queued) return;
    queued=true;
    requestAnimationFrame(()=>{
      queued=false;
      const source=window.B737UnifiedFlightDisplayMotionV1?.sample?.();
      const original=window.B737UnifiedFlightGaugeBridgeV1?.getState()?.sample;
      const live=source?{
        indicatedSpeedKt:source.iasKt,altitudeFt:source.altitudeFt,
        standbyAltitudeFt:source.altitudeFt,verticalSpeedFpm:source.vsFpm
       }:original;
      const scene=source|| (live?window.B737UnifiedFlightScenarioV1?.getState?.():null);
      const needles=window.B737UnifiedFlightNeedles?.getAngles?.();
      const speeds=window.B737UnifiedAirspeedPointers?.getValues?.();
      const snapshot=window.B737UnifiedAvionicsNetworkV1?.getSnapshot?.();
      const mcp=snapshot?.['mcp.state']?.quality==='VALID'?
        snapshot['mcp.state'].value:null;
      const fmc=snapshot?.['fmc.computed']?.value;
      const valid=(topic)=>snapshot?.[topic]?.quality==='VALID'?snapshot[topic].value:null;
      const base={...photos.defaults, ias:0, mach:0, altitude:0, standbyAltitude:0,
        altitudeBug:500, dme1:null, dme2:null, ivsiOff:false,
        bugs:[85,92,100,107],orangeBugs:[null,null]};
      for(const station of stations){
        const angles=needles?.[station];
        const speedsForStation=speeds?.[station];
        const nav=window.B737UnifiedEfisSources?.project(station==='captain'?'CAPT':'FO',snapshot);
        const hdg=nav?.heading??scene?.headingMagDeg??0;
        // RMI VOR 1/2 needles follow valid NAV receivers, not the
        // ADF-only EHSI compass pointer array.
        const magneticBearing=signal=>{
          if(!Number.isFinite(signal?.bearingDeg))return null;
          const normal=angle=>((angle%360)+360)%360;
          if(signal.bearingReference==='MAGNETIC')return normal(signal.bearingDeg);
          if(signal.bearingReference==='RELATIVE'&&Number.isFinite(hdg))
            return normal(hdg+signal.bearingDeg);
          if(signal.bearingReference==='TRUE'&&Number.isFinite(nav?.magneticVariationDeg))
            return normal(signal.bearingDeg-nav.magneticVariationDeg);
          return null;
        };
        const bearing=n=>magneticBearing(valid('navigation.vor'+n));
        const adc=valid('airdata.adc'+(station==='captain'?1:2));
        const adf=n=>magneticBearing(valid('navigation.adf'+n))??
          nav?.bearings?.find(x=>x.channel===n)?.angle??null;
        const altitude=live?.altitudeFt??adc?.pressureAltitudeFt??0;
        const selectedCas=mcp?.powered===true&&mcp.speedBlank!==true?
          (mcp.speedDisplayMode==='MACH'&&Number.isFinite(mcp.selectedMachHundredths)?
           photos.calibratedSpeed(mcp.selectedMachHundredths/100,altitude):
           mcp.speedDisplayMode==='IAS'?mcp.selectedSpeedKt:null):null;
        const state={...base,...settings[station],
          orangeBugs:Number.isFinite(selectedCas)?[selectedCas,selectedCas]:[null,null],
          ias:live?.indicatedSpeedKt??adc?.casKt??speedsForStation?.airspeedKts??0,
          limit:speedsForStation?.vmoMmoKts??base.limit,
          altitude,
          vs:live?.verticalSpeedFpm??0,
          autoCursor:Number.isFinite(selectedCas)?selectedCas:fmc?.targets?.speedKt,
          oat:adc?.satC??scene?.oatC??null,hdg,
          bearing1:bearing(1),bearing2:bearing(2),
          adfBearing1:adf(1),adfBearing2:adf(2),
          dme1:valid('navigation.dme1')?.distanceNm??null,dme2:valid('navigation.dme2')?.distanceNm??null

        };
        gauges.get(station+':airspeed')?.render(state);
        gauges.get(station+':altimeter')?.render(state);
        gauges.get(station+':ivsi')?.render({...state,
          vsiAngle:live?undefined:angles?.verticalSpeed});
        gauges.get(station+':rmi')?.render(state);
      }
      standby?.render({...base,...settings.standby,ias:live?.indicatedSpeedKt??0,standbyAltitude:live?.standbyAltitudeFt??0});
    });
  }
  for(const name of ['b737:flight-presentation-frame',
    'b737:photo-needle-update','b737:photo-airspeed-update',
    'b737:standby-altimeter-sample','b737:flight-scenario-stopped','b737:mcp-afds-state','b737:avionics-data']){
    window.addEventListener(name,repaint);
  }
  // Owner F/O image and mode transforms mount in an animation frame.
  // The second frame is event-driven and handles an asynchronously created
  // owner photo without polling or changing any accepted photo layers.
  let mountQueued=false;
  function scheduleMount(){
    if(mountQueued)return;
    mountQueued=true;
    requestAnimationFrame(()=>{
      mountQueued=false;
      mount();
      requestAnimationFrame(()=>{
        const mode=registration.modeOf(document);
        const expected=mode==='CONVENTIONAL'?'fo-owner':'fo-inner';
        if(gauges.get('firstOfficer:airspeed')?.canvas?.dataset.gaugePiece!==expected)mount();
      });
    });
  }
  for(const event of ['b737:cockpit-mounted','b737:engine-indication-view',
    'b737:aircraft-profile-change'])window.addEventListener(event,scheduleMount);
  if(document.readyState==='loading')
    document.addEventListener('DOMContentLoaded',scheduleMount,{once:true});
  else scheduleMount();
  window.B737UnifiedPhotoGaugeBridgeV1=Object.freeze({
    getPlacements:()=>Object.fromEntries([...gauges].map(([key,g])=>[key,{
      piece:g.canvas.dataset.gaugePiece,
      mode:g.canvas.dataset.gaugeMode,
      center:g.canvas.dataset.gaugeCenter,
      source:g.canvas.dataset.gaugeSource,
      connected:g.canvas.isConnected
    }])),
    getMcpSelectedCas:()=>{
      const mcp=window.B737UnifiedAvionicsNetworkV1?.getSnapshot?.()?.['mcp.state']?.value;
      if(mcp?.powered!==true||mcp.speedBlank===true)return null;
      if(mcp.speedDisplayMode==='IAS')return Number.isFinite(mcp.selectedSpeedKt)?mcp.selectedSpeedKt:null;
      const alt=window.B737UnifiedFlightDisplayMotionV1?.sample?.()?.altitudeFt??0;
      return mcp.speedDisplayMode==='MACH'&&Number.isFinite(mcp.selectedMachHundredths)?
       photos.calibratedSpeed(mcp.selectedMachHundredths/100,alt):null;
    }
  });
})();
