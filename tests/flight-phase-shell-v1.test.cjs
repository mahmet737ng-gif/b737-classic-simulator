'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const read=p=>fs.readFileSync(p,'utf8');
const html=read('panel-mosaic-lab/cockpit/index.html');
const controller=read('panel-mosaic-lab/cockpit/flight-scenario-panel-v1.js');
const shell=read('panel-mosaic-lab/cockpit/flight-scenario-shell-v1.js');
test('original FLT PHASE entry and complete dialog exist before flight scripts run; only inner phase selector is absent',()=>{
 const view=html.match(/<dialog id="flightScenarioDialog"[^>]*>([\s\S]*?)<\/dialog>/)?.[1];
 assert.ok(view);assert.equal((html.match(/id="flightScenarioHeader"/g)||[]).length,1);
 assert.equal((html.match(/id="flightScenarioDialog"/g)||[]).length,1);
 for(const id of ['flightAirport','flightRunway','flightPreset','flightAlt','flightHeading','flightSpeed','flightVS','flightBank','flightLat','flightLon','flightLoad','flightTargets','flightTakeoff','flightPause','flightStop','flightFollowMCP','flightTelemetry'])
  assert.ok(view.includes('id="'+id+'"'),id+' must remain available');
 assert.doesNotMatch(view,/flightAirGround/);
});
test('main window opens without flight dependencies, then existing controls initialize and load a flight',()=>{
 const nodes=new Map();let createdDialogs=0;
 const node=id=>({id,dataset:{},style:{},value:'',textContent:'',options:[],handlers:{},
  addEventListener(k,fn){(this.handlers[k]??=[]).push(fn);},setAttribute(){},
  appendChild(n){nodes.set(n.id,n);},showModal(){this.open=true;},close(){this.open=false;},
  replaceChildren(){this.options=[];this.value='';},add(opt){this.options.push(opt);if(this.options.length===1)this.value=opt.value;}});
 for(const [,id] of html.matchAll(/id="(flight[^"]+)"/g))nodes.set(id,node(id));
 Object.assign(nodes.get('flightAirport'),{value:'OIMM'});nodes.get('flightPreset').value='RUNWAY_READY';
 const header=node('header'),body=node('body');
 const document={readyState:'complete',body,getElementById:id=>nodes.get(id)||null,
  querySelector:s=>s==='.unified-minimal-header .header-settings'?header:null,
  createElement(tag){if(tag==='dialog')createdDialogs++;return node('');},addEventListener(){}};
 const win={document,setInterval:()=>1,dispatchEvent(){},
  B737WMM2025V1:require('../engine/efis/wmm2025-magnetic-model-v1.js')};
 const context={window:win,document,performance:{now:()=>1000},console,
  Option:class {constructor(label,value){this.label=label;this.value=value;}},
  CustomEvent:class {constructor(type,opt={}){this.type=type;this.detail=opt.detail;}}};
 vm.runInNewContext(shell,context);
 const fire=(id,type='click')=>{for(const fn of nodes.get(id).handlers[type]||[])fn({target:nodes.get(id)});};
 fire('flightScenarioHeader');assert.equal(nodes.get('flightScenarioDialog').open,true);
 fire('flightScenarioClose');assert.equal(nodes.get('flightScenarioDialog').open,false);
 win.B737FlightScenarioCoreV1=require('../engine/flight/flight-scenario-core-v1.js');
 vm.runInNewContext(controller,context);
 assert.equal(createdDialogs,0,'reuse the original full window instead of bailing out or replacing it');
 assert.equal(nodes.get('flightScenarioHeader').handlers.click.length,1,'one persistent launcher binding');
 nodes.get('flightPreset').value='FINAL_5';fire('flightPreset','change');fire('flightLoad');
 assert.equal(win.B737UnifiedFlightScenarioV1.getState().airborne,true);
 assert.equal(win.B737UnifiedFlightScenarioV1.getState().icao,'OIMM');
 fire('flightPause');assert.equal(win.B737UnifiedFlightScenarioV1.getDiagnostics().paused,true);
 fire('flightScenarioHeader');assert.equal(nodes.get('flightScenarioDialog').open,true);
});
