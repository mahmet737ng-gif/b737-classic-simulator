'use strict';
// MCP -> EFIS event/source contract. Sensor data and controls are never
// fabricated to make a selector move. Both seats have independent display
// selectors while the MCP supplies HDG and selected SG's course.
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const Sources=require('./unified-efis-sources-v1.js');
const Fma=require('../../engine/afds/fma-mode-engine-v1.js');
const rec=value=>({quality:'VALID',value,receivedAtMs:1000,origin:'TRAINING_SCENARIO'});
const irs={powered:true,attitudeValid:true,positionValid:true,pitchDeg:0,rollDeg:0,
 headingDeg:100,trackDeg:100,magneticVariationDeg:5,gsKt:0};
const selected={powered:true,course2Powered:true,headingDeg:127,courseL:223,courseR:345,
 selectedSpeedKt:185,selectedMachHundredths:74,speedDisplayMode:'IAS',
 speedBlank:false,altitudeFt:15000,verticalSpeedFpm:1300,
 lateralMode:'HDG_SEL',verticalMode:'VS',thrustMode:'SPEED',autopilotMode:'CMD_A',
 fdLeft:true,fdRight:true};
const snapshot=(mcp=selected)=>({'irs.left':rec(irs),'irs.right':rec(irs),
 ...(mcp===undefined?{}:{'mcp.state':rec(mcp)})});
const resolve=(seat,mcp=selected,toggles={})=>Sources.resolve(snapshot(mcp),seat,toggles,
 {1:true,2:true},{1:false,2:false});
test('MCP heading bug, selected course, speed and AFDS target metadata reach both EFIS sides',()=>{
 const c=resolve('CAPT'),f=resolve('FO');
 assert.equal(c.selectedHeading,127);assert.equal(f.selectedHeading,127);
 assert.equal(c.course,223);assert.equal(f.course,345);
 assert.equal(c.mcp.courseDeg,223);assert.equal(f.mcp.courseDeg,345);
 for(const value of [c,f]){
  assert.equal(value.mcp.selectedSpeedKt,185);
  assert.equal(value.mcp.speedDisplayMode,'IAS');
  assert.equal(value.mcp.altitudeSelectedFt,15000);
  assert.equal(value.mcp.verticalSpeedSelectedFpm,1300);
  assert.equal(value.mcp.lateralMode,'HDG_SEL');
  assert.equal(value.mcp.verticalMode,'VS');
  assert.equal(value.mcp.autopilotMode,'CMD_A');
 }
});
test('MCP COURSE follows selected SG while the EFIS pilot settings stay local',()=>{
 const c=resolve('CAPT',selected,{'efi-transfer':'BOTH ON 2'});
 assert.equal(c.sg,2);assert.equal(c.sourceSeat,'FO');
 assert.equal(c.course,345);
 assert.equal(c.selectedHeading,127);
 const f=resolve('FO',selected,{'efi-transfer':'BOTH ON 1'});
 assert.equal(f.sg,1);assert.equal(f.course,223);
});
test('Independent COURSE2 feed fails dark while main HDG and course L remain live',()=>{
 const m={...selected,course2Powered:false};
 const c=resolve('CAPT',m),f=resolve('FO',m);
 assert.equal(c.course,223);
 assert.equal(f.course,null);
 assert.equal(f.mcp.course2Powered,false);
 assert.equal(c.selectedHeading,127);
 assert.equal(f.selectedHeading,127);
});
test('Battery-fed COURSE2 can remain available with main MCP power lost',()=>{
 const m={...selected,powered:false,course2Powered:true};
 const c=resolve('CAPT',m),f=resolve('FO',m);
 assert.equal(c.course,null);
 assert.equal(f.course,345);
 assert.equal(c.selectedHeading,null);
 assert.equal(f.selectedHeading,null);
 assert.equal(f.mcp.selectedSpeedKt,null);
 assert.equal(f.mcp.altitudeSelectedFt,null);
 assert.equal(f.mcp.verticalMode,null);
});
test('VNAV/MACH blank is not interpreted as IAS or as a manufactured CAS speed',()=>{
 const m={...selected,speedDisplayMode:'MACH',speedBlank:true};
 const c=resolve('CAPT',m);
 assert.equal(c.mcp.powered,true);
 assert.equal(c.mcp.speedBlank,true);
 assert.equal(c.mcp.speedDisplayMode,'MACH');
 assert.equal(c.mcp.selectedSpeedKt,null);
});
test('No MCP or no magnetic reference suppresses course/heading symbols',()=>{
 const c=Sources.resolve({'irs.left':rec(irs),'irs.right':rec(irs)},'CAPT',{},
   {1:true,2:true},{1:false,2:false});
 assert.equal(c.course,null);assert.equal(c.selectedHeading,null);
 const x=Sources.resolve(snapshot(selected),'CAPT',{}, {1:true,2:true},{1:false,2:false});
 assert.equal(x.heading,95);
 assert.equal(x.selectedHeading,127);
 const noVariation={...irs,magneticVariationDeg:null};
 const broken={'irs.left':rec(noVariation),'irs.right':rec(irs),'mcp.state':rec(selected)};
 const y=Sources.resolve(broken,'CAPT',{}, {1:true,2:true},{1:false,2:false});
 assert.equal(y.selectedHeading,null);assert.equal(y.course,null);
});
test('MCP selection is not a fabricated FD servo, LOC or GS capture',()=>{
 const root=__dirname;
 const eadi=fs.readFileSync(path.join(root,'eadi-lab-unified-v2.js'),'utf8');
 const ehsi=fs.readFileSync(path.join(root,'ehsi-unified-v1.js'),'utf8');
 const avionics=fs.readFileSync(path.join(root,'avionics-network-runtime-v1.js'),'utf8');
 const renderer=fs.readFileSync(path.join(root,'../../efis-display-lab/eadi.js'),'utf8');
 assert.match(eadi,/selectedSpeedKt:src\.mcp\?\.selectedSpeedKt/);
 assert.match(eadi,/selectedSpeedValid:src\.mcp\?\.powered===true/);
 assert.match(eadi,/director:src\.director/);
 assert.match(renderer,/p\.selSpeed=input\.selectedSpeedValid===true/);
 assert.match(ehsi,/dataset\.mcpHeadingBug/);
 assert.match(ehsi,/dataset\.mcpCourse/);
 assert.match(avionics,/course2Powered:s\.course2Power/);
 assert.match(avionics,/speedDisplayMode:s\.speedDisplayMode/);
 const state=Fma.fromMcp({schema:'B737_MCP_AFDS_OUTPUT_V1',power:true,
   modes:{thrust:null,lateral:'HDG_SEL',vertical:'VS',autopilot:'CMD_A'},
   controls:{atArm:false,fd:{left:true,right:true}},
   axisControl:{pitch:'CMD',roll:'CMD'}},'CAPT');
 assert.equal(state.roll.active,'HDG SEL');
 assert.equal(state.pitch.active,'V/S');
 assert.equal(state.afds.active,'CMD');
 assert.equal(state.pitch.armed,'');
 assert.equal(state.roll.armed,'');
});
