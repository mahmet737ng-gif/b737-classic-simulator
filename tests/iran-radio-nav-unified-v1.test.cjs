const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const geo=require('../engine/flight/iran-radio-navaids-v1.js');
const cockpit=path.join(__dirname,'../panel-mosaic-lab/cockpit');
test('all eleven real facilities and the MHD airport-code alias',()=>{
 assert.equal(geo.STATIONS.length,11);
 assert.equal(geo.byIdent('MHD').ident,'MSD');
 for(const id of ['TRN','IKA','MSD','SYZ','IFN','DHN','IMSD','ITRN','IIKA','ISYZ','ITHL'])assert.ok(geo.byIdent(id));
 assert.equal(geo.byIdent('IMSD').freqKhz,109900);
 assert.equal(geo.byIdent('ITHL').freqKhz,109900);
 assert.equal(geo.byIdent('ITHL').airport,'OIII');
 assert.equal(geo.byIdent('ITHL').runway,'29L');
});
test('co-channel 109.90 MHz selects ITHL, IMSD and ISYZ by aircraft location',()=>{
 assert.equal(geo.match(109900,'ILS',{lat:35.69,lon:51.31,altitudeFt:4800}).ident,'ITHL');
 assert.equal(geo.match(109900,'ILS',{lat:36.2,lon:59.7,altitudeFt:4000}).ident,'IMSD');
 assert.equal(geo.match(109900,'ILS',{lat:29.5,lon:52.5,altitudeFt:6000}).ident,'ISYZ');
 assert.equal(geo.match(109900,'ILS'),null);
});
test('DME is geometric slant range, not merely horizontal distance',()=>{
 const s=geo.byIdent('TRN'),a={lat:s.lat,lon:s.lon,altitudeFt:s.elevationFt};
 assert.equal(geo.dmeSlantNm(a,s),0);
 assert.ok(Math.abs(geo.dmeSlantNm({...a,altitudeFt:s.elevationFt+6076.11549},s)-1)<.00001);
});
test('VOR course selection changes TO/FROM and CDI',()=>{
 const s=geo.byIdent('DHN'),a={lat:s.lat+.1,lon:s.lon,altitudeFt:s.elevationFt+2000};
 assert.equal(geo.evaluate(a,s,{variationDeg:0,courseMagDeg:180}).toFrom,'TO');
 assert.equal(geo.evaluate(a,s,{variationDeg:0,courseMagDeg:0}).toFrom,'FROM');
});
test('ILS front lobe and glideslope respond to position/altitude',()=>{
 const s=geo.byIdent('IIKA'),direction=(s.courseTrueDeg+180)%360;
 const a={lat:s.lat+5*Math.cos(direction*Math.PI/180)/60,
  lon:s.lon+5*Math.sin(direction*Math.PI/180)/(60*Math.cos(s.lat*Math.PI/180)),
  altitudeFt:s.elevationFt+50+Math.tan(3*Math.PI/180)*5*6076.11549};
 const on=geo.evaluate(a,s);
 assert.equal(on.frontCourse,true);assert.ok(Math.abs(on.localizerDots)<.1);
 assert.ok(Math.abs(on.glideslopeDots)<.1);
 assert.ok(geo.evaluate({...a,altitudeFt:a.altitudeFt+500},s).glideslopeDots>0);
 assert.equal(geo.evaluate({...a,lat:s.lat-.1,lon:s.lon},s).frontCourse,false);
});
test('NAV tuning publishes same source to VOR, DME and ILS consumers without mixing seats',()=>{
 const script=fs.readFileSync(path.join(cockpit,'iran-radio-nav-unified-v1.js'),'utf8');
 const packets={},freq={CAPT:115300,FO:117800},owners=new Set(),events={};
 const root={document:{readyState:'loading',addEventListener:(name,fn)=>events['document:'+name]=fn},
  addEventListener:(name,fn)=>events[name]=fn,setTimeout:fn=>fn(),setInterval:()=>{},
  B737IranRadioNavaidsV1:geo,
  B737UnifiedFlightScenarioV1:{getDiagnostics:()=>({active:true}),getState:()=>({lat:35.75,lon:51.3,altitudeFt:7000})},
  B737UnifiedVHFNavControlsV1:{getState:seat=>({activeFrequencyKhz:freq[seat]})},
  B737WMM2025V1:{evaluate:()=>({valid:true,declinationDeg:5})},
  B737UnifiedAvionicsNetworkV1:{
   connectExternal:owner=>{assert.ok(!owners.has(owner));owners.add(owner);
    return {publish:(topic,value,metadata)=>packets[topic]={value,metadata}}},
   getSnapshot:()=>({'mcp.state':{quality:'VALID',value:{powered:true,course2Powered:true,courseL:100,courseR:120}}})}};
 vm.runInNewContext(script,{window:root});
 events['document:DOMContentLoaded']();
 assert.equal(packets['navigation.vor1'].value.stationIdent,'TRN');
 assert.equal(packets['navigation.dme1'].value.stationIdent,'TRN');
 assert.equal(packets['navigation.vor2'].value,null);
 assert.equal(owners.size,3);
 freq.FO=114300;root.B737UnifiedIranRadioNavV1.refresh();
 assert.equal(packets['navigation.vor2'].value.stationIdent,'IKA');
 freq.CAPT=109900;root.B737UnifiedFlightScenarioV1.getState=()=>({lat:36.2,lon:59.7,altitudeFt:5200});
 root.B737UnifiedIranRadioNavV1.refresh();
 assert.equal(packets['navigation.ils1'].value.stationIdent,'IMSD');
 root.B737UnifiedFlightScenarioV1.getState=()=>({lat:35.655,lon:51.430,altitudeFt:5600});
 root.B737UnifiedIranRadioNavV1.refresh();
 assert.equal(packets['navigation.ils1'].value.stationIdent,'ITHL');
 assert.equal(packets['navigation.dme1'].value.stationIdent,'ITHL');
 root.B737UnifiedFlightScenarioV1.getState=()=>({lat:36.2,lon:59.7,altitudeFt:5200});
 root.B737UnifiedIranRadioNavV1.refresh();
 assert.equal(packets['navigation.vor1'].value,null);
 assert.ok(packets['navigation.dme1'].value.distanceNm>0);
});
test('Unified HTML loads radio modules after live NAV controls without changing photo gauges',()=>{
 const html=fs.readFileSync(path.join(cockpit,'index.html'),'utf8');
 assert.ok(html.includes('iran-radio-navaids-v1.js'));
 assert.ok(html.includes('iran-radio-nav-unified-v1.js'));
 assert.ok(html.indexOf('pedestal-vhf-nav-controls-v1.js')<html.indexOf('iran-radio-nav-unified-v1.js'));
 assert.ok(html.indexOf('iran-radio-navaids-v1.js')<html.indexOf('iran-radio-nav-unified-v1.js'));
});
