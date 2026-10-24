/* ISN-02: evidence-gated control/annunciator bridge for the Unified cockpit.
 * Registry IDs are exact existing interactive-overhead identifiers. This does
 * not modify the approved overhead artwork, create wires or prove LRU feeders.
 */
(function(root,factory){'use strict';const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.B737ISNCockpitBridgeV1=api;})(typeof globalThis!=='undefined'?globalThis:null,function(){
 'use strict';
 const PUMPS=Object.freeze({
  'fuel-center-l':'fuel.centerLeftPump',
  'fuel-center-r':'fuel.centerRightPump',
  'fuel-1-aft':'fuel.main1AftPump',
  'fuel-1-fwd':'fuel.main1FwdPump',
  'fuel-2-fwd':'fuel.main2FwdPump',
  'fuel-2-aft':'fuel.main2AftPump',
  // Existing TrainerCore names elecA = ELEC 2 / SYS A and elecB = ELEC 1 / SYS B.
  // This names the UI connection; it does not certify aircraft feeder wiring.
  'hyd-elec-2':'hyd.electricPumpA',
  'hyd-elec-1':'hyd.electricPumpB'
 });
 const LAMPS=Object.freeze(Object.fromEntries(Object.entries(PUMPS).map(([lamp,pump])=>[pump,lamp])));
 const ELECTRICAL_LAMPS=Object.freeze({
  'busOff1':'busOff1','busOff2':'busOff2',
  'transferBusOff1':'transferBusOff1','transferBusOff2':'transferBusOff2',
  'genOffBus1':'gen-off-bus-1','genOffBus2':'gen-off-bus-2'
 });
 const GUARDED=Object.freeze({'battery-master':'batterySwitch','standby-power':'standbySelector',
  'generator-disconnect-1':'GEN1_FAILED','generator-disconnect-2':'GEN2_FAILED'});
 const SCENARIO=Object.freeze(['engine1Running','engine2Running','apuRunning','groundPowerAttached','onGround']);
 const copy=v=>JSON.parse(JSON.stringify(v));
 const own=(v,k)=>v!==null&&typeof v==='object'&&Object.prototype.hasOwnProperty.call(v,k);
 function projectLamps(state){
  const lamps={};
  for(const [pump,light] of Object.entries(LAMPS))lamps[light]=state.pumps[pump].lowPressure;
  for(const [key,light] of Object.entries(ELECTRICAL_LAMPS))lamps[light]=state.electrical.lamps[key];
  lamps['hyd-elec-2-overheat']=state.pumps['hyd.electricPumpA'].overheat;
  lamps['hyd-elec-1-overheat']=state.pumps['hyd.electricPumpB'].overheat;
  return lamps;
 }
 class Bridge{
  constructor(session){if(!session?.send||!session?.get)throw Error('ISN-01 session required');this.session=session;this.snapshot=null;this.inputs={toggles:{},guards:{},rotaries:{},context:{}};this.initialized=false;this.rejected=[];}
  send(command){try{return this.session.send(command);}catch(error){this.rejected.push({command:copy(command),reason:error.message});if(this.rejected.length>30)this.rejected.shift();return this.session.get();}}
  electrical(action){this.send({type:'ELECTRICAL',action});}
  control(id,next){
   if(own(PUMPS,id)){
    if(next==='ON'||next==='OFF')this.send({type:'PUMP_SWITCH',id:PUMPS[id],value:next==='ON'});
   }else if(id==='battery-master'){
    if(next==='on'||next==='off')this.electrical({type:'CONTROL',key:'batterySwitch',value:next==='on'});
   }else if(id==='standby-power'){
    if(['auto','off','bat'].includes(next))this.electrical({type:'CONTROL',key:'standbySelector',value:next.toUpperCase()});
   }else if(/^generator-disconnect-[12]$/.test(id)){
    if(['normal','disconnect'].includes(next))this.electrical({type:'FAULT',id:'GEN'+id.at(-1)+'_FAILED',active:next==='disconnect',instructor:true});
   }else if(/^gen-[12]$/.test(id)||/^apu-gen-[12]$/.test(id)){
    // Momentary ON/OFF commands matter; NEUTRAL must NOT erase the selected source.
    const side=Number(id.at(-1)),source=id.startsWith('apu')?'APU':'GEN'+side;
    if(next==='ON')this.electrical({type:'SELECT_SOURCE',side,source});
    if(next==='OFF'){
     const current=this.session.electricalState.source[side];
     if(current===source)this.electrical({type:'SELECT_SOURCE',side,source:'OFF'});
    }
   }else if(id==='ground-power'){
    if(next==='ON')this.electrical({type:'SELECT_SOURCE',side:1,source:'EXT'});
    else if(next==='OFF')for(const side of [1,2]){
     if(this.session.electricalState.source[side]==='EXT')this.electrical({type:'SELECT_SOURCE',side,source:'OFF'});
    }
   }
  }
  synchronize(packet){
   if(!packet||typeof packet!=='object'||!packet.toggles||!packet.guards||!packet.context)throw Error('Overhead controls snapshot required');
   const next={toggles:packet.toggles,guards:packet.guards,rotaries:packet.rotaries||{},context:packet.context};
   // Apply upstream scenarios before source-selector requests.
   for(const key of SCENARIO)if(typeof next.context[key]==='boolean'&&next.context[key]!==this.inputs.context[key]){
    this.electrical({type:'CONTROL',key,value:next.context[key]});
    if(key==='onGround')this.send({type:'WARNING_SENSOR',key:'onGround',value:next.context[key]});
   }
   const guardIds=['battery-master','standby-power','generator-disconnect-1','generator-disconnect-2'];
   for(const id of guardIds){const value=next.guards[id]?.value,previous=this.inputs.guards[id]?.value;if(value!==undefined&&value!==previous)this.control(id,value);}
   // Binary toggles are level signals, not inferred power sources.
   for(const id of Object.keys(PUMPS))if(own(next.toggles,id)&&next.toggles[id]!==this.inputs.toggles[id])this.control(id,next.toggles[id]);
   // If loaded from browser storage with latched ON/OFF, reconcile that source
   // once. For a subsequent rapid pulse, handleEvent catches the detent.
   for(const id of ['gen-1','gen-2','apu-gen-1','apu-gen-2','ground-power']){
    if(own(next.toggles,id)&&next.toggles[id]!==this.inputs.toggles[id])this.control(id,next.toggles[id]);
   }
   this.inputs=copy(next);this.initialized=true;this.snapshot=this.session.get();return this.get();
  }
  handleEvent(event){
   if(!this.initialized||!event||typeof event.id!=='string')return this.get();
   const id=event.id,next=event.kind==='guarded'?event.next?.value:event.next;
   if(typeof next!=='string')return this.get();
   const kind=event.kind==='guarded'?'guards':'toggles';
   if(event.kind==='rotary')return this.get();
   const previous=kind==='guards'?this.inputs.guards[id]?.value:this.inputs.toggles[id];
   if(previous===next)return this.get();
   if(kind==='guards')this.inputs.guards[id]=copy(event.next);
   else this.inputs.toggles[id]=next;
   this.control(id,next);
   this.snapshot=this.session.get();return this.get();
  }
  instructor(command){this.send(command);this.snapshot=this.session.get();return this.get();}
  replay(){const commands=this.session.events.map(e=>copy(e.command));this.session.replay(commands);this.snapshot=this.session.get();return this.get();}
  reset(){this.session.reset();this.initialized=false;const last=copy(this.inputs);this.inputs={toggles:{},guards:{},rotaries:{},context:{}};this.rejected=[];return this.synchronize(last);}
  get(){const state=this.session.get();return {state,lamps:projectLamps(state),initialized:this.initialized,
   rejected:copy(this.rejected),inputs:copy(this.inputs),coverage:{pumpControls:Object.keys(PUMPS).length,pumpLamps:Object.keys(LAMPS).length,electricalLamps:Object.keys(ELECTRICAL_LAMPS).length,busTransferPhysicalControl:false}};}
 }
 return Object.freeze({PUMPS,LAMPS,ELECTRICAL_LAMPS,GUARDED,SCENARIO,projectLamps,Bridge});
});
