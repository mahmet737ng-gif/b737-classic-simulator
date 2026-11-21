/* Unified Flight Scenario Core v1 — deterministic, offline training model.
 * NOT FCOM performance, not a certified aerodynamic model or navigation source.
 * Runway reference points are explicitly ARP-DERIVED PROVISIONAL until official
 * runway THR coordinates are imported. All bearings are TRUE, altitude MSL.
 */
(function(root,factory){
 'use strict';
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.B737FlightScenarioCoreV1=api;
})(typeof globalThis!=='undefined'?globalThis:null,function(){
 'use strict';
 const RAD=Math.PI/180, EARTH_NM=3440.065, KT_TO_MPS=.514444, FT_PER_NM=6076.1155;
 const Laws=(typeof globalThis==='object'?globalThis.B737FlightControlLawsV1:null)||
  (typeof module==='object'&&typeof require==='function'?
   require('./flight-control-laws-v1.js'):null);
 const Envelope=(typeof globalThis==='object'?globalThis.B737ClassicLowSpeedEnvelopeV1:null)||
  (typeof module==='object'&&typeof require==='function'?
   require('./classic-low-speed-envelope-v1.js'):null);
 const clamp=(n,a,b)=>Math.min(b,Math.max(a,n));
 const wrap=h=>(h%360+360)%360;
 const angle=(a,b)=>((wrap(b)-wrap(a)+540)%360)-180;
 const finite=(v,lo,hi,name)=>{const n=Number(v);if(!Number.isFinite(n)||n<lo||n>hi)throw RangeError(name);return n;};
 const AIRPORTS=Object.freeze({
  OIMM:Object.freeze({icao:'OIMM',name:'Mashhad / Shahid Hashemi Nejad',lat:36.2348333,lon:59.643,elevationFt:3263,defaultRunway:'31R',
   runways:Object.freeze({ '13L':134,'13R':134,'31L':314,'31R':314 })}),
  OIII:Object.freeze({icao:'OIII',name:'Tehran / Mehrabad',lat:35.6891667,lon:51.3143333,elevationFt:3962,defaultRunway:'29L',
   runways:Object.freeze({ '11L':109,'11R':109,'29L':289,'29R':289 })}),
  OISS:Object.freeze({icao:'OISS',name:'Shiraz / Shahid Dastghaib',lat:29.5391667,lon:52.5898333,elevationFt:4927,defaultRunway:'29L',
   runways:Object.freeze({ '11L':114,'11R':114,'29L':294,'29R':294 })})
 });
 const PRESETS=Object.freeze(['RUNWAY_READY','FINAL_5','FINAL_10','MANUAL']);
 function move(lat,lon,heading,distNm){
  const d=distNm/EARTH_NM,br=heading*RAD,la=lat*RAD,lo=lon*RAD;
  const lat2=Math.asin(Math.sin(la)*Math.cos(d)+Math.cos(la)*Math.sin(d)*Math.cos(br));
  const lon2=lo+Math.atan2(Math.sin(br)*Math.sin(d)*Math.cos(la),Math.cos(d)-Math.sin(la)*Math.sin(lat2));
  return {lat:lat2/RAD,lon:((lon2/RAD+540)%360)-180};
 }
 function distanceNm(a,b){
  const dLat=(b.lat-a.lat)*RAD,dLon=(b.lon-a.lon)*RAD,la=a.lat*RAD,lb=b.lat*RAD;
  const h=Math.sin(dLat/2)**2+Math.cos(la)*Math.cos(lb)*Math.sin(dLon/2)**2;
  return 2*EARTH_NM*Math.asin(Math.min(1,Math.sqrt(h)));
 }
 function bearing(a,b){
  const la=a.lat*RAD,lb=b.lat*RAD,dl=(b.lon-a.lon)*RAD;
  return wrap(Math.atan2(Math.sin(dl)*Math.cos(lb),Math.cos(la)*Math.sin(lb)-Math.sin(la)*Math.cos(lb)*Math.cos(dl))/RAD);
 }
 function runwayAnchor(icao,runway,thresholds){
  const airport=AIRPORTS[icao];if(!airport||!Object.hasOwn(airport.runways,runway))throw RangeError('UNKNOWN_RUNWAY');
  const verified=thresholds?.[icao]?.[runway];
  if(verified&&Number.isFinite(verified.lat)&&Number.isFinite(verified.lon)&&
      distanceNm(airport,verified)<8)
   return {lat:verified.lat,lon:verified.lon,quality:'VERIFIED_INPUT',source:verified.source||'TRAINER_IMPORTED_THR'};
  // ARP approximate. NOT a surveyed runway threshold: deliberately flagged.
  return {lat:airport.lat,lon:airport.lon,quality:'PROVISIONAL_ARP',source:'AIRPORT_REFERENCE_POINT_NOT_THR'};
 }
 function newScenario(config={},thresholds={}){
  const icao=String(config.airport||'OIMM').toUpperCase();
  const airport=AIRPORTS[icao];if(!airport)throw RangeError('UNKNOWN_AIRPORT');
  const runway=String(config.runway||airport.defaultRunway).toUpperCase();
  if(!Object.hasOwn(airport.runways,runway))throw RangeError('UNKNOWN_RUNWAY');
  const kind=String(config.preset||'RUNWAY_READY').toUpperCase();
  if(!PRESETS.includes(kind))throw RangeError('UNKNOWN_PRESET');
  const anchor=runwayAnchor(icao,runway,thresholds),hdg=airport.runways[runway];
  const finalNm=kind==='FINAL_5'?5:kind==='FINAL_10'?10:0;
  const isFinal=finalNm>0, manual=kind==='MANUAL';
  const ground=kind==='RUNWAY_READY'||(manual&&config.airborne===false);
  const latitude=manual&&config.lat!==undefined?finite(config.lat,-90,90,'LAT'):isFinal?move(anchor.lat,anchor.lon,wrap(hdg+180),finalNm).lat:anchor.lat;
  const longitude=manual&&config.lon!==undefined?finite(config.lon,-180,180,'LON'):isFinal?move(anchor.lat,anchor.lon,wrap(hdg+180),finalNm).lon:anchor.lon;
  const defaultAlt=airport.elevationFt+(isFinal?Math.tan(3*RAD)*finalNm*FT_PER_NM+50:ground?0:3000);
  const altitudeInput=manual&&config.altitudeFt!==undefined?finite(config.altitudeFt,-1000,65000,'ALTITUDE_FT'):defaultAlt;
  const alt=ground?airport.elevationFt:altitudeInput;
  if(alt<airport.elevationFt-.01)throw RangeError('ALTITUDE_BELOW_AIRPORT_SURFACE');
  const speedInput=manual&&config.speedKt!==undefined?finite(config.speedKt,0,450,'IAS_KT'):isFinal?(finalNm===5?155:170):ground?0:220;
  const speed=ground?0:speedInput;
  if(!ground&&speed<80)throw RangeError('AIRBORNE_IAS_BELOW_TRAINING_MINIMUM');
  const heading=manual&&config.headingDeg!==undefined?wrap(finite(config.headingDeg,0,360,'HEADING_DEG')):hdg;
  const bank=manual&&config.bankDeg!==undefined?finite(config.bankDeg,-30,30,'BANK_DEG'):0;
  const vsInput=manual&&config.vsFpm!==undefined?finite(config.vsFpm,-5000,5000,'VS_FPM'):isFinal?-speed*5.307:0;
  const vs=ground?0:vsInput;
  const guidance={lateralMode:manual&&bank!==0?'BANK':'HEADING',verticalMode:isFinal?'GLIDEPATH':'VS',
   headingDeg:heading,bankCommandDeg:bank,bankLimitDeg:25,altitudeFt:ground?airport.elevationFt+3000:alt,
   vsFpm:ground?1500:vs,speedKt:ground?150:speed};
  return {schema:'B737_FLIGHT_SCENARIO_STATE_V1',revision:1,
   icao,airportName:airport.name,runway,runwayHeadingTrueDeg:hdg,threshold:anchor,
   preset:kind,phase:ground?'GROUND_READY':isFinal?'FINAL_APPROACH':'AIRBORNE',
   airborne:!ground,groundRoll:false,lat:latitude,lon:longitude,
   altitudeFt:alt,radioAltitudeFt:Math.max(0,alt-airport.elevationFt),
   elevationFt:airport.elevationFt,iasKt:speed,tasKt:speed,
   gsKt:speed,trueHeadingDeg:heading,trueTrackDeg:heading,
   bankDeg:bank,pitchDeg:ground?0:vs>100?3:vs< -100?-2:2,vsFpm:ground?0:vs,
   flapLever:0,flapActual:0,slatsFull:false,autoSlatTrainingFraction:0,
   massKg:config.massKg===undefined?null:finite(config.massKg,30000,75000,'MASS_KG'),
   autoSlatRequest:false,aeroEnvelope:null,
   target:guidance,windFromDeg:0,windKt:0,elapsedSec:0,georefQuality:anchor.quality,
   notices:['TRAINING_SURROGATE','NO_FCOM_PERFORMANCE_CLAIM',anchor.source]};
 }
 function command(state,action){
  if(!state||state.schema!=='B737_FLIGHT_SCENARIO_STATE_V1')throw TypeError('STATE');
  if(!action||typeof action!=='object')throw TypeError('ACTION');
  const next={...state,target:{...state.target},revision:state.revision+1};
  switch(action.type){
   case 'HEADING':next.target.headingDeg=wrap(finite(action.value,0,360,'HEADING'));next.target.lateralMode='HEADING';break;
   case 'BANK':next.target.bankCommandDeg=finite(action.value,-30,30,'BANK');next.target.lateralMode='BANK';break;
   case 'BANK_LIMIT':next.target.bankLimitDeg=finite(action.value,10,30,'BANK_LIMIT');break;
   case 'ALTITUDE':next.target.altitudeFt=finite(action.value,0,65000,'ALTITUDE');next.target.verticalMode='ALTITUDE';break;
   case 'VS':next.target.vsFpm=finite(action.value,-5000,5000,'VS');next.target.verticalMode='VS';break;
   case 'SPEED':next.target.speedKt=finite(action.value,0,450,'SPEED');break;
   case 'AERO_CONFIG':
    if(!Envelope?.DETENTS?.includes(action.flapLever)||
      typeof action.slatsFull!=='boolean')throw RangeError('AERO_CONFIG_INPUT');
    next.flapLever=action.flapLever;
    next.flapActual=finite(action.flapActual,0,40,'ACTUAL_TE_FLAP');
    next.slatsFull=action.slatsFull;
    if(action.massKg!==undefined)
     next.massKg=action.massKg===null?null:finite(action.massKg,30000,75000,'MASS_KG');
    break;
   case 'MANUAL_HOLD':
    // Autopilot disconnect: preserve last observed bank and vertical motion.
    // Do not let obsolete HDG SEL / ALT targets keep steering the aircraft.
    next.target.lateralMode='BANK';
    next.target.bankCommandDeg=next.bankDeg;
    next.target.verticalMode='VS';
    next.target.vsFpm=next.vsFpm;
    next.target.flightControlOwner='MANUAL_TRIM_NO_AP';
    break;
   case 'WIND':next.windFromDeg=wrap(finite(action.direction,0,360,'WIND_DIR'));next.windKt=finite(action.speed,0,150,'WIND_KT');break;
   case 'TAKEOFF_ROLL':
    if(state.phase!=='GROUND_READY')throw Error('NOT_GROUND_READY');
    next.phase='TAKEOFF_ROLL';next.groundRoll=true;break;
   case 'STOP':
    if(state.airborne)throw Error('CANNOT_STOP_AIRBORNE');
    next.phase='GROUND_READY';next.groundRoll=false;next.iasKt=0;next.gsKt=0;next.vsFpm=0;break;
   case 'PAUSE':next.paused=!!action.value;break;
   default:throw RangeError('UNKNOWN_ACTION');
  }
  return next;
 }
 function step(state,dtSeconds,propulsion=null){
  const dt=finite(dtSeconds,0,2,'DT_SECONDS');
  if(state.paused||dt===0)return state;
  const s={...state,target:{...state.target},revision:state.revision+1,elapsedSec:state.elapsedSec+dt};
  const target=s.target;
  const assessAero=()=>Envelope?.evaluate({iasKt:s.iasKt,
   massKg:s.massKg,flapLever:s.flapLever,flapActual:s.flapActual,
   slatsFull:s.slatsFull,slatExtension:s.autoSlatTrainingFraction,
   bankDeg:s.bankDeg,airborne:s.airborne,
   autoSlatPreviouslyRequested:state.autoSlatRequest})??null;
  if(s.phase==='GROUND_READY'){
   s.airborne=false;s.iasKt=0;s.tasKt=0;s.gsKt=0;s.vsFpm=0;s.pitchDeg=0;s.bankDeg=0;
   s.autoSlatTrainingFraction=0;
   s.aeroEnvelope=assessAero();s.autoSlatRequest=false;
   s.radioAltitudeFt=Math.max(0,s.altitudeFt-s.elevationFt);return s;
  }
  const groundRoll=s.phase==='TAKEOFF_ROLL',landingRoll=s.phase==='LANDING_ROLL';
  const commandedSpeed=landingRoll?0:groundRoll?165:target.speedKt;
  const rate=groundRoll?2.4:landingRoll?1.8:s.iasKt<commandedSpeed?1.2:1;
  // Shared ISN-18 ECU N1 is the sole observed propulsion input. Do not
  // synthesize takeoff acceleration from the TO/GA label or a speed target.
  // The following coefficients are TRAINING approximations, not AFM data.
  const observed=propulsion?.valid===true&&Array.isArray(propulsion.engines)&&
   propulsion.engines.length===2&&propulsion.engines.every(e=>
    typeof e?.running==='boolean'&&Number.isFinite(e.n1Percent)&&
    e.n1Percent>=0&&e.n1Percent<=120);
  if(groundRoll&&observed){
   // At idle N1 there is no takeoff acceleration. Real observed engine
   // spool drives a bounded training surrogate with rolling/drag losses.
   const normalizedThrust=propulsion.engines.reduce((sum,e)=>
    sum+(e.running?Math.pow(clamp((e.n1Percent-22)/78,0,1),1.25):0),0)/2;
   const resistanceKtSec=.12+.000025*s.iasKt*s.iasKt;
   const accelerationKtSec=4.1*normalizedThrust-resistanceKtSec;
   s.iasKt=clamp(s.iasKt+accelerationKtSec*dt,0,450);
   s.propulsion={source:'ISN18_OBSERVED_N1_GROUND_TRAINING_PLANT',
    normalizedThrust,resistanceKtSec,accelerationKtSec};
  }else if(groundRoll){
   // An absent/invalid ECU observation cannot authorize synthetic thrust.
   const accelerationKtSec=-(.12+.000025*s.iasKt*s.iasKt);
   s.iasKt=Math.max(0,s.iasKt+accelerationKtSec*dt);
   s.propulsion={source:'NO_ENGINE_OBSERVATION_NO_SYNTHETIC_THRUST',
    accelerationKtSec};
  }else if(observed&&s.airborne&&!landingRoll){
   const n1Equivalent=32+propulsion.engines.reduce((sum,e)=>
    sum+(e.running?clamp(e.n1Percent-32,0,65):0),0)/2;
   const requiredN1=clamp(42+.105*s.iasKt+.0002*s.iasKt*s.iasKt+
    3*s.vsFpm/1000,32,92);
   const accelerationKtSec=clamp((n1Equivalent-requiredN1)*.065,-2,1.8);
   s.iasKt=clamp(s.iasKt+accelerationKtSec*dt,0,450);
   s.propulsion={source:'ISN18_OBSERVED_N1_TRAINING_PLANT',
    n1Equivalent,requiredN1,accelerationKtSec};
  }else{
   s.iasKt=Math.max(0,s.iasKt+clamp(commandedSpeed-s.iasKt,-rate*dt,rate*dt));
   s.propulsion={source:'KINEMATIC_TRAINING_FALLBACK'};
  }
  // Trainer aerodynamic drag responds to actual TE flap travel, not just lever
  // selection. This is NOT a calibrated performance/engine model.
  const preliminary=assessAero();
  if(preliminary&&s.airborne){
   const drag=preliminary.flapDragKtSec*Math.pow(s.iasKt/180,2)*dt;
   s.iasKt=Math.max(0,s.iasKt-drag);
   if(s.propulsion)s.propulsion.flapDragKtSec=preliminary.flapDragKtSec;
  }
  // Simplified TAS=IAS approximation; density/weight/thrust modeling is deferred.
  s.tasKt=s.iasKt;
  // One instructor-only Auto Slat response: request from the SAME
  // weight/flap/bank/shaker envelope, then rate-limit lift credit so neither
  // the IAS tape nor the airplane physics teleports when the request trips.
  // The frozen owner LE device remains authoritative for cockpit lamps.
  const envelopeDemand=assessAero();
  const requested=envelopeDemand?.autoSlatRequest===true&&s.airborne;
  const actualFull=s.slatsFull===true&&envelopeDemand?.autoSlatEligible===true;
  const nextSlatTarget=actualFull||requested?1:0;
  const slatSeconds=nextSlatTarget>state.autoSlatTrainingFraction?4:6;
  const previousFraction=Number.isFinite(state.autoSlatTrainingFraction)?
   state.autoSlatTrainingFraction:0;
  s.autoSlatTrainingFraction=clamp(previousFraction+
   clamp(nextSlatTarget-previousFraction,-dt/slatSeconds,dt/slatSeconds),0,1);
  if(actualFull)s.autoSlatTrainingFraction=1;
  s.aeroEnvelope=assessAero();
  s.autoSlatRequest=requested;
  if(groundRoll){
   s.pitchDeg=s.iasKt>=128?clamp((s.iasKt-128)*.65,0,9):0;
   if(s.iasKt>=145){
    s.airborne=true;s.groundRoll=false;s.phase='INITIAL_CLIMB';
    s.target.verticalMode='VS';s.target.vsFpm=1500;
   }
  }
  if(!s.airborne){
   s.bankDeg=0;s.vsFpm=0;s.altitudeFt=s.elevationFt;s.radioAltitudeFt=0;
  }else{
   let wantVS=target.vsFpm;
   if(target.verticalMode==='ALTITUDE'){
    const diff=target.altitudeFt-s.altitudeFt;
    wantVS=Math.abs(diff)<30?0:clamp(diff*2,-2500,2500);
   }else if(target.verticalMode==='GLIDEPATH'){
    const distance=distanceNm(s,s.threshold);
    const height=s.elevationFt+50+Math.tan(3*RAD)*distance*FT_PER_NM;
    wantVS=clamp(-Math.max(0,s.gsKt)*5.307+
     clamp((height-s.altitudeFt)*.8,-900,900),-2200,600);
   }
   const commanded={...target,verticalMode:'VS',vsFpm:wantVS};
   const control=Laws?.stepAttitude(s,commanded,dt);
   if(control){
    // Pitch, vertical response, and bank are one physical control chain.
    // Same pitch/bank targets are used by FCC flight-director bars.
    s.bankDeg=control.bankDeg;s.pitchDeg=control.pitchDeg;
    s.vsFpm=control.vsFpm;
    s.flightControl={source:'FCC_SHARED_TRAINING_CONTROL_LAWS',
     desiredBankDeg:control.desiredBankDeg,
     desiredPitchDeg:control.desiredPitchDeg,
     commandedBankDeg:control.commandedBankDeg,
     commandedPitchDeg:control.commandedPitchDeg,
     desiredVsFpm:control.desiredVsFpm};
   }else{
    // Fallback for isolated fixture environments without the new module.
    const limit=Number.isFinite(target.bankLimitDeg)?target.bankLimitDeg:25;
    const error=angle(s.trueHeadingDeg,target.headingDeg);
    const bank=target.lateralMode==='BANK'?target.bankCommandDeg:clamp(error*.65,-limit,limit);
    s.bankDeg+=clamp(bank-s.bankDeg,-3.2*dt,3.2*dt);
    const desiredPitch=clamp(2+Math.atan2(wantVS/60*.3048,Math.max(s.tasKt*KT_TO_MPS,35))/RAD,-10,15);
    s.pitchDeg+=clamp(desiredPitch-s.pitchDeg,-1.15*dt,1.15*dt);
    const actualVs=clamp(Math.tan((s.pitchDeg-2)*RAD)*Math.max(s.tasKt*KT_TO_MPS,35)*60/.3048,-5000,5000);
    s.vsFpm+=clamp(actualVs-s.vsFpm,-420*dt,420*dt);
   }
   // Bounded training disturbance. Positive bank is toward the heavier right wing.
   // The shared controller continues to apply its corrective bank command.
   const imbalance=propulsion?.fuelImbalanceKg;
   if(Number.isFinite(imbalance)){
    const rollBiasDegSec=clamp(imbalance/453*.12,-1.2,1.2);
    s.bankDeg=clamp(s.bankDeg+rollBiasDegSec*dt,-45,45);
    s.fuelBalance={imbalanceKg:imbalance,rollBiasDegSec,source:'TRAINING_LATERAL_FUEL_MASS'};
   }else delete s.fuelBalance;
   // Gravity coordinated-turn relation, using the RATE-LIMITED bank angle.
   const velocity=Math.max(s.tasKt*KT_TO_MPS,50);
   const turnDegPerSec=(9.80665*Math.tan(s.bankDeg*RAD)/velocity)/RAD;
   s.trueHeadingDeg=wrap(s.trueHeadingDeg+turnDegPerSec*dt);
   const oldAlt=s.altitudeFt;
   s.altitudeFt=Math.max(s.elevationFt,s.altitudeFt+s.vsFpm/60*dt);
   if(target.verticalMode==='ALTITUDE'&&
      (target.altitudeFt-oldAlt)*(target.altitudeFt-s.altitudeFt)<=0){
    s.altitudeFt=target.altitudeFt;s.vsFpm=0;
   }
   s.radioAltitudeFt=Math.max(0,s.altitudeFt-s.elevationFt);
   if(s.preset.startsWith('FINAL_')&&distanceNm(s,s.threshold)<.09&&s.radioAltitudeFt<80){
    s.phase='LANDING_ROLL';s.airborne=false;s.iasKt=Math.min(s.iasKt,145);
    s.vsFpm=0;s.altitudeFt=s.elevationFt;s.radioAltitudeFt=0;s.pitchDeg=0;s.bankDeg=0;
   }
  }
  const windTo=wrap(s.windFromDeg+180),heading=s.trueHeadingDeg;
  const speedEast=Math.sin(heading*RAD)*s.tasKt+Math.sin(windTo*RAD)*s.windKt;
  const speedNorth=Math.cos(heading*RAD)*s.tasKt+Math.cos(windTo*RAD)*s.windKt;
  s.gsKt=Math.max(0,Math.hypot(speedEast,speedNorth));
  s.trueTrackDeg=s.gsKt<.01?heading:wrap(Math.atan2(speedEast,speedNorth)/RAD);
  if(s.gsKt>0&&s.phase!=='GROUND_READY'){
   const next=move(s.lat,s.lon,s.trueTrackDeg,s.gsKt*dt/3600);
   s.lat=next.lat;s.lon=next.lon;
  }
  return s;
 }
 return Object.freeze({VERSION:'FLIGHT-SCENARIO-CORE-0001',
  AIRPORTS,PRESETS,newScenario,command,step,move,distanceNm,bearing,runwayAnchor,wrap,angle});
});
