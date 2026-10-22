'use strict';
/**
 * ISN-06 Engine/APU/Fuel/Bleed/Electrical event integration (training pilot).
 * Private source: Sepehran 737CL FCOM NP.21.34-35 (PDF 134-135),
 * §7.10.22 (PDF 1193), §7.20.7-8 (PDF 1208-09),
 * §7.30.1-3 (PDF 1216-18), §6.20.1-4 (PDF 1150-53),
 * §12.20.1-2 (PDF 1834-35).
 *
 * No synthetic N2/EGT/duct-pressure spool-up or invented time constants.
 * Aircraft source selections remain explicit, NEVER silently paralleled.
 */
const {initializeProtection,evaluatePneumatics,evaluateStartProtections,
  verifyStartAttempt}=require('./pneumatic-start-protection.cjs');
const SOURCE='FCOM-SEPEHRAN-1937';
const src=(section,pdfPages)=>({sourceId:SOURCE,section,pdfPages});
const ENGINE_IDS=['1','2'];
const requireBool=(x,k)=>{if(typeof x!=='boolean')throw new TypeError(k+' must be boolean');};
const enumVal=(x,values,k)=>{if(!values.includes(x))throw new TypeError(k+' invalid');};
const finite=(x,k,min,max)=>{
  if(typeof x!=='number'||!Number.isFinite(x)||x<min||x>max)
    throw new TypeError(k+' outside valid observed range');
};
function initPropulsion(){
  const engine=()=>({
    phase:'OFF',startSwitch:'OFF',startLever:'CUTOFF',
    n2Pct:0,n1Rotating:false,maxMotoring:false,
    lightoffConfirmed:false,generatorHealthy:true,
    startValveOpenFeedback:null
  });
  return {
    mode:'LEGACY_FIXTURE',
    engines:{'1':engine(),'2':engine()},
    ignitionSelect:'R',
    safety:initializeProtection(),
    apu:{phase:'OFF',switch:'OFF',inletDoorOpen:false,
      fireSwitchIn:true,groundFireHandleIn:true,
      generatorHealthy:true,bleedSwitchOn:false,
      dcBoostPumpHealthy:true,stabilizationSeconds:0,
      fault:null},
    pneumatic:{groundCartOn:false,crossbleedOn:false,
      ductPsi:null,fieldElevationFt:0}
  };
}
function synchronizedInputs(snapshot){
  const e=JSON.parse(JSON.stringify(snapshot.electrical));
  const pumps=JSON.parse(JSON.stringify(snapshot.pumps));
  if(!snapshot.propulsion||snapshot.propulsion.mode!=='INTEGRATED')return {electrical:e,pumps};
  const p=snapshot.propulsion;
  e.available.GEN1=p.engines['1'].phase==='RUNNING'&&p.engines['1'].generatorHealthy;
  e.available.GEN2=p.engines['2'].phase==='RUNNING'&&p.engines['2'].generatorHealthy;
  e.available.APU=p.apu.phase==='AVAILABLE'&&p.apu.generatorHealthy;
  pumps.hydraulic.engineDriven.A.engineRunning=p.engines['1'].phase==='RUNNING';
  pumps.hydraulic.engineDriven.B.engineRunning=p.engines['2'].phase==='RUNNING';
  return {electrical:e,pumps};
}
function fuelAccess(feed, side){
  const f=feed.fuel.engineFeed['ENGINE'+side];
  const ok=['CENTER_PRIORITY','MAIN_TANK_PUMPED'].includes(f.source);
  return {state:ok?'PRESSURIZED':
    f.source==='UNKNOWN'?'UNKNOWN':'UNCONFIRMED',
    source:f.source,certainty:f.certainty,
    note:'Suction feed possible does not guarantee fuel during start'};
}
function ignitionSupply(p,electrical){
  const left=electrical.buses.transfer1==='POWERED'&&
    electrical.buses.transfer2==='POWERED'?'AVAILABLE':
    electrical.buses.transfer1==='UNPOWERED'&&
    electrical.buses.transfer2==='UNPOWERED'?'UNAVAILABLE':'UNKNOWN';
  const right=electrical.buses.acStandby==='POWERED'?'AVAILABLE':
    electrical.buses.acStandby==='UNPOWERED'?'UNAVAILABLE':'UNKNOWN';
  let state=p.ignitionSelect==='L'?left:p.ignitionSelect==='R'?right:
    (left==='AVAILABLE'||right==='AVAILABLE'?'AVAILABLE':
      left==='UNAVAILABLE'&&right==='UNAVAILABLE'?'UNAVAILABLE':'UNKNOWN');
  return {state,left,right,selector:p.ignitionSelect,
    caveat:'Left igniter AC transfer bus exact side unverified; L-only uncertain in partial-bus modes',
    source:src('7.20.8',[1209])};
}
function evaluatePropulsion(p,electrical,feed,pumps){
  if(!p||p.mode!=='INTEGRATED')return {mode:'LEGACY_FIXTURE',authority:'NONE'};
  const bat=electrical.buses.battery;
  const usable=electrical.buses.hotBattery==='POWERED';
  const apu=p.apu;
  const ready=apu.phase==='AVAILABLE';
  const apuDC=electrical.config && electrical.buses.hotBattery==='POWERED';
  const tank1=pumps.fuel.fuelAtInlet.MAIN1;
  const aFuel=tank1?(feed.fuel.engineFeed.ENGINE1.source==='CENTER_PRIORITY'||
      feed.fuel.engineFeed.ENGINE1.source==='MAIN_TANK_PUMPED'?
      'PRESSURIZED_FROM_LEFT_MANIFOLD':'SUCTION_NO1_DC_BOOST'):
      'NO_NO1_FUEL';
  const dcBoost=apu.phase==='DOOR_OPENING'||apu.phase==='STARTING'?
    (apu.dcBoostPumpHealthy&&usable?'RUNNING':'UNAVAILABLE'):
    ready?'OFF_AT_GOVERNED':'OFF';
  const pneumaticRouting=evaluatePneumatics(p,electrical);
  const apuBleed=pneumaticRouting.apuBleedValve.projectedOpen;
  const other=p.engines;
  const srcAir=pneumaticRouting.engines['1'].source===
    pneumaticRouting.engines['2'].source?
      pneumaticRouting.engines['1'].source:'MIXED';
  const minDuct= Math.max(0,30-0.5*(p.pneumatic.fieldElevationFt/1000));
  const pressure=p.pneumatic.ductPsi===null?'UNMEASURED':
    p.pneumatic.ductPsi>=minDuct?'ADEQUATE':'LOW';
  const airReady=pressure==='ADEQUATE';
  const ig=ignitionSupply(p,electrical);
  const engines={};
  for(const id of ENGINE_IDS){
    const eng=p.engines[id];
    const ownAir=pneumaticRouting.engines[id];
    const dc=bat==='POWERED';
    const valveCommand=eng.startSwitch==='GRD'?
      (dc?'COMMAND_OPEN':'UNPOWERED'):'COMMAND_CLOSED';
    const fuel=fuelAccess(feed,id);
    const gate=(eng.n2Pct>=25&&eng.n1Rotating) ||
      (eng.maxMotoring&&eng.n2Pct>=20&&eng.n1Rotating);
    const ignitionAvailable=ig.state==='AVAILABLE'&&eng.startLever==='IDLE' &&
      ['GRD','CONT','FLT'].includes(eng.startSwitch);
    let status='OFF';
    if(eng.phase==='RUNNING')status='RUNNING_CONFIRMED';
    else if(eng.startSwitch==='GRD'){
      status=!dc?'NO_DC_START_VALVE':
        !(airReady&&ownAir.access==='AVAILABLE')?'AIR_NOT_CONFIRMED':
        !gate?'MOTORING_BELOW_FUEL_INTRODUCTION':
        eng.startLever!=='IDLE'?'READY_FOR_START_LEVER':
        fuel.state!=='PRESSURIZED'?'FUEL_NOT_CONFIRMED':
        !ignitionAvailable?'IGNITION_NOT_CONFIRMED':
        eng.lightoffConfirmed?'LIGHTOFF_CONFIRMED':'AWAITING_LIGHTOFF_CONFIRMATION';
    }
    engines[id]={
      phase:eng.phase,startSwitch:eng.startSwitch,
      startLever:eng.startLever,n2Pct:eng.n2Pct,n1Rotating:eng.n1Rotating,
      starterValveCommand:valveCommand,
      startValveOpenIndication:eng.startValveOpenFeedback===null?null:eng.startValveOpenFeedback,
      air:{source:ownAir.source,measuredPsi:p.pneumatic.ductPsi,minimumPsi:minDuct,
        pressure:pressure,available:airReady&&ownAir.access==='AVAILABLE'},
      dcStarterPower:bat,ignition:{...ig,available:ignitionAvailable},
      fuel,lightoffConfirmed:eng.lightoffConfirmed,
      status,generatorAvailable:eng.phase==='RUNNING'&&eng.generatorHealthy,
      source:src('7.20.7-8,NP.21.34-35',[1208,1209,134,135])
    };
  }
  return {
    mode:'INTEGRATED',engines,
    apu:{
      phase:apu.phase,switch:apu.switch,inletDoorOpen:apu.inletDoorOpen,
      startPower:usable&&electrical.buses.switchedHotBattery==='POWERED'?'AVAILABLE':'UNAVAILABLE',
      batterySwitchRequired:true,fuel:aFuel,dcBoostPump:dcBoost,
      generatorAvailable:ready&&apu.generatorHealthy,
      generatorOffBusLightDemand:ready&&!Object.values(electrical.sourceAssignments).includes('APU'),
      bleedSource:apuBleed?'AVAILABLE':'OFF',
      recommendedBleedWarmup:{
        completed:apu.stabilizationSeconds>=60,
        secondsObserved:apu.stabilizationSeconds,
        advisoryOnly:true
      },
      fault:apu.fault,source:src('7.30.1-3',[1216,1217,1218])
    },
    pneumatic:{source:srcAir,ductPsi:p.pneumatic.ductPsi,
      minimumForStartPsi:minDuct,status:pressure,distribution:pneumaticRouting},
    protection:evaluateStartProtections(p),
    unresolved:['No automatic N2, N1, fuel-flow or EGT computation',
      'Pneumatic duct pressure is an external measurement',
      'Engine generator quality/transient after idle not modeled',
      'Actual starter-valve feedback distinct from command',
      'Exact left igniter transfer bus feeder side not WDM-verified'],
    source:src('NP.21.34-35;7.20.7-8;7.30.1-3',[134,135,1208,1209,1216,1217,1218])
  };
}
function applyPropulsionAction(p,action,context){
  if(!p||p.mode!=='INTEGRATED')throw new TypeError('ISN06 integrated mode required');
  const q=action,apu=p.apu;
  const chooseEngine=()=>{
    const id=String(q.engine);
    enumVal(id,ENGINE_IDS,'engine');return p.engines[id];
  };
  const b=()=>requireBool(q.value,'value');
  switch(q.type){
    case 'SET_APU_SWITCH':
      enumVal(q.value,['OFF','ON','START'],'APU switch');
      apu.switch=q.value;
      if(q.value==='OFF'){
        apu.phase='OFF';apu.inletDoorOpen=false;apu.bleedSwitchOn=false;
        apu.stabilizationSeconds=0;apu.fault=null;
      }else if(q.value==='START'){
        if(context.electrical.buses.switchedHotBattery!=='POWERED' ||
           !apu.fireSwitchIn || !apu.groundFireHandleIn){
          apu.phase='OFF';apu.fault='APU_START_INTERLOCK';apu.switch='ON';
        }else{
          apu.phase='DOOR_OPENING';apu.inletDoorOpen=false;
          apu.stabilizationSeconds=0;apu.fault=null;apu.switch='ON';
        }
      }
      break;
    case 'SET_APU_INLET_OPEN':
      b();apu.inletDoorOpen=q.value;
      if(q.value && apu.phase==='DOOR_OPENING')apu.phase='STARTING';
      break;
    case 'CONFIRM_APU_READY':
      if(apu.phase!=='STARTING'||!apu.inletDoorOpen ||
         !context.electrical.buses.hotBattery ||
         context.electrical.buses.hotBattery!=='POWERED' ||
         !apu.dcBoostPumpHealthy||!context.fuelAtInlet.MAIN1)
        throw new Error('APU ready cannot be confirmed: start/door/DC fuel prerequisites missing');
      apu.phase='AVAILABLE';apu.stabilizationSeconds=0;break;
    case 'SET_APU_BLEED':
      b();apu.bleedSwitchOn=q.value;break;
    case 'SET_APU_FIRE_SWITCH_IN':
      b();apu.fireSwitchIn=q.value;
      if(!q.value){apu.phase='OFF';apu.bleedSwitchOn=false;apu.switch='OFF';}
      break;
    case 'SET_APU_GROUND_FIRE_HANDLE_IN':
      b();apu.groundFireHandleIn=q.value;
      if(!q.value){apu.phase='OFF';apu.bleedSwitchOn=false;apu.switch='OFF';}
      break;
    case 'SET_APU_DC_BOOST_HEALTH':
      b();apu.dcBoostPumpHealthy=q.value;break;
    case 'SET_APU_GENERATOR_HEALTH':
      b();apu.generatorHealthy=q.value;break;
    case 'ADVANCE_SECONDS':
      finite(q.value,'seconds',0,3600);
      if(apu.phase==='AVAILABLE')apu.stabilizationSeconds+=q.value;
      break;
    case 'SET_GROUND_CART':
      b();p.pneumatic.groundCartOn=q.value;break;
    case 'SET_CROSSBLEED':
      b();p.pneumatic.crossbleedOn=q.value;break;
    case 'SET_DUCT_PSI':
      if(q.value!==null)finite(q.value,'duct psi',0,200);
      p.pneumatic.ductPsi=q.value;break;
    case 'SET_FIELD_ELEVATION_FT':
      finite(q.value,'field elevation ft',0,15000);
      p.pneumatic.fieldElevationFt=q.value;break;
    case 'SET_IGNITION_SELECTOR':
      enumVal(q.value,['L','R','BOTH'],'ignition select');
      p.ignitionSelect=q.value;break;
    case 'SET_ENGINE_START_SWITCH':{
      const eng=chooseEngine();
      enumVal(q.value,['OFF','GRD','CONT','FLT'],'engine start switch');
      if(q.value==='GRD' && eng.startSwitch!=='GRD')verifyStartAttempt(p,String(q.engine));
      eng.startSwitch=q.value;break;
    }
    case 'SET_ENGINE_START_LEVER':{
      const eng=chooseEngine();
      enumVal(q.value,['CUTOFF','IDLE'],'start lever');
      eng.startLever=q.value;
      if(q.value==='CUTOFF'){
        eng.phase='OFF';eng.lightoffConfirmed=false;
      }
      break;
    }
    case 'SET_ENGINE_N2':{
      const eng=chooseEngine();
      finite(q.value,'N2%',0,110);eng.n2Pct=q.value;
      if(eng.startSwitch==='GRD'&&q.value>=46)eng.startSwitch='OFF';
      break;
    }
    case 'SET_ENGINE_N1_ROTATION':
      b();chooseEngine().n1Rotating=q.value;break;
    case 'SET_ENGINE_MAX_MOTORING':
      b();chooseEngine().maxMotoring=q.value;break;
    case 'SET_ENGINE_START_VALVE_FEEDBACK':
      if(q.value!==null)b();
      chooseEngine().startValveOpenFeedback=q.value;break;
    case 'SET_ENGINE_GENERATOR_HEALTH':
      b();chooseEngine().generatorHealthy=q.value;break;
    case 'CONFIRM_ENGINE_LIGHTOFF':{
      const eng=chooseEngine(),evaluated=context.propulsion.engines[String(q.engine)];
      if(eng.startLever!=='IDLE' || evaluated.status!=='AWAITING_LIGHTOFF_CONFIRMATION')
        throw new Error('Engine lightoff prerequisites not met: N2, air, power, fuel or ignition');
      eng.lightoffConfirmed=true;eng.phase='MOTORING';break;
    }
    case 'CONFIRM_ENGINE_IDLE':{
      const eng=chooseEngine();
      if(!eng.lightoffConfirmed||eng.n2Pct<46||eng.startLever!=='IDLE')
        throw new Error('Stable idle requires confirmed lightoff, N2 >=46 and lever IDLE');
      eng.phase='RUNNING';eng.startSwitch='OFF';break;
    }
    case 'ABORT_ENGINE_START':{
      const eng=chooseEngine();
      eng.phase='OFF';eng.startLever='CUTOFF';
      eng.startSwitch='OFF';eng.lightoffConfirmed=false;break;
    }
    default:throw new TypeError('Unsupported propulsion action '+String(q.type));
  }
}
const PROPULSION_COMMANDS=new Set([
'SET_APU_SWITCH','SET_APU_INLET_OPEN','CONFIRM_APU_READY','SET_APU_BLEED',
'SET_APU_FIRE_SWITCH_IN','SET_APU_GROUND_FIRE_HANDLE_IN',
'SET_APU_DC_BOOST_HEALTH','SET_APU_GENERATOR_HEALTH','ADVANCE_SECONDS',
'SET_GROUND_CART','SET_CROSSBLEED','SET_DUCT_PSI',
'SET_FIELD_ELEVATION_FT','SET_IGNITION_SELECTOR',
'SET_ENGINE_START_SWITCH','SET_ENGINE_START_LEVER','SET_ENGINE_N2',
'SET_ENGINE_N1_ROTATION','SET_ENGINE_MAX_MOTORING',
'SET_ENGINE_START_VALVE_FEEDBACK','SET_ENGINE_GENERATOR_HEALTH',
'CONFIRM_ENGINE_LIGHTOFF','CONFIRM_ENGINE_IDLE','ABORT_ENGINE_START']);
module.exports={initPropulsion,synchronizedInputs,evaluatePropulsion,
  applyPropulsionAction,PROPULSION_COMMANDS};
