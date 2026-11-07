'use strict';
/* DOM-free browser-event smoke test for every rendered bus and consumer row.
 * No package install, visual images, or network access needed in CI.
 */
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const path=require('node:path');
const E=require('../engine/systems/electrical-v7.js');
const Core=require('../engine/systems/classic-bus-consumer-engine-v1.js');
const Lab=require('../engine/systems/classic-bus-consumer-test-lab-v1.js');
const index=require('../engine/systems/mrg-classic-340-consumer-bus-index-v1.json');
const dir=path.join(__dirname,'..','bus-consumer-test-lab');
const html=fs.readFileSync(path.join(dir,'index.html'),'utf8');
const js=fs.readFileSync(path.join(dir,'app.js'),'utf8');
class Element{
 constructor(tag='div'){
  this.tagName=tag.toUpperCase();this.style={};this.dataset={};
  this.children=[];this.listeners={};this.value='';
  this.title='';this.hidden=false;this.attributes={};this.className='';
  this.classList={toggle:(name,on)=>{const set=new Set(this.className.split(/\s+/).filter(Boolean));if(on)set.add(name);else set.delete(name);this.className=[...set].join(' ');}};
 }
 appendChild(el){this.children.push(el);return el;}
 append(el){return this.appendChild(el);}
 replaceChildren(...nodes){this.children=nodes.flatMap(x=>x.tagName==='FRAGMENT'?x.children:[x]);}
 setAttribute(name,value){this.attributes[name]=String(value);}
 getAttribute(name){return this.attributes[name]??null;}
 addEventListener(name,fn){(this.listeners[name]??=[]).push(fn);}
 trigger(name){for(const fn of this.listeners[name]||[])fn({target:this});}
 querySelector(selector){
  if(selector==='.bus-indicator')
   return this.children.find(x=>String(x.className).split(/\s+/).includes('bus-indicator'))||null;
  return null;
 }
}
const ids={};
for(const match of html.matchAll(/\bid="([^"]+)"/g))ids[match[1]]=new Element('div');
for(const [name,value] of Object.entries({
 modelSelect:'737-300',indicationSelect:'CONVENTIONAL',pressurizationSelect:'DCPCS',
 baselineSelect:'ALL_ON',searchInput:'',stateFilter:'ALL',systemFilter:'ALL'
}))ids[name].value=value;
const document={
 getElementById:id=>ids[id]||null,
 createElement:tag=>new Element(tag),
 createDocumentFragment:()=>new Element('fragment')
};
const root={
 B737ClassicBusConsumersV1:Core,
 B737ElectricalV7:E,
 B737BusConsumerTestLabV1:Lab,
 localStorage:{getItem(){return null;}}
};
const context={document,window:root,fetch:async ()=>({ok:true,json:async()=>index}),
 console,setTimeout,clearTimeout};
vm.runInNewContext(js,context,{filename:'bus-consumer-test-lab/app.js'});
function allChildren(el){const out=[];for(const child of el.children){out.push(child,...allChildren(child));}return out;}
async function test(){
 for(let i=0;i<6&&!root.B737BusConsumerTestLabUIV1;i++)await new Promise(r=>setImmediate(r));
 const api=root.B737BusConsumerTestLabUIV1;
 assert.ok(api,'UI was not initialized');
 assert.equal(api.listBusNames().length,26);
 const buttons=allChildren(ids.busList).filter(x=>x.tagName==='BUTTON');
 assert.equal(buttons.length,26);
 assert.equal(ids.consumerBody.children.length,340,'All 340 physical source entries are visible');
 assert.equal(ids.metricBusOn.textContent,'26 / 26');
 let fuel=ids.consumerBody.children.find(x=>x.dataset.consumer==='Fuel Boost Pump - Main Tank 1 Forward');
 assert.equal(fuel.dataset.state,'NORMAL');
 const main1=buttons.find(x=>x.dataset.bus==='main1@115VAC');
 assert.equal(main1.getAttribute('aria-pressed'),'true');
 main1.trigger('click');
 assert.equal(main1.getAttribute('aria-pressed'),'false');
 fuel=ids.consumerBody.children.find(x=>x.dataset.consumer==='Fuel Boost Pump - Main Tank 1 Forward');
 assert.equal(fuel.dataset.state,'OFF','Disconnected bus renders power loss as red source row');
 assert.equal(ids.metricOff.textContent,'17');
 main1.trigger('click');
 fuel=ids.consumerBody.children.find(x=>x.dataset.consumer==='Fuel Boost Pump - Main Tank 1 Forward');
 assert.equal(fuel.dataset.state,'NORMAL','Restored bus returns consumer to blue');
 ids.allOff.trigger('click');
 assert.equal(ids.metricBusOn.textContent,'0 / 26');
 assert.equal(ids.metricOn.textContent,'0');
 assert.equal(ids.metricOff.textContent,String(api.getSnapshot().coverage.activeRows));
 ids.allOn.trigger('click');
 assert.equal(ids.metricBusOn.textContent,'26 / 26');
 ids.devicesView.trigger('click');
 assert.equal(ids.consumerBody.children.length,322,'All 322 composite devices are shown');
 ids.rowsView.trigger('click');
 assert.equal(ids.consumerBody.children.length,340);
 ids.searchInput.value='N1';
 ids.searchInput.trigger('input');
 assert.ok(ids.consumerBody.children.length>=1&&ids.consumerBody.children.length<340);
 ids.searchInput.value='';
 ids.searchInput.trigger('input');
 assert.equal(ids.consumerBody.children.length,340);
 ids.cascadeSwitch.checked=true;
 ids.cascadeSwitch.trigger('change');
 assert.equal(api.getSession().cascade,true);
 ids.modelSelect.value='737-400';
 ids.modelSelect.trigger('change');
 assert.equal(api.getSnapshot().aircraftModel,'737-400');
 assert.equal(ids.labError.hidden,false,'No initialization errors were expected')
}
test().then(()=>console.log('PASS lab UI: 26 bus toggles, 340 red/blue consumers, 322 devices, search, cascade, variant')).
 catch(e=>{console.error(e);process.exitCode=1;});
