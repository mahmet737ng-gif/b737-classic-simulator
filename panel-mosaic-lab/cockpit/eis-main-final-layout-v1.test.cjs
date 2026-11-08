'use strict';
/* OWNER FINAL — EIS MAIN GEOMETRY 2026-11-08.
 * This is a read-only regression gate. Never rewrite its expected values to
 * accommodate Conventional registration, and never modify older owner locks.
 * Deliberately compares EIS-only geometry; it does not freeze conventional
 * calibration, future aircraft logic, or switch behavior.
 */
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const here=__dirname;
const read=(n)=>fs.readFileSync(path.join(here,n),'utf8');
const baseline=JSON.parse(read('eis-main-final-layout-v1.json'));
const assembly=JSON.parse(read('assembly.json'));
const main=assembly.regions.find(r=>r.id==='main');
const check=(a,b,label)=>assert.deepStrictEqual(a,b,'EIS FINAL LOCK changed: '+label);
assert.equal(baseline.status,'OWNER_FINAL_EIS_GEOMETRY');
check(Object.fromEntries(['x','y','w','h','nativeWidth','nativeHeight'].map(k=>[k,main[k]])),
 baseline.mainRegion,'MAIN region');
check(main.placements.map(p=>Object.fromEntries(['id','asset','x','y','w','h'].map(k=>[k,p[k]]))),
 baseline.placements,'Captain / MCP / engine / FO-inner / FO-outer source geometry');
check(Object.fromEntries(main.placements.map(p=>[p.id,{
 sha256:assembly.assets[p.asset].sha256,
 dimensions:assembly.assets[p.asset].dimensions
}])),baseline.sourcePixels,'photograph source identities and dimensions');
check(JSON.parse(read('main-panel-socket-calibration-v1.json')).sockets,
 baseline.lampSockets,'all 30 MAIN lamp aperture registrations');
// These registries export pure geometry and do not mount any cockpit DOM.
const flight=require('./flight-needles-model.js');
check(JSON.parse(JSON.stringify(flight.sources)),baseline.flightNeedleSources,
 'Captain/FO airspeed-adjacent ALT/RMI/VSI/CLOCK pivots');
const air=require('./airspeed-pointers-model.js');
check({captain:{source:air.source,pivot:air.pivot},firstOfficer:air.firstOfficer},
 baseline.airspeed,'Captain/FO airspeed pointers');
const engine=require('./isn-engine-gauge-model.js');
check(Object.fromEntries(engine.eisGauges.map(g=>[g.id,[g.cx,g.cy,g.radius]])),
 baseline.engineEisGauges,'all 16 EIS engine gauge pivots/radii');
const dots=read('eis-dot-readouts-v1.js');
for(const [id,[x,y]]of Object.entries(baseline.oilQuantityReadouts)){
 const side=id.endsWith('_1')?1:2;
 assert.match(dots,new RegExp('cx:n===1\\?'+baseline.oilQuantityReadouts.oilQuantity_1[0]+':'+baseline.oilQuantityReadouts.oilQuantity_2[0]+',cy:'+y),
  'EIS readout placement changed: '+id);
}
const mcp=read('mcp-socket-registration-v2.js');
function block(source,name,isArray){
 const token=isArray?'\\[':'\\{',end=isArray?'\\]':'\\}';
 const pattern=new RegExp('const '+name+'=Object\\.freeze\\(\\'+token+'([\\s\\S]*?)\\'+end+'\\);');
 const match=source.match(pattern);
 assert.ok(match,'Missing MCP source block '+name);
 return match[1].trim();
}
check(block(mcp,'buttonRects',true),baseline.mcpRegistrations.buttonRects,'MCP button apertures');
check(block(mcp,'knobRects',false),baseline.mcpRegistrations.knobRects,'MCP course/IAS/heading/ALT knob apertures');
const eadi=read('eadi-stage1-unified-v1.js');
for(const seat of ['CAPT','FO']){
 const m=eadi.match(new RegExp(seat+":\\{name:'[^']+',x:([\\d.]+),y:([\\d.]+),w:([\\d.]+),h:([\\d.]+),pitch:"));
 assert.ok(m,'Missing '+seat+' EADI');
 check({x:+m[1],y:+m[2],w:+m[3],h:+m[4]},baseline.eadi.stations[seat],seat+' EADI glass');
 const transform=seat==='CAPT'
  ?eadi.match(/if\(seat==='CAPT'\)\{c.translate\(([^)]+)\);c.scale\(([^)]+)\);\}/)
  :eadi.match(/else\{c.translate\(([^)]+)\);c.scale\(([^)]+)\);\}/);
 assert.ok(transform,'Missing '+seat+' EADI render registration');
 check({translate:transform[1].split(',').map(Number),scale:transform[2].split(',').map(Number)},
  baseline.eadi.attitudeTransforms[seat],seat+' EADI horizon render transform');
}
assert.ok(eadi.includes('const WIDTH=900,HEIGHT=720;'),'EADI canvas resolution changed');
const fo=require('./fo-proportional-scale-v1.js');
check(fo.PROFILES.EIS,baseline.foEis.profile,'EIS first-officer transform anchor and scale');
assert.ok(Math.abs(fo.EIS_OUTER_LIFT-baseline.foEis.outerLift)<1e-10,
 'EIS final FO outer photo lift changed');
check(fo.GPWS_IDS,baseline.foEis.guardIds,'FO three guarded switch identities');
assert.equal(fo.mapRect(1222,127,0,0).x,baseline.acceptance.seamX,
 'EIS engine-to-FO seam lost');
const a=fo.mapRect(1594,225,475,592.1638468388246);
assert.ok(a.x+a.w<=baseline.acceptance.outerMaxX,'EIS FO photo overflows the stage');
const f=baseline.eadi.stations.FO,c=baseline.eadi.stations.CAPT;
const mapped=fo.mapRect(f.x,f.y,f.w,f.h);
const realFoTop=mapped.y+fo.EIS_OUTER_LIFT;
assert.ok(Math.abs(realFoTop-c.y)<1e-8,'EIS two EADI top edges differ');
const t=baseline.eadi.attitudeTransforms;
const ref=baseline.eadi.translationReferenceY;
const center=baseline.eadi.zeroPitchAnchorY;
const capY=c.y+c.h*(t.CAPT.translate[1]+(center-ref)*t.CAPT.scale[1])/baseline.eadi.canvas[1];
const foY=realFoTop+mapped.h*(t.FO.translate[1]+(center-ref)*t.FO.scale[1])/baseline.eadi.canvas[1];
assert.ok(Math.abs(capY-foY)<baseline.acceptance.horizonErrorToleranceNative,
 'EIS EADI zero-pitch horizons have become misaligned');
console.log('PASS: OWNER FINAL EIS main geometry; 5 photo panels, 30 lamps, MCP, 16 engine gauges, flight needles, 2 EADI horizons. Conventional can be calibrated independently.');
