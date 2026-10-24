'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto'),m=require('./view-model');
const a=JSON.parse(fs.readFileSync(path.join(__dirname,'assembly.json'),'utf8'));assert.equal(m.validate(a),true);assert.equal(a.regions.length,3);assert.equal(a.regions.find(r=>r.id==='main').placements.length,5);assert.equal(a.regions.find(r=>r.id==='overhead').baseVersion,'UPD-0012-OVH-measured-seams');
assert.equal(a.version,'CKP-0012-THROTTLE-FIT');
const pedestal=a.regions.find(r=>r.id==='pedestal');
const [throttle,fire,radio]=pedestal.placements;
assert.deepEqual(pedestal.placements.map(p=>p.id),['throttle-quadrant','fire-protection','pedestal-radio']);
assert.equal(throttle.asset,'panel-mosaic-lab/assets/locked/2026-10-23/Aircraft Throttle Quadrant Control Panel.png');
assert.ok(Math.abs(throttle.w/throttle.h-throttle.sourceWindow.w/throttle.sourceWindow.h)<1e-9,'Display-only trim preserves throttle source aspect');
assert.equal(throttle.w,606,'Throttle core must not span the full pedestal width');
assert.ok(Math.abs(throttle.x+throttle.w/2-pedestal.nativeWidth/2)<1e-9,'Throttle centered in pedestal');
assert.ok(throttle.maskPolygon?.length>=30,'Silhouette mask hides white canvas without altering the approved source image');
assert.ok(Math.abs(fire.y-(throttle.y+throttle.h))<1e-9,'Fire follows throttle without overlap');
assert.ok(Math.abs(radio.y-(fire.y+fire.h))<1e-9,'Radio follows fire without overlap');
assert.ok(a.canvas.height>=pedestal.y+pedestal.h,'Whole pedestal remains inside canvas');
assert.equal(a.assets[throttle.asset].sha256,'e533f907b3826dbf8fc986812b9045c2ef8980f93133ce85b859e9b9d7ab0030');
for(const asset of Object.values(a.assets)){const bytes=fs.readFileSync(path.resolve(__dirname,asset.url));assert.equal(bytes.length,asset.bytes);assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),asset.sha256);assert.equal(crypto.createHash('sha1').update(Buffer.concat([Buffer.from('blob '+bytes.length+'\0'),bytes])).digest('hex'),asset.gitBlobSha);}
const zoom=m.zoomAnchor(.25,.5,100,200,300,250);assert.equal((100+300)/.25,(zoom.left+300)/.5);assert.equal((200+250)/.25,(zoom.top+250)/.5);assert.ok(m.fit({w:4400,h:8100},390,600)>=.04);
const centered=m.zoomAnchor(.1,.2,0,0,500,200,{x:300,y:20},{x:100,y:0});assert.equal((500-300)/.1,(centered.left+500-100)/.2);assert.equal((200-20)/.1,(centered.top+200)/.2);
const html=fs.readFileSync(path.join(__dirname,'overhead-stage.html'),'utf8');for(const src of ['stage.js?v=UPD-0012','app.js?v=RG-0001','rotary-motion-rm0002.js?v=RM-0004','rotary-guards.js?v=ISN-0003','rotary-guards-model.js?v=RM-0003','overhead-bridge.js?v=ISN-0003','lights.js?v=LGT-0003'])assert.ok(html.includes(src),src);assert.ok(!html.includes('data-cockpit-entry'));
assert.equal(a.regions.find(r=>r.id==='overhead').embeddedUrl,'./overhead-stage.html?v=ISN-0003','Unified must reload current overhead bridge and start cutout handling');
const interactive=fs.readFileSync(path.join(__dirname,'../interactive-overhead/rotary-guards.js'),'utf8');
assert.ok(interactive.includes('mountEngineStartLabelCorrection(layout)'),'Unified corrects FLT spacing without changing the locked atlas image');
assert.ok(interactive.includes('motion.createDetentGesture'),'Unified uses event-triggered hard-stop detents');
assert.ok(interactive.includes("engine.setRotary(c.id,hit.state,'legend-tap')"),'Tapping an exact legend selects its detent directly');
assert.match(interactive,/firstThreshold:12,nextThreshold:28,minTravelPixels:9/,'Swipe sensitivity is reduced while legend targets remain immediate');
assert.ok(interactive.includes('model.legendHotspots'),'UI maps calibrated polygons via source atlas transform');
assert.match(interactive,/if\(c\.mode==='detent'\)\{drag\.gesture\.feed\(delta,Math\.hypot\(dx,dy\)\);return;\}/,'Detents require angular and pointer-distance dead zones; no continuous free-follow rotation');
const unified=fs.readFileSync(path.join(__dirname,'index.html'),'utf8');
assert.ok(unified.includes('CKP-0012'),'Unified HTML advertises throttle fit correction');
for(const marker of ['id="unifiedLightsOpen"','id="unifiedLightsDialog"','id="unifiedLightSearch"','unified-lights.js?v=LGT-0013','../lights-test/asset-model.js?v=LGT-0013'])assert.ok(unified.includes(marker),'Unified annunciator testing: '+marker);
const assetModel=require('../lights-test/asset-model'),gallery=JSON.parse(fs.readFileSync(path.join(__dirname,'../lights-test/registry.json')));
assert.ok(gallery.lights.length>=87,'Unified must load the expanding LIGHTS catalogue');
const atLim=gallery.lights.find(c=>c.id==='A_T_LIM_WHITE');assert.deepEqual(atLim?.lines,['A/T LIM']);assert.deepEqual(atLim.states,['OFF','ON']);assert.deepEqual(atLim.face,{width:600,height:300});
const align=gallery.lights.find(c=>c.id==='ALIGN_WHITE');assert.deepEqual(align?.lines,['ALIGN']);assert.deepEqual(align.states,['OFF','ON']);assert.deepEqual(align.face,{width:600,height:300});
for(const [id,stem] of [['ALIGN_WHITE','ALIGN_WHITE'],['ON_DC_LAMP','ON_DC_LAMP'],['FAULT','FAULT'],['DC_FAIL','DC_FAIL']]){
 const legend=gallery.lights.find(c=>c.id===id);
 assert.ok(legend,id);assert.deepEqual(legend.states,['OFF','ON']);assert.equal(legend.face.width,600);assert.equal(legend.face.height,300);
 assert.equal(legend.assets.OFF,'unified-v2/'+stem+'_OFF.svg');assert.equal(legend.assets.ON,'unified-v2/'+stem+'_ON.svg');
 assert.equal(gallery.lights.filter(c=>c.id===id).length,1,'One reusable legend per IRS type: '+id);
}
for(const [id,stem,expectedLines] of [
 ['LOW_PRESSURE','LOW_PRESSURE_AMBER_REF',['LOW','PRESSURE']],
 ['R_ELEV_PITOT','R_ELEV_PITOT_AMBER_REF',['R ELEV','PITOT']]
]){
 const light=gallery.lights.find(c=>c.id===id);
 assert.deepEqual(light?.lines,expectedLines);assert.deepEqual(light.states,['OFF','ON']);
 assert.deepEqual(light.face,{width:600,height:300});
 assert.equal(light.assets.OFF,'unified-v2/'+id+'_OFF.svg');assert.equal(light.assets.ON,'unified-v2/'+id+'_ON.svg');
 for(const state of light.states){const original=fs.readFileSync(path.join(__dirname,'../assets/locked/2026-10-23/LIGHTS',stem+'_'+state+'.svg'));const approved=fs.readFileSync(path.join(__dirname,'../assets/locked/2026-10-23/LIGHTS',light.assets[state]));assert.deepEqual(approved,original,'Keep the approved '+id+' '+state+' pixel-identical');}
}
for(const id of ['SPEED_BRAKE_ARMED_GREEN','SPEED_BRAKE_DO_NOT_ARMED_AMBER'])assert.ok(gallery.lights.some(c=>c.id===id),id);
const stab=gallery.lights.find(c=>c.id==='STAB_OUT_OF_TRIM');assert.deepEqual(stab.face,{width:300,height:300});
assert.equal(stab.assets.ON,'unified-v2/STAB_OUT_OF_TRIM_ON.svg');
const fakeListing=['STAB_OUT_OF_TRIM_OFF.svg','STAB_OUT_OF_TRIM_ON.svg','STAB_OUT_OF_TRIM_FIT_OFF.svg','STAB_OUT_OF_TRIM_FIT_ON.svg'].map(name=>({name,type:'file'}));
const mergedGallery=assetModel.merge(gallery,fakeListing);assert.equal(mergedGallery.length,gallery.lights.length,'Replacement faces must not create duplicate STAB lights');assert.equal(mergedGallery.find(c=>c.id==='STAB_OUT_OF_TRIM').assets.ON,'unified-v2/STAB_OUT_OF_TRIM_ON.svg','Registered revision must override older discovered face');
for(const [asset,id] of [['SPEED_BRAKE_ARMED_GREEN','main-speed-brake-armed'],['SPEED_BRAKE_DO_NOT_ARMED_AMBER','main-speed-brake-do-not-arm']])assert.ok(gallery.lights.find(c=>c.id===asset)?.mountedCockpitInstances.includes(id),asset+' mounted on Unified');
assert.equal(assetModel.normalize(gallery.lights.find(c=>c.id==='VALVE_OPEN'),'DIM_BLUE'),'DIM_BLUE');
for(const light of gallery.lights)for(const state of light.states)assert.ok(fs.existsSync(path.join(__dirname,'../assets/locked/2026-10-23/LIGHTS',light.assets[state])),light.id+' '+state);
console.log('PASS: three regions; five main sources; complete source aspects; exact eight image fingerprints; cursor-anchored zoom; embedded approved overhead modules.');

const approvedFlap=fs.readFileSync(path.resolve(__dirname,'../assets/locked/2026-10-23/B737_FLAP_9_ORIGINAL_BMP_EXTRACTED.png'));
assert.equal(crypto.createHash('sha256').update(approvedFlap).digest('hex'),'709ea64910a134c4199f9bed393fc65fbd8e6b44bc70f7adc03a8470d29460a4','Original nine-BMP extraction must remain byte-for-byte unchanged');
const flapManifest=JSON.parse(fs.readFileSync(path.join(__dirname,'flap-lever-test.json'),'utf8'));
assert.deepEqual(flapManifest.detents.map(d=>d.value),[0,1,2,5,10,15,25,30,40]);
assert.equal(flapManifest.image.frameWidth*flapManifest.image.frameCount,flapManifest.image.width);
assert.equal(flapManifest.controls.mode,'visual-test-only','No unverified physical flap motion coupling');
const background=a.regions.find(r=>r.id==='pedestal').placements.find(p=>p.id==='throttle-quadrant');
const flapCalibration=flapManifest.backgroundCalibrations[background.asset];
assert.ok(flapCalibration,'Current background must have its own measured FLAP calibration');
const [tickCorrection]=flapCalibration.cosmeticCorrections;
assert.deepEqual(tickCorrection.destinationRect,{x:853,y:455,w:14,h:14},'Only the unlabeled mark between 1 and 2 is covered');
assert.deepEqual(tickCorrection.sourceRect,{x:838,y:455,w:14,h:14},'Copy neighboring dark surface from the same source image');
for(const detent of flapManifest.detents){
 const target=flapCalibration.targets[String(detent.value)];
 assert.ok(target&&Number.isFinite(target.x)&&Number.isFinite(target.y),'Missing source-pixel target for '+detent.value);
 assert.ok(Number.isFinite(detent.toothTip.x)&&Number.isFinite(detent.toothTip.y),'Missing sprite tooth anchor for '+detent.value);
 const point=require('./flap-lever-model').nativePoint(background,target);
 assert.ok(point.x>background.x+background.w/2,'FLAP tooth must sit to the right of the throttle core');
}
assert.ok(unified.includes('flap-lever-test.js?v=FLAP-BMP-0004'));
assert.ok(unified.includes('flap-lever-test.css?v=FLAP-BMP-0004'));
console.log('PASS: exact owner nine-BMP flap sprite archived and visual-only nine-detent Unified overlay registered.');
