'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),EventEmitter=require('node:events');
const {capture,accumulate,hotFunctions,FRAME_SAMPLER}=require('./runtime-performance-audit.cjs');
test('timeline ignores instant events and records sampled layout costs',()=>{
 const m=new Map();
 accumulate(m,[{ph:'X',name:'Layout',dur:2000},{ph:'X',name:'Layout',dur:3000},{ph:'B',name:'Paint',dur:8000},{ph:'X',name:'Other',dur:1000}]);
 assert.deepEqual(m.get('Layout'),{name:'Layout',count:2,totalMs:5,maxMs:3});assert.equal(m.size,1);
});
test('CPU report distinguishes exclusive and inclusive samples',()=>{
 const h=hotFunctions({startTime:0,endTime:20000,
  nodes:[{id:1,callFrame:{functionName:'main',url:'a.js',lineNumber:1},children:[2]},
   {id:2,callFrame:{functionName:'tick',url:'b.js',lineNumber:5},children:[]}],samples:[2,2]});
 assert.equal(h[0].function,'tick');assert.equal(h[0].selfMs,20);assert.equal(h[1].selfMs,0);
});
test('audit stops tracing and detaches debugger even after normal sample',async()=>{
 class FakeDebugger extends EventEmitter{
  attached=false;isAttached(){return this.attached;}attach(){this.attached=true;}detach(){this.attached=false;}
  async sendCommand(name){
   if(name==='Profiler.stop')return {profile:{startTime:0,endTime:10000,nodes:[],samples:[]}};
   if(name==='Tracing.end')queueMicrotask(()=>{
    this.emit('message',null,'Tracing.dataCollected',{value:[{name:'Layout',ph:'X',dur:4500}]});
    this.emit('message',null,'Tracing.tracingComplete',{});
   });
   return {};
  }
 }
 const debuggerInstance=new FakeDebugger();
 const r=await capture({debugger:debuggerInstance,executeJavaScript:async()=>({samples:[{context:'cockpit',fps:24}]})});
 assert.equal(r.traceComplete,true);assert.equal(r.frames.samples[0].fps,24);
 assert.equal(r.timeline[0].name,'Layout');assert.equal(debuggerInstance.attached,false);
 assert.match(FRAME_SAMPLER,/requestAnimationFrame/);
});