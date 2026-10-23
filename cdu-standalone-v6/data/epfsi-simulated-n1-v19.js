(function(root,factory){'use strict';const api=factory();
if(typeof module==='object'&&module.exports)module.exports=api;
if(root)root.EPFSI_ESTIMATED_N1_V19=api;
})(typeof window!=='undefined'?window:null,function(){'use strict';
/* TRAINER SURROGATE N1: owner explicitly accepts plausible non-AFM estimates.
 * Never identify output as AFM-calculated, observed engine N1 or A/T setpoint.
 * No proprietary Boeing tables / graphs are embedded.
 */
const AIRFRAME=Object.freeze({registration:'EP-FSI',serial:29340,engine:'CFM56-3B-1',ratingLbf:20000});
const BASE=Object.freeze({TAKEOFF:92,GO_AROUND:94,MAX_CONTINUOUS:90});
const HEURISTIC_VERSION='EPFSI_SIM_ESTIMATE_V19';
function round(v){return Math.round(v*10)/10;}
function clip(v,min,max){return Math.min(max,Math.max(min,v));}
function validAircraft(c){return c&&c.registration===AIRFRAME.registration&&c.serial===AIRFRAME.serial&&c.engine===AIRFRAME.engine&&c.ratingLbf===AIRFRAME.ratingLbf;}
function defaultLever(phase){return phase==='GO_AROUND'?98:phase==='TAKEOFF'?97:82;}
function estimate(context){
 const c=context||{};
 if(!validAircraft(c))return {status:'BLOCKED',reason:'AIRFRAME_MISMATCH',maxN1Pct:null,presentN1Pct:null,canDriveAutothrottle:false};
 const phase=Object.hasOwn(BASE,c.phase)?c.phase:'TAKEOFF';
 // Trained DISPLAY heuristics, not aerodynamics or AFM performance corrections:
 // The user's example permits approximate 88–95% on TO and go-around.
 // A missing pressure altitude is treated as an explicitly tagged display assumption.
 const altitudeAssumed=!Number.isFinite(c.pressureAltitudeFt);
 const h=altitudeAssumed?0:c.pressureAltitudeFt;
 const oatAssumed=!Number.isFinite(c.oatC);
 const temp=oatAssumed?15:c.oatC;
 const altitudeAdjustment=clip(h/5000*.25,-1,1.5);
 const temperatureAdjustment=clip((temp-15)*.02,-.7,.7);
 const bleedAdjustment=(c.engineBleedMode==='OFF'?-0.0:-.3);
 const packAdjustment=c.acPacks==='HIGH' ? -.2 : 0;
 const iceAdjustment=(!c.antiIceMode||c.antiIceMode==='OFF')?0:-.4;
 const raw=BASE[phase]-altitudeAdjustment-temperatureAdjustment+bleedAdjustment+packAdjustment+iceAdjustment;
 const limit=round(clip(raw,phase==='MAX_CONTINUOUS'?80:88,95));
 const lever=Number.isFinite(c.thrustLeverPct)?clip(c.thrustLeverPct,0,100):defaultLever(phase);
 const presentBase=20+(limit-20)*lever/100;
 const one=round(clip(presentBase,0,106));
 const two=round(clip(presentBase-.3,0,106));
 return Object.freeze({
  status:'SIM_ESTIMATE',provenance:'USER_ACCEPTED_APPROXIMATION_NOT_AFM',
  heuristicVersion:HEURISTIC_VERSION,phase,engine:'CFM56-3B-1 / 20K',
  weather:c.weatherMode||'ISA',bleed:c.engineBleedMode||'ON',antiIce:c.antiIceMode||'OFF',
  maxN1Pct:limit,presentN1Pct:Object.freeze({1:one,2:two}),
  sourceLabel:'EST',displayLabel:'SIM EST',altitudeAssumed,oatAssumed,
  thrustLeverPct:lever,canDriveAutothrottle:false,afmValidated:false,
  notForActualFlight:true
 });
}
function format(pct){return Number.isFinite(pct)?pct.toFixed(1):'---.-';}
return Object.freeze({AIRFRAME,BASE,HEURISTIC_VERSION,estimate,format});
});