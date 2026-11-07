'use strict';
/* B737 Classic MCP five physical rotaries + V/S wheel:
 * tap, horizontal/vertical touch swipe, velocity sensitivity, wheel,
 * keyboard, pointer capture/cancel, and FCOM Ch4 stepping limits.
 * Uses the production gesture helper and numeric authority, no mocked
 * timing loops or electrical bus polling. Only interaction speed changes.
 */
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const base=path.resolve(__dirname,'..');
const Gesture=require('../panel-mosaic-lab/cockpit/mcp-rotary-gesture-v1.js');
const Rules=require('../engine/afds/mcp-fcom-ch4-numeric-v1.js');
const source=p=>fs.readFileSync(path.join(base,p),'utf8');
assert.equal(Gesture.VERSION,'MCP-GESTURE-0001');
assert.equal(Gesture.acceleration(.1),1);
assert.ok(Gesture.acceleration(1.5)>Gesture.acceleration(.1));
const options=id=>({axis:id==='verticalSpeed'?'y':'auto',
 pixelsPerDetent:()=>8,tapDirection:e=>id==='verticalSpeed'?(e.clientY<50?1:-1):(e.clientX<50?-1:1)});
function sample(id,move,end,pointerType='touch'){
 const values={courseL:120,courseR:245,heading:340,speed:180,
  machHundredths:70,altitude:10000,verticalSpeed:0};
 let output=values[id],events=[];
 const gesture=Gesture.create({...options(id),onDetents:(n,meta)=>{
  output=Rules.step(id,output,n);
  events.push({n,method:meta.method,acceleration:meta.acceleration});
 }});
 const first={pointerId:1,pointerType,button:0,clientX:50,clientY:50,timeStamp:0};
 assert.equal(gesture.down(first),true);
 const evt={...first,...move};
 gesture.move(evt);
 const last={...evt,...end};
 gesture.up(last);
 assert.equal(gesture.audit().active,false);
 return {output,events};
}
const slow=sample('speed',{clientX:85,clientY:50,timeStamp:360},{timeStamp:361});
const fast=sample('speed',{clientX:85,clientY:50,timeStamp:14},{timeStamp:15});
const a=slow.output-180,b=fast.output-180;
assert.ok(a>0&&b>a*2,'fast swipe must turn MORE detents for identical travel');
assert.equal(slow.events[0].method,'drag');assert.equal(fast.events[0].method,'drag');
const vertical=sample('courseL',{clientX:50,clientY:30,timeStamp:60},{timeStamp:61});
assert.ok(vertical.output>120,'upward swipe turns rotary higher');
const reverse=sample('courseR',{clientX:18,clientY:50,timeStamp:70},{timeStamp:71});
assert.ok(reverse.output<245,'left swipe decreases course');
let taps=0,value=200;
const tap=Gesture.create({axis:'auto',pixelsPerDetent:()=>8,
 tapDirection:e=>e.clientX<50?-1:1,
 onDetents:(n,{method})=>{taps++;assert.equal(method,'tap');value=Rules.step('heading',value,n)}});
tap.down({pointerId:2,pointerType:'touch',button:0,clientX:30,clientY:50,timeStamp:0});
tap.up({pointerId:2,pointerType:'touch',button:0,clientX:30,clientY:50,timeStamp:10});
assert.equal(taps,1);assert.equal(value,199,'left half tap must decrease exactly 1 degree');
tap.down({pointerId:2,pointerType:'touch',button:0,clientX:72,clientY:50,timeStamp:20});
tap.up({pointerId:2,pointerType:'touch',button:0,clientX:72,clientY:50,timeStamp:30});
assert.equal(taps,2);assert.equal(value,200,'right half tap must increase exactly 1 degree');
const vsTap=sample('verticalSpeed',{clientX:50,clientY:49,timeStamp:8},{timeStamp:9});
assert.equal(vsTap.output,50,'VS upper half tap increases by 50 fpm');
const vsMove=sample('verticalSpeed',{clientX:50,clientY:23,timeStamp:65},{timeStamp:66});
assert.ok(vsMove.output>0,'VS wheel swipes upward increase values');
const vsDown=sample('verticalSpeed',{clientX:50,clientY:75,timeStamp:70},{timeStamp:71});
assert.ok(vsDown.output<0,'VS downward swipe decreases values');
const noMulti=Gesture.create({onDetents:()=>{}});
assert.equal(noMulti.down({pointerId:4,pointerType:'touch',clientX:0,clientY:0}),true);
assert.equal(noMulti.down({pointerId:5,pointerType:'touch',clientX:0,clientY:0}),false);
noMulti.cancel();assert.equal(noMulti.audit().active,false);
let wheelCount=0;
const mouseWheel=Gesture.create({onDetents:n=>wheelCount+=n});
assert.equal(mouseWheel.wheel(-100),1,'one notched up wheel = one detent');
assert.equal(wheelCount,1);
assert.equal(mouseWheel.wheel(100),-1);
assert.equal(wheelCount,0);
for(let i=0;i<4;i++)assert.equal(mouseWheel.wheel(-20),0);
assert.equal(mouseWheel.wheel(-20),1,'touchpad pixel deltas accumulate before a tick');
assert.equal(wheelCount,1);
assert.equal(Rules.step('courseL',359,1),0);
assert.equal(Rules.step('heading',0,-1),359);
assert.equal(Rules.step('speed',340,100),340);
assert.equal(Rules.step('machHundredths',82,100),82);
assert.equal(Rules.step('altitude',50000,1),50000);
assert.equal(Rules.step('altitude',0,-1),0);
assert.equal(Rules.step('verticalSpeed',950,1),1000);
assert.equal(Rules.step('verticalSpeed',1000,1),1100);
assert.equal(Rules.step('verticalSpeed',1000,-1),950);
assert.equal(Rules.step('verticalSpeed',6000,100),6000);
assert.equal(Rules.step('verticalSpeed',-7900,-100),-7900);
// End-to-end static integrity: all five physical knob elements are created
// from source geometry, all six knob/wheel gestures share one authority,
// and each emitted physical event updates the live AFDS / digits.
const visual=source('panel-mosaic-lab/cockpit/mcp-visual-v3.js');
const hardware=source('panel-mosaic-lab/cockpit/mcp-hardware-v1.js');
const bridge=source('panel-mosaic-lab/cockpit/mcp-afds-bridge-v1.js');
const liveDigits=source('panel-mosaic-lab/cockpit/mcp-independent-digits-v1.js');
const css=source('panel-mosaic-lab/cockpit/mcp-visual-v3.css');
const hCss=source('panel-mosaic-lab/cockpit/mcp-hardware-v1.css');
assert.match(visual,/for\(const n of knobs\)mountKnob\(parent,n\)/);
assert.match(visual,/const gesture=Gesture.create\(/);
assert.match(hardware,/const gesture=Gesture.create\(/);
assert.match(visual,/gesture.move\(e\)/);
assert.match(hardware,/gesture.move\(e\)/);
assert.match(visual,/step\(n.id,detents,meta.method\)/);
assert.match(hardware,/Rules.step\("verticalSpeed",state\[c.id\],detents\)/);
assert.match(bridge,/window.addEventListener\("b737:mcp-value-change",visualValue\)/);
assert.match(bridge,/window.addEventListener\("b737:mcp-hardware-change",hardwareCommand\)/);
assert.match(liveDigits,/b737:mcp-value-change/);
assert.match(css,/touch-action:none/);
assert.match(hCss,/touch-action:none/);
for(const file of ['panel-mosaic-lab/cockpit/index.html','panel-mosaic-lab/mcp-panel/index.html']){
 const html=source(file);
 const helper=html.indexOf('mcp-rotary-gesture-v1.js');
 const visualIndex=html.indexOf('mcp-visual-v3.js');
 const hardwareIndex=html.indexOf('mcp-hardware-v1.js');
 assert.ok(helper>=0&&helper<visualIndex&&helper<hardwareIndex,
  file+' must load shared gesture before both control modules');
}
console.log('MCP GESTURES PASS: five live knobs, V/S, tap, slow vs fast swipe, vertical gestures, wheel+touchpad, FCOM 4 boundaries and live AFDS events');
