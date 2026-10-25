'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const m=require('./aircon-400-model');
const sourceDir=path.join(__dirname,'../assets/locked/2026-10-23');
assert.equal(m.validate(),true);
assert.equal(m.source.asset,'Boeing-Style Environmental Control Panel.png');
const png=fs.readFileSync(path.join(sourceDir,m.source.asset));
assert.equal(png.subarray(1,4).toString(),'PNG');
assert.deepEqual([png.readUInt32BE(16),png.readUInt32BE(20)],[1122,1402]);
assert.equal(m.controls.length,5);
assert.equal(m.zoneKnobs.length,3);
assert.equal(m.lamps.length,3);
assert.equal(m.trim.type,'toggle');
assert.deepEqual(m.trim.states,['OFF','ON']);
assert.equal(m.precheck.type,'rotary');
assert.ok(m.precheck.states.some(x=>x.startsWith('SUPPLY DUCT')));
assert.ok(m.precheck.states.some(x=>x.startsWith('PASS CAB')));
assert.deepEqual(m.zoneKnobs.map(x=>x.id),['cont-cab','fwd-cab','aft-cab']);

assert.ok(m.precheck.diameter>=195,'737-400 PRECHECK rotary must fit its round socket');
for(const c of m.zoneKnobs)assert.ok(c.diameter>=198,'737-400 zone rotary must fit its socket: '+c.id);
assert.ok(m.trim.width>=120&&m.trim.height>=160,'TRIM AIR toggle must fill its slot');
// The annunciator faces are measured against BLACK glass, not the orange frame.
const ownerBezelBounds=[[107,774,338,887],[456,774,679,887],[787,774,1017,887]];
assert.deepEqual(m.lamps.map(l=>l.rect),[[118,788,210,88],[466,788,204,88],[797,788,210,88]]);
for(const [i,l] of m.lamps.entries()){
 const [x,y,w,h]=l.rect,[left,top,right,bottom]=ownerBezelBounds[i];
 assert.ok(x>=left+6&&y>=top+9&&x+w<=right-6&&y+h<=bottom-8,
  'ZONE TEMP image must remain inside black opening, preserving baked orange border: '+l.id);
}
assert.ok(m.precheck.diameter>=258&&m.zoneKnobs.every(c=>c.diameter>=260),'Actual 400 rotary faces enlarged');

// The ORIGINAL source image's black socket centers, not screen CSS / zoom.
// Regressions here detect a raised lower knob and any radial pivot drift.
assert.deepEqual([m.precheck.x,m.precheck.y],[839,348]);
assert.deepEqual(m.zoneKnobs.map(c=>[c.x,c.y]),[[220,1117],[561,1117],[900,1117]]);
assert.deepEqual([m.trim.x,m.trim.y],[553,639]);
const distinct=m.zoneKnobs.map(c=>[c.x,c.y]);
assert.ok(distinct.every(([x,y],i)=>i===0||x-distinct[i-1][0]>300),'No knob overlaps adjacent socket');

assert.ok(m.trim.width>=176&&m.trim.height>=220,'Actual 400 TRIM AIR toggle enlarged');

const layout=JSON.parse(fs.readFileSync(path.join(__dirname,'../all-overhead/atlas-layout.json'),'utf8'));
const placement=layout.placements.find(p=>p.id==='OH20');
for(const c of m.controls){const pos=m.map([c.x,c.y],placement);
 assert.ok(pos.x>placement.x&&pos.x<placement.x+placement.w);
 assert.ok(pos.y>placement.y&&pos.y<placement.y+placement.h);
 assert.equal(m.step(c,c.states[0],-1),c.states[0]);
 assert.equal(m.step(c,c.states.at(-1),1),c.states.at(-1));
}
const boxes=m.lamps.map(x=>m.rect(x.rect,placement));
for(let i=0;i<boxes.length;i++){
 const b=boxes[i];assert.ok(b.x>=placement.x&&b.y>=placement.y);
 assert.ok(b.x+b.w<=placement.x+placement.w&&b.y+b.h<=placement.y+placement.h);
 if(i)assert.ok(boxes[i-1].x+boxes[i-1].w<b.x,'Distinct lamp windows must not overlap');
}
assert.ok(fs.existsSync(path.join(sourceDir,'LIGHTS/black-yellow-v1/mounted/ZONE_TEMP_YELLOW_OFF.svg')));
assert.ok(fs.existsSync(path.join(sourceDir,'LIGHTS/black-yellow-v1/mounted/ZONE_TEMP_YELLOW_ON.svg')));
const overlay=fs.readFileSync(path.join(__dirname,'aircon-400-overlay.js'),'utf8');
const css=fs.readFileSync(path.join(__dirname,'aircon-400-overlay.css'),'utf8');
const stage=fs.readFileSync(path.join(__dirname,'overhead-stage.html'),'utf8');
const bridge=fs.readFileSync(path.join(__dirname,'overhead-bridge.js'),'utf8');
const shared=fs.readFileSync(path.join(__dirname,'../interactive-overhead/rotary-guards.js'),'utf8');
for(const asset of ['aircon-400-model.js?v=AIRCON400-0004-BEZEL-FIT','aircon-400-overlay.js?v=AIRCON400-0004-BEZEL-FIT','aircon-400-overlay.css?v=AIRCON400-0004-BEZEL-FIT'])assert.ok(stage.includes(asset));
for(const id of ['temperature-source','control-cabin-temp','pass-cabin-temp','duct-overheat-l','duct-overheat-r'])assert.ok(css.includes(id),'Old 300/500 overlay must be hidden for 400: '+id);
assert.ok(overlay.includes('zoneFaults'),'Three caution outputs are distinct');
assert.ok(overlay.includes('setAirconTemperature'),'Outer-zone controls retain pneumatic bridge');
assert.ok(shared.includes('setAirconTemperature:(id,value)=>'),'Narrow outer-zone integration exists');
assert.ok(overlay.includes("classList.toggle('b737-aircon300500'"),'Legacy family retains its own fit class');
assert.ok(css.includes('html.b737-aircon300500'),'737-300/500 knobs and lamps have their own visual scale');
assert.ok(css.includes('top:6%')&&css.includes('transform:scale(1.09) rotate(var(--aircon-angle,0deg))'),'400 knob image pivot matches socket center at detents');
assert.ok(css.includes('transform:translateY(-4%) scale(1.25)'),'400 trim switch art is correctly seated');
assert.ok(css.includes('scale:1.16'),'Legacy lower temp knobs grow without overriding live rotation');
assert.ok(css.includes('scale(1.075,1.11)'),'Legacy DUCT OVERHEAT faces enlarge independently');

assert.ok(bridge.includes("action==='aircon-background'"),'Profile change selects 400 image');
assert.ok(!fs.readFileSync(path.join(__dirname,'../all-overhead/stage.js'),'utf8').includes('aircon400Overlay'),'Frozen overhead untouched');
console.log('PASS: 737-400 environmental controls, toggle and Zone Temp windows are independent of 300/500.');
