/* ATA24-LOAD-DYNAMICS-0002: deterministic, bounded training estimates.
 * V7 owns power routing. V1 retains its legacy unit tests and catalog.
 * No assumed load/CB feed is claimed as a verified EP-FSI wiring value.
 * No change to lamps, panel art, needles, switches or physical detents.
 */
(function(root,factory){'use strict';
 const api=factory(typeof module==='object'&&module.exports?require('./electrical-demand-estimate-v1.js'):root.B737ElectricalDemandEstimateV1);
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.B737ElectricalDemandEstimateV2=api;
})(typeof globalThis!=='undefined'?globalThis:null,function(Base){
 'use strict';
 if(!Base?.project||!Base.CATALOG)throw Error('ATA24 V1 model is required');
 const VERSION='ATA24-LOAD-DYNAMICS-0002';
 const AC_CONVERSION=28/(Math.sqrt(3)*200*0.82*0.90);
 const MOTOR_IDS=new Set(Base.CATALOG.filter(x=>x.system==='FUEL'||x.system==='HYDRAULIC'||
  x.id==='EQUIP_COOL_SUP'||x.id==='EQUIP_COOL_EXH'||x.id==='RECIRC_FAN').map(x=>x.id));
 const HEAT_IDS=new Set(['WIN_L_FWD','WIN_L_SIDE','WIN_R_FWD','WIN_R_SIDE']);
 const round=n=>Math.round(n*100)/100;
 const clip=(n,a,b)=>Math.max(a,Math.min(b,n));
 function fraction(value,fallback,label){
  if(value==null)return fallback;
  if(typeof value!=='number'||!Number.isFinite(value)||value<0||value>1)
   throw Error(label+' must be a finite fraction 0..1');
  return value;
 }
 function project(input={}){
  const base=Base.project(input),loads=[];
  const galleyDuty=fraction(input.galleyDuty,0,'Galley appliance demand');
  const hydraulicDuty=fraction(input.hydraulicDuty,0.35,'Hydraulic pressure demand');
  const fallbackWindowDuty=fraction(input.fallbackWindowDuty,0.55,'Window heater training duty');
  const latched=input.galleyShedLatched===true;
  const runSeconds=input.motorRunSeconds||{};
  const sourceAmps={GEN1:0,GEN2:0,APU:0,EXT:0},trAmps={TR1:0,TR2:0,TR3:0};
  for(const old of base.loads){
   let factor=1,reason='NOMINAL_TRAINING_RUNNING';
   if(old.system==='GALLEY'){
    factor=latched?0:galleyDuty;
    reason=latched?'GALLEY_SHED_SIMULATION':galleyDuty?'APPLIANCE_DUTY_TRAINING':'POWER_ON_APPLIANCES_IDLE';
   }else if(old.system==='HYDRAULIC'){
    // A running variable-delivery pump does not consume rated full-flow power
    // indefinitely. Without a real hydraulic demand signal use a mid/low state.
    factor=.60+.40*hydraulicDuty;
    reason='VARIABLE_DELIVERY_PUMP_TRAINING';
   }else if(HEAT_IDS.has(old.id)&&!input.windowHeat?.channels){
    // A selected thermostatic heater need not draw full current continuously.
    factor=fallbackWindowDuty;reason='THERMOSTAT_DUTY_ESTIMATE';
   }
   if(MOTOR_IDS.has(old.id)&&old.active){
    const t=runSeconds[old.id];
    if(t!==undefined&&(typeof t!=='number'||!Number.isFinite(t)||t<0))
     throw Error('Invalid motor run seconds: '+old.id);
    if(Number.isFinite(t)&&t<2){
     // Short motor inrush, smoothly decaying to its running load.
     const transient=1+.55*(1-t/2);
     factor*=transient;
     reason+='+START_TRANSIENT';
    }
   }
   const amps=old.active?round(old.nominalA*factor):0;
   const active=old.active&&amps>0;
   const row={...old,active,currentA:amps,source:active?old.source:null,
    dutyFactor:round(factor),demandModel:reason};
   loads.push(row);
   if(!active||!row.source||!Object.hasOwn(sourceAmps,row.source))continue;
   sourceAmps[row.source]+=row.unit==='AC_GEN_EQUIV_A'?amps:amps*AC_CONVERSION;
   if(row.unit==='DC_28V_A'){
    // Keep V1's TR assignment as the authoritative electrical routing owner.
    const original=Base.CATALOG.find(x=>x.id===row.id);
    const b=original?.bus;
    const e=input.electrical;
    const feed=e?.feed;
    let tr=null;
    if(b==='dc1'||b==='dc2'){
     const side=b==='dc1'?1:2,main='TR'+side,other='TR'+(3-side);
     tr=feed.tr[main]?main:feed.tie&&feed.tr[other]?other:null;
    }else if(b==='battery')tr=feed.tr.TR3?'TR3':null;
    else if(b==='dcStandby')tr=feed.standbyFeed==='TRANSFER1_DC1'?
      (feed.tr.TR1?'TR1':feed.tie&&feed.tr.TR2?'TR2':null):feed.tr.TR3?'TR3':null;
    if(tr)trAmps[tr]+=amps;
   }
  }
  const bat=input.battery;
  if(bat&&Number.isFinite(bat.chargerA)&&input.electrical.feed.tr.TR3){
   trAmps.TR3+=bat.chargerA;
   const chargingSource=input.electrical.source[2];
   if(chargingSource&&Object.hasOwn(sourceAmps,chargingSource))
    sourceAmps[chargingSource]+=bat.chargerA*AC_CONVERSION;
  }
  for(const key of Object.keys(sourceAmps))sourceAmps[key]=round(sourceAmps[key]);
  for(const key of Object.keys(trAmps))trAmps[key]=round(trAmps[key]);
  const apuLimitA=input.onGround===false?125:150;
  const apuAmps=sourceAmps.APU;
  const needsGalleyShed=apuAmps>162&&galleyDuty>0&&input.toggles?.galley==='ON'&&!latched;
  return {...base,version:VERSION,loads,sourceAmps,trAmps,
   totals:{...base.totals,sourceGenAmps:round(Object.values(sourceAmps).reduce((a,b)=>a+b,0)),
    acLoadCount:loads.filter(x=>x.active&&x.unit==='AC_GEN_EQUIV_A').length,
    dcLoadCount:loads.filter(x=>x.active&&x.unit==='DC_28V_A').length},
   apu:{amps:apuAmps,limitA:apuLimitA,overLimit:apuAmps>apuLimitA,
    needsGalleyShed,galleyShedLatched:latched,
    loadPct:round(100*apuAmps/apuLimitA),onGround:input.onGround!==false,
    quality:'LIMIT_TRAINING_REFERENCE_REQUIRES_AIRFRAME_EFFECTIVITY'},
   systemAmps:Object.fromEntries([...new Set(loads.map(x=>x.system))].map(system=>
    [system,round(loads.filter(x=>x.system===system&&x.active)
     .reduce((sum,x)=>sum+(x.unit==='AC_GEN_EQUIV_A'?x.currentA:x.currentA*AC_CONVERSION),0))])),
   quality:'APPROXIMATE_DYNAMIC_LOADS_NOT_AIRFRAME_WDM_OR_CERTIFIED_AMPS',
   notes:[...base.notes,'Galley power ON only energizes outlets; appliances start with zero simulated demand',
    'Hydraulic variable-displacement pump has a part-load running state and motor start transient',
    'APU >162A galley shed only if installed training option is enabled',
    'APU 125A flight/150A ground reference is not a forced ammeter cap']};
 }
 return Object.freeze({VERSION,CATALOG:Base.CATALOG,MOTOR_IDS,project});
});
