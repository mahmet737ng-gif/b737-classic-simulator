'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const root=path.join(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const api=require('../panel-mosaic-lab/cockpit/parking-brake-unified-v1.js');
const assembly=JSON.parse(read('panel-mosaic-lab/cockpit/assembly.json'));
const pedestal=assembly.regions.find(r=>r.id==='pedestal');
const plate=pedestal.placements.find(p=>p.id==='throttle-quadrant');
function geometry(){return api.geometry({x:plate.x,y:plate.y,w:plate.w,sourceWidth:plate.sourceWindow.w});}
test('lever hinge exactly enters user green-marked source slot at (127,925)',()=>{
 assert.deepEqual(api.SLOT,{x:127,y:925});
 const g=geometry(),scale=plate.w/plate.sourceWindow.w;
 assert.ok(Math.abs(g.hinge.x-(plate.x+127*scale))<1e-8);
 assert.ok(Math.abs(g.hinge.y-(plate.y+925*scale))<1e-8);
 assert.ok(Math.abs((g.left+g.width*41/140)-g.slot.x)<1e-8);
 assert.ok(Math.abs((g.top+g.height*185/189)-g.slot.y)<1e-8);
 assert.ok(g.slot.y<plate.y+plate.h,'hinge remains in throttle plate source window');
});
test('red light stays independent and centered in the user red-marked hole (207,892)',()=>{
 const g=geometry(),scale=plate.w/plate.sourceWindow.w;
 assert.deepEqual(api.LAMP,{x:207,y:892});
 assert.ok(Math.abs(g.light.x-(plate.x+207*scale))<1e-8);
 assert.ok(Math.abs(g.light.y-(plate.y+892*scale))<1e-8);
 assert.ok(g.light.x>g.slot.x+20 && g.light.y<g.slot.y);
});
test('asset is the transparent raster lever wrapped in a self-contained SVG',()=>{
 const svg=read('panel-mosaic-lab/cockpit/assets/parking-brake-off-front-v1.svg');
 assert.match(svg,/<svg[^>]+viewBox="0 0 140 189"/);
 const b64=svg.match(/data:image\/webp;base64,([^"]+)/)?.[1];
 assert.ok(b64,'asset must embed its raster; no separate external image lookup');
 const img=Buffer.from(b64,'base64');
 assert.ok(img.length>3000&&img.length<10000);
 assert.equal(img.subarray(0,4).toString('ascii'),'RIFF');
 assert.equal(img.subarray(8,12).toString('ascii'),'WEBP');
});
test('parking brake owner defaults OFF and emits a single state-change per toggle',()=>{
 api.setEngaged(false);
 let count=0;
 const unsub=api.subscribe(()=>count++);
 assert.equal(api.getState().position,'OFF');
 api.setEngaged(true);api.setEngaged(true);
 assert.equal(api.getState().position,'ON');
 assert.equal(count,1,'unchanged state must not generate duplicate notifications');
 api.toggle();assert.equal(api.getState().position,'OFF');
 assert.equal(count,2);
 unsub();
});
test('lever is mounted on pedestal native layer; lamp on/off with no scene-zoom offsets',()=>{
 const js=read('panel-mosaic-lab/cockpit/parking-brake-unified-v1.js');
 const html=read('panel-mosaic-lab/cockpit/index.html');
 assert.ok(html.includes('parking-brake-unified-v1.js?v=PARK-BRAKE-001-SLOT-LAMP'));
 assert.ok(js.includes('#region-pedestal .region-native .texture-piece[data-piece="throttle-quadrant"]'));
 assert.ok(js.includes("left:(q.light.x-d/2)+'px'"));
 assert.ok(js.includes("top:(q.light.y-d/2)+'px'"));
 assert.ok(js.includes("holder.append(lamp,lever)"));
 assert.ok(js.includes("data-parking-brake=\"ON\""));
 assert.ok(!js.includes('viewport.scrollLeft')&&!js.includes('viewport.scrollTop'));
});
