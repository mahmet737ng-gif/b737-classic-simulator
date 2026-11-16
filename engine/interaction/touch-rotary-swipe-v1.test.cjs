/* Deterministic, DOM-free regression checks for touch rotary gain and detents. */
const assert = require('node:assert/strict');
const { createMotion, tapDirection, selector, install, ASP_SWIPE_START_PX, ASP_VOLUME } = require('./touch-rotary-swipe-v1.js');
const slow = createMotion();
const fast = createMotion();
assert.equal(slow.feed(28,300), 2, 'slow right swipe makes two fine steps');
assert.ok(fast.feed(28,12) > 2, 'fast swipe over same distance makes more steps');
const left = createMotion();
assert.equal(left.feed(-28,300), -2, 'left swipe reverses rotary');
assert.equal(left.feed(0,10), 0, 'stationary finger never rotates');
const tiny = createMotion();
assert.equal(tiny.feed(3,200), 0, 'micro-movements accumulate without jitter');
assert.equal(tiny.feed(11,200), 1, 'slow motion eventually crosses one detent');
tiny.reset();
assert.equal(tiny.pending(), 0, 'new gestures do not inherit fractional travel');
assert.equal(tapDirection(30, { left: 0, width: 100 }), -1);
assert.equal(tapDirection(70, { left: 0, width: 100 }), 1);
assert.ok(selector.includes('.mounted-rotary'));
console.log('TOUCH-ROTARY-0001 motion tests passed');


// ASP is deliberately EXCLUDED from the generic document-capture router.
// The physical ASP button must receive its own pointerdown/up and return
// touch ownership immediately. A subsequent inert-panel gesture must be
// free to reach the cockpit's pinch/pan controller.
assert.equal(ASP_SWIPE_START_PX,12);
assert.equal(ASP_VOLUME,'.asp-photo-control[data-kind="volume"]');
assert.equal(selector.includes(ASP_VOLUME),false,
 'There must be just ONE ASP gesture owner (the native ASP control)');
{
 const handlers=new Map();
 const doc={
  head:{appendChild(){}},
  createElement(){return {id:'',textContent:''}},
  addEventListener(type,cb){handlers.set(type,cb)},
  defaultView:{addEventListener(){}}
 };
 assert.equal(install(doc),true);
 let stopCalls=0,rotaryWheelCalls=0;
 const asp={
  disabled:false,getAttribute(){return null},
  closest(query){return query===ASP_VOLUME?this:null},
  matches(query){return query===ASP_VOLUME},
  setPointerCapture(){throw Error('Generic router must not capture ASP')},
  focus(){throw Error('Generic router must not focus ASP')},
  dispatchEvent(){rotaryWheelCalls++},
  getBoundingClientRect(){return {left:0,width:80}}
 };
 const inert={
  closest(){return null}
 };
 const event=(target,id=1)=>({
  target,pointerType:'touch',pointerId:id,isPrimary:true,button:0,
  clientX:25,clientY:25,timeStamp:100,cancelable:true,
  preventDefault(){stopCalls++},stopImmediatePropagation(){stopCalls++}
 });
 handlers.get('pointerdown')(event(asp,1));
 handlers.get('pointerup')(event(asp,1));
 handlers.get('pointerdown')(event(inert,2));
 handlers.get('pointermove')(event(inert,2));
 handlers.get('pointerup')(event(inert,2));
 assert.equal(stopCalls,0,'A new pan touch must not be intercepted after an ASP touch');
 assert.equal(rotaryWheelCalls,0,'Generic gesture router may not turn any ASP volume');
}
console.log('ASP gesture lifecycle: native control owns touch; next pan immediately free');
