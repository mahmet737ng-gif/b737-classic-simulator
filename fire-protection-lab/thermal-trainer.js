/* Independent, deterministic P8 equipment and compartment simulation. */
(function(root,factory){
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 else root.B737FireThermalTrainer=api;
})(globalThis,()=>{
'use strict';
// Bounded instructor training points. The selected Classic detector
// installation and its measured setpoints are not specified by the FCOM.
const thresholds=Object.freeze({overheat:180,fire:260,releaseMargin:10});
const cbNames=Object.freeze({
 'engine1.fireDetector':'P6-2 A24 · Engine 1 Fire Detection',
 'engine2.fireDetector':'P6-2 A22 · Engine 2 Fire Detection',
 'apu.fireDetector':'P6-2 A23 · APU Fire Detection',
 'fire.wheelWellDetector':'P6-2 B24 · Wheel-Well Detection',
 'warning.masterFireControl':'P6-2 B23 · Master Fire',
 'warning.aural':'P6-2 D22 · Aural Warning',
 'fire.extinguisherL':'P6-2 C24 · Left Bottle',
 'fire.extinguisherLAlternate':'P6-2 D24 · Left Bottle Alternate',
 'fire.extinguisherR':'P6-2 C22 · Right Bottle',
 'fire.extinguisherRAlternate':'P6-2 D23 · Right Bottle Alternate',
 'fire.extinguisherAPU':'P6-2 C23 · APU Bottle'
});
const initial={ENG1:{temperature:100,n1:85,n2:94,egt:560,oil:91},ENG2:{temperature:100,n1:85,n2:94,egt:560,oil:91},
 APU:{temperature:90,n1:100,n2:null,egt:410,oil:null}};
const toward=(value,target,rate,time)=>value+Math.sign(target-value)*Math.min(Math.abs(target-value),rate*time);
function level(celsius,prior){
 if(celsius>=thresholds.fire||prior==='FIRE'&&celsius>=thresholds.fire-thresholds.releaseMargin)return 'FIRE';
 if(celsius>=thresholds.overheat||prior!=='NORMAL'&&celsius>=thresholds.overheat-thresholds.releaseMargin)return 'OVHT';
 return 'NORMAL';
}
function create(Fire){
 const opened=new Set();
 const fire=Fire.createEngine(undefined,{available:key=>!opened.has(key)});
 let equipment,clearCaution=false,falseCue=null,falseAcknowledged=false;
 function reset(){
  opened.clear();fire.dispatch({type:'RESET'});clearCaution=false;falseCue=null;falseAcknowledged=false;
  equipment=Object.fromEntries(Object.entries(initial).map(([id,start])=>[id,{...start,target:start.temperature,stage:'NORMAL',stopped:false}]));
 }
 reset();
 function setTemperature(id,celsius){
  if(!Object.hasOwn(equipment,id)||!Number.isFinite(celsius)||celsius<20||celsius>650)return false;
  equipment[id].target=celsius;return true;
 }
 function faultCue(cue){
  if(![null,'HANDLE','OVERHEAT','BELL'].includes(cue))throw RangeError('Unknown warning cue');
  falseCue=cue;falseAcknowledged=false;
 }
 function setBreaker(key,closed){
  if(!Object.hasOwn(cbNames,key))throw RangeError('Unknown breaker');
  if(closed)opened.delete(key);else opened.add(key);
 }
 function evaluate(){
  const d=fire.evaluate();
  if(!falseCue)return d;
  const indications={...d.indications},activeFire={...d.activeFire};
  if(falseCue==='HANDLE')activeFire.ENG1=indications.ENG1_FIRE=fire.getState().power.batteryBus&&!opened.has('engine1.fireDetector');
  if(falseCue==='OVERHEAT'&&fire.getState().power.batteryBus&&!opened.has('engine1.fireDetector')){
   indications.ENG1_OVERHEAT=indications.OVHT_DET=indications.MASTER_CAUTION=true;
  }
  if(falseCue==='BELL'&&fire.getState().power.batteryBus&&!opened.has('warning.aural')&&!falseAcknowledged)indications.FIRE_BELL=true;
  return {...d,indications,activeFire};
 }
 function dispatch(command){
  const result=fire.dispatch(command);
  if(command.type==='BELL_CUTOUT')falseAcknowledged=true;
  return result;
 }
 function tick(seconds){
  const before=fire.getState();
  if(Object.values(before.pending).some(value=>value!==null)||Object.values(before.handles).some(h=>h.pulled&&h.angle))
   dispatch({type:'TICK',seconds});
  const state=fire.getState(),outputs=fire.evaluate().outputs;
  for(const [id,unit] of Object.entries(equipment)){
   const start=initial[id],isolated=outputs[id].fuelShutoff;
   if(isolated)unit.stopped=true;
   if(Object.keys(state.bottles).some(b=>state.bottles[b]&&!before.bottles[b]&&state.dischargedTo[b]===id))unit.target=start.temperature;
   unit.temperature=toward(unit.temperature,unit.target,unit.target>unit.temperature?36:47,seconds);
   const next=level(unit.temperature,unit.stage);
   if(next!==unit.stage){
    unit.stage=next;
    if(id!=='APU')dispatch({type:'SET_OVERHEAT',unit:id,active:next!=='NORMAL'});
    dispatch({type:'SET_FIRE',unit:id,active:next==='FIRE'});
   }
   const heat=Math.max(0,unit.temperature-start.temperature);
   const targetEGT=unit.stopped?Math.min(40+heat*.8,start.egt):start.egt+heat*.92;
   unit.egt=toward(unit.egt,targetEGT,unit.stopped?68:44,seconds);
   unit.n1=toward(unit.n1,unit.stopped?0:start.n1,unit.stopped?13:2,seconds);
   if(unit.n2!==null)unit.n2=toward(unit.n2,unit.stopped?0:start.n2,unit.stopped?11:2,seconds);
   if(unit.oil!==null)unit.oil=toward(unit.oil,unit.stopped?35:start.oil+heat*.08,2,seconds);
  }
  if(!evaluate().indications.MASTER_CAUTION)clearCaution=false;
 }
 function snapshot(){
  const derived=evaluate(),state=fire.getState();
  const indications=derived.indications;
  const cues=[indications.ENG1_FIRE,indications.ENG1_OVERHEAT,indications.FIRE_BELL];
  return {state,derived,equipment:Object.fromEntries(Object.entries(equipment).map(([id,row])=>[id,{...row}])),
   falseCue,cues,masterCaution:indications.MASTER_CAUTION&&!clearCaution};
 }
 return {dispatch,evaluate,getState:fire.getState,reset,tick,setTemperature,faultCue,setBreaker,snapshot,
  acknowledgeCaution:()=>{clearCaution=true;},recall:()=>{clearCaution=false;}};
}
return Object.freeze({thresholds,cbNames,create});
});
