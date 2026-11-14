/* HEADLESS INTEGRATION REGRESSION — real Unified adapter + selector snapshots.
 * Avoid editing any locked atlas/guard files. Run with node --test.
 */
const test=require('node:test'),assert=require('node:assert/strict'),
 fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const Model=require('../../engine/systems/air-mix-valve-300500-v1.js');
class Element{
 constructor(name){this.name=name;this.children=[];this.attrs={};this.style={};this.isConnected=false;}
 setAttribute(key,value){this.attrs[key]=String(value);}
 getAttribute(key){return this.attrs[key]??null;}
 append(el){el.isConnected=true;this.children.push(el);}
 querySelector(q){return q.startsWith('[data-air-mix-rotor]')
  ?this.children.find(el=>el.attrs['data-air-mix-rotor']):null;}
}
function fixture(){
 const strip=new Element('strip');Object.assign(strip.style,{left:'0px',top:'0px',width:'493px',height:'508px'});
 const plate=new Element('plate');Object.assign(plate.style,{left:'1724px',top:'1031px'});
 plate.querySelector=q=>q==='.atlas-source-strip'?strip:null;
 const host=new Element('host');host.querySelector=q=>q==='.atlas-piece[data-key="OH20"]'?plate:null;
 let rotaries={'control-cabin-temp':'MANUAL WARM','pass-cabin-temp':'MANUAL COOL'};
 const child={B737RotaryGuards:{getState:()=>({rotaries})},
  B737OverheadToggles:{getState:()=>({'pack-l':'OFF','pack-r':'OFF'})}};
 const doc={baseURI:'https://example.com/cockpit/',readyState:'complete',
  createElementNS:(_,tag)=>new Element(tag),
  getElementById:id=>id==='overheadFrame'?frame:id==='atlasAbsolute'?host:null};
 const frame={contentWindow:child,contentDocument:doc,addEventListener(){}};
 let now=0,timer=null;
 const listeners={};
 const win={B737AirMixValve300500V1:Model,
  B737AircraftProfileStore:{get:()=>({aircraftFamily:'B737-300-500',pressurization:'CPCS'})},
  addEventListener:(type,fn)=>listeners[type]=fn,dispatchEvent(){}};
 const context={window:win,document:doc,URL,location:{origin:'https://example.com'},
  localStorage:{getItem:()=>null},performance:{now:()=>now},
  setInterval:fn=>{timer=fn;},CustomEvent:function(){}};
 vm.runInNewContext(fs.readFileSync(path.join(__dirname,'air-mix-valve-300500-unified-v1.js'),'utf8'),context);
 const api=win.B737AirMix300500UnifiedV1;
 const advance=(seconds)=>{for(let i=0;i<Math.ceil(seconds*4);i++){now+=250;timer();}};
 const assembly=side=>host.children[0].children.find(n=>n.attrs['data-air-mix-side']===side);
 const rotor=side=>assembly(side).children.find(n=>n.attrs['data-air-mix-rotor']===side).attrs.transform;
 const conceal=side=>assembly(side).children.find(n=>n.attrs['data-photo-pointer-mask']===side).attrs.transform;
 return {api,advance,rotor,conceal,assembly,host,setRotaries:r=>{rotaries=r;}};
}
test('native pivot rotation + selectors: bench PACK OFF responds in both directions',()=>{
 const f=fixture();f.api.setTrainingPower(true);f.advance(6);
 assert.equal(f.api.getState().engine.positions.CONT,1);
 assert.ok(f.api.getState().engine.positions.PASS<.00001);
 assert.equal(f.rotor('CONT'),'rotate(64.000 0 0)');
 assert.equal(f.rotor('PASS'),'rotate(-64.000 0 0)');
 assert.equal(f.host.children.length,1,'one idempotent overlay layer');
 assert.equal(f.assembly('CONT').attrs.transform,'translate(226 423)');
 assert.equal(f.assembly('PASS').attrs.transform,'translate(1023 423)');
 assert.equal(f.conceal('CONT'),'translate(-2 2)');
 assert.equal(f.conceal('PASS'),'translate(-2 2)');
 f.setRotaries({'control-cabin-temp':'AUTO COOL','pass-cabin-temp':'AUTO WARM'});
 f.advance(4);
 assert.equal(f.api.getState().engine.command.CONT,'COLD');
 assert.equal(f.api.getState().engine.command.PASS,'HOT');
 assert.ok(f.api.getState().engine.positions.CONT<1);
 assert.ok(f.api.getState().engine.positions.PASS>0);
 assert.equal(f.api.getState().inputs.CONT.benchSensor,true);
});
test('in non-bench mode PACK OFF has higher priority; CB is still authoritative',()=>{
 const f=fixture();f.api.setTrainingPower(false);f.advance(3);
 assert.equal(f.api.getState().engine.reason.CONT,'ACTUATOR_UNPOWERED');
 assert.equal(f.api.getState().trainingPower,false);
});
