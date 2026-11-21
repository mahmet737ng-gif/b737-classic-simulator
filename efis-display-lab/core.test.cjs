'use strict';
const assert=require('node:assert/strict');
const core=require('./core.js');
const ehsi=require('../cdu-standalone-v6/ehsi/ehsi-engine.js');
const fs=require('node:fs');
const result=core.selfTest();
for(const c of result.checks)assert.equal(c.pass,true,c.id);
assert.equal(result.pass,true);
assert.equal(core.MODES.length,7);
assert.deepEqual(core.RANGES,[10,20,40,80,160,320]);
assert.equal(core.items.length,25);
assert.equal(new Set(core.items.map(x=>x.display+'.'+x.id)).size,core.items.length);
for(const item of core.items){assert.ok(item.folio);assert.equal(item.box.length,4);assert.ok(item.box.every(Number.isFinite))}
let s=core.initial();
let m=core.ehsiModel(s);
assert.equal(ehsi.computeDisplay(m).orientation,'TRACK_UP');
assert.equal(ehsi.computeDisplay(m).wptEligible,true);
s=core.apply(s,{type:'set',path:'ehsi.range',value:80});m=core.ehsiModel(s);
assert.equal(ehsi.computeDisplay(m).wptEligible,false,'waypoint option gated above 40nm');
s=core.apply(s,{type:'set',path:'ehsi.mode',value:'EXP_VOR_ILS'});
assert.equal(ehsi.computeDisplay(core.ehsiModel(s)).orientation,'HEADING_UP');
s=core.apply(s,{type:'set',path:'ehsi.mode',value:'PLAN'});
assert.equal(ehsi.computeDisplay(core.ehsiModel(s)).orientation,'TRUE_NORTH');
s=core.apply(s,{type:'set',path:'power.nav',value:false});
assert.equal(core.ehsiModel(s).route.points.length,0,'no synthetic route on invalid NAV');
s=core.apply(s,{type:'set',path:'power.ehsi',value:false});
assert.equal(s.power.ehsi,false);

s=core.initial();
s.seat='FO';
s=core.apply(s,{type:'set',path:'power.sg2',value:false});
assert.equal(core.activeSg(s),false,'FO normally uses SG2');
s=core.apply(s,{type:'set',path:'power.source',value:'SG1'});
assert.equal(core.activeSg(s),true,'EFI SG transfer');
s=core.apply(s,{type:'option',name:'wxr',value:true});
s=core.apply(s,{type:'option',name:'terr',value:true});
assert.equal(s.ehsi.options.wxr,false);
assert.equal(s.ehsi.options.terr,true);
assert.equal(core.initial().eadi.dh,200,'DH REF physical startup 200 ft');
assert.equal(core.initial().eadi.brightness,1);
assert.equal(core.initial().ehsi.wxBrightness,1);
let cp=core.initial();
cp=core.apply(cp,{type:'set',path:'eadi.dh',value:-30});
assert.equal(cp.eadi.dh,-20,'DH minimum clamp');
cp=core.apply(cp,{type:'set',path:'eadi.dh',value:1100});
assert.equal(cp.eadi.dh,999,'DH maximum clamp');
cp=core.apply(cp,{type:'set',path:'ehsi.brightness',value:.4});
cp=core.apply(cp,{type:'set',path:'ehsi.wxBrightness',value:.8});
cp=core.apply(cp,{type:'set',path:'eadi.brightness',value:.5});
assert.equal(cp.ehsi.brightness,.4,'outer EHSI dimmer independent');
assert.equal(cp.ehsi.wxBrightness,.8,'inner WXR/MAP dimmer independent');
assert.equal(cp.eadi.brightness,.5,'EADI dimmer independent');
cp=core.apply(cp,{type:'option',name:'tfc',value:true});
assert.equal(core.ehsiModel(cp).options.tfc,true,'TFC reaches EHSI model');
cp=core.apply(cp,{type:'option',name:'wxr',value:true});
assert.equal(core.ehsiModel(cp).options.wxr,true,'WXR reaches EHSI model without artificial returns');
for(const name of ['efis-cp.js','efis-cp.css'])assert.equal(fs.existsSync(__dirname+'/'+name),true,'control panel asset: '+name);
assert.equal(fs.existsSync(__dirname+'/index.html'),true);
assert.equal(fs.existsSync(__dirname+'/eadi.js'),true);
assert.equal(fs.existsSync(__dirname+'/lab.js'),true);
const {liveModel:renderModel}=require('../panel-mosaic-lab/cockpit/ehsi-unified-v1.js');
const {resolve,route}=require('../panel-mosaic-lab/cockpit/unified-efis-sources-v1.js');
function liveModel(snap,state,aspect,acBus){
 const source=resolve(snap,state.seat,{}, {1:acBus?.powered??true,2:false});
 return renderModel(source,state,state,aspect,route(source.fmc,state.ehsi.mode,1));
}
const data=value=>({quality:'VALID',value});
const bus={
 'electrical.buses':data({bus:{electronic1:true,electronic2:false}}),
 'irs.left':data({powered:true,positionValid:true,headingDeg:340,trackDeg:345,gsKt:212}),
 'irs.right':data({powered:true,positionValid:false,headingDeg:null,trackDeg:null}),
 'mcp.state':data({powered:true,headingDeg:90,courseL:213,courseR:151}),
 'airdata.adc1':data({tasKt:232}),
 'airdata.adc2':{quality:'STALE',value:{tasKt:160}},
 'navigation.vor1':data({stationIdent:'SYZ',tunedFrequencyMHz:113.4}),
 'navigation.dme1':data({stationIdent:'ABC',distanceNm:32})
};
let live=liveModel(bus,core.initial(),.8);
assert.equal(live.efis.displayPower,true);
assert.equal(liveModel(bus,core.initial(),.8,{powered:false}).efis.displayPower,false,'Onside 115 VAC feed takes priority');
assert.deepEqual([live.heading,live.track,live.groundSpeed,live.trueAirspeed],[null,null,212,232], 'Unknown magnetic variation must blank HSI heading/track');
assert.equal(live.selectedHeading,null,'No mixed TRUE and magnetic references');
assert.deepEqual(live.route.points,[],'Live renderer must not fabricate demo geometry');
assert.deepEqual(live.mapObjects,[]);
const fo=core.apply(core.initial(),{type:'seat',value:'FO'});
live=liveModel(bus,fo,.78);
assert.equal(live.efis.displayPower,false);
assert.equal(live.efis.headingValid,false);
assert.equal(live.trueAirspeed,null);
const radio=core.apply(core.initial(),{type:'set',path:'ehsi.mode',value:'FULL_VOR_ILS'});
live=liveModel(bus,radio,.8);
assert.equal(live.nav.valid,true);
assert.equal(live.nav.dme,null,'An unrelated DME must not be attributed to the tuned VOR');
assert.equal(live.nav.cdi,null,'No synthetic centered CDI for partial VOR data');
const fmcModel=require('../engine/integration/avionics-fmc-computer-v1.js');
const fmcNetwork=require('../engine/ch11/fmc-systems-network-v1.js');
const committed=fmcNetwork.validateDisplayRoute({source:'PMDG_WORLD_2610_WITH_PROCEDURES_R1',points:[
 {name:'OIII',lat:35.7,lon:51.3},{name:'SADAF',lat:35.6,lon:51.4,leg:'DISCONTINUITY'},
 {name:'OIMM',lat:36.2,lon:59.6}]},'OIII','OIMM');
assert.equal(committed.points[1].leg,'DISCONTINUITY');
assert.equal(fmcNetwork.validateDisplayRoute(committed,'OIII','OIKB'),null);
const signals={...bus,
 'irs.left':data({...bus['irs.left'].value,lat:35.7,lon:51.3,attitudeValid:true,pitchDeg:3,rollDeg:4,magneticVariationDeg:5}),
 'irs.right':data({powered:true,positionValid:true,lat:35.7,lon:51.3,headingDeg:150,trackDeg:155,magneticVariationDeg:0,gsKt:205,attitudeValid:true,pitchDeg:8,rollDeg:-7}),
 'crew.flightplan':data({origin:'OIII',dest:'OIMM',active:true,displayRoute:committed}),
 'electrical.fmcFeeds':data({modeledSupply:true})};
const compute=()=>fmcModel.project({read:topic=>signals[topic]||{quality:'UNKNOWN'}});
signals['fmc.computed']=data(compute());
const powered={1:true,2:true};
assert.equal(signals['fmc.computed'].value.route.displayRoute,committed);
assert.equal(signals['fmc.computed'].value.guidance.routeEvidenceReady,false);
let captain=resolve(signals,'CAPT',{},powered),officer=resolve(signals,'FO',{},powered);
assert.deepEqual([captain.sg,captain.irs,captain.heading,captain.track,captain.trackSource],[1,1,335,340,'FMC']);
assert.deepEqual([officer.sg,officer.irs,officer.heading,officer.track],[2,2,150,345]);
officer=resolve(signals,'FO',{'irs-transfer':'BOTH ON L'},powered);
assert.deepEqual([officer.sg,officer.irs,officer.pitch],[2,1,3]);
captain=resolve(signals,'CAPT',{'efi-transfer':'BOTH ON 2'},powered,{1:true});
assert.deepEqual([captain.sg,captain.irs,captain.pitch,captain.video],[2,2,8,true]);
assert.equal(resolve(signals,'CAPT',{},powered,{1:true}).video,false);
assert.deepEqual(route(captain.fmc,'PLAN',1).points[1],{...committed.points[1],x:0,y:0});
assert.deepEqual(route(captain.fmc,'MAP',1).points[0],{...committed.points[0],x:0,y:0});
signals['electrical.fmcFeeds']=data({modeledSupply:true,failed:true});
signals['fmc.computed']=data(compute());
officer=resolve(signals,'FO',{},powered);
assert.deepEqual([officer.track,officer.trackSource,officer.groundSpeed],[155,'IRS R',205]);
assert.deepEqual(route(officer.fmc,'MAP',1).points,[]);
console.log('EFIS display lab: '+result.checks.length+' FCOM-style logic checks passed; '+core.items.length+' components registered. VISUAL pixel QA remains pending.');
