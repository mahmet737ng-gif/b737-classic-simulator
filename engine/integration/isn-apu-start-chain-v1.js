/* ISN-03 / cockpit training harness. Distinct from certified FCOM rules:
 * discrete time checkpoints below are compressed classroom steps and are
 * explicitly marked TRAINING_SEQUENCE_SIMULATED, never physical sensors.
 * The real electrical, fuel/hydraulic and pneumatic discrete model is reused.
 */
(function(root,factory){'use strict';const api=factory(root?.B737ISNEngineStartDynamicsV1||(typeof require==='function'?require('./isn-engine-start-dynamics-v1'):null));if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.B737ISNAPUStartChainV1=api;})(typeof globalThis!=='undefined'?globalThis:null,function(Dynamics){
 'use strict';
 if(!Dynamics?.sample)throw Error('ISN engine start dynamics dependency required');
 const ORIGIN='TRAINING_SEQUENCE_SIMULATED';
 const CONTROLS=Object.freeze({'apu-start':'apu','engine-start-1':'engine1','engine-start-2':'engine2'});
 const FAULT_KEYS=Object.freeze(['n2Stall','egtHigh','noLightOff','hungStart','earlyCutout','flameOut']);
 const FAULT_TIMING=Object.freeze({earlyCutoutMs:650,flameOutAfterRunningMs:700});
 const copy=v=>JSON.parse(JSON.stringify(v));
 // The fault is a classroom curve. Queue its crossing before the normal
 // completion checkpoint so a large advance() cannot skip the 725°C gate.
 const HIGH_EGT_THRESHOLD_MS=(()=>{let low=0,high=Dynamics.duration.lightoffMs;
  for(let i=0;i<24;i++){const mid=(low+high)/2;
   if(Dynamics.sample('LIGHT_OFF_SEQUENCE',mid,{egtHigh:true}).egtC>=725)high=mid;else low=mid;}
  return Math.ceil(high);
 })();
 class Chain{
  constructor(start){if(!start?.send||!start?.core?.pack||!start?.core?.pneumaticState)throw Error('ISN-03 start session required');
   this.start=start;this.time=0;this.jobs=[];this.phase={apu:'OFF',engine1:'OFF',engine2:'OFF'};
   this.effects=[];this.lastError='';this.controls={};this.guards={};this.started={engine1:false,engine2:false};
   this.dynamic={engine1:null,engine2:null};
   this.operating={engine1:null,engine2:null};this.throttle={engine1:0,engine2:0};
   this.flight={onGround:true};
   this.trainingFaults=Object.fromEntries(['engine1','engine2'].map(device=>
    [device,Object.fromEntries(FAULT_KEYS.map(key=>[key,false]))]));
   for(const device of ['engine1','engine2','apu'])this.obs(device,false);
   this.feedback('apu','cockpitFireHandleIn',true);
   this.feedback('apu','groundFireHandleIn',true);
   for(const device of ['engine1','engine2'])this.feedback(device,'fuelStartLever','CUTOFF');
   this.start.send({type:'IGNITION_SELECTOR',position:'BOTH'});
   this.syncPower();
  }
  command(cmd){return this.start.send(cmd);}
  observed(key,value){return this.command({type:'POWER_FEEDBACK',key,value,origin:ORIGIN,training:true});}
  feedback(device,key,value){return this.command({type:'FEEDBACK',device,key,value,origin:ORIGIN,training:true});}
  obs(device,running){return this.command({type:'SOURCE_OBSERVATION',device,running,origin:ORIGIN,training:true});}
  schedule(device,ms,fn){this.jobs.push({device,at:this.time+ms,fn});this.jobs.sort((a,b)=>a.at-b.at);}
  cancel(device){this.jobs=this.jobs.filter(j=>j.device!==device);}
  advance(ms){if(!Number.isFinite(ms)||ms<0)throw Error('Nonnegative elapsed ms required');
   const end=this.time+ms;let count=0;
   while(this.jobs.length&&this.jobs[0].at<=end){if(++count>100)throw Error('Training queue limit');
    const job=this.jobs.shift();this.updateDynamics(job.at);this.time=job.at;job.fn();this.syncPower();}
   this.updateDynamics(end);this.time=end;return this.get();
  }
  updateDynamics(at){for(const device of ['engine1','engine2']){
   const operating=this.operating[device];
   if(this.phase[device]==='RUNNING'&&operating&&at>=operating.at){
    const values=Dynamics.stepRunning(operating.values,{
     deltaMs:at-operating.at,throttle:this.throttle[device],onGround:this.flight.onGround});
    this.operating[device]={at,values};
    // Training feedback never replaces externally-owned sensor/instructor observations.
    const feedback=this.start.get().observation[device].feedback;
    for(const [key,value] of [['n2Percent',values.n2Percent],['egtC',values.egtC],
     ['fuelFlowKgHr',values.fuelFlowKgHr]]){
     if(feedback[key]?.origin===null||feedback[key]?.origin===ORIGIN)this.feedback(device,key,value);
    }
   }
   const active=this.dynamic[device];if(!active||this.phase[device]!==active.phase)continue;
   const value=Dynamics.sample(active.phase,Math.max(0,at-active.since),this.trainingFaults[device]);
   this.feedback(device,'n2Percent',value.n2Percent);
   if(value.egtC!==null)this.feedback(device,'egtC',value.egtC);
   this.feedback(device,'fuelFlowKgHr',value.fuelFlowKgHr);
   if(active.phase==='LIGHT_OFF_SEQUENCE'&&this.trainingFaults[device].egtHigh&&value.egtC>=725){
    this.cancel(device);this.dynamic[device]=null;this.phase[device]='ABNORMAL_EGT';
    this.lastError=device.toUpperCase()+': TRAINING EGT >=725°C — move START LEVER to CUTOFF';
   }
  }}
  setTrainingFault(device,key,active){
   if(!['engine1','engine2'].includes(device)||!FAULT_KEYS.includes(key)||typeof active!=='boolean')
    throw Error('Invalid instructor start fault');
   if(!['OFF','BLOCKED'].includes(this.phase[device]))
    throw Error('Set instructor start fault before ENGINE START GRD');
   // Only one injected failure per engine; the other engine remains independent.
   if(active)for(const other of FAULT_KEYS)if(other!==key)this.trainingFaults[device][other]=false;
   this.trainingFaults[device][key]=active;return this.get();
  }
  syncPower(){const p=this.start.core.pack;
   const e=p.get().electrical.bus,c=p.electricalState.config;
   for(const [key,val] of Object.entries({batterySwitchOn:c.batterySwitch,batteryBusPowered:e.battery,
    acTransferBusPowered:e.transfer1||e.transfer2,acStandbyBusPowered:e.acStandby,onGround:c.onGround})){
    if(this.start.powerFeedback[key].value!==val)this.observed(key,val);
   }
   if(['INLET_DOOR','STARTING','READY'].includes(this.phase.apu)&&
      this.start.get().observation.apu.rules.prerequisitesSatisfied===false){
    this.cancel('apu');this.phase.apu='STOPPING';this.lastError='APU start/operation inhibited: battery or fire handle prerequisite lost';
    this.schedule('apu',250,()=>{this.obs('apu',false);this.feedback('apu','genOffBusLight',false);this.phase.apu='OFF';});
   }
   for(const device of ['engine1','engine2'])if(['MOTORING','N2_STALLED','AWAIT_FUEL_LEVER_IDLE','LIGHT_OFF_SEQUENCE','ABNORMAL_EGT','NO_LIGHT_OFF','HUNG_START'].includes(this.phase[device])){
    const reason=this.canStartEngine(device);
    if(reason){this.abortEngine(device);this.lastError=device.toUpperCase()+': start aborted — '+reason;}
   }
  }
  synchronize(packet){if(!packet?.toggles||!packet?.guards||!packet?.rotaries)throw Error('Real overhead snapshot required');
   const guard=packet.guards['battery-master']?.value;
   if(['on','off'].includes(guard)&&this.guards.battery!==guard)
    this.command({type:'ELECTRICAL',action:{type:'CONTROL',key:'batterySwitch',value:guard==='on'}});
   this.guards.battery=guard;
   const onGround=packet.context?.onGround;
   if(typeof onGround==='boolean'&&this.guards.onGround!==onGround)
    this.command({type:'ELECTRICAL',action:{type:'CONTROL',key:'onGround',value:onGround}});
   this.guards.onGround=onGround;
   if(typeof onGround==='boolean')this.flight.onGround=onGround;
   for(const [id,key] of [['bleed-apu','apuBleed'],['bleed-eng-1','engineBleed1'],['bleed-eng-2','engineBleed2'],
    ['pack-l','packL'],['pack-r','packR'],['isolation-valve','isolation']]){
    if(typeof packet.toggles[id]==='string'&&packet.toggles[id]!==this.controls[id])
     this.command({type:'PNEUMATIC',action:{type:'CONTROL',key,value:packet.toggles[id]}});
   }
   const ign=packet.rotaries['ignition-source'];if(['IGN L','BOTH','IGN R'].includes(ign)&&ign!==this.controls['ignition-source'])
    this.command({type:'IGNITION_SELECTOR',position:ign.replace(' ','_')});
   this.controls=copy({...packet.toggles,...packet.rotaries});this.syncPower();return this.get();
  }
  event(event){if(!event||typeof event.id!=='string')return this.get();
   const id=event.id,value=event.kind==='guarded'?event.next?.value:event.next;
   if(typeof value!=='string')return this.get();
   this.controls[id]=value;
   if(id==='battery-master'&&['on','off'].includes(value)){
    this.guards.battery=value;
    this.command({type:'ELECTRICAL',action:{type:'CONTROL',key:'batterySwitch',value:value==='on'}});
   }
   if(['bleed-apu','bleed-eng-1','bleed-eng-2','pack-l','pack-r','isolation-valve'].includes(id)){
    const keys={'bleed-apu':'apuBleed','bleed-eng-1':'engineBleed1','bleed-eng-2':'engineBleed2','pack-l':'packL','pack-r':'packR','isolation-valve':'isolation'};
    this.command({type:'PNEUMATIC',action:{type:'CONTROL',key:keys[id],value}});
   }
   if(id==='ignition-source')this.command({type:'IGNITION_SELECTOR',position:value.replace(' ','_')});
   if(id==='apu-start'&&value==='START')this.startAPU();
   if(id==='apu-start'&&value==='OFF')this.stopAPU();
   if((id==='engine-start-1'||id==='engine-start-2')&&value==='GRD')this.startEngine(CONTROLS[id]);
   if((id==='engine-start-1'||id==='engine-start-2')&&value==='OFF'&&
     this.phase[CONTROLS[id]]!=='RUNNING')this.abortEngine(CONTROLS[id]);
   this.syncPower();return this.get();
  }
  startAPU(){
   this.lastError='';this.cancel('apu');this.command({type:'APU_SWITCH',position:'START'});
   // Restore the actual cockpit-selected bleed switch after a prior APU OFF.
   // Physical valve still requires a running source; no air is synthesized.
   if(this.controls['bleed-apu']==='ON')
    this.command({type:'PNEUMATIC',action:{type:'CONTROL',key:'apuBleed',value:'ON'}});
   const r=this.start.get().observation.apu.rules;
   if(r.prerequisitesSatisfied!==true){this.phase.apu='BLOCKED';this.lastError='APU requires BATTERY ON, battery power and both APU fire handles IN';return;}
   this.phase.apu='INLET_DOOR';
   this.schedule('apu',400,()=>{if(this.phase.apu!=='INLET_DOOR')return;this.feedback('apu','inletDoorOpen',true);this.feedback('apu','starterEngaged',true);this.phase.apu='STARTING';});
   this.schedule('apu',1400,()=>{if(this.phase.apu!=='STARTING')return;
    this.feedback('apu','starterEngaged',false);this.obs('apu',true);
    this.feedback('apu','genOffBusLight',true);this.phase.apu='READY';});
  }
  stopAPU(){this.cancel('apu');this.command({type:'APU_SWITCH',position:'OFF'});
   this.phase.apu='STOPPING';this.schedule('apu',400,()=>{
    this.obs('apu',false);this.feedback('apu','genOffBusLight',false);
    this.feedback('apu','inletDoorOpen',false);this.phase.apu='OFF';});
  }
  canStartEngine(device){
   const apu=this.start.get().observation.apu.running;
   const n=this.start.core.pneumaticState,c=n.controls;
   const b=this.start.core.pack.get().electrical.bus;
   if(apu!==true)return 'APU NOT READY';
   if(c.apuBleed!=='ON')return 'APU BLEED OFF';
   if(c.isolation==='CLOSE')return 'ISOLATION VALVE CLOSED';
   if(c.packL!=='OFF'||c.packR!=='OFF')return 'PACK L/R MUST BE OFF FOR ENGINE START';
   if(b.battery!==true)return 'BATTERY BUS NOT AVAILABLE';
   const ign=this.start.controls.ignitionSelector;
   const left=ign==='IGN_L'||ign==='BOTH',right=ign==='IGN_R'||ign==='BOTH';
   if(!(left&&b.transfer1===true||right&&b.acStandby===true))
    return 'IGNITION AC SUPPLY NOT READY — SELECT APU GEN';
   return null;
  }
  startEngine(device){
   const fuelLever=this.start.get().observation[device].feedback.fuelStartLever.value;
   if(!['OFF','BLOCKED'].includes(this.phase[device])||fuelLever!=='CUTOFF'){
    this.lastError=device.toUpperCase()+': START LEVER CUTOFF and a stopped start sequence required before GRD';
    this.effects.push({type:'ROTARY_RELEASE',id:device==='engine1'?'engine-start-1':'engine-start-2',position:'OFF'});
    return;
   }
   this.lastError='';this.cancel(device);this.started[device]=false;
   this.dynamic[device]=null;this.operating[device]=null;
   this.feedback(device,'n2Percent',0);
   this.feedback(device,'egtC',null);this.feedback(device,'fuelFlowKgHr',0);
   this.command({type:'ENGINE_START_SWITCH',device,position:'GRD'});
   this.syncPower();
   const failure=this.canStartEngine(device);
   if(failure){this.phase[device]='BLOCKED';this.lastError=device.toUpperCase()+': '+failure;return;}
   this.feedback(device,'startAirAvailable',true);this.feedback(device,'startValveOpen',true);
   this.feedback(device,'starterEngaged',true);
   this.phase[device]='MOTORING';
   this.dynamic[device]={phase:'MOTORING',since:this.time};
   if(this.trainingFaults[device].earlyCutout)this.schedule(device,FAULT_TIMING.earlyCutoutMs,()=>{
    if(this.phase[device]!=='MOTORING')return;
    this.cancel(device);this.dynamic[device]=null;
    this.feedback(device,'startValveOpen',false);this.feedback(device,'startAirAvailable',false);
    this.feedback(device,'starterEngaged',false);
    this.command({type:'ENGINE_START_SWITCH',device,position:'OFF'});
    this.command({type:'SOURCE_REQUEST',device,request:'SHUTDOWN'});
    this.phase[device]='EARLY_STARTER_CUTOUT';
    this.lastError=device.toUpperCase()+': INJECTED EARLY STARTER CUTOUT — confirm START LEVER CUTOFF';
    this.effects.push({type:'ROTARY_RELEASE',id:device==='engine1'?'engine-start-1':'engine-start-2',position:'OFF'});
   });
   this.schedule(device,850,()=>{if(this.phase[device]!=='MOTORING')return;
    if(this.trainingFaults[device].n2Stall){this.dynamic[device]=null;this.phase[device]='N2_STALLED';
     this.lastError=device.toUpperCase()+': TRAINING N2 STALL — START LEVER remains CUTOFF';return;}
    this.feedback(device,'n1RotationObserved',true);this.feedback(device,'maxMotoringObserved',false);
    this.feedback(device,'n2Percent',25);this.phase[device]='AWAIT_FUEL_LEVER_IDLE';});
  }
  setThrottle(device,value){
   if(!['engine1','engine2'].includes(device)||!Number.isFinite(value)||value<0||value>1)
    throw Error('Engine and normalized throttle in [0,1] required');
   this.throttle[device]=value;return this.get();
  }
  setOnGround(onGround){if(typeof onGround!=='boolean')throw Error('Boolean onGround required');
   this.flight.onGround=onGround;return this.get();
  }
  lever(device,position){if(!['engine1','engine2'].includes(device)||!['IDLE','CUTOFF'].includes(position))throw Error('Invalid start lever');
   if(position==='CUTOFF'){this.operating[device]=null;this.feedback(device,'fuelStartLever','CUTOFF');if(this.phase[device]!=='RUNNING')this.abortEngine(device);else{
    this.cancel(device);this.dynamic[device]=null;
    this.feedback(device,'fuelFlowKgHr',0);this.feedback(device,'n2Percent',null);
    this.feedback(device,'egtC',null);this.command({type:'SOURCE_REQUEST',device,request:'SHUTDOWN'});
    this.obs(device,false);this.started[device]=false;this.phase[device]='OFF';}
    this.lastError='';return this.get();}
   if(this.phase[device]!=='AWAIT_FUEL_LEVER_IDLE'){
    this.lastError=device.toUpperCase()+': START LEVER IDLE requires starter motoring';return this.get();}
   const rule=this.start.get().observation[device].rules;
   if(rule.fuel.recommendMovingLeverToIdle!==true){this.lastError='WAIT FOR N1 ROTATION AND N2';return this.get();}
   this.feedback(device,'fuelStartLever','IDLE');
   this.lastError='';this.phase[device]='LIGHT_OFF_SEQUENCE';
   this.dynamic[device]={phase:'LIGHT_OFF_SEQUENCE',since:this.time};
   this.feedback(device,'fuelFlowKgHr',400);this.feedback(device,'egtC',0);
   if(this.trainingFaults[device].egtHigh)this.schedule(device,HIGH_EGT_THRESHOLD_MS,()=>{});
   this.schedule(device,1000,()=>{if(this.phase[device]!=='LIGHT_OFF_SEQUENCE')return;
    this.dynamic[device]=null;
    if(this.trainingFaults[device].noLightOff||this.trainingFaults[device].hungStart){
     this.phase[device]=this.trainingFaults[device].noLightOff?'NO_LIGHT_OFF':'HUNG_START';
     this.lastError=device.toUpperCase()+': INJECTED '+this.phase[device]+' — move START LEVER to CUTOFF';
     return;
    }
    this.feedback(device,'n2Percent',46);this.feedback(device,'startValveOpen',false);
    this.feedback(device,'startAirAvailable',false);this.feedback(device,'starterEngaged',false);
    this.feedback(device,'fuelFlowKgHr',350);this.obs(device,true);this.phase[device]='RUNNING';
    this.started[device]=true;
    this.operating[device]={at:this.time,values:Dynamics.initialRunning()};
    this.effects.push({type:'ROTARY_RELEASE',id:device==='engine1'?'engine-start-1':'engine-start-2',position:'OFF'});
    if(this.trainingFaults[device].flameOut)this.schedule(device,FAULT_TIMING.flameOutAfterRunningMs,()=>{
     if(this.phase[device]!=='RUNNING')return;
     this.operating[device]=null;this.obs(device,false);this.feedback(device,'fuelFlowKgHr',null);
     this.feedback(device,'n2Percent',null);this.feedback(device,'egtC',null);
     this.command({type:'SOURCE_REQUEST',device,request:'SHUTDOWN'});
     this.started[device]=false;this.phase[device]='FLAMEOUT';
     this.lastError=device.toUpperCase()+': INJECTED FLAMEOUT — move START LEVER to CUTOFF before retry';
    });
   });return this.get();
  }
  abortEngine(device){this.cancel(device);this.dynamic[device]=null;this.operating[device]=null;
   const fuelIdle=this.start.get().observation[device].feedback.fuelStartLever.value==='IDLE';
   // Stopping the starter does not move the fuel lever. With IDLE selected,
   // fuel flow after an abort is unknown, not a fabricated zero.
   this.feedback(device,'fuelFlowKgHr',fuelIdle?null:0);
   this.feedback(device,'n2Percent',null);
   if(!fuelIdle)this.feedback(device,'egtC',null);
   this.feedback(device,'startValveOpen',false);
   this.feedback(device,'startAirAvailable',false);this.feedback(device,'starterEngaged',false);
   this.command({type:'ENGINE_START_SWITCH',device,position:'OFF'});
   this.command({type:'SOURCE_REQUEST',device,request:'SHUTDOWN'});
   if(this.phase[device]!=='RUNNING')this.phase[device]=fuelIdle?'AWAIT_FUEL_CUTOFF':'OFF';
   if(fuelIdle)this.lastError=device.toUpperCase()+': START LEVER remains IDLE — move it to CUTOFF';
  }
  consumeEffects(){const effects=copy(this.effects);this.effects=[];return effects;}
  get(){const engine=this.start.get(),pack=this.start.core.pack.get(),apu=engine.observation.apu;
   const projected={},faultStatus={};for(const device of ['engine1','engine2']){
    const n=Number(device.at(-1)),r=engine.observation[device].rules;
    projected['mainStartValve'+n]=r.starter.startValveOpenObserved===true &&
      engine.observation[device].feedback.startAirAvailable.value===true;
    const feedback=engine.observation[device].feedback,selected=FAULT_KEYS.find(key=>this.trainingFaults[device][key])||null;
    const fuelCutoff=feedback.fuelStartLever.value==='CUTOFF';
    const phaseReady=['OFF','BLOCKED'].includes(this.phase[device]);
    faultStatus[device]={selected,origin:selected?ORIGIN:null,phase:this.phase[device],
     observed:{n2Percent:feedback.n2Percent.value,egtC:feedback.egtC.value,
      fuelFlowKgHr:feedback.fuelFlowKgHr.value,startValveOpen:feedback.startValveOpen.value,
      fuelStartLever:feedback.fuelStartLever.value,running:engine.observation[device].running},
     requiredAction:!fuelCutoff&&['ABNORMAL_EGT','NO_LIGHT_OFF','HUNG_START','FLAMEOUT','AWAIT_FUEL_CUTOFF'].includes(this.phase[device])?
      'MOVE_START_LEVER_TO_CUTOFF':null,
     retryAllowed:phaseReady&&fuelCutoff&&this.canStartEngine(device)===null};
   }
   const apuConnected=Object.values(pack.electrical.source).includes('APU');
   projected['apu-gen-off-bus']=apu.running===true&&!apuConnected;
   projected['apu-low-pressure']=['INLET_DOOR','STARTING'].includes(this.phase.apu);
   return {clockMs:this.time,phase:copy(this.phase),lastError:this.lastError,trainingFaults:copy(this.trainingFaults),
    runningEnvelope:{
     origin:ORIGIN,quality:'SIMULATION_APPROX_ONLY',
     onGround:this.flight.onGround,throttle:copy(this.throttle),
     engines:copy(Object.fromEntries(['engine1','engine2'].map(d=>[d,this.phase[d]==='RUNNING'?
      this.operating[d]?.values??null:null]))),
     limits:copy(Dynamics.ENVELOPE)
    },
    faultStatus:copy(faultStatus),
    sources:copy(engine.network.source),electrical:copy(pack.electrical.bus),
    selectedSources:copy(pack.electrical.source),bleed:copy(this.start.core.Pneumatics.derive(this.start.core.pneumaticState).bleed),
    controls:copy(this.controls),projected,observations:copy(engine.observation),
    trainingNotice:'TRAINING_SEQUENCE_SIMULATED: continuous classroom interpolation between compressed checkpoints; NOT calibrated engine/APU performance or sensor evidence'};
  }
 }
 return Object.freeze({ORIGIN,CONTROLS,FAULT_KEYS,FAULT_TIMING,Chain});
});
