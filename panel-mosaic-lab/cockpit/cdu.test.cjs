'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto'),view=require('./view-model');
const root=path.resolve(__dirname,'../..'),read=p=>fs.readFileSync(path.join(root,p),'utf8'),assembly=JSON.parse(read('panel-mosaic-lab/cockpit/assembly.json')),items=assembly.embeddedInstruments,core=require('../../cdu-standalone-v6/engine/cdu-engine'),pages=JSON.parse(read('cdu-standalone-v6/data/page-definitions.json')).pages;
assert.equal(view.validateInstruments(assembly),true);assert.equal(items.length,2);assert.deepEqual(new Set(items.map(i=>i.seat)),new Set(['CAPT','FO']));assert.ok(items[0].x<items[1].x,'Captain on left, F/O on right');
for(const i of items){const box=view.target(assembly,i.id);assert.ok(box&&box.w>0&&box.h>0);assert.equal(box.x,100+i.x*2);const u=new URL(i.embeddedUrl,'https://example.test/panel-mosaic-lab/cockpit/');assert.equal(u.searchParams.get('seat'),i.seat);assert.equal(i.nativeWidth,1199);assert.equal(i.nativeHeight,1312);assert.equal(u.pathname,'/panel-mosaic-lab/cockpit/cdu-stage.html');}
const source=assembly.cduSource;for(const [p,sha]of [[source.artwork,source.artworkSha256],[source.controlMap,source.controlMapSha256]])assert.equal(crypto.createHash('sha256').update(fs.readFileSync(path.join(root,p))).digest('hex'),sha);
const map=JSON.parse(read(source.controlMap));assert.equal(map.controls.length,70);assert.equal(map.outputs.length,5);assert.equal(source.artworkSha256,'2c60c534e6e9cd80afa721f2d82801d7bdbc54dce4bbd39b8adb3470f2df0237');
const embedded=read('panel-mosaic-lab/cockpit/cdu-stage.html'),original=read(source.page),scripts=s=>[...s.matchAll(/<script[^>]*src="([^"]+)"/g)].map(m=>m[1]);assert.deepEqual(scripts(embedded).slice(0,-1),scripts(original));assert.ok(embedded.includes('<base href="../../cdu-standalone-v6/">'));assert.ok(embedded.includes('href="../assets/fonts/boeing-cdu/cdu-screen.css"'));
const css=read('panel-mosaic-lab/cockpit/cdu-embed.css');for(const selector of ['font-family','font-size','.hotspot','.fmc-screen','.fmc-line'])assert.ok(!css.includes(selector),'Embed must not rewrite approved CDU screen or keys: '+selector);
require('./cdu-session.test.cjs');
// New CDU boxes must not cover any existing main-panel annunciator.
const lights=JSON.parse(read('panel-mosaic-lab/cockpit/lights.json')),region=assembly.regions.find(r=>r.id==='main');for(const i of items)for(const light of lights.lights){const p=region.placements.find(p=>p.id===light.pieceId);if(!p)continue;const k=p.w/assembly.assets[p.asset].dimensions[0],[x,y,w,h]=light.sourceRect,b={x:p.x+x*k,y:p.y+y*k,w:w*k,h:h*k};assert.ok(!(i.x<b.x+b.w&&i.x+i.w>b.x&&i.y<b.y+b.h&&i.y+i.h>b.y),'CDU obscures light '+light.id);}
const invalid=structuredClone(assembly);invalid.embeddedInstruments[1].x=2100;assert.throws(()=>view.validateInstruments(invalid));
console.log('PASS: two correctly sided CDU frames; unchanged approved 1199×1312 art / 70 keys / five outputs / locked fonts; original v6 imports; independent pages/scratchpads with shared FMC fields; no lamp overlap.');

const group=view.target(assembly,'cdu-both');for(const i of items){const box=view.target(assembly,i.id);assert.ok(group.x<=box.x&&group.y<=box.y&&group.x+group.w>=box.x+box.w&&group.y+group.h>=box.y+box.h);}

// Owner screenshot registration measures the actual bezel, not the surrounding black bitmap.
const calibration=JSON.parse(read('panel-mosaic-lab/cockpit/cdu-size-reference.json')),anchor=region.placements.find(p=>p.id===calibration.anchor.pieceId),nativeRatio=anchor.w/assembly.assets[anchor.asset].dimensions[0],registration=calibration.anchor.sourceToReference;
for(const i of items){
 assert.equal(i.presentation,'reference-frame-fit');assert.deepEqual(i.sourceWindow,calibration.sourceVisibleFrame);
 const p=view.instrumentPresentation(i),window=i.sourceWindow;
 assert.ok(Math.abs(p.left+window.x*p.scaleX)<1e-8);assert.ok(Math.abs(p.top+window.y*p.scaleY)<1e-8);
 assert.ok(Math.abs(p.left+(window.x+window.w)*p.scaleX-i.w)<1e-8);assert.ok(Math.abs(p.top+(window.y+window.h)*p.scaleY-i.h)<1e-8);
 for(const control of map.controls){const [l,t,r,b]=control.bbox_px;assert.ok(l>=window.x&&t>=window.y&&r<=window.x+window.w&&b<=window.y+window.h,'Visible source crop removes key '+control.id);}
 const projected=[registration.offsetX+(i.x-anchor.x)/nativeRatio*registration.scale,registration.offsetY+(i.y-anchor.y)/nativeRatio*registration.scale,registration.offsetX+(i.x+i.w-anchor.x)/nativeRatio*registration.scale,registration.offsetY+(i.y+i.h-anchor.y)/nativeRatio*registration.scale];
 const expected=[...calibration.referenceFrames[i.seat]],adjust=calibration.ownerAdjustments?.[i.seat];if(adjust){expected[1]+=adjust.top/nativeRatio*registration.scale;expected[3]+=adjust.bottom/nativeRatio*registration.scale;}for(let n=0;n<4;n++)assert.ok(Math.abs(projected[n]-expected[n])<.001,'Visible CDU bezel differs from owner screenshot: '+i.seat);
}
const wrongCrop=structuredClone(assembly);wrongCrop.embeddedInstruments[0].sourceWindow.w=1300;assert.throws(()=>view.validateInstruments(wrongCrop));
console.log('PASS: bezel-to-reference corner registration; original black padding excluded; all 140 original key hitboxes remain visible and share the artwork transform.');
