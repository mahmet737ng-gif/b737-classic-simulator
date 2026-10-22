const assert=require('node:assert/strict');
const G=require('../gestures.js');
function button(){const listeners=new Map();return {addEventListener(name,fn){listeners.set(name,fn)},removeEventListener(name){listeners.delete(name)},dispatch(name,extra={}){const e={pointerId:1,clientX:100,clientY:100,button:0,deltaMode:0,deltaY:0,preventDefault(){this.prevented=true},...extra};listeners.get(name)?.(e);return e;},setPointerCapture(){},hasPointerCapture(){return true},releasePointerCapture(){}}}
let count=0,pushCount=0;const el=button();G.attach(el,{rotary:true,onStep:n=>count+=n,onPress:()=>pushCount++});
el.dispatch('click');assert.equal(count,1,'tap advances rotary');
el.dispatch('wheel',{deltaY:-96});assert.equal(count,2,'wheel advances one detent');
el.dispatch('wheel',{deltaY:10});assert.equal(count,2,'small reversed wheel delta only accumulates');
el.dispatch('wheel',{deltaY:50});assert.equal(count,2,'opposite wheel direction remains below threshold');
el.dispatch('pointerdown');el.dispatch('pointermove',{clientY:38});assert.equal(count,4,'vertical swipe up advances two');el.dispatch('pointerup');el.dispatch('click');assert.equal(count,4,'drag synth-click must not apply a third change');
el.dispatch('pointerdown');el.dispatch('pointerup');el.dispatch('click');assert.equal(count,5,'fresh tap still works');
el.dispatch('pointerdown');el.dispatch('pointermove',{clientX:45,clientY:100});el.dispatch('pointerup');assert.equal(count,4,'horizontal left swipe decrements');
el.dispatch('keydown',{key:'ArrowDown'});assert.equal(count,3,'keyboard reverse');
el.dispatch('contextmenu');assert.equal(count,2,'right click reverse');
const push=button();G.attach(push,{rotary:false,onStep:()=>{throw Error('push changed rotary')},onPress:()=>pushCount++});
push.dispatch('wheel',{deltaY:100});assert.equal(pushCount,0,'wheel must not press buttons');
push.dispatch('click');assert.equal(pushCount,1,'tap presses button');
assert.equal(G.SWIPE_STEP_PX,28);
console.log('PASS EFIS gestures: mouse wheel, swipe touch/pointer, click/tap, no synthetic second click, push only on click');