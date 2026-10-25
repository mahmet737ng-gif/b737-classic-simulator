/* B737 Classic training-only N1 thrust planner, separate from AFM-certified values.
 * The physical model is deliberately approximate and supports future CDU N1 LIMIT
 * presentation without mutating the authoritative engine-start session.
 * All angles are TRUE; airspeed is KIAS (modeled as EAS at low subsonic Mach).
 */
(function(root,factory){'use strict';const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.B737ISNThrustPerformanceV1=api;})(typeof globalThis!=='undefined'?globalThis:null,function(){
 'use strict';
 const SCHEMA='b737-isn-thrust-planner/1';
 const ORIGIN='SIMULATION_APPROX_ONLY';
 const G=9.80665,R=287.05287,RHO0=1.225,T0=288.15,P0=101325,L=0.0065;
 const KTS_TO_MS=0.5144444444444445,FT_TO_M=0.3048;
 const CONFIG=Object.freeze({
  engineTakeoffRatingLbf:20000, wingAreaM2:105.4, cdZero:0.025, inducedDragFactor:0.05,
  n1ThrustExponent:0.43, thrustLapseExponent:0.70,
  // Reference limits and corrections are SIMULATION assumptions, not AFM limits.
  referenceN1:Object.freeze({TO:97,GA:96.5,CON:94,CLB:92,CRZ:88}),
  altitudeN1CorrectionPer1000Ft:0.08,temperatureN1CorrectionPerC:0.025,
  engineAntiIceN1Cost:1.0,wingAntiIceN1Cost:1.8,packsN1Cost:0.4
 });
 const VALID_MODES=Object.freeze(['TO','GA','CON','CLB','CLB-1','CLB-2','CRZ']);
 const num=x=>typeof x==='number'&&Number.isFinite(x);
 const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
 const rad=x=>x*Math.PI/180;
 const round=(v,p=2)=>Number(v.toFixed(p));
 function assertIn(name,value,min,max){if(!num(value)||value<min||value>max)throw Error(name+' must be in ['+min+','+max+']');}
 function atmosphere(pressureAltitudeFt,oatC){
  assertIn('pressureAltitudeFt',pressureAltitudeFt,-1000,40000);
  assertIn('oatC',oatC,-80,60);
  const h=pressureAltitudeFt*FT_TO_M;
  const isaK=T0-L*h;
  const p=P0*Math.pow(isaK/T0,G/(R*L));
  const actualK=oatC+273.15;
  const rho=p/(R*actualK);
  return {isaTemperatureC:isaK-273.15,isaDeviationC:oatC-(isaK-273.15),
   pressurePa:p,densityKgM3:rho,densityRatio:rho/RHO0};
 }
 function wind({windFromDeg=0,windSpeedKt=0,trackTrueDeg=0,tasKt}){
  assertIn('windFromDeg',windFromDeg,0,360);assertIn('windSpeedKt',windSpeedKt,0,250);
  assertIn('trackTrueDeg',trackTrueDeg,0,360);assertIn('tasKt',tasKt,0,700);
  const theta=rad(windFromDeg-trackTrueDeg);
  const headwindKt=windSpeedKt*Math.cos(theta);
  const crosswindKt=windSpeedKt*Math.sin(theta);
  const achievable=Math.abs(crosswindKt)<=tasKt;
  const along=achievable?Math.sqrt(Math.max(0,tasKt*tasKt-crosswindKt*crosswindKt)):null;
  return {headwindKt:round(headwindKt),tailwindKt:round(Math.max(0,-headwindKt)),
   crosswindKt:round(crosswindKt),groundSpeedKt:achievable?round(along-headwindKt):null,
   trackHoldPossible:achievable};
 }
 function ratings({pressureAltitudeFt=0,oatC=15,clb2Available=true}={}){
  const a=atmosphere(pressureAltitudeFt,oatC);
  if(typeof clb2Available!=='boolean')throw Error('clb2Available must be boolean');
  const correction=CONFIG.altitudeN1CorrectionPer1000Ft*Math.max(0,pressureAltitudeFt)/1000+
   CONFIG.temperatureN1CorrectionPerC*Math.max(0,a.isaDeviationC);
  const base={};
  for(const [name,n1] of Object.entries(CONFIG.referenceN1))base[name]=round(clamp(n1-correction,0,97));
  // FCOM 11.41.43: reduced climb washes out progressively by 15,000 ft.
  const fade=clamp((15000-pressureAltitudeFt)/15000,0,1);
  base['CLB-1']=round(base.CLB-3*fade);
  base['CLB-2']=clb2Available?round(base.CLB-6*fade):null;
  return {limitsN1Percent:base,clb2Available,
   reducedClimbAutoDeleteAbove15000Ft:pressureAltitudeFt>15000,
   rule:'TRAINING_N1_LIMIT_SURROGATE',atmosphere:a};
 }
 function resolveMode(mode,pressureAltitudeFt,clb2Available){
  if(!VALID_MODES.includes(mode))throw Error('Unsupported thrust mode');
  if(mode==='CLB-2'&&!clb2Available)throw Error('CLB-2 not installed');
  if(pressureAltitudeFt>15000&&['CLB-1','CLB-2'].includes(mode))return {mode:'CLB',autoCleared:true};
  return {mode,autoCleared:false};
 }
 function performance(input){
  if(!input||typeof input!=='object')throw Error('Input object required');
  const {pressureAltitudeFt,oatC,iasKt,weightKg,trackTrueDeg=0,
   windFromDeg=0,windSpeedKt=0,verticalSpeedFpm=0,
   mode='CRZ',operatingEngines=2,onGround=false,
   engineAntiIce=false,wingAntiIce=false,packsOn=true,
   targetIasKt=iasKt,accelTimeSec=null,clb2Available=true}=input;
  const a=atmosphere(pressureAltitudeFt,oatC);
  assertIn('iasKt',iasKt,100,360);
  assertIn('weightKg',weightKg,35000,80000);
  assertIn('verticalSpeedFpm',verticalSpeedFpm,-3500,5000);
  assertIn('targetIasKt',targetIasKt,100,360);
  if(accelTimeSec!==null)assertIn('accelTimeSec',accelTimeSec,1,600);
  if(targetIasKt!==iasKt&&accelTimeSec===null)throw Error('Acceleration time is required when target speed differs');
  if(![1,2].includes(operatingEngines))throw Error('operatingEngines must be 1 or 2');
  for(const [k,v] of Object.entries({onGround,engineAntiIce,wingAntiIce,packsOn}))if(typeof v!=='boolean')throw Error(k+' must be boolean');
  const ratingsTable=ratings({pressureAltitudeFt,oatC,clb2Available});
  const selection=resolveMode(mode,pressureAltitudeFt,clb2Available);
  const limit=ratingsTable.limitsN1Percent[selection.mode];
  function dragAt(ias){
   const eas=ias*KTS_TO_MS, tasKt=ias/Math.sqrt(a.densityRatio),tas=tasKt*KTS_TO_MS;
   const q=0.5*RHO0*eas*eas,weightN=weightKg*G;
   const parasiteN=q*CONFIG.wingAreaM2*CONFIG.cdZero;
   const inducedN=CONFIG.inducedDragFactor*weightN*weightN/(q*CONFIG.wingAreaM2);
   return {tasKt,tasMps:tas,parasiteN,inducedN,dragN:parasiteN+inducedN};
  }
  const current=dragAt(iasKt),target=dragAt(targetIasKt);
  const maxThrustN=CONFIG.engineTakeoffRatingLbf*4.4482216152605*Math.pow(a.densityRatio,CONFIG.thrustLapseExponent);
  const climbN=weightKg*G*(verticalSpeedFpm*0.00508)/Math.max(current.tasMps,1);
  const accelerationMps2=accelTimeSec===null?0:
   ((targetIasKt-iasKt)*KTS_TO_MS/Math.sqrt(a.densityRatio))/accelTimeSec;
  const accelN=weightKg*accelerationMps2;
  const floorN1=onGround?22:32;
  const penalties=(engineAntiIce?CONFIG.engineAntiIceN1Cost:0)+
   (wingAntiIce?CONFIG.wingAntiIceN1Cost:0)+(packsOn?CONFIG.packsN1Cost:0);
  function thrustToN1(netForceN){
   const fraction=Math.max(0,netForceN/operatingEngines)/maxThrustN;
   return floorN1+(97-floorN1)*Math.pow(fraction,CONFIG.n1ThrustExponent)+penalties;
  }
  const neededNow=thrustToN1(Math.max(0,current.dragN+climbN+accelN));
  const holdTarget=thrustToN1(Math.max(0,target.dragN+weightKg*G*(verticalSpeedFpm*0.00508)/Math.max(target.tasMps,1)));
  const n1Command=clamp(neededNow,floorN1,limit);
  const speedDemandLimited=neededNow>limit+1e-8;
  const normalizedThrottle=clamp(Math.pow(clamp((n1Command-floorN1)/(97-floorN1),0,1),1/1.12),0,1);
  const wi=wind({windFromDeg,windSpeedKt,trackTrueDeg,tasKt:current.tasKt});
  return {schema:SCHEMA,origin:ORIGIN,quality:'TRAINING_APPROX_NOT_AFM',
   inputs:{pressureAltitudeFt,oatC,iasKt,targetIasKt,weightKg,verticalSpeedFpm,
    windFromDeg,windSpeedKt,trackTrueDeg,mode,operatingEngines,onGround,
    engineAntiIce,wingAntiIce,packsOn,accelTimeSec},
   atmosphere:{isaTemperatureC:round(a.isaTemperatureC,1),isaDeviationC:round(a.isaDeviationC,1),densityRatio:round(a.densityRatio,5)},
   speeds:{iasKt,tasKt:round(current.tasKt),groundSpeedKt:wi.groundSpeedKt,
    targetIasKt,targetTasKt:round(target.tasKt),...wi},
   mode:{requested:mode,active:selection.mode,autoCleared:selection.autoCleared,
    limitN1Percent:limit,limitTable:ratingsTable.limitsN1Percent},
   performance:{parasiteDragN:round(current.parasiteN),inducedDragN:round(current.inducedN),
    totalDragN:round(current.dragN),climbForceN:round(climbN),accelerationForceN:round(accelN),
    accelerationMps2:round(accelerationMps2,3),maxThrustPerOperatingEngineN:round(maxThrustN),
    requiredN1NowPercent:round(neededNow),requiredN1HoldTargetPercent:round(holdTarget),
    selectedN1CommandPercent:round(n1Command),throttleDemand:round(normalizedThrottle,5),
    atIdleLimit:n1Command===floorN1,thrustLimited:speedDemandLimited,
    marginN1Points:round(limit-neededNow)},
   notes:['WIND_CHANGES_GROUND_SPEED_NOT_AIR_MASS_RELATIVE_THRUST',
    'UNVERIFIED_DRAG_AND_N1_MAP_TRAINING_ONLY',
    'IAS_APPROXIMATED_AS_EAS_NOT_PITOT_COMPRESSIBILITY_CORRECTED',
    'NO_AFM_TAKEOFF_PERFORMANCE_OR_V_SPEED_VERIFICATION',
    'AIRSPEED_ACCELERATION_REQUIRES_EXPLICIT_TIME_HORIZON']};
 }
 function applyToTrainingChain(chain,device,input){
  if(!chain||typeof chain.get!=='function'||typeof chain.setThrottle!=='function')
   throw Error('ISN Chain with get and setThrottle required');
  if(!['engine1','engine2'].includes(device))throw Error('engine1 or engine2 required');
  // Recalculate: an untrusted N1/throttle payload must never be applied directly.
  const result=performance(input),s=chain.get(),eng=s.sources?.[device];
  if(s.phase?.[device]!=='RUNNING'||eng?.running!==true)
   throw Error('Engine is not RUNNING in the ISN start chain');
  if(eng.origin!=='TRAINING_SEQUENCE_SIMULATED')
   throw Error('Training planner cannot overwrite externally-owned running state');
  if(chain.flight?.onGround!==result.inputs.onGround)
   throw Error('onGround input differs from current ISN aircraft state');
  const engines=['engine1','engine2'].filter(id=>s.sources?.[id]?.running===true).length;
  if(engines!==result.inputs.operatingEngines)
   throw Error('Operating-engine count disagrees with ISN source state');
  chain.setThrottle(device,result.performance.throttleDemand);
  return {status:'THROTTLE_COMMAND_APPLIED_FOR_SIMULATION',device,
   selectedN1CommandPercent:result.performance.selectedN1CommandPercent,
   throttleDemand:result.performance.throttleDemand,mode:result.mode,
   thrustLimited:result.performance.thrustLimited,origin:ORIGIN};
 }
 return Object.freeze({SCHEMA,ORIGIN,CONFIG,VALID_MODES,atmosphere,wind,ratings,performance,applyToTrainingChain});
});
