'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto'),m=require('./view-model');
const a=JSON.parse(fs.readFileSync(path.join(__dirname,'assembly.json'),'utf8'));assert.equal(m.validate(a),true);assert.equal(a.regions.length,3);assert.equal(a.regions.find(r=>r.id==='main').placements.length,5);assert.equal(a.regions.find(r=>r.id==='overhead').baseVersion,'UPD-0012-OVH-measured-seams');
for(const asset of Object.values(a.assets)){const bytes=fs.readFileSync(path.resolve(__dirname,asset.url));assert.equal(bytes.length,asset.bytes);assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),asset.sha256);assert.equal(crypto.createHash('sha1').update(Buffer.concat([Buffer.from('blob '+bytes.length+'\0'),bytes])).digest('hex'),asset.gitBlobSha);}
const zoom=m.zoomAnchor(.25,.5,100,200,300,250);assert.equal((100+300)/.25,(zoom.left+300)/.5);assert.equal((200+250)/.25,(zoom.top+250)/.5);assert.ok(m.fit({w:4400,h:8100},390,600)>=.04);
const centered=m.zoomAnchor(.1,.2,0,0,500,200,{x:300,y:20},{x:100,y:0});assert.equal((500-300)/.1,(centered.left+500-100)/.2);assert.equal((200-20)/.1,(centered.top+200)/.2);
const html=fs.readFileSync(path.join(__dirname,'overhead-stage.html'),'utf8');for(const src of ['stage.js?v=UPD-0012','app.js?v=RG-0001','rotary-guards.js?v=LGT-0003','lights.js?v=LGT-0003'])assert.ok(html.includes(src),src);assert.ok(!html.includes('data-cockpit-entry'));
const unified=fs.readFileSync(path.join(__dirname,'index.html'),'utf8');
for(const marker of ['id="unifiedLightsOpen"','id="unifiedLightsDialog"','id="unifiedLightSearch"','unified-lights.js?v=CKP-0004','../lights-test/asset-model.js?v=LGT-0006'])assert.ok(unified.includes(marker),'Unified annunciator testing: '+marker);
const assetModel=require('../lights-test/asset-model'),gallery=JSON.parse(fs.readFileSync(path.join(__dirname,'../lights-test/registry.json')));
assert.ok(gallery.lights.length>=85,'Unified must load the expanding LIGHTS catalogue');
for(const id of ['SPEED_BRAKE_ARMED_GREEN','SPEED_BRAKE_DO_NOT_ARMED_AMBER'])assert.ok(gallery.lights.some(c=>c.id===id),id);
const stab=gallery.lights.find(c=>c.id==='STAB_OUT_OF_TRIM');assert.deepEqual(stab.face,{width:300,height:300});
assert.equal(assetModel.normalize(gallery.lights.find(c=>c.id==='VALVE_OPEN'),'DIM_BLUE'),'DIM_BLUE');
for(const light of gallery.lights)for(const state of light.states)assert.ok(fs.existsSync(path.join(__dirname,'../assets/locked/2026-10-23/LIGHTS',light.assets[state])),light.id+' '+state);
console.log('PASS: three regions; five main sources; complete source aspects; exact eight image fingerprints; cursor-anchored zoom; embedded approved overhead modules.');
