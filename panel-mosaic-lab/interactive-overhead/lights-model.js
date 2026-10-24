/* LGT-0001. Discrete trainer adapter, not an aircraft wiring model.
 * Source-located electrical V7 is reused without resolving its UNKNOWN cases.
 * Fuel/flight-controls legacy rules are simulator prototypes; additional
 * sensor predicates and short delays are explicitly SIM_APPROX_ONLY.
 */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.B737OverheadLightModel=api;})(typeof globalThis!=='undefined'?globalThis:null,function(){
 'use strict';
 const copy=v=>JSON.parse(JSON.stringify(v));
 function initialContext(){return {panelPower:true,engine1Running:true,engine2Running:true,apuRunning:false,groundPowerAttached:false,fuelAvailable:true,standbyPumpFailed:false,passengerOxygenDeployed:false,irsBatterySupply:false,equipmentSupplyFailed:false,equipmentExhaustFailed:false,faults:{}};}
 function rectangle(c,p,mapPoint){const [x,y,w,h]=c.sourceRect;const point=(a,b)=>mapPoint({id:c.id,sourcePoint:[a,b],bezelSourceDiameter:1},p);const a=point(x,y),b=point(x+w,y+h);return {x:a.x,y:a.y,w:b.x-a.x,h:b.y-a.y};}
 function validate(reg,layout,mapper,controlIds){
  const ids=new Set(),plates=new Map(layout.placements.map(p=>[p.id,p]));
  for(const c of reg.lights){
   if(ids.has(c.id)||!reg.assets[c.asset])throw Error('Invalid lamp '+c.id);ids.add(c.id);
   const p=plates.get(c.placementId);if(!p||c.sourceRect.length!==4||c.sourceRect.some(n=>!Number.isFinite(n)))throw Error('Invalid lamp geometry '+c.id);
   const box=rectangle(c,p,mapper);if(box.w<=0||box.h<=0||box.x<0||box.y<0||box.x+box.w>layout.canvas.width||box.y+box.h>layout.canvas.height)throw Error('Lamp outside board '+c.id);
   for(const id of c.controls)if(!controlIds.has(id))throw Error('Unresolved lamp control '+id);
   for(const state of ['ON','OFF'])if(!reg.assets[c.asset][state]?.url)throw Error('Missing lamp pair '+c.asset);
  }return true;
 }
 function controller(reg,electrical,notify=()=>{}){
  let context=initialContext(),toggles={},rotaries={},guards={},test=false,electricalState=electrical.initialState();
  let oxygen=false;const faults=new Set(reg.lights.map(c=>c.id)),switchTime={};let result=null;
  const control=id=>toggles[id]??guards[id]?.value??rotaries[id];
  const isOn=id=>String(control(id)).toUpperCase()==='ON';
  function command(c){try{electricalState=electrical.apply(electricalState,c);}catch{ /* Unavailable source cannot latch. */ }}
  function syncElectrical(){
   for(const [key,value]of Object.entries({batterySwitch:isOn('battery-master'),standbySelector:String(control('standby-power')||'auto').toUpperCase(),engine1Running:context.engine1Running,engine2Running:context.engine2Running,apuRunning:context.apuRunning,groundPowerAttached:context.groundPowerAttached}))command({type:'CONTROL',key,value});
   for(const side of [1,2])command({type:'FAULT',id:'GEN'+side+'_FAILED',active:control('generator-disconnect-'+side)==='disconnect',instructor:true});
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
   const before=toggles;toggles={...t};rotaries={...r.rotaries};guards=copy(r.guards);
   for(const [id,value]of Object.entries(toggles))if(value!==before[id])switchTime[id]=now;
   if(control('passenger-oxygen')==='on')oxygen=true;
   syncElectrical();if(event)sourceEvent(event.id,event.next);
   return evaluate(now);
  }
  function update(patch,now=0){
   for(const [key,value]of Object.entries(patch)){
    if(key==='faults'){for(const [id,active]of Object.entries(value)){if(!faults.has(id)||typeof active!=='boolean')throw Error('Invalid lamp fault');context.faults[id]=active;}}
    else if(!Object.hasOwn(initialContext(),key)||typeof value!=='boolean')throw Error('Invalid scenario input');else context[key]=value;
   }
   syncElectrical();return evaluate(now);
  }
  function evaluate(now=0){
   const e=electrical.evaluate(electricalState),on={},unknown=[],fault=id=>context.faults[id]===true;
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
     case 'dc-fail':active=v!=='OFF'&&fault(c.id);break;
     case 'fault':active=v!=='OFF'&&fault(c.id);break;
     case 'apu':active=c.id==='apu-low-pressure'?control('apu-start')!=='OFF'&&(!context.apuRunning||fault(c.id)):fault(c.id);break;
     case 'oxygen':active=oxygen||context.passengerOxygenDeployed;break;
     case 'recorder':active=fault(c.sensor);break;
     default:throw Error('Unknown lamp predicate '+c.rule);
    }
    if(active===null){unknown.push(c.id);on[c.id]=available&&test?true:null;}else on[c.id]=available&&(test||!!active);
   }
   result={version:reg.version,lights:on,unknown,electrical:e,context:copy(context),lampTest:test,passengerOxygenDeployed:oxygen,power:available};notify(copy(result));return copy(result);
  }
  return {ingest,update,evaluate,snapshot:()=>copy(result),setLampTest:(v,now=0)=>{test=!!v;return evaluate(now);},reset:(now=0)=>{context=initialContext();oxygen=false;test=false;electricalState=electrical.initialState();syncElectrical();return evaluate(now);}};
 }
 return Object.freeze({initialContext,rectangle,validate,controller});
});
