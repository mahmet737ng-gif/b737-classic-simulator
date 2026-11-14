/* Battery HUD visibility and recharge control resilient to cached HUD runtime.
 * Does not create a second battery state. All writes go to the ECU owner.
 */
(function(root){
 'use strict';
 const hudId='liveBatteryReadout',buttonId='liveBatteryRecharge';
 let mounted=false;
 function owner(){return root.B737ISNCockpitV1;}
 function connectedGenerator(){
  const evaluated=owner()?.getState?.()?.state?.electrical;
  return [1,2].some(side=>
   ['GEN1','GEN2','APU'].includes(evaluated?.source?.[side]) &&
   evaluated?.bus?.['generator'+side]===true);
 }
 function showSnapshot(battery){
  if(!battery)return;
  const hud=document.getElementById(hudId);
  if(!hud)return;
  const map={
   percent:battery.percent.toFixed(2)+'%',
   volts:battery.voltageV.toFixed(2)+' V',
   amps:(battery.ammeterA>=0?'+':'')+battery.ammeterA.toFixed(2)+' A',
   watts:(battery.voltageV*battery.dischargeA).toFixed(1)+' W',
   used:'مصرف '+battery.dischargedAh.toFixed(3)+' Ah / '+battery.dischargedWh.toFixed(2)+' Wh',
   status:battery.status==='EMPTY'?'باتری خالی':battery.status==='CHARGING'?'در حال شارژ':battery.status==='DISCHARGING'?'در حال مصرف':'آماده'
  };
  for(const [key,value]of Object.entries(map)){
   const el=hud.querySelector('[data-battery-'+key+']');
   if(el)el.textContent=value;
  }
 }
 function recharge(event){
  event.preventDefault();event.stopPropagation();
  // Override any old click listener that survived HTTP/browser caching.
  event.stopImmediatePropagation();
  const button=document.getElementById(buttonId);
  try{
   const installed=root.B737InstalledBattery;
   let battery;
   if(typeof installed?.recharge==='function'){
    battery=installed.recharge();
   }else{
    // Compatibility for a cached v1 HUD with an updated electrical ECU.
    const ecu=owner();
    if(typeof ecu?.rechargeLiveBattery!=='function')throw Error('Electrical ECU not initialized or cached. Refresh the cockpit.');
    battery=ecu.rechargeLiveBattery();
    // Persist from the authoritative ECU state, never from a display value.
    const state=ecu.getElectricalState?.().battery;
    if(state)localStorage.setItem('b737classic.live-battery.v1',JSON.stringify({
     schema:'b737-saved-battery/1',state
    }));
    installed?.refresh?.();
   }
   if(!battery||battery.percent<99.999)throw Error('Battery ECU did not report full charge');
   showSnapshot(battery);
   if(button){button.textContent='BAT RECHARGE';button.title='ECU battery at 100% and saved';button.dataset.recharge='success';}
  }catch(error){
   console.error('BAT RECHARGE failed:',error);
   if(button){button.textContent='RECHARGE FAILED';button.title=String(error.message||error);button.dataset.recharge='error';}
  }
 }
 function ensure(){
  const hud=document.getElementById(hudId);
  if(!hud)return;
  let btn=hud.querySelector('#'+buttonId);
  if(!btn){
   btn=document.createElement('button');
   btn.id=buttonId;btn.type='button';btn.textContent='BAT RECHARGE';
   btn.setAttribute('aria-label','Recharge the installed training battery to 100 percent');
   btn.style.cssText='display:block!important;visibility:visible!important;position:relative;box-sizing:border-box;margin-top:7px;padding:6px 10px;min-height:32px;width:100%;border:1px solid #6c9a8d;border-radius:5px;background:#163a3c;color:#e5fff3;font:700 12px/1.3 system-ui;cursor:pointer;pointer-events:auto;touch-action:manipulation';
   for(const type of ['pointerdown','mousedown','touchstart','dblclick'])btn.addEventListener(type,event=>event.stopPropagation());
   hud.append(btn);
  }
  // Capture clicks from both fresh and cached legacy battery buttons.
  if(btn.dataset.rechargeHandlerV3!=='true'){
   btn.addEventListener('click',recharge,true);
   btn.dataset.rechargeHandlerV3='true';
  }
  btn.style.pointerEvents='auto';
  hud.style.display=connectedGenerator()?'none':'';
 }
 function ready(){
  if(mounted)return;mounted=true;
  ensure();
  const viewport=document.getElementById('viewport');
  if(viewport&&typeof MutationObserver==='function'){
   const observer=new MutationObserver(ensure);
   observer.observe(viewport,{childList:true});
  }
  root.addEventListener('b737:battery-live',ensure);
  root.addEventListener('b737:electrical-network',ensure);
  root.addEventListener('b737:electrical-owner-ready',ensure);
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',ready,{once:true});
 else ready();
})(window);
