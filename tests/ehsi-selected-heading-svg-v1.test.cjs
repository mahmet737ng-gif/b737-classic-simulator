'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const Renderer=require('../efis-display-lab/ehsi-v2.js');
class SVGNode{
 constructor(document,tag){this.ownerDocument=document;this.tag=tag;this.attrs={};this.children=[];this.style={};this.id='';this.textContent='';}
 setAttribute(key,value){this.attrs[key]=String(value);if(key==='id')this.id=String(value);}
 appendChild(child){this.children.push(child);return child;}
 replaceChildren(){this.children=[];}
}
function draw({mode='MAP',track=91,heading=91,selectedHeading=139}={}){
 const document={createElementNS:(_,tag)=>new SVGNode(document,tag)};
 const svg=new SVGNode(document,'svg');svg.setAttribute('id','ehsi-regression');
 const view=Renderer.render(svg,{mode,range:40,heading,track,selectedHeading,trueRef:false,
  nav:{valid:false},efis:{displayPower:true,sgValid:true,headingValid:true,trackValid:true,brightness:1,wxBrightness:1},
  route:{points:[],activeIndex:0},weather:{visible:false},options:{},traffic:{mode:'OFF',targets:[]}});
 const all=[];function visit(node){all.push(node);for(const child of node.children)visit(child);}visit(svg);
 const find=segment=>all.find(x=>x.attrs['data-segment']===segment);
 return {svg,view,find,all};
}
test('offscale heading above right edge has only dashed vector, no triangle or arrow',()=>{
 const r=draw();assert.equal(r.view.compassValid,true);
 const vector=r.find('heading-bug-vector');
 assert.ok(vector,'dashed heading vector must remain');
 assert.equal(r.find('heading-bug-offscale'),undefined);
 assert.equal(r.find('heading-bug'),undefined);
 assert.equal(vector.attrs['data-relative-heading'],'48');
 assert.equal(vector.attrs['data-heading-offscale'],'true');
 assert.equal(vector.attrs['stroke-dasharray'],'8 18');
 const magenta=r.all.filter(x=>x.attrs.stroke==='#e649e7'&&
  (x.tag==='polygon'||x.attrs['data-heading-selected']));
 assert.equal(magenta.length,0,'no extra magenta offscale arrow/triangle');
});
test('offscale heading past left edge also retains only dashed vector',()=>{
 const r=draw({selectedHeading:25});
 assert.equal(r.find('heading-bug-offscale'),undefined);
 assert.equal(r.find('heading-bug'),undefined);
 assert.equal(r.find('heading-bug-vector').attrs['data-relative-heading'],'-66');
 assert.equal(r.find('heading-bug-vector').attrs['stroke-dasharray'],'8 18');
});
test('boundary: bug appears only after heading enters ±35 degree visible scale',()=>{
 const outside=draw({selectedHeading:126.01,heading:91,track:91});
 assert.equal(outside.find('heading-bug'),undefined);
 assert.equal(outside.find('heading-bug-offscale'),undefined);
 assert.ok(outside.find('heading-bug-vector'));
 const inside=draw({selectedHeading:124.99,heading:91,track:91});
 assert.ok(inside.find('heading-bug'));
 assert.equal(inside.find('heading-bug-offscale'),undefined);
});
test('in-range heading uses actual ring position, not an offscale fake',()=>{
 const r=draw({selectedHeading:111});
 assert.ok(r.find('heading-bug'));
 assert.equal(r.find('heading-bug-offscale'),undefined);
});
test('full 360 mode renders heading bug normally at every selected direction',()=>{
 for(const h of [1,95,181,270,359]){
  const r=draw({mode:'FULL_NAV',selectedHeading:h});
  assert.ok(r.find('heading-bug'),'full-rose missing bug at '+h);
  assert.equal(r.find('heading-bug-offscale'),undefined);
 }
});
test('wrap 359 to 000 degrees preserves relative heading sign and no invisible gap',()=>{
 const r=draw({mode:'EXP_NAV',track:355,heading:355,selectedHeading:15});
 assert.ok(r.find('heading-bug'));
 assert.equal(r.find('heading-bug-vector').attrs['data-relative-heading'],'20');
});

test('live EHSI heading / track readout displays MAG M and never TRU',()=>{
 for(const mode of ['MAP','EXP_NAV','FULL_NAV','EXP_VOR_ILS','FULL_VOR_ILS']){
  const screen=draw({mode,track:86.03,heading:86.03,selectedHeading:134});
  const texts=screen.all.map(n=>n.attrs?.['data-text']).filter(Boolean);
  assert.ok(texts.includes('M'),'missing MAG label in '+mode);
  assert.equal(texts.includes('TRU'),false);
 }
});
