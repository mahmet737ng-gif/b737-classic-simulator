'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const core=require('./residual-volts-model-v1.js');
assert.equal(core.version,'RESID-0001-SAFE-MOMENTARY');
const x=core.create();
assert.equal(x.snapshot().pressed,false);
assert.equal(x.evaluate().acVolts,null,'no fake residual data');
x.configure('GEN1',{gcr:'CLOSED',drive:'RUNNING',normalVolts:115});
assert.equal(x.evaluate().acVolts,115,'normal 115V is a valid explicit sample');
x.setPress(true);
assert.equal(x.evaluate().status,'UNSAFE_OVER_RANGE','live field must inhibit 30V meter path');
assert.equal(x.evaluate().acVolts,null);
x.setPress(false);
assert.equal(x.evaluate().scale,'NORMAL');
x.configure('GEN1',{gcr:'OPEN',drive:'RUNNING',fieldExcited:false,measuredResidual:null});
x.setPress(true);
assert.equal(x.evaluate().status,'NO_SENSOR','discrete GCR open is not a voltage sensor');
x.setMode('TRAINER_FIXTURE');
assert.equal(x.evaluate().acVolts,18,'explicit trainer-only CSD preset');
assert.equal(x.evaluate().fixture,true);
x.configure('GEN1',{drive:'DISCONNECTED'});
assert.equal(x.evaluate().acVolts,4,'trainer-only disconnected preset');
x.configure('GEN1',{drive:'STOPPED'});
assert.equal(x.evaluate().acVolts,null,'stopped drives cannot claim a live fixture');
x.configure('GEN1',{drive:'RUNNING',technology:'VSCF'});
assert.equal(x.evaluate().acVolts,17,'VSCF separate teaching fixture');
x.setMode('MEASURED');x.configure('GEN1',{measuredResidual:12});
assert.equal(x.evaluate().acVolts,12,'real explicit source sample passes');
assert.equal(x.evaluate().method,'SOURCE_MEASUREMENT');
x.configure('GEN1',{measuredResidual:45});
assert.equal(x.evaluate().status,'UNSAFE_OVER_RANGE','excessive sample must not saturate to 30V');
assert.equal(x.evaluate().acVolts,null);
x.configure('GEN1',{measuredResidual:null,failed:true});
assert.equal(x.evaluate().status,'SOURCE_FAULT');
x.configure('GEN1',{failed:false,measuredResidual:null,gcr:'CLOSED',drive:'UNKNOWN'});
assert.equal(x.evaluate().status,'UNSAFE_OVER_RANGE','closed GCR takes precedence even with missing RPM');
x.setDamageSimulation(true);assert.equal(x.evaluate().meterDamaged,true,'explicit instructor damage');
x.setPress(false);assert.equal(x.evaluate().acVolts,null,'damaged gauge remains unavailable');
x.resetDamage();assert.equal(x.evaluate().acVolts,115,'reset meter only by instructor replacement');
x.setSelector('GND PWR');x.setPress(true);
assert.equal(x.evaluate().status,'INHIBITED','non-generator selector cannot invoke this test');
assert.throws(()=>x.setSelector('UNKNOWN'));
assert.throws(()=>x.configure('GEN1',{gcr:'BROKEN'}));
assert.throws(()=>x.configure('GEN1',{measuredResidual:NaN}));
assert.throws(()=>x.setPress(1));
assert.throws(()=>x.configure('GEN2',{volts:117}));
const integration=fs.readFileSync(path.join(__dirname,'residual-volts-unified-v1.js'),'utf8');
const html=fs.readFileSync(path.join(__dirname,'index.html'),'utf8');
const actualButton=fs.readFileSync(path.join(__dirname,'recessed-overhead-v2.js'),'utf8');
assert.match(actualButton,/id":"residual-volts"/,'existing exact user-aligned OH10 recess retained');
assert.match(actualButton,/b737:cockpit-overhead/,'existing overhead message transport must remain unchanged');
assert.match(integration,/data.kind!=='recessed-button'/);
assert.match(integration,/event.origin!==root.location.origin/,'same origin only');
assert.match(integration,/event.source!==frame.contentWindow/,'only OH10 iframe source');
assert.match(integration,/b737:residual-volts-status/);
assert.match(integration,/b737:residual-generator-state/);
assert.match(integration,/b737:electrical-v7-state/);
assert.match(integration,/b737:unified-ecu-observation/);
assert.match(integration,/B737ISNCockpitV1/);
assert.match(integration,/ISN_LIVE_ENGINE_APU_DRIVE/);
assert.match(integration,/b737:ac-dc-selector-change/);
assert.match(integration,/b737:ac-dc-source-measurement/);
assert.match(integration,/pointercancel/);
assert.match(integration,/lostpointercapture/);
assert.ok(!integration.includes("createElementNS"),'no new gauge, needle, button or owner hardware art');
assert.match(html,/residual-volts-model-v1\.js\?v=RESID-0001-SAFE-MOMENTARY/);
assert.match(html,/residual-volts-unified-v1\.js\?v=RESID-0001-SAFE-MOMENTARY/);
// Headless host API: source-authenticated iframe message toggles only AC VOLTS,
// release returns to normal and never overwrites the other three needles.
const model=require('./ac-dc-selector-model-v1.js'),selection=model.create();
let selectors={
 read:side=>selection.read(side),
 choose:(side,p)=>selection.choose(side,p),
 getReadings:()=>selection.readings(),
 setSourceMeasurement:(side,p,sample)=>selection.setSourceMeasurement(side,p,sample)
};
const reads=[],events={},frame={contentWindow:{},addEventListener:(n,fn)=>events['frame:'+n]=fn};
const fakeDocument={getElementById:id=>id==='overheadFrame'?frame:null};
const fakeMeters={setReading:(id,v,mode)=>{reads.push({id,v,mode});}};
const fakeWindow={
 B737ResidualVoltsModelV1:core,B737UnifiedAcDcMetering:fakeMeters,
 B737UnifiedAcDcSelectors:selectors,location:{origin:'https://unit.test'},
 addEventListener:(name,fn)=>(events[name]??=[]).push(fn),
 dispatchEvent:e=>(events[e.type]||[]).forEach(fn=>fn(e))
};
class CustomEvent {constructor(type,opts){this.type=type;this.detail=opts.detail;}}
new Function('window','document','CustomEvent',integration)(fakeWindow,fakeDocument,CustomEvent);
const api=fakeWindow.B737UnifiedResidualVolts;
assert.ok(api&&api.snapshot());
api.configure('GEN1',{gcr:'OPEN',drive:'RUNNING',measuredResidual:12,normalVolts:115});
let messages=(events.message||[]);
messages[0]({origin:'https://evil.test',source:frame.contentWindow,
 data:{type:'b737:cockpit-overhead',kind:'recessed-button',id:'residual-volts',pressed:true}});
assert.equal(api.snapshot().pressed,false,'cross origin injection rejected');
messages[0]({origin:'https://unit.test',source:{},
 data:{type:'b737:cockpit-overhead',kind:'recessed-button',id:'residual-volts',pressed:true}});
assert.equal(api.snapshot().pressed,false,'non-overhead iframe injection rejected');
messages[0]({origin:'https://unit.test',source:frame.contentWindow,
 data:{type:'b737:cockpit-overhead',kind:'recessed-button',id:'residual-volts',pressed:true}});
assert.equal(api.snapshot().pressed,true);
assert.deepEqual(reads.at(-1),{id:'acVolts',v:12,mode:{mode:'RESIDUAL'}});
messages[0]({origin:'https://unit.test',source:frame.contentWindow,
 data:{type:'b737:cockpit-overhead',kind:'recessed-button',id:'residual-volts',pressed:false}});
assert.equal(api.snapshot().pressed,false);
assert.deepEqual(reads.at(-1),{id:'acVolts',v:115,mode:{mode:'NORMAL'}});
api.select('GND PWR');api.press(true);
assert.equal(api.snapshot().result.status,'INHIBITED');
assert.equal(reads.at(-1).v,null);
api.press(false);
assert.equal(api.snapshot().result.scale,'NORMAL');
assert.ok(reads.every(r=>r.id==='acVolts'),'RESID bridge does not modify DC/CPS pointers');
console.log('PASS RESID: real OH10 momentary event bridge, GCR/drive/sensor safety, two scale restoration, instructor scenarios and unchanged cockpit art');
