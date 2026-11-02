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
 assert.equal((xml.match(/<rect(?:\s|>)/g)||[]).length,0,'Emission overlay must have zero bezels');
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
console.log('PASS OH14 ONE source record, 2 transparent letter states, no second fitted lens, untouched 112 original sockets');
