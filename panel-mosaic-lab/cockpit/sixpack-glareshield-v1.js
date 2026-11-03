/* SIXPACK-0001 — independently addressed 737 Classic glareshield annunciators.
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
let visualTest=false, recallHeld=false, mounted=false;
const norm=v=>String(v||'').trim().toUpperCase().replace(/[_\s-]+/g,' ').replace(/\s*\/\s*/g,'/');
const key=(side,name)=>String(side).toUpperCase()+'.'+norm(name);
for(const side of Object.keys(sides))for(const name of [...sides[side],...ids]){
 const k=key(side,name);manual.set(k,false);
 if(!ids.includes(name))liveReasons.set(k,[]);
}
function emit(side,name,on,source){
 window.dispatchEvent(new CustomEvent('b737:sixpack-light-change',{detail:{side,legend:name,id:key(side,name),on:!!on,source,visualOnly:true}}));
}

const isSystem=k=>liveReasons.has(k);
const active=k=>manual.get(k)===true||(liveReasons.get(k)?.length||0)>0;
function anyCaution(){return [...liveReasons.keys()].some(k=>active(k)&&!acknowledged.has(k));}
function effective(k){
 if(visualTest)return true;
 if(isSystem(k))return recallHeld||(active(k)&&!acknowledged.has(k));
 if(k.endsWith('.MASTER CAUTION'))return manual.get(k)===true||anyCaution();
 return (fireWarningActive&&!fireWarningAcknowledged)||manual.get(k)===true;
}
function paint(){
 for(const [k,n]of nodes){
  const on=effective(k);n.dataset.on=String(on);
  if(n.tagName==='BUTTON')n.setAttribute('aria-pressed',String(on));
  else n.setAttribute('aria-label',k+(on?' illuminated':' unlit'));
 }
 const count=document.getElementById('b737SixpackCount');
 if(count)count.textContent=[...manual.keys()].filter(k=>isSystem(k)&&effective(k)).length+' / 12';
 document.querySelectorAll('[data-sixpack-checkbox]').forEach(n=>{
  n.checked=manual.get(n.dataset.sixpackCheckbox)===true;n.disabled=visualTest;
 });
}
function acknowledge(source='master-caution-reset'){
 for(const k of liveReasons.keys())if(active(k))acknowledged.add(k);
 for(const side of Object.keys(sides)){
  const k=key(side,'MASTER CAUTION');
  if(manual.get(k)){manual.set(k,false);emit(side,'MASTER CAUTION',false,source);}
 }
 paint();
 window.dispatchEvent(new CustomEvent('b737:sixpack-acknowledge',{detail:{source,retainedActiveFaults:[...acknowledged],visualOnly:true}}));
}
function recall(side='CAPT'){
 const existing=[...liveReasons.keys()].filter(k=>active(k));
 acknowledged.clear();paint();
 window.dispatchEvent(new CustomEvent('b737:sixpack-recall',{detail:{side,active:existing,masterCaution:existing.length>0,source:'UNIFIED_AND_INSTRUCTOR',visualOnly:false}}));
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
 const s=String(side).toUpperCase(), n=norm(name), k=key(s,n);
 if(!manual.has(k))return false;
 const next=!!on,prev=manual.get(k);manual.set(k,next);if(next!==prev)acknowledged.delete(k);paint();
 if(next!==prev)emit(s,n,next,source);
 return true;
}
function setAll(on,side=null,source='instructor'){
 const filter=side?String(side).toUpperCase():null;
 if(filter&&!sides[filter])return false;
 acknowledged.clear();
 for(const [k,v] of manual){
  if(filter&&!k.startsWith(filter+'.'))continue;
  if(v!==!!on){
   manual.set(k,!!on);
   const i=k.indexOf('.');emit(k.slice(0,i),k.slice(i+1),!!on,source);
  }
 }
 paint();return true;
}
// An atomic set of actual annunciator reasons; false-to-true/new-fault edges re-arm caution.
function setLiveConditions(reasons,source='UNIFIED'){
 if(!reasons||typeof reasons!=='object')return false;
 let changed=false;
 for(const k of liveReasons.keys()){
  const input=reasons[k];
  if(input===undefined)continue;
  if(!Array.isArray(input)||input.some(id=>typeof id!=='string'||!id||id.length>120))return false;
  const next=[...new Set(input)].sort(),before=liveReasons.get(k);
  if(JSON.stringify(before)!==JSON.stringify(next)){
   if(next.some(id=>!before.includes(id))||next.length===0)acknowledged.delete(k);
   liveReasons.set(k,next);changed=true;
  }
 }
 if(changed){
  paint();
  window.dispatchEvent(new CustomEvent('b737:sixpack-system-update',{detail:{source,activeReasons:Object.fromEntries(liveReasons),masterCaution:anyCaution()}}));
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
 window.dispatchEvent(new CustomEvent('b737:sixpack-ready',{detail:{version:'SIXPACK-0003',independentLamps:12,masters:4}}));
}
window.B737SixPack=Object.freeze({
 version:'SIXPACK-0003',
 mount,
 getState:()=>Object.fromEntries(manual),
 getEffectiveState:()=>Object.fromEntries([...manual.keys()].map(k=>[k,effective(k)])),
 getLiveReasons:()=>Object.fromEntries([...liveReasons].map(([k,v])=>[k,[...v]])),
 setLight,setAll,setCombination,setLiveConditions,setFireWarning,acknowledgeFire,acknowledge,recall,press,release,
 reset:()=>{acknowledged.clear();recallHeld=false;fireWarningAcknowledged=false;return setAll(false,null,'reset');},
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