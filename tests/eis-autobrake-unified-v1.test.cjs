'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const M=require('../engine/systems/autobrake-classic-v1.js');
const EIS=require('../panel-mosaic-lab/cockpit/eis-autobrake-physical-v1.js');
const CONV=require('../panel-mosaic-lab/cockpit/conventional-physical-controls-v1.js');
const root=path.resolve(__dirname,'..');
const file=p=>fs.readFileSync(path.join(root,p),'utf8');
const html=file('panel-mosaic-lab/cockpit/index.html');
const css=file('panel-mosaic-lab/cockpit/eis-autobrake-physical-v1.css');
const originalConv=file('panel-mosaic-lab/cockpit/conventional-physical-controls-v1.js');
assert.deepEqual(EIS.DETENTS,M.DETENTS);
assert.deepEqual(EIS.DETENTS,CONV.DETENTS,'EIS and Conventional must share 6 physical positions');
assert.deepEqual(EIS.ANGLES,CONV.ANGLES,'Same knob rotation and detent direction');
assert.match(css,/data-engine-indication="EIS"/);
assert.match(css,/\.b737-eis-autobrake-rotary/);
assert.match(css,/display:none/);
assert.ok(!css.includes('data-engine-indication="CONVENTIONAL"] #region-main .region-native>.b737-eis'),'EIS knob must not cover Conventional');
assert.ok(html.includes('eis-autobrake-physical-v1.js?v=EIS-AUTOBRAKE-0003-RING-FIT'),'Updated EIS position must invalidate cached cockpit script');
assert.ok(html.includes('eis-autobrake-physical-v1.css?v=EIS-AUTOBRAKE-0001'));
assert.ok(html.includes('autobrake-unified-v1.js?v=ATA32-AUTOBRAKE-SHARED-0001'));
assert.ok(originalConv.includes("common.setSelector(next)"),'Conventional remains tied to existing shared system');
const assembly=JSON.parse(file('panel-mosaic-lab/cockpit/assembly.json'));
const main=assembly.regions.find(x=>x.id==='main');
const fo=main.placements.find(p=>p.id==='fo-inner');
const engine=main.placements.find(p=>p.id==='engine');
const eit=EIS.placement(fo);
assert.equal(assembly.assets[fo.asset].dimensions[0],EIS.REF.image[0]);
assert.equal(assembly.assets[fo.asset].dimensions[1],EIS.REF.image[1]);
const cp={sourceWidth:CONV.REF.image[0],sourceHeight:CONV.REF.image[1],
 x:engine.x,y:engine.y,matrix:[(1374-engine.x)/CONV.REF.image[0],0,0,engine.h/CONV.REF.image[1],0,0]};
const conv=CONV.point(cp,CONV.REF.autobrake.center);
// EIS screenshot-pixel QA (1920x1080 user photograph 2026-11-05).
// The previous knob was 120px right and 82px above the empty hole.
// Its circular base measured 88.8px across; the white bezel measured
// 139px. Keep the same rotary image, detents and axis, but move/scale
// the EIS view until the white ring is visible all the way around.
assert.deepEqual(EIS.REF.center,[67.5,915],'EIS knob must follow measured ring center');
assert.equal(EIS.REF.diameter,108,'Resize only EIS knob to fit inside white bezel');
assert.equal(CONV.REF.autobrake.diameter,80,'Conventional approved diameter is untouched');
const calibrated={
 priorReference:[175,841],priorCenterPx:[1108.5,638.5],
 wellCenterPx:[988.5,720.5],baseDiameterPx:88.8,bezelOuterDiameterPx:139
};
const scalePxPerSource=calibrated.baseDiameterPx/CONV.REF.autobrake.diameter;
const expectedCenterPx=[
 calibrated.priorCenterPx[0]+(EIS.REF.center[0]-calibrated.priorReference[0])*scalePxPerSource,
 calibrated.priorCenterPx[1]+(EIS.REF.center[1]-calibrated.priorReference[1])*scalePxPerSource
];
assert.ok(Math.abs(expectedCenterPx[0]-calibrated.wellCenterPx[0])<2,
 'Photo-derived EIS knob X must coincide with actual hole center');
assert.ok(Math.abs(expectedCenterPx[1]-calibrated.wellCenterPx[1])<2,
 'Photo-derived EIS knob Y must coincide with actual hole center');
const fittedBasePx=EIS.REF.diameter*scalePxPerSource;
const visibleWhiteRingPx=(calibrated.bezelOuterDiameterPx-fittedBasePx)/2;
assert.ok(visibleWhiteRingPx>=7 && visibleWhiteRingPx<=13,
 'White aperture ring must remain visible at every side of round knob base');
assert.ok(Math.abs(eit.w-fo.w*EIS.REF.diameter/918)<1e-9 &&
 Math.abs(eit.h-fo.h*EIS.REF.diameter/1713)<1e-9,
 'EIS hitbox and image remain proportional to physical photo registration');
assert.ok(eit.x>fo.x&&eit.x<fo.x+fo.w);
assert.ok(eit.w>0&&eit.h>0);
assert.throws(()=>EIS.placement({x:0,y:0,w:0,h:4}),/placement/);
const handlers={};
class Node{
 constructor(tag){this.tagName=tag;this.style={};this.dataset={};this.attrs={};this.children=[];
  this.listeners={};this.parentElement=null;}
 setAttribute(k,v){this.attrs[k]=v;}
 getAttribute(k){return this.attrs[k];}
 addEventListener(type,fn){(this.listeners[type]??=[]).push(fn);}
 dispatch(type,extra={}){const e={type,key:extra.key,deltaY:extra.deltaY,shiftKey:extra.shiftKey||false,
  defaultPrevented:false,preventDefault(){this.defaultPrevented=true;},stopPropagation(){},...extra};
  for(const cb of this.listeners[type]||[])cb(e);return e;}
 append(child){child.parentElement=this;this.children.push(child);}
 querySelector(sel){if(sel==='img')return this.children.find(c=>c.tagName==='img')||null;return null;}
}
const scene=new Node('div'),parent=new Node('div'),piece=new Node('div');piece.style={left:fo.x+'px',top:fo.y+'px',width:fo.w+'px',height:fo.h+'px'};
parent.querySelector=selector=>selector==='.texture-piece[data-piece="fo-inner"]'?piece:null;
const dom={baseURI:'https://example.test/b737-classic-simulator/panel-mosaic-lab/cockpit/',
 readyState:'complete',documentElement:{dataset:{engineIndication:'EIS'}},
 body:scene,createElement:tag=>new Node(tag),
 querySelector:selector=>selector==='#region-main .region-native'?parent:null,
 getElementById:id=>id==='scene'?scene:null,
 addEventListener(type,fn){(handlers[type]??=[]).push(fn);}
};
const core=M.create(),winHandlers={};
const shared={getState:()=>core.getState(),setSelector:detent=>core.select(detent)};
const win={document:dom,B737AutobrakeUnified:shared,
 addEventListener(type,fn){(winHandlers[type]??=[]).push(fn);},
 requestAnimationFrame(fn){fn();},
 dispatchEvent(event){for(const f of winHandlers[event.type]||[])f(event);},
 CustomEvent:class{constructor(type,init){this.type=type;this.detail=init.detail;}},
 MutationObserver:class{observe(){}disconnect(){}}
};
const api=EIS.install(win);
assert.equal(api.getState().ready,true);
assert.equal(api.getState().visible,true);
assert.equal(parent.children.length,1);
const knob=parent.children[0],image=knob.querySelector('img');
assert.equal(knob.tagName,'button');
assert.equal(knob.attrs.role,'slider');
assert.equal(knob.attrs['aria-valuenow'],'1');
assert.ok(image.src.endsWith('/shared-assets/DUMMY')===false);
assert.ok(image.src.includes('rotary-standard-v1.webp'));
assert.equal(Number.parseFloat(knob.style.left),Number(eit.x.toFixed(3)));
assert.equal(Number.parseFloat(knob.style.top),Number(eit.y.toFixed(3)));
assert.equal(knob.dataset.detent,'OFF');
knob.dispatch('click');
assert.equal(core.getState().selector,'1','EIS click selects detent in shared engine');
assert.equal(knob.dataset.detent,'1');
knob.dispatch('wheel',{deltaY:-2});
assert.equal(core.getState().selector,'2','EIS wheel selects upward');
knob.dispatch('wheel',{deltaY:3});
assert.equal(core.getState().selector,'1','EIS wheel selects downward');
knob.dispatch('keydown',{key:'Home'});
assert.equal(core.getState().selector,'RTO');
assert.equal(core.getState().phase,'SELF_TEST');
assert.equal(core.getState().disarmLight,true,'RTO lights AUTO BRAKE DISARM during 1.5 s test');
core.advance(1499);assert.equal(core.getState().disarmLight,true);
core.advance(1);assert.equal(core.getState().disarmLight,false);
knob.dispatch('keydown',{key:'End'});
assert.equal(core.getState().selector,'MAX');
knob.dispatch('keydown',{key:'ArrowLeft'});
assert.equal(core.getState().selector,'3');
knob.dispatch('contextmenu');
assert.equal(core.getState().selector,'2');
dom.documentElement.dataset.engineIndication='CONVENTIONAL';
win.dispatchEvent(new win.CustomEvent('b737:engine-indication-view',{detail:{display:'CONVENTIONAL'}}));
assert.equal(api.getState().visible,false,'Conventional overlays hide EIS knob without destroying its state');
assert.equal(core.getState().selector,'2','Changing display must not reset backend autobrake');
dom.documentElement.dataset.engineIndication='EIS';
win.dispatchEvent(new win.CustomEvent('b737:engine-indication-view',{detail:{display:'EIS'}}));
assert.equal(api.getState().visible,true);
assert.equal(parent.children.length,1,'Mode changes must not duplicate EIS physical knob');
assert.equal(knob.dataset.detent,'2');
shared.setSelector('RTO');win.dispatchEvent(new win.CustomEvent('b737:autobrake-state',{detail:core.getState()}));
assert.equal(knob.dataset.detent,'RTO','EIS follows changes made by Conventional or instructor');
core.update({antiskidOn:false});core.advance(1500);
assert.equal(core.getState().phase,'FAILED','ANTISKID OFF fails RTO self-test in shared source');
assert.equal(core.getState().disarmLight,true);
console.log('PASS EIS AUTO BRAKE: photo-aligned physical knob, no duplicate sprite, 6 shared detents, click/wheel/keyboard, 1500ms RTO lamp, antiskid and mode switching.');
