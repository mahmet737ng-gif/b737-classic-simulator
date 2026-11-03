/* 737 Classic GRD POWER trainer control in the Unified header.
 * FCOM 6.10.6 / 6.20.2 / SP.6.1. External cable and cockpit momentary
 * GRD PWR switch are separate steps; never manufacture AC power on attach.
 * One electrical owner: the existing ISN03 ECU Electrical V7 Pack.
 */
(function(root){
 'use strict';
 const ID='groundPowerHeader',PANEL='groundPowerPopover';
 const policy=root.B737GroundPowerHeaderPolicyV1;
 if(!policy)return;
 let button=null,panel=null,notice=null,opened=false,lastSignature='';
 const byId=id=>document.getElementById(id);
 const owner=()=>root.B737ISNCockpitV1;
 const electrical=()=>root.B737ElectricalV7;
 function snapshot(){
  const state=owner()?.getElectricalState?.();
  if(!state||!electrical()?.evaluate)return null;
  return {state,projection:electrical().evaluate(state),
   view:policy.evaluate(state,electrical().evaluate(state))};
 }
 function bar(){return document.querySelector('body > header.unified-minimal-header .header-settings');}
 function ensure(){
  const holder=bar();if(!holder)return false;
  button=byId(ID);
  if(!button){
   button=document.createElement('button');button.id=ID;button.type='button';
   button.textContent='GROUND POWER';
  }
  const bat=holder.querySelector('#liveBatteryRecharge');
  if(bat&&button.previousElementSibling!==bat)bat.insertAdjacentElement('afterend',button);
  else if(!button.isConnected)holder.append(button);
  if(button.dataset.gpuBound!=='true'){
   button.addEventListener('click',()=>{opened=!opened;panel.hidden=!opened;
    button.setAttribute('aria-expanded',String(opened));render(true);});
   button.dataset.gpuBound='true';
  }
  button.setAttribute('aria-controls',PANEL);
  button.setAttribute('aria-haspopup','dialog');
  button.setAttribute('aria-expanded',String(opened));
  button.setAttribute('aria-label','Ground power cable and GRD PWR switch');
  if(!panel){
   panel=document.createElement('section');panel.id=PANEL;
   panel.setAttribute('role','dialog');panel.setAttribute('aria-label','External Ground Power — FCOM');
   panel.setAttribute('dir','ltr');panel.hidden=true;
   panel.innerHTML=
    '<header><strong>GROUND POWER · 737 CLASSIC</strong><button type="button" id="gpuClose" aria-label="Close ground power controls">×</button></header>'+
    '<p id="gpuStatus" role="status">WAITING FOR LIVE ELECTRICAL SYSTEM</p>'+
    '<p id="gpuAvailability">GRD POWER AVAILABLE: —</p>'+
    '<p id="gpuBus">AC TRANSFER BUS 1 / 2: —</p>'+
    '<div class="gpu-actions">'+
    '<button type="button" data-gpu-action="CONNECT">1 · CONNECT GPU</button>'+
    '<button type="button" data-gpu-action="DISCONNECT">DISCONNECT GPU</button>'+
    '<button type="button" data-gpu-action="ON">2 · GRD PWR ON</button>'+
    '<button type="button" data-gpu-action="OFF">GRD PWR OFF</button></div>'+
    '<p class="gpu-explain">FCOM sequence: connect approved external AC → check GRD POWER AVAILABLE → BAT ON → momentarily select GRD PWR ON → verify BUS OFF / TRANSFER BUS OFF and STANDBY PWR OFF extinguish. The real P5 switch remains usable.</p>'+
    '<p id="gpuMessage" role="status" aria-live="polite"></p>';
   document.body.append(panel);
   notice=byId('gpuMessage');
   panel.querySelector('#gpuClose').addEventListener('click',close);
   for(const control of panel.querySelectorAll('[data-gpu-action]')){
    control.addEventListener('click',()=>run(control.dataset.gpuAction));
   }
   document.addEventListener('keydown',event=>{if(event.key==='Escape'&&opened)close();});
   document.addEventListener('pointerdown',event=>{
    if(opened&&!panel.contains(event.target)&&!button?.contains(event.target))close();
   });
  }
  return true;
 }
 function close(){opened=false;if(panel)panel.hidden=true;if(button)button.setAttribute('aria-expanded','false');}
 function message(value,error=false){
  if(!notice)return;
  notice.textContent=value||'';notice.dataset.error=String(error);
 }
 function render(force=false){
  if(!ensure())return;
  const s=snapshot();
  const sig=JSON.stringify(s?{
   rev:s.state.rev,attached:s.view.attached,connected:s.view.connected,
   battery:s.view.batteryOn,ground:s.view.onGround,quality:s.view.quality,
   source:s.projection.source,bus:s.projection.bus
  }:null);
  if(!force&&lastSignature===sig)return;
  lastSignature=sig;
  if(!s){
   button.dataset.gpu='WAITING';button.title='Waiting for the live Electrical V7 owner';
   button.disabled=false;
   if(panel&&!panel.hidden){
    byId('gpuStatus').textContent='WAITING FOR LIVE ELECTRICAL SYSTEM';
    for(const el of panel.querySelectorAll('[data-gpu-action]'))el.disabled=true;
   }
   return;
  }
  const {view:v,projection:p}=s;
  button.dataset.gpu=v.status;
  button.title=v.connected?'External AC feeding both AC transfer buses':
   v.available?'GPU attached; use GRD PWR ON with BATTERY ON':
   v.attached?'GPU attached, quality rejected':'Ground power cable disconnected';
  if(!panel?.hidden){
   byId('gpuStatus').textContent='GPU: '+v.status+
    ' · BATTERY '+(v.batteryOn?'ON':'OFF')+
    ' · ON GROUND '+(v.onGround?'YES':'NO');
   byId('gpuAvailability').textContent='GRD POWER AVAILABLE: '+(v.available?'BLUE / ON':'OFF')+
    (v.attached&&!v.quality?' · BAD QUALITY':'');
   byId('gpuBus').textContent='AC TRANSFER BUS 1: '+(p.bus.transfer1?'POWERED':'OFF')+
    ' · BUS 2: '+(p.bus.transfer2?'POWERED':'OFF')+
    ' · SOURCE 1/2: '+(p.source[1]||'NONE')+'/'+(p.source[2]||'NONE');
   for(const control of panel.querySelectorAll('[data-gpu-action]')){
    const a=control.dataset.gpuAction;
    control.disabled=a==='CONNECT'?!v.canConnect:a==='DISCONNECT'?!v.canDisconnect:
     a==='ON'?!v.canSwitchOn:!v.canSwitchOff;
   }
  }
 }
 function environment(attached){
  const lights=byId('overheadFrame')?.contentWindow?.B737OverheadLights;
  if(typeof lights?.setScenario!=='function')
   throw Error('The original overhead must be ready before connecting the GPU');
  // The iframe owns the physical scenario; its controls-state snapshot
  // flows through the existing Bridge into the very same electrical Pack.
  const observation=lights.setScenario({groundPowerAttached:attached});
  if(observation?.context?.groundPowerAttached!==attached)
   throw Error('Overhead GPU cable scenario was not accepted');
 }
 function run(action){
  try{
   if(!policy.ACTIONS.includes(action))throw Error('Unsupported GPU command');
   const s=snapshot();
   if(!s)throw Error('The live Electrical V7 system is not ready');
   const plan=policy.plan(action,s.state,s.projection);
   if(plan.environmentAttached===true){
    environment(true);
    message('GPU cable connected; wait for GRD POWER AVAILABLE, then select GRD PWR ON');
   }else{
    // Before requesting OFF or physical cable removal, retain generator/APU
    // connections on unrelated buses. Only remove a selected EXT contactor.
    for(const command of plan.sourceCommands){
     owner().instructor({type:'ELECTRICAL',action:command});
     const after=owner().getElectricalState();
     if(command.source==='EXT'&&!(after.source[1]==='EXT'&&after.source[2]==='EXT'))
      throw Error('GRD PWR ON rejected by live electrical source owner');
     if(command.source==='OFF'&&after.source[command.side]==='EXT')
      throw Error('GRD PWR OFF was not accepted for bus '+command.side);
    }
    if(plan.environmentAttached===false)environment(false);
    message(action==='ON'?'External power selected on both buses; verify aircraft bus lamps':
     action==='OFF'?'GRD PWR OFF; GPU may remain AVAILABLE':
     'GPU disconnected; external contactors open');
   }
   render(true);
  }catch(error){
   message(error.message||String(error),true);
   render(true);
  }
 }
 function start(){
  if(!ensure())return;
  for(const event of ['b737:electrical-owner-ready','b737:electrical-network',
   'b737:unified-ecu-observation','b737:battery-live']){
   root.addEventListener(event,()=>render());
  }
  // A late iframe/ECU load is not an excuse for a dead header button.
  // This small status check does not read or traverse cockpit bitmap DOM.
  setInterval(()=>{if(opened)render();},1000);
  render(true);
 }
 root.B737GroundPowerHeader=Object.freeze({refresh:()=>render(true),
  getState:()=>snapshot()?.view||null,act:run});
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});
 else start();
})(window);
