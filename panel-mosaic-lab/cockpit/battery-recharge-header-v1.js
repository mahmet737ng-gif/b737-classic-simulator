/* Instructor BAT RECHARGE in the Unified top command bar.
 * Always visible and usable regardless of AC generator, ground service,
 * external power or standby inverter. Actual charge stays in the ECU.
 */
(function(root){
 'use strict';
 const ID='liveBatteryRecharge';
 const STORE='b737classic.live-battery.v1';
 const owner=()=>root.B737ISNCockpitV1;
 // The cockpit header may be rebuilt by a launcher or an older cached page.
 // Own exactly one command button and keep it immediately after CB PNL (RTL:
 // visually to the left). Never make visibility dependent on AC availability.
 function ensureButton(){
  const bar=document.querySelector('body > header.unified-minimal-header .header-settings');
  if(!bar)return null;
  let button=document.getElementById(ID);
  if(!button){
   button=document.createElement('button');
   button.id=ID;button.type='button';
   button.textContent='BAT RECHARGE';
   button.setAttribute('aria-label','Recharge training battery to 100 percent');
  }
  const cb=bar.querySelector('#cbPanelOpen');
  if(cb){
   if(button.parentElement!==bar||button.previousElementSibling!==cb)
    cb.insertAdjacentElement('afterend',button);
  }else if(button.parentElement!==bar)bar.append(button);
  // Other electrical modules may mark the HUD hidden; this instructor
  // command MUST remain visible with or without generator/GPU/APU power.
  if(button.hidden)button.hidden=false;
  if(button.style.getPropertyValue('display')!=='inline-flex'||
     button.style.getPropertyPriority('display')!=='important')
   button.style.setProperty('display','inline-flex','important');
  if(button.dataset.batteryRechargeBound!=='true'){
   button.addEventListener('click',recharge);
   button.dataset.batteryRechargeBound='true';
  }
  return button;
 }
 function acPowerConnected(electrical){
  const bus=electrical?.bus;
  return bus?.generator1===true||bus?.generator2===true||bus?.groundService===true;
 }
 function electrical(){
  try{return owner()?.getState?.()?.state?.electrical||null;}
  catch(error){console.warn('BAT RECHARGE source state unavailable:',error);return null;}
 }
 function update(){
  const button=ensureButton();
  if(!button)return;
  const connected=acPowerConnected(electrical());
  const ready=typeof root.B737InstalledBattery?.recharge==='function'||
   typeof owner()?.rechargeLiveBattery==='function';
  // Instructor recharge must remain present with AC online, off, or unknown.
  button.hidden=false;
  button.disabled=!ready;
  button.dataset.acConnected=String(connected);
  button.title=!ready?'Waiting for the live battery ECU':
   'Recharge training battery to 100% — AC state does not inhibit this control';
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
  const button=ensureButton();
  if(!button)return;
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
  const button=ensureButton();
  if(!button)return;
  // Only watch the four-command header, not the large animated cockpit.
  // A launcher-driven replacement of the bar can no longer lose the control.
  const bar=button.parentElement;
  if(typeof MutationObserver==='function'){
   const observer=new MutationObserver(()=>{ensureButton();update();});
   observer.observe(bar,{childList:true});
  }
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
