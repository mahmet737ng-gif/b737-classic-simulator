'use strict';
/* B737 Classic educational thrust scheduler: SURROGATE, NOT AFM DATA.
 * Mode limits and drag parameters are manually tunable. No real-world use.
 * Pure CommonJS module without UI, state mutations or external dependencies.
 */
const MODEL = 'ISN_THRUST_SCHEDULE_V1_SIM_EST';
const STANDARD = Object.freeze({g:9.80665, rho0:1.225, p0:101325, R:287.05, T0:288.15,
 lapse:0.0065, kiasToMps:0.514444, ftToM:0.3048, wingAreaM2:105.4,
 cd0Clean:0.030, inducedDragFactor:0.055,
 ratedThrustN:20000*4.4482216153, densityThrustExponent:0.72,
 thrustToSpoolExponent:0.78});
// Training policy, NOT real CFM56-3 engine certification limits.
const MODES=Object.freeze({TO:97,GA:96.5,CON:94,CLB:92,CRZ:88});
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const round=(v,d=1)=>Number(v.toFixed(d));
const finite=(v)=>typeof v==='number'&&Number.isFinite(v);
function check(p){
 const inRange=(name,v,lo,hi)=>{if(!finite(v)||v<lo||v>hi)throw Error(name+' requires '+lo+'..'+hi);};
 inRange('pressureAltitudeFt',p.pressureAltitudeFt,-1000,36000);
 inRange('oatC',p.oatC,-70,55);
 inRange('iasKt',p.iasKt,100,340);
 if(p.targetIasKt!==null)inRange('targetIasKt',p.targetIasKt,100,340);
 if(p.accelTimeSec!==null)inRange('accelTimeSec',p.accelTimeSec,1,600);
 if(p.targetIasKt!==null&&p.targetIasKt!==p.iasKt&&p.accelTimeSec===null)throw Error('accelTimeSec required for IAS target change');
 inRange('massKg',p.massKg,30000,75000);
 inRange('verticalSpeedFpm',p.verticalSpeedFpm,-4500,4500);
 inRange('windSpeedKt',p.windSpeedKt,0,150);
 inRange('windFromDeg',p.windFromDeg,0,360);
 inRange('trackDeg',p.trackDeg,0,360);
 if(!['TO','GA','CON','CLB','CLB-1','CLB-2','CRZ'].includes(p.mode))throw Error('Invalid thrust mode');
 if(![0,1,5,15,30,40].includes(p.flaps))throw Error('Unknown flap setting');
 if(!Number.isInteger(p.operatingEngines)||![1,2].includes(p.operatingEngines))throw Error('One or two engines required');
 for(const k of ['gearDown','engineAntiIce','packsHigh','engineBleedOn','clb2Installed'])
  if(typeof p[k]!=='boolean')throw Error(k+' must be boolean');
 if(p.mode==='CLB-2'&&!p.clb2Installed)throw Error('CLB-2 requires installed option');
 if(p.weather!=='CLEAR'&&p.weather!=='RAIN'&&p.weather!=='SNOW'&&p.weather!=='ICING')throw Error('Unknown weather');
}
function defaults(overrides={}){return {
 pressureAltitudeFt:10000,oatC:-5,iasKt:240,massKg:55000,
 verticalSpeedFpm:0,targetIasKt:null,accelTimeSec:null,windSpeedKt:0,windFromDeg:0,trackDeg:90,
 mode:'CRZ',flaps:0,gearDown:false,operatingEngines:2,
 engineAntiIce:false,packsHigh:false,engineBleedOn:true,clb2Installed:false,
 weather:'CLEAR',...overrides};}
function air(pressureAltitudeFt,oatC){
 const h=pressureAltitudeFt*STANDARD.ftToM;
 const isaC=Math.max(-56.5,15-0.0065*h);
 const p=STANDARD.p0*Math.pow(1-STANDARD.lapse*h/STANDARD.T0,STANDARD.g/(STANDARD.R*STANDARD.lapse));
 const rho=p/(STANDARD.R*(oatC+273.15));
 const sigma=rho/STANDARD.rho0;
 return {isaC,rho,sigma,pressurePa:p};
}
function limits(p,isaC){
 // Small, explicitly assumed adjustments. Limit never claims AFM authority.
 const temperatureDeltaC=p.oatC-isaC;
 const correction=clamp(p.pressureAltitudeFt/5000*0.16,-.5,1.1)
  -clamp(temperatureDeltaC*0.033,-1.5,1.5)
  -(p.engineBleedOn?0.35:0)-(p.engineAntiIce?0.65:0)-(p.packsHigh?0.2:0);
 const nominal={};for(const [name,n1] of Object.entries(MODES))nominal[name]=round(clamp(n1+correction,35,97));
 const fade=clamp((15000-p.pressureAltitudeFt)/15000,0,1);
 nominal['CLB-1']=round(Math.max(35,nominal.CLB-3*fade));
 nominal['CLB-2']=p.clb2Installed?round(Math.max(35,nominal.CLB-6*fade)):null;
 return {valuePct:nominal[p.mode],allModesPct:nominal,temperatureDeltaC:round(temperatureDeltaC,1),
  estimatedCorrectionPct:round(correction,2),quality:'TRAINING_ONLY_N1_LIMIT'};
}
function compute(raw){
 const p=defaults(raw);check(p);
 const atm=air(p.pressureAltitudeFt,p.oatC);
 // Approximate IAS as equivalent airspeed; compressibility/CAS effects ignored.
 const iasMps=p.iasKt*STANDARD.kiasToMps;
 const tasMps=iasMps/Math.sqrt(atm.sigma);
 const tasKt=tasMps/STANDARD.kiasToMps;
 const relative=((p.windFromDeg-p.trackDeg)*Math.PI/180);
 const headwindKt=p.windSpeedKt*Math.cos(relative);
 const crosswindKt=p.windSpeedKt*Math.sin(relative);
 const trackHoldPossible=Math.abs(crosswindKt)<=tasKt;
 const gsAlongTrackKt=trackHoldPossible?Math.sqrt(Math.max(0,tasKt*tasKt-crosswindKt*crosswindKt))-headwindKt:null;
 const q=STANDARD.rho0*iasMps*iasMps/2;
 const qS=q*STANDARD.wingAreaM2;
 // Nominal parasite/induced drag model. Configuration deltas are training placeholders.
 const flapParasite={0:1,1:1.08,5:1.16,15:1.5,30:2.2,40:2.7}[p.flaps];
 const cd0=STANDARD.cd0Clean*flapParasite*(p.gearDown?1.4:1);
 const weightN=p.massKg*STANDARD.g;
 const cleanDragN=qS*cd0+STANDARD.inducedDragFactor*weightN*weightN/qS;
 const verticalMps=p.verticalSpeedFpm*0.00508;
 const climbForceN=weightN*verticalMps/Math.max(tasMps,1); // energy balance W * climb-rate / TAS.
 const targetIas=p.targetIasKt===null?p.iasKt:p.targetIasKt;
 const tasTargetMps=targetIas*STANDARD.kiasToMps/Math.sqrt(atm.sigma);
 const accelerationMps2=p.accelTimeSec===null?0:(tasTargetMps-tasMps)/p.accelTimeSec;
 const accelerationForceN=p.massKg*accelerationMps2;
 const requiredThrustN=Math.max(0,cleanDragN+climbForceN+accelerationForceN);
 const qTargetS=qS*Math.pow(targetIas/p.iasKt,2);
 const targetDragN=qTargetS*cd0+STANDARD.inducedDragFactor*weightN*weightN/qTargetS;
 const targetHoldThrustN=Math.max(0,targetDragN+weightN*verticalMps/Math.max(tasTargetMps,1));
 const perEngineN=requiredThrustN/p.operatingEngines;
 const maxThrustPerEngineN=STANDARD.ratedThrustN*Math.pow(atm.sigma,STANDARD.densityThrustExponent);
 const loadFraction=perEngineN/maxThrustPerEngineN;
 const idlePct=32; // airborne/high idle, synchronized with ISN envelope policy.
 const rawN1=idlePct+(97-idlePct)*Math.pow(Math.max(0,loadFraction),STANDARD.thrustToSpoolExponent);
 const requiredN1=round(clamp(rawN1,idlePct,110));
 const targetHoldLoad=(targetHoldThrustN/p.operatingEngines)/maxThrustPerEngineN;
 const targetHoldN1=round(clamp(idlePct+(97-idlePct)*Math.pow(targetHoldLoad,STANDARD.thrustToSpoolExponent),idlePct,110));
 const lim=limits(p,atm.isaC);
 const cap=lim.valuePct;
 const demanded=Math.min(cap,requiredN1);
 const throttleDemand=Math.pow(clamp((demanded-idlePct)/(97-idlePct),0,1),1/1.12);
 const unavailable=requiredN1>cap+0.05;
 const issues=[];
 if(unavailable)issues.push('REQUIRED_N1_EXCEEDS_SELECTED_SIM_LIMIT');
 if(p.weather==='ICING'&&!p.engineAntiIce)issues.push('ICING_SCENARIO_ANTIICE_NOT_SELECTED');
 if(p.flaps>0||p.gearDown)issues.push('CONFIGURATION_DRAG_IS_TRAINING_APPROXIMATION');
 if(p.operatingEngines===1)issues.push('OEI_THRUST_AND_FLIGHT_PATH_NOT_AIRCRAFT_PERFORMANCE_DATA');
 if(!trackHoldPossible||gsAlongTrackKt<0)issues.push('COURSE_TRACK_CANNOT_BE_MAINTAINED_IN_WIND');
 const cr= {origin:MODEL,quality:'SIM_ESTIMATE_NOT_AFM',inputs:p,
  atmosphere:{isaC:round(atm.isaC,1),deltaIsaC:lim.temperatureDeltaC,sigma:round(atm.sigma,3),
   densityKgM3:round(atm.rho,3)},
  navigation:{tasKt:round(tasKt),headwindKt:round(headwindKt),crosswindKt:round(crosswindKt),
   groundSpeedKt:gsAlongTrackKt===null?null:round(gsAlongTrackKt),trackHoldPossible,targetTasKt:round(tasTargetMps/STANDARD.kiasToMps)},
  limits:{selectedMode:p.mode,n1LimitPct:cap,allModesN1Pct:lim.allModesPct,
   estimatedCorrectionPct:lim.estimatedCorrectionPct},
  required:{n1RequiredPct:requiredN1,n1HoldAtTargetPct:targetHoldN1,accelerationMps2:round(accelerationMps2,3),
   accelerationForceKN:round(accelerationForceN/1000),thrustRequiredTotalKN:round(requiredThrustN/1000),
   thrustRequiredPerEngineKN:round(perEngineN/1000),
   availableReferencePerEngineKN:round(maxThrustPerEngineN/1000)},
  command:{n1CommandPct:round(demanded),normalizedThrottle:round(throttleDemand,4),
   speedDemand:targetIas===p.iasKt?'HOLD_IAS':'TARGET_IAS_WITH_ACCEL_HORIZON',
   withinSelectedLimit:!unavailable},flags:issues};
 return Object.freeze(cr);
}
module.exports=Object.freeze({MODEL,STANDARD,MODES,defaults,air,limits,compute});
