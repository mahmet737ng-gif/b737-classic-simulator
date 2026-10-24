/* ISN-03 Stage 2: source-located B737 Classic discrete start/ignition rules.
 * FCOM 7.10.22/25/29, 7.20.7-9, 7.30.2-3 and NP.21.33-35.
 * No simulated RPM/EGT, engine-running inference, or installation bus wiring.
 * A running source still requires SOURCE_OBSERVATION in ISN-03.
 */
(function(root, factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.B737ISNStartSequenceV1 = api;
})(typeof globalThis !== 'undefined' ? globalThis : null, function() {
  'use strict';
  const SCHEMA = 'b737-isn-start-sequence/1';
  const DEVICES = Object.freeze(['engine1', 'engine2', 'apu']);
  const ORIGINS = Object.freeze(['INSTRUCTOR_OBSERVATION', 'EXTERNAL_SENSOR_OBSERVATION',
    'TRAINING_SEQUENCE_SIMULATED']);
  const TRIT = Object.freeze(['true', 'false', 'null']);
  const ENGINE_FIELDS = Object.freeze({
    starterEngaged: 'TRISTATE', ignitionEnergized: 'TRISTATE',
    fuelStartLever: 'FUEL_LEVER', n2Percent: 'NONNEGATIVE_NUMBER', egtC: 'NUMBER',
    startValveOpen: 'TRISTATE', startAirAvailable: 'TRISTATE',
    n1RotationObserved: 'TRISTATE', maxMotoringObserved: 'TRISTATE',
    fuelFlowKgHr: 'NONNEGATIVE_NUMBER'
  });
  const APU_FIELDS = Object.freeze({
    starterEngaged: 'TRISTATE', rpmPercent: 'NONNEGATIVE_NUMBER', egtC: 'NUMBER',
    inletDoorOpen: 'TRISTATE', cockpitFireHandleIn: 'TRISTATE',
    groundFireHandleIn: 'TRISTATE', genOffBusLight: 'TRISTATE'
  });
  const POWER_FIELDS = Object.freeze({batteryBusPowered:'TRISTATE', batterySwitchOn:'TRISTATE',onGround:'TRISTATE',
    acTransferBusPowered:'TRISTATE', acStandbyBusPowered:'TRISTATE'});
  const START_SWITCHES = Object.freeze(['GRD','OFF','CONT','FLT']);
  const IGNITION_SELECTORS = Object.freeze(['IGN_L','BOTH','IGN_R']);
  const APU_SWITCHES = Object.freeze(['OFF','ON','START']);
  const REF = Object.freeze({engineSwitch:'FCOM 7.10.22, PDF 1193',
    engineLever:'FCOM 7.10.25, PDF 1196', engineStart:'FCOM 7.20.7, PDF 1208',
    ignition:'FCOM 7.20.8, PDF 1209', engineProcedure:'FCOM NP.21.33-35, PDF 133-135',
    apu:'FCOM 7.30.2-3, PDF 1217-1218'});
  const FIELDS = Object.freeze({engine1: ENGINE_FIELDS, engine2: ENGINE_FIELDS, apu: APU_FIELDS});
  const clone = v => JSON.parse(JSON.stringify(v));
  const finite = v => typeof v === 'number' && Number.isFinite(v);
  const triAnd = values => values.includes(false)?false:values.includes(null)?null:true;
  const triOr = values => values.includes(true)?true:values.includes(null)?null:false;
  function validate(device, key, value) {
    const type = FIELDS[device]?.[key];
    if (!type) throw Error('Unknown engine/APU feedback field');
    if (type === 'TRISTATE' && !(value === true || value === false || value === null)) throw Error('Feedback requires true/false/null');
    if (type === 'FUEL_LEVER' && !['CUTOFF', 'IDLE', null].includes(value)) throw Error('Invalid observed fuel start lever');
    if (type === 'NUMBER' && value !== null && !finite(value)) throw Error('Expected finite EGT or null');
    if (type === 'NONNEGATIVE_NUMBER' && value !== null && (!finite(value) || value < 0)) throw Error('Expected nonnegative observed percentage or null');
  }
  function blankFeedback(device) {
    return Object.fromEntries(Object.keys(FIELDS[device]).map(key => [key, {value:null, origin:null}]));
  }
  function engineRules(control, selector, feedback, power, startWindow, advisoryLatched, cutout) {
    const val=key=>feedback[key].value;
    const n2=val('n2Percent'), lever=val('fuelStartLever');
    const switchPos=control.startSwitch;
    // This is a power-dependent command, not evidence that a physical valve moved.
    const startValveCommand=switchPos===null?null:switchPos==='GRD'?power.batteryBusPowered.value:false;
    const startMotorPossible=triAnd([startValveCommand,val('startValveOpen'),val('startAirAvailable')]);
    const ignitionDemand=lever===null||switchPos===null?null:
      lever==='CUTOFF'?false:START_SWITCHES.includes(switchPos)&&switchPos!=='OFF';
    const demandLeft=ignitionDemand===false?false:ignitionDemand===null||(selector===null&&switchPos!=='FLT')?null:
      switchPos==='FLT'||selector==='IGN_L'||selector==='BOTH';
    const demandRight=ignitionDemand===false?false:ignitionDemand===null||(selector===null&&switchPos!=='FLT')?null:
      switchPos==='FLT'||selector==='IGN_R'||selector==='BOTH';
    const leftEligible=triAnd([demandLeft,power.acTransferBusPowered.value]);
    const rightEligible=triAnd([demandRight,power.acStandbyBusPowered.value]);
    // NP.21.34: N1 rotation and either >=25 N2, or max motoring with >=20 N2.
    const n2At25=n2===null?null:n2>=25;
    const maxMotorAt20=n2===null?null:triAnd([n2>=20,val('maxMotoringObserved')]);
    const recommendIdle=triAnd([val('n1RotationObserved'),triOr([n2At25,maxMotorAt20])]);
    const threshold725= !startWindow?false:val('egtC')===null?null:val('egtC')>=725;
    return {source:REF, startSwitch:switchPos, groundStartWindow:startWindow,
      starter:{startValveOpenCommand:startValveCommand,motorDrivePossible:startMotorPossible,
        engineBleedForcedClosedCommand:startValveCommand,
        startValveOpenObserved:val('startValveOpen'), startValveOpenAmberLamp:val('startValveOpen'),
        cutoutAtApprox46N2:cutout,
        cutoutIsApproximate:true,pressurePsi:null,minimumSeaLevelStartPressurePsi:30,
        minimumPressureReductionPsiPer1000Ft:0.5,maxStarterUseSecondsPerAttempt:120,
        firstRetryWaitSeconds:20,laterRetryWaitSeconds:180},
      ignition:{selector, demand:{left:demandLeft,right:demandRight},
        supplyEligible:{left:leftEligible,right:rightEligible},
        energizedObserved:val('ignitionEnergized'),
        leftPowerReference:'AC_TRANSFER_BUS_UNSPECIFIED_SIDE',rightPowerReference:'AC_STANDBY_BUS'},
      fuel:{lever,wingFuelValveOpenCommand:lever===null?null:lever==='IDLE',
        mecShutoffValveOpenCommand:lever===null?null:lever==='IDLE',
        fuelFlowObservedKgHr:val('fuelFlowKgHr'),fuelFlowCalculated:false,
        recommendMovingLeverToIdle:recommendIdle},
      advisory:{egt725Criterion:threshold725,egt725Latched:advisoryLatched,
        calculatedN2OatCriterion:null,accelerationAfter32Criterion:null,
        otherCriterionUnresolved:true,fireBellTriggered:false},
      limitations:['NO_N2_OR_EGT_DYNAMICS','NO_PHYSICAL_START_VALVE_FROM_COMMAND',
        'NO_HUNG_START_RATE_OR_N2_OAT_EGT_LIMIT_FORMULA']};
  }
  function apuRules(control, feedback, power) {
    const val=key=>feedback[key].value;
    const prerequisite=triAnd([power.batterySwitchOn.value,power.batteryBusPowered.value,
      val('cockpitFireHandleIn'),val('groundFireHandleIn')]);
    const requested=control.startRequested;
    const doorCommand=requested?prerequisite:false;
    const afterDoor=triAnd([doorCommand,val('inletDoorOpen')]);
    const batteryOffGround=triAnd([power.onGround.value,
      power.batterySwitchOn.value===null?null:!power.batterySwitchOn.value]);
    const fireHandlePulled=val('cockpitFireHandleIn')===null?null:!val('cockpitFireHandleIn');
    return {source:REF.apu, switchPosition:control.switchPosition, startRequested:requested,
      prerequisitesSatisfied:prerequisite,inletDoorOpenCommand:doorCommand,
      sequenceAfterDoorOpenEligible:afterDoor,
      batteryOffGroundShutdownCondition:batteryOffGround,
      cockpitFireHandleShutdownCondition:fireHandlePulled,
      ignitionAndFuelAtUnspecifiedSpeed:null,genOffBusLightObserved:val('genOffBusLight'),
      maximumStartCycleSeconds:135,cycleElapsedSeconds:null,
      automaticShutdownCauses:['OVERSPEED','LOW_OIL_PRESSURE','HIGH_OIL_TEMPERATURE','APU_FIRE','FCU_FAILURE'],
      overtemperatureResponse:'BLEED_VALVE_MODULATES_OR_CLOSES_APU_CAN_KEEP_RUNNING',
      bleedStabilizationRecommendationSeconds:60,shutdownCooldownRecommendationSeconds:60,
      limitations:['NO_APU_RPM_READY_THRESHOLD','NO_APU_ACCELERATION_TIMEOUT_FORMULA',
        'NO_APU_EGT_SHUTDOWN_THRESHOLD','NO_RUNNING_INFERENCE']};
  }
  function viewPhase(running, request, data) {
    // These are UI/evidence labels, NOT FCOM-defined procedural phases.
    if (request === 'SHUTDOWN') return running === false ? 'STOPPED_OBSERVED_AFTER_REQUEST' : 'SHUTDOWN_REQUESTED_AWAITING_OBSERVATION';
    if (running === true) return 'RUNNING_OBSERVED';
    if (request === 'START') return data.starterEngaged?.value === true
      ? 'STARTER_ACTIVITY_OBSERVED_RUNNING_NOT_PROVEN' : 'START_REQUESTED_RUNNING_NOT_PROVEN';
    return running === false ? 'STOPPED_OBSERVED' : 'UNKNOWN';
  }

  class Session {
    constructor({EngineAPU, ...dependencies} = {}) {
      if (typeof EngineAPU?.Session !== 'function') throw Error('ISN-03 Stage 1 Engine/APU session required');
      this.EngineAPU = EngineAPU;
      this.dependencies = dependencies;
      this.reset();
    }
    reset() {
      this.core = new this.EngineAPU.Session(this.dependencies);
      this.feedback = Object.fromEntries(DEVICES.map(device => [device, blankFeedback(device)]));
      this.powerFeedback=Object.fromEntries(Object.keys(POWER_FIELDS).map(key=>[key,{value:null,origin:null}]));
      this.controls={ignitionSelector:null,engine1:{startSwitch:null},engine2:{startSwitch:null},
        apu:{switchPosition:'OFF',startRequested:false}};
      this.groundStartWindow={engine1:false,engine2:false};
      this.egtAdvisoryLatched={engine1:false,engine2:false};
      this.cutout={engine1:false,engine2:false};
      this.events = [];
      this.seq = 0;
      this.snapshot = this.compute();
      return this.get();
    }
    compute() {
      const core = this.core.get();
      const observation = {};
      for (const device of DEVICES) {
        const running = core.source[device].running;
        const fb = this.feedback[device];
        observation[device] = {
          request: core.requests[device], running,
          phase: viewPhase(running, core.requests[device], fb),
          feedback: clone(fb),
          evidence: {
            running: core.source[device].origin,
            starter: fb.starterEngaged.origin,
            ignition: fb.ignitionEnergized?.origin ?? null,
            fuelLever: fb.fuelStartLever?.origin ?? null,
            speed: (fb.n2Percent ?? fb.rpmPercent).origin,
            egt: fb.egtC.origin
          },
          completionRule: 'RUNNING_REQUIRES_INDEPENDENT_SOURCE_OBSERVATION',
          numericLimits: device==='apu'?'APU_START_MAX_135_SECONDS_OTHER_LIMITS_UNKNOWN':
            'FCOM_NP_25_OR_MAX_MOTORING_MIN_20_N2_APPROX_46_CUTOUT_725_EGT'
        };
        observation[device].rules=device==='apu'?apuRules(this.controls.apu,fb,this.powerFeedback):
          engineRules(this.controls[device],this.controls.ignitionSelector,fb,this.powerFeedback,
            this.groundStartWindow[device],this.egtAdvisoryLatched[device],this.cutout[device]);
      }
      return {
        schema: SCHEMA, seq: this.seq, observation,controls:clone(this.controls),
        powerFeedback:clone(this.powerFeedback),
        network: core,
        limitations: [
          'NO_N2_APU_RPM_OR_EGT_TO_RUNNING_AUTOMATION',
          'ONLY_FCOM_DISCRETE_COMMAND_AND_RECOMMENDATION_RULES',
          'NO_DERIVED_HUNG_START_OR_FIRE_ALARM',
          'NO_ENGINE_DYNAMICS',
          'SOURCE_OBSERVATION_IS_THE_ONLY_RUNNING_STATE_OWNER'
        ]
      };
    }
    changes(before, after, networkChanges) {
      const changes = [];
      const append=(path,from,to,evidence)=>{if(from!==to)changes.push({path,from,to,evidence});};
      append('controls.ignitionSelector',before.controls.ignitionSelector,after.controls.ignitionSelector,REF.ignition);
      append('controls.apu.switchPosition',before.controls.apu.switchPosition,
        after.controls.apu.switchPosition,REF.apu);
      for(const key of Object.keys(POWER_FIELDS)){
        append('powerFeedback.'+key,before.powerFeedback[key].value,after.powerFeedback[key].value,
          after.powerFeedback[key].origin||'OBSERVATION_WITHDRAWN');
      }
      for (const device of DEVICES) {
        const prev = before.observation[device], now = after.observation[device];
        if(device!=='apu')append('controls.'+device+'.startSwitch',before.controls[device].startSwitch,
          after.controls[device].startSwitch,REF.engineStart);
        if (prev.phase !== now.phase) changes.push({path:device+'.phase', from:prev.phase, to:now.phase,
          evidence:'OBSERVATION_PRESENTATION_ONLY_NOT_FCOM_AUTOMATIC_SEQUENCE'});
        for (const [key, item] of Object.entries(now.feedback)) {
          if (prev.feedback[key].value !== item.value) changes.push({path:device+'.feedback.'+key,
            from:prev.feedback[key].value, to:item.value, evidence:item.origin || 'OBSERVATION_WITHDRAWN'});
        }
        if (device!=='apu') {
          for(const path of ['starter.startValveOpenCommand','ignition.supplyEligible.left',
            'ignition.supplyEligible.right','fuel.recommendMovingLeverToIdle','advisory.egt725Latched']) {
            const pick=(o)=>path.split('.').reduce((value,key)=>value?.[key],o.rules);
            if(pick(prev)!==pick(now))changes.push({path:device+'.rules.'+path,
              from:pick(prev),to:pick(now),evidence:'SOURCE_LOCATED_FCOM_7_20_AND_NP_21'});
          }
        }else{
          for(const key of ['prerequisitesSatisfied','inletDoorOpenCommand','sequenceAfterDoorOpenEligible',
            'batteryOffGroundShutdownCondition','cockpitFireHandleShutdownCondition']){
            append('apu.rules.'+key,prev.rules[key],now.rules[key],REF.apu);
          }
        }
      }
      return [...changes, ...networkChanges];
    }
    shutdownAPU() {
      let changes=[];
      const result=this.core.send({type:'SOURCE_REQUEST',device:'apu',request:'SHUTDOWN'});
      changes.push(...(result.recentEvents.at(-1)?.changes??[]));
      // APU generator is disconnected only if specifically selected, preserving GEN1/2.
      for(const side of [1,2])if(this.core.pack.electricalState.source[side]==='APU'){
        const off=this.core.send({type:'ELECTRICAL',action:{type:'SELECT_SOURCE',source:'OFF',side}});
        changes.push(...(off.recentEvents.at(-1)?.changes??[]));
      }
      const bleed=this.core.send({type:'PNEUMATIC',action:{type:'CONTROL',key:'apuBleed',value:'OFF'}});
      changes.push(...(bleed.recentEvents.at(-1)?.changes??[]));
      this.controls.apu.startRequested=false;
      return changes;
    }
    send(command) {
      if (!command || typeof command.type !== 'string') throw Error('Start sequence command required');
      if (command.type === 'RESET') return this.reset();
      const before = this.snapshot;
      let networkChanges = [];
      if (command.type === 'FEEDBACK' || command.type === 'POWER_FEEDBACK') {
        if(command.type==='POWER_FEEDBACK' && !Object.hasOwn(POWER_FIELDS,command.key))throw Error('Unknown power observation');
        if(command.type==='POWER_FEEDBACK' && ![true,false,null].includes(command.value))throw Error('Invalid power observation');
        if(command.type==='FEEDBACK')validate(command.device, command.key, command.value);
        if (!ORIGINS.includes(command.origin) ||
            (command.origin === 'INSTRUCTOR_OBSERVATION' && command.instructor !== true) ||
            (command.origin === 'TRAINING_SEQUENCE_SIMULATED' && command.training !== true)) {
          throw Error('Feedback origin required; instructor observations require instructor:true');
        }
        const store=command.type==='FEEDBACK'?this.feedback[command.device]:this.powerFeedback;
        store[command.key]={value:command.value,origin:command.value===null?null:command.origin};
        const observedGroundOff=this.powerFeedback.onGround.value===true &&
          this.powerFeedback.batterySwitchOn.value===false;
        const fireHandlePulled=this.feedback.apu.cockpitFireHandleIn.value===false;
        if((observedGroundOff||fireHandlePulled) && this.core.get().requests.apu!=='SHUTDOWN' &&
          (this.controls.apu.startRequested||this.core.get().source.apu.running===true))
          networkChanges.push(...this.shutdownAPU());
        if(command.type==='FEEDBACK' && command.device!=='apu') {
          if(command.key==='egtC' && this.groundStartWindow[command.device] &&
             command.value!==null && command.value>=725)this.egtAdvisoryLatched[command.device]=true;
          if(command.key==='fuelFlowKgHr' && command.value===0)this.egtAdvisoryLatched[command.device]=false;
          if(command.key==='n2Percent' && command.value!==null && command.value>=46 &&
             this.controls[command.device].startSwitch==='GRD') {
            this.controls[command.device].startSwitch='OFF';
            this.cutout[command.device]=true;
          }
        }
      } else if (command.type === 'ENGINE_START_SWITCH') {
        if(!['engine1','engine2'].includes(command.device)||!START_SWITCHES.includes(command.position))throw Error('Invalid engine start switch');
        this.controls[command.device].startSwitch=command.position;
        if(command.position==='GRD'){
          this.groundStartWindow[command.device]=true;this.cutout[command.device]=false;
          this.core.send({type:'SOURCE_REQUEST',device:command.device,request:'START'});
          const n2=this.feedback[command.device].n2Percent.value;
          if(n2!==null && n2>=46){this.controls[command.device].startSwitch='OFF';this.cutout[command.device]=true;}
        }
      } else if (command.type === 'IGNITION_SELECTOR') {
        if(!IGNITION_SELECTORS.includes(command.position))throw Error('Invalid ignition selector');
        this.controls.ignitionSelector=command.position;
      } else if (command.type === 'APU_SWITCH') {
        if(!APU_SWITCHES.includes(command.position))throw Error('Invalid APU switch');
        this.controls.apu.switchPosition=command.position==='START'?'ON':command.position;
        if(command.position==='START'){
          this.controls.apu.startRequested=true;
          this.core.send({type:'SOURCE_REQUEST',device:'apu',request:'START'});
        }else if(command.position==='OFF'){
          // FCOM 7.30.3: OFF trips selected APU GEN and closes APU BLEED.
          networkChanges.push(...this.shutdownAPU());
        }
      } else if(command.type==='EGT_ADVISORY_RESET'){
        if(!['engine1','engine2'].includes(command.device)||command.normalStartObserved!==true||command.instructor!==true)
          throw Error('Observed normal start and instructor confirmation required for reset');
        this.egtAdvisoryLatched[command.device]=false;
      } else if(command.type==='SOURCE_OBSERVATION'){
        const result=this.core.send(command);
        networkChanges=result.recentEvents.at(-1)?.changes??[];
        if(command.running===true && ['engine1','engine2'].includes(command.device))this.groundStartWindow[command.device]=false;
      } else if (['SOURCE_REQUEST','ELECTRICAL','PNEUMATIC','PACK'].includes(command.type)) {
        const result = this.core.send(command);
        networkChanges = result.recentEvents.at(-1)?.changes ?? [];
        if(command.type==='SOURCE_REQUEST'&&command.request==='SHUTDOWN'&&
           ['engine1','engine2'].includes(command.device))this.groundStartWindow[command.device]=false;
      } else throw Error('Unsupported start sequence action');
      this.seq++;
      this.snapshot = this.compute();
      this.events.push({seq:this.seq, command:clone(command), changes:this.changes(before,this.snapshot,networkChanges)});
      if (this.events.length > 250) this.events.shift();
      return this.get();
    }
    get() { return {...clone(this.snapshot), recentEvents:clone(this.events)}; }
    replay(commands) { this.reset(); for (const c of commands) this.send(c); return this.get(); }
  }
  return Object.freeze({SCHEMA, DEVICES, ORIGINS, ENGINE_FIELDS, APU_FIELDS, POWER_FIELDS,
    START_SWITCHES,IGNITION_SELECTORS,APU_SWITCHES,REF,TRIT, validate, Session});
});
