'use strict';
/**
 * Project-owner HDG/STS display countdown policy (2026-10-28).
 *
 * IMPORTANT: Sepehran/B737CL FCOM 2020 chapter 11.10.16 describes a TEN-minute
 * ceiling. The project owner explicitly corrected the target simulation to a
 * SEVEN-minute ceiling. This function models the owner's required behavior,
 * not a verbatim statement from that revision of the FCOM.
 *
 * No simulator time, AC power, GPS data, or realignment state is fabricated.
 * This is an additive formatting/presentation boundary; it does not create an
 * IRS inertial engine and does not touch the owner-locked 13-cell renderer.
 */
const VALID_ALIGN_PHASES=Object.freeze(['ALIGNING','HIGH_LAT_ALIGNING']);
const ALIGNMENT_DISPLAY_CAP_MINUTES=7;

function cappedAlignmentMinutes(secondsRemaining){
  if(typeof secondsRemaining!=='number'||!Number.isFinite(secondsRemaining)||secondsRemaining<=0)return null;
  return Math.min(ALIGNMENT_DISPLAY_CAP_MINUTES,Math.ceil(secondsRemaining/60));
}

/**
 * Single selected IRS source only. ALL required state is explicit.
 *
 * @param {object} input
 * @param {'HDG/STS'|'PPOS'|'TK/GS'|'WIND'|'TEST'} input.displayMode
 * @param {'L'|'R'} input.selectedIRS
 * @param {{L: object,R: object}} input.irsStates
 * @param {boolean} [input.keyboardOverride]
 * @param {boolean} [input.displayTestActive]
 * @returns {{visible: boolean,value: number|null,text: string|null,source: string|null}}
 */
function getHDGStatusAlignmentTime(input){
  const hidden=Object.freeze({visible:false,value:null,text:null,source:null});
  if(!input||input.displayMode!=='HDG/STS')return hidden;
  if(input.keyboardOverride===true||input.displayTestActive===true)return hidden;
  if(input.selectedIRS!=='L'&&input.selectedIRS!=='R')return hidden;
  const irs=input.irsStates?.[input.selectedIRS];
  if(!irs)return hidden;
  // A lit ALIGN annunciator ALONE is insufficient. It can also be lit during
  // OFF shutdown or initial ATT, which must not show a navigation countdown.
  if(!VALID_ALIGN_PHASES.includes(irs.phase))return hidden;
  if(irs.powerAvailable!==true||irs.remainingTimeValid!==true)return hidden;
  // FCOM does not specify the small display's behavior for every motion/position
  // failure or 30-second fast realignment. Do not invent a value for those.
  if(irs.alignmentBlocked===true||irs.fastRealign===true||irs.fault===true)return hidden;
  const value=cappedAlignmentMinutes(irs.secondsRemaining);
  if(value===null)return hidden;
  return {visible:true,value,text:String(value),source:input.selectedIRS};
}

module.exports=Object.freeze({
  ALIGNMENT_DISPLAY_CAP_MINUTES,
  cappedAlignmentMinutes,
  getHDGStatusAlignmentTime
});
