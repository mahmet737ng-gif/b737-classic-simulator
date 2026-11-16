'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {URL}=require('node:url');
const Wheel=require('../engine/instruments/mechanical-number-wheels-v1.js');
const source=fs.readFileSync(path.resolve(__dirname,'../panel-mosaic-lab/cockpit/instrument-lab/gauges.js'),'utf8');
function photo(){
 class Node{
  constructor(tag){this.tag=tag;this.attrs={};this.children=[];this.style={};this.textContent='';this.listeners={};this.parentNode=null;}
  setAttribute(k,v){this.attrs[k]=String(v);}
  getAttribute(k){return this.attrs[k]??null;}
  append(child){this.children.push(child);child.parentNode=this;return child;}
  addEventListener(k,f){this.listeners[k]=f;}
 }
 const document={baseURI:'https://example.invalid/panel-mosaic-lab/cockpit/instrument-lab/',
  getElementById:()=>({getAttribute:()=>null}),createElementNS:(ns,tag)=>new Node(tag)};
 const window={B737MechanicalNumberWheelsV1:Wheel};
 vm.runInNewContext(source,{window,document,URL});
 const tree=root=>{const out=[];function visit(node){out.push(node);for(const child of node.children)visit(child)}visit(root);return out};
 return {api:window.B737PhotoGauges,host:new Node('div'),tree};
}
test('actual airspeed SVG creates three physically clipped rolling columns',()=>{
 const p=photo(),g=p.api.createGauge(p.host,'airspeed');
 const nodes=p.tree(g.canvas),w=nodes.filter(n=>n.attrs['data-rolling-digits']==='airspeed');
 const columns=nodes.filter(n=>n.attrs['data-rolling-column']!==undefined);
 assert.equal(w.length,1);assert.equal(columns.length,3);
 assert.equal(nodes.filter(n=>n.tag==='clipPath').length,3);
 g.render({...p.api.defaults,ias:190.5,altitude:5000},false);
 const units=columns.find(n=>n.attrs['data-rolling-column']==='2');
 assert.ok(units.attrs.transform.includes('translate(0 -'));
 assert.deepEqual(units.children.map(x=>x.textContent),['9','0','1']);
});
test('actual ALT SVG switches from four to five rotating digit drums at 10,000ft',()=>{
 const p=photo(),g=p.api.createGauge(p.host,'altimeter');
 const nodes=p.tree(g.canvas),groups=nodes.filter(n=>n.attrs['data-rolling-digits']==='altimeter');
 assert.equal(groups.length,2);
 assert.deepEqual(groups.map(g=>g.attrs['data-rolling-count']),['4','5']);
 g.render({...p.api.defaults,altitude:4660},false);
 assert.equal(groups[0].attrs.display,'inline');assert.equal(groups[1].attrs.display,'none');
 g.render({...p.api.defaults,altitude:12000},false);
 assert.equal(groups[0].attrs.display,'none');assert.equal(groups[1].attrs.display,'inline');
});
test('photo airspeed orange bug sprites disappear when MCP command is unavailable',()=>{
 const p=photo(),g=p.api.createGauge(p.host,'airspeed',{lockOrangeBugs:true});
 const nodes=p.tree(g.canvas);
 const oranges=nodes.filter(n=>n.tag==='image'&&/orange-[12]\.png$/.test(n.attrs.href||''));
 assert.equal(oranges.length,2);
 g.render({...p.api.defaults,orangeBugs:[null,null]},false);
 assert.ok(oranges.every(n=>n.attrs.display==='none'));
 g.render({...p.api.defaults,orangeBugs:[240,240]},false);
 assert.ok(oranges.every(n=>n.attrs.display==='inline'));
});
