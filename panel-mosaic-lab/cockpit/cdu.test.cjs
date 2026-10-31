'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto'),view=require('./view-model');
const root=path.resolve(__dirname,'../..'),read=p=>fs.readFileSync(path.join(root,p),'utf8'),assembly=JSON.parse(read('panel-mosaic-lab/cockpit/assembly.json')),items=assembly.embeddedInstruments,core=require('../../cdu-standalone-v6/engine/cdu-engine'),pages=JSON.parse(read('cdu-standalone-v6/data/page-definitions.json')).pages;
assert.equal(view.validateInstruments(assembly),true);assert.equal(items.length,2);assert.deepEqual(new Set(items.map(i=>i.seat)),new Set(['CAPT','FO']));assert.ok(items[0].x<items[1].x,'Captain on left, F/O on right');
for(const i of items){const box=view.target(assembly,i.id);assert.ok(box&&box.w>0&&box.h>0);assert.equal(box.x,100+i.x*2);const u=new URL(i.embeddedUrl,'https://example.test/panel-mosaic-lab/cockpit/');assert.equal(u.searchParams.get('seat'),i.seat);assert.equal(i.nativeWidth,1199);assert.equal(i.nativeHeight,1312);assert.equal(u.pathname,'/panel-mosaic-lab/cockpit/cdu-stage.html');}
const source=assembly.cduSource;for(const [p,sha]of [[source.artwork,source.artworkSha256],[source.controlMap,source.controlMapSha256]])assert.equal(crypto.createHash('sha256').update(fs.readFileSync(path.join(root,p))).digest('hex'),sha);
const map=JSON.parse(read(source.controlMap));assert.equal(map.controls.length,70);assert.equal(map.outputs.length,5);assert.equal(source.artworkSha256,'2c60c534e6e9cd80afa721f2d82801d7bdbc54dce4bbd39b8adb3470f2df0237');
const embedded=read('panel-mosaic-lab/cockpit/cdu-stage.html'),original=read(source.page),scripts=s=>[...s.matchAll(/<script[^>]*src="([^"]+)"/g)].map(m=>m[1]);const omitted=new Set(['ehsi/ehsi-engine.js','ehsi/photo-panel.js','nav-map-overlay.js','stage5-map.js']);const integrationScripts=['../panel-mosaic-lab/cockpit/cdu-bridge.js?v=CDU-U3-WHEEL-PAN-0001','../panel-mosaic-lab/cockpit/cdu-irs-adapter-v1.js?v=FCOM-PREFLIGHT-0001','../panel-mosaic-lab/cockpit/cdu-fmc-telemetry-v1.js?v=CH11-NET-0001','../engine/config/cdu-ident-installation-v1.js?v=CDU-ENGINE-IDENT-0001','../engine/ch11/cdu-airac-banks-v1.js?v=CDU-AIRAC-BANKS-0001','../panel-mosaic-lab/cockpit/cdu-ident-profile-receiver-v1.js?v=CDU-ENGINE-IDENT-0001','../engine/ch11/fmc-airac-banks-v1.js?v=AIRAC-2611-BANKS-0001','../panel-mosaic-lab/cockpit/cdu-airac-ident-adapter-v1.js?v=AIRAC-2611-BANKS-0001','../panel-mosaic-lab/cockpit/cdu-airac-bank-receiver-v1.js?v=CDU-AIRAC-BANKS-0001','../engine/ch11/cdu-24-column-metrics-v1.js?v=CDU-24COL-0006','../panel-mosaic-lab/cockpit/cdu-screen-fit-v6.js?v=CDU-24COL-0006-R9-LSK-PROMPT-80','../panel-mosaic-lab/cockpit/cdu-font-diagnostics-v6.js?v=CDU-24COL-0006'];
const bodyScripts=scripts(embedded).filter(src=>!src.includes('performance/manifest.js')&&!src.includes('performance-loader.js'));
assert.deepEqual(bodyScripts.slice(-integrationScripts.length),integrationScripts,'Only the eight currently approved CDU bridge, installation profile and 24-column typography scripts may be appended');
assert.ok(read('panel-mosaic-lab/cockpit/cdu-bridge.js').includes("kind:'wheel-pan'"),'Shared FMC bridge also forwards wheel pan without changing CDU page engine');
const telemetry=read('panel-mosaic-lab/cockpit/cdu-fmc-telemetry-v1.js');assert.ok(telemetry.includes('read-only')&&telemetry.includes('Chapter 11'),'FMC telemetry adapter must remain advisory-only and retain its scope');
const approvedDepArrQueries={
 'data/page-definitions.js?v=IDENT-POS-0001':'data/page-definitions.js?v=DEPARR-FCOM-114032-0001-IDENT-POS-0001-AIRAC2611-0001',
 'engine/cdu-engine.js?v=route-airport-20261023-IDENT-POS-0001':'engine/cdu-engine.js?v=route-airport-20261023-IDENT-POS-0001-DEPARR-FCOM-114032-0001',
 '../engine/ch11/cdu-preflight-evidence-v1.js?v=FCOM-PREFLIGHT-0001':'../engine/ch11/cdu-preflight-evidence-v1.js?v=FCOM-PREFLIGHT-0001-ENGINE-IDENT-0001',
 'app.js?v=CH11-SCREEN-LEDGER-0001-IDENT-POS-0001':'app.js?v=CH11-SCREEN-LEDGER-0001-IDENT-POS-0001-DEPARR-CFM-IDENT-0001',
 'stage5-adapter.js':'stage5-adapter.js?v=DEPARR-FCOM-114032-0001',
 'stage6-selector.js?v=standalone-20261023b':'stage6-selector.js?v=standalone-20261023b-DEPARR-FCOM-114032-0001'
};
assert.deepEqual(bodyScripts.slice(0,-integrationScripts.length),scripts(original).filter(src=>!omitted.has(src)&&src!=='../engine/ch11/fmc-airac-banks-v1.js?v=AIRAC-2611-BANKS-0001').map(src=>approvedDepArrQueries[src]||src),'Every original CDU application script must keep its exact order and approved DEP ARR cache versions');for(const src of omitted)assert.ok(!scripts(embedded).includes(src),'Hidden EHSI/map code must not execute in Unified');assert.ok(embedded.includes('<base href="../../cdu-standalone-v6/">'));assert.ok(embedded.includes('href="../assets/fonts/boeing-cdu/cdu-screen.css"'));
const css=read('panel-mosaic-lab/cockpit/cdu-embed.css');
assert.ok(!css.includes('font-family'),'Locked BoeingCDU font faces must not change');
assert.ok(!css.includes('.hotspot'),'CDU key hotspot geometry must not change');
const display=css.split('/* CDU on Unified: match the supplied 737 Classic reference screenshot.')[1];
assert.ok(display&&display.includes('RGB(41,255,49)')&&display.includes('color:#29ff31'),
 'Owner green CDU monochrome reference RGB(41,255,49) must be retained');
const metrics=require('../../engine/ch11/cdu-24-column-metrics-v1');
assert.equal(metrics.COLUMNS,24,'Latest owner requirement is an exact 24-character scratchpad');
assert.equal(metrics.TEST,'A'.repeat(24));assert.equal(metrics.TOO_LONG,'A'.repeat(25));
const fit=read('panel-mosaic-lab/cockpit/cdu-screen-fit-v6.js');
assert.ok(fit.includes('Metrics.calibrate(ctx,available,family)')&&fit.includes('root.document.fonts.ready'),
 'Typography must use the approved font advances after font loading, rather than the superseded small cqw sizes');
assert.ok(!/(?:font-family|transform|position|letter-spacing)\\s*:/.test(display),
 'CDU display must not move hotspots, alter font family or character grid');
require('./cdu-session.test.cjs');
require('./cdu-classic-typography.test.cjs');
// New CDU boxes must not cover any existing main-panel annunciator.
const lights=JSON.parse(read('panel-mosaic-lab/cockpit/lights.json')),region=assembly.regions.find(r=>r.id==='main');for(const i of items)for(const light of lights.lights){const p=region.placements.find(p=>p.id===light.pieceId);if(!p)continue;const k=p.w/assembly.assets[p.asset].dimensions[0],[x,y,w,h]=light.sourceRect,b={x:p.x+x*k,y:p.y+y*k,w:w*k,h:h*k};assert.ok(!(i.x<b.x+b.w&&i.x+i.w>b.x&&i.y<b.y+b.h&&i.y+i.h>b.y),'CDU obscures light '+light.id);}
const invalid=structuredClone(assembly);invalid.embeddedInstruments[1].x=2100;assert.throws(()=>view.validateInstruments(invalid));
console.log('PASS: two correctly sided CDU frames; unchanged approved 1199×1312 art / 70 keys / five outputs / locked fonts; original v6 input/display engine; hidden EHSI/map imports excluded; independent pages/scratchpads with shared FMC fields; no lamp overlap.');

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
