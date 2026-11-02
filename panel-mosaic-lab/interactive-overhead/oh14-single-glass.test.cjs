'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const here=__dirname,read=f=>fs.readFileSync(path.join(here,f),'utf8');
const lights=JSON.parse(read('lights.json'));
const matches=lights.lights.filter(x=>x.id==='emergency-not-armed');
assert.equal(matches.length,1,'NOT ARMED must have exactly one physical registration');
assert.equal(matches[0].placementId,'OH14');
assert.deepEqual(matches[0].sourceRect,[138,507,183,317]);
assert.equal(lights.lights.length,112,'No original annunciator may be removed');
for(const state of ['on','off']){
 const xml=read('oh14-not-armed-emission-'+state+'.svg');
 assert.match(xml,/viewBox="0 0 270 600"/);
 assert.match(xml,/<svg/);
 assert.equal((xml.match(/<rect(?:\s|>)/g)||[]).length,2,'Exactly the dark interior glass and its subtle reflection; no second bezel');
 assert.match(xml,/x="27" y="29" width="216" height="542"/,'OH14 dark glass must fill the photograph cavity');
 assert.doesNotMatch(xml,/<rect[^>]*(?:stroke|x="0"|width="270")/,'No double metallic frame');
 assert.equal((xml.match(/<image(?:\s|>)/g)||[]).length,0,'Emission overlay must not contain photo replacement');
 assert.equal((xml.match(/<text /g)||[]).length,state==='on'?16:8,'Expected only the eight readable glyphs');
 assert.match(xml,/role="img"/);
}
const live=read('lights.js'),fitting=read('../lamp-socket-fit-v3/live-fit.js'),css=read('lights.css');
assert.match(live,/PHOTO_GLASS_EMISSION_ONLY/);
assert.match(live,/oh14-not-armed-emission-/);
assert.match(fitting,/photoGlassOnly=new Set\(\['emergency-not-armed'\]\)/);
assert.match(fitting,/if\(photoGlassOnly.has\(row.id\)\)return;/);
assert.match(css,/\.mounted-light\[data-light="emergency-not-armed"\] > \.lamp-socket-fit-face/);
assert.match(css,/display:none!important/);
const toggles=JSON.parse(read('registry.json')),app=read('app.js'),overlay=read('overlay.css');
const actuator=toggles.controls.filter(c=>c.id==='emergency-exit-lights');
assert.equal(actuator.length,1,'Exactly one original main OH14 control');
assert.equal(actuator[0].visualFamily,'Small Silver','Use approved owner-selected atlas, not a CSS knob');
assert.deepEqual(actuator[0].states,['OFF','ARMED','ON']);
assert.deepEqual(matches[0].controls,['emergency-exit-lights']);
assert.match(app,/const photoOnly=c\.id==='emergency-exit-lights'/,'Existing photographed switch alone is interactive');
assert.match(app,/holder.className='oh14-top-hinge-guard'/,'Owner requested a single top-hinged black guard');
assert.match(app,/button.append\(sprite\)/,'The owner-requested Small Silver toggle must be drawn');
assert.match(app,/Black_Guarded_CLOSED\.png/,'Guard uses an immutable black photographic asset');
assert.doesNotMatch(app,/append\(occlusion\)|oh14-original-toggle-occlusion/,'Original photo stays visible and untouched');
assert.match(overlay,/\.mounted-toggle\[data-control="emergency-exit-lights"\]/,'Transparent native photo hitbox is maintained');
assert.doesNotMatch(overlay,/background:linear-gradient\(90deg,#0d0c0b/,'No artificial OH14 paint-over mask');
assert.doesNotMatch(live,/oh14EmergencyExitPhysical|oh14-small-silver-toggle/,'Never mount a second mini-switch over the photographed one');
assert.doesNotMatch(live,/oh14-photo-lever-sprite/,'No oversized photographic nut overlays allowed');
assert.doesNotMatch(css,/img\.light-face\[data-frame="OFF"\]\{\s*opacity:0!important/,'Do not hide the installed dark glass');
const assembly=JSON.parse(read('../cockpit/assembly.json'));
const overhead=assembly.regions.find(r=>r.id==='overhead');
assert.match(overhead.embeddedUrl,/&oh14=OH14-OPERABLE-FIXED-0017&ts=OH14-OPERABLE-FIXED-0017/,'Overhead iframe URL must bypass stale cached HTML');
const embedded=read('../cockpit/overhead-stage.html');
assert.match(embedded,/app\.js\?v=OH14-OPERABLE-FIXED-0017/,'Embedded new guarded OH14 UI must use the new JS revision');
assert.match(embedded,/lights\.js\?v=OH14-PHOTO-LIVE-0010/,'Embedded lights must use the revised frame without the legacy selector');
assert.match(overlay,/\.oh14-top-hinge-guard/,'OH14 top-hinge guard CSS must be mounted');
assert.match(overlay,/\.oh14-guard-state-photo/,'Photo guard must be visible as a hinged cover');
assert.match(overlay,/OH14-OPERABLE-FIXED-0017/,'OH14 fixed-size photographic housing marker');
assert.doesNotMatch(overlay,/\.oh14-guard-state-photo\s*\{[^}]*clip-path:/,'Do not use a state-dependent image silhouette');
assert.match(embedded,/overlay\.css\?v=OH14-OPERABLE-FIXED-0017/,'Embedded overhead must bust old CSS cache');
assert.match(overlay,/#oh14EmergencyExitPhysical/,'Obsolete duplicate selector stays suppressed');
assert.match(app,/dataset\.photoOwner/,'Production switch should expose a versioned ownership marker');


assert.match(app,/OH14_FIXED_SOURCE_RECT=Object\.freeze\(\[452,163,748,876\]\)/,
 'OH14 native bounding coordinates match the 132x405 red rectangle');
assert.match(app,/holder\.dataset\.fixedGeometry='OH14-OPERABLE-FIXED-0017'/,
 'Closed and all three open states share the same fixed mount');
assert.match(app,/if\(photo\.src!==url\)photo\.src=url/,
 'Only the photo source may change on the four detents');
assert.match(overlay,/overflow:hidden;/,'OH14 photo cannot exceed fixed box');
assert.match(overlay,/width:100%;height:100%/,
 'All four guarded states have the same visible metal housing dimensions');
assert.match(app,/bind\(c,leverHit\)/,'OH14 lever must accept click/drag/wheel/keyboard independently');
assert.match(app,/button\._oh14SilverVisual=silver/,'Small Silver atlas is visibly mounted');
assert.match(app,/leverHit\.disabled=!open/,'Closed guard prevents lever input');
console.log('PASS OH14 one Small Silver actuator, one independent black top-hinged guard; NOT ARMED and other 111 lamps preserved');

for(const name of ['Black_Guarded_Open_CENTER.png','Black_Guarded_CLOSED.png']){
 assert.ok(app.includes(name),'Approved housing is in runtime');
 assert.ok(fs.existsSync(path.join(here,'../assets/locked/2026-10-23/Switches/guard/runtime',name)));
}
assert.match(app,/const guardRoot=/);
assert.doesNotMatch(app,/guardFiles\[engine\.get\(c\.id\)\]/,
 'Changing detents must not resize the housing photo');
assert.doesNotMatch(overlay,/transform:rotate\(180deg\)/,'Owner asset already has top hinge');
