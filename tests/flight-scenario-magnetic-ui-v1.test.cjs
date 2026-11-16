'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const Core=require('../engine/flight/flight-scenario-core-v1.js');
const WMM=require('../engine/efis/wmm2025-magnetic-model-v1.js');
const code=fs.readFileSync(path.resolve(__dirname,'../panel-mosaic-lab/cockpit/flight-scenario-panel-v1.js'),'utf8');
function fixture(model=WMM){
 const elements={},events=[];
 const elt=(tag='div')=>({tag,value:'',dataset:{},disabled:false,options:[],listeners:{},textContent:'',
  addEventListener(k,cb){this.listeners[k]=cb;},setAttribute(){},
  appendChild(node){if(node.id)elements[node.id]=node;},
  append(node){if(node.id)elements[node.id]=node;},
  replaceChildren(){this.options=[];this.value='';},
  add(option){this.options.push(option);if(this.options.length===1)this.value=option.value;},
  showModal(){this.open=true;},close(){this.open=false;}
 });
 const header=elt('header'),body=elt('body');
 const document={readyState:'complete',body,
  createElement:tag=>elt(tag),
  querySelector:selector=>selector==='.unified-minimal-header .header-settings'?header:null,
  getElementById(id){
   if(id==='flightScenarioDialog'&&!elements[id])return null;
   if(!elements[id])elements[id]=elt();
   return elements[id];
  }};
 for(const [id,value] of Object.entries({flightAirport:'OIMM',flightPreset:'RUNWAY_READY',
  flightAirGround:'GROUND',flightHeading:'314',flightAlt:'3263',flightSpeed:'0',
  flightVS:'0',flightBank:'0'}))document.getElementById(id).value=value;
 const win={document,B737FlightScenarioCoreV1:Core,B737WMM2025V1:model,
  addEventListener(){},dispatchEvent:e=>events.push(e),setInterval(){return 1;}};
 class Option{constructor(label,value){this.label=label;this.value=value;}}
 class CustomEvent{constructor(type,opt={}){this.type=type;this.detail=opt.detail;}}
 vm.runInNewContext(code,{window:win,Option,CustomEvent,performance:{now:()=>1000},console});
 const get=id=>document.getElementById(id);
 return {win,get,events,click:id=>get(id).listeners.click?.()};
}
test('instructor controls and runway selections use MAG, not TRUE heading numbers',()=>{
 const f=fixture(),a=Core.AIRPORTS.OIMM;
 assert.ok(f.get('flightRunway').options.every(x=>x.label.includes('MAG')));
 assert.notEqual(Number(f.get('flightHeading').value),a.runways[a.defaultRunway]);
 assert.equal(Number(f.get('flightHeading').value),Math.round(WMM.trueToMag(
  a.runways[a.defaultRunway],WMM.evaluate({lat:a.lat,lon:a.lon,altitudeFt:a.elevationFt}).declinationDeg))%360));
});
test('manual magnetic 134 generates TRUE flight state and magnetic live readout; targets convert again',()=>{
 const f=fixture();
 f.get('flightAirport').value='OIII';
 f.get('flightRunway').value='29L';
 f.get('flightPreset').value='MANUAL';
 f.get('flightAirGround').value='AIRBORNE';
 f.get('flightAlt').value='8000';
 f.get('flightHeading').value='134';
 f.get('flightSpeed').value='200';f.get('flightVS').value='0';f.get('flightBank').value='0';
 f.click('flightLoad');
 const s=f.win.B737UnifiedFlightScenarioV1.getState();
 assert.equal(s.icao,'OIII');assert.equal(s.airborne,true);
 const varA=WMM.evaluate({lat:Core.AIRPORTS.OIII.lat,lon:Core.AIRPORTS.OIII.lon,altitudeFt:Core.AIRPORTS.OIII.elevationFt}).declinationDeg;
 assert.ok(Math.abs(s.trueHeadingDeg-(134+varA))<.03);
 assert.ok(f.get('flightOutHDG').textContent.includes('134° MAG'));
 assert.ok(f.get('flightOutVar').textContent.includes('E'));
 f.get('flightHeading').value='190';f.click('flightTargets');
 const next=f.win.B737UnifiedFlightScenarioV1.getState();
 const varNow=WMM.evaluate({lat:next.lat,lon:next.lon,altitudeFt:next.altitudeFt}).declinationDeg;
 assert.ok(Math.abs(next.target.headingDeg-(190+varNow))<.02);
});
test('unknown geomagnetic reference must NOT silently become 000-degree magnetic',()=>{
 const f=fixture({evaluate:()=>({valid:false}),trueToMag:()=>null,magToTrue:()=>null});
 assert.equal(f.get('flightHeading').value,'');
 assert.ok(f.get('flightRunway').options.every(x=>x.label.includes('MAG N/A')));
});
