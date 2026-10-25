/* ISN-09 to ISN-12 B737 Classic TRAINING runtime. Pure backend adapter.
 * FCOM system topology: 7.20.5; 7.20.7-9; 12.20.2, but fuel consumption,
 * values and dynamic flameout thresholds are simulator tuning only.
 * Never claim physical pump feeder, measured fuel pressure, or real N1 limits.
 */
(function(root,factory){'use strict';const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.B737ISN0912RuntimeV1=api;})(typeof globalThis!=='undefined'?globalThis:null,function(){
 'use strict';
 const SCHEMA='b737-isn-09-12/1';
 const SOURCE='TRAINING_FUEL_AND_ENGINE_MODEL';
 const IDS=['engine1','engine2'];
 const TANK=['main1','center','main2'];
 const cp=x=>JSON.parse(JSON.stringify(x));
 const round=x=>Math.round(x*1000)/1000;
 const finite=x=>typeof x==='number'&&Number.isFinite(x);
 const pumpNames=Object.freeze({main1:['fuel.main1FwdPump','fuel.main1AftPump'],
  main2:['fuel.main2FwdPump','fuel.main2AftPump'],center:['fuel.centerLeftPump','fuel.centerRightPump']});
 const approx=Object.freeze({apuFuelKgHr:110,initialFuelKg:{main1:3500,center:0,main2:3500},
  mainFuelPriority:'CENTER_BEFORE_MAIN',maxStepMs:1000});
 function checkedKg(x){if(!finite(x)||x<0||x>25000)throw Error('Fuel quantity must be finite kg between 0 and 25000');return x;}
 function anyPump(pumps,ids){
  const states=ids.map(id=>pumps?.[id]?.operating??null);
  if(states.includes(true))return true;
  return states.includes(null)?null:false;
 }
 class FuelNetwork{
  constructor({initialFuelKg=approx.initialFuelKg,allowSuctionTraining=false}={}){
   if(typeof allowSuctionTraining!=='boolean')throw Error('allowSuctionTraining boolean required');
   this.tanks={};for(const tank of TANK)this.tanks[tank]=checkedKg(initialFuelKg[tank]);
   this.initialFuelKg=cp(this.tanks);this.crossfeed='CLOSED';this.allowSuctionTraining=allowSuctionTraining;
   this.burnedKg={engine1:0,engine2:0,apu:0};this.events=[];
  }
  setTank(id,kg){if(!TANK.includes(id))throw Error('Unknown tank');this.tanks[id]=checkedKg(kg);}
  setCrossfeed(v){if(!['OPEN','CLOSED'].includes(v))throw Error('Crossfeed requires OPEN/CLOSED');this.crossfeed=v;}
  supply(engine,pumps,{pressureAltitudeFt=0,fuelStartLever='IDLE',fireSwitchPulled=false}={}){
   if(!IDS.includes(engine))throw Error('Unknown engine');
   if(!finite(pressureAltitudeFt))throw Error('Pressure altitude required');
   if(!['IDLE','CUTOFF'].includes(fuelStartLever))throw Error('Fuel lever required');
   if(typeof fireSwitchPulled!=='boolean')throw Error('Fire switch state required');
   if(fuelStartLever==='CUTOFF'||fireSwitchPulled)return {available:false,tank:null,reason:'SHUTOFF_VALVE_CLOSED',quality:SOURCE};
   const own=engine==='engine1'?'main1':'main2',opposite=engine==='engine1'?'main2':'main1';
   // Center pumps can supply either engine. With unknown pump power prefer known
   // own-main feed; absent all known routes retains UNKNOWN rather than inventing OFF.
   const center=anyPump(pumps,pumpNames.center);
   if(this.tanks.center>0&&center===true)return {available:true,tank:'center',reason:'CENTER_PUMP_FEED',quality:SOURCE};
   const main=anyPump(pumps,pumpNames[own]);
   if(this.tanks[own]>0&&main===true)return {available:true,tank:own,reason:'OWN_MAIN_PUMP_FEED',quality:SOURCE};
   const other=anyPump(pumps,pumpNames[opposite]);
   if(this.crossfeed==='OPEN'&&this.tanks[opposite]>0&&other===true)
    return {available:true,tank:opposite,reason:'OTHER_MAIN_CROSSFEED',quality:SOURCE};
   if(this.allowSuctionTraining&&this.tanks[own]>0&&pressureAltitudeFt<=10000)
    return {available:true,tank:own,reason:'EXPLICIT_LOW_ALTITUDE_SUCTION_TRAINING',quality:'UNVERIFIED_SIM_OPTION'};
   const uncertain=(this.tanks.center>0&&center===null)||(this.tanks[own]>0&&main===null)||
    (this.crossfeed==='OPEN'&&this.tanks[opposite]>0&&other===null);
   return {available:uncertain?null:false,tank:null,reason:uncertain?'PUMP_POWER_UNRESOLVED':'NO_AVAILABLE_FUEL_PATH',quality:SOURCE};
  }
  consume(engine,amountKg,tank){
   if(!['engine1','engine2','apu'].includes(engine))throw Error('Unknown consumer');
   if(!TANK.includes(tank))throw Error('Unknown source tank');
   if(!finite(amountKg)||amountKg<0)throw Error('Invalid fuel burn');
   const delivered=Math.min(this.tanks[tank],amountKg);
   this.tanks[tank]=round(Math.max(0,this.tanks[tank]-delivered));
   this.burnedKg[engine]=round(this.burnedKg[engine]+delivered);
   if(delivered>0)this.events.push({type:'FUEL_BURN',engine,tank,kg:round(delivered)});
   if(this.events.length>100)this.events.splice(0,this.events.length-100);
   return {deliveredKg:round(delivered),shortfallKg:round(Math.max(0,amountKg-delivered))};
  }
  get(){return {schema:'b737-isn-fuel-12/1',quality:'TRAINING_QUANTITIES_AND_FUEL_FLOW',
   tanksKg:cp(this.tanks),crossfeed:this.crossfeed,burnedKg:cp(this.burnedKg),
   suctionTraining:this.allowSuctionTraining,events:cp(this.events)};}
 }
 function diagnostics(snapshot,fuelSources){
  const entries={};for(const id of IDS){
   const phase=snapshot.phase?.[id]||'UNKNOWN';
   const obs=snapshot.observations?.[id];
   const faults=[];const push=(code,priority)=>faults.push({code,priority,origin:'ISN_DISCRETE_OR_TRAINING',notFireWarning:true});
   if(obs?.rules?.advisory?.egt725Latched)push('START_EGT_725_CRITERION','WARNING');
   if(phase==='ABNORMAL_EGT')push('ABNORMAL_START_EGT','WARNING');
   if(phase==='NO_LIGHT_OFF')push('NO_LIGHT_OFF','CAUTION');
   if(phase==='HUNG_START'||phase==='N2_STALLED')push(phase,'CAUTION');
   if(phase==='EARLY_STARTER_CUTOUT')push('EARLY_STARTER_CUTOUT','CAUTION');
   if(phase==='FLAMEOUT'||phase==='FUEL_STARVATION')push(phase,'CAUTION');
   if(phase==='RUNNING'&&fuelSources?.[id]?.available===false)push('FUEL_PATH_UNAVAILABLE','CAUTION');
   entries[id]={phase,faults,status:faults.length?'ABNORMAL':'NO_IDENTIFIED_ABNORMAL',
    source:obs?.running===true?obs?.feedback?.n2Percent?.origin??null:null};
  }
  return {quality:'DISCRETE_FCOM_CRITERIA_AND_SIMULATED_FAULTS',engines:entries,
   noInferredFireBell:true,noInferredOilWarnings:true};
 }
 class Runtime{
  constructor({chain,thrustPlanner,initialFuelKg,allowSuctionTraining=false}={}){
   if(!chain||typeof chain.get!=='function'||typeof chain.advance!=='function'||typeof chain.lever!=='function')
    throw Error('ISN training start Chain required');
   if(!thrustPlanner||typeof thrustPlanner.performance!=='function'||typeof thrustPlanner.applyToTrainingChain!=='function')
    throw Error('ISN thrust-performance planner required');
   this.chain=chain;this.planner=thrustPlanner;
   this.fuel=new FuelNetwork({initialFuelKg:initialFuelKg??approx.initialFuelKg,allowSuctionTraining});
   this.env={pressureAltitudeFt:0};this.fireSwitch={engine1:false,engine2:false};
   this.commandLog=[];this.lastPlan=null;this.elapsedMs=0;
  }
  pumps(){return this.chain.start?.core?.pack?.get()?.pumps??{};}
  fuelPath(device){const obs=this.chain.get().observations?.[device];
   return this.fuel.supply(device,this.pumps(),{pressureAltitudeFt:this.env.pressureAltitudeFt,
    fuelStartLever:obs?.feedback?.fuelStartLever?.value??'CUTOFF',fireSwitchPulled:this.fireSwitch[device]});}
  setEnvironment({pressureAltitudeFt}){if(!finite(pressureAltitudeFt)||pressureAltitudeFt< -1000||pressureAltitudeFt>40000)throw Error('Invalid altitude');
   this.env.pressureAltitudeFt=pressureAltitudeFt;return this.get();}
  setFireSwitch(device,pulled){if(!IDS.includes(device)||typeof pulled!=='boolean')throw Error('Invalid engine fire switch');
   this.fireSwitch[device]=pulled;
   if(pulled&&this.chain.get().phase[device]==='RUNNING'){
    if(typeof this.chain.fuelFlameout!=='function')throw Error('ISN fuelFlameout adapter required');
    this.chain.fuelFlameout(device,'FIRE_SWITCH_FUEL_SHUTOFF');
   }
   return this.get();}
  pumpSwitch(id,on){if(!Object.values(pumpNames).flat().includes(id)||typeof on!=='boolean')throw Error('Invalid fuel pump');
   this.chain.start.core.pack.send({type:'PUMP_SWITCH',id,value:on});return this.get();}
  enableTrainingPumpPower(){this.chain.start.core.pack.send({type:'MODE',value:'TRAINING_SURROGATE',instructor:true});return this.get();}
  fuelLever(device,position){if(!IDS.includes(device)||!['CUTOFF','IDLE'].includes(position))throw Error('Invalid fuel lever');
   if(position==='IDLE'){
    const test=this.fuel.supply(device,this.pumps(),{pressureAltitudeFt:this.env.pressureAltitudeFt,
     fuelStartLever:'IDLE',fireSwitchPulled:this.fireSwitch[device]});
    if(test.available!==true)return {accepted:false,reason:test.reason,quality:test.quality};
   }
   this.chain.lever(device,position);return {accepted:true,phase:this.chain.get().phase[device]};
  }
  planThrust(device,input,{apply=false}={}){
   if(!IDS.includes(device))throw Error('Invalid engine');
   const p=this.planner.performance(input);this.lastPlan=cp(p);
   if(apply){
    if(this.chain.get().phase[device]!=='RUNNING')throw Error('Cannot command stopped engine');
    const action=this.planner.applyToTrainingChain(this.chain,device,input);
    this.commandLog.push({event:'APPLIED_TRAINING_THRUST',device,mode:p.mode.active,commandN1:p.performance.selectedN1CommandPercent});
    return {plan:p,action};
   }
   return {plan:p,action:null};
  }
  advance(ms){if(!finite(ms)||ms<0||ms>120000)throw Error('Invalid elapsed time');
   let remaining=ms;
   while(remaining>0){const dt=Math.min(remaining,approx.maxStepMs);remaining-=dt;
    const pre=this.chain.get();
    // A live engine losing its pumped fuel route must fail, never keep generating.
    for(const id of IDS)if(pre.phase[id]==='RUNNING'&&this.fuelPath(id).available===false){
     if(typeof this.chain.fuelFlameout==='function')this.chain.fuelFlameout(id);
     else throw Error('ISN-12 requires source-gated fuelFlameout adapter');
    }
    this.chain.advance(dt);this.elapsedMs+=dt;
    const now=this.chain.get();
    for(const id of IDS){
     if(now.phase[id]!=='RUNNING')continue;
     const fuel=this.fuelPath(id);
     if(fuel.available===false){this.chain.fuelFlameout(id);continue;}
     if(fuel.available!==true)continue; // UNKNOWN fuel path must not mutate physical observations.
     const ff=now.runningEnvelope?.engines?.[id]?.fuelFlowKgHr;
     if(!finite(ff))continue;
     const burn=this.fuel.consume(id,ff*dt/3600000,fuel.tank);
     if(burn.shortfallKg>0||this.fuel.tanks[fuel.tank]===0){this.chain.fuelFlameout(id);}
    }
    // APU fuel draw: explicit training amount from main 1, never an asserted pump/wiring sensor.
    if(now.sources?.apu?.running===true&&this.fuel.tanks.main1>0)
     this.fuel.consume('apu',approx.apuFuelKgHr*dt/3600000,'main1');
   }
   return this.get();
  }
  get(){const snap=this.chain.get();const paths=Object.fromEntries(IDS.map(d=>[d,this.fuelPath(d)]));
   const engines=Object.fromEntries(IDS.map(d=>[d,{phase:snap.phase[d],
    n1ActualSimPct:snap.runningEnvelope?.engines?.[d]?.n1Percent??null,
    n2Percent:snap.observations?.[d]?.feedback?.n2Percent?.value??null,
    egtC:snap.observations?.[d]?.feedback?.egtC?.value??null,
    fuelFlowKgHr:snap.observations?.[d]?.feedback?.fuelFlowKgHr?.value??null,
    fuelPath:paths[d],source:snap.sources[d]?.origin??null}]));
   return {schema:SCHEMA,quality:SOURCE,elapsedMs:this.elapsedMs,engines,
    modeLimitsN1Pct:this.lastPlan?.mode?.limitTable??null,
    lastPlan:this.lastPlan?cp(this.lastPlan):null,
    fuel:this.fuel.get(),diagnostics:diagnostics(snap,paths),commands:cp(this.commandLog),
    starter:{engine1:snap.observations?.engine1?.rules?.starter??null,
     engine2:snap.observations?.engine2?.rules?.starter??null},
    issues:['SOURCE_GATED_UNKNOWN_PUMP_POWER_IS_NOT_FALSE','NOT_INSTALLED_AIRFRAME_WIRING',
     'NO_INFERRED_FIRE_WARNING','NUMERIC_FUEL_BURN_AND_APU_FLOW_SIMULATED']};}
 }
 return Object.freeze({SCHEMA,SOURCE,approx,FuelNetwork,diagnostics,Runtime});
});