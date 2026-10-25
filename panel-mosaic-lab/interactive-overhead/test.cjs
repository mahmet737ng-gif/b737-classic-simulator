'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const model=require('./model.js'),registry=JSON.parse(fs.readFileSync(path.join(__dirname,'registry.json'),'utf8'));
const layout=JSON.parse(fs.readFileSync(path.join(__dirname,'../all-overhead/atlas-layout.json'),'utf8'));
assert.equal(model.validate(registry,layout),true);
assert.equal(registry.controls.length,58);
assert.deepEqual(Object.fromEntries(['toggle-2','toggle-3-vertical','toggle-3-horizontal'].map(t=>[t,registry.controls.filter(c=>c.type===t).length])),{'toggle-2':41,'toggle-3-vertical':14,'toggle-3-horizontal':3});
assert.equal(registry.controls.some(c=>c.placementId==='UPPER'),false,'guide covers lower overhead only');
const events=[],engine=model.controller(registry,{},e=>events.push(e));
engine.cycle('yaw-damper');assert.equal(engine.get('yaw-damper'),'OFF');engine.cycle('yaw-damper');assert.equal(engine.get('yaw-damper'),'ON');
engine.step('vhf-nav',-1);assert.equal(engine.get('vhf-nav'),'BOTH ON 1');engine.step('vhf-nav',-1);assert.equal(engine.get('vhf-nav'),'BOTH ON 1','left stop clamps');
engine.step('vhf-nav',1);assert.equal(engine.get('vhf-nav'),'NORMAL');engine.step('vhf-nav',1);assert.equal(engine.get('vhf-nav'),'BOTH ON 2');
const before=events.length;assert.equal(engine.set('vhf-nav','UP'),false);assert.equal(events.length,before,'invalid vertical detent cannot enter horizontal selector');
for(const id of ['alternate-flaps-position','window-power-test','gen-1','outflow-manual']){
 const c=registry.controls.find(c=>c.id===id);for(const state of Object.keys(c.springReturn)){engine.set(id,state,'hold');assert.equal(engine.get(id),state);engine.release(id);assert.equal(engine.get(id),c.springReturn[state]);}
}
engine.set('apu-start','START');engine.releaseAll();assert.equal(engine.get('apu-start'),'ON','APU START returns to ON, not OFF');
engine.set('pack-l','HIGH');engine.releaseAll();assert.equal(engine.get('pack-l'),'HIGH','latched three-position switch stays selected');
const resumed=model.controller(registry,{...engine.snapshot(),'alternate-flaps-position':'UP','yaw-damper':'invalid'});
assert.equal(resumed.get('vhf-nav'),'BOTH ON 2');assert.equal(resumed.get('alternate-flaps-position'),'OFF','momentary direction is never restored held');assert.equal(resumed.get('yaw-damper'),'ON','invalid saved value uses registry default');
const nav=registry.controls.find(c=>c.id==='vhf-nav'),slot=layout.placements.find(p=>p.id==='OH08'),point=model.mapPoint(nav,slot);
assert.ok(point.y>=slot.y&&point.y<=slot.y+slot.h,'nav shared-source crop maps into OH08, not OH07');
const savedPoint={...point};engine.set('vhf-nav','NORMAL');assert.deepEqual(model.mapPoint(nav,slot),savedPoint,'socket pivot never moves with the detent');
for(const c of registry.controls){const p=model.mapPoint(c,layout.placements.find(p=>p.id===c.placementId));assert.ok(Number.isFinite(p.x+p.y+p.diameter)&&p.diameter>0);}
for(const a of Object.values(registry.assets)){const bytes=fs.readFileSync(path.resolve(__dirname,a.url));assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),a.sha256,'original approved toggle asset reused');}
engine.reset();for(const c of registry.controls)assert.equal(engine.get(c.id),c.default);
const html=fs.readFileSync(path.join(__dirname,'index.html'),'utf8');assert.ok(html.includes('<base href="../all-overhead/">'));assert.ok(html.includes('./stage.js?v=UPD-0012-OVH-measured-seams'),'frozen renderer reused unchanged');
console.log('PASS: 58 socket mappings; binary, horizontal and vertical detents; clamps; spring release; safe persistence; fixed pivots; six approved frame hashes; frozen renderer reuse.');

assert.deepEqual(Object.fromEntries(Object.entries(registry.assets).map(([name,asset])=>[name,asset.frame])),{'vertical-off':4,'vertical-center':1,'vertical-on':3,'horizontal-left':0,'horizontal-center':1,'horizontal-right':2});

// HQ image decodes as one shared 3840x768 texture across all mounted switches.
const hqPath=path.resolve(__dirname,registry.assets['vertical-on'].url);
const hqBytes=fs.readFileSync(hqPath);
assert.equal(hqBytes.subarray(0,4).toString('ascii'),'RIFF');
assert.equal(hqBytes.subarray(8,12).toString('ascii'),'WEBP');
assert.equal(hqBytes.subarray(12,16).toString('ascii'),'VP8X');
assert.equal(1+hqBytes.readUIntLE(24,3),3840);
assert.equal(1+hqBytes.readUIntLE(27,3),768);
assert.equal(registry.version,'TGL-0003-HQ');

// Approved sprite has a transparent background; image cleanup only affects mounted switch footprints.
const cleanup=require('./socket-cleanup-v1.js');
assert.equal(cleanup.REPAIR_RADIUS_RATIO,.82);
const photoPixels=new Uint8ClampedArray(128*128*4);
for(let y=0;y<128;y++)for(let x=0;x<128;x++){
 const n=(y*128+x)*4;photoPixels[n]=76;photoPixels[n+1]=96;photoPixels[n+2]=112;photoPixels[n+3]=255;
 if(x>50&&x<78&&y>47&&y<81){photoPixels[n]=244;photoPixels[n+1]=238;photoPixels[n+2]=230;}
}
const neutral=cleanup.estimate(photoPixels,128);
assert.deepEqual(neutral.base,[76,96,112],'old white toggle is excluded from sampled paint');
const patch={width:128,height:128,data:new Uint8ClampedArray(128*128*4)};
cleanup.patchToImageData(patch,neutral,55);
assert.equal(patch.data[(64*128+64)*4+3],255,'old socket covered directly below new switch');
assert.equal(patch.data[(13*128+64)*4+3],0,'legends outside the switch remain unaltered');
const mountJS=fs.readFileSync(path.join(__dirname,'app.js'),'utf8');
assert.ok(mountJS.includes("cleanup.className='toggle-socket-cleanup'"));
assert.ok(mountJS.includes('button.append(cleanup,art)'),'cleanup must stay BEHIND approved sprite');
const cockpitHTML=fs.readFileSync(path.join(__dirname,'../cockpit/overhead-stage.html'),'utf8');
assert.ok(cockpitHTML.indexOf('socket-cleanup-v1.js')<cockpitHTML.indexOf('app.js?v=TGL-0004'),'cleanup loads before toggle mount');
