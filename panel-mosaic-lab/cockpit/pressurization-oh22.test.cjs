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
assert.ok(c.controls.some(x=>x.id==='flight-ground'), 'Owner specified physical CPCS FLT/GRD selector');
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
cs=cpcs.apply(cs,oh22.command('CPCS','flight-ground','FLT',cs));
assert.equal(cs.flightGround,'FLT');
assert.equal(oh22.readControl('CPCS',c.controls.find(x=>x.id==='flight-ground'),cs),'FLT');
cs=cpcs.apply(cs,oh22.command('CPCS','flight-ground','GRD',cs));
assert.equal(cs.flightGround,'GRD');
assert.throws(()=>oh22.command('DCPCS','flight-ground','FLT',ds),/Unknown/);
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
assert.ok(d.lamps.every(l=>Math.abs(l.xy[1]-.043)<.002),'DCPCS faces must align with photographed lamp row, not fall below housings');
assert.ok(c.lamps.every(l=>Math.abs(l.xy[1]-.056)<.002),'CPCS has its OWN higher/deeper lamp row calibration');
assert.notEqual(d.lampFaceCalibration.asset,c.lampFaceCalibration.asset,'CPCS/DCPCS must never share source-specific calibration');

// Each installation owns its own visual fit and all added faces must remain
// inside their photographed bezel without colliding with the next aperture.
for(const id of ['CPCS','DCPCS']){
 const cfg=oh22.config(id);
 assert.ok(cfg.lampFit.x>1&&cfg.lampFit.y>1,id+' lamp face must grow');
 for(const knob of cfg.controls.filter(x=>x.appearance!=='hotspot')){
  const min=knob.visualFamily==='Small Silver'?.075:.12;
   assert.ok(cfg.controlFit[knob.id]>=min,id+' '+knob.id+' must fit its own photographed socket');
 }
 const expanded=cfg.lamps.map(l=>({x:l.face[0],y:l.face[1],w:l.face[2]*cfg.lampFit.x,h:l.face[3]*cfg.lampFit.y}));
 expanded.forEach((f,i)=>{
  assert.ok(f.x-f.w/2>=0&&f.x+f.w/2<=1&&f.y-f.h/2>=0&&f.y+f.h/2<=1,id+' lamp fits inside panel');
  if(i)assert.ok(expanded[i-1].x+expanded[i-1].w/2<f.x-f.w/2,id+' grown lamp faces must not touch');
 });
}
assert.notDeepEqual(c.controlFit,d.controlFit,'Independent knob calibration is required');

assert.deepEqual(oh22.lampFace('DCPCS','auto-fail'),[.219,.043,.157,.050]);
assert.deepEqual(oh22.lampFace('CPCS','auto-fail'),[.233,.056,.159,.057]);
assert.deepEqual(oh22.lampFace('DCPCS','manual'),[.782,.043,.153,.050]);
assert.deepEqual(oh22.lampFace('CPCS','manual'),[.766,.056,.157,.057]);
for(const name of ['CPCS','DCPCS']){
  const cfg=oh22.config(name),faces=cfg.lamps.map(l=>oh22.lampFace(name,l.id));
  assert.equal(faces.length,4,name+' needs four independently fitted lamp faces');
  const centers=faces.map(f=>f[0]);
  assert.ok(centers.every((v,i)=>i===0||v>centers[i-1]),'Actual physical left-to-right lamp order');
  for(let i=0;i<faces.length;i++){
    const [x,y,w,h]=faces[i];
    assert.ok(x-w/2>=0&&x+w/2<=1&&y-h/2>=0&&y+h/2<=1,name+' face escaped OH22 plate');
    if(i)assert.ok(faces[i-1][0]+faces[i-1][2]/2 < x-w/2,
      name+' lamp graphics overlap each other instead of fitting separate sockets');
  }
}
const geometryRenderer=fs.readFileSync(path.join(__dirname,'pressurization-oh22.js'),'utf8');
assert.ok(geometryRenderer.includes('model.lampFace(system,l.id)'), 'Renderer MUST apply dimensions per lamp per system');
assert.ok(geometryRenderer.includes("el.style.width=(w*100)+'%'"),'Lamp physical width must come from aperture registry');
assert.ok(geometryRenderer.includes("el.style.height=(h*100)+'%'"),'Lamp physical height must come from aperture registry');
assert.ok(geometryRenderer.includes("el.dataset.faceSystem=system"),'Lamp DOM must identify active installation');
assert.ok(geometryRenderer.includes("el.classList.add('oh22-altn-face')"),'DCPCS ALTN must use exact legend, not ALTEN');
const lampCss=fs.readFileSync(path.join(__dirname,'pressurization-oh22.css'),'utf8');
assert.ok(lampCss.includes('box-sizing:border-box;overflow:hidden;'), 'Faces must be clipped to measured slots');

assert.ok(c.controls.find(x=>x.id==='press-mode')?.xy[1]>.7,
  'CPCS MODE must be mounted at the real lower right selector (not the upper valve gauge)');
assert.ok(c.controls.some(x=>x.id==='flight-ground'&&x.visualFamily==='Small Silver'&&x.xy[0]<c.controls.find(z=>z.id==='press-mode').xy[0]),
  'CPCS Small Silver FLT/GRD must remain separate from MODE');
for(const sys of ['CPCS','DCPCS']){
 const valve=oh22.config(sys).controls.find(x=>x.id==='manual-valve');
 assert.equal(valve.visualFamily,'Small Silver',sys+' OPEN/CLOSE');
 assert.deepEqual(valve.states,['CLOSE','NEUTRAL','OPEN'],sys+' spring center');
}
assert.equal(oh22.config('CPCS').controlFit['flight-ground'],.082); // 2026-10-26 photo-scale Small Silver correction
assert.ok(!oh22.config('DCPCS').controls.some(x=>x.id==='flight-ground'));

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
assert.ok(actuatorSource.includes('Small_Silver_5Positions.webp'),'Use approved shared Small Silver artwork');
assert.ok(actuatorSource.includes("const face=n.querySelector('.oh22-small-silver-face')"),'Fixed bezel must use sprite frames');
assert.ok(actuatorSource.includes("go(before==='FLT'?'GRD':'FLT')"),'Reversible CPCS flight/ground');
assert.ok(fs.readFileSync(path.join(__dirname,'pressurization-oh22.css'),'utf8').includes('background-size:500% 100%'),'Preserve five-state atlas geometry');
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
