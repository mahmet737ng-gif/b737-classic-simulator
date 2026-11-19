(async()=>{
;
/* ./fuel-system-live-unified-v1.js?v=ATA28-FUEL-MOVE-0002 */
try{
/* B737 Classic ATA28: live readout of the ONE Unified/ISN ECU fuel system.
 * Controls are instructor-only ground fuel servicing/failure injection;
 * existing OH09 physical switches remain sole pilot command inputs.
 */
(function(root){'use strict';
 const ID='unifiedFuelSystemLiveATA28';let panel=null,status=null,liveRows=null,controls=null,last='';
 const label={main1:'MAIN 1',center:'CENTER',main2:'MAIN 2'};
 const pumpLabel={'fuel.main1FwdPump':'M1 FWD','fuel.main1AftPump':'M1 AFT',
  'fuel.main2FwdPump':'M2 FWD','fuel.main2AftPump':'M2 AFT',
  'fuel.centerLeftPump':'CTR L','fuel.centerRightPump':'CTR R'};
 const text=(tag,value,parent)=>{const el=document.createElement(tag);if(value!==undefined)el.textContent=value;parent?.append(el);return el;};
 const owner=()=>root.B737ISNCockpitV1;
 function command(args){
  try{const result=owner()?.fuelTrainerAction?.({instructor:true,...args});
   if(!result)throw Error('ECU fuel backend is not connected');
   status.textContent='ATA28 command accepted';refresh();return result;
  }catch(err){status.textContent=err.message||String(err);return null;}
 }
 function mount(){
  if(panel)return true;
  const parent=document.getElementById('isnBridgePanel');
  if(!parent||!owner()?.getFuelSystem)return false;
  panel=text('section',undefined,parent);panel.id=ID;panel.style.cssText='border:1px solid #45606b;border-radius:10px;padding:12px;margin:12px 0;line-height:1.7';
  text('h2','FUEL SYSTEM · ATA 28 · LIVE',panel);
  text('p','ECU fuel model with six pumps and a common manifold. Use FAILURES > FUEL to inject faults; overhead switches remain the pilot commands.',panel);
  liveRows=text('div',undefined,panel);liveRows.dir='ltr';
  liveRows.style.cssText='font:12px/1.5 ui-monospace,monospace;white-space:pre-wrap;overflow-wrap:anywhere;background:#0f1b22;color:#d9e5ec;padding:10px;border-radius:6px';
  controls=text('details',undefined,panel);text('summary','GROUND FUEL SERVICING · ON GROUND ONLY',controls);
  text('p','Fuel failure injection has moved to FAILURES > FUEL in the cockpit top bar.',controls);
  const tanks=text('div',undefined,controls);
  for(const id of ['main1','center','main2']){
   const line=text('label',undefined,tanks);
   line.style.cssText='display:flex;gap:7px;align-items:center;flex-wrap:wrap;margin:7px 0';
   text('span',label[id]+' kg',line);
   const inp=text('input',undefined,line);inp.type='number';inp.min='0';
   inp.max=String(({main1:4555,center:7029,main2:4555})[id]);inp.step='1';
   inp.dataset.tank=id;inp.style.cssText='width:100px';
   const button=text('button','SET QUANTITY',line);button.type='button';
   button.onclick=()=>command({type:'SERVICE_TANK',tank:id,quantityKg:Number(inp.value)});
  }
  status=text('p','Ready · FCOM 12.10 / 12.20 · Training values',panel);status.setAttribute('role','status');
  refresh();return true;
 }
 function refresh(){
  if(!panel||!owner()?.getFuelSystem)return;
  const s=owner().getFuelSystem();if(!s)return;
  const key=JSON.stringify([s.tanksKg,s.pumps,s.valves,s.scavenge,s.caution,s.indications,s.leaks]);
  if(key===last)return;last=key;
  const q=Object.entries(s.tanksKg).map(([id,kg])=>label[id]+': '+kg.toFixed(1)+' / '+s.capacitiesKg[id]+' kg');
  const ps=Object.entries(s.pumps).map(([id,p])=>pumpLabel[id]+': '+(p.commandedOn?'ON':'OFF')+' · '+(p.operating===null?'POWER ?':p.operating?'PRESSURE OK':'LOW PRESSURE')+(p.autoStopped?' · AUTO STOP':''));
  liveRows.textContent=q.join(' | ')+'\nTOTAL '+s.totalFuelKg.toFixed(1)+' kg · T '+s.fuelTemperatureC+' °C'+
   '\nMAIN 2 − MAIN 1 '+s.indications.imbalanceKg.toFixed(1)+' kg'+
   (s.indications.imbalanceLimitExceeded?' · LIMIT EXCEEDED':'')+
   '\nTEMPERATURE '+s.indications.temperature.status+' · MIN '+s.indications.temperature.minimumC+' °C'+
   '\nLEAK LOSS '+Object.entries(s.leaks.lostKg).map(([id,kg])=>label[id]+' '+kg.toFixed(1)+' kg').join(' | ')+
   '\nCROSSFEED selector '+s.valves.crossfeed.command+' / valve '+s.valves.crossfeed.position+' · '+s.valves.crossfeed.lamp+
   '\nSCAVENGE '+(s.scavenge.active?'WINDOW OPEN':'OFF')+' · '+s.scavenge.flowKgHr+' kg/h · '+Math.ceil(s.scavenge.remainingMs/60000)+' min left'+
   '\nFUEL CAUTION '+(s.caution.masterCaution?'ON':'OFF')+'\n'+ps.join(' | ');
 }
 root.addEventListener('b737:electrical-owner-ready',()=>{mount();refresh()});
 // ATA28 instructor telemetry is not an aircraft output. Never serialize
 // the full fuel snapshot at 10 Hz while the instructor drawer is hidden.
 // The ECU fuel plant, physical OH09 switches, cautions and fuel needles
 // still update independently through their existing live paths.
 root.addEventListener('b737:unified-ecu-observation',()=>{
  if(!document.body.classList.contains('side-open'))return;
  const profiler=root.B737InteractionProfilerV1,started=profiler?performance.now():0;
  try{if(mount()&&panel)refresh();}
  finally{if(profiler)profiler.markWork('ECU listener ATA28 instructor',performance.now()-started);}
 });
 document.getElementById('inspectorToggle')?.addEventListener('click',()=>{
  setTimeout(()=>{if(document.body.classList.contains('side-open')){mount();refresh();}},0);
 });
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount);else mount();
 root.B737UnifiedFuelSystemATA28=Object.freeze({version:'ATA28-FUEL-LIVE-0001',snapshot:()=>owner()?.getFuelSystem?.()??null,refresh});
})(window);

}catch(error){queueMicrotask(()=>{throw error});}
;await 0;
;
/* ./failures-fuel-v1.js?v=ATA28-FAILURES-FUEL-0003 */
try{
/* Unified FAILURES > FUEL (ATA 28).
 * Moves EXISTING instructor pump, crossfeed, tank-leak and fuel temperature
 * injectors into one branch. There is no second fuel ledger or simulated ECU.
 * Physical OH09 switches retain exclusive pilot command authority.
 */
(function(root,factory){'use strict';
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root?.document)api.install(root);
})(typeof window!=='undefined'?window:globalThis,function(){'use strict';
 const PUMPS=Object.freeze({
  'fuel.main1FwdPump':'MAIN 1 · FWD PUMP',
  'fuel.main1AftPump':'MAIN 1 · AFT PUMP',
  'fuel.main2FwdPump':'MAIN 2 · FWD PUMP',
  'fuel.main2AftPump':'MAIN 2 · AFT PUMP',
  'fuel.centerLeftPump':'CENTER · LEFT PUMP',
  'fuel.centerRightPump':'CENTER · RIGHT PUMP'
 });
 const TANKS=Object.freeze({main1:'MAIN 1',center:'CENTER',main2:'MAIN 2'});
 const normalTemperature=10,normalFreezePoint=-47;
 const round=x=>Math.round(x*100)/100;
 function faultSnapshot(s){
  if(!s)return null;
  const pump=Object.fromEntries(Object.keys(PUMPS).map(id=>[id,s.pumps?.[id]?.failed===true]));
  const leaks=Object.fromEntries(Object.keys(TANKS).map(id=>[id,Number(s.leaks?.rateKgHr?.[id]??0)]));
  const crossfeed=s.valves?.crossfeed?.failed===true;
  const temperature=s.indications?.temperature??{};
  const tempC=Number(s.fuelTemperatureC??temperature.celsius??normalTemperature);
  const freezeC=Number(temperature.freezePointC??normalFreezePoint);
  const abnormalTemperature=temperature.status==='ABOVE_MAX'||temperature.status==='BELOW_MIN';
  const total=Object.values(pump).filter(Boolean).length+Number(crossfeed)+
   Object.values(leaks).filter(v=>v>0).length+Number(abnormalTemperature);
  return {pump,leaks,crossfeed,temperatureC:tempC,freezePointC:freezeC,
   temperatureStatus:temperature.status??'UNKNOWN',abnormalTemperature,total};
 }
 function action(type,key,value){
  switch(type){
   case 'pump':
    if(!Object.hasOwn(PUMPS,key)||typeof value!=='boolean')throw Error('Invalid fuel pump fault');
    return {type:'PUMP_FAILURE',id:key,active:value};
   case 'crossfeed':
    if(typeof value!=='boolean')throw Error('Invalid crossfeed fault');
    return {type:'CROSSFEED_FAILURE',active:value};
   case 'leak':
    if(!Object.hasOwn(TANKS,key)||!Number.isFinite(value)||value<0||value>60000)
     throw Error('Leak rate must be 0–60000 kg/h');
    return {type:'TANK_LEAK',tank:key,rateKgHr:value};
   case 'temperature':
    if(!Number.isFinite(value)||value< -56||value>56)throw Error('Fuel temperature must be -56 to +56 °C');
    return {type:'FUEL_TEMPERATURE',celsius:value};
   case 'freezingPoint':
    if(!Number.isFinite(value)||value< -75||value>0)throw Error('Freezing point must be -75 to 0 °C');
    return {type:'FUEL_FREEZE_POINT',celsius:value};
   default:throw Error('Unsupported fuel failure control');
  }
 }
 function install(win){
  const doc=win.document;
  if(!doc)return null;
  function init(){
   if(win.B737UnifiedFuelFailuresV1?.installed)return win.B737UnifiedFuelFailuresV1;
   const host=doc.getElementById('failuresFuelMount');
   if(!host)return null;
   host.replaceChildren();
   const create=(tag,parent,css,label)=>{
    const el=doc.createElement(tag);if(css)el.className=css;
    if(label!==undefined)el.textContent=label;
    if(parent)parent.append(el);
    return el;
   };
   const owner=()=>win.B737ISNCockpitV1;
   const system=()=>owner()?.getFuelSystem?.()??null;
   const rows=[],pumps=new Map(),leaks=new Map();let wasReady=false;
   const status=create('p',host,'failures-feedback','FUEL ECU NOT READY');
   status.id='failuresFuelFeedback';status.setAttribute('role','status');
   const allButtons=[];
   const actionButton=(parent,name,callback,css='')=>{
    const b=create('button',parent,css,name);b.type='button';
    b.addEventListener('click',callback);allButtons.push(b);return b;
   };
   const numeric=(parent,label,minimum,maximum,step=1)=>{
    const wrapper=create('label',parent,'failures-fuel-field');
    create('span',wrapper,'',label);
    const input=create('input',wrapper,'');
    input.type='number';input.min=String(minimum);input.max=String(maximum);
    input.step=String(step);input.setAttribute('aria-label',label);
    rows.push(input);return input;
   };
   const group=(name)=>{
    const section=create('section',host,'failures-group');
    create('h3',section,'',name);return section;
   };
   const send=(args,label)=>{
    try{
     if(!owner()?.fuelTrainerAction||!system())throw Error('FUEL ECU NOT READY · Open Unified and initialize the electrical / ECU backend');
     const result=owner().fuelTrainerAction({instructor:true,...args});
     if(result?.accepted!==true)throw Error('Fuel ECU did not accept the instructor command');
     status.textContent=label+' · APPLIED TO LIVE ECU';
     status.dataset.error='false';
     refresh();
     win.B737UnifiedFailuresHeaderV1?.refresh?.();
     return result;
    }catch(error){
     status.textContent=error.message||String(error);status.dataset.error='true';
     refresh();return null;
    }
   };
   const inject=(type,key,value,label)=>{
    try{return send(action(type,key,value),label);}catch(error){
     status.textContent=error.message;status.dataset.error='true';return null;
    }
   };
   const pGroup=group('PUMP FAILURES · 6');
   const pumpGrid=create('div',pGroup,'failures-bus-grid');
   for(const [id,name] of Object.entries(PUMPS)){
    const b=actionButton(pumpGrid,name,()=>{
     const s=faultSnapshot(system());
     if(!s){status.textContent='FUEL ECU NOT READY';status.dataset.error='true';return;}
     inject('pump',id,!s.pump[id],name);
    },'failures-bus-toggle');
    b.dataset.fuelPump=id;b.dataset.failed='false';b.setAttribute('aria-pressed','false');
    const state=create('span',b,'failures-bus-state','NO FAULT');
    state.dataset.fuelState='pump';pumps.set(id,{button:b,state});
   }
   const crossGroup=group('CROSSFEED VALVE');
   const crossGrid=create('div',crossGroup,'failures-bus-grid');
   const cross=actionButton(crossGrid,'CROSSFEED VALVE STUCK',()=>{
    const s=faultSnapshot(system());
    if(!s){status.textContent='FUEL ECU NOT READY';status.dataset.error='true';return;}
    inject('crossfeed',null,!s.crossfeed,'CROSSFEED VALVE');
   },'failures-bus-toggle');
   cross.dataset.fuelCrossfeed='true';cross.dataset.failed='false';cross.setAttribute('aria-pressed','false');
   const crossStatus=create('span',cross,'failures-bus-state','NO FAULT');
   const leakGroup=group('TANK LEAKS · KG/H');
   for(const [tank,name] of Object.entries(TANKS)){
    const row=create('div',leakGroup,'failures-fuel-row');
    const input=numeric(row,name+' LEAK RATE (KG/H)',0,60000);
    const apply=actionButton(row,'APPLY LEAK',()=>{
     const v=Number(input.value);
     inject('leak',tank,v,name+' LEAK');
    });
    const clear=actionButton(row,'STOP LEAK',()=>inject('leak',tank,0,name+' LEAK'),'failures-fuel-clear-single');
    const current=create('span',row,'failures-fuel-reading','0 KG/H');
    leaks.set(tank,{input,apply,clear,current});
   }
   const tempGroup=group('FUEL TEMPERATURE / FREEZING POINT');
   const tempRow=create('div',tempGroup,'failures-fuel-row');
   const temperature=numeric(tempRow,'FUEL TEMPERATURE (°C)',-56,56);
   actionButton(tempRow,'SET °C',()=>inject('temperature',null,Number(temperature.value),'FUEL TEMPERATURE'));
   actionButton(tempRow,'HOT +50°C',()=>inject('temperature',null,50,'FUEL HIGH TEMPERATURE'));
   actionButton(tempRow,'COLD -50°C',()=>inject('temperature',null,-50,'FUEL LOW TEMPERATURE'));
   actionButton(tempRow,'NORMAL +10°C',()=>inject('temperature',null,normalTemperature,'FUEL TEMPERATURE'));
   const tempState=create('span',tempRow,'failures-fuel-reading','NORMAL');
   const freezeRow=create('div',tempGroup,'failures-fuel-row');
   const freeze=numeric(freezeRow,'FREEZING POINT (°C)',-75,0);
   actionButton(freezeRow,'SET POINT',()=>inject('freezingPoint',null,Number(freeze.value),'FREEZING POINT'));
   const actions=create('div',host,'failures-actions');
   const clearAll=actionButton(actions,'CLEAR ALL FUEL FAILURES',()=>{
    if(!system()){status.textContent='FUEL ECU NOT READY';status.dataset.error='true';return;}
    // Every reset targets the original ECU. Do not say ALL CLEARED if a
    // command was rejected halfway through the sequence.
    const commands=[
     ...Object.keys(PUMPS).map(id=>action('pump',id,false)),
     action('crossfeed',null,false),
     ...Object.keys(TANKS).map(tank=>action('leak',tank,0)),
     action('freezingPoint',null,normalFreezePoint),
     action('temperature',null,normalTemperature)
    ];
    try{
     for(const command of commands){
      const result=owner().fuelTrainerAction({instructor:true,...command});
      if(result?.accepted!==true)throw Error('Fuel ECU rejected '+command.type);
     }
     status.textContent='ALL FUEL FAILURES CLEARED';status.dataset.error='false';
    }catch(err){status.textContent='RESET INCOMPLETE · '+(err.message||String(err));status.dataset.error='true';}
    refresh();win.B737UnifiedFailuresHeaderV1?.refresh?.();
   },'failures-clear');
   const help=create('p',host,'failures-footer',
    'All injections command the existing ATA 28 ECU. Pilot overhead pump switches are not moved or overridden. Tank servicing remains in Fuel System Live.');
   help.setAttribute('role','note');
   function refresh(){
    const s=faultSnapshot(system()),ready=!!s;
    for(const b of allButtons)b.disabled=!ready;
    for(const input of rows)input.disabled=!ready;
    if(!ready){
     wasReady=false;
     status.textContent='FUEL ECU NOT READY · Initialize Unified electrical / ECU before testing';
     status.dataset.error='true';
     return 0;
    }
    if(!wasReady){
     status.textContent='LIVE FUEL ECU CONNECTED';
     status.dataset.error='false';
     wasReady=true;
    }
    for(const [id,{button,state}]of pumps){
     const active=s.pump[id];button.dataset.failed=String(active);
     button.setAttribute('aria-pressed',String(active));state.textContent=active?'FAILED':'NO FAULT';
    }
    cross.dataset.failed=String(s.crossfeed);
    cross.setAttribute('aria-pressed',String(s.crossfeed));
    crossStatus.textContent=s.crossfeed?'FAILED':'NO FAULT';
    for(const [tank,item]of leaks){
     const v=s.leaks[tank];item.current.textContent=round(v)+' KG/H';
     item.current.dataset.failed=String(v>0);
     if(doc.activeElement!==item.input)item.input.value=String(v);
     item.clear.disabled=v<=0;
    }
    if(doc.activeElement!==temperature)temperature.value=String(s.temperatureC);
    if(doc.activeElement!==freeze)freeze.value=String(s.freezePointC);
    tempState.textContent=s.temperatureStatus.replaceAll('_',' ')+' · '+round(s.temperatureC)+' °C';
    tempState.dataset.failed=String(s.abnormalTemperature);
    clearAll.disabled=s.total===0;
    return s.total;
   }
   const branch=doc.getElementById('failuresFuelBranch');
   branch?.addEventListener('toggle',()=>{if(branch.open)refresh();});
   win.addEventListener('b737:electrical-owner-ready',()=>{
    refresh();win.B737UnifiedFailuresHeaderV1?.refresh?.();
   });
   win.addEventListener('focus',()=>{if(!doc.getElementById('failuresHeaderPopover')?.hidden)win.B737UnifiedFailuresHeaderV1?.refresh?.();});
   // Reflect changes made outside this branch without heavy 10-Hz telemetry
   // serialization while the instructor flyout is closed.
   let observedAt=0;
   win.addEventListener('b737:unified-ecu-observation',()=>{
    if(!branch?.open||doc.getElementById('failuresHeaderPopover')?.hidden)return;
    const now=Date.now();if(now-observedAt<500)return;observedAt=now;
    win.B737UnifiedFailuresHeaderV1?.refresh?.();
   });
   const api=Object.freeze({installed:true,refresh,read:()=>faultSnapshot(system()),
    inject,clearAll:()=>clearAll.click(),getCount:()=>faultSnapshot(system())?.total??0});
   win.B737UnifiedFuelFailuresV1=api;
   win.B737UnifiedFailuresHeaderV1?.refresh?.();
   return api;
  }
  if(doc.readyState==='loading')doc.addEventListener('DOMContentLoaded',init,{once:true});
  else return init();
  return null;
 }
 return Object.freeze({PUMPS,TANKS,normalTemperature,normalFreezePoint,faultSnapshot,action,install});
});

}catch(error){queueMicrotask(()=>{throw error});}
;await 0;
;
/* ../../engine/instruments/cold-dark-indicator-v1.js?v=CDK-0001 */
try{
/* Cold & dark analogue instrument initial-condition resolver.
   Numeric physical states are separate from unverified pointer angles.
   Never write unknown sensor values as zero and never assume every dial
   starts at a twelve-o'clock marking. */
(function(root,factory){
 'use strict';
 const registry=(typeof module==='object'&&module.exports)?
   require('./cold-dark-indicator-policy-v1.json'):
   root?.B737ColdDarkIndicatorPolicyV1;
 const api=factory(registry,root);
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.B737ColdDarkIndicatorV1=api;
})(typeof globalThis==='object'?globalThis:this,function(registry,root){
 'use strict';
 const finite=v=>typeof v==='number'&&Number.isFinite(v);
 const registryNow=()=>registry||root?.B737ColdDarkIndicatorPolicyV1;
 const safe=(name,val,unit,source)=>Object.freeze({id:name,status:'physical_value_known',value:val,unit,source,calibrationApproved:false});
 const need=(name,why,unit)=>Object.freeze({id:name,status:'requires_system_state',value:null,unit,reason:why,calibrationApproved:false});
 const status=(name,state,reason,unit)=>Object.freeze({id:name,status:state,value:null,unit,reason,calibrationApproved:false});
 function context(profile={}){
   // Cold/dark conditions do not implicitly dictate outside temperature,
   // charge states, cabin altitude, surface positions or oxygen quantity.
   const defaults={enginesStopped:true,apuStopped:true,aircraftStationary:true,
     cabinEqualized:true,cabinPressureStable:true,bleedSourcesOff:true,
     airAndDuctPressureDissipated:false,allBusesDeenergized:true,
     engineOilPressureDissipated:true,hydraulicPressureDissipated:false,
     csdTemperatureEqualized:false,engineCooled:false,apuCooled:false,
     fieldElevationFt:null,indicatedAltitudeFt:null,ambientTemperatureC:null,
     fuelTemperatureC:null,cabinTemperatureC:null,oxygenPressurePsi:null,
     ductPressurePsi:null,flapPosition:null,engineOilTemperatureC:null,
     fuelFlowKgH:null,hydBrakePressurePsi:null,stabilizerTrim:null,
     rudderTrim:null,engineN1:null,engineN2:null,cabinAltitudeFt:null,
     fuelQuantities:null,clockTime:null,indicatedSpeedKts:null,
     selectedBus:null,selectorDriveOilMode:null};
   return Object.freeze({...defaults,...profile});
 }
 function resolve(id,c={}) {
   if(!registryNow()?.entries||!Object.prototype.hasOwnProperty.call(registryNow().entries,id))
     throw Error('Unknown cold-dark gauge ID '+id);
   const p=registryNow().entries[id],v=context(c),kind=p.kind;
   const physical=(num,key,unit)=>finite(num)?safe(id,num,unit,key):need(id,'Missing '+key,unit);
   switch(kind){
    case 'electrically_unpowered':
      if(v.allBusesDeenergized)
        return status(id,'unpowered_mechanical_rest_unverified',
          'No measured per-gauge electrical meter zero-stop. Do not invent bearing.',p.unit);
      return need(id,'Read the selected powered bus and meter selector state',p.unit);
    case 'selector_dual_temperature':
      if(!['rise','inlet'].includes(v.selectorDriveOilMode))
        return status(id,'selector_unknown','RISE vs IN not selected; same physical tick has different values','°C');
      if(v.selectorDriveOilMode==='rise'&&v.enginesStopped&&v.csdTemperatureEqualized)
        return safe(id,0,'°C','CSD inlet/outlet thermal equilibrium');
      return physical(v.selectorDriveOilMode==='rise'?v.csdRiseC:v.csdInletC,
        'CSD '+v.selectorDriveOilMode+' sensor','°C');
    case 'dual_readings':{
      const press=v.cabinEqualized?safe('press',0,'psi','equalized ambient and cabin'):
        physical(v.cabinDiffPressurePsi,'cabinDiffPressurePsi','psi');
      const alt=finite(v.cabinAltitudeFt)?safe('cabAlt',v.cabinAltitudeFt,'ft','cabin sensor'):
        v.cabinEqualized&&finite(v.fieldElevationFt)?
        safe('cabAlt',v.fieldElevationFt,'ft','cabin equalized, field elevation assumed on QNH'):
        need('cabAlt','Cabin altitude depends on outside static pressure, not zero','ft');
      return Object.freeze({id,status:'dual_independent_values',needles:Object.freeze({press, cabAlt:alt}),
        calibrationApproved:false});
    }
    case 'zero_on_stable_cabin':
      return v.cabinPressureStable?safe(id,0,'ft/min','stable cabin pressure'):
        physical(v.cabinRateFpm,'cabinRateFpm','ft/min');
    case 'zero_if_pneumatics_isolated':
      if(v.bleedSourcesOff&&v.airAndDuctPressureDissipated)
        return safe(id,0,'psi','pneumatic manifold depressurized');
      return physical(v.ductPressurePsi,'ductPressurePsi','psi');
    case 'ambient_sensor':
      return physical(id==='oh.fuel.temperature'?v.fuelTemperatureC:v.cabinTemperatureC,
        id==='oh.fuel.temperature'?'fuelTemperatureC':'cabinTemperatureC','°C');
    case 'thermal_or_power_dependent':
      return v.apuCooled&&finite(v.ambientTemperatureC)?
        safe(id,v.ambientTemperatureC,'°C','APU thermally cooled to ambient'):
        physical(v.apuEgtC,'apuEgtC','°C');
    case 'mechanical_low_stop':
      if(!v.aircraftStationary&&!finite(v.indicatedSpeedKts))
        return need(id,'Current IAS signal required','kt');
      return Object.freeze({id,status:'low_stop_if_offscale',
        physicalValue:finite(v.indicatedSpeedKts)?v.indicatedSpeedKts:0,unit:'kt',
        currentVisualMinKt:60,actualZeroMarkVerified:false,
        reason:'Photographed dial starts at 60 kt; a stationary aircraft is below the lowest tick',
        calibrationApproved:false});
    case 'zero_on_stable_static_pressure':
      return v.aircraftStationary?safe(id,0,'ft/min','stable static pressure'):
        physical(v.verticalSpeedFpm,'verticalSpeedFpm','ft/min');
    case 'static_pressure_altitude':
      if(finite(v.indicatedAltitudeFt))return safe(id,v.indicatedAltitudeFt,'ft','actual altimeter indication');
      return finite(v.fieldElevationFt)&&v.baroSettingMatchesQnh?
        safe(id,v.fieldElevationFt,'ft','field elevation at correctly set QNH'):
        need(id,'Static pressure and barometric setting required; not always 0 ft','ft');
    case 'rotor_zero':
      return v.enginesStopped?safe(id,0,'%', 'engine rotor stopped'):
        physical(id.includes('.n1.')?v.engineN1:v.engineN2,id.includes('.n1.')?'engineN1':'engineN2','%');
    case 'fuel_flow_zero':
      return v.enginesStopped?safe(id,0,'flow','engines stopped and fuel cutoff'):
        physical(v.fuelFlowKgH,'fuel flow sensor','flow');
    case 'oil_pressure_zero':
      return v.enginesStopped&&v.engineOilPressureDissipated?safe(id,0,'psi','oil pressure dissipated'):
        physical(v.oilPressurePsi,'oilPressurePsi','psi');
    case 'vibration_zero':
      return v.enginesStopped?safe(id,0,p.unit,'no rotating engine components'):
        physical(v.engineVibration,'engineVibration',p.unit);
    case 'engine_oil_thermal':
      return physical(v.engineOilTemperatureC,'engineOilTemperatureC','°C');
    case 'engine_thermal':
      return v.engineCooled&&finite(v.ambientTemperatureC)?
        safe(id,v.ambientTemperatureC,'°C','engine cooled to ambient'):
        physical(v.engineEgtC,'engineEgtC','°C');
    case 'fuel_quantity_retained':{
      const key=id.split('.').at(-1),quantity=v.fuelQuantities?.[key];
      return physical(quantity,'fuel quantity in tank '+key,p.unit);
    }
    case 'accumulator_retained':
      return physical(v.hydBrakePressurePsi,'hydBrakePressurePsi','psi');
    case 'hydraulics_condition':
      return v.hydraulicPressureDissipated?safe(id,0,'psi','hydraulic systems fully depressurized'):
        physical(v.hydPressurePsi,'hydPressurePsi','psi');
    case 'mechanical_last_position':{
      const value=id==='fo.flap_position'?v.flapPosition:
        id.startsWith('ped.stab_trim.')?v.stabilizerTrim:v.rudderTrim;
      return physical(value,'retained mechanical surface position',p.unit);
    }
    case 'bottle_pressure_retained':
      return physical(v.oxygenPressurePsi,'physical oxygen bottle PSI','psi');
    case 'clock_retained':
      return status(id,'clock_or_last_position','Clock may remain running on an independent supply; never force hands to 00:00',p.unit);
    case 'nav_power_dependent':
      return status(id,'nav_invalid_or_held','Without receiver power, bearing needles are not zero; retain/unavailable based on equipment',p.unit);
    case 'identity_unresolved':
    case 'indicator_identity_unknown':
      return status(id,'identity_unresolved',p.details,p.unit);
    default:return status(id,'system_state_required',p.details,p.unit);
   }
 }
 function snapshot(c){return Object.freeze(Object.fromEntries(Object.keys(registryNow().entries).map(id=>[id,resolve(id,c)])));}
 return Object.freeze({context,resolve,snapshot,get registry(){return registryNow();}});
});
}catch(error){queueMicrotask(()=>{throw error});}
;await 0;
;
/* ./cold-dark-indicators-unified.js?v=CDK-0002-FIELD-ALT */
try{
(function(){
 'use strict';
 // Startup policy applies only demonstrably safe physical/stop positions.
 // It never converts an unverified scale into a flight-ready reading.
 const policyUrl=new URL('../../engine/instruments/cold-dark-indicator-policy-v1.json',document.baseURI).href;
 let ready=false,last=null,lastApplied=null,simActive=false;
 const report=()=>last;
 function safeApply(context){
   if(!ready)throw Error('Cold-dark registry not loaded');
   const resolver=window.B737ColdDarkIndicatorV1;
   const state=resolver.snapshot(context);
   last=state;
   const applied=[], skipped=[];
   const call=(fn,id)=>{try{fn();applied.push(id);}catch(error){skipped.push(id+': '+error.message);}};
   const isSafe=(id,value)=>state[id]?.status==='physical_value_known'&&state[id].value===value;
   // Existing APIs take calibrated visual offsets, not physical values.
   // Apply ONLY gauges where those existing models already define a known
   // zero/low-stop reference. Never manufacture numeric->angle calibrations.
   if(isSafe('oh.cabin.rate',0)&&window.B737UnifiedCabinRateNeedle)
     call(()=>window.B737UnifiedCabinRateNeedle.setOffset(0),'oh.cabin.rate');
   if(isSafe('oh.duct.pressure_lr',0)&&window.B737UnifiedDuctPressureNeedles)
     call(()=>window.B737UnifiedDuctPressureNeedles.setValues({L:0,R:0}),'oh.duct.pressure_lr');
   const air1=state['capt.airspeed'],air2=state['fo.airspeed'];
   if(air1?.status==='low_stop_if_offscale'&&air2?.status==='low_stop_if_offscale'&&
     window.B737UnifiedAirspeedPointers)
     call(()=>window.B737UnifiedAirspeedPointers.setAirspeedKts(60),'capt.airspeed / fo.airspeed');
   if(state['oh.fuel.temperature']?.status==='physical_value_known'&&window.B737UnifiedFuelTemperature)
     call(()=>window.B737UnifiedFuelTemperature.setTemperature(state['oh.fuel.temperature'].value),
       'oh.fuel.temperature');
   if(state['oh.crew_oxygen.pressure']?.status==='physical_value_known'&&window.B737UnifiedOxygenPressureGauge)
     call(()=>window.B737UnifiedOxygenPressureGauge.setPressurePsi(state['oh.crew_oxygen.pressure'].value),
       'oh.crew_oxygen.pressure');
   if(state['fo.flap_position']?.status==='physical_value_known'&&window.B737FlapNeedles)
     call(()=>window.B737FlapNeedles.setCommon(state['fo.flap_position'].value),
       'fo.flap_position');
   // Gen drive oil / AC/DC / press/alt / APU EGT:
   // no falsely calibrated zero angle. They remain visually provisional.
   lastApplied=Object.freeze({attempted:Object.keys(state).length,applied,skipped,
     status:'PHYSICAL_BASELINE_NO_UNVERIFIED_ANGLE_WRITES'});
   show();
   return lastApplied;
 }
 function show(){
   const elt=document.querySelector('#coldDarkGaugeQA');
   if(!elt||!last)return;
   const unresolved=Object.values(last).filter(v=>v.status==='requires_system_state'
     ||v.status==='identity_unresolved'||v.status==='selector_unknown').length;
   const cabin=last['oh.cabin.diff_pressure_altitude']?.needles;
   const numericCabin=cabin?.cabAlt?.status==='physical_value_known'
    ?' · Ground CAB ALT: '+cabin.cabAlt.value.toFixed(0)+' ft (DIFF '+cabin.press?.value+' psi)'
    :' · CAB ALT: airport elevation / valid sensor required';
   elt.querySelector('output').textContent=
    'Coverage: '+Object.keys(last).length+' gauges · physical zero independent of power · '+
    'Environment/system inputs required: '+unresolved+numericCabin+
    ' · Photo-calibrated needles approved: 0'+
    ' · Safe visual states applied: '+(lastApplied?.applied.join(', ')||'—');
 }
 function panel(){
   const inspector=document.querySelector('.inspector');if(!inspector||document.querySelector('#coldDarkGaugeQA'))return;
   const section=document.createElement('section');section.id='coldDarkGaugeQA';
   const head=document.createElement('h2');head.textContent='Cold & Dark · Instrument QA';
   const note=document.createElement('p');note.className='muted';
   note.textContent='Each gauge follows its own physical logic. Oxygen pressure, temperature, airport elevation, flaps and trim are not forced to zero. Unverified photo calibration is never applied.';
   const out=document.createElement('output');out.style.display='block';out.style.direction='rtl';
   section.append(head,note,out);inspector.append(section);show();
 }
 function cleanColdDark(){
   const current=window.B737ISNCockpitV1?.getStartState?.();
   const sources=current?.sources;
   const running=sources&&(sources.engine1?.running||sources.engine2?.running||sources.apu?.running);
   return !running;
 }
 window.addEventListener('b737:isn-start-indications',e=>{
   const engines=e.detail?.engines;
   if(engines&&(Number(engines.engine1?.n2?.value)>0||Number(engines.engine2?.n2?.value)>0))
     simActive=true;
 });
 window.B737UnifiedColdDarkIndicators=Object.freeze({
   getStatus:()=>lastApplied, getSnapshot:()=>last,
   apply(context={}){
     if(simActive||!cleanColdDark())return Object.freeze({status:'skipped_active_system'});
     return safeApply(context);
   }});
 function load(){
   panel();
   fetch(policyUrl,{cache:'no-cache'})
    .then(response=>{if(!response.ok)throw Error('Policy status '+response.status);return response.json();})
    .then(policy=>{
      if(Object.keys(policy.entries||{}).length!==54)throw Error('Cold dark inventory completeness guard failed');
      window.B737ColdDarkIndicatorPolicyV1=Object.freeze(policy);
      ready=true;
      const ground=window.B737GroundAirfieldContext?.()||{};
      if(!simActive&&cleanColdDark())safeApply(ground);
      else{last=window.B737ColdDarkIndicatorV1.snapshot(ground);show();}
    }).catch(error=>{
      const out=document.querySelector('#coldDarkGaugeQA output');
      if(out)out.textContent='Cold/dark state registry unavailable: '+error.message;
      console.error('Cold dark gauge initial condition unavailable:',error);
    });
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',load,{once:true});else load();
 window.addEventListener('b737:cockpit-mounted',panel);
 window.addEventListener('b737:cold-dark-state',event=>{
   if(ready&&!simActive&&cleanColdDark()){
     try{safeApply(event.detail||{});}catch(error){console.error(error);}
   }
 });
})();
}catch(error){queueMicrotask(()=>{throw error});}
;await 0;
;
/* ../../fire-protection-lab/engine.js?v=FIRELAMP-0007&amp;cb=CB-UNIFIED-0001&amp;p8=ATA26-0003 */
try{
/* B737 Classic ATA26 / FCOM 8.10 and 8.20, standalone engineering trainer v3.
   References (Sepehran 737CL FCOM): 8.10.1–8.10.4, 8.20.1–8.20.8.
   Educational simulation; no actual-flight/navigation endorsement.
   Never updates immutable panel art or sends commands to unified runtime.
*/
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.B737FireProtection=factory();})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
const UNITS=Object.freeze(['ENG1','ENG2','APU']), BOTTLES=Object.freeze(['L','R','APU']);
const clone=v=>JSON.parse(JSON.stringify(v));
function defaults(){return {
 selectors:{ENG1:'NORMAL',ENG2:'NORMAL'},test:null,extTest:null,
 heldSeconds:{ENG1:0,ENG2:0,APU:0},
 loops:{ENG1:{A:true,B:true},ENG2:{A:true,B:true}},
 sensing:{ENG1:{A:{fire:false,overheat:false},B:{fire:false,overheat:false}},ENG2:{A:{fire:false,overheat:false},B:{fire:false,overheat:false}}},
 apuDetector:true,engineFire:{ENG1:false,ENG2:false},engineOverheat:{ENG1:false,ENG2:false},apuFire:false,wheelWellFire:false,
 bottles:{L:false,R:false,APU:false},dischargedTo:{L:null,R:null,APU:null},pressureLow:{L:false,R:false,APU:false},pending:{L:null,R:null,APU:null},
 circuits:{L:true,R:true,APU:true},squibs:{L:{1:true,2:true},R:{1:true,2:true},APU:{1:true,2:true}},
 handles:{ENG1:{pulled:false,angle:0,override:false},ENG2:{pulled:false,angle:0,override:false},APU:{pulled:false,angle:0,override:false}},
 power:{batteryBus:true,hotBatteryBus:true,acTransfer1:true,onGround:true},ackFire:null,elapsed:0
};}
function selected(s,unit){const choice=s.selectors[unit],l=s.loops[unit];if(choice==='NORMAL')return ['A','B'].filter(k=>l[k]);return l[choice]?[choice]:[];}
function fault(s,unit){const choice=s.selectors[unit],l=s.loops[unit];return choice==='NORMAL'?(!l.A&&!l.B):!l[choice];}
function sensed(s,unit,kind){
 const paths=selected(s,unit);if(paths.length===0)return false;
 return paths.every(loop=>s.sensing[unit][loop][kind]||s.engineFire[unit]||(kind==='overheat'&&(s.engineOverheat[unit]||s.sensing[unit][loop].fire)));
}
// LAN ATA 26-20 figs 29/30. Two independent hot-battery feeds per
// engine bottle supply the two firing coils. Squib 1/2 selects the engine.
const liveCB=name=>globalThis.B737UnifiedCB?.available(name)!==false;
function feeds(bottle,cb){
 const primary=cb('fire.extinguisher'+bottle);
 return bottle==='APU'?[primary]:[primary,cb('fire.extinguisher'+bottle+'Alternate')];
}
function dischargeStatus(s,unit,angle,cb){
 const bottle=unit==='APU'?'APU':angle<0?'L':'R';
 if(!s.power.hotBatteryBus)return 'NO_HOT_BATTERY_POWER';
 if(s.bottles[bottle]||s.pending[bottle]!==null||s.pressureLow[bottle])return 'BOTTLE_UNAVAILABLE';
 const squib=unit==='ENG2'?2:1;
 if(!s.circuits[bottle]||!s.squibs[bottle][squib]||!feeds(bottle,cb).some(Boolean))
  return 'EXTINGUISHER_CIRCUIT_FAILED';
 return null;
}
function evaluate(s,cb=liveCB){
 const detector=unit=>cb(unit==='APU'?'apu.fireDetector':'engine'+(unit==='ENG1'?1:2)+'.fireDetector');
 const powered=s.power.batteryBus,testFire=s.test==='OVHT_FIRE'&&powered,testFault=s.test==='FAULT_INOP'&&powered;
 const testPath=unit=>testFire&&selected(s,unit).length>0;
 const anyFault=['ENG1','ENG2'].some(unit=>!detector(unit)||fault(s,unit));
 const failedTestPath=unit=>s.selectors[unit]==='NORMAL'?
  !s.loops[unit].A||!s.loops[unit].B:!s.loops[unit][s.selectors[unit]];
 const activeFire={
 ENG1:powered&&detector('ENG1')&&(testPath('ENG1')||sensed(s,'ENG1','fire')),
 ENG2:powered&&detector('ENG2')&&(testPath('ENG2')||sensed(s,'ENG2','fire')),
 APU:powered&&detector('APU')&&s.apuDetector&&(testFire||s.apuFire)
 };
 const activeOverheat={
 ENG1:powered&&detector('ENG1')&&(testPath('ENG1')||sensed(s,'ENG1','overheat')),
 ENG2:powered&&detector('ENG2')&&(testPath('ENG2')||sensed(s,'ENG2','overheat'))
 };
 const wheel=Boolean(cb('fire.wheelWellDetector')&&s.power.acTransfer1&&(s.wheelWellFire||testFire));
 const warningIds=[...UNITS.filter(unit=>activeFire[unit]),...(wheel?['WHEEL_WELL']:[])];
 const signature=warningIds.join('|'),acknowledged=s.ackFire!==null&&warningIds.every(id=>s.ackFire.split('|').includes(id));
 const noDet=powered&&(!s.apuDetector||!detector('APU'));
 // An engine detector FAULT alone does not illuminate either master caution (FCOM 8.10.3-4).
 const caution=testFault||activeOverheat.ENG1||activeOverheat.ENG2||noDet;
 const flags={
 ENG1_OVERHEAT:activeOverheat.ENG1,ENG2_OVERHEAT:activeOverheat.ENG2,
 FAULT:powered&&(testFault||anyFault||(testFire&&['ENG1','ENG2'].some(failedTestPath))),
 APU_DET_INOP:powered&&(testFault||!s.apuDetector||!detector('APU')),
 WHEEL_WELL:wheel,L_BOTTLE_DISCHARGED:s.power.hotBatteryBus&&feeds('L',cb).some(Boolean)&&(s.bottles.L||s.pressureLow.L),
 R_BOTTLE_DISCHARGED:s.power.hotBatteryBus&&feeds('R',cb).some(Boolean)&&(s.bottles.R||s.pressureLow.R),
 APU_BOTTLE_DISCHARGED:s.power.hotBatteryBus&&feeds('APU',cb).some(Boolean)&&(s.bottles.APU||s.pressureLow.APU),
 ENG1_FIRE:activeFire.ENG1,ENG2_FIRE:activeFire.ENG2,APU_FIRE:activeFire.APU,
 FIRE_BELL:cb('warning.aural')&&signature.length>0&&!acknowledged,
 MASTER_FIRE_WARN:cb('warning.masterFireControl')&&signature.length>0&&!acknowledged,
 APU_GROUND_HORN:s.power.onGround&&activeFire.APU&&!acknowledged,
 APU_GROUND_LIGHT:s.power.onGround&&activeFire.APU,
 APU_GROUND_LIGHT_FLASHING:s.power.onGround&&activeFire.APU&&!acknowledged,
 MASTER_CAUTION:caution,OVHT_DET:caution
 };
 const ext=s.extTest||s.test;
 const channel=ext==='EXT_1'?1:ext==='EXT_2'?2:0;
 for(const bottle of BOTTLES){const suffix=bottle==='L'?'L':bottle==='R'?'R':'APU';
  flags['EXT_'+suffix]=!!(channel&&feeds(bottle,cb).every(Boolean)&&s.power.hotBatteryBus&&s.circuits[bottle]&&s.squibs[bottle][bottle==='APU'?1:channel]&&s.dischargedTo[bottle]!== (bottle==='APU'?'APU':'ENG'+channel));
 }
 const outputs={};
 for(const unit of ['ENG1','ENG2']){const pulled=s.handles[unit].pulled;outputs[unit]={
 fuelShutoff:pulled,hydraulicShutoff:pulled,bleedShutoff:pulled,generatorTrip:pulled,reverserInhibit:pulled,
 engineDrivenHydraulicLowPressureInhibit:pulled};}
 const apuPull=s.handles.APU.pulled;
 const realApuFire=powered&&detector('APU')&&s.apuDetector&&s.apuFire;
 outputs.APU={autoShutdown:realApuFire,fuelShutoff:apuPull||realApuFire,bleedShutoff:apuPull,
 inletDoorClose:apuPull,generatorTrip:apuPull};
 // Extra P8 lamp check requested for this trainer. This does not assert an
 // actual detector fault, a failed APU loop, or a discharged bottle.
 const testLamps={
  FAULT:testFire&&['ENG1','ENG2'].some(detector),
  APU_DET_INOP:testFire&&detector('APU'),
  APU_BOTTLE_DISCHARGED:testFire&&s.power.hotBatteryBus&&feeds('APU',cb).some(Boolean)
 };
 return {indications:flags,testLamps,outputs,activeFire,activeOverheat,fireKeys:warningIds,fireSignature:signature,
 handleUnlock:{ENG1:activeFire.ENG1||activeOverheat.ENG1,ENG2:activeFire.ENG2||activeOverheat.ENG2,APU:activeFire.APU},
 detectorSelection:clone(s.selectors),dischargePending:clone(s.pending)};
}
function createEngine(initialPower,{available=liveCB}={}){
 const inspect=s=>evaluate(s,available);
 const initial=()=>{const state=defaults();Object.assign(state.power,initialPower);return state;};
 let state=initial(),last={accepted:true,reason:'INIT'};
 function dispatch(cmd){
 if(!cmd||typeof cmd!=='object')throw new TypeError('Command is required');
 const prior=state, n=clone(state),unit=cmd.unit, value=cmd.value;
 let result={accepted:true,reason:cmd.type};
 const known=()=>{if(!UNITS.includes(unit))throw new RangeError('Invalid unit '+unit);};
 const engine=()=>{if(!['ENG1','ENG2'].includes(unit))throw new RangeError('Invalid engine '+unit);};
 const bottleCheck=()=>{if(!BOTTLES.includes(cmd.bottle))throw new RangeError('Invalid bottle '+cmd.bottle);};
 switch(cmd.type){
 case 'RESET':Object.assign(n,initial());break;
 case 'SERVICE_BOTTLES':
   if(UNITS.some(id=>n.handles[id].pulled)||BOTTLES.some(id=>n.pending[id]!==null)){
    result={accepted:false,reason:'STOW_HANDLES_BEFORE_SERVICE'};break;
   }
   for(const bottle of BOTTLES){n.bottles[bottle]=false;n.dischargedTo[bottle]=null;}
   break;
 case 'SELECT_LOOP':
   if(!['NORMAL','A','B'].includes(value))throw new RangeError('Invalid selector detent');
   if(unit){engine();n.selectors[unit]=value;}else{n.selectors.ENG1=value;n.selectors.ENG2=value;}
   break;
 case 'EXT_TEST':
   if(![null,'EXT_1','EXT_2'].includes(value))throw new RangeError('Invalid extinguisher test');
   n.extTest=value;break;
 case 'TEST':if(![null,'EXT_1','EXT_2','FAULT_INOP','OVHT_FIRE'].includes(value))throw new RangeError('Invalid test');n.test=value;break;
 case 'SET_LOOP':engine();if(!['A','B'].includes(cmd.loop))throw new RangeError('Invalid loop');n.loops[unit][cmd.loop]=Boolean(cmd.healthy);break;
 case 'SET_SENSOR':
   engine();if(!['A','B'].includes(cmd.loop)||!['fire','overheat'].includes(cmd.kind))throw new RangeError('Invalid sensor');
   n.sensing[unit][cmd.loop][cmd.kind]=Boolean(cmd.active);break;
 case 'SET_APU_DETECTOR':n.apuDetector=Boolean(cmd.healthy);break;
 case 'SET_FIRE':known();if(unit==='APU')n.apuFire=Boolean(cmd.active);else n.engineFire[unit]=Boolean(cmd.active);break;
 case 'SET_OVERHEAT':engine();n.engineOverheat[unit]=Boolean(cmd.active);break;
 case 'SET_WHEEL_FIRE':n.wheelWellFire=Boolean(cmd.active);break;
 case 'SET_BOTTLE_LOW':bottleCheck();n.pressureLow[cmd.bottle]=Boolean(cmd.active);break;
 case 'SET_CIRCUIT':bottleCheck();
   if(cmd.channel!==undefined&&!['1','2',1,2].includes(cmd.channel))throw new RangeError('Invalid squib channel');
   if(cmd.channel!==undefined)n.squibs[cmd.bottle][cmd.bottle==='APU'?1:Number(cmd.channel)]=Boolean(cmd.healthy);
   else n.circuits[cmd.bottle]=Boolean(cmd.healthy);
   break;
 case 'SYNC_POWER':
   for(const bus of Object.keys(n.power)){
    if(typeof cmd.power?.[bus]!=='boolean')throw new TypeError('Missing '+bus);
    n.power[bus]=cmd.power[bus];
   }
   break;
 case 'SET_POWER':
   if(!Object.prototype.hasOwnProperty.call(n.power,cmd.bus))throw new RangeError('Invalid power bus');
   n.power[cmd.bus]=Boolean(cmd.active);break;
 case 'OVERRIDE':known();n.handles[unit].override=Boolean(cmd.enabled);break;
 case 'PULL':
   known();if(cmd.pulled===false){
     if(n.handles[unit].angle!==0){result={accepted:false,reason:'RETURN_ROTATION_TO_CENTER'};break;}
     n.handles[unit].pulled=false;break;}
   if(!(inspect(n).handleUnlock[unit]||n.handles[unit].override)){result={accepted:false,reason:'HANDLE_LOCKED'};break;}
   n.handles[unit].pulled=true;break;
 case 'ROTATE':
   known();if(![-45,0,45].includes(cmd.angle))throw new RangeError('Invalid rotary detent');
   if(!n.handles[unit].pulled){result={accepted:false,reason:'PULL_FIRST'};break;}
   if(n.handles[unit].angle!==cmd.angle){n.heldSeconds[unit]=0;n.handles[unit].angle=cmd.angle;}
   if(cmd.angle){
    const failure=dischargeStatus(n,unit,cmd.angle,available);
    if(failure)result={accepted:false,reason:failure};
   }
   break;
 case 'TICK': {
   const dt=cmd.seconds;
   if(!Number.isFinite(dt)||dt<0||dt>30)throw new RangeError('Invalid tick');
   n.elapsed+=dt;
   for(const id of UNITS){
    const angle=n.handles[id].angle;
    if(!angle||!n.handles[id].pulled||dischargeStatus(n,id,angle,available)){n.heldSeconds[id]=0;continue;}
    const held=n.heldSeconds[id];
    n.heldSeconds[id]=held+dt;
    if(held<1&&held+dt>=1){
     const bottle=id==='APU'?'APU':angle<0?'L':'R';
     // One second at the stop, followed by the pressure-switch delay.
     n.dischargedTo[bottle]=id;
     n.pending[bottle]=1-held+1.5;
    }
   }
   for(const bottle of BOTTLES)if(n.pending[bottle]!==null){
    n.pending[bottle]-=dt;
    if(n.pending[bottle]<=0){
     n.pending[bottle]=null;n.bottles[bottle]=true;
     // A successful application clears the simulated compartment fire. Separately
     // injected heat and detector faults remain under the instructor's control.
     const target=n.dischargedTo[bottle];
     if(target==='APU')n.apuFire=false;
     else if(target)n.engineFire[target]=false;
    }
   }
   break;}
 case 'BELL_CUTOUT':n.ackFire=inspect(n).fireSignature;break;
 default:throw new RangeError('Unknown fire protection command '+cmd.type);
 }
 if(!n.power.hotBatteryBus)for(const id of UNITS)n.heldSeconds[id]=0;
 if(result.accepted||(cmd.type==='ROTATE'&&n.handles[unit]?.pulled)){
   const was=inspect(prior).fireKeys, now=inspect(n).fireKeys;
   const newAlert=now.some(id=>!was.includes(id));
   if(newAlert)n.ackFire=null;
   if(!now.length)n.ackFire=null;
   state=n;
 }
 last=result;
 return {state:clone(state),derived:inspect(state),result};
 }
 return Object.freeze({dispatch,getState:()=>clone(state),evaluate:()=>inspect(state),lastEvent:()=>({...last})});
}
return Object.freeze({VERSION:'3.0.0',UNITS,BOTTLES,defaults,evaluate,createEngine});
});

}catch(error){queueMicrotask(()=>{throw error});}
;await 0;
;
/* ./fire-lights-model.js?v=FIRELAMP-0007 */
try{
/* P8 lamp windows and engraved legends registered to the 2172 × 724 plate. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.B737UnifiedFireLampModel=api;})(typeof globalThis==='undefined'?this:globalThis,function(){
'use strict';
const BASE=Object.freeze({width:2172,height:724});
const data=[
 ['ENG1_OVERHEAT',182,289,243,110,'rect'],['WHEEL_WELL',682,104,261,114,'rect'],
 ['FAULT',682,218,261,115,'rect'],['APU_DET_INOP',682,333,261,119,'rect'],
 ['APU_BOTTLE_DISCHARGED',682,453,261,121,'rect'],['ENG2_OVERHEAT',1236,289,246,111,'rect'],
 ['L_BOTTLE_DISCHARGED',1698,103,176,117,'rect'],['R_BOTTLE_DISCHARGED',1875,103,181,117,'rect'],
 ['EXT_L',1763,373,72,73,'round'],['EXT_R',1859,373,72,73,'round'],['EXT_APU',1810,467,72,73,'round']
];
const legends={
 ENG1_OVERHEAT:['ENG 1','OVERHEAT'], ENG2_OVERHEAT:['ENG 2','OVERHEAT'],
 WHEEL_WELL:['WHEEL','WELL'], FAULT:['FAULT'], APU_DET_INOP:['APU DET','INOP'],
 APU_BOTTLE_DISCHARGED:['APU BOTTLE','DISCHARGED'],
 L_BOTTLE_DISCHARGED:['L BOTTLE','DISCHARGED'], R_BOTTLE_DISCHARGED:['R BOTTLE','DISCHARGED']
};
const SLOTS=Object.freeze(data.map(([id,x,y,w,h,type])=>Object.freeze({id,type,lines:Object.freeze(legends[id]||[]),color:type==='round'?'green':id==='WHEEL_WELL'?'red':'amber',cx:x+w/2,cy:y+h/2,bounds:Object.freeze([x,y,w,h])})));
const map=Object.freeze(Object.fromEntries(SLOTS.map(s=>[s.id,s])));
function region(s){const [left,top,width,height]=s.bounds;return {left,top,width,height};}
function percent(s){const b=region(s);return {left:(b.left/BASE.width*100)+'%',top:(b.top/BASE.height*100)+'%',width:(b.width/BASE.width*100)+'%',height:(b.height/BASE.height*100)+'%'};}
function facePercent(){return {left:'0%',top:'0%',width:'100%',height:'100%'};}
function validate(){
 if(SLOTS.length!==11||new Set(SLOTS.map(s=>s.id)).size!==11)throw Error('Missing/duplicate lights');
 for(let i=0;i<SLOTS.length;i++){const a=SLOTS[i],b=region(a);
  if(b.left<0||b.top<0||b.left+b.width>BASE.width||b.top+b.height>BASE.height)throw Error('Outside plate '+a.id);
  if(a.cx!==b.left+b.width/2||a.cy!==b.top+b.height/2)throw Error('Center mismatch '+a.id);
  for(let j=i+1;j<SLOTS.length;j++){const c=region(SLOTS[j]);if(b.left<c.left+c.width&&c.left<b.left+b.width&&b.top<c.top+c.height&&c.top<b.top+b.height)throw Error('Light collision '+a.id+'/'+SLOTS[j].id);}
 }
 if(map.L_BOTTLE_DISCHARGED.cy!==map.R_BOTTLE_DISCHARGED.cy)throw Error('Bottle row mismatch');
 if(SLOTS.filter(s=>s.type==='round').some(s=>s.bounds[2]<70||s.bounds[3]<70))throw Error('Green lens undersized');
 return true;
}
validate();
return Object.freeze({BASE,SLOTS,map,region,faceRegion:region,percent,facePercent,legendPercent:facePercent,validate,source:'P8_REGISTERED_LENSES',version:'FIRELAMP-0007'});
});
}catch(error){queueMicrotask(()=>{throw error});}
;await 0;
;
/* ./fire-lights-unified.js?v=FIRELAMP-0007&amp;cb=CB-UNIFIED-0001&amp;p8=ATA26-0003 */
try{
(function(win){
'use strict';
const model=win.B737UnifiedFireLampModel;
if(!model)throw Error('FIRELAMP model missing');
const unit=win.B737FireProtection?.createEngine?.({batteryBus:false,hotBatteryBus:false,acTransfer1:false,onGround:true})||null;
const faceNodes=new Map();
let lastRegistration=null;
const overrides={};
let lastPanel='',clockAt=0,clockTimer=0;
const pressed=new Set(),pointerLamps=new Map();
function releaseLamp(id){
 if(pressed.delete(id))draw();
}
function releasePointer(e){
 const id=pointerLamps.get(e.pointerId);if(!id)return;
 pointerLamps.delete(e.pointerId);
 if(![...pointerLamps.values()].includes(id))releaseLamp(id);
}
function releaseAll(){
 pointerLamps.clear();if(pressed.size){pressed.clear();draw();}
}
function bindPushTest(node,id){
 node.setAttribute('role','button');node.tabIndex=0;
 node.setAttribute('aria-label',id+' — hold to test');
 node.addEventListener('pointerdown',e=>{
  e.stopPropagation();if(e.pointerType==='mouse'&&e.button!==0)return;
  pointerLamps.set(e.pointerId,id);pressed.add(id);draw();
 });
 node.addEventListener('click',e=>e.stopPropagation());
 node.addEventListener('keydown',e=>{
  if((e.key===' '||e.key==='Enter')&&!e.repeat){
   e.preventDefault();e.stopPropagation();pressed.add(id);draw();
  }
 });
 node.addEventListener('keyup',e=>{
  if(e.key===' '||e.key==='Enter'){e.preventDefault();e.stopPropagation();releaseLamp(id);}
 });
 node.addEventListener('blur',()=>releaseLamp(id));
}
let external=null, visualTest=false, attached=false, lastSystemLamps='',lampTestPower=false;
const ids=new Set(model.SLOTS.map(s=>s.id));
function systemIndications(computed=unit?.evaluate()?.indications||{}){
 const out={};
 for(const s of model.SLOTS)out[s.id]=Boolean(
  Object.prototype.hasOwnProperty.call(overrides,s.id)?overrides[s.id]:
  external&&Object.prototype.hasOwnProperty.call(external,s.id)?external[s.id]:
  computed[s.id]
 );
 return out;
}
function visualIndications(live=systemIndications()){
 const out={...live};
 for(const [id,lit] of Object.entries(unit?.evaluate()?.testLamps||{}))if(lit)out[id]=true;
 if(visualTest)for(const k of Object.keys(out))out[k]=true;
 if(lampTestPower)for(const id of pressed)out[id]=true;
 return out;
}
function draw(){
 const state=unit?.getState(),derived=unit?.evaluate();
 const live=systemIndications(derived?.indications),vals=visualIndications(live);
 for(const [id,node] of faceNodes){
  node.dataset.illuminated=String(vals[id]);
  node.dataset.pushTest=String(pressed.has(id));
 }
 const caution=derived?.indications.OVHT_DET,signature=JSON.stringify([live,caution]);
 if(signature!==lastSystemLamps){
  lastSystemLamps=signature;
  win.dispatchEvent(new CustomEvent('b737:unified-fire-indicators-state',{detail:{indications:{...live,OVHT_DET:caution},source:'FIRELAMP-0007_SYSTEM'}}));
 }
 if(state){
  const key=JSON.stringify([state.handles,state.selectors,state.test,state.extTest,state.power,state.bottles,
   derived.indications,derived.outputs,visualTest]);
  if(lastPanel!==key){
   lastPanel=key;
   win.dispatchEvent(new CustomEvent('b737:ata26-panel-state',{detail:{state,derived,visualTest}}));
   win.dispatchEvent(new CustomEvent('b737:fire-warning-state',{detail:{active:derived.indications.MASTER_FIRE_WARN,source:'ATA26'}}));
  }
 }
 return vals;
}
function attach(){
 if(attached)return true;
 const host=win.document.querySelector('#region-pedestal .texture-piece[data-piece="fire-protection"]');
 if(!host)return false;
 const base=host.querySelector(':scope > img');
 if(!base||!(base.dataset.perfSource||base.getAttribute('src')||'').includes('fire-v6/FIRE_PANEL_BARE.webp')){
  win.console.warn('FIRELAMP: fire plate asset not recognized; mounting skipped without changing other panels');
  return false;
 }
 const layer=win.document.createElement('div');
 layer.className='fire-lamps-mounted';
 layer.dataset.coordinateBase='2172x724';
 // The full-size host has the exact plate aspect ratio. Percent positioning
 // stays aligned at every zoom and when the real controls are moved to the lab.
 const hostW=parseFloat(host.style.width)||host.clientWidth;
 const hostH=parseFloat(host.style.height)||host.clientHeight;
 layer.setAttribute('aria-label','Fire protection indicator lamps');
 for(const slot of model.SLOTS){
  const node=win.document.createElement('span');node.className='fire-lamp';
  node.dataset.fireLamp=slot.id;node.dataset.kind=slot.type;
  const p=model.percent(slot);
  for(const [key,value]of Object.entries(p))node.style[key]=value;
  node.dataset.color=slot.color;
  node.dataset.version=model.version;
  for(const line of slot.lines){
   const label=win.document.createElement('span');label.textContent=line;node.append(label);
  }
  bindPushTest(node,slot.id);layer.append(node);faceNodes.set(slot.id,node);
 }
 host.append(layer);attached=true;
  win.document.addEventListener('pointerup',releasePointer,true);
  win.document.addEventListener('pointercancel',releasePointer,true);
  win.addEventListener('blur',releaseAll);
  win.document.addEventListener('visibilitychange',()=>{if(win.document.hidden)releaseAll();});
 lastRegistration={hostWidth:hostW,hostHeight:hostH,imageWidth:hostW,imageHeight:hostH,offsetX:0,offsetY:0};draw();
 win.dispatchEvent(new win.CustomEvent('b737:unified-fire-lamps-mounted',{detail:{count:model.SLOTS.length,base:model.BASE,source:model.source}}));
 return true;
}
function patch(values){
 if(!values||typeof values!=='object')throw TypeError('Indicator status object required');
 for(const [id,value] of Object.entries(values)){
  if(!ids.has(id))throw RangeError('Unknown fire indicator '+id);
  if(typeof value!=='boolean')throw TypeError('Fire indicator must be boolean '+id);
 }
 Object.assign(overrides,values);return draw();
}
function clearOverrides(){for(const key of Object.keys(overrides))delete overrides[key];return draw();}
// Run the clock only during a held discharge or a pressure indication delay.
function advanceClock(){
 if(!clockAt)return;
 const now=performance.now(),dt=Math.max(0,(now-clockAt)/1000);clockAt=now;
 if(dt)unit.dispatch({type:'TICK',seconds:Math.min(30,dt)});
}
function armClock(){
 clearTimeout(clockTimer);
 const s=unit.getState();
 const running=Object.values(s.pending).some(n=>n!==null)||Object.values(s.handles).some(h=>h.pulled&&h.angle);
 if(!running){clockAt=0;return;}
 if(!clockAt)clockAt=performance.now();
 clockTimer=setTimeout(()=>{advanceClock();draw();armClock();},100);
}
function dispatch(cmd){
 if(!unit)throw Error('Fire protection behavior core not loaded');
 advanceClock();const x=unit.dispatch(cmd);
 if(cmd.type==='RESET')syncPower(true);
 draw();armClock();
 if(!['TEST','EXT_TEST','TICK','OVERRIDE','BELL_CUTOUT'].includes(cmd.type))
  win.dispatchEvent(new CustomEvent('b737:ata26-input-change'));
 return x;
}
function syncPower(force=false){
 if(!unit)return;
 const network=win.B737UnifiedElectricalLive?.snapshot?.(),nodes=network?.nodes;
 const failed=win.B737UnifiedBusFailureInjectionV1?.live;
 const feed=(id,bus,volts)=>nodes?.[id]?.powered===true&&!failed?.isUnavailable(bus,volts);
 // The local lamp push energizes the test filaments through the master dim/test
 // system (LAN 26-20, figures 29/30). Its supply is independent of squib continuity.
 const cb=win.B737UnifiedCB;
 const testSupply=[['BATTERY_BUS','battery','lights.masterDimBattery'],['DC_1','dc1','lights.masterDimDC1'],
  ['DC_2','dc2','lights.masterDimDC2']].some(([id,bus,circuit])=>feed(id,bus,'28VDC')&&cb?.available(circuit)!==false);
 const testPowerChanged=lampTestPower!==testSupply;lampTestPower=testSupply;
 const flight=win.B737UnifiedFlightScenarioV1;
 const onGround=flight?.getDiagnostics?.()?.active===true?flight.getState()?.airborne!==true:network?.controls?.onGround!==false;
 const power={batteryBus:feed('BATTERY_BUS','battery','28VDC'),hotBatteryBus:feed('HOT_BATTERY_BUS','hotBattery','28VDC'),
  acTransfer1:feed('TRANSFER_1','transfer1','115VAC'),onGround};
 const prior=unit.getState().power;
 if(force||testPowerChanged||Object.keys(power).some(k=>prior[k]!==power[k])){
  advanceClock();unit.dispatch({type:'SYNC_POWER',power});draw();armClock();
 }
}
for(const name of ['b737:electrical-distribution-changed','b737:electrical-owner-ready','b737:bus-failure-injection-changed','b737:flight-scenario-stopped'])
 win.addEventListener(name,()=>syncPower());
let lastAirborne=null;
win.addEventListener('b737:flight-scenario-state',e=>{
 const flag=e.detail?.airborne;if(typeof flag==='boolean'&&flag!==lastAirborne){lastAirborne=flag;syncPower();}
});
queueMicrotask(syncPower);
win.addEventListener('b737:cockpit-mounted',attach);
win.document.addEventListener('DOMContentLoaded',attach,{once:true});
win.addEventListener('load',attach,{once:true});
win.addEventListener('b737:visual-test',e=>{visualTest=Boolean(e.detail?.active);draw();});
win.addEventListener('b737:cb-state-change',()=>syncPower(true));
win.addEventListener('b737:fire-protection-state',e=>{if(e.detail?.indications&&typeof e.detail.indications==='object'){external={...e.detail.indications};draw();}});
if(win.document.readyState==='complete')attach();
win.B737UnifiedFireLights=Object.freeze({
 mount:attach,
 setIndicators:patch,
 clearOverrides,
 visualTest(active){visualTest=Boolean(active);return draw();},
 dispatch,indications:()=>Object.freeze({...visualIndications()}),
 systemIndications:()=>Object.freeze({...systemIndications()}),
 getState:()=>unit?.getState()||null,evaluate:()=>unit?.evaluate()||null,
 positions:()=>model.SLOTS.map(s=>({id:s.id,center:[s.cx,s.cy],frameBounds:model.region(s),glassBounds:model.faceRegion(s),legendPercent:model.legendPercent(s)})),
 version:()=>model.version,
 registration:()=>lastRegistration?Object.freeze({...lastRegistration}):null
});
})(window);

}catch(error){queueMicrotask(()=>{throw error});}
;await 0;
;
/* ./fire-hardware-unified.js?v=ATA26-0003-PERF-0001 */
try{
/* P8-1 hardware registered to the same fitted photo plane as all 11 lenses. */
(function(win){
'use strict';
const doc=win.document;
function createHardware(owner,openLab){
const controls=new Map(),handles=new Map(),held=new Map();
const handleRoot='../assets/locked/2026-10-23/Switches/Fire_Handles/';
const handleBounds={ENG1:[210,138,604,1274],APU:[254,117,517,1300],ENG2:[191,140,643,1278]};
let layer,feedback,lastState=null,visualTest=false,manualRelease=false,releaseButton;
function armRelease(armed){
 manualRelease=armed;
 releaseButton?.setAttribute('aria-pressed',String(armed));
}
function rect(el,x,y,w,h){
 Object.assign(el.style,{left:x/2172*100+'%',top:y/724*100+'%',width:w/2172*100+'%',height:h/724*100+'%'});
}
function button(label,cls){
 const el=doc.createElement('button');el.type='button';el.className=cls;
 el.title=label;el.setAttribute('aria-label',label);el.draggable=false;return el;
}
function command(cmd){
 const result=owner().dispatch(cmd);
 if(feedback&&!result.result.accepted)feedback.textContent=result.result.reason.replaceAll('_',' ');
 return result;
}
function touch(el,down,move,up){
 let id=null;
 el.addEventListener('pointerdown',e=>{
  if(e.button!==0||id!==null)return;
  e.preventDefault();e.stopPropagation();id=e.pointerId;el.setPointerCapture(id);down(e);
 });
 el.addEventListener('pointermove',e=>{if(e.pointerId===id&&move){e.preventDefault();e.stopPropagation();move(e);}});
 function release(e){if(e.pointerId!==id)return;id=null;up?.(e);}
 for(const name of ['pointerup','pointercancel','lostpointercapture'])el.addEventListener(name,release);
 el.addEventListener('click',e=>e.stopPropagation());
}
function switchAt(id,x,y,values,axis){
 const selector=id.startsWith('ENG'),isExt=id==='EXT',eventType=isExt?'EXT_TEST':'TEST';
 const label=selector?id+' OVHT DET':isExt?'EXT TEST':'Fire and overheat TEST';
 const sprite=doc.createElement('span');sprite.className='fire-toggle-silver';rect(sprite,x-85,y-85,170,170);
 layer.append(sprite);controls.set(id,{sprite,values,axis});
 function select(k){
  if(selector)command({type:'SELECT_LOOP',unit:id,value:values[k]});
  else if(k===1){held.delete(id);command({type:eventType,value:null});}
  else{held.set(id,eventType);command({type:eventType,value:values[k]});}
 }
 const center=button(label,'fire-touch');rect(center,x-42,y-39,84,78);layer.append(center);
 const indexFor=e=>{
  const r=center.getBoundingClientRect(),horizontal=axis==='x';
  const t=horizontal?(e.clientX-r.left)/r.width:(e.clientY-r.top)/r.height;
  return t<.36?0:t>.64?2:1;
 };
 touch(center,e=>select(indexFor(e)),e=>{const k=indexFor(e);if(values[k]!==currentValue())select(k);},
  ()=>{if(!selector)select(1);});
 function currentValue(){return selector?lastState?.selectors[id]:isExt?lastState?.extTest:lastState?.test;}
 center.onkeydown=e=>{
  const k={ArrowLeft:0,ArrowUp:0,Home:1,ArrowRight:2,ArrowDown:2}[e.key];
  if(k!==undefined){e.preventDefault();e.stopPropagation();if(!e.repeat)select(k);}
 };
 center.onkeyup=e=>{if(!selector&&e.key.startsWith('Arrow')){e.preventDefault();select(1);}};
 center.onblur=()=>{if(!selector&&held.has(id))select(1);};
 const zones=selector?[[x-98,y-34,52,68],[x-60,y+43,120,42],[x+45,y-34,55,68]]:
  isExt?[[x-112,y-62,65,60],null,[x-112,y+3,65,60]]:[[x-127,y-72,74,140],null,[x+55,y-72,78,140]];
 values.forEach((v,k)=>{
  if(!zones[k])return;
  const el=button(label+' '+v.replaceAll('_',' / '),'fire-touch fire-label-touch');rect(el,...zones[k]);layer.append(el);
  if(selector){el.addEventListener('pointerdown',e=>e.stopPropagation());el.onclick=e=>{e.stopPropagation();select(k);};}
  else{
   touch(el,()=>select(k),null,()=>select(1));
   el.onkeydown=e=>{if(['Enter',' '].includes(e.key)){e.preventDefault();if(!e.repeat)select(k);}};
   el.onkeyup=e=>{if(['Enter',' '].includes(e.key)){e.preventDefault();select(1);}};
   el.onblur=()=>{if(held.has(id))select(1);};
  }
 });
}
function handleAt(unit,x){
 const h=button(unit+' fire handle · pull / push, hold left or right to discharge','fire-handle-control');
 rect(h,x-92,143,184,428);h.dataset.unit=unit;
 const img=new Image();img.alt='';img.draggable=false;img.loading='eager';
 const source=handleRoot+'FIRE_HANDEL_'+unit+'_OFF.webp';
 if(win.B737ImageLoader)win.B737ImageLoader.assign(img,source);else img.src=source;
 const [cropX,cropY,w,height]=handleBounds[unit];
 Object.assign(img.style,{left:-cropX/w*100+'%',top:-cropY/height*100+'%',width:1024/w*100+'%',height:1536/height*100+'%'});
 h.append(img);layer.append(h);
 const handle=()=>owner().getState().handles[unit];
 const turn=angle=>command({type:'ROTATE',unit,angle});
 function pull(out){
  const released=out&&manualRelease;
  if(released){armRelease(false);command({type:'OVERRIDE',unit,enabled:true});}
  try{return command({type:'PULL',unit,pulled:out});}
  finally{if(released)command({type:'OVERRIDE',unit,enabled:false});}
 }
 let gesture=null;
 touch(h,e=>{
  const bounds=h.getBoundingClientRect();
  gesture={x:e.clientX,y:e.clientY,action:null,width:bounds.width,height:bounds.height,
   allowTurn:handle().pulled&&e.clientY<bounds.top+bounds.height/2};
 },e=>{
  if(!gesture)return;
  const dx=(e.clientX-gesture.x)/gesture.width,dy=(e.clientY-gesture.y)/gesture.height;
  if(gesture.allowTurn&&Math.abs(dx)>.23&&Math.abs(dx)>Math.abs(dy)){
   const angle=dx<0?-45:45;
   if(gesture.action!==angle){gesture.action=angle;turn(angle);}
  }else if(typeof gesture.action==='number'&&Math.abs(dx)<.12){
   gesture.action='center';turn(0);
  }else if(!gesture.action&&(Math.abs(dx)>.18||Math.abs(dy)>.18))gesture.action='drag';
 },e=>{
  if(!gesture)return;
  const tap=gesture.action===null&&e.type==='pointerup';gesture=null;
  if(handle().angle)turn(0);else if(tap)pull(!handle().pulled);
 });
 h.onclick=e=>{e.stopPropagation();if(e.detail===0)pull(!handle().pulled);};
 h.onkeydown=e=>{
  if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home'].includes(e.key))return;
  e.preventDefault();e.stopPropagation();if(e.repeat)return;
  if(e.key==='ArrowLeft'||e.key==='ArrowRight')turn(e.key==='ArrowLeft'?-45:45);
  else if(e.key==='Home')turn(0);else pull(e.key==='ArrowUp');
 };
 h.onkeyup=e=>{if(['ArrowLeft','ArrowRight'].includes(e.key)){e.preventDefault();turn(0);}};
 h.onblur=()=>{if(handle().angle)turn(0);};
 handles.set(unit,h);
}
function release(){
 armRelease(false);
 for(const [id,type] of held){held.delete(id);command({type,value:null});}
 if(!owner())return;
 for(const [id,h] of Object.entries(owner().getState().handles)){
  if(h.angle)command({type:'ROTATE',unit:id,angle:0});
  if(h.override)command({type:'OVERRIDE',unit:id,enabled:false});
 }
}
function paint(state,derived,allOn=false){
 if(!state||!derived)return;lastState=state;visualTest=allOn;
 for(const [id,c] of controls){
  const v=state.selectors[id]??(id==='EXT'?(state.extTest||state.test):state.test);
  const k=c.values.indexOf(v),pose=k===0?(c.axis==='x'?0:3):k===2?(c.axis==='x'?2:4):1;
  c.sprite.style.backgroundPositionX=pose*25+'%';c.sprite.dataset.detent=c.values[k]||'CENTER';
 }
 for(const [id,h] of handles){
  const st=state.handles[id],lit=allOn||derived.activeFire[id];
  h.style.transform='rotate('+st.angle+'deg)';
  h.dataset.pulled=String(st.pulled);h.dataset.angle=String(st.angle);h.dataset.lit=String(lit);
  h.setAttribute('aria-pressed',String(st.pulled));
 }
}
// The public training bell uses the two tones from the existing audio lab.
let audio=null,volume=null,bellTimer=0,bellWanted=false,bellMuted=false;
function playBell(){
 if(!bellWanted||bellMuted||bellTimer||win.navigator.userActivation?.hasBeenActive===false)return;
 const Engine=win.AudioContext||win.webkitAudioContext;if(!Engine)return;
 audio=audio||new Engine();if(audio.state!=='running')audio.resume().catch(()=>{});
 volume=audio.createGain();volume.gain.value=.16;volume.connect(audio.destination);
 function strike(){
  const t=audio.currentTime;
  for(const [hz,end,type] of [[950,800,'sine'],[1550,1300,'triangle']]){
   const osc=audio.createOscillator(),gain=audio.createGain();osc.type=type;
   osc.frequency.setValueAtTime(hz,t);osc.frequency.exponentialRampToValueAtTime(end,t+.4);
   gain.gain.setValueAtTime(.001,t);gain.gain.exponentialRampToValueAtTime(.45,t+.009);
   gain.gain.exponentialRampToValueAtTime(.001,t+.45);
   osc.connect(gain);gain.connect(volume);osc.start(t);osc.stop(t+.47);
   osc.onended=()=>{osc.disconnect();gain.disconnect();};
  }
 }
 strike();bellTimer=setInterval(strike,600);
}
function bell(active){
 bellWanted=active;
 if(active&&!bellMuted){playBell();return;}
 if(bellTimer){clearInterval(bellTimer);bellTimer=0;volume.disconnect();}
}
function mount(host){
 if(layer||!owner()||!host)return;
 layer=doc.createElement('div');layer.className='fire-hardware-layer';host.append(layer);
 if(openLab){
 const labTarget=button('Fire Protection Test Lab · triple click','fire-lab-target');
 labTarget.onclick=e=>{
  e.stopPropagation();
  if(e.detail===0||e.detail>=3)openLab();
 };
 layer.append(labTarget);
 }
 const patch=new Image();patch.className='fire-surface-patch';patch.src='./assets/pedestal-hardware/fire-blanking.webp';patch.alt='';patch.draggable=false;rect(patch,1205,424,299,186);layer.append(patch);
 switchAt('ENG1',305,222,['A','NORMAL','B'],'x');switchAt('ENG2',1359,222,['A','NORMAL','B'],'x');
 switchAt('TEST',305,519,['FAULT_INOP','CENTER','OVHT_FIRE'],'x');switchAt('EXT',2047,486,['EXT_1','CENTER','EXT_2'],'x');
 handleAt('ENG1',544);handleAt('APU',1090);handleAt('ENG2',1614);
 const bell=button('Fire warning bell cutout','fire-bell-cutout');bell.textContent='BELL CUTOUT';rect(bell,1001,71,178,29);
 bell.onpointerdown=e=>e.stopPropagation();bell.onclick=e=>{e.stopPropagation();command({type:'BELL_CUTOUT'});};layer.append(bell);
 releaseButton=button('Fire handle manual lock release · arm next pull','fire-override');
 rect(releaseButton,1314,476,64,64);armRelease(false);
 releaseButton.onpointerdown=e=>e.stopPropagation();
 releaseButton.onclick=e=>{e.stopPropagation();armRelease(!manualRelease);};
 layer.append(releaseButton);
 feedback=doc.createElement('span');feedback.className='fire-sr-status';feedback.setAttribute('role','status');layer.append(feedback);
 paint(owner().getState(),owner().evaluate(),visualTest);
}
return {mount,release,paint(state,derived,allOn){
 paint(state,derived,allOn);bell(derived.indications.FIRE_BELL);
},stopBell:()=>bell(false),muteBell:muted=>{bellMuted=muted;bell(bellWanted);},playBell};
}
win.B737FirePanelHardware=Object.freeze({create:createHardware});
const owner=()=>win.B737UnifiedFireLights;
const primary=createHardware(owner,()=>win.B737UnifiedFireLab?.open());
function mount(){
 primary.mount(doc.querySelector('#region-pedestal [data-piece="fire-protection"] .fire-lamps-mounted'));
}
doc.addEventListener('pointerdown',primary.playBell,{passive:true});
win.addEventListener('b737:ata26-panel-state',e=>primary.paint(e.detail.state,e.detail.derived,e.detail.visualTest));
win.addEventListener('b737:fire-lab-visibility',e=>primary.muteBell(e.detail));
win.addEventListener('b737:unified-fire-lamps-mounted',mount);
win.addEventListener('b737:cockpit-mounted',mount);
win.addEventListener('blur',primary.release);
doc.addEventListener('visibilitychange',()=>{if(doc.hidden)primary.release();});
win.addEventListener('b737:sixpack-fire-acknowledge',()=>owner()?.dispatch({type:'BELL_CUTOUT'}));
queueMicrotask(mount);
})(window);

}catch(error){queueMicrotask(()=>{throw error});}
;await 0;
})();
