/* Boeing 737 Classic FCOM §4.20.2–4.20.4 autopilot protection.
 * Variant-dependent selectors are normalized to named events.
 * Explicit loss evidence is required; UNKNOWN never means FAILED.
 * Only confirmed events may disengage an engaged CMD/CWS autopilot.
 */
(function(root,factory){'use strict';const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.B737FcomCh4APProtectionV1=api;
})(typeof globalThis!=='undefined'?globalThis:null,function(){
 'use strict';
 const VERSION='B737_FCOM_CH4_AP_PROTECTION_0001';
 const REASONS=Object.freeze([
  'CONTROL_WHEEL_AP_DISCONNECT','AP_DISENGAGE_BAR_DOWN',
  'AP_ENGAGE_PADDLE_OFF','ILLUMINATED_AP_ENGAGE_SWITCH',
  'TOGA_BELOW_2000_RA','DUAL_AP_TOGA_AFTER_TOUCHDOWN',
  'CONTROL_WHEEL_TRIM','STAB_TRIM_AUTOPILOT_CUTOUT',
  'AP_A_HYDRAULIC_PRESSURE_LOST','AP_B_HYDRAULIC_PRESSURE_LOST',
  'LEFT_IRS_FAILURE','RIGHT_IRS_FAILURE',
  'ELECTRICAL_POWER_LOST','CRITICAL_SENSOR_INPUT_LOST',
  'EFI_TRANSFER_REPOSITIONED','RADIO_ALT_FAILURE_AFTER_LOC_GS_2S'
 ]);
 const physical=new Set(['CONTROL_WHEEL_AP_DISCONNECT','AP_DISENGAGE_BAR_DOWN',
  'AP_ENGAGE_PADDLE_OFF','ILLUMINATED_AP_ENGAGE_SWITCH',
  'TOGA_BELOW_2000_RA','DUAL_AP_TOGA_AFTER_TOUCHDOWN',
  'CONTROL_WHEEL_TRIM','STAB_TRIM_AUTOPILOT_CUTOUT','EFI_TRANSFER_REPOSITIONED']);
 const finite=x=>typeof x==='number'&&Number.isFinite(x);
 function initial(){return {schema:VERSION,raFailureSinceMs:null,reason:null};}
 function evaluate(prev,mcp,input={},nowMs=0){
  if(prev?.schema!==VERSION||!finite(nowMs))throw TypeError('INVALID_PROTECTION_STATE');
  const next={...prev},ap=mcp?.modes?.autopilot||null;
  const engaged=/^(CMD|CWS)_[AB]$/.test(ap);
  if(!engaged){next.raFailureSinceMs=null;return {state:next,disengage:false,reason:null};}
  const checked=(reason,ok)=>ok===true?{state:{...next,reason},disengage:true,reason}:
   {state:next,disengage:false,reason:null};
  // Pilot hardware events must be directly observed and explicitly confirmed.
  if(input.hardware?.confirmed===true&&input.hardware?.source==='COCKPIT_HARDWARE'&&
     physical.has(input.hardware.reason)){
   const reason=input.hardware.reason;
   if(reason==='TOGA_BELOW_2000_RA'&&!(finite(input.radioAltitudeFt)&&input.radioAltitudeFt<2000))
    return checked(reason,false);
   if(reason==='DUAL_AP_TOGA_AFTER_TOUCHDOWN'&&input.touchdown!==true)return checked(reason,false);
   return checked(reason,true);
  }
  if(mcp?.power===false)return checked('ELECTRICAL_POWER_LOST',true);
  if(input.stabTrimAutopilotNormal===false&&input.stabTrimVerified===true)
   return checked('STAB_TRIM_AUTOPILOT_CUTOUT',true);
  if(input.hydraulicsVerified===true){
   if(ap.endsWith('_A')&&input.hydraulicAAvailable===false)
    return checked('AP_A_HYDRAULIC_PRESSURE_LOST',true);
   if(ap.endsWith('_B')&&input.hydraulicBAvailable===false)
    return checked('AP_B_HYDRAULIC_PRESSURE_LOST',true);
  }
  if(input.irsVerified===true){
   if(input.leftIrsFault===true)return checked('LEFT_IRS_FAILURE',true);
   if(input.rightIrsFault===true)return checked('RIGHT_IRS_FAILURE',true);
  }
  if(input.criticalSensorFailureVerified===true&&input.criticalSensorFailed===true)
   return checked('CRITICAL_SENSOR_INPUT_LOST',true);
  // FCOM 4.20.4: with an inoperative RA, disconnect 2 s after LOC & GS
  // capture. Do not assume LOC/GS capture from APP mode selection alone.
  if(input.raFailureVerified===true&&input.radioAltimeterInoperative===true&&
     mcp.nav?.loc===true&&mcp.nav?.gs===true){
   if(next.raFailureSinceMs===null)next.raFailureSinceMs=nowMs;
   if(nowMs-next.raFailureSinceMs>=2000)
    return checked('RADIO_ALT_FAILURE_AFTER_LOC_GS_2S',true);
  }else next.raFailureSinceMs=null;
  return {state:next,disengage:false,reason:null};
 }
 return Object.freeze({VERSION,REASONS,initial,evaluate});
});
