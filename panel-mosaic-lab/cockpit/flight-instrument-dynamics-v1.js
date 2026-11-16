/* Unified flight dynamics -> CAPT/FO analog primary flight instruments.
 * Drives existing physical needle APIs (no competing SVG layer or pixel drift).
 * Standby barometric model is independent source, with diagnostic readout until
 * its center-panel mechanical needle registration is photographically verified.
 * Scenario feed is explicitly TRAINING, never an operational sensor.
 */
(function(win){
 'use strict';
 const Model=win.B737FlightDynamicsGaugesV1;
 if(!Model){win.console?.error('Flight dynamics gauge mapping dependency absent');return;}
 const doc=win.document,VERSION='UNIFIED_FLIGHT_GAUGE_BRIDGE_0001';
 const by=id=>doc.getElementById(id);
 let last=null,active=false,previous=null,latest=null,queued=false,paints=0,error=null;
 const stations=['captain','firstOfficer'];
 const clone=x=>x===null?null:JSON.parse(JSON.stringify(x));
 const validApi=()=>typeof win.B737UnifiedFlightNeedles?.setAngle==='function'&&
  typeof win.B737UnifiedAirspeedPointers?.setAirspeedKts==='function';
 function capture(){
  if(previous||!validApi())return;
  const fn=win.B737UnifiedFlightNeedles,air=win.B737UnifiedAirspeedPointers;
  previous={angles:fn.getAngles(),airspeed:air.getValues()};
 }
 function updateStatus(sample){
  const widgets={
   flightGaugeAltitude:sample?Math.round(sample.altitudeFt).toLocaleString('en-US')+' FT':'—',
   flightGaugeSpeed:sample?sample.indicatedSpeedKt.toFixed(1)+' KT':'—',
   flightGaugeVSI:sample?Math.round(sample.verticalSpeedFpm)+' FPM':'—',
   flightGaugeStandby:sample?Math.round(sample.standbyAltitudeFt).toLocaleString('en-US')+' FT':'—'
  };
  for(const [id,v] of Object.entries(widgets))if(by(id))by(id).textContent=v;
  const label=by('flightGaugeSource');
  if(label)label.textContent=sample?
   'SCENARIO ACTIVE · CAPT + FO NEEDLES · STBY ALT DATA LIVE':
   'SOURCE INACTIVE · INSTRUMENT VALUES NOT ASSERTED';
 }
 function addPanel(){
  const dlg=by('flightScenarioDialog');
  if(!dlg||by('flightGaugeBridgePanel'))return;
  const p=doc.createElement('section');
  p.id='flightGaugeBridgePanel';p.className='flight-gauge-bridge';
  p.innerHTML=`
    <div class="flight-heading">LIVE FLIGHT INSTRUMENT BUS · CAPT / F/O</div>
    <p id="flightGaugeSource" class="flight-gauge-source">SOURCE INACTIVE</p>
    <div class="flight-telemetry">
     <div><span>ALTIMETERS · MSL*</span><strong id="flightGaugeAltitude">—</strong></div>
     <div><span>AIRSPEED INDICATORS</span><strong id="flightGaugeSpeed">—</strong></div>
     <div><span>IVSI / VERTICAL SPEED</span><strong id="flightGaugeVSI">—</strong></div>
     <div><span>STANDBY ALTIMETER*</span><strong id="flightGaugeStandby">—</strong></div>
    </div>
    <p class="flight-sub">Primary CAPT and F/O altimeter, airspeed and IVSI pointers track the same simulated flight state. STANDBY ALT is independently published here; the physical standby dial photo has not yet been registered/calibrated. *MSL ≠ barometrically corrected indicated altitude until BARO is modeled. When IAS is below 60 kt the photographed ASI pointer stays at its lowest printed scale.</p>
  `;
  const anchor=by('flightAtPanel')||by('flightTelemetry');
  if(anchor)anchor.after(p);else dlg.append(p);
  updateStatus(last);
 }
 function draw(sample){
  if(!sample||!validApi())return false;
  capture();
  const fn=win.B737UnifiedFlightNeedles,asi=win.B737UnifiedAirspeedPointers;
  for(const station of stations){
   fn.setAngle(station,'altimeter',sample.altimeterNeedleDeg);
   fn.setAngle(station,'verticalSpeed',sample.ivsiNeedleDeg);
   asi.setAirspeedKts(sample.airspeedPointerKt,station);
  }
  last=sample;active=true;paints++;
  updateStatus(sample);
  win.dispatchEvent(new CustomEvent('b737:standby-altimeter-sample',{detail:{
   schema:'B737_STANDBY_ALTIMETER_SAMPLE_V1',
   quality:'TRAINING_SIMULATED',source:sample.source,
   altitudeFt:sample.standbyAltitudeFt,needleAngleDeg:sample.standbyNeedleDeg,
   standardBaroAssumption:true,physicalDialRegistration:'PENDING_VERIFIED_GEOMETRY'
  }}));
  return true;
 }
 function schedule(frame){
  latest=frame;
  if(queued)return;
  queued=true;
  win.requestAnimationFrame(()=>{
   queued=false;
   const current=latest;latest=null;
   if(!current)return;
   try{
    if(!draw(Model.sample(current)))error='GAUGE_NOT_READY';
    else error=null;
   }catch(e){error=String(e?.message||e);win.console?.warn('Flight gauge bridge',e);}
  });
 }
 function stopped(){
  latest=null;active=false;last=null;
  if(previous&&validApi()){
   const fn=win.B737UnifiedFlightNeedles,asi=win.B737UnifiedAirspeedPointers;
   try{
    for(const station of stations){
     for(const key of ['altimeter','verticalSpeed'])
      if(Number.isFinite(previous.angles?.[station]?.[key]))
       fn.setAngle(station,key,previous.angles[station][key]);
     if(Number.isFinite(previous.airspeed?.[station]?.airspeedKts))
      asi.setAirspeedKts(previous.airspeed[station].airspeedKts,station);
    }
   }catch(e){error='RESTORE: '+String(e?.message||e);}
  }
  previous=null;
  updateStatus(null);
  win.dispatchEvent(new CustomEvent('b737:standby-altimeter-sample',{detail:{
   schema:'B737_STANDBY_ALTIMETER_SAMPLE_V1',quality:'UNKNOWN',
   source:'SCENARIO_STOPPED',altitudeFt:null,physicalDialRegistration:'PENDING_VERIFIED_GEOMETRY'
  }}));
 }
 win.addEventListener('b737:flight-scenario-state',event=>{
  if(event.detail?.schema==='B737_FLIGHT_SCENARIO_STATE_V1')schedule(event.detail);
 });
 win.addEventListener('b737:flight-scenario-stopped',stopped);
 function mount(){
  addPanel();
  // An active scenario can predate this deferred bundle; attach without
  // requiring a second LOAD press.
  const scn=win.B737UnifiedFlightScenarioV1;
  if(scn?.getDiagnostics?.()?.active===true){
   const snap=scn.getState?.();if(snap)schedule(snap);
  }
 }
 win.addEventListener('b737:cockpit-mounted',mount);
 if(doc.readyState==='loading')doc.addEventListener('DOMContentLoaded',mount,{once:true});
 else mount();
 win.B737UnifiedFlightGaugeBridgeV1=Object.freeze({
  VERSION,getState:()=>({active,sample:clone(last),paints,error,previousCaptured:!!previous,
   registration:{altimeter:['captain','firstOfficer'],airspeed:['captain','firstOfficer'],
    ivsi:['captain','firstOfficer'],standbyAltimeter:'DATA_ONLY_PENDING_DIAL_REGISTRATION'}}),
  update:frame=>draw(Model.sample(frame)),stop:stopped,mount
 });
})(window);
