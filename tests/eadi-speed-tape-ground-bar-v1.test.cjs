'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const speed=require('../engine/efis/classic-speed-tape-engine-v1.js');
const tape=require('../panel-mosaic-lab/cockpit/eadi-speed-tape-v1.js');
function ctxTrace(){
 const calls=[],c={
  strokeStyle:'',fillStyle:'',lineWidth:1,
  save(){},restore(){},beginPath(){},rect(){},clip(){},fillRect(){},
  strokeRect(){},moveTo(){},lineTo(){},closePath(){},fill(){},arc(){},fillText(){},
  stroke(){calls.push({color:this.strokeStyle,width:this.lineWidth});}
 };
 return {c,calls};
}
const view=(inFlight)=>({
 schema:'B737_CLASSIC_SPEED_TAPE_VIEW_V1',casKt:130,range:{minKt:88,maxKt:172},
 tapeCenterKt:130,lowSpeedDefault:false,rollingDigitsVisible:false,
 inFlight,flags:{SPD:false,SEL_SPD_INOP:false,V1_INOP:false,SPD_LIM:false},
 marks:{minimumManeuverKt:150,stickShakerKt:130,trainingOperatingLimit:null,
  highSpeedBuffetKt:null,nextFlapPlacardKt:null,maximumOperatingKt:null,
  flapBuffer:null,flapsUpKt:null,retractKt:null,vrKt:null,v1Kt:null,vrefKt:null},
 command:null,trend:null,provenance:'SIMULATOR_ADC'
});
test('SpeedTape engine projects CONFIRMED ground and airborne phases, with unknown distinct',()=>{
 const mk=v=>speed.transition(speed.initialState('CAPT'),{type:'CONFIG',inFlight:v,phase:v===false?'GROUND':v===true?'APPROACH':null});
 assert.equal(speed.view(mk(false)).inFlight,false);
 assert.equal(speed.view(mk(true)).inFlight,true);
 assert.equal(speed.view(mk(null)).inFlight,null);
});
test('EADI low-speed RED diagonal barber pole and warning bracket are suppressed on GROUND',()=>{
 const {c,calls}=ctxTrace();
 tape.draw(c,view(false));
 assert.equal(calls.filter(s=>s.color==='#d44747').length,0);
 assert.equal(calls.filter(s=>s.color==='#dfc53c').length,0);
});
test('EADI low-speed RED diagonal barber pole and caution bracket appear AIRBORNE',()=>{
 const {c,calls}=ctxTrace();
 tape.draw(c,view(true));
 assert.ok(calls.filter(s=>s.color==='#d44747').length>0);
 assert.ok(calls.filter(s=>s.color==='#dfc53c').length>0);
});
test('EADI does not invent ground when air/ground has unknown quality',()=>{
 const {c,calls}=ctxTrace();
 tape.draw(c,view(null));
 assert.ok(calls.some(s=>s.color==='#d44747'));
});
test('Unified EADI honors instructor phase first, then airground avionics signal',()=>{
 const fs=require('node:fs'),path=require('node:path');
 const code=fs.readFileSync(path.join(__dirname,'../panel-mosaic-lab/cockpit/eadi-lab-unified-v2.js'),'utf8');
 assert.match(code,/knownGround=typeof activeScene\?\.airborne==='boolean'/);
 assert.match(code,/airground\?\.quality==='VALID'/);
 assert.match(code,/speedView=\{\.\.\.speedView,inFlight:!knownGround\}/);
});
