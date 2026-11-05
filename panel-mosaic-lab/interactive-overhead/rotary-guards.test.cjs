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
// OH23-25 revised photo: both Engine Start selectors must stop at the four
// printed ticks and the click targets must track the same source-image marks.
for(const [id,expectedMarks] of [
 ['engine-start-1',[[967,298],[1022,278],[1075,299],[1094,345]]],
 ['engine-start-2',[[1317,298],[1370,278],[1423,299],[1442,345]]]
]){
 const c=reg.rotaries.find(x=>x.id===id);
 assert.deepEqual(c.states,['GRD','OFF','CONT','FLT']);
 assert.deepEqual(c.panelMarks,expectedMarks,id+' registered photo marks');
 const angles=model.detentAngles(c);
 assert.ok(angles[0]<-45&&angles[0]>-55,id+' GRD tick must point upper-left');
 assert.ok(Math.abs(angles[1])<1,id+' OFF tick must point straight up');
 assert.ok(angles[2]>45&&angles[2]<55,id+' CONT tick must point upper-right');
 assert.ok(Math.abs(angles[3]-90)<1,id+' FLT tick must point right');
 const areas=model.legendHotspots(c,layout.placements.find(p=>p.id===c.placementId),toggle.mapPoint);
 assert.equal(areas.length,4,id+' four clickable photo legends');
 for(const [i,state] of c.states.entries()){
  assert.equal(model.nearest(c,angles[i]),state,id+' angle snaps to '+state);
  assert.ok(areas.some(h=>h.state===state),id+' has clickable '+state);
  const polygon=c.legendAreas[state],xs=polygon.map(p=>p[0]),ys=polygon.map(p=>p[1]);
  const [x,y]=c.panelMarks[i];
  assert.ok(x>=Math.min(...xs)&&x<=Math.max(...xs)&&y>=Math.min(...ys)&&y<=Math.max(...ys),id+' '+state+' click target covers printed mark');
  e.setRotary(id,state);
  assert.equal(e.rotary(id),state,id+' must select '+state);
 }
}
e.setRotary('engine-start-1','FLT');assert.equal(e.stepRotary('engine-start-1',1),false);
e.setRotary('engine-start-1','GRD');assert.equal(e.stepRotary('engine-start-1',-1),false);
e.setRotary('ac-meter','TEST');assert.equal(e.rotary('ac-meter'),'TEST');
e.setRotary('crossfeed','OPEN');assert.equal(e.rotary('crossfeed'),'OPEN');
for(const a of Object.values(reg.assets)){const bytes=fs.readFileSync(path.resolve(__dirname,a.url));assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),a.sha256);}
const view=fs.readFileSync(path.join(__dirname,'rotary-guards.js'),'utf8');assert.doesNotMatch(view,/mountEngineStartLabelCorrection|rg-start-label-correction|label\.textContent='FLT'/,'No floating FLT text overlay may cover the baked CONT/FLT labels');assert.match(view,/motion.createDetentGesture/);
console.log('PASS: 20 rotary knobs operational; 0 registered guards; no legacy imagery; cached guarded states ignored.');
