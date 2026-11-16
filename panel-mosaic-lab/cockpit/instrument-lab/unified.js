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
  let standby, queued=false;
  function mountGauge(station,kind,piece,width,height,x,y,radius){
    const key=`${station}:${kind}`;
    const host=document.querySelector(`.texture-piece[data-piece="${piece}"]`);
    if(!host||gauges.get(key)?.canvas.parentNode===host) return;
    const gauge=photos.createGauge(host,kind,{label:`${station} ${kind}`});
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
      standby=photos.createGauge(slot,'standby',{label:'Standby altimeter and IAS'});
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
      const base={...photos.defaults, ias:0, mach:0, altitude:0, standbyAltitude:0,
        altitudeBug:500, dme1:null, dme2:null, ivsiOff:false, bugs:[85,92,100,107]};
      for(const station of stations){
        const angles=needles?.[station];
        const speedsForStation=speeds?.[station];
        const state={...base,
          ias:live?.indicatedSpeedKt??speedsForStation?.airspeedKts??0,
          limit:speedsForStation?.vmoMmoKts??base.limit,
          altitude:live?.altitudeFt??0,
          vs:live?.verticalSpeedFpm??0,
          mach:Number.isFinite(scene?.tasKt)?Math.min(.95,scene.tasKt/660):0,
          hdg:scene?.headingMagDeg??scene?.headingDeg??0
        };
        gauges.get(station+':airspeed')?.render(state);
        gauges.get(station+':altimeter')?.render({...state,
          altitudeAngle:angles?.altimeter});
        gauges.get(station+':ivsi')?.render({...state,
          vsiAngle:live?undefined:angles?.verticalSpeed});
        gauges.get(station+':rmi')?.render({...state,
          bearingAngle1:angles?.rmi1,bearingAngle2:angles?.rmi2});
      }
      standby?.render({...base,ias:live?.indicatedSpeedKt??0,standbyAltitude:live?.standbyAltitudeFt??0});
    });
  }
  for(const name of ['b737:photo-needle-update','b737:photo-airspeed-update',
    'b737:standby-altimeter-sample','b737:flight-scenario-stopped']){
    window.addEventListener(name,repaint);
  }
  window.addEventListener('b737:cockpit-mounted',mount);
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',mount,{once:true});
  else mount();
})();
