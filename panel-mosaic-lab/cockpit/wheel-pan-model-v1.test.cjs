const test=require('node:test'),assert=require('node:assert/strict');
const M=require('./wheel-pan-model-v1.js');
test('pixel wheel scrolls vertically and horizontally',()=>{
 const vp={scrollTop:45,scrollLeft:10,clientHeight:600};
 assert.equal(M.pan(vp,{deltaX:6,deltaY:96,deltaMode:0}),true);
 assert.deepEqual([vp.scrollLeft,vp.scrollTop],[16,141]);
});
test('upward wheel decreases scroll; line-mode and page-mode converted',()=>{
 const vp={scrollTop:200,scrollLeft:0,clientHeight:480};
 M.pan(vp,{deltaX:0,deltaY:-3,deltaMode:1});
 assert.equal(vp.scrollTop,152);
 M.pan(vp,{deltaX:0,deltaY:1,deltaMode:2});
 assert.equal(vp.scrollTop,632);
});
test('shift-wheel maps vertical delta horizontally when needed',()=>{
 const vp={scrollTop:42,scrollLeft:15,clientHeight:500};
 M.pan(vp,{deltaX:0,deltaY:110,deltaMode:0,shiftKey:true});
 assert.deepEqual([vp.scrollLeft,vp.scrollTop],[125,42]);
});
test('native horizontal trackpads keep their own delta on Shift',()=>{
 assert.deepEqual(M.normalize({deltaX:60,deltaY:0,deltaMode:0,shiftKey:true},{height:500}),{x:60,y:0});
});
test('malformed iframe message cannot change scroll',()=>{
 const vp={scrollTop:100,scrollLeft:200,clientHeight:500};
 for(const x of [{deltaX:0,deltaY:'500',deltaMode:0},{deltaX:NaN,deltaY:1},{deltaY:5},null]){
  assert.equal(M.pan(vp,x),false);
 }
 assert.deepEqual([vp.scrollLeft,vp.scrollTop],[200,100]);
});
