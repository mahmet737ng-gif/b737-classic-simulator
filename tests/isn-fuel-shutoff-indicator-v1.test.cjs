'use strict';
const assert=require('node:assert/strict'),{test}=require('node:test');
const {create}=require('../engine/integration/isn-fuel-shutoff-indicator-v1.js');
test('ATA28: closed dim, transit bright, open off, independently per engine',()=>{
 const m=create(),l={engine1:'CUTOFF',engine2:'CUTOFF'};
 assert.deepEqual(m.observe({levers:l,nowMs:0}).frames,{engine1:'DIM_BLUE',engine2:'DIM_BLUE'});
 l.engine1='IDLE';
 assert.deepEqual(m.observe({levers:l,nowMs:10}).frames,{engine1:'BRIGHT_BLUE',engine2:'DIM_BLUE'});
 assert.equal(m.observe({levers:l,nowMs:829}).frames.engine1,'BRIGHT_BLUE');
 assert.equal(m.observe({levers:l,nowMs:830}).frames.engine1,'OFF');
 l.engine1='CUTOFF';
 assert.equal(m.observe({levers:l,nowMs:900}).frames.engine1,'BRIGHT_BLUE');
 assert.equal(m.observe({levers:l,nowMs:1721}).frames.engine1,'DIM_BLUE');
});
test('FCOM bright on valve/lever OR fire-switch disagreement',()=>{
 const m=create(),l={engine1:'IDLE',engine2:'CUTOFF'};
 assert.equal(m.observe({levers:l,observedPositions:{engine1:'CLOSED'},nowMs:0}).frames.engine1,'BRIGHT_BLUE');
 assert.equal(m.observe({levers:l,fireHandles:{engine1:true},observedPositions:{engine1:'OPEN'},nowMs:1000}).frames.engine1,'BRIGHT_BLUE');
 assert.equal(m.observe({levers:l,fireHandles:{engine1:true},observedPositions:{engine1:'CLOSED'},nowMs:2000}).frames.engine1,'DIM_BLUE');
 assert.throws(()=>m.observe({levers:l,observedPositions:{engine1:'BAD'},nowMs:2001}));
});
test('changing back to CUTOFF before travel completes retains closed position',()=>{
 const m=create(),l={engine1:'CUTOFF',engine2:'CUTOFF'};
 m.observe({levers:l,nowMs:0});l.engine2='IDLE';m.observe({levers:l,nowMs:100});
 l.engine2='CUTOFF';assert.equal(m.observe({levers:l,nowMs:200}).frames.engine2,'DIM_BLUE');
});
