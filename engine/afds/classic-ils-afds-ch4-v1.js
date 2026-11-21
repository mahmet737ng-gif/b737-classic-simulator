/* B737 Classic CH4 ILS/VOR AFDS training geometry -> FCC evidence.
 * FCOM SHI 4.10.14-16, 4.20.20-29. Only models published training signals;
 * not certified radio propagation, FCC capture law, or autoland control.
 * LOC <= 0.5 dot, G/S <= 0.4 dot are documented capture bounds;
 * rates/gains/intercept predictions are openly instructor approximations.
 */
(function(root,factory){'use strict';const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.B737ClassicILSApproachCH4V1=api;
})(typeof globalThis!=='undefined'?globalThis:null,function(){
 'use strict';
 const VERSION='CLASSIC-ILS-AFDS-CH4-0001';
 const finite=Number.isFinite,clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
 const norm=x=>(x%360+360)%360;
 const diff=(a,b)=>((a-b+540)%360)-180;
 function radio(record){
  if(record?.quality!=='VALID'||!record.value)return null;
  return record.value;
 }
 function active(out){
  return out?.pending?.approach||out?.nav?.gs?'APP':
   out?.armed?.roll==='VOR/LOC'||out?.capture?.roll==='VOR_LOC'?'VOR_LOC':'OFF';
 }
 function evaluate({output,flight,snapshot,declinationDeg=null}={}){
  const blank={version:VERSION,valid:false,kind:'NONE',stationIdent:null,mode:active(output),
   navCaptureConfirmed:false,gsCaptureConfirmed:false,courseTrackValid:false,
   glideValid:false,dualIlsValid:false,reason:'NO_SIGNAL'};
  if(output?.power!==true||!flight||!snapshot)return {...blank,reason:'SOURCE_UNAVAILABLE'};
  const mode=active(output);
  const nav1=radio(snapshot['navigation.ils1']),nav2=radio(snapshot['navigation.ils2']);
  const vor1=radio(snapshot['navigation.vor1']),vor2=radio(snapshot['navigation.vor2']);
  const primary=output.modes?.autopilot==='CMD_B'?'FO':'CAPT';
  const selected=primary==='CAPT'?1:2;
  const ils=selected===1?nav1:nav2,vor=selected===1?vor1:vor2;
  const signal=ils||vor;
  if(!signal)return {...blank,mode,reason:'NAV_RECEIVER_NO_VALID_SIGNAL'};
  const ilsValid=!!ils&&ils.frontCourse===true&&
   finite(ils.localizerDots)&&finite(ils.courseTrueDeg);
  const vorValid=!!vor&&finite(vor.bearingDeg)&&
   finite(output.values?.[selected===1?'courseL':'courseR'])&&finite(declinationDeg);
  const kind=ilsValid?'ILS':vorValid?'VOR':'NONE';
  const valid=kind!=='NONE';
  const locDots=ilsValid?ils.localizerDots:vorValid?vor.deviationDots:null;
  const gsDots=ilsValid&&finite(ils.glideslopeDots)?ils.glideslopeDots:null;
  const crs=output.values?.[selected===1?'courseL':'courseR'];
  const vorCourse=vorValid?norm(crs+declinationDeg):null;
  const courseTrue=ilsValid?ils.courseTrueDeg:vorCourse;
  const courseMag=ilsValid&&finite(ils.courseMagDeg)?ils.courseMagDeg:crs;
  const selectedCourseAligned=ilsValid&&finite(declinationDeg)?
   Math.abs(diff(norm(crs+declinationDeg),courseTrue))<=15:vorValid;
  const lineValid=valid&&finite(locDots)&&selectedCourseAligned;
  const locCaptured=output.capture?.roll==='VOR_LOC'&&lineValid;
  const navCaptureConfirmed=mode!=='OFF'&&lineValid&&Math.abs(locDots)<=.5;
  const gsCaptureConfirmed=mode==='APP'&&locCaptured&&
   finite(gsDots)&&Math.abs(gsDots)<=.4;
  const dualIlsValid=ilsValid&&!!nav1&&!!nav2&&
   nav1.stationIdent===nav2.stationIdent&&
   nav1.tunedFrequencyMHz===nav2.tunedFrequencyMHz&&
   nav2.frontCourse===true&&finite(nav2.localizerDots)&&
   Math.abs(diff(norm(output.values.courseL+declinationDeg),
    norm(output.values.courseR+declinationDeg)))<=5&&
   output.course2Power===true;
  // Proportional track offset, no artificial FD deflection if signal absent.
  const correctedCourse=lineValid&&finite(courseTrue)?
   norm(courseTrue+clamp(locDots*5,-12,12)):null;
  const gsTrack=mode==='APP'&&locCaptured&&finite(gsDots);
  const gsKt=finite(flight.gsKt)?flight.gsKt:
   finite(flight.tasKt)?flight.tasKt:finite(flight.iasKt)?flight.iasKt:null;
  const glideDeg=ils?.glideDeg??3;
  const nominalVs=gsTrack&&finite(gsKt)?-gsKt*6076.11549/60*Math.tan(glideDeg*Math.PI/180):null;
  // Positive deviation represents aircraft above the GP in this radio model:
  // command stronger descent to return to the centerline.
  const gsVsFpm=finite(nominalVs)?clamp(nominalVs-gsDots*320,-2800,-150):null;
  return {version:VERSION,valid,kind,stationIdent:signal.stationIdent,mode,
   navCaptureConfirmed,gsCaptureConfirmed,dualIlsValid,
   locDeviationDots:finite(locDots)?locDots:null,gsDeviationDots:gsDots,
   gsBelowDots:finite(gsDots)?Math.max(0,-gsDots):null,
   courseTrackValid:locCaptured&&finite(correctedCourse),
   courseDeg:correctedCourse,glideValid:gsTrack&&finite(gsVsFpm),
   gsVsFpm,glideDeg,source:'TRAINING_NAV_AVIONICS',
   reason:!valid?'NAV_SIGNAL_UNVERIFIED':!selectedCourseAligned?'COURSE_MISMATCH':
    mode==='OFF'?'AFDS_NOT_ARMED':'GEOMETRY_VALID'};
 }
 return Object.freeze({VERSION,evaluate,active});
});
