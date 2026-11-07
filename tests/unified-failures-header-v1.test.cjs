'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const Failures=require('../panel-mosaic-lab/cockpit/failures-header-v1.js');
const Protocol=require('../engine/systems/unified-bus-failure-injection-v1.js');
const Electrical=require('../engine/systems/electrical-v7.js');
const base=path.resolve(__dirname,'..');
const html=fs.readFileSync(path.join(base,'panel-mosaic-lab/cockpit/index.html'),'utf8');
const css=fs.readFileSync(path.join(base,'panel-mosaic-lab/cockpit/failures-header-v1.css'),'utf8');
const header=html.match(/<header class="unified-minimal-header">([\s\S]*?)<\/header>/)?.[1]||'';
assert.match(header,/id="failuresHeaderOpen"/);
assert.ok(header.indexOf('groundPowerHeader')<header.indexOf('failuresHeaderOpen'),
 'FAILURES must remain alongside Ground Power');
assert.match(html,/failures-header-v1\.js\?v=FAILURES-HEADER-0001/);
assert.match(html,/failures-header-v1\.css\?v=FAILURES-HEADER-0001/);
assert.match(css,/#failuresHeaderPopover\[hidden\]/);
assert.match(css,/touch-action:manipulation/);
assert.equal(Failures.ids().length,24);
assert.equal(new Set(Failures.ids()).size,24);
assert.deepEqual(new Set(Failures.ids()),new Set(Protocol.BUS_KEYS));
assert.equal(Failures.label('standby@115VAC'),'AC STBY BUS');
assert.equal(Failures.label('standby@28VDC'),'DC STBY BUS');
assert.deepEqual(Failures.nextOffKeys([],'main1@115VAC',true,Protocol.BUS_KEYS),['main1@115VAC']);
assert.deepEqual(Failures.nextOffKeys(['main1@115VAC'],'main1@115VAC',false,Protocol.BUS_KEYS),[]);
assert.throws(()=>Failures.nextOffKeys([],'unknown@115VAC',true,Protocol.BUS_KEYS),/Invalid electrical/);

class Element{
 constructor(tag){
  this.tagName=tag.toUpperCase();this.children=[];this.parentElement=null;
  this.hidden=false;this.dataset={};this.attrs={};this.listeners={};
  this.textContent='';this.style={};this.disabled=false;this.className='';
 }
 append(child){this.children.push(child);child.parentElement=this;}
 setAttribute(name,value){this.attrs[name]=String(value);}
 getAttribute(name){return this.attrs[name];}
 addEventListener(name,fn){(this.listeners[name]??=[]).push(fn);}
 trigger(name,event={}){for(const fn of this.listeners[name]||[])fn({target:this,...event});}
 contains(needle){return needle===this||this.children.some(c=>c.contains(needle));}
 querySelector(selector){
  if(selector==='[data-indicator]')return descend(this).find(x=>x.dataset.indicator==='true')||null;
  return null;
 }
 focus(){this.focused=true;}
}
function descend(el){return el.children.flatMap(child=>[child,...descend(child)]);}
const trigger=new Element('button');trigger.id='failuresHeaderOpen';
const listeners={},docListeners={},storage=new Map();
const document={
 readyState:'complete',body:new Element('body'),
 getElementById:id=>id==='failuresHeaderOpen'?trigger:null,
 querySelector:()=>null,
 createElement:tag=>new Element(tag),
 addEventListener:(ev,fn)=>{(docListeners[ev]??=[]).push(fn);}
};
const win={
 document,B737ElectricalV7:Electrical,
 localStorage:{
  getItem:k=>storage.get(k)||null,
  setItem:(k,v)=>storage.set(k,v)
 },
 CustomEvent:class{constructor(type,options){this.type=type;this.detail=options?.detail;}},
 addEventListener:(ev,fn)=>{(listeners[ev]??=[]).push(fn);},
 dispatchEvent:event=>{for(const fn of listeners[event.type]||[])fn(event);}
};
const live=Protocol.install(win);
assert.ok(live);
win.B737UnifiedBusFailureInjectionV1={...Protocol,live};
const hub=Failures.install(win);
assert.ok(hub?.installed,'FAILURES top-bar menu must install without a second Electrical engine');
const panel=document.body.children.find(el=>el.id==='failuresHeaderPopover');
assert.ok(panel,'FAILURES flyout exists');
assert.equal(panel.hidden,true);
const electrical=descend(panel).find(el=>el.id==='failuresElectricalBranch');
assert.ok(electrical,'Electrical is a dedicated expandable branch');
assert.equal(electrical.tagName,'DETAILS');
assert.equal(electrical.open,undefined,'Electrical starts closed by default');
const buttons=descend(panel).filter(el=>el.tagName==='BUTTON'&&el.dataset.bus);
assert.equal(buttons.length,24,'All 24 actual buses must be individually selectable');
const main1=buttons.find(el=>el.dataset.bus==='main1@115VAC');
const main2=buttons.find(el=>el.dataset.bus==='main2@115VAC');
assert.ok(main1&&main2);
const machine=Electrical.initialState({coldDark:false});
const originalState=JSON.stringify(machine),source1=Electrical.evaluate(machine).source[1];
trigger.trigger('click');
assert.equal(panel.hidden,false);
assert.equal(trigger.getAttribute('aria-expanded'),'true');
main1.trigger('click');
assert.equal(live.get().active,true);
assert.deepEqual(live.get().offBusKeys,['main1@115VAC']);
assert.equal(win.B737ElectricalV7.evaluate(machine).bus.main1,false);
assert.equal(win.B737ElectricalV7.evaluate(machine).bus.main2,true);
assert.equal(main1.dataset.failed,'true');
assert.equal(main1.getAttribute('aria-pressed'),'true');
assert.equal(trigger.dataset.failureCount,'1');
main2.trigger('click');
assert.deepEqual(new Set(live.get().offBusKeys),new Set(['main1@115VAC','main2@115VAC']));
assert.equal(trigger.textContent,'FAILURES (2)');
for(const fn of docListeners.keydown||[])fn({key:'Escape'});
assert.equal(panel.hidden,true);
assert.equal(trigger.getAttribute('aria-expanded'),'false');
trigger.trigger('click');
assert.equal(main1.dataset.failed,'true','Injected failure persists after reopening menu');
main1.trigger('click');
assert.deepEqual(live.get().offBusKeys,['main2@115VAC'],
 'Removing a single bus failure must not accidentally restore another bus');
const clear=descend(panel).find(el=>el.className==='failures-clear');
assert.ok(clear);
clear.trigger('click');
assert.equal(live.get().active,false);
assert.deepEqual(live.get().offBusKeys,[]);
assert.equal(win.B737ElectricalV7.evaluate(machine).bus.main1,true);
assert.equal(win.B737ElectricalV7.evaluate(machine).bus.main2,true);
assert.equal(win.B737ElectricalV7.evaluate(machine).source[1],source1,
 'Injected bus failures never alter generator source selection');
assert.equal(JSON.stringify(machine),originalState,
 'No writes to the simulator physical electrical state');
assert.equal(trigger.textContent,'FAILURES');
assert.equal(clear.disabled,true);
assert.equal(main1.dataset.failed,'false');
assert.equal(main2.dataset.failed,'false');
const external=Protocol.payload(['standby@115VAC','electronic2@28VDC']);
const serialized=JSON.stringify(external);storage.set(Protocol.KEY,serialized);
for(const handler of listeners.storage||[])handler({key:Protocol.KEY,newValue:serialized});
assert.equal(trigger.dataset.failureCount,'2','Cross-tab scenarios must update the header immediately');
assert.equal(buttons.find(x=>x.dataset.bus==='standby@115VAC').dataset.failed,'true');
assert.equal(buttons.find(x=>x.dataset.bus==='electronic2@28VDC').dataset.failed,'true');
hub.clearAll();
assert.equal(trigger.dataset.failureCount,'0');
console.log('PASS FAILURES header: independent 24-bus electrical branch, toggles, cross-tab sync, state persistence and clear without touching cockpit source or engine');
