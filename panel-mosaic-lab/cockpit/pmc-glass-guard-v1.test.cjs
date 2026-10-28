'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const model=require('./pmc-glass-model-v1.js');
test('closed clear cover protects the independently latched PMC selection',()=>{
 const c=model.controller();
 assert.deepEqual(c.view(1),{engine:1,on:true,open:false,onSymbol:true,inop:false});
 assert.equal(c.press(1),false);
 c.cover(1,true);assert.equal(c.press(1),true);
 assert.deepEqual(c.view(1),{engine:1,on:false,open:true,onSymbol:false,inop:true});
 assert.equal(c.view(2).on,true);assert.equal(c.view(2).inop,false);
 c.cover(1,false);assert.equal(c.view(1).onSymbol,false);assert.equal(c.view(1).inop,true);
 assert.equal(c.press(1),false);
 c.cover(1,true);c.press(1);assert.equal(c.view(1).onSymbol,true);assert.equal(c.view(1).inop,false);
});
test('lamp test is temporary and a reload closes covers without changing selections',()=>{
 const c=model.controller();assert.equal(c.view(1,true).inop,true);assert.equal(c.view(1).inop,false);
 c.cover(2,true);c.press(2);
 const reload=model.controller(c.snapshot());assert.equal(reload.view(2).on,false);assert.equal(reload.view(2).open,false);
 assert.equal(reload.view(1).on,true);
 assert.equal(model.controller({1:{on:'OFF'}}).view(1).on,true);
});
test('square covers share exact native-source hinges and clear adjacent panels',()=>{
 const a=model.bounds(1),b=model.bounds(2);
 assert.equal(a.width,a.height);assert.equal(b.width,b.height);
 assert.equal(a.top,b.top);
 assert.ok(Math.abs((a.left+a.width/2-3)*1731/2214-1076)<1e-9);
 assert.ok(Math.abs((b.left+b.width/2-3)*1731/2214-1248)<1e-9);
 const lowerSource=(a.top+a.height-3)*909/1019;
 assert.ok(lowerSource<520,'PMC cover must end above the oxygen-panel boundary');
 assert.ok(a.left+a.width<b.left,'PMC units must remain independent with LOW IDLE between them');
});
