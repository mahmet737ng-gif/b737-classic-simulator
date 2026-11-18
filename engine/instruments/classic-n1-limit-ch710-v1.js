/* B737 Classic N1 reference indicator and instructor-only performance estimate.
 * 737CL Sepehran FCOM SHI 7.10.2-4 (EIS), 7.10.14-15 (conventional).
 * Bug is YELLOW on the source image, not an orange painted needle.
 * FMC target MUST come from the FMC N1 LIMIT / TAKEOFF REF pages when
 * available. An assumed value is never marked "FCOM COMPUTED".
 * A provisional ISA/altitude temperature model is TRAINING ONLY, NOT AFM.
 */
(function(root,factory){'use strict';const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.B737ClassicN1LimitCH710V1=api;})(typeof globalThis!=='undefined'?globalThis:null,function(){'use strict';
 const VERSION='CH710-N1-LIMIT-0001',clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
 const finite=v=>typeof v==='number'&&Number.isFinite(v);
 const limit=({engineVariant='20K',pressureAltitudeFt=0,ambientC=15,
  antiIceOn=false,bleedsOn=false,deratePercent=0,fmcReferenceN1=null,
  manualPulled=false,manualN1=null,measuredN1=null}={})=>{
  if(!['20K','22K'].includes(engineVariant))throw RangeError('ENGINE_VARIANT');
  for(const [name,v] of Object.entries({pressureAltitudeFt,ambientC,deratePercent}))
   if(!finite(v))throw RangeError(name);
  if(pressureAltitudeFt< -2000||pressureAltitudeFt>50000||
   ambientC< -80||ambientC>65||deratePercent<0||deratePercent>25)
   throw RangeError('TRAINING_N1_CONTEXT');
  const isaC=15-0.0019812*Math.min(36089,Math.max(0,pressureAltitudeFt));
  const deltaIsa=ambientC-isaC;
  // Explicitly NON-CERTIFIED performance approximation. Keep maximum red
  // radial (operating limit) independent from reference N1 bug.
  const redRadialN1=104;
  const maxThrustReferenceN1=clamp((engineVariant==='22K'?100:97.5)-
   Math.max(0,deltaIsa)*.115-Math.max(0,pressureAltitudeFt)*.00019-
   (antiIceOn?1.25:0)-(bleedsOn?.65:0),72,redRadialN1);
  const estimatedTarget=clamp(maxThrustReferenceN1*(1-deratePercent/100),65,redRadialN1);
  const fmcValid=finite(fmcReferenceN1)&&fmcReferenceN1>=0&&fmcReferenceN1<=120;
  const manualValid=finite(manualN1)&&manualN1>=0&&manualN1<=120;
  const value=manualPulled?(manualValid?manualN1:null):
   (fmcValid?fmcReferenceN1:estimatedTarget);
  return Object.freeze({
   version:VERSION,manualPulled,manualSetIndication:manualPulled&&manualValid?manualN1:null,
   referenceN1:value,markerColor:'yellow',markerKind:'REFERENCE_N1_BUG',
   operatingRedRadialN1:redRadialN1,estimatedMaximumN1:maxThrustReferenceN1,
   autoThrustLimitN1:fmcValid?fmcReferenceN1:null,
   autoThrustAffectedByManual:false,
   source:manualPulled?(manualValid?'CREW_SELECTED':'MANUAL_VALUE_UNSET'):
    fmcValid?'FMC_N1_LIMIT_PAGE':'TRAINING_ESTIMATE_NOT_AFM',
   warning:finite(measuredN1)&&measuredN1>=redRadialN1
  });
 };
 return Object.freeze({VERSION,limit});
});
