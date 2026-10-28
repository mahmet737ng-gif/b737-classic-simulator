(function(root,factory){'use strict';const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.B737IRSTrainerCoreV1=api;})(typeof window!=='undefined'?window:null,function(){'use strict';
/**
 * B737 Classic IRS procedure trainer — lightweight navigation and alignment
 * sandbox, NO real IRS sensor physics / no aircraft navigation certification.
 *
 * FCOM D6-27370-300/400/500-SHI 11.20.7-10 / SP.11.4-5:
 * - FMC POS INIT -> SET IRS POS (LSK 4R), or selected L/R ISDU PPOS
 *   hemisphere latitude ENT, hemisphere longitude ENT;
 * - full alignment stationary, normal ~10min; high latitude 17min;
 * - L/R independently powered, aligned, initialized and navigated;
 * - OFF, ALIGN, NAV, ATT are separate operating selections.
 * All actual interface art and the owner-approved 13-cell ISDU are LOCKED.
 *
 * The vehicle movement provider is the SIMULATOR, never the aircraft's real IRS.
 * Drift is explicitly an instructor-facing synthetic approximation, not FCOM
 * sensor performance data or a navigation reference for real flight.
 */
const getHDGStatusAlignmentTime=typeof module==='object'&&module.exports
 ?require('../contracts/irs-hdg-sts-seven-minute-v1.cjs').getHDGStatusAlignmentTime
 :function(input){
   const irs=input?.irsStates?.[input?.selectedIRS];
   if(input?.displayMode!=='HDG/STS'||!['L','R'].includes(input?.selectedIRS)||!irs||
       !['ALIGNING','HIGH_LAT_ALIGNING'].includes(irs.phase)||irs.powerAvailable!==true||
       irs.remainingTimeValid!==true||irs.alignmentBlocked||irs.fastRealign||irs.fault||input.keyboardOverride||input.displayTestActive||
       !Number.isFinite(irs.secondsRemaining)||irs.secondsRemaining<=0)return {visible:false,value:null,text:null,source:null};
   const value=Math.min(7,Math.ceil(irs.secondsRemaining/60));
   return {visible:true,value,text:String(value),source:input.selectedIRS};
 };
const R_NM=3440.065;
const DEG=Math.PI/180;
const SIDES=Object.freeze(['L','R']);
const MODES=Object.freeze(['OFF','ALIGN','NAV','ATT']);
const MAX_STEP=5;
const CAL=Object.freeze({
  normalAlignSeconds:600,
  highLatitudeAlignSeconds:1020,
  shutdownSeconds:30,
  powerTestSeconds:3.5,
  boundaryNormalLatitude:70.2,
  boundaryHighLatitude:78.25,
  // Owner training policy: >=50N must use OFF -> ALIGN; FCOM is 70d12m.
  northAlignHoldLatitude:50,
  originVerifyThresholdNm:4,
  defaultDriftRateNmPerHour:0.42,
  trainingSeparationTargetNm:1.0,
  // FCOM specifies flashing, not its frequency; 1Hz is training calibration.
  alignFlashPeriodSeconds:1
});
function finite(v){return typeof v==='number'&&Number.isFinite(v);}
function checkPosition(p){
 if(!p||!finite(p.lat)||!finite(p.lon)||Math.abs(p.lat)>90||Math.abs(p.lon)>180)throw new RangeError('Valid signed latitude/longitude required');
 return {lat:p.lat,lon:p.lon};
}
function longitude(lon){return (lon+540)%360-180;}
function move(position,trackDeg,distanceNm){
 const a=distanceNm/R_NM, lat1=position.lat*DEG,lon1=position.lon*DEG,t=trackDeg*DEG;
 const lat2=Math.asin(Math.max(-1,Math.min(1,Math.sin(lat1)*Math.cos(a)+Math.cos(lat1)*Math.sin(a)*Math.cos(t))));
 const lon2=lon1+Math.atan2(Math.sin(t)*Math.sin(a)*Math.cos(lat1),Math.cos(a)-Math.sin(lat1)*Math.sin(lat2));
 return {lat:lat2/DEG,lon:longitude(lon2/DEG)};
}
function offset(position,northNm,eastNm){
 const magnitude=Math.hypot(northNm,eastNm);
 return magnitude===0?{...position}:move(position,Math.atan2(eastNm,northNm)/DEG,magnitude);
}
function distanceNm(a,b){
 const a1=a.lat*DEG,b1=b.lat*DEG,dLat=(b.lat-a.lat)*DEG,dLon=(b.lon-a.lon)*DEG;
 const h=Math.sin(dLat/2)**2+Math.cos(a1)*Math.cos(b1)*Math.sin(dLon/2)**2;
 return 2*R_NM*Math.asin(Math.min(1,Math.sqrt(h)));
}
function parseCoordinate(text,kind){
 const raw=String(text||'').toUpperCase().replace(/\s|\./g,'');
 const pattern=kind==='lat'?/^([NS])(\d{2})(\d{2})(\d)$/:/^([EW])(\d{3})(\d{2})(\d)$/;
 const match=raw.match(pattern);
 if(!match)throw new RangeError(kind==='lat'?'Latitude format NDDMMm / SDDMMm':'Longitude format EDDDMMm / WDDDMMm');
 const deg=Number(match[2]),mins=Number(match[3])+Number(match[4])/10;
 const limit=kind==='lat'?90:180;
 if(mins>=60||deg>limit||(deg===limit&&mins!==0))throw new RangeError('Coordinate degrees or minutes out of range');
 const sign=match[1]==='S'||match[1]==='W'?-1:1;
 return sign*(deg+mins/60);
}
function parseFmcPosition(text){
 const raw=String(text||'').toUpperCase().trim();
 // FMC scratchpad accepts compact, separated and decimal variants alike.
 // Examples: N35395E051254 / N3539.5 E05125.4 / N35395/E051254.
 const joined=raw.replace(/[\s/,]+/g,'');
 const match=joined.match(/^([NS]\d{4}\.?\d)([EW]\d{5}\.?\d)$/);
 if(!match)throw new RangeError('Expected NDDMMm EDDDMMm coordinates');
 return checkPosition({lat:parseCoordinate(match[1],'lat'),lon:parseCoordinate(match[2],'lon')});
}
function unit(id){
 return {id,mode:'OFF',phase:'OFF',powered:false,
  initialized:false,entrySource:null,entryPending:{lat:null,lon:null},enteredPosition:null,
  position:null,basePosition:null,alignmentElapsedSec:0,alignmentDurationSec:CAL.normalAlignSeconds,powerTestElapsedSec:0,
  valid:false,lastWarning:null,groundSpeedKt:null,trueTrackDeg:null,trueHeadingDeg:null,
  altitudeFt:null,windFromDeg:null,windKt:null,northDriftNm:0,eastDriftNm:0,
  navigationElapsedSec:0,alignFault:null,alignBlockCode:null,
  alignMessage:null,alignFlashElapsedSec:0,
  internalChecks:{storedPositionConsistent:null,computedLatitudeConsistent:null},
  lastRejectedPosition:null,lastRejectReason:null,computedRejectCount:0};
}
function initialState(options={}){
 return {schema:'b737-classic.irs-trainer.v1',revision:0,
  config:{normalAlignSeconds:options.normalAlignSeconds??CAL.normalAlignSeconds,
   highLatitudeAlignSeconds:options.highLatitudeAlignSeconds??CAL.highLatitudeAlignSeconds,
   northAlignHoldLatitude:options.northAlignHoldLatitude??CAL.northAlignHoldLatitude,
   driftRateNmPerHour:options.driftRateNmPerHour??CAL.defaultDriftRateNmPerHour,
   // Post-Jan-1990 FCOM auto full restart is the training default.
   motionRecoveryPolicy:options.motionRecoveryPolicy??'AUTO_FULL_RESTART'},
  units:{L:unit('L'),R:unit('R')},events:[],referenceOnly:true};
}
function clone(s){
 if(s?.schema!=='b737-classic.irs-trainer.v1')throw new TypeError('Invalid IRS trainer state');
 return JSON.parse(JSON.stringify(s));
}
function get(s,side){
 if(!SIDES.includes(side))throw new RangeError('Selected IRS side must be L or R');
 return s.units[side];
}
function emit(s,side,type,detail=''){
 s.events.push({side,type,detail});
 if(s.events.length>120)s.events.shift();
}
function requiresAlignHold(latitude,config){
 // Project: 50N or above requires manual ALIGN hold. The published high
 // latitude rule below 70d12m SOUTH remains independently protected.
 return latitude>=config.northAlignHoldLatitude||latitude< -CAL.boundaryNormalLatitude;
}
function samePosition(a,b){
 return !!a&&!!b&&Math.abs(a.lat-b.lat)<1e-9&&Math.abs(a.lon-b.lon)<1e-9;
}
function blockAlignment(s,u,code,message,phase='WAIT_POSITION'){
 u.phase=phase;u.valid=false;u.alignBlockCode=code;u.alignMessage=message;
 if(code!==8){u.initialized=false;u.enteredPosition=null;u.entrySource=null;}
 u.alignFlashElapsedSec=0;
 emit(s,u.id,'IRS_ALIGN_FLASH',String(code).padStart(2,'0')+' '+message);
}
function clearAlignmentBlock(u){
 u.alignBlockCode=null;u.alignMessage=null;u.alignFlashElapsedSec=0;
}
function begin(u,config,mode){
 u.mode=mode;u.phase='SELFTEST';u.powerTestElapsedSec=0;u.valid=false;u.initialized=false;
 u.alignmentElapsedSec=0;u.alignmentDurationSec=config.normalAlignSeconds;
 u.alignStartMode=mode;
 u.enteredPosition=null;u.position=null;u.basePosition=null;u.entryPending={lat:null,lon:null};
 u.lastWarning=null;u.alignFault=null;clearAlignmentBlock(u);
 u.internalChecks={storedPositionConsistent:null,computedLatitudeConsistent:null};
 u.lastRejectedPosition=null;u.lastRejectReason=null;u.computedRejectCount=0;
 u.northDriftNm=0;u.eastDriftNm=0;
 u.navigationElapsedSec=0;
}
function writePosition(s,side,p,source,origin){
 const u=get(s,side),pos=checkPosition(p);
 if(!u.powered||!['SELFTEST','ALIGNING','ALIGN_READY','WAIT_POSITION','HIGH_LAT_READY','FAST_REALIGN'].includes(u.phase)){
  throw new Error('IRS position may be initialized only during alignment');
 }
 const lat=Math.abs(pos.lat);
 if(lat>CAL.boundaryHighLatitude)throw new RangeError('IRS alignment latitude beyond supported region');
 const checks=u.internalChecks||{};
 const repeat=samePosition(u.lastRejectedPosition,pos);
 // FCOM has internal checks but no published numeric comparison threshold
 // here. Only explicit trusted evidence can fail one; 4NM ORIGIN is a CDU
 // advisory, never evidence for a failed IRS internal comparison.
 if(checks.storedPositionConsistent===false&&
    !(repeat&&u.lastRejectReason==='STORED')){
   u.lastRejectedPosition=pos;u.lastRejectReason='STORED';
   blockAlignment(s,u,12,'ENTER IRS POS');return;
 }
 if(checks.computedLatitudeConsistent===false){
   u.computedRejectCount=repeat&&u.lastRejectReason==='COMPUTED'?u.computedRejectCount+1:1;
   u.lastRejectedPosition=pos;u.lastRejectReason='COMPUTED';
   if(u.computedRejectCount>=2){u.alignFault='INTERNAL_POSITION_CHECK_FAILURE';emit(s,side,'IRS_POSITION_CHECK_FAULT');}
   blockAlignment(s,u,4,'ENTER IRS POS');return;
 }
 u.enteredPosition=pos;u.initialized=true;u.entrySource=source;
 u.alignmentDurationSec=lat>CAL.boundaryNormalLatitude?s.config.highLatitudeAlignSeconds:s.config.normalAlignSeconds;
 u.lastWarning=null;u.alignFault=null;clearAlignmentBlock(u);
 u.lastRejectedPosition=null;u.lastRejectReason=null;u.computedRejectCount=0;
 // Between 50N and 70d12m N: 10min, but requires OFF->ALIGN and manual
 // NAV selection. Beyond 70d12m: published 17min high-lat procedure.
 if(requiresAlignHold(pos.lat,s.config)&&(u.mode!=='ALIGN'||u.alignStartMode!=='ALIGN')){
   u.phase='MODE_MISMATCH';u.valid=false;
   u.lastWarning='HIGH_LAT_SELECT_ALIGN';
   emit(s,side,'HIGH_LAT_MODE_REQUIRED');
   return;
 }
 // A late high-lat position may extend the timer after WAIT_POSITION; resume
 // timing rather than remaining indefinitely in the waiting phase.
 if(u.phase==='WAIT_POSITION'&&u.alignmentElapsedSec<u.alignmentDurationSec)u.phase='ALIGNING';
 if(origin&&distanceNm(pos,checkPosition(origin))>CAL.originVerifyThresholdNm)u.lastWarning='VERIFY POSITION';
 // A wrong-position internal comparison must be modeled separately; the >4NM
 // origin check is a CDU warning and must NOT falsely be treated as IRS fault.
 if(u.alignmentElapsedSec>=u.alignmentDurationSec)ready(s,u);
 emit(s,side,'IRS_POSITION_ACCEPTED',source);
}
function ready(s,u){
 if(!u.initialized||!u.enteredPosition)return;
 if(u.mode==='ALIGN'){
  u.phase=u.alignmentDurationSec>=s.config.highLatitudeAlignSeconds?'HIGH_LAT_READY':'ALIGN_READY';u.valid=false;emit(s,u.id,'READY_WAIT_NAV');
 }else{
  u.phase='NAV_READY';u.valid=true;u.basePosition={...u.enteredPosition};
  u.position={...u.enteredPosition};u.navigationElapsedSec=0;
  emit(s,u.id,'NAV_READY');
 }
}
function apply(state,cmd){
 const s=clone(state);
 if(!cmd||!cmd.type)throw new TypeError('IRS command with type required');
 if(cmd.type==='FMC_SET_IRS_POS'){
  const p=parseFmcPosition(cmd.position);
  const sides=cmd.sides||SIDES.filter(id=>{
   const u=s.units[id];
   return u.powered&&['SELFTEST','ALIGNING','ALIGN_READY','WAIT_POSITION','HIGH_LAT_READY','FAST_REALIGN'].includes(u.phase);
  });
  // FMC broadcast should initialize each ELIGIBLE IRS independently. If one
  // unit is OFF/failed, the other must still receive SET IRS POS.
  if(sides.length===0)throw new Error('No powered IRS is eligible for FMC position initialization');
  for(const id of sides)writePosition(s,id,p,'FMC',cmd.originPosition);
 }else{
  const u=get(s,cmd.side);
  switch(cmd.type){
   case 'POWER':{
    if(typeof cmd.available!=='boolean')throw new TypeError('Explicit true/false IRS power required');
    // Electrical bus sampling is level-triggered. A repeated identical feed
    // must not restart alignment or erase an already-entered FMC position.
    if(u.powered===cmd.available)break;
    u.powered=cmd.available;
    if(!u.powered){
      u.valid=false;u.position=null;u.basePosition=null;
      u.groundSpeedKt=null;u.trueTrackDeg=null;u.trueHeadingDeg=null;
      u.altitudeFt=null;u.windFromDeg=null;u.windKt=null;
      // OFF is a selector position, not an electrical fault. Actual loss
      // while OFF simply ends the 30s powered shutdown sequence.
      if(u.mode==='OFF'){
        u.phase='OFF';u.alignmentElapsedSec=0;
      }else{
        // Any uninterrupted-alignment guarantee is lost without power.
        // Do not reuse a stale initial position on power restoration.
        u.phase='POWER_LOST';u.alignmentElapsedSec=0;u.initialized=false;
        u.entrySource=null;u.entryPending={lat:null,lon:null};
        u.enteredPosition=null;u.powerTestElapsedSec=0;u.alignFault=null;
        clearAlignmentBlock(u);
      }
      emit(s,u.id,'POWER_LOST');
    }else{
      // The physical MSU selector remains where the crew left it. When AC
      // (or eligible backup DC) returns to a selected NAV/ALIGN IRS, restart
      // the initial ON DC self-test and the full alignment automatically.
      if(u.mode==='NAV'||u.mode==='ALIGN'){
        begin(u,s.config,u.mode);
        emit(s,u.id,'POWER_RESTORED_RESTART_ALIGN');
      }else if(u.mode==='ATT'){
        u.phase='ATT';u.valid=false;
      }else{
        u.phase='OFF';u.valid=false;
      }
      emit(s,u.id,'POWER_ON');
    }
    break;
   }
   case 'SELECT_MODE':{
    if(!MODES.includes(cmd.mode))throw new RangeError('Unknown IRS mode');
    if(cmd.mode==='OFF'){u.mode='OFF';u.valid=false;u.phase=u.powered?'SHUTDOWN':'OFF';u.alignmentElapsedSec=0;emit(s,u.id,u.powered?'SHUTDOWN':'OFF');break;}
    if(!u.powered)throw new Error('IRS requires power for mode selection');
    if(cmd.mode==='ATT'){u.mode='ATT';u.phase='ATT';u.valid=false;emit(s,u.id,'ATT_ONLY');break;}
    if(u.mode==='OFF'||u.phase==='OFF'||u.phase==='SHUTDOWN'||u.phase==='POWER_LOST'){
      begin(u,s.config,cmd.mode);emit(s,u.id,'START_ALIGN');
    }else if(cmd.mode==='NAV'){
      // Keep the physical selector on ALIGN for an entered >=50N airport
      // until alignment is complete and position validity is established.
      if(u.mode==='ALIGN'&&u.enteredPosition&&
         requiresAlignHold(u.enteredPosition.lat,s.config)&&
         (!u.initialized||u.alignmentElapsedSec<u.alignmentDurationSec||
          !['ALIGN_READY','HIGH_LAT_READY'].includes(u.phase))){
       throw new Error('HIGH_LAT_ALIGN_HOLD_REQUIRED: keep selector on ALIGN until complete');
      }
      u.mode='NAV';
      if(['HIGH_LAT_READY','ALIGN_READY'].includes(u.phase))ready(s,u);
    }else if(cmd.mode==='ALIGN'&&u.mode==='NAV'&&u.phase==='NAV_READY'){
      u.mode='ALIGN';u.phase='FAST_REALIGN';u.valid=false;u.alignmentElapsedSec=0;
      u.alignmentDurationSec=30;emit(s,u.id,'FAST_REALIGN');
    }else u.mode=cmd.mode;
    break;
   }
   case 'SET_ALIGNMENT_CHECKS':{
    // Instructor/telemetry evidence, not invented sensor comparison values.
    if(!u.powered||!['SELFTEST','ALIGNING','WAIT_POSITION','ALIGN_READY','HIGH_LAT_READY'].includes(u.phase))
     throw new Error('Alignment comparison evidence requires powered aligning IRS');
    if(!cmd.evidence||typeof cmd.evidence!=='object'||Array.isArray(cmd.evidence))
     throw new TypeError('Explicit alignment comparison evidence object required');
    const keys=['storedPositionConsistent','computedLatitudeConsistent'];
    if(!keys.some(k=>Object.prototype.hasOwnProperty.call(cmd.evidence,k)))
     throw new TypeError('No recognized IRS position comparison evidence');
    for(const key of keys)if(Object.prototype.hasOwnProperty.call(cmd.evidence,key)){
     const value=cmd.evidence[key];
     if(value!==true&&value!==false&&value!==null)
      throw new TypeError('IRS position evidence must be true, false or null');
     u.internalChecks[key]=value;
    }
    emit(s,u.id,'IRS_POSITION_CHECK_EVIDENCE');break;
   }
   case 'ISDU_LAT_ENT':{
    if(!u.powered||!['SELFTEST','ALIGNING','ALIGN_READY','WAIT_POSITION','HIGH_LAT_READY','FAST_REALIGN'].includes(u.phase))
      throw new Error('ISDU position entry requires selected powered IRS in ALIGN');
    u.entryPending.lat=parseCoordinate(cmd.value,'lat');
    emit(s,u.id,'ISDU_LAT_ACCEPTED');break;
   }
   case 'ISDU_LON_ENT':{
    u.entryPending.lon=parseCoordinate(cmd.value,'lon');
    if(u.entryPending.lat===null)throw new Error('Enter latitude before longitude');
    writePosition(s,u.id,{lat:u.entryPending.lat,lon:u.entryPending.lon},'ISDU',cmd.originPosition);
    break;
   }
   default:throw new RangeError('Unknown IRS command type '+cmd.type);
  }
 }
 s.revision++;return s;
}
function resolveMotion(frame){
 if(finite(frame.gsKt)&&finite(frame.trueTrackDeg)){
  if(frame.gsKt<0||frame.gsKt>750)throw new RangeError('Ground speed out of bounds');
  return {gsKt:frame.gsKt,trackDeg:((frame.trueTrackDeg%360)+360)%360,source:'GS_TRACK'};
 }
 if(finite(frame.tasKt)&&finite(frame.trueHeadingDeg)&&finite(frame.windFromDeg)&&finite(frame.windKt)){
  if(frame.tasKt<0||frame.tasKt>750||frame.windKt<0||frame.windKt>200)throw new RangeError('TAS or wind speed out of range');
  const hdg=frame.trueHeadingDeg*DEG,windTo=(frame.windFromDeg+180)*DEG;
  const north=frame.tasKt*Math.cos(hdg)+frame.windKt*Math.cos(windTo);
  const east=frame.tasKt*Math.sin(hdg)+frame.windKt*Math.sin(windTo);
  return {gsKt:Math.hypot(north,east),trackDeg:(Math.atan2(east,north)/DEG+360)%360,source:'TAS_HEADING_WIND'};
 }
 return null;
}
function tick(state,frame){
 const s=clone(state);
 const dt=frame?.dtSec;
 if(!finite(dt)||dt<=0||dt>MAX_STEP)throw new RangeError('IRS tick requires dtSec >0 and <=5; substep long frames');
 const movement=resolveMotion(frame);
 for(const side of SIDES){
  const u=s.units[side];
  if(!u.powered)continue;
  if(u.alignBlockCode!==null)
   u.alignFlashElapsedSec=(u.alignFlashElapsedSec+dt)%CAL.alignFlashPeriodSeconds;
  if(u.phase==='BLOCKED_MOVEMENT'){
   // Effectivity switch: older aircraft require OFF cycling. An automatic
   // full restart on stationary aircraft re-requests present position.
   if(frame.stationary===true&&s.config.motionRecoveryPolicy==='AUTO_FULL_RESTART'){
    u.phase='ALIGNING';u.alignmentElapsedSec=0;u.valid=false;
    u.initialized=false;u.enteredPosition=null;u.entrySource=null;
    u.entryPending={lat:null,lon:null};clearAlignmentBlock(u);
    emit(s,side,'IRS_MOTION_AUTO_FULL_REALIGN');
   }
   continue;
  }
  if(u.phase==='SHUTDOWN'){
   u.alignmentElapsedSec+=dt;
   if(u.alignmentElapsedSec>=CAL.shutdownSeconds){u.phase='OFF';u.position=null;u.valid=false;}
   continue;
  }
  if(u.phase==='SELFTEST'){
   u.powerTestElapsedSec+=dt;
   if(u.powerTestElapsedSec>=CAL.powerTestSeconds){
     u.phase='ALIGNING';
     const leftover=u.powerTestElapsedSec-CAL.powerTestSeconds;
     u.alignmentElapsedSec=frame.stationary===true?Math.max(0,leftover):0;
     if(frame.stationary!==true)blockAlignment(s,u,3,'IRS MOTION','BLOCKED_MOVEMENT');
     emit(s,side,'SELFTEST_COMPLETE');
   }
   continue;
  }
  if(['ALIGNING','FAST_REALIGN'].includes(u.phase)){
   if(frame.stationary!==true){blockAlignment(s,u,3,'IRS MOTION','BLOCKED_MOVEMENT');continue;}
   u.alignmentElapsedSec+=dt;
   if(u.alignmentElapsedSec>=u.alignmentDurationSec){
    if(!u.initialized){blockAlignment(s,u,8,'ENTER IRS POS');emit(s,side,'ENTER_IRS_POSITION');}
    else if(u.phase==='FAST_REALIGN'){if(u.mode==='NAV')ready(s,u);else{u.phase='ALIGN_READY';u.valid=false;emit(s,side,'FAST_REALIGN_READY_WAIT_NAV');}}
    else ready(s,u);
   }
   continue;
  }
  if(u.phase!=='NAV_READY'||u.mode!=='NAV'||!u.valid)continue;
  // Motion must be grounded in a VALID simulator frame. No motion is invented.
  if(frame.valid!==true||!movement){u.lastWarning='NAV_FRAME_MISSING';continue;}
  u.navigationElapsedSec+=dt;
  const distance=movement.gsKt*dt/3600;
  u.basePosition=move(u.basePosition,movement.trackDeg,distance);
  // Synthetic smooth independent drift (does NOT rewrite truth every tick).
  const sideSign=side==='L'?1:-1;
  const hours=u.navigationElapsedSec/3600;
  const b=s.config.driftRateNmPerHour;
  const northRate=b*(sideSign*.72+.20*Math.sin(hours*.85+(side==='L'?0.35:1.55)));
  const eastRate=b*(sideSign*.55+.22*Math.cos(hours*.72+(side==='L'?0.2:2.1)));
  u.northDriftNm+=northRate*dt/3600;
  u.eastDriftNm+=eastRate*dt/3600;
  u.position=offset(u.basePosition,u.northDriftNm,u.eastDriftNm);
  u.groundSpeedKt=movement.gsKt;u.trueTrackDeg=movement.trackDeg;
  u.trueHeadingDeg=finite(frame.trueHeadingDeg)?((frame.trueHeadingDeg%360)+360)%360:null;
  u.altitudeFt=finite(frame.altitudeFt)?frame.altitudeFt:null;
  u.windFromDeg=finite(frame.windFromDeg)?frame.windFromDeg:null;
  u.windKt=finite(frame.windKt)?frame.windKt:null;
  u.lastWarning=null;
 }
 s.revision++;return s;
}
function status(s,side){
 const u=get(s,side);
 const remaining=(u.phase==='ALIGNING'&&u.powered)
  ?Math.max(0,u.alignmentDurationSec-u.alignmentElapsedSec):null;
 const alignCommanded=u.powered&&['ALIGNING','WAIT_POSITION','HIGH_LAT_READY','ALIGN_READY',
  'FAST_REALIGN','SHUTDOWN','BLOCKED_MOVEMENT'].includes(u.phase);
 const flashing=alignCommanded&&u.alignBlockCode!==null;
 // Existing RED ZONE renderer already reads alignLamp on each render.
 const lit=alignCommanded&&(!flashing||u.alignFlashElapsedSec<CAL.alignFlashPeriodSeconds/2);
 return {
  id:side,mode:u.mode,phase:u.phase,powered:u.powered,
  onDcLamp:u.powered&&u.phase==='SELFTEST',
  alignLamp:lit,alignLampMode:!alignCommanded?'OFF':flashing?'FLASHING':'STEADY',
  alignLampFlashing:flashing,alignStatusCode:u.alignBlockCode,
  alignStatusText:u.alignBlockCode===null?null:String(u.alignBlockCode).padStart(2,'0'),
  cduMessage:u.alignMessage||(u.lastWarning==='VERIFY POSITION'?'VERIFY POSITION':null),
  faultLamp:u.powered&&u.alignFault!==null,
  positionValid:u.valid&&u.phase==='NAV_READY'&&!!u.position,
  position:u.valid&&u.phase==='NAV_READY'?u.position:null,
  gsKt:u.valid?u.groundSpeedKt:null,trueTrackDeg:u.valid?u.trueTrackDeg:null,
  trueHeadingDeg:u.valid?u.trueHeadingDeg:null,warning:u.lastWarning,
  alignSecondsRemaining:remaining,entrySource:u.entrySource,
  navDriftNm:Math.hypot(u.northDriftNm,u.eastDriftNm),
  trace:'SIMULATOR_REFERENCE_WITH_SYNTHETIC_IRS_DRIFT_NOT_REAL_NAVIGATION'
 };
}
function comparison(s){
 const L=status(s,'L'),R=status(s,'R');
 return {left:L,right:R,separationNm:L.positionValid&&R.positionValid?distanceNm(L.position,R.position):null,
  nominalTrainingToleranceNm:CAL.trainingSeparationTargetNm,
  note:'1 NM is an educational target, not a hard FCOM sensor limit or permanent offset'};
}
function hdgStsCountdown(s,selectedIRS){
 const selected=get(s,selectedIRS);
 // The existing HDG/STS renderer uses value as text: publish two digits
 // when an MRG alignment status code has priority over the minute timer.
 if(selected.powered&&selected.alignBlockCode!==null){
  const code=String(selected.alignBlockCode).padStart(2,'0');
  return {visible:true,value:code,text:code,source:selectedIRS,kind:'STATUS_CODE'};
 }
 const irsStates={};
 for(const id of SIDES){
  const x=s.units[id],out=status(s,id);
  irsStates[id]={phase:x.phase,powerAvailable:x.powered,remainingTimeValid:out.alignSecondsRemaining!==null,
    secondsRemaining:out.alignSecondsRemaining,alignmentBlocked:x.phase==='BLOCKED_MOVEMENT',
    fastRealign:x.phase==='FAST_REALIGN',fault:x.alignFault!==null};
 }
 return getHDGStatusAlignmentTime({displayMode:'HDG/STS',selectedIRS,irsStates});
}
return Object.freeze({CAL,initialState,apply,tick,status,comparison,hdgStsCountdown,
 parseCoordinate,parseFmcPosition,move,distanceNm,resolveMotion});

});
