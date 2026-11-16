/* Source-preserving visual interpolation for Unified photo gauges and EFIS.
 * Never changes avionics bus, flight physics, FCC modes, or failure flags.
 * One sampled state and one coalesced animation clock for all consumers.
 */
(function(root,factory){'use strict';const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.B737FlightDisplayMotionV1=api;
})(typeof globalThis!=='undefined'?globalThis:null,function(){
 'use strict';
 const VERSION='B737_FLIGHT_DISPLAY_MOTION_0001';
 const finite=n=>typeof n==='number'&&Number.isFinite(n);
 const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
 const settings=Object.freeze({
  iasKt:{tau:.18,rate:18},altitudeFt:{tau:.16,rate:200},
  vsFpm:{tau:.20,rate:650},pitchDeg:{tau:.11,rate:3.4},
  bankDeg:{tau:.11,rate:6},radioAltitudeFt:{tau:.17,rate:200},
  trueHeadingDeg:{tau:.13,rate:13},gsKt:{tau:.18,rate:18}
 });
 function stepValue(current,target,dt,{tau=.16,rate=200}={}){
  if(!finite(target))return current;
  if(!finite(current)||dt>1)return target;
  if(!finite(dt)||dt<=0)return current;
  const diff=target-current,change=diff*(-Math.expm1(-dt/tau));
  return current+clamp(change,-rate*dt,rate*dt);
 }
 function wrap360(a){return ((a%360)+360)%360;}
 function stepFrame(prev,raw,dt){
  if(!raw||raw.schema!=='B737_FLIGHT_SCENARIO_STATE_V1')return null;
  if(!prev||prev.icao!==raw.icao||raw.elapsedSec+1e-6<(prev.elapsedSec??0)||
     dt>1||raw.revision<prev.revision)
   return {...raw,presentationSource:VERSION};
  const next={...raw,presentationSource:VERSION};
  for(const [field,config]of Object.entries(settings)){
   if(!finite(raw[field]))continue;
   if(field==='trueHeadingDeg'){
    const previous=prev[field],delta=((raw[field]-previous+540)%360)-180;
    next[field]=wrap360(stepValue(0,delta,dt,config)+previous);
   }else next[field]=stepValue(prev[field],raw[field],dt,config);
  }
  return next;
 }
 return Object.freeze({VERSION,settings,stepValue,stepFrame});
});
