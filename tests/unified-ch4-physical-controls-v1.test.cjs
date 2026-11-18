'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const read=p=>fs.readFileSync(__dirname+'/../'+p,'utf8');
const html=read('panel-mosaic-lab/cockpit/index.html');
for(const part of [
 'classic-toga-ch4-v1.js','toga-unified-ch4-v1.js',
 'lvlchg-thrust-servo-ch4-v1.js','manual-n1-live-v1.js',
 'fuel-used-physical-ch7-v1.js','mcp-afds-bridge-v1.js',
 'engine-indication-live-v2.js'])assert.ok(html.includes(part),'Missing live '+part);
const png=fs.readFileSync(__dirname+'/../panel-mosaic-lab/cockpit/assets/manual-n1-raster-20261119.png');
assert.equal(png.subarray(0,8).toString('hex'),'89504e470d0a1a0a','Manual N1 physical control must be PNG');
assert.ok(read('panel-mosaic-lab/cockpit/throttle-levers.js').includes('b737:toga-request'));
assert.ok(read('panel-mosaic-lab/cockpit/fuel-used-physical-ch7-v1.js').includes('pointercancel'));
assert.ok(read('panel-mosaic-lab/cockpit/smiths-fuel-quantity-v1.js').includes('Math.floor(Math.max(0, raw) / 20) * 20'));
assert.ok(read('panel-mosaic-lab/cockpit/engine-indication-live-v2.js').includes('fuelResetDueAt=now+1000'));
assert.ok(read('panel-mosaic-lab/cockpit/manual-n1-live-v1.js').includes('atInfluenced:false'));
let m={power:true,controls:{atArm:true},modes:{vertical:'LVL_CHG',thrust:'RETARD'}};
let fuelFmc=false,tick=null;const commands=[],visual=[];
const aircraft={engine1:{running:true,n1Percent:85,throttle:.55},
 engine2:{running:true,n1Percent:85.2,throttle:.57}};
const win={
 document:{readyState:'loading',getElementById:()=>null,addEventListener:()=>{},
  dispatchEvent:e=>visual.push(e.detail)},
 addEventListener:()=>{},console:{warn:()=>{}},setInterval:fn=>{tick=fn},
 B737McpAFDSBridgeV1:{getOutput:()=>m},
 B737ManualN1LiveV1:{getState:()=>({
  1:{automaticSource:fuelFmc?'FMC':'EST',automaticPct:91.8,pulled:true,source:'MAN',targetPct:95},
  2:{automaticSource:fuelFmc?'FMC':'EST',automaticPct:91.9,pulled:false,source:'FMC',targetPct:91.9}})},
 B737ISNCockpitV1:{
  getPropulsionSnapshot:()=>({engines:aircraft}),
  levelChangeThrottleCommand:command=>{commands.push(command);return {accepted:true};}
 }};
vm.runInNewContext(read('panel-mosaic-lab/cockpit/lvlchg-thrust-servo-ch4-v1.js'),
 {window:win,CustomEvent:function(_,args){this.detail=args.detail;},console});
assert.equal(typeof tick,'function');
tick();
assert.equal(commands.length,2,'Both running engines retard on LVL CHG descent');
assert.ok(commands.every(c=>c.value===0&&c.phase==='DESCENT'));
commands.length=0;
m={...m,modes:{...m.modes,thrust:'N1'}};
tick();assert.equal(commands.length,0,'EST must never command autothrottle');
assert.match(win.B737LevelChangeThrustCh4V1.getState().reason,/FMC LIMIT NOT AVAILABLE/);
fuelFmc=true;tick();
assert.equal(commands.length,2,'Verified FMC AUTO N1 may command both running engines');
assert.ok(commands.every(c=>c.value>=0&&c.value<=1&&c.phase==='CLIMB'));
const cmd1=commands.find(x=>x.engine==='engine1');
assert.ok(cmd1.value<.58,'Manual N1 knob set at 95% MUST NOT influence A/T target');
console.log('PASS Unified CH4 physical controls: PNG, T/O G/A, both fuel used switches, 20kg Smiths and source-gated LVL CHG live servo');
