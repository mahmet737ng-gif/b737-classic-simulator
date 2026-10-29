'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const Core=require('../engine/systems/tat-probe-v1.js');
const CB=require('../engine/cb/tat-probe-cb-link-v1.js');
const script=fs.readFileSync(path.join(__dirname,'../panel-mosaic-lab/cockpit/tat-test-lab-v1.js'),'utf8');
function el(id){
 const children=new Map();
 const e={id,name:id,children:[],style:{},dataset:{},open:false,textContent:'',innerHTML:'',disabled:false,
  listeners:{},attributes:{},setAttribute(k,v){this.attributes[k]=v;},addEventListener(n,fn){this.listeners[n]=fn;},
  append(...e){this.children.push(...e);},
  querySelector(x){if(!children.has(x))children.set(x,el(x));return children.get(x);},
  querySelectorAll(x){if(x!=='[data-tat-scenario]')return [];
   if(!this.scenarios)this.scenarios=['ground-off','ground-on','tat-test','heater-fail','sensor-fail','cb-pulled','ac-loss','dc-loss','flight','lamp-stuck'].map(id=>{
    const item=el(id);item.dataset.tatScenario=id;return item;});
   return this.scenarios;
  },
  showModal(){this.open=true;},close(){this.open=false;},
  getBoundingClientRect(){return {left:100,top:100,right:450,bottom:500};}
 };
 return e;
}
function setup(){
 let time=0,cb=false,lab=null,pulls=0;const body=el('body'),frameDocument=el('iframeDocument');
 const piece=el('OH15');
 frameDocument.querySelector=selector=>selector==='#atlasAbsolute .atlas-piece[data-key="OH15"]'?piece:null;
 const iframe=el('overheadFrame');
 iframe.contentDocument=frameDocument;
 const targetCb=el('cbPanelOpen');
 const doc={readyState:'complete',baseURI:'https://example.test/panel-mosaic-lab/cockpit/',
  body,createElement(name){const e=el(name);if(name==='dialog')lab=e;return e;},
  getElementById(name){if(name==='overheadFrame')return iframe;if(name==='cbPanelOpen')return targetCb;return null;}};
 const tat={
  getCbState(){return {pulled:cb,tripped:false,fault:null};},
  setCbPulled(v){cb=v;pulls++;return {ok:true,state:{pulled:cb}};}
 };
 const win={B737TATProbeV1:Core,B737TATProbeUnifiedV1:tat,
  addEventListener(){}};
 const context={window:win,document:doc,performance:{now:()=>time},setInterval:()=>1,setTimeout:()=>1,URL};
 vm.runInNewContext(script,context,{filename:'tat-test-lab-v1.js'});
 const pointer=(type,x=200,y=250,id=1,ptype='mouse')=>{
  const ev={pointerType:ptype,pointerId:id,button:0,clientX:x,clientY:y};
  const fn=frameDocument.listeners[type];assert.equal(typeof fn,'function',type+' must be captured');
  fn(ev);
 };
 const click=(x,y,dur=40)=>{pointer('pointerdown',x,y);time+=dur;pointer('pointerup',x,y);time+=150;};
 return {get lab(){return lab;},api:win.B737TATTestLabV1,tat,click,pointer,advance:v=>time+=v,pulled:()=>cb,pullCount:()=>pulls};
}
test('Three short distinct taps directly on rendered OH15 open original-photo TAT lab',()=>{
 const h=setup();
 assert.ok(h.lab,'lab is mounted');
 assert.equal(h.lab.open,false);
 h.click(180,210);h.click(180,210);assert.equal(h.lab.open,false);
 h.click(180,210);assert.equal(h.lab.open,true);
 assert.ok(h.api.asset.includes('/assets/locked/2026-10-23/OH15-WINDOW-PITOT-'));
 assert.ok(h.lab.innerHTML.includes('img src='));
});
test('Outside-panel triple clicks and drags never open lab',()=>{
 const h=setup();
 for(let i=0;i<3;i++)h.click(60,80);
 assert.equal(h.lab.open,false);
 for(let i=0;i<3;i++){h.pointer('pointerdown',150,200);h.pointer('pointerup',350,405);h.advance(80);}
 assert.equal(h.lab.open,false);
});
test('All scenarios are modelled independently with original Core, not altered live state',()=>{
 const h=setup(),api=h.api;
 assert.equal(api.setScenario('ground-on'),true);
 assert.equal(api.output().amberOn,false);
 assert.equal(api.output().heaterPower,false);
 api.setScenario('tat-test');
 assert.equal(api.output().amberOn,false);
 assert.equal(api.output().heaterPower,true);
 api.setScenario('heater-fail');assert.equal(api.output().amberOn,true);
 api.setScenario('sensor-fail');assert.equal(api.output().heaterPower,true);
 assert.equal(api.output().amberOn,true);
 api.setScenario('ac-loss');assert.equal(api.output().amberOn,true);
 api.setScenario('dc-loss');assert.equal(api.output().amberOn,false);
 api.setScenario('flight');assert.equal(api.output().heaterPower,true);
 api.setScenario('cb-pulled');assert.equal(api.output().cbClosed,false);
 assert.equal(h.pulled(),false,'virtual scenario must NOT pull real CB');
});
test('Real CB panel pull and push are reflected in TAT test lab while scenario flags stay separate',()=>{
 const h=setup();h.api.setScenario('tat-test');
 assert.equal(h.api.output().heaterPower,true);
 h.api.realCB().pulled;h.tat.setCbPulled(true);h.api.refresh();
 assert.equal(h.api.output().heaterPower,false);
 assert.equal(h.api.output().amberOn,true);
 h.tat.setCbPulled(false);h.api.refresh();
 assert.equal(h.api.output().heaterPower,true);
});
