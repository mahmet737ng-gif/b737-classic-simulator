/* Unified B737 Classic flight-to-gauge source mapping, instructor scenario only.
 * Stateless, testable; not a replacement for air data, baro compensation or
 * certified instrument calibration. Dial geometry based on existing photo
 * needle reference: upper pointer 0 deg, IVSI 0 FPM at 9 o'clock (-90deg).
 */
(function(root,factory){'use strict';const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.B737FlightDynamicsGaugesV1=api;
})(typeof globalThis!=='undefined'?globalThis:null,function(){
 'use strict';
 const VERSION='FLIGHT_DYNAMICS_GAUGES_0001';
 const VSI_TICKS=Object.freeze([[0,0],[500,25],[1000,42],[2000,58],[4000,75],[6000,90]]);
 const clamp=(x,a,b)=>Math.min(b,Math.max(a,x));
 const finite=(x,a,b)=>typeof x==='number'&&Number.isFinite(x)&&x>=a&&x<=b;
 function altimeterAngle(ft){
  if(!finite(ft,-2000,65000))throw RangeError('ALTIMETER_ALTITUDE');
  // Hundred-foot needle, one clockwise revolution per 1000 ft.
  return ((ft%1000)+1000)%1000*360/1000;
 }
 function interpolate(x,points){
  const v=clamp(x,points[0][0],points.at(-1)[0]);
  for(let i=1;i<points.length;i++)if(v<=points[i][0]){
   const a=points[i-1],b=points[i];return a[1]+(v-a[0])/(b[0]-a[0])*(b[1]-a[1]);
  }
  return points.at(-1)[1];
 }
 function ivsiAngle(fpm){
  if(!finite(fpm,-10000,10000))throw RangeError('IVSI_FPM');
  return -90+Math.sign(fpm)*interpolate(Math.abs(fpm),VSI_TICKS);
 }
 function sample(frame){
  if(!frame||frame.schema!=='B737_FLIGHT_SCENARIO_STATE_V1'||
   !finite(frame.altitudeFt,-2000,65000)||!finite(frame.iasKt,0,450)||
   !finite(frame.vsFpm,-10000,10000))throw TypeError('INVALID_FLIGHT_INSTRUMENT_SOURCE');
  const altitudeFt=frame.altitudeFt,iasKt=frame.iasKt,vsFpm=frame.vsFpm;
  return Object.freeze({schema:VERSION,source:'UNIFIED_FLIGHT_SCENARIO',
   quality:'TRAINING_SIMULATED',revision:frame.revision,
   altitudeFt,standbyAltitudeFt:altitudeFt,indicatedSpeedKt:iasKt,verticalSpeedFpm:vsFpm,
   altimeterNeedleDeg:altimeterAngle(altitudeFt),standbyNeedleDeg:altimeterAngle(altitudeFt),
   ivsiNeedleDeg:ivsiAngle(vsFpm),
   airspeedPointerKt:clamp(iasKt,60,400),airspeedBelowScale:iasKt<60,
   note:'SIM MSL WITH STANDARD BARO ASSUMPTION; PHOTO NEEDLES UNCALIBRATED'});
 }
 return Object.freeze({VERSION,altimeterAngle,ivsiAngle,sample,VSI_TICKS});
});
