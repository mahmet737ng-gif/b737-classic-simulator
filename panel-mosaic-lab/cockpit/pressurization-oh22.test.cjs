'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const oh22=require('./pressurization-oh22-model');
const cpcs=require('../../engine/systems/cpcs-v5');
const dcpcs=require('../../engine/systems/dcpcs-v4');
assert.equal(oh22.validate(),true);
const d=oh22.config('DCPCS'),c=oh22.config('CPCS');
assert.equal(d.backgroundAsset,'panel-mosaic-lab/assets/locked/2026-10-23/DCPCS_Background_Owner.png');
assert.equal(c.backgroundAsset,null);
assert.deepEqual(d.modes,['AUTO','ALTN','MAN']);
assert.deepEqual(c.modes,['AUTO','STBY','MAN_AC','MAN_DC']);
assert.ok(c.controls.some(x=>x.id==='cabin-rate'));
assert.ok(!d.controls.some(x=>x.id==='cabin-rate'));
assert.ok(!d.controls.some(x=>x.id==='flight-ground'));
assert.ok(!c.controls.some(x=>x.id==='flight-ground'), 'FLT/GRD engine input must not masquerade as a physical OH22 selector');
assert.ok(c.controls.some(x=>x.id==='standby-alt'));
assert.ok(!d.controls.some(x=>x.id==='standby-alt'));
assert.deepEqual(Object.keys(oh22.lamps('DCPCS',{lamps:{autoFail:true,altn:false,manual:false,offSchedDescent:false}})),['auto-fail','off-sched','altn','manual']);
assert.deepEqual(Object.keys(oh22.lamps('CPCS',{lamps:{autoFail:false,standby:true,manual:false,offSchedDescent:false}})),['auto-fail','off-sched','standby','manual']);
assert.throws(()=>oh22.command('DCPCS','press-mode','STBY'),/Bad detent/);
assert.throws(()=>oh22.command('CPCS','press-mode','ALTN'),/Bad detent/);
assert.throws(()=>oh22.command('DCPCS','cabin-rate','INCR'),/Unknown/);
assert.throws(()=>oh22.command('DCPCS','flight-alt',28320),/Out of range/);
let ds=dcpcs.initial(),cs=cpcs.initial();
ds=dcpcs.apply(ds,oh22.command('DCPCS','press-mode','ALTN',ds));
assert.equal(dcpcs.derive(ds).selectedMode,'ALTN');
cs=cpcs.apply(cs,oh22.command('CPCS','press-mode','STBY',cs));
assert.equal(cpcs.derive(cs).selectedMode,'STBY');
cs=cpcs.apply(cs,oh22.command('CPCS','cabin-rate','INCR',cs));
assert.equal(cpcs.derive(cs).standbyRateSelected,'INCR');
ds=dcpcs.apply(ds,oh22.command('DCPCS','flight-alt',32000,ds));
assert.equal(ds.input.flightAltitudeFt,32000);
ds=dcpcs.apply(ds,oh22.command('DCPCS','landing-alt',250,ds));
assert.equal(ds.input.landingAltitudeFt,250);
cs=cpcs.apply(cs,{type:'FLIGHT_GROUND',value:'FLT'});
assert.equal(cs.flightGround,'FLT');
cs=cpcs.apply(cs,oh22.command('CPCS','manual-valve','OPEN',cs));
assert.equal(cs.valveSwitch,'OPEN');
assert.equal(ds.selector,'ALTN','CPCS commands must not corrupt independent DCPCS engine');
// Owner screenshot measured the actual DCPCS sockets, NOT old wrongly mounted knobs.
// Pixel references are normalized to the same OH22 plate with edge-to-edge image fit.
// Do not reuse these coordinates when a different owner background is installed.
assert.equal(d.calibrationAsset,d.backgroundAsset);
assert.equal(d.artworkFit,'fill','DCPCS image must fill physical OH22 plate with no top letterbox');
const anchors=Object.fromEntries(d.controls.map(x=>[x.id,x.xy]));
const readouts=Object.fromEntries(d.displays.map(x=>[x.id,x.xy]));
const ideal={
  'flight-alt':[.325,.372],
  'landing-alt':[.325,.676],
  'manual-valve':[.72,.453],
  'press-mode':[.72,.678]
};
for(const [id,xy]of Object.entries(ideal)){
  assert.ok(anchors[id],'Missing calibrated DCPCS socket '+id);
  assert.ok(Math.abs(anchors[id][0]-xy[0])<.002&&Math.abs(anchors[id][1]-xy[1])<.002,'DCPCS knob shifted off photo socket: '+id);
}
assert.deepEqual(readouts['flight-display'],[.32,.207]);
assert.deepEqual(readouts['landing-display'],[.32,.498]);
assert.ok(d.lamps.every(l=>Math.abs(l.xy[1]-.055)<.002),'Lamps must stay inside upper annunciator row');
assert.ok(c.controls.find(x=>x.id==='press-mode')?.xy[1]>.7,
  'CPCS MODE must be mounted at the real lower right selector (not the upper valve gauge)');
assert.ok(!c.controls.some(x=>x.id==='flight-ground'),
  'CPCS FLT/GRD is an engine input, not a knob at the MODE socket');
assert.equal(c.controls.find(x=>x.id==='auto-check')?.appearance,'hotspot',
  'CPCS AUTO CHECK is a selector action, not a floating duplicate knob');
assert.equal(c.displays.length,3,'CPCS must show FLT ALT, LAND ALT, standby cabin altitude');
for(const d of c.displays)assert.equal(d.stateRoot,'settings');
let cpcsDisplayState=cpcs.initial();
cpcsDisplayState=cpcs.apply(cpcsDisplayState,{type:'ALTITUDE',key:'flightAltitudeFt',value:29000});
assert.equal(oh22.readDisplay('CPCS',c.displays[0],cpcsDisplayState),29000);
assert.equal(oh22.readDisplay('DCPCS',d.displays[0],dcpcs.initial()),28000);

const bridge=fs.readFileSync(path.join(__dirname,'overhead-bridge.js'),'utf8');
assert.ok(bridge.includes("objectFit:'fill'"),'Owner photo must reach tile top and bottom with no contain gaps');
const skin=fs.readFileSync(path.join(__dirname,'pressurization-oh22.css'),'utf8');
assert.ok(skin.includes('display:none; /* Physical knobs do not print live value labels'),'Knob text must not overlap real panel labels');
assert.ok(skin.includes('font:700 21px'),'Digital altitude text must fit its dedicated instrument windows');
// Independent annunciators must illuminate under either overhead lamp test,
// including the cockpit all-lights visual test, without fault-latching engines.
const actuatorSource=fs.readFileSync(path.join(__dirname,'pressurization-oh22.js'),'utf8');
assert.ok(actuatorSource.includes("document.documentElement.classList.contains('cockpit-visual-test')"),
  'OH22 must follow the global visual lamp-test mode');
assert.ok(actuatorSource.includes('window.B737OverheadLights?.getState?.()?.lampTest===true'),
  'OH22 must follow the hardware overhead lamp-test mode');
assert.ok(actuatorSource.includes('const lit=lampTest||values[l.id]'),
  'Both systems must illuminate all annunciators during lamp-test');
assert.ok(actuatorSource.includes("window.addEventListener('b737:pressure-light-test'"),
  'OH22 must repaint when the user operates all-lights test');
assert.ok(actuatorSource.includes("window.addEventListener('b737:overhead-light-state'"),
  'OH22 must repaint when the existing overhead lamp-test state changes');
const lightBridge=fs.readFileSync(path.join(__dirname,'overhead-bridge.js'),'utf8');
assert.ok(lightBridge.includes("new CustomEvent('b737:pressure-light-test'"),
  'All-lights visual test must notify isolated OH22 annunciator layers');
const legacySkin=fs.readFileSync(path.join(__dirname,'pressurization-oh22.css'),'utf8');
for(const id of ['flight-alt','landing-alt','cabin-alt','cabin-rate','pressurization-mode','pressurization-check']){
  assert.ok(legacySkin.includes('.rg-detent-hit[data-control="'+id+'"]'),
    'Old detached detent hit areas must not overlay either selected system: '+id);
}
assert.ok(legacySkin.includes('.guard-node[data-control="pressurization-check"]'),
  'CPCS/DCPCS must suppress outdated guarded OH22 action area');
const overhead=fs.readFileSync(path.join(__dirname,'overhead-stage.html'),'utf8');
for(const src of ['pressurization-oh22-model.js','pressurization-oh22.js','pressurization-oh22.css'])assert.ok(overhead.includes(src));
const styles=fs.readFileSync(path.join(__dirname,'pressurization-oh22.css'),'utf8');
for(const legacy of ['flight-alt','landing-alt','cabin-alt','cabin-rate','pressurization-mode','pressurization-check','outflow-manual','press-auto-fail','press-off-sched-descent','press-standby','press-manual'])assert.ok(styles.includes(legacy),'Legacy control must not remain visually over OH22: '+legacy);
const active=fs.readFileSync(path.join(__dirname,'aircraft-settings.js'),'utf8');
assert.ok(active.includes("getPressureSession(system)"),'Separate CPCS and DCPCS sessions required');
assert.ok(active.includes("'pressurization-command'"),'OH22 physical controls must invoke engine');
assert.ok(active.includes("type:'b737:cockpit-command',action:'pressurization-state'"),'Lamp and detent state must be projected from engine');
console.log('PASS: two isolated pressurization configurations, distinct actuators and lamps, source-linked commands, original artwork, legacy OH22 cleanup.');
