'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const root=path.join(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const Core=require('../engine/flight/flight-scenario-core-v1.js');
const Geo=require('../engine/flight/iran-radio-navaids-v1.js');
const profiles=[
 {airport:'OIII',runway:'29L',vor:'TRN',ils:'ITHL'},
 {airport:'OIMM',runway:'31R',vor:'MSD',ils:'IMSD'},
 {airport:'OISS',runway:'29L',vor:'SYZ',ils:'ISYZ'}
];
const thresholds=s=>({[s.airport]:{[s.runway]:{
 lat:Geo.byIdent(s.ils).lat,lon:Geo.byIdent(s.ils).lon,
 elevationFt:Geo.byIdent(s.ils).elevationFt,
 courseTrueDeg:Geo.byIdent(s.ils).courseTrueDeg,
 glideDeg:Geo.byIdent(s.ils).glideDeg,
 tchFt:Geo.byIdent(s.ils).tchFt??50
}}});
test('Final 10 starts 10 NM from runway, one dot below ILS, level at 142 kt for all supported airports',()=>{
 for(const p of profiles){
  const s=Core.newScenario({airport:p.airport,runway:p.runway,preset:'FINAL_10'},thresholds(p));
  const ils=Geo.byIdent(p.ils),radio=Geo.evaluate(s,ils);
  assert.ok(Math.abs(Core.distanceNm(s,s.threshold)-10)<.001,p.airport);
  assert.equal(s.iasKt,142);
  assert.equal(s.gsKt,142);
  assert.equal(s.vsFpm,0);
  assert.equal(s.target.verticalMode,'ALTITUDE');
  assert.equal(s.target.lateralMode,'HEADING');
  assert.equal(s.glideslopeBelowDots,1);
  assert.ok(Math.abs(radio.glideslopeDots+1)<.035,p.airport+' GS='+radio.glideslopeDots);
  assert.ok(Math.abs(radio.localizerDots)<.035,p.airport);
 }
});
test('Final 5 and runway-ready keep their established start speed and flight phases',()=>{
 const f=Core.newScenario({airport:'OIII',runway:'29L',preset:'FINAL_5'},thresholds(profiles[0]));
 const g=Core.newScenario({airport:'OIII',runway:'29L',preset:'RUNWAY_READY'});
 assert.equal(f.iasKt,155);assert.equal(f.target.verticalMode,'GLIDEPATH');
 assert.equal(g.phase,'GROUND_READY');assert.equal(g.iasKt,0);
});
test('Cockpit 10 NM simulator uses one physical owner per system and reports all detailed setup checks',()=>{
 const state=Core.newScenario({airport:'OIII',runway:'29L',preset:'FINAL_10'},thresholds(profiles[0]));
 const checks=[],selected={},oh={},freq={},mode={},events=[],phases={engine1:'OFF',engine2:'OFF',apu:'OFF'};
 const lights={inputs:{speedBrakeArmedIndication:false}};
 const definitions=[
  ...['gen-1','gen-2','apu-gen-1','apu-gen-2'].map(id=>({id,states:['OFF','NEUTRAL','ON']})),
  {id:'apu-start',states:['OFF','ON','START']},
  ...['bleed-apu','bleed-eng-1','bleed-eng-2'].map(id=>({id,states:['OFF','ON']})),
  ...['pack-l','pack-r'].map(id=>({id,states:['OFF','AUTO','HIGH']})),
  {id:'isolation-valve',states:['CLOSE','AUTO','OPEN']},
  ...['landing-out-l','landing-out-r'].map(id=>({id,states:['RETRACT','EXTEND','ON']})),
  ...['landing-in-l','landing-in-r','strobe','anti-collision','wing-lights','runway-turnoff-l','runway-turnoff-r','taxi'].map(id=>({id,states:['OFF','ON']})),
  {id:'position-lights',states:['OFF','ON BAT','ON']},
  {id:'logo',states:['OFF','AUTO','ON']},
 ];
 let flap=0,autobrake='OFF';
 const sw={
  getRegistry:()=>({controls:definitions}),
  getState:()=>oh,
  setScenarioSwitch:(id,target)=>{
   const entry=definitions.find(x=>x.id===id);
   if(!entry||!entry.states.includes(target))return {accepted:false};
   oh[id]=target;return {accepted:true};
  }
 };
 const cockpit={
  B737UnifiedFlightScenarioV1:{getState:()=>state},
  B737WMM2025V1:{evaluate:()=>({valid:true,declinationDeg:4.75})},
  B737IranRadioNavaidsV1:Geo,
  B737ISNCockpitV1:{
   getStartState:()=>({phase:phases}),
   getElectricalState:()=>({source:{
    side1:oh['gen-1']==='ON'?'GEN1':'APU',
    side2:oh['gen-2']==='ON'?'GEN2':'APU'}}),
   engineTrainerAction:({engine,type,instructor})=>{
    assert.equal(instructor,true);assert.equal(type,'PRESET_RUNNING');
    phases[engine]='RUNNING';return {type,engine};}
  },
  B737UnifiedVHFDualV1:{setFrequency:(id,kHz)=>{freq[id]=kHz;return true;}},
  B737UnifiedVHFNavControlsV1:{setMode:(seat,m)=>{mode[seat]=m;return true;}},
  B737AutobrakeUnified:{getState:()=>({selector:autobrake}),setSelector:x=>{autobrake=x;}},
  B737LandingGearUnifiedV1:{getState:()=>({lever:'DN',gear:{nose:'DOWN',left:'DOWN',right:'DOWN'}}),select:()=>true},
  B737SpeedbrakeLever:{mounted:()=>true,set:x=>{selected.speedbrake=x;lights.inputs.speedBrakeArmedIndication=x==='ARMED';}},
  B737CockpitLights:{getState:()=>lights},
  B737FlapVisualTest:{get position(){return flap},select:x=>{flap=x;return true;}},
  B737LEDevicesUnifiedLink:{getState:()=>({actualTe:flap})},
  B737McpAFDSBridgeV1:{refreshElectrical(){},
   applyFinal10Preset:x=>{selected.mcp=x;return {accepted:true};}},
  dispatchEvent:x=>events.push(x),
  setInterval:()=>13,clearInterval(){},addEventListener(){},
  document:{getElementById:id=>id==='overheadFrame'?{contentWindow:{B737OverheadToggles:sw}}:null,
   querySelector:sel=>sel==='#b737-speedbrake-groove'?{}:null}
 };
 cockpit.CustomEvent=class{constructor(type,options){this.type=type;this.detail=options?.detail}};
 vm.runInNewContext(read('panel-mosaic-lab/cockpit/final10-approach-preset-v1.js'),
  {window:cockpit,CustomEvent:cockpit.CustomEvent});
 const response=cockpit.B737Final10ApproachPresetV1.apply(state);
 assert.equal(response.started,true);
 const result=cockpit.B737Final10ApproachPresetV1.getStatus().checks;
 assert.equal(result.ENGINE_1.ok,true);
 assert.equal(result.ENGINE_2.ok,true);
 assert.equal(result.APU_OFF.ok,true);
 assert.equal(result.GEN1_ON_BUS.ok,true);
 assert.equal(result.GEN2_ON_BUS.ok,true);
 assert.equal(result.NAV1_VOR.ok,true);
 assert.equal(result.NAV2_ILS.ok,true);
 assert.equal(result.AUTOBRAKE_2.ok,true);
 assert.equal(result.LANDING_GEAR_DOWN.ok,true);
 assert.equal(result.FLAP_LEVER_30.ok,true);
 assert.equal(result.FLAP_ACTUAL_30.ok,true);
 assert.equal(result.SPEED_BRAKE_ARMED.ok,true);
 assert.equal(result.MCP.ok,true);
 assert.equal(autobrake,'2');assert.equal(flap,30);
 assert.equal(freq['nav-capt-manual'],115300);
 assert.equal(freq['nav-fo-manual'],109900);
 assert.equal(mode.CAPT,'manual');assert.equal(mode.FO,'manual');
 assert.equal(selected.speedbrake,'ARMED');
 assert.equal(selected.mcp.speedKt,142);
 assert.equal(selected.mcp.altitudeFt,state.altitudeFt);
 assert.equal(selected.mcp.courseMag,285);
 assert.equal(selected.mcp.headingMag,285);
 assert.equal(oh['apu-start'],'OFF');
 assert.equal(oh['landing-out-l'],'ON');
 assert.equal(oh['strobe'],'ON');
 assert.equal(oh['position-lights'],'ON');
 assert.ok(events.some(x=>x.type==='b737:final10-preset-status'));
 assert.ok(Object.values(result).every(x=>x.ok),JSON.stringify(result));
});
test('START/PAUSE is integrated with real FLT PHASE state, located in the gap without moving approved overhead geometry',()=>{
 const js=read('panel-mosaic-lab/cockpit/flight-scenario-panel-v1.js');
 const css=read('panel-mosaic-lab/cockpit/flight-scenario-panel-v1.css');
 const html=read('panel-mosaic-lab/cockpit/index.html');
 assert.match(js,/pause=preset==='FINAL_10'/);
 assert.match(js,/win\.B737Final10ApproachPresetV1\?\.apply/);
 assert.match(js,/scene\.append\(toggle\)/);
 assert.match(js,/function togglePause\(/);
 assert.match(css,/top:3491px/);
 assert.match(css,/left:2200px/);
 assert.match(html,/final10-approach-preset-v1\.js\?v=/);
});
test('Final 10 changes only allowed unguarded overhead controls',()=>{
 const app=read('panel-mosaic-lab/interactive-overhead/app.js');
 const policy=read('panel-mosaic-lab/cockpit/final10-approach-preset-v1.js');
 assert.match(app,/SCENARIO_SWITCHES=new Set/);
 assert.match(app,/if\(!SCENARIO_SWITCHES\.has\(id\)\)/);
 assert.match(app,/setScenarioSwitch:scenarioSet/);
 assert.match(policy,/setScenarioSwitch/);
 for(const guarded of ['battery-master','standby-power','bus-transfer',
   'generator-disconnect-1','generator-disconnect-2','pass-oxygen']){
  const section=app.match(/const SCENARIO_SWITCHES=new Set\(\[([\s\S]*?)\]\);/)?.[1]??'';
  assert.equal(section.includes("'"+guarded+"'"),false,guarded);
 }
});
