'use strict';
// Tests the real DOM event handler and interval scheduling in the browser lab.
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const path=require('node:path');
const app=fs.readFileSync(path.join(__dirname,'app.js'),'utf8');
const html=fs.readFileSync(path.join(__dirname,'index.html'),'utf8');
const nodes={};let clickHandler=null,nextTimer=1;const timers=new Map();
const el=id=>(nodes[id]??=( {textContent:'',innerHTML:'',value:id==='throttle1'||id==='throttle2'?'0':'200',addEventListener(){} } ));
const document={getElementById:el,querySelector:selector=>el(selector),addEventListener(name,handler){if(name==='click')clickHandler=handler;}};
class FakeTestbench{
 constructor(){this.timeMs=0;this.apuPhase='OFF';this.engines={engine1:'OFF',engine2:'OFF'};this.batteryOn=false;}
 get(){const engine=phase=>({phase,n1Percent:0,n2Percent:0,egtC:20,fuelFlowKgHr:null,oil:{pressurePsi:0,temperatureC:20,quantityPct:85,lowPressureLamp:true,filterBypassLamp:false},startValveOpen:null,fuelLever:'CUTOFF'});
 return {timeMs:this.timeMs,electrical:{battery:this.batteryOn,selectedSources:{1:null}},apu:{phase:this.apuPhase,rpmPct:this.apuPhase==='READY'?100:5,egtC:20,bleedValveOpen:false,faults:{}},engines:{engine1:engine(this.engines.engine1),engine2:engine(this.engines.engine2)},alerts:[],fuel:{tanksKg:{main1:3500,center:1000,main2:3500},crossfeed:'CLOSED'},trace:[],aircraft:{onGround:true}};}
 battery(x){this.batteryOn=x;}
 startAPU(){if(!this.batteryOn)throw Error('BATTERY OFF');this.apuPhase='INLET_DOOR';}
 engineStart(engine){this.engines[engine]='MOTORING';}
 advance(ms){this.timeMs+=ms;if(this.apuPhase==='INLET_DOOR'&&this.timeMs>=400)this.apuPhase='STARTING';if(this.apuPhase==='STARTING'&&this.timeMs>=1400)this.apuPhase='READY';}
}
vm.runInNewContext(app,{document,window:{B737ISN1318ECUTestbenchV1:{Testbench:FakeTestbench}},setInterval(callback,ms){assert.equal(ms,100);const id=nextTimer++;timers.set(id,callback);return id;},clearInterval(id){timers.delete(id);},console},{filename:'app.js'});
const click=act=>{assert.ok(clickHandler);clickHandler({target:{closest:()=>({dataset:{act}})}});};
const tick=n=>{for(let i=0;i<n;i++)for(const fn of [...timers.values()])fn();};
assert.equal(timers.size,0);
click('battery');assert.equal(timers.size,0,'Battery ON alone should not run the clock');
click('apuStart');assert.equal(timers.size,1,'APU START auto-runs the simulator clock');
tick(14);assert.equal(el('clock').textContent,'1.4 s');assert.match(el('apu').textContent,/APU READY/);
click('play');assert.equal(timers.size,0,'Manual pause should stop time');
click('start1');assert.equal(timers.size,1,'Engine GRD resumes timer after manual pause');
click('start2');assert.equal(timers.size,1,'Concurrent starts should not create duplicate timers');
click('reset');assert.equal(timers.size,0,'Reset must cancel background intervals');assert.equal(el('clock').textContent,'0.0 s');
assert.match(html,/clock starts automatically/i);
console.log('PASS ECU startup browser lab: APU START auto-runs clock, resumes with engine GRD, single timer, PAUSE and RESET.');