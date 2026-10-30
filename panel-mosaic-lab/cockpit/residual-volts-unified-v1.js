/* RESID-0001 OH10 bus adapter: only the existing recessed RESID VOLTS button and
 * the existing original AC VOLTS needle. No cockpit background/needle changes.
 * Overhead iframe emits b737:cockpit-overhead / recessed-button press/release.
 * A discrete bus status is NOT a calibrated residual-voltage measurement.
 */
(function(root){
 'use strict';
 const Core=root.B737ResidualVoltsModelV1,meters=root.B737UnifiedAcDcMetering;
 const selectors=root.B737UnifiedAcDcSelectors;
 if(!Core||!meters||!selectors){console.error('RESID bridge missing core gauge or selector');return;}
 const core=Core.create(),VERSION='RESID-0001-SAFE-MOMENTARY',HISTORY=[];
 let inspector=null,lastResult=null,lastButton='RELEASE',lastInput='NONE';
 function addLog(result,origin){
  HISTORY.push({event:origin,selector:result.selector,pressed:result.pressed,
   scale:result.scale,status:result.status,reason:result.reason,volts:result.acVolts,
   source:result.method,warning:result.warning});
  if(HISTORY.length>100)HISTORY.shift();
 }
 function normalValue(result){
  if(result.generator){
   const p=core.snapshot().plants[result.generator];
   if(p.normalVolts!==null)return p.normalVolts;
  }
  const read=selectors.getReadings();
  return read.acVolts??null;
 }
 function refresh(origin){
  const result=core.evaluate();lastResult=result;
  if(result.pressed){
   // If the selected source is unsafe, over-range, faulty or unknown we
   // deliberately park the ORIGINAL needle; never force 115V through a 30V scale.
   meters.setReading('acVolts',result.acVolts,{mode:'RESIDUAL'});
  }else{
   meters.setReading('acVolts',normalValue(result),{mode:'NORMAL'});
  }
  addLog(result,origin);renderInspector();
  root.dispatchEvent(new CustomEvent('b737:residual-volts-status',{
   detail:{...result,origin,version:VERSION}}));
  return result;
 }
 function setPress(pressed,origin='COMMAND'){
  if(typeof pressed!=='boolean')throw Error('RESID requires boolean');
  lastButton=pressed?'PRESS':'RELEASE';lastInput=origin;
  core.setPress(pressed);return refresh(origin);
 }
 function select(position){core.setSelector(position);return refresh('AC_SELECTOR');}
 function configure(source,patch){
  core.configure(source,patch);
  // Explicit normal sensor data can also feed normal AC selector source values.
  if(Object.hasOwn(patch,'normalVolts')||Object.hasOwn(patch,'normalFrequency')){
   const before=core.snapshot().plants[source];
   selectors.setSourceMeasurement('AC',source,{
    volts:before.normalVolts,cps:before.normalFrequency});
  }
  return refresh('PLANT_SAMPLE');
 }
 function mode(value){core.setMode(value);return refresh('MODE_CHANGE');}
 function damageControl(value){core.setDamageSimulation(value);return refresh('INSTRUCTOR_DAMAGE_GATE');}
 function replaceMeter(){core.resetDamage();return refresh('INSTRUCTOR_REPLACE_METER');}
 function consumeRecessed(detail,origin){
  if(detail?.id!=='residual-volts'||typeof detail.pressed!=='boolean')return false;
  // Must stay spring-return; never toggle or latch on release.
  setPress(detail.pressed,origin);
  return true;
 }
 root.addEventListener('message',event=>{
  if(event.origin!==root.location.origin)return;
  const frame=document.getElementById('overheadFrame');
  if(!frame||event.source!==frame.contentWindow)return;
  const data=event.data;
  if(data?.type!=='b737:cockpit-overhead'||data.kind!=='recessed-button')return;
  consumeRecessed(data,'OH10_RECESSED_IFRAME');
 });
 root.addEventListener('b737:recessed-button',event=>consumeRecessed(event.detail,'DIRECT_RECESSED_BUTTON'));
 root.addEventListener('b737:ac-dc-selector-change',event=>{
  if(event.detail?.side!=='AC')return;
  select(event.detail.position);
 });
 // This event is the documented external generator data entry point. An
 // Electrical V7 Boolean bus "online" MUST NOT be interpreted as GCR CLOSED.
 root.addEventListener('b737:residual-generator-state',event=>{
  const data=event.detail;
  try{if(data&&Core.generators.includes(data.source))configure(data.source,data.patch);}
  catch(e){console.error('RESID generator data rejected',e);}
 });
 root.addEventListener('b737:electrical-v7-state',event=>{
  const state=event.detail?.state||event.detail;
  const cfg=state?.config;
  if(!cfg)return;
  try{
   for(const [id,key] of [['GEN1','engine1Running'],['GEN2','engine2Running'],['APU GEN','apuRunning']]){
    if(typeof cfg[key]==='boolean')core.configure(id,{drive:cfg[key]?'RUNNING':'STOPPED'});
   }
   refresh('V7_DRIVE_STATUS_ONLY');
  }catch(error){console.error('RESID V7 drive inference rejected',error);}
 });
 function element(tag,text,parent){
  const node=document.createElement(tag);if(text!==undefined)node.textContent=text;
  if(parent)parent.append(node);return node;
 }
 function field(label,options,value,onChange,parent){
  const wrapper=element('label',label+' ',parent);
  wrapper.style.cssText='display:flex;align-items:center;justify-content:space-between;gap:6px;margin:6px 0;direction:ltr';
  const sel=element('select',undefined,wrapper);sel.setAttribute('aria-label',label);
  for(const v of options){const opt=element('option',v,sel);opt.value=v;}
  sel.value=value;sel.addEventListener('change',()=>onChange(sel.value));
  return sel;
 }
 function renderInspector(){
  if(!inspector)return;
  const result=lastResult||core.evaluate();
  const fields=inspector.querySelector('[data-resid-current]');
  if(fields)fields.textContent=[
   'button: '+lastButton+' ('+lastInput+')',
   'AC selector: '+result.selector,
   'meter scale: '+result.scale,
   'status: '+result.status,
   'reason: '+result.reason,
   'AC VOLTS: '+(result.acVolts===null?'UNKNOWN':result.acVolts.toFixed(1)+' V'),
   'method: '+result.method,
   'GCR: '+(result.generator?core.snapshot().plants[result.generator].gcr:'N/A'),
   'driver: '+(result.generator?core.snapshot().plants[result.generator].drive:'N/A'),
   'meter simulated damaged: '+result.meterDamaged,
   'warning: '+(result.warning||'none'),
   'QA: 0–30 V calibration is still provisional; training only'
  ].join('\n');
 }
 function buildInspector(){
  const holder=document.getElementById('unifiedAcDcMeteringNeedles');if(!holder)return;
  inspector=element('section',undefined,holder);
  inspector.dataset.residualLab='RESID-0001';
  element('h3','RESID VOLTS — ATA24 Test Lab (independent of photo)',inspector);
  const description=element('p','Press and hold the real RESID VOLTS button under OH10, or use this test control. Measured inputs and illustrative training fixtures are kept separate.',inspector);
  description.style.fontSize='12px';
  const status=element('pre','',inspector);status.dataset.residCurrent='1';
  status.style.cssText='white-space:pre-wrap;direction:ltr;text-align:left;font:11px monospace;padding:6px;border:1px solid #425b68;border-radius:6px;overflow-wrap:anywhere';
  const press=element('button','PRESS & HOLD · RESID VOLTS',inspector);
  press.type='button';press.style.cssText='touch-action:none;padding:6px;margin:5px 0';
  press.setAttribute('aria-label','Momentary residual voltage test');
  press.addEventListener('pointerdown',e=>{if(e.pointerType==='mouse'&&e.button!==0)return;e.preventDefault();press.setPointerCapture(e.pointerId);setPress(true,'TEST_LAB');});
  for(const name of ['pointerup','pointercancel','lostpointercapture'])
   press.addEventListener(name,()=>{if(core.snapshot().pressed)setPress(false,'TEST_LAB_RELEASE');});
  press.addEventListener('blur',()=>{if(core.snapshot().pressed)setPress(false,'TEST_LAB_BLUR');});
  press.addEventListener('keydown',e=>{if([' ','Enter'].includes(e.key)){e.preventDefault();if(!e.repeat)setPress(true,'TEST_LAB_KEY');}});
  press.addEventListener('keyup',e=>{if([' ','Enter'].includes(e.key)){e.preventDefault();setPress(false,'TEST_LAB_KEY_RELEASE');}});
  field('Source',['GEN1','GEN2','APU GEN'],core.snapshot().selector,
   name=>{selectors.choose('AC',name);},inspector);
  field('Measurement',['MEASURED','TRAINER_FIXTURE'],core.snapshot().mode,mode,inspector);
  field('GCR',['UNKNOWN','OPEN','CLOSED'],'UNKNOWN',
   value=>configure(core.snapshot().selector,{gcr:value}),inspector);
  field('Drive',['UNKNOWN','RUNNING','STOPPED','DISCONNECTED'],'UNKNOWN',
   value=>configure(core.snapshot().selector,{drive:value}),inspector);
  field('Generator type',['CSD','VSCF','APU'],'CSD',
   value=>configure(core.snapshot().selector,{technology:value}),inspector);
  const presets=element('div',undefined,inspector);
  presets.style.cssText='display:flex;gap:4px;flex-wrap:wrap;margin:6px 0';
  const presetsList=[
   ['CSD demo 18V',{technology:'CSD',gcr:'OPEN',drive:'RUNNING',measuredResidual:null,failed:false,fieldExcited:false},'TRAINER_FIXTURE'],
   ['CSD disconnected demo 4V',{technology:'CSD',gcr:'OPEN',drive:'DISCONNECTED',measuredResidual:null,failed:false,fieldExcited:false},'TRAINER_FIXTURE'],
   ['VSCF demo 17V',{technology:'VSCF',gcr:'OPEN',drive:'RUNNING',measuredResidual:null,failed:false,fieldExcited:false},'TRAINER_FIXTURE'],
   ['GCR CLOSED (unsafe)',{gcr:'CLOSED',drive:'RUNNING',fieldExcited:true,normalVolts:115},'MEASURED'],
   ['Sensor 12V',{gcr:'OPEN',drive:'RUNNING',fieldExcited:false,measuredResidual:12},'MEASURED'],
   ['Sensor overrange 45V',{gcr:'OPEN',drive:'RUNNING',fieldExcited:false,measuredResidual:45},'MEASURED'],
   ['Generator failed',{gcr:'OPEN',drive:'RUNNING',failed:true,measuredResidual:null},'MEASURED'],
   ['Unknown / no sensor',{gcr:'UNKNOWN',drive:'UNKNOWN',measuredResidual:null,failed:false,fieldExcited:null,normalVolts:null},'MEASURED']
  ];
  for(const [label,patch,setmode]of presetsList){
   const button=element('button',label,presets);button.type='button';
   button.style.cssText='font-size:11px;white-space:normal';
   button.onclick=()=>{
    const source=core.snapshot().selector;
    if(!Core.generators.includes(source))selectors.choose('AC','GEN1');
    const active=core.snapshot().selector;
    core.configure(active,patch);core.setMode(setmode);refresh('TEST_LAB_PRESET');
   };
  }
  const instructor=element('label','Instructor: simulate meter damage on unsafe press ',inspector);
  const checkbox=element('input',undefined,instructor);checkbox.type='checkbox';
  checkbox.onchange=()=>damageControl(checkbox.checked);
  const reset=element('button','Instructor: replace damaged voltmeter',inspector);
  reset.type='button';reset.onclick=replaceMeter;
  element('p','Demo values are illustrative only (18V/4V/17V). No measured residual volts can be inferred from V7 bus availability. Never execute this as an aircraft procedure.',inspector).style.fontSize='11px';
  renderInspector();
 }
 const api=Object.freeze({version:VERSION,press:setPress,select,configure,mode,
  setDamageSimulation:damageControl,replaceMeter,snapshot:()=>core.snapshot(),
  getAudit:()=>({lastEvent:lastInput,result:lastResult,history:HISTORY.map(x=>({...x})),
   connectedRecessedIframe:Boolean(document.getElementById('overheadFrame')?.contentWindow),
   originalArtworkUnchanged:true})});
 root.B737UnifiedResidualVolts=api;
 const frame=document.getElementById('overheadFrame');
 if(frame)frame.addEventListener('load',()=>setPress(false,'OH10_IFRAME_RELOADED'));
 root.addEventListener('blur',()=>{if(core.snapshot().pressed)setPress(false,'WINDOW_BLUR');});
 const initial=selectors.read('AC');core.setSelector(initial.position);
 buildInspector();refresh('INITIAL_CONNECT');
})(window);
