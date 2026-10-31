/* BAT RECHARGE in the Unified top command bar. Electrical V7 is the
 * single authority: GEN/APU/EXT must actually energize an AC circuit.
 * Battery-only inverter power is not a reason to hide the recharge control.
 */
(function(root){
 'use strict';
 const ID='liveBatteryRecharge';
 const STORE='b737classic.live-battery.v1';
 let previousHidden=null;
 const owner=()=>root.B737ISNCockpitV1;
 function acPowerConnected(electrical){
  const bus=electrical?.bus;
  return bus?.generator1===true||bus?.generator2===true||bus?.groundService===true;
 }
 function electrical(){
  try{return owner()?.getState?.()?.state?.electrical||null;}
  catch(error){console.warn('BAT RECHARGE source state unavailable:',error);return null;}
 }
 function update(){
  const button=document.getElementById(ID);
  if(!button)return;
  const connected=acPowerConnected(electrical());
  const ready=typeof owner()?.rechargeLiveBattery==='function';
  if(connected!==previousHidden){
   button.hidden=connected;
   previousHidden=connected;
  }
  button.disabled=connected||!ready;
  button.dataset.acConnected=String(connected);
  button.title=connected?'AC bus energized — BAT RECHARGE hidden':
   !ready?'Waiting for the live battery ECU':'Recharge the training battery to 100%';
 }
 function persistFromECU(){
  const state=owner()?.getElectricalState?.()?.battery;
  if(!state||!Number.isFinite(state.chargeAh)||!Number.isFinite(state.capacityAh))
   throw Error('Battery state unavailable for persistence');
  try{
   localStorage.setItem(STORE,JSON.stringify({schema:'b737-saved-battery/1',state}));
  }catch(error){console.warn('Battery charged but persistence unavailable:',error);}
 }
 function recharge(event){
  event.preventDefault();event.stopPropagation();
  const button=document.getElementById(ID);
  if(!button||acPowerConnected(electrical())){update();return;}
  button.disabled=true;
  try{
   const installed=root.B737InstalledBattery;
   let battery;
   if(typeof installed?.recharge==='function')battery=installed.recharge();
   else if(typeof owner()?.rechargeLiveBattery==='function'){
    battery=owner().rechargeLiveBattery();
    installed?.refresh?.();
   }else throw Error('Live electrical ECU is not ready');
   if(!battery||battery.percent<99.99)
    throw Error('Battery ECU did not reach 100%');
   persistFromECU();
   button.textContent='BAT RECHARGE';
   button.dataset.recharge='success';
   root.dispatchEvent(new CustomEvent('b737:battery-recharge-header',{detail:{percent:battery.percent}}));
  }catch(error){
   console.error('BAT RECHARGE failed:',error);
   button.textContent='RECHARGE FAILED';
   button.dataset.recharge='error';
   button.title=String(error.message||error);
  }finally{update();}
 }
 function start(){
  const button=document.getElementById(ID);
  if(!button)return;
  button.addEventListener('click',recharge);
  for(const event of ['b737:electrical-owner-ready','b737:electrical-network',
   'b737:battery-live','b737:unified-ecu-observation','b737:battery-recharged'])
   root.addEventListener(event,update);
  update();
 }
 root.B737BatteryRechargeHeader=Object.freeze({acPowerConnected,refresh:update});
 if(document.readyState==='loading')
  document.addEventListener('DOMContentLoaded',start,{once:true});
 else start();
})(window);
