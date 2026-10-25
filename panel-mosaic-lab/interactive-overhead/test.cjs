'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const model=require('./model.js'),registry=JSON.parse(fs.readFileSync(path.join(__dirname,'registry.json'),'utf8'));
const layout=JSON.parse(fs.readFileSync(path.join(__dirname,'../all-overhead/atlas-layout.json'),'utf8'));
assert.equal(model.validate(registry,layout),true);
assert.equal(registry.controls.length,58);
assert.deepEqual(Object.fromEntries(['toggle-2','toggle-3-vertical','toggle-3-horizontal'].map(t=>[t,registry.controls.filter(c=>c.type===t).length])),{'toggle-2':39,'toggle-3-vertical':16,'toggle-3-horizontal':3});
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

// Owner-approved landing lights: two outboard 3-detent, two inboard 2-detent.
const landingIds=['landing-out-l','landing-out-r','landing-in-l','landing-in-r'];
const landings=landingIds.map(id=>registry.controls.find(c=>c.id===id));
assert.deepEqual(landings.slice(0,2).map(c=>c.states),[['EXTEND','OFF','ON'],['EXTEND','OFF','ON']]);
assert.deepEqual(landings.slice(2).map(c=>c.states),[['OFF','ON'],['OFF','ON']]);
assert.ok(landings.every(c=>c.visualFamily==='landing-triplet-v1'));
for(const id of landingIds.slice(0,2)){
 assert.equal(engine.set(id,'EXTEND','test'),true);
 assert.equal(engine.step(id,1,'test'),true);
 assert.equal(engine.get(id),'OFF');
 assert.equal(engine.step(id,1,'test'),true);
 assert.equal(engine.get(id),'ON');
}
for(const id of landingIds.slice(2))assert.equal(engine.set(id,'EXTEND','test'),false);
const triplet=registry.specialAssets?.landingTriplet;
assert.deepEqual(triplet?.order,['UP','CENTER','DOWN']);
const tripletBytes=fs.readFileSync(path.resolve(__dirname,triplet.url));
assert.equal(crypto.createHash('sha256').update(tripletBytes).digest('hex'),triplet.sha256);
assert.equal(tripletBytes.subarray(0,4).toString('ascii'),'RIFF');
assert.equal(tripletBytes.subarray(8,12).toString('ascii'),'WEBP');
const landingSource=fs.readFileSync(path.join(__dirname,'app.js'),'utf8');
assert.ok(landingSource.includes("c.visualFamily==='landing-triplet-v1'"));
assert.ok(landingSource.includes('window.B737TogglePoseMap.landingFrames(c)'),'render uses verified physical UP/OFF DOWN/ON poses');
assert.ok(landingSource.includes("backgroundSize:'300% 100%'"));

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
assert.equal(registry.version,'TGL-0008-SHAFT-CENTERED');

// TGL-0005: prevent upside-down visuals and dark ring regressions.
const poses=require('./toggle-pose-v1.js');
for(const c of registry.controls){
 if(c.axis!=='vertical')continue;
 const frames=poses.frameKeys(c);
 assert.equal(frames.length,c.states.length,c.id);
 if(c.states.length===2){assert.deepEqual(frames,['vertical-on','vertical-off'],c.id+' top OFF bottom ON');}
 if(c.states.length===3){assert.deepEqual(frames,['vertical-on','vertical-center','vertical-off'],c.id);}
}
for(const id of ['landing-in-l','landing-in-r']){
 const c=registry.controls.find(s=>s.id===id);
 assert.deepEqual(poses.landingFrames(c),[0,2],id+' OFF UP / ON DOWN');
}
for(const id of ['landing-out-l','landing-out-r']){
 const c=registry.controls.find(s=>s.id===id);
 assert.deepEqual(poses.landingFrames(c),[0,1,2],id+' three detents');
}
const cleanup=require('./socket-cleanup-v2.js');
const s=176,d=new Uint8ClampedArray(s*s*4),mid=(s-1)/2;
for(let y=0;y<s;y++)for(let x=0;x<s;x++){
 const k=(y*s+x)*4,blackOld=Math.hypot(x-mid,y-mid)<28;
 d[k]=blackOld?5:169;d[k+1]=blackOld?4:181;d[k+2]=blackOld?6:191;d[k+3]=255;
}
const neutral=cleanup.estimate(d,s);
assert.ok(neutral.base.every(v=>v>=160),'must sample silver panel rather than black old bezel '+JSON.stringify(neutral.base));
const out={width:128,height:128,data:new Uint8ClampedArray(128*128*4)};
cleanup.patchToImageData(out,neutral,70);
const at=(x,y,k)=>out.data[(y*128+x)*4+k];
assert.ok(at(64,64,0)>140&&at(64,64,1)>140,'center of replacement must never become black');
assert.equal(at(0,0,3),0,'all exterior pixels must stay fully transparent');
assert.equal(at(64,64,3),255,'metal ghost is fully masked beneath the switch');
assert.ok(at(64,13,3)<255,'outer feather must blend into the original photo');
const mountedSource=fs.readFileSync(path.join(__dirname,'app.js'),'utf8');
assert.ok(mountedSource.includes('window.B737TogglePoseMap.landingFrames(c)'));
assert.ok(mountedSource.includes('button.append(cleanup,art)'),'cleanup must remain behind the approved five-position art');
const html2=fs.readFileSync(path.join(__dirname,'../cockpit/overhead-stage.html'),'utf8');
assert.ok(html2.indexOf('toggle-pose-v1.js')<html2.indexOf('app.js?v=TGL-0007'));
assert.ok(html2.indexOf('socket-cleanup-v3.js')<html2.indexOf('app.js?v=TGL-0007'));
console.log('PASS TGL-0005: all 58 physical detents upright, no black fallback, feathered masked sockets, immutable art.');

// TGL-0006: five sprites now share a halo-free, orthographic metal nut.
// The original frozen photographic mosaic is deliberately unchanged.
assert.equal(registry.approvedVisuals[0],'b737-cockpit-toggle-v6-shaft-centered-fixed-collar');
assert.ok(registry.controls.length===58,'Every switch must still be mapped');
assert.ok(Object.values(registry.assets).every(a=>a.url.includes('toggle-switch-standard-v6/b737-toggle-five-shafts-centered-v8.webp')));
console.log('PASS TGL-0006: unified overhead reuses one transparent no-halo five-pose nut atlas with all physical detents intact.');

/* TGL-0007: eliminate black circles and recenter the metal collar itself. */
const repair=require('./socket-cleanup-v3.js');
assert.ok(repair.REPAIR_RADIUS_RATIO<.5,'Repair must not draw a new disc larger than the mounted bezel');
for(const [panel,color] of [['OH12',[200,217,226]],['OH09',[92,105,120]],['OH23-25',[68,78,88]]]){
 const n=160,source=new Uint8ClampedArray(n*n*4),m=(n-1)/2;
 for(let y=0;y<n;y++)for(let x=0;x<n;x++){
   const off=(y*n+x)*4,dark=Math.hypot(x-m,y-m)<28;
   for(let k=0;k<3;k++)source[off+k]=dark?5:color[k];
   source[off+3]=255;
 }
 const sampled=repair.chooseBackground(source,n,panel);
 assert.ok(sampled,panel+' samples unavailable');
 assert.deepEqual(sampled.base,color,'The original black hole must never be chosen as panel skin: '+panel);
 const patch={width:120,height:120,data:new Uint8ClampedArray(120*120*4)};
 repair.patchToImageData(patch,sampled,70);
 const px=(x,y,k)=>patch.data[(y*120+x)*4+k];
 assert.equal(px(60,60,0),color[0]);
 assert.equal(px(0,0,3),0,'No visible black or colored outer halo');
 assert.equal(px(60,60,3),255,'Photographed hole masked below metal collar');
}
assert.ok(mountedSource.includes('p.diameter,c.placementId)'),'The background sampler must know the original panel');
assert.ok(Object.values(registry.assets).every(a=>a.sha256==='1bf7934b77b32acac90d7ad10e41e3810a5ca65d70ff967c06f5ee171e3792f0'));
assert.ok(html2.includes('socket-cleanup-v3.js?v=TGL-0007'));
console.log('PASS TGL-0007: centered bezel; only narrow transparent repair, original old black pixel discarded.');

/* TGL-0008: the shaft artwork, NOT the nut nor the panel socket, is aligned. */
const alignment=require('../../shared-assets/toggle-switch-standard-v6/alignment.json');
assert.equal(alignment.baseTranslation.x,-28);
assert.equal(alignment.baseTranslation.y,-7);
assert.equal(alignment.shaftCorrection.x,30,'shaft moved to the right inside the fixed nut');
assert.equal(alignment.shaftCorrection.y,0);
assert.equal(alignment.shiftAppliedToBase,false,'nut image must not move along with the shaft');
assert.deepEqual(alignment.states,['LEFT','CENTER','RIGHT','UP','DOWN']);
assert.equal(registry.version,'TGL-0008-SHAFT-CENTERED');
console.log('PASS TGL-0008: stationary socket/nut, shaft re-centered 30 source pixels, five states unchanged.');
