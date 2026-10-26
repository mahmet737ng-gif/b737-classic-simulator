/* LGT-0003. Discrete trainer adapter, not an aircraft wiring model.
 * Source-located electrical V7 is reused without resolving its UNKNOWN cases.
 * Fuel/flight-controls legacy rules are simulator prototypes; additional
 * sensor predicates and short delays are explicitly SIM_APPROX_ONLY.
 */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.B737OverheadLightModel=api;})(typeof globalThis!=='undefined'?globalThis:null,function(){
 'use strict';
 const copy=v=>JSON.parse(JSON.stringify(v));
 function initialContext(){return {panelPower:true,engine1Running:true,engine2Running:true,apuRunning:false,groundPowerAttached:false,fuelAvailable:true,standbyPumpFailed:false,passengerOxygenDeployed:false,irsBatterySupply:false,irsLAlignmentInProgress:false,irsRAlignmentInProgress:false,irsLAttitudeAvailable:false,irsRAttitudeAvailable:false,irsLShutdownInProgress:false,irsRShutdownInProgress:false,equipmentSupplyFailed:false,equipmentExhaustFailed:false,onGround:true,engine1FuelValveClosed:false,engine2FuelValveClosed:false,faults:{}};}
 function rectangle(c,p,mapPoint){const [x,y,w,h]=c.sourceRect;const point=(a,b)=>mapPoint({id:c.id,sourcePoint:[a,b],bezelSourceDiameter:1},p);const a=point(x,y),b=point(x+w,y+h);return {x:a.x,y:a.y,w:b.x-a.x,h:b.y-a.y};}
 function validate(reg,layout,mapper,controlIds){
  const ids=new Set(),plates=new Map(layout.placements.map(p=>[p.id,p]));
  for(const c of reg.lights){
   if(ids.has(c.id)||!reg.assets[c.asset])throw Error('Invalid lamp '+c.id);ids.add(c.id);
   const p=plates.get(c.placementId);if(!p||c.sourceRect.length!==4||c.sourceRect.some(n=>!Number.isFinite(n)))throw Error('Invalid lamp geometry '+c.id);
   const box=rectangle(c,p,mapper);if(box.w<=0||box.h<=0||box.x<0||box.y<0||box.x+box.w>layout.canvas.width||box.y+box.h>layout.canvas.height)throw Error('Lamp outside board '+c.id);
   for(const id of c.controls)if(!controlIds.has(id))throw Error('Unresolved lamp control '+id);
   for(const state of c.states||['ON','OFF'])if(!reg.assets[c.asset][state]?.url)throw Error('Missing lamp pair '+c.asset);
  }return true;
 }
 function controller(reg,electrical,notify=()=>{},pneumatics){
  let context=initialContext(),toggles={},rotaries={},guards={},test=false,electricalState=electrical.initialState();
  let pneumaticState=pneumatics.initial();
  let aircraftFamily='B737-300-500',recirc400Left='AUTO';
  let oxygen=false;const faults=new Set(reg.lights.map(c=>c.id)),switchTime={},valveTime={};let result=null;
  const control=id=>toggles[id]??guards[id]?.value??rotaries[id];
  const isOn=id=>String(control(id)).toUpperCase()==='ON';
  function command(c){try{electricalState=electrical.apply(electricalState,c);}catch{ /* Unavailable source cannot latch. */ }}
  function syncElectrical(){
   for(const [key,value]of Object.entries({batterySwitch:isOn('battery-master'),standbySelector:String(control('standby-power')||'auto').toUpperCase(),engine1Running:context.engine1Running,engine2Running:context.engine2Running,apuRunning:context.apuRunning,groundPowerAttached:context.groundPowerAttached}))command({type:'CONTROL',key,value});
   for(const side of [1,2])command({type:'FAULT',id:'GEN'+side+'_FAILED',active:control('generator-disconnect-'+side)==='disconnect',instructor:true});
  }
  const pneumaticSensors={
   'pack-trip-l':'packLOverheat','pack-trip-r':'packROverheat',
   'duct-overheat-l':'ductLOverheat','duct-overheat-r':'ductROverheat',
   'bleed-trip-l':'bleed1Overlimit','bleed-trip-r':'bleed2Overlimit',
   'wing-body-overheat-l':'wingBodyLLeakDetected','wing-body-overheat-r':'wingBodyRLeakDetected'
  };
  function syncPneumatic(){
   const controls={engineBleed1:control('bleed-eng-1'),engineBleed2:control('bleed-eng-2'),apuBleed:control('bleed-apu'),isolation:control('isolation-valve'),packL:control('pack-l'),packR:control('pack-r'),recirc:control('recirc-fan'),recircL:recirc400Left,recircR:control('recirc-fan')??'AUTO',aircraftFamily,temperatureL:String(control('control-cabin-temp')).startsWith('MANUAL')?'MANUAL':'AUTO',temperatureR:String(control('pass-cabin-temp')).startsWith('MANUAL')?'MANUAL':'AUTO'};
   for(const [key,value]of Object.entries(controls))if(value!==undefined)pneumaticState=pneumatics.apply(pneumaticState,{type:'CONTROL',key,value});
   const inputs={engine1Running:context.engine1Running,engine2Running:context.engine2Running,apuRunning:context.apuRunning};
   for(const [id,key]of Object.entries(pneumaticSensors))inputs[key]=context.faults[id]===true;
   for(const [key,value]of Object.entries(inputs))pneumaticState=pneumatics.apply(pneumaticState,{type:'SENSOR',key,value});
  }
  function sourceEvent(id,next){
   let source,side;
   if(id==='ground-power'){if(next==='ON')command({type:'SELECT_SOURCE',side:1,source:'EXT'});else if(next==='OFF')for(const s of [1,2])if(electricalState.source[s]==='EXT')command({type:'SELECT_SOURCE',side:s,source:'OFF'});return;}
   if(/^gen-[12]$/.test(id)){side=Number(id.at(-1));source='GEN'+side;}
   if(/^apu-gen-[12]$/.test(id)){side=Number(id.at(-1));source='APU';}
   if(!side||!['ON','OFF'].includes(next))return;
   command({type:'SELECT_SOURCE',side,source:next==='ON'?source:'OFF'});
  }
  function ingest(t,r,now=0,event){
   const before=toggles,previousRotaries=rotaries;toggles={...t};rotaries={...r.rotaries};guards=copy(r.guards);
   for(const [id,value]of Object.entries(toggles))if(value!==before[id])switchTime[id]=now;
   for(const [id,value]of Object.entries({...toggles,...rotaries})){const previous=before[id]??previousRotaries[id];if(previous!==undefined&&previous!==value)valveTime[id]=now;}
   if(control('passenger-oxygen')==='on')oxygen=true;
   syncElectrical();syncPneumatic();if(event)sourceEvent(event.id,event.next);
   return evaluate(now);
  }
  function update(patch,now=0){
   for(const [key,value]of Object.entries(patch)){
    if(key==='faults'){for(const [id,active]of Object.entries(value)){if(!faults.has(id)||typeof active!=='boolean')throw Error('Invalid lamp fault');context.faults[id]=active;}}
    else if(!Object.hasOwn(initialContext(),key)||typeof value!=='boolean')throw Error('Invalid scenario input');else {if(key.startsWith('engine')&&key.endsWith('FuelValveClosed')&&context[key]!==value)valveTime[key]=now;context[key]=value;}
   }
   syncElectrical();syncPneumatic();return evaluate(now);
  }
  function evaluate(now=0){
   const p=pneumatics.derive(pneumaticState),e=electrical.evaluate(electricalState),on={},frames={},unknown=[],fault=id=>context.faults[id]===true;
   const standbyCommand=['flight-control-a','flight-control-b'].some(id=>control(id)==='stby')||control('alternate-flaps-master')==='arm';
   const hyd=id=>isOn(id)&&!fault(id)&&(id.includes('eng-')?context['engine'+id.at(-1)+'Running']:true);
   const pressureA=hyd('hyd-eng-1')||hyd('hyd-elec-2'),pressureB=hyd('hyd-eng-2')||hyd('hyd-elec-1');
   const available=context.panelPower&&(isOn('battery-master')||Object.values(e.source).some(Boolean)||control('standby-power')==='bat');
   for(const c of reg.lights){let active=false;const id=c.controls[0],v=control(id);
    switch(c.rule){
     case 'sensor':active=fault(c.sensor);break;
     case 'fuel-pressure':active=(c.id.includes('center')?isOn(id):true)&&(!isOn(id)||!context.fuelAvailable||fault(c.id)||now-(switchTime[id]??-1000)<720);break;
     case 'hyd-pressure':active=!hyd(id);break;
     case 'flight-pressure':active=v!=='on'||!(c.id.endsWith('a')?pressureA:pressureB)||fault(c.id);break;
     case 'standby-pressure':active=standbyCommand&&(context.standbyPumpFailed||fault(c.id));break;
     case 'standby-rudder':active=standbyCommand&&!context.standbyPumpFailed&&!fault('stby-pressure');break;
     case 'yaw':active=!isOn(id)||fault(c.id);break;
     case 'emergency':active=v!=='armed';break;
     case 'drive-pressure':active=!context['engine'+id.at(-1)+'Running']||v==='disconnect'||fault(c.id);break;
     case 'drive-temperature':active=fault(c.id);break;
     case 'electrical':active=e.lamps[c.sensor];break;
     case 'standby-power':active=e.lamps.standbyPowerOff;break;
     case 'equipment':active=(v==='NORMAL'&&context[id.endsWith('supply')?'equipmentSupplyFailed':'equipmentExhaustFailed'])||fault(c.id);break;
     case 'window':active=control('window-power-test')==='OVHT'||isOn(id)&&fault(c.sensor);break;
     case 'probe':active=!isOn(id)||fault(c.sensor);break;
     case 'on-dc':active=v!=='OFF'&&context.irsBatterySupply;break;
     case 'irs-align':{
      const side=c.sensor==='R'?'R':'L';
      const showing=v==='ALIGN'||v==='NAV'&&context['irs'+side+'AlignmentInProgress']||v==='ATT'&&!context['irs'+side+'AttitudeAvailable']||v==='OFF'&&context['irs'+side+'ShutdownInProgress'];
      active=showing?(fault(c.id)?'FLASH':true):false;
      break;
     }
     case 'dc-fail':active=v!=='OFF'&&fault(c.id);break;
     case 'fault':active=v!=='OFF'&&fault(c.id);break;
     case 'apu':active=c.id==='apu-low-pressure'?control('apu-start')!=='OFF'&&(!context.apuRunning||fault(c.id)):fault(c.id);break;
     case 'anti-ice':active=isOn(id)&&fault(c.id);break;
     case 'pneumatic':active=p.lamps[c.sensor];break;
     case 'press-fault':active=v==='AUTO'&&fault(c.id);break;
     case 'window-on':active=control('window-power-test')==='PWR TEST'||isOn(id)&&!fault('window-'+id.slice(7)+'-overheat');break;
     case 'valve':active=fault(c.id)||now-(valveTime[id]??-10000)<820?'BRIGHT_BLUE':(v==='ON'||v==='OPEN')?'DIM_BLUE':'OFF';break;
     case 'fuel-valve':active=fault(c.id)||now-(valveTime[c.sensor]??-10000)<820?'BRIGHT_BLUE':context[c.sensor]?'DIM_BLUE':'OFF';break;
     case 'apu-gen-off':active=context.apuRunning&&!Object.values(e.source).includes('APU');break;
     case 'ram-door':active=context.onGround&&v!=='OFF'||fault(c.id);break;
     case 'press-mode':active=v===c.sensor;break;
     case 'oxygen':active=oxygen||context.passengerOxygenDeployed;break;
     case 'recorder':active=fault(c.id)||fault(c.sensor)||(context.onGround&&!context.engine1Running&&!context.engine2Running&&control('flight-recorder-test')!=='test');break;
     default:throw Error('Unknown lamp predicate '+c.rule);
    }
    const states=c.states||['OFF','ON'],bright=states.at(-1);
    if(active===null){unknown.push(c.id);on[c.id]=available&&test?true:null;frames[c.id]=available&&test?bright:'OFF';}
    else {const frame=!available?'OFF':test?bright:typeof active==='string'?active:active?bright:'OFF';frames[c.id]=frame;on[c.id]=frame!=='OFF';}
   }
   result={version:reg.version,lights:on,frames,unknown,electrical:e,pneumatic:p,context:copy(context),lampTest:test,passengerOxygenDeployed:oxygen,power:available};notify(copy(result));return copy(result);
  }
  return {setAircraftFamily:(value,now=0)=>{if(!['B737-300-500','B737-400'].includes(value))throw Error('Invalid airframe family');aircraftFamily=value;syncPneumatic();return evaluate(now);},
  setAircon400LeftRecirc:(value,now=0)=>{if(!['OFF','AUTO'].includes(value))throw Error('Invalid left recirc fan position');recirc400Left=value;syncPneumatic();return evaluate(now);},
  tripReset:(now=0)=>{syncPneumatic();pneumaticState=pneumatics.apply(pneumaticState,{type:'TRIP_RESET'});return evaluate(now);},ingest,update,evaluate,snapshot:()=>copy(result),setLampTest:(v,now=0)=>{test=!!v;return evaluate(now);},reset:(now=0)=>{context=initialContext();for(const id of Object.keys(valveTime))delete valveTime[id];oxygen=false;test=false;electricalState=electrical.initialState();pneumaticState=pneumatics.initial();syncElectrical();syncPneumatic();return evaluate(now);}};
 }
 return Object.freeze({initialContext,rectangle,validate,controller});
});
