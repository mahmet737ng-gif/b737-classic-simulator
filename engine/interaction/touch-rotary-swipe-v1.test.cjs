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


// Real capture-phase gesture routing regression. The generic Unified touch
// router previously consumed pointerup and turned EVERY ASP tap into a wheel
// tick. This compact fake DOM exercises the actual installed event handlers,
// including the synthesized click and duplicate-click suppression.
assert.equal(ASP_SWIPE_START_PX,12);
assert.equal(ASP_VOLUME,'.asp-photo-control[data-kind="volume"]');
{
  const handlers=new Map();
  const previousWheelEvent=globalThis.WheelEvent;
  globalThis.WheelEvent=class{
    constructor(type,options){this.type=type;Object.assign(this,options);}
  };
  try {
    const doc={
      head:{appendChild(){}},
      createElement(){return {id:'',textContent:''};},
      addEventListener(type,cb){handlers.set(type,cb);},
      defaultView:{addEventListener(){}}
    };
    assert.equal(install(doc),true);
    assert.equal(install(doc),false,'touch router installs once, avoiding double taps');
    let clicks=0,volumeTicks=0,volumeDirection=0;
    const volumeKnob={
      disabled:false,captured:null,
      getAttribute(){return null;},
      closest(selector){return selector.includes(ASP_VOLUME)?this:null;},
      matches(selector){return selector.includes(ASP_VOLUME);},
      setPointerCapture(id){this.captured=id;},
      hasPointerCapture(id){return this.captured===id;},
      releasePointerCapture(){this.captured=null;},
      getBoundingClientRect(){return {left:0,top:0,width:90,height:90};},
      focus(){},
      dispatchEvent(event){if(event.type==='wheel'){volumeTicks++;volumeDirection+=-Math.sign(event.deltaY);}return true;},
      click(){
        const ev={detail:0,target:this,cancelable:true,
          preventDefault(){},stopImmediatePropagation(){}};
        handlers.get('click')(ev);
        clicks++;
      }
    };
    const pointer=(target,x,y,time,id=1)=>({
      target,pointerType:'touch',pointerId:id,isPrimary:true,button:0,
      clientX:x,clientY:y,timeStamp:time,cancelable:true,
      prevented:false,stopped:false,
      preventDefault(){this.prevented=true;},
      stopImmediatePropagation(){this.stopped=true;}
    });
    const trigger=(name,e)=>handlers.get(name)(e);
    function touchTap(x=42,y=42,id=1){
      trigger('pointerdown',pointer(volumeKnob,x,y,0,id));
      trigger('pointerup',pointer(volumeKnob,x,y,80,id));
    }
    touchTap();
    assert.equal(clicks,1,'ASP touch tap must select receiver once');
    assert.equal(volumeTicks,0,'ASP touch tap must NEVER rotate the volume');
    touchTap(67,45,2);
    assert.equal(clicks,2,'second tap toggles the same selection back off');
    assert.equal(volumeTicks,0,'tap on right edge also must not rotate');
    trigger('pointerdown',pointer(volumeKnob,40,40,100,3));
    trigger('pointermove',pointer(volumeKnob,46,45,112,3));
    trigger('pointerup',pointer(volumeKnob,46,45,145,3));
    assert.equal(clicks,3,'small finger jitter is still a tap to select');
    assert.equal(volumeTicks,0,'sub-12px jitter must not rotate');
    trigger('pointerdown',pointer(volumeKnob,40,40,200,4));
    trigger('pointermove',pointer(volumeKnob,76,40,230,4));
    trigger('pointerup',pointer(volumeKnob,76,40,260,4));
    assert.equal(clicks,3,'deliberate swipe must not change receiver selection');
    assert.ok(volumeTicks>0,'swipe beyond dead-zone rotates knob');
    assert.ok(volumeDirection>0,'right swipe increases ASP volume');
    const beforeReverse=volumeDirection;
    trigger('pointerdown',pointer(volumeKnob,72,40,300,5));
    trigger('pointermove',pointer(volumeKnob,35,40,330,5));
    trigger('pointerup',pointer(volumeKnob,35,40,360,5));
    assert.ok(volumeDirection<beforeReverse,'left swipe reverses volume');
    const beforeUp=volumeDirection;
    trigger('pointerdown',pointer(volumeKnob,45,70,400,6));
    trigger('pointermove',pointer(volumeKnob,45,20,440,6));
    trigger('pointerup',pointer(volumeKnob,45,20,480,6));
    assert.ok(volumeDirection>beforeUp,'upward swipe also rotates clockwise');
    assert.equal(clicks,3,'none of the swipes toggled receiver selection');
    trigger('pointerdown',pointer(volumeKnob,45,45,500,7));
    trigger('pointercancel',pointer(volumeKnob,45,45,510,7));
    assert.equal(clicks,3,'cancelled gesture does not select or rotate');
    const possibleGhost=pointer(volumeKnob,45,45,520,7);
    possibleGhost.detail=1;
    trigger('click',possibleGhost);
    assert.equal(possibleGhost.stopped,true,'ghost click after touch must be suppressed');
  } finally {
    if(previousWheelEvent===undefined)delete globalThis.WheelEvent;
    else globalThis.WheelEvent=previousWheelEvent;
  }
}
console.log('ASP tap-select/swipe-volume touch regression passed');
