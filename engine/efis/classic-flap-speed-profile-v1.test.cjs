'use strict';
const assert=require('node:assert/strict');
const P=require('./classic-flap-speed-profile-v1.js');
const data=[
 [1,230,null,null],
 [2,230,5,225],
 [5,225,15,210],
 [10,210,15,195],
 [15,195,5,190],
 [25,190,5,185],
 [30,180,25,155],
 [40,158,0,158]
];
for(const [detent,max,buffer,start] of data){
 const p=P.get(detent);
 assert.equal(p.maximumKt,max,'maximum FLAP '+detent);
 assert.equal(p.bufferKt,buffer,'buffer FLAP '+detent);
 assert.equal(p.bufferStartKt,start,'yellow band low FLAP '+detent);
 assert.equal(p.source,'OWNER_VISUAL_TRAINING');
}
assert.deepEqual(P.DETENTS,[0,1,2,5,10,15,25,30,40]);
assert.equal(P.get(0).maximumKt,null);
assert.equal(P.get(30,{flap30MaximumKt:185}).bufferStartKt,160);
assert.equal(P.get(30,{flap30MaximumKt:185}).maximumKt,185);
assert.throws(()=>P.get(3),/INVALID_FLAP/);
assert.throws(()=>P.get(30,{flap30MaximumKt:188}),/INVALID_FLAP30/);
console.log('PASS owner flap speed table, yellow buffer starts, 30=180/185 variants and zero-buffer behavior');
