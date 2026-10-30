/* Single-owner, non-visual APU EGT instrument link. Source: Unified ISN ECU.
 * Never changes owner-approved EGT dial, needle sprite, center or switches.
 */
(function(root){
 'use strict';
 // OH12 APU EGT is a clockwise-increasing arc: cold/0°C on the left,
 // higher EGT toward the right. The prior +127 -> -110 mapping ran CCW.
 // These are provisional training transfer angles, not a tick survey.
 const ZERO=-127,FULL_SCALE=127,MAX_C=1000;
 let latest=null;
 const clamp=(x,lo,hi)=>Math.max(lo,Math.min(hi,x));
 function bearingForEGT(c){
  if(typeof c!=='number'||!Number.isFinite(c))throw Error('APU EGT must be finite °C');
  // Clockwise (positive CSS/SVG rotation) from cold-left to hot-right,
  // 0..1000°C. Maintain the approved pointer artwork and pivot untouched.
  return ZERO+(FULL_SCALE-ZERO)*clamp(c,0,MAX_C)/MAX_C;
 }
 function project(apu){
  if(!apu||!Number.isFinite(apu.egtC))return null;
  return {phase:apu.phase,egtC:apu.egtC,angleDeg:bearingForEGT(apu.egtC),
   rpmPct:apu.rpmPct,generatorReady:apu.generator?.ready===true,
   voltsV:apu.generator?.voltageV??0,frequencyHz:apu.generator?.frequencyHz??0,
   sourceAmpsA:apu.generator?.currentEstimatedA??0,
   fuel:apu.fuelPath||null,quality:'APU_TRAINING_EGT_SWEEP_PROVISIONAL'};
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
 root.B737APULiveMetersV1=Object.freeze({bearingForEGT,project,
  snapshot:()=>latest?JSON.parse(JSON.stringify(latest)):null,refresh:()=>paint(root.B737ISNCockpitV1?.getECUState?.()?.apu)});
})(window);
