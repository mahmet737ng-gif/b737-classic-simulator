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
const Protocol=require('../engine/systems/unified-bus-failure-injection-v1.js');
const index=require('../engine/systems/mrg-classic-340-consumer-bus-index-v1.json');
const dir=path.join(__dirname,'..','bus-consumer-test-lab');
// Test the actual user-facing, cache-isolated v2 page rather than a source
// fixture that an older GitHub Pages edge could still have cached.
const html=fs.readFileSync(path.join(dir,'v3.html'),'utf8');
assert.match(html,/name="b737-bus-lab-revision" content="BUSLAB24-INJECT-0009"/);
assert.equal((html.match(/v=BUSLAB24-INJECT-0009/g)||[]).length,6,
 'All CSS and JS dependencies must share the same never-before-used asset revision');
assert.match(html,/24 BUS NODES/);
assert.doesNotMatch(html,/26 BUS NODES/);
const js=fs.readFileSync(path.join(dir,'app.js'),'utf8');
class Element{
 constructor(tag='div'){
  this.tagName=tag.toUpperCase();this.style={};this.dataset={};
  this.children=[];this.listeners={};this.value='';
  this.title='';this.hidden=false;this.attributes={};this.className='';
  this._textContent='';
  this.classList={toggle:(name,on)=>{const set=new Set(this.className.split(/\s+/).filter(Boolean));if(on)set.add(name);else set.delete(name);this.className=[...set].join(' ');}};
 }
 set textContent(value){this._textContent=String(value);}
 get textContent(){return this._textContent;}
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
ids.labError.hidden=true;
for(const [name,value] of Object.entries({
 baselineSelect:'ALL_ON',searchInput:'',stateFilter:'ALL',systemFilter:'ALL'
}))ids[name].value=value;
const document={
 getElementById:id=>ids[id]||null,
 createElement:tag=>new Element(tag),
 createDocumentFragment:()=>new Element('fragment')
};
const storage=new Map();
const root={
 B737ClassicBusConsumersV1:Core,
 B737ElectricalV7:E,
 B737BusConsumerTestLabV1:Lab,
 B737UnifiedBusFailureInjectionV1:Protocol,
 localStorage:{getItem(key){return storage.get(key)||null;},setItem(key,val){storage.set(key,val);}}
};
const context={document,window:root,fetch:async ()=>({ok:true,json:async()=>index}),
 console,setTimeout,clearTimeout};
vm.runInNewContext(js,context,{filename:'bus-consumer-test-lab/app.js'});
function allChildren(el){const out=[];for(const child of el.children){out.push(child,...allChildren(child));}return out;}
async function test(){
 for(let i=0;i<6&&!root.B737BusConsumerTestLabUIV1;i++)await new Promise(r=>setImmediate(r));
 const api=root.B737BusConsumerTestLabUIV1;
 assert.ok(api,'UI was not initialized');
 assert.equal(api.listBusNames().length,24);
 const buttons=allChildren(ids.busList).filter(x=>x.tagName==='BUTTON');
 assert.equal(buttons.length,24);
 const standby=buttons.filter(x=>x.dataset.bus?.startsWith('standby@'));
 assert.equal(standby.length,2,'Exactly AC and DC standby buses are clickable');
 assert.ok(standby.some(x=>x.children.some(c=>c.textContent==='AC STBY BUS')));
 assert.ok(standby.some(x=>x.children.some(c=>c.textContent==='DC STBY BUS')));
 assert.equal(new Set(Object.values(api.getSnapshot().consumers).map(x=>x.system)).has('OTHER'),false);
 assert.equal(ids.consumerBody.children.length,340,'All 340 physical source entries are visible');
 assert.equal(ids.metricBusOn.textContent,'24 / 24');
 let fuel=ids.consumerBody.children.find(x=>x.dataset.consumer==='Fuel Boost Pump - Main Tank 1 Forward');
 assert.equal(fuel.dataset.state,'NORMAL');
 const main1=buttons.find(x=>x.dataset.bus==='main1@115VAC');
 assert.equal(main1.getAttribute('aria-pressed'),'true');
 main1.trigger('click');
 assert.equal(main1.getAttribute('aria-pressed'),'false');
 fuel=ids.consumerBody.children.find(x=>x.dataset.consumer==='Fuel Boost Pump - Main Tank 1 Forward');
 assert.equal(fuel.dataset.state,'OFF','Disconnected bus renders power loss as red source row');
 assert.ok(Number(ids.metricOff.textContent)>0);
 main1.trigger('click');
 fuel=ids.consumerBody.children.find(x=>x.dataset.consumer==='Fuel Boost Pump - Main Tank 1 Forward');
 assert.equal(fuel.dataset.state,'NORMAL','Restored bus returns consumer to blue');
 ids.allOff.trigger('click');
 assert.equal(ids.metricBusOn.textContent,'0 / 24');
 assert.equal(ids.metricOn.textContent,'0');
 assert.equal(ids.metricOff.textContent,String(api.getSnapshot().coverage.activeRows));
 ids.allOn.trigger('click');
 assert.equal(ids.metricBusOn.textContent,'24 / 24');
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
 assert.equal(api.getSnapshot().coverage.NOT_INSTALLED,0,'All variants and configurations shown');
 assert.equal(ids.consumerBody.children.length,340);
 assert.ok(ids.consumerBody.children.some(x=>x.dataset.consumer==='Temp. Control - aft cabin (400)'));
 assert.doesNotMatch(html,/id="modelSelect"/);
 assert.doesNotMatch(html,/id="indicationSelect"/);
 assert.doesNotMatch(html,/id="pressurizationSelect"/);
 ids.allOff.trigger('click');
 ids.injectToCockpit.trigger('click');
 const injected=JSON.parse(storage.get(Protocol.KEY));
 assert.equal(injected.active,true,'The user manually injects the failed buses');
 assert.equal(injected.offBusKeys.length,24);
 assert.equal(ids.injectionStatus.dataset.injected,'true');
 ids.clearCockpitFailures.trigger('click');
 const cleared=JSON.parse(storage.get(Protocol.KEY));
 assert.equal(cleared.active,false);
 assert.deepEqual(cleared.offBusKeys,[]);
 assert.equal(ids.injectionStatus.dataset.injected,'false');
 assert.equal(ids.labError.hidden,true,'No initialization or interaction errors were expected')
}
test().then(()=>console.log('PASS lab UI: 24 bus toggles, 340 red/blue consumers, 322 devices, search, cascade, manual cross-tab Inject/Clear')).
 catch(e=>{console.error(e);process.exitCode=1;});
