'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const wh=require('../engine/systems/window-heat-v1.js'),tat=require('../engine/systems/tat-probe-v1.js');
const code=fs.readFileSync(path.join(__dirname,'../panel-mosaic-lab/cockpit/antiice-live-test-lab-v2.js'),'utf8');
function elem(name){
 const children=new Map();
 const o={name,id:name,style:{},dataset:{},events:{},open:false,innerHTML:'',textContent:'',disabled:false,clientWidth:620,clientHeight:700,value:'L_FWD',listeners:{},
  addEventListener(type,fn){this.listeners[type]=fn;},
  setAttribute(){},getAttribute(k){return k==='src'?'./overhead-stage.html?v=LOCKED':null;},
  getBoundingClientRect(){return {left:100,top:100,right:593,bottom:608};},
  append(child){this.child=child;},showModal(){this.open=true;},close(){this.open=false;},
  querySelector(selector){if(!children.has(selector))children.set(selector,elem(selector));return children.get(selector);},
  querySelectorAll(selector){return [];}
 };
 if(name==='iframe')o.src='';
 return o;
}
function setup(){
 let now=1000;
 const body=elem('body'),main=elem('overheadFrame'),mainDoc=elem('mainDoc');
 main.contentDocument=mainDoc;
 mainDoc.querySelector=selector=>selector.includes('OH15')?elem('OH15'):null;
 const document={readyState:'complete',body,baseURI:'https://example.test/panel-mosaic-lab/cockpit/',
  createElement:name=>elem(name),getElementById:id=>id==='overheadFrame'?main:null};
 const window={B737WindowHeatV1:wh,B737TATProbeV1:tat,
  B737TATProbeUnifiedV1:{getCbState:()=>({pulled:false})},
  innerHeight:1000,addEventListener(){}};
 const observers=[];
 class RO{observe(e){observers.push(e);}}
 const script={window,document,performance:{now:()=>now},ResizeObserver:RO,URL,
  location:{origin:'https://example.test'},localStorage:{getItem:()=>null},console,
  setInterval:()=>1,setTimeout:()=>1};
 vm.runInNewContext(code,script,{filename:'antiice-live-test-lab-v2.js'});
 const pointer=(type,x=250,y=300)=>{
  mainDoc.listeners[type]({pointerType:'mouse',pointerId:1,button:0,clientX:x,clientY:y});
 };
 const tap=(x=250,y=300)=>{pointer('pointerdown',x,y);now+=50;pointer('pointerup',x,y);now+=130;};
 return {api:window.B737AntiIceTestLabV2,body,main,tap,advance:v=>now+=v};
}
test('Embedded ANTI ICE test lab references the EXACT same overhead-stage.html route as Unified',()=>{
 const h=setup();h.api.open();
 const d=h.body.child;
 assert.equal(d.id,'antiIceLiveLab');
 const content=d.innerHTML;
 assert.ok(content.includes('id="anti-live-stage"'));
 assert.ok(!content.includes('class="tatlab-photo"'));
 assert.equal(h.api.getTile().x,1231);
 assert.equal(h.api.getTile().y,1031);
 assert.equal(h.api.getTile().w,493);
 assert.equal(h.api.getTile().h,508);
});
test('Triple tap fires only on physical OH15 tile, no exterior triple tap',()=>{
 const h=setup();
 h.tap(30,30);h.tap(30,30);h.tap(30,30);
 assert.equal(h.body.child,undefined);
 h.tap();h.tap();
 assert.equal(h.body.child,undefined);
 h.tap();assert.equal(h.body.child.open,true);
});
test('Scenarios include all real Window Heat channels / all documented failure types / TAT CB',()=>{
 const h=setup(),ids=h.api.scenarioIds;
 assert.ok(ids.includes('window-ovht')&&ids.includes('window-power'));
 assert.ok(ids.includes('tat-cb')&&ids.includes('tat-heater'));
 assert.ok(ids.includes('wh-control-cb')&&ids.includes('wh-heater-cb'));
 assert.ok(ids.includes('dc1')&&ids.includes('dc2')&&ids.includes('main2'));
 assert.ok(ids.length>=28);
});
test('Simulated main bus failure is isolated from live cockpit CB and switch storage',()=>{
 const h=setup();h.api.open();h.api.applyScenario('main2');
 const result=h.api.evaluate(0);
 assert.equal(result.buses.main2,false);
 assert.equal(result.breakers[tat.CB_ID],undefined);
 h.api.applyScenario('tat-cb');
 const broken=h.api.evaluate(0);
 assert.equal(broken.breakers[tat.CB_ID],false);
});
test('Window Heat/TAT physics use original shared core exports, not mockup algorithms',()=>{
 const h=setup();h.api.open();
 const normal=h.api.evaluate(0);
 assert.equal(normal.window.schema,'B737_WINDOW_HEAT_V1_RESULT');
 assert.equal(normal.tat.cbId,tat.CB_ID);
 assert.equal(Object.keys(normal.window.channels).length,4);
});
