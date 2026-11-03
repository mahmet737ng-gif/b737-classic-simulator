/* SIXPACK-0001 — independently addressed 737 Classic glareshield annunciators.
   An additive visual/training layer: protected cockpit photos and guard geometry are untouched.
   No automatic FCOM-level failures or electrical authority are inferred by this module. */
(function(){
'use strict';
const ROOT='b737-classic-sixpack', CAPT=['FLT CONT','ELEC','IRS','APU','FUEL','OVHT/DET'];
const FO=['ANTI-ICE','ENG','HYD','OVERHEAD','DOORS','AIR COND'];
const sides={CAPT,FO};
const ids=['MASTER CAUTION','FIRE WARN'];
const manual=new Map(), nodes=new Map();
let visualTest=false, mounted=false;
const norm=v=>String(v||'').trim().toUpperCase().replace(/[_\s-]+/g,' ').replace(/\s*\/\s*/g,'/');
const key=(side,name)=>String(side).toUpperCase()+'.'+norm(name);
for(const side of Object.keys(sides))for(const name of [...sides[side],...ids])manual.set(key(side,name),false);
function emit(side,name,on,source){
 window.dispatchEvent(new CustomEvent('b737:sixpack-light-change',{detail:{side,legend:name,id:key(side,name),on:!!on,source,visualOnly:true}}));
}
function paint(){
 for(const [k,n] of nodes){
  const active=visualTest||manual.get(k)===true;
  n.dataset.on=String(active);
  n.setAttribute('aria-pressed',String(active));
 }
 const counter=document.getElementById('b737SixpackCount');
 if(counter)counter.textContent=[...manual.entries()].filter(([k,v])=>!k.includes('MASTER CAUTION')&&!k.includes('FIRE WARN')&&(visualTest||v)).length+' / 12';
 const checks=document.querySelectorAll('[data-sixpack-checkbox]');
 checks.forEach(n=>{n.checked=manual.get(n.dataset.sixpackCheckbox)===true;n.disabled=visualTest;});
}
function setLight(side,name,on,source='external'){
 const s=String(side).toUpperCase(), n=norm(name), k=key(s,n);
 if(!manual.has(k))return false;
 const next=!!on,prev=manual.get(k);manual.set(k,next);paint();
 if(next!==prev)emit(s,n,next,source);
 return true;
}
function setAll(on,side=null,source='instructor'){
 const filter=side?String(side).toUpperCase():null;
 if(filter&&!sides[filter])return false;
 for(const [k,v] of manual){
  if(filter&&!k.startsWith(filter+'.'))continue;
  if(v!==!!on){
   manual.set(k,!!on);
   const i=k.indexOf('.');emit(k.slice(0,i),k.slice(i+1),!!on,source);
  }
 }
 paint();return true;
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
 const b=document.createElement('button');b.type='button';
 b.className=kind==='master'?'b737-sp-master '+(name==='FIRE WARN'?'fire':'caution'):'b737-sp-legend';
 b.dataset.sixpack=key(side,name);b.dataset.on='false';b.setAttribute('aria-pressed','false');
 b.setAttribute('aria-label',side+' '+name+' visual warning light');
 if(kind==='master')b.innerHTML=name==='FIRE WARN'
   ?'<span>FIRE</span><span>WARN</span><small>BELL CUTOUT</small>'
   :'<span>MASTER</span><span>CAUTION</span><small>PUSH TO RESET</small>';
 else b.textContent=name;
 const id=key(side,name);nodes.set(id,b);
 b.addEventListener('pointerdown',e=>e.stopPropagation());
 b.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();setLight(side,name,!manual.get(id),'cockpit-click')});
 return b;
}
function makeSeat(side){
 const panel=document.createElement('section');
 panel.className='b737-sp-console seat-'+side.toLowerCase();
 panel.dataset.sixpackSeat=side;panel.dir='ltr';
 panel.setAttribute('aria-label',side==='CAPT'?'Captain glareshield six-pack':'First Officer glareshield six-pack');
 const top=document.createElement('div');top.className='b737-sp-top';
 const knob=document.createElement('div');knob.className='b737-sp-map';
 knob.innerHTML='<div class="b737-sp-clock">CLOCK</div><div class="b737-sp-bright">BRIGHT</div><div class="b737-sp-metal"><i></i></div><div class="b737-sp-map-label">MAP</div>';
 const fire=makeButton(side,'FIRE WARN','master'),caution=makeButton(side,'MASTER CAUTION','master');
 if(side==='CAPT')top.append(fire,caution,knob);else top.append(knob,caution,fire);
 const rack=document.createElement('div');rack.className='b737-sp-rack';rack.setAttribute('role','group');
 for(const name of sides[side])rack.append(makeButton(side,name,'legend'));
 panel.append(top,rack);
 return panel;
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
 const note=document.createElement('small');note.textContent='Visual test overrides. Independent sensor / fault logic may be connected later without changing these lamps.';
 section.append(note);inspector.append(section);
}
function mount(){
 if(mounted)return;
 const native=document.querySelector('#region-main .region-native');
 if(!native)return;
 if(document.getElementById(ROOT))return;
 const root=document.createElement('div');root.id=ROOT;root.className='b737-sixpack-glareshield';root.setAttribute('aria-label','Boeing 737 Classic glareshield system annunciators');
 root.append(makeSeat('CAPT'),makeSeat('FO'));native.append(root);mounted=true;addInspector();paint();
 window.dispatchEvent(new CustomEvent('b737:sixpack-ready',{detail:{version:'SIXPACK-0001',independentLamps:12,masters:4}}));
}
window.B737SixPack=Object.freeze({
 version:'SIXPACK-0001',
 mount,
 getState:()=>Object.fromEntries(manual),
 getEffectiveState:()=>Object.fromEntries([...manual.keys()].map(k=>[k,visualTest||manual.get(k)])),
 setLight,setAll,setCombination,
 reset:()=>setAll(false,null,'reset'),
 setVisualTest:on=>{visualTest=!!on;paint();},
 getGeometry:()=>({region:'main',width:2100,height:920,left:{x:604,y:3,w:180,h:121},right:{x:1387,y:3,w:180,h:121}})
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