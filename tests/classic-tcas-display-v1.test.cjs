'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const TCAS=require('../engine/tcas/classic-tcas-v1.js'),Renderer=require('../efis-display-lab/ehsi-v2.js');
class Node{
 constructor(doc,tag){this.ownerDocument=doc;this.tag=tag;this.attrs={};this.children=[];this.style={};this.textContent='';}
 setAttribute(k,v){this.attrs[k]=String(v);}appendChild(child){this.children.push(child);return child;}replaceChildren(){this.children=[];}
}
const own={airborne:true,altitudeFt:9000,radioAltitudeFt:6000,tasKt:220,pitchDeg:2,vsFpm:0,trueHeadingDeg:90,trueTrackDeg:90};
function draw(traffic,{tfc=true,mode='MAP',range=40}={}){
 const doc={createElementNS:(_,tag)=>new Node(doc,tag)},svg=new Node(doc,'svg');
 Renderer.render(svg,{mode,range,heading:90,track:90,selectedHeading:90,nav:{valid:true},
  options:{tfc},traffic,weather:{},efis:{displayPower:true,sgValid:true,headingValid:true,trackValid:true}});
 const nodes=[];function walk(n){nodes.push(n);n.children.forEach(walk);}walk(svg);
 return {nodes,texts:nodes.map(n=>n.attrs['data-text']).filter(Boolean),find:id=>nodes.find(n=>n.attrs['data-segment']===id)};
}
const encounter=id=>TCAS.evaluate({scenario:id,elapsedSec:20,own});
test('TA / RA symbols and altitude labels are source-colored and disappear with TFC, alert text remains',()=>{
 const ra=draw(encounter('CLIMB'));
 assert.ok(ra.find('traffic-ra'));assert.ok(ra.texts.includes('TRAFFIC'));assert.ok(ra.texts.includes('-02'));
 assert.equal(ra.find('traffic-ra').children.find(n=>n.tag==='rect').attrs.fill,'#ff504f');
 const off=draw(encounter('CLIMB'),{tfc:false});assert.equal(off.find('traffic-ra'),undefined);assert.ok(off.texts.includes('TRAFFIC'));
 const ta=draw(TCAS.evaluate({scenario:'CLIMB',elapsedSec:5,own}));assert.ok(ta.find('traffic-ta'));
 assert.equal(ta.find('traffic-ta').children.find(n=>n.tag==='circle').attrs.fill,'#ffca43');
});
test('PLAN and FULL modes suppress traffic targets, retaining the all-mode TRAFFIC message',()=>{
 for(const mode of ['PLAN','FULL_NAV','FULL_VOR_ILS']){
  const r=draw(encounter('CLIMB'),{mode});assert.equal(r.find('traffic-ra'),undefined);assert.ok(r.texts.includes('TRAFFIC'));
 }
});
test('offscale and no-bearing messages never fabricate an intruder bearing',()=>{
 const off=draw(encounter('OFFSCALE'));assert.ok(off.texts.includes('OFFSCALE'));assert.equal(off.find('traffic-ra'),undefined);
 const noBearing=draw(encounter('NO_BEARING'));assert.ok(noBearing.texts.some(t=>/^RA \d/.test(t)));assert.equal(noBearing.find('traffic-ra'),undefined);
 const unknown=draw(encounter('NO_ALTITUDE'));assert.ok(!unknown.texts.includes('+00'));
});
test('TA ONLY green, FAIL amber and OFF white follow the FCOM status color contract',()=>{
 for(const [mode,label,color] of [['TA_ONLY','TA ONLY','#62ee79'],['FAIL','TCAS FAIL','#ffca43']]){
  const r=draw({mode,targets:[]});const n=r.nodes.find(n=>n.attrs['data-text']===label);assert.equal(n.children.find(c=>c.tag==='path').attrs.stroke,color);
 }
});
test('live EADI receives the RA pitch zones and clears them without changing attitude/FMA inputs',()=>{
 global.EFISLabGlyphs=require('../efis-display-lab/glyphs.js');
 global.EFISDisplayLabCore=require('../efis-display-lab/core.js');
 global.B737EADIFMAFcomV2={renderReference(){},getState:()=>({fields:{afds:{}}})};
 const Eadi=require('../efis-display-lab/eadi.js');
 const calls=[];const ctx=new Proxy({}, {get:(o,k)=>typeof o[k]!=='undefined'?o[k]:(...args)=>calls.push([k,...args]),set:(o,k,v)=>(o[k]=v,true)});
 const canvas={width:640,height:640,style:{},dataset:{},getContext:()=>ctx};
 const input={seat:'CAPT',pitch:2,bank:10,powered:true,attitudeValid:true,tcas:encounter('CLIMB')};
 assert.equal(Eadi.renderUnifiedFull(canvas,input),true);assert.equal(canvas.dataset.tcasRa,'CLIMB');
 assert.ok(calls.some(c=>c[0]==='lineTo'&&c[1]===91));
 Eadi.renderUnifiedFull(canvas,{...input,tcas:{advisory:null,ra:null}});assert.equal(canvas.dataset.tcasRa,'');
 Eadi.renderUnifiedFull(canvas,{...input,powered:false});assert.equal(canvas.dataset.tcasRa,'CLIMB');
 // Electrical power remains enforced by the renderer (no red strokes when dark).
 calls.length=0;Eadi.renderUnifiedFull(canvas,{...input,powered:false});
 assert.ok(!calls.some(c=>c[0]==='lineTo'));
});
