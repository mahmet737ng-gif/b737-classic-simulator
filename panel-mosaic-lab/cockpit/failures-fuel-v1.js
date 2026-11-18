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
