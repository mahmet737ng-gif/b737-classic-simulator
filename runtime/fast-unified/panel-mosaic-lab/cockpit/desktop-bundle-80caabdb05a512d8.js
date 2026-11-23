(async()=>{
;
/* ./unified-workspace-v1.js?v=WORKSPACE-0002-P15-CTR-0043 */
try{
/* UNIFIED WORKSPACE V1: lightweight instructor navigation and aircraft ground services.
 * This layer never edits locked overhead/guard/IRS visuals. Test lab actions reuse
 * their existing handlers; fuel quantities are written to the ONE ATA28 ECU.
 * External conditioned air and air-cart state remain instructor-only until an
 * authoritative physical cabin/duct source adapter is installed.
 */
(function(win,doc){
 'use strict';
 const $=id=>doc.getElementById(id);
 const CHAPTERS=[
  [1,'Airplane General, Emergency Equipment, Doors, Windows'],
  [2,'Air Systems'],[3,'Anti-Ice, Rain'],[4,'Automatic Flight'],
  [5,'Communications'],[6,'Electrical'],[7,'Engines, APU'],
  [8,'Fire Protection'],[9,'Flight Controls'],[10,'Flight Instruments, Displays'],
  [11,'Flight Management, Navigation'],[12,'Fuel'],[13,'Hydraulics'],
  [14,'Landing Gear'],[15,'Warning Systems']
 ];
 // [FCOM V2 chapter, title, verified repository-relative URL]. Keep URL
 // resolution anchored to /panel-mosaic-lab/cockpit/, not the gateway alias.
 const LABS=[
  [1,'Interactive Panel Test','../../interactive-panel-test/'],
  [1,'Trainer Lab','../../trainer-lab/'],
  [1,'Switch Lab','../../switch-lab/'],
  [1,'Vector Lab','../../vector-lab/'],
  [1,'Lighting / Annunciator Test Lab','../lights-test/'],
  [2,'Pneumatics Lab','../../pneumatics-lab/'],
  [2,'CPCS Lab','../../cpcs-lab/'],
  [2,'DCPCS Lab','../../dcpcs-lab/'],
  [4,'MCP Panel Lab','../mcp-panel/'],
  [4,'Speed Limit / AFDS Lab','./speed-limit-ch4-lab.html'],
  [6,'Bus Consumer Test Lab','../../bus-consumer-test-lab/v3.html'],
  [6,'Electrical Lab','../../electrical-lab/'],
  [6,'Electrical Load Lab','../../electrical-load-lab/'],
  [6,'AC/DC Metering Lab','../../acdc-metering-lab/'],
  [6,'Circuit Breaker Panel Lab','../../cb-panel-lab/'],
  [6,'Electrical Pack Test','../../isn-electrical-pack-lab/'],
  [7,'APU Test Lab','../apu-test-lab/'],
  [7,'Engine Test Lab','../engine-test-lab/'],
  [7,'Engine ECU Start Lab','../../isn-ecu-start-lab/'],
  [7,'Engine Start Sequence Lab','../../isn-start-sequence-lab/'],
  [7,'N1 / EGT Precision Lab','./n1-egt-precision-lab.html'],
  [8,'Fire Protection Lab','../../fire-protection-lab/'],
  [8,'Fire Handle Lab','../../fire-handle-lab/'],
  [9,'Leading Edge Devices Lab','../le-devices/'],
  [10,'Instrument Photo Lab','./instrument-lab/'],
  [10,'EADI Attitude Lab','../../eadi-attitude-lab/'],
  [10,'EFIS Display Lab','../../efis-display-lab/'],
  [10,'Main Panel Lab','../../main-panel-lab/'],
  [10,'Speed Tape Lab','./speed-tape-lab.html'],
  [10,'Scale Calibration Lab','./scale-calibration-lab/'],
  [11,'CDU Font Test','../../cdu-font-test/'],
  [11,'IRS Test Lab','../irs-test-lab/'],
  [11,'EFIS/CDU Integration Lab','../../integration-lab/efis-cdu.html'],
  [12,'Fuel Service · P15 (in FLT PHASE)','#flightFuelService'],
  [15,'TCAS Test Lab','./tcas-lab/'],
  [15,'Stall Warning Lab','../../stall-warning-lab/'],
  [15,'Audio Warning Lab','../../audio-lab/']
 ];
 // Metadata is derived from the verified Overhead catalog so FCOM chapters
 // have visible lab entries immediately, independent of a lazy network fetch.
 const OVERHEAD_MENU_LABS=[
  ["OH01", "LE DEVICES / FLAP CONTROL"],
  ["OH02", "IRS / INERTIAL REFERENCE"],
  ["OH03", "SERVICE INTERPHONE / DOME LIGHT"],
  ["OH04", "AUDIO SELECTOR / MICROPHONE"],
  ["OH05", "ENGINE INDICATIONS / CREW OXYGEN"],
  ["OH06", "FLIGHT RECORDER / ELT / STALL WARN"],
  ["OH07", "FLIGHT CONTROLS / YAW DAMPER"],
  ["OH08", "NAV / IRS / EFIS TRANSFER"],
  ["OH09", "FUEL PUMPS / CROSSFEED"],
  ["OH10", "ELECTRICAL AC/DC METERING"],
  ["OH11", "DRIVE / STANDBY POWER"],
  ["OH12", "GENERATORS / BUS TRANSFER / APU GEN"],
  ["OH13", "EQUIPMENT COOLING / CIRCUIT PANEL"],
  ["OH14", "EMERGENCY LIGHTS / PASSENGER SIGNS"],
  ["OH15", "WINDOW HEAT / PITOT / TAT"],
  ["OH16", "ENGINE / WING ANTI-ICE"],
  ["OH17", "HYDRAULIC PUMPS"],
  ["OH18", "GROUND CALL / WIPER / RAIN REPELLENT"],
  ["OH19-VOICE", "VOICE RECORDER / DOOR INDICATIONS"],
  ["OH19-DIFF", "CABIN DIFF PRESS / ALT HORN"],
  ["OH20", "CABIN TEMPERATURE / AIR MIX"],
  ["OH21", "PACKS / BLEED AIR / RECIRCULATION"],
  ["OH22", "CABIN PRESSURIZATION · CPCS / DCPCS"],
  ["OH23", "LANDING / RUNWAY / TAXI LIGHTS"],
  ["OH24", "APU / ENGINE START / IGNITION"],
  ["OH25", "POSITION / STROBE / EXTERIOR LIGHTS"]
 ];
 const ACTIONS=[
  [6,'FAILURES · Electrical / Fuel / Fire','failuresHeaderOpen'],
  [6,'CB PANEL · Cockpit Circuit Breakers','cbPanelOpen'],
  [10,'Instrument Photo Lab','instrumentPhotoLabOpen'],
  [6,'Bus Consumer Lab','busConsumerTestLabOpen']
 ];
 const OVERHEAD_CHAPTER=Object.freeze({
  OH01:9,OH02:11,OH03:5,OH04:5,OH05:7,OH06:15,OH07:9,OH08:11,
  OH09:12,OH10:6,OH11:6,OH12:6,OH13:2,OH14:1,OH15:3,OH16:3,
  OH17:13,OH18:3,'OH19-VOICE':5,'OH19-DIFF':2,OH20:2,OH21:2,
  OH22:2,OH23:1,OH24:7,OH25:1
 });
 function chapterForLabel(label){
  const v=String(label||'').toUpperCase();
  if(/TCAS|TRAFFIC|STALL|WARNING|GPWS|AURAL|AUDIO/.test(v))return 15;
  if(/GEAR|BRAKE/.test(v))return 14;
  if(/HYD/.test(v))return 13;
  if(/FUEL|REFUEL/.test(v))return 12;
  if(/NAV|IRS|CDU|FMC|FMS|ROUTE/.test(v))return 11;
  if(/EADI|EHSI|EFIS|INSTRUMENT|SPEED TAPE|ATTITUDE|DISPLAY|SCALE/.test(v))return 10;
  if(/FLAP|SLAT|FLIGHT CONTROL|TRIM/.test(v))return 9;
  if(/FIRE|OVHT|EXTINGUISH/.test(v))return 8;
  if(/ENGINE|APU|STARTER|IGNITION/.test(v))return 7;
  if(/ELECTR|BUS|CB|BATTERY|GENERATOR|GROUND POWER/.test(v))return 6;
  if(/COMM|AUDIO SELECT|VHF|MIC/.test(v))return 5;
  if(/AFDS|AUTOPILOT|MCP|AUTOTHROTTLE|SPEED LIMIT/.test(v))return 4;
  if(/ANTI.?ICE|WINDOW HEAT|PITOT|WIPER|RAIN|TAT/.test(v))return 3;
  if(/AIR COND|AIR SYSTEM|BLEED|PACK|PRESSUR|CPCS|DCPCS/.test(v))return 2;
  return 1;
 }
 const services={
  airStarterAttached:false,airStarterFlow:false,airStarterPressurePsi:35,
  conditionedAirAttached:false,conditionedAirOn:false,
  fuelDoorOpen:false,fuelHoseAttached:false,fuelPower:false,fuelAuxPower:false,fuelTest:false,lampTest:null,
  fuelRunOnKg:{main1:0,center:0,main2:0},fuelRunOnMode:{main1:'REFUEL',center:'REFUEL',main2:'REFUEL'},fuelIsFlowing:{main1:false,center:false,main2:false},
  fuelMode:'REFUEL',fuelRunning:false,
  fuelTargets:{main1:4555,center:7029,main2:4555},
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
  if(target.tagName==='A'){const path=target.href.endsWith('/')?target.href+'index.html':target.href;win.open(path,'_blank','noopener');}
  else target.click();
 }
 function testEntry(label,actionId,parent){
  const b=element('button','workspace-lab-item',label,parent);
  b.type='button';b.addEventListener('click',()=>{hideLabs();safeOpen(actionId);});return b;
 }
 function linkEntry(label,path,parent){
  const a=element('a','workspace-lab-item',label,parent);
  if(path==='#flightFuelService'){
   a.href='#flightFuelService';
   a.addEventListener('click',event=>{
    event.preventDefault();hideLabs();$('flightScenarioHeader')?.click();
    const fold=doc.querySelector('#flightServices [data-service="fuel"]');
    if(fold){fold.open=true;fold.scrollIntoView?.({block:'nearest'});}
   });
   return a;
  }
  const finalPath=path.endsWith('/')?path+'index.html':path;
  const cockpitBase=new URL('/panel-mosaic-lab/cockpit/index.html',doc.baseURI);
  a.href=new URL(finalPath,cockpitBase).href;a.target='_blank';a.rel='noopener';return a;
 }
 // Explicit accordion avoids native <details> clipping inside the floating grid.
 // Each panel is a normal section; hidden and aria-expanded are always in sync.
 function setGroupOpen(section,open){
  if(!section)return;
  const content=section.querySelector('.workspace-group-content');
  const trigger=section.querySelector('.workspace-group-trigger');
  if(!content||!trigger)return;
  content.hidden=!open;
  section.dataset.open=open?'true':'false';
  trigger.setAttribute('aria-expanded',String(!!open));
 }
 function makeGroup(title,parent,number,open=false){
  const section=element('section','workspace-group',undefined,parent);
  const trigger=element('button','workspace-group-trigger',undefined,section);
  trigger.type='button';
  const name=element('span','workspace-group-title',title,trigger);
  const content=element('div','workspace-group-content',undefined,section);
  content.id='workspaceChapter'+number;
  trigger.setAttribute('aria-controls',content.id);
  trigger.addEventListener('click',()=>{
   const opening=content.hidden;
   setGroupOpen(section,opening);
   if(opening)section.scrollIntoView?.({block:'nearest'});
  });
  setGroupOpen(section,open);
  return content;
 }
 function refreshLabCounts(){
  for(const [number] of CHAPTERS){
   const host=$('workspaceChapter'+number);
   const trigger=host?.parentElement?.querySelector('.workspace-group-trigger');
   if(!trigger)continue;
   let badge=trigger.querySelector('.workspace-lab-count');
   if(!badge)badge=element('span','workspace-lab-count',undefined,trigger);
   const count=host.querySelectorAll('.workspace-lab-item').length;
   badge.textContent=count+' LAB'+(count===1?'':'S');
  }
 }
 function addOverheadMenuItem(panel){
  const id=String(panel.id||'');
  if(!id||doc.getElementById('workspaceOverhead'+id))return;
  const container=$('workspaceChapter'+(OVERHEAD_CHAPTER[id]||chapterForLabel(panel.title)));
  if(!container)return;
  const b=element('button','workspace-lab-item',id+' · '+panel.title,container);
  b.id='workspaceOverhead'+id;
  b.type='button';
  b.addEventListener('click',async()=>{
   b.disabled=true;b.setAttribute('aria-busy','true');
   try{
    for(let attempt=0;attempt<50;attempt++){
     const api=win.B737OverheadTestLabsV1;
     if(api&&typeof api.open==='function'){
      if(api.open(id)){hideLabs();return;}
      break;
     }
     if(attempt===0)msg('workspaceLabStatus','Opening '+id+' test lab…');
     await new Promise(resolve=>win.setTimeout(resolve,100));
    }
    msg('workspaceLabStatus','Unable to open '+id+'. The overhead lab module is unavailable.',true);
   }catch(error){
    msg('workspaceLabStatus','Unable to open '+id+': '+String(error?.message||error),true);
   }finally{b.disabled=false;b.removeAttribute('aria-busy');}
  });
 }
 function hideLabs(){
  if(!palette)return;
  palette.hidden=true;$('workspaceLabsToggle')?.setAttribute('aria-expanded','false');
 }
 async function addOverheadLabs(){
  const host=$('workspaceLabsMenu');if(!host||host.dataset.overheadLoaded)return;
  host.dataset.overheadLoaded='loading';
  try{
   const response=await fetch(new URL('./overhead-test-labs-catalog-v1.json',new URL('/panel-mosaic-lab/cockpit/index.html',doc.baseURI)).href);
   if(!response.ok)throw Error('Catalog is unavailable');
   const json=await response.json();
   if(!Array.isArray(json.panels))throw Error('Invalid catalog');
    json.panels.forEach(addOverheadMenuItem);
    host.dataset.overheadLoaded='yes';
    refreshLabCounts();
  }catch(error){host.dataset.overheadLoaded='';msg('workspaceLabStatus',String(error.message||error),true);}
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
  const controls=element('div','workspace-lab-toolbar',undefined,palette);
  const expand=element('button','','SHOW ALL LABS',controls);expand.type='button';
  const collapse=element('button','','COLLAPSE ALL',controls);collapse.type='button';
  const area=element('div','workspace-lab-area',undefined,palette);
  expand.addEventListener('click',()=>{
   input.value='';
   for(const section of area.querySelectorAll('.workspace-group')){
    section.hidden=false;setGroupOpen(section,true);
    section.querySelectorAll('.workspace-lab-item').forEach(item=>item.hidden=false);
   }
   msg('workspaceLabStatus','');
  });
  collapse.addEventListener('click',()=>{
   input.value='';
   for(const section of area.querySelectorAll('.workspace-group')){
    section.hidden=false;setGroupOpen(section,false);
    section.querySelectorAll('.workspace-lab-item').forEach(item=>item.hidden=false);
   }
  });
  // Fixed FCOM Chapter 1–15 taxonomy. Every overhead and dynamic test lab
  // joins the chapter that owns its system; never create uncategorized tabs.
  for(const [number,title] of CHAPTERS){
   makeGroup(String(number).padStart(2,'0')+' · '+title,area,number,number===1);
  }
  for(const [chapter,label,id] of ACTIONS)testEntry(label,id,$('workspaceChapter'+chapter));
  for(const [chapter,label,path] of LABS)linkEntry(label,path,$('workspaceChapter'+chapter));
  for(const [id,title] of OVERHEAD_MENU_LABS)addOverheadMenuItem({id,title});
  const emptyGear=$('workspaceChapter14');
  if(emptyGear&&!emptyGear.querySelector('.workspace-lab-item'))
   element('p','workspace-lab-empty','No separate landing gear test lab has been registered. The live landing gear controls remain in the cockpit.',emptyGear);
  refreshLabCounts();
  const status=element('p','workspace-status','',palette);status.id='workspaceLabStatus';status.setAttribute('role','status');
  const seenInspectorActions=new Set();
  const updateInspectorActions=()=>{
   for(const node of doc.querySelectorAll('#inspector button,#inspector a[href]')){
    const name=(node.textContent||node.getAttribute('aria-label')||'').trim().replace(/\s+/g,' ');
    if(!/\b(TEST\s*LAB|LABORATORY|TESTBENCH|TEST)\b/i.test(name)||name.length>95)continue;
    const key=(node.id||node.href||name);
    if(seenInspectorActions.has(key)||node.closest('#workspaceLabsMenu'))continue;
    seenInspectorActions.add(key);
    const target=$('workspaceChapter'+chapterForLabel(name));
    if(!target)continue;
    const entry=element('button','workspace-lab-item',name,target);
    entry.type='button';
    entry.addEventListener('click',()=>{hideLabs();if(node.tagName==='A')win.open(node.href.endsWith('/')?node.href+'index.html':node.href,'_blank','noopener');else node.click();});
   }
   refreshLabCounts();
  };
  b.addEventListener('click',()=>{
   palette.hidden=!palette.hidden;b.setAttribute('aria-expanded',String(!palette.hidden));
   if(!palette.hidden){addOverheadLabs();updateInspectorActions();refreshLabCounts();input.focus();}
  });
  input.addEventListener('input',()=>{
   const q=input.value.toLowerCase().trim();
   let matches=0;
   for(const section of area.querySelectorAll('.workspace-group')){
    const title=section.querySelector('.workspace-group-title')?.textContent.toLowerCase()||'';
    const titleMatch=!!q&&title.includes(q);
    let visible=0;
    for(const item of section.querySelectorAll('.workspace-lab-item')){
     const match=!q||titleMatch||item.textContent.toLowerCase().includes(q);
     item.hidden=!match;
     if(match)visible++;
    }
    section.hidden=!!q&&!visible&&!titleMatch;
    if(q&&!section.hidden){setGroupOpen(section,true);matches+=visible;}
   }
   msg('workspaceLabStatus',q?(matches?matches+' matching lab entries':'No matching test labs'):'');
  });
  doc.addEventListener('pointerdown',event=>{
   if(!palette.hidden&&!palette.contains(event.target)&&event.target!==b)hideLabs();
  });
  doc.addEventListener('keydown',event=>{if(event.key==='Escape')hideLabs()});
  const shortcuts=$('unifiedLabShortcuts');
  if(shortcuts){
   for(const item of [...shortcuts.children]){
    const label=item.textContent||item.getAttribute?.('aria-label')||'';
    const target=$('workspaceChapter'+chapterForLabel(label));
    target?.append(item);
   }
   shortcuts.hidden=true;
  }
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
  const legacy=new Set(['unifiedEfisHeader','groundPowerHeader','instrumentPhotoLabOpen','busConsumerTestLabOpen']);
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
 // Photographed P15 faceplate; numbers were removed from this raster in
 // advance. This file is REAL WebP (44,948 bytes), never SVG / CSS imitation.
 let p15Photo=null,p15PhotoReady=false,p15PhotoLoading=false,p15PhotoFailed=false;
 // The user-approved photographic P15 switch uses one 5.4 KB WebP containing
 // two positions. The fixed mount/nut remains registered to the same pivot.
 let p15ValveSprite=null,p15ValveLoading=false,p15ValveFailed=false;
 const p15ValveSource='./assets/p15-approved-switch-5state-v3.webp?v=P15-5STATE-0042';
 // Build OFF from the two unobscured halves of the SAME 8 KB source
 // photographs. The stationary nut/red ring never rotates; the OFF pose
 // consists of only the central metal ball, without any visible lever.
 function fixedCenterSwitch(source){
  const size=104,sprite=doc.createElement('canvas');
  sprite.width=size*5;sprite.height=size;
  const c=sprite.getContext('2d',{willReadFrequently:true});
  if(!c)return source;
  c.drawImage(source,0,0);
  const upper=c.getImageData(size,0,size,size);
  const lower=c.getImageData(0,0,size,size);
  const center=c.createImageData(size,size);
  for(let y=0;y<size;y++){
   const t=Math.max(0,Math.min(1,(y-48)/8));
   for(let x=0;x<size;x++){
    const i=(y*size+x)*4;
    for(let k=0;k<4;k++)
     center.data[i+k]=Math.round(upper.data[i+k]*(1-t)+lower.data[i+k]*t);
   }
  }
  c.putImageData(center,size*3,0);
  c.save();c.beginPath();
  c.ellipse(size*3+52,52,13.5,13.5,0,0,Math.PI*2);c.clip();
  c.drawImage(source,37,8,31,32,size*3+37,36,31,32);c.restore();
  return sprite;
 }
 function ensureP15ValveSprite(){
  if(p15ValveSprite||p15ValveLoading||p15ValveFailed)return;
  p15ValveLoading=true;
  const img=new win.Image();img.decoding='async';
  img.onload=()=>{
   try{p15ValveSprite=fixedCenterSwitch(img);}catch(e){
    p15ValveFailed=true;p15ValveSprite=null;
    fuelMessage('P15 TEST GAGES centered sprite failed to initialize.',true);
   }
   p15ValveLoading=false;drawFuelPanel();
  };
  img.onerror=()=>{p15ValveFailed=true;p15ValveLoading=false;
    fuelMessage('Approved P15 valve switch artwork unavailable.',true);};
  img.src=new URL(p15ValveSource,doc.baseURI).href;
 }
 const p15Source='./assets/p15-refuel-photo-v1.webp?v=P15-REAL-PHOTO-0001';
 const p15TankCoords=Object.freeze([
  {id:'main2',screenX:283,leverX:339,lampX:206},
  {id:'center',screenX:545,leverX:610,lampX:514},
  {id:'main1',screenX:801,leverX:869,lampX:778}
 ]);
 function ensureP15Photo(){
  // Lazy load once the Fuel Service section is opened; no boot-time cost.
  ensureP15ValveSprite();
  if(p15PhotoLoading||p15PhotoReady||p15PhotoFailed)return;
  p15PhotoLoading=true;
  const img=new win.Image();
  img.decoding='async';
  img.onload=()=>{p15Photo=img;p15PhotoReady=true;p15PhotoLoading=false;drawFuelPanel();};
  img.onerror=()=>{p15PhotoFailed=true;p15PhotoLoading=false;
   fuelMessage('Photorealistic P15 image could not load; retry from the Gateway source.',true);
   drawFuelPanel();};
  img.src=new URL(p15Source,doc.baseURI).href;
 }
 // Seven-segment display drawn over the empty photographic glass,
 // avoiding static/fake numbers, LB units and duplicate fuel ledgers.
 const fuelSegMap={0:'abcedf',1:'bc',2:'abged',3:'abgcd',4:'fgbc',
  5:'afgcd',6:'afgecd',7:'abc',8:'abcdefg',9:'abcdfg'};
 function fuelDigit(c,x,y,d){
  const w=19,h=37,t=3.4;
  const lines={
   a:[x+3,y,x+w-3,y],b:[x+w,y+2,x+w,y+h/2-2],
   c:[x+w,y+h/2+2,x+w,y+h-2],d:[x+3,y+h,x+w-3,y+h],
   e:[x,y+h/2+2,x,y+h-2],f:[x,y+2,x,y+h/2-2],
   g:[x+3,y+h/2,x+w-3,y+h/2]
  };
  for(const [key,line] of Object.entries(lines)){
   const on=fuelSegMap[d]?.includes(key);
   c.beginPath();c.lineCap='round';c.lineWidth=t;
   c.strokeStyle=on?'#ff9d16':'#42200b';
   c.shadowBlur=on?7:0;c.shadowColor=on?'#ff850a':'transparent';
   c.moveTo(line[0],line[1]);c.lineTo(line[2],line[3]);c.stroke();
  }
  c.shadowBlur=0;
 }
 function paintFuelDigits(c,x,kg,powered,testing){
  if(!powered&&!testing)return;
  const valid=Number.isFinite(kg)&&kg>=0;
  const characters=testing?'88888':valid?String(Math.round(kg)):'-----';
  const step=25,chars=characters.slice(0,5),left=x-(chars.length-1)*step/2-9.5;
  const y=346;
  c.save();
  if(valid||testing)for(let i=0;i<chars.length;i++)fuelDigit(c,left+step*i,y,chars[i]);
  else{
   c.fillStyle='#c55e13';c.font='bold 24px ui-monospace,monospace';
   c.textAlign='center';c.fillText('-----',x,y+27);
  }
  c.textAlign='center';c.fillStyle='#ff9b16';c.shadowColor='#ff8415';c.shadowBlur=5;
  c.font='bold 21px Arial,sans-serif';c.fillText('KG',x,410);
  c.restore();
 }
 function paintPhotoLight(c,x,on){
  if(!on)return;
  c.save();
  const lens=c.createRadialGradient(x-4,71,3,x,74,26);
  lens.addColorStop(0,'#c6ebff');lens.addColorStop(.28,'#369ae9');
  lens.addColorStop(.65,'#054d9b');lens.addColorStop(1,'#063b8300');
  c.fillStyle=lens;c.beginPath();c.arc(x,74,26,0,Math.PI*2);c.fill();
  c.restore();
 }

 const FUEL_TICK_MS=250;
 const FUEL_FLOW_KG_S=18; // Instructor tuning; not a certified pump rate.
 const FUEL_RUNON_KG=50;  // User-requested training residual; not an FCOM value.
 const fuelStepRound=n=>Math.round(n/10)*10;
 const fuelHasRunOn=()=>tankKeys.some(t=>services.fuelRunOnKg[t]>.01);
 const fuelAnyOpen=()=>tankKeys.some(t=>services.valves[t]);
 function valvePowered(){return services.fuelPower||services.fuelAuxPower;}
 function updateFuelValveControls(){
  for(const tank of tankKeys){
   const node=$('flightFuelValve_'+tank);
   if(node){
    const open=services.valves[tank];
    node.textContent='VALVE · '+(open?'OPEN':'CLOSED');
    node.setAttribute('aria-pressed',String(open));
    node.dataset.position=open?'open':'closed';
   }
  }
 }
 // The original photographic nut/red ring is identical across each sprite
 // frame; only the metal shaft and ball shift vertically. Five WebP frames,
 // no SVG or procedural fake knob geometry, and no visual state latency.
 const P15_FRAME=104;
 function paintFuelToggle(c,x,open){
  if(!p15ValveSprite)return;
  const frame=open?0:1;
  const size=92,pivotY=160;
  c.drawImage(p15ValveSprite,frame*P15_FRAME,0,P15_FRAME,P15_FRAME,
    x-size/2,pivotY-size/2,size,size);
 }
 function paintTestToggle(c){
  if(!p15ValveSprite)return;
  // TEST GAGES = spring-loaded UP, OFF = center ball only (no stem),
  // AUX FUEL DOOR SWITCH BYPASS = spring-loaded DOWN.
  const frame=services.fuelTest?2:services.fuelAuxPower?4:3;
  const size=88;
  c.drawImage(p15ValveSprite,frame*P15_FRAME,0,P15_FRAME,P15_FRAME,
    88-size/2,204-size/2,size,size);
 }
 function drawFuelPanel(){
  const canvas=$('flightFuelCanvas');if(!canvas)return;
  const c=canvas.getContext('2d');if(!c)return;
  const w=canvas.width,h=canvas.height;
  c.clearRect(0,0,w,h);
  if(!p15PhotoReady){
   c.fillStyle='#1c2732';c.fillRect(0,0,w,h);
   c.fillStyle='#c4d7e4';c.textAlign='center';c.font='bold 19px Arial,sans-serif';
   c.fillText(p15PhotoFailed?'P15 PHOTO UNAVAILABLE':'P15 PHOTO LOADS WHEN FUEL SERVICE IS EXPANDED',w/2,h/2);
   return;
  }
  c.drawImage(p15Photo,0,0,w,h);
  const fuel=liveFuel(),q=fuel?.indications?.tanksKg??fuel?.tanksKg;
  const powered=valvePowered();
  for(const part of p15TankCoords){
   const raw=q?.[part.id],cap=fuel?.capacitiesKg?.[part.id]??tankCaps[part.id];
   const usableKg=Number.isFinite(raw)?Math.max(0,Math.min(raw,cap)):NaN;
   // P15 indication is total usable fuel, not gross tank contents.
   paintFuelDigits(c,part.screenX,Number.isFinite(usableKg)?fuelStepRound(usableKg):NaN,powered,services.fuelTest);
   paintPhotoLight(c,part.lampX,(services.lampTest===part.id)||services.fuelTest||
    (powered&&services.valves[part.id]&&Number.isFinite(usableKg)&&usableKg<cap-.2));
   paintFuelToggle(c,part.leverX,services.valves[part.id]);
  }
  paintTestToggle(c);
  lastFuelDraw=Date.now();
 }
 function fuelMessage(value,bad=false){fuelStatus=value;msg('flightFuelStatus',value,bad);}
 function targetFor(tank){
  const n=services.fuelTargets[tank];
  if(!Number.isFinite(n)||n<0||n>tankCaps[tank])
   throw Error(tankLabels[tank]+' training target is invalid.');
  return n;
 }
 // Quick Fill is separate from the pressure-refueling switch/valve scenario.
 // Entering a quantity commits directly to the ONE live ATA28 ECU.
 function applyQuickFill(tank){
  try{
   onGroundGuard();
   const field=$('flightFuelQuick_'+tank);
   if(!field||field.value.trim()==='')throw Error('Enter a fuel quantity (KG).');
   const qty=Number(field.value);
   if(!Number.isFinite(qty)||qty<0||qty>tankCaps[tank])
    throw Error(tankLabels[tank]+' quantity must be 0–'+tankCaps[tank]+' KG.');
   const ecu=win.B737ISNCockpitV1;
   if(!ecu?.fuelTrainerAction||!ecu?.getFuelSystem||!ecu.getFuelSystem()?.tanksKg)
    throw Error('ATA28 live fuel system is not ready. No change made.');
   // Isolate only this tank from any active pump/switch training scenario
   // so instructor's quantity is not immediately overwritten.
   services.valves[tank]=false;
   services.fuelRunOnKg[tank]=0;
   services.fuelIsFlowing[tank]=false;
   ecu.fuelTrainerAction({instructor:true,type:'SERVICE_TANK',tank,quantityKg:qty});
   updateFuelValveControls();
   drawFuelPanel();
   fuelMessage('QUICK FILL · '+tankLabels[tank]+' set directly to '+qty.toFixed(0)+' KG');
   if(!fuelAnyOpen()&&!fuelHasRunOn()&&fuelTimer!==null){
    win.clearInterval(fuelTimer);fuelTimer=null;services.fuelRunning=false;
   }
   return true;
  }catch(e){fuelMessage('QUICK FILL · '+(e.message||String(e)),true);return false;}
 }
 function startFuelTicker(){
  if(fuelTimer===null){fuelTimer=win.setInterval(tickFuel,FUEL_TICK_MS);}
 }
 function stopFuel(reason){
  if(fuelTimer!==null){win.clearInterval(fuelTimer);fuelTimer=null;}
  services.fuelRunning=false;
  for(const tank of tankKeys){
   services.fuelIsFlowing[tank]=false;
   services.fuelRunOnKg[tank]=0;
  }
  if(reason)fuelMessage(reason);
  drawFuelPanel();
 }
 function commandFuelValve(tank,open){
  if(!tankKeys.includes(tank))throw Error('Unknown refueling valve.');
  onGroundGuard();
  if(open===services.valves[tank])return;
  if(open){
   // Instructor convenience: entering P15 refueling is equivalent to
   // accessing the fueling station and opening its door. A separate hose
   // connection is NOT a prerequisite in this training scenario.
   if(!services.fuelDoorOpen){
    services.fuelDoorOpen=true;services.fuelPower=true;
   }
   services.fuelRunOnKg[tank]=0;
   services.valves[tank]=true;
   services.fuelIsFlowing[tank]=false;
   try{targetFor(tank);}catch(e){services.valves[tank]=false;throw e;}
   startFuelTicker();tickFuel();
  }else{
   // De-energize the switch immediately, but a running transfer gets a
   // bounded 50-kg non-certified closure run-on. Switching off a valve
   // that was never flowing must not invent extra fuel.
   const moving=services.fuelIsFlowing[tank]===true;
   services.fuelRunOnMode[tank]=services.fuelMode;
   services.fuelRunOnKg[tank]=moving?FUEL_RUNON_KG:0;
   services.fuelIsFlowing[tank]=false;
   services.valves[tank]=false;
   if(moving)startFuelTicker();
   fuelMessage(tankLabels[tank]+' switch CLOSED · '+(moving?'up to 50 kg training run-on':'no flow to run on'));
  }
  updateFuelValveControls();drawFuelPanel();
 }
 function fuelPanelHit(x,y){
  // The actual metal toggles on the photo, not the quantity windows.
  if(y>=116&&y<=225){
   for(const part of p15TankCoords){
    if(Math.abs(x-part.leverX)<=57){
     try{commandFuelValve(part.id,!services.valves[part.id]);}
     catch(e){fuelMessage(e.message,true);}
     return;
    }
   }
  }
  // Blue push-to-test lenses.
  if(y>=33&&y<=119){
   for(const part of p15TankCoords){
    if(Math.abs(x-part.lampX)<=45){services.lampTest=part.id;drawFuelPanel();return;}
   }
  }
  // Momentary switch: top TEST, bottom AUX FUEL DOOR SWITCH BYPASS.
  if(x>=12&&x<=158&&y>=116&&y<=288){
   if(y<202)services.fuelTest=true;
   else services.fuelAuxPower=true;
   drawFuelPanel();
  }
 }
 function tickFuel(){
  // In the instructor service the physical valve switches, not a START
  // button, own the transfer state. One 250-ms timer advances all tanks.
  try{
   if(!onGround())throw Error('Refueling cannot continue airborne.');
   const ecu=win.B737ISNCockpitV1;
   if(!ecu?.fuelTrainerAction||!ecu?.getFuelSystem)throw Error('ATA28 live ECU is unavailable.');
   const current=getQty();if(!current)throw Error('Fuel ledger unavailable.');
   const powered=valvePowered();
   let transferred=false,haveWork=false,runOn=false;
   for(const tank of tankKeys){
    const open=services.valves[tank];
    let remainder=services.fuelRunOnKg[tank];
    if(!open&&remainder<=.01){services.fuelIsFlowing[tank]=false;continue;}
    const mode=open?services.fuelMode:services.fuelRunOnMode[tank];
    const direction=mode==='REFUEL'?1:-1;
    const actual=Number(current[tank]);
    if(!Number.isFinite(actual))throw Error('Invalid live ATA28 quantity for '+tank);
    const physicalLimit=direction>0?tankCaps[tank]:0;
    const target=open?targetFor(tank):physicalLimit;
    const available=direction>0?Math.min(target,physicalLimit)-actual:actual-Math.max(target,physicalLimit);
    const canFlow=powered&&available>.01;
    if(!canFlow){
     services.fuelIsFlowing[tank]=false;
     if(!open)services.fuelRunOnKg[tank]=0;
     continue;
    }
    // Once CLOSED the residual quantity decelerates gradually. 50 kg is
    // the total training allowance, not an instantaneous transfer.
    const taper=open?1:(.20+.80*Math.max(0,remainder)/FUEL_RUNON_KG);
    const nominal=FUEL_FLOW_KG_S*FUEL_TICK_MS/1000*taper;
    const delta=Math.min(nominal,available,open?Infinity:remainder);
    if(delta<=.01){services.fuelIsFlowing[tank]=false;continue;}
    const newQty=Math.max(0,Math.min(tankCaps[tank],actual+direction*delta));
    ecu.fuelTrainerAction({instructor:true,type:'SERVICE_TANK',tank,quantityKg:newQty});
    transferred=true;
    if(open)services.fuelIsFlowing[tank]=true;
    else{
     services.fuelRunOnKg[tank]=Math.max(0,remainder-delta);
     runOn=runOn||services.fuelRunOnKg[tank]>.01;
    }
    haveWork=haveWork||open||services.fuelRunOnKg[tank]>.01;
   }
   services.fuelRunning=transferred;
   const q=getQty();
   if(transferred){
    fuelMessage('TRANSFER '+services.fuelMode+' · '+tankKeys.map(t=>tankLabels[t]+' '+fuelStepRound(Number(q?.[t]||0))+' KG').join(' · ')+(runOn?' · VALVE CLOSURE RUN-ON':''));
   }else if(!fuelAnyOpen()&&!fuelHasRunOn()){
    fuelMessage('All valve switches CLOSED · fuel transfer stopped.');
   }else if(!powered)fuelMessage('REFUEL POWER UNAVAILABLE · check station power / AUX bypass',true);
   else fuelMessage('Valves selected · target quantity reached or no transfer available.');
   drawFuelPanel();
   if(!haveWork&&!runOn){
    // Stop timing while OPEN valves are at their targets, restart on
    // switch/target changes; lamp state still follows FCOM independently.
    if(fuelTimer!==null){win.clearInterval(fuelTimer);fuelTimer=null;}
   }
  }catch(e){
   stopFuel(e.message||String(e));msg('flightFuelStatus',e.message||String(e),true);
  }
 }
 function initFuel(host){
  element('p','flight-service-hint','FCOM P15: Tank 2 / Center / Tank 1. Photo-based metal switches control valve-driven refuel/defuel and training-only closure run-on. Quick Fill below writes desired KG directly to ATA28.',host);
  const op=element('section','flight-fuel-operation',undefined,host);
  element('h4','', '1 · REFUELING / DEFUELING · VALVE DRIVEN',op);
  element('p','flight-service-hint','No hose or START button is required in the valve-driven instructor scenario. Choose REFUEL or DEFUEL, then move physical switches OPEN to transfer toward tank limits.',op);
  const canvas=element('canvas','flight-fuel-canvas',undefined,op);
  canvas.id='flightFuelCanvas';canvas.width=960;canvas.height=540;
  canvas.setAttribute('role','img');canvas.setAttribute('aria-label','Interactive B737 Classic right wing P15 refueling station: three live tank quantity displays and clickable valve switches');
  canvas.title='Click each physical valve switch to move OPEN / CLOSED. Top-left spring toggle: TEST GAGES or AUX. Click blue lenses to test lights.';
  canvas.style.cursor='pointer';canvas.tabIndex=0;
  const fuelFold=host.closest('[data-service="fuel"]');
  fuelFold?.addEventListener('toggle',()=>{if(fuelFold.open){ensureP15Photo();drawFuelPanel();}});
  canvas.addEventListener('pointerdown',event=>{
   const rect=canvas.getBoundingClientRect();
   fuelPanelHit((event.clientX-rect.left)*canvas.width/Math.max(rect.width,1),
    (event.clientY-rect.top)*canvas.height/Math.max(rect.height,1));
   if(services.fuelTest||services.fuelAuxPower||services.lampTest)canvas.setPointerCapture?.(event.pointerId);
  });
  for(const eventName of ['pointerup','pointercancel','pointerleave'])canvas.addEventListener(eventName,()=>{
   if(services.fuelTest||services.fuelAuxPower||services.lampTest){
    services.fuelTest=false;services.fuelAuxPower=false;services.lampTest=null;drawFuelPanel();
   }
  });
  const controls=element('div','flight-fuel-controls',undefined,op);
  const mode=element('label','flight-fuel-mode','OPERATION ',controls);
  const modeSelect=element('select','',undefined,mode);
  modeSelect.id='flightFuelOperation';
  for(const v of ['REFUEL','DEFUEL']){const o=element('option','',v,modeSelect);o.value=v;}
  element('h4','flight-quick-title','QUICK FILL / DEFUEL · DIRECT QUANTITY (KG)',controls);
  element('p','flight-service-hint','Instructor shortcut: enter the desired usable fuel in any tank. After typing stops, on Enter or when leaving the field, the live ATA28 quantity updates immediately. No switch or START button.',controls);
  const rows=element('div','flight-fuel-rows',undefined,controls);
  tankKeys.forEach(tank=>{
   const row=element('div','flight-fuel-row',undefined,rows);
   element('strong','',tankLabels[tank]+' · MAX '+tankCaps[tank]+' KG',row);
   const label=element('label','','QUICK FILL · KG ',row);
   const field=element('input','flight-quick-input',undefined,label);
   field.type='number';field.id='flightFuelQuick_'+tank;
   field.step='10';field.min='0';field.max=String(tankCaps[tank]);
   field.placeholder='Enter quantity';
   const current=getQty()?.[tank];
   field.value=Number.isFinite(current)?String(Math.round(current)):'';
   field.dataset.initialized=Number.isFinite(current)?'yes':'no';
   let debounceId=null;
   const commit=()=>{if(debounceId!==null)win.clearTimeout(debounceId);debounceId=null;applyQuickFill(tank);};
   field.addEventListener('input',()=>{
    if(debounceId!==null)win.clearTimeout(debounceId);
    if(field.value.trim()!=='')debounceId=win.setTimeout(commit,550);
   });
   field.addEventListener('change',commit);
   field.addEventListener('keydown',event=>{if(event.key==='Enter'){event.preventDefault();commit();field.blur?.();}});
  });
  modeSelect.addEventListener('change',()=>{
   if(fuelAnyOpen()||fuelHasRunOn()){
    modeSelect.value=services.fuelMode;
    fuelMessage('Close valves and allow closure run-on to finish before changing REFUEL / DEFUEL.',true);
    return;
   }
   services.fuelMode=modeSelect.value;
   tankKeys.forEach(tank=>{services.fuelTargets[tank]=services.fuelMode==='REFUEL'?tankCaps[tank]:0;});
   fuelMessage(services.fuelMode+' selected · open a valve switch to begin.');
  });
  const status=element('p','flight-service-status','Select a tank valve to begin.',op);
  status.id='flightFuelStatus';status.setAttribute('role','status');
  const aux=element('details','flight-service-fold flight-fuel-aux',undefined,host);
  element('summary','', '2 · FUEL SERVICE / FAULTS / AUXILIARY CONTROLS',aux);
  const auxBody=element('div','flight-service-body',undefined,aux);
  element('p','flight-service-hint','The normal training flow automatically energizes the P15 station on first use. These controls simulate a door switch failure or interrupt service.',auxBody);
  const actions=element('div','flight-service-actions',undefined,auxBody);
  serviceButton(actions,'OPEN REFUEL DOOR / RESTORE POWER',()=>{
   try{onGroundGuard();services.fuelDoorOpen=true;services.fuelPower=true;fuelMessage('Door power restored.');if(fuelAnyOpen())startFuelTicker();drawFuelPanel();}
   catch(e){fuelMessage(e.message,true);}
  });
  serviceButton(actions,'SIMULATE DOOR POWER FAILURE',()=>{
   services.fuelDoorOpen=true;services.fuelPower=false;
   fuelMessage('Door power failure · momentary AUX switch bypass available.',true);drawFuelPanel();
  });
  serviceButton(actions,'ABORT / STOP ALL TRANSFER',()=>{
   tankKeys.forEach(t=>services.valves[t]=false);updateFuelValveControls();
   stopFuel('Instructor emergency abort · all flow stopped immediately (no normal valve closure run-on).');
  });
  serviceButton(actions,'CLOSE REFUEL DOOR',()=>{
   if(fuelAnyOpen()||fuelHasRunOn()){
    fuelMessage('Close all valves and wait for residual flow before closing the refuel door.',true);return;
   }
   services.fuelDoorOpen=false;services.fuelPower=false;
   fuelMessage('Refuel door closed · P15 power OFF.');drawFuelPanel();
  });
  element('small','flight-service-hint','FCOM 12.10.7–8: OPEN energizes related valve; CLOSED de-energizes. Blue valve position lamp indicates OPEN with tank not full. Displays represent usable fuel in KG. The 50 KG post-closure quantity, 18 KG/s transfer rate and ten-kg display increments are training approximations, not certified Boeing performance.',auxBody);
  drawFuelPanel();
  win.addEventListener('b737:unified-ecu-observation',()=>{
   const q=getQty();
   if(q)for(const tank of tankKeys){
    const field=$('flightFuelQuick_'+tank);
    if(field?.dataset.initialized==='no'&&!field.value.trim()){
     field.value=String(Math.round(q[tank]||0));field.dataset.initialized='yes';
    }
   }
   if(!services.fuelRunning&&doc.querySelector('#flightScenarioDialog[open] [data-service="fuel"][open]')&&Date.now()-lastFuelDraw>700)drawFuelPanel();
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
}catch(error){queueMicrotask(()=>{throw error});}
;await 0;
;
/* ./unified-welcome-readiness-v2.js?v=WELCOME-GATE-0001 */
try{
/* Unified Welcome entry gate: measured cockpit owner/paint milestones.
 * 70% is a weighted readiness score, never a fake network/download percentage.
 * Main panel/flight displays/electrical/MCP/CDUs are mandatory even at 99%.
 * Pure evaluator; no side effects or DOM mutations.
 */
(function(root,factory){'use strict';
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.B737WelcomeReadinessV2=api;
})(typeof globalThis!=='undefined'?globalThis:null,function(){'use strict';
 const VERSION='WELCOME-MAIN-READY-0001',MIN_PERCENT=70;
 const REQUIRED=Object.freeze(['mainPhotos','mainInstruments','mcp','electrical',
  'cdu','throttle','forward']);
 function evaluate({visual={},full={},mcpMounted=false}={}){
  const checks={
   mainPhotos:visual.main===true&&full.main===true,
   // StartupGate requires both painted EADIs, both EHSIs and a
   // live engine-indication layer (rather than merely a background texture).
   mainInstruments:full.instruments===true,
   mcp:full.controls===true&&mcpMounted===true,
   electrical:full.electrical===true,
   cdu:full.cdu===true,
   throttle:visual.throttle===true,
   forward:visual.forward===true,
   aft:visual.aft===true,
   pedestal:visual.pedestal===true,
   overheadOwner:full.overhead===true
  };
  const weights={mainPhotos:2,mainInstruments:3,mcp:1,electrical:2,
   cdu:1,throttle:1,forward:1,aft:1,pedestal:1,overheadOwner:1};
  const total=Object.values(weights).reduce((n,w)=>n+w,0);
  const done=Object.entries(weights).reduce((n,[key,w])=>n+(checks[key]?w:0),0);
  const percent=Math.floor(done*100/total);
  const missing=REQUIRED.filter(key=>!checks[key]);
  const mainReady=checks.mainPhotos&&checks.mainInstruments&&checks.mcp;
  return {version:VERSION,percent,completed:done,total,
   mainReady,criticalReady:missing.length===0,
   canEnter:percent>=MIN_PERCENT&&missing.length===0,
   checks,missing};
 }
 function scenarioReady({shared=false,active=false,
   beforePaints=[],afterPaints=[],final10=false,final10Complete=false,
   elapsedMs=0}={}){
  if(shared===true)return true;
  const fresh=beforePaints.length===2&&afterPaints.length===2&&
   afterPaints.every((paint,index)=>Number.isFinite(paint)&&
    paint>beforePaints[index]);
  return active===true&&fresh&&(!final10||final10Complete===true)&&elapsedMs>=500;
 }
 return Object.freeze({VERSION,MIN_PERCENT,REQUIRED,evaluate,scenarioReady});
});

}catch(error){queueMicrotask(()=>{throw error});}
;await 0;
})();
