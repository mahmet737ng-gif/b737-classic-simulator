'use strict';
/**
 * ISN-08 Training-only QRH routing registry, not a substitute for a current
 * approved QRH. Source: Sepehran 737-3/500 QRH (2016-12-16).
 * Reference page mappings: 7.1 PDF149, 2.8 PDF82, 7.12 PDF160,
 * 7.13 PDF161, 8.1 PDF189, 8.2 PDF190, 7.14 PDF162.
 * Source text is NOT embedded here; steps are concise paraphrased index cues.
 */
const QRH='QRH-SEPEHRAN-D6-27370-3-500-SEP-20161216';
const refs=(folio,page)=>({sourceId:QRH,section:folio,pdfPage:page,referenceClass:'SIM_TRAINING_QRH_POINTER'});
const D={
 ABORTED_ENGINE_START:{
   title:'Aborted Engine Start',folio:'7.1',page:149,group:'ENGINES',
   steps:[
     {id:'LEVER_CUTOFF',title:'Place the affected engine start lever at CUTOFF',verify:'ENGINE_LEVER_CUTOFF'},
     {id:'STARTER_BRANCH',title:'Follow the GRD/OFF starter motoring branch in the referenced QRH',verify:'MANUAL_BRANCH'},
     {id:'VERIFY_START',title:'Verify the starter is OFF after the relevant QRH branch',verify:'ENGINE_START_OFF'}]},
 BLEED_TRIP_OFF:{
   title:'BLEED TRIP OFF',folio:'2.8',page:82,group:'AIR',
   steps:[
     {id:'WING_ANTI_ICE',title:'Review the QRH wing anti-ice restriction',verify:'MANUAL_UNMODELLED'},
     {id:'TRIP_RESET',title:'Perform the QRH TRIP RESET check; observe the trip light',verify:'MANUAL_AND_OBSERVED'},
     {id:'BRANCH',title:'Follow the still-illuminated / extinguished light branch',verify:'MANUAL_BRANCH'}]},
 APU_FIRE:{
   title:'APU FIRE',folio:'8.1',page:189,group:'FIRE',
   steps:[
     {id:'APU_FIRE_SWITCH',title:'Use the APU fire switch per the QRH',verify:'APU_FIRE_SWITCH_OUT'},
     {id:'APU_SWITCH_OFF',title:'Set APU switch OFF',verify:'APU_SWITCH_OFF'},
     {id:'FIRE_BRANCH',title:'Check the fire switch indication and follow the QRH branch',verify:'MANUAL_BRANCH'}]},
 APU_LOW_OIL_PRESSURE:{
   title:'APU LOW OIL PRESSURE',folio:'7.12',page:160,group:'APU',
   steps:[{id:'APU_SWITCH_OFF',title:'Set APU switch OFF',verify:'APU_SWITCH_OFF'}]},
 APU_OVERSPEED:{
   title:'APU OVERSPEED',folio:'7.13',page:161,group:'APU',
   steps:[
     {id:'APU_SWITCH_OFF',title:'Set APU switch OFF',verify:'APU_SWITCH_OFF'},
     {id:'RESET_REVIEW',title:'Review the referenced QRH reset requirement before a new start',verify:'MANUAL_UNMODELLED'}]},
 APU_FAULT:{
   title:'APU FAULT',folio:'7.12',page:160,group:'APU',
   steps:[{id:'APU_SWITCH_OFF',title:'Set APU switch OFF',verify:'APU_SWITCH_OFF'}]},
 ENGINE_FIRE:{
   title:'ENGINE FIRE or Severe Damage',folio:'8.2',page:190,group:'FIRE',
   steps:[
     {id:'THRUST_CLOSE',title:'Check affected thrust lever and related indications',verify:'MANUAL_UNMODELLED'},
     {id:'LEVER_CUTOFF',title:'Move affected engine start lever to CUTOFF',verify:'ENGINE_LEVER_CUTOFF'},
     {id:'ENGINE_FIRE_SWITCH',title:'Use the engine fire switch and extinguishing QRH branches',verify:'MANUAL_UNMODELLED'}]}
};
function initChecklistState(){return {selected:null,completed:{},audit:[]};}
function parseCase(caseId){
 if(typeof caseId!=='string'||!/^([A-Z_]+):(1|2|APU)$/.test(caseId))throw new TypeError('Invalid checklist case');
 const [type,unit]=caseId.split(':');
 if(!Object.prototype.hasOwnProperty.call(D,type))throw new TypeError('Unknown checklist procedure');
 if(unit==='APU'&&!type.startsWith('APU_') || unit!=='APU'&&type.startsWith('APU_'))
   throw new TypeError('Checklist target incorrect');
 if(type==='ENGINE_FIRE'&&unit!=='1')throw new TypeError('Engine 2 fire detector not integrated');
 return {type,unit};
}
function getCases(view){
 if(view.propulsion?.mode!=='INTEGRATED')return [];
 const candidates=[];
 const add=(type,unit,reason,certainty)=>{
   const d=D[type],id=type+':'+unit;
   candidates.push({id,type,unit,title:d.title,group:d.group,reason,
     certainty:certainty||'OBSERVED_SIM_INPUT',
     source:refs(d.folio,d.page)});
 };
 for(const unit of ['1','2']){
   const p=view.propulsion.protection.engines[unit];
   if(p.advisoryReasons.some(reason=>reason!=='STARTER_DUTY_LIMIT')){
     add('ABORTED_ENGINE_START',unit,'SOURCE_INDEXED_START_ABORT_CONDITION');
   }
   if(view.propulsion.pneumatic.distribution.engineValves[unit].bleedTripLatched)
     add('BLEED_TRIP_OFF',unit,'BLEED_TRIP_LATCHED');
 }
 const faults=view.propulsion.protection.apu.shutdownFaults;
 if(faults.includes('FIRE'))add('APU_FIRE','APU','INSTRUCTOR_APU_FIRE_PROTECTION_INPUT','INJECTED_NOT_PHYSICAL_DETECTOR');
 if(faults.includes('LOW_OIL_PRESSURE'))add('APU_LOW_OIL_PRESSURE','APU','INJECTED_APU_LOW_OIL_INPUT','INJECTED_NOT_PHYSICAL_SENSOR');
 if(faults.includes('OVERSPEED'))add('APU_OVERSPEED','APU','INJECTED_APU_OVERSPEED_INPUT','INJECTED_NOT_PHYSICAL_SENSOR');
 if(faults.some(x=>['FCU_FAILURE','HIGH_OIL_TEMPERATURE'].includes(x)))
   add('APU_FAULT','APU','INJECTED_APU_SYSTEM_FAULT','INJECTED_NOT_PHYSICAL_SENSOR');
 if(view.fireDetection.fireDetected===true)
   add('ENGINE_FIRE','1','ENG1_FIRE_DETECTOR_PILOT_CONFIRMED');
 return candidates.sort((a,b)=>a.id.localeCompare(b.id));
}
function verifyStep(step,unit,snapshot,view){
 const eng=snapshot.propulsion.engines?.[unit];
 const apu=snapshot.propulsion.apu;
 switch(step.verify){
  case 'ENGINE_LEVER_CUTOFF':return eng?.startLever==='CUTOFF';
  case 'ENGINE_START_OFF':return eng?.startSwitch==='OFF';
  case 'APU_FIRE_SWITCH_OUT':return apu.fireSwitchIn===false;
  case 'APU_SWITCH_OFF':return apu.switch==='OFF';
  case 'MANUAL_AND_OBSERVED':return unit!=='APU' &&
    view.propulsion.pneumatic.distribution.engineValves[unit].bleedTripLatched===false;
  default:return null;
 }
}
function deriveChecklists(snapshot,view){
 const state=snapshot.checklist||initChecklistState();
 const active=getCases(view),activeIDs=new Set(active.map(x=>x.id));
 const all=[...active];
 if(state.selected&&!activeIDs.has(state.selected)){
   const parsed=parseCase(state.selected),d=D[parsed.type];
   all.push({id:state.selected,type:parsed.type,unit:parsed.unit,
     title:d.title,group:d.group,reason:'RESOLVED_RETAINED_FOR_DEBRIEF',
     certainty:'NOT_CURRENTLY_ACTIVE',source:refs(d.folio,d.page)});
 }
 const cases=all.map(item=>{
   const definition=D[item.type],done=state.completed[item.id]||{};
   const steps=definition.steps.map(step=>{
     const evidence=verifyStep(step,item.unit,snapshot,view);
     return {id:step.id,title:step.title,verification:step.verify,
       observed:evidence,confirmed:done[step.id]===true,
       requiresCrewAttestation:evidence===null,
       source:refs(definition.folio,definition.page)};
   });
   return {...item,status:activeIDs.has(item.id)?'ACTIVE':'RESOLVED',
     steps,completedCount:steps.filter(x=>x.confirmed).length,
     totalCount:steps.length,fullProcedureInRepository:false};
 });
 return {selected:state.selected,cases,
   activeCaseIds:active.map(x=>x.id),
   audit:state.audit.slice(-100),label:'REFERENCE_ONLY_TRAINING_NOT_FLIGHT_USE'};
}
function performChecklistAction(state,action,snapshot,view){
 if(!state||!state.completed)throw new TypeError('checklist state missing');
 const current=deriveChecklists(snapshot,view);
 if(action.type==='OPEN_CHECKLIST'){
   parseCase(action.caseId);
   if(!current.activeCaseIds.includes(action.caseId))throw new Error('Case is not active');
   state.selected=action.caseId;
 }else if(action.type==='RESET_CHECKLIST'){
   if(action.caseId){parseCase(action.caseId);delete state.completed[action.caseId];}
   else state.completed={};
 }else if(action.type==='CONFIRM_CHECKLIST_STEP'){
   const checkId=action.caseId||state.selected;
   if(!checkId)throw new Error('No selected checklist');
   const {type,unit}=parseCase(checkId);
   if(state.selected!==checkId)throw new Error('Select checklist before confirming steps');
   const item=D[type].steps.find(x=>x.id===action.stepId);
   if(!item)throw new TypeError('Unknown checklist step');
   const evidence=verifyStep(item,unit,snapshot,view);
   if(evidence===false)throw new Error('Physical state does not support step confirmation');
   if(evidence===null && action.crewConfirmed!==true)
     throw new Error('Unmodelled QRH step requires crew attestation');
   state.completed[checkId]??={};state.completed[checkId][item.id]=true;
   state.audit.push({caseId:checkId,stepId:item.id,
     verification:evidence===true?'OBSERVED':'CREW_ATTESTED',
     source:refs(D[type].folio,D[type].page)});
 }else throw new TypeError('Unknown checklist action');
}
module.exports={initChecklistState,getCases,deriveChecklists,
  performChecklistAction,parseCase};
