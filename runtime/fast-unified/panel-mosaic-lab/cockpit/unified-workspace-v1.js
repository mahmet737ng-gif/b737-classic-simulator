/* UNIFIED WORKSPACE V1: lightweight instructor navigation and aircraft ground services.
 * This layer never edits locked overhead/guard/IRS visuals. Test lab actions reuse
 * their existing handlers; fuel quantities are written to the ONE ATA28 ECU.
 * External conditioned air and air-cart state remain instructor-only until an
 * authoritative physical cabin/duct source adapter is installed.
 */
(function(win,doc){
 'use strict';
 const $=id=>doc.getElementById(id);
 const LABS=[
  ['Instrumentation','Instrument Photo Lab','./instrument-lab/'],
  ['Instrumentation','EADI Attitude Lab','../../eadi-attitude-lab/'],
  ['Instrumentation','EFIS Display Lab','../../efis-display-lab/'],
  ['Instrumentation','Main Panel Lab','../../main-panel-lab/'],
  ['Instrumentation','CDU Font Test','../../cdu-font-test/'],
  ['Electrical','Bus Consumer Test Lab','../../bus-consumer-test-lab/v3.html'],
  ['Electrical','Electrical Lab','../../electrical-lab/'],
  ['Electrical','Electrical Load Lab','../../electrical-load-lab/'],
  ['Electrical','AC/DC Metering Lab','../../acdc-metering-lab/'],
  ['Electrical','Circuit Breaker Panel Lab','../../cb-panel-lab/'],
  ['Electrical','Electrical Pack Test','../../isn-electrical-pack-lab/'],
  ['Airframe & Flight','CPCS Lab','../../cpcs-lab/'],
  ['Airframe & Flight','DCPCS Lab','../../dcpcs-lab/'],
  ['Airframe & Flight','Pneumatics Lab','../../pneumatics-lab/'],
  ['Airframe & Flight','Stall Warning Lab','../../stall-warning-lab/'],
  ['Airframe & Flight','Integration Lab','../../integration-lab/'],
  ['Airframe & Flight','Systems Integration','../../systems-integration-lab/'],
  ['Engines & Fire','Engine ECU Start Lab','../../isn-ecu-start-lab/'],
  ['Engines & Fire','Engine Start Sequence Lab','../../isn-start-sequence-lab/'],
  ['Engines & Fire','Fire Protection Lab','../../fire-protection-lab/'],
  ['Engines & Fire','Fire Handle Lab','../../fire-handle-lab/'],
  ['Engines & Fire','Audio Warning Lab','../../audio-lab/'],
  ['Panels','Interactive Panel Test','../../interactive-panel-test/'],
  ['Panels','Switch Lab','../../switch-lab/'],
  ['Panels','Trainer Lab','../../trainer-lab/'],
  ['Panels','Vector Lab','../../vector-lab/']
 ];
 const ACTIONS=[
  ['Cockpit Test Labs','FAILURES · Electrical / Fuel / Fire','failuresHeaderOpen'],
  ['Cockpit Test Labs','CB PANEL · Cockpit Circuit Breakers','cbPanelOpen'],
  ['Cockpit Test Labs','Instrument Photo Lab','instrumentPhotoLabOpen'],
  ['Cockpit Test Labs','Bus Consumer Lab','busConsumerTestLabOpen'],
  ['Cockpit Test Labs','ENGINE TEST LAB','engineTestLabOpen'],
  ['Cockpit Test Labs','TCAS TEST LAB','tcasTestLabOpen']
 ];
 const services={
  airStarterAttached:false,airStarterFlow:false,airStarterPressurePsi:35,
  conditionedAirAttached:false,conditionedAirOn:false,
  fuelDoorOpen:false,fuelHoseAttached:false,fuelPower:false,
  fuelMode:'REFUEL',fuelRunning:false,
  valves:{main1:false,center:false,main2:false}
 };
 let palette=null,fuelTimer=null,fuelStatus='',lastFuelDraw=0;
 const tankKeys=['main1','center','main2'];
 const tankLabels={main1:'MAIN 1',center:'CENTER',main2:'MAIN 2'};
 const tankCaps={main1:4555,center:7029,main2:4555};
 const liveFuel=()=>win.B737ISNCockpitV1?.getFuelSystem?.()||null;
 const getQty=()=>liveFuel()?.tanksKg||null;
 const onGround=()=>{
  const flight=win.B737UnifiedFlightScenarioV1?.getState?.();
  if(flight?.airborne===true)return false;
  const gpu=win.B737GroundPowerHeader?.getState?.();
  return gpu?.onGround!==false;
 };
 const msg=(id,value,bad=false)=>{const el=$(id);if(el){el.textContent=value;el.dataset.error=String(bad);}};
 function element(tag,cls,text,parent){
  const node=doc.createElement(tag);
  if(cls)node.className=cls;
  if(text!==undefined)node.textContent=text;
  if(parent)parent.append(node);
  return node;
 }
 function safeOpen(actionId){
  const target=$(actionId);
  if(!target){msg('workspaceLabStatus','Lab entry is not ready: '+actionId,true);return;}
  if(target.tagName==='A'){win.open(target.href,'_blank','noopener');}
  else target.click();
 }
 function testEntry(label,actionId,parent){
  const b=element('button','workspace-lab-item',label,parent);
  b.type='button';b.addEventListener('click',()=>{hideLabs();safeOpen(actionId);});return b;
 }
 function linkEntry(label,path,parent){
  const a=element('a','workspace-lab-item',label,parent);
  a.href=new URL(path,doc.baseURI).href;a.target='_blank';a.rel='noopener';return a;
 }
 function makeGroup(title,parent,open=false){
  const details=element('details','workspace-group',undefined,parent);
  details.open=open;element('summary','',title,details);
  return element('div','workspace-group-content',undefined,details);
 }
 function hideLabs(){
  if(!palette)return;
  palette.hidden=true;$('workspaceLabsToggle')?.setAttribute('aria-expanded','false');
 }
 async function addOverheadLabs(){
  const host=$('workspaceOverheadLabs');if(!host||host.dataset.loaded)return;
  host.dataset.loaded='loading';
  try{
   const response=await fetch('./overhead-test-labs-catalog-v1.json');
   if(!response.ok)throw Error('Catalog is unavailable');
   const json=await response.json();
   if(!Array.isArray(json.panels))throw Error('Invalid catalog');
   json.panels.forEach(panel=>{
    const b=element('button','workspace-lab-item',panel.id+' · '+panel.title,host);
    b.type='button';b.addEventListener('click',()=>{
     hideLabs();
     if(!win.B737OverheadTestLabsV1?.open?.(panel.id)){
      msg('workspaceLabStatus',panel.id+' is not ready yet.',true);
     }
    });
   });
   host.dataset.loaded='yes';
  }catch(error){host.dataset.loaded='';msg('workspaceLabStatus',String(error.message||error),true);}
 }
 function initLabs(){
  const header=doc.querySelector('body > header.unified-minimal-header .header-settings');
  if(!header||$('workspaceLabsToggle'))return;
  const b=element('button','','TEST LABS');b.id='workspaceLabsToggle';
  b.type='button';b.setAttribute('aria-expanded','false');b.setAttribute('aria-controls','workspaceLabsMenu');
  header.insertBefore(b,$('inspectorToggle')||null);
  palette=element('aside','workspace-lab-palette',undefined,doc.body);
  palette.id='workspaceLabsMenu';palette.hidden=true;palette.setAttribute('role','dialog');
  palette.setAttribute('aria-label','All Test Labs');
  const top=element('div','workspace-lab-top',undefined,palette);
  element('strong','', 'TEST LABS · B737 CLASSIC',top);
  const close=element('button','','×',top);close.type='button';close.setAttribute('aria-label','Close test labs');close.onclick=hideLabs;
  const input=element('input','workspace-lab-search',undefined,palette);
  input.type='search';input.placeholder='Search all test labs';input.setAttribute('aria-label','Search test labs');
  const area=element('div','workspace-lab-area',undefined,palette);
  const cockpit=makeGroup('Cockpit / Live Test Labs',area,true);
  ACTIONS.forEach(x=>testEntry(x[1],x[2],cockpit));
  const extras=element('div','workspace-dynamic-labs',undefined,cockpit);
  extras.id='workspaceExtraShortcuts';
  const groups=[...new Set(LABS.map(x=>x[0]))];
  groups.forEach(g=>{
   const part=makeGroup(g,area);
   LABS.filter(x=>x[0]===g).forEach(x=>linkEntry(x[1],x[2],part));
  });
  const oh=makeGroup('Overhead OH01–OH25 · Individual Test Labs',area);
  oh.id='workspaceOverheadLabs';
  const status=element('p','workspace-status','',palette);status.id='workspaceLabStatus';status.setAttribute('role','status');
  b.addEventListener('click',()=>{
   palette.hidden=!palette.hidden;b.setAttribute('aria-expanded',String(!palette.hidden));
   if(!palette.hidden){addOverheadLabs();input.focus();}
  });
  input.addEventListener('input',()=>{
   const q=input.value.toLowerCase().trim();
   for(const item of area.querySelectorAll('.workspace-lab-item')){
    item.hidden=!!q&&!item.textContent.toLowerCase().includes(q);
   }
   if(q)area.querySelectorAll('details').forEach(d=>d.open=true);
  });
  doc.addEventListener('pointerdown',event=>{
   if(!palette.hidden&&!palette.contains(event.target)&&event.target!==b)hideLabs();
  });
  doc.addEventListener('keydown',event=>{if(event.key==='Escape')hideLabs()});
  const shortcuts=$('unifiedLabShortcuts');
  if(shortcuts)extras.append(shortcuts);
  // Move the NAV DATA instructor top-level entry out of the header,
  // preserving the separate CDU navigation data bank and its runtime.
  const navCheck=()=>{
   [...header.children].forEach(node=>{
    if(node===b||node.id==='flightScenarioHeader'||node.id==='inspectorToggle'||node.id==='aircraftSettingsOpen')return;
    if(/^\s*NAV\s*DATA\s*$/i.test(node.textContent||'')){
     node.hidden=true;node.dataset.workspaceNavHidden='true';
    }
   });
  };
  navCheck();
  const observer=new MutationObserver(navCheck);observer.observe(header,{childList:true});
 }
 function actionDock(holder,id,title){
  const target=$(id);if(target){holder.append(target);target.hidden=false;if(title)target.textContent=title;}
 }
 function foldForFlight(parent,title,key){
  const d=element('details','flight-service-fold',undefined,parent);
  d.dataset.service=key;const s=element('summary','',title,d);
  const inner=element('div','flight-service-body',undefined,d);return inner;
 }
 function serviceButton(parent,text,fn){
  const b=element('button','flight-service-button',text,parent);b.type='button';b.onclick=fn;return b;
 }
 function onGroundGuard(){
  if(!onGround())throw Error('Ground services are unavailable while airborne.');
 }
 function updateCart(){
  msg('flightAirStarterStatus','AIR STARTER · '+(services.airStarterAttached?'HOSE CONNECTED':'DISCONNECTED')+
   ' · '+(services.airStarterFlow?'AIR FLOW ON':'AIR FLOW OFF')+
   ' · '+services.airStarterPressurePsi+' PSI (TRAINING)');
  msg('flightConditionedAirStatus','AIR CONDITIONING CART · '+
   (services.conditionedAirAttached?'DUCT CONNECTED':'DISCONNECTED')+
   ' · '+(services.conditionedAirOn?'CART ON':'CART OFF'));
  win.dispatchEvent(new CustomEvent('b737:ground-services-change',{detail:{
   airStarterAttached:services.airStarterAttached,airStarterFlow:services.airStarterFlow,
   airStarterPressurePsi:services.airStarterPressurePsi,
   conditionedAirAttached:services.conditionedAirAttached,conditionedAirOn:services.conditionedAirOn
  }}));
 }
 function initServices(){
  const dialog=$('flightScenarioDialog');if(!dialog||$('flightServices'))return;
  const servicesHost=element('section','flight-services',undefined,dialog);
  servicesHost.id='flightServices';
  const first=dialog.querySelector('.flight-actions');
  if(first)first.insertAdjacentElement('afterend',servicesHost);
  element('h3','','AIRCRAFT SERVICES · GROUND OPERATIONS',servicesHost);
  const gp=foldForFlight(servicesHost,'GROUND SERVICES · GPU / AIR STARTER / AIR CONDITIONING','ground');
  const gpDock=element('div','flight-service-dock',undefined,gp);gpDock.id='flightGroundPowerDock';
  element('p','flight-service-hint','External AC power remains controlled by the original Electrical V7 GPU handler and aircraft GRD PWR switch.',gp);
  const popDock=element('div','',undefined,gp);popDock.id='flightGroundPowerPopoverDock';
  actionDock(gpDock,'groundPowerHeader','EXTERNAL GROUND POWER');
  const starter=element('div','flight-service-subsystem',undefined,gp);
  element('strong','','AIR STARTER UNIT · EXTERNAL PNEUMATIC CART',starter);
  const starterActions=element('div','flight-service-actions',undefined,starter);
  serviceButton(starterActions,'CONNECT HOSE',()=>{try{onGroundGuard();services.airStarterAttached=true;updateCart();}catch(e){msg('flightServicesMessage',e.message,true)}});
  serviceButton(starterActions,'START AIR CART',()=>{
   try{onGroundGuard();if(!services.airStarterAttached)throw Error('Connect the high-pressure air hose first.');
    services.airStarterFlow=true;
    // The existing ECU can accept instructor duct-pressure targets, but its
    // start valve/GRD logic remains the sole engagement authority.
    const ecu=win.B737ISNCockpitV1;
    if(typeof ecu?.engineTrainerAction==='function'){
     for(const engine of ['engine1','engine2'])
      ecu.engineTrainerAction({type:'DUCT_PSI',engine,psi:services.airStarterPressurePsi,instructor:true});
    }
    msg('flightServicesMessage','Air cart ON · Training duct PSI set. Physical starter engagement and source gating are not overridden.');
    updateCart();
   }catch(e){services.airStarterFlow=false;msg('flightServicesMessage',e.message,true);updateCart();}
  });
  serviceButton(starterActions,'STOP / DISCONNECT',()=>{
   services.airStarterFlow=false;services.airStarterAttached=false;updateCart();
   msg('flightServicesMessage','Air cart disconnected. Existing ECU duct state is not overridden with a fictitious zero.');
  });
  const pressure=element('label','flight-service-small','Instructor air cart delivery (PSI) ',starter);
  const input=element('input','',undefined,pressure);input.type='number';input.min='20';input.max='50';input.step='1';input.value='35';
  input.addEventListener('change',()=>{const n=Number(input.value);if(Number.isFinite(n)&&n>=20&&n<=50)services.airStarterPressurePsi=n;else input.value=String(services.airStarterPressurePsi);updateCart();});
  const starterStat=element('p','flight-service-status','',starter);starterStat.id='flightAirStarterStatus';
  const ac=element('div','flight-service-subsystem',undefined,gp);
  element('strong','','GROUND PRE-CONDITIONED AIR · SEPARATE CABIN DUCT',ac);
  const acActions=element('div','flight-service-actions',undefined,ac);
  serviceButton(acActions,'CONNECT CABIN DUCT',()=>{try{onGroundGuard();services.conditionedAirAttached=true;updateCart();}catch(e){msg('flightServicesMessage',e.message,true)}});
  serviceButton(acActions,'AIR CONDITIONING ON',()=>{try{onGroundGuard();if(!services.conditionedAirAttached)throw Error('Connect the conditioned-air duct first.');services.conditionedAirOn=true;updateCart();}catch(e){msg('flightServicesMessage',e.message,true)}});
  serviceButton(acActions,'STOP / DISCONNECT',()=>{services.conditionedAirOn=false;services.conditionedAirAttached=false;updateCart();});
  const acStat=element('p','flight-service-status','',ac);acStat.id='flightConditionedAirStatus';
  element('small','flight-service-hint','Cabin air cart state is a training interface. It does not yet drive a calibrated cabin temperature ECU or pack bleed pressure.',ac);
  const groundNotice=element('p','flight-service-status','',gp);groundNotice.id='flightServicesMessage';groundNotice.setAttribute('role','status');
  const fuel=foldForFlight(servicesHost,'FUEL SERVICE · RIGHT-WING P15 REFUEL PANEL','fuel');
  initFuel(fuel);
  const apu=foldForFlight(servicesHost,'APU CONTROL / TEST LAB','apu');
  const apuDock=element('div','flight-service-dock',undefined,apu);
  actionDock(apuDock,'apuLabButtonV1','OPEN APU CONTROL / TEST LAB');
  element('p','flight-service-hint','The existing APU ECU and photographed overhead controls remain authoritative.',apu);
  const efis=foldForFlight(servicesHost,'EFIS / IRS CONTROL','efis');
  const efisDock=element('div','flight-service-dock',undefined,efis);
  actionDock(efisDock,'unifiedEfisHeader','OPEN EFIS CONTROL PANEL');
  actionDock(efisDock,'unifiedEfisOpen','EFIS CONTROL PRESETS');
  updateCart();
  dialog.addEventListener('close',()=>{if(services.fuelRunning)stopFuel('Refueling paused when Flight Phase closes.');});
 }
 function fuelMessage(value,bad=false){fuelStatus=value;msg('flightFuelStatus',value,bad);}
 function drawFuelPanel(){
  const canvas=$('flightFuelCanvas');if(!canvas)return;
  const context=canvas.getContext('2d');if(!context)return;
  const w=canvas.width,h=canvas.height;
  const g=context.createLinearGradient(0,0,w,h);
  g.addColorStop(0,'#46505b');g.addColorStop(.33,'#202a35');g.addColorStop(.75,'#343c47');g.addColorStop(1,'#131d26');
  context.fillStyle=g;context.fillRect(0,0,w,h);
  // Rasterized metal grain with a deterministic fixed seed; no SVG assets.
  let seed=31739;for(let n=0;n<2400;n++){
   seed=(seed*1664525+1013904223)>>>0;
   const x=seed%w;seed=(seed*1664525+1013904223)>>>0;const y=seed%h;
   context.fillStyle=n%2?'#ffffff07':'#0000001c';context.fillRect(x,y,1+n%5,1);
  }
  context.strokeStyle='#9aaab2';context.lineWidth=3;context.strokeRect(12,12,w-24,h-24);
  context.strokeStyle='#13191d';context.lineWidth=2;context.strokeRect(21,21,w-42,h-42);
  for(const x of [32,w-32])for(const y of [32,h-32]){
   const m=context.createRadialGradient(x-2,y-2,1,x,y,13);
   m.addColorStop(0,'#ecf1f4');m.addColorStop(.4,'#9fa7aa');m.addColorStop(.75,'#393f43');m.addColorStop(1,'#0c1013');
   context.fillStyle=m;context.beginPath();context.arc(x,y,13,0,Math.PI*2);context.fill();
   context.strokeStyle='#252b2e';context.beginPath();context.moveTo(x-6,y+3);context.lineTo(x+6,y-3);context.stroke();
  }
  context.fillStyle='#e7ebdf';context.textAlign='center';context.font='bold 23px Arial';
  context.fillText('PRESSURE REFUELING STATION',w/2,61);
  context.font='13px Arial';context.fillStyle='#c9d5dc';
  context.fillText('B737 CLASSIC · P15 · TRAINING MODEL · QUANTITY IN KILOGRAMS',w/2,87);
  const q=getQty()||{};
  tankKeys.forEach((id,i)=>{
   const x=40+i*290,y=115;
   context.fillStyle='#151c25';context.fillRect(x,y,268,175);
   context.strokeStyle='#8798a5';context.lineWidth=2;context.strokeRect(x,y,268,175);
   context.fillStyle='#f1f2e9';context.font='bold 18px Arial';context.fillText(tankLabels[id],x+134,y+27);
   context.fillStyle='#020a0d';context.fillRect(x+23,y+40,222,69);
   context.fillStyle='#b9d29c';context.font='bold 40px monospace';
   context.shadowColor='#a0f07e';context.shadowBlur=10;
   context.fillText(Number(q[id]||0).toFixed(0).padStart(5,'0'),x+134,y+91);
   context.shadowBlur=0;context.font='12px Arial';context.fillStyle='#a9b8be';
   context.fillText('FUEL QUANTITY · KG',x+134,y+128);
   context.fillStyle=services.valves[id]?'#75b9ff':'#35414b';
   context.beginPath();context.arc(x+134,y+151,7,0,Math.PI*2);context.fill();
   context.fillStyle='#cad4dc';context.font='12px Arial';context.fillText('REFUEL VALVE '+(services.valves[id]?'OPEN':'CLOSED'),x+134,y+172);
  });
  context.fillStyle='#f0e8d8';context.font='bold 13px Arial';
  context.fillText('FUELING POWER / TEST GAGES / AUX POWER · REFUEL / DEFUEL CONTROL',w/2,326);
  const indicator=(x,title,on)=>{
   context.fillStyle='#121a20';context.fillRect(x,343,150,31);
   context.strokeStyle='#778b94';context.strokeRect(x,343,150,31);
   context.fillStyle=on?'#c2e7ff':'#8999a1';context.font='bold 12px Arial';context.fillText(title+' '+(on?'ON':'OFF'),x+75,364);
  };
  indicator(105,'DOOR',services.fuelDoorOpen);
  indicator(360,'HOSE',services.fuelHoseAttached);
  indicator(615,'PWR',services.fuelPower);
  lastFuelDraw=Date.now();
 }
 function stopFuel(reason){
  services.fuelRunning=false;if(fuelTimer!==null){clearInterval(fuelTimer);fuelTimer=null;}
  $('flightFuelStart')?.setAttribute('aria-pressed','false');
  if(reason)fuelMessage(reason);
  drawFuelPanel();
 }
 function targetFor(tank){const n=Number($('flightFuelTarget_'+tank)?.value);if(!Number.isFinite(n)||n<0||n>tankCaps[tank])throw Error(tankLabels[tank]+' target must be 0–'+tankCaps[tank]+' kg.');return n;}
 function tickFuel(){
  if(!services.fuelRunning)return;
  try{
   onGroundGuard();
   if(!services.fuelDoorOpen||!services.fuelHoseAttached||!services.fuelPower)throw Error('Fueling connection or station power lost.');
   const ecu=win.B737ISNCockpitV1;
   if(!ecu?.fuelTrainerAction||!ecu?.getFuelSystem)throw Error('ATA28 live ECU is unavailable.');
   const current=getQty();if(!current)throw Error('Fuel ledger unavailable.');
   let pending=0;
   for(const tank of tankKeys){
    if(!services.valves[tank])continue;
    const goal=targetFor(tank),now=Number(current[tank]);
    if(services.fuelMode==='REFUEL'&&goal<now-0.1)throw Error('REFUEL target is below current tank quantity.');
    if(services.fuelMode==='DEFUEL'&&goal>now+0.1)throw Error('DEFUEL target is above current tank quantity.');
    const distance=goal-now;
    if(Math.abs(distance)<0.2)continue;
    pending++;
    // Training flow: 18 kg/s per open valve, not a certified fueling rate.
    const step=Math.min(Math.abs(distance),4.5)*Math.sign(distance);
    ecu.fuelTrainerAction({instructor:true,type:'SERVICE_TANK',tank,quantityKg:Math.min(tankCaps[tank],Math.max(0,now+step))});
   }
   if(!pending){stopFuel('Target quantities reached. Close valves and disconnect the fueling hose.');return;}
   drawFuelPanel();
   const q=getQty();fuelMessage('Fuel transfer active · '+tankKeys.map(id=>tankLabels[id]+' '+Number(q[id]||0).toFixed(0)+' kg').join(' · '));
  }catch(error){stopFuel(error.message||String(error));msg('flightFuelStatus',error.message||String(error),true);}
 }
 function initFuel(host){
  element('p','flight-service-hint','Right-wing refueling station. Existing ATA28 live ECU is the only fuel quantity owner. Photo-style panel is rasterized on Canvas, not SVG.',host);
  const canvas=element('canvas','flight-fuel-canvas',undefined,host);
  canvas.id='flightFuelCanvas';canvas.width=910;canvas.height=400;
  canvas.setAttribute('role','img');canvas.setAttribute('aria-label','B737 Classic right wing pressure refueling P15 raster training panel with three tank quantity indicators');
  const controls=element('div','flight-fuel-controls',undefined,host);
  const actions=element('div','flight-service-actions',undefined,controls);
  serviceButton(actions,'OPEN REFUEL DOOR',()=>{try{onGroundGuard();services.fuelDoorOpen=true;fuelMessage('Refueling station door open.');drawFuelPanel();}catch(e){fuelMessage(e.message,true)}});
  serviceButton(actions,'CONNECT FUEL HOSE',()=>{try{onGroundGuard();if(!services.fuelDoorOpen)throw Error('Open the refuel door first.');services.fuelHoseAttached=true;fuelMessage('Pressure refueling hose connected.');drawFuelPanel();}catch(e){fuelMessage(e.message,true)}});
  serviceButton(actions,'FUELING POWER ON / OFF',()=>{try{onGroundGuard();if(!services.fuelDoorOpen)throw Error('Open the refuel door first.');services.fuelPower=!services.fuelPower;if(!services.fuelPower)stopFuel();drawFuelPanel();}catch(e){fuelMessage(e.message,true)}});
  const mode=element('label','flight-fuel-mode','OPERATION ',controls);
  const modeSelect=element('select','',undefined,mode);
  for(const v of ['REFUEL','DEFUEL']){const o=element('option','',v,modeSelect);o.value=v;}
  modeSelect.addEventListener('change',()=>{stopFuel();services.fuelMode=modeSelect.value;});
  const rows=element('div','flight-fuel-rows',undefined,controls);
  tankKeys.forEach(tank=>{
   const row=element('div','flight-fuel-row',undefined,rows);
   element('strong','',tankLabels[tank]+' · MAX '+tankCaps[tank]+' kg',row);
   const label=element('label','','TARGET KG ',row);
   const input=element('input','',undefined,label);input.type='number';input.id='flightFuelTarget_'+tank;
   input.step='1';input.min='0';input.max=String(tankCaps[tank]);
   input.value=String(Math.round(Number(getQty()?.[tank]||0)));
   const valve=serviceButton(row,'VALVE · CLOSED',()=>{
    if(services.fuelRunning)return;
    services.valves[tank]=!services.valves[tank];valve.textContent='VALVE · '+(services.valves[tank]?'OPEN':'CLOSED');
    valve.setAttribute('aria-pressed',String(services.valves[tank]));drawFuelPanel();
   });
   valve.setAttribute('aria-pressed','false');
  });
  const footer=element('div','flight-service-actions',undefined,controls);
  const start=serviceButton(footer,'START FUEL TRANSFER',()=>{
   try{
    onGroundGuard();
    if(services.fuelRunning)return;
    if(!services.fuelDoorOpen||!services.fuelHoseAttached||!services.fuelPower)
     throw Error('Open door, attach hose and switch fueling power on.');
    if(!tankKeys.some(t=>services.valves[t]))throw Error('Open at least one refueling valve.');
    const q=getQty();if(!q)throw Error('Live ATA28 fuel ECU is not ready.');
    for(const t of tankKeys)if(services.valves[t]){
     const goal=targetFor(t),actual=q[t];
     if(services.fuelMode==='REFUEL'&&goal<actual-0.1||services.fuelMode==='DEFUEL'&&goal>actual+0.1)
      throw Error('Target direction conflicts with '+services.fuelMode+' mode.');
    }
    services.fuelRunning=true;start.setAttribute('aria-pressed','true');
    fuelMessage('Fuel transfer started · instructor rate 18 kg/s per open valve.');
    fuelTimer=setInterval(tickFuel,250);tickFuel();
   }catch(e){fuelMessage(e.message,true);}
  });start.id='flightFuelStart';
  serviceButton(footer,'STOP TRANSFER',()=>stopFuel('Fuel transfer stopped.'));
  serviceButton(footer,'DISCONNECT / CLOSE DOOR',()=>{
   stopFuel('Fuel service disconnected.');
   services.fuelPower=false;services.fuelHoseAttached=false;services.fuelDoorOpen=false;
   tankKeys.forEach(t=>services.valves[t]=false);
   rows.querySelectorAll('button').forEach(b=>{b.textContent='VALVE · CLOSED';b.setAttribute('aria-pressed','false');});
   drawFuelPanel();
  });
  const status=element('p','flight-service-status','Open the refuel door to begin.',host);
  status.id='flightFuelStatus';status.setAttribute('role','status');
  const details=element('small','flight-service-hint','Quantity change is transmitted to the live ATA28 service interface every 250 ms. Transfer rate, valve actuation and panel artwork are instructor approximations pending aircraft-specific P15 photo/FCOM calibration.',host);
  drawFuelPanel();
  win.addEventListener('b737:unified-ecu-observation',()=>{
   if(!services.fuelRunning&&doc.querySelector('#flightScenarioDialog[open] [data-service="fuel"][open]')&&Date.now()-lastFuelDraw>900)drawFuelPanel();
  });
 }
 function groupControls(){
  const inspector=$('inspector');if(!inspector)return;
  const control=$('unifiedControlCenter');
  if(control&&!control.dataset.workspaceGrouped){
   control.dataset.workspaceGrouped='true';
   const h=control.querySelector('h2');if(h)h.textContent='CONTROLS · AIRCRAFT SYSTEMS';
   const battery=$('batteryControlsSlot');
   if(battery){const fold=element('details','workspace-control-fold',undefined,control);
    element('summary','','Electrical · Battery / Recharge',fold);fold.append(battery);}
   const actions=control.querySelector('.control-center-actions');
   const lamp=$('visualLampTest');
   if(lamp){const fold=element('details','workspace-control-fold',undefined,control);
    element('summary','','Lighting · Lamp Test',fold);fold.append(lamp);}
   if(actions)actions.hidden=true;
  }
  function groupSection(section){
   if(section.dataset.workspaceGrouped||section.id==='unifiedControlCenter')return;
   if(section.closest('.workspace-control-fold'))return;
   section.dataset.workspaceGrouped='true';
   const title=(section.querySelector('h1,h2,h3,summary')?.textContent||section.id||'Aircraft Controls').trim();
   const fold=doc.createElement('details');fold.className='workspace-control-fold';
   const summary=element('summary','',''+title,fold);
   section.insertAdjacentElement('beforebegin',fold);fold.append(section);
  }
  [...inspector.children].filter(n=>n.tagName==='SECTION').forEach(groupSection);
  const observer=new MutationObserver(()=>[...inspector.children].filter(n=>n.tagName==='SECTION').forEach(groupSection));
  observer.observe(inspector,{childList:true});
 }
 function start(){
  initLabs();initServices();groupControls();
 }
 win.B737UnifiedGroundServicesV1=Object.freeze({snapshot:()=>({...services,valves:{...services.valves}}),
  isAirStarterAvailable:()=>onGround()&&services.airStarterAttached&&services.airStarterFlow,
  isConditionedAirAvailable:()=>onGround()&&services.conditionedAirAttached&&services.conditionedAirOn,
  stopFuel:()=>stopFuel('Fuel transfer stopped by instructor.')});
 if(doc.readyState==='loading')doc.addEventListener('DOMContentLoaded',start,{once:true});else start();
})(window,document);