/* Installed battery -> existing BAT selector/ammeter/voltmeter and panel power.
 * Real elapsed seconds, persistent charge, no Controls page or fast-time switch.
 */
(function(root){
 'use strict';
 const Engine=root.B737BatteryDynamicsV1,Loads=root.B737BatteryPanelLoadsV1;
 if(!Engine||!Loads)return;
 const STORE='b737classic.live-battery.v1';
 let attached=false,busy=false,readout=null,lastAt=Date.now(),lastInputs=null,lastPower=null,
  savedAt=0,timer=null,current=null,restored=false;
 const owner=()=>root.B737ISNCockpitV1;
 const copy=v=>JSON.parse(JSON.stringify(v));
 function stored(){
  try{const data=JSON.parse(localStorage.getItem(STORE)||'null');
   if(data?.schema==='b737-saved-battery/1'){const b=Engine.step(data.state,0);restored=true;return b;}
  }catch(error){console.warn('Battery saved charge unavailable:',error.message);}
  return null;
 }
 function save(){
  if(!attached)return;
  try{localStorage.setItem(STORE,JSON.stringify({schema:'b737-saved-battery/1',state:owner().getElectricalState().battery}));savedAt=Date.now();}
  catch(error){if(readout)readout.dataset.persistence='UNAVAILABLE';}
 }
 function panelInputs(){
  const p=owner(),raw=p.getElectricalState(),electrical=p.getState().state.electrical,
   frame=document.getElementById('overheadFrame'),win=frame?.contentWindow;
  let litLamps=0,brightness=50,irsModes={L:'OFF',R:'OFF'};
  try{
   litLamps=frame?.contentDocument?.querySelectorAll('.mounted-light[data-frame="ON"],.mounted-light[data-frame="BRIGHT_BLUE"],.mounted-light[data-frame="DIM_BLUE"]').length||0;
   const rotaries=win?.B737RotaryGuards?.getState?.()?.rotaries||{};
   const br=Number(rotaries['panel-brightness']);if(Number.isFinite(br))brightness=Math.max(0,Math.min(100,br));
   for(const [side,id]of [['L','irs-l-mode'],['R','irs-r-mode']]){
    if(['OFF','ALIGN','NAV','ATT'].includes(rotaries[id]))irsModes[side]=rotaries[id];
   }
  }catch{}
  const main=root.B737CockpitLights?.getState?.();
  if(main?.frames)litLamps+=Object.values(main.frames).filter(x=>x!=='OFF').length;
  return Loads.project(raw,electrical,{litLamps,brightness,irsModes,apuPhase:p.getStartState?.()?.phase?.apu||'OFF'});
 }
 function mount(){
  const viewport=document.getElementById('viewport');if(!viewport||readout)return;
  readout=document.createElement('section');readout.id='liveBatteryReadout';readout.dir='ltr';
  readout.setAttribute('aria-label','Live aircraft battery voltage current charge and consumption');
  readout.style.cssText='position:absolute;top:8px;left:8px;z-index:1900;pointer-events:none;max-width:calc(100% - 16px);padding:7px 11px;border:1px solid #668270;border-radius:7px;background:#0b191eee;color:#d9f2de;font:12px/1.6 system-ui;box-shadow:0 2px 9px #0005';
  readout.innerHTML='<b>BATTERY <span data-battery-percent></span></b> <span data-battery-status></span><div style="display:flex;gap:12px;flex-wrap:wrap;font:600 15px/1.7 monospace"><span data-battery-volts></span><span data-battery-amps></span><span data-battery-watts></span></div><div style="font-size:10px;color:#adc0c1"><span data-battery-used></span> · 40 Ah مدل آموزشی</div>';
  viewport.append(readout);
 }
 function paint(){
  mount();if(!readout||!current)return;
  const set=(key,text)=>{readout.querySelector('[data-battery-'+key+']').textContent=text;};
  set('percent',current.percent.toFixed(2)+'%');
  set('volts',current.voltageV.toFixed(2)+' V');
  set('amps',(current.ammeterA>=0?'+':'')+current.ammeterA.toFixed(2)+' A');
  set('watts',(current.voltageV*current.dischargeA).toFixed(1)+' W');
  set('used','مصرف '+current.dischargedAh.toFixed(3)+' Ah / '+current.dischargedWh.toFixed(2)+' Wh');
  set('status',current.status==='EMPTY'?'باتری خالی':current.status==='CHARGING'?'در حال شارژ':current.status==='DISCHARGING'?'در حال مصرف':'آماده');
  readout.dataset.status=current.status;readout.dataset.restored=String(restored);
  readout.style.borderColor=current.percent<=10?'#da6c45':'#668270';
 }
 function power(){
  const p=owner(),b=p.getState().state.electrical.bus,
   available=b.battery===true||b.dc1===true||b.dc2===true||b.dcStandby===true;
  const frame=document.getElementById('overheadFrame');
  if(frame?.contentWindow&&available!==lastPower){
   lastPower=available;
   frame.contentWindow.postMessage({type:'b737:cockpit-command',action:'live-electrical-supply',power:available},location.origin);
  }
 }
 function tick(){
  if(busy||!owner()?.attachLiveBattery)return;
  busy=true;
  try{
   const p=owner(),now=Date.now();
   if(!attached){p.attachLiveBattery(stored());attached=true;lastAt=now;}
   const dt=Math.max(0,Math.min(86400,(now-lastAt)/1000));lastAt=now;
   const nextInputs=panelInputs();
   current=p.advanceLiveBattery(dt,lastInputs||nextInputs);
   // Apply changed switches immediately after integrating the previous interval.
   const afterInputs=panelInputs();
   if(JSON.stringify(afterInputs)!==JSON.stringify(lastInputs))current=p.advanceLiveBattery(0,afterInputs);
   lastInputs=afterInputs;
   power();paint();
   root.dispatchEvent(new CustomEvent('b737:battery-live',{detail:copy(current)}));
   if(now-savedAt>=5000)save();
  }catch(error){console.error('Live battery:',error);}
  finally{busy=false;}
 }
 function start(){
  // ECU observations can fire at 10 Hz; every old 'start()' invoked a full
  // battery step, ECU render, panel repaint and another observation event.
  // Bound this live integration to 2.5 Hz plus the existing 1 Hz timer.
  // Physical meter-selector actions below still refresh immediately.
  if(!attached||Date.now()-lastAt>=400)tick();
  if(attached&&!timer)timer=setInterval(tick,1000);
 }
 for(const name of ['b737:electrical-owner-ready','b737:unified-ecu-observation'])root.addEventListener(name,start);
 root.addEventListener('message',event=>{
  if(event.origin!==location.origin||event.source!==document.getElementById('overheadFrame')?.contentWindow)return;
  const d=event.data;if(d?.type!=='b737:cockpit-overhead')return;
  const e=d.event;
  if(d.kind==='control-event'&&e?.kind==='rotary'){
   const selectors=root.B737UnifiedAcDcSelectors;
   if(e.id==='dc-meter'&&selectors?.detents.DC.includes(e.next))selectors.choose('DC',e.next);
   if(e.id==='ac-meter'){
    const next=({'GRD PWR':'GND PWR','GEN 1':'GEN1','GEN 2':'GEN2'})[e.next]||e.next;
    if(selectors?.detents.AC.includes(next))selectors.choose('AC',next);
   }
   tick();
  }
 });
 document.getElementById('overheadFrame')?.addEventListener('load',()=>{lastPower=null;start();});
 document.addEventListener('visibilitychange',()=>{tick();save();});
 root.addEventListener('pagehide',()=>{tick();save();});
 root.B737InstalledBattery=Object.freeze({snapshot:()=>current?copy(current):null});
 start();
})(window);
