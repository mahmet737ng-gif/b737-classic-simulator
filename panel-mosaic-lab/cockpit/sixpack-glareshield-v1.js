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
function effective(k){
 if(visualTest)return true;
 if(isSystem(k))return recallHeld||recallShown.has(k)||pending(k);
 if(k.endsWith('.MASTER CAUTION'))return manual.get(k)===true||recallMaster||anyCaution();
 return (fireWarningActive&&!fireWarningAcknowledged)||manual.get(k)===true;
}
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
 root.append(makeSeat('CAPT'),makeSeat('FO'));native.append(root);mounted=true;addInspector();paint();
 window.dispatchEvent(new CustomEvent('b737:sixpack-ready',{detail:{version:'SIXPACK-0004',independentLamps:12,masters:4}}));
}
window.B737SixPack=Object.freeze({
 version:'SIXPACK-0003',
 mount,
 getState:()=>Object.fromEntries(manual),
 getEffectiveState:()=>Object.fromEntries([...manual.keys()].map(k=>[k,effective(k)])),
 getLiveReasons,getLiveConditionDetails,getCautionDiagnostics,
 setLight,setAll,setCombination,setLiveConditions,setFireWarning,acknowledgeFire,acknowledge,recall,press,release,
 reset:()=>{acknowledged.clear();clearRecall();recallHeld=false;fireWarningAcknowledged=false;return setAll(false,null,'reset');},
 setVisualTest:on=>{visualTest=!!on;paint();},
 getGeometry:()=>({region:'main',width:2100,height:920,left:{x:640,y:3,w:144,h:121},right:{x:1387,y:3,w:144,h:121}})
});
window.addEventListener('b737:cockpit-mounted',mount);
window.addEventListener('b737:visual-test',e=>{visualTest=!!e.detail?.active;paint()});
window.addEventListener('b737:sixpack-command',e=>{
 const d=e.detail||{};
 if(d.combination)setCombination(d.combination,'event');
 else if(d.side&&d.legend!==undefined)setLight(d.side,d.legend,d.on,'event');
 else if(typeof d.all==='boolean')setAll(d.all,d.side||null,'event');
});
document.addEventListener('DOMContentLoaded',mount);
if(document.readyState!=='loading')mount();
})();