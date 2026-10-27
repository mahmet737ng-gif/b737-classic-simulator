'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const model=require('./rotary-guards-model.js'),toggle=require('./model.js');
const read=p=>JSON.parse(fs.readFileSync(path.join(__dirname,p),'utf8'));
const reg=read('rotary-guards.json'),upper=read('lights-controls.json'),layout=read('../all-overhead/atlas-layout.json');
assert.equal(reg.guards.length,0,'No old guarded switches in base registry');
assert.equal(upper.guards.length,0,'No old guarded switches in upper registry');
assert.equal(reg.interlocks.length,0,'Old guard interlocks removed');
assert.equal(Object.keys(reg.assets).filter(k=>/^(owner-|red-|black-)/.test(k)).length,0,'No legacy guard sprites in active asset registry');
assert.equal(model.validate(reg,layout,toggle.mapPoint),true);
assert.equal(reg.rotaries.length,18);assert.equal(upper.rotaries.length,2);
const all={...reg,rotaries:[...reg.rotaries,...upper.rotaries]};
assert.equal(model.validate(all,layout,toggle.mapPoint),true);
const events=[];const e=model.controller(all,{guards:{'retired-example':{value:'on',guard:'open'}}},evt=>events.push(evt));
assert.deepEqual(e.snapshot().guards,{},'Old user-local guard state must not be loaded');
for(const id of ['dc-meter','ac-meter','wiper','engine-start-1','engine-start-2']){
 const c=reg.rotaries.find(r=>r.id===id),slot=layout.placements.find(p=>p.id===c.placementId);
 assert.ok(c?.panelMarks&&c.panelPivot,id+' actual detent calibration');
 assert.equal(model.detentAngles(c).length,c.states.length);
 const areas=model.legendHotspots(c,slot,toggle.mapPoint);
 assert.equal(areas.length,c.states.length);
 for(let i=0;i<areas.length;i++)for(let j=i+1;j<areas.length;j++)assert.equal(model.outlinesOverlap(areas[i].points,areas[j].points),false);
}
e.setRotary('engine-start-1','FLT');assert.equal(e.stepRotary('engine-start-1',1),false);
e.setRotary('engine-start-1','GRD');assert.equal(e.stepRotary('engine-start-1',-1),false);
e.setRotary('ac-meter','TEST');assert.equal(e.rotary('ac-meter'),'TEST');
e.setRotary('crossfeed','OPEN');assert.equal(e.rotary('crossfeed'),'OPEN');
for(const a of Object.values(reg.assets)){const bytes=fs.readFileSync(path.resolve(__dirname,a.url));assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),a.sha256);}
const view=fs.readFileSync(path.join(__dirname,'rotary-guards.js'),'utf8');assert.match(view,/mountEngineStartLabelCorrection\(layout\)/);assert.match(view,/motion.createDetentGesture/);
console.log('PASS: 20 rotary knobs operational; 0 registered guards; no legacy imagery; cached guarded states ignored.');
