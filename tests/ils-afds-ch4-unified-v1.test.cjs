'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const MCP=require('../engine/afds/mcp-mode-core-v1.js');
const FMA=require('../engine/afds/fma-mode-engine-v1.js');
const FCC=require('../engine/afds/fcc-flight-guidance-v1.js');
const ILS=require('../engine/afds/classic-ils-afds-ch4-v1.js');
const Geo=require('../engine/flight/iran-radio-navaids-v1.js');
const Flight=require('../engine/flight/flight-scenario-core-v1.js');
const required=['generator1','generator2','transfer1','transfer2','main1','main2','acStandby',
 'groundService','dc1','dc2','battery','hotBattery','switchedHotBattery','dcStandby'];
function powered(){
 const bus=Object.fromEntries(required.map(k=>[k,k==='dc1'||k==='battery'||k==='hotBattery']));
 bus.electronic1=true;
 let s=MCP.initialState();
 s=MCP.transition(s,{type:'ELECTRICAL',snapshot:{schema:'B737_ELECTRICAL_V7_RESULT',revision:1,bus}});
 s=MCP.transition(s,{type:'FD',side:'left',on:true});
 s=MCP.transition(s,{type:'FD',side:'right',on:true});
 s=MCP.transition(s,{type:'AT_ARM',armed:true});
 s.values.courseL=285;s.values.courseR=285;
 return s;
}
function sample(extra={}){
 return {schema:'B737_AFDS_FLIGHT_OBSERVATION_V1',confirmed:true,source:'SIMULATED_FCC',
  navValid:true,navKind:'ILS',navCaptureConfirmed:false,gsCaptureConfirmed:false,
  dualIlsValid:true,radioAltitudeFt:1600,altitudeFt:5500,verticalSpeedFpm:-800,
  bankDeg:0,pitchDeg:-2,headingDeg:289,...extra,
  // The FCC observation wrapper, not raw NAV data, owns this identity.
  source:'SIMULATED_FCC',confirmed:true};
}
function stationSnapshot(nm=5,offset=0){
 const s=Geo.byIdent('ITHL'),to=(s.courseTrueDeg+180)*Math.PI/180;
 const flight={lat:s.lat+nm*Math.cos(to)/60,
  lon:s.lon+nm*Math.sin(to)/(60*Math.cos(s.lat*Math.PI/180)),
  altitudeFt:s.elevationFt+(s.tchFt||50)+Math.tan(s.glideDeg*Math.PI/180)*nm*6076.11549+offset,
  gsKt:145,iasKt:145,tasKt:145};
 const r=Geo.evaluate(flight,s);
 const nav={stationIdent:s.ident,courseTrueDeg:s.courseTrueDeg,courseMagDeg:s.courseMagDeg,
  frontCourse:r.frontCourse,localizerDots:r.localizerDots,glideslopeDots:r.glideslopeDots,
  tunedFrequencyMHz:s.freqKhz/1000,glideDeg:s.glideDeg};
 return {flight,snapshot:{'navigation.ils1':{quality:'VALID',value:nav},
  'navigation.ils2':{quality:'VALID',value:{...nav}}},
  nav};
}
test('ILS evidence uses tuned NAV and rejects coincidental centered diamonds when AFDS OFF',()=>{
 let s=powered();const q=stationSnapshot(),out=MCP.output(s);
 let ev=ILS.evaluate({output:out,flight:q.flight,snapshot:q.snapshot,declinationDeg:4.75});
 assert.equal(ev.valid,true);assert.equal(ev.kind,'ILS');
 assert.equal(ev.stationIdent,'ITHL');assert.equal(ev.navCaptureConfirmed,false);
 assert.equal(ev.gsCaptureConfirmed,false);
 assert.equal(ev.dualIlsValid,true);
 assert.ok(Math.abs(ev.locDeviationDots)<.08);
 assert.ok(Math.abs(ev.gsDeviationDots)<.08);
});
test('APP captures LOC first, G/S second and drives green FCC FMA',()=>{
 let s=powered(),q=stationSnapshot();
 const push=a=>(s=MCP.transition(s,a),MCP.output(s));
 push({type:'FLIGHT_OBSERVATION',sample:sample()});
 push({type:'BUTTON',id:'HDG_SEL'});
 push({type:'BUTTON',id:'ALT_HLD'});
 push({type:'BUTTON',id:'CMD_A'});
 push({type:'BUTTON',id:'APP'});
 assert.equal(s.armed.roll,'VOR/LOC');assert.equal(s.armed.pitch,'G/S');
 let fm=FMA.fromMcp(MCP.output(s),'CAPT');
 assert.equal(fm.roll.armed,'VOR/LOC');assert.equal(fm.pitch.armed,'G/S');
 let ev=ILS.evaluate({output:MCP.output(s),flight:q.flight,snapshot:q.snapshot,declinationDeg:4.75});
 assert.equal(ev.navCaptureConfirmed,true);
 push({type:'FLIGHT_OBSERVATION',sample:sample(ev)});
 assert.equal(s.nav.loc,true);assert.equal(s.nav.gs,false);
 assert.equal(s.capture.roll,'VOR_LOC');
 fm=FMA.fromMcp(MCP.output(s),'CAPT');
 assert.equal(fm.roll.active,'VOR/LOC');assert.equal(fm.pitch.armed,'G/S');
 assert.equal(fm.afds.secondary,'1 CH');
 ev=ILS.evaluate({output:MCP.output(s),flight:q.flight,snapshot:q.snapshot,declinationDeg:4.75});
 assert.equal(ev.gsCaptureConfirmed,true);
 push({type:'FLIGHT_OBSERVATION',sample:sample(ev)});
 assert.equal(s.nav.gs,true);assert.equal(s.capture.pitch,'G/S');
 fm=FMA.fromMcp(MCP.output(s),'CAPT');
 assert.equal(fm.pitch.active,'G/S');assert.equal(fm.at.active,'MCP SPD');
 assert.equal(MCP.output(s).lamps.APP,false);
 const f={...Flight.newScenario({airport:'OIII',preset:'FINAL_5'}),gsKt:145};
 const guidance=FCC.evaluate(FCC.createState(),MCP.output(s),f,{
  courseTrackValid:ev.courseTrackValid,courseDeg:ev.courseDeg,
  glideValid:ev.glideValid,gsVsFpm:ev.gsVsFpm,magneticVariationDeg:4.75});
 assert.ok(guidance.actions.some(a=>a.type==='HEADING'));
 assert.ok(guidance.actions.some(a=>a.type==='VS'&&a.value<0));
 assert.equal(guidance.fdAxes.captain.pitch,true);
 assert.equal(guidance.fdAxes.captain.roll,true);
});
test('matching NAV receivers allow second CMD above 800 RA; FLARE arms below 1500',()=>{
 let s=powered(),q=stationSnapshot();
 const push=a=>(s=MCP.transition(s,a),MCP.output(s));
 push({type:'FLIGHT_OBSERVATION',sample:sample()});
 push({type:'BUTTON',id:'CMD_A'});push({type:'BUTTON',id:'APP'});
 push({type:'BUTTON',id:'CMD_B'});
 assert.equal(s.modes.autopilot,'CMD_A');
 assert.equal(s.dualApproach.second,'CMD_B');
 assert.equal(MCP.output(s).lamps.CMD_B,true);
 let ev=ILS.evaluate({output:MCP.output(s),flight:q.flight,snapshot:q.snapshot,declinationDeg:4.75});
 push({type:'FLIGHT_OBSERVATION',sample:sample(ev)});
 ev=ILS.evaluate({output:MCP.output(s),flight:q.flight,snapshot:q.snapshot,declinationDeg:4.75});
 push({type:'FLIGHT_OBSERVATION',sample:sample(ev)});
 assert.equal(s.dualApproach.flareArmed,false);
 push({type:'FLIGHT_OBSERVATION',sample:sample({...ev,radioAltitudeFt:1400})});
 assert.equal(s.dualApproach.coupled,true);assert.equal(s.dualApproach.flareArmed,true);
 assert.equal(FMA.fromMcp(MCP.output(s),'CAPT').pitch.armed,'FLARE');
 push({type:'FLIGHT_OBSERVATION',sample:sample({...ev,radioAltitudeFt:48})});
 assert.equal(s.capture.pitch,'FLARE');
 assert.equal(FMA.fromMcp(MCP.output(s),'CAPT').pitch.active,'FLARE');
 push({type:'FLIGHT_OBSERVATION',sample:sample({...ev,radioAltitudeFt:25})});
 assert.equal(s.dualApproach.retard,true);
 assert.equal(FMA.fromMcp(MCP.output(s),'CAPT').at.active,'RETARD');
 push({type:'TOGA_ENGAGED',confirmed:true,source:'SIMULATED_FCC',dualApGA:true});
 assert.equal(s.nav.loc,false);assert.equal(s.nav.gs,false);
 assert.equal(s.capture.pitch,null);assert.equal(s.dualApproach.second,'CMD_B');
});
test('Dual CMD cannot be added below 800 RA or with mismatched tuned NAV',()=>{
 let s=powered();const push=a=>s=MCP.transition(s,a);
 push({type:'FLIGHT_OBSERVATION',sample:sample({radioAltitudeFt:900})});
 push({type:'BUTTON',id:'CMD_A'});push({type:'BUTTON',id:'APP'});
 push({type:'FLIGHT_OBSERVATION',sample:sample({radioAltitudeFt:790})});
 push({type:'BUTTON',id:'CMD_B'});
 assert.equal(s.lastRejection,'DUAL_AP_SELECTION_INHIBITED_BELOW_800_RA');
 push({type:'FLIGHT_OBSERVATION',sample:sample({radioAltitudeFt:1000,dualIlsValid:false})});
 push({type:'BUTTON',id:'CMD_B'});
 assert.equal(s.lastRejection,'DUAL_AP_REQUIRES_MATCHING_NAV1_NAV2_ILS');
});
test('FD-only APP captures and shows commands but never moves flight actuators',()=>{
 let s=powered();const push=a=>s=MCP.transition(s,a);
 push({type:'FLIGHT_OBSERVATION',sample:sample()});
 push({type:'BUTTON',id:'APP'});
 push({type:'FLIGHT_OBSERVATION',sample:sample({navCaptureConfirmed:true})});
 push({type:'FLIGHT_OBSERVATION',sample:sample({gsCaptureConfirmed:true,gsDeviationDots:0})});
 assert.equal(s.nav.loc,true);assert.equal(s.nav.gs,true);
 assert.equal(FMA.fromMcp(MCP.output(s),'CAPT').afds.active,'FD');
 const q=stationSnapshot(),ev=ILS.evaluate({output:MCP.output(s),flight:q.flight,snapshot:q.snapshot,declinationDeg:4.75});
 const o=FCC.evaluate(FCC.createState(),MCP.output(s),
  Flight.newScenario({airport:'OIII',preset:'FINAL_5'}),{
   courseTrackValid:ev.courseTrackValid,courseDeg:ev.courseDeg,glideValid:ev.glideValid,gsVsFpm:ev.gsVsFpm});
 assert.equal(o.actions.length,0);
 assert.equal(o.fdAxes.captain.pitch,true);
});
test('Loss of ILS evidence after autoland coupling does not leave false G/S or FLARE',()=>{
 let s=powered();const push=a=>s=MCP.transition(s,a);
 push({type:'FLIGHT_OBSERVATION',sample:sample()});
 push({type:'BUTTON',id:'CMD_A'});push({type:'BUTTON',id:'APP'});push({type:'BUTTON',id:'CMD_B'});
 push({type:'FLIGHT_OBSERVATION',sample:sample({navCaptureConfirmed:true})});
 push({type:'FLIGHT_OBSERVATION',sample:sample({gsCaptureConfirmed:true,gsDeviationDots:0})});
 push({type:'FLIGHT_OBSERVATION',sample:sample({radioAltitudeFt:1400})});
 assert.equal(s.dualApproach.coupled,true);
 push({type:'FLIGHT_OBSERVATION',sample:sample({navValid:false,navKind:'NONE'})});
 assert.equal(s.nav.loc,false);assert.equal(s.nav.gs,false);
 assert.equal(s.modes.autopilot,null);
 assert.equal(s.flightDirectorBarsRetracted,true);
});
test('Actual Unified includes FCC and captured radio module in boot order',()=>{
 const html=fs.readFileSync(path.join(__dirname,'../panel-mosaic-lab/cockpit/index.html'),'utf8');
 assert.ok(html.includes('classic-ils-afds-ch4-v1.js'));
 assert.ok(html.indexOf('classic-ils-afds-ch4-v1.js')<html.indexOf('fcc-flight-runtime-v1.js'));
 const body=fs.readFileSync(path.join(__dirname,'../panel-mosaic-lab/cockpit/fcc-flight-runtime-v1.js'),'utf8');
 assert.match(body,/navCaptureConfirmed:radio\?\.navCaptureConfirmed===true/);
 assert.match(body,/gsCaptureConfirmed:radio\?\.gsCaptureConfirmed===true/);
});
