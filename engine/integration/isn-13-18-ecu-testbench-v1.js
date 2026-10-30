/* ISN 13-18 classroom testbench, without altering the approved cockpit artwork.
 * Functional system topology from 737 Classic FCOM §§7.20, 7.30, 12.20;
 * all rates, timing, pressure values and thrust/ECU behaviour are approximations.
 * The only writable owners of engine running state remain the ISN03 start chain
 * and ISN09-12 fuel runtime. Never override external/instructor observations.
 */
(function(root,factory){'use strict';const api=factory(root?.B737ISNAPULoadDynamicsV1||(typeof require==='function'?require('./isn-apu-load-dynamics-v1'):null));if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.B737ISN1318ECUTestbenchV1=api;})(typeof globalThis!=='undefined'?globalThis:null,function(LoadDynamics){
'use strict';
const SCHEMA='b737.isn.ecu-start-test.v1', ORIGIN='SIM_TRAINING_APPROX_13_18';
if(!LoadDynamics?.initial||!LoadDynamics?.step)throw Error('APU load dynamics dependency required');
 const ENGINES=['engine1','engine2'];
const CONFIG=Object.freeze({oilPressureLampOnPsi:11.75,oilPressureLampOffPsi:13,
 oilRedRadialTrainingPsi:13,oilPressureRiseN2:18,oilPressureAt22N2Psi:45,
 oilPumpPressurePerN2:0.75,oilPressureMaxPsi:95,
 oilPressureResponseMs:300,oilPressureDecayMs:2100,
 hydraulicPumpStartN2:4.5,hydraulicPumpRatedN2:6,hydraulicRatedPressurePsi:3000,
 apuRatedRpmPct:95.5,apuGeneratorReadyRpmPct:95,
 apuGenVoltageV:115,apuGenFrequencyHz:400,apuStartPeakEGTC:620,
 oilAmbientTempC:20,oilIdleTempC:82,oilHighPowerTempC:103,oilTempWarmupMs:95000,
 oilTempCooldownMs:240000,oilInitialQuantityPct:85,
 oilLeakLossPctPerSec:0.20,oilNaturalLossPctPerHour:0.02,
 starterAirTrainingPsi:30,apuReadyEGTC:390,apuFuelKgHr:110,
 // Educational thermodynamic inertia (not an airframe/APU empirical curve).
 apuEGTChangeoverC:50,apuCoolFastTauMs:70000,apuCoolTailTauMs:1200000,
 engineN1WindDownMs:5200,engineN2WindDownMs:7200,engineEGTWindDownMs:12000,
 maxStepMs:250});
const finite=x=>typeof x==='number'&&Number.isFinite(x);
const round=(x,d=2)=>Number(x.toFixed(d));
const clip=(x,a,b)=>Math.min(b,Math.max(a,x));
const smooth=(current,target,dt,tau)=>target+(current-target)*Math.exp(-dt/tau);
const copy=x=>JSON.parse(JSON.stringify(x));
function checkEngine(engine){if(!ENGINES.includes(engine))throw Error('Expected engine1 or engine2');}
function oilInitial(){return {pressurePsi:0,temperatureC:CONFIG.oilAmbientTempC,
 quantityPct:CONFIG.oilInitialQuantityPct,lowPressureLamp:true,filterBypassLamp:false,
 faults:{pumpFailure:false,oilLeak:false,filterRestriction:false},source:ORIGIN};}
function oilStep(previous,{n2Percent=0,throttle=0,engineRunning=false}={},dtMs){
 if(!previous||!finite(n2Percent)||!finite(throttle)||!finite(dtMs)||dtMs<0||dtMs>120000)
  throw Error('Invalid oil model input/time');
 if(!finite(previous.pressurePsi)||!finite(previous.temperatureC)||!finite(previous.quantityPct))
  throw Error('Invalid prior oil state');
 const s={...previous,faults:{...previous.faults}};
 const effectiveN2=clip(n2Percent,0,110);
 // No simulated oil pressure until N2 reaches 18%; rapid rise through N2 22%.
  const coldN2Pressure=effectiveN2<=CONFIG.oilPressureRiseN2?0:
   effectiveN2<22?CONFIG.oilPressureAt22N2Psi*(effectiveN2-CONFIG.oilPressureRiseN2)/(22-CONFIG.oilPressureRiseN2):
   clip(CONFIG.oilPressureAt22N2Psi+(effectiveN2-22)*CONFIG.oilPumpPressurePerN2,0,CONFIG.oilPressureMaxPsi);
 const quantityMultiplier=s.quantityPct<=5?0:s.quantityPct<20?s.quantityPct/20:1;
 const warmFactor=1-clip((s.temperatureC-100)*0.003,0,0.20);
 const pumpGood=!s.faults.pumpFailure;
 const targetPsi=pumpGood?coldN2Pressure*quantityMultiplier*warmFactor:0;
 const pressureTau=targetPsi>=s.pressurePsi?CONFIG.oilPressureResponseMs:CONFIG.oilPressureDecayMs;
 s.pressurePsi=round(smooth(s.pressurePsi,targetPsi,dtMs,pressureTau));
 const targetTemp=engineRunning?CONFIG.oilIdleTempC+(CONFIG.oilHighPowerTempC-CONFIG.oilIdleTempC)*clip(throttle,0,1):CONFIG.oilAmbientTempC;
 const tempTau=targetTemp>s.temperatureC?CONFIG.oilTempWarmupMs:CONFIG.oilTempCooldownMs;
 s.temperatureC=round(smooth(s.temperatureC,targetTemp,dtMs,tempTau));
 const leakLoss=s.faults.oilLeak?CONFIG.oilLeakLossPctPerSec*dtMs/1000:0;
 const normalLoss=engineRunning?CONFIG.oilNaturalLossPctPerHour*dtMs/3600000:0;
 s.quantityPct=round(clip(s.quantityPct-normalLoss-leakLoss,0,100),5);
 // Explicit Schmitt thresholds for TRAINING lamp; independent of N2 or phase.
 if(s.pressurePsi>=CONFIG.oilPressureLampOffPsi)s.lowPressureLamp=false;
 else if(s.pressurePsi<=CONFIG.oilPressureLampOnPsi)s.lowPressureLamp=true;
 s.filterBypassLamp=Boolean(s.faults.filterRestriction&&effectiveN2>10);
 return s;
}
// Read-only engine-driven hydraulic pressure training indication, not an
 // assertion that the fitted aircraft's hydraulic bus has this measured pressure.
 function hydraulicPressure(n2Percent){
  if(!finite(n2Percent))throw Error('Finite N2 required for hydraulic pressure');
  return round(CONFIG.hydraulicRatedPressurePsi*clip(
   (n2Percent-CONFIG.hydraulicPumpStartN2)/
   (CONFIG.hydraulicPumpRatedN2-CONFIG.hydraulicPumpStartN2),0,1));
 }
 function apuStartEGT(progress){
  const peakAt=0.64,p=clip(progress,0,1),ease=x=>x*x*(3-2*x);
  return round(p<=peakAt?
   CONFIG.oilAmbientTempC+(CONFIG.apuStartPeakEGTC-CONFIG.oilAmbientTempC)*ease(p/peakAt):
   CONFIG.apuStartPeakEGTC+(CONFIG.apuReadyEGTC-CONFIG.apuStartPeakEGTC)*ease((p-peakAt)/(1-peakAt)));
 }
 // Shutdown cool-down is independent of fuel/battery/electrical buses.
 // Two analytic exponential stages preserve real elapsed time and yield the
 // same result for 100ms ticks, throttled 1s ticks or tab-resume catch-up.
 function apuCoolingStep(egtC,dtMs){
  if(!finite(egtC)||!finite(dtMs)||dtMs<0||dtMs>120000)
   throw Error('Valid APU EGT and 0..120000ms cooling duration required');
  const ambient=CONFIG.oilAmbientTempC,transition=CONFIG.apuEGTChangeoverC;
  if(egtC<=ambient)return ambient;
  if(egtC<=transition)return smooth(egtC,ambient,dtMs,CONFIG.apuCoolTailTauMs);
  const afterFast=smooth(egtC,ambient,dtMs,CONFIG.apuCoolFastTauMs);
  if(afterFast>=transition)return afterFast;
  // Crossed 50°C during this tick. Integrate exactly to the crossing
  // then use the slower stage for the remaining fraction of this same tick.
  const fastMs=CONFIG.apuCoolFastTauMs*Math.log((egtC-ambient)/(transition-ambient));
  return smooth(transition,ambient,dtMs-fastMs,CONFIG.apuCoolTailTauMs);
 }
function initialCoast(){return {n1:0,n2:0,egt:CONFIG.oilAmbientTempC,lastRunning:false};}
function coastStep(prev,{runningN1=null,n2=null,egtC=null,phase='OFF'}={},dtMs){
 const s={...prev};
 if(phase==='RUNNING'&&finite(runningN1)&&finite(n2)){
  s.n1=runningN1;s.n2=n2;s.egt=finite(egtC)?egtC:s.egt;s.lastRunning=true;
 }else if(phase==='MOTORING'||phase==='AWAIT_FUEL_LEVER_IDLE'||phase==='LIGHT_OFF_SEQUENCE'||phase==='ABNORMAL_EGT'||phase==='NO_LIGHT_OFF'||phase==='HUNG_START'){
  s.n2=finite(n2)?n2:s.n2;
  s.n1=clip(s.n2*0.17,0,12);
  if(finite(egtC))s.egt=egtC;
 }else{
  s.n1=smooth(s.n1,0,dtMs,CONFIG.engineN1WindDownMs);
  s.n2=smooth(s.n2,0,dtMs,CONFIG.engineN2WindDownMs);
  s.egt=smooth(s.egt,CONFIG.oilAmbientTempC,dtMs,CONFIG.engineEGTWindDownMs);
 }
 for(const k of ['n1','n2','egt'])s[k]=round(s[k]);
 return s;
}
class Testbench{
 constructor({Electrical,Loads,TrainerCore,WarningEngine,Pneumatics,Pack,EngineAPU,Start,Chain,ThrustPlanner,FuelRuntime,timingProfile='REALTIME_TRAINING'}={}){
  if(!Electrical?.initialState||!Loads?.project||!Pack?.Session||!Start?.Session||
   !Chain?.Chain||!FuelRuntime?.Runtime||!ThrustPlanner?.performance||typeof WarningEngine!=='function')
   throw Error('ISN 01, 03, 09-12 and N1 planner modules required');
  this.modules={Electrical,Loads,TrainerCore,WarningEngine,Pneumatics,Pack,EngineAPU,Start,Chain,ThrustPlanner,FuelRuntime};
  this.start=new Start.Session({EngineAPU,ElectricalPack:Pack,Electrical,Loads,TrainerCore,WarningEngine,Pneumatics});
  this.chain=new Chain.Chain(this.start,{timingProfile});
  this.core=new FuelRuntime.Runtime({chain:this.chain,thrustPlanner:ThrustPlanner});
  this.oil={engine1:oilInitial(),engine2:oilInitial()};
  this.coast={engine1:initialCoast(),engine2:initialCoast()};
  this.elapsedMs=0;this.apuStartMs=null;this.engineStartMs={engine1:null,engine2:null};this.lastThrust=null;this.trace=[];
  this.apuFaults={overheat:false,bleedFailure:false,generatorFailure:false};
   this.apuConsumers=Object.fromEntries(Object.keys(LoadDynamics.CATALOG).map(id=>[id,false]));
   this.apuLoadState=LoadDynamics.initial();
   this.apuPhysicalAmpsA=0;
   this.apuThermalEgtC=CONFIG.oilAmbientTempC;
  this.aircraft={pressureAltitudeFt:0,oatC:15,iasKt:0,massKg:55000,onGround:true};
  this.chain.synchronize({toggles:{'apu-start':'OFF','bleed-apu':'OFF','bleed-eng-1':'OFF','bleed-eng-2':'OFF',
   'pack-l':'OFF','pack-r':'OFF','isolation-valve':'OPEN'},
   guards:{'battery-master':{value:'off'}},
   rotaries:{'ignition-source':'BOTH','engine-start-1':'OFF','engine-start-2':'OFF'},
   context:{onGround:true,engine1Running:false,engine2Running:false,apuRunning:false,groundPowerAttached:false}});
 }
 log(type,data={}){this.trace.push({tMs:this.elapsedMs,type,...data});if(this.trace.length>120)this.trace.shift();}
 battery(on){if(typeof on!=='boolean')throw Error('battery switch requires boolean');
  this.chain.event({id:'battery-master',kind:'guarded',next:{value:on?'on':'off',guard:'open'}});
  this.log('BATTERY',{on});return this.get();}
 observeAPUSourceAmps(amps){
  // Real physical toggles/CBs feed this from the existing ATA24 estimate.
  // APU state or generator contactor remains owned by the original Pack.
  if(amps!==null&&(!finite(amps)||amps<0))throw Error('Invalid estimated APU source amps');
  this.apuPhysicalAmpsA=amps===null?0:Math.min(300,amps);
 }
 startAPU(){if(this.apuFaults.overheat)throw Error('Clear injected APU overheat before new start');
  this.chain.event({id:'apu-start',kind:'toggle',next:'START'});
  this.apuStartMs=this.chain.get().phase.apu==='INLET_DOOR'?this.elapsedMs:null;
  this.log('APU_START_REQUEST');return this.get();}
 selectGenerator(source,side){if(![1,2].includes(side)||!['APU','GEN1','GEN2','OFF'].includes(source))throw Error('Invalid generator selection');
  if(this.apuFaults.generatorFailure&&source==='APU')throw Error('Injected APU generator failure');
   if(source==='APU'&&!this.get().apu.generator.ready)throw Error('APU generator not yet at rated speed');
  this.start.core.pack.send({type:'ELECTRICAL',action:{type:'SELECT_SOURCE',source,side}});
  this.chain.syncPower();this.log('SOURCE_SELECT',{source,side});return this.get();}
 setIgnitionSelector(position){
  if(!['IGN_L','BOTH','IGN_R'].includes(position))throw Error('Expected IGN_L/BOTH/IGN_R');
  this.chain.event({id:'ignition-source',kind:'rotary',next:position.replace('_',' ')});
  this.core.refreshFuelDelivery();
  this.log('IGNITION_SELECTOR',{position});return this.get();
 }
 setStandbyPower(position){
  if(!['AUTO','BAT','OFF'].includes(position))throw Error('Expected standby AUTO/BAT/OFF');
  this.start.core.pack.send({type:'ELECTRICAL',action:{type:'CONTROL',key:'standbySelector',value:position}});
  this.chain.syncPower();this.core.refreshFuelDelivery();
  this.log('STANDBY_POWER',{position});return this.get();
 }
 setElectricalConsumer(id,on){
   if(!Object.hasOwn(LoadDynamics.CATALOG,id)||typeof on!=='boolean')
    throw Error('Known training electrical consumer ID and boolean switch required');
   this.apuConsumers[id]=on;
   this.log('TRAINING_ELECTRICAL_CONSUMER',{id,on,kvaEstimate:LoadDynamics.CATALOG[id].kva});
   return this.get();
  }
  apuBleed(on){if(typeof on!=='boolean')throw Error('APU BLEED boolean required');
  if(on&&this.apuFaults.bleedFailure)throw Error('Injected APU bleed unavailable');
  this.chain.event({id:'bleed-apu',kind:'toggle',next:on?'ON':'OFF'});
  this.log('APU_BLEED',{on});return this.get();}
 prepareFuel({trainingPumpPower=true,pumps=true}={}){
  if(trainingPumpPower)this.core.enableTrainingPumpPower();
  if(pumps)for(const name of ['fuel.main1FwdPump','fuel.main1AftPump','fuel.main2FwdPump','fuel.main2AftPump'])this.core.pumpSwitch(name,true);
  this.core.refreshFuelDelivery();
  this.log('FUEL_PUMPS',{trainingPumpPower,pumps});return this.get();}
 setStartDuctPressure(engine,psi){
  checkEngine(engine);this.chain.setStartDuctPressure(engine,psi);
  this.log('TRAINING_DUCT_PRESSURE',{engine,psi,source:'TRAINING_INPUT_NOT_SENSOR'});
  return this.get();
 }
 engineStart(engine){checkEngine(engine);
  this.core.refreshFuelDelivery();
  this.chain.event({id:'engine-start-'+engine.at(-1),kind:'rotary',next:'GRD'});
  if(this.chain.get().phase[engine]==='MOTORING')this.engineStartMs[engine]=this.elapsedMs;
  this.log('ENGINE_START_GRD',{engine,phase:this.chain.get().phase[engine],reason:this.chain.get().lastError});return this.get();}
 fuelLever(engine,position){checkEngine(engine);
  const result=this.core.fuelLever(engine,position);
  this.log('FUEL_LEVER',{engine,position,accepted:result.accepted,phase:result.phase,
   fuelAvailable:result.fuelAvailable,reason:result.fuelSupplyReason??result.reason??null});
  return result;}
 setOnGround(onGround){if(typeof onGround!=='boolean')throw Error('onGround boolean');
  this.chain.setOnGround(onGround);this.aircraft.onGround=onGround;
  this.log('GROUND_FLAG',{onGround});return this.get();}
 setFlightInputs(input){if(!input||typeof input!=='object')throw Error('Flight inputs required');
  for(const [key,range] of Object.entries({pressureAltitudeFt:[-1000,40000],oatC:[-80,60],iasKt:[0,360],massKg:[35000,80000]}))
   if(Object.hasOwn(input,key)){const value=input[key];if(!finite(value)||value<range[0]||value>range[1])throw Error('Invalid '+key);this.aircraft[key]=value;}
  this.core.setEnvironment({pressureAltitudeFt:this.aircraft.pressureAltitudeFt});
  this.chain.setFlightConditions({pressureAltitudeFt:this.aircraft.pressureAltitudeFt,
   iasKt:this.aircraft.iasKt});
  return this.get();}
 setThrottle(engine,throttle){checkEngine(engine);if(!finite(throttle)||throttle<0||throttle>1)throw Error('throttle 0..1');
  if(this.chain.get().phase[engine]!=='RUNNING')throw Error('Engine must be RUNNING');
  this.chain.setThrottle(engine,throttle);this.log('THROTTLE',{engine,throttle});return this.get();}
 planThrust(engine,{mode='CRZ',targetIasKt=null,accelTimeSec=null,verticalSpeedFpm=0,windSpeedKt=0,windFromDeg=0,trackTrueDeg=0}={}){
  checkEngine(engine);if(this.aircraft.iasKt<100)throw Error('Set airborne IAS before N1 speed planning');
  const snap=this.chain.get();const n=['engine1','engine2'].filter(id=>snap.phase[id]==='RUNNING').length;
  if(n===0)throw Error('No running engines');
  const input={pressureAltitudeFt:this.aircraft.pressureAltitudeFt,oatC:this.aircraft.oatC,
   iasKt:this.aircraft.iasKt,weightKg:this.aircraft.massKg,onGround:this.aircraft.onGround,
   mode,operatingEngines:n,targetIasKt:targetIasKt??this.aircraft.iasKt,accelTimeSec,
   verticalSpeedFpm,windSpeedKt,windFromDeg,trackTrueDeg};
  const out=this.core.planThrust(engine,input,{apply:true});this.lastThrust=copy(out.plan);
  this.log('N1_PLAN_APPLIED',{engine,mode,n1:out.plan.performance.selectedN1CommandPercent});return out;}
 setOilFault(engine,key,on){checkEngine(engine);if(!['pumpFailure','oilLeak','filterRestriction'].includes(key)||typeof on!=='boolean')throw Error('Invalid oil fault');
  this.oil[engine].faults[key]=on;this.log('INJECT_OIL',{engine,key,on});return this.get();}
 setAPUFault(key,on){if(!Object.hasOwn(this.apuFaults,key)||typeof on!=='boolean')throw Error('Invalid APU fault');
  this.apuFaults[key]=on;
  if(on&&key==='bleedFailure')this.apuBleed(false);
  if(on&&key==='generatorFailure')for(const side of [1,2])if(this.chain.get().selectedSources[side]==='APU')this.selectGenerator('OFF',side);
  this.log('INJECT_APU',{key,on});return this.get();}
 setStartFault(engine,key,on){checkEngine(engine);this.chain.setTrainingFault(engine,key,on);
  this.log('INJECT_START',{engine,key,on});return this.get();}
 shutdown(engine){checkEngine(engine);this.fuelLever(engine,'CUTOFF');return this.get();}
 // Lightweight passive heat decay while every engine and the APU is off:
 // avoids running the full ECU/fuel/electrical simulator for 20 minutes.
 coolAPU(ms){
  if(!finite(ms)||ms<0||ms>120000)throw Error('Invalid passive APU cooling interval');
  if(['READY','STARTING'].includes(this.chain.get().phase.apu))return this.get();
  this.apuThermalEgtC=apuCoolingStep(this.apuThermalEgtC,ms);
  this.elapsedMs+=ms;
  return this.get();
 }
 advance(ms){if(!finite(ms)||ms<0||ms>120000)throw Error('Invalid step duration');
  let remaining=ms;
  while(remaining>0){const dt=Math.min(remaining,CONFIG.maxStepMs);remaining-=dt;
   this.core.advance(dt);this.elapsedMs+=dt;
   const snap=this.chain.get();
   for(const id of ENGINES){const n2=snap.observations[id].feedback.n2Percent.value;
    const phase=snap.phase[id],env=snap.runningEnvelope.engines[id];
    const running=phase==='RUNNING';
    this.coast[id]=coastStep(this.coast[id],{
     runningN1:env?.n1Percent??null,n2:finite(n2)?n2:null,
     egtC:snap.observations[id].feedback.egtC.value,phase},dt);
    this.oil[id]=oilStep(this.oil[id],{n2Percent:this.coast[id].n2,
     throttle:snap.runningEnvelope.throttle[id],engineRunning:running},dt);
   }
   if(snap.phase.apu==='READY'){
    const load=LoadDynamics.demand({selectedSources:snap.selectedSources,
     switches:this.apuConsumers,bleedValveOpen:snap.bleed.apuBleedValveOpen,
     pumpSnapshot:this.start.core.pack.get(),physicalSourceAmpsA:this.apuPhysicalAmpsA});
    this.apuLoadState=LoadDynamics.step(this.apuLoadState,load,dt);
    this.apuThermalEgtC=this.apuLoadState.egtC;
    // ISN-12 burns the estimated baseline 110 kg/h. Charge only the
    // simulated excess from electrical/pneumatic load, with no double count.
    const excessKgHr=Math.max(0,this.apuLoadState.fuelFlowKgHr-this.modules.FuelRuntime.approx.apuFuelKgHr);
    if(snap.sources?.apu?.running===true&&excessKgHr>0){
     const path=this.core.apuFuelPath();
     if(path.available===true){
      const burn=this.core.fuel.consume('apu',excessKgHr*dt/3600000,path.tank);
      if(burn.shortfallKg>0||this.core.fuel.tanks[path.tank]===0)
       this.chain.apuFuelStarve('APU_LOAD_FUEL_EXHAUSTED');
     }
    }
   }else{
    this.apuLoadState=LoadDynamics.initial();
    if(snap.phase.apu==='STARTING'){
     const since=this.apuStartMs===null?0:Math.max(0,this.elapsedMs-this.apuStartMs);
     const progress=clip((since-this.chain.timing.apuDoorMs)/
      (this.chain.timing.apuReadyMs-this.chain.timing.apuDoorMs),0,1);
     this.apuThermalEgtC=apuStartEGT(progress);
    }else this.apuThermalEgtC=apuCoolingStep(this.apuThermalEgtC,dt);
   }
  }
  return this.get();}
 get(){const base=this.core.get(),snap=this.chain.get();
  const engines={};const alerts=[];
  for(const id of ENGINES){
   const e=base.engines[id],oil=this.oil[id],needle=this.coast[id],phase=e.phase;
   const running=phase==='RUNNING';
   // Probe the actual ISN-12 source graph as though IDLE were selected. This
   // includes engine-driven suction when motor N2 is rotating, not only pumps.
   const fuelReady=this.core.fuelPath(id,{fuelStartLever:'IDLE'});
   const n2Observed=snap.observations[id].feedback.n2Percent.value;
   const startCue=fuelReady.reason; // State only; no pilot-facing instructions.
   engines[id]={phase,n1Percent:needle.n1,n2Percent:needle.n2,
    egtC:needle.egt, fuelFlowKgHr:e.fuelFlowKgHr,
    oil:{pressurePsi:oil.pressurePsi,temperatureC:oil.temperatureC,quantityPct:oil.quantityPct,
     lowPressureLamp:oil.lowPressureLamp,filterBypassLamp:oil.filterBypassLamp,origin:ORIGIN},
     hydraulic:{system:id==='engine1'?'A':'B',engineDrivenPressurePsi:hydraulicPressure(needle.n2),origin:ORIGIN},
    ignition:{selector:snap.observations[id].rules.ignition.selector,
      demand:copy(snap.observations[id].rules.ignition.demand),
      eligible:copy(snap.observations[id].rules.ignition.supplyEligible)},
     startValveOpen:snap.observations[id].feedback.startValveOpen.value,
    fuelLever:snap.observations[id].feedback.fuelStartLever.value,
    fuelPath:e.fuelPath,fuelSupplyReady:fuelReady.available,
    fuelSupplyReason:fuelReady.reason,startCue,
    startElapsedSec:this.engineStartMs[id]===null?null:round((this.elapsedMs-this.engineStartMs[id])/1000,1),
    starterDuctPsiTraining:snap.trainingStartDuctPsi[id],
    startTimingTraining:copy(snap.effectiveEngineStartTiming[id]),
    origin:e.source,
    readingsAreTrainingEstimates:true};
   if(oil.lowPressureLamp)alerts.push({id:id+'.LOW_OIL_PRESSURE',level:'AMBER',source:ORIGIN});
   if(oil.filterBypassLamp)alerts.push({id:id+'.OIL_FILTER_BYPASS',level:'AMBER',source:ORIGIN});
   for(const f of base.diagnostics.engines[id].faults)alerts.push({id:id+'.'+f.code,level:f.priority,source:f.origin});
   if(running&&e.fuelPath.available!==true)alerts.push({id:id+'.FUEL_SUPPLY_UNRESOLVED',level:'CAUTION',source:ORIGIN});
  }
  if(this.apuFaults.overheat)alerts.push({id:'APU.OVERHEAT_INJECTED',level:'AMBER',source:ORIGIN});
  if(this.apuFaults.bleedFailure)alerts.push({id:'APU.BLEED_FAILURE_INJECTED',level:'AMBER',source:ORIGIN});
  if(this.apuFaults.generatorFailure)alerts.push({id:'APU.GEN_FAILURE_INJECTED',level:'AMBER',source:ORIGIN});
  const tSince=this.apuStartMs===null?0:Math.max(0,this.elapsedMs-this.apuStartMs);
  const apuPhase=snap.phase.apu;
  const timing=this.chain.timing;
  const apuProgress=clip((tSince-timing.apuDoorMs)/(timing.apuReadyMs-timing.apuDoorMs),0,1);
  const ramp=apuProgress*apuProgress*(3-2*apuProgress);
   const apuDemand=LoadDynamics.demand({selectedSources:snap.selectedSources,
    switches:this.apuConsumers,bleedValveOpen:snap.bleed.apuBleedValveOpen,
    pumpSnapshot:this.start.core.pack.get(),physicalSourceAmpsA:this.apuPhysicalAmpsA});
   const apuLoad=LoadDynamics.project(this.apuLoadState,apuDemand);
   const apuRPM=apuPhase==='READY'?apuLoad.rpmPct:
    apuPhase==='STARTING'?5+(CONFIG.apuRatedRpmPct-5)*ramp:0;
   // Never snap APU EGT to ambient on OFF/STOPPING/FUEL_STARVATION.
   const apuEGT=apuPhase==='READY'?apuLoad.egtC:
    apuPhase==='STARTING'?apuStartEGT(apuProgress):this.apuThermalEgtC;
   // APU rated generator capability does not close the GEN-to-BUS switch.
   const genReady=apuPhase==='READY'&&apuRPM>=CONFIG.apuGeneratorReadyRpmPct&&!this.apuFaults.generatorFailure;
   const generator={ready:genReady,voltageV:genReady?CONFIG.apuGenVoltageV:0,
    frequencyHz:genReady?CONFIG.apuGenFrequencyHz:0,
    currentEstimatedA:genReady?round(this.apuPhysicalAmpsA):0,
    connectedBusSides:Object.keys(snap.selectedSources).filter(side=>snap.selectedSources[side]==='APU').map(Number),origin:ORIGIN};
   const apu={phase:apuPhase,rpmPct:round(apuRPM),egtC:round(apuEGT),
    startElapsedSec:this.apuStartMs===null?null:round(tSince/1000,1),
    readyTargetSec:timing.apuReadyMs/1000,
    bleedValveOpen:snap.bleed.apuBleedValveOpen,genSelected:generator.connectedBusSides.length>0,
    generator,load:apuLoad,fuelFlowEstimatedKgHr:apuPhase==='READY'?apuLoad.fuelFlowKgHr:0,
   fuelPath:base.apuFuelPath,faults:{...this.apuFaults},origin:ORIGIN};
  const states={aircraft:copy(this.aircraft),engine1:engines.engine1,engine2:engines.engine2,apu};
  return {schema:SCHEMA,origin:ORIGIN,quality:'TRAINING_SIMULATION_ONLY',
   timeMs:this.elapsedMs,timingProfile:this.chain.timingProfile,timing:copy(this.chain.timing),stage:{ISN13:'OIL',ISN14:'APU_TELEMETRY',ISN15:'FAILURE_BUS',
    ISN16:'THRUST_LIMIT',ISN17:'ENGINE_DYNAMICS',ISN18:'TESTBENCH_E2E'},
   aircraft:copy(this.aircraft),engines,apu,
   electrical:{battery:snap.electrical.battery,selectedSources:copy(snap.selectedSources),
     standbySelector:this.start.core.pack.electricalState.config.standbySelector,
     standbyAcPowered:snap.electrical.acStandby,
     apuGenerator:copy(generator),apuConsumerSwitches:copy(this.apuConsumers)},
    hydraulics:{systemA:{pressurePsi:engines.engine1.hydraulic.engineDrivenPressurePsi,origin:ORIGIN},
     systemB:{pressurePsi:engines.engine2.hydraulic.engineDrivenPressurePsi,origin:ORIGIN}},
   fuel:base.fuel,thrust:{lastPlan:this.lastThrust,limits:base.modeLimitsN1Pct},
   alerts,trace:copy(this.trace),
   limits:{oilPressureLampOnPsi:CONFIG.oilPressureLampOnPsi,oilPressureLampOffPsi:CONFIG.oilPressureLampOffPsi},
   limitations:['NOT_AIRCRAFT_AFMS','NO_PHYSICAL_ECU_OR_FADEC_EMULATION',
    'USER_TIMED_START_PROFILE_NOT_AFM_CERTIFIED','START_DUCT_PSI_ESTIMATED_NOT_A_MEASURED_SENSOR','ALTITUDE_IAS_FUEL_MODEL_NOT_FCOM_VALIDATED','FUEL_PUMP_BUS_ASSIGNMENT_UNVERIFIED',
    'APU_EGT_AND_RPM_SURROGATES','APU_LOAD_KVA_AND_GOVERNOR_SURROGATE_NOT_WDM_CALIBRATED','NO_RELIABLE_MACH_OR_FULL_AERODYNAMIC_MODEL',
    'UNIFIED_APU_NEEDLES_USE_TRAINING_CALIBRATION_NOT_AIRCRAFT_CERTIFIED']};
 }
}
return Object.freeze({SCHEMA,ORIGIN,CONFIG,oilInitial,oilStep,hydraulicPressure,apuStartEGT,apuCoolingStep,coastStep,Testbench});
});