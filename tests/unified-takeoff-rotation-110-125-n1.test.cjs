'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const Core=require('../engine/flight/flight-scenario-core-v1.js');
const Aero=require('../engine/flight/classic-low-speed-envelope-v1.js');
const Toga=require('../engine/afds/classic-toga-ch4-v1.js');
const MCP=require('../engine/afds/mcp-mode-core-v1.js');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
const thrust={valid:true,engines:[{running:true,n1Percent:95},{running:true,n1Percent:95}]};
function flight(){return Core.command(Core.newScenario({airport:'OIMM',preset:'RUNWAY_READY'}),{type:'TAKEOFF_ROLL'});}
test('Runway-ready instructor model uses 110 kt stall and an upper buffer no greater than 125',()=>{
 const s=Core.step(flight(),.1,thrust);
 assert.equal(s.aeroEnvelope.stallKt,110);
 assert.equal(s.aeroEnvelope.stickShakerKt,110);
 assert.equal(s.aeroEnvelope.buffer.upperKt,125);
 assert.equal(s.aeroEnvelope.takeoffTrainingProfile,true);
 const manual=Aero.evaluate({iasKt:145,flapLever:30,flapActual:30,bankDeg:0,airborne:true});
 assert.notEqual(manual.stallKt,110,'Other flight presets retain mass/flap physics');
});
test('No pre-rotation: at 144 kt trainer pitch stays on ground and zero',()=>{
 let s={...flight(),iasKt:143.5,tasKt:143.5,gsKt:143.5};
 s=Core.step(s,.1,thrust);
 assert.ok(s.iasKt<145);assert.equal(s.pitchDeg,0);
 assert.equal(s.airborne,false);assert.equal(s.rotationStarted,false);
});
test('Reaching VR=145 starts rate-limited rotation, not instant liftoff',()=>{
 let s={...flight(),iasKt:144.95,tasKt:144.95,gsKt:144.95};
 s=Core.step(s,.1,thrust);
 assert.ok(s.iasKt>=145);assert.ok(s.pitchDeg>0&&s.pitchDeg<1);
 assert.equal(s.airborne,false);
 assert.equal(s.flightControl.source,'TRAINER_AUTO_ROTATION_NOT_AP');
 for(let i=0;i<50&&!s.airborne;i++)s=Core.step(s,.1,thrust);
 assert.equal(s.airborne,true);
 assert.ok(s.pitchDeg>=8&&s.pitchDeg<=10);
 assert.equal(s.phase,'INITIAL_CLIMB');
 assert.equal(s.target.verticalMode,'PITCH');
 assert.equal(s.target.pitchDeg,15);
 const next=Core.step(s,.2,thrust);
 assert.ok(next.pitchDeg>=s.pitchDeg&&next.pitchDeg<=15);
 assert.ok(next.vsFpm>=0);
});
test('Manual pitch has authority over trainer rotation and can follow F/D without CMD',()=>{
 let s={...flight(),iasKt:144,tasKt:144,gsKt:144};
 s=Core.command(s,{type:'PITCH',value:10,source:'MANUAL_PILOT'});
 assert.equal(s.takeoffAutoMode,false);
 s=Core.step(s,.2,thrust);
 assert.ok(s.pitchDeg>0&&s.pitchDeg<1);
 for(let i=0;i<45&&!s.airborne;i++)s=Core.step(s,.1,thrust);
 assert.equal(s.airborne,true);
 assert.equal(s.target.pitchDeg,10,'Manual pilot owns pitch after lift-off');
 s=Core.command(s,{type:'PITCH',value:9,source:'MANUAL_PILOT'});
 assert.equal(s.takeoffAutoMode,false);
});
test('FD OFF TOGA starts takeoff but auto-pop waits for IAS above 80',()=>{
 const ctx={groundReady:true,airborne:false,fdLeft:false,fdRight:false,
  atArmed:true,engine1Running:true,engine2Running:true,
  iasKt:0,radioAltitudeFt:0,selectedSpeedKt:165,takeoffSpeedIncrementKt:15};
 let s=Toga.press(Toga.initial(),ctx);
 assert.equal(s.phase,'TO');assert.equal(s.fdAutoPopUp,false);
 assert.equal(s.targetSpeedKt,180);
 s=Toga.advance(s,{...ctx,iasKt:80},.2);assert.equal(s.fdAutoPopUp,false);
 s=Toga.advance(s,{...ctx,iasKt:81},.2);assert.equal(s.fdAutoPopUp,true);
});
test('Post-400 ARM to N1 requires armed A/T and preserves N1 beyond 84kt',()=>{
 const ctx={groundReady:true,fdLeft:true,fdRight:true,atArmed:true,
  engine1Running:true,engine2Running:true,iasKt:0,radioAltitudeFt:0,
  selectedSpeedKt:165,takeoffSpeedIncrementKt:15};
 let s=Toga.press(Toga.initial(),ctx);
 s=Toga.advance(s,{...ctx,iasKt:85},1);
 s=Toga.advance(s,{...ctx,airborne:true,radioAltitudeFt:401,iasKt:160,vsFpm:1100},10);
 s=Toga.advance(s,{...ctx,airborne:true,radioAltitudeFt:450,iasKt:170,vsFpm:1100},10);
 s=Toga.advance(s,{...ctx,airborne:true,radioAltitudeFt:450,iasKt:175,vsFpm:1100},9);
 assert.equal(s.atMode,'ARM');
 assert.equal(Toga.selectN1(s,{...ctx,radioAltitudeFt:399}).atMode,'ARM');
 assert.equal(Toga.selectN1(s,{...ctx,radioAltitudeFt:450,atArmed:false}).atMode,'ARM');
 s=Toga.selectN1(s,{...ctx,radioAltitudeFt:450});
 assert.equal(s.atMode,'N1');assert.equal(s.n1SelectedAfterArm,true);
 assert.equal(s.thrustDemand,'TAKEOFF_LIMIT');
 s=Toga.advance(s,{...ctx,airborne:true,radioAltitudeFt:600,iasKt:180},.3);
 assert.equal(s.atMode,'N1');
});
test('Integration wires automatic FD follow and manual control distinctly',()=>{
 const scenario=read('panel-mosaic-lab/cockpit/flight-scenario-panel-v1.js');
 const visual=read('panel-mosaic-lab/cockpit/eadi-speed-tape-v1.js');
 const toga=read('panel-mosaic-lab/cockpit/toga-unified-ch4-v1.js');
 const mode=read('engine/afds/mcp-mode-core-v1.js');
 assert.ok(scenario.includes("source:'TRAINER_AUTO_TO'"));
 assert.ok(scenario.includes("source:'MANUAL_PILOT'"));
 assert.ok(scenario.includes('flightManualPitchApply'));
 assert.ok(visual.includes('trainingLowSpeed:'));
 assert.ok(visual.includes("minimumManeuverKt:envelope.minimumManeuverKt"));
 assert.ok(toga.includes("state=T.initial()")&&toga.includes('T.selectN1(state,context())'));
 assert.ok(mode.includes("s.togaActive===true&&id==='N1'"));
});

test('real MCP mode core permits N1 after 400 RA with both F/D switches OFF only in TOGA',()=>{
 const fresh=()=>{const s=MCP.initialState();
  s.electrical.mcpPower=true;s.autoThrottleArm=true;
  s.togaActive=true;s.flight={radioAltitudeFt:450};
  s.fd.left=false;s.fd.right=false;return s;};
 const accepted=MCP.transition(fresh(),{type:'BUTTON',id:'N1'});
 assert.equal(accepted.modes.thrust,'N1');
 const early=fresh();early.flight.radioAltitudeFt=399;
 const blocked=MCP.transition(early,{type:'BUTTON',id:'N1'});
 assert.notEqual(blocked.modes.thrust,'N1');
 const withoutToga=fresh();withoutToga.togaActive=false;
 assert.notEqual(MCP.transition(withoutToga,{type:'BUTTON',id:'N1'}).modes.thrust,'N1');
});
