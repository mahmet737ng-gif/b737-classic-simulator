/* Unified FAILURES header V1.
 * This menu is additive to the live instructor bus-failure protocol.
 * No simulator source selector, overhead switch, ECU or protected artwork is modified.
 */
(function(root,factory){'use strict';
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root&&root.document)api.install(root);
})(typeof window!=='undefined'?window:globalThis,function(){'use strict';
 const GROUPS=Object.freeze([
  {name:'AC · GENERATOR / MAIN / TRANSFER · 115V',ids:[
   'generator1@115VAC','generator2@115VAC','main1@115VAC','main2@115VAC',
   'transfer1@115VAC','transfer2@115VAC']},
  {name:'AC · EXTERNAL / SERVICE · 115V',ids:[
   'external@115VAC','groundService@115VAC']},
  {name:'DC · DISTRIBUTION · 28V',ids:[
   'dc1@28VDC','dc2@28VDC','battery@28VDC','hotBattery@28VDC',
   'switchedHotBattery@28VDC']},
  {name:'STANDBY',ids:['standby@115VAC','standby@28VDC']},
  {name:'ELECTRONICS · 115V AC / 28V DC',ids:[
   'electronic1@115VAC','electronic2@115VAC',
   'electronic1@28VDC','electronic2@28VDC']},
  {name:'AC CONVERTER OUTPUT · 28V AC',ids:[
   'transfer1@28VAC','transfer2@28VAC','main1@28VAC','main2@28VAC',
   'groundService@28VAC']}
 ]);
 const LABELS=Object.freeze({
  generator1:'GEN BUS 1',generator2:'GEN BUS 2',
  main1:'MAIN BUS 1',main2:'MAIN BUS 2',
  transfer1:'TRANSFER BUS 1',transfer2:'TRANSFER BUS 2',
  dc1:'DC BUS 1',dc2:'DC BUS 2',
  battery:'BATTERY BUS',hotBattery:'HOT BAT BUS',
  switchedHotBattery:'SW HOT BAT BUS',
  groundService:'GROUND SERVICE',external:'EXT POWER BUS',
  electronic1:'ELECTRONIC BUS 1',electronic2:'ELECTRONIC BUS 2'
 });
 function label(id){
  const [bus,voltage]=id.split('@');
  return bus==='standby'?(voltage==='115VAC'?'AC STBY BUS':'DC STBY BUS'):
   LABELS[bus]||id;
 }
 const ids=()=>GROUPS.flatMap(group=>group.ids);
 function validateProtocol(protocol){
  if(!protocol?.live?.get||!protocol?.live?.write||!protocol?.payload)
   throw Error('Shared Unified bus injection engine not ready');
  const expected=protocol.BUS_KEYS||[];
  const listed=ids();
  if(expected.length!==24||listed.length!==24||new Set(listed).size!==24||
    listed.some(key=>!expected.includes(key)))
   throw Error('Electrical FAILURES menu must match the complete 24-bus registry');
  return true;
 }
 function nextOffKeys(current,id,failed,expected){
  if(!expected.includes(id)||typeof failed!=='boolean')throw Error('Invalid electrical bus toggle');
  const set=new Set(current||[]);
  if([...set].some(k=>!expected.includes(k)))throw Error('Unknown existing bus failure');
  if(failed)set.add(id);else set.delete(id);
  return expected.filter(k=>set.has(k));
 }
 function install(win){
  const doc=win.document;
  if(!doc||!doc.getElementById)return null;
  if(win.B737UnifiedFailuresHeaderV1?.installed)return win.B737UnifiedFailuresHeaderV1;
  function init(){
   const trigger=doc.getElementById('failuresHeaderOpen');
   if(!trigger)return null;
   if(trigger.dataset.failuresBound==='true')return win.B737UnifiedFailuresHeaderV1;
   const create=(tag,parent,cls,text)=>{
    const node=doc.createElement(tag);
    if(cls)node.className=cls;
    if(text!==undefined)node.textContent=text;
    if(parent)parent.append(node);
    return node;
   };
   let opened=false;
   const panel=create('section',doc.body,'failures-popover');
   panel.id='failuresHeaderPopover';
   panel.hidden=true;
   panel.dir='ltr';
   panel.setAttribute('role','dialog');
   panel.setAttribute('aria-label','Unified Instructor Failures');
   const top=create('div',panel,'failures-top');
   create('strong',top,'','FAILURES · INSTRUCTOR');
   const closeButton=create('button',top,'failures-close','×');
   closeButton.type='button';
   closeButton.setAttribute('aria-label','Close Failures menu');
   const summaryLine=create('p',panel,'failures-intro',
    'Training faults only · Existing cockpit switches and live engine state are preserved.');
   const electrical=create('details',panel,'failures-electrical');
   electrical.id='failuresElectricalBranch';
   const summary=create('summary',electrical,'failures-section-title');
   const summaryName=create('span',summary,'','ELECTRICAL');
   const counter=create('span',summary,'failures-branch-counter','0 FAILED');
   const content=create('div',electrical,'failures-electrical-content');
   const feedback=create('p',content,'failures-feedback',
    'Tap any bus to inject or remove that bus failure in Unified.');
   feedback.id='failuresFeedback';
   feedback.setAttribute('role','status');
   const grid=create('div',content,'failures-bus-groups');
   const buttons=new Map();
   for(const group of GROUPS){
    const section=create('section',grid,'failures-group');
    create('h3',section,'',group.name);
    const rows=create('div',section,'failures-bus-grid');
    for(const key of group.ids){
     const button=create('button',rows,'failures-bus-toggle');
     button.type='button';button.dataset.bus=key;button.dataset.failed='false';
     button.setAttribute('aria-pressed','false');
     button.setAttribute('aria-label','Inject electrical bus failure: '+key);
     create('span',button,'failures-bus-name',label(key));
     const volts=create('small',button,'failures-bus-voltage',key.split('@')[1]);
     const state=create('span',button,'failures-bus-state','ACTIVE');
     state.dataset.indicator='true';
     buttons.set(key,button);
     button.addEventListener('click',()=>toggle(key));
    }
   }
   const actions=create('div',content,'failures-actions');
   const clear=create('button',actions,'failures-clear','CLEAR ELECTRICAL FAILURES');
   clear.type='button';
   const link=create('a',actions,'failures-lab-link','OPEN FULL BUS TEST LAB');
   link.href='../../bus-consumer-test-lab/v3.html';
   link.target='_blank';link.rel='noopener';
   create('p',panel,'failures-footer',
    'Future groups (Fuel, Hydraulic, Pneumatic and others) will be added here.');
   function live(){
    const api=win.B737UnifiedBusFailureInjectionV1;
    validateProtocol(api);
    return api;
   }
   function updateMessage(value,error=false){
    feedback.textContent=value;feedback.dataset.error=String(error);
   }
   function currentKeys(){
    try{
     const protocol=live(),record=protocol.live.get();
     return record.active?record.offBusKeys.slice():[];
    }catch(_){return [];}
   }
   function refresh(){
    const keys=new Set(currentKeys());
    trigger.dataset.failureCount=String(keys.size);
    trigger.dataset.failuresActive=String(keys.size>0);
    trigger.textContent=keys.size?'FAILURES ('+keys.size+')':'FAILURES';
    counter.textContent=keys.size+' FAILED';
    for(const [key,button] of buttons){
     const failed=keys.has(key);
     button.dataset.failed=String(failed);
     button.setAttribute('aria-pressed',String(failed));
     const status=button.querySelector('[data-indicator]');
     if(status)status.textContent=failed?'FAILED':'ACTIVE';
    }
    clear.disabled=keys.size===0;
    return keys.size;
   }
   function write(keys){
    const protocol=live(),record=protocol.payload(keys);
    protocol.live.write(record);
    refresh();
    return record;
   }
   function toggle(key){
    try{
     const keys=currentKeys(),next=nextOffKeys(keys,key,!keys.includes(key),live().BUS_KEYS);
     write(next);
     updateMessage(label(key)+(next.includes(key)?' · FAILURE INJECTED':' · FAILURE CLEARED'));
    }catch(error){updateMessage(error.message,true);}
   }
   function clearAll(){
    try{write([]);updateMessage('All instructor electrical bus failures cleared.');}
    catch(error){updateMessage(error.message,true);}
   }
   function close(){
    opened=false;panel.hidden=true;
    trigger.setAttribute('aria-expanded','false');
   }
   function open(){
    opened=true;panel.hidden=false;
    trigger.setAttribute('aria-expanded','true');
    refresh();
   }
   trigger.dataset.failuresBound='true';
   trigger.setAttribute('aria-controls',panel.id);
   trigger.setAttribute('aria-haspopup','dialog');
   trigger.setAttribute('aria-expanded','false');
   trigger.addEventListener('click',()=>opened?close():open());
   closeButton.addEventListener('click',close);
   clear.addEventListener('click',clearAll);
   doc.addEventListener('keydown',event=>{
    if(opened&&event.key==='Escape'){close();trigger.focus();}
   });
   doc.addEventListener('pointerdown',event=>{
    if(opened&&!panel.contains(event.target)&&!trigger.contains(event.target))close();
   });
   win.addEventListener('b737:bus-failure-injection-changed',refresh);
   win.addEventListener('focus',refresh);
   win.addEventListener('pageshow',refresh);
   const api=Object.freeze({installed:true,open,close,refresh,toggle,clearAll,
    getOpen:()=>opened,getFailedBuses:currentKeys,
    getGroups:()=>GROUPS.map(g=>({name:g.name,ids:g.ids.slice()}))});
   win.B737UnifiedFailuresHeaderV1=api;
   refresh();
   return api;
  }
  if(doc.readyState==='loading')doc.addEventListener('DOMContentLoaded',init,{once:true});
  else return init();
  return null;
 }
 return Object.freeze({GROUPS,LABELS,label,ids,validateProtocol,nextOffKeys,install});
});
