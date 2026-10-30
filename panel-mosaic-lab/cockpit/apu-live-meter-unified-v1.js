/* Single-owner, non-visual APU EGT instrument link. Source: Unified ISN ECU.
 * Never changes owner-approved EGT dial, needle sprite, center or switches.
 */
(function(root){
 'use strict';
 // The actual OH12 photographed EGT instrument is numbered 0..8 (°C×100),
 // clockwise from approximately 4 o'clock to 12 o'clock, NOT 0..1000°C.
 // Graduations were measured against the owner screenshot: (dial centre
 // 396,796 px; numbered label centres 1:(510,975), 2:(410,1008),
 // 3:(306,981), 4:(230,896), 5:(208,795), 6:(231,697),
 // 7:(306,630), 8:(399,589)). Unprinted 0 is extrapolated from 1/2.
 // The continuous, unwrapped CSS angles prevent discontinuities at 360°.
 // Values are photo-derived TRAINING calibration, not shaft certification.
 const EGT_C=[0,100,200,300,400,500,600,700,800];
 const EGT_DEG=[-241.5,-212.5,-183.8,-154.1,-121.1,-89.7,-59,-28.5,0.8];
 const MAX_C=800;
 let latest=null;
 const clamp=(x,lo,hi)=>Math.max(lo,Math.min(hi,x));
 function bearingForEGT(c){
  if(typeof c!=='number'||!Number.isFinite(c))throw Error('APU EGT must be finite °C');
  const v=clamp(c,0,MAX_C),i=Math.min(7,Math.floor(v/100));
  return EGT_DEG[i]+(EGT_DEG[i+1]-EGT_DEG[i])*(v-EGT_C[i])/100;
 }
 function project(apu){
  if(!apu||!Number.isFinite(apu.egtC))return null;
  return {phase:apu.phase,egtC:apu.egtC,angleDeg:bearingForEGT(apu.egtC),
   rpmPct:apu.rpmPct,generatorReady:apu.generator?.ready===true,
   voltsV:apu.generator?.voltageV??0,frequencyHz:apu.generator?.frequencyHz??0,
   sourceAmpsA:apu.generator?.currentEstimatedA??0,
   fuel:apu.fuelPath||null,quality:'APU_EGT_OH12_PHOTO_GRADUATIONS_0_TO_8_X100_TRAINING'};
 }
 function paint(apu){
  const reading=project(apu);if(!reading)return false;
  latest=reading;
  const needle=root.B737UnifiedApuEgtNeedle;
  if(!needle?.setAngle)return false;
  needle.setAngle(reading.angleDeg);return true;
 }
 root.addEventListener('b737:unified-ecu-observation',event=>paint(event.detail?.apu));
 root.addEventListener('b737:electrical-owner-ready',()=>{
  paint(root.B737ISNCockpitV1?.getECUState?.()?.apu);
 });
 root.addEventListener('b737:cockpit-mounted',()=>{
  paint(latest||root.B737ISNCockpitV1?.getECUState?.()?.apu);
 });
 root.B737APULiveMetersV1=Object.freeze({bearingForEGT,EGT_C:Object.freeze(EGT_C),EGT_DEG:Object.freeze(EGT_DEG),project,
  snapshot:()=>latest?JSON.parse(JSON.stringify(latest)):null,refresh:()=>paint(root.B737ISNCockpitV1?.getECUState?.()?.apu)});
})(window);
