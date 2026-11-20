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
  ['Airframe & Flight','EFIS/CDU Integration Lab','../../integration-lab/efis-cdu.html'],
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
  ['Cockpit Test Labs','Bus Consumer Lab','busConsumerTestLabOpen']
 ];
 const services={
  airStarterAttached:false,airStarterFlow:false,airStarterPressurePsi:35,
  conditionedAirAttached:false,conditionedAirOn:false,
  fuelDoorOpen:false,fuelHoseAttached:false,fuelPower:false,fuelAuxPower:false,fuelTest:false,
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
  const seenInspectorActions=new Set();
  const updateInspectorActions=()=>{
   for(const node of doc.querySelectorAll('#inspector button,#inspector a[href]')){
    const name=(node.textContent||node.getAttribute('aria-label')||'').trim().replace(/\s+/g,' ');
    if(!/\b(TEST\s*LAB|LABORATORY|TESTBENCH|TEST)\b/i.test(name)||name.length>95)continue;
    const key=(node.id||node.href||name);
    if(seenInspectorActions.has(key)||node.closest('#workspaceLabsMenu'))continue;
    seenInspectorActions.add(key);
    const entry=element('button','workspace-lab-item',name,extras);
    entry.type='button';
    entry.addEventListener('click',()=>{hideLabs();if(node.tagName==='A')win.open(node.href,'_blank','noopener');else node.click();});
   }
  };
  b.addEventListener('click',()=>{
   palette.hidden=!palette.hidden;b.setAttribute('aria-expanded',String(!palette.hidden));
   if(!palette.hidden){addOverheadLabs();updateInspectorActions();input.focus();}
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
  const legacy=new Set(['unifiedEfisHeader','cbPanelOpen','instrumentPhotoLabOpen','busConsumerTestLabOpen','failuresHeaderOpen']);
  function hideLegacyHeader(){
   for(const node of [...header.children]){
    if(legacy.has(node.id)||node.dataset.workspaceNavHidden==='true'){
     node.style.setProperty('display','none','important');
     node.tabIndex=-1;
    }
   }
  }
  win.B737WorkspaceHideLegacyHeaderV1=hideLegacyHeader;
  hideLegacyHeader();
  const observer=new MutationObserver(()=>{navCheck();hideLegacyHeader();});
  observer.observe(header,{childList:true});
 }
 function actionDock(holder,id,title){
  const target=$(id);if(target){holder.append(target);target.hidden=false;target.style.removeProperty('display');target.removeAttribute('aria-hidden');target.removeAttribute('tabindex');if(title)target.textContent=title;}
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
    // Use the existing pneumatic ECU: external high-pressure air enters the
    // right-side manifold through its source-availability sensor.
    const ecu=win.B737ISNCockpitV1;
    if(typeof ecu?.sendPneumatic!=='function'||typeof ecu?.engineTrainerAction!=='function')
     throw Error('The live pneumatic and engine-start ECUs are not ready.');
    const derived=ecu.sendPneumatic({type:'SENSOR',key:'externalAirAvailable',value:true});
    if(derived?.bleed?.externalAirAttached!==true)
     throw Error('External cart source was rejected by Pneumatics V6.');
    for(const engine of ['engine1','engine2'])
     ecu.engineTrainerAction({type:'DUCT_PSI',engine,psi:services.airStarterPressurePsi,instructor:true});
    services.airStarterFlow=true;
    msg('flightServicesMessage','Air cart ON · External source connected to the live Pneumatics V6 right duct. Engine starts still require the physical GRD start selectors.');
    updateCart();
   }catch(e){try{win.B737ISNCockpitV1?.sendPneumatic?.({type:'SENSOR',key:'externalAirAvailable',value:false});}catch(_){}services.airStarterFlow=false;msg('flightServicesMessage',e.message,true);updateCart();}
  });
  serviceButton(starterActions,'STOP / DISCONNECT',()=>{
   try{
    if(services.airStarterFlow)win.B737ISNCockpitV1?.sendPneumatic?.({type:'SENSOR',key:'externalAirAvailable',value:false});
    services.airStarterFlow=false;services.airStarterAttached=false;updateCart();
    msg('flightServicesMessage','Air cart disconnected from the live right-side pneumatic manifold. Other bleed sources remain independent.');
   }catch(e){msg('flightServicesMessage',e.message,true);}
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
  const c=canvas.getContext('2d');if(!c)return;
  const w=canvas.width,h=canvas.height,live=getQty(),powered=services.fuelDoorOpen&&(services.fuelPower||services.fuelAuxPower);
  const linear=c.createLinearGradient(0,0,w,h);
  linear.addColorStop(0,'#5a6670');linear.addColorStop(.3,'#37434c');
  linear.addColorStop(.62,'#232d36');linear.addColorStop(1,'#121e27');
  c.fillStyle=linear;c.fillRect(0,0,w,h);
  let seed=31739;
  for(let i=0;i<2900;i++){
   seed=(Math.imul(seed,1664525)+1013904223)>>>0;const x=seed%w;
   seed=(Math.imul(seed,1664525)+1013904223)>>>0;const y=seed%h;
   c.fillStyle=i%2?'#ffffff09':'#050b1110';c.fillRect(x,y,i%3+1,1);
  }
  c.strokeStyle='#9aa5ad';c.lineWidth=3;c.strokeRect(10,10,w-20,h-20);
  c.strokeStyle='#111920';c.lineWidth=2;c.strokeRect(20,20,w-40,h-40);
  const txt=(label,x,y,size=13,color='#dce4e7',weight='600')=>{
   c.textAlign='center';c.fillStyle=color;c.font=weight+' '+size+'px Arial,sans-serif';c.fillText(label,x,y);
  };
  const bolt=(x,y)=>{
   const metal=c.createRadialGradient(x-2,y-2,1,x,y,13);
   metal.addColorStop(0,'#e4e9eb');metal.addColorStop(.42,'#9eaab0');
   metal.addColorStop(.78,'#46525a');metal.addColorStop(1,'#111b22');
   c.fillStyle=metal;c.beginPath();c.arc(x,y,12,0,Math.PI*2);c.fill();
   c.strokeStyle='#242b33';c.lineWidth=2;c.beginPath();c.moveTo(x-5,y+3);c.lineTo(x+5,y-3);c.stroke();
  };
  for(const x of [35,875])for(const y of [35,367])bolt(x,y);
  txt('B737 CLASSIC · PRESSURE REFUELING STATION',455,50,21,'#ecf1ee','700');
  txt('RIGHT WING LEADING EDGE  ·  P15  ·  KG',455,72,12,'#c1ccd1','600');
  // Left auxiliary spring-loaded TEST GAGES / AUX FUELING POWER switch.
  c.fillStyle='#111c24';c.fillRect(36,99,137,225);
  c.strokeStyle='#85949c';c.lineWidth=2;c.strokeRect(36,99,137,225);
  txt('TEST GAGES',104,121,12);
  txt('& AUX FUELING',104,139,10);
  txt('POWER',104,155,11);
  const auxX=104,auxY=225;
  c.fillStyle='#0e151a';c.beginPath();c.arc(auxX,auxY,36,0,2*Math.PI);c.fill();
  c.strokeStyle='#707f89';c.lineWidth=4;c.stroke();
  const stem=c.createLinearGradient(auxX-12,0,auxX+14,0);
  stem.addColorStop(0,'#323b42');stem.addColorStop(.35,'#d6dde1');
  stem.addColorStop(.6,'#8798a4');stem.addColorStop(1,'#1b2a32');
  c.save();c.translate(auxX,auxY);c.rotate(services.fuelTest?-.45:services.fuelAuxPower?.45:0);
  c.fillStyle=stem;c.beginPath();c.moveTo(-9,4);c.lineTo(-11,-37);c.lineTo(11,-37);c.lineTo(9,4);c.closePath();c.fill();
  c.fillStyle='#c7d0d5';c.fillRect(-9,-42,18,14);c.restore();
  txt('TEST',104,176,11,'#d9e8ef');
  txt('OFF',104,282,13,'#d9e8ef');
  txt('AUX PWR',104,310,11,'#c9d6dc');
  // FCOM station order is #2 / CENTER / #1 (not captain-first cockpit order).
  const positions=[{id:'main2',x:280,label:'TANK No. 2'},
   {id:'center',x:495,label:'CENTER TANK'},
   {id:'main1',x:710,label:'TANK No. 1'}];
  txt('VALVE POSITION LIGHTS',496,96,12,'#ecf0e7','700');
  const raised=(cx,cy,rad)=>{
   const chrome=c.createRadialGradient(cx-4,cy-4,2,cx,cy,rad);
   chrome.addColorStop(0,'#d7dee0');chrome.addColorStop(.3,'#7f919e');
   chrome.addColorStop(.7,'#3c4b56');chrome.addColorStop(1,'#101922');
   c.fillStyle=chrome;c.beginPath();c.arc(cx,cy,rad,0,2*Math.PI);c.fill();
  };
  for(const part of positions){
   const {id,x,label}=part,qty=Number(live?.[id]||0),isFull=qty>=tankCaps[id]-.25;
   const lit=powered&&services.valves[id]&&!isFull;
   txt(label,x,124,14,'#edf1ef','700');
   // Blue lens lights when commanded valve is OPEN and associated tank not full.
   raised(x,153,19);
   const glow=c.createRadialGradient(x-3,149,2,x,153,14);
   glow.addColorStop(0,services.fuelTest?'#e8faff':lit?'#98dbff':'#233947');
   glow.addColorStop(.4,services.fuelTest?'#92d5ff':lit?'#307fcb':'#193441');
   glow.addColorStop(1,lit||services.fuelTest?'#164277':'#0b1c25');
   c.fillStyle=glow;c.beginPath();c.arc(x,153,14,0,Math.PI*2);c.fill();
   txt('OPEN',x-45,211,11,'#c6d2d6');
   txt('CLOSED',x+47,211,11,'#c6d2d6');
   raised(x,208,18);
   c.save();c.translate(x,208);c.rotate(services.valves[id]?-.64:.64);
   c.fillStyle='#dee5e8';c.fillRect(-9,-31,18,45);
   c.fillStyle='#758d98';c.fillRect(-9,2,18,12);c.restore();
   // Three recessed instrument windows below switches; no SVG.
   c.fillStyle='#131b22';c.fillRect(x-87,240,174,100);
   c.strokeStyle='#899aa4';c.lineWidth=3;c.strokeRect(x-87,240,174,100);
   c.fillStyle='#000a10';c.fillRect(x-77,252,154,61);
   c.fillStyle=powered?'#c8e2ae':'#657567';c.shadowColor=powered?'#96c378':'transparent';c.shadowBlur=powered?10:0;
   txt((services.fuelTest?'88888':String(Math.round(qty)).padStart(5,'0')),x,298,31,c.fillStyle,'700');
   c.shadowBlur=0;txt('FUEL QTY  KG',x,329,11,'#c4d3d8');
  }
  txt('FUELING STATION',495,365,13,'#c1cbd0','700');
  txt(powered?'PANEL ENERGIZED':'PANEL POWER OFF',495,386,11,powered?'#a9decb':'#e8ab93');
  lastFuelDraw=Date.now();
 }
 function fuelPanelHit(x,y){
  if(y>171&&y<239){
   for(const part of [{id:'main2',x:280},{id:'center',x:495},{id:'main1',x:710}]){
    if(Math.abs(x-part.x)<69){
     if(services.fuelRunning){fuelMessage('Stop fuel transfer before moving a valve switch.',true);return;}
     services.valves[part.id]=!services.valves[part.id];
     const row=$('flightFuelValve_'+part.id);
     if(row){row.textContent='VALVE · '+(services.valves[part.id]?'OPEN':'CLOSED');row.setAttribute('aria-pressed',String(services.valves[part.id]));}
     drawFuelPanel();return;
    }
   }
  }
  if(x>=45&&x<=165&&y>=162&&y<=315){
   if(y<229)services.fuelTest=true;
   else services.fuelAuxPower=services.fuelDoorOpen;
   drawFuelPanel();
  }
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
   if(!services.fuelDoorOpen||!services.fuelHoseAttached||!(services.fuelPower||services.fuelAuxPower))throw Error('Fueling connection or station power lost.');
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
  element('p','flight-service-hint','Right-wing pressure refueling station P15: Tank 2 / Center / Tank 1, blue valve-open lamps, spring-loaded TEST GAGES / AUX POWER. Existing ATA28 ECU owns all fuel quantities. Raster Canvas, not SVG.',host);
  const canvas=element('canvas','flight-fuel-canvas',undefined,host);
  canvas.id='flightFuelCanvas';canvas.width=910;canvas.height=400;
  canvas.setAttribute('role','img');canvas.setAttribute('aria-label','B737 Classic right wing pressure refueling P15 raster training panel with three tank quantity indicators');
  canvas.title='Click the three metal fueling valve switches to select OPEN or CLOSED. Press the left TEST GAGES control momentarily.';
  canvas.style.cursor='pointer';
  canvas.addEventListener('pointerdown',event=>{
   const rect=canvas.getBoundingClientRect();
   fuelPanelHit((event.clientX-rect.left)*canvas.width/Math.max(rect.width,1),
    (event.clientY-rect.top)*canvas.height/Math.max(rect.height,1));
  });
  for(const eventName of ['pointerup','pointercancel','pointerleave'])canvas.addEventListener(eventName,()=>{
   if(services.fuelTest||services.fuelAuxPower){services.fuelTest=false;services.fuelAuxPower=false;drawFuelPanel();}
  });
  const controls=element('div','flight-fuel-controls',undefined,host);
  const actions=element('div','flight-service-actions',undefined,controls);
  serviceButton(actions,'OPEN REFUEL DOOR',()=>{try{onGroundGuard();services.fuelDoorOpen=true;services.fuelPower=true;fuelMessage('Refueling station door open · training power automatically enabled.');drawFuelPanel();}catch(e){fuelMessage(e.message,true)}});
  serviceButton(actions,'CONNECT FUEL HOSE',()=>{try{onGroundGuard();if(!services.fuelDoorOpen)throw Error('Open the refuel door first.');services.fuelHoseAttached=true;fuelMessage('Pressure refueling hose connected.');drawFuelPanel();}catch(e){fuelMessage(e.message,true)}});
  serviceButton(actions,'SIMULATE DOOR POWER FAILURE / RESTORE',()=>{try{onGroundGuard();if(!services.fuelDoorOpen)throw Error('Open the refuel door first.');services.fuelPower=!services.fuelPower;if(!services.fuelPower)stopFuel('Door power failed. Hold AUX POWER to test the bypass.');drawFuelPanel();}catch(e){fuelMessage(e.message,true)}});
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
   const initialFuel=getQty();
   input.value=initialFuel?String(Math.round(Number(initialFuel[tank]||0))):'';
   input.dataset.liveInitialized=initialFuel?'yes':'no';
   input.addEventListener('input',()=>input.dataset.liveInitialized='yes');
   const valve=serviceButton(row,'VALVE · CLOSED',()=>{
    if(services.fuelRunning)return;
    services.valves[tank]=!services.valves[tank];valve.textContent='VALVE · '+(services.valves[tank]?'OPEN':'CLOSED');
    valve.setAttribute('aria-pressed',String(services.valves[tank]));drawFuelPanel();
   });
   valve.id='flightFuelValve_'+tank;
   valve.setAttribute('aria-pressed','false');
  });
  const footer=element('div','flight-service-actions',undefined,controls);
  const start=serviceButton(footer,'START FUEL TRANSFER',()=>{
   try{
    onGroundGuard();
    if(services.fuelRunning)return;
    if(!services.fuelDoorOpen||!services.fuelHoseAttached||!(services.fuelPower||services.fuelAuxPower))
     throw Error('Open refueling door, connect hose and verify station power.');
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
   services.fuelPower=false;services.fuelAuxPower=false;services.fuelTest=false;services.fuelHoseAttached=false;services.fuelDoorOpen=false;
   tankKeys.forEach(t=>services.valves[t]=false);
   rows.querySelectorAll('button').forEach(b=>{b.textContent='VALVE · CLOSED';b.setAttribute('aria-pressed','false');});
   drawFuelPanel();
  });
  const status=element('p','flight-service-status','Open the refuel door to begin.',host);
  status.id='flightFuelStatus';status.setAttribute('role','status');
  const details=element('small','flight-service-hint','Quantities are written to the single ATA28 ECU at 250 ms intervals while servicing. The door normally energizes the training panel; auxiliary power is momentary. Electrical CB wiring, valve transit, fueling pressure/flow and artwork remain uncalibrated instructor approximations.',host);
  drawFuelPanel();
  win.addEventListener('b737:unified-ecu-observation',()=>{
   const quantities=getQty();
   if(quantities)for(const tank of tankKeys){const input=$('flightFuelTarget_'+tank);
    if(input?.dataset.liveInitialized==='no'){input.value=String(Math.round(quantities[tank]||0));input.dataset.liveInitialized='yes';}
   }
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
  initLabs();initServices();groupControls();win.B737WorkspaceHideLegacyHeaderV1?.();
 }
 win.B737UnifiedGroundServicesV1=Object.freeze({snapshot:()=>({...services,valves:{...services.valves}}),
  isAirStarterAvailable:()=>onGround()&&services.airStarterAttached&&services.airStarterFlow,
  isConditionedAirAvailable:()=>onGround()&&services.conditionedAirAttached&&services.conditionedAirOn,
  stopFuel:()=>stopFuel('Fuel transfer stopped by instructor.')});
 if(doc.readyState==='loading')doc.addEventListener('DOMContentLoaded',start,{once:true});else start();
})(window,document);