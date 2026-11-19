(async()=>{
;
/* ./exterior-lights-classic-v1.js?v=EXTL-CLASSIC-0001-CONTROLS&amp;cb=CB-UNIFIED-0001 */
try{
/* EXTL-CLASSIC-0001 — additive controls for OH23–25, no modification to frozen artwork/guards. */
(function(){
'use strict';
const defs=[
 ['landing-out-l','OUTBOARD LANDING L',['RETRACT','EXTEND','ON']],
 ['landing-out-r','OUTBOARD LANDING R',['RETRACT','EXTEND','ON']],
 ['landing-in-l','INBOARD LANDING L',['OFF','ON']],
 ['landing-in-r','INBOARD LANDING R',['OFF','ON']],
 ['runway-turnoff-l','RUNWAY TURNOFF L',['OFF','ON']],
 ['runway-turnoff-r','RUNWAY TURNOFF R',['OFF','ON']],
 ['taxi','TAXI',['OFF','ON']],
 ['logo','LOGO',['OFF','AUTO','ON']],
 ['strobe','STROBE',['OFF','AUTO','ON']],
 ['position-lights','POSITION',['ON BAT','OFF','ON']],
 ['anti-collision','ANTI-COLLISION',['OFF','ON']],
 ['wing-lights','WING',['OFF','ON']],
 ['wheel-well','WHEEL WELL',['OFF','ON']]
].map(([id,label,states])=>Object.freeze({id,label,states:Object.freeze(states)}));
const circuits={'landing-out-l':'landingOutboardL','landing-out-r':'landingOutboardR','landing-in-l':'landingInboardL','landing-in-r':'landingInboardR','runway-turnoff-l':'turnoffL','runway-turnoff-r':'turnoffR','taxi':'taxi','strobe':'strobe','position-lights':'position','wing-lights':'wingScan'};
const effective=states=>Object.fromEntries(defs.map(d=>{const v=states[d.id],cb=window.B737UnifiedCB;
 const protectedOn=d.id==='anti-collision'?(cb?.available('lights.beaconUpper')!==false||cb?.available('lights.beaconLower')!==false):!circuits[d.id]||cb?.available('lights.'+circuits[d.id])!==false;
 return [d.id,{selected:v,illuminated:protectedOn&&['ON','ON BAT'].includes(v),circuitAvailable:protectedOn}];}));
const allowed=new Map(defs.map(x=>[x.id,x]));
const copy=()=>JSON.parse(JSON.stringify(defs));
const isChild=window.parent!==window&&!!document.getElementById('atlasAbsolute');
if(isChild){
 let booted=false;
 window.addEventListener('b737:cb-state-change',()=>report());
 const report=()=>{
  const engine=window.B737OverheadToggles;
  if(!engine)return;
  const values=engine.getState();
  const states=Object.fromEntries(defs.map(d=>[d.id,values[d.id]||null]));
  parent.postMessage({type:'b737:exterior-lights',kind:'state',version:'EXTL-CLASSIC-0001',states,effective:effective(states)},location.origin);
  window.dispatchEvent(new CustomEvent('b737:exterior-lights-state',{detail:{states,effective:effective(states)}}));
 };
 function set(id,state){
  const def=allowed.get(id);if(!def||!def.states.includes(state))return false;
  const native=window.B737OverheadToggles;
  const button=document.getElementById('toggle-'+id);
  if(!native||!button)return false;
  if(native.getState()[id]===state)return true;
  // Use the original switch engine and its persisted state, never a parallel model.
  button.dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true,detail:0}));
  const target=Array.from(document.querySelectorAll('#toggleStates button')).find(x=>x.dataset.state===state);
  if(!target)return false;
  target.click();
  report();
  return native.getState()[id]===state;
 }
 const start=()=>{
  if(booted||!window.B737OverheadToggles||!document.getElementById('toggle-landing-out-l'))return false;
  booted=true;clearInterval(watch);
  window.addEventListener('b737:switch-change',e=>{if(allowed.has(e.detail?.id))report()});
  window.addEventListener('message',e=>{
   if(e.origin!==location.origin||e.source!==parent||e.data?.type!=='b737:exterior-lights-command')return;
   if(e.data.action==='query')report();
   if(e.data.action==='set')set(e.data.id,e.data.state);
  });
  window.B737ClassicExteriorLights=Object.freeze({version:'EXTL-CLASSIC-0001',definitions:copy,getState:()=>Object.fromEntries(defs.map(d=>[d.id,window.B737OverheadToggles.getState()[d.id]])),set});
  report();return true;
 };
 const watch=setInterval(start,200);start();
 setTimeout(()=>clearInterval(watch),25000);
}else{
 const snapshot={};
 let dialog=null,readout=null;
 const receive=e=>{
  if(e.origin!==location.origin||e.source!==document.getElementById('overheadFrame')?.contentWindow||e.data?.type!=='b737:exterior-lights'||e.data.kind!=='state')return;
  Object.assign(snapshot,e.data.states||{});
  refresh();
 };
 window.addEventListener('message',receive);
 const command=(action,id,state)=>{
  const frame=document.getElementById('overheadFrame');
  if(!frame||!frame.contentWindow)return false;
  frame.contentWindow.postMessage({type:'b737:exterior-lights-command',action,id,state},location.origin);
  return true;
 };
 function refresh(){
  if(!dialog)return;
  for(const card of dialog.querySelectorAll('[data-exterior-control]')){
   const id=card.dataset.exteriorControl,v=snapshot[id];
   card.querySelector('.ext-state').textContent=v||'—';
   for(const b of card.querySelectorAll('button[data-detent]'))b.setAttribute('aria-pressed',String(v===b.dataset.detent));
  }
  readout.textContent=Object.keys(snapshot).length===defs.length?'13 controls connected to the physical overhead panel.':'Open the Unified Overhead view to connect the controls.';
 }
 function open(){
  if(!dialog){
   dialog=document.createElement('dialog');dialog.id='b737ExteriorLightsDialog';dialog.className='extl-unified-dialog';
   dialog.setAttribute('aria-label','B737 Classic Exterior Lights');
   const title=document.createElement('h2');title.textContent='B737 CLASSIC · EXTERIOR LIGHTS (P5)';
   const close=document.createElement('button');close.type='button';close.className='extl-close';close.textContent='Close ×';close.onclick=()=>dialog.close();
   readout=document.createElement('p');readout.className='extl-status';readout.setAttribute('role','status');
   const grid=document.createElement('div');grid.className='extl-grid';
   for(const def of defs){
    const card=document.createElement('section');card.className='extl-card';card.dataset.exteriorControl=def.id;
    const label=document.createElement('strong');label.textContent=def.label;
    const state=document.createElement('span');state.className='ext-state';
    const choices=document.createElement('div');choices.className='extl-choices';
    for(const detent of def.states){
     const b=document.createElement('button');b.type='button';b.dataset.detent=detent;b.textContent=detent;
     b.onclick=()=>command('set',def.id,detent);choices.append(b);
    }
    card.append(label,state,choices);grid.append(card);
   }
   const note=document.createElement('p');note.className='extl-note';note.textContent='Change states using the existing mosaic switches. Electrical and CB logic are unchanged.';
   dialog.append(close,title,readout,grid,note);document.body.append(dialog);
  }
  refresh();dialog.showModal();command('query');
 }
 function install(){
  if(document.getElementById('b737ExteriorLightsOpen'))return;
  const bar=document.getElementById('unifiedLabShortcuts');
  if(!bar)return;
  const b=document.createElement('button');b.type='button';b.id='b737ExteriorLightsOpen';
  b.textContent='EXTERNAL LIGHTS';b.setAttribute('aria-haspopup','dialog');b.setAttribute('aria-controls','b737ExteriorLightsDialog');
  b.onclick=open;bar.append(b);
  window.B737ClassicExteriorLights=Object.freeze({version:'EXTL-CLASSIC-0001',definitions:copy,getState:()=>({...snapshot}),open});
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
}
})();

}catch(error){queueMicrotask(()=>{throw error});}
;await 0;
;
/* ./sixpack-glareshield-v1.js?v=SIXPACK-ATA24-ANNUNCIATION-0005 */
try{
/* SIXPACK-0004 — independently addressed 737 Classic glareshield annunciators.
   An additive visual/training layer: protected cockpit photos and guard geometry are untouched.
   No automatic FCOM-level failures or electrical authority are inferred by this module. */
(function(){
'use strict';
const ROOT='b737-classic-sixpack', CAPT=['FLT CONT','ELEC','IRS','APU','FUEL','OVHT/DET'];
const FO=['ANTI-ICE','ENG','HYD','OVERHEAD','DOORS','AIR COND'];
const sides={CAPT,FO};
const ids=['MASTER CAUTION','FIRE WARN'];
const manual=new Map(), nodes=new Map(), acknowledged=new Set(), liveReasons=new Map();
let fireWarningActive=false,fireWarningAcknowledged=false;
let visualTest=false, recallHeld=false, mounted=false, recallMaster=false;
let annunciatorPower=null; // null = no authoritative aircraft supply snapshot yet
const recallShown=new Set();
const norm=v=>String(v||'').trim().toUpperCase().replace(/[_\s-]+/g,' ').replace(/\s*\/\s*/g,'/');
const key=(side,name)=>String(side).toUpperCase()+'.'+norm(name);
for(const side of Object.keys(sides))for(const name of [...sides[side],...ids]){
 const k=key(side,name);manual.set(k,false);
 if(!ids.includes(name))liveReasons.set(k,[]);
}
function emit(side,name,on,source){
 window.dispatchEvent(new CustomEvent('b737:sixpack-light-change',{detail:{side,legend:name,id:key(side,name),on:!!on,source,visualOnly:true}}));
}

// The caution state is per fault, never only per six-pack category.
// Two faults in the same category must produce two independent alert edges.
const isSystem=k=>liveReasons.has(k);
const reasons=k=>[...(liveReasons.get(k)||[]),...(manual.get(k)===true?[{id:'MANUAL',mode:'IMMEDIATE'}]:[])];
const token=(k,id)=>k+'|'+id;
const immediate=r=>r.mode!=='RECALL_ONLY';
const pending=k=>reasons(k).some(r=>immediate(r)&&!acknowledged.has(token(k,r.id)));
const anyCaution=()=>[...liveReasons.keys()].some(pending);
const anyImmediate=()=>[...liveReasons.keys()].some(k=>reasons(k).some(immediate));
const isActive=k=>reasons(k).length>0;
// Every output mode (live alert, RECALL, PTT and instructor ALL LIGHTS ON)
// shares the physical CB circuit gate. A test command cannot bypass a pulled
// MASTER CAUTION ANTI-ICE/FUEL lamp CB and cannot erase the underlying faults.
function annunciatorCircuitClosed(k){
 const cb=window.B737UnifiedCB;
 const legend=k.slice(k.indexOf('.')+1);
 const circuit={'AIR COND':'airCond','ANTI ICE':'antiIce','FUEL':'fuel'}[legend];
 if(circuit&&cb?.available('warning.'+circuit)===false)return false;
 if(legend==='MASTER CAUTION'&&(cb?.available('warning.masterCaution')===false||
  cb?.available('warning.masterCautionControl')===false))return false;
 if(legend==='FIRE WARN'&&cb?.available('warning.masterFireControl')===false)return false;
 return true;
}
function effective(k){
 if(!annunciatorCircuitClosed(k))return false;
 if(annunciatorPower===false)return false; // No annunciator light on a dead DC supply.
 if(visualTest)return true; // Visual test affects only powered, CB-protected lamps.
 if(isSystem(k))return recallHeld||recallShown.has(k)||pending(k);
 if(k.endsWith('.MASTER CAUTION'))return manual.get(k)===true||recallMaster||anyCaution();
 return (fireWarningActive&&!fireWarningAcknowledged)||manual.get(k)===true;
}
window.addEventListener('b737:cb-state-change',()=>paint());
function paint(){
 for(const [k,n]of nodes){
  const on=effective(k);n.dataset.on=String(on);
  if(n.tagName==='BUTTON')n.setAttribute('aria-pressed',String(on));
  else n.setAttribute('aria-label',k+(on?' illuminated':' unlit'));
 }
 const counter=document.getElementById('b737SixpackCount');
 if(counter)counter.textContent=[...liveReasons.keys()].filter(effective).length+' / 12';
 document.querySelectorAll('[data-sixpack-checkbox]').forEach(n=>{
  n.checked=manual.get(n.dataset.sixpackCheckbox)===true;n.disabled=visualTest;
 });
}
function refreshAnnunciatorPower(){
 // The existing Electrical V7 ECU owns supply; no shadow electrical model.
 // Hot Battery and Ground Service alone are not Master Caution supplies.
 const bus=window.B737ISNCockpitV1?.getState?.()?.state?.electrical?.bus;
 if(!bus)return;
 const feeds=['dc1','dc2','battery','switchedHotBattery','dcStandby'];
 if(!feeds.every(id=>Object.hasOwn(bus,id)))return;
 const next=feeds.some(id=>bus[id]===true)?true:
  feeds.every(id=>bus[id]===false)?false:null;
 if(next===annunciatorPower)return;
 annunciatorPower=next;paint();
}
function clearRecall(){
 recallShown.clear();recallMaster=false;
}
function acknowledge(source='master-caution-reset'){
 for(const k of liveReasons.keys())for(const r of reasons(k))
  acknowledged.add(token(k,r.id));
 clearRecall();
 for(const side of Object.keys(sides)){
  const k=key(side,'MASTER CAUTION');
  if(manual.get(k)){manual.set(k,false);emit(side,'MASTER CAUTION',false,source);}
 }
 paint();
 window.dispatchEvent(new CustomEvent('b737:sixpack-acknowledge',{
  detail:{source,retainedActiveFaults:getLiveReasons(),visualOnly:false}
 }));
}
function recall(side='CAPT'){
 if(!sides[side])return [];
 clearRecall();
 const existing=[];
 for(const k of liveReasons.keys())if(isActive(k)){
  recallShown.add(k);existing.push(k);
 }
 // A recalled single redundant-channel fault shows its system locator only,
 // while an existing immediate master-caution condition may re-illuminate MC.
 recallMaster=anyImmediate();
 paint();
 window.dispatchEvent(new CustomEvent('b737:sixpack-recall',{
  detail:{side,active:existing,masterCaution:recallMaster,source:'UNIFIED_AND_INSTRUCTOR',visualOnly:false}
 }));
 return existing;
}
function press(side='CAPT'){
 if(!sides[side]||recallHeld)return false;
 recallHeld=true;paint();
 window.dispatchEvent(new CustomEvent('b737:sixpack-lamp-test',{detail:{side,held:true,visualOnly:true}}));
 return true;
}
function release(side='CAPT'){
 if(!recallHeld)return false;
 recallHeld=false;
 window.dispatchEvent(new CustomEvent('b737:sixpack-lamp-test',{detail:{side,held:false,visualOnly:true}}));
 recall(side);return true;
}
function setLight(side,name,on,source='external'){
 const s=String(side).toUpperCase(),n=norm(name),k=key(s,n);
 if(!manual.has(k))return false;
 const next=!!on,prev=manual.get(k);
 manual.set(k,next);
 if(next!==prev){
  acknowledged.delete(token(k,'MANUAL'));
  if(!isActive(k))recallShown.delete(k);
  emit(s,n,next,source);
 }
 paint();return true;
}
function setAll(on,side=null,source='instructor'){
 const filter=side?String(side).toUpperCase():null;
 if(filter&&!sides[filter])return false;
 for(const [k,v]of manual){
  if(filter&&!k.startsWith(filter+'.'))continue;
  if(v!==!!on){
   manual.set(k,!!on);acknowledged.delete(token(k,'MANUAL'));
   if(isSystem(k)&&!isActive(k))recallShown.delete(k);
   const i=k.indexOf('.');emit(k.slice(0,i),k.slice(i+1),!!on,source);
  }
 }
 paint();return true;
}
function getLiveReasons(){
 return Object.fromEntries([...liveReasons].map(([k,arr])=>[k,arr.map(r=>r.id)]));
}
function getLiveConditionDetails(){
 return Object.fromEntries([...liveReasons].map(([k,arr])=>[k,arr.map(r=>({...r}))]));
}
function getCautionDiagnostics(){
 return {activeImmediate:anyImmediate(),pendingMasterCaution:anyCaution(),
  recallMaster,recallOnly:[...liveReasons.keys()].flatMap(k=>reasons(k)
   .filter(r=>!immediate(r)).map(r=>({system:k,id:r.id}))),
  recalled:[...recallShown],acknowledged:[...acknowledged]};
}
function setLiveConditions(incoming,source='UNIFIED'){
 if(!incoming||typeof incoming!=='object'||Array.isArray(incoming))return false;
 const staged=new Map();
 // Validate everything before applying one change: no half-applied snapshots.
 for(const k of liveReasons.keys()){
  if(!Object.hasOwn(incoming,k))continue;
  const values=incoming[k];
  if(!Array.isArray(values))return false;
  const byId=new Map();
  for(const input of values){
   const id=typeof input==='string'?input:input?.id;
   const mode=typeof input==='string'?'IMMEDIATE':input?.mode;
   if(typeof id!=='string'||!id||id.length>120||
      !['IMMEDIATE','RECALL_ONLY'].includes(mode))return false;
   const candidate={id,mode};
   if(!byId.has(id)||mode==='IMMEDIATE')byId.set(id,candidate);
  }
  staged.set(k,[...byId.values()].sort((a,b)=>a.id.localeCompare(b.id)));
 }
 let changed=false;
 for(const [k,next]of staged){
  const before=liveReasons.get(k);
  if(JSON.stringify(next)===JSON.stringify(before))continue;
  const old=new Map(before.map(r=>[r.id,r.mode]));
  const now=new Map(next.map(r=>[r.id,r.mode]));
  for(const r of before)if(!now.has(r.id))acknowledged.delete(token(k,r.id));
  for(const r of next)if(old.get(r.id)!==r.mode)acknowledged.delete(token(k,r.id));
  liveReasons.set(k,next);changed=true;
  if(!isActive(k))recallShown.delete(k);
 }
 if(changed){
  if(!anyImmediate())recallMaster=false;
  paint();
  window.dispatchEvent(new CustomEvent('b737:sixpack-system-update',{
   detail:{source,activeReasons:getLiveReasons(),classified:getLiveConditionDetails(),masterCaution:anyCaution()}
  }));
 }
 return true;
}
function setFireWarning(on,source='UNIFIED_FIRE_WARNING'){
 if(typeof on!=='boolean')return false;
 if(fireWarningActive!==on){
  fireWarningActive=on;fireWarningAcknowledged=false;paint();
  window.dispatchEvent(new CustomEvent('b737:sixpack-fire-update',{detail:{active:on,source}}));
 }
 return true;
}
function acknowledgeFire(source='bell-cutout'){
 fireWarningAcknowledged=true;
 for(const side of Object.keys(sides)){
  const k=key(side,'FIRE WARN');
  if(manual.get(k)){manual.set(k,false);emit(side,'FIRE WARN',false,source);}
 }
 paint();
 window.dispatchEvent(new CustomEvent('b737:sixpack-fire-acknowledge',{detail:{source,warningStillActive:fireWarningActive}}));
}
function setCombination(combination,source='external'){
 if(!combination||typeof combination!=='object')return false;
 let applied=0;
 for(const [side,entries] of Object.entries(combination)){
  if(!sides[side.toUpperCase()]||!entries||typeof entries!=='object')continue;
  for(const [name,on] of Object.entries(entries))if(setLight(side,name,on,source))applied++;
 }
 return applied>0;
}

function makeButton(side,name,kind){
 const master=kind==='master';
 const el=document.createElement(master?'button':'span');
 if(master)el.type='button';
 el.className=master?'b737-sp-master '+(name==='FIRE WARN'?'fire':'caution'):'b737-sp-legend';
 el.dataset.sixpack=key(side,name);el.dataset.on='false';
 if(master){
  el.setAttribute('aria-pressed','false');
  el.setAttribute('aria-label',side+' '+name+' pushbutton');
  el.innerHTML=name==='FIRE WARN'
   ?'<span>FIRE</span><span>WARN</span><small>BELL CUTOUT</small>'
   :'<span>MASTER</span><span>CAUTION</span><small>PUSH TO RESET</small>';
  el.addEventListener('pointerdown',e=>e.stopPropagation());
  el.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();
   if(name==='MASTER CAUTION')acknowledge();
   else acknowledgeFire('fire-warn-bell-cutout');
  });
 }else{
  el.textContent=name;el.setAttribute('role','img');
  el.setAttribute('aria-label',side+' '+name+' unlit');
 }
 nodes.set(key(side,name),el);return el;
}
function makeSeat(side){
 const panel=document.createElement('section');panel.className='b737-sp-console seat-'+side.toLowerCase();
 panel.dataset.sixpackSeat=side;panel.dir='ltr';
 panel.setAttribute('aria-label',side==='CAPT'?'Captain glareshield six-pack':'First Officer glareshield six-pack');
 const top=document.createElement('div');top.className='b737-sp-top';
 const fire=makeButton(side,'FIRE WARN','master'),caution=makeButton(side,'MASTER CAUTION','master');
 // MAP, CLOCK and BRIGHT rotary is deliberately absent.
 if(side==='CAPT')top.append(fire,caution);else top.append(caution,fire);
 const rack=document.createElement('div');rack.className='b737-sp-rack';
 rack.tabIndex=0;rack.setAttribute('role','button');
 rack.setAttribute('aria-label',(side==='CAPT'?'Captain':'First Officer')+' system annunciator: hold to test, release to recall');
 for(const name of sides[side])rack.append(makeButton(side,name,'legend'));
 rack.addEventListener('pointerdown',e=>{
  if(e.pointerType==='mouse'&&e.button!==0)return;
  e.stopPropagation();e.preventDefault();rack.focus({preventScroll:true});
  if(rack.setPointerCapture)rack.setPointerCapture(e.pointerId);press(side);
 });
 rack.addEventListener('pointerup',e=>{e.stopPropagation();release(side);});
 rack.addEventListener('pointercancel',e=>{e.stopPropagation();if(recallHeld){recallHeld=false;paint();}});
 rack.addEventListener('lostpointercapture',()=>{if(recallHeld){recallHeld=false;paint();}});
 rack.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();
  // Keyboard/synthetic click fallback; real pointer clicks already recalled on pointerup.
  if(e.detail===0)recall(side);
 });
 rack.addEventListener('keydown',e=>{if(e.key===' '||e.key==='Enter'){e.preventDefault();e.stopPropagation();if(!e.repeat)press(side);}});
 rack.addEventListener('keyup',e=>{if(e.key===' '||e.key==='Enter'){e.preventDefault();e.stopPropagation();release(side);}});
 rack.addEventListener('blur',()=>{if(recallHeld){recallHeld=false;paint();}});
 panel.append(top,rack);return panel;
}
function addInspector(){
 const inspector=document.getElementById('inspector');
 if(!inspector||document.getElementById('b737SixpackInspector'))return;
 const section=document.createElement('section');section.className='b737-sp-inspector';section.id='b737SixpackInspector';section.dir='ltr';
 const header=document.createElement('h2');header.textContent='Six-Pack · Annunciator Test';
 const count=document.createElement('p');count.innerHTML='Independent lights: <output id="b737SixpackCount">0 / 12</output>';
 section.append(header,count);
 const actions=document.createElement('div');actions.className='b737-sp-actions';
 for(const [label,on,side] of [['ALL ON',true,null],['ALL OFF',false,null],['CAPT ON',true,'CAPT'],['FO ON',true,'FO']]){
  const b=document.createElement('button');b.type='button';b.textContent=label;
  b.addEventListener('click',()=>setAll(on,side));actions.append(b);
 }
 section.append(actions);
 for(const [side,names] of Object.entries(sides)){
  const field=document.createElement('fieldset');const legend=document.createElement('legend');legend.textContent=side==='CAPT'?'CAPTAIN / LEFT':'FIRST OFFICER / RIGHT';field.append(legend);
  const grid=document.createElement('div');grid.className='b737-sp-test-grid';
  for(const name of names){
   const label=document.createElement('label');const input=document.createElement('input');
   input.type='checkbox';input.dataset.sixpackCheckbox=key(side,name);
   input.addEventListener('change',e=>setLight(side,name,e.target.checked,'instructor-panel'));
   label.append(input,document.createTextNode(' '+name));grid.append(label);
  }
  field.append(grid);section.append(field);
 }
 const note=document.createElement('small');note.textContent='Live: categories follow Unified overhead, electrical and fire-protection indications. Instructor checkboxes inject additional simulated conditions. Holding a plate tests 12 lamps; release recalls active conditions. MASTER CAUTION acknowledges; FIRE WARN cuts out its warning indication.';
 section.append(note);inspector.append(section);
}
function mount(){
 if(mounted)return;
 const native=document.querySelector('#region-main .region-native');
 if(!native)return;
 if(document.getElementById(ROOT))return;
 const root=document.createElement('div');root.id=ROOT;root.className='b737-sixpack-glareshield';root.setAttribute('aria-label','Boeing 737 Classic glareshield system annunciators');
 root.append(makeSeat('CAPT'),makeSeat('FO'));native.append(root);mounted=true;addInspector();refreshAnnunciatorPower();paint();
 window.dispatchEvent(new CustomEvent('b737:sixpack-ready',{detail:{version:'SIXPACK-0004',independentLamps:12,masters:4}}));
}
window.B737SixPack=Object.freeze({
 version:'SIXPACK-0003',
 mount,
 getState:()=>Object.fromEntries(manual),
 getEffectiveState:()=>Object.fromEntries([...manual.keys()].map(k=>[k,effective(k)])),
 getLiveReasons,getLiveConditionDetails,getCautionDiagnostics,getSupply:()=>annunciatorPower,
 setLight,setAll,setCombination,setLiveConditions,setFireWarning,acknowledgeFire,acknowledge,recall,press,release,
 reset:()=>{acknowledged.clear();clearRecall();recallHeld=false;fireWarningAcknowledged=false;return setAll(false,null,'reset');},
 setVisualTest:on=>{visualTest=!!on;paint();},
 getGeometry:()=>({region:'main',width:2100,height:920,left:{x:640,y:3,w:144,h:121},right:{x:1387,y:3,w:144,h:121}})
});
window.addEventListener('b737:cockpit-mounted',mount);
window.addEventListener('b737:visual-test',e=>{visualTest=!!e.detail?.active;paint()});
for(const event of ['b737:electrical-network','b737:electrical-v7-state',
 'b737:unified-ecu-observation','b737:electrical-owner-ready',
 'b737:bus-failure-injection-changed'])
 window.addEventListener(event,refreshAnnunciatorPower);
window.addEventListener('b737:sixpack-command',e=>{
 const d=e.detail||{};
 if(d.combination)setCombination(d.combination,'event');
 else if(d.side&&d.legend!==undefined)setLight(d.side,d.legend,d.on,'event');
 else if(typeof d.all==='boolean')setAll(d.all,d.side||null,'event');
});
document.addEventListener('DOMContentLoaded',mount);
if(document.readyState!=='loading')mount();
})();
}catch(error){queueMicrotask(()=>{throw error});}
;await 0;
;
/* ../../engine/systems/classic-redundancy-caution-v1.js?v=REDUNDANCY-CAUTION-0001 */
try{
/* REDUNDANCY-CAUTION-0001: B737 Classic 300/400/500 training alert classifier.
 * FCOM V2 9.10.2-3 / 9.10.5-6: single FCC or auto-slat computer
 * failure is recall-only; loss of both channels is an immediate failure.
 * Independent of flight-control/IRS/electrical authority. TRAINER ONLY.
 */
(function(root,factory){
 'use strict';
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.B737ClassicRedundancyCautionV1=api;
})(typeof globalThis!=='undefined'?globalThis:null,function(){
 'use strict';
 const CHANNELS=Object.freeze({
  SPEED_TRIM:Object.freeze({A:'FCC_A',B:'FCC_B',locator:'CAPT.FLT CONT',individualLamp:'speed-trim'}),
  MACH_TRIM:Object.freeze({A:'FCC_A',B:'FCC_B',locator:'CAPT.FLT CONT',individualLamp:'mach-trim'}),
  AUTO_SLAT:Object.freeze({A:'AUTOSLAT_A',B:'AUTOSLAT_B',locator:'CAPT.FLT CONT',individualLamp:'auto-slat'})
 });
 const KEYS=Object.freeze(Object.keys(CHANNELS));
 const initial=()=>Object.fromEntries(KEYS.map(id=>[id,{A:false,B:false}]));
 const validId=id=>Object.hasOwn(CHANNELS,id);
 const copy=s=>Object.fromEntries(KEYS.map(id=>[id,{A:s[id].A,B:s[id].B}]));
 function evaluate(channels){
  if(!channels||KEYS.some(id=>typeof channels[id]?.A!=='boolean'||typeof channels[id]?.B!=='boolean'))
   throw Error('Complete Boolean channel pairs required');
  const reasons={},indicators={};
  for(const id of KEYS){
   const failed=Object.keys(channels[id]).filter(ch=>channels[id][ch]===true);
   const mode=failed.length===0?'NORMAL':failed.length===1?'RECALL_ONLY':'IMMEDIATE';
   const key=CHANNELS[id].locator;
   if(!reasons[key])reasons[key]=[];
   if(failed.length)reasons[key].push({
    id:'REDUNDANCY:'+id+':'+(failed.length===2?'TOTAL':failed[0]),
    mode,
    system:id,
    failedChannels:failed.join('+')
   });
   indicators[CHANNELS[id].individualLamp]={system:id,mode,failedChannels:[...failed],
    illuminatedImmediately:mode==='IMMEDIATE',illuminatedOnRecall:mode!=='NORMAL'};
  }
  return {reasons,indicators,channels:copy(channels),version:'REDUNDANCY-CAUTION-0001'};
 }
 function create(){
  let channels=initial(),revision=0;
  function snapshot(){return {...evaluate(channels),revision};}
  function setChannel(system,channel,failed){
   if(!validId(system)||!['A','B'].includes(channel)||typeof failed!=='boolean')return false;
   if(channels[system][channel]!==failed){
    channels[system][channel]=failed;revision++;
   }
   return snapshot();
  }
  function setSystem(system,pair){
   if(!validId(system)||!pair||typeof pair.A!=='boolean'||typeof pair.B!=='boolean')return false;
   if(channels[system].A!==pair.A||channels[system].B!==pair.B){
    channels[system]={A:pair.A,B:pair.B};revision++;
   }
   return snapshot();
  }
  function reset(){channels=initial();revision++;return snapshot();}
  return Object.freeze({snapshot,setChannel,setSystem,reset});
 }
 return Object.freeze({CHANNELS,KEYS,initial,evaluate,create});
});

}catch(error){queueMicrotask(()=>{throw error});}
;await 0;
;
/* ./sixpack-live-integration-v1.js?v=SIXPACK-FCOM15-0008&amp;p8=ATA26-0003 */
try{
/* SIXPACK-LIVE-0008 FCOM 15.20: read-only adapter from existing Unified system outputs.
 * Never creates a second electrical/overhead/fire engine or infers unobserved alarms.
 * Training approximation: uses verified illuminated category-related OH annunciators.
 */
(function(root,factory){
 'use strict';
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root&&root.document)api.install(root);
})(typeof window!=='undefined'?window:null,function(){
 'use strict';
 const groups=Object.freeze({
  'CAPT.FLT CONT':['flight-pressure-a','flight-pressure-b','stby-pressure','stby-quantity','stby-rudder','feel-diff','speed-trim','mach-trim','auto-slat','yaw-damper'],
  // FCOM 15.20.3 ELEC: IDG/drive oil warnings, STANDBY POWER OFF,
   // TRANSFER BUS OFF and BUS OFF. Blue GEN OFF BUS is advisory.
   'CAPT.ELEC':['drive-1-drive-pressure','drive-2-drive-pressure',
    'drive-1-drive-temperature','drive-2-drive-temperature',
    'standby-power-off','transferBusOff1','transferBusOff2','busOff1','busOff2'],
  'CAPT.IRS':['irs-l-fault','irs-r-fault','irs-l-dc-fail','irs-r-dc-fail'],
  'CAPT.APU':['apu-low-pressure','apu-high-oil-temp','apu-overspeed','apu-low-oil-quantity'],
  'CAPT.FUEL':['filter-1','filter-2','fuel-center-l','fuel-center-r','fuel-1-aft','fuel-1-fwd','fuel-2-fwd','fuel-2-aft'],
  'CAPT.OVHT/DET':[],
  'FO.ANTI ICE':['window-l-side-overheat','window-l-fwd-overheat','window-r-fwd-overheat','window-r-side-overheat','cowl-anti-ice-1','cowl-anti-ice-2','probe-capt-ps','probe-fo-static','probe-l-elev','probe-l-alpha','probe-fo-ps','probe-capt-static','probe-r-elev','probe-r-alpha'],
  // FCOM 15.20.3 ENG = REVERSER, PMC INOP and LOW IDLE.
   'FO.ENG':['reverser-1','reverser-2','pmc-inop-1','pmc-inop-2','low-idle'],
  'FO.HYD':['hyd-eng-1','hyd-eng-2','hyd-elec-1','hyd-elec-2','hyd-elec-1-overheat','hyd-elec-2-overheat'],
  'FO.OVERHEAD':['equip-supply-off','equip-exhaust-off','flight-recorder-off','emergency-not-armed','pass-oxygen'],
  'FO.DOORS':['door-fwd-entry','door-aft-entry','door-fwd-service','door-aft-service','door-fwd-cargo','door-aft-cargo','door-air-stair','door-equip'],
  // FCOM 15.20.4: amber DUAL BLEED is an AIR COND master caution.
   'FO.AIR COND':['duct-overheat-l','duct-overheat-r','dual-bleed','pack-trip-l','pack-trip-r','wing-body-overheat-l','wing-body-overheat-r','bleed-trip-l','bleed-trip-r','press-auto-fail','press-off-sched-descent']
 });
 const empty=()=>Object.fromEntries(Object.keys(groups).map(k=>[k,[]]));
 const validOn=v=>v==='ON'||v==='FLASH';
 function overhead(packet){
  if(!packet||typeof packet!=='object'||!packet.frames||packet.lampTest===true)return null;
  const result=empty();
  if(packet.power!==true)return result;
  for(const [name,ids]of Object.entries(groups))result[name]=ids.filter(id=>validOn(packet.frames[id])).map(id=>'OH:'+id);
  // FCOM 12.10.3: one main tank LOW PRESSURE is recall-only,
  // both FWD and AFT LOW PRESSURE on the same tank prompt master caution.
  // Center-tank caution depends on aircraft modifications: keep separate.
  for(const pair of [['fuel-1-fwd','fuel-1-aft'],['fuel-2-fwd','fuel-2-aft']]){
   const affected=pair.filter(id=>validOn(packet.frames[id]));
   if(affected.length===1){
    const id='OH:'+affected[0],idx=result['CAPT.FUEL'].indexOf(id);
    if(idx>=0)result['CAPT.FUEL'][idx]={id,mode:'RECALL_ONLY'};
   }
  }
  return result;
 }
 // FCOM 15.20.3: only observed amber system annunciators trigger ELEC.
 // Internal ECU faults (GEN FAILED, relay failed, etc.) are not independent
 // system-annunciator evidence. Blue GEN OFF BUS is informational, not caution.
 // Map only positive actual V7 annunciator lamp evidence; overhead merge
 // deduplicates identical OH:<id> reason tokens from the physical lens.
 const electricalAnnunciators=Object.freeze({
  standbyPowerOff:'standby-power-off',
  transferBusOff1:'transferBusOff1',transferBusOff2:'transferBusOff2',
  busOff1:'busOff1',busOff2:'busOff2'
 });
 function electrical(packet){
  const result=empty(),lamps=packet?.evaluated?.lamps??packet?.lamps;
  if(!lamps||typeof lamps!=='object')return result;
  for(const [id,overheadId] of Object.entries(electricalAnnunciators))
   if(lamps[id]===true)result['CAPT.ELEC'].push('OH:'+overheadId);
  return result;
 }
 function fire(packet){
  const out=empty(), lamps=packet?.indications||packet;
  if(!lamps||typeof lamps!=='object')return out;
  for(const id of ['ENG1_OVERHEAT','ENG2_OVERHEAT','APU_DET_INOP'])
   if(lamps[id]===true)out['CAPT.OVHT/DET'].push('FIRE:'+id);
  if(lamps.FAULT&&lamps.OVHT_DET===true)out['CAPT.OVHT/DET'].push('FIRE:FAULT');
  return out;
 }

 function irs(packet){
  if(!packet?.units||!['L','R'].every(side=>packet.units[side]))return null;
  const out=empty();
  for(const side of ['L','R']){
   const u=packet.units[side];if(u.powered!==true)continue;
   if(u.faultLamp===true)out['CAPT.IRS'].push('IRS:'+side+':FAULT');
   // FCOM 11.10.18-20: flashing ALIGN is a white alignment-status
   // indication, not an amber IRS system caution. Momentary ON DC
   // during SELFTEST is normal, and does not generate MASTER CAUTION.
   // A sustained ON DC or DC FAIL from an actual powered IRS can
   // trigger IRS, once those authoritative lamp bits are provided.
   if(u.onDcLamp===true&&u.phase!=='SELFTEST')
    out['CAPT.IRS'].push('IRS:'+side+':ON_DC');
   if(u.dcFailLamp===true)
    out['CAPT.IRS'].push('IRS:'+side+':DC_FAIL');
  }
  return out;
 }
 function windowHeat(packet){
  if(packet?.schema!=='B737_WINDOW_HEAT_V1_RESULT'||!packet.channels)return null;
  const out=empty();
  for(const [id,c]of Object.entries(packet.channels))
   if(c?.overheatOn===true&&c.indicationPowered===true)out['FO.ANTI ICE'].push('WH:'+id+':OVERHEAT');
  return out;
 }
 function tatProbe(packet){
  if(!packet||typeof packet!=='object'||!packet.faults||typeof packet.amberOn!=='boolean')return null;
  const out=empty();
  // TEMP PROBE amber with no requested heater is a normal ground indication.
  if(packet.lampPower===true&&packet.heaterRequested===true&&packet.amberOn===true)
   out['FO.ANTI ICE'].push('TAT:HEAT_DEMAND_UNSATISFIED');
  return out;
 }

 // ECU oil-light evidence is used only with a powered live Overhead. The
 // physical OH lamp remains the fallback until ECU telemetry becomes ready.
 // TAT TEMP PROBE is intentionally excluded from generic probe mapping:
 // its separate live adapter prevents normal ground indications becoming faults.
 function apuECU(packet){
  const a=packet?.apu;
  if(!a||typeof a.phase!=='string'||typeof a.oil?.lowPressureLamp!=='boolean')return null;
  const out=empty();
  if(a.phase!=='OFF'&&a.oil.lowPressureLamp===true)
   out['CAPT.APU'].push('ECU:APU:LOW_OIL_PRESSURE');
  return out;
 }
 function pressurization(packet){
  if(!['CPCS','DCPCS'].includes(packet?.system)||!packet.lamps)return null;
  const out=empty();
  if(packet.lamps.autoFail===true)out['FO.AIR COND'].push('PRESS:'+packet.system+':AUTO_FAIL');
  if(packet.lamps.offSchedDescent===true)out['FO.AIR COND'].push('PRESS:'+packet.system+':OFF_SCHED_DESCENT');
  return out;
 }
 function airconZones(packet){
  if(!packet||!['B737-300-500','B737-400'].includes(packet.family)||!packet.zoneFaults)return null;
  const out=empty();
  if(packet.family==='B737-400')for(const id of ['cont-cab','fwd-cab','aft-cab']){
   if(packet.zoneFaults[id]===true)out['FO.AIR COND'].push('AIRCON400:'+id+':ZONE_FAULT');
  }
  return out;
 }
 function airconFcomRecall(packet){
  const out=empty();
  if(packet?.family!=='B737-400')return out;
  for(const side of ['L','R'])if(packet.pack400?.[side]?.recallOnly)
   out['FO.AIR COND'].push({id:'AIRCON400:PACK:'+side+':SINGLE_CONTROLLER',mode:'RECALL_ONLY'});
  for(const zone of ['CONT','FWD','AFT'])if(packet.zones?.[zone]?.recallOnly)
   out['FO.AIR COND'].push({id:'AIRCON400:ZONE:'+zone+':CONTROLLER',mode:'RECALL_ONLY'});
  return out;
 }
 function merge(sourceStates){
  const out=empty();
  for(const [source,snapshot] of Object.entries(sourceStates||{})){
   if(!snapshot)continue;
   for(const k of Object.keys(out)){
    const arr=snapshot[k];
    if(Array.isArray(arr))for(const item of arr){
     const id=typeof item==='string'?item:item?.id;
     if(typeof id!=='string'||!id||id.length>120)continue;
     const mode=typeof item==='string'?'IMMEDIATE':item.mode;
     if(!['IMMEDIATE','RECALL_ONLY'].includes(mode))continue;
     const old=out[k].findIndex(x=>(typeof x==='string'?x:x.id)===id);
     if(old<0)out[k].push(typeof item==='string'?item:{id,mode});
     else if(mode==='IMMEDIATE'&&typeof out[k][old]!=='string')out[k][old]={id,mode};
    }
   }
  }
  return out;
 }
 function install(win){
  const sources={overhead:empty(),electrical:empty(),fire:empty(),irs:empty(),windowHeat:empty(),tatProbe:empty(),pressurization:empty(),airconZones:empty(),airconRecall:empty(),apuECU:empty(),redundancy:empty()};
  let overheadPowered=null;
  let last='',updates=0,lastApuObservationSignature=null,activeSource={overhead:false,electrical:false,fire:false,irs:false,windowHeat:false,tatProbe:false,pressurization:false,airconZones:false,airconRecall:false,apuECU:false,redundancy:false};
  function resolved(){
   const filtered=empty();
   for(const [k,v]of Object.entries(sources.overhead))filtered[k]=[...v];
   if(activeSource.irs)filtered['CAPT.IRS']=[];
   if(activeSource.apuECU)filtered['CAPT.APU']=filtered['CAPT.APU'].filter(id=>id!=='OH:apu-low-pressure');
   if(activeSource.windowHeat)filtered['FO.ANTI ICE']=filtered['FO.ANTI ICE'].filter(id=>!id.startsWith('OH:window-'));
   if(activeSource.pressurization)filtered['FO.AIR COND']=filtered['FO.AIR COND']
    .filter(id=>!['OH:press-auto-fail','OH:press-off-sched-descent'].includes(id));
   const inputs={...sources,overhead:filtered};
   if(overheadPowered!==true)inputs.apuECU=empty(); // never energize MC from an unpowered/unknown APU lamp
   return merge(inputs);
  }
  // The new classifier models only the FCOM-supported FCC and auto-slat pairs.
  // It never mutates aircraft systems and listens to explicit channel evidence.
  const redundancy=win.B737ClassicRedundancyCautionV1?.create?.()||null;
  const fireWarningInputs={wheelWell:false,external:false};
  function publishPhysical(){
   if(!redundancy)return;
   const state=redundancy.snapshot();
   const recalled=win.B737SixPack?.getCautionDiagnostics?.().recalled?.includes('CAPT.FLT CONT')===true;
   const indicators=Object.fromEntries(Object.entries(state.indicators).map(([id,v])=>[
    id,{on:v.mode==='IMMEDIATE'||v.mode==='RECALL_ONLY'&&recalled,mode:v.mode}
   ]));
   const frame=win.document.getElementById('overheadFrame');
   if(frame?.contentWindow&&win.location?.origin)
    frame.contentWindow.postMessage?.({type:'b737:cockpit-command',action:'redundancy-physical-lamps',indicators},win.location.origin);
   win.dispatchEvent(new win.CustomEvent('b737:redundancy-indicator-state',{
    detail:{schema:'REDUNDANCY-CAUTION-0001',indicators,recalled,channels:state.channels}
   }));
  }
  function setChannelFailure(system,channel,failed){
   if(!redundancy)return false;
   const snapshot=redundancy.setChannel(system,channel,failed);
   if(!snapshot)return false;
   update('redundancy',snapshot.reasons);
   publishPhysical();updateRedundancyControls();
   return snapshot;
  }
  function setSystemFailures(system,channels){
   if(!redundancy)return false;
   const snapshot=redundancy.setSystem(system,channels);
   if(!snapshot)return false;
   update('redundancy',snapshot.reasons);
   publishPhysical();updateRedundancyControls();
   return snapshot;
  }
  function updateRedundancyControls(){
   if(!redundancy)return;
   const state=redundancy.snapshot();
   const box=win.document.getElementById('b737RedundancyPanel');
   if(!box)return;
   for(const n of box.querySelectorAll('input[data-redundancy-system]')){
    n.checked=state.channels[n.dataset.redundancySystem]?.[n.dataset.redundancyChannel]===true;
   }
  }
  function mountRedundancyControls(){
   if(!redundancy)return;
   const inspector=win.document.getElementById('b737SixpackInspector');
   if(!inspector||win.document.getElementById('b737RedundancyPanel'))return;
   const section=win.document.createElement('section');
   section.id='b737RedundancyPanel';section.dir='ltr';
   section.style.cssText='padding:10px;margin-top:9px;border:1px solid #55616a;border-radius:7px;background:#151f27';
   const h=win.document.createElement('h3');h.textContent='Dual-channel failure · FCOM 9.10';
   h.style.cssText='margin:0 0 7px;font-size:13px';section.append(h);
   const info=win.document.createElement('small');
   info.textContent='Single failure: Recall-only. Both failed: Master Caution + FLT CONT. Training injection; no physical FCC/SMYD fault is assumed.';
   info.style.cssText='display:block;color:#b4c6d1;margin-bottom:8px';section.append(info);
   for(const sys of win.B737ClassicRedundancyCautionV1.KEYS){
    const row=win.document.createElement('div');row.style.cssText='display:flex;align-items:center;gap:9px;margin:6px 0;flex-wrap:wrap';
    const title=win.document.createElement('strong');title.style.cssText='min-width:96px;font-size:11px';title.textContent=sys.replaceAll('_',' ');row.append(title);
    for(const ch of ['A','B']){
     const label=win.document.createElement('label');label.style.cssText='font-size:11px';
     const input=win.document.createElement('input');input.type='checkbox';
     input.dataset.redundancySystem=sys;input.dataset.redundancyChannel=ch;
     input.addEventListener('change',()=>setChannelFailure(sys,ch,!!input.checked));
     label.append(input,win.document.createTextNode(' '+ch));row.append(label);
    }
    section.append(row);
   }
   inspector.append(section);updateRedundancyControls();
  }
  function fireWarningFrom(source,active){
   if(typeof active!=='boolean')return;
   if(source==='wheelWell'&&win.B737UnifiedFireLights?.evaluate?.()?.indications.WHEEL_WELL)
    active=false;
   fireWarningInputs[source]=active;
   win.B737SixPack?.setFireWarning?.(Object.values(fireWarningInputs).some(Boolean),'UNIFIED_FIRE_WARNING');
  }
  function publish(){
   const combined=resolved(),signature=JSON.stringify(combined);
   if(signature===last)return;
   last=signature;updates++;
   win.B737SixPack?.setLiveConditions?.(combined,'UNIFIED_SYSTEMS');
   win.dispatchEvent(new win.CustomEvent('b737:sixpack-live-status',{
    detail:{version:'SIXPACK-LIVE-0008-FCOM15',updates,sources:{...activeSource},active:Object.fromEntries(Object.entries(combined).map(([k,v])=>[k,v.length]))}
   }));
  }
  function update(kind,data){
   if(!Object.hasOwn(sources,kind)||!data)return;
   sources[kind]=data;activeSource[kind]=true;publish();
  }
  // Only the actual embedded OH iframe is an allowed source. Ignore test-lab iframes.
  win.addEventListener('message',e=>{
   if(e.origin!==win.location.origin||e.source!==win.document.getElementById('overheadFrame')?.contentWindow)return;
   const d=e.data;
   if(d?.type!=='b737:cockpit-overhead')return;
   if(d.kind==='state'){
   if(d.lampTest!==true&&d.frames&&typeof d.power==='boolean')overheadPowered=d.power;
   update('overhead',overhead(d));
  }
   if(d.kind==='pressurization-live-output')update('pressurization',pressurization(d));
   if(d.kind==='aircon400-zone-status')update('airconZones',airconZones(d));
  });
  win.addEventListener('b737:unified-ecu-observation',e=>{
   const profiler=win.B737InteractionProfilerV1,started=profiler?performance.now():0;
   try{
    const next=apuECU(e.detail);
    if(!next)return;
    // The Six-Pack needs APU caution transitions, not 10 identical
    // snapshots per second. APU oil pressure, phase and lamp events still
    // publish immediately whenever their effective caution changes.
    const signature=JSON.stringify(next);
    if(signature===lastApuObservationSignature)return;
    lastApuObservationSignature=signature;
    update('apuECU',next);
   }finally{
    if(profiler)profiler.markWork('ECU listener SixPack APU caution',performance.now()-started);
   }
  });
  // Clear retired controller/zone snapshots when switching 300/500 <-> 400 or CPCS <-> DCPCS.
  // Fresh OH live outputs will repopulate them without preserving stale cautions.
  win.addEventListener('b737:aircraft-profile-change',()=>{
   sources.airconZones=empty();activeSource.airconZones=false;
   sources.airconRecall=empty();activeSource.airconRecall=false;
   sources.pressurization=empty();activeSource.pressurization=false;
   publish();
  });
  win.addEventListener('b737:aircon-fcom-status',e=>update('airconRecall',airconFcomRecall(e.detail)));
  // The bus-injection event carries only a source tag, not fault bits.
  // Read the actual recomputed ISN snapshot, preserving existing cautions.
  function refreshElectrical(fallback=null){
   const owner=win.B737ISNCockpitV1;
   const state=owner?.getElectricalState?.()||fallback?.state||fallback;
   const evaluated=owner?.getState?.()?.state?.electrical||fallback?.evaluated;
   if(!state?.faults)return false;
   update('electrical',electrical({state,evaluated}));
   return true;
  }
  win.addEventListener('b737:electrical-v7-state',e=>refreshElectrical(e.detail));
  win.addEventListener('b737:bus-failure-injection-changed',()=>refreshElectrical());
  win.addEventListener('b737:redundancy-channel-state',e=>{
   const d=e.detail;if(d)setChannelFailure(d.system,d.channel,d.failed);
  });
  for(const event of ['b737:sixpack-recall','b737:sixpack-acknowledge','b737:sixpack-system-update']){
   win.addEventListener(event,publishPhysical);
  }
  const frame=win.document.getElementById('overheadFrame');
  frame?.addEventListener?.('load',publishPhysical);
  win.addEventListener('b737:irs-trainer-state',e=>update('irs',irs(e.detail)));
  win.addEventListener('b737:window-heat-annunciations',()=>update('windowHeat',windowHeat(win.B737WindowHeatUnifiedV1?.getOutput?.())));
  win.addEventListener('b737:tat-probe-output',e=>update('tatProbe',tatProbe(e.detail)));
  win.addEventListener('b737:fire-protection-state',e=>{
   update('fire',fire(e.detail));
   fireWarningFrom('wheelWell',e.detail?.indications?.WHEEL_WELL);
  });
  win.addEventListener('b737:unified-fire-indicators-state',e=>{
   update('fire',fire(e.detail));
   fireWarningFrom('wheelWell',e.detail?.indications?.WHEEL_WELL);
  });
  win.addEventListener('b737:unified-fire-lamps-mounted',()=>{
   const lights=win.B737UnifiedFireLights?.systemIndications?.();
   if(lights){update('fire',fire(lights));fireWarningFrom('wheelWell',lights.WHEEL_WELL);}
  });
  // Live FIRE WARN is accepted only from an explicit warning signal, not
  // from the engine OVERHEAT lens, APU bottle indicators, or generic faults.
  win.addEventListener('b737:fire-warning-state',e=>{
   fireWarningFrom('external',e.detail?.active);
  });
  win.B737SixPackLiveV1=Object.freeze({
   version:'SIXPACK-LIVE-0008-FCOM15',deriveOverhead:overhead,deriveElectrical:electrical,deriveFire:fire,
    deriveIRS:irs,deriveWindowHeat:windowHeat,deriveTAT:tatProbe,
    derivePressurization:pressurization,deriveAircon400:airconZones,deriveAPUECU:apuECU,
    setChannelFailure,setSystemFailures,
    getRedundancyState:()=>redundancy?.snapshot?.()||null,
   snapshot:()=>({sources:{...activeSource},reasons:resolved(),overheadPowered,updates}),
   refresh:()=>{
    if(!refreshElectrical()){
     const power=win.B737UnifiedElectricalLive?.snapshot?.();
     if(power?.faults)update('electrical',electrical(power));
    }
    const i=win.B737IRSTrainerUnified?.getState?.();if(i?.units)update('irs',irs(i));
    const w=win.B737WindowHeatUnifiedV1?.getOutput?.();if(w?.channels)update('windowHeat',windowHeat(w));
    const t=win.B737TATProbeUnifiedV1?.getOutput?.();if(t?.faults)update('tatProbe',tatProbe(t));
    const f=win.B737UnifiedFireLights?.systemIndications?.()||win.B737UnifiedFireLights?.indications?.();
    if(f){update('fire',fire(f));fireWarningFrom('wheelWell',f.WHEEL_WELL);}
    const apu=win.B737ISNCockpitV1?.getECUState?.();
    if(apu?.apu)update('apuECU',apuECU(apu));
    publish();
   }
  });
  win.addEventListener('b737:sixpack-ready',()=>{last='';publish();publishPhysical();mountRedundancyControls();});
  if(redundancy)update('redundancy',redundancy.snapshot().reasons);
  if(win.document.readyState!=='loading')mountRedundancyControls();
  else win.document.addEventListener?.('DOMContentLoaded',mountRedundancyControls);
  win.B737SixPackLiveV1.refresh();
  publishPhysical();
  return win.B737SixPackLiveV1;
 }
 return Object.freeze({groups,empty,overhead,electrical,fire,irs,windowHeat,tatProbe,apuECU,pressurization,airconZones,merge,install});
});

}catch(error){queueMicrotask(()=>{throw error});}
;await 0;
;
/* ./overhead-test-labs-gesture-v1.js?v=OH-LABS-0001 */
try{
/* OVERHEAD-LAB-GESTURE-0001
 * Physical invariant: three intentional short taps, at the same non-control
 * point, in the same dedicated overhead panel. Never use click/dblclick counts:
 * native switch movement, button activation, zoom and drag are not lab gestures.
 * Owner18, IRS and atlas artwork remain completely untouched.
 */
(function(root,factory){
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.B737OverheadLabGestureV1=api;
})(typeof globalThis==='undefined'?null:globalThis,function(){
 'use strict';
 const GAP_MS=650,DOWN_MS=420,RADIUS_PX=12;
 const INTERACTIVE_SELECTOR=[
  'button','input','select','textarea','a','label',
  '[role="button"]','[role="slider"]','[role="switch"]','[role="checkbox"]',
  '[contenteditable="true"]','[data-control]','[data-light]','[data-rotary]',
  '[data-switch]','[data-action]','[data-knob]','[data-recessed]',
  '.mounted-toggle','.mounted-rotary','.mounted-light',
  '.owner18-guard-control','.owner18-guard','.guarded-switch',
  '.mounted-guard','.rotary-hitzone','.toggle-sprite',
  '.recessed-switch','.recessed-button','.le-device-control',
  '.le-devices-control','.press-oh22-control','.oh21-overlay-control'
 ].join(',');
 function isInteractive(node){
  if(!node)return false;
  if(typeof node.closest==='function'){
   try{return !!node.closest(INTERACTIVE_SELECTOR);}catch(_){return true;}
  }
  return !!node.isContentEditable;
 }
 const blank=()=>({count:0,region:null,x:null,y:null,lastAt:0,fire:false});
 function advance(previous,tap){
  const old=previous||blank();
  if(!tap||tap.valid!==true||!tap.region||!Number.isFinite(tap.x)||!Number.isFinite(tap.y)||!Number.isFinite(tap.at))return blank();
  const same=old.count>0&&old.region===tap.region&&tap.at>=old.lastAt&&tap.at-old.lastAt<=GAP_MS&&
   Math.hypot(tap.x-old.x,tap.y-old.y)<=RADIUS_PX;
  const count=same?old.count+1:1;
  return count===3?{...blank(),fire:true,region:tap.region}:{
   count,region:tap.region,x:tap.x,y:tap.y,lastAt:tap.at,fire:false
  };
 }
 function shortStationary(down,up){
  return !!down&&!!up&&down.id===up.id&&up.at>=down.at&&up.at-down.at<=DOWN_MS&&
   Math.hypot(up.x-down.x,up.y-down.y)<=RADIUS_PX&&down.region===up.region&&
   down.valid===true&&up.valid===true;
 }
 return Object.freeze({GAP_MS,DOWN_MS,RADIUS_PX,INTERACTIVE_SELECTOR,isInteractive,blank,advance,shortStationary});
});

}catch(error){queueMicrotask(()=>{throw error});}
;await 0;
;
/* ./overhead-cross-cockpit-v1.js?v=CROSS-COCKPIT-0001 */
try{
/* CROSS-COCKPIT-LABS-0001
 * A system may have physical indicators in several cockpit zones.
 * Display original asset crops + real read-only signals within the SAME system lab.
 * No guessed numeric values, no duplicate physical lamps, no source changes.
 */
(function(root,factory){
 'use strict';
 const api=factory(root);
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root?.document)root.B737CrossCockpitIndicatorsV1=api;
})(typeof window!=='undefined'?window:null,function(win){
 'use strict';
 const STATUS='B737_CROSS_COCKPIT_INDICATORS_V1';
 let catalogPromise=null,host=null,panel=null,seq=0,interval=null,items=[];
 const by=(v,k)=>v&&typeof v==='object'&&Object.prototype.hasOwnProperty.call(v,k)?v[k]:undefined;
 const exact=(object,path)=>{
  if(!path||!/^[a-zA-Z0-9_.]+$/.test(path))return undefined;
  return path.split('.').reduce((value,key)=>by(value,key),object);
 };
 function readIndicator(def,sources={}){
  if(!def)return {status:'NO_SOURCE',text:'—'};
  if(def.kind==='sixpack'){
   const value=by(sources.sixpack?.getEffectiveState?.(),def.id);
   return typeof value==='boolean'
    ?{status:'LIVE_MAIN_READ_ONLY',text:value?'ILLUMINATED':'OFF',on:value}
    :{status:'UNAVAILABLE',text:'NOT CONNECTED'};
  }
  if(def.kind==='overhead_lamps'){
   const lampState=sources.overhead?.B737OverheadLights?.getState?.();
   if(!lampState?.frames)return {status:'UNAVAILABLE',text:'LAMP SOURCE NOT READY',lamps:[]};
   const lights=def.lamps.map(id=>({id,frame:by(lampState.frames,id)??'UNKNOWN'}));
   return {status:'LIVE_ISOLATED_OVERHEAD',text:lights.filter(x=>x.frame!=='OFF'&&x.frame!=='UNKNOWN').length+
    ' / '+lights.length+' annunciations active',lamps:lights};
  }
  if(def.kind==='gauge'){
   if(def.source?.provider!=='ecu'||!def.source.path)return {status:'NO_VERIFIED_SIGNAL',text:'—'};
   const ecu=sources.ecu?.getECUState?.();
   const val=exact(ecu,def.source.path);
   // Follow the Stage8 contract: a numeric value without declared simulator
   // provenance is NOT a valid instrument observation.
   if(ecu?.quality!=='TRAINING_SIMULATION_ONLY'||typeof val!=='number'||!Number.isFinite(val))
    return {status:'UNAVAILABLE_SOURCE',text:'—'};
   return {status:'TRAINING_SIMULATION_ONLY',text:val.toFixed(0)+' '+(def.source.unit||'')};
  }
  return {status:'NO_SOURCE',text:'—'};
 }
 function obtainSources(){
  let overhead;
  try{overhead=win.document.getElementById('ohLabStage')?.contentWindow||win.document.getElementById('anti-live-stage')?.contentWindow;}catch(_){}
  return {overhead:overhead||null,sixpack:win.B737SixPack,ecu:win.B737ISNCockpitV1};
 }
 function load(){
  if(!catalogPromise)catalogPromise=fetch('./cross-cockpit-indicators-v1.json',{cache:'no-store'}).then(r=>{
   if(!r.ok)throw Error('Cross-cockpit catalog unavailable '+r.status);
   return r.json();
  }).then(d=>{
   if(d?.schema!==STATUS||!d.panels||typeof d.panels!=='object')throw Error('Cross-cockpit catalog rejected');
   return d;
  });
  return catalogPromise;
 }
 function node(tag,cls,text){
  const el=win.document.createElement(tag);
  if(cls)el.className=cls;if(text!==undefined)el.textContent=text;
  return el;
 }
 function photoCrop(def){
  const photo=def.photo,card=node('div','oh-cross-source');
  if(!photo?.url)return card;
  const p=def.geometry?.pivot;
  // An unapproved native-pixel approximate pivot may be used ONLY to select
  // a generous visual crop. It is never a needle rotation center.
  const size=p?200:null;
  const box=size?{
   x:Math.max(0,Math.min(photo.width-size,p.x-size/2)),
   y:Math.max(0,Math.min(photo.height-size,p.y-size/2)),
   w:Math.min(size,photo.width),h:Math.min(size,photo.height)
  }:{x:0,y:0,w:photo.width,h:photo.height};
  const scale=Math.min(1,220/box.w,180/box.h);
  card.style.width=(box.w*scale)+'px';
  card.style.height=(box.h*scale)+'px';
  const pic=node('div','oh-cross-native-photo');
  Object.assign(pic.style,{
   backgroundImage:'url("'+new URL(photo.url,win.document.baseURI).href+'")',
   backgroundRepeat:'no-repeat',backgroundSize:(photo.width*scale)+'px '+(photo.height*scale)+'px',
   backgroundPosition:(-box.x*scale)+'px '+(-box.y*scale)+'px'
  });
  card.append(pic);
  card.title='Original '+def.panel+' source image'+(p?' · approximate crop, pivot not approved':'');
  return card;
 }
 function displayCard(def){
  const card=node('article','oh-cross-card');
  const tag=node('div','oh-cross-tag',def.zone+' · '+def.id);
  const title=node('strong','oh-cross-name',def.label);
  const output=node('output','oh-cross-value','—');
  const status=node('small','oh-cross-quality','WAITING FOR ORIGINAL SIGNAL');
  card.append(tag,title);
  if(def.photo)card.append(photoCrop(def));
  if(def.kind==='overhead_lamps')card.append(node('div','oh-cross-lamps'));
  card.append(output,status);
  const note=def.kind==='gauge'?
   (def.geometry?.verified?'SOURCE PHOTO VERIFIED':'Photo crop approximate · gauge needle geometry NOT yet certified'):
   def.kind==='sixpack'?'Existing live glareshield six-pack indication':
   'Same original overhead annunciations shown within this system lab';
  card.append(node('small','oh-cross-note',note));
  return {def,card,output,status};
 }
 function refresh(){
  if(!panel||!items.length)return;
  const source=obtainSources();
  for(const item of items){
   const result=readIndicator(item.def,source);
   item.output.textContent=result.text;
   item.output.dataset.on=result.on?'true':'false';
   item.status.textContent=result.status.replaceAll('_',' ');
   if(result.lamps){
    const lamps=item.card.querySelector('.oh-cross-lamps');
    if(lamps) {
     lamps.replaceChildren();
     for(const l of result.lamps){
      const name=node('span','oh-cross-lamp',l.id.replaceAll('-',' ').toUpperCase()+' · '+l.frame);
      name.dataset.frame=l.frame;
      lamps.append(name);
     }
    }
   }
  }
 }
 function mount(container){
  if(!container)return false;
  if(host?.parentNode!==container){
   host=node('section','oh-cross-indicators');
   host.setAttribute('aria-label','Same-system cockpit-wide indicators');
   container.append(host);
  }
  return true;
 }
 function hide(){
  seq++;panel=null;items=[];
  if(interval!==null){clearInterval(interval);interval=null;}
  if(host){host.replaceChildren();host.hidden=true;}
 }
 async function show(id,container){
  if(!mount(container))return false;
  const ticket=++seq;
  if(interval!==null){clearInterval(interval);interval=null;}
  host.hidden=false;host.replaceChildren(node('p','oh-cross-note','Locating the original indicators across cockpit zones…'));
  try{
   const data=await load();
   if(ticket!==seq)return false;
   const entry=data.panels[id];
   panel=id;host.replaceChildren();
   if(!entry?.displays?.length){
    host.hidden=true;return true;
   }
   host.append(node('h3','oh-cross-heading','SYSTEM-WIDE INDICATIONS · ALL COCKPIT LOCATIONS'));
   host.append(node('p','oh-cross-note','Original overhead + main + engine instruments are grouped by system, not by panel. Main/engine values are read-only from the installed cockpit; lab injections are isolated until the corresponding ECU fault bridge is validated.'));
   const grid=node('div','oh-cross-grid');
   items=entry.displays.map(displayCard);
   for(const item of items)grid.append(item.card);
   host.append(grid);
   refresh();interval=setInterval(refresh,500);
   return true;
  }catch(err){
   if(ticket!==seq)return false;
   host.replaceChildren(node('p','oh-cross-error','Cross-cockpit indicators unavailable: '+err.message));
   return false;
  }
 }
 return Object.freeze({load,mount,show,hide,readIndicator,exact,refresh,getCurrent:()=>panel});
});

}catch(error){queueMicrotask(()=>{throw error});}
;await 0;
;
/* ../../engine/systems/hydraulic-test-lab-core-v1.js?v=HYD-LAB-CORE-0001&amp;p8=ATA26-0003 */
try{
/* HYD-LAB-CORE-0001
 * B737 Classic 300/400/500 trainer / ATA 29.
 * Pure deterministic hydraulic simulation: independently testable, no DOM and
 * no dependency on full cockpit. NOT APPROVED FOR FLIGHT/MAINTENANCE.
 *
 * Source backed architecture: A=ENG1+ELEC2, B=ELEC1+ENG2,
 * normal 3000 psi, 2800 psi dispatch check, 3500 psi maximum,
 * reservoir quantities displayed in %, brake accumulator charged by B.
 * Transients, leakage rates, switch failures, thresholds and heat-up rates
 * are EXPLICIT TRAINING APPROXIMATIONS, not certified aircraft dynamics.
 */
(function(root,factory){'use strict';
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.B737ClassicHydraulicLabCoreV1=api;
})(typeof globalThis==='undefined'?null:globalThis,function(){
 'use strict';
 const COPY=x=>JSON.parse(JSON.stringify(x));
 const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
 const PUMP=Object.freeze({
  'hyd-eng-1':{system:'A',kind:'ENG',feed:'eng1',label:'ENG 1 · SYSTEM A'},
  'hyd-elec-2':{system:'A',kind:'ELEC',feed:'ac2',label:'ELEC 2 · SYSTEM A'},
  'hyd-elec-1':{system:'B',kind:'ELEC',feed:'ac1',label:'ELEC 1 · SYSTEM B'},
  'hyd-eng-2':{system:'B',kind:'ENG',feed:'eng2',label:'ENG 2 · SYSTEM B'}
 });
 const LAMP={ 'hyd-eng-1':'hyd-eng-1','hyd-elec-2':'hyd-elec-2','hyd-elec-1':'hyd-elec-1','hyd-eng-2':'hyd-eng-2' };
 const CATALOG=[];
 function add(id,label,category,effect,options={}){
  CATALOG.push(Object.freeze({id,label,category,effect,...options}));
 }
 // Normal modes are complete scenarios; individual failures can be stacked.
 const PRESETS=Object.freeze([
  {id:'healthy',label:'All systems healthy',category:'NORMAL',env:{eng1:true,eng2:true,ac1:true,ac2:true,onGround:true},switches:'ON',charge:true},
  {id:'cold',label:'Cold & Dark · zero pressure',category:'NORMAL',env:{eng1:false,eng2:false,ac1:false,ac2:false,onGround:true},switches:'OFF',charge:false},
  {id:'preflight',label:'Preflight · ENG pumps ON / ELEC OFF',category:'NORMAL',env:{eng1:false,eng2:false,ac1:true,ac2:true,onGround:true},switches:'ENG_ONLY',charge:false},
  {id:'eng1',label:'ENG 1 only · EDP A',category:'NORMAL',env:{eng1:true,eng2:false,ac1:false,ac2:false,onGround:true},switches:'ENG_ONLY'},
  {id:'eng2',label:'ENG 2 only · EDP B',category:'NORMAL',env:{eng1:false,eng2:true,ac1:false,ac2:false,onGround:true},switches:'ENG_ONLY'},
  {id:'electric',label:'Electric pumps only · ground',category:'NORMAL',env:{eng1:false,eng2:false,ac1:true,ac2:true,onGround:true},switches:'ELEC_ONLY'},
  {id:'pushback',label:'Pushback · System A isolated, B electric ON',category:'NORMAL',env:{eng1:false,eng2:false,ac1:true,ac2:true,onGround:true},switches:'B_ELEC_ONLY'},
  {id:'airborne',label:'Airborne · both engines / all pumps ON',category:'NORMAL',env:{eng1:true,eng2:true,ac1:true,ac2:true,onGround:false},switches:'ON'},
  {id:'a-lost',label:'System A LOST · B operating',category:'EMERGENCY',preset:'healthy',faults:['A_RAPID_LEAK']},
  {id:'b-lost',label:'System B LOST · A operating',category:'EMERGENCY',preset:'healthy',faults:['B_RAPID_LEAK']},
  {id:'dual-lost',label:'DUAL A + B HYD LOSS',category:'EMERGENCY',preset:'healthy',faults:['A_RAPID_LEAK','B_RAPID_LEAK']},
  {id:'engine-out1',label:'ENGINE 1 failure · electric pump A available',category:'ABNORMAL',preset:'healthy',env:{eng1:false}},
  {id:'engine-out2',label:'ENGINE 2 failure · electric pump B available',category:'ABNORMAL',preset:'healthy',env:{eng2:false}},
  {id:'dual-ac-loss',label:'AC GENERATOR / BUS 1+2 LOSS',category:'ABNORMAL',preset:'healthy',faults:['BOTH_AC_LOST']},
  {id:'brake-accum',label:'BRAKE ACCUMULATOR depleted',category:'EMERGENCY',preset:'healthy',faults:['ACCUMULATOR_LEAK']},
  {id:'standby',label:'STANDBY RUDDER selected',category:'ABNORMAL',preset:'healthy',env:{standbySelected:true}},
  {id:'reservoir-air',label:'Both hydraulic reservoirs unpressurized',category:'ABNORMAL',preset:'healthy',faults:['RES_A_AIR_LOSS','RES_B_AIR_LOSS']}
 ]);
 for(const [id,label,sys] of [
  ['ENG1_PUMP_FAIL','ENG 1 pump failed','A'],['ELEC2_PUMP_FAIL','ELEC 2 pump failed','A'],
  ['ELEC1_PUMP_FAIL','ELEC 1 pump failed','B'],['ENG2_PUMP_FAIL','ENG 2 pump failed','B'],
  ['ENG1_PUMP_LOW','ENG 1 pump low output','A'],['ELEC2_PUMP_LOW','ELEC 2 pump low output','A'],
  ['ELEC1_PUMP_LOW','ELEC 1 pump low output','B'],['ENG2_PUMP_LOW','ENG 2 pump low output','B'],
  ['ENG1_SHUTOFF_STUCK','ENG 1 EDP shutoff valve stuck closed','A'],
  ['ENG2_SHUTOFF_STUCK','ENG 2 EDP shutoff valve stuck closed','B'],
  ['ELEC2_CB_OPEN','ELEC 2 pump CB open','A'],['ELEC1_CB_OPEN','ELEC 1 pump CB open','B'],
  ['ELEC2_OVHT','ELEC 2 pump overheat','A'],['ELEC1_OVHT','ELEC 1 pump overheat','B'],
  ['ELEC2_THERMAL_TRIP','ELEC 2 motor thermal trip','A'],
  ['ELEC1_THERMAL_TRIP','ELEC 1 motor thermal trip','B']]){
  add(id,label,'PUMPS',id.endsWith('OVHT')?'OVERHEAT':id.includes('CB')?'ELECTRICAL':'PUMP', {system:sys});
 }
 for(const [id,label,cat,effect] of [
  ['AC1_BUS_LOST','AC BUS 1 loss · ELEC 1','POWER','ELECTRICAL'],
  ['AC2_BUS_LOST','AC BUS 2 loss · ELEC 2','POWER','ELECTRICAL'],
  ['BOTH_AC_LOST','AC BUS 1 + 2 loss','POWER','ELECTRICAL'],
  ['RES_A_AIR_LOSS','System A reservoir air pressure lost','POWER','SUPPLY'],
  ['RES_B_AIR_LOSS','System B reservoir air pressure lost','POWER','SUPPLY'],
  ['A_LEAK','Hydraulic System A slow leak','SYSTEM','LEAK'],
  ['B_LEAK','Hydraulic System B slow leak','SYSTEM','LEAK'],
  ['A_RAPID_LEAK','System A major hydraulic leak','SYSTEM','LEAK'],
  ['B_RAPID_LEAK','System B major hydraulic leak','SYSTEM','LEAK'],
  ['A_LOW_QTY','System A fluid quantity low','SYSTEM','QUANTITY'],
  ['B_LOW_QTY','System B fluid quantity low','SYSTEM','QUANTITY'],
  ['A_FLUID_OVERHEAT','System A fluid overheated','SYSTEM','THERMAL'],
  ['B_FLUID_OVERHEAT','System B fluid overheated','SYSTEM','THERMAL'],
  ['STBY_PUMP_FAIL','Standby hydraulic pump failed','STANDBY','PUMP'],
  ['STBY_QTY_LOW','Standby reservoir low quantity','STANDBY','QUANTITY'],
  ['STBY_PUMP_CB_OPEN','Standby pump CB open','STANDBY','ELECTRICAL'],
  ['STBY_LEAK','Standby hydraulic reservoir leak','STANDBY','LEAK'],
  ['AUTO_STBY_FAIL','Automatic standby activation failed','STANDBY','CONTROLLER'],
  ['STBY_PRESS_SENSOR_FAIL','Standby pressure sensor failed','STANDBY','SENSOR'],
  ['PTU_FAIL','PTU failure','FLIGHT_CONTROLS','CONTROLLER'],
  ['LGTU_FAIL','Landing gear transfer unit failure','FLIGHT_CONTROLS','CONTROLLER'],
  ['FLIGHT_CTRL_A_ISOLATED','Flight control A hydraulic isolation','FLIGHT_CONTROLS','VALVE'],
  ['FLIGHT_CTRL_B_ISOLATED','Flight control B hydraulic isolation','FLIGHT_CONTROLS','VALVE'],
  ['ALT_FLAP_BYPASS_FAIL','Alternate flap bypass valve failed','FLIGHT_CONTROLS','VALVE'],
  ['YAW_DAMPER_HYD_FAIL','Yaw damper hydraulic supply failure','FLIGHT_CONTROLS','CONTROLLER'],
  ['A_PRESS_SENSOR_OPEN','System A pressure sensor open','SENSORS','SENSOR'],
  ['B_PRESS_SENSOR_OPEN','System B pressure sensor open','SENSORS','SENSOR'],
  ['A_PRESS_SENSOR_STUCK','System A pressure sensor frozen at 3000','SENSORS','SENSOR'],
  ['B_PRESS_SENSOR_STUCK','System B pressure sensor frozen at 3000','SENSORS','SENSOR'],
  ['A_QTY_SENSOR_FAIL','System A quantity sensor failed','SENSORS','SENSOR'],
  ['B_QTY_SENSOR_FAIL','System B quantity sensor failed','SENSORS','SENSOR'],
  ['BRAKE_INDICATOR_FAIL','Brake pressure indicator failed','SENSORS','INDICATION'],
  ['ACCUMULATOR_LEAK','Brake accumulator internal leak','BRAKES','LEAK'],
  ['ACCUMULATOR_PRECHARGE_LOW','Brake accumulator nitrogen precharge low','BRAKES','PNEUMATIC'],
  ['BRAKE_SELECTOR_STUCK_B','Brake selector stuck normal','BRAKES','VALVE'],
  ['BRAKE_SELECTOR_STUCK_A','Brake selector stuck alternate','BRAKES','VALVE'],
  ['BRAKE_PIPE_LEAK','Brake pressure supply line leak','BRAKES','LEAK'],
  ['BRAKE_PEDAL_FAIL','Brake pedal metering valve failed','BRAKES','VALVE'],
  ['ANTISKID_FAIL','Anti-skid controller failed','BRAKES','CONTROLLER'],
  ['MASTER_CAUTION_HYD_FAIL','HYD Master Caution output failed','WARNINGS','INDICATION'],
  ['SIXPACK_HYD_LAMP_FAIL','FO HYD sixpack lamp failed','WARNINGS','INDICATION'],
  ['SIXPACK_HYD_STUCK_ON','FO HYD sixpack lamp stuck on','WARNINGS','INDICATION'],
  ['ENG1_LOW_LAMP_FAIL','ENG 1 LOW PRESS lamp failed','WARNINGS','INDICATION'],
  ['ELEC2_LOW_LAMP_FAIL','ELEC 2 LOW PRESS lamp failed','WARNINGS','INDICATION'],
  ['ELEC1_LOW_LAMP_FAIL','ELEC 1 LOW PRESS lamp failed','WARNINGS','INDICATION'],
  ['ENG2_LOW_LAMP_FAIL','ENG 2 LOW PRESS lamp failed','WARNINGS','INDICATION'],
  ['ELEC2_OVHT_LAMP_FAIL','ELEC 2 OVERHEAT lamp failed','WARNINGS','INDICATION'],
  ['ELEC1_OVHT_LAMP_FAIL','ELEC 1 OVERHEAT lamp failed','WARNINGS','INDICATION']
 ])add(id,label,cat,effect);
 const FAULTS=Object.freeze(CATALOG);
 const ALLOWED=new Set(FAULTS.map(f=>f.id));
 const DEFAULT_ENV=()=>({eng1:true,eng2:true,ac1:true,ac2:true,onGround:true,
  reservoirAir:true,standbySelected:false,alternateFlapsArmed:false,
  fireHandle1:false,fireHandle2:false,gearUpSelected:false,gearNotUpLocked:false,flapsDeg:0,airspeedKt:0});
 const SWITCHES=()=>Object.fromEntries(Object.keys(PUMP).map(id=>[id,'ON']));
 const initial=()=>({schema:'HYD-LAB-CORE-0001',time:0,env:DEFAULT_ENV(),switches:SWITCHES(),
  faults:[],pressure:{A:3000,B:3000,STBY:0},quantity:{A:100,B:100,STBY:100},
  brakeAccumulator:3000,brakeCount:0,masterAcknowledged:false,
  pumpHeat:{'hyd-elec-1':30,'hyd-elec-2':30}});
 const faulted=(s,id)=>s.faults.includes(id);
 const command=(state,cmd)=>{
  if(!cmd||typeof cmd!=='object')throw Error('Hydraulic command required');
  const s=COPY(state),id=cmd.id;
  switch(cmd.type){
   case 'SET_SWITCH':
    if(!PUMP[id]||!['ON','OFF'].includes(cmd.value))throw Error('Invalid physical hydraulic switch');
    s.switches[id]=cmd.value;break;
   case 'SET_ENV':
    if(!Object.hasOwn(s.env,id))throw Error('Unknown hydraulic environment input');
    if(['flapsDeg','airspeedKt'].includes(id)){if(!Number.isFinite(cmd.value))throw Error('Invalid numeric environment input');s.env[id]=clamp(cmd.value,0,id==='flapsDeg'?40:550);}
    else if(typeof cmd.value==='boolean')s.env[id]=cmd.value;else throw Error('Boolean environment input required');
    break;
   case 'INJECT':
    if(!ALLOWED.has(id))throw Error('Unknown hydraulic failure '+id);
    if(!s.faults.includes(id))s.faults.push(id);break;
   case 'CLEAR':
    if(!ALLOWED.has(id))throw Error('Unknown hydraulic failure '+id);
    s.faults=s.faults.filter(x=>x!==id);break;
   case 'CLEAR_ALL':s.faults=[];break;
   case 'ACK':s.masterAcknowledged=true;break;
   case 'RECALL':s.masterAcknowledged=false;break;
   case 'BRAKE':
    if(!Number.isFinite(cmd.count)||cmd.count<1||cmd.count>50)throw Error('Invalid brake application count');
    s.brakeCount+=Math.round(cmd.count);
    const bSupply=s.pressure.B>2400&&!faulted(s,'BRAKE_PIPE_LEAK');
    const aSupply=s.pressure.A>2400&&!faulted(s,'BRAKE_SELECTOR_STUCK_B');
    if(!bSupply&&!aSupply&&!faulted(s,'BRAKE_PEDAL_FAIL'))s.brakeAccumulator=clamp(s.brakeAccumulator-340*cmd.count,0,3500);
    break;
   case 'SET_QTY':
    if(!['A','B','STBY'].includes(id)||!Number.isFinite(cmd.value))throw Error('Invalid hydraulic reservoir quantity');
    s.quantity[id]=clamp(cmd.value,0,106);break;
   case 'RESET':return initial();
   default:throw Error('Unknown hydraulic command '+cmd.type);
  }
  return s;
 };
 function loadPreset(id){
  const p=PRESETS.find(x=>x.id===id);
  if(!p)throw Error('Unknown hydraulic scenario '+id);
  let s=initial();
  const base=PRESETS.find(x=>x.id===p.preset)||p;
  s.env={...s.env,...base.env,...p.env};
  const mode=base.switches||'ON';
  for(const key of Object.keys(s.switches)){
   const kind=PUMP[key].kind,sys=PUMP[key].system;
   s.switches[key]=mode==='ON'?'ON':mode==='OFF'?'OFF':
    mode==='ENG_ONLY'?(kind==='ENG'?'ON':'OFF'):
    mode==='ELEC_ONLY'?(kind==='ELEC'?'ON':'OFF'):
    mode==='B_ELEC_ONLY'?(key==='hyd-elec-1'?'ON':'OFF'):'OFF';
  }
  s.faults=[...(p.faults||[])];
  if(p.charge===false){s.pressure={A:0,B:0,STBY:0};s.brakeAccumulator=p.id==='preflight'?2800:0;}
  if(p.id==='brake-accum'){
   // A depleted accumulator cannot stay depleted with B still recharging it.
   s.env.eng2=false;s.env.ac1=false;s.brakeAccumulator=1000;
  }
  // Presets represent already established operating conditions; pressure
  // should never falsely start at 3000 psi with both supplying pumps OFF.
  if(p.charge!==false){
   for(const sys of ['A','B']){
    s.pressure[sys]=Math.max(...Object.keys(PUMP).filter(k=>PUMP[k].system===sys)
     .map(k=>onePump(s,k).pressurePsi));
   }
   if(s.env.standbySelected&&s.env.ac1&&!faulted(s,'STBY_PUMP_FAIL'))s.pressure.STBY=3000;
  }
  return s;
 }
 function onePump(s,id){
  const p=PUMP[id],env=s.env,sys=p.system,engNum=id==='hyd-eng-1'?'1':id==='hyd-eng-2'?'2':null;
  const token=engNum?'ENG'+engNum:id==='hyd-elec-1'?'ELEC1':'ELEC2';
  const fail=faulted(s,token+'_PUMP_FAIL')||faulted(s,token+'_THERMAL_TRIP')||
   faulted(s,token+'_SHUTOFF_STUCK')||faulted(s,token+'_CB_OPEN');
  const bus= p.kind==='ELEC'? (p.feed==='ac1'?env.ac1:env.ac2) &&
   !faulted(s,p.feed==='ac1'?'AC1_BUS_LOST':'AC2_BUS_LOST')&&!faulted(s,'BOTH_AC_LOST'):true;
  const running=p.kind==='ENG'?(engNum==='1'?env.eng1:env.eng2):true;
  const blocked=p.kind==='ENG'&&(engNum==='1'?env.fireHandle1:env.fireHandle2);
  const q=s.quantity[sys];
  const inletOk=env.reservoirAir&&!faulted(s,'RES_'+sys+'_AIR_LOSS');
  const active=s.switches[id]==='ON'&&running&&bus&&!blocked&&!fail&&q>3;
  let strength=active?1:0;
  if(faulted(s,token+'_PUMP_LOW'))strength=.48;
  if(!inletOk)strength*=.5;
  if(q<15)strength*=clamp(q/15,0,1);
  if(faulted(s,token+'_OVHT'))strength*=.65;
  const outPressure=clamp(3000*strength,0,3500);
  const overheat=faulted(s,token+'_OVHT');
  return {id,system:sys,kind:p.kind,switch:s.switches[id],powered:bus,running,blocked,
   active,delivering:outPressure>1500,pressurePsi:outPressure,overheat,
   lowPressure:outPressure<2000,fireLampInhibited:blocked&&p.kind==='ENG'};
 }
 function evaluate(s){
  if(s?.schema!=='HYD-LAB-CORE-0001')throw Error('Invalid hydraulic state');
  const pumps=Object.fromEntries(Object.keys(PUMP).map(id=>[id,onePump(s,id)]));
  const pressure={...s.pressure},q={...s.quantity};
  const pa=faulted(s,'A_PRESS_SENSOR_OPEN')?null:faulted(s,'A_PRESS_SENSOR_STUCK')?3000:Math.round(pressure.A);
  const pb=faulted(s,'B_PRESS_SENSOR_OPEN')?null:faulted(s,'B_PRESS_SENSOR_STUCK')?3000:Math.round(pressure.B);
  const qa=faulted(s,'A_QTY_SENSOR_FAIL')?null:Math.round(q.A);
  const qb=faulted(s,'B_QTY_SENSOR_FAIL')?null:Math.round(q.B);
  const brake=faulted(s,'BRAKE_INDICATOR_FAIL')?null:Math.round(s.brakeAccumulator);
  const normalBrakes=pressure.B>2200&&!faulted(s,'BRAKE_SELECTOR_STUCK_A')&&!faulted(s,'BRAKE_PIPE_LEAK');
  const alternateBrakes=!normalBrakes&&pressure.A>2200&&!faulted(s,'BRAKE_SELECTOR_STUCK_B')&&!faulted(s,'BRAKE_PIPE_LEAK');
  const brakeMode=faulted(s,'BRAKE_PEDAL_FAIL')?'FAILED':normalBrakes?'NORMAL_B':alternateBrakes?'ALTERNATE_A':brake>1000?'ACCUMULATOR_ONLY':'UNAVAILABLE';
  const standbyDemand=s.env.standbySelected||s.env.alternateFlapsArmed||
   (!s.env.onGround&&s.env.flapsDeg>0&&(pressure.A<1800||pressure.B<1800)&&!faulted(s,'AUTO_STBY_FAIL'));
  const alertLowPump=Object.values(pumps).some(p=>p.lowPressure&&!p.fireLampInhibited);
  const panelPowered=s.env.ac1||s.env.ac2;
  const alertHyd=alertLowPump||pressure.A<2200||pressure.B<2200||q.A<20||q.B<20;
  const failedLamp=id=>faulted(s,id);
  const lamps={};
  for(const [id,p] of Object.entries(pumps)){
   const k=id==='hyd-eng-1'?'ENG1':id==='hyd-eng-2'?'ENG2':id==='hyd-elec-1'?'ELEC1':'ELEC2';
   lamps[id]=panelPowered&&p.lowPressure&&!p.fireLampInhibited&&!failedLamp(k+'_LOW_LAMP_FAIL');
  }
  for(const id of ['hyd-elec-1','hyd-elec-2']){
   const k=id==='hyd-elec-1'?'ELEC1':'ELEC2';
   lamps[id+'-overheat']=panelPowered&&pumps[id].overheat&&!failedLamp(k+'_OVHT_LAMP_FAIL');
  }
  lamps['flight-pressure-a']=panelPowered&&(pressure.A<1800||faulted(s,'FLIGHT_CTRL_A_ISOLATED'));
  lamps['flight-pressure-b']=panelPowered&&(pressure.B<1800||faulted(s,'FLIGHT_CTRL_B_ISOLATED'));
  lamps['stby-pressure']=panelPowered&&standbyDemand&&(pressure.STBY<1800||faulted(s,'STBY_PRESS_SENSOR_FAIL'));
  lamps['stby-quantity']=panelPowered&&(q.STBY<25||faulted(s,'STBY_QTY_LOW'));
  lamps['stby-rudder']=panelPowered&&standbyDemand&&pressure.STBY>1800;
  const sixPackHyd=panelPowered&&(failedLamp('SIXPACK_HYD_STUCK_ON')||
   (alertHyd&&!failedLamp('SIXPACK_HYD_LAMP_FAIL')));
  // Cross-system dependencies are separate *capability outputs*: they do
  // not fake actual aircraft positions or flow-rate measurements.
  const mainA=pressure.A>=2200,mainB=pressure.B>=2200;
  const flightA=mainA&&!faulted(s,'FLIGHT_CTRL_A_ISOLATED');
  const flightB=mainB&&!faulted(s,'FLIGHT_CTRL_B_ISOLATED');
  const ptuDemand=!s.env.onGround&&s.env.flapsDeg>0&&s.env.flapsDeg<15&&
   pumps['hyd-eng-2'].pressurePsi<2000&&mainA;
  const lgtuDemand=!s.env.onGround&&s.env.gearUpSelected&&s.env.gearNotUpLocked&&
   !s.env.eng1&&mainB;
  const capabilities={
   flightControls:{A:flightA,B:flightB,manualReversion:!flightA&&!flightB},
   autopilot:{A:flightA,B:flightB},
   gearNormal:mainA,
   nosewheelSteering:mainA,
   yawDamper:mainB&&!faulted(s,'YAW_DAMPER_HYD_FAIL'),
   antiskid:!faulted(s,'ANTISKID_FAIL'),
   alternateFlaps:standbyDemand&&pressure.STBY>1800&&!faulted(s,'ALT_FLAP_BYPASS_FAIL'),
   reverser1:!s.env.fireHandle1&&(mainA||pressure.STBY>1800),
   reverser2:!s.env.fireHandle2&&(mainB||pressure.STBY>1800),
   ptu:{available:!faulted(s,'PTU_FAIL'),demand:ptuDemand,active:ptuDemand&&!faulted(s,'PTU_FAIL')},
   lgtu:{available:!faulted(s,'LGTU_FAIL'),demand:lgtuDemand,active:lgtuDemand&&!faulted(s,'LGTU_FAIL')},
   fluidOverheat:{A:faulted(s,'A_FLUID_OVERHEAT'),B:faulted(s,'B_FLUID_OVERHEAT')}
  };
  return Object.freeze({schema:'HYD-LAB-CORE-0001/OUT',time:s.time,
   pressurePsi:{A:Math.round(pressure.A),B:Math.round(pressure.B),STBY:Math.round(pressure.STBY),BRAKE:Math.round(s.brakeAccumulator)},
   quantityPct:{A:Math.round(q.A),B:Math.round(q.B),STBY:Math.round(q.STBY)},
   indications:{'eng.hyd_pressure.a':pa,'eng.hyd_pressure.b':pb,
    'eng.hyd_qty.a':qa,'eng.hyd_qty.b':qb,'fo.hyd_brake_pressure':brake},
   lamps,alerts:{sixPackHyd,masterCaution:panelPowered&&alertHyd&&!failedLamp('MASTER_CAUTION_HYD_FAIL')&&!s.masterAcknowledged,
    recallHyd:alertHyd,acknowledged:s.masterAcknowledged,masterCautionAuthority:'LAB_TRAINING_APPROX'},
   pumps,capabilities,brakes:{mode:brakeMode,normalBrakes,alternateBrakes,accumulatorPsi:Math.round(s.brakeAccumulator)},
   standby:{selected:standbyDemand,active:pressure.STBY>1800},
   warnings:{systemA:pressure.A<2200,systemB:pressure.B<2200,
    reservoirA:q.A<40,reservoirB:q.B<40},
   faults:[...s.faults],quality:'TRAINING_SIMULATION_ONLY',
   sourceNote:'ATA 29 / B737 Classic FCOM principles; pressure transients, thresholds, leaks and warning timing approximate'});
 }
 function step(state,seconds){
  if(!Number.isFinite(seconds)||seconds<0||seconds>60)throw Error('Invalid hydraulic elapsed seconds');
  let s=COPY(state);
  let left=seconds;
  while(left>0){
   const dt=Math.min(.1,left);left=Math.max(0,left-dt);
   const pp=Object.fromEntries(Object.keys(PUMP).map(id=>[id,onePump(s,id)]));
   for(const sys of ['A','B']){
    const options=Object.values(pp).filter(p=>p.system===sys);
    const strong=Math.max(...options.map(p=>p.pressurePsi));
    const leak=faulted(s,sys+'_RAPID_LEAK')?5.0:faulted(s,sys+'_LEAK')?0.9:0;
    if(leak)s.quantity[sys]=clamp(s.quantity[sys]-leak*dt,0,106);
    if(faulted(s,sys+'_LOW_QTY'))s.quantity[sys]=Math.min(s.quantity[sys],24);
    const target=clamp(strong*(1-(faulted(s,sys+'_RAPID_LEAK')?.68:faulted(s,sys+'_LEAK')?.15:0)),0,3500);
    const tau=target>s.pressure[sys]?(options.some(p=>p.kind==='ENG'&&p.delivering)?1.4:2.8):3.3;
    const gain=1-Math.exp(-dt/tau);
    s.pressure[sys]+= (target-s.pressure[sys])*gain;
    if(s.pressure[sys]<.1)s.pressure[sys]=0;
   }
   const standbySelected=s.env.standbySelected||s.env.alternateFlapsArmed||
     (!s.env.onGround&&s.env.flapsDeg>0&&(s.pressure.A<1800||s.pressure.B<1800)&&!faulted(s,'AUTO_STBY_FAIL'));
   if(faulted(s,'STBY_LEAK'))s.quantity.STBY=clamp(s.quantity.STBY-1.3*dt,0,106);
   if(faulted(s,'STBY_QTY_LOW'))s.quantity.STBY=Math.min(s.quantity.STBY,20);
   const sOn=standbySelected&&s.env.ac1&&!faulted(s,'BOTH_AC_LOST')&&!faulted(s,'AC1_BUS_LOST')&&
     !faulted(s,'STBY_PUMP_FAIL')&&!faulted(s,'STBY_PUMP_CB_OPEN')&&s.quantity.STBY>4;
   const targetS=sOn?3000:0;
   s.pressure.STBY+=(targetS-s.pressure.STBY)*(1-Math.exp(-dt/(sOn?1.8:3.2)));
   // A/B pressure is not a direct brake accumulator gauge. B charges it;
   // loss of B preserves trapped pressure until use or leakage.
   const charging=s.pressure.B>2400&&!faulted(s,'BRAKE_PIPE_LEAK');
   const targetAcc=clamp(s.pressure.B,0,3500);
   if(charging)s.brakeAccumulator+=(targetAcc-s.brakeAccumulator)*(1-Math.exp(-dt/2));
   if(faulted(s,'ACCUMULATOR_LEAK'))s.brakeAccumulator=clamp(s.brakeAccumulator-150*dt,0,3500);
   if(faulted(s,'ACCUMULATOR_PRECHARGE_LOW'))s.brakeAccumulator=Math.min(s.brakeAccumulator,1400);
   s.time+=dt;
  }
  return s;
 }
 return Object.freeze({
  VERSION:'HYD-LAB-CORE-0001',PUMP,FAULTS,PRESETS,
  initial,loadPreset,command,step,evaluate,
  getFault:id=>FAULTS.find(x=>x.id===id)||null,clone:COPY
 });
});

}catch(error){queueMicrotask(()=>{throw error});}
;await 0;
;
/* ../../engine/instruments/hydraulic-gauge-calibration-v2.js?v=HYD-GAUGE-CAL-V2 */
try{
/* HYD-GAUGE-CAL-V2 — photo-registered, non-linear analog pointer calibration.
 * Gauges A/B share a photographed dual face but have distinct source pivots.
 * Conventional engine photo: 1235x1274 native pixels.
 * FO brake photo: 918x1713 native pixels.
 * Direction: 0° is 12 o'clock; clockwise positive. Absolute SVG rotation,
 * never add a mystery 90° offset to a pointer whose base points UP.
 * Image-based calibration for this instructional simulator, not certified
 * FCOM pointer tolerances. Do not change locked source artwork.
 */
(function(root,factory){'use strict';
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.B737HydraulicGaugeCalibrationV2=api;
})(typeof globalThis==='undefined'?null:globalThis,function(){
 'use strict';
 const config={
  A:{
   panel:'ENGINE',photoKind:'HYD_DUAL',face:'eng.hyd_pressure.a',
   native:{w:1235,h:1274},viewport:{x:907,y:921,w:150,h:204},
   pivot:{x:982,y:991},qtyWindow:{x:990,y:1085},
   needleLength:40,
   detents:[{psi:0,angle:132},{psi:1000,angle:180},
    {psi:2000,angle:234},{psi:3000,angle:319},{psi:4000,angle:409}]
  },
  B:{
   panel:'ENGINE',photoKind:'HYD_DUAL',face:'eng.hyd_pressure.b',
   native:{w:1235,h:1274},viewport:{x:1043,y:921,w:150,h:204},
   pivot:{x:1118,y:991},qtyWindow:{x:1096,y:1085},
   needleLength:40,
   detents:[{psi:0,angle:133},{psi:1000,angle:180},
    {psi:2000,angle:233},{psi:3000,angle:318},{psi:4000,angle:409}]
  },
  BRAKE:{
   panel:'FO-INNER',photoKind:'BRAKE',face:'fo.hyd_brake_pressure',
   native:{w:918,h:1713},viewport:{x:385,y:480,w:176,h:176},
   pivot:{x:473,y:568},qtyWindow:null,needleLength:66,
   // 0 must point at the printed lower-right zero, approximately 3:30.
   detents:[{psi:0,angle:110},{psi:1000,angle:180},
    {psi:2000,angle:269},{psi:3000,angle:358},{psi:4000,angle:425}]
  }
 };
 const frozen=Object.freeze(Object.fromEntries(Object.entries(config).map(([id,c])=>
  [id,Object.freeze({...c,native:Object.freeze(c.native),viewport:Object.freeze(c.viewport),
   pivot:Object.freeze(c.pivot),qtyWindow:c.qtyWindow?Object.freeze(c.qtyWindow):null,
   detents:Object.freeze(c.detents.map(x=>Object.freeze(x)))})])));
 const clamp=(n,a,b)=>Math.min(b,Math.max(a,n));
 function gauge(id){
  const g=frozen[id];
  if(!g)throw Error('Unknown hydraulic gauge '+id);
  return g;
 }
 function angle(id,psi){
  const g=gauge(id),t=g.detents;
  if(!Number.isFinite(psi))return null;
  const v=clamp(psi,t[0].psi,t[t.length-1].psi);
  for(let i=1;i<t.length;i++){
   if(v<=t[i].psi){
    const prev=t[i-1],next=t[i],ratio=(v-prev.psi)/(next.psi-prev.psi);
    return prev.angle+(next.angle-prev.angle)*ratio;
   }
  }
  return t[t.length-1].angle;
 }
 function polar(angleDeg,length){
  if(!Number.isFinite(angleDeg)||!Number.isFinite(length))return null;
  const r=angleDeg*Math.PI/180;
  return {dx:Math.sin(r)*length,dy:-Math.cos(r)*length};
 }
 function local(id){
  const g=gauge(id);
  return {x:g.pivot.x-g.viewport.x,y:g.pivot.y-g.viewport.y};
 }
 function qtyLocal(id){
  const g=gauge(id);
  return g.qtyWindow?{x:g.qtyWindow.x-g.viewport.x,y:g.qtyWindow.y-g.viewport.y}:null;
 }
 function validate(){
  for(const [id,g] of Object.entries(frozen)){
   const v=g.viewport,p=local(id);
   if(p.x<0||p.y<0||p.x>v.w||p.y>v.h)throw Error(id+' pivot outside source crop');
   if(v.x<0||v.y<0||v.x+v.w>g.native.w||v.y+v.h>g.native.h)
    throw Error(id+' crop outside source artwork');
   if(g.qtyWindow){
    const q=qtyLocal(id);
    if(q.x<5||q.y<5||q.x>v.w-5||q.y>v.h-5)throw Error(id+' quantity window outside crop');
   }
   if(g.detents.length!==5)throw Error(id+' missing 0-4 detents');
   for(let i=1;i<g.detents.length;i++)
    if(g.detents[i].psi<=g.detents[i-1].psi||g.detents[i].angle<=g.detents[i-1].angle)
     throw Error(id+' non-monotonic pressure calibration');
  }
  return true;
 }
 validate();
 return Object.freeze({VERSION:'HYD-GAUGE-CAL-V2',GAUGES:frozen,gauge,angle,polar,local,qtyLocal,validate});
});

}catch(error){queueMicrotask(()=>{throw error});}
;await 0;
})();
