/* ATA24 / OH10 RESID VOLTS — procedure & QRH training only.
 * This intentionally distinguishes measured volts, declared simulator fixtures,
 * and UNKNOWN. Discrete Electrical V7 buses do not measure residual voltage.
 * Do not use this model as an aircraft maintenance test procedure.
 * Original panel and OH10 gauge/needle/guard assets are immutable.
 */
(function(root,factory){
 'use strict';const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.B737ResidualVoltsModelV1=api;
})(typeof globalThis==='object'?globalThis:this,function(){
 'use strict';
 const VERSION='RESID-0001-SAFE-MOMENTARY';
 const GENERATORS=Object.freeze(['GEN1','GEN2','APU GEN']);
 const AC_POSITIONS=Object.freeze(['STBY PWR','GND PWR','GEN1','APU GEN','GEN2','INV','TEST']);
 const SYSTEMS=Object.freeze(['CSD','VSCF','APU']);
 const GCR_STATES=Object.freeze(['UNKNOWN','OPEN','CLOSED']);
 const DRIVE_STATES=Object.freeze(['UNKNOWN','RUNNING','STOPPED','DISCONNECTED']);
 const VALID_MODES=Object.freeze(['MEASURED','TRAINER_FIXTURE']);
 const scenarioFixtures=Object.freeze({
  CSD_OPEN_SPINNING:Object.freeze({volts:18,detail:'ILLUSTRATIVE_ONLY_NOT_AFM_LIMIT'}),
  CSD_DISCONNECTED:Object.freeze({volts:4,detail:'ILLUSTRATIVE_ONLY_NOT_AFM_LIMIT'}),
  VSCF_OPEN_SPINNING:Object.freeze({volts:17,detail:'ILLUSTRATIVE_ONLY_NOT_AFM_LIMIT'}),
  APU_OPEN_SPINNING:Object.freeze({volts:null,detail:'UNKNOWN_NOT_MODELLED'})
 });
 function oneOf(x,list,name){if(!list.includes(x))throw Error('Invalid '+name+': '+x);return x;}
 function reading(v,label){if(v!==null&&(typeof v!=='number'||!Number.isFinite(v)||v<0))throw Error(label+' must be a nonnegative finite number or null');return v;}
 function initialPlant(id){
  return {id,technology:id==='APU GEN'?'APU':'CSD',gcr:'UNKNOWN',drive:'UNKNOWN',fieldExcited:null,
    measuredResidual:null,normalVolts:null,normalFrequency:null,failed:false,instrumentFault:false};
 }
 function create(){
  let selected='GEN1',pressed=false,mode='MEASURED',damageSimulation=false,meterDamaged=false,sequence=0;
  const plants=Object.fromEntries(GENERATORS.map(id=>[id,initialPlant(id)]));
  const notices=[];
  function note(code){notices.push({seq:++sequence,code});if(notices.length>120)notices.shift();}
  function setSelector(position){
   selected=oneOf(position,AC_POSITIONS,'AC selector');
   note('SELECT_'+selected.replaceAll(' ','_'));
   return evaluate();
  }
  function setMode(value){mode=oneOf(value,VALID_MODES,'measurement mode');note('MODE_'+mode);return evaluate();}
  function configure(id,patch){
   oneOf(id,GENERATORS,'generator');if(!patch||typeof patch!=='object'||Array.isArray(patch))throw Error('Invalid plant data');
   const allowed=['technology','gcr','drive','fieldExcited','measuredResidual','normalVolts','normalFrequency','failed','instrumentFault'];
   for(const key of Object.keys(patch))if(!allowed.includes(key))throw Error('Unsupported generator data: '+key);
   const next={...plants[id]};
   for(const [key,value]of Object.entries(patch)){
    if(key==='technology')next[key]=oneOf(value,SYSTEMS,'technology');
    else if(key==='gcr')next[key]=oneOf(value,GCR_STATES,'GCR state');
    else if(key==='drive')next[key]=oneOf(value,DRIVE_STATES,'drive');
    else if(['measuredResidual','normalVolts','normalFrequency'].includes(key))next[key]=reading(value,key);
    else if(key==='fieldExcited'){if(value!==null&&typeof value!=='boolean')throw Error('Invalid fieldExcited');next[key]=value;}
    else if(typeof value!=='boolean')throw Error('Invalid '+key);
    else next[key]=value;
   }
   Object.assign(plants[id],next);
   note('PLANT_'+id.replaceAll(' ','_'));
   return evaluate();
  }
  function setPress(value){if(typeof value!=='boolean')throw Error('Momentary press requires boolean');if(pressed!==value){pressed=value;note(value?'RESID_PRESS':'RESID_RELEASE');}return evaluate();}
  function setDamageSimulation(value){if(typeof value!=='boolean')throw Error('Invalid instructor damage control');damageSimulation=value;note('INSTRUCTOR_DAMAGE_'+(value?'ON':'OFF'));return evaluate();}
  function resetDamage(){meterDamaged=false;note('INSTRUCTOR_METER_REPLACED');return evaluate();}
  function evaluate(){
   const generator=GENERATORS.includes(selected)?selected:null;
   const source=generator?plants[generator]:null;
   const result={version:VERSION,sequence,pressed,selector:selected,mode,
    generator,scale:pressed?'RESIDUAL':'NORMAL',acVolts:null,normalVolts:null,cps:null,
    status:'UNAVAILABLE',reason:'NO_MEASUREMENT',warning:null,fixture:false,
    meterDamaged,damageSimulation,method:'UNVERIFIED'};
   if(!pressed){
    if(source){
     result.acVolts=source.normalVolts;
     result.normalVolts=source.normalVolts;
     result.cps=source.normalFrequency;
     result.status=source.normalVolts===null?'NORMAL_NO_SENSOR':'NORMAL_MEASURED';
    }else result.status='NORMAL_NON_GENERATOR_SOURCE';
    if(meterDamaged){result.acVolts=null;result.status='METER_DAMAGED';}
    return Object.freeze(result);
   }
   if(!source){result.status='INHIBITED';result.reason='SELECT_ENGINE_OR_APU_GENERATOR';return Object.freeze(result);}
   if(meterDamaged||source.instrumentFault){
    result.status='INSTRUMENT_FAULT';result.reason='VOLTMETER_UNAVAILABLE';return Object.freeze(result);
   }
   if(source.gcr==='UNKNOWN'||source.drive==='UNKNOWN'){
    result.status='UNVERIFIED';result.reason='GCR_AND_DRIVE_STATE_REQUIRED';return Object.freeze(result);
   }
   if(source.gcr==='CLOSED'||source.fieldExcited===true){
    result.status='UNSAFE_OVER_RANGE';result.reason='GENERATOR_FIELD_EXCITED';
    result.warning='Do not use 0–30V meter range while generator field is excited';
    // This is only an instructor-requested failure exercise, never automatic.
    if(damageSimulation&&!meterDamaged){meterDamaged=true;note('SIMULATED_VOLTMETER_DAMAGE');result.meterDamaged=true;}
    return Object.freeze(result);
   }
   if(source.failed){
    result.status='SOURCE_FAULT';result.reason='GENERATOR_FAILED_NO_VALID_READING';
    return Object.freeze(result);
   }
   if(source.measuredResidual!==null){
    if(source.measuredResidual>30){
     result.status='UNSAFE_OVER_RANGE';result.reason='RESIDUAL_SENSOR_OVER_RANGE';
     result.warning='Measured value exceeds protected residual 0–30V scale';
     return Object.freeze(result);
    }
    result.acVolts=source.measuredResidual;result.status='MEASURED';result.reason='VALID_GENERATOR_READING';
    result.method='SOURCE_MEASUREMENT';return Object.freeze(result);
   }
   if(mode!=='TRAINER_FIXTURE'){
    result.status='NO_SENSOR';result.reason='NO_RESIDUAL_VOLTAGE_MEASUREMENT';
    return Object.freeze(result);
   }
   const name=source.technology==='CSD'?(source.drive==='DISCONNECTED'?'CSD_DISCONNECTED':'CSD_OPEN_SPINNING'):
    source.technology==='VSCF'?'VSCF_OPEN_SPINNING':'APU_OPEN_SPINNING';
   const fixture=scenarioFixtures[name];
   if(!fixture||fixture.volts===null||source.drive==='STOPPED'){
    result.status='NO_FIXTURE';result.reason='UNKNOWN_GENERATOR_OR_STATIONARY_BEHAVIOR';
    return Object.freeze(result);
   }
   result.acVolts=fixture.volts;result.status='TRAINER_FIXTURE';result.fixture=true;
   result.reason=fixture.detail;result.method='ILLUSTRATIVE_NOT_MEASURED';
   return Object.freeze(result);
  }
  function snapshot(){return Object.freeze({version:VERSION,selector:selected,pressed,mode,damageSimulation,meterDamaged,
    plants:Object.fromEntries(GENERATORS.map(id=>[id,{...plants[id]}])),
    result:evaluate(),events:notices.map(x=>({...x}))});}
  return Object.freeze({setSelector,setMode,configure,setPress,setDamageSimulation,resetDamage,evaluate,snapshot});
 }
 return Object.freeze({version:VERSION,generators:GENERATORS,acPositions:AC_POSITIONS,systems:SYSTEMS,create,scenarioFixtures});
});
