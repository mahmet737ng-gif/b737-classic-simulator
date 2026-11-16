'use strict';
// Boeing 737 Classic expanded display: 70-degree window moves through every
// 360-degree bearing, and selected MCP heading vector remains when off-scale.
const test=require('node:test');
const assert=require('node:assert/strict');
const V=require('./ehsi-v2.js');

function fixture(mode='MAP',reference=166,selectedHeading=260){
 return {mode,heading:reference,track:reference,selectedHeading,range:40,
  trueAirspeed:0,groundSpeed:0,efis:{
   displayPower:true,sgValid:true,headingValid:true,trackValid:true,
   brightness:1,wxBrightness:1},
  nav:{valid:false},route:{points:[]},options:{}};
}
function dom(){
 const doc={createElementNS(_ns,tag){return new Element(tag,doc);}};
 class Element{
  constructor(tag,owner){this.tagName=tag;this.ownerDocument=owner;this.children=[];this.attrs={};this.style={};this.id='test-ehsi';}
  setAttribute(name,val){this.attrs[name]=String(val);}
  getAttribute(name){return this.attrs[name]??null;}
  appendChild(child){this.children.push(child);return child;}
  replaceChildren(...children){this.children=[...children];}
 }
 const svg=new Element('svg',doc);
 function search(predicate,node=svg,found=[]){
  if(predicate(node))found.push(node);
  for(const child of node.children)search(predicate,child,found);
  return found;
 }
 const named=name=>search(n=>n.attrs?.['data-segment']===name);
 return {svg,named};
}
function draw(mode,reference,heading){
 const doc=dom();
 V.render(doc.svg,fixture(mode,reference,heading));
 return doc;
}
test('Classic expanded rose remains a 70-degree viewport over a seamless 360-degree heading ring',()=>{
 for(const mode of ['MAP','EXP_NAV','EXP_VOR_ILS']){
  assert.equal(V.LAYOUT[mode].degrees,70);
  for(let bearing=0;bearing<360;bearing++){
   const m=V.model(fixture(mode,bearing,(bearing+180)%360));
   const ref=m.reference;
   assert.equal(ref,bearing,'reference is normalized within 000...359');
   const labels=[];
   for(let major=0;major<360;major+=5){
    const relative=V.rel(major-ref);
    if(Math.abs(relative)<=35)labels.push(major);
   }
   assert.ok(labels.length>=14&&labels.length<=15,
    'All 360 headings retain the correct adjacent tick marks without wrap gaps');
   const selected=V.selectedHeadingPresentation(m,V.LAYOUT[mode]);
   assert.equal(selected.offScale,true);
   assert.equal(selected.vectorVisible,true);
  }
 }
});
test('Heading line persists outside +/-35 degree arc and respects shortest 360 wrap',()=>{
 for(const mode of ['MAP','EXP_NAV','EXP_VOR_ILS']){
  for(const relative of [-179,-100,-36,36,100,179,180]){
   const m=V.model(fixture(mode,166,(166+relative+360)%360));
   const result=V.selectedHeadingPresentation(m,V.LAYOUT[mode]);
   assert.equal(result.vectorVisible,true);
   assert.equal(result.onArc,false,'offscale does not park a false in-range triangle');
   assert.equal(result.offScale,true);
   assert.equal(Math.abs(result.delta),relative===180?180:Math.abs(relative));
   const d=draw(mode,166,m.selectedHeading);
   assert.equal(d.named('heading-bug').length,0,mode+' should not paint off-arc bug');
   assert.equal(d.named('selected-heading-vector').length,1,'offscale line remains');
   const lines=d.named('heading-bug-vector');
   // data-segment is on the polyline/line itself.
   assert.equal(lines.length,1);
   assert.equal(lines[0].getAttribute('data-heading-offscale'),'true');
   assert.equal(lines[0].getAttribute('stroke-dasharray'),'8 18');
   assert.ok(d.named('selected-heading-vector')[0].getAttribute('clip-path').includes('-plot'));
  }
 }
});
test('MCP 359/000 transitions and 35/36 border preserve heading cues without disappearing',()=>{
 for(const [ref,selected,delta,onArc] of [
  [359,0,1,true],[0,359,-1,true],[358,1,3,true],[1,358,-3,true],
  [359,36,37,false],[1,325,-36,false],[355,30,35,true],
  [355,31,36,false],[5,330,-35,true],[5,329,-36,false]
 ]){
  const m=V.model(fixture('MAP',ref,selected));
  const h=V.selectedHeadingPresentation(m,V.LAYOUT.MAP);
  assert.equal(h.delta,delta);
  assert.equal(h.onArc,onArc);
  assert.equal(h.vectorVisible,true);
  const d=draw('MAP',ref,selected);
  assert.equal(d.named('compass-rose').length,1);
  assert.equal(d.named('heading-bug').length,onArc?1:0);
  assert.equal(d.named('heading-bug-vector').length,1);
  assert.equal(d.named('heading-bug-vector')[0].getAttribute('data-heading-offscale'),String(!onArc));
 }
});
test('No invented magenta heading vector when MCP heading missing or PLAN selected',()=>{
 for(const sel of [null,undefined,Number.NaN]){
  const d=draw('MAP',166,sel);
  assert.equal(d.named('heading-bug').length,0);
  assert.equal(d.named('heading-bug-vector').length,0);
 }
 const plan=draw('PLAN',166,260);
 assert.equal(plan.named('heading-bug').length,0);
 assert.equal(plan.named('heading-bug-vector').length,0);
 assert.equal(V.selectedHeadingPresentation(V.model(fixture('PLAN',166,260)),V.LAYOUT.PLAN).vectorVisible,false);
});
test('360 FULL NAV remains distinct from 70 expanded, no fabricated offscale indicator',()=>{
 const full=draw('FULL_NAV',166,260);
 assert.equal(V.LAYOUT.FULL_NAV.degrees,360);
 assert.equal(full.named('heading-bug').length,1);
 assert.equal(full.named('heading-bug-vector').length,0);
 assert.equal(V.selectedHeadingPresentation(V.model(fixture('FULL_NAV',166,260)),V.LAYOUT.FULL_NAV).offScale,false);
});
