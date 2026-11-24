'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {Motion}=require('../panel-mosaic-lab/cockpit/cabin-needle-motion-v1');
const model=require('../panel-mosaic-lab/cockpit/cabin-dual-needles-model');
const motion=new Motion({
 cabAlt:model.cabinAltitudePreviewBearing(14000),
 press:model.differentialPressurePreviewBearing(8)
},{durationMs:960});
const emergencyDescent=[
 [13500,7.6],[12000,7.1],[10000,6.4],[8500,5.9],
 [7000,5.2],[5500,4.1],[4000,3.1],[2500,2.0],[1200,1.0]
];
let ms=0,prev=motion.view(),checks=0;
for(const [alt,psi] of emergencyDescent){
 const toAlt=model.cabinAltitudePreviewBearing(alt);
 const toPress=model.differentialPressurePreviewBearing(psi);
 motion.retarget('cabAlt',toAlt,ms);motion.retarget('press',toPress,ms);
 // Same pressurization output may be published every render frame: unchanged
 // samples must never restart a transition or snap to an initial angle.
 for(let i=0;i<25;i++){
  ms+=40;
  motion.retarget('cabAlt',toAlt,ms);
  motion.retarget('press',toPress,ms);
  motion.advance(ms);
  const next=motion.view();
  assert.ok(next.cabAlt<=prev.cabAlt+0.0001,'CAB ALT cannot jump back toward start');
  assert.ok(next.press<=prev.press+0.0001,'DIFF PRESS cannot jump back toward start');
  assert.ok(next.cabAlt>=toAlt-0.0001,'CAB ALT must not overshoot target');
  assert.ok(next.press>=toPress-0.0001,'DIFF PRESS must not overshoot target');
  assert.ok(Math.abs(next.cabAlt-prev.cabAlt)<20,'CAB ALT cannot teleport between 40ms frames');
  assert.ok(Math.abs(next.press-prev.press)<20,'DIFF PRESS cannot teleport between 40ms frames');
  prev=next;checks++;
 }
 assert.ok(Math.abs(prev.cabAlt-toAlt)<0.000001);
 assert.ok(Math.abs(prev.press-toPress)<0.000001);
}
const final=motion.view();
assert.ok(final.cabAlt>0&&final.press>0);
const hold=motion.view();motion.retarget('cabAlt',motion.target('cabAlt'),ms);
assert.deepEqual(motion.view(),hold,'repeat state cannot jump to startup');
motion.snap('cabAlt',0);assert.equal(motion.get('cabAlt'),0,'manual QA may still explicitly set zero');
assert.ok(motion.get('press')>0,'manual set of CAB ALT must not affect PRESS');
const ui=fs.readFileSync(path.join(__dirname,'../panel-mosaic-lab/cockpit/cabin-dual-needles-unified.js'),'utf8');
const html=fs.readFileSync(path.join(__dirname,'../panel-mosaic-lab/cockpit/index.html'),'utf8');
assert.ok(html.includes('cabin-needle-motion-v1.js?v=CDN-SMOOTH-0001'),'Unified must load motion engine first');
assert.ok(ui.includes('motion.retarget(id,angle,clock())'),'live targets must interpolate');
assert.ok(ui.includes('if([...next.values()].every(Boolean))'),'overhead remount must rebind actual needles');
assert.ok(ui.includes("transition:'none'"),'CSS must not independently reset the motion');
assert.ok(ui.includes("if(window.B737UnifiedFlightScenarioV1?.getDiagnostics?.()?.active===true)return"),
  'manual QA angle event must not override active emergency descent');
console.log('PASS: '+checks+' continuous emergency descent frames; monotone CAB ALT / PRESS, no zero resets, no stale re-targeting and safe overhead remount.');
