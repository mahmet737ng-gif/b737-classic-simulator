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
test('selected HDG 139 true on TRK 091 full cockpit expanded display is NOT invisible',()=>{
 const r=draw();assert.equal(r.view.compassValid,true);
 const cue=r.find('heading-bug-offscale');
 const vector=r.find('heading-bug-vector');
 assert.ok(cue,'magenta heading bug edge cue must be present');
 assert.ok(vector,'true radial heading vector must be present');
 assert.equal(vector.attrs['data-relative-heading'],'48');
 assert.equal(vector.attrs['data-heading-offscale'],'true');
 assert.ok(cue.attrs.transform.includes('translate(456.'),'cue must be on right edge');
 const colorPaths=r.all.filter(x=>x.attrs.stroke==='#e649e7');
 assert.ok(colorPaths.length>=2,'magenta heading elements must be rendered');
});
test('offscale heading below left edge also retains marker and true vector',()=>{
 const r=draw({selectedHeading:25});
 assert.ok(r.find('heading-bug-offscale'));
 assert.equal(r.find('heading-bug-vector').attrs['data-relative-heading'],'-66');
 assert.ok(r.find('heading-bug-offscale').attrs.transform.includes('translate(55.'));
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
