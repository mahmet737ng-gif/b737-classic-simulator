'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const Pan=require('../panel-mosaic-lab/cockpit/pan-stability-v1.js');
const root=path.resolve(__dirname,'..');
const cockpit=path.join(root,'panel-mosaic-lab/cockpit');
const file=name=>fs.readFileSync(path.join(cockpit,name),'utf8');
test('gesture step ignores coordinate-space teleports and accepts normal hand motion',()=>{
 const vp={clientWidth:1400,clientHeight:760};
 assert.deepEqual(Pan.step({x:300,y:400},{x:320,y:385},vp),{accepted:true,dx:20,dy:-15});
 assert.equal(Pan.step({x:320,y:385},{x:15000,y:-7300},vp).accepted,false);
 assert.equal(Pan.step({x:15000,y:-7300},{x:15006,y:-7296},vp).accepted,true,
  'Move after bad packet uses new previous coordinate instead of recursing into a jump');
 assert.equal(Pan.step({x:0,y:0},{x:0,y:1000},vp).accepted,false);
 assert.equal(Pan.step({x:0,y:0},{x:NaN,y:10},vp).accepted,false);
});
test('incremental movement clamps in both axes without exposing invalid scroll coordinates',()=>{
 const vp={scrollLeft:40,scrollTop:100,scrollWidth:4100,scrollHeight:3200,clientWidth:1000,clientHeight:600};
 assert.equal(Pan.boundedPan(vp,-60,-15),true);
 assert.deepEqual([vp.scrollLeft,vp.scrollTop],[100,115]);
 Pan.boundedPan(vp,-9000,-9000);
 assert.deepEqual([vp.scrollLeft,vp.scrollTop],[3100,2600]);
 Pan.boundedPan(vp,10000,10000);
 assert.deepEqual([vp.scrollLeft,vp.scrollTop],[0,0]);
 assert.equal(Pan.boundedPan(vp,Infinity,10),false);
 assert.deepEqual([vp.scrollLeft,vp.scrollTop],[0,0]);
});
test('active visual-first user zoom + pan is restored exactly at hydration',()=>{
 const canvas={width:4400,height:8100},vp={clientWidth:1410,clientHeight:762};
 const save={interacted:true,zoom:.55,left:680,top:1270,focused:'main'};
 const restored=Pan.handoff(save,canvas,vp);
 assert.equal(restored.zoom,.55);
 assert.equal(restored.left,680);
 assert.equal(restored.top,1270);
 assert.equal(restored.sceneLeft,0);
 assert.equal(restored.sceneTop,0);
 assert.equal(restored.focused,'main');
 const sourceBefore=(save.left+vp.clientWidth/2)/save.zoom;
 const sourceAfter=(restored.left+vp.clientWidth/2-restored.sceneLeft)/restored.zoom;
 assert.equal(sourceAfter,sourceBefore,'source pixel under center must not jump');
});
test('handoff is inapplicable if the user did not navigate early',()=>{
 assert.equal(Pan.handoff({interacted:false,zoom:.2}, {width:4400,height:8100},{clientWidth:1400,clientHeight:700}),null);
 assert.equal(Pan.handoff({interacted:true,zoom:NaN}, {width:4400,height:8100},{clientWidth:1400,clientHeight:700}),null);
});
test('small canvas remains centered while handed-off scroll is in range',()=>{
 const h=Pan.handoff({interacted:true,zoom:.1,left:800,top:900},
  {width:4400,height:1200},{clientWidth:1400,clientHeight:700});
 assert.equal(h.left,0);
 assert.equal(h.top,0);
 assert.equal(h.sceneLeft,480);
 assert.equal(h.sceneTop,290);
});
test('startup adopts existing early pan instead of resetting focus; all scripted pan requires guarded movement',()=>{
 const app=file('app.js'),first=file('visual-first-shell-v1.js'),html=file('index.html'),style=file('style.css');
 assert.match(first,/B737VisualFirstShellV1\.snapshot=\(\)=>/);
 assert.match(first,/if\(win\.B737VisualFirstShellV1\.adopted\|\|interacted\)return/);
 assert.match(app,/const visualHandoff=panGuard\?\.handoff/);
 assert.ok(app.indexOf('const visualHandoff=panGuard?.handoff')<app.indexOf('  mount();'));
 assert.match(app,/if\(visualHandoff\)[\s\S]*?else focus\(window\.B737VisualFirstShellV1/);
 assert.equal((app.match(/panGuard\.boundedPan\(vp,step\.dx,step\.dy\)/g)||[]).length,2,
  'parent and iframe both use incremental guarded movement');
 assert.match(app,/finishWheelZoom\(\);wheelController\?\.cancel\(\);endParentDrag\(\);/);
 assert.match(html,/pan-stability-v1\.js\?v=PAN-STABLE-0004/);
 assert.ok(html.indexOf('pan-stability-v1.js')<html.indexOf('app.js?'));
 assert.match(style,/#viewport,#sizer,#scene\{overflow-anchor:none;scroll-behavior:auto\}/);
});
test('resize anchor adjustment keeps same source pixel at viewport center',()=>{
 const currentZoom=.7,oldW=1400,oldH=800,newW=1100,newH=600;
 const scrollX=1200,scrollY=1500;
 const preservedLeft=scrollX+(oldW-newW)/2;
 const preservedTop=scrollY+(oldH-newH)/2;
 const oldCenterX=(scrollX+oldW/2)/currentZoom;
 const oldCenterY=(scrollY+oldH/2)/currentZoom;
 const newCenterX=(preservedLeft+newW/2)/currentZoom;
 const newCenterY=(preservedTop+newH/2)/currentZoom;
 assert.equal(newCenterX,oldCenterX);assert.equal(newCenterY,oldCenterY);
 assert.match(file('app.js'),/oldWidth-vp\.clientWidth/);
 assert.match(file('app.js'),/oldHeight-vp\.clientHeight/);
});
