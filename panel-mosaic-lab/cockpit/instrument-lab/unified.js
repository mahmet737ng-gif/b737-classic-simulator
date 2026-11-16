(() => {
  'use strict';
  const photos=window.B737PhotoGauges;
  const source=window.B737FlightNeedlesModel?.sources;
  const airspeed=window.B737AirspeedPointersModel;
  if(!photos||!source||!airspeed) return;
  const stations=['captain','firstOfficer'];
  const gauges=new Map();
  const radii={airspeed:304, altimeter:456, ivsi:240, rmi:213};
  const type={altimeter:'altimeter',verticalSpeed:'ivsi',rmi:'rmi'};
  const settings={captain:{},firstOfficer:{},standby:{}};
  let standby, queued=false;
  function change(station,key,value,initial){
    if(key==='cursorManual'&&value) settings[station].cursor=initial;
    settings[station][key]=value;
    repaint();
  }
  function mountGauge(station,kind,piece,width,height,x,y,radius){
    const key=`${station}:${kind}`;
    const host=document.querySelector(`.texture-piece[data-piece="${piece}"]`);
    if(!host||gauges.get(key)?.canvas.parentNode===host) return;
    const gauge=photos.createGauge(host,kind,{label:`${station} ${kind}`,onChange:(...args)=>change(station,...args)});
    const {size,pivot}=photos.geometry[kind];
    const scale=radius/radii[kind];
    Object.assign(gauge.canvas.style,{
      position:'absolute',left:`${(x-pivot[0]*scale)*100/width}%`,
      top:`${(y-pivot[1]*scale)*100/height}%`,
      width:`${size[0]*scale*100/width}%`,height:`${size[1]*scale*100/height}%`,
      overflow:'visible',pointerEvents:'none',zIndex:4
    });
    gauge.canvas.setAttribute('preserveAspectRatio','none');
    gauges.set(key,gauge);
    if(kind==='airspeed') host.querySelector('[data-airspeed-pointers]')?.setAttribute('aria-hidden','true');
    const oldKind={altimeter:['altimeter'],ivsi:['verticalSpeed'],rmi:['rmi1','rmi2']}[kind]||[];
    for(const old of oldKind) host.querySelector(`[data-flight-needle="${old}"]`)?.setAttribute('display','none');
    if(kind==='airspeed') host.querySelector('[data-airspeed-pointers]')?.setAttribute('display','none');
  }
  function mount(){
    for(const [group,panel] of Object.entries(source)){
      const station=group==='captain'?'captain':'firstOfficer';
      for(const [key,{x,y,radius}] of Object.entries(panel.gauges)){
        if(type[key]) mountGauge(station,type[key],panel.piece,panel.width,panel.height,x,y,radius);
      }
    }
    const pilot=airspeed.source,fo=airspeed.firstOfficer;
    mountGauge('captain','airspeed',pilot.piece,pilot.width,pilot.height,airspeed.pivot.x,airspeed.pivot.y,airspeed.pointers.airspeed.tipRadius);
    mountGauge('firstOfficer','airspeed',fo.piece,fo.width,fo.height,fo.pivot.x,fo.pivot.y,fo.tipRadius);
    const slot=document.querySelector('.flight-gauge-bridge .flight-standby-row');
    if(slot && standby?.canvas.parentNode!==slot){
      standby=photos.createGauge(slot,'standby',{label:'Standby altimeter and IAS',onChange:(...args)=>change('standby',...args)});
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
      const live=window.B737UnifiedFlightGaugeBridgeV1?.getState()?.sample;
      const scene=live?window.B737UnifiedFlightScenarioV1?.getState?.():null;
      const needles=window.B737UnifiedFlightNeedles?.getAngles?.();
      const speeds=window.B737UnifiedAirspeedPointers?.getValues?.();
      const snapshot=window.B737UnifiedAvionicsNetworkV1?.getSnapshot?.();
      const mcp=snapshot?.['mcp.state']?.value;
      const fmc=snapshot?.['fmc.computed']?.value;
      const valid=(topic)=>snapshot?.[topic]?.quality==='VALID'?snapshot[topic].value:null;
      const base={...photos.defaults, ias:0, mach:0, altitude:0, standbyAltitude:0,
        altitudeBug:500, dme1:null, dme2:null, ivsiOff:false, bugs:[85,92,100,107]};
      for(const station of stations){
        const angles=needles?.[station];
        const speedsForStation=speeds?.[station];
        const nav=window.B737UnifiedEfisSources?.project(station==='captain'?'CAPT':'FO',snapshot);
        const hdg=nav?.heading??scene?.headingMagDeg??0;
        const bearing=n=>nav?.bearings?.find(x=>x.channel===n)?.angle??null;
        const adc=valid('airdata.adc'+(station==='captain'?1:2));
        const adf=n=>{
          const signal=valid('navigation.adf'+n);
          if(!Number.isFinite(signal?.bearingDeg)) return null;
          if(signal.bearingReference==='RELATIVE') return hdg+signal.bearingDeg;
          if(signal.bearingReference==='TRUE') return Number.isFinite(nav?.magneticVariationDeg) ?
            signal.bearingDeg-nav.magneticVariationDeg : null;
          return signal.bearingDeg;
        };
        const altitude=live?.altitudeFt??adc?.pressureAltitudeFt??0;
        const state={...base,...settings[station],
          ias:live?.indicatedSpeedKt??adc?.casKt??speedsForStation?.airspeedKts??0,
          limit:speedsForStation?.vmoMmoKts??base.limit,
          altitude,
          vs:live?.verticalSpeedFpm??0,
          autoCursor:mcp?.powered&&!mcp.speedBlank ? (mcp.speedDisplayMode==='MACH'&&Number.isFinite(mcp.selectedMachHundredths)
            ? photos.calibratedSpeed(mcp.selectedMachHundredths/100,altitude) : mcp.selectedSpeedKt) : fmc?.targets?.speedKt,
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
  for(const name of ['b737:photo-needle-update','b737:photo-airspeed-update',
    'b737:standby-altimeter-sample','b737:flight-scenario-stopped','b737:mcp-afds-state','b737:avionics-data']){
    window.addEventListener(name,repaint);
  }
  window.addEventListener('b737:cockpit-mounted',mount);
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',mount,{once:true});
  else mount();
})();
