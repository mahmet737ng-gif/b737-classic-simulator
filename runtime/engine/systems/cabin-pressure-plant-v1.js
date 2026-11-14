/* Educational closed-loop cabin air plant for B737 Classic CPCS / DCPCS.
 * Separate from the FCOM-grounded controller state machines and from OH22 art.
 * First-principles ideal-gas pressure integration, with UNVERIFIED trainer
 * cabin volume, pack mass flow, leakage, outflow area and servo dynamics.
 * NEVER use for real aircraft calculations, QRH decisions or performance.
 */
(function(root,factory){'use strict';const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.B737CabinPressurePlantV1=api;})(typeof globalThis!=='undefined'?globalThis:null,function(){'use strict';
 const P0=101325,RGAS=287.05,TEMP_K=293.15,FT=0.3048,PSI=6894.757293168;
 const PARAMETERS=Object.freeze({cabinVolumeM3:220,packMassFlowKgS:0.62,maxValveAreaM2:0.006,leakAreaM2:0.00008,autoFullStrokeSeconds:24,manualFullStrokeSeconds:20,positiveReliefPsid:8.65,negativeReliefPsid:-0.5,maxCabinScheduleFt:8000,nominalCabinClimbFtMin:450,nominalCabinDescentFtMin:350});
 const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
 const finite=v=>typeof v==='number'&&Number.isFinite(v);
 function pressureAtFt(altFt){if(!finite(altFt))throw Error('Invalid aircraft pressure altitude');return P0*Math.pow(Math.max(0.04,1-altFt*FT/44330.77),5.25588);}
 function altitudeFromPressureFt(p){if(!finite(p)||p<=0)throw Error('Invalid cabin absolute pressure');return 44330.77/FT*(1-Math.pow(p/P0,1/5.25588));}
 function initial(options={}){
  const altitudeFt=finite(options.aircraftAltitudeFt)?options.aircraftAltitudeFt:0;
  return {schema:'b737-cabin-plant/1',timeMs:0,aircraftAltitudeFt:altitudeFt,pressurePa:pressureAtFt(altitudeFt),valveOpenFraction:1,cabinAltitudeFt:altitudeFt,cabinRateFtMin:0,targetCabinAltitudeFt:altitudeFt,packFlowKgS:0,lastMode:'GROUND_OPEN',source:'PROVISIONAL_IDEAL_GAS_TRAINER'};
 }
 function observe(state){
  if(!state||state.schema!=='b737-cabin-plant/1')throw Error('Invalid pressure plant state');
  const ambientPa=pressureAtFt(state.aircraftAltitudeFt);
  return {cabinAltitudeFt:state.cabinAltitudeFt,cabinRateFtMin:state.cabinRateFtMin,differentialPsid:(state.pressurePa-ambientPa)/PSI,
   cabinPressurePa:state.pressurePa,ambientPressurePa:ambientPa,valveOpenFraction:state.valveOpenFraction,
   targetCabinAltitudeFt:state.targetCabinAltitudeFt,packFlowKgS:state.packFlowKgS,
   status:'PROVISIONAL_TRAINING_PHYSICS_NOT_AIRCRAFT_VALIDATED'};
 }
 function targetFt(env,state){
  if(finite(env.cabinTargetFt))return clamp(env.cabinTargetFt,-1000,14000);
  if(env.onGround)return env.prepressurized?env.aircraftAltitudeFt-200:env.aircraftAltitudeFt;
  if(env.mode==='STBY'&&finite(env.standbyCabinAltitudeFt))return clamp(env.standbyCabinAltitudeFt,-1000,14000);
  const dest=finite(env.landingAltitudeFt)?env.landingAltitudeFt:0;
  return clamp(Math.max(dest,env.aircraftAltitudeFt*0.255),-1000,PARAMETERS.maxCabinScheduleFt);
 }
 function step(old,env={}){
  if(!old||old.schema!=='b737-cabin-plant/1')throw Error('Invalid pressure plant state');
  const ms=env.ms;
  if(!Number.isInteger(ms)||ms<0||ms>60000)throw Error('Invalid pressure integration period');
  const altitudeFt=finite(env.aircraftAltitudeFt)?env.aircraftAltitudeFt:old.aircraftAltitudeFt;
  if(!finite(altitudeFt)||altitudeFt< -2000||altitudeFt>60000)throw Error('Aircraft altitude outside trainer envelope');
  const s={...old,aircraftAltitudeFt:altitudeFt};
  if(ms===0)return s;
  const command=String(env.outflowCommand||'HOLD');
  const failed=/NO_AUTO_COMMAND|NO_ACTUATION|UNDETERMINED|HOLD_OR_UNDETERMINED/.test(command);
  const opening=/DRIVE_FULL_OPEN|SLOWLY_OPEN_FULL/.test(command);
  const prepress=/PREPRESS|MODULATE_TOWARD_CLOSE/.test(command);
  const manual=env.mode==='MAN'||env.mode==='MAN_AC'||env.mode==='MAN_DC';
  const hasPacks=env.packsAvailable!==false&&env.bleedAirAvailable!==false;
  const packs=hasPacks?clamp(finite(env.packMassFlowKgS)?env.packMassFlowKgS:PARAMETERS.packMassFlowKgS,0,2):0;
  const target=targetFt({...env,aircraftAltitudeFt:altitudeFt,prepressurized:prepress},s);
  s.targetCabinAltitudeFt=target;s.packFlowKgS=packs;s.lastMode=manual?'MAN':opening?'GROUND_OPEN':failed?'FAILED_HOLD':'AUTO';
  const n=Math.max(1,Math.ceil(ms/250)),dt=ms/n/1000;
  let previousAlt=old.cabinAltitudeFt;
  for(let k=0;k<n;k++){
   const ambient=pressureAtFt(altitudeFt),rho=clamp(s.pressurePa/(RGAS*TEMP_K),0.1,1.5);
   const delta=s.pressurePa-ambient;
   // A reversible opening allows pressure equalization, including descending
   // flight when outside pressure exceeds cabin pressure.
   const flowAtFull=PARAMETERS.maxValveAreaM2*Math.sqrt(2*rho*Math.max(0,delta));
   let demanded=s.valveOpenFraction;
   if(opening)demanded=1;
   else if(manual){
    if(command==='OPEN')demanded=1;
    if(command==='CLOSE')demanded=0;
   }else if(!failed){
    const currentAlt=altitudeFromPressureFt(s.pressurePa);
    const desiredRate=clamp((target-currentAlt)*0.22,-PARAMETERS.nominalCabinDescentFtMin,PARAMETERS.nominalCabinClimbFtMin);
    const pressurePerFt=-s.pressurePa*5.25588*FT/(44330.77*(Math.max(0.04,1-currentAlt*FT/44330.77)));
    const desiredDpdt=pressurePerFt*desiredRate/60;
    const desiredOutflow=packs-desiredDpdt*PARAMETERS.cabinVolumeM3/(RGAS*TEMP_K);
    demanded=flowAtFull>0.015?clamp(desiredOutflow/flowAtFull,0,1):0;
    if(env.onGround&&!prepress)demanded=1;
   }
   const motorRate=dt/(manual?PARAMETERS.manualFullStrokeSeconds:PARAMETERS.autoFullStrokeSeconds);
   s.valveOpenFraction=clamp(s.valveOpenFraction+clamp(demanded-s.valveOpenFraction,-motorRate,motorRate),0,1);
   const area=PARAMETERS.leakAreaM2+PARAMETERS.maxValveAreaM2*s.valveOpenFraction;
   const massRate=area*Math.sqrt(2*rho*Math.abs(delta))*(delta>=0?1:-1);
   const dpdt=(packs-massRate)*(RGAS*TEMP_K)/PARAMETERS.cabinVolumeM3;
   s.pressurePa=Math.max(5000,s.pressurePa+dpdt*dt);
   // Mechanical relief valves work passively, even when DCPCS/CPCS failed.
   s.pressurePa=Math.min(s.pressurePa,ambient+PARAMETERS.positiveReliefPsid*PSI);
   s.pressurePa=Math.max(s.pressurePa,ambient+PARAMETERS.negativeReliefPsid*PSI);
  }
  s.timeMs+=ms;s.cabinAltitudeFt=altitudeFromPressureFt(s.pressurePa);
  s.cabinRateFtMin=(s.cabinAltitudeFt-previousAlt)*60000/ms;
  return s;
 }
 return Object.freeze({PARAMETERS,initial,step,observe,pressureAtFt,altitudeFromPressureFt});
});