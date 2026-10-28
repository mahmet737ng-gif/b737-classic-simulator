const test=require('node:test'),assert=require('node:assert/strict');
const Light=require('../panel-mosaic-lab/cockpit/lights-model.js');
const reg={version:'LEDEV_TEST',lights:[
 {id:'main-le-transit',rule:'le-transit',inputs:['leadingEdge','trailingFlaps','autoslatInFlight']},
 {id:'main-le-extended',rule:'le-extended',inputs:['leadingEdge','trailingFlaps']}
]};
test('physical flap detent and LE state govern the two original forward annunciators',()=>{
 const m=Light.controller(reg);
 let s=m.update({trailingFlaps:5,leadingEdge:'INTERMEDIATE'});
 assert.equal(s.frames['main-le-transit'],'OFF');
 assert.equal(s.frames['main-le-extended'],'OFF'); // overhead power not yet confirmed
 m.setOverheadPower(true);
 s=m.evaluate();assert.equal(s.frames['main-le-extended'],'ON');
 s=m.update({trailingFlaps:15,leadingEdge:'TRANSIT'});
 assert.equal(s.frames['main-le-transit'],'ON');
 assert.equal(s.frames['main-le-extended'],'OFF');
 s=m.update({trailingFlaps:15,leadingEdge:'DISAGREE'});
 assert.equal(s.frames['main-le-transit'],'ON');
 assert.equal(s.frames['main-le-extended'],'OFF');
 s=m.update({trailingFlaps:5,leadingEdge:'INTERMEDIATE'});
 assert.equal(s.frames['main-le-transit'],'OFF');
 assert.equal(s.frames['main-le-extended'],'ON');
 s=m.update({trailingFlaps:0,leadingEdge:'RETRACTED'});
 assert.equal(s.frames['main-le-transit'],'OFF');
 assert.equal(s.frames['main-le-extended'],'OFF');
});
test('DC1 loss extinguishes only forward LE annunciators',()=>{
 const m=Light.controller(reg);m.setOverheadPower(true);
 m.update({trailingFlaps:15,leadingEdge:'DISAGREE'});
 assert.equal(m.evaluate().frames['main-le-transit'],'ON');
 m.update({leCenterPowered:false});
 assert.equal(m.evaluate().frames['main-le-transit'],'OFF');
 m.update({leCenterPowered:true});
 assert.equal(m.evaluate().frames['main-le-transit'],'ON');
});
