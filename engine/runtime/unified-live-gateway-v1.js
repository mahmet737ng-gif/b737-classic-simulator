/* Unified cockpit -> existing ISN ECU/Pack, single physical owner per routed control.
 * Reads the SAME Electrical V7 instance held by ECU.start.core.pack.
 * No second Electrical Session; no changes to approved artwork.
 */
(function(root,factory){'use strict';const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.B737UnifiedLiveGatewayV1=api;})(typeof globalThis!=='undefined'?globalThis:null,function(){'use strict';
 const copy=v=>JSON.parse(JSON.stringify(v));
 const BRIDGE_TOGGLE=new Set(['fuel-center-l','fuel-center-r','fuel-1-aft','fuel-1-fwd','fuel-2-fwd','fuel-2-aft',
  'hyd-elec-2','hyd-elec-1','gen-1','gen-2','apu-gen-1','apu-gen-2','ground-power']);
 const BRIDGE_GUARD=new Set(['standby-power','generator-disconnect-1','generator-disconnect-2']);
 const ECU_TOGGLE=new Set(['apu-start','bleed-apu','bleed-eng-1','bleed-eng-2','pack-l','pack-r','isolation-valve']);
 const ECU_ROTARY=new Set(['ignition-source','engine-start-1','engine-start-2']);
 const ECU_GUARD=new Set(['battery-master']);
 const KEYS=Object.freeze(Object.fromEntries([
  ...[...BRIDGE_TOGGLE].map(id=>[id,'toggle']),
  ...[...BRIDGE_GUARD].map(id=>[id,'guarded']),
  ...[...ECU_TOGGLE].map(id=>[id,'toggle']),
  ...[...ECU_ROTARY].map(id=>[id,'rotary']),
  ...[...ECU_GUARD].map(id=>[id,'guarded'])
 ]));
 const DETENTS=Object.freeze({
  'battery-master':['off','on'],'standby-power':['bat','off','auto'],
  'generator-disconnect-1':['normal','disconnect'],'generator-disconnect-2':['normal','disconnect'],
  'gen-1':['OFF','NEUTRAL','ON'],'gen-2':['OFF','NEUTRAL','ON'],
  'apu-gen-1':['OFF','NEUTRAL','ON'],'apu-gen-2':['OFF','NEUTRAL','ON'],
  'ground-power':['OFF','ON'],'apu-start':['OFF','ON','START'],
  'bleed-apu':['OFF','ON'],'bleed-eng-1':['OFF','ON'],'bleed-eng-2':['OFF','ON'],
  'pack-l':['OFF','AUTO','HIGH'],'pack-r':['OFF','AUTO','HIGH'],
  'isolation-valve':['CLOSE','AUTO','OPEN'],
  'ignition-source':['IGN L','BOTH','IGN R'],
  'engine-start-1':['GRD','OFF','CONT','FLT'],'engine-start-2':['GRD','OFF','CONT','FLT']
 });
 const owner=id=>BRIDGE_TOGGLE.has(id)||BRIDGE_GUARD.has(id)?'ISN_PACK_BRIDGE':'ISN_ECU_CHAIN';
 class Gateway{
  constructor({bridge,ecu,physical}={}){
   if(!bridge?.get||!bridge?.synchronize||!bridge?.handleEvent||
     !ecu?.chain?.event||!ecu?.start?.core?.pack||
     !physical?.dispatch||!physical?.synchronize)
    throw Error('Existing bridge, ECU and physical router required');
   if(bridge.sourceOwner!=='ISN03_START_SESSION'||bridge.session!==ecu.start.core.pack)
    throw Error('Live gateway requires a single shared ECU Electrical Pack');
   this.bridge=bridge;this.ecu=ecu;this.physical=physical;
   this.positions=new Map();this.log=[];this.sequence=0;this.initialized=false;this.lastFailure=null;
  }
  _record(out){
   this.log.push({sequence:++this.sequence,...out});
   if(this.log.length>100)this.log.shift();
   if(!out.accepted&&!out.duplicate)this.lastFailure=copy(out);
   return copy(out);
  }
  synchronize(packet){
   if(!packet?.toggles||!packet?.guards||!packet?.rotaries||!packet?.context)
    throw Error('Full physical cockpit snapshot required');
   // Bridge writes only its own controls; ECU/Chain owns Battery and pneumatic/start state.
   this.bridge.synchronize(packet);
   const recovery=this.physical.synchronize(this.ecu,packet);
   this.positions.clear();
   for(const [id,kind] of Object.entries(KEYS)){
    const val=kind==='guarded'?packet.guards[id]?.value:packet[kind==='rotary'?'rotaries':'toggles'][id];
    if(typeof val==='string')this.positions.set(id,val);
   }
   this.initialized=true;
   return this._record({accepted:true,type:'SYNCHRONIZE',recovered:recovery.recovered||[],owner:'SHARED_ECU_PACK'});
  }
  dispatch(event){
   if(!this.initialized)return this._record({accepted:false,reason:'NOT_SYNCHRONIZED'});
   if(!event||typeof event.id!=='string'||typeof event.kind!=='string')
    return this._record({accepted:false,reason:'INVALID_PHYSICAL_EVENT'});
   const expected=KEYS[event.id];
   if(!expected)return this._record({accepted:false,id:event.id,reason:'CONTROL_NOT_MAPPED'});
   if(expected!==event.kind)return this._record({accepted:false,id:event.id,reason:'WRONG_EVENT_KIND'});
   const val=expected==='guarded'?event.next?.value:event.next;
   if(typeof val!=='string'||!val.length)return this._record({accepted:false,id:event.id,reason:'INVALID_DETENT'});
   const allowed=DETENTS[event.id]||['OFF','ON']; // pump controls
   if(!allowed.includes(val))return this._record({accepted:false,id:event.id,value:val,reason:'INVALID_DETENT'});
   if(this.positions.get(event.id)===val)
    return this._record({accepted:true,duplicate:true,id:event.id,value:val,owner:owner(event.id)});
   const before=this.bridge.get().rejected.length;
   try{
    if(owner(event.id)==='ISN_ECU_CHAIN'){
     const r=this.physical.dispatch(this.ecu,event);
     if(r?.accepted===false)throw Error(r.reason||'ECU rejected physical command');
     // Mirror physical detent for diagnostic/reconciliation only; sourceOwner
     // prevents the bridge from double-writing Battery to the same pack.
     if(expected==='guarded')this.bridge.handleEvent(event);
    }else this.bridge.handleEvent(event);
    const rejected=this.bridge.get().rejected;
    if(rejected.length>before)throw Error(rejected.at(-1)?.reason||'Bridge rejected cockpit command');
    this.positions.set(event.id,val);
    return this._record({accepted:true,id:event.id,value:val,owner:owner(event.id),
     electricalRevision:this.ecu.start.core.pack.electricalState.rev});
   }catch(error){
    // Physical hardware stays where the user placed it. A failed source
    // selection is not secretly retried, nor is it mislabeled as successful.
    this.positions.set(event.id,val);
    return this._record({accepted:false,id:event.id,value:val,owner:owner(event.id),
     reason:error.message||String(error)});
   }
  }
  snapshot(){
   const pack=this.bridge.get(),e=this.ecu.get();
   return {schema:'b737-unified-live-snapshot/1',singleElectricalOwner:this.bridge.session===this.ecu.start.core.pack,
    engineSource:'ISN13_18_ECU',electricalSource:'ELECTRICAL_V7_EXISTING_PACK',
    electrical:copy(pack.state.electrical),loads:copy(pack.state.loads),
    engines:copy(e.engines),apu:copy(e.apu),lamps:copy(pack.lamps),
    limitations:['NOT_ALL_CONTROLS_ROUTED','TRAINING_SURROGATE_ENGINE_ENVELOPE','UNKNOWN_EQUIPMENT_FEEDS']};
  }
  get(){return {schema:'b737-unified-live-gateway/1',initialized:this.initialized,
   singleElectricalOwner:this.bridge.session===this.ecu.start.core.pack,
   activeElectricalSchema:this.ecu.start.core.pack.electricalState.schema,
   mappedPhysicalControls:Object.keys(KEYS).length,
   latestFailure:copy(this.lastFailure),recentEvents:copy(this.log)};}
 }
 return Object.freeze({Gateway,KEYS,DETENTS,owner});
});
