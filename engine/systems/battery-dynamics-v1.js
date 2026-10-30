/* Coulomb-counted training battery. 24V NiCd identity: Classic FCOM 6.20.9.
 * Capacity, OCV curve, resistance and charger rates are explicit TRAINING
 * parameters, not an EP-FSI battery part-number or certified endurance claim.
 * Positive ammeter current = charge; negative = discharge.
 */
(function(root,factory){'use strict';const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.B737BatteryDynamicsV1=api;
})(typeof globalThis!=='undefined'?globalThis:null,function(){
 'use strict';
 const PROFILE=Object.freeze({capacityAh:40,resistanceOhm:0.012,chargerMaxA:25,
  chargerTargetA:20,chargerVolts:28,minimumBusVolts:21,quality:'TRAINING_PARAMETERS_NOT_EP_FSI_CALIBRATED'});
 const copy=v=>JSON.parse(JSON.stringify(v));
 const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
 function number(v,name,min=0,max=Infinity){if(typeof v!=='number'||!Number.isFinite(v)||v<min||v>max)throw Error('Invalid battery '+name);return v;}
 function initial({capacityAh=PROFILE.capacityAh,chargeAh=capacityAh}={}){
  number(capacityAh,'capacity',1,200);number(chargeAh,'charge',0,capacityAh);
  return {schema:'b737-battery/1',capacityAh,chargeAh,elapsedSec:0,dischargedAh:0,chargedAh:0,
   dischargedWh:0,chargedWh:0,voltageV:ocv(chargeAh/capacityAh),ammeterA:0,
   dischargeA:0,chargeA:0,loadWatts:0,chargerA:0,depleted:chargeAh===0,loads:[],
   quality:PROFILE.quality};
 }
 function ocv(soc){
  number(soc,'SOC',0,1);
  // Deliberately simplified NiCd plateau and end-of-discharge knee.
  return soc<0.1?22+soc*20:24+((soc-0.1)/0.9)*1.5;
 }
 function inputs(value={}){
  const {loadAmps=0,inverterWatts=0,chargerAvailable=false,forcedFailed=false,loads=[]}=value;
  number(loadAmps,'load',0,2000);number(inverterWatts,'AC load',0,10000);
  if(typeof chargerAvailable!=='boolean'||typeof forcedFailed!=='boolean'||!Array.isArray(loads))throw Error('Invalid battery source inputs');
  return {loadAmps,inverterWatts,chargerAvailable,forcedFailed,loads:copy(loads)};
 }
 function validate(s){
  if(s?.schema!=='b737-battery/1')throw Error('Battery state required');
  number(s.capacityAh,'capacity',1,200);number(s.chargeAh,'charge',0,s.capacityAh);
  for(const key of ['elapsedSec','dischargedAh','chargedAh','dischargedWh','chargedWh'])number(s[key],key);
 }
 function sample(s,i){
  const soc=s.chargeAh/s.capacityAh,openVolts=ocv(soc);
  const demand=i.loadAmps+i.inverterWatts/(Math.max(21,openVolts)*0.85);
  let charger=0,net=-demand;
  if(i.chargerAvailable&&!i.forcedFailed){
   const taper=clamp((1-soc)/0.1,0,1)*PROFILE.chargerTargetA;
   charger=Math.min(PROFILE.chargerMaxA,demand+taper);net=charger-demand;
  }
  if(i.forcedFailed){net=0;charger=0;}
  if(s.chargeAh<=0&&net<0)net=0;
  if(s.chargeAh>=s.capacityAh&&net>0)net=0;
  const voltage=i.chargerAvailable&&!i.forcedFailed&&demand<=PROFILE.chargerMaxA?
   PROFILE.chargerVolts:Math.max(0,openVolts+net*PROFILE.resistanceOhm);
  return {voltageV:voltage,ammeterA:net,dischargeA:Math.max(0,-net),chargeA:Math.max(0,net),
   loadWatts:demand*voltage,chargerA:charger,
   depleted:s.chargeAh<=0||i.forcedFailed,
   available:!i.forcedFailed&&s.chargeAh>0&&voltage>=PROFILE.minimumBusVolts};
 }
 function step(state,dtSec,rawInputs={}){
  validate(state);number(dtSec,'clock step',0,86400);const i=inputs(rawInputs),s=copy(state);
  // <=1s integration: equivalent foreground ticks and a throttled background
  // catch-up use the same load/voltage curve. No accelerated UI clock.
  let remaining=dtSec;
  while(remaining>0){
   const dt=Math.min(1,remaining),p=sample(s,i),before=s.chargeAh;
   s.chargeAh=clamp(before+p.ammeterA*dt/3600,0,s.capacityAh);
   const delta=s.chargeAh-before;
   if(delta<0){s.dischargedAh-=delta;s.dischargedWh-=delta*p.voltageV;}
   else{s.chargedAh+=delta;s.chargedWh+=delta*p.voltageV;}
   s.elapsedSec+=dt;remaining-=dt;
  }
  Object.assign(s,sample(s,i),{loads:i.loads});return s;
 }
 function snapshot(state){validate(state);const s=copy(state),soc=s.chargeAh/s.capacityAh;
  return {...s,soc,percent:soc*100,remainingWh:s.chargeAh*24,
   remainingMinutes:s.dischargeA>0?s.chargeAh/s.dischargeA*60:null,
   status:s.depleted?'EMPTY':s.chargeA>0.01?'CHARGING':s.dischargeA>0.01?'DISCHARGING':'HOLD'};
 }
 return Object.freeze({PROFILE,initial,step,snapshot,ocv});
});
