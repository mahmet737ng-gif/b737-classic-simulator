'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const C=require('../engine/tcas/classic-tcas-v2.js');
test('Unified start prepares both physical EHSIs; real ATC2 CB and independent bus/ADC selection affect reception',()=>{
 const listeners=new Map(),panels={CAPT:{mode:'PLAN',range:40,options:{tfc:false}},FO:{mode:'FULL_NAV',range:80,options:{tfc:false}}};
 let cb=true,bus1=true,bus2=true,adc1=true;
 const own={airborne:true,altitudeFt:10000,radioAltitudeFt:6000,tasKt:220,gsKt:220,pitchDeg:2,vsFpm:0,trueHeadingDeg:0,trueTrackDeg:0,elapsedSec:0};
 const win={B737ClassicTcasV2:C,document:{readyState:'loading',getElementById:()=>null,addEventListener(){}},
  B737UnifiedFlightScenarioV1:{getState:()=>own,getDiagnostics:()=>({active:true,lastPublishAgeMs:0})},
  B737UnifiedBusConsumerLiveV1:{getBus:id=>({powered:id==='electronic1'?bus1:bus2})},
  B737UnifiedCB:{closed:key=>{assert.equal(key,'P6-1|ALL|D16');return cb;}},
  B737UnifiedAvionicsNetworkV1:{getSnapshot:()=>Object.fromEntries(['airdata.adc1','airdata.adc2','airdata.radioAltitude1','airdata.radioAltitude2'].map(id=>[id,{quality:id==='airdata.adc1'&&!adc1?'INVALID':'VALID'}]))},
  B737IRSTrainerUnified:{getState:()=>({units:{L:{positionValid:true},R:{positionValid:true}}})},
  B737UnifiedEFISPedestalV1:{getState:s=>panels[s],operate(s,k,v){if(k==='tfc')panels[s].options.tfc=v;else panels[s][k]=v;}},
  addEventListener(k,fn){const a=listeners.get(k)||[];a.push(fn);listeners.set(k,a);},
  dispatchEvent(e){for(const f of listeners.get(e.type)||[])f(e);}};
 class CustomEvent{constructor(type,opt={}){this.type=type;this.detail=opt.detail;}}
 vm.runInNewContext(fs.readFileSync('panel-mosaic-lab/cockpit/tcas-training-unified-v1.js','utf8'),{window:win,CustomEvent});
 const api=win.B737UnifiedTcasV1;api.start('SAME_LEVEL');
 for(const p of Object.values(panels)){assert.equal(p.mode,'MAP');assert.equal(p.range,10);assert.equal(p.options.tfc,true);}
 // Pilot retains TFC authority after preparation; a flight tick never turns it back on.
 panels.CAPT.options.tfc=false;own.elapsedSec=24;win.dispatchEvent(new CustomEvent('b737:flight-scenario-state',{detail:own}));
 assert.equal(panels.CAPT.options.tfc,false);assert.equal(api.getState().advisory,'RA');
 api.configure({unit:2});cb=false;win.dispatchEvent(new CustomEvent('b737:cb-state-change'));
 assert.equal(api.getState().mode,'FAIL');assert.equal(api.getState().targets.length,0);
 api.configure({unit:1});assert.equal(api.getState().advisory,'RA');
 bus1=false;win.dispatchEvent(new CustomEvent('b737:bus-consumer-snapshot'));assert.equal(api.getState().mode,'FAIL');
 cb=true;api.configure({unit:2});assert.equal(api.getState().advisory,'RA');
 adc1=false;win.dispatchEvent(new CustomEvent('b737:efis-source-change'));assert.equal(api.getState().mode,'TA_ONLY');assert.equal(api.getState().ra,null);
 api.configure({altSource:2});assert.equal(api.getState().advisory,'RA');
 bus2=null;win.dispatchEvent(new CustomEvent('b737:bus-consumer-snapshot'));assert.equal(api.getState().mode,'FAIL','unknown supply never counts as powered');
  bus2=true;api.stop();assert.equal(api.getState().mode,'TA_RA','clearing traffic does not switch a healthy transponder off');assert.equal(api.getState().targets.length,0);
  api.configure({mode:'TEST'});assert.equal(api.getState().stage,'TEST OK');assert.equal(api.getState().transponder.displayedCode,'8888');
});

// Execute the standalone HTML's real ordered scripts, renderers and UI actions.
// Canvas commands are recorded rather than requiring a CI-specific browser or native library.
function lab(){
 const root=path.resolve('panel-mosaic-lab/cockpit/tcas-lab'),html=fs.readFileSync(path.join(root,'index.html'),'utf8'),nodes=new Map(),calls=[];
 class Node{
  constructor(tag='div'){this.tag=tag;this.attrs={};this.children=[];this.style={};this.dataset={};this.value='';this.checked=false;this.textContent='';this.ownerDocument=doc;}
  setAttribute(k,v){this.attrs[k]=String(v);}getAttribute(k){return this.attrs[k];}
  append(...n){this.children.push(...n);}appendChild(n){this.append(n);return n;}replaceChildren(...n){this.children=[...n];}add(n){this.append(n);}
  addEventListener(k,fn){this['on'+k]=fn;}getContext(){return ctx;}
 }
 const ctx=new Proxy({measureText:s=>({width:String(s).length*9})},{get:(o,k)=>o[k]??((...args)=>calls.push([k,...args])),set:(o,k,v)=>(o[k]=v,true)});
 const doc={readyState:'complete',createElement:t=>new Node(t),createElementNS:(_,t)=>new Node(t),createTextNode:text=>({textContent:text}),
  getElementById:id=>nodes.get(id)||null,querySelector:()=>null,querySelectorAll:()=>[],addEventListener(){},documentElement:{dataset:{}}};
 for(const m of html.matchAll(/<(input|select|button|canvas|svg|div|p|tbody)\b([^>]*\bid="([^"]+)"[^>]*)>/g)){
  const n=new Node(m[1]);n.id=m[3];n.value=m[2].match(/\bvalue="([^"]*)"/)?.[1]||'';n.checked=/\bchecked\b/.test(m[2]);n.width=n.height=640;nodes.set(n.id,n);
 }
 for(const m of html.matchAll(/<select\b[^>]*\bid="([^"]+)"[^>]*>([\s\S]*?)<\/select>/g)){
  const opts=[...m[2].matchAll(/<option([^>]*)>([^<]*)<\/option>/g)],selected=opts.find(x=>/selected/.test(x[1]))||opts[0];
  if(selected)nodes.get(m[1]).value=selected[1].match(/value="([^"]*)"/)?.[1]||selected[2];
 }
 const listeners=new Map(),win={document:doc,console,Math,Date,JSON,performance:{now:()=>0},requestAnimationFrame(){},setTimeout(){},clearTimeout(){},
  addEventListener(k,fn){listeners.set(k,fn);},dispatchEvent(e){listeners.get(e.type)?.(e);},Option:function(text,value){return {textContent:text,value};}};
 win.window=win;win.globalThis=win;const context=vm.createContext(win);
 for(const m of html.matchAll(/<script src="([^"]+)"/g)){
  const file=path.resolve(root,m[1].split('?')[0]);assert.ok(fs.existsSync(file),'missing lab dependency '+m[1]);vm.runInContext(fs.readFileSync(file,'utf8'),context,{filename:file});
 }
 return {nodes,calls};
}
test('standalone lab boots its actual script graph, renders TA and RA, responds, and isolates ATC power',()=>{
 const {nodes,calls}=lab(),by=id=>nodes.get(id);assert.ok(calls.some(c=>c[0]==='lineTo'));
 assert.equal(by('scenario').value,'SAME_LEVEL');assert.ok(by('ehsi').children.length);
 for(let i=0;i<6;i++)by('step').onclick();assert.match(by('status').textContent,/TA/);
 for(let i=0;i<18;i++)by('step').onclick();assert.match(by('status').textContent,/CLIMB/);
 by('respond').onclick();assert.ok(Number(by('pitch').value)>2);
 let cleared=false;for(let i=0;i<40;i++){by('step').onclick();if(/CLEAR OF CONFLICT/.test(by('status').textContent))cleared=true;}assert.ok(cleared,by('ownState').textContent+' / '+by('status').textContent);
 by('bus1').checked=false;by('bus1').onchange();assert.match(by('status').textContent,/FAIL/);
 by('unit').value='2';by('unit').onchange();assert.doesNotMatch(by('status').textContent,/FAIL/);
 by('atc2cb').checked=false;by('atc2cb').onchange();assert.match(by('status').textContent,/FAIL/);
});
