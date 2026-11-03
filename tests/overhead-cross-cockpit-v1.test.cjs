'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const cockpit=path.join(__dirname,'../panel-mosaic-lab/cockpit');
const bridge=require(path.join(cockpit,'overhead-cross-cockpit-v1.js'));
const catalog=JSON.parse(fs.readFileSync(path.join(cockpit,'cross-cockpit-indicators-v1.json'),'utf8'));
const source=fs.readFileSync(path.join(cockpit,'overhead-test-labs-v1.js'),'utf8');
const assembly=JSON.parse(fs.readFileSync(path.join(cockpit,'assembly.json'),'utf8'));
const inventory=JSON.parse(fs.readFileSync(path.join(__dirname,'../engine/instruments/gauge-inventory-v1.json'),'utf8'));
const contract=JSON.parse(fs.readFileSync(path.join(__dirname,'../engine/instruments/stage8-signal-contracts-v1.json'),'utf8'));
const knownFaces=new Set(inventory.faceGroups.flatMap(g=>g.ids));
const hyd=catalog.panels.OH17.displays;
test('Hydraulic system lab collects overhead lamps, FO main panel, glareshield HYD and engine A/B gauges',()=>{
 assert.equal(catalog.schema,'B737_CROSS_COCKPIT_INDICATORS_V1');
 const ids=new Set(hyd.map(x=>x.id));
 for(const id of ['FO.HYD','eng.hyd_pressure.a','eng.hyd_pressure.b','fo.hyd_brake_pressure','hydraulic-overhead']){
  assert.ok(ids.has(id),'Missing hydraulic indicator '+id);
 }
 assert.equal(hyd.find(x=>x.id==='hydraulic-overhead').lamps.length,6);
 const engine=hyd.filter(x=>x.panel==='ENGINE');
 assert.equal(engine.length,2);
 assert.ok(engine.every(x=>x.zone==='MAIN'));
});
test('Catalog is mapped for all overhead systems, with original photo sources and certified signal IDs only',()=>{
 const panelCatalog=JSON.parse(fs.readFileSync(path.join(cockpit,'overhead-test-labs-catalog-v1.json'),'utf8'));
 assert.equal(Object.keys(catalog.panels).length,panelCatalog.panels.length);
 for(const p of panelCatalog.panels){
  const d=catalog.panels[p.id];
  assert.ok(d,'missing cross-cockpit map '+p.id);
  for(const x of d.displays){
   if(x.kind!=='gauge')continue;
   assert.ok(knownFaces.has(x.id),'unrecognized dial '+x.id);
   if(!x.photo)continue; // Overhead gauge is already shown in original OH tile.
   const stored=Object.values(assembly.assets).find(a=>a.url===x.photo.url);
   assert.ok(stored,'original photo URL not in Unified assembly '+x.id);
   assert.equal(stored.dimensions[0],x.photo.width);
   assert.equal(stored.dimensions[1],x.photo.height);
   if(x.source?.provider==='ecu')
    assert.equal(contract.faces[x.id].channels[0].source.path,x.source.path);
   assert.notEqual(x.geometry.verified,true,'unapproved pivot was incorrectly certified');
  }
 }
});
test('Six-pack status comes from LIVE existing annunciator state rather than scripted values',()=>{
 const d=hyd.find(x=>x.id==='FO.HYD');
 const trueState=bridge.readIndicator(d,{sixpack:{getEffectiveState:()=>({'FO.HYD':true})}});
 assert.equal(trueState.text,'ILLUMINATED');
 assert.equal(trueState.status,'LIVE_MAIN_READ_ONLY');
 assert.equal(bridge.readIndicator(d,{sixpack:{getEffectiveState:()=>({'FO.HYD':false})}}).text,'OFF');
 assert.equal(bridge.readIndicator(d,{}).status,'UNAVAILABLE');
});
test('Hydraulic A/B numeric readouts respect Stage8 TRAINING_SIMULATION_ONLY and never fabricate brake pressure',()=>{
 const a=hyd.find(x=>x.id==='eng.hyd_pressure.a'),b=hyd.find(x=>x.id==='eng.hyd_pressure.b');
 const state={ecu:{getECUState:()=>({quality:'TRAINING_SIMULATION_ONLY',hydraulics:{
  systemA:{pressurePsi:2960},systemB:{pressurePsi:3050}}})}};
 assert.equal(bridge.readIndicator(a,state).text,'2960 psi');
 assert.equal(bridge.readIndicator(b,state).text,'3050 psi');
 const missing={ecu:{getECUState:()=>({quality:'UNKNOWN',hydraulics:{systemA:{pressurePsi:3000}}})}};
 assert.equal(bridge.readIndicator(a,missing).status,'UNAVAILABLE_SOURCE');
 assert.equal(bridge.readIndicator(a,{}).text,'—');
 const brake=hyd.find(x=>x.id==='fo.hyd_brake_pressure');
 assert.equal(bridge.readIndicator(brake,state).status,'NO_VERIFIED_SIGNAL');
});
test('All overhead annunciators are read from the original embedded OH signal source',()=>{
 const d=hyd.find(x=>x.id==='hydraulic-overhead');
 const frames=Object.fromEntries(d.lamps.map(id=>[id,'OFF']));
 frames['hyd-elec-1-overheat']='ON';
 const result=bridge.readIndicator(d,{overhead:{B737OverheadLights:{getState:()=>({frames})}}});
 assert.equal(result.lamps.length,6);
 assert.equal(result.text,'1 / 6 annunciations active');
 assert.equal(result.status,'LIVE_ISOLATED_OVERHEAD');
});
test('Cross-cockpit views are mounted in the live overhead test dialog with no underlying artwork changes',()=>{
 const index=fs.readFileSync(path.join(cockpit,'index.html'),'utf8');
 assert.ok(index.includes('overhead-cross-cockpit-v1.js'));
 assert.ok(index.indexOf('overhead-cross-cockpit-v1.js')<index.indexOf('overhead-test-labs-v1.js'));
 assert.ok(source.includes('id="ohLabCrossHost"'));
 assert.ok(source.includes("B737CrossCockpitIndicatorsV1?.show(id,$('ohLabCrossHost'))"));
 assert.ok(source.includes('pointer-events:auto'));
 assert.ok(source.includes('B737CrossCockpitIndicatorsV1?.hide()'));
 assert.ok(source.includes("B737CrossCockpitIndicatorsV1?.show('OH15',antiHost)"));
});
