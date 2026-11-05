const assert=require('node:assert/strict');
const {create,deltaAngle}=require('./motion.js');
const events=[];
const d=create({id:'test',mode:'detent',angles:[0,30,90],labels:['A','B','C'],initial:0},e=>events.push(e));
d.begin();d.drag(48);assert.equal(d.angle,48);assert.equal(d.value,0);assert.equal(events.length,0);
d.finish();assert.equal(d.value,1);assert.equal(d.angle,30);assert.equal(events.length,1);
d.step(1);d.step(1);assert.equal(d.value,2);assert.equal(d.angle,90); // hard end stop, no wrap
d.begin();d.drag(-200);assert.equal(d.angle,0);d.drag(5);assert.equal(d.angle,5); // no accumulated overshoot
d.finish(true);assert.equal(d.value,2);assert.equal(d.angle,90);
assert.equal(deltaAngle(179,-179),2);assert.equal(deltaAngle(-179,179),-2);
const c=create({id:'c',mode:'continuous',min:0,max:100,step:1,angleMin:-135,angleMax:135,initial:50});
c.begin();c.drag(999);assert.equal(c.value,100);assert.equal(c.angle,135);c.drag(-2.7);assert.equal(c.value,99);
c.finish(true);assert.equal(c.value,50);assert.equal(c.angle,0);
c.set(1.2);assert.equal(c.value,1);c.step(0);assert.equal(c.value,1);assert.equal(c.set(NaN),false);
assert.throws(()=>create({mode:'detent',angles:[0,0],labels:['A','B'],initial:0}));
assert.throws(()=>create({mode:'continuous',min:0,max:0,step:1,angleMin:0,angleMax:90,initial:0}));
console.log('RM-0001: detent commit, cancellation, hard stops, seam crossing and continuous controls pass');
